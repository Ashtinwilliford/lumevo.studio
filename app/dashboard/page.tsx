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
  const [step, setStep] = useState<"name" | "chat">("name");
  const [projectName, setProjectName] = useState("");
  const [messages, setMessages] = useState<{ id: string; role: "user" | "ai"; content: string }[]>([
    { id: "0", role: "ai", content: "What are we creating today? Tell me the topic - a trip, a product, a moment, a routine. The more specific the better." }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [projectState, setProjectState] = useState<Record<string, unknown>>({});
  const [draftProjectId, setDraftProjectId] = useState<string | null>(null);
  const [needsUpload, setNeedsUpload] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [useVoiceClone, setUseVoiceClone] = useState(false);
  const [includeMusic, setIncludeMusic] = useState(true);
  const [localUploads, setLocalUploads] = useState<Upload[]>(uploads);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [trialBlocked, setTrialBlocked] = useState(false);
  const [result, setResult] = useState<{ projectId?: string; script?: string; caption?: string; hasVoice?: boolean } | null>(null);
  const [gdriveInput, setGdriveInput] = useState("");
  const [gdriveImporting, setGdriveImporting] = useState(false);
  const [gdriveStatus, setGdriveStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setLocalUploads(uploads); }, [uploads]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isTyping, needsUpload]);

  function toggleSelect(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
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
        form.append("file", file);
        form.append("signature", sig.signature);
        form.append("timestamp", String(sig.timestamp));
        form.append("folder", sig.folder);
        form.append("api_key", sig.apiKey);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`, { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || "Upload failed");
        const saveRes = await fetch("/api/uploads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: file.name, fileType: file.type.startsWith("video/") ? "video" : "image", mimeType: file.type, fileSize: file.size, filePath: data.secure_url }),
        });
        const saved = await saveRes.json();
        if (saved.upload) newUploads.push(saved.upload as Upload);
      }
      setLocalUploads(prev => [...newUploads, ...prev]);
      setSelectedIds(prev => [...newUploads.map(u => u.id), ...prev]);
      onRefresh();
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setUploadingFiles(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function sendMessage(msg?: string) {
    const text = msg || input.trim();
    if (!text) return;
    setInput("");
    setQuickReplies([]);
    const userMsg = { id: Date.now().toString(), role: "user" as const, content: text };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);
    try {
      const res = await fetch("/api/project/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: messages, projectState, draftProjectId }),
      });
      const data = await res.json();
      if (data.trialLimitReached) { setTrialBlocked(true); setIsTyping(false); return; }
      if (data.reply) setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: "ai", content: data.reply }]);
      if (data.projectState) setProjectState(data.projectState);
      if (data.projectId) setDraftProjectId(data.projectId);
      if (data.needsUpload) setNeedsUpload(true);
      if (data.quickReplies) setQuickReplies(data.quickReplies);
      if (data.result) { setResult(data.result); setNeedsUpload(false); }
    } catch (err) {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: "ai", content: "Something went wrong. Try again." }]);
    } finally {
      setIsTyping(false);
    }
  }

  function handleConfirmUploads() {
    setNeedsUpload(false);
    const uploadSummary = selectedIds.length > 0
      ? `I have selected ${selectedIds.length} clip${selectedIds.length !== 1 ? "s" : ""} for the video.${useVoiceClone ? " Use my voice clone for narration." : ""}${includeMusic ? " Include background music." : ""}`
      : "No clips - create from brand voice only.";
    sendMessage(uploadSummary);
  }

  function handleReset() {
    setMessages([{ id: "0", role: "ai", content: "What are we creating today? Tell me the topic - a trip, a product, a moment, a routine. The more specific the better." }]);
    setInput(""); setProjectState({}); setDraftProjectId(null); setNeedsUpload(false);
    setSelectedIds([]); setQuickReplies([]); setTrialBlocked(false); setResult(null);
  }

  async function generateVideo() {
    if (!draftProjectId) return;
    try {
      const res = await fetch("/api/video/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: draftProjectId }),
      });
      const data = await res.json();
      if (data.error) { alert(data.error); return; }
      setMessages(prev => [...prev, { id: Date.now().toString(), role: "ai", content: "Your video is being generated. Check your project page in about 60 seconds." }]);
    } catch (err) {
      alert("Video generation failed. Try again.");
    }
  }

    if (step === "name") {
    return (
      <div style={{ maxWidth: 560 }}>
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 12 }}>New Project</div>
          <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: 36, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 8 }}>What are we making?</h2>
          <p style={{ fontSize: 15, color: "#7c7660" }}>Give your project a name to get started.</p>
        </div>
        <div style={{ background: "#fff", borderRadius: 16, padding: "32px", border: "1px solid rgba(0,0,0,0.07)" }}>
          <input
            autoFocus
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && projectName.trim()) {
                setMessages([{ id: "0", role: "ai", content: `Love it. Tell me everything about "${projectName}" - what happened, what you want people to feel, and who this is for.` }]);
                setProjectState({ title: projectName.trim() });
                setStep("chat");
              }
            }}
            placeholder="e.g. My Bali Trip, Product Launch, Morning Routine..."
            style={{ width: "100%", padding: "16px 20px", borderRadius: 12, border: "1.5px solid rgba(0,0,0,0.12)", fontFamily: "inherit", fontSize: 16, outline: "none", boxSizing: "border-box", marginBottom: 16 }}
          />
          <button
            onClick={() => {
              if (!projectName.trim()) return;
              setMessages([{ id: "0", role: "ai", content: `Love it. Tell me everything about "${projectName}" - what happened, what you want people to feel, and who this is for.` }]);
              setProjectState({ title: projectName.trim() });
              setStep("chat");
            }}
            disabled={!projectName.trim()}
            style={{ width: "100%", background: projectName.trim() ? "#FF2D2D" : "#f5f5f0", color: projectName.trim() ? "#fff" : "#b5b09a", border: "none", borderRadius: 12, padding: "14px 20px", fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: projectName.trim() ? "pointer" : "default" }}
          >
            Start Creating
          </button>
        </div>
      </div>
    );
  }

  if (trialBlocked) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800 }}>Trial Limit Reached</h2>
        </div>
        <div style={{ background: "#1a1a1a", borderRadius: 20, padding: "48px 40px", textAlign: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 16 }}>Free Trial</div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, color: "#fff", marginBottom: 12 }}>You have used both trial projects</div>
          <div style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", maxWidth: 400, margin: "0 auto 32px" }}>
            Your free trial includes 2 projects. To keep creating, pick a plan. Your work is saved.
          </div>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            {[{ name: "Creator", price: "$29/mo" }, { name: "Pro", price: "$79/mo" }, { name: "Elite", price: "$149/mo" }].map(p => (
              <button key={p.name} style={{ background: "#FF2D2D", color: "#fff", border: "none", borderRadius: 999, padding: "12px 24px", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                {p.name} - {p.price}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 20, fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Cancel anytime - No hidden fees</div>
        </div>
      </div>
    );
  }

  if (result) {
    const scriptLines = (result.script || "").split("\n").filter(Boolean);
    return (
      <div>
        <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 6 }}>Ready</div>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800 }}>{String(projectState.title || "Your Content")}</h2>
          </div>
          <button onClick={handleReset} style={{ background: "none", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 999, padding: "8px 18px", fontFamily: "inherit", fontSize: 13, cursor: "pointer", color: "#7c7660" }}>
            Start fresh
          </button>
        </div>

        {result.projectId && (
          <div style={{ marginBottom: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button onClick={() => router.push(`/project/${result.projectId}`)} style={{ background: "#FF2D2D", color: "#fff", border: "none", borderRadius: 999, padding: "14px 32px", fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
              Review Script & Render Video
            </button>
          </div>
        )}

        {scriptLines.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,0.07)", marginBottom: 16, overflow: "hidden" }}>
            <div style={{ padding: "18px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#7c7660" }}>Script</div>
              <button onClick={() => navigator.clipboard?.writeText(result.script || "")} style={{ background: "none", border: "none", fontSize: 11, color: "#FF2D2D", cursor: "pointer", fontWeight: 700 }}>Copy</button>
            </div>
            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
              {scriptLines.map((line, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: i === 0 ? "#FF2D2D" : "#f5f5f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: i === 0 ? "#fff" : "#7c7660", flexShrink: 0 }}>
                    {i + 1}
                  </div>
                  <p style={{ fontSize: 14, lineHeight: 1.7, color: "#1a1a1a", margin: 0 }}>{line}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {result.caption && (
          <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
            <div style={{ padding: "18px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#7c7660" }}>Caption</div>
              <button onClick={() => navigator.clipboard?.writeText(result.caption || "")} style={{ background: "none", border: "none", fontSize: 11, color: "#FF2D2D", cursor: "pointer", fontWeight: 700 }}>Copy</button>
            </div>
            <div style={{ padding: "16px 20px" }}>
              <p style={{ fontSize: 14, lineHeight: 1.75, color: "#1a1a1a", margin: 0 }}>{result.caption}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        {draftProjectId && projectState.title ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 12, color: "#7c7660", marginBottom: 6 }}>Resuming saved project</div>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, marginBottom: 4 }}>{String(projectState.title)}</h2>
              <p style={{ fontSize: 14, color: "#7c7660" }}>Pick up exactly where you left off.</p>
            </div>
            <button onClick={handleReset} style={{ background: "none", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 999, padding: "8px 16px", fontFamily: "inherit", fontSize: 12, cursor: "pointer", color: "#7c7660" }}>Start fresh</button>
          </div>
        ) : (
          <>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Create Content</h2>
            <p style={{ fontSize: 14, color: "#7c7660" }}>Tell your AI creative director what you want to make.</p>
          </>
        )}
      </div>

      <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
        <div style={{ maxHeight: 420, overflowY: "auto", padding: "24px 20px 16px" }}>
          {messages.map(msg => (
            <div key={msg.id} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", gap: 10, marginBottom: 16, alignItems: "flex-start" }}>
              {msg.role === "ai" && (
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#FF2D2D", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff", flexShrink: 0 }}>L</div>
              )}
              <div style={{ maxWidth: "80%", padding: "12px 16px", borderRadius: msg.role === "user" ? "18px 4px 18px 18px" : "4px 18px 18px 18px", background: msg.role === "user" ? "#FF2D2D" : "#f5f5f0", color: msg.role === "user" ? "#fff" : "#1a1a1a", fontSize: 14, lineHeight: 1.6 }}>
                {msg.content}
              </div>
            </div>
          ))}

          {isTyping && (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#FF2D2D", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff", flexShrink: 0 }}>L</div>
              <div style={{ padding: "14px 18px", borderRadius: "4px 18px 18px 18px", background: "#f5f5f0", display: "flex", gap: 4 }}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#b5b09a", display: "inline-block", animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          )}

          {needsUpload && !isTyping && (
            <div style={{ marginTop: 8 }}>
              <div style={{ background: "linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)", borderRadius: 16, padding: "20px", marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 8 }}>Add Your Media</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Upload your clips and photos</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>Add up to 10 files. Lumevo will use them to build your video.</div>
              </div>

              <div
                onClick={() => fileRef.current?.click()}
                style={{ border: "2px dashed rgba(255,45,45,0.3)", borderRadius: 12, padding: "32px 24px", textAlign: "center", cursor: "pointer", background: "#fafaf4", marginBottom: 12 }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  if (fileRef.current && e.dataTransfer.files.length > 0) {
                    const fake = { target: { files: e.dataTransfer.files } } as unknown as React.ChangeEvent<HTMLInputElement>;
                    handleFileUpload(fake);
                  }
                }}
              >
                {uploadingFiles ? (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#FF2D2D" }}>Uploading...</div>
                    <div style={{ fontSize: 11, color: "#7c7660", marginTop: 4 }}>Files are going directly to the cloud</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 24, marginBottom: 8, color: "#FF2D2D" }}>+</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>Drop videos and photos here</div>
                    <div style={{ fontSize: 11, color: "#7c7660" }}>or click to browse - up to 10 files - MP4, MOV, JPG, PNG</div>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" style={{ display: "none" }} onChange={handleFileUpload} accept="video/*,image/*" multiple />

              {/* Google Drive Import */}
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.07)", padding: "14px 16px", marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#7c7660", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Or import from Google Drive</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={gdriveInput}
                    onChange={e => setGdriveInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && gdriveInput.trim()) {
                        setGdriveImporting(true);
                        setGdriveStatus("Importing...");
                        fetch("/api/uploads/gdrive", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ url: gdriveInput.trim() }),
                        })
                          .then(r => r.json())
                          .then(data => {
                            if (data.error) { setGdriveStatus(data.error); }
                            else if (data.uploads?.length > 0) {
                              setLocalUploads(prev => [...(data.uploads as Upload[]), ...prev]);
                              setSelectedIds(prev => [...data.uploads.map((u: Upload) => u.id), ...prev]);
                              setGdriveInput("");
                              setGdriveStatus("Imported!");
                              setTimeout(() => setGdriveStatus(null), 2000);
                              onRefresh();
                            }
                          })
                          .catch(() => setGdriveStatus("Import failed"))
                          .finally(() => setGdriveImporting(false));
                      }
                    }}
                    placeholder="Paste Google Drive share link..."
                    style={{ flex: 1, padding: "9px 12px", borderRadius: 10, border: "1.5px solid rgba(0,0,0,0.1)", fontFamily: "inherit", fontSize: 12, outline: "none" }}
                  />
                  <button
                    onClick={() => {
                      if (!gdriveInput.trim()) return;
                      setGdriveImporting(true);
                      setGdriveStatus("Importing...");
                      fetch("/api/uploads/gdrive", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ url: gdriveInput.trim() }),
                      })
                        .then(r => r.json())
                        .then(data => {
                          if (data.error) { setGdriveStatus(data.error); }
                          else if (data.uploads?.length > 0) {
                            setLocalUploads(prev => [...(data.uploads as Upload[]), ...prev]);
                            setSelectedIds(prev => [...data.uploads.map((u: Upload) => u.id), ...prev]);
                            setGdriveInput("");
                            setGdriveStatus("Imported!");
                            setTimeout(() => setGdriveStatus(null), 2000);
                            onRefresh();
                          }
                        })
                        .catch(() => setGdriveStatus("Import failed"))
                        .finally(() => setGdriveImporting(false));
                    }}
                    disabled={!gdriveInput.trim() || gdriveImporting}
                    style={{ background: gdriveInput.trim() ? "#FF2D2D" : "#f5f5f0", color: gdriveInput.trim() ? "#fff" : "#b5b09a", border: "none", borderRadius: 10, padding: "9px 14px", fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: gdriveInput.trim() ? "pointer" : "default" }}
                  >
                    {gdriveImporting ? "..." : "Import"}
                  </button>
                </div>
                {gdriveStatus && (
                  <div style={{ fontSize: 11, marginTop: 6, color: gdriveStatus === "Imported!" ? "#16a34a" : gdriveStatus === "Importing..." ? "#7B61FF" : "#FF2D2D", fontWeight: 600 }}>
                    {gdriveStatus}
                  </div>
                )}
              </div>

              {localUploads.filter(u => u.file_type === "video" || u.file_type === "image").length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#7c7660", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Your Media Library - tap to select</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                    {localUploads.filter(u => u.file_type === "video" || u.file_type === "image").map(u => {
                      const sel = selectedIds.includes(u.id);
                      return (
                        <div key={u.id} onClick={() => toggleSelect(u.id)} style={{ position: "relative", borderRadius: 10, overflow: "hidden", aspectRatio: "1", cursor: "pointer", border: sel ? "2px solid #FF2D2D" : "2px solid transparent" }}>
                          {u.file_path && u.file_type === "image" ? (
                            <img src={u.file_path} alt={u.file_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0", fontSize: 11, color: "#7c7660", fontWeight: 600 }}>
                              {u.file_type === "video" ? "Video" : "Image"}
                            </div>
                          )}
                          {sel && (
                            <div style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%", background: "#FF2D2D", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#fff", fontWeight: 800 }}>
                              ok
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {user.elevenlabs_voice_id ? (
                <div onClick={() => setUseVoiceClone(v => !v)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#fafaf4", borderRadius: 12, cursor: "pointer", marginBottom: 8 }}>
                  <div style={{ width: 36, height: 20, background: useVoiceClone ? "#FF2D2D" : "#ddd", borderRadius: 10, position: "relative", flexShrink: 0, transition: "background 0.2s" }}>
                    <div style={{ width: 16, height: 16, background: "#fff", borderRadius: "50%", position: "absolute", top: 2, left: useVoiceClone ? 18 : 2, transition: "left 0.2s" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>Narrate with my voice</div>
                    <div style={{ fontSize: 11, color: "#7c7660" }}>{user.voice_clone_name || "Voice clone active"}</div>
                  </div>
                </div>
              ) : user.subscription_tier === "elite" ? (
                <div style={{ background: "#F8F8A6", borderRadius: 12, padding: "12px 16px", marginBottom: 8, fontSize: 13, color: "#7c7660" }}>
                  Set up your Voice Clone in Settings to narrate this video in your actual voice.
                </div>
              ) : null}

              <div onClick={() => setIncludeMusic(v => !v)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#fafaf4", borderRadius: 12, cursor: "pointer", marginBottom: 12 }}>
                <div style={{ width: 36, height: 20, background: includeMusic ? "#FF2D2D" : "#ddd", borderRadius: 10, position: "relative", flexShrink: 0, transition: "background 0.2s" }}>
                  <div style={{ width: 16, height: 16, background: "#fff", borderRadius: "50%", position: "absolute", top: 2, left: includeMusic ? 18 : 2, transition: "left 0.2s" }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>AI music selection</div>
                  <div style={{ fontSize: 11, color: "#7c7660" }}>Lumevo picks background music that matches your vibe</div>
                </div>
              </div>

              <button onClick={handleConfirmUploads} style={{ width: "100%", background: "#FF2D2D", color: "#fff", border: "none", borderRadius: 12, padding: "14px 20px", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                {selectedIds.length > 0 ? `Create video with ${selectedIds.length} clip${selectedIds.length !== 1 ? "s" : ""}` : "Create from brand voice only"}
              </button>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {quickReplies.length > 0 && !isTyping && !needsUpload && (
          <div style={{ padding: "8px 20px 12px", display: "flex", gap: 8, flexWrap: "wrap", borderTop: "1px solid rgba(0,0,0,0.05)" }}>
            {quickReplies.map(q => (
              <button key={q} onClick={() => sendMessage(q)} style={{ padding: "7px 14px", borderRadius: 999, border: "1.5px solid rgba(0,0,0,0.1)", background: "#fff", fontFamily: "inherit", fontSize: 13, cursor: "pointer", color: "#1a1a1a" }}>
                {q}
              </button>
            ))}
          </div>
        )}

        <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(0,0,0,0.06)", display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Type anything..."
            disabled={isTyping || needsUpload}
            rows={1}
            style={{ flex: 1, padding: "11px 14px", borderRadius: 12, border: "1.5px solid rgba(0,0,0,0.1)", fontFamily: "inherit", fontSize: 14, resize: "none", outline: "none", background: "#fafaf4" }}
          />
          <button onClick={() => sendMessage()} disabled={!input.trim() || isTyping} style={{ width: 42, height: 42, borderRadius: 12, background: input.trim() ? "#FF2D2D" : "#f5f5f0", border: "none", color: input.trim() ? "#fff" : "#b5b09a", cursor: input.trim() ? "pointer" : "default", fontSize: 18, fontWeight: 700 }}>
            →
          </button>
        </div>
      </div>
      <style>{`@keyframes bounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-5px); opacity: 1; } }`}</style>
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
          { name: "Elite", price: "$149/mo", features: ["Everything in Pro", "Voice Clone Studio", "AI Manager", "White-label export"] },
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
      <div style={{ width: 220, background: "#fff", borderRight: "1px solid rgba(0,0,0,0.07)", display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, height: "100vh", zIndex: 10, overflowY: "auto" }}>
        <div style={{ padding: "24px 20px 16px" }}>
          <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 22, color: "#FF2D2D", letterSpacing: 2, marginBottom: 4 }}>LUMEVO</div>
          <div style={{ fontSize: 10, color: "#b5b09a", letterSpacing: 1, textTransform: "uppercase" }}>Studio</div>
        </div>

        <nav style={{ flex: 1, padding: "0 10px" }}>
          {groups.map(group => {
            const items = NAV.filter(n => (n.group || "") === group);
            if (!items.length) return null;
            return (
              <div key={group} style={{ marginBottom: 8 }}>
                {group && (
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#b5b09a", padding: "8px 10px 4px" }}>{group}</div>
                )}
                {items.map(item => {
                  const active = section === item.id;
                  if (item.elite && user.subscription_tier !== "elite") {
                    return (
                      <div key={item.id} onClick={() => handleNav(item.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 10px", borderRadius: 10, cursor: "pointer", marginBottom: 2 }}>
                        <span style={{ fontSize: 13, color: "#b5b09a" }}>{item.label}</span>
                        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", background: "#FF2D2D", color: "#fff", padding: "2px 6px", borderRadius: 4 }}>Elite</span>
                      </div>
                    );
                  }
                  return (
                    <div key={item.id} onClick={() => handleNav(item.id)} style={{ padding: "9px 10px", borderRadius: 10, cursor: "pointer", marginBottom: 2, background: active ? "#FF2D2D" : "transparent" }}>
                      <span style={{ fontSize: 13, fontWeight: active ? 700 : 400, color: active ? "#fff" : "#1a1a1a" }}>{item.label}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(0,0,0,0.07)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a", marginBottom: 2 }}>{user.name}</div>
          <div style={{ fontSize: 11, color: "#b5b09a", marginBottom: 12 }}>{TIER_LABELS[user.subscription_tier] || user.subscription_tier}</div>
          <button onClick={handleLogout} style={{ background: "none", border: "none", fontSize: 12, color: "#b5b09a", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>Log out</button>
        </div>
      </div>

      <div style={{ marginLeft: 220, flex: 1, padding: "40px 40px 80px", minWidth: 0 }}>
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
