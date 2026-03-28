import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { createSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, plan } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "All fields required" }, { status: 400 });
    }

    const validTiers = ["trial", "creator", "pro", "elite"];
    const subscription_tier = validTiers.includes(plan) ? plan : "trial";

    const existing = await query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    const password_hash = await bcrypt.hash(password, 12);

    const result = await query(
      `INSERT INTO users (name, email, password_hash, subscription_tier, trial_started_at)
       VALUES ($1, $2, $3, $4, now()) RETURNING id, name, email, subscription_tier, trial_started_at`,
      [name, email, password_hash, subscription_tier]
    );
    const user = result.rows[0];

    await query(
      `INSERT INTO brand_profiles (user_id, brand_name, confidence_score, learning_progress_percent)
       VALUES ($1, $2, 0, 0)`,
      [user.id, name]
    );

    await createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      subscription_tier: user.subscription_tier,
    });

    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, subscription_tier: user.subscription_tier } });
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
