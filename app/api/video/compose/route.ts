import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// Publicly accessible royalty-free music tracks
const MUSIC_LIBRARY = [
  "https://cdn.creatomate.com/demo/music1.mp3",
  "https://cdn.creatomate.com/demo/music2.mp3",
  "https://cdn.creatomate.com/demo/music3.mp3",
  "https://cdn.creatomate.com/demo/music4.mp3",
];

interface UploadWithAnalysis {
  id: string;
  file_name: string;
  file_type: string;
  file_path: string;
  ai_analysis: Record<string, unknown> | null;
  video_duration_sec: number | null;
}

interface ClipSelection {
  uploadId: string;
  trimStart: number;
  trimEnd: number;
  keepAudio: boolean;
  reason: string;
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
    // Load project
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
    const vibe = (project.vibe as string) || "warm and cinematic";
    const targetDuration = (project.target_duration as number) || 30;

    // Load ALL uploads for this project with analysis data
    const uploadRes = await query(
      `SELECT id, file_name, file_type, file_path, ai_analysis, video_duration_sec
       FROM uploads WHERE project_id = $1 AND user_id = $2 AND file_path IS NOT NULL
       ORDER BY created_at ASC`,
      [projectId, userId]
    );
    const uploads = uploadRes.rows as unknown as UploadWithAnalysis[];

    if (uploads.length === 0) {
      return NextResponse.json({ error: "No media uploaded. Upload photos or videos first." }, { status: 400 });
    }

