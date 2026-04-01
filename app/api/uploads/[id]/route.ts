import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    // Fetch the upload to get the Cloudinary public_id for cleanup
    const res = await query(
      "SELECT id, file_path FROM uploads WHERE id = $1 AND user_id = $2",
      [id, session.id]
    );
    if (!res.rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const upload = res.rows[0] as { id: string; file_path: string | null };

    // Try to delete from Cloudinary (non-fatal if fails)
    if (upload.file_path) {
      try {
        // Extract public_id from Cloudinary URL: .../folder/filename.ext
        const urlParts = upload.file_path.split("/");
        const fileName = urlParts[urlParts.length - 1].split(".")[0];
        const folderIdx = urlParts.indexOf("lumevo");
        const publicId = folderIdx >= 0
          ? urlParts.slice(folderIdx).join("/").replace(/\.[^/.]+$/, "")
          : fileName;
        await cloudinary.uploader.destroy(publicId, { resource_type: "video" }).catch(() => {});
        await cloudinary.uploader.destroy(publicId, { resource_type: "image" }).catch(() => {});
      } catch {
        // Non-fatal
      }
    }

    // Delete from DB
    await query("DELETE FROM uploads WHERE id = $1 AND user_id = $2", [id, session.id]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Upload delete error:", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
