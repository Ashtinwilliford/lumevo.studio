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

// Curated royalty-free music tracks by vibe (used when ElevenLabs music unavailable)
// These are high-quality YouTube Audio Library / Pixabay free tracks
const MUSIC_LIBRARY: Record<string, string[]> = {
  "warm country": [
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", // placeholder
  ],
  cinematic: [
    "https://cdn.creatomate.com/demo/music1.mp3",
    "https://cdn.creatomate.com/demo/music2.mp3",
  ],
  upbeat: [
    "https://cdn.creatomate.com/demo/music3.mp3",
    "https://cdn.creatomate.com/demo/music4.mp3",
  ],
};

// Map music_energy style values to descriptive ElevenLabs prompts
const MUSIC_PROMPTS: Record<string, string> = {
  cinematic: "cinematic orchestral background music, warm strings, emotional, smooth, luxury reel, no vocals",
  "cinematic emotional": "cinematic emotional piano with strings, tender, heartfelt, beautiful, luxury video, no vocals",
  energetic: "upbeat energetic music, driving beat, high energy, exciting, dynamic, no vocals",
  trendy: "trendy modern pop music, upbeat, viral social media vibes, fresh, no vocals",
  ambient: "soft ambient background music, minimal, airy, modern editorial, no vocals",
  upbeat: "upbeat cheerful background music, positive, bright, lifestyle, no vocals",
  dramatic: "dramatic cinematic music, intense, powerful, dark undertones, film score, no vocals",
  "warm cozy": "warm acoustic country folk instrumental, gentle fingerpicked guitar, Nashville sound, southern warmth, no vocals",
};

// Build a rich, genre-specific ElevenLabs prompt from free-form user music description
function buildMusicPromptFromStyle(musicStyle: string): string {
  const s = musicStyle.toLowerCase();

  // Country / Americana / Ella/Ellie Langley
  if (s.includes("country") || s.includes("langley") || s.includes("ella") || s.includes("choosin") || s.includes("texas") || s.includes("nashville") || s.includes("southern")) {
    return "warm country music instrumental, fingerpicked acoustic guitar, gentle Nashville-style fiddle, steel guitar undertone, southern Americana warmth, heartfelt folk melody, no vocals, high quality background music";
  }
  // Pop
  if (s.includes("pop") || s.includes("taylor") || s.includes("olivia") || s.includes("trending") || s.includes("viral")) {
    return "upbeat modern pop instrumental, bright synth layers, punchy beat, feel-good energy, radio-ready production, no vocals";
  }
  // Hip-hop / trap / R&B
  if (s.includes("hip hop") || s.includes("hiphop") || s.includes("trap") || s.includes("r&b") || s.includes("rnb")) {
    return "lo-fi hip hop instrumental, smooth beat, warm bass, chill vibes, modern urban sound, no vocals";
  }
  // Cinematic / film
  if (s.includes("cinematic") || s.includes("film") || s.includes("orchestral") || s.includes("epic")) {
    return "cinematic orchestral instrumental, sweeping strings, emotional build, luxury lifestyle feel, no vocals";
  }
  // Indie / alternative
  if (s.includes("indie") || s.includes("alternative") || s.includes("folk")) {
    return "indie folk instrumental, acoustic guitar, warm production, tender melody, no vocals";
  }
  // Upbeat / happy
  if (s.includes("upbeat") || s.includes("happy") || s.includes("fun") || s.includes("cheerful")) {
    return "upbeat cheerful background music, bright melody, positive energy, no vocals";
  }
  // Calm / chill / relaxed
  if (s.includes("calm") || s.includes("chill") || s.includes("relax") || s.includes("peaceful") || s.includes("cozy") || s.includes("warm")) {
    return "warm cozy acoustic background music, gentle guitar, soft ambient tones, relaxed feel, no vocals";
  }

  // Generic fallback: use the raw style as-is but append quality modifiers
  return `${musicStyle} background music instrumental, professional music production, continuous melody, no vocals`;
}

// POST /api/music/generate
// Body: { projectId, prompt?, durationSeconds? }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ELEVENLABS_API_KEY not configured" }, { status: 500 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }

  const { projectId, prompt, durationSeconds = 22 } = body as {
    projectId?: string;
    prompt?: string;
    durationSeconds?: number;
  };

  const userId = session.id;

  // Build music prompt: priority order:
  // 1. Explicit prompt passed in request
  // 2. project.music_style (user-specified genre, e.g. "warm country like Ella Langley")
  // 3. claude_plan.music_brief (AI's music suggestion)
  // 4. creator_styles.music_energy fallback
  let musicPrompt = prompt;
  if (!musicPrompt && projectId) {
    const [projRes, styleRes] = await Promise.all([
      query("SELECT claude_plan, target_duration, music_style FROM projects WHERE id = $1 AND user_id = $2", [projectId, userId]),
      query("SELECT music_energy FROM creator_styles WHERE user_id = $1", [userId]),
    ]);
    const proj = projRes.rows[0];
    const style = styleRes.rows[0];

    // Priority: user's music_style > plan brief > creator energy
    const userMusicStyle = proj?.music_style as string | null;
    if (userMusicStyle) {
      musicPrompt = buildMusicPromptFromStyle(userMusicStyle);
    } else {
      let claudePlan: { music_brief?: string } | null = null;
      try {
        const rawPlan = proj?.claude_plan;
        claudePlan = rawPlan && typeof rawPlan === "string" ? JSON.parse(rawPlan) : rawPlan;
      } catch { claudePlan = null; }
      const planBrief = claudePlan?.music_brief;
      const musicEnergy = (style?.music_energy as string) || "cinematic";
      musicPrompt = (planBrief ? buildMusicPromptFromStyle(planBrief) : null) || MUSIC_PROMPTS[musicEnergy] || MUSIC_PROMPTS.cinematic;
    }
  }

  if (!musicPrompt) musicPrompt = MUSIC_PROMPTS.cinematic;

  // ElevenLabs sound-generation max is 22s — Creatomate loops it for the full video
  const targetDuration = Math.min(Math.max(durationSeconds, 5), 22);

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
