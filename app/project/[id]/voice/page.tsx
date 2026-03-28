"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getProject, patchProject } from "../../../../lib/projectStore";
import type { Project, VoiceClone } from "../../../../lib/types";

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');
  :root { --bg:#FFF9E6; --surface:#ffffff; --surface2:#FFF3CC; --border:rgba(0,0,0,0.08); --accent:#C62828; --text:#1a1a1a; --muted:#78716c; --radius:14px; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { background:var(--bg); color:var(--text); font-family:'DM Sans',system-ui,sans-serif; min-height:100vh; }
  .page-wrap { max-width:760px; margin:0 auto; padding:48px 24px 120px; }
  .back-btn { display:flex; align-items:center; gap:6px; color:var(--muted); background:none; border:none; cursor:pointer; font-size:14px; font-family:inherit; margin-bottom:40px; transition:color 0.2s; }
  .back-btn:hover { color:var(--text); }
  .page-title { font-family:'Syne',sans-serif; font-size:32px; font-weight:800; letter-spacing:-0.5px; }
  .page-subtitle { color:var(--muted); font-size:15px; margin-top:6px; margin-bottom:40px; line-height:1.6; }
  .card { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:28px 28px; margin-bottom:20px; }
  .card-title { font-family:'Syne',sans-serif; font-size:17px; font-weight:700; margin-bottom:6px; }
  .card-sub { font-size:13px; color:var(--muted); line-height:1.6; margin-bottom:20px; }
  .section-label { font-size:11px; font-weight:600; letter-spacing:1.5px; text-transform:uppercase; color:var(--muted); margin-bottom:8px; }
  .input-field { width:100%; background:var(--bg); border:1px solid var(--border); border-radius:10px; color:var(--text); font-family:inherit; font-size:15px; padding:12px 14px; outline:none; transition:border-color 0.2s; }
  .input-field:focus { border-color:rgba(198,40,40,0.4); }
  .input-field::placeholder { color:var(--muted); }
  .drop-zone { border:2px dashed var(--border); border-radius:12px; padding:36px 20px; display:flex; flex-direction:column; align-items:center; gap:10px; text-align:center; cursor:pointer; transition:border-color 0.2s,background 0.2s; margin-top:12px; }
  .drop-zone:hover, .drop-zone-active { border-color:rgba(198,40,40,0.4); background:rgba(198,40,40,0.02); }
  .drop-icon { width:44px; height:44px; border-radius:50%; background:var(--surface2); display:flex; align-items:center; justify-content:center; font-size:18px; color:var(--accent); font-weight:700; }
  .drop-title { font-size:14px; font-weight:600; }
  .drop-sub { font-size:12px; color:var(--muted); }
  .files-list { margin-top:12px; display:flex; flex-direction:column; gap:8px; }
  .file-row { display:flex; align-items:center; gap:10px; background:var(--surface2); border-radius:8px; padding:10px 14px; }
  .file-row-icon { font-size:18px; }
  .file-row-name { font-size:13px; font-weight:500; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .file-row-remove { background:none; border:none; color:var(--muted); font-size:18px; cursor:pointer; padding:0; line-height:1; transition:color 0.15s; }
  .file-row-remove:hover { color:var(--accent); }
  .btn-primary { display:flex; align-items:center; justify-content:center; gap:8px; background:var(--accent); color:#fff; font-family:inherit; font-size:14px; font-weight:600; border:none; border-radius:999px; padding:13px 28px; cursor:pointer; width:100%; margin-top:20px; transition:opacity 0.2s,transform 0.15s; }
  .btn-primary:hover:not(:disabled) { opacity:0.9; transform:translateY(-1px); }
  .btn-primary:disabled { opacity:0.4; cursor:not-allowed; }
  .btn-ghost { display:flex; align-items:center; justify-content:center; gap:8px; background:transparent; color:var(--text); font-family:inherit; font-size:14px; font-weight:500; border:1px solid var(--border); border-radius:999px; padding:12px 24px; cursor:pointer; width:100%; margin-top:10px; transition:border-color 0.2s; }
  .btn-ghost:hover:not(:disabled) { border-color:rgba(0,0,0,0.2); }
  .btn-ghost:disabled { opacity:0.4; cursor:not-allowed; }
  .spinner { width:16px; height:16px; border:2px solid rgba(255,255,255,0.3); border-top-color:#fff; border-radius:50%; animation:spin 0.6s linear infinite; }
  .spinner-dark { border-color:rgba(0,0,0,0.15); border-top-color:var(--accent); }
  @keyframes spin { to { transform:rotate(360deg); } }
  .error-msg { font-size:13px; color:var(--accent); margin-top:12px; text-align:center; }
  .success-banner { background:rgba(22,163,74,0.08); border:1px solid rgba(22,163,74,0.2); border-radius:10px; padding:14px 18px; margin-bottom:20px; display:flex; align-items:center; gap:12px; }
  .success-icon { font-size:20px; }
  .success-text { font-size:14px; color:#15803d; font-weight:500; }
  .success-sub { font-size:12px; color:#15803d; opacity:0.8; margin-top:2px; }
  .preview-section { margin-top:20px; }
  .audio-player { width:100%; margin-top:10px; border-radius:8px; }
  textarea.input-field { min-height:90px; line-height:1.6; resize:none; }
  .tip-box { background:var(--surface2); border-radius:10px; padding:14px 16px; margin-bottom:24px; }
  .tip-text { font-size:13px; color:var(--muted); line-height:1.6; }
  .tip-text strong { color:var(--text); }
  .divider { border:none; border-top:1px solid var(--border); margin:24px 0; }
`;

export default function VoicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [voiceName, setVoiceName] = useState("");
  const [audioFiles, setAudioFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [cloneError, setCloneError] = useState("");
  const [voiceClone, setVoiceClone] = useState<VoiceClone | undefined>();
  const [previewText, setPreviewText] = useState("");
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [synthError, setSynthError] = useState("");

  useEffect(() => {
    const p = getProject(id);
    if (!p) { router.push("/dashboard"); return; }
    setProject(p);
    setVoiceName(p.title);
    if (p.voiceClone) setVoiceClone(p.voiceClone);
    if (p.generated?.captions?.[0]) setPreviewText(p.generated.captions[0]);
  }, [id, router]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const added = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("audio/"));
    setAudioFiles((prev) => [...prev, ...added]);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const added = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("audio/"));
    setAudioFiles((prev) => [...prev, ...added]);
  }

  async function handleClone() {
    if (!voiceName.trim()) { setCloneError("Enter a name for your voice."); return; }
    if (audioFiles.length === 0) { setCloneError("Upload at least one audio sample."); return; }
    setCloneError("");
    setIsCloning(true);

    const form = new FormData();
    form.append("name", voiceName.trim());
    audioFiles.forEach((f) => form.append("files", f, f.name));

    const res = await fetch("/api/voice/clone", { method: "POST", body: form });
    const data = await res.json() as { voiceId?: string; error?: string };

    if (!res.ok || !data.voiceId) {
      setCloneError(data.error ?? "Cloning failed. Please try again.");
      setIsCloning(false);
      return;
    }

    const clone: VoiceClone = { voiceId: data.voiceId, voiceName: voiceName.trim(), createdAt: new Date().toISOString() };
    setVoiceClone(clone);
    patchProject(id, { voiceClone: clone });
    setIsCloning(false);
  }

  async function handleSynthesize() {
    if (!voiceClone) return;
    if (!previewText.trim()) { setSynthError("Enter some text to preview."); return; }
    setSynthError("");
    setIsSynthesizing(true);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);

    const res = await fetch("/api/voice/synthesize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voiceId: voiceClone.voiceId, text: previewText.trim() }),
    });

    if (!res.ok) {
      const data = await res.json() as { error?: string };
      setSynthError(data.error ?? "Synthesis failed.");
      setIsSynthesizing(false);
      return;
    }

    const blob = await res.blob();
    setAudioUrl(URL.createObjectURL(blob));
    setIsSynthesizing(false);
  }

  function handleDeleteVoice() {
    if (!confirm("Remove this voice clone from the project?")) return;
    setVoiceClone(undefined);
    setAudioUrl(null);
    patchProject(id, { voiceClone: undefined });
  }

  if (!project) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#FFF9E6" }}><div style={{ width: 8, height: 8, background: "#C62828", borderRadius: "50%" }} /></div>;

  return (
    <>
      <style>{STYLES}</style>
      <div className="page-wrap">
        <button className="back-btn" onClick={() => router.push(`/project/${id}`)}>← Back</button>
        <h1 className="page-title">Voice Clone</h1>
        <p className="page-subtitle">Upload a short recording of your voice and we will clone it. Use it to hear your generated captions read back in your own voice.</p>

        {voiceClone ? (
          <>
            <div className="success-banner">
              <span className="success-icon">✓</span>
              <div>
                <p className="success-text">Voice cloned — {voiceClone.voiceName}</p>
                <p className="success-sub">Created {new Date(voiceClone.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
              </div>
            </div>

            <div className="card">
              <p className="card-title">Preview your voice</p>
              <p className="card-sub">Type or paste any text and hear it read in your cloned voice. If you generated captions, they will appear below automatically.</p>

              <p className="section-label">Text to speak</p>
              <textarea
                className="input-field"
                placeholder="Enter text to synthesize…"
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
              />

              {project.generated?.captions && project.generated.captions.length > 0 && (
                <>
                  <div className="divider" />
                  <p className="section-label">Or pick a generated caption</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 4 }}>
                    {project.generated.captions.map((cap, i) => (
                      <button key={i} onClick={() => setPreviewText(cap)} style={{ textAlign: "left", background: previewText === cap ? "rgba(198,40,40,0.06)" : "var(--surface2)", border: `1px solid ${previewText === cap ? "rgba(198,40,40,0.3)" : "transparent"}`, borderRadius: 8, padding: "10px 14px", cursor: "pointer", fontSize: 13, color: "var(--text)", fontFamily: "inherit", lineHeight: 1.5, transition: "all 0.15s" }}>
                        {cap}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <button className="btn-primary" onClick={handleSynthesize} disabled={isSynthesizing || !previewText.trim()}>
                {isSynthesizing ? <><div className="spinner" /> Generating audio…</> : "Play in my voice"}
              </button>

              {synthError && <p className="error-msg">{synthError}</p>}

              {audioUrl && (
                <div className="preview-section">
                  <audio className="audio-player" controls src={audioUrl} autoPlay />
                </div>
              )}
            </div>

            <button className="btn-ghost" style={{ color: "var(--muted)", marginTop: 12 }} onClick={handleDeleteVoice}>
              Remove voice clone
            </button>
          </>
        ) : (
          <div className="card">
            <p className="card-title">Create your voice clone</p>
            <p className="card-sub">Record 30–60 seconds of yourself speaking clearly. A quiet room with no background noise gives the best results.</p>

            <div className="tip-box">
              <p className="tip-text"><strong>Tips for a good clone:</strong> Speak naturally at a consistent pace. Avoid music or echoes. MP3, WAV, M4A, and OGG files are all supported.</p>
            </div>

            <p className="section-label">Voice name</p>
            <input className="input-field" placeholder="e.g. My Creator Voice" value={voiceName} onChange={(e) => setVoiceName(e.target.value)} style={{ marginBottom: 20 }} />

            <p className="section-label">Audio samples</p>
            <div
              className={`drop-zone ${isDragging ? "drop-zone-active" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
            >
              <div className="drop-icon">+</div>
              <p className="drop-title">Drop audio files here</p>
              <p className="drop-sub">or click to browse — MP3, WAV, M4A, OGG</p>
              <input ref={inputRef} type="file" multiple accept="audio/*" style={{ display: "none" }} onChange={handleFileInput} />
            </div>

            {audioFiles.length > 0 && (
              <div className="files-list">
                {audioFiles.map((f) => (
                  <div key={f.name} className="file-row">
                    <span className="file-row-icon">♪</span>
                    <span className="file-row-name">{f.name}</span>
                    <button className="file-row-remove" onClick={() => setAudioFiles((prev) => prev.filter((x) => x.name !== f.name))}>×</button>
                  </div>
                ))}
              </div>
            )}

            <button className="btn-primary" onClick={handleClone} disabled={isCloning || audioFiles.length === 0}>
              {isCloning ? <><div className="spinner" /> Cloning voice…</> : "Clone my voice"}
            </button>

            {cloneError && <p className="error-msg">{cloneError}</p>}
          </div>
        )}
      </div>
    </>
  );
}
