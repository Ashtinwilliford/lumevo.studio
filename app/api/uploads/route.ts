import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import busboy from "busboy";
import { Readable } from "stream";
import OpenAI from "openai";

const execAsync = promisify(exec);

const ai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY!,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export const maxDuration = 60;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const result = await query(
    `SELECT id, file_type, file_name, mime_type, file_size, analysis_status,
            transcript_text, file_path, thumb_path, ai_analysis, video_duration_sec, created_at
     FROM uploads WHERE user_id = $1 ORDER BY created_at DESC`,
    [session.id]
  );

  return NextResponse.json({ uploads: result.rows });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const contentType = req.headers.get("content-type") || "";

  // === Multipart upload — uses busboy to stream files with no size limit ===
  if (contentType.includes("multipart/form-data")) {
    try {
      const userDir = join(process.cwd(), "public", "media", session.id);
      await mkdir(userDir, { recursive: true });

      type ParsedFile = { fieldname: string; filename: string; mimetype: string; data: Buffer; size: number };
      const parsedFiles: ParsedFile[] = [];
      let projectId: string | null = null;

      await new Promise<void>((resolve, reject) => {
        const bb = busboy({ headers: { "content-type": contentType }, limits: { files: 10, fileSize: 500 * 1024 * 1024 } });

        bb.on("field", (name, val) => { if (name === "project_id") projectId = val; });
        bb.on("file", (fieldname, stream, info) => {
          const chunks: Buffer[] = [];
          stream.on("data", (c: Buffer) => chunks.push(c));
          stream.on("end", () => {
            parsedFiles.push({ fieldname, filename: info.filename, mimetype: info.mimeType, data: Buffer.concat(chunks), size: Buffer.concat(chunks).length });
          });
          stream.on("error", reject);
        });
        bb.on("finish", resolve);
        bb.on("error", reject);

        // Pipe the request body into busboy
        const nodeStream = Readable.fromWeb(req.body as import("stream/web").ReadableStream);
        nodeStream.pipe(bb);
      });

      if (!parsedFiles.length) {
        return NextResponse.json({ error: "No files provided" }, { status: 400 });
      }

      const uploads = [];

      for (const file of parsedFiles) {
        const isVideo = file.mimetype.startsWith("video/");
        const isImage = file.mimetype.startsWith("image/");
        const isAudio = file.mimetype.startsWith("audio/");
        const fileType = isVideo ? "video" : isImage ? "image" : isAudio ? "audio" : "text";

        const ext = file.filename.split(".").pop()?.toLowerCase() || (isVideo ? "mp4" : isImage ? "jpg" : "bin");
        const insertRow = await query(
          `INSERT INTO uploads (user_id, project_id, file_type, file_name, mime_type, file_size, analysis_status)
           VALUES ($1, $2, $3, $4, $5, $6, 'processing') RETURNING id`,
          [session.id, projectId || null, fileType, file.filename, file.mimetype, file.size]
        );
        const uploadId: string = (insertRow.rows[0] as { id: string }).id;

        const fileName = `${uploadId}.${ext}`;
        const filePath = join(userDir, fileName);
        await writeFile(filePath, file.data);

        const relPath = `/media/${session.id}/${fileName}`;
        await query("UPDATE uploads SET file_path = $1 WHERE id = $2", [relPath, uploadId]);

        let thumbPath: string | null = null;
        let videoDuration: number | null = null;

        if (isVideo) {
          const thumbName = `${uploadId}_thumb.jpg`;
          const thumbFilePath = join(userDir, thumbName);
          try {
            const { stdout: durationOut } = await execAsync(
              `ffprobe -v error -show_entries format=duration -of csv=p=0 "${filePath}"`
            );
            videoDuration = parseFloat(durationOut.trim()) || null;
            await execAsync(
              `ffmpeg -y -ss 1 -i "${filePath}" -frames:v 1 -q:v 3 -vf "scale=400:-1" "${thumbFilePath}" 2>/dev/null`
            );
            thumbPath = `/media/${session.id}/${thumbName}`;
          } catch (e) {
            console.warn("Thumbnail extraction failed:", e);
          }
        } else if (isImage) {
          const thumbName = `${uploadId}_thumb.jpg`;
          const thumbFilePath = join(userDir, thumbName);
          try {
            await execAsync(`ffmpeg -y -i "${filePath}" -vf "scale=400:-1" "${thumbFilePath}" 2>/dev/null`);
            thumbPath = `/media/${session.id}/${thumbName}`;
          } catch {
            thumbPath = relPath;
          }
        }

        if (thumbPath) {
          await query("UPDATE uploads SET thumb_path = $1, video_duration_sec = $2 WHERE id = $3", [thumbPath, videoDuration, uploadId]);
        }

        analyzeWithVision(uploadId, filePath, thumbPath, fileType, file.filename, session.id).catch(console.error);
        uploads.push({ id: uploadId, file_name: file.filename, file_type: fileType, file_path: relPath, thumb_path: thumbPath, analysis_status: "processing" });
      }

      await query(
        `UPDATE brand_profiles SET upload_count = upload_count + $1,
         learning_progress_percent = LEAST(100, learning_progress_percent + $2),
         confidence_score = LEAST(100, confidence_score + $3),
         updated_at = NOW() WHERE user_id = $4`,
        [uploads.length, uploads.length * 3, uploads.length * 2, session.id]
      ).catch(() => null);

      return NextResponse.json({ uploads });
    } catch (err) {
      console.error("Multipart upload error:", err);
      return NextResponse.json({ error: "Upload failed — " + (err instanceof Error ? err.message : "unknown error") }, { status: 500 });
    }
  }

  // === Legacy JSON upload (backwards compatibility for text/caption) ===
  try {
    const body = await req.json();
    const { file_name, file_type, mime_type, file_size, file_data, project_id } = body;

    if (!file_name || !file_type) {
      return NextResponse.json({ error: "file_name and file_type required" }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO uploads (user_id, project_id, file_type, file_name, mime_type, file_size, file_data, analysis_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING id, file_name, file_type, analysis_status, created_at`,
      [session.id, project_id || null, file_type, file_name, mime_type || null, file_size || 0, file_data || null]
    );

    await query(
      `UPDATE brand_profiles SET upload_count = upload_count + 1,
       learning_progress_percent = LEAST(100, learning_progress_percent + 3),
       confidence_score = LEAST(100, confidence_score + 2),
       updated_at = NOW() WHERE user_id = $1`,
      [session.id]
    ).catch(() => null);

    const upload = result.rows[0];
    if (file_type === "caption" || file_type === "script" || file_type === "text") {
      await query(
        `UPDATE uploads SET analysis_status = 'complete', transcript_text = $1 WHERE id = $2`,
        [file_data || file_name, upload.id as string]
      );
    }
    return NextResponse.json({ upload });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// Background AI Vision analysis for each upload
async function analyzeWithVision(
  uploadId: string,
  filePath: string,
  thumbPath: string | null,
  fileType: string,
  fileName: string,
  _userId: string
) {
  try {
    // Get the image to analyze (thumb for videos, original for images)
    const analysisPath = thumbPath
      ? join(process.cwd(), "public", thumbPath)
      : fileType === "image"
      ? filePath
      : null;

    if (!analysisPath) {
      await query(
        `UPDATE uploads SET analysis_status = 'complete', ai_analysis = $1 WHERE id = $2`,
        [JSON.stringify({ description: "Audio file — no visual analysis", energy: "audio", bestUse: "background or narration" }), uploadId]
      );
      return;
    }

    // Resize image for Vision API (max 512px wide)
    const resizedPath = filePath + "_vision.jpg";
    await execAsync(`ffmpeg -y -i "${analysisPath}" -vf "scale='min(512,iw)':-1" -q:v 5 "${resizedPath}" 2>/dev/null`);

    const { readFile } = await import("fs/promises");
    const imgBuffer = await readFile(resizedPath);
    const imgBase64 = imgBuffer.toString("base64");
    execAsync(`rm -f "${resizedPath}"`).catch(() => null);

    const response = await ai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${imgBase64}`, detail: "low" },
            },
            {
              type: "text",
              text: `Analyze this media frame for social media video editing. File: "${fileName}". Respond with ONLY this JSON:
{
  "description": "one sentence describing what's in the frame",
  "energy": "low|medium|high",
  "vibe": "one phrase like 'calm and aesthetic' or 'raw and intense'",
  "setting": "outdoor|indoor|studio|travel|lifestyle|other",
  "subjects": "what/who is the main focus",
  "bestUse": "hook|main content|b-roll|outro",
  "colorTone": "warm|cool|neutral|vibrant|dark"
}`,
            },
          ],
        },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() || "{}";
    let analysis: Record<string, string> = {};
    try {
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```/g, "").trim();
      analysis = JSON.parse(cleaned);
    } catch {
      analysis = { description: raw.slice(0, 100), energy: "medium", bestUse: "main content" };
    }

    await query(
      `UPDATE uploads SET analysis_status = 'complete', ai_analysis = $1 WHERE id = $2`,
      [JSON.stringify(analysis), uploadId]
    );
  } catch (err) {
    console.error("Vision analysis failed:", err);
    await query(
      `UPDATE uploads SET analysis_status = 'complete', ai_analysis = $1 WHERE id = $2`,
      [JSON.stringify({ description: "Analysis unavailable", energy: "medium", bestUse: "main content" }), uploadId]
    );
  }
}
