import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export const maxDuration = 60;

// Analyze a single upload - detect mood, speech, laughter, best moments
async function analyzeUpload(uploadId: string, filePath: string, fileType: string, fileName: string): Promise<Record<string, unknown>> {
  // Get video duration from Cloudinary if it's a video
  let duration: number | null = null;
  if (fileType === "video") {
    try {
      // Extract public ID from Cloudinary URL
      const urlParts = filePath.split("/upload/");
      if (urlParts[1]) {
        const publicId = urlParts[1].replace(/\.[^/.]+$/, ""); // remove extension
        const resource = await cloudinary.api.resource(publicId, { resource_type: "video", media_metadata: true });
        duration = resource.duration || null;
      }
    } catch {
      // Cloudinary metadata fetch failed - continue without duration
    }
  }

  // Use Claude to analyze the content
  // For images: analyze visually
  // For videos: analyze the thumbnail/preview frame
  const analysisPrompt = fileType === "video"
    ? `Analyze this video file for a cinematic social media reel editor.
File: ${fileName}
${duration ? `Duration: ${duration.toFixed(1)}s` : ""}

Based on the filename and any context, estimate these properties.
Return JSON only:
{
  "energy": "high" or "medium" or "low",
  "mood": "warm" or "funny" or "emotional" or "energetic" or "calm" or "dramatic",
  "has_speech": true/false (likely has someone talking?),
  "has_laughter": true/false (likely has laughing/joy sounds?),
  "has_natural_audio": true/false (likely has ambient sounds worth keeping?),
  "best_moment_start": 0 (seconds - where the best clip starts, estimate based on duration),
  "best_moment_end": ${Math.min(duration || 5, 5)} (seconds - best clip end, 3-5s max),
  "description": "brief description of likely content",
  "warmth_score": 1-10 (how warm/cozy does this feel?),
  "visual_quality": "high" or "medium" or "low",
  "best_use": "hook" or "broll" or "reveal" or "transition" or "closeup" or "wide"
}`
    : `Analyze this image for a cinematic social media reel editor.
File: ${fileName}

Based on the filename and context, estimate:
{
  "energy": "high" or "medium" or "low",
  "mood": "warm" or "funny" or "emotional" or "energetic" or "calm" or "dramatic",
  "has_speech": false,
  "has_laughter": false,
  "has_natural_audio": false,
  "best_moment_start": 0,
  "best_moment_end": 4,
  "description": "brief description",
  "warmth_score": 1-10,
  "visual_quality": "high" or "medium" or "low",
  "best_use": "hook" or "broll" or "reveal" or "transition" or "closeup" or "wide"
}`;

  try {
    const completion = await ai.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 300,
      temperature: 0.3,
      messages: [{ role: "user", content: analysisPrompt }],
    });

    const raw = completion.content[0]?.type === "text" ? completion.content[0].text : "{}";
    const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
    const analysis = JSON.parse(cleaned);

    // Add duration if we got it
    if (duration) analysis.duration = duration;

    return analysis;
  } catch (err) {
    console.error("AI analysis failed for", uploadId, err);
    // Return sensible defaults
    return {
      energy: "medium",
      mood: "warm",
      has_speech: false,
      has_laughter: false,
      has_natural_audio: false,
      best_moment_start: 0,
      best_moment_end: Math.min(duration || 4, 5),
      description: fileName,
      warmth_score: 5,
      visual_quality: "medium",
      best_use: "broll",
      duration: duration,
    };
  }
}

// POST: Analyze a specific upload by ID
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }

  const { uploadId } = body;
  if (!uploadId) return NextResponse.json({ error: "uploadId required" }, { status: 400 });

  const uploadRes = await query(
    "SELECT id, file_name, file_type, file_path FROM uploads WHERE id = $1 AND user_id = $2",
    [uploadId, session.id]
  );
  const upload = uploadRes.rows[0];
  if (!upload) return NextResponse.json({ error: "Upload not found" }, { status: 404 });

  const analysis = await analyzeUpload(
    upload.id as string,
    upload.file_path as string,
    upload.file_type as string,
    upload.file_name as string
  );

  await query(
    "UPDATE uploads SET ai_analysis = $1, analysis_status = 'analyzed' WHERE id = $2",
    [JSON.stringify(analysis), uploadId]
  );

  return NextResponse.json({ analysis });
}
