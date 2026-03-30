"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

type Section = "overview" | "uploads" | "create" | "video" | "brand" | "projects" | "plan" | "aimanager" | "analytics" | "billing" | "settings";

interface User { id: string; name: string; email: string; subscription_tier: string; created_at: string; trial_started_at?: string; elevenlabs_voice_id?: string; voice_clone_name?: string; }
interface Upload { id: string; file_type: string; file_name: string; mime_type: string; file_size: number; analysis_status: string; created_at: string; file_path?: string | null; thumb_path?: string | null; ai_analysis?: Record<string, string> | null; video_duration_sec?: number | null; }
interface Project { id: string; title: string; project_type: string; target_platform: string; target_duration?: number; vibe?: string; status: string; created_at: string; updated_at: string; }
interface FullProject extends Project { generated_content?: { script?: string; caption?: string } | null; }
interface Voiceover { id: string; script_content: string; provider_voice_id?: string; status: string; created_at: string; }
interface BrandProfile { user_id: string; tone_summary: string; personality_summary: string; audience_summary: string; pacing_style: string; cta_style: string; visual_style_summary?: string; voice_preferences?: string; hook_style?: string; pattern_interrupt_style?: string; emotional_arc_preference?: string; music_genre_preference?: string; creator_archetype?: string; confidence_score: number; learning_progress_percent: number; upload_count: number; generation_count: number; last_learned_at?: string; }

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

