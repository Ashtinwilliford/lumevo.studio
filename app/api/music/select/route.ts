import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import { detectVibe } from "@/app/api/music/soundstripe/route";

export const maxDuration = 45;

// Bensound royalty-free fallbacks (last resort only)
const BENSOUND_FALLBACKS = [
  { url: "https://www.bensound.com/bensound-music/bensound-acousticbreeze.mp3", name: "Acoustic Breeze", artist: "Bensound", genre: "folk", source: "bensound" },
  { url: "https://www.bensound.com/bensound-music/bensound-ukulele.mp3",        name: "Ukulele",        artist: "Bensound", genre: "folk", source: "bensound" },
  { url: "https://www.bensound.com/bensound-music/bensound-sunny.mp3",          name: "Sunny",          artist: "Bensound", genre: "country", source: "bensound" },
  { url: "https://www.bensound.com/bensound-music/bensound-tenderness.mp3",     name: "Tenderness",     artist: "Bensound", genre: "emotional", source: "bensound" },
  { url: "https://www.bensound.com/bensound-music/bensound-happiness.mp3",      name: "Happiness",      artist: "Bensound", genre: "folk", source: "bensound" },
];

// ElevenLabs sound generation prompts by vibe (fallback only)
const ELEVENLABS_PROMPTS: Record<string, string> = {
  warm_emotional:      "warm acoustic country folk instrumental, gentle fingerpicked guitar, Nashville sound, southern warmth, heartfelt melody, no vocals, high quality",
  fun_playful:         "upbeat cheerful background music, bright ukulele, positive energy, playful, no vocals",
  cinematic_luxury:    "cinematic orchestral instrumental, sweeping strings, emotional build, luxury lifestyle feel, no vocals",
  upbeat_celebratory:  "upbeat energetic pop instrumental, driving beat, exciting, no vocals",
};

