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

// POST /api/voice/generate
// Body: { projectId, script, voiceId? }
// Generates a voiceover via ElevenLabs TTS and uploads to Cloudinary
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ELEVENLABS_API_KEY not configured" }, { status: 500 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }

  const { projectId, script, voiceId } = body as { projectId: string; script: string; voiceId?: string };
  if (!script) return NextResponse.json({ error: "script required" }, { status: 400 });

  const userId = session.id;

  // Use user's cloned voice if no voiceId provided
  let finalVoiceId = voiceId;
  if (!finalVoiceId && projectId) {
    const userRes = await query("SELECT elevenlabs_voice_id FROM users WHERE id = $1", [userId]);
    finalVoiceId = userRes.rows[0]?.elevenlabs_voice_id as string | undefined;
  }
  // Fall back to a warm, natural default voice
  if (!finalVoiceId) finalVoiceId = "21m00Tcm4TlvDq8ikWAM"; // Rachel - warm, natural

  try {
    const elRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${finalVoiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: script,
        model_id: "eleven_turbo_v2_5",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true,
        },
      }),
    });

    if (!elRes.ok) {
      const errText = await elRes.text();
      return NextResponse.json({ error: `ElevenLabs TTS error: ${errText}` }, { status: 500 });
    }

    // Upload binary audio to Cloudinary
    const audioBuffer = Buffer.from(await elRes.arrayBuffer());
    const base64Audio = audioBuffer.toString("base64");
    const dataUri = `data:audio/mpeg;base64,${base64Audio}`;

    const uploadResult = await cloudinary.uploader.upload(dataUri, {
      resource_type: "video",
      folder: "lumevo/voiceovers",
      format: "mp3",
    });

    const audioUrl = uploadResult.secure_url;

    // Save to voiceovers table
    if (projectId) {
      await query(
        `INSERT INTO voiceovers (user_id, project_id, audio_url, status, audio_type, style_prompt)
         VALUES ($1, $2, $3, 'completed', 'voiceover', $4)`,
        [userId, projectId, audioUrl, script.slice(0, 200)]
      );
    }

    return NextResponse.json({ audioUrl, voiceId: finalVoiceId });
  } catch (err) {
    console.error("Voiceover generation error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Voiceover generation failed" }, { status: 500 });
  }
}
