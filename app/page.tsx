"use client";

import { useRouter } from "next/navigation";

const PRICING = [
  {
    id: "trial",
    name: "Trial",
    sub: "2 Projects Free",
    price: "Free",
    per: "for 14 days",
    desc: "2 full projects. 14 days. Then auto-renews to Creator — cancel anytime.",
    cta: "Start Free Trial",
    highlight: false,
    features: [
      "2 complete AI video projects",
      "Full brand learning",
      "All content types (captions, hooks, scripts)",
      "Agentic creative director",
      "Auto-renews to Creator ($29/mo)",
      "Cancel before 14 days — no charge",
    ],
  },
  {
    id: "creator",
    name: "Creator",
    sub: "Growth",
    price: "$29",
    per: "per month",
    desc: "Built for creators who want to move faster.",
    cta: "Start Creator",
    highlight: false,
    features: [
      "50 uploads / month",
      "100 AI generations / month",
      "Personalized captions & hooks",
      "Full tone & style recognition",
      "Weekly content ideas",
      "Cancel anytime",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    sub: "Brand Builder",
    price: "$79",
    per: "per month",
    desc: "Your brand. Your voice. Fully trained.",
    cta: "Build Your Brand",
    highlight: false,
    features: [
      "Unlimited uploads & generations",
      "Full personality training",
      "Multi-platform content",
      "Advanced project history",
      "Content calendar",
      "Cancel anytime",
    ],
  },
  {
    id: "elite",
    name: "Elite",
    sub: "AI Manager",
    price: "$149",
    per: "per month",
    desc: "Let Lumevo run your entire content system.",
    cta: "Get Your AI Manager",
    highlight: true,
    features: [
      "Everything in Pro",
      "AI Video Creation",
      "Voice Clone Studio — sounds exactly like you",
      "Agentic creative director",
      "Script → narrated in your voice",
      "Priority support",
      "Cancel anytime",
    ],
  },
];

const STEPS = [
  { num: "01", title: "Upload Your Content", body: "Drop in videos, captions, scripts, or ideas — anything you've already created." },
  { num: "02", title: "Lumevo Learns You", body: "Your tone, visuals, structure, and audience patterns are analyzed and stored in your Brand Profile." },
  { num: "03", title: "Create in Your Style", body: "Generate captions, hooks, scripts, and videos that actually match your brand — not a generic template." },
  { num: "04", title: "Improve Over Time", body: "Every upload sharpens the system. Your content compounds, not resets." },
];

export default function LandingPage() {
  const router = useRouter();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&family=Syne:wght@700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #F8F8A6; font-family: 'DM Sans', system-ui, sans-serif; color: #1a1a1a; -webkit-font-smoothing: antialiased; }

        .nav { position: sticky; top: 0; z-index: 100; background: rgba(248,248,166,0.88); backdrop-filter: blur(14px); border-bottom: 1px solid rgba(0,0,0,0.07); padding: 0 32px; height: 64px; display: flex; align-items: center; justify-content: space-between; }
        .nav-logo { display: flex; align-items: baseline; gap: 5px; cursor: pointer; text-decoration: none; }
        .nav-lumevo { font-family: 'Fredoka One', cursive; font-size: 26px; color: #FF2D2D; letter-spacing: 1px; line-height: 1; }
        .nav-studio { font-size: 11px; font-weight: 500; color: #FF2D2D; font-style: italic; letter-spacing: 2px; text-transform: uppercase; }
        .nav-links { display: flex; align-items: center; gap: 6px; }
        .nav-link { background: none; border: none; color: #7c7660; font-family: inherit; font-size: 14px; font-weight: 500; padding: 8px 14px; border-radius: 999px; cursor: pointer; transition: color 0.2s; }
        .nav-link:hover { color: #1a1a1a; }
        .nav-cta { background: #FF2D2D; color: #fff; border: none; font-family: inherit; font-size: 14px; font-weight: 700; padding: 10px 22px; border-radius: 999px; cursor: pointer; transition: opacity 0.2s, transform 0.15s; }
        .nav-cta:hover { opacity: 0.88; transform: translateY(-1px); }

        .hero { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 72px 24px 72px; }
        .hero-eyebrow { display: inline-block; background: rgba(255,45,45,0.1); color: #FF2D2D; font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; padding: 6px 18px; border-radius: 999px; margin-bottom: 32px; }
        .hero-brand { margin-bottom: 40px; }
        .hero-lumevo { font-family: 'Fredoka One', cursive; font-size: clamp(64px, 13vw, 130px); color: #FF2D2D; line-height: 0.88; letter-spacing: 2px; display: block; }
        .hero-studio-text { font-size: clamp(12px, 2vw, 18px); font-style: italic; color: #FF2D2D; letter-spacing: 8px; text-transform: uppercase; display: block; margin-top: 6px; opacity: 0.8; }
        .hero-headline { font-family: 'Syne', sans-serif; font-size: clamp(26px, 3vw, 40px); font-weight: 700; line-height: 1.18; letter-spacing: -0.5px; color: #1a1a1a; max-width: 640px; margin: 0 auto 22px; }
        .hero-headline em { color: #FF2D2D; font-style: normal; }
        .hero-sub { font-size: clamp(15px, 1.8vw, 19px); color: #7c7660; line-height: 1.7; max-width: 520px; margin: 0 auto 44px; }
        .hero-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; justify-content: center; margin-bottom: 52px; }
        .btn-red { background: #FF2D2D; color: #fff; border: none; font-family: inherit; font-size: 16px; font-weight: 700; padding: 15px 34px; border-radius: 999px; cursor: pointer; transition: opacity 0.2s, transform 0.15s; }
        .btn-red:hover { opacity: 0.88; transform: translateY(-2px); }
        .btn-outline { background: transparent; color: #1a1a1a; border: 2px solid rgba(0,0,0,0.15); font-family: inherit; font-size: 16px; font-weight: 600; padding: 13px 32px; border-radius: 999px; cursor: pointer; transition: border-color 0.2s, transform 0.15s; }
        .btn-outline:hover { border-color: rgba(0,0,0,0.3); transform: translateY(-2px); }
        .hero-chips { display: none; }
        .hero-chip { display: none; }

        .section { padding: 80px 24px; }
        .section-white { background: #ffffff; }
        .section-yellow { background: #F8F8A6; }
        .container { max-width: 1100px; margin: 0 auto; }
        .section-label { font-size: 11px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; color: #FF2D2D; margin-bottom: 10px; }
        .section-title { font-family: 'Syne', sans-serif; font-size: clamp(22px, 2.8vw, 36px); font-weight: 700; letter-spacing: -0.3px; line-height: 1.15; margin-bottom: 12px; color: #1a1a1a; }
        .section-body { font-size: 17px; color: #7c7660; line-height: 1.7; max-width: 500px; margin-top: 0; }

        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center; }
        @media (max-width: 780px) { .two-col { grid-template-columns: 1fr; gap: 40px; } }

        .learn-card { background: #F8F8A6; border-radius: 20px; padding: 36px; }
        .learn-item { display: flex; gap: 14px; align-items: flex-start; margin-bottom: 18px; }
        .learn-item:last-child { margin-bottom: 0; }
        .learn-dot { width: 8px; height: 8px; background: #FF2D2D; border-radius: 50%; margin-top: 8px; flex-shrink: 0; }
        .learn-text { font-size: 16px; color: #1a1a1a; font-weight: 500; line-height: 1.5; }

        .operator-steps { display: flex; flex-direction: column; gap: 4px; }
        .op-step { display: flex; align-items: center; gap: 20px; padding: 20px 24px; border-radius: 14px; background: #ffffff; border: 1px solid rgba(0,0,0,0.07); }
        .op-arrow { font-size: 20px; color: #FF2D2D; font-weight: 700; flex-shrink: 0; }
        .op-text { font-size: 15px; font-weight: 500; color: #1a1a1a; }
        .op-connector { height: 16px; width: 1px; background: rgba(0,0,0,0.1); margin-left: 35px; }

        .result-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; max-width: 580px; margin: 0 auto; }
        @media (max-width: 500px) { .result-grid { grid-template-columns: 1fr; } }
        .result-item { background: #F8F8A6; border-radius: 14px; padding: 20px 22px; display: flex; align-items: center; gap: 12px; }
        .result-check { width: 28px; height: 28px; background: #FF2D2D; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 14px; font-weight: 700; flex-shrink: 0; }
        .result-text { font-size: 15px; font-weight: 600; color: #1a1a1a; }
        .output-climax { text-align: center; padding: 72px 48px; background: #FF2D2D; border-radius: 28px; }
        .output-climax-pre { font-size: 17px; color: rgba(255,255,255,0.65); margin-bottom: 24px; font-style: italic; letter-spacing: 0.2px; line-height: 1.7; }
        .output-climax-pre em { color: #ffffff; font-style: normal; font-weight: 700; }
        .output-climax-title { font-family: 'Syne', sans-serif; font-size: clamp(48px, 8vw, 96px); font-weight: 800; line-height: 1.0; letter-spacing: -2px; color: #F8F8A6; margin-bottom: 28px; }
        .output-climax-title em { color: #ffffff; font-style: normal; }
        .output-climax-sub { font-size: 17px; color: rgba(255,255,255,0.65); letter-spacing: 0.3px; }

        .steps-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; margin-top: 52px; }
        .step-card { background: #ffffff; border-radius: 20px; padding: 28px; }
        .step-num { font-family: 'Fredoka One', cursive; font-size: 42px; color: #FF2D2D; line-height: 1; margin-bottom: 14px; }
        .step-title { font-family: 'Syne', sans-serif; font-size: 17px; font-weight: 700; margin-bottom: 10px; color: #1a1a1a; }
        .step-body { font-size: 14px; color: #7c7660; line-height: 1.6; }

        .pricing-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; margin-top: 52px; }
        .price-card { background: #ffffff; border-radius: 20px; padding: 28px 26px; border: 2px solid rgba(0,0,0,0.07); display: flex; flex-direction: column; transition: transform 0.2s, box-shadow 0.2s; }
        .price-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(0,0,0,0.09); }
        .price-card-elite { background: #FF2D2D; border-color: #FF2D2D; }
        .price-tier { font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #7c7660; margin-bottom: 6px; }
        .price-card-elite .price-tier { color: rgba(255,255,255,0.7); }
        .price-name { font-family: 'Fredoka One', cursive; font-size: 32px; color: #1a1a1a; margin-bottom: 2px; line-height: 1; }
        .price-card-elite .price-name { color: #fff; }
        .price-amount { font-family: 'Syne', sans-serif; font-size: 44px; font-weight: 800; letter-spacing: -1px; line-height: 1; margin: 14px 0 2px; color: #1a1a1a; }
        .price-card-elite .price-amount { color: #fff; }
        .price-per { font-size: 13px; color: #7c7660; margin-bottom: 12px; }
        .price-card-elite .price-per { color: rgba(255,255,255,0.65); }
        .price-desc { font-size: 14px; color: #7c7660; line-height: 1.5; margin-bottom: 22px; flex: 1; }
        .price-card-elite .price-desc { color: rgba(255,255,255,0.75); }
        .price-features { list-style: none; margin-bottom: 26px; display: flex; flex-direction: column; gap: 10px; }
        .price-features li { font-size: 14px; color: #1a1a1a; display: flex; align-items: flex-start; gap: 9px; line-height: 1.4; }
        .price-features li::before { content: '✓'; font-weight: 700; color: #FF2D2D; flex-shrink: 0; margin-top: 1px; }
        .price-card-elite .price-features li { color: #fff; }
        .price-card-elite .price-features li::before { color: rgba(255,255,255,0.8); }
        .price-btn { background: #1a1a1a; color: #fff; border: none; font-family: inherit; font-size: 14px; font-weight: 700; padding: 13px; border-radius: 999px; cursor: pointer; transition: opacity 0.2s, transform 0.15s; width: 100%; }
        .price-btn:hover { opacity: 0.85; transform: translateY(-1px); }
        .price-card-elite .price-btn { background: #ffffff; color: #FF2D2D; }
        .elite-badge { display: inline-block; background: rgba(255,255,255,0.2); color: #fff; font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; padding: 4px 10px; border-radius: 999px; margin-bottom: 8px; }

        .final-section { padding: 80px 24px; text-align: center; background: #F8F8A6; }
        .final-pre { font-size: 18px; color: #7c7660; margin-bottom: 6px; }
        .final-title { font-family: 'Syne', sans-serif; font-size: clamp(26px, 3.5vw, 44px); font-weight: 700; letter-spacing: -0.5px; line-height: 1.15; margin-bottom: 6px; }
        .final-title em { color: #FF2D2D; font-style: normal; }
        .final-detail { font-size: 17px; color: #7c7660; margin: 20px auto 44px; max-width: 420px; line-height: 1.6; }
        .final-actions { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }

        .footer { border-top: 1px solid rgba(0,0,0,0.08); padding: 36px 32px; background: #F8F8A6; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; }
        .footer-logo { font-family: 'Fredoka One', cursive; font-size: 22px; color: #FF2D2D; }
        .footer-copy { font-size: 13px; color: #7c7660; }
        .footer-links { display: flex; gap: 20px; }
        .footer-link { background: none; border: none; color: #7c7660; font-size: 13px; cursor: pointer; font-family: inherit; }
        .footer-link:hover { color: #1a1a1a; }
      `}</style>

      {/* NAV */}
      <nav className="nav">
        <div className="nav-logo" onClick={() => router.push("/")}>
          <span className="nav-lumevo">LUMEVO</span>
          <span className="nav-studio">Studio</span>
        </div>
        <div className="nav-links">
          <button className="nav-link" onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}>Pricing</button>
          <button className="nav-link" onClick={() => router.push("/login")}>Log in</button>
          <button className="nav-cta" onClick={() => router.push("/signup")}>Get Started →</button>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-eyebrow">AI Social Media Manager</div>
        <div className="hero-brand">
          <span className="hero-lumevo">LUMEVO</span>
          <span className="hero-studio-text">Studio</span>
        </div>
        <h1 className="hero-headline">
          You Upload. <span style={{ whiteSpace: "nowrap" }}>Lumevo Learns.</span> <em>We Create.</em>
        </h1>
        <p className="hero-sub">
          Every time you upload content, Lumevo studies your voice, your style, and what your audience responds to — then it starts creating for you.
        </p>
        <div className="hero-actions">
          <button className="btn-red" onClick={() => router.push("/signup")}>Start for Free</button>
          <button className="btn-outline" onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}>See Pricing</button>
        </div>
        <div className="hero-chips">
          <span className="hero-chip">🎙 Voice Cloning</span>
          <span className="hero-chip">✦ AI Captions</span>
          <span className="hero-chip">📹 Video Scripts</span>
          <span className="hero-chip">📊 Brand Learning</span>
          <span className="hero-chip">🚀 Multi-Platform</span>
        </div>
      </section>

      {/* FEATURE 1 */}
      <section className="section section-white">
        <div className="container two-col">
          <div>
            <p className="section-label">What Makes Lumevo Different</p>
            <h2 className="section-title">This Isn't<br />Content Generation</h2>
            <p className="section-body">
              This is a system that trains on <em>you</em>. You're not starting from scratch every time — you're building something that improves with every single upload.
            </p>
          </div>
          <div className="learn-card">
            {[
              "It learns how you sound",
              "It learns how your content looks",
              "It learns what performs",
              "It learns what your audience engages with",
            ].map(item => (
              <div className="learn-item" key={item}>
                <div className="learn-dot" />
                <span className="learn-text">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURE 2 */}
      <section className="section section-yellow">
        <div className="container two-col">
          <div className="operator-steps">
            {[
              "At first, Lumevo helps you create",
              "Then it suggests better content",
              "Then it optimizes your posts",
              "Then it runs your content engine",
            ].map((step, i) => (
              <div key={step}>
                <div className="op-step">
                  <span className="op-arrow">→</span>
                  <span className="op-text">{step}</span>
                </div>
                {i < 3 && <div className="op-connector" />}
              </div>
            ))}
          </div>
          <div>
            <p className="section-label">The Progression</p>
            <h2 className="section-title">From Tool<br />To Operator</h2>
            <p className="section-body">
              Lumevo starts as a tool that helps you create. Over time, it becomes an operator that runs your content system — so you can focus on being a creator, not a manager.
            </p>
          </div>
        </div>
      </section>

      {/* FEATURE 3 */}
      <section className="section section-white">
        <div className="container">
          <div className="output-climax">
            <p className="output-climax-pre">It doesn&apos;t just <em>look</em> like you. It doesn&apos;t just <em>sound</em> like you.</p>
            <h3 className="output-climax-title">It <em>is</em> you.</h3>
            <p className="output-climax-sub">Your voice. Your style. Your audience. Running on autopilot.</p>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section section-yellow">
        <div className="container">
          <div style={{ textAlign: "center" }}>
            <p className="section-label">How It Works</p>
            <h2 className="section-title">Four Steps to Your<br />Personal Content System</h2>
          </div>
          <div className="steps-grid">
            {STEPS.map(s => (
              <div className="step-card" key={s.num}>
                <div className="step-num">{s.num}</div>
                <h3 className="step-title">{s.title}</h3>
                <p className="step-body">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="section section-white" id="pricing">
        <div className="container">
          <div style={{ textAlign: "center" }}>
            <p className="section-label">Choose Your Level</p>
            <h2 className="section-title">Pick the Plan That Fits<br />Where You Are</h2>
            <p style={{ fontSize: 16, color: "#7c7660", marginTop: 10 }}>Upgrade anytime as Lumevo learns more about your brand.</p>
          </div>
          <div className="pricing-grid">
            {PRICING.map(plan => (
              <div key={plan.id} className={`price-card ${plan.highlight ? "price-card-elite" : ""}`}>
                {plan.highlight && <div className="elite-badge">🎯 Flagship Plan</div>}
                <div className="price-tier">{plan.sub}</div>
                <div className="price-name">{plan.name}</div>
                <div className="price-amount">{plan.price}</div>
                <div className="price-per">{plan.per}</div>
                <p className="price-desc">{plan.desc}</p>
                <ul className="price-features">
                  {plan.features.map(f => <li key={f}>{f}</li>)}
                </ul>
                <button className="price-btn" onClick={() => router.push("/signup")}>{plan.cta}</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="final-section">
        <p className="final-pre">Other platforms give you tools.</p>
        <h2 className="final-title">Lumevo builds you <em>a system.</em></h2>
        <p className="final-detail">You upload once. We learn forever.<br />And it only gets better from there.</p>
        <div className="final-actions">
          <button className="btn-red" onClick={() => router.push("/signup")}>Start Free Trial →</button>
          <button className="btn-outline" onClick={() => router.push("/login")}>Already have an account?</button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-logo">LUMEVO</div>
        <p className="footer-copy">© 2026 Lumevo Studio. All rights reserved.</p>
        <div className="footer-links">
          <button className="footer-link" onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}>Pricing</button>
          <button className="footer-link" onClick={() => router.push("/login")}>Login</button>
          <button className="footer-link" onClick={() => router.push("/signup")}>Sign Up</button>
        </div>
      </footer>
    </>
  );
}
