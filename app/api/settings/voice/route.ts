import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { voiceId } = await req.json();
  await query(
    "UPDATE users SET elevenlabs_voice_id = $1, updated_at = now() WHERE id = $2",
    [voiceId?.trim() || null, session.userId]
  );

  return NextResponse.json({ ok: true });
}
