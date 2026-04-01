import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import { v2 as cloudinary } from "cloudinary";

export const maxDuration = 60;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Map music_energy style values to descriptive ElevenLabs prompts
const MUSIC_PROMPTS: Record<string, string> = {
  cinematic: "cinematic orchestral background music, warm strings, emotional, smooth, luxury reel",
  "cinematic emotional": "cinematic emotional piano with strings, tender, heartfelt, beautiful, luxury video",
  energetic: "upbeat energetic music, driving beat, high energy, exciting, dynamic",
  trendy: "trendy modern pop music, upbeat, viral social media vibes, fresh",
  ambient: "soft ambient background music, minimal, airy, modern editorial",
  upbeat: "upbeat cheerful background music, positive, bright, lifestyle",
  dramatic: "dramatic cinematic music, intense, powerful, dark undertones, film score",
};

// POST /api/music/generate
// Body: { projectId, prompt?, durationSeconds? }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ELEVENLABS_API_KEY not configured" }, { status: 500 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }

  const { projectId, prompt, durationSeconds = 30 } = body as {
    projectId?: string;
    prompt?: string;
    durationSeconds?: number;
  };

  const userId = session.id;

  // If no prompt provided but projectId given, derive from project plan + creator style
  let musicPrompt = prompt;
  if (!musicPrompt && projectId) {
    const [projRes, styleRes] = await Promise.all([
      query("SELECT claude_plan, target_duration FROM projects WHERE id = $1 AND user_id = $2", [projectId, userId]),
      query("SELECT music_energy FROM creator_styles WHERE user_id = $1", [userId]),
    ]);
    const proj = projRes.rows[0];
    const style = styleRes.rows[0];
    const musicEnergy = (style?.music_energy as string) || "cinematic";
    const claudePlan = proj?.claude_plan as { music_brief?: string } | null;
    const planBrief = claudePlan?.music_brief;
    musicPrompt = planBrief || MUSIC_PROMPTS[musicEnergy] || MUSIC_PROMPTS.cinematic;
  }

  if (!musicPrompt) musicPrompt = MUSIC_PROMPTS.cinematic;

  const targetDuration = Math.min(Math.max(durationSeconds, 5), 60);

  try {
    // Call ElevenLabs Sound Generation API
    const elRes = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: musicPrompt,
        duration_seconds: targetDuration,
        prompt_influence: 0.3,
      }),
    });

    if (!elRes.ok) {
      const errText = await elRes.text();
      console.error("ElevenLabs error:", errText);
      return NextResponse.json({ error: `ElevenLabs error: ${errText}` }, { status: 500 });
    }

    // ElevenLabs returns binary audio — upload to Cloudinary
    const audioBuffer = Buffer.from(await elRes.arrayBuffer());
    const base64Audio = audioBuffer.toString("base64");
    const dataUri = `data:audio/mpeg;base64,${base64Audio}`;

    const uploadResult = await cloudinary.uploader.upload(dataUri, {
      resource_type: "video", // Cloudinary uses "video" for audio files
      folder: "lumevo/music",
      format: "mp3",
    });

    const audioUrl = uploadResult.secure_url;

    // Save to voiceovers table (reusing for music tracks)
    if (projectId) {
      await query(
        `INSERT INTO voiceovers (user_id, project_id, audio_url, status, audio_type, style_prompt)
         VALUES ($1, $2, $3, 'completed', 'music', $4)
         ON CONFLICT DO NOTHING`,
        [userId, projectId, audioUrl, musicPrompt]
      );
    }

    return NextResponse.json({ audioUrl, prompt: musicPrompt, durationSeconds: targetDuration });
  } catch (err) {
    console.error("Music generation error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Music generation failed" }, { status: 500 });
  }
}
