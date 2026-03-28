"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getProject, patchProject } from "../../../../lib/projectStore";
import { generateContent } from "../../../../lib/aiGeneration";
import type { Project, Vibe, Tone, AudienceGoal, GeneratedContent } from "../../../../lib/types";
import { VIBE_LABELS, TONE_LABELS, AUDIENCE_GOAL_LABELS } from "../../../../lib/types";

function ChipGroup<T extends string>({ options, labels, selected, onSelect }: { options: T[]; labels: Record<T, string>; selected: T | ""; onSelect: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button key={opt} type="button" onClick={() => onSelect(opt)} className={`chip ${selected === opt ? "chip-active" : "chip-idle"}`}>
          {labels[opt]}
        </button>
      ))}
    </div>
  );
}

export default function ScriptPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [vibe, setVibe] = useState<Vibe | "">("");
  const [tone, setTone] = useState<Tone | "">("");
  const [audienceGoal, setAudienceGoal] = useState<AudienceGoal | "">("");
  const [generated, setGenerated] = useState<GeneratedContent | undefined>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const p = getProject(id);
    if (p) { setProject(p); setTitle(p.title); setDescription(p.description); setVibe(p.vibe); setTone(p.tone); setAudienceGoal(p.audienceGoal); if (p.generated) setGenerated(p.generated); }
  }, [id]);

  function handleSave() {
    patchProject(id, { title, description, vibe, tone, audienceGoal });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  }

  async function handleGenerate() {
    if (!project) return;
    if (!title.trim()) { setError("Add a title first."); return; }
    if (!description.trim()) { setError("Add a description first."); return; }
    if (!vibe) { setError("Pick a vibe."); return; }
    if (!tone) { setError("Pick a tone."); return; }
    if (!audienceGoal) { setError("Pick an audience goal."); return; }
    setError(""); setIsGenerating(true);
    const updated = patchProject(id, { title, description, vibe, tone, audienceGoal, status: "generating" });
    try {
      const result = await generateContent({ ...project, ...updated! });
      const gen: GeneratedContent = { ...result, generatedAt: new Date().toISOString() };
      setGenerated(gen);
      patchProject(id, { generated: gen, status: "ready" });
    } catch { setError("Generation failed. Try again."); patchProject(id, { status: "draft" }); }
    finally { setIsGenerating(false); }
  }

  if (!project) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#F8F8A6"}}><div style={{width:8,height:8,background:"#FF2D2D",borderRadius:"50%"}} /></div>;

  const vibeOptions = Object.keys(VIBE_LABELS) as Vibe[];
  const toneOptions = Object.keys(TONE_LABELS) as Tone[];
  const goalOptions = Object.keys(AUDIENCE_GOAL_LABELS) as AudienceGoal[];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');
        :root { --bg:#F8F8A6; --surface:#ffffff; --surface2:#F2F29A; --border:rgba(0,0,0,0.08); --accent:#FF2D2D; --accent2:#FF2D2D; --text:#1a1a1a; --muted:#78716c; --radius:14px; }
        * { box-sizing:border-box; margin:0; padding:0; }
        body { background:var(--bg); color:var(--text); font-family:'DM Sans',system-ui,sans-serif; min-height:100vh; }
        .page-wrap { max-width:860px; margin:0 auto; padding:48px 24px 120px; }
        .back-btn { display:flex; align-items:center; gap:6px; color:var(--muted); background:none; border:none; cursor:pointer; font-size:14px; font-family:inherit; transition:color 0.2s; margin-bottom:40px; }
        .back-btn:hover { color:var(--text); }
        .page-title { font-family:'Syne',sans-serif; font-size:32px; font-weight:800; letter-spacing:-0.5px; }
        .page-subtitle { color:var(--muted); font-size:15px; margin-top:6px; margin-bottom:40px; }
        .section { margin-bottom:36px; }
        .section-label { font-size:11px; font-weight:600; letter-spacing:1.5px; text-transform:uppercase; color:var(--muted); margin-bottom:10px; }
        .input-field { width:100%; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); color:var(--text); font-family:inherit; font-size:15px; padding:14px 16px; outline:none; transition:border-color 0.2s; resize:none; }
        .input-field::placeholder { color:var(--muted); }
        .input-field:focus { border-color:rgba(255,45,45,0.4); }
        textarea.input-field { min-height:110px; line-height:1.6; }
        .flex { display:flex; } .flex-wrap { flex-wrap:wrap; } .gap-2 { gap:8px; }
        .chip { border-radius:999px; border:1px solid; font-family:inherit; font-size:13px; font-weight:500; padding:6px 14px; cursor:pointer; transition:all 0.15s; white-space:nowrap; }
        .chip-idle { background:var(--surface); border-color:var(--border); color:var(--muted); }
        .chip-idle:hover { border-color:rgba(0,0,0,0.2); color:var(--text); }
        .chip-active { background:var(--accent); border-color:var(--accent); color:#fff; }
        .action-row { display:flex; align-items:center; gap:12px; margin-top:44px; flex-wrap:wrap; }
        .btn-primary { display:flex; align-items:center; gap:8px; background:var(--accent); color:#fff; font-family:inherit; font-size:14px; font-weight:600; border:none; border-radius:999px; padding:12px 24px; cursor:pointer; transition:opacity 0.2s,transform 0.15s; }
        .btn-primary:hover:not(:disabled) { opacity:0.9; transform:translateY(-1px); }
        .btn-primary:disabled { opacity:0.4; cursor:not-allowed; }
        .btn-ghost { display:flex; align-items:center; gap:8px; background:var(--surface); color:var(--text); font-family:inherit; font-size:14px; font-weight:500; border:1px solid var(--border); border-radius:999px; padding:12px 22px; cursor:pointer; transition:border-color 0.2s; }
        .btn-ghost:hover { border-color:rgba(0,0,0,0.2); }
        .saved-badge { font-size:13px; color:#16a34a; font-weight:500; }
        .error-msg { font-size:13px; color:var(--accent); margin-top:12px; }
        .divider { border:none; border-top:1px solid var(--border); margin:52px 0; }
        .gen-heading { font-family:'Syne',sans-serif; font-size:22px; font-weight:700; margin-bottom:24px; }
        .gen-grid { display:grid; gap:20px; }
        .result-card { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:20px 22px; }
        .result-label { font-size:11px; font-weight:600; letter-spacing:1.5px; text-transform:uppercase; color:var(--accent); }
        .result-list { display:grid; gap:8px; margin-top:12px; }
        .result-item { display:flex; align-items:flex-start; gap:10px; font-size:14px; color:var(--text); line-height:1.5; }
        .result-index { width:20px; min-width:20px; height:20px; border-radius:50%; background:var(--surface2); color:var(--muted); font-size:11px; font-weight:600; display:flex; align-items:center; justify-content:center; margin-top:1px; }
        .structure-grid { display:grid; gap:12px; margin-top:12px; }
        .structure-block { background:var(--surface2); border-radius:10px; padding:14px 16px; display:grid; grid-template-columns:80px 1fr auto; gap:12px; align-items:start; }
        .structure-label { font-size:13px; font-weight:700; color:var(--accent); }
        .structure-suggestion { font-size:14px; color:var(--text); line-height:1.5; }
        .structure-duration { font-size:12px; color:var(--muted); white-space:nowrap; margin-top:2px; }
        .spinner { width:18px; height:18px; border:2px solid rgba(255,255,255,0.3); border-top-color:#fff; border-radius:50%; animation:spin 0.6s linear infinite; }
        @keyframes spin { to { transform:rotate(360deg); } }
        @media (max-width:600px) { .structure-block { grid-template-columns:1fr; } }
      `}</style>

      <div className="page-wrap">
        <button className="back-btn" onClick={() => router.push(`/project/${id}`)}>← Back</button>
        <h1 className="page-title">Content Brief</h1>
        <p className="page-subtitle">Tell us what you're making — we'll handle the rest.</p>

        <div className="section">
          <p className="section-label">Project Title</p>
          <input className="input-field" placeholder="e.g. Morning routine transformation" value={title} onChange={e => setTitle(e.target.value)} />
        </div>

        <div className="section">
          <p className="section-label">What's this content about?</p>
          <textarea className="input-field" placeholder="Describe the video or post. What happens? What's the point?" value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        <div className="section">
          <p className="section-label">Vibe</p>
          <ChipGroup options={vibeOptions} labels={VIBE_LABELS} selected={vibe} onSelect={setVibe} />
        </div>

        <div className="section">
          <p className="section-label">Tone</p>
          <ChipGroup options={toneOptions} labels={TONE_LABELS} selected={tone} onSelect={setTone} />
        </div>

        <div className="section">
          <p className="section-label">Audience Goal</p>
          <ChipGroup options={goalOptions} labels={AUDIENCE_GOAL_LABELS} selected={audienceGoal} onSelect={setAudienceGoal} />
        </div>

        <div className="action-row">
          <button className="btn-primary" onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? <><div className="spinner" /> Generating…</> : <>✦ Generate Content</>}
          </button>
          <button className="btn-ghost" onClick={handleSave}>Save Draft</button>
          {isSaved && <span className="saved-badge">✓ Saved</span>}
        </div>

        {error && <p className="error-msg">⚠ {error}</p>}

        {generated && (
          <>
            <hr className="divider" />
            <h2 className="gen-heading">Generated Content</h2>
            <div className="gen-grid">
              {generated.captions && (
                <div className="result-card">
                  <p className="result-label">Caption Options</p>
                  <div className="result-list">
                    {generated.captions.map((item, i) => (
                      <div key={i} className="result-item"><span className="result-index">{i+1}</span><span>{item}</span></div>
                    ))}
                  </div>
                </div>
              )}
              {generated.titleIdeas && (
                <div className="result-card">
                  <p className="result-label">On-Screen Title Ideas</p>
                  <div className="result-list">
                    {generated.titleIdeas.map((item, i) => (
                      <div key={i} className="result-item"><span className="result-index">{i+1}</span><span>{item}</span></div>
                    ))}
                  </div>
                </div>
              )}
              {generated.contentStructure && (
                <div className="result-card">
                  <p className="result-label">Content Structure</p>
                  <div className="structure-grid">
                    {generated.contentStructure.map((block, i) => (
                      <div key={i} className="structure-block">
                        <span className="structure-label">{block.label}</span>
                        <span className="structure-suggestion">{block.suggestion}</span>
                        {block.duration && <span className="structure-duration">{block.duration}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
