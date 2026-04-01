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

    if (!script) return NextResponse.json({ error: "No script generated yet. Generate a script first." }, { status: 400 });

    // Load uploads for this project
    const uploadRes = await query(
      `SELECT id, file_name, file_type, file_path FROM uploads WHERE project_id = $1 AND user_id = $2 ORDER BY created_at ASC`,
      [projectId, userId]
    );
    const uploads = uploadRes.rows;

    // Build modifications for the Creatomate template
    const modifications: Record<string, string> = {};
    modifications["Text"] = script;
    modifications["Caption"] = caption || "";
    modifications["Title"] = (project.title as string) || "Untitled";

    uploads.forEach((u, i) => {
      const filePath = u.file_path as string;
      if (filePath) {
        modifications[`Video-${i + 1}`] = filePath;
        modifications[`Image-${i + 1}`] = filePath;
      }
    });

    console.log("Starting Creatomate render for project:", projectId, "with", uploads.length, "media files");

    // Use raw API call instead of SDK (SDK polls until done and times out on Vercel)
    const apiKey = process.env.CREATOMATE_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "CREATOMATE_API_KEY not configured" }, { status: 500 });

    const templateId = process.env.CREATOMATE_TEMPLATE_ID || "7aaaccf3-91cb-4f7f-88c8-94bf94d511d6";

    const creatomateRes = await fetch("https://api.creatomate.com/v1/renders", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        template_id: templateId,
        modifications,
      }),
    });

    const renderData = await creatomateRes.json();

    if (!creatomateRes.ok) {
      console.error("Creatomate API error:", creatomateRes.status, renderData);
      return NextResponse.json({ error: `Creatomate error: ${JSON.stringify(renderData)}` }, { status: 500 });
    }

    // API returns array of renders with status "planned" and a pre-assigned URL
    const render = Array.isArray(renderData) ? renderData[0] : renderData;
    const videoUrl = render?.url;
    const renderId = render?.id;

    if (!videoUrl) {
      console.error("No URL in Creatomate response:", renderData);
      return NextResponse.json({ error: "No video URL returned from renderer" }, { status: 500 });
    }

    console.log("Creatomate render queued:", renderId, "URL:", videoUrl);

    // Save the video URL and render ID to the project
    await query(
      `UPDATE projects SET generated_content = $1, status = 'rendering', updated_at = now()
       WHERE id = $2 AND user_id = $3`,
      [JSON.stringify({ ...gc, videoUrl, renderId, renderStatus: "planned" }), projectId, userId]
    );

    return NextResponse.json({
      videoUrl,
      renderId,
      status: "rendering",
      message: "Your video is being rendered. It will be ready in 30-60 seconds.",
    });
  } catch (err) {
    console.error("Creatomate compose error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message.slice(0, 400) : "Video rendering failed" },
      { status: 500 }
    );
  }
}
