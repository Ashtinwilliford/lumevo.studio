import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";

export const maxDuration = 60;

// Curated royalty-free cinematic music tracks (direct MP3 URLs)
const MUSIC_LIBRARY = [
  // Emotional/cinematic
  "https://cdn.pixabay.com/audio/2024/11/29/audio_688ab0e968.mp3", // cinematic emotional
  "https://cdn.pixabay.com/audio/2024/02/14/audio_8e53869e0a.mp3", // inspiring cinematic
  "https://cdn.pixabay.com/audio/2023/10/25/audio_fddaa5c0e1.mp3", // cinematic trailer
  "https://cdn.pixabay.com/audio/2024/09/10/audio_6e1f4eb5c9.mp3", // elegant piano
  "https://cdn.pixabay.com/audio/2023/04/28/audio_d3d2328f81.mp3", // soft emotional
];

function pickMusic(vibe?: string): string {
  // Simple vibe-based selection - can be made smarter later
  const idx = Math.floor(Math.random() * MUSIC_LIBRARY.length);
  return MUSIC_LIBRARY[idx];
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }

  const { projectId } = body;
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const userId = session.id;

  try {
    const projectRes = await query(
      `SELECT id, title, target_platform, target_duration, vibe, generated_content
       FROM projects WHERE id = $1 AND user_id = $2`,
      [projectId, userId]
    );
    const project = projectRes.rows[0];
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const gc = typeof project.generated_content === "string"
      ? JSON.parse(project.generated_content as string)
      : (project.generated_content as Record<string, unknown>) || {};
    const script = (gc.script as string) || "";
    const title = (project.title as string) || "Untitled";
    const vibe = (project.vibe as string) || "";
    const targetDuration = (project.target_duration as number) || 30;

    // Load uploads for this project
    const uploadRes = await query(
      `SELECT id, file_name, file_type, file_path FROM uploads WHERE project_id = $1 AND user_id = $2 ORDER BY created_at ASC`,
      [projectId, userId]
    );
    const uploads = uploadRes.rows.filter(u => u.file_path);

    if (uploads.length === 0) {
      return NextResponse.json({ error: "No media uploaded. Upload photos or videos first." }, { status: 400 });
    }

    const apiKey = process.env.CREATOMATE_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "CREATOMATE_API_KEY not configured" }, { status: 500 });

    // === CINEMATIC LUXURY REEL FORMULA ===
    // 1. Smooth crossfade transitions (1s fade between clips)
    // 2. Slow Ken Burns zoom on every clip
    // 3. Warm color grading (sepia 15%)
    // 4. Minimal text - just title at start, one line at end
    // 5. Background music with fade in/out
    // 6. 9:16 vertical format

    const clipCount = uploads.length;
    const transitionDur = 1; // 1s crossfade
    // Each clip gets equal time, accounting for transition overlaps
    const rawClipDur = (targetDuration + (clipCount - 1) * transitionDur) / clipCount;
    const clipDuration = Math.max(2, rawClipDur);

    // Media elements - each on track 1 with crossfade transitions
    const mediaElements = uploads.map((u, i) => {
      const isVideo = (u.file_type as string) === "video";
      return {
        type: isVideo ? "video" : "image",
        track: 1,
        duration: clipDuration,
        source: u.file_path as string,
        fit: "cover",
        // Warm cinematic color grading
        color_filter: [
          { type: "sepia", value: "12%" },
          { type: "brighten", value: "5%" },
          { type: "contrast", value: "8%" },
        ],
        // Slow Ken Burns zoom - cinematic movement
        animations: [
          ...(isVideo ? [] : [{
            easing: "linear",
            type: "scale",
            scope: "element",
            start_scale: "100%",
            end_scale: "115%",
          }]),
          // Crossfade transition between clips (not on first clip)
          ...(i > 0 ? [{ type: "fade", duration: `${transitionDur} s` }] : []),
        ],
      };
    });

    // Title text - elegant serif, appears for 3s at the start, fades in
    const titleElement = {
      type: "text",
      track: 2,
      time: 0.5,
      duration: 3,
      text: title.toUpperCase(),
      width: "75%",
      x: "50%",
      y: "50%",
      x_alignment: "50%",
      y_alignment: "50%",
      font_family: "Playfair Display",
      font_weight: "700",
      font_size: "8 vmin",
      fill_color: "#ffffff",
      shadow_color: "rgba(0,0,0,0.6)",
      shadow_blur: "15",
      shadow_x: "0",
      shadow_y: "2",
      text_alignment: "center",
      letter_spacing: "8%",
      line_height: "130%",
      animations: [
        { type: "fade", fade_duration: "0.8 s" },
        { type: "scale", easing: "quadratic-out", scope: "element", start_scale: "90%", end_scale: "100%" },
      ],
    };

    // Subtle hook line - one sentence from the script, lower third
    const hookLine = script.split(/[.!?]/)[0]?.trim() || "";
    const hookElement = hookLine ? {
      type: "text",
      track: 3,
      time: targetDuration * 0.35,
      duration: 3.5,
      text: hookLine,
      width: "80%",
      x: "50%",
      y: "82%",
      x_alignment: "50%",
      y_alignment: "50%",
      font_family: "Montserrat",
      font_weight: "600",
      font_size: "5 vmin",
      fill_color: "#ffffff",
      shadow_color: "rgba(0,0,0,0.5)",
      shadow_blur: "10",
      text_alignment: "center",
      line_height: "140%",
      animations: [
        { type: "fade", fade_duration: "0.6 s" },
      ],
    } : null;

    // End card - small elegant text
    const endElement = {
      type: "text",
      track: 4,
      time: targetDuration - 3.5,
      duration: 3,
      text: title,
      width: "70%",
      x: "50%",
      y: "50%",
      x_alignment: "50%",
      y_alignment: "50%",
      font_family: "Playfair Display",
      font_weight: "700",
      font_size: "6 vmin",
      fill_color: "#ffffff",
      shadow_color: "rgba(0,0,0,0.5)",
      shadow_blur: "12",
      text_alignment: "center",
      letter_spacing: "6%",
      animations: [
        { type: "fade", fade_duration: "0.8 s" },
      ],
    };

    // Background music - cinematic track with fade in/out
    const musicUrl = pickMusic(vibe);
    const musicElement = {
      type: "audio",
      source: musicUrl,
      duration: targetDuration,
      volume: "80%",
      audio_fade_in: 1.5,
      audio_fade_out: 2.5,
    };

    const source = {
      output_format: "mp4",
      width: 1080,
      height: 1920,
      frame_rate: 30,
      fill_color: "#000000",
      elements: [
        ...mediaElements,
        titleElement,
        ...(hookElement ? [hookElement] : []),
        endElement,
        musicElement,
      ],
    };

    console.log("Cinematic render for project:", projectId, "clips:", clipCount, "duration:", targetDuration, "music:", musicUrl);

    const creatomateRes = await fetch("https://api.creatomate.com/v1/renders", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ source }),
    });

    const renderData = await creatomateRes.json();

    if (!creatomateRes.ok) {
      console.error("Creatomate API error:", creatomateRes.status, JSON.stringify(renderData));
      const errMsg = typeof renderData === "object" && renderData?.message
        ? renderData.message
        : JSON.stringify(renderData);
      return NextResponse.json({ error: `Render error: ${errMsg}` }, { status: 500 });
    }

    const render = Array.isArray(renderData) ? renderData[0] : renderData;
    const videoUrl = render?.url;
    const renderId = render?.id;

    if (!videoUrl) {
      return NextResponse.json({ error: "No video URL returned" }, { status: 500 });
    }

    console.log("Cinematic render queued:", renderId);

    await query(
      `UPDATE projects SET generated_content = $1, status = 'rendering', updated_at = now()
       WHERE id = $2 AND user_id = $3`,
      [JSON.stringify({ ...gc, videoUrl, renderId, renderStatus: "planned" }), projectId, userId]
    );

    return NextResponse.json({
      videoUrl,
      renderId,
      status: "rendering",
      message: "Your cinematic video is rendering. It will be ready in 30-60 seconds.",
    });
  } catch (err) {
    console.error("Cinematic compose error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message.slice(0, 400) : "Video rendering failed" },
      { status: 500 }
    );
  }
}
