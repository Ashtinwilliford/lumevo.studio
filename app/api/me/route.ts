import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const result = await query(
    "SELECT id, name, email, subscription_tier, created_at, elevenlabs_voice_id FROM users WHERE id = $1",
    [session.userId]
  );

  if (!result[0]) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user: result[0] });
}
