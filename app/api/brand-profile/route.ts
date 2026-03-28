import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const result = await query(
    `SELECT * FROM brand_profiles WHERE user_id = $1`,
    [session.id]
  );

  if (!result.rows[0]) {
    await query(
      `INSERT INTO brand_profiles (user_id, confidence_score, learning_progress_percent) VALUES ($1, 0, 0)`,
      [session.id]
    );
    return NextResponse.json({ brand_profile: { user_id: session.id, confidence_score: 0, learning_progress_percent: 0, upload_count: 0, generation_count: 0 } });
  }

  return NextResponse.json({ brand_profile: result.rows[0] });
}
