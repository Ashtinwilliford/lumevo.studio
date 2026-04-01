"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

type Section = "overview" | "uploads" | "create" | "video" | "brand" | "projects" | "plan" | "aimanager" | "analytics" | "billing" | "settings";

interface User { id: string; name: string; email: string; subscription_tier: string; created_at: string; trial_started_at?: string; elevenlabs_voice_id?: string; voice_clone_name?: string; }
interface Upload { id: string; file_type: string; file_name: string; mime_type: string; file_size: number; analysis_status: string; created_at: string; file_path?: string | null; thumb_path?: string | null; ai_analysis?: Record<string, string> | null; video_duration_sec?: number | null; }
interface Project { id: string; title: string; project_type: string; target_platform: string; target_duration?: number; vibe?: string; status: string; created_at: string; updated_at: string; }
interface BrandProfile { user_id: string; tone_summary: string; personality_summary: string; audience_summary: string; pacing_style: string; cta_style: string; visual_style_summary?: string; voice_preferences?: string; hook_style?: string; pattern_interrupt_style?: string; emotional_arc_preference?: string; music_genre_preference?: string; creator_archetype?: string; confidence_score: number; learning_progress_percent: number; upload_count: number; generation_count: number; last_learned_at?: string; }

const NAV: { id: Section; label: string; group?: string; elite?: boolean }[] = [
  { id: "overview", label: "Overview" },
  { id: "uploads", label: "Uploads", group: "Create" },
  { id: "create", label: "Create Content", group: "Create" },
  { id: "video", label: "New Project", group: "Create" },
  { id: "brand", label: "Brand Profile", group: "Learn" },
  { id: "projects", label: "Projects", group: "Learn" },
  { id: "plan", label: "Content Plan", group: "Learn" },
  { id: "aimanager", label: "AI Manager", group: "Learn", elite: true },
  { id: "analytics", label: "Analytics", group: "Learn" },
  { id: "billing", label: "Billing", group: "Account" },
  { id: "settings", label: "Settings", group: "Account" },
];

const TIER_LABELS: Record<string, string> = { trial: "Free Trial", creator: "Creator", pro: "Pro", elite: "Elite" };
const TRIAL_LIMIT = 2;
const TRIAL_DAYS = 14;

function trialDaysLeft(startedAt?: string) {
  if (!startedAt) return TRIAL_DAYS;
  const ms = Date.now() - new Date(startedAt).getTime();
  return Math.max(0, TRIAL_DAYS - Math.floor(ms / 86400000));
}

const PLATFORM_LABELS: Record<string, string> = { tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube", general: "General" };
const STATUS_COLORS: Record<string, string> = { draft: "#b5b09a", chatting: "#7B61FF", generating: "#FF8C00", queued: "#7c7660", analyzing: "#FF8C00", scripting: "#FF8C00", completed: "#2da44e", failed: "#FF2D2D" };

function fmt(bytes: number) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / 1048576).toFixed(1)} MB`; }
function fmtDate(d: string) {
  const dt = new Date(d);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[dt.getUTCMonth()]} ${dt.getUTCDate()}, ${dt.getUTCFullYear()}`;
}

