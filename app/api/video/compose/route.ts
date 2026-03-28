import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import { writeFile, unlink, readFile, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { exec } from "child_process";
import { promisify } from "util";
import OpenAI from "openai";
import { ReplitConnectors } from "@replit/connectors-sdk";

export const maxDuration = 120;

const execAsync = promisify(exec);
const ai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY!,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const VIDEO_W = 1080;
const VIDEO_H = 1920;

interface UploadRow {
  id: string;
  file_name: string;
  file_type: string;
  file_path: string | null;
  thumb_path: string | null;
  ai_analysis: Record<string, string> | null;
  video_duration_sec: number | null;
}

interface TimelineClip {
  uploadId: string;
  trimStart: number;
  trimEnd: number;
  purpose: string;
  note?: string;
}

interface Timeline {
  rationale: string;
  clips: TimelineClip[];
  totalDuration: number;
}

// Scale + pad any input to 1080x1920 (vertical)
const SCALE_FILTER = `scale=${VIDEO_W}:${VIDEO_H}:force_original_aspect_ratio=decrease,pad=${VIDEO_W}:${VIDEO_H}:(ow-iw)/2:(oh-ih)/2:color=black`;

async function getVideoDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of csv=p=0 "${filePath}"`
    );
    return parseFloat(stdout.trim()) || 5;
  } catch {
    return 5;
  }
}

// Convert a single clip (video trim or image) to a normalized mp4 segment
async function makeClip(
  upload: UploadRow,
  trimStart: number,
  trimEnd: number,
  outPath: string
): Promise<boolean> {
  const absPath = upload.file_path
    ? join(process.cwd(), "public", upload.file_path)
    : null;

  if (!absPath) return false;

  const duration = Math.max(1, trimEnd - trimStart);

  try {
    if (upload.file_type === "image") {
      // Image → video with Ken Burns zoom
      await execAsync(
        `ffmpeg -y -loop 1 -i "${absPath}" -t ${duration} ` +
        `-vf "${SCALE_FILTER},zoompan=z='min(zoom+0.0008,1.3)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${Math.round(duration * 30)}:s=${VIDEO_W}x${VIDEO_H},fps=30" ` +
        `-an -c:v libx264 -preset fast -crf 24 -pix_fmt yuv420p "${outPath}"`,
        { timeout: 60000 }
      );
    } else {
      // Video trim + scale
      const realDuration = await getVideoDuration(absPath);
      const safeStart = Math.min(trimStart, Math.max(0, realDuration - 2));
      const safeDuration = Math.min(duration, realDuration - safeStart);
      await execAsync(
        `ffmpeg -y -ss ${safeStart.toFixed(2)} -i "${absPath}" -t ${safeDuration.toFixed(2)} ` +
        `-vf "${SCALE_FILTER},fps=30" ` +
        `-an -c:v libx264 -preset fast -crf 24 -pix_fmt yuv420p "${outPath}"`,
        { timeout: 60000 }
      );
    }
    return true;
  } catch (err) {
    console.error(`Clip encode failed for ${upload.file_name}:`, err);
    return false;
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, uploadIds, script, title, vibe, platform, duration, useVoiceClone, audioBase64 } =
    await req.json() as {
      projectId?: string;
      uploadIds: string[];
      script: string;
      title: string;
      vibe?: string;
      platform?: string;
      duration?: number;
      useVoiceClone?: boolean;
      audioBase64?: string | null;
    };

  if (!uploadIds?.length || !script?.trim()) {
    return NextResponse.json({ error: "uploadIds and script required" }, { status: 400 });
  }

  const userId = session.id;
  const targetDuration = duration || 30;
  const tmpDir = tmpdir();
  const jobId = `compose_${userId.slice(0, 8)}_${Date.now()}`;
  const tempFiles: string[] = [];

  try {
    // === 1. Fetch uploads + brand profile ===
    const placeholders = uploadIds.map((_: string, i: number) => `$${i + 2}`).join(", ");
    const uploadRows = await query(
      `SELECT id, file_name, file_type, file_path, thumb_path, ai_analysis, video_duration_sec
       FROM uploads WHERE user_id = $1 AND id IN (${placeholders})`,
      [userId, ...uploadIds]
    );
    const uploads = uploadRows.rows as UploadRow[];

    const brandRows = await query("SELECT * FROM brand_profiles WHERE user_id = $1", [userId]);
    const brand = brandRows.rows[0] as Record<string, unknown> | undefined;
    const userRows = await query("SELECT name, elevenlabs_voice_id FROM users WHERE id = $1", [userId]);
    const user = userRows.rows[0] as Record<string, unknown> | undefined;

    // === 2. Build clip summaries for AI ===
    const clipSummaries = uploads
      .filter(u => u.file_path)
      .map(u => {
        const a = u.ai_analysis || {};
        const dur = u.video_duration_sec ? `${u.video_duration_sec.toFixed(1)}s video` : "image";
        return `ID: ${u.id} | ${u.file_name} | ${dur} | ${a.description || "no description"} | Energy: ${a.energy || "?"} | Vibe: ${a.vibe || "?"} | Best use: ${a.bestUse || "any"}`;
      })
      .join("\n");

    const brandCtx = brand
      ? [
          brand.tone_summary && `Tone: ${brand.tone_summary}`,
          brand.personality_summary && `Personality: ${brand.personality_summary}`,
          brand.voice_preferences && `Voice style: ${brand.voice_preferences}`,
          brand.pacing_style && `Pacing: ${brand.pacing_style}`,
        ].filter(Boolean).join("\n")
      : "Energetic, authentic, personal content.";

    // === 3. AI Timeline Generation ===
    const timelinePrompt = `You are an expert video editor creating a ${targetDuration}-second ${platform || "short-form"} video for ${user?.name || "a creator"}.

Creator's brand:
${brandCtx}

Video details:
- Title: "${title}"
- Vibe: "${vibe || "engaging and authentic"}"
- Target duration: ${targetDuration} seconds
- Script (narration): ${script.slice(0, 600)}

Available media clips (analyze each carefully):
${clipSummaries}

Your job: Create a timeline that combines these clips into a compelling ${targetDuration}-second video.

Rules:
- Total clip time MUST add up to exactly ${targetDuration} seconds
- Put the most visually striking clip first (the hook) — viewers decide in 2 seconds
- Match clip energy to the script section being narrated
- You CAN use the same clip multiple times with different trim points
- Images should be 3-5 seconds each (you control duration via trimEnd-trimStart)
- For videos, trimStart and trimEnd define which part to use (stay within the video's duration)
- If only images are provided, use 3-5s per image
- Order clips to match the narrative flow of the script

RESPOND WITH ONLY THIS JSON (no markdown):
{
  "rationale": "one sentence explaining your edit choices",
  "clips": [
    { "uploadId": "exact-id-from-list", "trimStart": 0, "trimEnd": 5, "purpose": "hook", "note": "why this clip here" }
  ],
  "totalDuration": ${targetDuration}
}`;

    const timelineRes = await ai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1200,
      temperature: 0.6,
      messages: [{ role: "user", content: timelinePrompt }],
      response_format: { type: "json_object" },
    });

    let timeline: Timeline;
    try {
      const raw = timelineRes.choices[0]?.message?.content || "{}";
      timeline = JSON.parse(raw) as Timeline;
      if (!timeline.clips?.length) throw new Error("No clips in timeline");
    } catch {
      // Fallback: split duration evenly across all uploads
      const perClip = targetDuration / uploads.length;
      timeline = {
        rationale: "Even distribution across all clips",
        clips: uploads.map((u, i) => ({
          uploadId: u.id,
          trimStart: 0,
          trimEnd: u.file_type === "image" ? perClip : Math.min(perClip, u.video_duration_sec || perClip),
          purpose: i === 0 ? "hook" : "main content",
        })),
        totalDuration: targetDuration,
      };
    }

    // Save timeline to project
    if (projectId) {
      await query("UPDATE projects SET timeline = $1 WHERE id = $2 AND user_id = $3", [
        JSON.stringify(timeline), projectId, userId,
      ]);
    }

    // === 4. Render each clip segment ===
    const uploadMap = new Map(uploads.map(u => [u.id, u]));
    const clipPaths: string[] = [];

    for (let i = 0; i < timeline.clips.length; i++) {
      const tc = timeline.clips[i];
      const upload = uploadMap.get(tc.uploadId);
      if (!upload) continue;

      const clipPath = join(tmpDir, `${jobId}_clip${i}.mp4`);
      tempFiles.push(clipPath);

      const ok = await makeClip(upload, tc.trimStart, tc.trimEnd, clipPath);
      if (ok) clipPaths.push(clipPath);
    }

    if (!clipPaths.length) {
      return NextResponse.json({ error: "No clips could be rendered. Check that your files are valid videos or images." }, { status: 422 });
    }

    // === 5. Concatenate all clips ===
    const concatPath = join(tmpDir, `${jobId}_concat.mp4`);
    const listPath = join(tmpDir, `${jobId}_list.txt`);
    tempFiles.push(concatPath, listPath);

    const listContent = clipPaths.map(p => `file '${p}'`).join("\n");
    await writeFile(listPath, listContent);

    await execAsync(
      `ffmpeg -y -f concat -safe 0 -i "${listPath}" -c:v libx264 -preset fast -crf 24 -pix_fmt yuv420p "${concatPath}"`,
      { timeout: 90000 }
    );

    // === 6. Mix in narration audio ===
    const outputPath = join(tmpDir, `${jobId}_final.mp4`);
    tempFiles.push(outputPath);

    // Generate narration if not provided but voice clone exists
    let narrationBase64 = audioBase64;
    const voiceId = user?.elevenlabs_voice_id as string | undefined;
    if (!narrationBase64 && voiceId && script && useVoiceClone !== false) {
      try {
        const connectors = new ReplitConnectors();
        const ttsRes = await connectors.proxy("elevenlabs", `/v1/text-to-speech/${voiceId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "audio/mpeg" },
          body: JSON.stringify({
            text: script,
            model_id: "eleven_multilingual_v2",
            voice_settings: { stability: 0.5, similarity_boost: 0.85, style: 0.4, use_speaker_boost: true },
          }),
        });
        if (ttsRes.ok) {
          const buf = await ttsRes.arrayBuffer();
          narrationBase64 = Buffer.from(buf).toString("base64");
        }
      } catch (e) {
        console.error("TTS error:", e);
      }
    }

    if (narrationBase64) {
      const audioPath = join(tmpDir, `${jobId}_narration.mp3`);
      tempFiles.push(audioPath);
      await writeFile(audioPath, Buffer.from(narrationBase64, "base64"));

      // Mix video + narration (narration dominates, video silent)
      await execAsync(
        `ffmpeg -y -i "${concatPath}" -i "${audioPath}" ` +
        `-filter_complex "[0:v][1:a]concat=n=1:v=1:a=1[vout][aout]" ` +
        `-map "[vout]" -map "[aout]" ` +
        `-c:v libx264 -preset fast -crf 24 -pix_fmt yuv420p ` +
        `-c:a aac -b:a 128k -shortest "${outputPath}"`,
        { timeout: 90000 }
      );
    } else {
      // No audio — add silent audio track
      await execAsync(
        `ffmpeg -y -i "${concatPath}" -f lavfi -i anullsrc=r=44100:cl=stereo ` +
        `-c:v copy -c:a aac -b:a 64k -shortest "${outputPath}"`,
        { timeout: 30000 }
      );
    }

    // === 7. Save to public/media and return ===
    const userDir = join(process.cwd(), "public", "media", userId);
    await mkdir(userDir, { recursive: true });
    const renderName = `${projectId || jobId}_render.mp4`;
    const renderPublicPath = join(userDir, renderName);
    const renderRelPath = `/media/${userId}/${renderName}`;

    const videoBuffer = await readFile(outputPath);
    await writeFile(renderPublicPath, videoBuffer);

    // Update project with render path
    if (projectId) {
      await query("UPDATE projects SET render_path = $1, status = 'completed' WHERE id = $2 AND user_id = $3", [
        renderRelPath, projectId, userId,
      ]);
    }

    // Save voiceover record if narration was generated fresh
    if (narrationBase64 && !audioBase64 && projectId && voiceId) {
      await query(
        `INSERT INTO voiceovers (user_id, project_id, script_content, provider, provider_voice_id, status)
         VALUES ($1, $2, $3, 'elevenlabs', $4, 'completed') ON CONFLICT DO NOTHING`,
        [userId, projectId, script, voiceId]
      ).catch(() => null);
    }

    return NextResponse.json({
      videoUrl: renderRelPath,
      timeline,
      narrationGenerated: !!narrationBase64,
      clipCount: clipPaths.length,
    });
  } catch (err) {
    console.error("Video compose error:", err);
    const msg = err instanceof Error ? err.message.slice(0, 400) : "Compose failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    for (const f of tempFiles) {
      unlink(f).catch(() => null);
    }
  }
}