// POST /api/music/select
// Body: { vibe?, musicStyle?, platform?, duration?, title?, projectId?, analysisResults? }
// Returns: { track: { name, artist, url, source }, reason, vibe, musicVolumeUnderVoice, musicVolumeNoVoice, ... }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Forward the original cookie so internal fetch calls are authenticated
  const cookieHeader = req.headers.get("cookie") || "";
  const reqOrigin = new URL(req.url).origin;

  const body = await req.json().catch(() => ({})) as {
    vibe?: string;
    musicStyle?: string;
    platform?: string;
    duration?: number;
    title?: string;
    projectId?: string;
    analysisResults?: { mood?: string; energy?: string }[];
  };

  const { vibe, musicStyle, duration = 60, analysisResults } = body;

  // Detect vibe (used by all tiers)
  const vibeKey = detectVibe({ vibe, musicStyle, analysisResults });

  // ── TIER 1: Soundstripe ───────────────────────────────────────────────────
  const soundstripeKey = process.env.SOUNDSTRIPE_API_KEY;
  if (soundstripeKey) {
    try {
      const ssRes = await fetch(`${reqOrigin}/api/music/soundstripe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieHeader },
        body: JSON.stringify({ vibe, musicStyle, targetDuration: duration, analysisResults }),
      });

      if (ssRes.ok) {
        const ssData = await ssRes.json() as {
          track: { name: string; artist: string; url: string; bpm?: number; duration?: number; source: string };
          vibe: string;
          reason: string;
          debug?: unknown;
        };

        if (ssData.track?.url) {
          console.log(`[music/select] TIER 1 Soundstripe: "${ssData.track.name}" — ${ssData.reason}`);

          // ── Proxy Soundstripe URL through Cloudinary ───────────────────────
          // Soundstripe CDN URLs may require authentication that Creatomate
          // can't provide. Download server-side and re-host on Cloudinary so
          // Creatomate can always stream the file.
          let publicUrl = ssData.track.url;
          try {
            const audioRes = await fetch(ssData.track.url, {
              headers: process.env.SOUNDSTRIPE_API_KEY
                ? { Authorization: `Bearer ${process.env.SOUNDSTRIPE_API_KEY}` }
                : {},
              signal: AbortSignal.timeout(20_000),
            });
            if (audioRes.ok) {
              const { v2: cloudinary } = await import("cloudinary");
              cloudinary.config({
                cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
                api_key: process.env.CLOUDINARY_API_KEY,
                api_secret: process.env.CLOUDINARY_API_SECRET,
              });
              const buf = Buffer.from(await audioRes.arrayBuffer());
              const uploadResult = await cloudinary.uploader.upload(
                `data:audio/mpeg;base64,${buf.toString("base64")}`,
                { resource_type: "video", folder: "lumevo/music", format: "mp3" }
              );
              publicUrl = uploadResult.secure_url;
              console.log(`[music/select] Soundstripe proxied to Cloudinary: ${publicUrl.slice(0, 60)}`);
            } else {
              console.warn(`[music/select] Soundstripe download failed (${audioRes.status}) — using direct URL`);
            }
          } catch (proxyErr) {
            console.warn("[music/select] Cloudinary proxy failed, using direct URL:", proxyErr instanceof Error ? proxyErr.message : proxyErr);
          }

          // Cache in music_tracks so repeated renders reuse the Cloudinary URL
          await query(
            `INSERT INTO music_tracks (name, artist, genre, vibe_tags, bpm, duration_sec, url)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (url) DO NOTHING`,
            [
              ssData.track.name,
              ssData.track.artist,
              (Array.isArray((ssData.track as unknown as Record<string, unknown>).genres) ? ((ssData.track as unknown as Record<string, string[]>).genres)[0] : undefined) ?? vibeKey,
              `{${vibeKey}}`,
              ssData.track.bpm ?? null,
              ssData.track.duration ?? null,
              publicUrl,
            ]
          ).catch(() => { /* non-fatal */ });

          return NextResponse.json({
            track: { ...ssData.track, url: publicUrl },
            vibe: vibeKey,
            reason: ssData.reason,
            source: "soundstripe",
            musicVolumeUnderVoice: 0.18,
            musicVolumeNoVoice: 0.65,
            introFadeInSec: 1.5,
            outroFadeOutSec: 3.0,
            debug: ssData.debug,
          });
        }
      } else {
        const errText = await ssRes.text();
        console.warn("[music/select] Soundstripe unavailable:", errText.slice(0, 200));
      }
    } catch (err) {
      console.warn("[music/select] Soundstripe error:", err instanceof Error ? err.message : err);
    }
  } else {
    console.log("[music/select] SOUNDSTRIPE_API_KEY not set — skipping Tier 1");
  }

  // ── TIER 2: ElevenLabs sound generation ───────────────────────────────────
  const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
  if (elevenLabsKey) {
    try {
      const musicPrompt = ELEVENLABS_PROMPTS[vibeKey] || ELEVENLABS_PROMPTS.warm_emotional;
      const targetSec = Math.min(Math.max(duration, 5), 22); // ElevenLabs max 22s

      const elRes = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
        method: "POST",
        headers: {
          "xi-api-key": elevenLabsKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: musicPrompt,
          duration_seconds: targetSec,
          prompt_influence: 0.3,
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (elRes.ok) {
        // Upload audio buffer to Cloudinary so Creatomate can reach it
        const { v2: cloudinary } = await import("cloudinary");
        cloudinary.config({
          cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
          api_key: process.env.CLOUDINARY_API_KEY,
          api_secret: process.env.CLOUDINARY_API_SECRET,
        });

        const audioBuffer = Buffer.from(await elRes.arrayBuffer());
        const uploadResult = await cloudinary.uploader.upload(
          `data:audio/mpeg;base64,${audioBuffer.toString("base64")}`,
          { resource_type: "video", folder: "lumevo/music", format: "mp3" }
        );

        const audioUrl = uploadResult.secure_url;
        console.log(`[music/select] TIER 2 ElevenLabs: generated ${targetSec}s track`);

        return NextResponse.json({
          track: { name: "AI Generated", artist: "ElevenLabs", url: audioUrl, source: "elevenlabs" },
          vibe: vibeKey,
          reason: `ElevenLabs generated: ${musicPrompt.slice(0, 60)}…`,
          source: "elevenlabs",
          musicVolumeUnderVoice: 0.18,
          musicVolumeNoVoice: 0.65,
          introFadeInSec: 1.5,
          outroFadeOutSec: 3.0,
        });
      } else {
        const errText = await elRes.text();
        console.warn("[music/select] ElevenLabs error:", errText.slice(0, 200));
      }
    } catch (err) {
      console.warn("[music/select] ElevenLabs error:", err instanceof Error ? err.message : err);
    }
  }

  // ── TIER 3: DB library (seeded Bensound tracks) ───────────────────────────
  try {
    const tracksRes = await query(
      `SELECT * FROM music_tracks WHERE $1 = ANY(vibe_tags) OR genre ILIKE $2 ORDER BY RANDOM() LIMIT 5`,
      [vibeKey, `%${vibeKey.split("_")[0]}%`]
    );
    const dbTracks = tracksRes.rows;

    if (dbTracks.length > 0) {
      const pick = dbTracks[0];
      console.log(`[music/select] TIER 3 DB library: "${pick.name}"`);
      return NextResponse.json({
        track: { name: pick.name, artist: pick.artist, url: pick.url, source: "library" },
        vibe: vibeKey,
        reason: "library track matching vibe",
        source: "library",
        musicVolumeUnderVoice: 0.15,
        musicVolumeNoVoice: 0.60,
        introFadeInSec: 1.5,
        outroFadeOutSec: 2.5,
      });
    }
  } catch (err) {
    console.warn("[music/select] DB library error:", err instanceof Error ? err.message : err);
  }

  // ── TIER 4: Hardcoded Bensound (final safety net) ─────────────────────────
  const fallback = BENSOUND_FALLBACKS[Math.floor(Math.random() * BENSOUND_FALLBACKS.length)];
  console.log(`[music/select] TIER 4 Bensound fallback: "${fallback.name}"`);
  return NextResponse.json({
    track: fallback,
    vibe: vibeKey,
    reason: "Bensound fallback — all primary sources unavailable",
    source: "bensound",
    musicVolumeUnderVoice: 0.15,
    musicVolumeNoVoice: 0.60,
    introFadeInSec: 1.5,
    outroFadeOutSec: 2.5,
  });
}

// GET /api/music/select — list all cached tracks
export async function GET() {
  const tracks = await query("SELECT * FROM music_tracks ORDER BY genre, name");
  return NextResponse.json({ tracks: tracks.rows });
}
