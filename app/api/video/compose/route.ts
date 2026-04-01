import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import Creatomate from "creatomate";

export const maxDuration = 120;

const client = new Creatomate.Client(process.env.CREATOMATE_API_KEY!);

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }

  const { projectId } = body;
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const userId = session.id;

  try {
    // Load project data
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

    // Add script text
    modifications["Text"] = script;
    modifications["Caption"] = caption || "";
    modifications["Title"] = (project.title as string) || "Untitled";

    // Add media from uploads (Cloudinary URLs)
    uploads.forEach((u, i) => {
      const filePath = u.file_path as string;
      if (filePath) {
        if (i === 0) modifications["Video-1"] = filePath;
        else if (i === 1) modifications["Video-2"] = filePath;
        else if (i === 2) modifications["Video-3"] = filePath;
        else if (i === 3) modifications["Video-4"] = filePath;
        else if (i === 4) modifications["Video-5"] = filePath;
        // Also set as Image slots for templates that use images
        if (i === 0) modifications["Image-1"] = filePath;
        else if (i === 1) modifications["Image-2"] = filePath;
        else if (i === 2) modifications["Image-3"] = filePath;
        else if (i === 3) modifications["Image-4"] = filePath;
        else if (i === 4) modifications["Image-5"] = filePath;
      }
    });

    console.log("Starting Creatomate render for project:", projectId, "with", uploads.length, "media files");

    // Render with Creatomate
    const renders = await client.render({
      templateId: process.env.CREATOMATE_TEMPLATE_ID || "7aaaccf3-91cb-4f7f-88c8-94bf94d511d6",
      modifications,
    });

    const render = renders[0];
    if (!render || !render.url) {
      console.error("Creatomate render failed:", renders);
      return NextResponse.json({ error: "Video render failed" }, { status: 500 });
    }

    console.log("Creatomate render complete:", render.url);

    // Update project with video URL
    await query(
      `UPDATE projects SET generated_content = $1, status = 'completed', updated_at = now()
       WHERE id = $2 AND user_id = $3`,
      [JSON.stringify({ ...gc, videoUrl: render.url }), projectId, userId]
    );

    return NextResponse.json({
      videoUrl: render.url,
      status: "completed",
      renderInfo: {
        id: render.id,
        url: render.url,
        clipCount: uploads.length,
      },
    });
  } catch (err) {
    console.error("Creatomate compose error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message.slice(0, 400) : "Video rendering failed" },
      { status: 500 }
    );
  }
}
