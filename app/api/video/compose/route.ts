import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";

export const maxDuration = 60;

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
    const caption = (gc.caption as string) || "";
    const title = (project.title as string) || "Untitled";
    const targetDuration = (project.target_duration as number) || 30;

    if (!script) return NextResponse.json({ error: "No script generated yet. Generate a script first." }, { status: 400 });

    // Load uploads for this project
    const uploadRes = await query(
      `SELECT id, file_name, file_type, file_path FROM uploads WHERE project_id = $1 AND user_id = $2 ORDER BY created_at ASC`,
      [projectId, userId]
    );
    const uploads = uploadRes.rows.filter(u => u.file_path);

    const apiKey = process.env.CREATOMATE_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "CREATOMATE_API_KEY not configured" }, { status: 500 });

    // Build video source JSON - 9:16 vertical format
    const clipCount = Math.max(uploads.length, 1);
    const clipDuration = targetDuration / clipCount;

    // Create video/image elements for each upload on the timeline
    const mediaElements = uploads.map((u, i) => {
      const isVideo = (u.file_type as string) === "video";
      return {
        type: isVideo ? "video" : "image",
        source: u.file_path as string,
        time: i * clipDuration,
        duration: clipDuration,
        // Fill the frame
        fit: "cover" as const,
        animations: [
          // Subtle zoom for images, crossfade between clips
          ...(isVideo ? [] : [{ type: "scale", scope: "element", start_scale: "100%", end_scale: "110%" }]),
          { type: "fade", fade_duration: "0.5 s" },
        ],
      };
    });

    // Script text overlay - split into segments across the video
    const scriptLines = script.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
    const lineCount = Math.max(scriptLines.length, 1);
    const lineDuration = targetDuration / lineCount;

    const textElements = scriptLines.map((line, i) => ({
      type: "text",
      text: line + (line.match(/[.!?]$/) ? "" : "."),
      time: i * lineDuration,
      duration: lineDuration,
      width: "90%",
      x: "50%",
      y: "78%",
      x_alignment: "50%",
      y_alignment: "50%",
      font_family: "Montserrat",
      font_weight: "800",
      font_size: i === 0 ? "7.5 vmin" : "6.5 vmin",
      fill_color: "#ffffff",
      shadow_color: "rgba(0,0,0,0.7)",
      shadow_blur: "8",
      text_alignment: "center",
      animations: [
        { type: "text-appear", split: "word", duration: "0.6 s" },
      ],
    }));

    // Title card at the start (2.5s overlay)
    const titleElement = {
      type: "text",
      text: title.toUpperCase(),
      time: 0,
      duration: 2.5,
      width: "80%",
      x: "50%",
      y: "45%",
      x_alignment: "50%",
      y_alignment: "50%",
      font_family: "Montserrat",
      font_weight: "900",
      font_size: "10 vmin",
      fill_color: "#ffffff",
      shadow_color: "rgba(0,0,0,0.8)",
      shadow_blur: "12",
      text_alignment: "center",
      animations: [
        { type: "fade", fade_duration: "0.5 s" },
      ],
    };

    // Caption at the bottom
    const captionElement = caption ? {
      type: "text",
      text: caption.slice(0, 100),
      time: targetDuration - 4,
      duration: 4,
      width: "85%",
      x: "50%",
      y: "90%",
      x_alignment: "50%",
      y_alignment: "50%",
      font_family: "Montserrat",
      font_weight: "600",
      font_size: "4 vmin",
      fill_color: "rgba(255,255,255,0.8)",
      text_alignment: "center",
      animations: [
        { type: "fade", fade_duration: "0.5 s" },
      ],
    } : null;

    const source = {
      output_format: "mp4",
      width: 1080,
      height: 1920,
      duration: targetDuration,
      fill_color: "#000000",
      elements: [
        ...mediaElements,
        titleElement,
        ...textElements,
        ...(captionElement ? [captionElement] : []),
      ],
    };

    console.log("Starting Creatomate render for project:", projectId, "clips:", uploads.length, "duration:", targetDuration);

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
      console.error("No URL in Creatomate response:", renderData);
      return NextResponse.json({ error: "No video URL returned from renderer" }, { status: 500 });
    }

    console.log("Creatomate render queued:", renderId, "URL:", videoUrl);

    await query(
      `UPDATE projects SET generated_content = $1, status = 'rendering', updated_at = now()
       WHERE id = $2 AND user_id = $3`,
      [JSON.stringify({ ...gc, videoUrl, renderId, renderStatus: "planned" }), projectId, userId]
    );

    return NextResponse.json({
      videoUrl,
      renderId,
      status: "rendering",
      message: "Your video is rendering. It will be ready in 30-60 seconds.",
    });
  } catch (err) {
    console.error("Creatomate compose error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message.slice(0, 400) : "Video rendering failed" },
      { status: 500 }
    );
  }
}
