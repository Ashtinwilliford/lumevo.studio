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
  // Native dissolve between adjacent clips on the same track
  const CROSSFADE_DUR = 0.6;

  // ── Detect if a clip's subject appears small/distant ──────────────────────
  // Used to drive a strong push-in zoom that brings the viewer closer.
  function isDistantSubject(analysis: Record<string, unknown>): boolean {
    const desc = ((analysis.description as string) || "").toLowerCase();
    const bestUse = (analysis.best_use as string) || "";
    return (
      bestUse === "wide" ||
      /\bfar\b|distant|small|walk.*away|tiny|field|background|far away/.test(desc)
    );
  }

  // ── Pass 1: compute timing with speed stretching ───────────────────────────
  // Each clip is slowed down (min 0.5×) to fill its targetPerClip slot so the
  // video actually reaches targetDuration seconds. Images stay at normal pace.
  interface SceneTiming {
    time: number;
    dur: number;       // displayed duration (after speed adjustment)
    trimStart: number;
    trimEnd: number;
    speed: number;     // playback rate (0.5 = half speed → twice as long)
    isVideo: boolean;
    hasAudio: boolean;
    farAway: boolean;
  }

  const validCount = plan.scene_order.filter(s => clips.get(s.clip_id)?.file_path).length;
  // Each clip gets an equal share of targetDuration, between 4 s and 15 s
  const targetPerClip = validCount > 0
    ? Math.max(4, Math.min(15, targetDuration / validCount))
    : 8;

  let clipStartTime = 0;
  let validIdx = 0;

  const sceneTimings: (SceneTiming | null)[] = plan.scene_order.map(scene => {
    const clip = clips.get(scene.clip_id);
    if (!clip?.file_path) return null;

    const isVideo = clip.file_type === "video";
    // When duration is unknown, assume a generous 15s so clips aren't cut to 5s stubs
    const actualDur = clip.video_duration_sec ?? (isVideo ? 15 : 5);
    if (!clip.video_duration_sec && isVideo) console.warn(`[render-plan] Clip ${scene.clip_id.slice(0,8)} missing duration — using ${actualDur}s default`);
    const a = clip.ai_analysis || {};

    // Prefer AI best_moment over plan trims for tighter clip selection
    let trimStart = (a.best_moment_start as number) ?? scene.start_trim_sec ?? 0;
    let trimEnd   = (a.best_moment_end   as number) ?? scene.end_trim_sec   ?? 0;

    if (trimEnd <= trimStart || trimEnd === 0) {
      trimStart = 0;
      trimEnd = actualDur;
    }
    trimEnd   = Math.min(trimEnd, actualDur);
    trimStart = Math.max(0, Math.min(trimStart, trimEnd - 1));

    const sourceDur = trimEnd - trimStart;

    // Speed: slow clip down to fill targetPerClip (floor at 0.5× = cinematic slow-mo)
    // Images don't have a speed concept — use them at fixed 5 s
    let speed = 1;
    let dur: number;
    if (isVideo) {
      speed = Math.max(0.5, Math.min(1.0, sourceDur / targetPerClip));
      dur   = Math.min(sourceDur / speed, targetPerClip);
    } else {
      dur = Math.min(5, targetPerClip);
    }
    dur = Math.max(1.5, dur);

    const isLastValid = validIdx === validCount - 1;
    const thisTime = clipStartTime;
    clipStartTime += dur - (isLastValid ? 0 : CROSSFADE_DUR);
    validIdx++;

    const hasAudio = isVideo && !!(a.has_laughter === true || a.has_natural_audio === true);
    const farAway  = isDistantSubject(a);
    return { time: thisTime, dur, trimStart, trimEnd, speed, isVideo, hasAudio, farAway };
  });

  const totalClipDur = clipStartTime;

  // ── Pass 2: build media elements ──────────────────────────────────────────
  // ALL clips on track 1 — Creatomate's `transition` property auto-positions
  // each clip to overlap the previous by transition.duration, then blends them.
  //
  // CRITICAL: Do NOT set explicit `time` on clips when using `transition`.
  // Explicit time CONFLICTS with transition auto-positioning and causes
  // double-overlap, which shows the black fill_color through the alpha blend.
  // Pass 1 timing is ONLY used for audio/text element positioning.
  let placedCount = 0;
  const mediaElements = plan.scene_order.map((scene, i) => {
    const timing = sceneTimings[i];
    const clip = clips.get(scene.clip_id);
    if (!timing || !clip?.file_path) return null;

    const { dur: clipDur, trimStart, trimEnd, speed, isVideo, farAway } = timing;
    const analysis = clip.ai_analysis || {};
    const hasPerson = !!(analysis.has_speech || analysis.has_laughter || analysis.has_natural_audio);

    // ── Ken Burns zoom ────────────────────────────────────────────────────
    const zoomIn    = i % 2 === 0;
    let startScale: string;
    let endScale:   string;

    if (farAway) {
      startScale = "100%";
      endScale   = "155%";
    } else if (hasPerson) {
      startScale = zoomIn ? "110%" : "122%";
      endScale   = zoomIn ? "122%" : "110%";
    } else {
      startScale = zoomIn ? "100%" : "112%";
      endScale   = zoomIn ? "112%" : "100%";
    }

    const zoomAnimation = {
      type: "scale",
      easing: "linear",
      time: 0,
      duration: clipDur,
      start_scale: startScale,
      end_scale:   endScale,
    };

    const el: Record<string, unknown> = {
      type: isVideo ? "video" : "image",
      track: 1,
      // *** NO explicit time — transition auto-positions on the track ***
      duration: clipDur,
      source: clip.file_path,
      fit: "cover",
      volume: timing.hasAudio ? "100%" : "0%",
      animations: [zoomAnimation],
    };

    if (isVideo) {
      el.trim_start = trimStart;
      el.trim_end   = trimEnd;
      // Creatomate expects speed as percentage: 50 = half speed, 100 = normal, 200 = 2x
      if (speed < 0.99) el.speed = `${Math.round(speed * 100)}%`;
    }

    // Creatomate SDK: transition = "animation between this and previous element"
    // The engine blends outgoing → incoming INTERNALLY — no black background
    // ever shows because both elements are composited in the same pass.
    if (placedCount > 0) {
      el.transition = { type: "fade", duration: CROSSFADE_DUR };
    }

    placedCount++;
    return el;
  }).filter(Boolean);

  // ── Text overlays ─────────────────────────────────────────────────────────
  const textElements: Record<string, unknown>[] = [];
  const showText = style.text_amount !== "none";

  if (showText) {
    // Title card on track 3 (above all video)
    textElements.push({
      type: "text",
      track: 3,
      time: 0.4,
      duration: 2.8,
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
        { type: "fade", time: 0, duration: 0.8 },
        { type: "scale", easing: "quadratic-out", time: 0, duration: 0.8, start_scale: "90%", end_scale: "100%" },
      ],
    });

    // Per-scene captions using Pass 1 times
    plan.scene_order.forEach((scene, i) => {
      const timing = sceneTimings[i];
      if (!timing || !scene.overlay_text?.trim()) return;
      textElements.push({
        type: "text",
        track: 4,
        time: timing.time + 0.5,
        duration: Math.max(1, Math.min(timing.dur - 0.6, 3.5)),
        text: scene.overlay_text,
        width: "80%",
        x: "50%", y: "82%",
        x_alignment: "50%", y_alignment: "50%",
        font_family: "Montserrat",
        font_weight: "600",
        font_size: "5 vmin",
        fill_color: "#ffffff",
        shadow_color: "rgba(0,0,0,0.55)",
        shadow_blur: "10",
        text_alignment: "center",
        animations: [{ type: "fade", time: 0, duration: 0.5 }],
      });
    });
  }

  // ── Audio elements ────────────────────────────────────────────────────────
  // SINGLE music element on track 2 — multiple audio elements on the same
  // implicit track cancel each other out in Creatomate; one element is reliable.
  // Volume ducking is applied globally: lower when baby audio is present in any clip.
  const audioElements: Record<string, unknown>[] = [];
  const finalMusicUrl = musicUrl || MUSIC_FALLBACK[Math.floor(Math.random() * MUSIC_FALLBACK.length)];
  const hasAnyNaturalAudio = sceneTimings.some(t => t?.hasAudio);

  audioElements.push({
    type: "audio",
    track: 2,
    time: 0,
    duration: totalClipDur,
    source: finalMusicUrl,
    // Duck slightly when baby audio is present, prominent otherwise
    volume: hasAnyNaturalAudio ? "22%" : "65%",
    audio_fade_in: 1.5,
    audio_fade_out: 3.0,
  });

  // Voiceover on track 3 (audio)
  if (voiceoverUrl) {
    audioElements.push({
      type: "audio",
      track: 3,
      time: 1,
      duration: totalClipDur - 1,
      source: voiceoverUrl,
      volume: "90%",
      audio_fade_in: 0.4,
      audio_fade_out: 0.8,
    });
  }

  console.log(`[buildCreatomateSource] clips=${validCount} targetPerClip=${targetPerClip.toFixed(1)}s totalDur=${totalClipDur.toFixed(1)}s music=${finalMusicUrl.slice(0,60)} voiceover=${!!voiceoverUrl}`);

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

    // ── Voiceover ───────────────────────────────────────────────────────────
    // Generate from plan.voiceover_script regardless of voiceover_needed flag.
    // Also check project.voiceover_script as a secondary source.
    // Cache in voiceovers table so re-renders reuse the same file.
    let voiceoverUrl: string | null = null;
    const voScript = plan.voiceover_script?.trim() || (project.voiceover_script as string | null)?.trim() || "";
    if (voScript) {
      const voRes = await query(
        "SELECT audio_url FROM voiceovers WHERE project_id = $1 AND status = 'completed' AND audio_type = 'voiceover' ORDER BY created_at DESC LIMIT 1",
        [projectId]
      );
      if (voRes.rows[0]?.audio_url) {
        voiceoverUrl = voRes.rows[0].audio_url as string;
        console.log("[render-plan] Reusing cached voiceover");
      } else if (process.env.ELEVENLABS_API_KEY) {
        try {
          const voiceRes = await fetch(`${reqOrigin}/api/voice/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Cookie: cookieHeader },
            body: JSON.stringify({ projectId, script: voScript }),
          });
          if (voiceRes.ok) {
            const voiceData = await voiceRes.json() as { audioUrl?: string };
            voiceoverUrl = voiceData.audioUrl || null;
            console.log("[render-plan] Voiceover generated:", voiceoverUrl?.slice(0, 60));
          } else {
            console.warn("[render-plan] Voiceover generation failed:", await voiceRes.text().catch(() => ""));
          }
          await logStage(projectId, userId, "voiceover_generation", { script: voScript.slice(0, 100) }, { voiceoverUrl }, undefined, 0);
        } catch (err) {
          console.error("[render-plan] Voiceover error:", err instanceof Error ? err.message : err);
        }
      } else {
        console.warn("[render-plan] ELEVENLABS_API_KEY not set — voiceover skipped");
      }
    } else {
      console.log("[render-plan] No voiceover script in plan — skipping");
    }

    const title = project.title as string;
    const targetDuration = (project.target_duration as number) || 30;

    // ── Music selection ─────────────────────────────────────────────────────
    // Priority order (handled inside /api/music/select):
    //   1. Soundstripe (licensed library — primary)
    //   2. ElevenLabs sound generation (fallback)
    //   3. Bensound royalty-free library (last resort)
    // We cache the selected URL in voiceovers so repeated re-renders skip the API call.
    let musicUrl: string | null = null;
    const projectMusicStyle = (project.music_style as string) || "";
    let musicSource = "unknown";
    let musicTrackName = "";

    try {
      // Check cache: reuse if style_prompt matches the current music_style
      const existingMusic = await query(
        "SELECT audio_url, style_prompt FROM voiceovers WHERE project_id = $1 AND audio_type = 'music' AND status = 'completed' ORDER BY created_at DESC LIMIT 1",
        [projectId]
      );
      if (existingMusic.rows[0]?.audio_url) {
        const cachedUrl = existingMusic.rows[0].audio_url as string;
        const cachedStyle = (existingMusic.rows[0].style_prompt as string) || "";
        const styleMatches = !projectMusicStyle || cachedStyle === projectMusicStyle;
        if (styleMatches) {
          musicUrl = cachedUrl;
          musicSource = "cached";
          console.log("[render-plan] Reusing cached music:", cachedUrl.slice(0, 80));
        }
      }

      if (!musicUrl) {
        // Pull AI analysis moods from clips to help vibe detection
        const analysisResults = Array.from(clipMap.values())
          .map(c => c.ai_analysis ? { mood: c.ai_analysis.mood as string, energy: c.ai_analysis.energy as string } : null)
          .filter(Boolean) as { mood: string; energy: string }[];

        const selectRes = await fetch(`${reqOrigin}/api/music/select`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookieHeader },
          body: JSON.stringify({
            vibe: project.vibe as string || "warm cozy",
            musicStyle: projectMusicStyle,
            platform: project.target_platform as string || "instagram",
            duration: targetDuration,
            title: project.title,
            projectId,
            analysisResults,
          }),
        });

        if (selectRes.ok) {
          const selectData = await selectRes.json() as {
            track?: { url: string; name?: string; artist?: string; source?: string };
            source?: string;
            reason?: string;
          };
          if (selectData.track?.url) {
            musicUrl = selectData.track.url;
            musicSource = selectData.source || selectData.track.source || "select";
            musicTrackName = [selectData.track.name, selectData.track.artist].filter(Boolean).join(" — ");

            // Cache so next render is instant
            await query(
              `INSERT INTO voiceovers (user_id, project_id, audio_url, status, audio_type, style_prompt)
               VALUES ($1, $2, $3, 'completed', 'music', $4) ON CONFLICT DO NOTHING`,
              [userId, projectId, musicUrl, projectMusicStyle || "auto"]
            ).catch(() => { /* non-fatal */ });

            console.log(`[render-plan] Music selected via ${musicSource}: "${musicTrackName}" — ${selectData.reason || ""}`);
          }
        } else {
          console.warn("[render-plan] /api/music/select failed:", await selectRes.text().catch(() => ""));
        }
      }
    } catch (err) {
      console.error("[render-plan] Music selection error:", err instanceof Error ? err.message : err);
    }

    await logStage(
      projectId, userId, "music_generation",
      { musicStyle: projectMusicStyle, vibe: project.vibe },
      { musicUrl, source: musicSource, track: musicTrackName },
      undefined, 0
    );

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
