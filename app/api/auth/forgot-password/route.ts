import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { query } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const result = await query("SELECT id, name FROM users WHERE email = $1", [email.toLowerCase().trim()]);
    const user = result.rows[0];

    if (!user) {
      return NextResponse.json({ sent: true });
    }

    await query("DELETE FROM password_reset_tokens WHERE user_id = $1", [user.id]);

    const token = crypto.randomBytes(48).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await query(
      "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)",
      [user.id, token, expiresAt]
    );

    const origin = req.headers.get("origin") || req.headers.get("x-forwarded-host") || "http://localhost:5000";
    const resetLink = `${origin}/reset-password?token=${token}`;

    return NextResponse.json({ sent: true, resetLink, userName: user.name });
  } catch (err) {
    console.error("Forgot password error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