const TIER_LABELS: Record<string, string> = { trial: "Free Trial", creator: "Creator", pro: "Pro", elite: "Elite" };
const TRIAL_LIMIT = 2;
const TRIAL_DAYS = 14;
function trialDaysLeft(startedAt?: string) {
  if (!startedAt) return TRIAL_DAYS;
  const ms = Date.now() - new Date(startedAt).getTime();
  return Math.max(0, TRIAL_DAYS - Math.floor(ms / 86400000));
}
const TYPE_LABELS: Record<string, string> = { caption: "Caption", hook: "Hook", post: "Post", script: "Script", video: "Video", ideas: "Ideas" };
const PLATFORM_LABELS: Record<string, string> = { tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube", general: "General" };
const STATUS_COLORS: Record<string, string> = { draft: "#b5b09a", chatting: "#7B61FF", generating: "#FF8C00", queued: "#7c7660", analyzing: "#FF8C00", scripting: "#FF8C00", completed: "#2da44e", failed: "#FF2D2D" };

function fmt(bytes: number) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1048576) return `${(bytes/1024).toFixed(1)} KB`; return `${(bytes/1048576).toFixed(1)} MB`; }
function fmtDate(d: string) {
  const dt = new Date(d);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[dt.getUTCMonth()]} ${dt.getUTCDate()}, ${dt.getUTCFullYear()}`;
}

// ── OVERVIEW ──────────────────────────────────────────────────────────────────
function Overview({ user, uploads, projects, brand, onNav }: {
  user: User; uploads: Upload[]; projects: Project[]; brand: BrandProfile | null; onNav: (s: Section, projectId?: string) => void;
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

      {user.subscription_tier === "trial" && (() => {
        const projectsLeft = Math.max(0, TRIAL_LIMIT - projects.length);
        const daysLeft = trialDaysLeft(user.trial_started_at);
        const trialEndDt = user.trial_started_at ? new Date(new Date(user.trial_started_at).getTime() + TRIAL_DAYS * 86400000) : null;
        const trialEndDate = trialEndDt ? fmtDate(trialEndDt.toISOString()) : "";
        return (
          <div style={{ background: "#1a1a1a", borderRadius: 16, padding: "20px 24px", marginBottom: 28, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 6 }}>Free Trial</div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 800, color: "#fff", marginBottom: 4 }}>
                {projectsLeft === 0 ? "You've used both trial projects" : `${projectsLeft} project${projectsLeft !== 1 ? "s" : ""} left · ${daysLeft} day${daysLeft !== 1 ? "s" : ""} remaining`}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
                {trialEndDate ? `Trial ends ${trialEndDate} — then auto-renews to Creator ($29/mo). Cancel anytime.` : "Auto-renews to Creator ($29/mo) after trial. Cancel anytime."}
              </div>
            </div>
            <button onClick={() => onNav("billing")} style={{ background: "#FF2D2D", color: "#fff", border: "none", borderRadius: 999, padding: "11px 22px", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
              Upgrade now →
            </button>
          </div>
        );
      })()}

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
                      { label: "Open project", icon: "↗", action: () => { onNav("projects", p.id); setMenuOpen(null); } },
                      { label: "Use as template", icon: "◻", action: () => { onNav("video"); setMenuOpen(null); } },
                      { label: "New project", icon: "+", action: () => { onNav("video"); setMenuOpen(null); } },
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
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadCount, setUploadCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [textType, setTextType] = useState("caption");
  const [activeTab, setActiveTab] = useState<"file" | "text">("file");
  const [generated, setGenerated] = useState("");
  const [savedToast, setSavedToast] = useState(false);
  const [gdriveUrl, setGdriveUrl] = useState("");
  const [gdriveOpen, setGdriveOpen] = useState(false);
  const [gdriveLoading, setGdriveLoading] = useState(false);
  const [gdriveError, setGdriveError] = useState<string | null>(null);

  async function handleGdriveImport() {
    if (!gdriveUrl.trim()) return;
    setGdriveLoading(true);
    setGdriveError(null);
    try {
      const res = await fetch("/api/uploads/gdrive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: gdriveUrl.trim() }),
      });
      const data = await res.json() as { upload?: unknown; error?: string };
      if (!res.ok) { setGdriveError(data.error || "Import failed"); return; }
      setGdriveUrl("");
      setGdriveOpen(false);
      onRefresh();
    } catch {
      setGdriveError("Connection error — try again.");
    } finally {
      setGdriveLoading(false);
    }
  }

  async function uploadFiles(files: File[]) {
    if (!files.length) return;
    setUploading(true);
    setUploadError(null);
    setUploadCount(files.length);
    const formData = new FormData();
    files.forEach(f => formData.append("files", f));
    try {
      const res = await fetch("/api/uploads", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" })) as { error?: string };
        setUploadError(err.error || `Upload failed (${res.status})`);
      } else {
        const data = await res.json() as { uploads?: unknown[] };
        if (!data.uploads?.length) setUploadError("No files were saved. Check file type and try again.");
        onRefresh();
      }
    } catch (err) {
      setUploadError("Connection error — check your internet and try again.");
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
      setUploadCount(0);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    await uploadFiles(Array.from(e.target.files || []).slice(0, 10));
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).slice(0, 10);
    if (files.length) uploadFiles(files);
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
          <div>
            {uploadError && (
              <div style={{ background: "#fff0f0", border: "1.5px solid rgba(255,45,45,0.25)", borderRadius: 12, padding: "12px 16px", marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 16 }}>⚠</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#FF2D2D", marginBottom: 2 }}>Upload failed</div>
                  <div style={{ fontSize: 12, color: "#7c7660" }}>{uploadError}</div>
                </div>
                <button onClick={() => setUploadError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#b5b09a", fontSize: 16, lineHeight: 1 }}>×</button>
              </div>
            )}
            <div
              onClick={() => !uploading && fileRef.current?.click()}
              onDragOver={handleDragOver}
              onDragEnter={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{ border: `2px dashed ${isDragging ? "#FF2D2D" : uploadError ? "rgba(255,45,45,0.4)" : "rgba(255,45,45,0.25)"}`, borderRadius: 14, padding: "40px 24px", textAlign: "center", cursor: uploading ? "wait" : "pointer", transition: "all 0.2s", background: isDragging ? "rgba(255,45,45,0.06)" : "transparent" }}>
              <input ref={fileRef} type="file" multiple style={{ display: "none" }} onChange={handleFile} accept="video/*,image/*,audio/*,.txt,.pdf" />
              <div style={{ fontSize: 32, marginBottom: 12 }}>{uploading ? "⏳" : isDragging ? "⊕" : "↑"}</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
                {uploading ? `Uploading ${uploadCount} file${uploadCount !== 1 ? "s" : ""}…` : isDragging ? "Drop to upload" : "Drag & drop or click to upload"}
              </div>
              <div style={{ fontSize: 13, color: "#7c7660" }}>Video, image, audio, text — anything that shows Lumevo your style</div>
            </div>

            {/* Google Drive import */}
            <div style={{ marginTop: 12 }}>
              <button onClick={() => { setGdriveOpen(o => !o); setGdriveError(null); }}
                style={{ width: "100%", background: "#fff", border: "1.5px solid rgba(0,0,0,0.1)", borderRadius: 12, padding: "12px 18px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                <svg width="20" height="20" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                  <path d="M43.65 25L29.9 1.2C28.55 2 27.4 3.1 26.6 4.5L1.2 48.5C.4 49.9 0 51.45 0 53h27.5z" fill="#00ac47"/>
                  <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 11.5z" fill="#ea4335"/>
                  <path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.4-4.5 1.2z" fill="#00832d"/>
                  <path d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.4 4.5-1.2z" fill="#2684fc"/>
                  <path d="M73.4 26.5l-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25 59.8 53h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                </svg>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>Import from Google Drive</div>
                  <div style={{ fontSize: 11, color: "#7c7660" }}>Paste a share link from any shared Drive file</div>
                </div>
                <span style={{ fontSize: 18, color: "#b5b09a", transform: gdriveOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>⌄</span>
              </button>

              {gdriveOpen && (
                <div style={{ background: "#fafaf4", border: "1.5px solid rgba(0,0,0,0.08)", borderRadius: 12, padding: 16, marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: "#7c7660", marginBottom: 10, lineHeight: 1.5 }}>
                    Open Google Drive, right-click a <strong>specific file</strong> (not a folder) → <strong>Share</strong> → change access to <strong>Anyone with the link</strong> → copy and paste below.
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={gdriveUrl}
                      onChange={e => { setGdriveUrl(e.target.value); setGdriveError(null); }}
                      onKeyDown={e => e.key === "Enter" && handleGdriveImport()}
                      placeholder="https://drive.google.com/file/d/..."
                      style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1.5px solid rgba(0,0,0,0.1)", fontFamily: "inherit", fontSize: 13, outline: "none", background: "#fff" }}
                    />
                    <button onClick={handleGdriveImport} disabled={gdriveLoading || !gdriveUrl.trim()}
                      style={{ background: "#FF2D2D", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: gdriveLoading || !gdriveUrl.trim() ? "not-allowed" : "pointer", opacity: !gdriveUrl.trim() ? 0.5 : 1, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
                      {gdriveLoading ? <><span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> Importing…</> : "Import"}
                    </button>
                  </div>
                  {gdriveError && (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#FF2D2D", fontWeight: 600 }}>{gdriveError}</div>
                  )}
                </div>
              )}
            </div>
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
type ChatStep = "title" | "platform" | "vibe" | "duration" | "upload" | null;

function CreateVideo({ uploads, user, projects, resumeDraftId, onResumeConsumed }: { uploads: Upload[]; user: User; projects: Project[]; resumeDraftId?: string | null; onResumeConsumed?: () => void }) {
  const firstName = user.name.split(" ")[0];
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "ai", content: `What's the content about, ${firstName}? Tell me the actual topic — a trip, a product launch, a morning routine, something that happened. The more specific, the better.`, id: 0 }
  ]);
  const [projectState, setProjectState] = useState<ProjectState>({ title: null, platforms: null, mediaType: null, vibe: null, duration: null });
  const [phase, setPhase] = useState<"chat" | "generating" | "done">("chat");
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [needsUpload, setNeedsUpload] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [msgCounter, setMsgCounter] = useState(1);
  const [stepIdx, setStepIdx] = useState(0);
  const [currentStep, setCurrentStep] = useState<ChatStep>(null);
  const [result, setResult] = useState<{ script: string; audioBase64: string | null; projectId: string; hasVoice: boolean; caption?: string; videoUrl?: string | null } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ name: string; done: boolean }[]>([]);
  const [localUploads, setLocalUploads] = useState<Upload[]>(uploads);
  const [useVoiceClone, setUseVoiceClone] = useState(!!user.elevenlabs_voice_id);
  // Only block trial users who are starting a brand-new project — never block resuming an existing one
  const [trialBlocked, setTrialBlocked] = useState(user.subscription_tier === "trial" && projects.length >= TRIAL_LIMIT && !resumeDraftId);
  const [gdriveUrl, setGdriveUrl] = useState("");
  const [gdriveOpen, setGdriveOpen] = useState(false);
  const [gdriveLoading, setGdriveLoading] = useState(false);
  const [gdriveError, setGdriveError] = useState<string | null>(null);

  async function handleGdriveImport() {
    if (!gdriveUrl.trim()) return;
    setGdriveLoading(true);
    setGdriveError(null);
    try {
      const res = await fetch("/api/uploads/gdrive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: gdriveUrl.trim() }),
      });
      const data = await res.json() as { upload?: Upload; error?: string };
      if (!res.ok) { setGdriveError(data.error || "Import failed"); setGdriveLoading(false); return; }
      if (data.upload) {
        setLocalUploads(prev => [data.upload!, ...prev]);
        setSelectedIds(prev => [data.upload!.id, ...prev]);
      }
      setGdriveUrl("");
      setGdriveOpen(false);
    } catch {
      setGdriveError("Connection error — try again.");
    } finally {
      setGdriveLoading(false);
    }
  }
  const [composing, setComposing] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [includeMusic, setIncludeMusic] = useState(true);
  const [feedbackSent, setFeedbackSent] = useState<string | null>(null);
  const [composeResult, setComposeResult] = useState<{ editorialNote?: string; emotionalArc?: string } | null>(null);
  const [draftProjectId, setDraftProjectId] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const draftSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resume a saved draft project: restore chat history + project state
  useEffect(() => {
    if (!resumeDraftId) return;
    fetch(`/api/project/draft?id=${resumeDraftId}`)
      .then(r => r.json())
      .then((data: { project?: { id: string; title: string; chat_history?: Array<{ role: string; content: string }>; draft_state?: Record<string, unknown> } }) => {
        const p = data.project;
        if (!p) return;
        setDraftProjectId(p.id);
        if (p.draft_state) {
          setProjectState(p.draft_state as unknown as ProjectState);
        }
        const hist = Array.isArray(p.chat_history) ? p.chat_history : [];
        if (hist.length) {
          const restored = hist.map((m, i) => ({
            role: m.role === "assistant" ? "ai" as const : "user" as const,
            content: m.content,
            id: i,
          }));
          setMessages(restored);
          setMsgCounter(restored.length);
        }
        setTrialBlocked(false); // resuming an existing project is always allowed
        setPhase("chat");
        onResumeConsumed?.();
      })
      .catch(e => console.warn("Resume failed:", e));
  }, [resumeDraftId]);

  async function logFeedback(action: string, projectId?: string) {
    setFeedbackSent(action);
    try {
      await fetch("/api/project/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, action }),
      });
    } catch { /* non-blocking */ }
  }

  async function composeVideo(projectId: string, script: string, audioBase64: string | null) {
    if (!selectedIds.length) return null;
    setComposing(true);
    setComposeError(null);
    try {
      const res = await fetch("/api/video/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          uploadIds: selectedIds,
          script,
          title: projectState.title,
          vibe: projectState.vibe,
          platform: projectState.platforms?.[0] || "tiktok",
          duration: projectState.duration || 30,
          useVoiceClone,
          audioBase64,
          includeMusic,
        }),
      });
      const data = await res.json() as { videoUrl?: string; error?: string; timeline?: unknown; editorialNote?: string; emotionalArc?: string };
      if (data.videoUrl) {
        setComposeResult({ editorialNote: data.editorialNote, emotionalArc: data.emotionalArc });
        return data.videoUrl as string;
      }
      setComposeError(data.error || "Compose failed");
      return null;
    } catch {
      setComposeError("Connection error during video compose");
      return null;
    } finally {
      setComposing(false);
    }
  }

  function downloadVideo(videoUrl: string) {
    const link = document.createElement("a");
    link.href = videoUrl;
    link.download = `${(projectState.title || "lumevo-video").replace(/\s+/g, "-").toLowerCase()}.mp4`;
    link.click();
    if (result?.projectId) logFeedback("download", result.projectId);
  }

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

      if (res.status === 401) {
        setIsTyping(false);
        setMessages(prev => [...prev, { role: "ai", content: "Your session has expired. Please refresh the page and log back in — your conversation will still be here.", id: msgCounter + 1 }]);
        return;
      }

      if (!res.ok) {
        let errMsg = "I'm having trouble right now — please try again in a moment.";
        try { const e = await res.json() as { message?: string }; if (e.message) errMsg = e.message; } catch { /* ignore */ }
        setIsTyping(false);
        setMessages(prev => [...prev, { role: "ai", content: errMsg, id: msgCounter + 1 }]);
        return;
      }

      const data = await res.json();

      const newState = { ...projectState };
      if (data.extracted) {
        if (data.extracted.title) newState.title = data.extracted.title;
        if (data.extracted.platforms) {
          const p = data.extracted.platforms;
          newState.platforms = Array.isArray(p) ? p : typeof p === "string" ? [p] : newState.platforms;
        }
        if (data.extracted.vibe) newState.vibe = data.extracted.vibe;
        if (data.extracted.duration) {
          const raw = data.extracted.duration;
          const parsed = typeof raw === "number" ? raw : parseInt(String(raw), 10);
          if (!isNaN(parsed) && parsed > 0) newState.duration = parsed;
        }
        if (!newState.mediaType) newState.mediaType = "both";
      }
      setProjectState(newState);
      if (data.currentStep) setCurrentStep(data.currentStep as ChatStep);
      if (data.needsUpload) setNeedsUpload(true);

      setIsTyping(false);
      const aiId = msgCounter + 1;
      setMsgCounter(c => c + 2);
      const finalMessages = [...updated, { role: "ai" as const, content: data.message as string, id: aiId }];
      setMessages(finalMessages);

      // Persist draft: create on first title, update on every subsequent message
      const chatForDb = finalMessages.map(m => ({ role: m.role === "ai" ? "assistant" : "user", content: m.content }));
      if (newState.title) {
        if (draftSaveRef.current) clearTimeout(draftSaveRef.current);
        draftSaveRef.current = setTimeout(async () => {
          try {
            const draftId = draftProjectId;
            const saveRes = await fetch("/api/project/draft", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                projectId: draftId ?? undefined,
                title: newState.title,
                chat_history: chatForDb,
                draft_state: newState,
                status: "chatting",
              }),
            });
            const saveData = await saveRes.json() as { projectId?: string };
            if (!draftId && saveData.projectId) setDraftProjectId(saveData.projectId);
          } catch (e) { console.warn("Draft save failed:", e); }
        }, 600);
      }
    } catch (err) {
      console.error("Chat fetch error:", err);
      setIsTyping(false);
      setMessages(prev => [...prev, { role: "ai", content: "Network hiccup — hit send again and it'll go through.", id: msgCounter + 1 }]);
    }
  }

  async function startGeneration(state: ProjectState, uploadIdsForGen: string[]) {
    setPhase("generating");
    setGenerationError(null);
    setStepIdx(0);
    const timers = STEPS.map((_, i) => setTimeout(() => setStepIdx(i), i * 2500));

    // Mark draft as generating so user can resume if needed
    if (draftProjectId) {
      fetch("/api/project/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: draftProjectId, status: "generating" }),
      }).catch(() => {});
    }

    try {
      // Step 1: Generate script + caption + narration
      const res = await fetch("/api/video/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: state.title,
          uploadIds: uploadIdsForGen,
          platform: state.platforms?.[0] || "tiktok",
          duration: state.duration || 30,
          vibe: state.vibe,
          mediaType: state.mediaType,
          useVoiceClone,
          draftProjectId: draftProjectId ?? undefined,
        }),
      });
      const data = await res.json() as { trialLimitReached?: boolean; script?: string; audioBase64?: string | null; projectId?: string; hasVoice?: boolean; caption?: string };

      if (data.trialLimitReached) {
        timers.forEach(clearTimeout);
        setTrialBlocked(true);
        setPhase("chat");
        return;
      }

      if (!data.script) {
        throw new Error("No script was generated — please try again.");
      }

      // Step 2: If media files selected, compose actual video from clips
      let videoUrl: string | null = null;
      if (uploadIdsForGen.length > 0 && data.projectId && data.script) {
        setStepIdx(3);
        const composed = await composeVideo(data.projectId, data.script, data.audioBase64 || null);
        videoUrl = composed;
      }

      timers.forEach(clearTimeout);
      setStepIdx(STEPS.length);
      await new Promise(r => setTimeout(r, 500));
      setResult({
        ...(data as { script: string; audioBase64: string | null; projectId: string; hasVoice: boolean; caption?: string }),
        videoUrl,
      });
      setDraftProjectId(null);
      setPhase("done");
    } catch (err) {
      timers.forEach(clearTimeout);
      const msg = err instanceof Error ? err.message : "Something went wrong during generation.";
      setGenerationError(msg);
      // Keep phase as "generating" so we can show the error UI with resume option
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []).slice(0, 10);
    if (!files.length) return;
    setUploadingFiles(true);
    setUploadProgress(files.map(f => ({ name: f.name, done: false })));

    const formData = new FormData();
    files.forEach(f => formData.append("files", f));

    try {
      const res = await fetch("/api/uploads", { method: "POST", body: formData });
      const data = await res.json() as { uploads?: Upload[] };
      if (data.uploads?.length) {
        setLocalUploads(prev => [...data.uploads!, ...prev]);
        setSelectedIds(prev => [...data.uploads!.map((u: Upload) => u.id), ...prev]);
        setUploadProgress(files.map(f => ({ name: f.name, done: true })));
      }
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploadingFiles(false);
      setUploadProgress([]);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function handleConfirmUploads() {
    setNeedsUpload(false);
    // Kick off generation immediately with whatever state + selected files
    startGeneration(projectState, selectedIds);
  }

  // Quick replies tied exactly to what the AI just asked about
  const quickReplies: string[] =
    currentStep === "platform" ? ["Instagram", "TikTok", "Both — Instagram & TikTok"] :
    currentStep === "duration" ? ["15 seconds", "30 seconds", "60 seconds"] :
    [];

  if (phase === "generating") {
    if (generationError) {
      return (
        <div style={{ paddingTop: 20 }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 22, color: "#FF2D2D", marginBottom: 8 }}>LUMEVO</div>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
              Hit a snag{projectState.title ? ` on "${projectState.title}"` : ""}
            </h2>
            <p style={{ fontSize: 14, color: "#7c7660", maxWidth: 360, margin: "0 auto" }}>{generationError}</p>
          </div>

          {draftProjectId && (
            <div style={{ background: "#F8F8A6", borderRadius: 16, padding: "16px 20px", maxWidth: 480, margin: "0 auto 16px", border: "1px solid rgba(0,0,0,0.07)", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 20 }}>💾</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>Your project is saved</div>
                <div style={{ fontSize: 13, color: "#7c7660" }}>
                  {projectState.title ? `"${projectState.title}"` : "Your project"} is safe in your Projects tab — pick up where you left off anytime.
                </div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 12, maxWidth: 480, margin: "0 auto" }}>
            <button
              onClick={() => { setGenerationError(null); startGeneration(projectState, selectedIds); }}
              style={{ flex: 1, background: "#FF2D2D", color: "#fff", border: "none", borderRadius: 14, padding: "16px 20px", fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 800, cursor: "pointer" }}
            >
              Try again
            </button>
            <button
              onClick={() => { setGenerationError(null); setPhase("chat"); }}
              style={{ flex: 1, background: "#fff", color: "#1a1a1a", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 14, padding: "16px 20px", fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >
              Back to chat
            </button>
          </div>
        </div>
      );
    }

    return (
      <div style={{ paddingTop: 20 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 22, color: "#FF2D2D", marginBottom: 8 }}>LUMEVO</div>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 800, marginBottom: 8 }}>
            Creating{projectState.title ? ` "${projectState.title}"` : " your video"}...
          </h2>
          <p style={{ fontSize: 15, color: "#7c7660" }}>Sit tight — this is where the magic happens.</p>
          {draftProjectId && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, background: "rgba(248,248,166,0.6)", borderRadius: 999, padding: "5px 14px", fontSize: 12, color: "#7c7660", fontWeight: 600 }}>
              <span>💾</span> Auto-saved — you can always resume from Projects
            </div>
          )}
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
    const scriptLines = result.script.split(/\n+/).filter(Boolean);

    return (
      <div>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 6 }}>✦ Content ready</div>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 4, lineHeight: 1.2 }}>{projectState.title}</h2>
            <p style={{ fontSize: 13, color: "#7c7660" }}>{platforms} · {projectState.duration || 30}s{projectState.vibe ? ` · ${projectState.vibe.slice(0, 40)}` : ""}</p>
          </div>
          <button onClick={handleReset} style={{ background: "#111", color: "#fff", border: "none", borderRadius: 999, padding: "10px 18px", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
            + New
          </button>
        </div>

        {/* Voice narration */}
        {result.audioBase64 && (
          <div style={{ background: "#1a1a1a", borderRadius: 20, padding: "20px 22px", marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 12 }}>Your Voice</div>
            <audio controls style={{ width: "100%", borderRadius: 8, accentColor: "#FF2D2D" }} src={`data:audio/mpeg;base64,${result.audioBase64}`} />
          </div>
        )}

        {/* Composed Video Player */}
        <div style={{ background: "#1a1a1a", borderRadius: 20, marginBottom: 14, overflow: "hidden" }}>
          <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 3 }}>Your Video</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>9:16 · From your actual clips · MP4</div>
            </div>
            {result.videoUrl && (
              <button onClick={() => downloadVideo(result.videoUrl!)} style={{ background: "#F8F8A6", color: "#1a1a1a", border: "none", borderRadius: 999, padding: "10px 20px", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                ↓ Download MP4
              </button>
            )}
          </div>

          <div style={{ padding: "18px 20px" }}>
            {composing && (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <div style={{ width: 44, height: 44, border: "3px solid rgba(255,45,45,0.25)", borderTopColor: "#FF2D2D", borderRadius: "50%", animation: "spin 0.9s linear infinite", margin: "0 auto 16px" }} />
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", fontWeight: 600, marginBottom: 6 }}>Creating your video…</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>Title card → smooth transitions → music mix. Takes 30–90 seconds.</div>
              </div>
            )}

            {composeError && !composing && !result.videoUrl && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "rgba(255,45,45,0.08)", borderRadius: 12 }}>
                <div style={{ fontSize: 18 }}>⚠</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: "#FF2D2D", fontWeight: 700, marginBottom: 2 }}>Compose failed</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{composeError}</div>
                </div>
                <button onClick={() => result && composeVideo(result.projectId, result.script, result.audioBase64)} style={{ background: "#FF2D2D", color: "#fff", border: "none", borderRadius: 999, padding: "8px 16px", fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Retry</button>
              </div>
            )}

            {result.videoUrl && !composing && (
              <div style={{ borderRadius: 12, overflow: "hidden", maxWidth: 280, margin: "0 auto" }}>
                <video
                  src={result.videoUrl}
                  controls
                  playsInline
                  style={{ width: "100%", display: "block", borderRadius: 12 }}
                />
              </div>
            )}

            {!result.videoUrl && !composing && !composeError && (
              <div style={{ padding: "16px 0 4px" }}>
                {selectedIds.length === 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>
                      Pick clips to compose
                    </div>
                    {uploads.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "20px 0", color: "rgba(255,255,255,0.35)", fontSize: 13 }}>
                        No uploads yet — go to your Media Library to add clips first.
                      </div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                        {uploads.filter(u => u.file_type === "video" || u.file_type === "image").slice(0, 12).map(u => {
                          const sel = selectedIds.includes(u.id);
                          const thumb = u.thumb_path ? `/${u.thumb_path}` : u.file_type === "image" && u.file_path ? `/${u.file_path}` : null;
                          return (
                            <div key={u.id} onClick={() => setSelectedIds(prev => sel ? prev.filter(x => x !== u.id) : [...prev, u.id])}
                              style={{ position: "relative", borderRadius: 8, overflow: "hidden", aspectRatio: "9/16", background: "#2a2a2a", cursor: "pointer", border: `2px solid ${sel ? "#FF2D2D" : "transparent"}`, transition: "border-color 0.15s" }}>
                              {thumb ? (
                                <img src={thumb} alt={u.file_name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                              ) : (
                                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                                  {u.file_type === "video" ? "▶" : "◻"}
                                </div>
                              )}
                              {sel && (
                                <div style={{ position: "absolute", top: 5, right: 5, width: 20, height: 20, borderRadius: "50%", background: "#FF2D2D", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 800 }}>✓</div>
                              )}
                              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.7))", padding: "14px 6px 5px", fontSize: 9, color: "rgba(255,255,255,0.75)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {u.file_name}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                {selectedIds.length > 0 && (
                  <div style={{ marginBottom: 12, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                    {selectedIds.length} clip{selectedIds.length !== 1 ? "s" : ""} selected — AI will cut and assemble them
                  </div>
                )}
                <button
                  onClick={() => result.projectId && selectedIds.length > 0 && composeVideo(result.projectId, result.script, result.audioBase64)}
                  disabled={selectedIds.length === 0}
                  style={{ width: "100%", background: selectedIds.length > 0 ? "#FF2D2D" : "rgba(255,255,255,0.08)", color: selectedIds.length > 0 ? "#fff" : "rgba(255,255,255,0.25)", border: "none", borderRadius: 999, padding: "13px 22px", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: selectedIds.length > 0 ? "pointer" : "default", transition: "all 0.2s" }}>
                  {selectedIds.length > 0 ? "▶ Compose Video Now" : "Select clips above to compose"}
                </button>
              </div>
            )}

          </div>
        </div>

        {/* Script as storyboard */}
        <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,0.07)", marginBottom: 14, overflow: "hidden" }}>
          <div style={{ padding: "18px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#7c7660" }}>Script</div>
            <button onClick={() => navigator.clipboard?.writeText(result.script)} style={{ fontSize: 11, fontWeight: 700, color: "#FF2D2D", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Copy</button>
          </div>
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
            {scriptLines.map((line, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: i === 0 ? "#FF2D2D" : "#F8F8A6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: i === 0 ? "#fff" : "#7c7660", flexShrink: 0, marginTop: 2 }}>
                  {i === 0 ? "▶" : i + 1}
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: "#1a1a1a", margin: 0, flex: 1 }}>{line}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Caption */}
        {result.caption && (
          <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,0.07)", marginBottom: 14, overflow: "hidden" }}>
            <div style={{ padding: "18px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#7c7660" }}>Caption</div>
              <button onClick={() => navigator.clipboard?.writeText(result.caption || "")} style={{ fontSize: 11, fontWeight: 700, color: "#FF2D2D", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Copy</button>
            </div>
            <div style={{ padding: "16px 20px" }}>
              <p style={{ fontSize: 14, lineHeight: 1.75, color: "#1a1a1a", margin: 0, whiteSpace: "pre-wrap" }}>{result.caption}</p>
            </div>
          </div>
        )}

        {/* Voice upsell */}
        {!result.hasVoice && (
          <div style={{ background: "#F8F8A6", borderRadius: 16, padding: "16px 20px", display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 24, flexShrink: 0 }}>🎙</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>
                {user.subscription_tier === "elite" ? "Set up your Voice Clone" : "Upgrade to hear your voice"}
              </div>
              <div style={{ fontSize: 12, color: "#7c7660" }}>
                {user.subscription_tier === "elite"
                  ? "Go to Settings → Voice Clone Studio and upload 1–5 clips of yourself talking. Lumevo will clone your voice and narrate every project in your actual voice."
                  : "Elite plan includes Voice Clone Studio — upload your videos, Lumevo clones your voice, and every script gets narrated in your actual voice."}
              </div>
            </div>
          </div>
        )}

        {/* AI Creative Director Insights */}
        {composeResult && (composeResult.editorialNote || composeResult.emotionalArc) && (
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid rgba(0,0,0,0.07)", padding: "16px 20px", marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#7c7660", marginBottom: 10 }}>Lumevo&apos;s Edit</div>
            {composeResult.editorialNote && (
              <div style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
                <div style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>◈</div>
                <div style={{ fontSize: 13, color: "#1a1a1a", lineHeight: 1.6 }}>
                  <span style={{ fontWeight: 700, color: "#FF2D2D" }}>Edit strategy: </span>
                  {composeResult.editorialNote}
                </div>
              </div>
            )}
            {composeResult.emotionalArc && (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>◉</div>
                <div style={{ fontSize: 13, color: "#1a1a1a", lineHeight: 1.6 }}>
                  <span style={{ fontWeight: 700, color: "#FF2D2D" }}>Emotional arc: </span>
                  {composeResult.emotionalArc}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Feedback system */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid rgba(0,0,0,0.07)", padding: "16px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#7c7660", marginBottom: 12 }}>How did this land?</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { action: "thumbs_up", label: "✓ Loved it", bg: feedbackSent === "thumbs_up" ? "#FF2D2D" : "#fafaf4", color: feedbackSent === "thumbs_up" ? "#fff" : "#1a1a1a", border: feedbackSent === "thumbs_up" ? "#FF2D2D" : "rgba(0,0,0,0.1)" },
              { action: "thumbs_down", label: "✕ Not quite", bg: feedbackSent === "thumbs_down" ? "#1a1a1a" : "#fafaf4", color: feedbackSent === "thumbs_down" ? "#fff" : "#1a1a1a", border: feedbackSent === "thumbs_down" ? "#1a1a1a" : "rgba(0,0,0,0.1)" },
              { action: "regenerate", label: "↻ Regenerate", bg: "#fafaf4", color: "#1a1a1a", border: "rgba(0,0,0,0.1)" },
            ].map(btn => (
              <button
                key={btn.action}
                onClick={() => {
                  if (btn.action === "regenerate") {
                    logFeedback("regenerate", result.projectId);
                    handleReset();
                  } else {
                    logFeedback(btn.action, result.projectId);
                  }
                }}
                style={{ padding: "9px 18px", borderRadius: 999, border: `1.5px solid ${btn.border}`, background: btn.bg, color: btn.color, fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.15s" }}>
                {btn.label}
              </button>
            ))}
          </div>
          {feedbackSent && feedbackSent !== "regenerate" && (
            <div style={{ marginTop: 10, padding: "10px 14px", background: "#fafaf4", borderRadius: 10, display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ width: 6, height: 6, background: "#FF2D2D", borderRadius: "50%", flexShrink: 0 }} />
              <div style={{ fontSize: 12, color: "#7c7660" }}>
                {feedbackSent === "thumbs_up"
                  ? "Got it — Lumevo will make more content like this."
                  : "Noted — Lumevo is adjusting your style profile to create better content next time."}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (trialBlocked) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 4 }}>New Project</h2>
        </div>
        <div style={{ background: "#1a1a1a", borderRadius: 20, padding: "48px 40px", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>◆</div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, color: "#fff", marginBottom: 12 }}>You&apos;ve used both trial projects</div>
          <div style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", maxWidth: 440, margin: "0 auto 32px", lineHeight: 1.7 }}>
            Your free trial includes 2 projects. To keep creating, pick a plan — your work is saved and you can keep going instantly.
          </div>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            {[{ name: "Creator", price: "$29/mo" }, { name: "Pro", price: "$79/mo" }, { name: "Elite", price: "$149/mo" }].map(p => (
              <button key={p.name} style={{ background: "#FF2D2D", color: "#fff", border: "none", borderRadius: 999, padding: "13px 28px", fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                {p.name} — {p.price}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 20, fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Cancel anytime · No hidden fees</div>
        </div>
      </div>
    );
  }

  function handleReset() {
    setPhase("chat");
    setResult(null);
    setProjectState({ title: null, platforms: null, mediaType: null, vibe: null, duration: null });
    setMessages([{ role: "ai", content: `What's the content about, ${firstName}? Tell me the actual topic — a trip, a product launch, a morning routine, something that happened. The more specific, the better.`, id: 0 }]);
    setMsgCounter(1);
    setSelectedIds([]);
    setCurrentStep(null);
    setNeedsUpload(false);
    setGenerationError(null);
    setDraftProjectId(null);
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        {draftProjectId && projectState.title ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(123,97,255,0.1)", borderRadius: 999, padding: "4px 12px", fontSize: 11, fontWeight: 700, color: "#7B61FF", marginBottom: 8, letterSpacing: 0.5 }}>
                ↩ Resuming saved project
              </div>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 4 }}>{projectState.title}</h2>
              <p style={{ fontSize: 14, color: "#7c7660" }}>Pick up exactly where you left off.</p>
            </div>
            <button onClick={handleReset} style={{ background: "none", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 999, padding: "8px 16px", fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#7c7660", whiteSpace: "nowrap" }}>
              Start fresh
            </button>
          </div>
        ) : (
          <>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 4 }}>New Project</h2>
            <p style={{ fontSize: 14, color: "#7c7660" }}>Tell your AI creative director what you&apos;re making. It handles everything else.</p>
          </>
        )}
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
            <div style={{ marginTop: 8 }}>
              <div style={{ background: "linear-gradient(135deg, #1a1a1a 0%, #2a1a1a 100%)", borderRadius: 16, padding: "18px 20px", marginBottom: 12, color: "#fff" }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 6 }}>Add Your Media</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Upload up to 10 videos or photos</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>AI will analyze each clip, select the best ones, and assemble your video automatically.</div>
              </div>

              {/* Multi-file dropzone */}
              <div
                onClick={() => fileRef.current?.click()}
                style={{ border: "2px dashed rgba(255,45,45,0.3)", borderRadius: 14, padding: "18px 16px", marginBottom: 12, textAlign: "center", cursor: "pointer", background: "rgba(255,45,45,0.02)", transition: "all 0.15s" }}
                onDragOver={e => { e.preventDefault(); }}
                onDrop={e => {
                  e.preventDefault();
                  const dt = e.dataTransfer;
                  if (dt.files.length > 0) {
                    const input = fileRef.current;
                    if (input) {
                      const fake = { target: { files: dt.files } } as unknown as React.ChangeEvent<HTMLInputElement>;
                      handleFileUpload(fake);
                    }
                  }
                }}
              >
                {uploadingFiles ? (
                  <div>
                    <div style={{ width: 32, height: 32, border: "3px solid rgba(255,45,45,0.2)", borderTopColor: "#FF2D2D", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 10px" }} />
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#FF2D2D" }}>Uploading & analyzing…</div>
                    <div style={{ fontSize: 11, color: "#7c7660", marginTop: 4 }}>{uploadProgress.length} file{uploadProgress.length !== 1 ? "s" : ""} · AI vision analysis running</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>⊕</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", marginBottom: 2 }}>Drop videos &amp; photos here</div>
                    <div style={{ fontSize: 11, color: "#7c7660" }}>or click to browse · up to 10 files · MP4, MOV, JPG, PNG</div>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" style={{ display: "none" }} onChange={handleFileUpload}
                accept="video/*,image/*" multiple />

              {/* Google Drive import */}
              <div style={{ marginBottom: 12 }}>
                <button onClick={() => { setGdriveOpen(o => !o); setGdriveError(null); }}
                  style={{ width: "100%", background: "#fff", border: "1.5px solid rgba(0,0,0,0.1)", borderRadius: 12, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                  <svg width="18" height="18" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                    <path d="M43.65 25L29.9 1.2C28.55 2 27.4 3.1 26.6 4.5L1.2 48.5C.4 49.9 0 51.45 0 53h27.5z" fill="#00ac47"/>
                    <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 11.5z" fill="#ea4335"/>
                    <path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.4-4.5 1.2z" fill="#00832d"/>
                    <path d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.4 4.5-1.2z" fill="#2684fc"/>
                    <path d="M73.4 26.5l-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25 59.8 53h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                  </svg>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a" }}>Import from Google Drive</div>
                    <div style={{ fontSize: 10, color: "#7c7660" }}>Paste a share link</div>
                  </div>
                  <span style={{ fontSize: 14, color: "#b5b09a", transform: gdriveOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>⌄</span>
                </button>
                {gdriveOpen && (
                  <div style={{ background: "#fafaf4", border: "1.5px solid rgba(0,0,0,0.08)", borderRadius: 10, padding: 12, marginTop: 6 }}>
                    <div style={{ fontSize: 11, color: "#7c7660", marginBottom: 8, lineHeight: 1.5 }}>
                      Right-click a <strong>specific file</strong> (not a folder) in Drive → <strong>Share</strong> → <strong>Anyone with the link</strong> → copy link
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input
                        value={gdriveUrl}
                        onChange={e => { setGdriveUrl(e.target.value); setGdriveError(null); }}
                        onKeyDown={e => e.key === "Enter" && handleGdriveImport()}
                        placeholder="https://drive.google.com/file/d/..."
                        style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1.5px solid rgba(0,0,0,0.1)", fontFamily: "inherit", fontSize: 12, outline: "none", background: "#fff" }}
                      />
                      <button onClick={handleGdriveImport} disabled={gdriveLoading || !gdriveUrl.trim()}
                        style={{ background: "#FF2D2D", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: gdriveLoading || !gdriveUrl.trim() ? "not-allowed" : "pointer", opacity: !gdriveUrl.trim() ? 0.5 : 1, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 }}>
                        {gdriveLoading ? <><span style={{ display: "inline-block", width: 10, height: 10, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> Importing…</> : "Import"}
                      </button>
                    </div>
                    {gdriveError && <div style={{ marginTop: 6, fontSize: 11, color: "#FF2D2D", fontWeight: 600 }}>{gdriveError}</div>}
                  </div>
                )}
              </div>

              {/* Media thumbnail grid */}
              {localUploads.filter(u => u.file_type === "video" || u.file_type === "image").length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#7c7660", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
                    Your Media Library · tap to select
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                    {localUploads.filter(u => u.file_type === "video" || u.file_type === "image").slice(0, 12).map(u => {
                      const sel = selectedIds.includes(u.id);
                      const analysis = u.ai_analysis as Record<string, string> | null;
                      return (
                        <div key={u.id} onClick={() => toggleSelect(u.id)}
                          style={{ position: "relative", borderRadius: 10, overflow: "hidden", cursor: "pointer", border: `2.5px solid ${sel ? "#FF2D2D" : "transparent"}`, aspectRatio: "1", background: "#1a1a1a", transition: "border 0.15s" }}>
                          {u.thumb_path ? (
                            <img src={u.thumb_path} alt={u.file_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "rgba(255,255,255,0.3)" }}>
                              {u.file_type === "video" ? "▶" : "◻"}
                            </div>
                          )}
                          {/* Selection check */}
                          {sel && (
                            <div style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, background: "#FF2D2D", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", fontWeight: 800 }}>✓</div>
                          )}
                          {/* Analysis badge */}
                          {analysis?.energy && (
                            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "4px 6px", background: "linear-gradient(transparent, rgba(0,0,0,0.8))", fontSize: 9, color: "rgba(255,255,255,0.8)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                              {analysis.energy} energy · {analysis.bestUse || u.file_type}
                            </div>
                          )}
                          {u.analysis_status === "processing" && (
                            <div style={{ position: "absolute", top: 6, left: 6, background: "rgba(0,0,0,0.7)", borderRadius: 4, padding: "2px 6px", fontSize: 9, color: "rgba(255,255,255,0.7)" }}>analyzing…</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Voice clone toggle */}
              {user.elevenlabs_voice_id ? (
                <div onClick={() => setUseVoiceClone(v => !v)}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${useVoiceClone ? "#FF2D2D" : "rgba(0,0,0,0.08)"}`, marginBottom: 10, cursor: "pointer", background: useVoiceClone ? "rgba(255,45,45,0.04)" : "#fafaf4", transition: "all 0.15s" }}>
                  <div style={{ width: 36, height: 20, background: useVoiceClone ? "#FF2D2D" : "rgba(0,0,0,0.12)", borderRadius: 999, position: "relative", flexShrink: 0, transition: "background 0.2s" }}>
                    <div style={{ width: 16, height: 16, background: "#fff", borderRadius: "50%", position: "absolute", top: 2, left: useVoiceClone ? 18 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>🎙 Narrate in my voice</div>
                    <div style={{ fontSize: 11, color: "#7c7660" }}>{user.voice_clone_name || "Your voice clone"} · AI will mix this into the video</div>
                  </div>
                </div>
              ) : user.subscription_tier === "elite" ? (
                <div style={{ background: "#F8F8A6", borderRadius: 12, padding: "12px 14px", marginBottom: 10, fontSize: 12, color: "#7c7660" }}>
                  🎙 Set up your Voice Clone in Settings to narrate this video in your actual voice.
                </div>
              ) : null}

              {/* Music toggle */}
              <div onClick={() => setIncludeMusic(v => !v)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${includeMusic ? "#FF2D2D" : "rgba(0,0,0,0.08)"}`, marginBottom: 10, cursor: "pointer", background: includeMusic ? "rgba(255,45,45,0.04)" : "#fafaf4", transition: "all 0.15s" }}>
                <div style={{ width: 36, height: 20, background: includeMusic ? "#FF2D2D" : "rgba(0,0,0,0.12)", borderRadius: 999, position: "relative", flexShrink: 0, transition: "background 0.2s" }}>
                  <div style={{ width: 16, height: 16, background: "#fff", borderRadius: "50%", position: "absolute", top: 2, left: includeMusic ? 18 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>♪ AI music selection</div>
                  <div style={{ fontSize: 11, color: "#7c7660" }}>Lumevo picks background music that matches your vibe · smart ducking under voice</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleConfirmUploads}
                  style={{ flex: 1, background: "#FF2D2D", color: "#fff", border: "none", borderRadius: 999, padding: "13px 18px", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                  {selectedIds.length > 0
                    ? `✦ Create video with ${selectedIds.length} clip${selectedIds.length !== 1 ? "s" : ""}`
                    : "Create from brand voice only →"}
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
            placeholder={
              currentStep === "title" ? "e.g. My trip to Bali, launching my skincare line, my morning routine…" :
              currentStep === "vibe" ? "e.g. raw and emotional, fun and fast-paced, calm and aesthetic…" :
              "Type anything…"
            }
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
  const [learning, setLearning] = useState(false);
  const [learnResult, setLearnResult] = useState<{ keyInsight?: string; archetype?: string } | null>(null);
  const prog = brand?.learning_progress_percent ?? 0;

  async function runDeepLearning() {
    setLearning(true);
    setLearnResult(null);
    try {
      const res = await fetch("/api/brand/learn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger: "manual" }),
      });
      const data = await res.json() as { keyInsight?: string; archetype?: string; updated?: boolean };
      if (data.updated) {
        setLearnResult({ keyInsight: data.keyInsight, archetype: data.archetype });
        onRefresh();
      }
    } catch { /* silent */ }
    finally { setLearning(false); }
  }

  const archetypeLabel: Record<string, string> = {
    educator: "Educator", entertainer: "Entertainer", inspirational: "Inspirational",
    storyteller: "Storyteller", documenter: "Documenter", provocateur: "Provocateur",
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 6 }}>Creator DNA</h2>
          <p style={{ fontSize: 15, color: "#7c7660" }}>Lumevo builds a living model of your style — it sharpens with every upload, project, and piece of feedback.</p>
        </div>
        <button onClick={runDeepLearning} disabled={learning}
          style={{ background: learning ? "rgba(255,45,45,0.08)" : "#FF2D2D", border: "none", color: learning ? "#FF2D2D" : "#fff", borderRadius: 999, padding: "10px 20px", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: learning ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}>
          {learning ? (
            <>
              <span style={{ display: "inline-block", width: 13, height: 13, border: "2px solid rgba(255,45,45,0.2)", borderTopColor: "#FF2D2D", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              Learning…
            </>
          ) : "◈ Run Deep Learning"}
        </button>
      </div>

      {learnResult?.keyInsight && (
        <div style={{ background: "#1a1a1a", borderRadius: 14, padding: "16px 20px", marginBottom: 20, display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }}>✦</div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 6 }}>What Lumevo just learned</div>
            <div style={{ fontSize: 14, color: "#fff", lineHeight: 1.7 }}>{learnResult.keyInsight}</div>
          </div>
        </div>
      )}

      {/* Progress + archetype */}
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid rgba(0,0,0,0.07)", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", marginBottom: 20 }}>
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 48, color: "#FF2D2D", lineHeight: 1 }}>{prog}%</div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#b5b09a", marginTop: 2 }}>Trained</div>
          </div>
          <div style={{ flex: 1 }}>
            {brand?.creator_archetype && (
              <div style={{ display: "inline-block", background: "#F8F8A6", borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 700, color: "#1a1a1a", marginBottom: 10 }}>
                {archetypeLabel[brand.creator_archetype] || brand.creator_archetype}
              </div>
            )}
            <div style={{ fontSize: 14, color: "#7c7660", lineHeight: 1.7, marginBottom: 10 }}>
              {prog < 20 ? "Just getting started — upload 3+ videos and generate your first project to begin training." :
               prog < 50 ? "Good foundation. Keep uploading and generating — your patterns are becoming clear." :
               prog < 80 ? "Strong profile. Lumevo understands your style. Feedback sharpens it further." :
               "Deeply trained. Every generation is personalized to your exact voice."}
            </div>
            <div style={{ height: 6, background: "#F8F8A6", borderRadius: 999 }}>
              <div style={{ height: "100%", width: `${prog}%`, background: "#FF2D2D", borderRadius: 999, transition: "width 0.8s ease" }} />
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {[
            { label: "Uploads", value: brand?.upload_count ?? 0 },
            { label: "Projects", value: brand?.generation_count ?? 0 },
            { label: "Confidence", value: brand?.confidence_score != null ? `${brand.confidence_score}%` : "0%" },
          ].map(s => (
            <div key={s.label} style={{ background: "#fafaf4", borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: "#1a1a1a" }}>{s.value}</div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#7c7660", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Core voice profile */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#7c7660", marginBottom: 12 }}>Voice Profile</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
          {[
            { label: "Brand Tone", value: brand?.tone_summary },
            { label: "Personality", value: brand?.personality_summary },
            { label: "Audience", value: brand?.audience_summary },
            { label: "Voice Style", value: brand?.voice_preferences },
          ].filter(i => i.value).map(item => (
            <div key={item.label} style={{ background: "#fff", borderRadius: 12, padding: "16px 18px", border: "1px solid rgba(0,0,0,0.07)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 6 }}>{item.label}</div>
              <div style={{ fontSize: 14, color: "#1a1a1a", lineHeight: 1.65 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Creative intelligence */}
      {(brand?.hook_style || brand?.pattern_interrupt_style || brand?.emotional_arc_preference) && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#7c7660", marginBottom: 12 }}>Creative Intelligence</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
            {[
              { label: "Hook Style", value: brand?.hook_style, icon: "◀" },
              { label: "Emotional Arc", value: brand?.emotional_arc_preference, icon: "◉" },
              { label: "Pattern Interrupt", value: brand?.pattern_interrupt_style, icon: "◈" },
            ].filter(i => i.value).map(item => (
              <div key={item.label} style={{ background: "#1a1a1a", borderRadius: 12, padding: "16px 18px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ fontSize: 16, color: "#FF2D2D", flexShrink: 0, marginTop: 2 }}>{item.icon}</div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 5 }}>{item.label}</div>
                  <div style={{ fontSize: 13, color: "#fff", lineHeight: 1.65 }}>{item.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Music + visual */}
      {(brand?.pacing_style || brand?.music_genre_preference || brand?.visual_style_summary) && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#7c7660", marginBottom: 12 }}>Audio &amp; Visual</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { label: "Pacing Style", value: brand?.pacing_style },
              { label: "Music Direction", value: brand?.music_genre_preference },
              { label: "Visual Style", value: brand?.visual_style_summary },
            ].filter(i => i.value).map(item => (
              <div key={item.label} style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", border: "1px solid rgba(0,0,0,0.07)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#7c7660", marginBottom: 6 }}>{item.label}</div>
                <div style={{ fontSize: 13, color: "#1a1a1a", lineHeight: 1.6 }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!brand?.tone_summary && (
        <div style={{ background: "#F8F8A6", borderRadius: 14, padding: "20px 22px", border: "1px solid rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Lumevo is waiting to learn you.</div>
          <div style={{ fontSize: 13, color: "#7c7660", lineHeight: 1.65 }}>Upload 3+ videos of yourself, generate your first project, then click "Run Deep Learning" to build your creator DNA profile.</div>
        </div>
      )}
    </div>
  );
}

// ── PROJECTS ──────────────────────────────────────────────────────────────────
function ProjectDetail({ project, voiceover, onBack, onRecreate }: {
  project: FullProject; voiceover: Voiceover | null; onBack: () => void; onRecreate: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [editingScript, setEditingScript] = useState(false);
  const [editingCaption, setEditingCaption] = useState(false);
  const [saving, setSaving] = useState(false);
  const [liveScript, setLiveScript] = useState(project.generated_content?.script || voiceover?.script_content || "");
  const [liveCaption, setLiveCaption] = useState(project.generated_content?.caption || "");
  const [scriptDraft, setScriptDraft] = useState(liveScript);
  const [captionDraft, setCaptionDraft] = useState(liveCaption);

  const scriptLines = liveScript.split(/\n+/).filter(Boolean);

  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  async function saveField(field: "script" | "caption") {
    setSaving(true);
    const existingContent = project.generated_content || {};
    const newValue = field === "script" ? scriptDraft : captionDraft;
    await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generated_content: { ...existingContent, [field]: newValue } }),
    });
    if (field === "script") { setLiveScript(newValue); setEditingScript(false); }
    if (field === "caption") { setLiveCaption(newValue); setEditingCaption(false); }
    setSaving(false);
  }

  return (
    <div>
      {/* Back + header */}
      <div style={{ marginBottom: 28 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#7c7660", fontFamily: "inherit", padding: 0, marginBottom: 18, display: "flex", alignItems: "center", gap: 6 }}>
          ← All Projects
        </button>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 6 }}>
              ✦ {project.status}
            </div>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 6, lineHeight: 1.2 }}>{project.title}</h2>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "#7c7660", background: "#F8F8A6", padding: "3px 10px", borderRadius: 999 }}>{PLATFORM_LABELS[project.target_platform]}</span>
              {project.target_duration && <span style={{ fontSize: 11, color: "#7c7660", background: "#F8F8A6", padding: "3px 10px", borderRadius: 999 }}>{project.target_duration}s</span>}
              {project.vibe && <span style={{ fontSize: 11, color: "#7c7660", background: "#F8F8A6", padding: "3px 10px", borderRadius: 999 }}>{project.vibe.slice(0, 36)}</span>}
              <span style={{ fontSize: 11, color: "#b5b09a", padding: "3px 0" }}>{fmtDate(project.updated_at)}</span>
            </div>
          </div>
          <button onClick={onRecreate} style={{ background: "#FF2D2D", color: "#fff", border: "none", borderRadius: 999, padding: "10px 18px", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
            + New from this
          </button>
        </div>
      </div>

      {/* Script */}
      {liveScript ? (
        <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,0.07)", marginBottom: 14, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#7c7660" }}>Script</div>
            <div style={{ display: "flex", gap: 10 }}>
              {!editingScript && <button onClick={() => { setScriptDraft(liveScript); setEditingScript(true); }} style={{ fontSize: 11, fontWeight: 700, color: "#7c7660", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Edit</button>}
              <button onClick={() => copy(liveScript, "script")} style={{ fontSize: 11, fontWeight: 700, color: "#FF2D2D", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                {copied === "script" ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
          {editingScript ? (
            <div style={{ padding: "16px 20px" }}>
              <textarea
                value={scriptDraft}
                onChange={e => setScriptDraft(e.target.value)}
                style={{ width: "100%", minHeight: 200, padding: "12px 14px", borderRadius: 10, border: "1.5px solid rgba(255,45,45,0.3)", fontFamily: "inherit", fontSize: 14, lineHeight: 1.7, resize: "vertical", outline: "none", background: "#fafaf4", boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={() => saveField("script")} disabled={saving} style={{ background: "#FF2D2D", color: "#fff", border: "none", borderRadius: 999, padding: "8px 18px", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  {saving ? "Saving…" : "Save"}
                </button>
                <button onClick={() => setEditingScript(false)} style={{ background: "none", border: "1.5px solid rgba(0,0,0,0.1)", borderRadius: 999, padding: "8px 18px", fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#7c7660" }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
              {scriptLines.map((line, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: i === 0 ? "#FF2D2D" : "#F8F8A6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: i === 0 ? "#fff" : "#7c7660", flexShrink: 0, marginTop: 2 }}>
                    {i === 0 ? "▶" : i + 1}
                  </div>
                  <p style={{ fontSize: 14, lineHeight: 1.7, color: "#1a1a1a", margin: 0, flex: 1 }}>{line}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ background: "#fafaf4", borderRadius: 20, border: "1px solid rgba(0,0,0,0.07)", marginBottom: 14, padding: "28px 24px", textAlign: "center", color: "#b5b09a", fontSize: 14 }}>
          No script generated for this project yet.
        </div>
      )}

      {/* Caption */}
      <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,0.07)", marginBottom: 14, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#7c7660" }}>Caption</div>
          <div style={{ display: "flex", gap: 10 }}>
            {!editingCaption && liveCaption && <button onClick={() => { setCaptionDraft(liveCaption); setEditingCaption(true); }} style={{ fontSize: 11, fontWeight: 700, color: "#7c7660", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Edit</button>}
            {liveCaption && <button onClick={() => copy(liveCaption, "caption")} style={{ fontSize: 11, fontWeight: 700, color: "#FF2D2D", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              {copied === "caption" ? "Copied!" : "Copy"}
            </button>}
          </div>
        </div>
        {editingCaption ? (
          <div style={{ padding: "16px 20px" }}>
            <textarea
              value={captionDraft}
              onChange={e => setCaptionDraft(e.target.value)}
              style={{ width: "100%", minHeight: 120, padding: "12px 14px", borderRadius: 10, border: "1.5px solid rgba(255,45,45,0.3)", fontFamily: "inherit", fontSize: 14, lineHeight: 1.7, resize: "vertical", outline: "none", background: "#fafaf4", boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={() => saveField("caption")} disabled={saving} style={{ background: "#FF2D2D", color: "#fff", border: "none", borderRadius: 999, padding: "8px 18px", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button onClick={() => setEditingCaption(false)} style={{ background: "none", border: "1.5px solid rgba(0,0,0,0.1)", borderRadius: 999, padding: "8px 18px", fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#7c7660" }}>
                Cancel
              </button>
            </div>
          </div>
        ) : liveCaption ? (
          <div style={{ padding: "16px 20px" }}>
            <p style={{ fontSize: 14, lineHeight: 1.75, color: "#1a1a1a", margin: 0, whiteSpace: "pre-wrap" }}>{liveCaption}</p>
          </div>
        ) : (
          <div style={{ padding: "14px 20px" }}>
            <button onClick={() => { setCaptionDraft(""); setEditingCaption(true); }} style={{ background: "none", border: "1.5px dashed rgba(0,0,0,0.15)", borderRadius: 10, padding: "10px 16px", fontFamily: "inherit", fontSize: 13, color: "#7c7660", cursor: "pointer", width: "100%", textAlign: "left" }}>
              + Add a caption
            </button>
          </div>
        )}
      </div>

      {/* Voiceover info */}
      {voiceover && (
        <div style={{ background: "#1a1a1a", borderRadius: 20, padding: "18px 22px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 8 }}>Voice Clone Used</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>Narrated with voice ID: {voiceover.provider_voice_id || "your clone"} · {fmtDate(voiceover.created_at)}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>Re-create this project to generate fresh narration audio.</div>
        </div>
      )}
    </div>
  );
}

function ProjectsSection({ projects, onNav, initialProjectId, onClearInitial }: {
  projects: Project[]; onNav: (s: Section, projectId?: string) => void; initialProjectId?: string | null; onClearInitial?: () => void;
}) {
  const [filter, setFilter] = useState("all");
  const [viewing, setViewing] = useState<{ project: FullProject; voiceover: Voiceover | null } | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const isDraft = (status: string) => status === "chatting" || status === "generating";

  const filtered = filter === "all" ? projects : projects.filter(p => p.project_type === filter || p.target_platform === filter);

  async function openProject(id: string) {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (res.ok) {
        const data = await res.json();
        setViewing({ project: data.project as FullProject, voiceover: data.voiceover as Voiceover | null });
      }
    } finally {
      setLoadingId(null);
    }
  }

  useEffect(() => {
    if (initialProjectId && !viewing) {
      openProject(initialProjectId);
      onClearInitial?.();
    }
  }, [initialProjectId]);

  if (viewing) {
    return (
      <ProjectDetail
        project={viewing.project}
        voiceover={viewing.voiceover}
        onBack={() => setViewing(null)}
        onRecreate={() => onNav("video")}
      />
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 36 }}>
        <div>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 6 }}>Projects</h2>
          <p style={{ fontSize: 15, color: "#7c7660" }}>Your full content history. Click any project to view, edit, or copy.</p>
        </div>
        <button onClick={() => onNav("video")}
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
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(p => {
            const isLoading = loadingId === p.id;
            const draft = isDraft(p.status);
            return (
              <div key={p.id} style={{ width: "100%", background: draft ? "rgba(123,97,255,0.04)" : "#fff", borderRadius: 16, padding: "18px 20px", border: `1px solid ${draft ? "rgba(123,97,255,0.2)" : "rgba(0,0,0,0.07)"}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    {p.project_type && p.project_type !== "video" && <span style={{ fontSize: 11, color: "#7c7660", background: "#F8F8A6", padding: "2px 8px", borderRadius: 999 }}>{TYPE_LABELS[p.project_type] || p.project_type}</span>}
                    {p.target_platform && <span style={{ fontSize: 11, color: "#7c7660", background: "#F8F8A6", padding: "2px 8px", borderRadius: 999 }}>{PLATFORM_LABELS[p.target_platform] || p.target_platform}</span>}
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: `${STATUS_COLORS[p.status] || "#7c7660"}18`, color: STATUS_COLORS[p.status] || "#7c7660" }}>
                      {draft ? (p.status === "chatting" ? "In chat" : "Generating") : p.status}
                    </span>
                    <span style={{ fontSize: 11, color: "#b5b09a" }}>{fmtDate(p.updated_at)}</span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  {draft ? (
                    <>
                      <button
                        onClick={() => onNav("video", p.id)}
                        style={{ background: "#7B61FF", color: "#fff", border: "none", borderRadius: 999, padding: "8px 16px", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                      >
                        Resume →
                      </button>
                    </>
                  ) : (
                    <button onClick={() => openProject(p.id)} disabled={!!loadingId}
                      style={{ background: "none", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 999, padding: "7px 14px", fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: isLoading ? "wait" : "pointer", color: "#1a1a1a", whiteSpace: "nowrap" }}
                    >
                      {isLoading ? "…" : "View →"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "80px 0", color: "#7c7660" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>◻</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No projects yet</div>
          <div style={{ fontSize: 14, marginBottom: 20 }}>Create your first piece of content to get started.</div>
          <button onClick={() => onNav("video")}
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
  const isTrial = user.subscription_tier === "trial";
  const daysLeft = trialDaysLeft(user.trial_started_at);
  const trialEndDt = user.trial_started_at ? new Date(new Date(user.trial_started_at).getTime() + TRIAL_DAYS * 86400000) : null;
  const trialEndDate = trialEndDt ? fmtDate(trialEndDt.toISOString()) : "";

  const PLANS = [
    { id: "creator", name: "Creator", price: "$29", period: "/mo", features: ["50 uploads/month", "100 AI generations", "Full brand learning", "All content types", "Weekly content ideas", "Cancel anytime"] },
    { id: "pro", name: "Pro", price: "$79", period: "/mo", features: ["Unlimited uploads", "Unlimited generations", "Full personality profile", "Multi-platform content", "Advanced project history", "Cancel anytime"] },
    { id: "elite", name: "Elite", price: "$149", period: "/mo", features: ["Everything in Pro", "AI Video Creation", "Voice Clone Studio — sounds exactly like you", "Agentic creative director", "Advanced creative briefs", "Priority support", "Cancel anytime"] },
  ];

  return (
    <div>
      <div style={{ marginBottom: 36 }}>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 6 }}>Billing</h2>
        <p style={{ fontSize: 15, color: "#7c7660" }}>
          {isTrial ? "You're on a free trial — choose a plan to keep going after your trial ends." : `You are on the ${TIER_LABELS[user.subscription_tier]} plan.`}
        </p>
      </div>

      {isTrial && (
        <div style={{ background: "#1a1a1a", borderRadius: 20, padding: "28px", marginBottom: 24, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, right: 0, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,45,45,0.08)", transform: "translate(40px,-60px)" }} />
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 10 }}>Your Free Trial</div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 8 }}>2 projects · 14 days · Full access</div>
          <div style={{ display: "flex", gap: 32, marginBottom: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#FF2D2D", fontFamily: "'Syne', sans-serif" }}>{daysLeft}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>days left</div>
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif" }}>{trialEndDate || "—"}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>trial ends</div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
            After your trial, you&apos;ll automatically move to Creator ($29/mo). Your card on file will be billed on {trialEndDate || "your trial end date"}. Cancel anytime before then to avoid being charged.
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 14 }}>
        {PLANS.map(plan => {
          const current = plan.id === user.subscription_tier;
          const isAutoRenew = isTrial && plan.id === "creator";
          return (
            <div key={plan.id} style={{ background: current ? "#1a1a1a" : "#fff", borderRadius: 20, padding: "24px 22px", border: `2px solid ${current || isAutoRenew ? "#FF2D2D" : "rgba(0,0,0,0.07)"}`, position: "relative" }}>
              {isAutoRenew && (
                <div style={{ position: "absolute", top: -1, right: 16, background: "#FF2D2D", color: "#fff", fontSize: 10, fontWeight: 800, letterSpacing: 1, padding: "4px 10px", borderRadius: "0 0 8px 8px", textTransform: "uppercase" }}>Auto-renews</div>
              )}
              <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 22, color: "#FF2D2D", marginBottom: 4 }}>{plan.name}</div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 800, color: current ? "#fff" : "#1a1a1a", marginBottom: 16 }}>
                {plan.price}<span style={{ fontSize: 14, fontWeight: 400, color: current ? "rgba(255,255,255,0.5)" : "#7c7660" }}>{plan.period}</span>
              </div>
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
                  {isTrial ? `Start ${plan.name}` : `Upgrade to ${plan.name}`}
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
function VoiceCloneStudio({ user, onCloneCreated }: { user: User; onCloneCreated: (voiceId: string, name: string) => void }) {
  const isElite = user.subscription_tier === "elite";
  const hasClone = !!user.elevenlabs_voice_id;

  // Manual ID state (non-elite or fallback)
  const [voiceId, setVoiceId] = useState(user.elevenlabs_voice_id || "");
  const [savingVoice, setSavingVoice] = useState(false);
  const [voiceSaved, setVoiceSaved] = useState(false);

  // Elite clone creation state
  const [cloneName, setCloneName] = useState(user.voice_clone_name || user.name || "");
  const [samples, setSamples] = useState<{ name: string; mimeType: string; base64: string; sizeMB: number }[]>([]);
  const [cloning, setCloning] = useState(false);
  const [cloneError, setCloneError] = useState("");
  const sampleRef = useRef<HTMLInputElement>(null);

  // Test voice state
  const [testText, setTestText] = useState("Hey, this is me testing my voice clone on Lumevo. Sounds just like me, right?");
  const [testing, setTesting] = useState(false);
  const [testAudioSrc, setTestAudioSrc] = useState("");
  const [removing, setRemoving] = useState(false);

  async function saveVoiceId() {
    setSavingVoice(true);
    await fetch("/api/settings/voice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voiceId: voiceId.trim() }) });
    setSavingVoice(false);
    setVoiceSaved(true);
    onCloneCreated(voiceId.trim(), "");
    setTimeout(() => setVoiceSaved(false), 2500);
  }

  async function handleSampleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const loaded = await Promise.all(files.map(f => new Promise<{ name: string; mimeType: string; base64: string; sizeMB: number }>((res) => {
      const reader = new FileReader();
      reader.onload = () => {
        const b64 = (reader.result as string).split(",")[1] || "";
        res({ name: f.name, mimeType: f.type, base64: b64, sizeMB: +(f.size / 1024 / 1024).toFixed(1) });
      };
      reader.readAsDataURL(f);
    })));
    setSamples(prev => [...prev, ...loaded].slice(0, 5));
    e.target.value = "";
  }

  async function createClone() {
    if (!cloneName.trim() || !samples.length) return;
    setCloning(true);
    setCloneError("");
    const res = await fetch("/api/voice/clone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cloneName: cloneName.trim(), samples: samples.map(s => ({ name: s.name, mimeType: s.mimeType, base64: s.base64 })) }),
    });
    const data = await res.json() as { voiceId?: string; cloneName?: string; error?: string };
    setCloning(false);
    if (!res.ok) { setCloneError(data.error || "Cloning failed. Try again."); return; }
    onCloneCreated(data.voiceId!, data.cloneName || cloneName);
    setSamples([]);
  }

  async function testVoice() {
    if (!user.elevenlabs_voice_id || !testText.trim()) return;
    setTesting(true);
    const res = await fetch("/api/voice/synthesize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voiceId: user.elevenlabs_voice_id, text: testText }),
    });
    if (res.ok) {
      const buf = await res.arrayBuffer();
      const blob = new Blob([buf], { type: "audio/mpeg" });
      setTestAudioSrc(URL.createObjectURL(blob));
    }
    setTesting(false);
  }

  async function removeClone() {
    setRemoving(true);
    await fetch("/api/voice/clone", { method: "DELETE" });
    setRemoving(false);
    setVoiceId("");
    setSamples([]);
    setTestAudioSrc("");
    onCloneCreated("", "");
  }

  if (!isElite) {
    return (
      <div style={{ background: "#fff", borderRadius: 20, padding: 28, border: "1px solid rgba(0,0,0,0.07)", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#7c7660" }}>🎙 Voice Clone</div>
          {user.elevenlabs_voice_id && <span style={{ fontSize: 11, fontWeight: 700, background: "#F8F8A6", padding: "3px 10px", borderRadius: 999, color: "#7c7660" }}>Connected</span>}
        </div>
        <p style={{ fontSize: 13, color: "#7c7660", marginBottom: 16, lineHeight: 1.6 }}>
          Paste your ElevenLabs Voice ID to let Lumevo narrate videos in your voice.
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
          <input value={voiceId} onChange={e => setVoiceId(e.target.value)} placeholder="e.g. abc123xyz456..."
            style={{ flex: 1, padding: "11px 14px", borderRadius: 10, border: "1.5px solid rgba(0,0,0,0.1)", fontFamily: "monospace", fontSize: 13, outline: "none", background: "#fafaf4" }} />
          <button onClick={saveVoiceId} disabled={savingVoice || !voiceId.trim()}
            style={{ background: voiceSaved ? "#2da44e" : "#FF2D2D", color: "#fff", border: "none", borderRadius: 10, padding: "11px 20px", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
            {voiceSaved ? "Saved ✓" : savingVoice ? "Saving…" : "Save"}
          </button>
        </div>
        <div style={{ background: "#F8F8A6", borderRadius: 12, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ fontSize: 18, flexShrink: 0 }}>✦</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>Upgrade to Elite for Voice Clone Studio</div>
            <div style={{ fontSize: 12, color: "#7c7660", lineHeight: 1.5 }}>Upload your videos, Lumevo extracts your voice and creates a full clone — no ElevenLabs account needed. Your content sounds exactly like you.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,0.07)", marginBottom: 16, overflow: "hidden" }}>
      <div style={{ background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)", padding: "22px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 6 }}>Elite Feature</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 2 }}>🎙 Voice Clone Studio</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>Upload your videos. Lumevo clones your voice. Every script sounds exactly like you.</div>
          </div>
          {hasClone && (
            <div style={{ background: "#2da44e", color: "#fff", fontSize: 11, fontWeight: 800, letterSpacing: 1, padding: "4px 12px", borderRadius: 999 }}>● Active</div>
          )}
        </div>
      </div>

      <div style={{ padding: 28 }}>
        {hasClone ? (
          <>
            <div style={{ background: "#fafaf4", borderRadius: 14, padding: "18px 20px", marginBottom: 20, display: "flex", gap: 16, alignItems: "center" }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#FF2D2D", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🎙</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>{user.voice_clone_name || "Your Voice Clone"}</div>
                <div style={{ fontSize: 12, color: "#7c7660", fontFamily: "monospace" }}>ID: {user.elevenlabs_voice_id?.slice(0, 18)}…</div>
              </div>
              <button onClick={removeClone} disabled={removing}
                style={{ background: "none", border: "1px solid rgba(255,45,45,0.2)", color: "#FF2D2D", fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit" }}>
                {removing ? "Removing…" : "Remove"}
              </button>
            </div>

            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#7c7660", marginBottom: 10 }}>Test your clone</div>
              <textarea value={testText} onChange={e => setTestText(e.target.value)} rows={2}
                style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid rgba(0,0,0,0.1)", fontFamily: "inherit", fontSize: 13, outline: "none", background: "#fafaf4", resize: "none", boxSizing: "border-box", marginBottom: 10 }} />
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button onClick={testVoice} disabled={testing || !testText.trim()}
                  style={{ background: "#1a1a1a", color: "#fff", border: "none", borderRadius: 999, padding: "10px 22px", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  {testing ? "Generating…" : "▶ Play my voice"}
                </button>
                {testAudioSrc && (
                  <audio controls autoPlay src={testAudioSrc} style={{ height: 36, flex: 1, accentColor: "#FF2D2D" }} />
                )}
              </div>
            </div>

            <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#7c7660", marginBottom: 10 }}>Recalibrate your clone</div>
              <p style={{ fontSize: 12, color: "#7c7660", marginBottom: 12, lineHeight: 1.6 }}>Upload new samples to replace your current voice clone with an updated version.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center", marginBottom: 12 }}>
                <input value={cloneName} onChange={e => setCloneName(e.target.value)} placeholder="Clone name…"
                  style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid rgba(0,0,0,0.1)", fontFamily: "inherit", fontSize: 13, outline: "none", background: "#fafaf4" }} />
                <button onClick={() => sampleRef.current?.click()}
                  style={{ background: "#F8F8A6", color: "#1a1a1a", border: "none", borderRadius: 10, padding: "10px 18px", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                  + Add samples
                </button>
              </div>
              <input ref={sampleRef} type="file" multiple style={{ display: "none" }} onChange={handleSampleUpload} accept="video/*,audio/*" />
              {samples.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                  {samples.map((s, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: "#fafaf4", fontSize: 12 }}>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                      <span style={{ color: "#7c7660" }}>{s.sizeMB} MB</span>
                      <button onClick={() => setSamples(p => p.filter((_, j) => j !== i))} style={{ color: "#FF2D2D", background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: 0 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
              {cloneError && <div style={{ fontSize: 12, color: "#FF2D2D", marginBottom: 10 }}>{cloneError}</div>}
              {samples.length > 0 && (
                <button onClick={createClone} disabled={cloning || !cloneName.trim()}
                  style={{ background: "#FF2D2D", color: "#fff", border: "none", borderRadius: 999, padding: "10px 22px", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  {cloning ? "Cloning…" : "Recalibrate clone →"}
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: "#7c7660", lineHeight: 1.7, marginBottom: 18 }}>
                Upload 1–5 videos or voice recordings of yourself talking naturally. The more natural and varied the better — aim for at least 1 minute of total audio.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center", marginBottom: 14 }}>
                <input value={cloneName} onChange={e => setCloneName(e.target.value)} placeholder="Name your clone (e.g. Taylor's Voice)"
                  style={{ padding: "11px 14px", borderRadius: 10, border: "1.5px solid rgba(0,0,0,0.1)", fontFamily: "inherit", fontSize: 13, outline: "none", background: "#fafaf4" }} />
                <button onClick={() => sampleRef.current?.click()}
                  style={{ background: "#F8F8A6", color: "#1a1a1a", border: "none", borderRadius: 10, padding: "11px 18px", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                  ↑ Upload samples
                </button>
              </div>
              <input ref={sampleRef} type="file" multiple style={{ display: "none" }} onChange={handleSampleUpload} accept="video/*,audio/*" />

              {samples.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                  {samples.map((s, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: "#fafaf4", border: "1.5px solid rgba(0,0,0,0.06)" }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: "#FF2D2D", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", flexShrink: 0, fontWeight: 700 }}>▶</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: "#7c7660" }}>{s.sizeMB} MB</div>
                      </div>
                      <button onClick={() => setSamples(p => p.filter((_, j) => j !== i))} style={{ color: "#7c7660", background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: "0 4px" }}>×</button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ background: "#fafaf4", borderRadius: 12, padding: "22px", textAlign: "center", marginBottom: 16, border: "1.5px dashed rgba(0,0,0,0.1)" }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>🎙</div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No samples yet</div>
                  <div style={{ fontSize: 12, color: "#7c7660" }}>Upload videos or audio clips of yourself talking naturally</div>
                </div>
              )}

              {cloneError && <div style={{ fontSize: 13, color: "#FF2D2D", marginBottom: 12, fontWeight: 500 }}>{cloneError}</div>}

              <button onClick={createClone} disabled={cloning || !cloneName.trim() || !samples.length}
                style={{ width: "100%", background: samples.length && cloneName.trim() ? "#FF2D2D" : "rgba(0,0,0,0.08)", color: samples.length && cloneName.trim() ? "#fff" : "#7c7660", border: "none", borderRadius: 12, padding: "14px", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: samples.length && cloneName.trim() ? "pointer" : "default", transition: "all 0.2s" }}>
                {cloning ? "Cloning your voice… this may take 30s" : "🎙 Clone my voice →"}
              </button>
            </div>

            <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#7c7660", marginBottom: 10 }}>Or paste an existing Voice ID</div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input value={voiceId} onChange={e => setVoiceId(e.target.value)} placeholder="ElevenLabs Voice ID…"
                  style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1.5px solid rgba(0,0,0,0.1)", fontFamily: "monospace", fontSize: 13, outline: "none", background: "#fafaf4" }} />
                <button onClick={saveVoiceId} disabled={savingVoice || !voiceId.trim()}
                  style={{ background: voiceSaved ? "#2da44e" : "#1a1a1a", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                  {voiceSaved ? "Saved ✓" : "Save"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Settings({ user, onLogout, onUserUpdate }: { user: User; onLogout: () => void; onUserUpdate: (patch: Partial<User>) => void }) {
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

      <VoiceCloneStudio user={user} onCloneCreated={(vid, name) => onUserUpdate({ elevenlabs_voice_id: vid || undefined, voice_clone_name: name || undefined })} />

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
  const isLocked = false;

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
interface AIMgrMessage { role: "user" | "assistant"; content: string; }

const QUICK_COMMANDS = [
  "Make this feel more expensive",
  "Turn my uploads into a launch reel",
  "Write a voiceover for my latest project",
  "Create 3 directions for different audiences",
  "Plan next week's content from my uploads",
  "What should I post this week?",
];

function AIManagerSection({ user, brand, onNav }: { user: User; brand: BrandProfile | null; onNav: (s: Section) => void }) {
  const [messages, setMessages] = useState<AIMgrMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isElite = user.subscription_tier === "elite";

  async function send(text?: string) {
    const msg = text || input.trim();
    if (!msg || thinking) return;
    setInput("");
    const newMessages: AIMgrMessage[] = [...messages, { role: "user", content: msg }];
    setMessages(newMessages);
    setThinking(true);

    try {
      const res = await fetch("/api/ai-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history: messages }),
      });
      const data = await res.json() as { reply?: string };
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
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [resumeDraftId, setResumeDraftId] = useState<string | null>(null);

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

  function navigate(s: Section, projectId?: string) {
    setSection(s);
    setSidebarOpen(false);
    window.scrollTo(0, 0);
    if (s === "projects" && projectId) {
      setSelectedProjectId(projectId);
    } else if (s !== "projects") {
      setSelectedProjectId(null);
    }
    if (s === "video" && projectId) {
      setResumeDraftId(projectId);
    } else if (s === "video" && !projectId) {
      setResumeDraftId(null);
    }
  }

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
            {section === "video" && <CreateVideo uploads={uploads} user={user} projects={projects} resumeDraftId={resumeDraftId} onResumeConsumed={() => setResumeDraftId(null)} />}
            {section === "brand" && <BrandSection brand={brand} onRefresh={fetchData} />}
            {section === "projects" && <ProjectsSection projects={projects} onNav={navigate} initialProjectId={selectedProjectId} onClearInitial={() => setSelectedProjectId(null)} />}
            {section === "plan" && <ContentPlan user={user} onNav={navigate} />}
            {section === "aimanager" && <AIManagerSection user={user} brand={brand} onNav={navigate} />}
            {section === "analytics" && <Analytics />}
            {section === "billing" && <Billing user={user} />}
            {section === "settings" && <Settings user={user} onLogout={handleLogout} onUserUpdate={(patch) => setUser(prev => prev ? { ...prev, ...patch } : prev)} />}
          </div>
        </main>
      </div>
      </div>
    </>
  );
}
