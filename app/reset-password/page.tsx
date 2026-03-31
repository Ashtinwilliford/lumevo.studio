"use client"

import { Suspense } from "react";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) setError("Invalid reset link. Please request a new one.");
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
      } else {
        setDone(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      {done ? (
        <>
          <div className="success-icon">✅</div>
          <h1 className="card-title">Password updated!</h1>
          <p className="card-sub">Your password has been reset successfully. You can now log in with your new password.</p>
          <button className="btn" onClick={() => router.push("/login")}>Go to log in</button>
        </>
      ) : (
        <>
          <h1 className="card-title">New password</h1>
          <p className="card-sub">Choose a strong password for your Lumevo account.</p>
          {error && <div className="error">{error}</div>}
          {!error || token ? (
            <form onSubmit={handleSubmit}>
              <label className="label">New password</label>
              <input
                className="input"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoFocus
                disabled={!token}
              />
              <label className="label">Confirm password</label>
              <input
                className="input"
                type="password"
                placeholder="Repeat your password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                disabled={!token}
              />
              <button className="btn" type="submit" disabled={loading || !token}>
                {loading ? "Updating…" : "Set new password"}
              </button>
            </form>
          ) : null}
          <div className="switch">
            <button className="switch-link" onClick={() => router.push("/forgot-password")}>Request a new link</button>
          </div>
        </>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  const router = useRouter();
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
        .main { flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px 24px; }
        .card { background: #fff; border-radius: 24px; padding: 48px 44px; width: 100%; max-width: 420px; box-shadow: 0 4px 40px rgba(0,0,0,0.07); }
        .card-title { font-family: 'Syne', sans-serif; font-size: 28px; font-weight: 800; margin-bottom: 6px; letter-spacing: -0.5px; }
        .card-sub { font-size: 15px; color: #7c7660; margin-bottom: 36px; line-height: 1.5; }
        .label { font-size: 12px; font-weight: 600; color: #7c7660; letter-spacing: 0.5px; margin-bottom: 7px; display: block; }
        .input { width: 100%; background: #F8F8A6; border: 1.5px solid rgba(0,0,0,0.1); border-radius: 12px; color: #1a1a1a; font-family: inherit; font-size: 15px; padding: 13px 16px; outline: none; transition: border-color 0.2s; margin-bottom: 20px; }
        .input:focus { border-color: #FF2D2D; }
        .input:disabled { opacity: 0.5; cursor: not-allowed; }
        .input::placeholder { color: #b5b09a; }
        .btn { width: 100%; background: #FF2D2D; color: #fff; border: none; font-family: inherit; font-size: 15px; font-weight: 700; padding: 14px; border-radius: 999px; cursor: pointer; transition: opacity 0.2s, transform 0.15s; }
        .btn:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
        .btn:disabled { opacity: 0.6; cursor: default; }
        .error { background: rgba(255,45,45,0.08); border: 1px solid rgba(255,45,45,0.2); color: #CC2020; font-size: 14px; padding: 12px 16px; border-radius: 10px; margin-bottom: 18px; }
        .success-icon { font-size: 48px; margin-bottom: 20px; }
        .switch { text-align: center; margin-top: 28px; font-size: 14px; color: #7c7660; }
        .switch-link { color: #FF2D2D; font-weight: 600; background: none; border: none; cursor: pointer; font-family: inherit; font-size: 14px; }
      `}</style>
      <div className="page">
        <nav className="nav">
          <div className="logo" onClick={() => router.push("/")}>
            <span className="logo-main">LUMEVO</span>
            <span className="logo-sub">Studio</span>
          </div>
        </nav>
        <main className="main">
          <Suspense fallback={null}><ResetPasswordContent /></Suspense>
        </main>
      </div>
    </>
  );
}