    const apiKey = process.env.CREATOMATE_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "CREATOMATE_API_KEY not configured" }, { status: 500 });

    // === AI CLIP SELECTOR ===
    // Build a description of all available clips for Claude
    const clipDescriptions = uploads.map((u, i) => {
      const a = u.ai_analysis || {};
      const dur = u.video_duration_sec || (u.file_type === "image" ? null : null);
      return [
        `Clip ${i + 1}: ID="${u.id}"`,
        `Type: ${u.file_type}`,
        dur ? `Duration: ${dur.toFixed(1)}s` : "Duration: unknown (image or no data)",
        `File: ${u.file_name}`,
        a.description ? `Content: ${a.description}` : "",
        a.mood ? `Mood: ${a.mood}` : "",
        a.energy ? `Energy: ${a.energy}` : "",
        a.warmth_score ? `Warmth: ${a.warmth_score}/10` : "",
        a.has_speech ? `Has speech: yes` : "",
        a.has_laughter ? `Has laughter: yes` : "",
        a.has_natural_audio ? `Has natural audio worth keeping: yes` : "",
        a.best_use ? `Best use: ${a.best_use}` : "",
        a.best_moment_start !== undefined ? `Best moment: ${a.best_moment_start}s - ${a.best_moment_end}s` : "",
      ].filter(Boolean).join(" | ");
    }).join("\n");

    const selectorPrompt = `You are a cinematic video editor creating a ${targetDuration}-second Instagram/TikTok reel.

STYLE: Luxury cinematic. Warm tones. Smooth transitions. Music-driven with moments where real audio shines through.
TITLE: "${title}"
VIBE: "${vibe}"
${script ? `SCRIPT/NARRATION CONTEXT: "${script.slice(0, 300)}"` : ""}

AVAILABLE CLIPS:
${clipDescriptions}

BUILD A TIMELINE:
- Select clips that total exactly ${targetDuration} seconds
- For images: you control the duration (3-6 seconds works well)
- For videos: use trimStart/trimEnd to pick the best segment (use the best_moment data if available)
- Start with the strongest hook clip (highest energy or most visually striking)
- Alternate between different clip types for variety
- Prioritize warmth_score and mood that matches "${vibe}"
- You CAN reuse a clip at a different trim point
- Set keepAudio=true for clips with speech, laughter, or natural audio worth hearing
- Set keepAudio=false for clips where background music should dominate

Return ONLY this JSON array:
[
  {"uploadId":"exact-id","trimStart":0,"trimEnd":4,"keepAudio":false,"reason":"strong visual hook"},
  {"uploadId":"exact-id","trimStart":2,"trimEnd":6,"keepAudio":true,"reason":"natural laughter moment"}
]`;

    let clipSelections: ClipSelection[];
    try {
      const selectorRes = await ai.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 1000,
        temperature: 0.5,
        messages: [{ role: "user", content: selectorPrompt }],
      });
      const raw = selectorRes.content[0]?.type === "text" ? selectorRes.content[0].text : "[]";
      clipSelections = JSON.parse(raw.replace(/```json\n?|\n?```/g, "").trim());
      if (!Array.isArray(clipSelections) || clipSelections.length === 0) throw new Error("Empty");
    } catch {
      // Fallback: use all clips equally
      const perClip = targetDuration / uploads.length;
      clipSelections = uploads.map(u => ({
        uploadId: u.id,
        trimStart: 0,
        trimEnd: u.file_type === "image" ? perClip : Math.min(perClip, u.video_duration_sec || perClip),
        keepAudio: !!(u.ai_analysis?.has_speech || u.ai_analysis?.has_laughter),
        reason: "equal distribution fallback",
      }));
    }

    // Build upload lookup map
    const uploadMap = new Map(uploads.map(u => [u.id, u]));

    // === BUILD CREATOMATE SOURCE ===
    const transitionDur = 0.8;
    const musicUrl = MUSIC_LIBRARY[Math.floor(Math.random() * MUSIC_LIBRARY.length)];

    // Media elements with smart audio
    const mediaElements = clipSelections.map((clip, i) => {
      const upload = uploadMap.get(clip.uploadId);
      if (!upload) return null;

      const isVideo = upload.file_type === "video";
      const clipDur = Math.max(1, clip.trimEnd - clip.trimStart);

      return {
        type: isVideo ? "video" : "image",
        track: 1,
        duration: clipDur,
        source: upload.file_path,
        fit: "cover",
        // Trim for videos
        ...(isVideo ? { trim_start: clip.trimStart, trim_end: clip.trimEnd } : {}),
        // Smart audio: keep original audio for speech/laughter clips
        ...(isVideo && clip.keepAudio ? { volume: "100%" } : { volume: "0%" }),
        // Warm cinematic color grading
        color_filter: [
          { type: "sepia", value: "10%" },
          { type: "brighten", value: "4%" },
          { type: "contrast", value: "6%" },
        ],
        // Animations
        animations: [
          // Ken Burns zoom for images
          ...(isVideo ? [] : [{
            easing: "linear",
            type: "scale",
            scope: "element",
            start_scale: "100%",
            end_scale: "112%",
          }]),
          // Crossfade between clips (not on first)
          ...(i > 0 ? [{ type: "fade", duration: `${transitionDur} s` }] : []),
        ],
      };
    }).filter(Boolean);

    // Title card - elegant serif
    const titleElement = {
      type: "text",
      track: 2,
      time: 0.3,
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

    // One hook line from script at 35%
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
      animations: [{ type: "fade", fade_duration: "0.6 s" }],
    } : null;

    // End card
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
      animations: [{ type: "fade", fade_duration: "0.8 s" }],
    };

    // Background music - ducks when clips have keepAudio=true
    // Calculate segments where music should be quieter
    let musicTime = 0;
    const hasAnySpeechClips = clipSelections.some(c => c.keepAudio);

    // Music volume: lower when speech clips play, higher when they don't
    const musicVolume = hasAnySpeechClips ? "40%" : "80%";
    const musicElement = {
      type: "audio",
      source: musicUrl,
      duration: targetDuration,
      volume: musicVolume,
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

    console.log("Cinematic render:", projectId, "clips:", clipSelections.length, "speech clips:", clipSelections.filter(c=>c.keepAudio).length);

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
      console.error("Creatomate error:", creatomateRes.status, JSON.stringify(renderData));
      const errMsg = typeof renderData === "object" && renderData?.message ? renderData.message : JSON.stringify(renderData);
      return NextResponse.json({ error: `Render error: ${errMsg}` }, { status: 500 });
    }

    const render = Array.isArray(renderData) ? renderData[0] : renderData;
    const videoUrl = render?.url;
    const renderId = render?.id;

    if (!videoUrl) return NextResponse.json({ error: "No video URL returned" }, { status: 500 });

    console.log("Render queued:", renderId);

    await query(
      `UPDATE projects SET generated_content = $1, status = 'rendering', updated_at = now()
       WHERE id = $2 AND user_id = $3`,
      [JSON.stringify({ ...gc, videoUrl, renderId, renderStatus: "planned", clipSelections }), projectId, userId]
    );

    return NextResponse.json({
      videoUrl,
      renderId,
      status: "rendering",
      clipSelections,
      message: "Your cinematic video is rendering. Ready in 30-60 seconds.",
    });
  } catch (err) {
    console.error("Compose error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message.slice(0, 400) : "Video rendering failed" },
      { status: 500 }
    );
  }
}
