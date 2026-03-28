"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getProject, patchProject } from "../../../../lib/projectStore";
import {
  getAllVoices,
  addVoice,
  deleteVoice,
  linkVoiceToProject,
  getVoice,
} from "../../../../lib/voiceStore";
import { extractAudioAsWav, isValidVoiceFile, isVideoFile } from "../../../../lib/audioExtract";
import type { Project, VoiceEntry } from "../../../../lib/types";

const PERSONALITY_TAGS = [
  "Warm", "Energetic", "Calm", "Confident", "Playful",
  "Authoritative", "Casual", "Inspirational", "Witty", "Storyteller",
];

const S = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');
  :root { --bg:#FFF9E6; --surface:#ffffff; --surface2:#FFF3CC; --border:rgba(0,0,0,0.08); --accent:#C62828; --text:#1a1a1a; --muted:#78716c; --radius:14px; }
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:var(--bg);color:var(--text);font-family:'DM Sans',system-ui,sans-serif;min-height:100vh;}
  .wrap{max-width:820px;margin:0 auto;padding:48px 24px 120px;}
  .back{display:flex;align-items:center;gap:6px;color:var(--muted);background:none;border:none;cursor:pointer;font-size:14px;font-family:inherit;margin-bottom:40px;transition:color 0.2s;}
  .back:hover{color:var(--text);}
  .page-title{font-family:'Syne',sans-serif;font-size:32px;font-weight:800;letter-spacing:-0.5px;}
  .page-sub{color:var(--muted);font-size:15px;margin-top:6px;margin-bottom:44px;line-height:1.6;max-width:560px;}
  .section-heading{font-family:'Syne',sans-serif;font-size:18px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:10px;}
  .count-badge{font-size:12px;font-weight:600;background:var(--surface2);color:var(--muted);padding:2px 10px;border-radius:999px;font-family:'DM Sans',sans-serif;}
  .divider{border:none;border-top:1px solid var(--border);margin:44px 0;}
  .voice-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;margin-bottom:8px;}
  .voice-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;transition:border-color 0.2s,box-shadow 0.2s;position:relative;}
  .voice-card-active{border-color:var(--accent)!important;box-shadow:0 0 0 3px rgba(198,40,40,0.08);}
  .vc-name{font-size:15px;font-weight:600;margin-bottom:4px;}
  .vc-personality{font-size:12px;color:var(--muted);margin-bottom:10px;line-height:1.5;}
  .vc-meta{font-size:11px;color:var(--muted);margin-bottom:14px;}
  .vc-actions{display:flex;gap:8px;flex-wrap:wrap;}
  .btn-xs{border-radius:999px;font-family:inherit;font-size:12px;font-weight:600;padding:6px 14px;cursor:pointer;border:1px solid;transition:all 0.15s;}
  .btn-xs-red{background:var(--accent);color:#fff;border-color:var(--accent);}
  .btn-xs-red:hover{opacity:0.88;}
  .btn-xs-outline{background:transparent;color:var(--muted);border-color:var(--border);}
  .btn-xs-outline:hover{color:var(--text);border-color:rgba(0,0,0,0.2);}
  .btn-xs-ghost{background:transparent;color:var(--accent);border-color:transparent;padding-left:0;}
  .btn-xs-ghost:hover{opacity:0.7;}
  .active-badge{position:absolute;top:12px;right:12px;font-size:10px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:var(--accent);background:rgba(198,40,40,0.08);padding:3px 8px;border-radius:999px;}
  .clone-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:28px;}
  .label{font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-bottom:8px;}
  .input{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:inherit;font-size:15px;padding:12px 14px;outline:none;transition:border-color 0.2s;margin-bottom:20px;}
  .input:focus{border-color:rgba(198,40,40,0.4);}
  .input::placeholder{color:var(--muted);}
  .tags{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px;}
  .tag{border-radius:999px;border:1px solid var(--border);font-family:inherit;font-size:12px;font-weight:500;padding:5px 13px;cursor:pointer;background:var(--surface);color:var(--muted);transition:all 0.15s;}
  .tag:hover{border-color:rgba(0,0,0,0.2);color:var(--text);}
  .tag-on{background:var(--accent);border-color:var(--accent);color:#fff;}
  .drop{border:2px dashed var(--border);border-radius:12px;padding:40px 20px;display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;cursor:pointer;transition:border-color 0.2s,background 0.2s;}
  .drop:hover,.drop-on{border-color:rgba(198,40,40,0.45);background:rgba(198,40,40,0.02);}
  .drop-icon{width:44px;height:44px;border-radius:50%;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:20px;}
  .drop-title{font-size:14px;font-weight:600;}
  .drop-sub{font-size:12px;color:var(--muted);}
  .files{margin-top:12px;display:flex;flex-direction:column;gap:8px;}
  .file-row{display:flex;align-items:center;gap:10px;background:var(--surface2);border-radius:8px;padding:10px 14px;}
  .file-row-name{font-size:13px;font-weight:500;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .file-type{font-size:10px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;padding:2px 7px;border-radius:4px;background:rgba(0,0,0,0.06);color:var(--muted);}
  .file-type-video{background:rgba(198,40,40,0.1);color:var(--accent);}
  .file-remove{background:none;border:none;color:var(--muted);font-size:18px;cursor:pointer;padding:0;line-height:1;transition:color 0.15s;}
  .file-remove:hover{color:var(--accent);}
  .progress-bar{height:4px;background:var(--surface2);border-radius:999px;overflow:hidden;margin-top:8px;}
  .progress-fill{height:100%;background:var(--accent);border-radius:999px;transition:width 0.3s;}
  .progress-label{font-size:12px;color:var(--muted);margin-top:6px;}
  .btn{display:flex;align-items:center;justify-content:center;gap:8px;background:var(--accent);color:#fff;font-family:inherit;font-size:14px;font-weight:600;border:none;border-radius:999px;padding:13px 28px;cursor:pointer;width:100%;margin-top:20px;transition:opacity 0.2s,transform 0.15s;}
  .btn:hover:not(:disabled){opacity:0.9;transform:translateY(-1px);}
  .btn:disabled{opacity:0.4;cursor:not-allowed;}
  .err{font-size:13px;color:var(--accent);margin-top:12px;text-align:center;}
  .spin{width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.6s linear infinite;}
  @keyframes spin{to{transform:rotate(360deg);}}
  .audio-wrap{margin-top:12px;}
  audio{width:100%;border-radius:8px;}
  .preview-text{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:inherit;font-size:14px;padding:12px 14px;outline:none;resize:none;min-height:80px;transition:border-color 0.2s;line-height:1.6;}
  .preview-text:focus{border-color:rgba(198,40,40,0.4);}
  .preview-text::placeholder{color:var(--muted);}
  .caption-options{display:flex;flex-direction:column;gap:6px;margin:8px 0 16px;}
  .caption-btn{text-align:left;background:var(--surface2);border:1px solid transparent;border-radius:8px;padding:9px 13px;cursor:pointer;font-size:13px;color:var(--text);font-family:inherit;line-height:1.5;transition:all 0.15s;}
  .caption-btn:hover,.caption-btn-on{background:rgba(198,40,40,0.06);border-color:rgba(198,40,40,0.25);}
  .empty-voices{text-align:center;padding:32px;color:var(--muted);font-size:14px;background:var(--surface);border:1px dashed var(--border);border-radius:var(--radius);}
`;

export default function VoicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [project, setProject] = useState<Project | null>(null);
  const [library, setLibrary] = useState<VoiceEntry[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | undefined>();

  const [voiceName, setVoiceName] = useState("");
  const [personality, setPersonality] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isCloning, setCloningState] = useState(false);
  const [cloneProgress, setCloneProgress] = useState(0);
  const [cloneStep, setCloneStep] = useState("");
  const [cloneError, setCloneError] = useState("");

  const [previewVoice, setPreviewVoice] = useState<VoiceEntry | null>(null);
  const [previewText, setPreviewText] = useState("");
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [synthError, setSynthError] = useState("");

  useEffect(() => {
    const p = getProject(id);
    if (!p) { router.push("/dashboard"); return; }
    setProject(p);
    setSelectedVoiceId(p.selectedVoiceId);
    setVoiceName(p.title);
    setLibrary(getAllVoices());
    if (p.generated?.captions?.[0]) setPreviewText(p.generated.captions[0]);
  }, [id, router]);

  function togglePersonality(tag: string) {
    setPersonality((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function addFiles(rawFiles: FileList | null) {
    if (!rawFiles) return;
    const valid = Array.from(rawFiles).filter(isValidVoiceFile);
    setFiles((prev) => [...prev, ...valid]);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  }

  async function handleClone() {
    if (!voiceName.trim()) { setCloneError("Give your voice a name."); return; }
    if (files.length === 0) { setCloneError("Upload at least one audio or video file."); return; }
    setCloneError("");
    setCloningState(true);

    const form = new FormData();
    form.append("name", voiceName.trim());

    let processed = 0;
    for (const file of files) {
      setCloneStep(isVideoFile(file) ? `Extracting audio from ${file.name}…` : `Preparing ${file.name}…`);
      setCloneProgress(Math.round((processed / files.length) * 60));

      let audioBlob: Blob;
      if (isVideoFile(file)) {
        try {
          audioBlob = await extractAudioAsWav(file);
          form.append("files", audioBlob, `${file.name}.wav`);
        } catch {
          form.append("files", file, file.name);
        }
      } else {
        form.append("files", file, file.name);
      }
      processed++;
    }

    setCloneStep("Cloning your voice with ElevenLabs…");
    setCloneProgress(70);

    const res = await fetch("/api/voice/clone", { method: "POST", body: form });
    const data = await res.json() as { voiceId?: string; error?: string };

    if (!res.ok || !data.voiceId) {
      setCloneError(data.error ?? "Cloning failed. Please try again.");
      setCloningState(false);
      setCloneProgress(0);
      return;
    }

    setCloneProgress(95);
    setCloneStep("Saving to your voice library…");

    const entry = addVoice({
      elevenLabsId: data.voiceId,
      name: voiceName.trim(),
      personality: personality.join(", "),
      usedInProjects: [id],
      sampleCount: files.length,
    });

    patchProject(id, { selectedVoiceId: entry.id });
    setSelectedVoiceId(entry.id);
    setLibrary(getAllVoices());
    setFiles([]);
    setCloneProgress(100);
    setCloningState(false);
    setCloneStep("");
  }

  function handleUseVoice(voice: VoiceEntry) {
    linkVoiceToProject(voice.id, id);
    patchProject(id, { selectedVoiceId: voice.id });
    setSelectedVoiceId(voice.id);
    setLibrary(getAllVoices());
  }

  function handleRemoveVoice(voice: VoiceEntry) {
    if (!confirm(`Delete "${voice.name}" from your library? This cannot be undone.`)) return;
    deleteVoice(voice.id);
    if (selectedVoiceId === voice.id) {
      patchProject(id, { selectedVoiceId: undefined });
      setSelectedVoiceId(undefined);
    }
    setLibrary(getAllVoices());
  }

  function openPreview(voice: VoiceEntry) {
    setPreviewVoice(voice);
    setAudioUrl(null);
    setSynthError("");
  }

  async function handleSynthesize() {
    if (!previewVoice || !previewText.trim()) return;
    setSynthError("");
    setIsSynthesizing(true);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);

    const res = await fetch("/api/voice/synthesize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voiceId: previewVoice.elevenLabsId, text: previewText.trim() }),
    });

    if (!res.ok) {
      const err = await res.json() as { error?: string };
      setSynthError(err.error ?? "Synthesis failed.");
      setIsSynthesizing(false);
      return;
    }

    const blob = await res.blob();
    setAudioUrl(URL.createObjectURL(blob));
    setIsSynthesizing(false);
  }

  if (!project) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#FFF9E6" }}>
      <div style={{ width: 8, height: 8, background: "#C62828", borderRadius: "50%" }} />
    </div>
  );

  const activeVoice = selectedVoiceId ? getVoice(selectedVoiceId) : null;

  return (
    <>
      <style>{S}</style>
      <div className="wrap">
        <button className="back" onClick={() => router.push(`/project/${id}`)}>← Back</button>

        <h1 className="page-title">Voice Repository</h1>
        <p className="page-sub">
          Clone your voice from any video or audio recording. Your voice library is shared across all projects — build it once, use it everywhere.
        </p>

        <h2 className="section-heading">
          Your voice library
          <span className="count-badge">{library.length} {library.length === 1 ? "voice" : "voices"}</span>
        </h2>

        {library.length === 0 ? (
          <div className="empty-voices">No voices yet. Clone your first voice below.</div>
        ) : (
          <div className="voice-grid">
            {library.map((v) => {
              const isActive = selectedVoiceId === v.id;
              const isPreviewing = previewVoice?.id === v.id;
              return (
                <div key={v.id} className={`voice-card ${isActive ? "voice-card-active" : ""}`}>
                  {isActive && <span className="active-badge">In use</span>}
                  <p className="vc-name">{v.name}</p>
                  {v.personality && <p className="vc-personality">{v.personality}</p>}
                  <p className="vc-meta">
                    {v.sampleCount} sample{v.sampleCount !== 1 ? "s" : ""} · {v.usedInProjects.length} project{v.usedInProjects.length !== 1 ? "s" : ""}
                  </p>
                  <div className="vc-actions">
                    {!isActive && (
                      <button className="btn-xs btn-xs-red" onClick={() => handleUseVoice(v)}>
                        Use this voice
                      </button>
                    )}
                    <button
                      className="btn-xs btn-xs-outline"
                      onClick={() => isPreviewing ? setPreviewVoice(null) : openPreview(v)}
                    >
                      {isPreviewing ? "Close" : "Preview"}
                    </button>
                    <button className="btn-xs btn-xs-ghost" onClick={() => handleRemoveVoice(v)}>
                      Delete
                    </button>
                  </div>

                  {isPreviewing && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                      {project.generated?.captions && project.generated.captions.length > 0 && (
                        <>
                          <p className="label" style={{ marginBottom: 6 }}>Pick a caption</p>
                          <div className="caption-options">
                            {project.generated.captions.map((cap, i) => (
                              <button
                                key={i}
                                className={`caption-btn ${previewText === cap ? "caption-btn-on" : ""}`}
                                onClick={() => setPreviewText(cap)}
                              >
                                {cap}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                      <p className="label">Or type your own</p>
                      <textarea
                        className="preview-text"
                        placeholder="Type something to hear in your voice…"
                        value={previewText}
                        onChange={(e) => setPreviewText(e.target.value)}
                      />
                      <button
                        className="btn"
                        style={{ marginTop: 12 }}
                        onClick={handleSynthesize}
                        disabled={isSynthesizing || !previewText.trim()}
                      >
                        {isSynthesizing ? <><div className="spin" /> Generating…</> : "Hear it"}
                      </button>
                      {synthError && <p className="err">{synthError}</p>}
                      {audioUrl && (
                        <div className="audio-wrap">
                          <audio controls src={audioUrl} autoPlay />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="divider" />

        <h2 className="section-heading">Clone a new voice</h2>
        <div className="clone-card">
          <p className="label">Voice name</p>
          <input
            className="input"
            placeholder="e.g. My main creator voice"
            value={voiceName}
            onChange={(e) => setVoiceName(e.target.value)}
          />

          <p className="label">Personality traits</p>
          <div className="tags" style={{ marginBottom: 20 }}>
            {PERSONALITY_TAGS.map((tag) => (
              <button
                key={tag}
                className={`tag ${personality.includes(tag) ? "tag-on" : ""}`}
                onClick={() => togglePersonality(tag)}
              >
                {tag}
              </button>
            ))}
          </div>

          <p className="label">Upload samples</p>
          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12, lineHeight: 1.6 }}>
            Upload video clips or audio recordings of yourself. 30–90 seconds total gives the best clone quality. Audio is automatically extracted from video files.
          </p>

          <div
            className={`drop ${isDragging ? "drop-on" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <div className="drop-icon">+</div>
            <p className="drop-title">Drop video or audio files here</p>
            <p className="drop-sub">MP4, MOV, WEBM, MP3, WAV, M4A, OGG — or click to browse</p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="audio/*,video/*"
              style={{ display: "none" }}
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>

          {files.length > 0 && (
            <div className="files">
              {files.map((f) => (
                <div key={f.name} className="file-row">
                  <span className={`file-type ${isVideoFile(f) ? "file-type-video" : ""}`}>
                    {isVideoFile(f) ? "VIDEO" : "AUDIO"}
                  </span>
                  <span className="file-row-name">{f.name}</span>
                  <button className="file-remove" onClick={() => setFiles((prev) => prev.filter((x) => x.name !== f.name))}>×</button>
                </div>
              ))}
            </div>
          )}

          {isCloning && cloneProgress > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${cloneProgress}%` }} />
              </div>
              <p className="progress-label">{cloneStep}</p>
            </div>
          )}

          <button className="btn" onClick={handleClone} disabled={isCloning || files.length === 0}>
            {isCloning ? <><div className="spin" /> {cloneStep || "Processing…"}</> : "Clone voice"}
          </button>

          {cloneError && <p className="err">{cloneError}</p>}
        </div>
      </div>
    </>
  );
}
