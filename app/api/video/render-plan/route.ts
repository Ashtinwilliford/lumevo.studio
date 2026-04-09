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
  const transitionDur = 0.8;

  // Color grading based on style
  const gradeMap: Record<string, { type: string; value: string }[]> = {
    warm: [{ type: "sepia", value: "10%" }, { type: "brighten", value: "4%" }, { type: "contrast", value: "6%" }],
    cool: [{ type: "hue", value: "10" }, { type: "brighten", value: "3%" }, { type: "contrast", value: "8%" }],
    dramatic: [{ type: "contrast", value: "15%" }, { type: "brighten", value: "-3%" }],
    natural: [{ type: "brighten", value: "2%" }],
    moody: [{ type: "sepia", value: "6%" }, { type: "contrast", value: "12%" }, { type: "brighten", value: "-5%" }],
  };
  const colorFilter = gradeMap[style.color_grade || "warm"] || gradeMap.warm;

  // Build media elements from scene_order
  const mediaElements = plan.scene_order.map((scene, i) => {
    const clip = clips.get(scene.clip_id);
    if (!clip) return null;

    const isVideo = clip.file_type === "video";
    const clipDur = Math.max(1, scene.end_trim_sec - scene.start_trim_sec);

    return {
      type: isVideo ? "video" : "image",
      track: 1,
      duration: clipDur,
      source: clip.file_path,
      fit: "cover",
      ...(isVideo ? { trim_start: scene.start_trim_sec, trim_end: scene.end_trim_sec } : {}),
      // Keep original audio for videos with speech, otherwise mute
      ...(isVideo && clip.ai_analysis?.has_speech ? { volume: "100%" } : { volume: "0%" }),
      color_filter: colorFilter,
      animations: [
        ...(isVideo ? [] : [{
          easing: "linear",
          type: "scale",
          scope: "element",
          start_scale: "100%",
          end_scale: "112%",
        }]),
        ...(i > 0 ? [{
          type: scene.transition_after === "cut" ? "fade" : "fade",
          duration: scene.transition_after === "cut" ? "0.2 s" : `${transitionDur} s`,
        }] : []),
      ],
    };
  }).filter(Boolean);

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
    plan.scene_order.forEach(scene => {
      const clipDur = Math.max(1, scene.end_trim_sec - scene.start_trim_sec);
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
    });

    // Ending text
    if (plan.ending) {
      textElements.push({
        type: "text",
        track: 4,
        time: targetDuration - 3,
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

  // Background music
  const finalMusicUrl = musicUrl || MUSIC_FALLBACK[Math.floor(Math.random() * MUSIC_FALLBACK.length)];
  const hasSpeechClips = plan.scene_order.some(s => {
    const c = clips.get(s.clip_id);
    return c?.ai_analysis?.has_speech;
  });

  audioElements.push({
    type: "audio",
    source: finalMusicUrl,
    duration: targetDuration,
    volume: hasSpeechClips ? "35%" : "75%",
    audio_fade_in: 1.5,
    audio_fade_out: 2.5,
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
    const dbPlan = project.claude_plan as VideoPlan;
    const plan = (dbPlan && typeof dbPlan === 'object' && Array.isArray((dbPlan as VideoPlan).scene_order) && (dbPlan as VideoPlan).scene_order.length > 0 ? dbPlan : null)
      || (bodyPlan as VideoPlan)
      || null;
    console.log("[render-plan] dbPlan type:", typeof dbPlan, "dbPlan keys:", dbPlan ? Object.keys(dbPlan) : "null");
    console.log("[render-plan] bodyPlan type:", typeof bodyPlan, "bodyPlan scene_order length:", (bodyPlan as VideoPlan)?.scene_order?.length ?? "N/A");
    console.log("[render-plan] resolved plan scene_order length:", plan?.scene_order?.length ?? "NONE");
    if (!plan?.scene_order?.length) return NextResponse.json({ error: "No plan generated yet. Generate a plan first.", debug: { dbPlanType: typeof dbPlan, dbPlanKeys: dbPlan ? Object.keys(dbPlan) : null, bodyPlanSceneCount: (bodyPlan as VideoPlan)?.scene_order?.length ?? null } }, { status: 400 });

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
          const voiceRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/voice/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Cookie: "" },
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
          // Generate new music
          const musicRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/music/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Cookie: "" },
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
