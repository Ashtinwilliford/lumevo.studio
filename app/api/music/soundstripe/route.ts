import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const maxDuration = 30;

const SOUNDSTRIPE_BASE = "https://app.soundstripe.com/api/v1";

// ── Vibe → Soundstripe filter mapping ────────────────────────────────────────
// Each vibe maps to moods[], genres[], and an optional tempo hint.
// All requests prefer instrumental tracks (no lead vocals).
type VibeKey = "warm_emotional" | "fun_playful" | "cinematic_luxury" | "upbeat_celebratory";

const VIBE_FILTERS: Record<VibeKey, { moods: string[]; genres: string[]; tempo?: string }> = {
  warm_emotional: {
    moods: ["happy", "romantic", "peaceful", "tender", "nostalgic"],
    genres: ["acoustic", "country", "folk", "piano", "singer-songwriter"],
    tempo: "slow",
  },
  fun_playful: {
    moods: ["fun", "happy", "playful", "lighthearted", "quirky"],
    genres: ["pop", "indie", "acoustic", "ukulele"],
    tempo: "medium",
  },
  cinematic_luxury: {
    moods: ["cinematic", "inspiring", "dramatic", "uplifting", "ethereal"],
    genres: ["cinematic", "orchestral", "ambient", "electronic"],
    tempo: "slow",
  },
  upbeat_celebratory: {
    moods: ["energetic", "happy", "exciting", "triumphant", "motivational"],
    genres: ["pop", "rock", "indie", "electronic"],
    tempo: "fast",
  },
};

// ── Detect vibe from project context ─────────────────────────────────────────
export function detectVibe(opts: {
  vibe?: string;
  musicStyle?: string;
  analysisResults?: { mood?: string; energy?: string }[];
}): VibeKey {
  const combined = [opts.vibe, opts.musicStyle, ...(opts.analysisResults || []).map(a => `${a.mood} ${a.energy}`)].
    join(" ").toLowerCase();

  if (/country|folk|acoustic|warm|cozy|tender|emotional|intimate|gentle|soft|langley|choosin|texas|nashville/.test(combined)) return "warm_emotional";
  if (/fun|playful|cute|silly|funny|light|happy|bright|ukulele|baby|kids|toddler/.test(combined)) return "fun_playful";
  if (/cinematic|luxury|dramatic|epic|orchestral|film|ambient|editorial/.test(combined)) return "cinematic_luxury";
  if (/upbeat|energetic|celebrat|party|excit|hype|fast|pop|dance/.test(combined)) return "upbeat_celebratory";

  // Default: warm/emotional for lifestyle/family content
  return "warm_emotional";
}

// ── Soundstripe API types ────────────────────────────────────────────────────
interface SoundstripeAttributes {
  title?: string;
  full_title?: string;
  duration?: number;
  bpm?: number;
  // Soundstripe may return the streamable/downloadable URL in different fields
  audio_preview_url?: string;
  full_song_url?: string;
  mp3_download_url?: string;
  waveform_url?: string;
  // Relationship names (may come as included)
  genres?: string[];
  moods?: string[];
  has_vocals?: boolean;
  vocal_type?: string;
  artist_name?: string;
  album_title?: string;
}

interface SoundstripeTrack {
  id: string;
  type?: string;
  attributes?: SoundstripeAttributes;
  // Some API versions flatten attributes directly on the object
  title?: string;
  full_title?: string;
  duration?: number;
  bpm?: number;
  audio_preview_url?: string;
  full_song_url?: string;
  mp3_download_url?: string;
  has_vocals?: boolean;
  vocal_type?: string;
  artist_name?: string;
  genres?: string[];
  moods?: string[];
}

// Normalize a track regardless of whether it uses JSON:API `.attributes` or flat structure
function normalizeTrack(raw: SoundstripeTrack): {
  id: string;
  name: string;
  artist: string;
  url: string;
  bpm: number | null;
  duration: number | null;
  genres: string[];
  moods: string[];
  hasVocals: boolean;
} | null {
  const a = raw.attributes || raw;
  const url = a.full_song_url || a.audio_preview_url || a.mp3_download_url || "";
  if (!url) return null;

  return {
    id: String(raw.id),
    name: a.full_title || a.title || "Unknown Track",
    artist: a.artist_name || "Unknown Artist",
    url,
    bpm: a.bpm ?? null,
    duration: a.duration ?? null,
    genres: a.genres || [],
    moods: a.moods || [],
    hasVocals: a.has_vocals ?? (a.vocal_type !== "instrumental"),
  };
}

type NormalizedTrack = NonNullable<ReturnType<typeof normalizeTrack>>;

