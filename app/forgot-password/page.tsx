"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [resetLink, setResetLink] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
      } else {
        setSent(true);
        if (data.resetLink) setResetLink(data.resetLink);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #F8F8A6; font-family: 'DM Sans', system-ui, sans-serif; color: #1a1a1a; -webkit-font-smoothing: antialiased; min-height: 100vh; }
        .page { min-height: 100vh; display: flex; flex-direction: column; }
        .nav { padding: 0 32px; height: 60px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.07); }
        .logo { display: flex; align-items: baseline; gap: 4px; cursor: pointer; }
        .logo-main { font-family: 'Fredoka One', cursive; font-size: 22px; color: #FF2D2D; letter-spacing: 1px; }
        .logo-sub { font-size: 10px; font-style: italic; color: #FF2D2D; letter-spacing: 2px; text-transform: uppercase; }
        .nav-link { background: none; border: none; color: #7c7660; font-family: inherit; font-size: 14px; cursor: pointer; }
        .main { flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px 24px; }
        .card { background: #fff; border-radius: 24px; padding: 48px 44px; width: 100%; max-width: 420px; box-shadow: 0 4px 40px rgba(0,0,0,0.07); }
        .card-title { font-family: 'Syne', sans-serif; font-size: 28px; font-weight: 800; margin-bottom: 6px; letter-spacing: -0.5px; }
        .card-sub { font-size: 15px; color: #7c7660; margin-bottom: 36px; line-height: 1.5; }
        .label { font-size: 12px; font-weight: 600; color: #7c7660; letter-spacing: 0.5px; margin-bottom: 7px; display: block; }
        .input { width: 100%; background: #F8F8A6; border: 1.5px solid rgba(0,0,0,0.1); border-radius: 12px; color: #1a1a1a; font-family: inherit; font-size: 15px; padding: 13px 16px; outline: none; transition: border-color 0.2s; margin-bottom: 20px; }
        .input:focus { border-color: #FF2D2D; }
        .input::placeholder { color: #b5b09a; }
        .btn { width: 100%; background: #FF2D2D; color: #fff; border: none; font-family: inherit; font-size: 15px; font-weight: 700; padding: 14px; border-radius: 999px; cursor: pointer; transition: opacity 0.2s, transform 0.15s; }
        .btn:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
        .btn:disabled { opacity: 0.6; cursor: default; }
        .btn-ghost { width: 100%; background: none; border: 1.5px solid rgba(0,0,0,0.1); color: #7c7660; font-family: inherit; font-size: 14px; font-weight: 600; padding: 13px; border-radius: 999px; cursor: pointer; transition: border-color 0.2s; margin-top: 12px; }
        .btn-ghost:hover { border-color: #FF2D2D; color: #FF2D2D; }
        .error { background: rgba(255,45,45,0.08); border: 1px solid rgba(255,45,45,0.2); color: #CC2020; font-size: 14px; padding: 12px 16px; border-radius: 10px; margin-bottom: 18px; }
        .success-icon { font-size: 48px; margin-bottom: 20px; }
        .switch { text-align: center; margin-top: 28px; font-size: 14px; color: #7c7660; }
        .switch-link { color: #FF2D2D; font-weight: 600; background: none; border: none; cursor: pointer; font-family: inherit; font-size: 14px; }
        .reset-box { background: #F8F8A6; border: 1.5px solid rgba(0,0,0,0.1); border-radius: 12px; padding: 14px 16px; margin-top: 20px; word-break: break-all; }
        .reset-label { font-size: 11px; font-weight: 600; color: #7c7660; letter-spacing: 0.5px; margin-bottom: 6px; }
        .reset-url { font-size: 13px; color: #FF2D2D; font-weight: 500; cursor: pointer; text-decoration: underline; }
        .dev-note { font-size: 12px; color: #b5b09a; margin-top: 10px; line-height: 1.5; }
      `}</style>
      <div className="page">
        <nav className="nav">
          <div className="logo" onClick={() => router.push("/")}>
            <span className="logo-main">LUMEVO</span>
            <span className="logo-sub">Studio</span>
          </div>
          <button className="nav-link" onClick={() => router.push("/login")}>Log in →</button>
        </nav>
        <main className="main">
          <div className="card">
            {!sent ? (
              <>
                <h1 className="card-title">Reset password</h1>
                <p className="card-sub">Enter your email and we&apos;ll send you a link to reset your password.</p>
                {error && <div className="error">{error}</div>}
                <form onSubmit={handleSubmit}>
                  <label className="label">Email address</label>
                  <input
                    className="input"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                  <button className="btn" type="submit" disabled={loading}>
                    {loading ? "Sending…" : "Send reset link"}
                  </button>
                </form>
                <div className="switch">
                  Remember your password?{" "}
                  <button className="switch-link" onClick={() => router.push("/login")}>Back to log in</button>
                </div>
              </>
            ) : (
              <>
                <div className="success-icon">✉️</div>
                <h1 className="card-title">Check your email</h1>
                <p className="card-sub">
                  If <strong>{email}</strong> is registered, a reset link is on its way. Check your inbox and spam folder.
                </p>
                {resetLink && (
                  <div className="reset-box">
                    <div className="reset-label">RESET LINK (shown here until email is configured)</div>
                    <span className="reset-url" onClick={() => router.push(`/reset-password?token=${resetLink.split("token=")[1]}`)}>
                      {resetLink}
                    </span>
                    <p className="dev-note">Click the link above or copy it into your browser to set a new password.</p>
                  </div>
                )}
                <button className="btn-ghost" onClick={() => router.push("/login")}>← Back to log in</button>
              </>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
