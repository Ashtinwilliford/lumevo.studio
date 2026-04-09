import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import { logStage } from "@/lib/genlog";

export const maxDuration = 60;

// Royalty-free fallback music tracks (Bensound CC)
const MUSIC_FALLBACK = [
  "https://www.bensound.com/bensound-music/bensound-ukulele.mp3",
  "https://www.bensound.com/bensound-music/bensound-sunny.mp3",
  "https://www.bensound.com/bensound-music/bensound-acousticbreeze.mp3",
  "https://www.bensound.com/bensound-music/bensound-tenderness.mp3",
];

interface SceneItem {
  clip_id: string;
  start_trim_sec: number;
  end_trim_sec: number;
  overlay_text: string;
  transition_after: string;
}

interface VideoPlan {
  video_concept: string;
  target_emotion: string;
  opening_hook: string;
  music_brief: string;
  voiceover_needed: boolean;
  voiceover_script: string;
  caption_style_rules: string[];
  scene_order: SceneItem[];
  ending: string;
}

interface ClipRow {
  id: string;
  file_type: string;
  file_path: string;
  video_duration_sec: number | null;
  ai_analysis: Record<string, unknown> | null;
}

// Map Claude plan → Creatomate source JSON
function buildCreatomateSource(
  plan: VideoPlan,
  clips: Map<string, ClipRow>,
  style: { color_grade?: string; text_amount?: string },
  targetDuration: number,
  title: string,
  voiceoverUrl?: string | null,
  musicUrl?: string | null,
) {
  // Crossfade duration — clips overlap by this amount for a real dissolve
  const CROSSFADE_DUR = 0.5;

  // Helper: compute safe clip duration from plan values + actual clip metadata
  // targetPerClip is passed in so clips stretch to fill the target video duration.
  function safeClipDur(scene: SceneItem, clip: ClipRow, targetPerClip: number): { dur: number; trimStart: number; trimEnd: number } {
    const isVideo = clip.file_type === "video";
    const actualDur = clip.video_duration_sec ?? 5;
    let trimStart = scene.start_trim_sec ?? 0;
    let trimEnd = scene.end_trim_sec ?? 0;

    // Guard: invalid trims (0,0 or reversed or exceeding actual duration)
    if (trimEnd <= trimStart || (trimStart === 0 && trimEnd === 0)) {
      trimStart = 0;
      trimEnd = Math.min(actualDur, targetPerClip);
    }
    trimEnd = Math.min(trimEnd, actualDur);
    trimStart = Math.min(trimStart, trimEnd - 1);

    const sourceDur = trimEnd - trimStart;
    // Cap at targetPerClip so clips fill the video rather than being cut to 5s
    const dur = isVideo ? Math.max(1.5, Math.min(sourceDur, targetPerClip)) : Math.min(5, targetPerClip);
    return { dur, trimStart, trimEnd };
  }

  // ── Pass 1: precompute timing for every scene ──────────────────────────────
  interface SceneTiming {
    time: number; dur: number; trimStart: number; trimEnd: number; isVideo: boolean; hasAudio: boolean;
  }
  const validCount = plan.scene_order.filter(s => clips.get(s.clip_id)?.file_path).length;

  // Spread clips to fill the target duration — each clip gets an equal share, min 3s max 15s
  const targetPerClip = validCount > 0
    ? Math.max(3, Math.min(15, targetDuration / validCount))
    : 8;

  let clipStartTime = 0;
  let validIdx = 0;

  const sceneTimings: (SceneTiming | null)[] = plan.scene_order.map(scene => {
    const clip = clips.get(scene.clip_id);
    if (!clip?.file_path) return null;
    const { dur, trimStart, trimEnd } = safeClipDur(scene, clip, targetPerClip);
    const isLastValid = validIdx === validCount - 1;
    const thisTime = clipStartTime;
    clipStartTime += dur - (isLastValid ? 0 : CROSSFADE_DUR);
    validIdx++;
    const a = clip.ai_analysis || {};
    const hasAudio = clip.file_type === "video" && !!(a.has_laughter === true || a.has_natural_audio === true);
    return { time: thisTime, dur, trimStart, trimEnd, isVideo: clip.file_type === "video", hasAudio };
  });

  // Total video duration accounts for all crossfade overlaps
  const totalClipDur = clipStartTime;

  // ── Pass 2: build media elements ──────────────────────────────────────────
  let placedCount = 0;
  const mediaElements = plan.scene_order.map((scene, i) => {
    const timing = sceneTimings[i];
    const clip = clips.get(scene.clip_id);
    if (!timing || !clip?.file_path) return null;

    const { dur: clipDur, trimStart, trimEnd, isVideo, time: thisTime } = timing;
    const analysis = clip.ai_analysis || {};
    const hasPerson = !!(analysis.has_speech || analysis.has_laughter || analysis.has_natural_audio);

    // Alternate zoom in/out; person clips start tighter
    const zoomIn = i % 2 === 0;
    const baseScale = hasPerson ? "115%" : "100%";
    const endScale  = hasPerson ? (zoomIn ? "125%" : "115%") : (zoomIn ? "110%" : "100%");
    const zoomAnimation = {
      easing: "linear", type: "scale", scope: "element",
      start_scale: baseScale, end_scale: endScale,
    };

    // First clip: no transition; subsequent clips fade IN over the tail of the previous
    const animations = placedCount === 0
      ? [zoomAnimation]
      : [zoomAnimation, { type: "fade", duration: `${CROSSFADE_DUR} s` }];

    // Alternate tracks 1/2 so overlapping clips dissolve correctly
    const track = (placedCount % 2) + 1;
    placedCount++;

    return {
      type: isVideo ? "video" : "image",
      track,
      time: Math.max(0, thisTime),
      duration: clipDur,
      source: clip.file_path,
      fit: "cover",
      ...(isVideo ? { trim_start: trimStart, trim_end: trimEnd } : {}),
      // Only keep audio for clips where AI explicitly detected laughter/baby sounds.
      // Default when ai_analysis is null = muted (safe — avoids playing unwanted voices).
      volume: timing.hasAudio ? "100%" : "0%",
      animations,
    };
  }).filter(Boolean);

  // Text overlays from scene_order (only if text_amount is not "none")
  const textElements: Record<string, unknown>[] = [];
  const showText = style.text_amount !== "none";

  if (showText) {
    // Title card — track 3+ so it floats above video clips on tracks 1/2
    textElements.push({
      type: "text",
      track: 3,
      time: 0.3,
      duration: 2.5,
      text: title.toUpperCase(),
      width: "75%",
      x: "50%", y: "50%",
      x_alignment: "50%", y_alignment: "50%",
      font_family: "Playfair Display",
      font_weight: "700",
      font_size: "8 vmin",
      fill_color: "#ffffff",
      shadow_color: "rgba(0,0,0,0.6)",
      shadow_blur: "15",
      text_alignment: "center",
      letter_spacing: "8%",
      animations: [
        { type: "fade", fade_duration: "0.8 s" },
        { type: "scale", easing: "quadratic-out", scope: "element", start_scale: "90%", end_scale: "100%" },
      ],
    });

    // Overlay text from scenes (if provided and minimal)
    let timeOffset = 0;
    plan.scene_order.forEach((scene, i) => {
      const clip = clips.get(scene.clip_id);
      const isVideo = clip?.file_type === "video";
      const rawDur = scene.end_trim_sec - scene.start_trim_sec;
      let clipDur: number;
      if (isVideo) {
        const sourceDur = clip?.video_duration_sec ?? rawDur;
        clipDur = rawDur > 5 ? Math.max(1.5, Math.min(sourceDur, 5)) : Math.max(1.5, rawDur);
      } else {
        clipDur = 3.5;
      }
      if (scene.overlay_text && scene.overlay_text.trim()) {
        textElements.push({
          type: "text",
          track: 4,
          time: timeOffset + 0.5,
          duration: Math.min(clipDur - 0.5, 3),
          text: scene.overlay_text,
          width: "80%",
          x: "50%", y: "82%",
          x_alignment: "50%", y_alignment: "50%",
          font_family: "Montserrat",
          font_weight: "600",
          font_size: "5 vmin",
          fill_color: "#ffffff",
          shadow_color: "rgba(0,0,0,0.5)",
          shadow_blur: "10",
          text_alignment: "center",
          animations: [{ type: "fade", fade_duration: "0.5 s" }],
        });
      }
      timeOffset += clipDur;
      void i;
    });

    // NOTE: plan.ending is intentionally NOT rendered as a text overlay —
    // Claude uses it for internal editor notes. Showing it on-screen was a bug.
  }

  // ── Audio elements ────────────────────────────────────────────────────────
  const audioElements: Record<string, unknown>[] = [];
  const finalMusicUrl = musicUrl || MUSIC_FALLBACK[Math.floor(Math.random() * MUSIC_FALLBACK.length)];

  // ── Intelligent per-clip audio ducking ────────────────────────────────────
  // For video clips: music ducks to 18% so Ellie's voice / laughter comes through at 100%.
  // For image clips (no natural audio): music rises to 68% and fills the space.
  // Each segment has short fades (0.4s) so volume transitions blend smoothly.
  // trim_start keeps the song playing continuously across all segments.
  let musicOffset = 0;
  const validTimings = sceneTimings.filter((t): t is NonNullable<typeof t> => t !== null);
  validTimings.forEach((timing, idx) => {
    const isFirst = idx === 0;
    const isLast = idx === validTimings.length - 1;
    // Duck music when this clip has confirmed baby audio; otherwise music is prominent.
    const vol = timing.hasAudio ? "18%" : "65%";
    audioElements.push({
      type: "audio",
      source: finalMusicUrl,
      time: Math.max(0, timing.time),
      duration: timing.dur,
      trim_start: musicOffset,
      volume: vol,
      audio_fade_in: isFirst ? 1.5 : 0.4,
      audio_fade_out: isLast ? 3.0 : 0.4,
    });
    musicOffset += timing.dur;
  });

  // Voiceover
  if (voiceoverUrl) {
    audioElements.push({
      type: "audio",
      track: 5,
      time: 1,
      source: voiceoverUrl,
      volume: "100%",
      audio_fade_in: 0.3,
      audio_fade_out: 0.5,
    });
  }

  return {
    output_format: "mp4",
    width: 1080,
    height: 1920,
    frame_rate: 30,
    fill_color: "#000000",
    elements: [
      ...mediaElements,
      ...textElements,
      ...audioElements,
    ],
  };
}

