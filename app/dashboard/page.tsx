"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

type Section = "overview" | "uploads" | "create" | "video" | "brand" | "projects" | "plan" | "aimanager" | "analytics" | "billing" | "settings";

interface User { id: string; name: string; email: string; subscription_tier: string; created_at: string; elevenlabs_voice_id?: string; }
interface Upload { id: string; file_type: string; file_name: string; mime_type: string; file_size: number; analysis_status: string; created_at: string; }
interface Project { id: string; title: string; project_type: string; target_platform: string; status: string; created_at: string; updated_at: string; }
interface BrandProfile { user_id: string; tone_summary: string; personality_summary: string; audience_summary: string; pacing_style: string; cta_style: string; confidence_score: number; learning_progress_percent: number; upload_count: number; generation_count: number; }

const NAV: { id: Section; icon: string; label: string; group?: string; elite?: boolean }[] = [
  { id: "overview", icon: "⌂", label: "Overview" },
  { id: "uploads", icon: "↑", label: "Uploads", group: "Create" },
  { id: "create", icon: "✦", label: "Create Content", group: "Create" },
  { id: "video", icon: "▶", label: "New Project", group: "Create" },
  { id: "brand", icon: "◉", label: "Brand Profile", group: "Learn" },
  { id: "projects", icon: "◻", label: "Projects", group: "Learn" },
  { id: "plan", icon: "◆", label: "Content Plan", group: "Learn" },
  { id: "aimanager", icon: "✧", label: "AI Manager", group: "Learn", elite: true },
  { id: "analytics", icon: "▲", label: "Analytics", group: "Learn" },
  { id: "billing", icon: "◈", label: "Billing", group: "Account" },
  { id: "settings", icon: "⚙", label: "Settings", group: "Account" },
];

