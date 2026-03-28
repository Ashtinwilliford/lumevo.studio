"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("lumevo_remembered_email");
    if (saved) { setEmail(saved); setRemember(true); }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
      } else {
        if (remember) {
          localStorage.setItem("lumevo_remembered_email", email);
        } else {
          localStorage.removeItem("lumevo_remembered_email");
        }
        router.push("/dashboard");
      }
    } catch {
      setError("Something went wrong. Try again.");
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
        .row { display: flex; align-items: center; justify-content: space-between; margin-top: -10px; margin-bottom: 24px; }
        .remember { display: flex; align-items: center; gap: 8px; cursor: pointer; }
        .remember-box { width: 16px; height: 16px; border-radius: 5px; border: 1.5px solid rgba(0,0,0,0.18); background: #F8F8A6; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background 0.15s, border-color 0.15s; }
        .remember-box.checked { background: #FF2D2D; border-color: #FF2D2D; }
        .remember-label { font-size: 13px; color: #7c7660; }
        .btn { width: 100%; background: #FF2D2D; color: #fff; border: none; font-family: inherit; font-size: 15px; font-weight: 700; padding: 14px; border-radius: 999px; cursor: pointer; transition: opacity 0.2s, transform 0.15s; }
        .btn:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
        .btn:disabled { opacity: 0.6; cursor: default; }
        .error { background: rgba(255,45,45,0.08); border: 1px solid rgba(255,45,45,0.2); color: #CC2020; font-size: 14px; padding: 12px 16px; border-radius: 10px; margin-bottom: 18px; }
        .switch { text-align: center; margin-top: 28px; font-size: 14px; color: #7c7660; }
        .switch-link { color: #FF2D2D; font-weight: 600; background: none; border: none; cursor: pointer; font-family: inherit; font-size: 14px; }
        .forgot { font-size: 13px; color: #FF2D2D; font-weight: 600; background: none; border: none; cursor: pointer; font-family: inherit; }
        .forgot:hover { opacity: 0.75; }
      `}</style>
      <div className="page">
        <nav className="nav">
          <div className="logo" onClick={() => router.push("/")}>
            <span className="logo-main">LUMEVO</span>
            <span className="logo-sub">Studio</span>
          </div>
          <button className="nav-link" onClick={() => router.push("/signup")}>Create account →</button>
        </nav>
        <main className="main">
          <div className="card">
            <h1 className="card-title">Welcome back</h1>
            <p className="card-sub">Log in to continue building your content system.</p>
            {error && <div className="error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <label className="label">Email</label>
              <input className="input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoFocus autoComplete="email" />
              <label className="label">Password</label>
              <input className="input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
              <div className="row">
                <label className="remember" onClick={() => setRemember(r => !r)}>
                  <div className={`remember-box${remember ? " checked" : ""}`}>
                    {remember && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>✓</span>}
                  </div>
                  <span className="remember-label">Remember me</span>
                </label>
                <button type="button" className="forgot" onClick={() => router.push("/forgot-password")}>Forgot password?</button>
              </div>
              <button className="btn" type="submit" disabled={loading}>{loading ? "Logging in…" : "Log In"}</button>
            </form>
            <div className="switch">
              Don&apos;t have an account?{" "}
              <button className="switch-link" onClick={() => router.push("/signup")}>Sign up free</button>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
