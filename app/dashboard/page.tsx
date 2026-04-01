"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

type Section = "studio" | "create" | "library" | "style" | "brand" | "analytics" | "settings";

interface User { id: string; name: string; email: string; subscription_tier: string; created_at: string; trial_started_at?: string; elevenlabs_voice_id?: string; voice_clone_name?: string; }
interface Upload { id: string; file_type: string; file_name: string; mime_type: string; file_size: number; analysis_status: string; created_at: string; file_path?: string | null; thumb_path?: string | null; ai_analysis?: Record<string, string> | null; video_duration_sec?: number | null; }
interface Project { id: string; title: string; project_type: string; target_platform: string; target_duration?: number; vibe?: string; status: string; created_at: string; updated_at: string; }
interface BrandProfile { user_id: string; tone_summary: string; personality_summary: string; audience_summary: string; pacing_style: string; cta_style: string; visual_style_summary?: string; voice_preferences?: string; hook_style?: string; creator_archetype?: string; music_genre_preference?: string; confidence_score: number; learning_progress_percent: number; upload_count: number; generation_count: number; last_learned_at?: string; }

const TIER_LABELS: Record<string, string> = { trial: "Free Trial", creator: "Creator", pro: "Pro", elite: "Elite" };
const STATUS_COLORS: Record<string, string> = { draft: "#999", planned: "#7B61FF", rendering: "#FF8C00", completed: "#2da44e", failed: "#FF2D2D" };
const PLATFORM_LABELS: Record<string, string> = { tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube", general: "General" };

function fmt(bytes: number) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / 1048576).toFixed(1)} MB`; }
function fmtDate(d: string) {
  const dt = new Date(d);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[dt.getUTCMonth()]} ${dt.getUTCDate()}, ${dt.getUTCFullYear()}`;
}