const TIER_LABELS: Record<string, string> = { free: "Free", creator: "Creator", pro: "Pro", elite: "Elite" };
const TYPE_LABELS: Record<string, string> = { caption: "Caption", hook: "Hook", post: "Post", script: "Script", video: "Video", ideas: "Ideas" };
const PLATFORM_LABELS: Record<string, string> = { tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube", general: "General" };
const STATUS_COLORS: Record<string, string> = { draft: "#b5b09a", queued: "#7c7660", analyzing: "#FF8C00", scripting: "#FF8C00", completed: "#2da44e", failed: "#FF2D2D" };

function fmt(bytes: number) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1048576) return `${(bytes/1024).toFixed(1)} KB`; return `${(bytes/1048576).toFixed(1)} MB`; }
function fmtDate(d: string) {
  const dt = new Date(d);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[dt.getUTCMonth()]} ${dt.getUTCDate()}, ${dt.getUTCFullYear()}`;
}

// ── OVERVIEW ──────────────────────────────────────────────────────────────────
function Overview({ user, uploads, projects, brand, onNav }: {
  user: User; uploads: Upload[]; projects: Project[]; brand: BrandProfile | null; onNav: (s: Section) => void;
}) {
  const prog = brand?.learning_progress_percent ?? 0;
  const completed = projects.filter(p => p.status === "completed").length;
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  return (
    <div>
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 10 }}>Dashboard</div>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 6 }}>
          Hey, {user.name.split(" ")[0]}
        </h2>
        <p style={{ fontSize: 15, color: "#7c7660" }}>Your AI content system is {prog < 20 ? "warming up" : prog < 60 ? "learning" : "trained and ready"}.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(155px,1fr))", gap: 12, marginBottom: 44 }}>
        {[
          { num: uploads.length, label: "Uploads", red: false },
          { num: projects.length, label: "Projects", red: false },
          { num: completed, label: "Completed", red: true },
          { num: `${prog}%`, label: "AI Trained", red: true },
        ].map(s => (
          <div key={s.label} style={{ background: "#fff", borderRadius: 16, padding: "20px 22px", border: "1px solid rgba(0,0,0,0.07)" }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 34, fontWeight: 800, color: s.red ? "#FF2D2D" : "#1a1a1a", lineHeight: 1 }}>{s.num}</div>
            <div style={{ fontSize: 12, color: "#7c7660", marginTop: 6 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", borderRadius: 16, padding: "24px 28px", border: "1px solid rgba(0,0,0,0.07)", marginBottom: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#7c7660", marginBottom: 6 }}>Brand Learning Progress</div>
            <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 40, color: "#FF2D2D", lineHeight: 1 }}>{prog}%</div>
          </div>
          <div style={{ textAlign: "right", fontSize: 13, color: "#7c7660", maxWidth: 220 }}>
            {prog < 20 ? "Upload your first content to start training." :
             prog < 50 ? "Good start — keep uploading to sharpen your profile." :
             prog < 80 ? "Strong foundation — your style is emerging." :
             "Well-trained — Lumevo knows your brand."}
          </div>
        </div>
        <div style={{ height: 8, background: "#F8F8A6", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${prog}%`, background: "#FF2D2D", borderRadius: 999, transition: "width 0.6s ease" }} />
        </div>
      </div>

      <button onClick={() => onNav("video")}
        style={{ width: "100%", background: "#FF2D2D", border: "none", borderRadius: 16, padding: "18px 24px", cursor: "pointer", fontFamily: "inherit", fontSize: 16, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 44, transition: "opacity 0.2s" }}
        onMouseOver={e => (e.currentTarget.style.opacity = "0.88")}
        onMouseOut={e => (e.currentTarget.style.opacity = "1")}>
        <span>Create Content</span>
        <span style={{ fontSize: 20 }}>→</span>
      </button>

      {projects.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700 }}>Recent Projects</div>
            <button onClick={() => onNav("projects")} style={{ background: "none", border: "none", fontSize: 13, fontWeight: 600, color: "#FF2D2D", cursor: "pointer", fontFamily: "inherit" }}>View all →</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {projects.slice(0, 4).map(p => (
              <div key={p.id} style={{ position: "relative" }}>
                <div
                  onClick={() => onNav("projects")}
                  style={{ background: "#fff", borderRadius: 12, padding: "14px 18px", border: "1px solid rgba(0,0,0,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", transition: "box-shadow 0.15s" }}
                  onMouseOver={e => (e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)")}
                  onMouseOut={e => (e.currentTarget.style.boxShadow = "none")}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>{p.title}</div>
                    <div style={{ fontSize: 12, color: "#7c7660" }}>{TYPE_LABELS[p.project_type]} · {PLATFORM_LABELS[p.target_platform]}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: `${STATUS_COLORS[p.status]}20`, color: STATUS_COLORS[p.status] }}>
                      {p.status}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === p.id ? null : p.id); }}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#7c7660", padding: "0 4px", lineHeight: 1 }}>
                      ···
                    </button>
                  </div>
                </div>
                {menuOpen === p.id && (
                  <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", background: "#fff", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", border: "1px solid rgba(0,0,0,0.08)", zIndex: 50, minWidth: 180, overflow: "hidden" }}>
                    {[
                      { label: "Open project", icon: "↗", action: () => { onNav("projects"); setMenuOpen(null); } },
                      { label: "Use as template", icon: "◻", action: () => { onNav("video"); setMenuOpen(null); } },
                      { label: "Edit details", icon: "✎", action: () => { onNav("projects"); setMenuOpen(null); } },
                    ].map(item => (
                      <button key={item.label} onClick={item.action}
                        style={{ width: "100%", background: "none", border: "none", padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 14, color: "#1a1a1a", textAlign: "left" }}
                        onMouseOver={e => (e.currentTarget.style.background = "#F8F8A6")}
                        onMouseOut={e => (e.currentTarget.style.background = "none")}>
                        <span style={{ fontSize: 13, color: "#FF2D2D" }}>{item.icon}</span>
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── UPLOADS ───────────────────────────────────────────────────────────────────
function UploadsSection({ uploads, onRefresh }: { uploads: Upload[]; onRefresh: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [textType, setTextType] = useState("caption");
  const [activeTab, setActiveTab] = useState<"file" | "text">("file");
  const [generated, setGenerated] = useState("");
  const [savedToast, setSavedToast] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const fileData = ev.target?.result as string;
      const type = file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") ? "image" : file.type.startsWith("audio/") ? "audio" : "text";
      await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_name: file.name, file_type: type, mime_type: file.type, file_size: file.size, file_data: fileData.slice(0, 5000) }),
      });
      setUploading(false);
      onRefresh();
      if (fileRef.current) fileRef.current.value = "";
    };
    reader.readAsDataURL(file);
  }

  async function handleGenerate() {
    if (!textInput.trim()) return;
    setGenerating(true);
    setGenerated("");
    const res = await fetch("/api/generate/quick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: textInput, contentType: textType }),
    });
    const data = await res.json();
    setGenerated(data.generated || "");
    setGenerating(false);
  }

  async function handleSave(content: string) {
    if (!content.trim()) return;
    setUploading(true);
    await fetch("/api/uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_name: `${textType}-${Date.now()}.txt`, file_type: textType, mime_type: "text/plain", file_size: content.length, file_data: content }),
    });
    setTextInput("");
    setGenerated("");
    setUploading(false);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
    onRefresh();
  }

  const TYPE_ICON: Record<string, string> = { video: "▶", image: "◻", audio: "◉", caption: "✦", script: "≡", text: "T" };

  const placeholders: Record<string, string> = {
    caption: "Write me a caption for a morning routine video… or paste one that already sounds like you.",
    script: "Write me a 30-second day in the life voiceover script… or paste a script you've used before.",
    text: "Describe what you want, or paste any text that reflects your voice…",
  };

  return (
    <div>
      {savedToast && (
        <div style={{ position: "fixed", top: 24, right: 24, background: "#111", color: "#fff", padding: "12px 20px", borderRadius: 12, fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
          Saved to library
        </div>
      )}
      <div style={{ marginBottom: 36 }}>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 6 }}>Uploads</h2>
        <p style={{ fontSize: 15, color: "#7c7660" }}>Every upload teaches Lumevo your style. Upload videos, images, captions, or scripts.</p>
      </div>

      <div style={{ background: "#fff", borderRadius: 20, padding: 28, border: "1px solid rgba(0,0,0,0.07)", marginBottom: 28 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {(["file", "text"] as const).map(t => (
            <button key={t} onClick={() => { setActiveTab(t); setGenerated(""); }}
              style={{ padding: "8px 20px", borderRadius: 999, border: "none", fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer", background: activeTab === t ? "#FF2D2D" : "transparent", color: activeTab === t ? "#fff" : "#7c7660" }}>
              {t === "file" ? "Upload File" : "Add Text / Caption"}
            </button>
          ))}
        </div>

        {activeTab === "file" ? (
          <div onClick={() => fileRef.current?.click()}
            style={{ border: "2px dashed rgba(255,45,45,0.25)", borderRadius: 14, padding: "40px 24px", textAlign: "center", cursor: "pointer", transition: "all 0.2s" }}>
            <input ref={fileRef} type="file" style={{ display: "none" }} onChange={handleFile} accept="video/*,image/*,audio/*,.txt,.pdf" />
            <div style={{ fontSize: 32, marginBottom: 12 }}>↑</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{uploading ? "Uploading…" : "Click to upload a file"}</div>
            <div style={{ fontSize: 13, color: "#7c7660" }}>Video, image, audio, text — anything that shows Lumevo your style</div>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {["caption", "script", "text"].map(t => (
                <button key={t} onClick={() => { setTextType(t); setGenerated(""); }}
                  style={{ padding: "6px 16px", borderRadius: 999, border: `1.5px solid ${textType === t ? "#FF2D2D" : "rgba(0,0,0,0.1)"}`, fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer", background: textType === t ? "rgba(255,45,45,0.07)" : "transparent", color: textType === t ? "#FF2D2D" : "#7c7660" }}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            <textarea
              value={textInput}
              onChange={e => { setTextInput(e.target.value); if (generated) setGenerated(""); }}
              placeholder={placeholders[textType]}
              style={{ width: "100%", minHeight: 110, padding: "14px 16px", borderRadius: 12, border: "1.5px solid rgba(0,0,0,0.1)", fontFamily: "inherit", fontSize: 14, resize: "vertical", outline: "none", background: "#fafaf4", boxSizing: "border-box", lineHeight: 1.6 }}
            />

            <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={handleGenerate} disabled={generating || !textInput.trim()}
                style={{ background: "#111", color: "#fff", border: "none", borderRadius: 999, padding: "11px 22px", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: generating || !textInput.trim() ? "not-allowed" : "pointer", opacity: !textInput.trim() ? 0.4 : 1, display: "flex", alignItems: "center", gap: 8 }}>
                {generating ? (
                  <>
                    <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    Generating…
                  </>
                ) : "✦ Generate with AI"}
              </button>
              <button onClick={() => handleSave(textInput)} disabled={uploading || !textInput.trim()}
                style={{ background: "transparent", color: "#7c7660", border: "1.5px solid rgba(0,0,0,0.12)", borderRadius: 999, padding: "10px 20px", fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: !textInput.trim() ? 0.4 : 1 }}>
                {uploading ? "Saving…" : "Save as-is"}
              </button>
            </div>

            {generated && (
              <div style={{ marginTop: 20, background: "#fafaf4", border: "1.5px solid rgba(255,45,45,0.2)", borderRadius: 16, padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#FF2D2D" }}>✦ Generated {textType}</span>
                  <button onClick={() => setGenerated("")} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#bbb", lineHeight: 1 }}>×</button>
                </div>
                <textarea
                  value={generated}
                  onChange={e => setGenerated(e.target.value)}
                  style={{ width: "100%", minHeight: 140, padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.08)", fontFamily: "inherit", fontSize: 14, resize: "vertical", outline: "none", background: "#fff", boxSizing: "border-box", lineHeight: 1.7 }}
                />
                <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                  <button onClick={() => handleSave(generated)} disabled={uploading}
                    style={{ background: "#FF2D2D", color: "#fff", border: "none", borderRadius: 999, padding: "11px 24px", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                    {uploading ? "Saving…" : "Save to Library"}
                  </button>
                  <button onClick={handleGenerate} disabled={generating}
                    style={{ background: "transparent", color: "#7c7660", border: "1.5px solid rgba(0,0,0,0.12)", borderRadius: 999, padding: "10px 20px", fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    Regenerate
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {uploads.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Your Library ({uploads.length})</div>
          {uploads.map(u => (
            <div key={u.id} style={{ background: "#fff", borderRadius: 14, padding: "14px 18px", border: "1px solid rgba(0,0,0,0.07)", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "#F8F8A6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#FF2D2D", flexShrink: 0 }}>
                {TYPE_ICON[u.file_type] || "◻"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.file_name}</div>
                <div style={{ fontSize: 12, color: "#7c7660" }}>{u.file_type} · {u.file_size > 0 ? fmt(u.file_size) : "text"} · {fmtDate(u.created_at)}</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: u.analysis_status === "complete" ? "#2da44e20" : "#F8F8A6", color: u.analysis_status === "complete" ? "#2da44e" : "#7c7660" }}>
                {u.analysis_status === "complete" ? "Analyzed" : "Processing"}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#7c7660" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>↑</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No uploads yet</div>
          <div style={{ fontSize: 14 }}>Add your first file or caption to start training Lumevo.</div>
        </div>
      )}
    </div>
  );
}

// ── CREATE CONTENT ────────────────────────────────────────────────────────────
function CreateContent({ brand }: { brand: BrandProfile | null }) {
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [contentType, setContentType] = useState("caption");
  const [platform, setPlatform] = useState("instagram");
  const [styleStrength, setStyleStrength] = useState(80);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setLoading(true);
    setResult("");
    try {
      const projRes = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title || prompt.slice(0, 60), project_type: contentType, target_platform: platform, prompt_text: prompt }),
      });
      const projData = await projRes.json();
      if (!projRes.ok) { setResult("Error creating project."); setLoading(false); return; }

      const genRes = await fetch(`/api/projects/${projData.project.id}/generate-content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content_type: contentType, platform, style_strength: styleStrength }),
      });
      const genData = await genRes.json();
      if (!genRes.ok) { setResult("Generation failed. Try again."); } else { setResult(genData.content.generated_text); }
    } catch { setResult("Something went wrong."); }
    finally { setLoading(false); }
  }

  function copy() {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <div style={{ marginBottom: 36 }}>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 6 }}>Create Content</h2>
        <p style={{ fontSize: 15, color: "#7c7660" }}>Generate captions, hooks, scripts, and posts — in your voice.</p>
      </div>

      {brand && brand.tone_summary && (
        <div style={{ background: "#F8F8A6", borderRadius: 14, padding: "14px 18px", marginBottom: 24, border: "1px solid rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#7c7660", marginBottom: 6 }}>Your Brand Voice</div>
          <div style={{ fontSize: 14, color: "#1a1a1a" }}>{brand.tone_summary} · {brand.personality_summary}</div>
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 20, padding: 28, border: "1px solid rgba(0,0,0,0.07)", marginBottom: 24 }}>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#7c7660", letterSpacing: 0.5, display: "block", marginBottom: 8 }}>Content Type</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["caption", "hook", "script", "post", "ideas"].map(t => (
              <button key={t} onClick={() => setContentType(t)}
                style={{ padding: "7px 16px", borderRadius: 999, border: `1.5px solid ${contentType === t ? "#FF2D2D" : "rgba(0,0,0,0.1)"}`, fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer", background: contentType === t ? "rgba(255,45,45,0.07)" : "transparent", color: contentType === t ? "#FF2D2D" : "#7c7660" }}>
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#7c7660", letterSpacing: 0.5, display: "block", marginBottom: 8 }}>Platform</label>
            <select value={platform} onChange={e => setPlatform(e.target.value)}
              style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid rgba(0,0,0,0.1)", fontFamily: "inherit", fontSize: 14, background: "#fafaf4", outline: "none" }}>
              {Object.entries(PLATFORM_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#7c7660", letterSpacing: 0.5, display: "block", marginBottom: 8 }}>Style Strength: {styleStrength}%</label>
            <input type="range" min={0} max={100} value={styleStrength} onChange={e => setStyleStrength(Number(e.target.value))}
              style={{ width: "100%", accentColor: "#FF2D2D" }} />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#7c7660", letterSpacing: 0.5, display: "block", marginBottom: 8 }}>Topic / Prompt</label>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
            placeholder="What is this content about? Be as specific as you want…"
            style={{ width: "100%", minHeight: 100, padding: "13px 16px", borderRadius: 12, border: "1.5px solid rgba(0,0,0,0.1)", fontFamily: "inherit", fontSize: 14, resize: "vertical", outline: "none", background: "#fafaf4", boxSizing: "border-box" }} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#7c7660", letterSpacing: 0.5, display: "block", marginBottom: 8 }}>Project Title (optional)</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Give this project a name…"
            style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid rgba(0,0,0,0.1)", fontFamily: "inherit", fontSize: 14, background: "#fafaf4", outline: "none", boxSizing: "border-box" }} />
        </div>

        <button onClick={handleGenerate} disabled={loading || !prompt.trim()}
          style={{ background: "#FF2D2D", color: "#fff", border: "none", borderRadius: 999, padding: "13px 32px", fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: loading || !prompt.trim() ? "not-allowed" : "pointer", opacity: !prompt.trim() ? 0.5 : 1 }}>
          {loading ? "Generating…" : `Generate ${TYPE_LABELS[contentType]}`}
        </button>
      </div>

      {result && (
        <div style={{ background: "#fff", borderRadius: 20, padding: 28, border: "1px solid rgba(0,0,0,0.07)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#7c7660", letterSpacing: 1, textTransform: "uppercase" }}>Generated {TYPE_LABELS[contentType]}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={copy}
                style={{ background: copied ? "#2da44e" : "#F8F8A6", color: copied ? "#fff" : "#1a1a1a", border: "none", borderRadius: 999, padding: "7px 16px", fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                {copied ? "Copied!" : "Copy"}
              </button>
              <button onClick={handleGenerate}
                style={{ background: "transparent", color: "#FF2D2D", border: "1.5px solid rgba(255,45,45,0.3)", borderRadius: 999, padding: "7px 16px", fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Regenerate
              </button>
            </div>
          </div>
          <div style={{ fontSize: 15, lineHeight: 1.75, whiteSpace: "pre-wrap", color: "#1a1a1a" }}>{result}</div>
        </div>
      )}
    </div>
  );
}

// ── NEW PROJECT (AGENTIC) ─────────────────────────────────────────────────────
interface ChatMessage { role: "ai" | "user"; content: string; id: number; }
interface ProjectState {
  title: string | null; platforms: string[] | null;
  mediaType: "voiceover" | "music" | "both" | null;
  vibe: string | null; duration: number | null;
}

function CreateVideo({ uploads, user }: { uploads: Upload[]; user: User }) {
  const firstName = user.name.split(" ")[0];
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "ai", content: `What are we creating today, ${firstName}? Tell me anything — a trip, a moment, a vibe, a product. I'll figure out the rest.`, id: 0 }
  ]);
  const [projectState, setProjectState] = useState<ProjectState>({ title: null, platforms: null, mediaType: null, vibe: null, duration: null });
  const [phase, setPhase] = useState<"chat" | "generating" | "done">("chat");
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [needsUpload, setNeedsUpload] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [msgCounter, setMsgCounter] = useState(1);
  const [stepIdx, setStepIdx] = useState(0);
  const [result, setResult] = useState<{ script: string; audioBase64: string | null; projectId: string; hasVoice: boolean; caption?: string } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [localUploads, setLocalUploads] = useState<Upload[]>(uploads);

  useEffect(() => { setLocalUploads(uploads); }, [uploads]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isTyping]);

  const media = localUploads.filter(u => u.file_type === "video" || u.file_type === "image" || u.file_type === "audio");
  const MEDIA_ICON: Record<string, string> = { video: "▶", image: "◻", audio: "◉" };
  const STEPS = [
    "Reading your media",
    "Writing your script",
    "Cloning your voice",
    "Assembling your video",
  ];

  async function sendMessage(text?: string) {
    const content = text ?? input.trim();
    if (!content) return;
    const newId = msgCounter;
    setMsgCounter(c => c + 1);
    const userMsg: ChatMessage = { role: "user", content, id: newId };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setIsTyping(true);

    const conversationForApi = updated.map(m => ({ role: m.role === "ai" ? "assistant" : "user", content: m.content }));

    try {
      const res = await fetch("/api/project/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: conversationForApi, projectState, userName: firstName }),
      });
      const data = await res.json();

      const newState = { ...projectState };
      if (data.extracted) {
        if (data.extracted.title) newState.title = data.extracted.title;
        if (data.extracted.platforms) newState.platforms = data.extracted.platforms;
        if (data.extracted.mediaType) newState.mediaType = data.extracted.mediaType;
        if (data.extracted.vibe) newState.vibe = data.extracted.vibe;
        if (data.extracted.duration) newState.duration = data.extracted.duration;
      }
      setProjectState(newState);
      if (data.needsUpload) setNeedsUpload(true);

      setIsTyping(false);
      const aiId = msgCounter + 1;
      setMsgCounter(c => c + 2);
      setMessages(prev => [...prev, { role: "ai", content: data.message, id: aiId }]);

      if (data.readyToCreate && newState.title) {
        setTimeout(() => startGeneration(newState, selectedIds), 800);
      }
    } catch {
      setIsTyping(false);
      setMessages(prev => [...prev, { role: "ai", content: "Sorry, I hit a snag. Try saying that again.", id: msgCounter + 1 }]);
    }
  }

  async function startGeneration(state: ProjectState, uploadIds: string[]) {
    setPhase("generating");
    setStepIdx(0);
    const timers = STEPS.map((_, i) => setTimeout(() => setStepIdx(i), i * 2000));

    const res = await fetch("/api/video/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: state.title,
        uploadIds,
        platform: state.platforms?.[0] || "tiktok",
        duration: state.duration || 30,
        vibe: state.vibe,
        mediaType: state.mediaType,
      }),
    });
    timers.forEach(clearTimeout);
    const data = await res.json();
    setStepIdx(STEPS.length);
    await new Promise(r => setTimeout(r, 600));
    setResult(data);
    setPhase("done");
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const fileData = ev.target?.result as string;
      const type = file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") ? "image" : file.type.startsWith("audio/") ? "audio" : "text";
      const res = await fetch("/api/uploads", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_name: file.name, file_type: type, mime_type: file.type, file_size: file.size, file_data: fileData.slice(0, 5000) }),
      });
      const newUpload = await res.json();
      if (newUpload?.upload) {
        setLocalUploads(prev => [newUpload.upload, ...prev]);
        setSelectedIds(prev => [newUpload.upload.id, ...prev]);
      }
      setUploadingFile(false);
      if (fileRef.current) fileRef.current.value = "";
    };
    reader.readAsDataURL(file);
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function handleConfirmUploads() {
    const count = selectedIds.length;
    const msg = count > 0
      ? `I've selected ${count} file${count > 1 ? "s" : ""} — ready to go!`
      : "I don't have media to add right now, just use my brand voice.";
    setNeedsUpload(false);
    sendMessage(msg);
  }

  function handleReset() {
    setPhase("chat");
    setResult(null);
    setMessages([{ role: "ai", content: `What are we creating today, ${firstName}? Tell me anything — a trip, a moment, a vibe, a product. I'll figure out the rest.`, id: 0 }]);
    setProjectState({ title: null, platforms: null, mediaType: null, vibe: null, duration: null });
    setSelectedIds([]);
    setNeedsUpload(false);
    setStepIdx(0);
    setInput("");
  }

  const quickReplies: string[] = !projectState.platforms
    ? ["Instagram", "TikTok", "Both — Instagram & TikTok"]
    : !projectState.mediaType
    ? ["Voiceover", "Background music", "Both"]
    : !projectState.duration
    ? ["15 seconds", "30 seconds", "60 seconds"]
    : [];

  if (phase === "generating") {
    return (
      <div style={{ paddingTop: 20 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 22, color: "#FF2D2D", marginBottom: 8 }}>LUMEVO</div>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 800, marginBottom: 8 }}>Creating your {projectState.title || "video"}...</h2>
          <p style={{ fontSize: 15, color: "#7c7660" }}>Sit tight — this is where the magic happens.</p>
        </div>
        <div style={{ background: "#fff", borderRadius: 24, padding: "36px 32px", border: "1px solid rgba(0,0,0,0.07)", maxWidth: 480, margin: "0 auto" }}>
          {STEPS.map((step, i) => {
            const done = i < stepIdx;
            const active = i === stepIdx;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 0", borderBottom: i < STEPS.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none", opacity: i > stepIdx ? 0.3 : 1, transition: "opacity 0.5s" }}>
                <div style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0, background: done ? "#FF2D2D" : active ? "rgba(255,45,45,0.1)" : "#F8F8A6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: done ? "#fff" : active ? "#FF2D2D" : "#b5b09a", transition: "all 0.4s" }}>
                  {done ? "✓" : active ? <span style={{ display: "inline-block", width: 15, height: 15, border: "2.5px solid rgba(255,45,45,0.25)", borderTopColor: "#FF2D2D", borderRadius: "50%", animation: "spin 0.75s linear infinite" }} /> : i + 1}
                </div>
                <span style={{ fontSize: 15, fontWeight: done || active ? 700 : 400, color: active ? "#FF2D2D" : done ? "#1a1a1a" : "#b5b09a" }}>{step}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (phase === "done" && result) {
    const platforms = projectState.platforms?.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" + ") || "Video";
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 6 }}>✦ Ready to post</div>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 4 }}>{projectState.title}</h2>
            <p style={{ fontSize: 14, color: "#7c7660" }}>{platforms} · {projectState.duration || 30}s {projectState.mediaType === "both" ? "· Voice + Music" : projectState.mediaType === "voiceover" ? "· Voice" : "· Music"}</p>
          </div>
          <button onClick={handleReset} style={{ background: "#111", color: "#fff", border: "none", borderRadius: 999, padding: "10px 18px", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            + New Project
          </button>
        </div>

        {result.audioBase64 && (
          <div style={{ background: "#fff", borderRadius: 20, padding: 24, border: "1px solid rgba(0,0,0,0.07)", marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 12 }}>🎙 Your Voice Narration</div>
            <audio controls style={{ width: "100%", borderRadius: 8 }} src={`data:audio/mpeg;base64,${result.audioBase64}`} />
          </div>
        )}

        <div style={{ background: "#fff", borderRadius: 20, padding: 24, border: "1px solid rgba(0,0,0,0.07)", marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#7c7660", marginBottom: 12 }}>📋 Caption</div>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "#1a1a1a", fontStyle: "italic" }}>
            &quot;{projectState.vibe ? `${projectState.title} — ${projectState.vibe.slice(0, 80)}` : projectState.title}&quot;
          </p>
        </div>

        <div style={{ background: "#fff", borderRadius: 20, padding: 24, border: "1px solid rgba(0,0,0,0.07)", marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#7c7660", marginBottom: 12 }}>🎬 Voiceover Script</div>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: "#1a1a1a", whiteSpace: "pre-wrap" }}>{result.script}</p>
        </div>

        {!result.hasVoice && (
          <div style={{ background: "#F8F8A6", borderRadius: 16, padding: "18px 22px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Want to hear yourself narrate this?</div>
            <div style={{ fontSize: 13, color: "#7c7660" }}>Add your ElevenLabs Voice ID in Settings and Lumevo will narrate every video in your actual voice.</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 4 }}>New Project</h2>
        <p style={{ fontSize: 14, color: "#7c7660" }}>Tell your AI creative director what you&apos;re making. It handles everything else.</p>
      </div>

      <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden", marginBottom: 16 }}>
        <div style={{ maxHeight: 420, overflowY: "auto", padding: "24px 20px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
          {messages.map(msg => (
            <div key={msg.id} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", gap: 10 }}>
              {msg.role === "ai" && (
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 12, fontFamily: "'Fredoka One', cursive", color: "#FF2D2D", marginTop: 2 }}>L</div>
              )}
              <div style={{ maxWidth: "80%", padding: "12px 16px", borderRadius: msg.role === "ai" ? "4px 18px 18px 18px" : "18px 18px 4px 18px", background: msg.role === "ai" ? "#fafaf4" : "#FF2D2D", color: msg.role === "ai" ? "#1a1a1a" : "#fff", fontSize: 14, lineHeight: 1.6, fontWeight: msg.role === "ai" ? 400 : 500 }}>
                {msg.content}
              </div>
            </div>
          ))}

          {isTyping && (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 12, fontFamily: "'Fredoka One', cursive", color: "#FF2D2D" }}>L</div>
              <div style={{ padding: "14px 18px", borderRadius: "4px 18px 18px 18px", background: "#fafaf4", display: "flex", gap: 4, alignItems: "center" }}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#b5b09a", display: "inline-block", animation: `bounce 1.2s ease-in-out ${i * 0.15}s infinite` }} />
                ))}
              </div>
            </div>
          )}

          {needsUpload && !isTyping && (
            <div style={{ marginTop: 8, background: "#fafaf4", borderRadius: 16, padding: 18, border: "1.5px solid rgba(255,45,45,0.15)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: "#1a1a1a" }}>
                Select your media for this video
                {selectedIds.length > 0 && <span style={{ marginLeft: 8, fontSize: 11, background: "#F8F8A6", padding: "2px 10px", borderRadius: 999 }}>{selectedIds.length} selected</span>}
              </div>

              {media.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto", marginBottom: 12 }}>
                  {media.map(u => {
                    const sel = selectedIds.includes(u.id);
                    return (
                      <div key={u.id} onClick={() => toggleSelect(u.id)}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${sel ? "#FF2D2D" : "rgba(0,0,0,0.07)"}`, cursor: "pointer", background: sel ? "rgba(255,45,45,0.04)" : "#fff", transition: "all 0.15s" }}>
                        <div style={{ width: 30, height: 30, borderRadius: 7, background: sel ? "#FF2D2D" : "#F8F8A6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: sel ? "#fff" : "#FF2D2D", flexShrink: 0 }}>
                          {sel ? "✓" : MEDIA_ICON[u.file_type] || "◻"}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.file_name}</div>
                          <div style={{ fontSize: 11, color: "#7c7660" }}>{u.file_type} · {(u.file_size / 1024 / 1024).toFixed(1)} MB</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "#b5b09a", marginBottom: 10 }}>No media in your library yet — upload below.</div>
              )}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => fileRef.current?.click()} disabled={uploadingFile}
                  style={{ background: "#111", color: "#fff", border: "none", borderRadius: 999, padding: "9px 16px", fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  {uploadingFile ? "Uploading…" : "↑ Upload new"}
                </button>
                <input ref={fileRef} type="file" style={{ display: "none" }} onChange={handleFileUpload} accept="video/*,image/*,audio/*" />
                <button onClick={handleConfirmUploads}
                  style={{ background: "#FF2D2D", color: "#fff", border: "none", borderRadius: 999, padding: "9px 18px", fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  {selectedIds.length > 0 ? `Continue with ${selectedIds.length} file${selectedIds.length > 1 ? "s" : ""}` : "Continue without media"}
                </button>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {quickReplies.length > 0 && !isTyping && !needsUpload && (
          <div style={{ padding: "8px 20px 12px", display: "flex", gap: 8, flexWrap: "wrap", borderTop: "1px solid rgba(0,0,0,0.04)" }}>
            {quickReplies.map(q => (
              <button key={q} onClick={() => sendMessage(q)}
                style={{ padding: "7px 14px", borderRadius: 999, border: "1.5px solid rgba(255,45,45,0.25)", background: "transparent", fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#FF2D2D", transition: "all 0.15s" }}>
                {q}
              </button>
            ))}
          </div>
        )}

        <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(0,0,0,0.06)", display: "flex", gap: 10, alignItems: "flex-end" }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Type anything…"
            disabled={isTyping || needsUpload}
            rows={1}
            style={{ flex: 1, padding: "11px 14px", borderRadius: 12, border: "1.5px solid rgba(0,0,0,0.1)", fontFamily: "inherit", fontSize: 14, resize: "none", outline: "none", background: "#fafaf4", lineHeight: 1.5, opacity: isTyping || needsUpload ? 0.5 : 1 }}
          />
          <button onClick={() => sendMessage()} disabled={!input.trim() || isTyping || needsUpload}
            style={{ width: 42, height: 42, borderRadius: 12, background: input.trim() && !isTyping ? "#FF2D2D" : "rgba(0,0,0,0.08)", border: "none", cursor: input.trim() && !isTyping ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: input.trim() && !isTyping ? "#fff" : "#b5b09a", transition: "all 0.15s", flexShrink: 0 }}>
            →
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ── BRAND PROFILE ─────────────────────────────────────────────────────────────
function BrandSection({ brand, onRefresh }: { brand: BrandProfile | null; onRefresh: () => void }) {
  const [refreshing, setRefreshing] = useState(false);
  const prog = brand?.learning_progress_percent ?? 0;

  async function handleRefresh() {
    setRefreshing(true);
    await fetch("/api/brand-profile/refresh", { method: "POST" });
    onRefresh();
    setRefreshing(false);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 36 }}>
        <div>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 6 }}>Brand Profile</h2>
          <p style={{ fontSize: 15, color: "#7c7660" }}>Your AI manager is learning you. Every upload sharpens this profile.</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          style={{ background: "transparent", border: "1.5px solid rgba(255,45,45,0.3)", color: "#FF2D2D", borderRadius: 999, padding: "9px 20px", fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          {refreshing ? "Refreshing…" : "Refresh Profile"}
        </button>
      </div>

      <div style={{ background: "#fff", borderRadius: 16, padding: 28, border: "1px solid rgba(0,0,0,0.07)", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 28, alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#7c7660", marginBottom: 8 }}>Learning Progress</div>
            <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 52, color: "#FF2D2D", lineHeight: 1 }}>{prog}%</div>
          </div>
          <div style={{ flex: 1, paddingTop: 8 }}>
            <div style={{ fontSize: 15, color: "#7c7660", lineHeight: 1.7, marginBottom: 12 }}>
              {prog < 20 ? "Just getting started — upload videos, captions, and scripts to begin training." :
               prog < 50 ? "Good foundation — keep uploading and generating to sharpen your voice." :
               prog < 80 ? "Strong profile — your style signals are becoming clear." :
               "Well-trained — Lumevo knows your brand deeply."}
            </div>
            <div style={{ height: 8, background: "#F8F8A6", borderRadius: 999 }}>
              <div style={{ height: "100%", width: `${prog}%`, background: "#FF2D2D", borderRadius: 999, transition: "width 0.6s ease" }} />
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ background: "#fafaf4", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#7c7660", marginBottom: 6 }}>Uploads</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800 }}>{brand?.upload_count ?? 0}</div>
          </div>
          <div style={{ background: "#fafaf4", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#7c7660", marginBottom: 6 }}>Generations</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800 }}>{brand?.generation_count ?? 0}</div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Brand Tone", value: brand?.tone_summary, empty: "Not analyzed yet" },
          { label: "Personality", value: brand?.personality_summary, empty: "Not analyzed yet" },
          { label: "Target Audience", value: brand?.audience_summary, empty: "Not analyzed yet" },
          { label: "Pacing Style", value: brand?.pacing_style, empty: "Not analyzed yet" },
          { label: "Signature CTA", value: brand?.cta_style, empty: "Not analyzed yet" },
          { label: "Confidence Score", value: brand?.confidence_score != null ? `${brand.confidence_score}%` : null, empty: "0%" },
        ].map(item => (
          <div key={item.label} style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", border: "1px solid rgba(0,0,0,0.07)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#7c7660", marginBottom: 8 }}>{item.label}</div>
            <div style={{ fontFamily: item.value ? "'Syne', sans-serif" : undefined, fontSize: item.value ? 16 : 14, fontWeight: item.value ? 700 : 400, color: item.value ? "#1a1a1a" : "#b5b09a" }}>
              {item.value || item.empty}
            </div>
          </div>
        ))}
      </div>

      {!brand?.tone_summary && (
        <div style={{ background: "#F8F8A6", borderRadius: 14, padding: "18px 20px", border: "1px solid rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Lumevo is waiting to learn you.</div>
          <div style={{ fontSize: 13, color: "#7c7660" }}>Upload a video, paste a caption, or generate your first piece of content to start building your brand profile.</div>
        </div>
      )}
    </div>
  );
}

// ── PROJECTS ──────────────────────────────────────────────────────────────────
function ProjectsSection({ projects, onNav }: { projects: Project[]; onNav: (s: Section) => void }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? projects : projects.filter(p => p.project_type === filter || p.target_platform === filter);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 36 }}>
        <div>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 6 }}>Projects</h2>
          <p style={{ fontSize: 15, color: "#7c7660" }}>Your full content history. Every piece of work Lumevo has created for you.</p>
        </div>
        <button onClick={() => onNav("create")}
          style={{ background: "#FF2D2D", color: "#fff", border: "none", borderRadius: 999, padding: "11px 22px", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          + New Project
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        {["all", "caption", "hook", "script", "video", "instagram", "tiktok", "youtube"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: "6px 16px", borderRadius: 999, border: `1.5px solid ${filter === f ? "#FF2D2D" : "rgba(0,0,0,0.1)"}`, fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer", background: filter === f ? "rgba(255,45,45,0.07)" : "transparent", color: filter === f ? "#FF2D2D" : "#7c7660", textTransform: "capitalize" }}>
            {f}
          </button>
        ))}
      </div>

      {filtered.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
          {filtered.map(p => (
            <div key={p.id} style={{ background: "#fff", borderRadius: 16, padding: "20px 20px", border: "1px solid rgba(0,0,0,0.07)", transition: "all 0.2s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 600, flex: 1, lineHeight: 1.4 }}>{p.title}</div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: `${STATUS_COLORS[p.status] || "#7c7660"}18`, color: STATUS_COLORS[p.status] || "#7c7660", flexShrink: 0, marginLeft: 8 }}>
                  {p.status}
                </span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: "#7c7660", background: "#F8F8A6", padding: "3px 10px", borderRadius: 999 }}>{TYPE_LABELS[p.project_type]}</span>
                <span style={{ fontSize: 11, color: "#7c7660", background: "#F8F8A6", padding: "3px 10px", borderRadius: 999 }}>{PLATFORM_LABELS[p.target_platform]}</span>
              </div>
              <div style={{ fontSize: 12, color: "#b5b09a" }}>{fmtDate(p.updated_at)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "80px 0", color: "#7c7660" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>◻</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No projects yet</div>
          <div style={{ fontSize: 14, marginBottom: 20 }}>Create your first piece of content to get started.</div>
          <button onClick={() => onNav("create")}
            style={{ background: "#FF2D2D", color: "#fff", border: "none", borderRadius: 999, padding: "11px 24px", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            Create Content
          </button>
        </div>
      )}
    </div>
  );
}

// ── ANALYTICS ─────────────────────────────────────────────────────────────────
function Analytics() {
  return (
    <div>
      <div style={{ marginBottom: 36 }}>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 6 }}>Analytics</h2>
        <p style={{ fontSize: 15, color: "#7c7660" }}>Track how your content performs and see what resonates with your audience.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 16 }}>
        {[
          { title: "Top Performing Content", desc: "Connect your TikTok or Instagram to see which posts performed best." },
          { title: "Content Type Performance", desc: "See which format (caption, hook, video) drives the most engagement." },
          { title: "Audience Signals", desc: "Understand who interacts with your content and when." },
          { title: "Future Recommendations", desc: "Lumevo will suggest what to post next based on your performance data." },
        ].map(card => (
          <div key={card.title} style={{ background: "#fff", borderRadius: 16, padding: "24px 22px", border: "1px solid rgba(0,0,0,0.07)" }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{card.title}</div>
            <div style={{ fontSize: 13, color: "#7c7660", lineHeight: 1.6, marginBottom: 16 }}>{card.desc}</div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#b5b09a" }}>Coming Soon</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── BILLING ───────────────────────────────────────────────────────────────────
function Billing({ user }: { user: User }) {
  const PLANS = [
    { id: "free", name: "Free", price: "$0", features: ["5 uploads/month", "10 AI generations", "Basic brand learning", "Captions & hooks"] },
    { id: "creator", name: "Creator", price: "$29", features: ["50 uploads/month", "100 AI generations", "Full brand learning", "All content types", "Weekly content ideas"] },
    { id: "pro", name: "Pro", price: "$79", features: ["Unlimited uploads", "Unlimited generations", "Full personality profile", "Multi-platform content", "Advanced project history"] },
    { id: "elite", name: "Elite", price: "$149", features: ["Everything in Pro", "AI Video Creation", "ElevenLabs voiceover", "Advanced creative briefs", "Priority support"] },
  ];

  return (
    <div>
      <div style={{ marginBottom: 36 }}>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 6 }}>Billing</h2>
        <p style={{ fontSize: 15, color: "#7c7660" }}>You are on the <strong>{TIER_LABELS[user.subscription_tier]}</strong> plan. Upgrade to unlock more.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 14 }}>
        {PLANS.map(plan => {
          const current = plan.id === user.subscription_tier;
          return (
            <div key={plan.id} style={{ background: current ? "#1a1a1a" : "#fff", borderRadius: 20, padding: "24px 22px", border: `2px solid ${current ? "#FF2D2D" : "rgba(0,0,0,0.07)"}` }}>
              <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 22, color: current ? "#FF2D2D" : "#FF2D2D", marginBottom: 4 }}>{plan.name}</div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 800, color: current ? "#fff" : "#1a1a1a", marginBottom: 16 }}>{plan.price}<span style={{ fontSize: 14, fontWeight: 400, color: current ? "rgba(255,255,255,0.5)" : "#7c7660" }}>/mo</span></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: current ? "rgba(255,255,255,0.8)" : "#7c7660" }}>
                    <span style={{ color: "#FF2D2D", flexShrink: 0 }}>✓</span>{f}
                  </div>
                ))}
              </div>
              {current ? (
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>Current Plan</div>
              ) : (
                <button style={{ width: "100%", background: "#FF2D2D", color: "#fff", border: "none", borderRadius: 999, padding: "11px 0", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                  Upgrade to {plan.name}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── SETTINGS ──────────────────────────────────────────────────────────────────
function Settings({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [voiceId, setVoiceId] = useState(user.elevenlabs_voice_id || "");
  const [savingVoice, setSavingVoice] = useState(false);
  const [voiceSaved, setVoiceSaved] = useState(false);

  async function saveVoiceId() {
    setSavingVoice(true);
    await fetch("/api/settings/voice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voiceId: voiceId.trim() }) });
    setSavingVoice(false);
    setVoiceSaved(true);
    setTimeout(() => setVoiceSaved(false), 2500);
  }

  return (
    <div>
      <div style={{ marginBottom: 36 }}>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 6 }}>Settings</h2>
        <p style={{ fontSize: 15, color: "#7c7660" }}>Manage your account and preferences.</p>
      </div>

      <div style={{ background: "#fff", borderRadius: 20, padding: 28, border: "1px solid rgba(0,0,0,0.07)", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#7c7660", marginBottom: 18 }}>Account</div>
        {[["Name", user.name], ["Email", user.email], ["Plan", TIER_LABELS[user.subscription_tier]], ["Member since", fmtDate(user.created_at)]].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
            <span style={{ fontSize: 14, color: "#7c7660" }}>{k}</span>
            <span style={{ fontSize: 14, fontWeight: 500 }}>{v}</span>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", borderRadius: 20, padding: 28, border: "1px solid rgba(0,0,0,0.07)", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#7c7660" }}>🎙 Voice Clone</div>
          {user.elevenlabs_voice_id && <span style={{ fontSize: 11, fontWeight: 700, background: "#F8F8A6", padding: "3px 10px", borderRadius: 999, color: "#7c7660" }}>Connected</span>}
        </div>
        <p style={{ fontSize: 13, color: "#7c7660", marginBottom: 16, lineHeight: 1.6 }}>
          Paste your ElevenLabs Voice ID to let Lumevo narrate every video in your actual voice. Find it in your ElevenLabs dashboard under Voice Lab.
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            value={voiceId}
            onChange={e => setVoiceId(e.target.value)}
            placeholder="e.g. abc123xyz456..."
            style={{ flex: 1, padding: "11px 14px", borderRadius: 10, border: "1.5px solid rgba(0,0,0,0.1)", fontFamily: "monospace", fontSize: 13, outline: "none", background: "#fafaf4" }}
          />
          <button onClick={saveVoiceId} disabled={savingVoice || !voiceId.trim()}
            style={{ background: voiceSaved ? "#2da44e" : "#FF2D2D", color: "#fff", border: "none", borderRadius: 10, padding: "11px 20px", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", transition: "background 0.2s" }}>
            {voiceSaved ? "Saved ✓" : savingVoice ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 20, padding: 28, border: "1px solid rgba(0,0,0,0.07)", marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#7c7660", marginBottom: 18 }}>Notifications</div>
        {["Content generation complete", "Weekly brand report", "New AI improvements"].map(n => (
          <div key={n} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
            <span style={{ fontSize: 14, color: "#7c7660" }}>{n}</span>
            <div style={{ width: 36, height: 20, background: "#FF2D2D", borderRadius: 999, position: "relative", flexShrink: 0 }}>
              <div style={{ width: 16, height: 16, background: "#fff", borderRadius: "50%", position: "absolute", right: 2, top: 2 }} />
            </div>
          </div>
        ))}
      </div>

      <button onClick={onLogout}
        style={{ background: "none", border: "1px solid rgba(255,45,45,0.25)", color: "#FF2D2D", fontFamily: "inherit", fontSize: 14, fontWeight: 600, padding: "10px 24px", borderRadius: 999, cursor: "pointer" }}>
        Log out of Lumevo
      </button>
    </div>
  );
}

// ── CONTENT PLAN ─────────────────────────────────────────────────────────────
interface ContentIdea { type: string; title: string; why: string; platform: string; duration: string; }

function ContentPlan({ user, onNav }: { user: User; onNav: (s: Section) => void }) {
  const [plan, setPlan] = useState<ContentIdea[]>([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const isLocked = user.subscription_tier === "free";

  const PLATFORM_ICON: Record<string, string> = { instagram: "◉", tiktok: "▶", youtube: "▲", general: "✦" };

  async function generatePlan() {
    setLoading(true);
    const res = await fetch("/api/content-plan");
    if (res.ok) { const d = await res.json(); setPlan(d.plan); setGenerated(true); }
    setLoading(false);
  }

  if (isLocked) {
    return (
      <div>
        <div style={{ marginBottom: 36 }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 6 }}>Content Plan</h2>
          <p style={{ fontSize: 15, color: "#7c7660" }}>Your AI-generated posting strategy based on your brand and recent work.</p>
        </div>
        <div style={{ background: "#fff", borderRadius: 20, padding: "48px 40px", border: "1px solid rgba(0,0,0,0.07)", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>◆</div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, marginBottom: 10 }}>Upgrade to unlock Content Plan</div>
          <div style={{ fontSize: 15, color: "#7c7660", marginBottom: 28, maxWidth: 400, margin: "0 auto 28px" }}>Your AI content strategist recommends exactly what to post next, and why — based on what works for your style and audience.</div>
          <button onClick={() => onNav("billing")} style={{ background: "#FF2D2D", color: "#fff", border: "none", borderRadius: 999, padding: "13px 32px", fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            See Plans →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 36 }}>
        <div>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 6 }}>Content Plan</h2>
          <p style={{ fontSize: 15, color: "#7c7660" }}>Your AI strategist recommends what to create next — based on your brand and what performs.</p>
        </div>
        <button onClick={generatePlan} disabled={loading}
          style={{ background: "#FF2D2D", color: "#fff", border: "none", borderRadius: 999, padding: "11px 22px", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
          {loading ? "Generating…" : generated ? "Refresh Plan" : "Generate Plan"}
        </button>
      </div>

      {!generated && !loading && (
        <div style={{ background: "#fff", borderRadius: 20, padding: "56px 40px", border: "1px solid rgba(0,0,0,0.07)", textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>◆</div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, marginBottom: 10 }}>Ready to plan your next week</div>
          <div style={{ fontSize: 15, color: "#7c7660", marginBottom: 28 }}>Click &ldquo;Generate Plan&rdquo; and Lumevo will analyze your brand and create personalized content recommendations.</div>
        </div>
      )}

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid rgba(0,0,0,0.07)", opacity: 0.5 + i * 0.1, animation: "pulse 1.5s ease-in-out infinite" }}>
              <div style={{ height: 14, background: "#F8F8A6", borderRadius: 8, width: "40%", marginBottom: 10 }} />
              <div style={{ height: 20, background: "#F2F29A", borderRadius: 8, width: "70%", marginBottom: 10 }} />
              <div style={{ height: 12, background: "#F8F8A6", borderRadius: 8, width: "90%" }} />
            </div>
          ))}
        </div>
      )}

      {generated && plan.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {plan.map((idea, i) => (
            <div key={i} style={{ background: "#fff", borderRadius: 18, padding: "24px 26px", border: "1px solid rgba(0,0,0,0.07)", display: "flex", gap: 20, alignItems: "flex-start" }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#F8F8A6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#FF2D2D", flexShrink: 0, fontWeight: 700 }}>
                {i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#7c7660" }}>{idea.type}</span>
                  <span style={{ fontSize: 11, background: "#F8F8A6", padding: "2px 10px", borderRadius: 999, color: "#7c7660" }}>{PLATFORM_ICON[idea.platform]} {PLATFORM_LABELS[idea.platform] || idea.platform}</span>
                  <span style={{ fontSize: 11, background: "#F8F8A6", padding: "2px 10px", borderRadius: 999, color: "#7c7660" }}>{idea.duration}</span>
                </div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 700, marginBottom: 8, lineHeight: 1.3 }}>{idea.title}</div>
                <div style={{ fontSize: 13, color: "#7c7660", lineHeight: 1.6 }}>{idea.why}</div>
              </div>
              <button onClick={() => onNav("create")}
                style={{ background: "#FF2D2D", color: "#fff", border: "none", borderRadius: 999, padding: "9px 18px", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                Create →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── AI MANAGER ────────────────────────────────────────────────────────────────
interface ChatMessage { role: "user" | "assistant"; content: string; }

const QUICK_COMMANDS = [
  "Make this feel more expensive",
  "Turn my uploads into a launch reel",
  "Write a voiceover for my latest project",
  "Create 3 directions for different audiences",
  "Plan next week's content from my uploads",
  "What should I post this week?",
];

function AIManagerSection({ user, brand, onNav }: { user: User; brand: BrandProfile | null; onNav: (s: Section) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isElite = user.subscription_tier === "elite";

  async function send(text?: string) {
    const msg = text || input.trim();
    if (!msg || thinking) return;
    setInput("");
    const newMessages: ChatMessage[] = [...messages, { role: "user", content: msg }];
    setMessages(newMessages);
    setThinking(true);

    try {
      const res = await fetch("/api/ai-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history: messages }),
      });
      const data = await res.json();
      if (data.reply) {
        setMessages([...newMessages, { role: "assistant", content: data.reply }]);
      }
    } catch { /* silent */ }
    finally { setThinking(false); }
  }

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, thinking]);

  if (!isElite) {
    return (
      <div>
        <div style={{ marginBottom: 36 }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 6 }}>AI Manager</h2>
          <p style={{ fontSize: 15, color: "#7c7660" }}>Your personal creative director. Available on Elite.</p>
        </div>
        <div style={{ background: "#1a1a1a", borderRadius: 24, padding: "56px 40px", textAlign: "center" }}>
          <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 20, color: "#FF2D2D", marginBottom: 20 }}>✧ AI Manager</div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 12 }}>Your creative director, on demand</div>
          <div style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", marginBottom: 32, maxWidth: 440, margin: "0 auto 32px", lineHeight: 1.7 }}>
            Tell Lumevo what you want to make. It thinks like a creative director — strategy, scripting, voiceover direction, multi-version creation, and more.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32, maxWidth: 360, margin: "0 auto 32px" }}>
            {QUICK_COMMANDS.slice(0, 3).map(c => (
              <div key={c} style={{ background: "rgba(255,255,255,0.07)", borderRadius: 10, padding: "12px 16px", fontSize: 14, color: "rgba(255,255,255,0.6)", textAlign: "left" }}>
                &ldquo;{c}&rdquo;
              </div>
            ))}
          </div>
          <button onClick={() => onNav("billing")} style={{ background: "#FF2D2D", color: "#fff", border: "none", borderRadius: 999, padding: "14px 36px", fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            Upgrade to Elite →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 180px)", minHeight: 500 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px" }}>AI Manager</h2>
          <span style={{ background: "#FF2D2D", color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, letterSpacing: 1 }}>ELITE</span>
        </div>
        <p style={{ fontSize: 15, color: "#7c7660" }}>
          {brand?.tone_summary ? `Your brand profile is active. Tone: ${brand.tone_summary}.` : "Your creative director. Tell it what you want to make."}
        </p>
      </div>

      <div style={{ flex: 1, background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,0.07)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
          {messages.length === 0 && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0", textAlign: "center" }}>
              <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 22, color: "#FF2D2D", marginBottom: 8 }}>✧ AI Manager</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Ready to create</div>
              <div style={{ fontSize: 14, color: "#7c7660", marginBottom: 28 }}>Tell your creative director what you want.</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 520 }}>
                {QUICK_COMMANDS.map(cmd => (
                  <button key={cmd} onClick={() => send(cmd)}
                    style={{ background: "#F8F8A6", border: "none", borderRadius: 999, padding: "9px 16px", fontFamily: "inherit", fontSize: 13, cursor: "pointer", color: "#1a1a1a", fontWeight: 500, transition: "all 0.15s" }}>
                    {cmd}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "78%",
                padding: "14px 18px",
                borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                background: m.role === "user" ? "#FF2D2D" : "#F8F8A6",
                color: m.role === "user" ? "#fff" : "#1a1a1a",
                fontSize: 15,
                lineHeight: 1.65,
                whiteSpace: "pre-wrap",
              }}>
                {m.content}
              </div>
            </div>
          ))}

          {thinking && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div style={{ background: "#F8F8A6", borderRadius: "18px 18px 18px 4px", padding: "14px 18px", fontSize: 18, letterSpacing: 4 }}>
                ···
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(0,0,0,0.06)", display: "flex", gap: 10 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Tell your AI Manager what you want to create…"
            style={{ flex: 1, padding: "13px 18px", borderRadius: 999, border: "1.5px solid rgba(0,0,0,0.1)", fontFamily: "inherit", fontSize: 14, background: "#fafaf4", outline: "none", boxSizing: "border-box" }}
          />
          <button onClick={() => send()} disabled={!input.trim() || thinking}
            style={{ background: "#FF2D2D", color: "#fff", border: "none", borderRadius: 999, padding: "13px 22px", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: !input.trim() || thinking ? "not-allowed" : "pointer", opacity: !input.trim() ? 0.5 : 1 }}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [section, setSection] = useState<Section>("overview");
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [brand, setBrand] = useState<BrandProfile | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [uRes, pRes, bRes] = await Promise.all([
      fetch("/api/uploads"),
      fetch("/api/projects"),
      fetch("/api/brand-profile"),
    ]);
    if (uRes.ok) setUploads((await uRes.json()).uploads);
    if (pRes.ok) setProjects((await pRes.json()).projects);
    if (bRes.ok) setBrand((await bRes.json()).brand_profile);
  }, []);

  useEffect(() => {
    fetch("/api/me").then(async res => {
      if (!res.ok) { router.push("/login"); return; }
      const data = await res.json();
      setUser(data.user);
      await fetchData();
      setLoading(false);
    });
  }, [router, fetchData]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  function navigate(s: Section) { setSection(s); setSidebarOpen(false); window.scrollTo(0, 0); }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#F8F8A6", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Fredoka One', cursive", fontSize: 28, color: "#FF2D2D", letterSpacing: 2 }}>
        LUMEVO
      </div>
    );
  }
  if (!user) return null;

  const groups = ["", "Create", "Learn", "Account"];
  const navByGroup = (g: string) => NAV.filter(n => (n.group || "") === g);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; overflow-x: hidden; }
        body { background: #F8F8A6; font-family: 'DM Sans', system-ui, sans-serif; color: #1a1a1a; -webkit-font-smoothing: antialiased; }
        .page-shell { display: flex; flex-direction: column; min-height: 100vh; }
        .topbar { display: none; background: rgba(248,248,166,0.97); backdrop-filter: blur(8px); border-bottom: 1px solid rgba(0,0,0,0.08); height: 56px; padding: 0 18px; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 200; flex-shrink: 0; }
        @media (max-width: 768px) { .topbar { display: flex; } }
        .overlay { display: none; }
        @media (max-width: 768px) { .overlay-show { display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 150; } }
        .layout { display: flex; flex: 1; min-height: 0; }
        .sidebar { width: 230px; flex-shrink: 0; background: #1a1a1a; display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
        @media (max-width: 768px) { .sidebar { position: fixed; top: 0; left: 0; height: 100vh; z-index: 180; transform: translateX(-100%); transition: transform 0.28s ease; } .sidebar-open { transform: translateX(0) !important; } }
        .main { flex: 1; min-width: 0; overflow-y: auto; padding: 48px 44px 100px; }
        .main-inner { max-width: 860px; margin: 0 auto; }
        @media (max-width: 768px) { .main { padding: 28px 18px 80px; } .main-inner { max-width: 100%; } }
        .nav-item { display: flex; align-items: center; gap: 10px; padding: 9px 14px; border-radius: 9px; cursor: pointer; margin-bottom: 2px; border: none; background: transparent; color: rgba(255,255,255,0.45); font-family: inherit; font-size: 13.5px; font-weight: 500; width: 100%; text-align: left; transition: all 0.15s; }
        .nav-item:hover { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.75); }
        .nav-item-active { background: rgba(255,45,45,0.15) !important; color: #FF6B6B !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="page-shell">
      <div className="topbar">
        <span style={{ fontFamily: "'Fredoka One', cursive", fontSize: 20, color: "#FF2D2D" }}>LUMEVO</span>
        <button onClick={() => setSidebarOpen(o => !o)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#1a1a1a", lineHeight: 1 }}>☰</button>
      </div>
      <div className={sidebarOpen ? "overlay overlay-show" : "overlay"} onClick={() => setSidebarOpen(false)} />

      <div className="layout">
        <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
          <div style={{ padding: "26px 22px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <span style={{ fontFamily: "'Fredoka One', cursive", fontSize: 26, color: "#FF2D2D", display: "block" }}>LUMEVO</span>
            <span style={{ fontSize: 9, fontStyle: "italic", color: "rgba(255,255,255,0.35)", letterSpacing: 3, textTransform: "uppercase" }}>Studio</span>
          </div>

          <nav style={{ flex: 1, padding: "16px 10px", overflowY: "auto" }}>
            {groups.map(group => (
              <div key={group}>
                {group && <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.2)", padding: "12px 14px 6px" }}>{group}</div>}
                {navByGroup(group).map(item => (
                  <button key={item.id} className={`nav-item ${section === item.id ? "nav-item-active" : ""}`} onClick={() => navigate(item.id)}>
                    <span style={{ fontSize: 15, width: 20, textAlign: "center" }}>{item.icon}</span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.elite && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, background: "#FF2D2D", color: "#fff", padding: "2px 6px", borderRadius: 4 }}>ELITE</span>}
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <div style={{ padding: "14px 10px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#FF2D2D", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{TIER_LABELS[user.subscription_tier]}</div>
              </div>
            </div>
          </div>
        </aside>

        <main className="main">
          <div className="main-inner">
            {section === "overview" && <Overview user={user} uploads={uploads} projects={projects} brand={brand} onNav={navigate} />}
            {section === "uploads" && <UploadsSection uploads={uploads} onRefresh={fetchData} />}
            {section === "create" && <CreateContent brand={brand} />}
            {section === "video" && <CreateVideo uploads={uploads} user={user} />}
            {section === "brand" && <BrandSection brand={brand} onRefresh={fetchData} />}
            {section === "projects" && <ProjectsSection projects={projects} onNav={navigate} />}
            {section === "plan" && <ContentPlan user={user} onNav={navigate} />}
            {section === "aimanager" && <AIManagerSection user={user} brand={brand} onNav={navigate} />}
            {section === "analytics" && <Analytics />}
            {section === "billing" && <Billing user={user} />}
            {section === "settings" && <Settings user={user} onLogout={handleLogout} />}
          </div>
        </main>
      </div>
      </div>
    </>
  );
}
