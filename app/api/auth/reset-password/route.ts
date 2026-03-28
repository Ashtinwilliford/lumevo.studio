import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ error: "Token and password required" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const result = await query(
      `SELECT prt.id, prt.user_id, prt.expires_at, prt.used_at
       FROM password_reset_tokens prt
       WHERE prt.token = $1`,
      [token]
    );

    const tokenRow = result.rows[0];

    if (!tokenRow) {
      return NextResponse.json({ error: "Invalid or expired reset link. Please request a new one." }, { status: 400 });
    }

    if (tokenRow.used_at) {
      return NextResponse.json({ error: "This reset link has already been used. Please request a new one." }, { status: 400 });
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      return NextResponse.json({ error: "This reset link has expired. Please request a new one." }, { status: 400 });
    }

    const hash = await bcrypt.hash(password, 12);
    await query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, tokenRow.user_id]);
    await query("UPDATE password_reset_tokens SET used_at = now() WHERE id = $1", [tokenRow.id]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Reset password error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