// ─── STUDIO (HOME) ──────────────────────────────────────────────────────────
function StudioSection({ user, uploads, projects, brand, onNav }: {
  user: User; uploads: Upload[]; projects: Project[]; brand: BrandProfile | null; onNav: (s: Section) => void;
}) {
  const router = useRouter();
  const firstName = user.name.split(" ")[0];
  const prog = brand?.learning_progress_percent ?? 0;
  const aiStatus = prog < 20 ? "learning your style" : prog < 60 ? "getting to know you" : "ready";

  const STYLE_PRESETS = [
    { name: "Luxe Beach", sub: "Soft, Warm Tones", icon: "○" },
    { name: "Clean Editorial", sub: "Minimal, Modern", icon: "□" },
    { name: "Playful Country", sub: "Fast Cuts, Upbeat", icon: "◇" },
  ];

  const CREATE_CARDS = [
    { icon: "▷", title: "Start from Clips", sub: "Upload your media", action: () => onNav("create") },
    { icon: "✦", title: "Start from Idea", sub: "Describe your vision", action: () => onNav("create") },
    { icon: "↺", title: "Recreate a Style", sub: "Match a look & feel", action: () => onNav("style") },
  ];

  return (
    <div style={{ maxWidth: 860 }}>
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 3, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 14 }}>LUMEVO</div>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 40, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 6, color: "#1a1a1a" }}>
          Hey, {firstName}
        </h1>
        <p style={{ fontSize: 18, color: "#1a1a1a", fontWeight: 500, marginBottom: 4 }}>Let&apos;s create something worth posting.</p>
        <p style={{ fontSize: 14, color: "#7c7660" }}>Your AI is {aiStatus}.</p>
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: 12, marginBottom: 48 }}>
        <button onClick={() => onNav("create")}
          style={{ background: "#FF2D2D", color: "#fff", border: "none", borderRadius: 12, padding: "14px 28px", fontFamily: "inherit", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
          Start a Video
        </button>
        <button onClick={() => onNav("library")}
          style={{ background: "#fff", color: "#1a1a1a", border: "1.5px solid rgba(0,0,0,0.12)", borderRadius: 12, padding: "14px 28px", fontFamily: "inherit", fontSize: 16, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>■</span> Upload Clips
        </button>
      </div>

      {/* Create Section */}
      <div style={{ marginBottom: 44 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", marginBottom: 14 }}>Create</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {CREATE_CARDS.map(card => (
            <div key={card.title} onClick={card.action}
              style={{ background: "#fff", borderRadius: 16, padding: "22px 20px", border: "1px solid rgba(0,0,0,0.08)", cursor: "pointer", transition: "box-shadow 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.08)")}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}>
              <div style={{ fontSize: 18, color: "#7c7660", marginBottom: 12 }}>{card.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>{card.title}</div>
              <div style={{ fontSize: 12, color: "#7c7660" }}>{card.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Your Style */}
      <div style={{ marginBottom: 44 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", marginBottom: 14 }}>Your Style</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {STYLE_PRESETS.map(preset => (
            <div key={preset.name} onClick={() => onNav("style")}
              style={{ background: "#fff", borderRadius: 16, padding: "22px 20px", border: "1px solid rgba(0,0,0,0.08)", cursor: "pointer", transition: "box-shadow 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.08)")}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}>
              <div style={{ fontSize: 18, color: "#7c7660", marginBottom: 12 }}>{preset.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>{preset.name}</div>
              <div style={{ fontSize: 12, color: "#7c7660" }}>{preset.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Stories */}
      {projects.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", marginBottom: 14 }}>Recent Stories</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {projects.slice(0, 6).map(p => {
              const thumb = (uploads.find(u => u.file_path && u.file_type === "image"))?.file_path;
              return (
                <div key={p.id} onClick={() => router.push(`/project/${p.id}`)}
                  style={{ background: "#fff", borderRadius: 16, overflow: "hidden", border: "1px solid rgba(0,0,0,0.08)", cursor: "pointer", transition: "box-shadow 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.08)")}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}>
                  {thumb ? (
                    <img src={thumb} alt={p.title} style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }} />
                  ) : (
                    <div style={{ width: "100%", height: 140, background: "#ddd3a8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ fontSize: 28, color: "#c5b99a" }}>▷</div>
                    </div>
                  )}
                  <div style={{ padding: "12px 14px" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a", marginBottom: 2 }}>{p.title}</div>
                    <div style={{ fontSize: 11, color: STATUS_COLORS[p.status] || "#7c7660", fontWeight: 600, textTransform: "capitalize" }}>{p.status}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CREATE (VIDEO FLOW) ─────────────────────────────────────────────────────
function CreateSection({ user, uploads, onRefresh }: { user: User; uploads: Upload[]; onRefresh: () => void }) {
  const router = useRouter();
  type FlowStep = "details" | "upload" | "generate";
  const [step, setStep] = useState<FlowStep>("details");
  const [projectName, setProjectName] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [vibe, setVibe] = useState("cinematic");
  const [duration, setDuration] = useState(30);
  const [draftProjectId, setDraftProjectId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [localUploads, setLocalUploads] = useState<Upload[]>(uploads);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [gdriveInput, setGdriveInput] = useState("");
  const [gdriveImporting, setGdriveImporting] = useState(false);
  const [gdriveStatus, setGdriveStatus] = useState<string | null>(null);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [genStatus, setGenStatus] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setLocalUploads(uploads); }, [uploads]);

  async function saveProject() {
    if (!projectName.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: projectName.trim(), target_platform: platform, vibe, target_duration: duration, project_type: "video" }),
      });
      const data = await res.json();
      if (data.project?.id) setDraftProjectId(data.project.id);
    } catch (err) { console.error(err); }
    setSaving(false);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingFiles(true);
    try {
      const newUploads: Upload[] = [];
      for (const file of files) {
        const sigRes = await fetch("/api/uploads/sign");
        const sig = await sigRes.json();
        const form = new FormData();
        form.append("file", file); form.append("signature", sig.signature); form.append("timestamp", String(sig.timestamp)); form.append("folder", sig.folder); form.append("api_key", sig.apiKey);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`, { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || "Upload failed");
        const saveRes = await fetch("/api/uploads", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: draftProjectId, fileName: file.name, fileType: file.type.startsWith("video/") ? "video" : "image", mimeType: file.type, fileSize: file.size, filePath: data.secure_url }),
        });
        const saved = await saveRes.json();
        if (saved.upload) newUploads.push(saved.upload as Upload);
      }
      setLocalUploads(prev => [...newUploads, ...prev]);
      setSelectedIds(prev => [...newUploads.map(u => u.id), ...prev]);
      onRefresh();
    } catch (err) { console.error("Upload error:", err); }
    finally { setUploadingFiles(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  function importGdrive(url: string) {
    setGdriveImporting(true); setGdriveStatus("Importing...");
    fetch("/api/uploads/gdrive", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, projectId: draftProjectId }) })
      .then(r => r.json()).then(data => {
        if (data.error) setGdriveStatus(data.error);
        else if (data.uploads?.length > 0) {
          setLocalUploads(prev => [...(data.uploads as Upload[]), ...prev]);
          setSelectedIds(prev => [...data.uploads.map((u: Upload) => u.id), ...prev]);
          setGdriveInput("");
          setGdriveStatus(`${data.uploads.length} file${data.uploads.length !== 1 ? "s" : ""} imported!`);
          setTimeout(() => setGdriveStatus(null), 3000);
          onRefresh();
        } else setGdriveStatus("No media files found.");
      }).catch(() => setGdriveStatus("Import failed")).finally(() => setGdriveImporting(false));
  }

  async function generateAndRender() {
    if (!draftProjectId || generating) return;
    setGenerating(true);
    setGenError(null);
    try {
      if (selectedIds.length > 0) {
        await fetch("/api/uploads", {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadIds: selectedIds, projectId: draftProjectId }),
        });
      }
      setGenStatus("Your AI creative director is planning the edit...");
      const planRes = await fetch("/api/video/plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: draftProjectId }),
      });
      const planData = await planRes.json();
      if (planData.error) { setGenError(planData.error); setGenStatus(null); setGenerating(false); return; }

      setGenStatus("Patience... crafting your masterpiece. This takes 3–5 minutes.");
      const renderRes = await fetch("/api/video/render-plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: draftProjectId }),
      });
      const renderData = await renderRes.json();
      if (renderData.error) { setGenError(renderData.error); setGenStatus(null); setGenerating(false); return; }

      if (renderData.renderId) {
        let attempts = 0;
        while (attempts < 60) {
          await new Promise(r => setTimeout(r, 5000));
          attempts++;
          try {
            const statusRes = await fetch(`/api/video/status?renderId=${renderData.renderId}`);
            const statusData = await statusRes.json();
            if (statusData.status === "succeeded") { router.push(`/project/${draftProjectId}`); return; }
            if (statusData.status === "failed") { setGenError(statusData.errorMessage || "Render failed"); setGenStatus(null); setGenerating(false); return; }
            setGenStatus(`Crafting your masterpiece... ${Math.min(attempts * 5, 300)}s`);
          } catch { /* keep polling */ }
        }
      }
    } catch (err) { setGenError(err instanceof Error ? err.message : "Generation failed. Try again."); }
    setGenerating(false);
    setGenStatus(null);
  }

  const VIBES = ["cinematic", "warm & cozy", "fun & playful", "bold & edgy", "elegant", "energetic", "dreamy"];
  const PLATFORMS = [{ id: "instagram", label: "Instagram" }, { id: "tiktok", label: "TikTok" }, { id: "youtube", label: "YouTube" }];
  const DURATIONS = [{ val: 15, label: "15s" }, { val: 30, label: "30s" }, { val: 60, label: "60s" }];
  const mediaItems = localUploads.filter(u => u.file_type === "video" || u.file_type === "image");

  const card = (children: React.ReactNode) => (
    <div style={{ background: "#fff", borderRadius: 20, padding: "28px 32px", border: "1px solid rgba(0,0,0,0.08)", marginBottom: 16 }}>{children}</div>
  );

  const label = (text: string) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: "#7c7660", textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 10 }}>{text}</div>
  );

  // STEP 1: DETAILS
  if (step === "details") return (
    <div style={{ maxWidth: 580 }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 10 }}>New Project</div>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 34, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 6 }}>Let&apos;s create something</h2>
        <p style={{ fontSize: 14, color: "#7c7660" }}>Name your project, pick your platform and vibe.</p>
      </div>
      {card(<>
        <div style={{ marginBottom: 24 }}>
          {label("Project Name")}
          <input autoFocus value={projectName} onChange={e => setProjectName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && projectName.trim()) { saveProject(); setStep("upload"); } }}
            placeholder="e.g. Bali Trip, Product Launch..."
            style={{ width: "100%", padding: "14px 18px", borderRadius: 12, border: "1.5px solid rgba(0,0,0,0.1)", fontFamily: "inherit", fontSize: 16, outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ marginBottom: 24 }}>
          {label("Platform")}
          <div style={{ display: "flex", gap: 8 }}>
            {PLATFORMS.map(p => (
              <button key={p.id} onClick={() => setPlatform(p.id)}
                style={{ flex: 1, padding: "12px", borderRadius: 12, border: platform === p.id ? "2px solid #FF2D2D" : "1.5px solid rgba(0,0,0,0.1)", background: platform === p.id ? "#FF2D2D" : "#fff", color: platform === p.id ? "#fff" : "#1a1a1a", fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 24 }}>
          {label("Vibe")}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {VIBES.map(v => (
              <button key={v} onClick={() => setVibe(v)}
                style={{ padding: "8px 16px", borderRadius: 999, border: vibe === v ? "2px solid #FF2D2D" : "1.5px solid rgba(0,0,0,0.1)", background: vibe === v ? "#FF2D2D" : "#fff", color: vibe === v ? "#fff" : "#1a1a1a", fontFamily: "inherit", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                {v}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 28 }}>
          {label("Duration")}
          <div style={{ display: "flex", gap: 8 }}>
            {DURATIONS.map(d => (
              <button key={d.val} onClick={() => setDuration(d.val)}
                style={{ flex: 1, padding: "12px", borderRadius: 12, border: duration === d.val ? "2px solid #FF2D2D" : "1.5px solid rgba(0,0,0,0.1)", background: duration === d.val ? "#FF2D2D" : "#fff", color: duration === d.val ? "#fff" : "#1a1a1a", fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <button onClick={async () => { await saveProject(); setStep("upload"); }} disabled={!projectName.trim() || saving}
          style={{ width: "100%", background: projectName.trim() ? "#FF2D2D" : "#ddd3a8", color: projectName.trim() ? "#fff" : "#b5b09a", border: "none", borderRadius: 12, padding: "16px", fontFamily: "inherit", fontSize: 16, fontWeight: 700, cursor: projectName.trim() ? "pointer" : "default" }}>
          {saving ? "Saving..." : "Next: Add Media →"}
        </button>
      </>)}
    </div>
  );

  // STEP 2: UPLOAD
  if (step === "upload") return (
    <div style={{ maxWidth: 580 }}>
      <div style={{ marginBottom: 28 }}>
        <button onClick={() => setStep("details")} style={{ background: "none", border: "none", fontSize: 13, color: "#7c7660", cursor: "pointer", padding: 0, fontFamily: "inherit", marginBottom: 10 }}>← Back</button>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 6 }}>{projectName}</div>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Add your media</h2>
        <p style={{ fontSize: 14, color: "#7c7660" }}>Upload clips or import from Google Drive.</p>
      </div>

      {/* Google Drive */}
      {card(<>
        {label("Google Drive")}
        <div style={{ display: "flex", gap: 8 }}>
          <input value={gdriveInput} onChange={e => setGdriveInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && gdriveInput.trim()) importGdrive(gdriveInput.trim()); }}
            placeholder="Paste folder or file link..."
            style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1.5px solid rgba(0,0,0,0.1)", fontFamily: "inherit", fontSize: 13, outline: "none" }} />
          <button onClick={() => gdriveInput.trim() && importGdrive(gdriveInput.trim())} disabled={!gdriveInput.trim() || gdriveImporting}
            style={{ background: gdriveInput.trim() ? "#FF2D2D" : "#ddd3a8", color: gdriveInput.trim() ? "#fff" : "#b5b09a", border: "none", borderRadius: 10, padding: "10px 18px", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: gdriveInput.trim() ? "pointer" : "default" }}>
            {gdriveImporting ? "..." : "Import"}
          </button>
        </div>
        {gdriveStatus && <div style={{ fontSize: 12, marginTop: 8, fontWeight: 600, color: gdriveStatus.includes("imported") ? "#16a34a" : gdriveStatus === "Importing..." ? "#7B61FF" : "#FF2D2D" }}>{gdriveStatus}</div>}
      </>)}

      {/* Device Upload */}
      <div onClick={() => fileRef.current?.click()} onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); if (fileRef.current && e.dataTransfer.files.length > 0) { const fake = { target: { files: e.dataTransfer.files } } as unknown as React.ChangeEvent<HTMLInputElement>; handleFileUpload(fake); } }}
        style={{ border: "2px dashed rgba(0,0,0,0.1)", borderRadius: 16, padding: "36px 24px", textAlign: "center", cursor: "pointer", background: "#fff", marginBottom: 12 }}>
        {uploadingFiles ? (
          <div style={{ fontSize: 14, fontWeight: 600, color: "#FF2D2D" }}>Uploading...</div>
        ) : (
          <>
            <div style={{ fontSize: 32, marginBottom: 8, color: "#c5b99a" }}>+</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>Drop files or click to browse</div>
            <div style={{ fontSize: 12, color: "#7c7660", marginTop: 4 }}>Videos and photos</div>
          </>
        )}
      </div>
      <input ref={fileRef} type="file" style={{ display: "none" }} onChange={handleFileUpload} accept="video/*,image/*" multiple />

      {/* Selected clips */}
      {mediaItems.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid rgba(0,0,0,0.08)", padding: "14px 18px", marginBottom: 12 }}>
          <div onClick={() => setShowMediaPicker(!showMediaPicker)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{selectedIds.length} of {mediaItems.length} clips selected</div>
            <div style={{ fontSize: 12, color: "#7c7660" }}>{showMediaPicker ? "Hide" : "Edit selection"}</div>
          </div>
          {showMediaPicker && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginTop: 12 }}>
              {mediaItems.map(u => {
                const sel = selectedIds.includes(u.id);
                return (
                  <div key={u.id} onClick={() => setSelectedIds(prev => sel ? prev.filter(x => x !== u.id) : [...prev, u.id])}
                    style={{ position: "relative", borderRadius: 8, overflow: "hidden", aspectRatio: "1", cursor: "pointer", border: sel ? "2px solid #FF2D2D" : "2px solid transparent" }}>
                    {u.file_path && u.file_type === "image" ? <img src={u.file_path} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <div style={{ width: "100%", height: "100%", background: "#ddd3a8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#7c7660", fontWeight: 700 }}>VID</div>}
                    {sel && <div style={{ position: "absolute", top: 3, right: 3, width: 16, height: 16, borderRadius: "50%", background: "#FF2D2D", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />
                    </div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <button onClick={() => setStep("generate")} disabled={selectedIds.length === 0}
        style={{ width: "100%", background: selectedIds.length > 0 ? "#FF2D2D" : "#ddd3a8", color: selectedIds.length > 0 ? "#fff" : "#b5b09a", border: "none", borderRadius: 12, padding: "16px", fontFamily: "inherit", fontSize: 16, fontWeight: 700, cursor: selectedIds.length > 0 ? "pointer" : "default" }}>
        {selectedIds.length > 0 ? `Next: Generate with ${selectedIds.length} clip${selectedIds.length !== 1 ? "s" : ""} →` : "Select clips to continue"}
      </button>
    </div>
  );

  // STEP 3: GENERATE
  return (
    <div style={{ maxWidth: 580 }}>
      <div style={{ marginBottom: 28 }}>
        <button onClick={() => setStep("upload")} style={{ background: "none", border: "none", fontSize: 13, color: "#7c7660", cursor: "pointer", padding: 0, fontFamily: "inherit", marginBottom: 10 }}>← Back</button>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 6 }}>{projectName}</div>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Generate your video</h2>
        <p style={{ fontSize: 14, color: "#7c7660" }}>{platform} · {vibe} · {duration}s · {selectedIds.length} clips</p>
      </div>

      {genError && (
        <div style={{ background: "#fff0f0", border: "1px solid rgba(255,45,45,0.2)", borderRadius: 12, padding: "14px 18px", marginBottom: 16, fontSize: 13, color: "#FF2D2D" }}>{genError}</div>
      )}

      {genStatus ? (
        <div style={{ background: "#1a1a1a", borderRadius: 20, padding: "48px 32px", textAlign: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", border: "3px solid rgba(255,45,45,0.25)", borderTopColor: "#FF2D2D", margin: "0 auto 20px", animation: "spin 1s linear infinite" }} />
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 8 }}>{genStatus}</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Your cinematic video is being crafted</div>
        </div>
      ) : (
        <>
          {card(<>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", marginBottom: 6 }}>
              {selectedIds.length} clip{selectedIds.length !== 1 ? "s" : ""} · {duration}s · {vibe}
            </div>
            <div style={{ fontSize: 13, color: "#7c7660", lineHeight: 1.6 }}>
              Your AI director will pick the best moments, arrange the edit, add cinematic music and color grading — ready to post.
            </div>
          </>)}
          <button onClick={generateAndRender} disabled={generating}
            style={{ width: "100%", background: "#FF2D2D", color: "#fff", border: "none", borderRadius: 12, padding: "18px", fontFamily: "inherit", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
            Generate Cinematic Video
          </button>
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── LIBRARY ────────────────────────────────────────────────────────────────
function LibrarySection({ uploads, onRefresh }: { uploads: Upload[]; onRefresh: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true); setError(null);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress(`Uploading ${i + 1} of ${files.length}: ${file.name}`);
        const sigRes = await fetch("/api/uploads/sign");
        const sig = await sigRes.json();
        const form = new FormData();
        form.append("file", file); form.append("signature", sig.signature); form.append("timestamp", String(sig.timestamp)); form.append("folder", sig.folder); form.append("api_key", sig.apiKey);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`, { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || "Upload failed");
        await fetch("/api/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: file.name, fileType: file.type.startsWith("video/") ? "video" : "image", mimeType: file.type, fileSize: file.size, filePath: data.secure_url }) });
      }
      setProgress(null);
      onRefresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Upload failed"); }
    finally { setUploading(false); setProgress(null); if (fileRef.current) fileRef.current.value = ""; }
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 10 }}>Media</div>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 800, marginBottom: 4 }}>Library</h2>
        <p style={{ fontSize: 14, color: "#7c7660" }}>{uploads.length} file{uploads.length !== 1 ? "s" : ""} in your library.</p>
      </div>

      <div onClick={() => fileRef.current?.click()} onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); if (fileRef.current && e.dataTransfer.files.length > 0) { const fake = { target: { files: e.dataTransfer.files } } as unknown as React.ChangeEvent<HTMLInputElement>; handleFiles(fake); } }}
        style={{ border: "2px dashed rgba(0,0,0,0.1)", borderRadius: 16, padding: "40px 24px", textAlign: "center", cursor: "pointer", background: "#fff", marginBottom: 20 }}>
        {uploading ? (
          <><div style={{ fontSize: 14, fontWeight: 600, color: "#FF2D2D" }}>Uploading...</div><div style={{ fontSize: 12, color: "#7c7660", marginTop: 4 }}>{progress}</div></>
        ) : (
          <><div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>Drop files or click to browse</div><div style={{ fontSize: 12, color: "#7c7660", marginTop: 4 }}>Photos and videos</div></>
        )}
        <input ref={fileRef} type="file" multiple accept="image/*,video/*" style={{ display: "none" }} onChange={handleFiles} />
      </div>

      {error && <div style={{ background: "#fff0f0", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#FF2D2D" }}>{error}</div>}

      {uploads.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12 }}>
          {uploads.map(u => (
            <div key={u.id} style={{ background: "#fff", borderRadius: 14, overflow: "hidden", border: "1px solid rgba(0,0,0,0.08)" }}>
              {u.file_path && u.file_type === "image" ? (
                <img src={u.file_path} alt={u.file_name} style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }} />
              ) : (
                <div style={{ width: "100%", height: 120, background: "#ddd3a8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "#c5b99a" }}>▷</div>
              )}
              <div style={{ padding: "8px 12px" }}>
                <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.file_name}</div>
                <div style={{ fontSize: 11, color: "#7c7660", marginTop: 2 }}>{fmt(u.file_size)}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "60px 24px", color: "#7c7660", fontSize: 14 }}>No uploads yet. Drop your first file above.</div>
      )}
    </div>
  );
}

// ─── STYLE ──────────────────────────────────────────────────────────────────
function StyleSection() {
  const [style, setStyle] = useState<Record<string, unknown> | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/style").then(r => r.json()).then(d => setStyle(d.style || {}));
  }, []);

  async function applyPreset(preset: Record<string, string>) {
    await fetch("/api/style", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(preset) });
    const d = await (await fetch("/api/style")).json();
    setStyle(d.style || {});
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const PRESETS = [
    { name: "Luxe Beach", sub: "Warm, smooth, elegant", icon: "○", values: { color_grade: "warm", pacing: "slow", music_energy: "cinematic", caption_style: "minimal", text_amount: "minimal" } },
    { name: "Clean Editorial", sub: "Minimal, modern, sharp", icon: "□", values: { color_grade: "cool", pacing: "medium", music_energy: "ambient", caption_style: "minimal", text_amount: "none" } },
    { name: "Playful Country", sub: "Fast cuts, upbeat, fun", icon: "◇", values: { color_grade: "natural", pacing: "fast", music_energy: "energetic", caption_style: "conversational", text_amount: "moderate" } },
    { name: "Moody Cinema", sub: "Dramatic, dark, story-driven", icon: "◈", values: { color_grade: "dramatic", pacing: "slow", music_energy: "cinematic emotional", caption_style: "minimal", text_amount: "minimal" } },
    { name: "Bright & Airy", sub: "Light, fresh, lifestyle", icon: "◎", values: { color_grade: "natural", pacing: "medium", music_energy: "upbeat", caption_style: "descriptive", text_amount: "moderate" } },
    { name: "Bold & Trendy", sub: "High energy, viral, punchy", icon: "◉", values: { color_grade: "dramatic", pacing: "fast", music_energy: "trendy", caption_style: "bold", text_amount: "moderate" } },
  ];

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 10 }}>Visual Identity</div>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 800, marginBottom: 4 }}>Your Style</h2>
        <p style={{ fontSize: 14, color: "#7c7660" }}>Pick a preset to set your video aesthetic. Your AI will use this on every generation.</p>
      </div>

      {saved && <div style={{ background: "#f0fff4", border: "1px solid rgba(45,164,78,0.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#2da44e", fontWeight: 600 }}>Style updated</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 32 }}>
        {PRESETS.map(preset => (
          <div key={preset.name} onClick={() => applyPreset(preset.values)}
            style={{ background: "#fff", borderRadius: 16, padding: "22px 20px", border: "1px solid rgba(0,0,0,0.08)", cursor: "pointer", transition: "box-shadow 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.08)")}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}>
            <div style={{ fontSize: 22, color: "#7c7660", marginBottom: 12 }}>{preset.icon}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>{preset.name}</div>
            <div style={{ fontSize: 12, color: "#7c7660", marginBottom: 12 }}>{preset.sub}</div>
            <div style={{ fontSize: 11, color: "#FF2D2D", fontWeight: 700 }}>Apply style →</div>
          </div>
        ))}
      </div>

      {style && (
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid rgba(0,0,0,0.08)", padding: "20px 24px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#7c7660", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>Current Settings</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[["Color Grade", "color_grade"], ["Pacing", "pacing"], ["Music", "music_energy"], ["Captions", "caption_style"], ["Text", "text_amount"], ["Transitions", "transition_density"]].map(([label, key]) => (
              <div key={key} style={{ padding: "10px 12px", background: "#e8dfc0", borderRadius: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#7c7660", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{String(style[key] || "—")}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BRAND ──────────────────────────────────────────────────────────────────
function BrandSection({ brand, user }: { brand: BrandProfile | null; user: User }) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshed, setRefreshed] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try { await fetch("/api/brand-profile/refresh", { method: "POST" }); setRefreshed(true); setTimeout(() => setRefreshed(false), 3000); }
    catch (err) { console.error(err); }
    finally { setRefreshing(false); }
  }

  if (!brand) return (
    <div style={{ maxWidth: 580 }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 10 }}>Identity</div>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 800, marginBottom: 4 }}>Brand Profile</h2>
        <p style={{ fontSize: 14, color: "#7c7660" }}>Upload content and create projects to build your AI brand profile.</p>
      </div>
      <div style={{ background: "#fff", borderRadius: 16, padding: "40px", border: "1px solid rgba(0,0,0,0.08)", textAlign: "center" }}>
        <div style={{ fontSize: 32, color: "#c5b99a", marginBottom: 16 }}>○</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", marginBottom: 8 }}>No brand profile yet</div>
        <div style={{ fontSize: 13, color: "#7c7660" }}>Your AI profile builds automatically as you upload content and create videos.</div>
      </div>
    </div>
  );

  const prog = brand.learning_progress_percent;
  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 10 }}>Identity</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 800, marginBottom: 4 }}>Brand Profile</h2>
            <p style={{ fontSize: 14, color: "#7c7660" }}>Confidence: {Math.round(brand.confidence_score * 100)}%</p>
          </div>
          <button onClick={handleRefresh} disabled={refreshing}
            style={{ background: refreshed ? "#2da44e" : "#FF2D2D", color: "#fff", border: "none", borderRadius: 999, padding: "10px 20px", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            {refreshing ? "Refreshing..." : refreshed ? "Updated" : "Refresh AI"}
          </button>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 16, padding: "20px 24px", border: "1px solid rgba(0,0,0,0.08)", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 12, fontWeight: 600 }}>
          <span style={{ color: "#1a1a1a" }}>AI Training</span>
          <span style={{ color: "#FF2D2D" }}>{prog}%</span>
        </div>
        <div style={{ height: 6, background: "#ddd3a8", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${prog}%`, background: "#FF2D2D", borderRadius: 3, transition: "width 0.5s" }} />
        </div>
        <div style={{ fontSize: 11, color: "#7c7660", marginTop: 8 }}>{brand.upload_count} uploads analyzed</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[["Tone", brand.tone_summary], ["Personality", brand.personality_summary], ["Pacing", brand.pacing_style], ["Archetype", brand.creator_archetype], ["Music", brand.music_genre_preference], ["Hooks", brand.hook_style]].filter(([, v]) => v).map(([k, v]) => (
          <div key={k} style={{ background: "#fff", borderRadius: 12, padding: "16px", border: "1px solid rgba(0,0,0,0.08)" }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#7c7660", marginBottom: 6 }}>{k}</div>
            <div style={{ fontSize: 13, color: "#1a1a1a", lineHeight: 1.5 }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ANALYTICS ──────────────────────────────────────────────────────────────
function AnalyticsSection({ uploads, projects }: { uploads: Upload[]; projects: Project[] }) {
  const completed = projects.filter(p => p.status === "completed").length;
  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 10 }}>Insights</div>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 800, marginBottom: 4 }}>Analytics</h2>
        <p style={{ fontSize: 14, color: "#7c7660" }}>Your content at a glance.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {[{ label: "Uploads", value: uploads.length }, { label: "Projects", value: projects.length }, { label: "Completed", value: completed }, { label: "Videos", value: uploads.filter(u => u.file_type === "video").length }, { label: "Photos", value: uploads.filter(u => u.file_type === "image").length }, { label: "In Progress", value: projects.length - completed }].map(s => (
          <div key={s.label} style={{ background: "#fff", borderRadius: 16, padding: "22px", border: "1px solid rgba(0,0,0,0.08)" }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 36, fontWeight: 800, color: "#FF2D2D", lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#7c7660", marginTop: 6 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SETTINGS ───────────────────────────────────────────────────────────────
function SettingsSection({ user, onRefresh }: { user: User; onRefresh: () => void }) {
  const [name, setName] = useState(user.name);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    try {
      await fetch("/api/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      setSaved(true); setTimeout(() => setSaved(false), 2000); onRefresh();
    } catch (err) { console.error(err); }
  }

  const PLANS = [
    { name: "Creator", price: "$29/mo", features: ["Unlimited projects", "AI video generation", "Brand profile"] },
    { name: "Pro", price: "$79/mo", features: ["Everything in Creator", "Priority rendering", "Advanced analytics"] },
    { name: "Elite", price: "$240/mo", features: ["Everything in Pro", "AI Manager", "Voice Clone", "2 team seats"] },
  ];

  return (
    <div style={{ maxWidth: 580 }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 10 }}>Account</div>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 800 }}>Settings</h2>
      </div>

      <div style={{ background: "#fff", borderRadius: 16, padding: "24px", border: "1px solid rgba(0,0,0,0.08)", marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#7c7660", marginBottom: 16 }}>Profile</div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#7c7660", display: "block", marginBottom: 6 }}>Name</label>
          <input value={name} onChange={e => setName(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid rgba(0,0,0,0.1)", fontFamily: "inherit", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#7c7660", display: "block", marginBottom: 6 }}>Email</label>
          <div style={{ padding: "10px 14px", borderRadius: 10, background: "#e8dfc0", fontSize: 14, color: "#7c7660" }}>{user.email}</div>
        </div>
        <button onClick={handleSave} style={{ background: saved ? "#2da44e" : "#FF2D2D", color: "#fff", border: "none", borderRadius: 999, padding: "10px 24px", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          {saved ? "Saved" : "Save Changes"}
        </button>
      </div>

      {user.elevenlabs_voice_id ? (
        <div style={{ background: "#fff", borderRadius: 16, padding: "20px 24px", border: "1px solid rgba(0,0,0,0.08)", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#7c7660", marginBottom: 10 }}>Voice Clone</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#2da44e" }}>Active: {user.voice_clone_name || "My Voice"}</div>
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 16, padding: "20px 24px", border: "1px solid rgba(0,0,0,0.08)", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#7c7660", marginBottom: 10 }}>Voice Clone</div>
          <div style={{ fontSize: 13, color: "#7c7660", marginBottom: 12 }}>Clone your voice to narrate your videos.</div>
          <a href="/project/voice" style={{ display: "inline-block", background: "#FF2D2D", color: "#fff", textDecoration: "none", borderRadius: 999, padding: "10px 20px", fontSize: 13, fontWeight: 700 }}>Set Up Voice</a>
        </div>
      )}

      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#7c7660", marginBottom: 12 }}>Plans</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {PLANS.map(plan => {
          const current = user.subscription_tier === plan.name.toLowerCase();
          return (
            <div key={plan.name} style={{ background: "#fff", borderRadius: 14, padding: "20px 22px", border: current ? "2px solid #FF2D2D" : "1px solid rgba(0,0,0,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a" }}>{plan.name} <span style={{ fontSize: 14, color: "#FF2D2D" }}>{plan.price}</span></div>
                <div style={{ fontSize: 12, color: "#7c7660", marginTop: 4 }}>{plan.features.join(" · ")}</div>
              </div>
              {current ? <div style={{ fontSize: 11, fontWeight: 700, color: "#2da44e", textTransform: "uppercase", letterSpacing: 1 }}>Current</div>
                : <button style={{ background: "#FF2D2D", color: "#fff", border: "none", borderRadius: 999, padding: "8px 18px", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Upgrade</button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── ROOT ────────────────────────────────────────────────────────────────────
const NAV: { id: Section; label: string }[] = [
  { id: "studio", label: "Studio" },
  { id: "create", label: "Create" },
  { id: "library", label: "Library" },
  { id: "style", label: "Style" },
  { id: "brand", label: "Brand" },
  { id: "analytics", label: "Analytics" },
  { id: "settings", label: "Settings" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [brand, setBrand] = useState<BrandProfile | null>(null);
  const [section, setSection] = useState<Section>("studio");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [uRes, pRes, bRes, meRes] = await Promise.all([fetch("/api/uploads"), fetch("/api/projects"), fetch("/api/brand-profile"), fetch("/api/me")]);
      if (meRes.status === 401) { router.push("/login"); return; }
      if (uRes.ok) setUploads((await uRes.json()).uploads || []);
      if (pRes.ok) setProjects((await pRes.json()).projects || []);
      if (bRes.ok) { const bd = await bRes.json(); setBrand(bd.brand || null); }
      if (meRes.ok) setUser((await meRes.json()).user);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#e8dfc0" }}>
        <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 28, color: "#FF2D2D", letterSpacing: 2 }}>LUMEVO</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#e8dfc0", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Sidebar */}
      <div style={{ width: 200, background: "#1a1a1a", display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, height: "100vh", zIndex: 10 }}>
        <div style={{ padding: "28px 22px 32px" }}>
          <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 22, color: "#FF2D2D", letterSpacing: 2 }}>LUMEVO</div>
        </div>

        <nav style={{ flex: 1, padding: "0 12px" }}>
          {NAV.map(item => {
            const active = section === item.id;
            return (
              <div key={item.id} onClick={() => setSection(item.id)}
                style={{ display: "flex", alignItems: "center", padding: "10px 14px", borderRadius: 10, cursor: "pointer", marginBottom: 2, position: "relative", gap: 10 }}>
                {active && <div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 3, height: 20, background: "#FF2D2D", borderRadius: "0 2px 2px 0" }} />}
                <span style={{ fontSize: 14, fontWeight: active ? 700 : 400, color: active ? "#fff" : "rgba(255,255,255,0.5)" }}>{item.label}</span>
              </div>
            );
          })}
        </nav>

        {/* Recent projects */}
        {projects.length > 0 && (
          <div style={{ padding: "0 12px 8px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.25)", padding: "8px 14px 6px" }}>Recent</div>
            {projects.slice(0, 3).map(p => (
              <div key={p.id} onClick={() => router.push(`/project/${p.id}`)}
                style={{ padding: "8px 14px", borderRadius: 10, cursor: "pointer", marginBottom: 2 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ padding: "16px 22px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 2 }}>{user.name}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 10 }}>{TIER_LABELS[user.subscription_tier] || user.subscription_tier}</div>
          <button onClick={handleLogout} style={{ background: "none", border: "none", fontSize: 12, color: "rgba(255,255,255,0.3)", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>Log out</button>
        </div>
      </div>

      {/* Main */}
      <div style={{ marginLeft: 200, flex: 1, padding: "48px 56px 80px", minWidth: 0 }}>
        {section === "studio" && <StudioSection user={user} uploads={uploads} projects={projects} brand={brand} onNav={setSection} />}
        {section === "create" && <CreateSection user={user} uploads={uploads} onRefresh={fetchData} />}
        {section === "library" && <LibrarySection uploads={uploads} onRefresh={fetchData} />}
        {section === "style" && <StyleSection />}
        {section === "brand" && <BrandSection brand={brand} user={user} />}
        {section === "analytics" && <AnalyticsSection uploads={uploads} projects={projects} />}
        {section === "settings" && <SettingsSection user={user} onRefresh={fetchData} />}
      </div>
    </div>
  );
}
