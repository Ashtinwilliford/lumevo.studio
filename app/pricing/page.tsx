"use client";

import { useRouter } from "next/navigation";

const PLANS = [
  {
    id: "free",
    tier: "Starter",
    name: "Free",
    price: "$0",
    per: "forever",
    desc: "Test the waters. See what Lumevo can do with zero commitment.",
    cta: "Start Free",
    highlight: false,
    features: [
      "5 uploads per month",
      "25 AI content generations",
      "Basic captions & hooks",
      "Standard dashboard",
      "1 active project",
    ],
    missing: ["Brand learning", "Voice cloning", "Video creator", "Analytics"],
  },
  {
    id: "creator",
    tier: "Growth",
    name: "Creator",
    price: "$29",
    per: "/ month",
    desc: "For creators who want to move faster and build a real content routine.",
    cta: "Start Growing",
    highlight: false,
    features: [
      "100 AI generations / month",
      "Personalized captions & hooks",
      "Basic tone & style recognition",
      "Weekly content suggestions",
      "Early brand learning",
      "Up to 10 projects",
      "Basic analytics",
    ],
    missing: ["Full personality training", "Voice cloning", "Video creator"],
  },
  {
    id: "pro",
    tier: "Brand Builder",
    name: "Pro",
    price: "$79",
    per: "/ month",
    desc: "Your brand. Your voice. Fully trained. Multi-platform, fully personalized.",
    cta: "Build Your Brand",
    highlight: false,
    features: [
      "Unlimited AI generations",
      "Full personality training",
      "Multi-platform content",
      "Content calendar",
      "Advanced audience learning",
      "Voice cloning (ElevenLabs)",
      "Unlimited projects",
      "Advanced analytics",
    ],
    missing: ["AI Video Manager", "Script → Video workflow"],
  },
  {
    id: "elite",
    tier: "AI Manager",
    name: "Elite",
    price: "$199",
    per: "/ month",
    desc: "Let Lumevo run your entire content engine. This is the full system.",
    cta: "Get Your AI Manager",
    highlight: true,
    features: [
      "Everything in Pro",
      "AI Video Creator + Manager",
      "Voiceover generation",
      "Script → Video workflow",
      "Content repurposing engine",
      "Social media manager workflow",
      "Strongest brand memory",
      "Premium analytics & planning",
      "Priority support",
    ],
    missing: [],
  },
];