// ── Fetch tracks from Soundstripe ────────────────────────────────────────────
async function fetchSoundstripeTracks(
  apiKey: string,
  vibe: VibeKey,
  limit = 20,
): Promise<NormalizedTrack[]> {
  const filters = VIBE_FILTERS[vibe];

  // Build query string — Soundstripe uses bracket notation for arrays
  const params = new URLSearchParams();
  params.set("per_page", String(limit));
  params.set("page", "1");
  // Prefer instrumental
  params.append("filter[vocal_type][]", "instrumental");

  // Add up to 2 moods and 2 genres (more keeps result count high)
  filters.moods.slice(0, 2).forEach(m => params.append("filter[moods][]", m));
  filters.genres.slice(0, 2).forEach(g => params.append("filter[genres][]", g));
  if (filters.tempo) params.set("filter[tempo]", filters.tempo);

  const url = `${SOUNDSTRIPE_BASE}/songs?${params.toString()}`;

  console.log("[Soundstripe] Fetching:", url.replace(apiKey, "***"));

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Soundstripe API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json() as {
    data?: SoundstripeTrack[];
    songs?: SoundstripeTrack[];
    results?: SoundstripeTrack[];
  };

  // Soundstripe may return songs under `data`, `songs`, or `results`
  const raw: SoundstripeTrack[] = data.data || data.songs || data.results || [];
  console.log(`[Soundstripe] Raw tracks returned: ${raw.length}`);

  // If no instrumental results, widen search without vocal filter
  if (raw.length === 0) {
    const params2 = new URLSearchParams();
    params2.set("per_page", String(limit));
    filters.moods.slice(0, 2).forEach(m => params2.append("filter[moods][]", m));
    filters.genres.slice(0, 2).forEach(g => params2.append("filter[genres][]", g));

    const res2 = await fetch(`${SOUNDSTRIPE_BASE}/songs?${params2.toString()}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (res2.ok) {
      const data2 = await res2.json() as typeof data;
      const raw2: SoundstripeTrack[] = data2.data || data2.songs || data2.results || [];
      console.log(`[Soundstripe] Widened search returned: ${raw2.length}`);
      return raw2.map(normalizeTrack).filter((t): t is NormalizedTrack => t !== null);
    }
  }

  return raw.map(normalizeTrack).filter((t): t is NormalizedTrack => t !== null);
}

// ── Auto-select best track ────────────────────────────────────────────────────
// Scoring: instrumental > vocals, reasonable BPM, sufficient duration
function selectBestTrack(
  tracks: NormalizedTrack[],
  targetDuration: number,
): NormalizedTrack & { score: number; reason: string } {
  const scored = tracks.map(t => {
    let score = 50;
    let reasons: string[] = [];

    // Strongly prefer instrumental
    if (!t.hasVocals) { score += 30; reasons.push("instrumental"); }

    // Duration: prefer tracks >= target, penalise very short tracks
    if (t.duration !== null) {
      if (t.duration >= targetDuration) { score += 10; reasons.push("full length"); }
      else if (t.duration >= 30) { score += 5; reasons.push("can loop"); }
      else { score -= 10; }
    }

    // BPM sweet spot 60-140 (most lifestyle content)
    if (t.bpm !== null) {
      if (t.bpm >= 60 && t.bpm <= 140) { score += 5; reasons.push(`${t.bpm}bpm`); }
    }

    return { ...t, score, reason: reasons.join(", ") || "closest match" };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0];
}

// ── POST /api/music/soundstripe ───────────────────────────────────────────────
// Body: { vibe?, musicStyle?, projectVibe?, targetDuration? }
// Returns: { track: { name, artist, url, ... }, vibe, reason, debug }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.SOUNDSTRIPE_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "SOUNDSTRIPE_API_KEY not configured" }, { status: 500 });

  let body: {
    vibe?: string;
    musicStyle?: string;
    targetDuration?: number;
    analysisResults?: { mood?: string; energy?: string }[];
  } = {};
  try { body = await req.json(); } catch { /* empty body is fine */ }

  const { vibe, musicStyle, targetDuration = 60, analysisResults } = body;

  // 1. Detect vibe
  const vibeKey = detectVibe({ vibe, musicStyle, analysisResults });
  console.log(`[Soundstripe] Detected vibe: ${vibeKey} from (vibe="${vibe}", musicStyle="${musicStyle}")`);

  try {
    // 2. Fetch tracks
    const tracks = await fetchSoundstripeTracks(apiKey, vibeKey, 20);
    if (tracks.length === 0) {
      return NextResponse.json({ error: "No tracks found for vibe", vibe: vibeKey }, { status: 404 });
    }

    // 3. Auto-select best
    const selected = selectBestTrack(tracks, targetDuration);

    const debugInfo = {
      vibe: vibeKey,
      filters: VIBE_FILTERS[vibeKey],
      tracksReturned: tracks.length,
      selectedId: selected.id,
      selectedScore: selected.score,
      reason: selected.reason,
      targetDuration,
    };

    console.log("[Soundstripe] Selected:", selected.name, "—", selected.reason, "— score:", selected.score);

    return NextResponse.json({
      track: {
        id: selected.id,
        name: selected.name,
        artist: selected.artist,
        url: selected.url,
        bpm: selected.bpm,
        duration: selected.duration,
        genres: selected.genres,
        moods: selected.moods,
        source: "soundstripe",
      },
      vibe: vibeKey,
      reason: selected.reason,
      debug: debugInfo,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Soundstripe] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET /api/music/soundstripe?vibe=warm_emotional — quick test endpoint
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.SOUNDSTRIPE_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "SOUNDSTRIPE_API_KEY not configured" }, { status: 500 });

  const vibe = (new URL(req.url).searchParams.get("vibe") || "warm_emotional") as VibeKey;
  const safeVibe: VibeKey = VIBE_FILTERS[vibe] ? vibe : "warm_emotional";

  try {
    const tracks = await fetchSoundstripeTracks(apiKey, safeVibe, 20);
    return NextResponse.json({
      vibe: safeVibe,
      count: tracks.length,
      tracks: tracks.map(t => ({
        id: t?.id,
        name: t?.name,
        artist: t?.artist,
        url: t?.url,
        bpm: t?.bpm,
        duration: t?.duration,
        hasVocals: t?.hasVocals,
        genres: t?.genres,
        moods: t?.moods,
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
