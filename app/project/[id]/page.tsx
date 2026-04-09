"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface Upload {
  id: string;
  file_type: string;
  file_name: string;
  file_path: string | null;
  file_size: number;
  video_duration_sec?: number | null;
  ai_analysis?: Record<string, unknown> | null;
}

interface VideoPlan {
  video_concept?: string;
  target_emotion?: string;
  music_brief?: string;
  [key: string]: unknown;
}

const FEEDBACK_CHIPS: { key: string; label: string; apiKey: string }[] = [
  { key: "more_energy",       label: "⚡ More Energy",         apiKey: "more_energy" },
  { key: "better_music",      label: "🎵 Better Music",        apiKey: "better_music" },
  { key: "more_cinematic",    label: "🔍 Zoom In More",        apiKey: "more_cinematic" },
  { key: "faster_pace",       label: "✂️ Speed Up Clips",      apiKey: "faster_pace" },
  { key: "slower_pace",       label: "🔄 Smoother Cuts",       apiKey: "slower_pace" },
  { key: "more_personal",     label: "🎤 More Natural Audio",  apiKey: "more_personal" },
];

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Record<string, unknown> | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [generating, setGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [genError, setGenError] = useState<string | null>(null);
  const [genStatus, setGenStatus] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // AI Feedback Panel state
  const [feedbackApplied, setFeedbackApplied] = useState(false);
  const [customFeedback, setCustomFeedback] = useState("");
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [claudePlan, setClaudePlan] = useState<VideoPlan | null>(null);

  // Music style state
  const [musicStyle, setMusicStyle] = useState("");
  const [savingMusicStyle, setSavingMusicStyle] = useState(false);
  const [musicSaved, setMusicSaved] = useState(false);

  // Clip analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeMessage, setAnalyzeMessage] = useState<string | null>(null);
  const [clipAnalysis, setClipAnalysis] = useState<Record<string, { has_laughter: boolean; mood: string; description: string }>>({});

  async function load() {
    const res = await fetch(`/api/projects/${id}`);
    if (!res.ok) { router.push("/dashboard"); return; }
    const data = await res.json();
    setProject(data.project);
    const gc = data.project?.generated_content;
    if (gc?.videoUrl) setVideoUrl(gc.videoUrl);
    // Also check video_url column
    if (data.project?.video_url) setVideoUrl(data.project.video_url as string);

    // Parse claude_plan (comes back as JSONB string or object)
    try {
      const rawPlan = data.project?.claude_plan;
      if (rawPlan && typeof rawPlan === "string") setClaudePlan(JSON.parse(rawPlan) as VideoPlan);
      else if (rawPlan && typeof rawPlan === "object") setClaudePlan(rawPlan as VideoPlan);
    } catch { setClaudePlan(null); }

    // Load music style
    if (data.project?.music_style) setMusicStyle(data.project.music_style as string);

    const uRes = await fetch(`/api/uploads?projectId=${id}`);
    if (uRes.ok) { const uData = await uRes.json(); setUploads(uData.uploads || []); }
    setLoading(false);

    // If still rendering, auto-poll for completion
    if (data.project?.status === "rendering" && data.project?.render_id && !data.project?.video_url) {
      const renderId = data.project.render_id as string;
      setGenStatus("Crafting your video...");
      let attempts = 0;
      const poll = async () => {
        while (attempts < 60) {
          await new Promise(r => setTimeout(r, 5000));
          attempts++;
          try {
            const statusRes = await fetch(`/api/video/status?renderId=${renderId}`);
            const statusData = await statusRes.json();
            if (statusData.status === "succeeded") { setVideoUrl(statusData.url); setGenStatus(null); return; }
            if (statusData.status === "failed") { setGenError(statusData.errorMessage || "Render failed"); setGenStatus(null); return; }
            setGenStatus(`Crafting your video... ${Math.min(attempts * 5, 300)}s`);
          } catch { /* keep polling */ }
        }
        setGenStatus(null);
      };
      poll();
    }
  }

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function deleteUpload(uploadId: string) {
    setDeletingId(uploadId);
    try {
      const res = await fetch(`/api/uploads/${uploadId}`, { method: "DELETE" });
      if (res.ok) setUploads(prev => prev.filter(u => u.id !== uploadId));
    } catch (err) { console.error(err); }
    setDeletingId(null);
  }

  async function sendFeedback(feedbackText: string) {
    setFeedbackSending(true);
    try {
      await fetch("/api/video/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id, feedback: feedbackText }),
      });
      setFeedbackApplied(true);
    } catch (err) { console.error(err); }
    setFeedbackSending(false);
  }

  async function handleChipClick(apiKey: string) {
    await sendFeedback(apiKey);
  }

  async function handleCustomFeedbackSubmit() {
    if (!customFeedback.trim()) return;
    await sendFeedback(customFeedback.trim());
    setCustomFeedback("");
  }

  async function analyzeClips() {
    setAnalyzing(true);
    setAnalyzeMessage("Scanning clips for Elliott's laughter...");
    try {
      const res = await fetch("/api/uploads/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id }),
      });
      const data = await res.json();
      if (data.results) {
        const map: Record<string, { has_laughter: boolean; mood: string; description: string }> = {};
        for (const r of data.results) {
          map[r.id] = { has_laughter: r.has_laughter, mood: r.mood, description: r.description };
        }
        setClipAnalysis(map);
      }
      setAnalyzeMessage(data.message || "Analysis complete.");
    } catch (err) {
      console.error(err);
      setAnalyzeMessage("Analysis failed — try again.");
    }
    setAnalyzing(false);
  }

  async function saveMusicStyle() {
    if (!musicStyle.trim()) return;
    setSavingMusicStyle(true);
    setMusicSaved(false);
    try {
      await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ music_style: musicStyle.trim() }),
      });
      setMusicSaved(true);
      setTimeout(() => setMusicSaved(false), 3000);
    } catch (err) { console.error(err); }
    setSavingMusicStyle(false);
  }

  async function generateVideo() {
    if (uploads.length === 0) return;
    setGenerating(true);
    setGenError(null);
    setFeedbackApplied(false);

    try {
      // Step 1: Plan
      setGenStatus("Your AI creative director is planning the edit...");
      const planRes = await fetch("/api/video/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id }),
      });
      const planData = await planRes.json();
      if (planData.error) { setGenError(planData.error); setGenStatus(null); setGenerating(false); return; }

      // Update local plan state if returned
      if (planData.plan) {
        try {
          const p = typeof planData.plan === "string" ? JSON.parse(planData.plan) : planData.plan;
          setClaudePlan(p as VideoPlan);
        } catch { /* ignore */ }
      }

      // Step 2: Render (pass plan in body as fallback if DB save didn't persist)
      setGenStatus("Crafting your video... this takes 3–5 minutes.");
      const renderRes = await fetch("/api/video/render-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id, plan: planData.plan }),
      });
      const renderData = await renderRes.json();
      if (renderData.error) { setGenError(renderData.error); setGenStatus(null); setGenerating(false); return; }

      // Step 3: Poll
      if (renderData.renderId) {
        let attempts = 0;
        while (attempts < 60) {
          await new Promise(r => setTimeout(r, 5000));
          attempts++;
          try {
            const statusRes = await fetch(`/api/video/status?renderId=${renderData.renderId}`);
            const statusData = await statusRes.json();
            if (statusData.status === "succeeded") {
              setVideoUrl(statusData.url || renderData.videoUrl);
              setGenStatus(null);
              setGenerating(false);
              return;
            }
            if (statusData.status === "failed") {
              setGenError(statusData.errorMessage || "Render failed");
              setGenStatus(null);
              setGenerating(false);
              return;
            }
            setGenStatus(`Crafting your video... ${Math.min(attempts * 5, 300)}s`);
          } catch { /* keep polling */ }
        }
        setGenError("Render timed out. Check back in a few minutes.");
      }
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Generation failed");
    }
    setGenerating(false);
    setGenStatus(null);
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#e8dfc0" }}>
      <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 22, color: "#FF2D2D", letterSpacing: 2 }}>LUMEVO</div>
    </div>
  );

  const platform = (project?.target_platform as string) || "instagram";
  const PLATFORM_LABELS: Record<string, string> = { tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube", general: "General" };

  return (
    <div style={{ maxWidth: videoUrl ? 1100 : 860, margin: "0 auto", padding: "48px 24px 100px", background: "#e8dfc0", minHeight: "100vh" }}>
      <button onClick={() => router.push("/dashboard")}
        style={{ background: "none", border: "none", cursor: "pointer", marginBottom: 28, fontSize: 13, color: "#7c7660", fontFamily: "inherit" }}>
        ← Back to Studio
      </button>

      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 34, fontWeight: 800, marginBottom: 6, letterSpacing: "-0.5px" }}>
        {String(project?.title || "Project")}
      </h1>
      <p style={{ color: "#7c7660", marginBottom: 40, fontSize: 14 }}>
        {String(project?.vibe || "")}
        {platform ? ` · ${PLATFORM_LABELS[platform] || platform}` : ""}
        {project?.target_duration ? ` · ${String(project.target_duration)}s` : ""}
      </p>

      {/* Video output + AI Feedback Panel — two-column when video exists */}
      {videoUrl && (
        <div style={{
          display: "flex",
          flexDirection: "row",
          gap: 28,
          marginBottom: 40,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}>
          {/* Left: video player + download */}
          <div style={{ flex: "0 0 auto", minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 14 }}>Your Video</div>
            <video src={videoUrl} controls style={{ width: "100%", maxWidth: 340, borderRadius: 16, display: "block" }} />
            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <a href={videoUrl} download
                style={{ background: "#FF2D2D", color: "#fff", padding: "10px 22px", borderRadius: 999, textDecoration: "none", fontWeight: 700, fontSize: 14 }}>
                Download
              </a>
              {!feedbackApplied && (
                <button onClick={generateVideo} disabled={generating}
                  style={{ background: "#fff", color: "#1a1a1a", border: "1.5px solid rgba(0,0,0,0.1)", borderRadius: 999, padding: "10px 22px", fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  Regenerate
                </button>
              )}
            </div>
          </div>

          {/* Right: AI Feedback Panel */}
          <div style={{
            flex: "1 1 300px",
            background: "#fff",
            borderRadius: 20,
            border: "1.5px solid rgba(0,0,0,0.08)",
            padding: "24px 22px",
            minWidth: 0,
          }}>
            {/* Header */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 800, color: "#1a1a1a", marginBottom: 5 }}>
                🎬 AI Director&apos;s Notes
              </div>
              {claudePlan?.video_concept && (
                <div style={{ fontSize: 13, color: "#7c7660", lineHeight: 1.5 }}>
                  {claudePlan.video_concept}
                </div>
              )}
            </div>

            {/* Quick action chips */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#7c7660", marginBottom: 10 }}>
                Quick Feedback
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {FEEDBACK_CHIPS.map(chip => (
                  <button
                    key={chip.key}
                    onClick={() => handleChipClick(chip.apiKey)}
                    disabled={feedbackSending}
                    style={{
                      background: "#f5f0e4",
                      border: "1.5px solid rgba(0,0,0,0.08)",
                      borderRadius: 999,
                      padding: "7px 14px",
                      fontSize: 13,
                      fontFamily: "inherit",
                      fontWeight: 600,
                      color: "#1a1a1a",
                      cursor: feedbackSending ? "not-allowed" : "pointer",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#ede5cc"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#f5f0e4"; }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom feedback textarea */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#7c7660", marginBottom: 10 }}>
                Custom Note
              </div>
              <textarea
                value={customFeedback}
                onChange={e => setCustomFeedback(e.target.value)}
                placeholder="Tell the AI what to change..."
                rows={3}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  border: "1.5px solid rgba(0,0,0,0.1)",
                  borderRadius: 12,
                  padding: "10px 14px",
                  fontFamily: "inherit",
                  fontSize: 13,
                  color: "#1a1a1a",
                  background: "#faf8f2",
                  resize: "vertical",
                  outline: "none",
                }}
              />
              <button
                onClick={handleCustomFeedbackSubmit}
                disabled={feedbackSending || !customFeedback.trim()}
                style={{
                  marginTop: 8,
                  background: "#1a1a1a",
                  color: "#fff",
                  border: "none",
                  borderRadius: 999,
                  padding: "9px 20px",
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: feedbackSending || !customFeedback.trim() ? "not-allowed" : "pointer",
                  opacity: feedbackSending || !customFeedback.trim() ? 0.5 : 1,
                }}
              >
                {feedbackSending ? "Sending..." : "Send →"}
              </button>
            </div>

            {/* Regenerate button — only shown after feedback */}
            {feedbackApplied && (
              <div style={{ borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 18 }}>
                <div style={{ fontSize: 12, color: "#7c7660", marginBottom: 12 }}>
                  Feedback saved. Ready to regenerate with your changes.
                </div>
                <button
                  onClick={generateVideo}
                  disabled={generating}
                  style={{
                    width: "100%",
                    background: "#fff",
                    color: "#1a1a1a",
                    border: "1.5px solid #1a1a1a",
                    borderRadius: 12,
                    padding: "13px",
                    fontFamily: "inherit",
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: generating ? "not-allowed" : "pointer",
                    opacity: generating ? 0.6 : 1,
                  }}
                >
                  {generating ? "Regenerating..." : "Regenerate with changes →"}
                </button>
              </div>
            )}
          </div>

          {/* Responsive: stack on mobile via a style tag */}
          <style>{`
            @media (max-width: 768px) {
              .video-feedback-row { flex-direction: column !important; }
            }
          `}</style>
        </div>
      )}

      {/* Status / Error */}
      {genError && (
        <div style={{ background: "#fff0f0", border: "1px solid rgba(255,45,45,0.2)", borderRadius: 12, padding: "14px 18px", marginBottom: 16, fontSize: 13, color: "#FF2D2D" }}>{genError}</div>
      )}
      {genStatus && (
        <div style={{ background: "#1a1a1a", borderRadius: 20, padding: "36px 28px", textAlign: "center", marginBottom: 24 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid rgba(255,45,45,0.25)", borderTopColor: "#FF2D2D", margin: "0 auto 16px", animation: "spin 1s linear infinite" }} />
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 6 }}>{genStatus}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Your cinematic video is being crafted</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Media grid */}
      {uploads.length > 0 && (
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#7c7660" }}>
              Media ({uploads.length} file{uploads.length !== 1 ? "s" : ""})
            </div>
            <button
              onClick={analyzeClips}
              disabled={analyzing}
              style={{
                background: analyzing ? "#ccc" : "#1a1a1a",
                color: "#fff", border: "none", borderRadius: 999,
                padding: "7px 16px", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                cursor: analyzing ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {analyzing ? "Scanning..." : "🔍 Find Baby Sounds"}
            </button>
          </div>

          {analyzeMessage && (
            <div style={{
              background: analyzeMessage.includes("Found") ? "#f0fdf4" : "#faf8f2",
              border: `1px solid ${analyzeMessage.includes("Found") ? "rgba(34,164,84,0.25)" : "rgba(0,0,0,0.08)"}`,
              borderRadius: 10, padding: "10px 14px", marginBottom: 12,
              fontSize: 13, color: analyzeMessage.includes("Found") ? "#22a454" : "#7c7660", fontWeight: 600,
            }}>
              {analyzeMessage}
              {analyzeMessage.includes("Found") && " Tap Regenerate to use them!"}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
            {uploads.map(u => {
              const analysis = clipAnalysis[u.id];
              return (
                <div key={u.id} style={{ position: "relative", background: "#fff", borderRadius: 12, overflow: "hidden", border: `1.5px solid ${analysis?.has_laughter ? "rgba(34,164,84,0.4)" : "rgba(0,0,0,0.08)"}` }}>
                  {u.file_path && u.file_type === "image" ? (
                    <img src={u.file_path} alt={u.file_name} style={{ width: "100%", height: 110, objectFit: "cover", display: "block" }} />
                  ) : (
                    <div style={{ width: "100%", height: 110, background: "#ddd3a8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#a89b7a" }}>▷</div>
                  )}
                  {/* Laughter badge */}
                  {analysis?.has_laughter && (
                    <div style={{
                      position: "absolute", top: 6, left: 6,
                      background: "#22a454", color: "#fff", borderRadius: 999,
                      padding: "2px 7px", fontSize: 10, fontWeight: 700,
                    }}>😂 audio</div>
                  )}
                  {/* X delete button */}
                  <button
                    onClick={() => deleteUpload(u.id)}
                    disabled={deletingId === u.id}
                    style={{
                      position: "absolute", top: 6, right: 6,
                      width: 22, height: 22, borderRadius: "50%",
                      background: deletingId === u.id ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.6)",
                      border: "none", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, color: "#fff", fontWeight: 700, lineHeight: 1,
                    }}>
                    {deletingId === u.id ? "·" : "×"}
                  </button>
                  <div style={{ padding: "6px 10px" }}>
                    <div style={{ fontSize: 11, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#1a1a1a" }}>{u.file_name}</div>
                    {analysis?.description
                      ? <div style={{ fontSize: 10, color: "#7c7660", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{analysis.description}</div>
                      : u.video_duration_sec
                        ? <div style={{ fontSize: 10, color: "#7c7660", marginTop: 1 }}>{u.video_duration_sec.toFixed(1)}s</div>
                        : null
                    }
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Music Style Card */}
      <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid rgba(0,0,0,0.08)", padding: "20px 22px", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 20 }}>🎵</span>
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 15, color: "#1a1a1a" }}>Music Style</div>
            <div style={{ fontSize: 12, color: "#7c7660", marginTop: 1 }}>Tell the AI what genre or vibe you want — it generates music to match.</div>
          </div>
        </div>
        <input
          type="text"
          value={musicStyle}
          onChange={e => setMusicStyle(e.target.value)}
          placeholder='e.g. "warm country like Ella Langley" or "upbeat pop" or "cinematic strings"'
          onKeyDown={e => e.key === "Enter" && saveMusicStyle()}
          style={{
            width: "100%",
            boxSizing: "border-box",
            border: "1.5px solid rgba(0,0,0,0.12)",
            borderRadius: 10,
            padding: "10px 14px",
            fontFamily: "inherit",
            fontSize: 14,
            color: "#1a1a1a",
            background: "#faf8f2",
            outline: "none",
            marginBottom: 10,
          }}
        />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={saveMusicStyle}
            disabled={savingMusicStyle || !musicStyle.trim()}
            style={{
              background: "#1a1a1a", color: "#fff", border: "none", borderRadius: 999,
              padding: "9px 20px", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
              cursor: savingMusicStyle || !musicStyle.trim() ? "not-allowed" : "pointer",
              opacity: savingMusicStyle || !musicStyle.trim() ? 0.5 : 1,
            }}
          >
            {savingMusicStyle ? "Saving..." : "Save Style"}
          </button>
          {musicSaved && (
            <span style={{ fontSize: 12, color: "#22a454", fontWeight: 600 }}>✓ Saved — music will regenerate on next video</span>
          )}
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: "#a89b7a" }}>
          💡 Your saved music style gets sent to ElevenLabs AI every time you generate — it creates a fresh track to match your description.
        </div>
      </div>

      {/* Generate button */}
      {!genStatus && (
        uploads.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 16, padding: "32px", border: "1px solid rgba(0,0,0,0.08)", textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", marginBottom: 8 }}>No media yet</div>
            <div style={{ fontSize: 13, color: "#7c7660", marginBottom: 20 }}>Go back to the dashboard and add media to this project to generate a video.</div>
            <button onClick={() => router.push("/dashboard")}
              style={{ background: "#FF2D2D", color: "#fff", border: "none", borderRadius: 999, padding: "12px 24px", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Add Media
            </button>
          </div>
        ) : !videoUrl ? (
          <button onClick={generateVideo} disabled={generating}
            style={{ width: "100%", background: "#FF2D2D", color: "#fff", border: "none", borderRadius: 12, padding: "18px", fontFamily: "inherit", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
            Generate Cinematic Video
          </button>
        ) : null
      )}
    </div>
  );
}
