import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import { logStage } from "@/lib/genlog";

export const maxDuration = 60;

// Publicly accessible music tracks (Creatomate CDN)
const MUSIC_FALLBACK = [
  "https://cdn.creatomate.com/demo/music1.mp3",
  "https://cdn.creatomate.com/demo/music2.mp3",
  "https://cdn.creatomate.com/demo/music3.mp3",
  "https://cdn.creatomate.com/demo/music4.mp3",
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
  // Transition cycle: alternate fade (0.6s) and fast-fade (0.2s)
  const transitionCycle = [
    { type: "fade", duration: "0.6 s" },
    { type: "fade", duration: "0.2 s" },
  ];

  // Color grading — build CSS filter strings for Creatomate
  const gradeMap: Record<string, string> = {
    warm: "sepia(0.1) brightness(1.04) contrast(1.06)",
    cool: "hue-rotate(10deg) brightness(1.03) contrast(1.08)",
    dramatic: "contrast(1.15) brightness(0.97)",
    natural: "brightness(1.02)",
    moody: "sepia(0.06) contrast(1.12) brightness(0.95)",
  };
  const colorFilter = gradeMap[style.color_grade || "warm"] || gradeMap.warm;
  void colorFilter; // used for future filter support

  // Helper: compute safe clip duration from plan values + actual clip metadata
  function safeClipDur(scene: SceneItem, clip: ClipRow): { dur: number; trimStart: number; trimEnd: number } {
    const isVideo = clip.file_type === "video";
    const actualDur = clip.video_duration_sec ?? 5;
    let trimStart = scene.start_trim_sec ?? 0;
    let trimEnd = scene.end_trim_sec ?? 0;

    // Guard: invalid trims (0,0 or reversed or exceeding actual duration)
    if (trimEnd <= trimStart || (trimStart === 0 && trimEnd === 0)) {
      // Use the full clip, capped at 6s
      trimStart = 0;
      trimEnd = Math.min(actualDur, 6);
    }
    // Clamp to actual duration
    trimEnd = Math.min(trimEnd, actualDur);
    trimStart = Math.min(trimStart, trimEnd - 1);

    const sourceDur = trimEnd - trimStart;
    let dur: number;
    if (isVideo) {
      // Cap display duration at 5s (if source is longer, Creatomate speeds it up)
      dur = Math.max(1.5, Math.min(sourceDur, 5));
    } else {
      dur = 3.5;
    }
    return { dur, trimStart, trimEnd };
  }

  // Build media elements from scene_order
  const mediaElements = plan.scene_order.map((scene, i) => {
    const clip = clips.get(scene.clip_id);
    if (!clip?.file_path) return null;

    const isVideo = clip.file_type === "video";
    const { dur: clipDur, trimStart, trimEnd } = safeClipDur(scene, clip);

    const analysis = clip.ai_analysis || {};
    const hasPerson = !!(analysis.has_speech || analysis.has_laughter || analysis.has_natural_audio);

    // Zoom: person clips zoom in tighter (they fill the frame better)
    // Even clips zoom IN, odd zoom OUT — but person clips always start at 115% to crop in closer
    const zoomIn = i % 2 === 0;
    const baseScale = hasPerson ? "115%" : "100%";
    const endScale  = hasPerson ? (zoomIn ? "125%" : "115%") : (zoomIn ? "110%" : "100%");
    const zoomAnimation = {
      easing: "linear",
      type: "scale",
      scope: "element",
      start_scale: baseScale,
      end_scale: endScale,
    };

    // Transition: cycle fade/fast-fade
    const trans = transitionCycle[i % transitionCycle.length];
    const transitionAnimation = i > 0 ? [{ type: trans.type, duration: trans.duration }] : [];

    // Audio: keep original audio for any clip with voice/laughter/natural sound
    const keepAudio = isVideo && hasPerson;

    return {
      type: isVideo ? "video" : "image",
      track: 1,
      duration: clipDur,
      source: clip.file_path,
      fit: "cover",
      ...(isVideo ? { trim_start: trimStart, trim_end: trimEnd } : {}),
      volume: keepAudio ? "100%" : "0%",
      animations: [zoomAnimation, ...transitionAnimation],
    };
  }).filter(Boolean);

  // Compute actual total clip duration so music doesn't run past the video
  const totalClipDur = (mediaElements as { duration: number }[]).reduce((sum, el) => sum + (el?.duration ?? 0), 0);

  // Text overlays from scene_order (only if text_amount is not "none")
  const textElements: Record<string, unknown>[] = [];
  const showText = style.text_amount !== "none";

  if (showText) {
    // Title card
    textElements.push({
      type: "text",
      track: 2,
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
          track: 3,
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

    // Ending text
    if (plan.ending && totalClipDur > 4) {
      textElements.push({
        type: "text",
        track: 4,
        time: Math.max(0, totalClipDur - 3),
        duration: 2.5,
        text: plan.ending,
        width: "70%",
        x: "50%", y: "50%",
        x_alignment: "50%", y_alignment: "50%",
        font_family: "Playfair Display",
        font_weight: "700",
        font_size: "6 vmin",
        fill_color: "#ffffff",
        shadow_color: "rgba(0,0,0,0.5)",
        shadow_blur: "12",
        text_alignment: "center",
        animations: [{ type: "fade", fade_duration: "0.8 s" }],
      });
    }
  }

  // Audio elements
  const audioElements: Record<string, unknown>[] = [];

  // Background music — duration matches actual clip duration so video doesn't run to black
  const finalMusicUrl = musicUrl || MUSIC_FALLBACK[Math.floor(Math.random() * MUSIC_FALLBACK.length)];
  const hasSpeechClips = plan.scene_order.some(s => {
    const c = clips.get(s.clip_id);
    return c?.ai_analysis?.has_speech || c?.ai_analysis?.has_laughter || c?.ai_analysis?.has_natural_audio;
  });

  // Music stays quiet so Ellie's voice / laughter comes through clearly
  audioElements.push({
    type: "audio",
    source: finalMusicUrl,
    duration: totalClipDur,
    volume: hasSpeechClips ? "18%" : "65%",
    loop: true,
    audio_fade_in: 1.5,
    audio_fade_out: 3.5,
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

    // Generate music with ElevenLabs if key is configured
    let musicUrl: string | null = null;
    if (process.env.ELEVENLABS_API_KEY) {
      try {
        // Check if we already have a music track for this project
        const existingMusic = await query(
          "SELECT audio_url FROM voiceovers WHERE project_id = $1 AND audio_type = 'music' AND status = 'completed' ORDER BY created_at DESC LIMIT 1",
          [projectId]
        );
        if (existingMusic.rows[0]?.audio_url) {
          musicUrl = existingMusic.rows[0].audio_url as string;
        } else {
          // Generate new music — parse claude_plan JSONB string if needed for music prompt derivation
          let parsedPlanForMusic: { music_brief?: string } | null = null;
          try {
            const rawPlan = project.claude_plan;
            if (rawPlan && typeof rawPlan === "string") parsedPlanForMusic = JSON.parse(rawPlan);
            else if (rawPlan && typeof rawPlan === "object") parsedPlanForMusic = rawPlan as { music_brief?: string };
          } catch { parsedPlanForMusic = null; }
          void parsedPlanForMusic; // music/generate endpoint handles its own plan lookup

          const musicRes = await fetch(`${reqOrigin}/api/music/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Cookie: cookieHeader },
            body: JSON.stringify({ projectId, durationSeconds: Math.min(targetDuration + 5, 60) }),
          });
          if (musicRes.ok) {
            const musicData = await musicRes.json();
            musicUrl = musicData.audioUrl || null;
          }
        }
        await logStage(projectId, userId, "music_generation", { prompt: plan.music_brief }, { musicUrl }, undefined, 0);
      } catch (err) {
        console.error("Music generation failed, using fallback:", err);
        // Non-fatal — falls back to Creatomate CDN music
      }
    }

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
