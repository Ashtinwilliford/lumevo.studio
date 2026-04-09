import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

interface MusicTrack {
  id: string;
  name: string;
  artist: string;
  genre: string;
  vibe_tags: string[];
  bpm: number;
  duration_sec: number;
  url: string;
}

interface BrandProfile {
  music_genre_preference: string | null;
  creator_archetype: string | null;
  emotional_arc_preference: string | null;
  pacing_style: string | null;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { vibe, platform, duration, title } = await req.json() as {
    vibe?: string;
    platform?: string;
    duration?: number;
    title?: string;
  };

  const userId = session.id;

  const [tracksRows, brandRows] = await Promise.all([
    query("SELECT * FROM music_tracks ORDER BY RANDOM() LIMIT 20"),
    query("SELECT music_genre_preference, creator_archetype, emotional_arc_preference, pacing_style FROM brand_profiles WHERE user_id = $1", [userId]),
  ]);

  let tracks = tracksRows.rows as unknown as MusicTrack[];
  const brand = brandRows.rows[0] as unknown as BrandProfile | undefined;

  if (!tracks.length) {
    // Fallback to hardcoded tracks when library is empty
    const warmTracks = [
      { url: "https://www.bensound.com/bensound-music/bensound-ukulele.mp3", name: "Ukulele", genre: "folk" },
      { url: "https://www.bensound.com/bensound-music/bensound-sunny.mp3", name: "Sunny", genre: "country" },
      { url: "https://www.bensound.com/bensound-music/bensound-acousticbreeze.mp3", name: "Acoustic Breeze", genre: "folk" },
      { url: "https://www.bensound.com/bensound-music/bensound-tenderness.mp3", name: "Tenderness", genre: "emotional" },
      { url: "https://www.bensound.com/bensound-music/bensound-happiness.mp3", name: "Happiness", genre: "folk" },
    ];
    const track = warmTracks[Math.floor(Math.random() * warmTracks.length)];
    return NextResponse.json({ track, musicVolumeUnderVoice: 0.15, musicVolumeNoVoice: 0.4, introFadeInSec: 1.5, outroFadeOutSec: 2.5, reason: "Warm folk fallback" });
  }

  // Smart vibe-tag filtering: if vibe contains warm/cozy/country/folk words, prefer matching tracks
  const vibeStr = (vibe || "").toLowerCase();
  const warmKeywords = ["cozy", "warm", "country", "folk", "acoustic", "sunny", "happy", "tender", "gentle"];
  const matchingKeywords = warmKeywords.filter(k => vibeStr.includes(k));
  if (matchingKeywords.length > 0) {
    const filtered = tracks.filter(t =>
      t.vibe_tags?.some(tag => matchingKeywords.includes(tag.toLowerCase())) ||
      matchingKeywords.includes(t.genre?.toLowerCase())
    );
    if (filtered.length > 0) tracks = filtered;
  }

  // Build a rich selection prompt
  const trackList = tracks.map((t, i) =>
    `${i + 1}. "${t.name}" | genre: ${t.genre} | vibes: ${t.vibe_tags?.join(", ")} | BPM: ${t.bpm}`
  ).join("\n");

  const selectionPrompt = `You are a music supervisor for a short-form video creator.

Video details:
- Title: "${title || "Untitled"}"
- Vibe: "${vibe || "engaging"}"
- Platform: ${platform || "TikTok/Reels"}
- Duration: ${duration || 30} seconds

Creator's profile:
- Music preference: ${brand?.music_genre_preference || "not set"}
- Content archetype: ${brand?.creator_archetype || "creator"}
- Emotional arc: ${brand?.emotional_arc_preference || "unknown"}
- Pacing: ${brand?.pacing_style || "unknown"}

Available tracks:
${trackList}

Pick the ONE track (by number) that best matches the video's emotional energy and the creator's style.
Also suggest the ideal volume level for music under voice narration (0.0-1.0, where 0.15 means very soft background and 0.5 means equal with voice).

Return JSON only:
{
  "trackIndex": <1-based number>,
  "reason": "one sentence explaining why this track fits",
  "musicVolumeUnderVoice": 0.15,
  "musicVolumeNoVoice": 0.4,
  "introFadeInSec": 1.5,
  "outroFadeOutSec": 2.0
}`;

  let selection = { trackIndex: 1, musicVolumeUnderVoice: 0.12, musicVolumeNoVoice: 0.35, introFadeInSec: 1.5, outroFadeOutSec: 2.0, reason: "Default selection" };

  try {
    const res = await ai.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 200,
      temperature: 0.5,
      messages: [{ role: "user", content: selectionPrompt }],
    });
    const parsed = JSON.parse((res.content[0]?.type === "text" ? res.content[0].text : "{}")) as typeof selection;
    if (parsed.trackIndex) selection = parsed;
  } catch (err) {
    console.error("Music selection AI error:", err);
  }

  const selectedTrack = tracks[Math.max(0, (selection.trackIndex || 1) - 1)];

  return NextResponse.json({
    track: selectedTrack,
    musicVolumeUnderVoice: selection.musicVolumeUnderVoice || 0.12,
    musicVolumeNoVoice: selection.musicVolumeNoVoice || 0.35,
    introFadeInSec: selection.introFadeInSec || 1.5,
    outroFadeOutSec: selection.outroFadeOutSec || 2.0,
    reason: selection.reason,
  });
}

export async function GET() {
  const tracks = await query("SELECT * FROM music_tracks ORDER BY genre, name");
  return NextResponse.json({ tracks: tracks.rows });
}



