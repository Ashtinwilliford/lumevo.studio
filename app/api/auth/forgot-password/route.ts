import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { query } from "@/lib/db";
import { Resend } from "resend";

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

    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:5000";
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const resetLink = `${proto}://${host}/reset-password?token=${token}`;

    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: "Lumevo Studio <noreply@lumevostudio.com>",
          to: email.toLowerCase().trim(),
          subject: "Reset your Lumevo password",
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
              <h2 style="font-size:24px;font-weight:800;color:#1a1a1a;margin-bottom:8px;">Reset your password</h2>
              <p style="color:#7c7660;font-size:15px;line-height:1.6;margin-bottom:28px;">
                Hi ${user.name}, we received a request to reset your Lumevo Studio password.
                Click the button below to choose a new one. This link expires in 1 hour.
              </p>
              <a href="${resetLink}" style="display:inline-block;background:#FF2D2D;color:#fff;font-weight:700;font-size:15px;padding:14px 28px;border-radius:999px;text-decoration:none;">
                Reset Password
              </a>
              <p style="color:#b5b09a;font-size:13px;margin-top:28px;line-height:1.5;">
                If you didn't request this, you can safely ignore this email. Your password won't change.
              </p>
            </div>
          `,
        });
        return NextResponse.json({ sent: true });
      } catch (emailErr) {
        console.error("Email send error:", emailErr);
        return NextResponse.json({ sent: true, resetLink, userName: user.name });
      }
    }

    return NextResponse.json({ sent: true, resetLink, userName: user.name });
  } catch (err) {
    console.error("Forgot password error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