// POST: Take a Claude plan and render it via Creatomate
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Derive origin from request URL (avoids hard-coded localhost)
  const reqOrigin = new URL(req.url).origin;
  // Forward session cookie to internal API calls
  const cookieHeader = req.headers.get("cookie") || "";

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }

  const { projectId, plan: bodyPlan } = body;
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const userId = session.id;
  const startTime = Date.now();

  try {
    // Load project with plan
    const projectRes = await query("SELECT * FROM projects WHERE id = $1 AND user_id = $2", [projectId, userId]);
    const project = projectRes.rows[0];
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    // Use DB plan if available, fall back to plan passed in request body
    // Note: postgres driver returns JSONB columns as strings — must parse
    let dbPlan: VideoPlan | null = null;
    try {
      const raw = project.claude_plan;
      if (raw && typeof raw === "string") dbPlan = JSON.parse(raw) as VideoPlan;
      else if (raw && typeof raw === "object") dbPlan = raw as VideoPlan;
    } catch { dbPlan = null; }

    const plan = (dbPlan?.scene_order?.length ? dbPlan : null) || (bodyPlan as VideoPlan) || null;
    if (!plan?.scene_order?.length) return NextResponse.json({ error: "No plan generated yet. Generate a plan first." }, { status: 400 });

    // Load creator style
    const styleRes = await query("SELECT * FROM creator_styles WHERE user_id = $1", [userId]);
    const style = (styleRes.rows[0] || {}) as { color_grade?: string; text_amount?: string };

    // Load clips
    const clipIds = plan.scene_order.map(s => s.clip_id);
    const placeholders = clipIds.map((_, i) => `$${i + 2}`).join(", ");
    const clipRes = await query(
      `SELECT id, file_type, file_path, video_duration_sec, ai_analysis
       FROM uploads WHERE user_id = $1 AND id IN (${placeholders})`,
      [userId, ...clipIds]
    );
    const clipMap = new Map<string, ClipRow>();
    for (const c of clipRes.rows as unknown as ClipRow[]) {
      // postgres returns JSONB as string — parse ai_analysis if needed
      if (c.ai_analysis && typeof c.ai_analysis === "string") {
        try { c.ai_analysis = JSON.parse(c.ai_analysis as unknown as string); } catch { c.ai_analysis = null; }
      }
      clipMap.set(c.id, c);
    }

    // Check for / generate voiceover
    let voiceoverUrl: string | null = null;
    if (plan.voiceover_needed && plan.voiceover_script) {
      // Check if we already have one
      const voRes = await query(
        "SELECT audio_url FROM voiceovers WHERE project_id = $1 AND status = 'completed' AND audio_type = 'voiceover' ORDER BY created_at DESC LIMIT 1",
        [projectId]
      );
      if (voRes.rows[0]?.audio_url) {
        voiceoverUrl = voRes.rows[0].audio_url as string;
      } else if (process.env.ELEVENLABS_API_KEY) {
        // Generate voiceover with ElevenLabs
        try {
          const voiceRes = await fetch(`${reqOrigin}/api/voice/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Cookie: cookieHeader },
            body: JSON.stringify({ projectId, script: plan.voiceover_script }),
          });
          if (voiceRes.ok) {
            const voiceData = await voiceRes.json();
            voiceoverUrl = voiceData.audioUrl || null;
          }
          await logStage(projectId, userId, "voiceover_generation", { script: plan.voiceover_script.slice(0, 100) }, { voiceoverUrl }, undefined, 0);
        } catch (err) {
          console.error("Voiceover generation failed:", err);
        }
      }
    }

    const title = project.title as string;
    const targetDuration = (project.target_duration as number) || 30;

    // ── Music selection ─────────────────────────────────────────────────────
    // Priority: cached matching music → ElevenLabs (when music_style set) → Bensound fallback
    let musicUrl: string | null = null;
    const projectMusicStyle = (project.music_style as string) || "";
    try {
      // Check cache: only reuse if style_prompt matches current music_style
      const existingMusic = await query(
        "SELECT audio_url, style_prompt FROM voiceovers WHERE project_id = $1 AND audio_type = 'music' AND status = 'completed' ORDER BY created_at DESC LIMIT 1",
        [projectId]
      );
      if (existingMusic.rows[0]?.audio_url) {
        const cachedUrl = existingMusic.rows[0].audio_url as string;
        const cachedStyle = (existingMusic.rows[0].style_prompt as string) || "";
        // Reuse if: it's a library track matching current style, OR an ElevenLabs track for same style
        const styleMatches = !projectMusicStyle || cachedStyle === projectMusicStyle;
        const notOldSoundEffect = !cachedUrl.includes("res.cloudinary.com") || styleMatches;
        if (styleMatches && notOldSoundEffect) musicUrl = cachedUrl;
      }

      if (!musicUrl) {
        if (projectMusicStyle && process.env.ELEVENLABS_API_KEY) {
          // Generate music with ElevenLabs using the user's genre description
          const genRes = await fetch(`${reqOrigin}/api/music/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Cookie: cookieHeader },
            body: JSON.stringify({ projectId }),
          });
          if (genRes.ok) {
            const genData = await genRes.json();
            if (genData.audioUrl) musicUrl = genData.audioUrl as string;
          }
        }

        if (!musicUrl) {
          // Fall back to Bensound royalty-free library
          const vibe = project.vibe as string || "warm cozy";
          const platform = project.target_platform as string || "instagram";
          const selectRes = await fetch(`${reqOrigin}/api/music/select`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Cookie: cookieHeader },
            body: JSON.stringify({ vibe, platform, duration: targetDuration, title: project.title }),
          });
          if (selectRes.ok) {
            const selectData = await selectRes.json();
            if (selectData.track?.url) {
              musicUrl = selectData.track.url as string;
              await query(
                `INSERT INTO voiceovers (user_id, project_id, audio_url, status, audio_type, style_prompt)
                 VALUES ($1, $2, $3, 'completed', 'music', $4) ON CONFLICT DO NOTHING`,
                [userId, projectId, musicUrl, vibe]
              );
            }
          }
        }
      }
    } catch (err) {
      console.error("Music selection failed, using fallback:", err);
    }
    await logStage(projectId, userId, "music_generation", { prompt: plan.music_brief, musicStyle: projectMusicStyle }, { musicUrl }, undefined, 0);

    // Build Creatomate source
    const source = buildCreatomateSource(plan, clipMap, style, targetDuration, title, voiceoverUrl, musicUrl);

    // Send to Creatomate
    const apiKey = process.env.CREATOMATE_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "CREATOMATE_API_KEY not configured" }, { status: 500 });

    await logStage(projectId, userId, "creatomate_payload", source, null, undefined, 0);

    const creatomateRes = await fetch("https://api.creatomate.com/v1/renders", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ source }),
    });

    const renderData = await creatomateRes.json();

    if (!creatomateRes.ok) {
      const errMsg = typeof renderData === "object" && renderData?.message ? renderData.message : JSON.stringify(renderData);
      await logStage(projectId, userId, "creatomate_render", source, renderData, errMsg, Date.now() - startTime);
      return NextResponse.json({ error: `Render error: ${errMsg}` }, { status: 500 });
    }

    const render = Array.isArray(renderData) ? renderData[0] : renderData;
    const videoUrl = render?.url;
    const renderId = render?.id;

    if (!videoUrl) return NextResponse.json({ error: "No video URL returned" }, { status: 500 });

    // Save render info
    await query(
      `UPDATE projects SET render_payload = $1, render_id = $2, video_url = $3, status = 'rendering', updated_at = now()
       WHERE id = $4`,
      [JSON.stringify(source), renderId, videoUrl, projectId]
    );

    await logStage(projectId, userId, "creatomate_render", { renderId }, { videoUrl }, undefined, Date.now() - startTime);

    return NextResponse.json({ videoUrl, renderId, status: "rendering" });
  } catch (err) {
    console.error("Render error:", err);
    await logStage(projectId, userId, "creatomate_render", {}, null, err instanceof Error ? err.message : "Unknown", Date.now() - startTime);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Render failed" }, { status: 500 });
  }
}
