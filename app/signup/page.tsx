"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Signup failed");
      } else {
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
        .card-tag { font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #FF2D2D; margin-bottom: 12px; }
        .card-title { font-family: 'Syne', sans-serif; font-size: 28px; font-weight: 800; margin-bottom: 6px; letter-spacing: -0.5px; }
        .card-sub { font-size: 15px; color: #7c7660; margin-bottom: 36px; line-height: 1.5; }
        .label { font-size: 12px; font-weight: 600; color: #7c7660; letter-spacing: 0.5px; margin-bottom: 7px; display: block; }
        .input { width: 100%; background: #F8F8A6; border: 1.5px solid rgba(0,0,0,0.1); border-radius: 12px; color: #1a1a1a; font-family: inherit; font-size: 15px; padding: 13px 16px; outline: none; transition: border-color 0.2s; margin-bottom: 20px; }
        .input:focus { border-color: #FF2D2D; }
        .input::placeholder { color: #b5b09a; }
        .btn { width: 100%; background: #FF2D2D; color: #fff; border: none; font-family: inherit; font-size: 15px; font-weight: 700; padding: 14px; border-radius: 999px; cursor: pointer; transition: opacity 0.2s, transform 0.15s; margin-top: 4px; }
        .btn:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
        .btn:disabled { opacity: 0.6; cursor: default; }
        .error { background: rgba(255,45,45,0.08); border: 1px solid rgba(255,45,45,0.2); color: #CC2020; font-size: 14px; padding: 12px 16px; border-radius: 10px; margin-bottom: 18px; }
        .terms { font-size: 12px; color: #b5b09a; text-align: center; margin-top: 16px; line-height: 1.5; }
        .switch { text-align: center; margin-top: 24px; font-size: 14px; color: #7c7660; }
        .switch-link { color: #FF2D2D; font-weight: 600; background: none; border: none; cursor: pointer; font-family: inherit; font-size: 14px; }
        .plan-note { background: #F8F8A6; border-radius: 12px; padding: 14px 16px; margin-bottom: 28px; }
        .plan-note-title { font-size: 13px; font-weight: 600; color: #1a1a1a; margin-bottom: 4px; }
        .plan-note-body { font-size: 12px; color: #7c7660; line-height: 1.5; }
      `}</style>
      <div className="page">
        <nav className="nav">
          <div className="logo" onClick={() => router.push("/")}>
            <span className="logo-main">LUMEVO</span>
            <span className="logo-sub">Studio</span>
          </div>
          <button className="nav-link" onClick={() => router.push("/login")}>Already have an account? Log in</button>
        </nav>
        <main className="main">
          <div className="card">
            <div className="card-tag">Free to Start</div>
            <h1 className="card-title">Create your account</h1>
            <p className="card-sub">Start building your personal content system. No credit card required.</p>
            <div className="plan-note">
              <div className="plan-note-title">✦ Starting on Free Plan</div>
              <div className="plan-note-body">You can upgrade anytime as Lumevo learns more about your brand.</div>
            </div>
            {error && <div className="error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <label className="label">Your Name</label>
              <input className="input" type="text" placeholder="Alex Creator" value={name} onChange={e => setName(e.target.value)} required autoFocus />
              <label className="label">Email</label>
              <input className="input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
              <label className="label">Password</label>
              <input className="input" type="password" placeholder="Min. 6 characters" value={password} onChange={e => setPassword(e.target.value)} required />
              <button className="btn" type="submit" disabled={loading}>{loading ? "Creating account…" : "Create Free Account"}</button>
            </form>
            <p className="terms">By signing up, you agree to our Terms of Service and Privacy Policy.</p>
            <div className="switch">
              Already have an account?{" "}
              <button className="switch-link" onClick={() => router.push("/login")}>Log in</button>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
