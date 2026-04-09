import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export const maxDuration = 60;

// Extract 3 frame URLs from a Cloudinary video URL at 15%, 50%, 85% through the clip.
// Cloudinary's URL transform: insert "so_XX p" after "/upload/" and swap extension to .jpg
function getVideoFrameUrls(videoUrl: string): string[] {
  if (!videoUrl.includes("res.cloudinary.com")) return [];
  const offsets = ["15p", "50p", "85p"];
  return offsets.map(pct =>
    videoUrl
      .replace("/upload/", `/upload/so_${pct}/`)
      .replace(/\.(mp4|mov|avi|webm|mkv)(\?.*)?$/i, ".jpg")
  );
}

// Fetch a URL and return base64 + media type for Claude Vision
async function fetchImageAsBase64(url: string): Promise<{ data: string; mediaType: "image/jpeg" } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const b64 = Buffer.from(buf).toString("base64");
    return { data: b64, mediaType: "image/jpeg" };
  } catch {
    return null;
  }
}

// Analyze one upload using Claude Vision on actual video frames
async function analyzeUpload(
  uploadId: string,
  filePath: string,
  fileType: string,
  fileName: string,
  existingDuration: number | null,
): Promise<Record<string, unknown>> {

  // ── Build vision content ────────────────────────────────────────────────
  const imageBlocks: Anthropic.ImageBlockParam[] = [];

  if (fileType === "video") {
    const frameUrls = getVideoFrameUrls(filePath);
    // Fetch frames in parallel
    const frames = await Promise.all(frameUrls.map(fetchImageAsBase64));
    for (const f of frames) {
      if (f) {
        imageBlocks.push({
          type: "image",
          source: { type: "base64", media_type: f.mediaType, data: f.data },
        });
      }
    }
  } else if (fileType === "image") {
    // For images, try fetching directly
    const img = await fetchImageAsBase64(filePath);
    if (img) {
      imageBlocks.push({
        type: "image",
        source: { type: "base64", media_type: img.mediaType, data: img.data },
      });
    }
  }

  // ── Build Claude prompt ─────────────────────────────────────────────────
  const systemContext = fileType === "video"
    ? `You are analyzing ${imageBlocks.length} frames from a short video clip of a baby/toddler named Elliott at a strawberry picking outing.
The frames are at roughly 15%, 50%, and 85% through the clip.
IMPORTANT: Look carefully at Elliott's expression in every frame. A big open mouth, scrunched eyes, raised cheeks = LAUGHING.
Any adult speaking = has_speech. Outdoor nature setting = has_natural_audio may be true.`
    : `You are analyzing a photo from a baby/toddler outing.`;

  const textPrompt = `${systemContext}

Respond with ONLY this JSON (no markdown, no explanation):
{
  "description": "one sentence: what is actually happening in the clip/photo",
  "has_laughter": true or false (Elliott laughing or giggling — look for open mouth, joy expression),
  "has_speech": true or false (any adult clearly talking),
  "has_natural_audio": true or false (meaningful sounds like laughter, nature, or joy worth keeping),
  "energy": "high" or "medium" or "low",
  "mood": "joyful" or "playful" or "calm" or "tender" or "excited",
  "warmth_score": 1-10,
  "best_use": "hook" or "broll" or "closeup" or "wide" or "emotional",
  "best_moment_start": 0,
  "best_moment_end": ${Math.min(existingDuration ?? 5, 8)}
}`;

  const content: Anthropic.MessageParam["content"] = [
    ...imageBlocks,
    { type: "text", text: textPrompt },
  ];

  // Fall back to text-only if no frames loaded (non-Cloudinary or fetch failed)
  const fallbackTextContent: Anthropic.MessageParam["content"] = [
    {
      type: "text",
      text: `Analyze this ${fileType} clip named "${fileName}". It's from a baby strawberry picking video.
${existingDuration ? `Duration: ${existingDuration.toFixed(1)}s.` : ""}
For a baby outing video, estimate: is there likely laughter? Speech? Joyful energy?
Return ONLY JSON:
{
  "description": "estimated content based on filename",
  "has_laughter": false,
  "has_speech": false,
  "has_natural_audio": false,
  "energy": "medium",
  "mood": "warm",
  "warmth_score": 7,
  "best_use": "broll",
  "best_moment_start": 0,
  "best_moment_end": ${Math.min(existingDuration ?? 4, 8)}
}`,
    },
  ];

  try {
    const completion = await ai.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 400,
      temperature: 0.2,
      messages: [{
        role: "user",
        content: imageBlocks.length > 0 ? content : fallbackTextContent,
      }],
    });

    const raw = completion.content[0]?.type === "text" ? completion.content[0].text : "{}";
    const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
    const analysis = JSON.parse(cleaned) as Record<string, unknown>;

    // Attach duration if we have it
    if (existingDuration) analysis.video_duration_sec = existingDuration;
    analysis.analyzed_with_vision = imageBlocks.length > 0;

    return analysis;
  } catch (err) {
    console.error("AI analysis failed for", uploadId, err);
    return {
      description: fileName,
      has_laughter: false,
      has_speech: false,
      has_natural_audio: false,
      energy: "medium",
      mood: "warm",
      warmth_score: 5,
      best_use: "broll",
      best_moment_start: 0,
      best_moment_end: Math.min(existingDuration ?? 4, 8),
      video_duration_sec: existingDuration,
      analyzed_with_vision: false,
    };
  }
}

// POST: Analyze one clip (uploadId) or all clips in a project (projectId)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }

  const { uploadId, projectId } = body as { uploadId?: string; projectId?: string };
  if (!uploadId && !projectId) return NextResponse.json({ error: "uploadId or projectId required" }, { status: 400 });

  const userId = session.id;

  // Load uploads to analyze
  let uploadsRes;
  if (uploadId) {
    uploadsRes = await query(
      "SELECT id, file_name, file_type, file_path, video_duration_sec FROM uploads WHERE id = $1 AND user_id = $2",
      [uploadId, userId]
    );
  } else {
    uploadsRes = await query(
      "SELECT id, file_name, file_type, file_path, video_duration_sec FROM uploads WHERE project_id = $1 AND user_id = $2 ORDER BY created_at ASC",
      [projectId, userId]
    );
  }

  if (!uploadsRes.rows.length) return NextResponse.json({ error: "No uploads found" }, { status: 404 });

  const results: { id: string; fileName: string; has_laughter: boolean; has_speech: boolean; mood: string; description: string }[] = [];

  // Analyze each upload sequentially (avoid rate limits)
  for (const upload of uploadsRes.rows) {
    const analysis = await analyzeUpload(
      upload.id as string,
      upload.file_path as string,
      upload.file_type as string,
      upload.file_name as string,
      upload.video_duration_sec as number | null,
    );

    await query(
      `UPDATE uploads SET ai_analysis = $1::jsonb, analysis_status = 'analyzed' WHERE id = $2`,
      [JSON.stringify(analysis), upload.id]
    );

    results.push({
      id: upload.id as string,
      fileName: upload.file_name as string,
      has_laughter: analysis.has_laughter === true,
      has_speech: analysis.has_speech === true,
      mood: analysis.mood as string || "warm",
      description: analysis.description as string || "",
    });
  }

  const laughterCount = results.filter(r => r.has_laughter).length;

  return NextResponse.json({
    analyzed: results.length,
    laughterDetected: laughterCount,
    results,
    message: laughterCount > 0
      ? `Found ${laughterCount} clip${laughterCount > 1 ? "s" : ""} with Elliott's laughter — regenerate to use them!`
      : "Analysis complete. No laughter detected yet — music will play over all clips.",
  });
}