export default function PricingPage() {
  const router = useRouter();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #F8F8A6; font-family: 'DM Sans', system-ui, sans-serif; color: #1a1a1a; -webkit-font-smoothing: antialiased; min-height: 100vh; }
        .nav { padding: 0 32px; height: 64px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.07); background: rgba(248,248,166,0.9); backdrop-filter: blur(12px); position: sticky; top: 0; z-index: 100; }
        .logo { display: flex; align-items: baseline; gap: 5px; cursor: pointer; }
        .logo-main { font-family: 'Fredoka One', cursive; font-size: 24px; color: #FF2D2D; letter-spacing: 1px; }
        .logo-sub { font-size: 10px; font-style: italic; color: #FF2D2D; letter-spacing: 2px; text-transform: uppercase; }
        .nav-links { display: flex; gap: 8px; align-items: center; }
        .nav-link { background: none; border: none; color: #7c7660; font-family: inherit; font-size: 14px; font-weight: 500; padding: 8px 14px; border-radius: 999px; cursor: pointer; }
        .nav-link:hover { color: #1a1a1a; }
        .nav-cta { background: #FF2D2D; color: #fff; border: none; font-family: inherit; font-size: 14px; font-weight: 700; padding: 10px 22px; border-radius: 999px; cursor: pointer; }
        .nav-cta:hover { opacity: 0.88; }

        .hero { text-align: center; padding: 80px 24px 60px; }
        .hero-label { font-size: 11px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; color: #FF2D2D; margin-bottom: 16px; }
        .hero-title { font-family: 'Syne', sans-serif; font-size: clamp(32px, 5vw, 56px); font-weight: 800; letter-spacing: -1px; line-height: 1.1; margin-bottom: 16px; }
        .hero-sub { font-size: 18px; color: #7c7660; max-width: 480px; margin: 0 auto; line-height: 1.6; }

        .grid-wrap { max-width: 1140px; margin: 0 auto; padding: 20px 24px 100px; }
        .plans-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
        .plan-card { background: #fff; border-radius: 24px; padding: 32px 28px; border: 2px solid rgba(0,0,0,0.07); display: flex; flex-direction: column; transition: transform 0.2s, box-shadow 0.2s; }
        .plan-card:hover { transform: translateY(-4px); box-shadow: 0 12px 48px rgba(0,0,0,0.09); }
        .plan-card-elite { background: #FF2D2D; border-color: #FF2D2D; }
        .elite-badge { display: inline-block; background: rgba(255,255,255,0.2); color: #fff; font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; padding: 4px 12px; border-radius: 999px; margin-bottom: 10px; }
        .plan-tier { font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #7c7660; margin-bottom: 6px; }
        .plan-card-elite .plan-tier { color: rgba(255,255,255,0.7); }
        .plan-name { font-family: 'Fredoka One', cursive; font-size: 34px; color: #1a1a1a; line-height: 1; margin-bottom: 2px; }
        .plan-card-elite .plan-name { color: #fff; }
        .plan-price { font-family: 'Syne', sans-serif; font-size: 48px; font-weight: 800; letter-spacing: -2px; line-height: 1; margin: 18px 0 2px; color: #1a1a1a; }
        .plan-card-elite .plan-price { color: #fff; }
        .plan-per { font-size: 14px; color: #7c7660; margin-bottom: 14px; }
        .plan-card-elite .plan-per { color: rgba(255,255,255,0.6); }
        .plan-desc { font-size: 14px; color: #7c7660; line-height: 1.5; margin-bottom: 24px; flex: 1; }
        .plan-card-elite .plan-desc { color: rgba(255,255,255,0.75); }
        .plan-divider { border: none; border-top: 1px solid rgba(0,0,0,0.07); margin: 0 0 20px; }
        .plan-card-elite .plan-divider { border-color: rgba(255,255,255,0.15); }
        .features-label { font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #7c7660; margin-bottom: 14px; }
        .plan-card-elite .features-label { color: rgba(255,255,255,0.6); }
        .features-list { list-style: none; margin-bottom: 20px; display: flex; flex-direction: column; gap: 10px; }
        .features-list li { font-size: 14px; color: #1a1a1a; display: flex; align-items: flex-start; gap: 9px; line-height: 1.4; }
        .features-list li::before { content: '✓'; font-weight: 700; color: #FF2D2D; flex-shrink: 0; }
        .plan-card-elite .features-list li { color: #fff; }
        .plan-card-elite .features-list li::before { color: rgba(255,255,255,0.85); }
        .missing-list { list-style: none; margin-bottom: 28px; display: flex; flex-direction: column; gap: 8px; }
        .missing-list li { font-size: 13px; color: #b5b09a; display: flex; align-items: flex-start; gap: 9px; text-decoration: line-through; }
        .missing-list li::before { content: '✗'; color: #d4cfc3; flex-shrink: 0; text-decoration: none; display: inline-block; }
        .plan-btn { background: #1a1a1a; color: #fff; border: none; font-family: inherit; font-size: 15px; font-weight: 700; padding: 14px; border-radius: 999px; cursor: pointer; transition: opacity 0.2s, transform 0.15s; width: 100%; }
        .plan-btn:hover { opacity: 0.85; transform: translateY(-1px); }
        .plan-card-elite .plan-btn { background: #fff; color: #FF2D2D; }

        .guarantee { text-align: center; margin-top: 48px; padding: 32px; background: #fff; border-radius: 20px; max-width: 560px; margin-left: auto; margin-right: auto; }
        .guarantee-title { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 700; margin-bottom: 10px; }
        .guarantee-body { font-size: 15px; color: #7c7660; line-height: 1.6; }

        .footer { border-top: 1px solid rgba(0,0,0,0.08); padding: 32px; background: #F8F8A6; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; }
        .footer-logo { font-family: 'Fredoka One', cursive; font-size: 20px; color: #FF2D2D; }
        .footer-copy { font-size: 13px; color: #7c7660; }
      `}</style>

      <nav className="nav">
        <div className="logo" onClick={() => router.push("/")}>
          <span className="logo-main">LUMEVO</span>
          <span className="logo-sub">Studio</span>
        </div>
        <div className="nav-links">
          <button className="nav-link" onClick={() => router.push("/login")}>Log in</button>
          <button className="nav-cta" onClick={() => router.push("/signup")}>Get Started →</button>
        </div>
      </nav>

      <div className="hero">
        <p className="hero-label">Pricing</p>
        <h1 className="hero-title">Choose Your Level</h1>
        <p className="hero-sub">Start free. Upgrade as Lumevo learns more about your brand. Downgrade anytime.</p>
      </div>

      <div className="grid-wrap">
        <div className="plans-grid">
          {PLANS.map(plan => (
            <div key={plan.id} className={`plan-card ${plan.highlight ? "plan-card-elite" : ""}`}>
              {plan.highlight && <div className="elite-badge">🎯 Flagship Plan</div>}
              <div className="plan-tier">{plan.tier}</div>
              <div className="plan-name">{plan.name}</div>
              <div className="plan-price">{plan.price}</div>
              <div className="plan-per">{plan.per}</div>
              <p className="plan-desc">{plan.desc}</p>
              <hr className="plan-divider" />
              <div className="features-label">What's included</div>
              <ul className="features-list">
                {plan.features.map(f => <li key={f}>{f}</li>)}
              </ul>
              {plan.missing.length > 0 && (
                <ul className="missing-list">
                  {plan.missing.map(f => <li key={f}>{f}</li>)}
                </ul>
              )}
              <button className="plan-btn" onClick={() => router.push("/signup")}>{plan.cta}</button>
            </div>
          ))}
        </div>

        <div className="guarantee" style={{ marginTop: 52 }}>
          <div className="guarantee-title">Other platforms give you tools.<br />Lumevo builds you a system.</div>
          <p className="guarantee-body">Start with the free plan. Lumevo learns your brand from day one. Upgrade when you're ready for more power.</p>
        </div>
      </div>

      <footer className="footer">
        <div className="footer-logo">LUMEVO</div>
        <p className="footer-copy">© 2026 Lumevo Studio. All rights reserved.</p>
      </footer>
    </>
  );
}