function Overview({ user, uploads, projects, brand, onNav }: {
  user: User; uploads: Upload[]; projects: Project[]; brand: BrandProfile | null; onNav: (s: Section, projectId?: string) => void;
}) {
  const prog = brand?.learning_progress_percent ?? 0;
  const completed = projects.filter(p => p.status === "completed").length;
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
                {projectsLeft === 0 ? "You have used both trial projects" : `${projectsLeft} project${projectsLeft !== 1 ? "s" : ""} left - ${daysLeft} day${daysLeft !== 1 ? "s" : ""} remaining`}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
                {trialEndDate ? `Trial ends ${trialEndDate} - then auto-renews to Creator ($29/mo). Cancel anytime.` : "Auto-renews to Creator ($29/mo) after trial. Cancel anytime."}
              </div>
            </div>
            <button onClick={() => onNav("billing")} style={{ background: "#FF2D2D", color: "#fff", border: "none", borderRadius: 999, padding: "11px 22px", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
              Upgrade now
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 32 }}>
        <button onClick={() => onNav("video")} style={{ background: "#FF2D2D", color: "#fff", border: "none", borderRadius: 14, padding: "20px 24px", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8, opacity: 0.7 }}>New</div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800 }}>Start a Project</div>
          <div style={{ fontSize: 12, marginTop: 4, opacity: 0.7 }}>Create a new AI video</div>
        </button>
        <button onClick={() => onNav("uploads")} style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 14, padding: "20px 24px", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8, color: "#7c7660" }}>Library</div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: "#1a1a1a" }}>Your Uploads</div>
          <div style={{ fontSize: 12, marginTop: 4, color: "#7c7660" }}>{uploads.length} file{uploads.length !== 1 ? "s" : ""} stored</div>
        </button>
      </div>

      {projects.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#7c7660", marginBottom: 16 }}>Recent Projects</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {projects.slice(0, 3).map(p => (
              <div key={p.id} onClick={() => onNav("projects", p.id)} style={{ background: "#fff", borderRadius: 12, padding: "14px 18px", border: "1px solid rgba(0,0,0,0.07)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>{p.title}</div>
                  <div style={{ fontSize: 11, color: "#7c7660", marginTop: 2 }}>{PLATFORM_LABELS[p.target_platform] || p.target_platform} - {fmtDate(p.created_at)}</div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLORS[p.status] || "#7c7660", textTransform: "uppercase", letterSpacing: 1 }}>{p.status}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UploadsSection({ uploads, onRefresh }: { uploads: Upload[]; onRefresh: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    setUploadError(null);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress(`Uploading ${i + 1} of ${files.length}: ${file.name}`);
        const sigRes = await fetch("/api/uploads/sign");
        if (!sigRes.ok) throw new Error("Could not get upload credentials");
        const sig = await sigRes.json();
        const form = new FormData();
        form.append("file", file);
        form.append("signature", sig.signature);
        form.append("timestamp", String(sig.timestamp));
        form.append("folder", sig.folder);
        form.append("api_key", sig.apiKey);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`, { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || "Upload failed");
        await fetch("/api/uploads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: file.name, fileType: file.type.startsWith("video/") ? "video" : "image", mimeType: file.type, fileSize: file.size, filePath: data.secure_url }),
        });
      }
      setProgress(null);
      onRefresh();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 10 }}>Media Library</div>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Your Uploads</h2>
        <p style={{ fontSize: 14, color: "#7c7660" }}>Photos and videos in your library. {uploads.length} file{uploads.length !== 1 ? "s" : ""} total.</p>
      </div>

      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault();
          if (fileRef.current && e.dataTransfer.files.length > 0) {
            const dt = new DataTransfer();
            Array.from(e.dataTransfer.files).forEach(f => dt.items.add(f));
            fileRef.current.files = dt.files;
            handleFiles({ target: fileRef.current } as React.ChangeEvent<HTMLInputElement>);
          }
        }}
        style={{ border: "2px dashed rgba(0,0,0,0.12)", borderRadius: 14, padding: "48px 24px", textAlign: "center", cursor: "pointer", background: "#fff", marginBottom: 24 }}
      >
        {uploading ? (
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#FF2D2D", marginBottom: 4 }}>Uploading...</div>
            <div style={{ fontSize: 12, color: "#7c7660" }}>{progress}</div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a", marginBottom: 4 }}>Drop files here or click to browse</div>
            <div style={{ fontSize: 12, color: "#7c7660" }}>Photos and videos - any size - uploaded directly to the cloud</div>
          </div>
        )}
        <input ref={fileRef} type="file" multiple accept="image/*,video/*" style={{ display: "none" }} onChange={handleFiles} />
      </div>

      {uploadError && (
        <div style={{ background: "#fff0f0", border: "1px solid rgba(255,45,45,0.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#FF2D2D" }}>
          {uploadError}
        </div>
      )}

      {uploads.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12 }}>
          {uploads.map(u => (
            <div key={u.id} style={{ background: "#fff", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(0,0,0,0.07)" }}>
              {u.file_path && u.file_type === "image" ? (
                <img src={u.file_path} alt={u.file_name} style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }} />
              ) : (
                <div style={{ width: "100%", height: 120, background: "#f5f5f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#7c7660", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
                  {u.file_type === "video" ? "Video" : "File"}
                </div>
              )}
              <div style={{ padding: "8px 10px" }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#1a1a1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.file_name}</div>
                <div style={{ fontSize: 11, color: "#7c7660", marginTop: 2 }}>{fmt(u.file_size)}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "60px 24px", color: "#7c7660", fontSize: 14 }}>
          No uploads yet. Drop your first file above.
        </div>
      )}
    </div>
  );
}

function VideoSection({ user, uploads, onRefresh }: { user: User; uploads: Upload[]; onRefresh: () => void }) {
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
  const [scriptResult, setScriptResult] = useState<{ script?: string; caption?: string } | null>(null);
  const [rendering, setRendering] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setLocalUploads(uploads); }, [uploads]);

  // Save project as soon as user enters name
  async function saveProject() {
    if (!projectName.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  async function generateScript() {
    if (!draftProjectId) return;
    setGenError(null);
    setGenStatus("Your AI creative director is writing the script...");
    try {
      const res = await fetch("/api/video/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: projectName, uploadIds: selectedIds, platform, duration, vibe, draftProjectId }),
      });
      const data = await res.json();
      if (data.error) { setGenError(data.error); setGenStatus(null); return; }
      if (data.script) setScriptResult({ script: data.script, caption: data.caption });
      setGenStatus(null);
    } catch (err) { setGenError("Script generation failed. Try again."); setGenStatus(null); }
  }

  async function renderVideo() {
    if (!draftProjectId) return;
    setRendering(true);
    setGenError(null);
    setGenStatus("Patience... we're crafting your masterpiece. This takes 3-5 minutes.");
    try {
      const renderRes = await fetch("/api/video/compose", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: draftProjectId }),
      });
      const renderData = await renderRes.json();
      if (renderData.error) { setGenError(renderData.error); setRendering(false); setGenStatus(null); return; }

      if (renderData.renderId) {
        let attempts = 0;
        while (attempts < 60) {
          await new Promise(r => setTimeout(r, 5000));
          attempts++;
          try {
            const statusRes = await fetch(`/api/video/status?renderId=${renderData.renderId}`);
            const statusData = await statusRes.json();
            if (statusData.status === "succeeded") {
              setGenStatus(null);
              setRendering(false);
              router.push(`/project/${draftProjectId}`);
              return;
            } else if (statusData.status === "failed") {
              setGenError(statusData.errorMessage || "Render failed");
              setGenStatus(null);
              setRendering(false);
              return;
            }
            setGenStatus(`Crafting your masterpiece... ${Math.min(attempts * 5, 300)}s`);
          } catch { /* keep polling */ }
        }
      }
    } catch (err) { setGenError("Rendering failed. Try again."); }
    setRendering(false);
    setGenStatus(null);
  }

  const VIBES = ["cinematic", "warm & cozy", "fun & playful", "bold & edgy", "elegant", "energetic", "aesthetic", "dreamy"];
  const PLATFORMS = [
    { id: "instagram", label: "Instagram" },
    { id: "tiktok", label: "TikTok" },
    { id: "youtube", label: "YouTube" },
  ];
  const DURATIONS = [
    { val: 15, label: "15s" },
    { val: 30, label: "30s" },
    { val: 60, label: "60s" },
  ];

  const mediaItems = localUploads.filter(u => u.file_type === "video" || u.file_type === "image");

  // === STEP 1: PROJECT DETAILS ===
  if (step === "details") {
    return (
      <div style={{ maxWidth: 620 }}>
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 12 }}>New Project</div>
          <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: 36, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 8 }}>Let&apos;s create something</h2>
          <p style={{ fontSize: 15, color: "#7c7660" }}>Set up your project, then we&apos;ll add media and generate.</p>
        </div>

        <div style={{ background: "#fff", borderRadius: 20, padding: "32px", border: "1px solid rgba(0,0,0,0.07)" }}>
          {/* Project Name */}
          <div style={{ marginBottom: 28 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#7c7660", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Project Name</label>
            <input autoFocus value={projectName} onChange={e => setProjectName(e.target.value)}
              placeholder="e.g. Bali Trip, Product Launch, Morning Routine..."
              style={{ width: "100%", padding: "14px 18px", borderRadius: 12, border: "1.5px solid rgba(0,0,0,0.1)", fontFamily: "inherit", fontSize: 16, outline: "none", boxSizing: "border-box" }} />
          </div>

          {/* Platform */}
          <div style={{ marginBottom: 28 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#7c7660", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Platform</label>
            <div style={{ display: "flex", gap: 8 }}>
              {PLATFORMS.map(p => (
                <button key={p.id} onClick={() => setPlatform(p.id)}
                  style={{ flex: 1, padding: "12px 16px", borderRadius: 12, border: platform === p.id ? "2px solid #FF2D2D" : "1.5px solid rgba(0,0,0,0.1)", background: platform === p.id ? "#FF2D2D" : "#fff", color: platform === p.id ? "#fff" : "#1a1a1a", fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Vibe */}
          <div style={{ marginBottom: 28 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#7c7660", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Vibe</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {VIBES.map(v => (
                <button key={v} onClick={() => setVibe(v)}
                  style={{ padding: "8px 16px", borderRadius: 999, border: vibe === v ? "2px solid #FF2D2D" : "1.5px solid rgba(0,0,0,0.1)", background: vibe === v ? "#FF2D2D" : "#fff", color: vibe === v ? "#fff" : "#1a1a1a", fontFamily: "inherit", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div style={{ marginBottom: 32 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#7c7660", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Duration</label>
            <div style={{ display: "flex", gap: 8 }}>
              {DURATIONS.map(d => (
                <button key={d.val} onClick={() => setDuration(d.val)}
                  style={{ flex: 1, padding: "12px 16px", borderRadius: 12, border: duration === d.val ? "2px solid #FF2D2D" : "1.5px solid rgba(0,0,0,0.1)", background: duration === d.val ? "#FF2D2D" : "#fff", color: duration === d.val ? "#fff" : "#1a1a1a", fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={async () => { await saveProject(); setStep("upload"); }} disabled={!projectName.trim() || saving}
            style={{ width: "100%", background: projectName.trim() ? "#FF2D2D" : "#f5f5f0", color: projectName.trim() ? "#fff" : "#b5b09a", border: "none", borderRadius: 12, padding: "16px 20px", fontFamily: "inherit", fontSize: 16, fontWeight: 700, cursor: projectName.trim() ? "pointer" : "default" }}>
            {saving ? "Saving..." : "Next: Add Media"}
          </button>
        </div>
      </div>
    );
  }

  // === STEP 2: UPLOAD MEDIA ===
  if (step === "upload") {
    return (
      <div style={{ maxWidth: 620 }}>
        <div style={{ marginBottom: 32 }}>
          <button onClick={() => setStep("details")} style={{ background: "none", border: "none", fontSize: 13, color: "#7c7660", cursor: "pointer", marginBottom: 12, padding: 0, fontFamily: "inherit" }}>Back to details</button>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 8 }}>{projectName}</div>
          <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Add your media</h2>
          <p style={{ fontSize: 14, color: "#7c7660" }}>Upload clips and photos, or import from Google Drive.</p>
        </div>

        {/* Google Drive Import */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid rgba(0,0,0,0.07)", padding: "20px", marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#7c7660", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Import from Google Drive</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={gdriveInput} onChange={e => setGdriveInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && gdriveInput.trim()) {
                  setGdriveImporting(true); setGdriveStatus("Importing...");
                  fetch("/api/uploads/gdrive", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: gdriveInput.trim(), projectId: draftProjectId }) })
                    .then(r => r.json()).then(data => {
                      if (data.error) setGdriveStatus(data.error);
                      else if (data.uploads?.length > 0) { setLocalUploads(prev => [...(data.uploads as Upload[]), ...prev]); setSelectedIds(prev => [...data.uploads.map((u: Upload) => u.id), ...prev]); setGdriveInput(""); setGdriveStatus(`${data.uploads.length} file${data.uploads.length !== 1 ? "s" : ""} imported!`); setTimeout(() => setGdriveStatus(null), 3000); onRefresh(); }
                      else setGdriveStatus("No media files found in that link.");
                    }).catch(() => setGdriveStatus("Import failed")).finally(() => setGdriveImporting(false));
                }
              }}
              placeholder="Paste Google Drive folder or file link..."
              style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1.5px solid rgba(0,0,0,0.1)", fontFamily: "inherit", fontSize: 13, outline: "none" }} />
            <button onClick={() => {
              if (!gdriveInput.trim()) return;
              setGdriveImporting(true); setGdriveStatus("Importing...");
              fetch("/api/uploads/gdrive", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: gdriveInput.trim(), projectId: draftProjectId }) })
                .then(r => r.json()).then(data => {
                  if (data.error) setGdriveStatus(data.error);
                  else if (data.uploads?.length > 0) { setLocalUploads(prev => [...(data.uploads as Upload[]), ...prev]); setSelectedIds(prev => [...data.uploads.map((u: Upload) => u.id), ...prev]); setGdriveInput(""); setGdriveStatus(`${data.uploads.length} file${data.uploads.length !== 1 ? "s" : ""} imported!`); setTimeout(() => setGdriveStatus(null), 3000); onRefresh(); }
                  else setGdriveStatus("No media files found in that link.");
                }).catch(() => setGdriveStatus("Import failed")).finally(() => setGdriveImporting(false));
            }} disabled={!gdriveInput.trim() || gdriveImporting}
              style={{ background: gdriveInput.trim() ? "#FF2D2D" : "#f5f5f0", color: gdriveInput.trim() ? "#fff" : "#b5b09a", border: "none", borderRadius: 10, padding: "10px 16px", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: gdriveInput.trim() ? "pointer" : "default" }}>
              {gdriveImporting ? "..." : "Import"}
            </button>
          </div>
          {gdriveStatus && <div style={{ fontSize: 12, marginTop: 8, color: gdriveStatus.includes("imported") ? "#16a34a" : gdriveStatus === "Importing..." ? "#7B61FF" : "#FF2D2D", fontWeight: 600 }}>{gdriveStatus}</div>}
        </div>

        {/* Device Upload */}
        <div onClick={() => fileRef.current?.click()} onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); if (fileRef.current && e.dataTransfer.files.length > 0) { const fake = { target: { files: e.dataTransfer.files } } as unknown as React.ChangeEvent<HTMLInputElement>; handleFileUpload(fake); } }}
          style={{ border: "2px dashed rgba(0,0,0,0.12)", borderRadius: 16, padding: "40px 24px", textAlign: "center", cursor: "pointer", background: "#fff", marginBottom: 16 }}>
          {uploadingFiles ? (
            <div><div style={{ fontSize: 14, fontWeight: 600, color: "#FF2D2D" }}>Uploading...</div></div>
          ) : (
            <div>
              <div style={{ fontSize: 28, marginBottom: 8, color: "#FF2D2D" }}>+</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>Drop files or click to browse</div>
              <div style={{ fontSize: 12, color: "#7c7660", marginTop: 4 }}>Videos and photos - unlimited</div>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" style={{ display: "none" }} onChange={handleFileUpload} accept="video/*,image/*" multiple />

        {/* Uploaded files - compact collapsible */}
        {mediaItems.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid rgba(0,0,0,0.07)", padding: "16px 20px", marginBottom: 16 }}>
            <div onClick={() => setShowMediaPicker(!showMediaPicker)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>{selectedIds.length} of {mediaItems.length} clips selected</div>
              <div style={{ fontSize: 12, color: "#7c7660" }}>{showMediaPicker ? "Hide" : "Select clips"}</div>
            </div>
            {showMediaPicker && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginTop: 12 }}>
                {mediaItems.map(u => {
                  const sel = selectedIds.includes(u.id);
                  return (
                    <div key={u.id} onClick={() => setSelectedIds(prev => sel ? prev.filter(x => x !== u.id) : [...prev, u.id])}
                      style={{ position: "relative", borderRadius: 8, overflow: "hidden", aspectRatio: "1", cursor: "pointer", border: sel ? "2px solid #FF2D2D" : "2px solid transparent" }}>
                      {u.file_path && u.file_type === "image" ? <img src={u.file_path} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0", fontSize: 10, color: "#7c7660", fontWeight: 600 }}>VID</div>}
                      {sel && <div style={{ position: "absolute", top: 3, right: 3, width: 18, height: 18, borderRadius: "50%", background: "#FF2D2D", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#fff", fontWeight: 800 }}>ok</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <button onClick={() => setStep("generate")} disabled={selectedIds.length === 0}
          style={{ width: "100%", background: selectedIds.length > 0 ? "#FF2D2D" : "#f5f5f0", color: selectedIds.length > 0 ? "#fff" : "#b5b09a", border: "none", borderRadius: 12, padding: "16px 20px", fontFamily: "inherit", fontSize: 16, fontWeight: 700, cursor: selectedIds.length > 0 ? "pointer" : "default" }}>
          {selectedIds.length > 0 ? `Next: Generate with ${selectedIds.length} clip${selectedIds.length !== 1 ? "s" : ""}` : "Select clips to continue"}
        </button>
      </div>
    );
  }

  // === STEP 3: GENERATE & RENDER ===
  return (
    <div style={{ maxWidth: 620 }}>
      <div style={{ marginBottom: 32 }}>
        <button onClick={() => setStep("upload")} style={{ background: "none", border: "none", fontSize: 13, color: "#7c7660", cursor: "pointer", marginBottom: 12, padding: 0, fontFamily: "inherit" }}>Back to media</button>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 8 }}>{projectName}</div>
        <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Generate your video</h2>
        <p style={{ fontSize: 14, color: "#7c7660" }}>{platform} - {vibe} - {duration}s - {selectedIds.length} clips</p>
      </div>

      {genError && <div style={{ background: "#fff0f0", border: "1px solid rgba(255,45,45,0.3)", borderRadius: 12, padding: "14px 18px", marginBottom: 16, fontSize: 13, color: "#FF2D2D" }}>{genError}</div>}

      {genStatus && (
        <div style={{ background: "#1a1a1a", borderRadius: 20, padding: "40px 32px", textAlign: "center", marginBottom: 24 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid rgba(255,45,45,0.3)", borderTopColor: "#FF2D2D", margin: "0 auto 20px", animation: "spin 1s linear infinite" }} />
          <div style={{ fontFamily: "Syne, sans-serif", fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 8 }}>{genStatus}</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>Your cinematic video is being crafted with AI</div>
        </div>
      )}

      {!scriptResult && !genStatus && (
        <button onClick={generateScript} style={{ width: "100%", background: "#FF2D2D", color: "#fff", border: "none", borderRadius: 12, padding: "16px 20px", fontFamily: "inherit", fontSize: 16, fontWeight: 700, cursor: "pointer", marginBottom: 24 }}>
          Generate Script with AI
        </button>
      )}

      {scriptResult?.script && !genStatus && (
        <div>
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden", marginBottom: 16 }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#7c7660" }}>Script Preview</div>
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => navigator.clipboard?.writeText(scriptResult.script || "")} style={{ background: "none", border: "none", fontSize: 11, color: "#FF2D2D", cursor: "pointer", fontWeight: 700 }}>Copy</button>
                <button onClick={() => { setScriptResult(null); generateScript(); }} style={{ background: "none", border: "none", fontSize: 11, color: "#7B61FF", cursor: "pointer", fontWeight: 700 }}>Regenerate</button>
              </div>
            </div>
            <div style={{ padding: "16px 20px", fontSize: 14, lineHeight: 1.7, color: "#1a1a1a", whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto" }}>{scriptResult.script}</div>
          </div>

          {scriptResult.caption && (
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden", marginBottom: 24 }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#7c7660" }}>Caption</div>
              </div>
              <div style={{ padding: "16px 20px", fontSize: 13, lineHeight: 1.7, color: "#1a1a1a" }}>{scriptResult.caption}</div>
            </div>
          )}

          <button onClick={renderVideo} disabled={rendering}
            style={{ width: "100%", background: "#FF2D2D", color: "#fff", border: "none", borderRadius: 12, padding: "16px 20px", fontFamily: "inherit", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
            {rendering ? "Rendering..." : "Render Cinematic Video"}
          </button>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function BrandSection({ brand, user }: { brand: BrandProfile | null; user: User }) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshed, setRefreshed] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await fetch("/api/brand-profile/refresh", { method: "POST" });
      setRefreshed(true);
      setTimeout(() => setRefreshed(false), 3000);
    } catch (err) { console.error(err); }
    finally { setRefreshing(false); }
  }

  if (!brand) {
    return (
      <div>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 10 }}>Your Identity</div>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Brand Profile</h2>
          <p style={{ fontSize: 14, color: "#7c7660" }}>Upload content and create projects to build your AI brand profile.</p>
        </div>
        <div style={{ background: "#fff", borderRadius: 16, padding: "32px", border: "1px solid rgba(0,0,0,0.07)", textAlign: "center" }}>
          <div style={{ fontSize: 14, color: "#7c7660", marginBottom: 8 }}>No brand profile yet</div>
          <div style={{ fontSize: 13, color: "#b5b09a" }}>Your AI profile builds automatically as you upload content and create videos.</div>
        </div>
      </div>
    );
  }

  const prog = brand.learning_progress_percent;
  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 10 }}>Your Identity</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Brand Profile</h2>
            <p style={{ fontSize: 14, color: "#7c7660" }}>How your AI understands you. Confidence: {Math.round(brand.confidence_score * 100)}%</p>
          </div>
          <button onClick={handleRefresh} disabled={refreshing} style={{ background: refreshed ? "#2da44e" : "#FF2D2D", color: "#fff", border: "none", borderRadius: 999, padding: "9px 18px", fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            {refreshing ? "Refreshing..." : refreshed ? "Updated" : "Refresh"}
          </button>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 16, padding: "20px", border: "1px solid rgba(0,0,0,0.07)", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#7c7660", marginBottom: 12 }}>AI Learning Progress</div>
        <div style={{ background: "#f5f5f0", borderRadius: 999, height: 8, marginBottom: 8 }}>
          <div style={{ background: "#FF2D2D", height: 8, borderRadius: 999, width: `${prog}%`, transition: "width 0.6s ease" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#7c7660" }}>
          <span>{prog}% trained</span>
          <span>{brand.upload_count} uploads analyzed</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {[
          { label: "Tone", value: brand.tone_summary },
          { label: "Personality", value: brand.personality_summary },
          { label: "Pacing", value: brand.pacing_style },
          { label: "Archetype", value: brand.creator_archetype },
          { label: "Music", value: brand.music_genre_preference },
          { label: "Hook Style", value: brand.hook_style },
        ].filter(i => i.value).map(item => (
          <div key={item.label} style={{ background: "#fff", borderRadius: 12, padding: "16px", border: "1px solid rgba(0,0,0,0.07)" }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#7c7660", marginBottom: 6 }}>{item.label}</div>
            <div style={{ fontSize: 13, color: "#1a1a1a", lineHeight: 1.5 }}>{item.value}</div>
          </div>
        ))}
      </div>

      {brand.audience_summary && (
        <div style={{ background: "#fff", borderRadius: 12, padding: "16px", border: "1px solid rgba(0,0,0,0.07)", marginTop: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#7c7660", marginBottom: 6 }}>Audience</div>
          <div style={{ fontSize: 13, color: "#1a1a1a", lineHeight: 1.6 }}>{brand.audience_summary}</div>
        </div>
      )}
    </div>
  );
}

function ProjectsSection({ projects, onOpen }: { projects: Project[]; onOpen: (id: string) => void }) {
  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 10 }}>Your Work</div>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Projects</h2>
        <p style={{ fontSize: 14, color: "#7c7660" }}>{projects.length} project{projects.length !== 1 ? "s" : ""} total.</p>
      </div>
      {projects.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 24px", color: "#7c7660", fontSize: 14 }}>No projects yet. Start one from Create Content.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {projects.map(p => (
            <div key={p.id} onClick={() => onOpen(p.id)} style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", border: "1px solid rgba(0,0,0,0.07)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>{p.title}</div>
                <div style={{ fontSize: 12, color: "#7c7660" }}>
                  {PLATFORM_LABELS[p.target_platform] || p.target_platform}
                  {p.target_duration ? ` - ${p.target_duration}s` : ""}
                  {p.vibe ? ` - ${p.vibe}` : ""}
                  {" - "}{fmtDate(p.created_at)}
                </div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLORS[p.status] || "#7c7660", textTransform: "uppercase", letterSpacing: 1, flexShrink: 0 }}>{p.status}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlanSection({ user }: { user: User }) {
  const [plan, setPlan] = useState<{ week?: string; posts?: { day: string; type: string; topic: string }[] } | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch("/api/content-plan", { method: "POST" });
      const data = await res.json();
      setPlan(data.plan);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 10 }}>Strategy</div>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Content Plan</h2>
        <p style={{ fontSize: 14, color: "#7c7660" }}>Your AI-generated weekly content calendar.</p>
      </div>
      {!plan ? (
        <div style={{ textAlign: "center", padding: "60px 24px" }}>
          <div style={{ fontSize: 14, color: "#7c7660", marginBottom: 24 }}>Generate a personalized content plan based on your brand profile and past performance.</div>
          <button onClick={generate} disabled={loading} style={{ background: "#FF2D2D", color: "#fff", border: "none", borderRadius: 999, padding: "12px 28px", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            {loading ? "Generating..." : "Generate My Plan"}
          </button>
        </div>
      ) : (
        <div>
          {plan.week && <div style={{ fontSize: 13, color: "#7c7660", marginBottom: 20 }}>{plan.week}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(plan.posts || []).map((post, i) => (
              <div key={i} style={{ background: "#fff", borderRadius: 12, padding: "14px 18px", border: "1px solid rgba(0,0,0,0.07)", display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ width: 60, fontSize: 12, fontWeight: 700, color: "#FF2D2D", flexShrink: 0 }}>{post.day}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{post.topic}</div>
                  <div style={{ fontSize: 11, color: "#7c7660", marginTop: 2, textTransform: "uppercase", letterSpacing: 1 }}>{post.type}</div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={generate} disabled={loading} style={{ marginTop: 20, background: "none", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 999, padding: "10px 20px", fontFamily: "inherit", fontSize: 13, cursor: "pointer", color: "#7c7660" }}>
            {loading ? "Regenerating..." : "Regenerate"}
          </button>
        </div>
      )}
    </div>
  );
}

function SettingsSection({ user, onRefresh }: { user: User; onRefresh: () => void }) {
  const [name, setName] = useState(user.name);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    try {
      await fetch("/api/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onRefresh();
    } catch (err) { console.error(err); }
  }

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 10 }}>Account</div>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Settings</h2>
      </div>

      <div style={{ background: "#fff", borderRadius: 16, padding: "24px", border: "1px solid rgba(0,0,0,0.07)", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#7c7660", marginBottom: 16 }}>Profile</div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#7c7660", display: "block", marginBottom: 6 }}>Name</label>
          <input value={name} onChange={e => setName(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid rgba(0,0,0,0.1)", fontFamily: "inherit", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#7c7660", display: "block", marginBottom: 6 }}>Email</label>
          <div style={{ padding: "10px 14px", borderRadius: 10, background: "#f5f5f0", fontSize: 14, color: "#7c7660" }}>{user.email}</div>
        </div>
        <button onClick={handleSave} style={{ background: saved ? "#2da44e" : "#FF2D2D", color: "#fff", border: "none", borderRadius: 999, padding: "10px 24px", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          {saved ? "Saved" : "Save Changes"}
        </button>
      </div>

      <div style={{ background: "#fff", borderRadius: 16, padding: "24px", border: "1px solid rgba(0,0,0,0.07)", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#7c7660", marginBottom: 16 }}>Voice Clone Studio</div>
        {user.elevenlabs_voice_id ? (
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#2da44e", marginBottom: 4 }}>Voice clone active: {user.voice_clone_name || "My Voice"}</div>
            <div style={{ fontSize: 13, color: "#7c7660" }}>Your voice clone is ready to narrate your videos.</div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 14, color: "#7c7660", marginBottom: 12 }}>Clone your voice to have Lumevo narrate your videos in your own voice.</div>
            <a href="/project/voice" style={{ display: "inline-block", background: "#FF2D2D", color: "#fff", textDecoration: "none", borderRadius: 999, padding: "10px 20px", fontSize: 13, fontWeight: 700 }}>Set Up Voice Clone</a>
          </div>
        )}
      </div>

      <div style={{ background: "#fff", borderRadius: 16, padding: "24px", border: "1px solid rgba(0,0,0,0.07)" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#7c7660", marginBottom: 16 }}>Subscription</div>
        <div style={{ fontSize: 14, color: "#1a1a1a", marginBottom: 4 }}>Current plan: <strong>{TIER_LABELS[user.subscription_tier] || user.subscription_tier}</strong></div>
        <div style={{ fontSize: 13, color: "#7c7660" }}>Member since {fmtDate(user.created_at)}</div>
      </div>
    </div>
  );
}

function BillingSection({ user }: { user: User }) {
  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 10 }}>Plans</div>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Billing</h2>
        <p style={{ fontSize: 14, color: "#7c7660" }}>Current plan: {TIER_LABELS[user.subscription_tier] || user.subscription_tier}</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[
          { name: "Creator", price: "$29/mo", features: ["Unlimited projects", "AI video generation", "Brand profile", "Content plan"] },
          { name: "Pro", price: "$79/mo", features: ["Everything in Creator", "Priority rendering", "Advanced analytics", "Custom templates"] },
          { name: "Elite", price: "$240/mo", features: ["Everything in Pro", "AI Manager with social analytics", "Voice Clone Studio", "2 team seats included", "Additional seats $49/mo each", "White-label export"] },
        ].map(plan => (
          <div key={plan.name} style={{ background: "#fff", borderRadius: 16, padding: "24px", border: user.subscription_tier === plan.name.toLowerCase() ? "2px solid #FF2D2D" : "1px solid rgba(0,0,0,0.07)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color: "#1a1a1a" }}>{plan.name}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#FF2D2D", marginTop: 2 }}>{plan.price}</div>
              </div>
              {user.subscription_tier === plan.name.toLowerCase() ? (
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#2da44e" }}>Current</div>
              ) : (
                <button style={{ background: "#FF2D2D", color: "#fff", border: "none", borderRadius: 999, padding: "10px 20px", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Upgrade</button>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {plan.features.map(f => (
                <div key={f} style={{ fontSize: 13, color: "#7c7660", display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#FF2D2D", flexShrink: 0 }} />
                  {f}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsSection({ uploads, projects }: { uploads: Upload[]; projects: Project[] }) {
  const completed = projects.filter(p => p.status === "completed").length;
  const videoUploads = uploads.filter(u => u.file_type === "video").length;
  const imageUploads = uploads.filter(u => u.file_type === "image").length;
  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 10 }}>Insights</div>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Analytics</h2>
        <p style={{ fontSize: 14, color: "#7c7660" }}>Your content performance overview.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(155px,1fr))", gap: 12 }}>
        {[
          { label: "Total Uploads", value: uploads.length },
          { label: "Video Files", value: videoUploads },
          { label: "Photo Files", value: imageUploads },
          { label: "Total Projects", value: projects.length },
          { label: "Completed", value: completed },
          { label: "In Progress", value: projects.length - completed },
        ].map(s => (
          <div key={s.label} style={{ background: "#fff", borderRadius: 16, padding: "20px 22px", border: "1px solid rgba(0,0,0,0.07)" }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 34, fontWeight: 800, color: "#FF2D2D", lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#7c7660", marginTop: 6 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AIManagerSection({ user }: { user: User }) {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask() {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ai-manager", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) });
      const data = await res.json();
      setResponse(data.response || "");
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  if (user.subscription_tier !== "elite") {
    return (
      <div>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 10 }}>Elite</div>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800 }}>AI Manager</h2>
        </div>
        <div style={{ background: "#1a1a1a", borderRadius: 20, padding: "40px", textAlign: "center" }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 12 }}>Elite Feature</div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginBottom: 24 }}>Your personal AI content manager. Upgrade to Elite to access.</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#FF2D2D" }}>$149/mo</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 10 }}>Elite</div>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, marginBottom: 6 }}>AI Manager</h2>
        <p style={{ fontSize: 14, color: "#7c7660" }}>Your personal AI content strategist. Ask anything.</p>
      </div>
      <div style={{ background: "#fff", borderRadius: 16, padding: "24px", border: "1px solid rgba(0,0,0,0.07)", marginBottom: 16 }}>
        <textarea value={query} onChange={e => setQuery(e.target.value)} placeholder="Ask your AI manager anything - content strategy, trend analysis, posting schedule..." rows={3} style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid rgba(0,0,0,0.1)", fontFamily: "inherit", fontSize: 14, resize: "none", outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
        <button onClick={ask} disabled={loading || !query.trim()} style={{ background: "#FF2D2D", color: "#fff", border: "none", borderRadius: 999, padding: "10px 24px", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          {loading ? "Thinking..." : "Ask"}
        </button>
      </div>
      {response && (
        <div style={{ background: "#fff", borderRadius: 16, padding: "24px", border: "1px solid rgba(0,0,0,0.07)" }}>
          <div style={{ fontSize: 14, color: "#1a1a1a", lineHeight: 1.7 }}>{response}</div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [brand, setBrand] = useState<BrandProfile | null>(null);
  const [section, setSection] = useState<Section>("overview");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [uRes, pRes, bRes, meRes] = await Promise.all([
        fetch("/api/uploads"),
        fetch("/api/projects"),
        fetch("/api/brand-profile"),
        fetch("/api/me"),
      ]);
      if (meRes.status === 401) { router.push("/login"); return; }
      if (uRes.ok) setUploads((await uRes.json()).uploads || []);
      if (pRes.ok) setProjects((await pRes.json()).projects || []);
      if (bRes.ok) { const bd = await bRes.json(); setBrand(bd.brand || null); }
      if (meRes.ok) setUser((await meRes.json()).user);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function handleNav(s: Section, projectId?: string) {
    if (projectId) { router.push(`/project/${projectId}`); return; }
    setSection(s);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#F8F8A6" }}>
        <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 28, color: "#FF2D2D", letterSpacing: 2 }}>LUMEVO</div>
      </div>
    );
  }

  if (!user) return null;

  const groups = ["", "Create", "Learn", "Account"];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F8F8A6", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ width: 240, background: "#1a1a1a", display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, height: "100vh", zIndex: 10, overflowY: "auto" }}>
        <div style={{ padding: "28px 22px 20px" }}>
          <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 22, color: "#FF2D2D", letterSpacing: 2, marginBottom: 4 }}>LUMEVO</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 1, textTransform: "uppercase" }}>Studio</div>
        </div>

        <nav style={{ flex: 1, padding: "0 12px" }}>
          {groups.map(group => {
            const items = NAV.filter(n => (n.group || "") === group);
            if (!items.length) return null;
            return (
              <div key={group} style={{ marginBottom: 8 }}>
                {group && (
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.3)", padding: "12px 10px 6px" }}>{group}</div>
                )}
                {items.map(item => {
                  const active = section === item.id;
                  if (item.elite && user.subscription_tier !== "elite") {
                    return (
                      <div key={item.id} onClick={() => handleNav(item.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, cursor: "pointer", marginBottom: 2 }}>
                        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>{item.label}</span>
                        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", background: "#FF2D2D", color: "#fff", padding: "2px 6px", borderRadius: 4 }}>Elite</span>
                      </div>
                    );
                  }
                  return (
                    <div key={item.id} onClick={() => handleNav(item.id)} style={{ padding: "10px 12px", borderRadius: 10, cursor: "pointer", marginBottom: 2, background: active ? "#FF2D2D" : "transparent", transition: "background 0.15s" }}>
                      <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? "#fff" : "rgba(255,255,255,0.75)" }}>{item.label}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Recent Projects in sidebar */}
        {projects.length > 0 && (
          <div style={{ padding: "0 12px 12px" }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.3)", padding: "8px 10px 8px" }}>Recent</div>
            {projects.slice(0, 3).map(p => (
              <div key={p.id} onClick={() => router.push(`/project/${p.id}`)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, cursor: "pointer", marginBottom: 4, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: STATUS_COLORS[p.status] || "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1, flexShrink: 0, marginLeft: 8 }}>{p.status}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ padding: "16px 22px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 2 }}>{user.name}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 12 }}>{TIER_LABELS[user.subscription_tier] || user.subscription_tier}</div>
          <button onClick={handleLogout} style={{ background: "none", border: "none", fontSize: 12, color: "rgba(255,255,255,0.35)", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>Log out</button>
        </div>
      </div>

      <div style={{ marginLeft: 240, flex: 1, padding: "40px 48px 80px", minWidth: 0 }}>
        {section === "overview" && <Overview user={user} uploads={uploads} projects={projects} brand={brand} onNav={handleNav} />}
        {section === "uploads" && <UploadsSection uploads={uploads} onRefresh={fetchData} />}
        {(section === "create" || section === "video") && <VideoSection user={user} uploads={uploads} onRefresh={fetchData} />}
        {section === "brand" && <BrandSection brand={brand} user={user} />}
        {section === "projects" && <ProjectsSection projects={projects} onOpen={id => router.push(`/project/${id}`)} />}
        {section === "plan" && <PlanSection user={user} />}
        {section === "aimanager" && <AIManagerSection user={user} />}
        {section === "analytics" && <AnalyticsSection uploads={uploads} projects={projects} />}
        {section === "billing" && <BillingSection user={user} />}
        {section === "settings" && <SettingsSection user={user} onRefresh={fetchData} />}
      </div>
    </div>
  );
}
