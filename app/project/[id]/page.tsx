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

  async function load() {
    const res = await fetch(`/api/projects/${id}`);
    if (!res.ok) { router.push("/dashboard"); return; }
    const data = await res.json();
    setProject(data.project);
    const gc = data.project?.generated_content;
    if (gc?.videoUrl) setVideoUrl(gc.videoUrl);
    // Also check video_url column
    if (data.project?.video_url) setVideoUrl(data.project.video_url as string);
    const uRes = await fetch(`/api/uploads?projectId=${id}`);
    if (uRes.ok) { const uData = await uRes.json(); setUploads(uData.uploads || []); }
    setLoading(false);
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

  async function generateVideo() {
    if (uploads.length === 0) return;
    setGenerating(true);
    setGenError(null);

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

      // Step 2: Render
      setGenStatus("Crafting your video... this takes 3–5 minutes.");
      const renderRes = await fetch("/api/video/render-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id }),
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
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "48px 24px 100px", background: "#e8dfc0", minHeight: "100vh" }}>
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

      {/* Video output */}
      {videoUrl && (
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#FF2D2D", marginBottom: 14 }}>Your Video</div>
          <video src={videoUrl} controls style={{ width: "100%", maxWidth: 380, borderRadius: 16, display: "block" }} />
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <a href={videoUrl} download
              style={{ background: "#FF2D2D", color: "#fff", padding: "10px 22px", borderRadius: 999, textDecoration: "none", fontWeight: 700, fontSize: 14 }}>
              Download
            </a>
            <button onClick={generateVideo} disabled={generating}
              style={{ background: "#fff", color: "#1a1a1a", border: "1.5px solid rgba(0,0,0,0.1)", borderRadius: 999, padding: "10px 22px", fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              Regenerate
            </button>
          </div>
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
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#7c7660", marginBottom: 14 }}>
            Media ({uploads.length} file{uploads.length !== 1 ? "s" : ""})
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
            {uploads.map(u => (
              <div key={u.id} style={{ position: "relative", background: "#fff", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(0,0,0,0.08)" }}>
                {u.file_path && u.file_type === "image" ? (
                  <img src={u.file_path} alt={u.file_name} style={{ width: "100%", height: 110, objectFit: "cover", display: "block" }} />
                ) : (
                  <div style={{ width: "100%", height: 110, background: "#ddd3a8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#a89b7a" }}>▷</div>
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
                  {u.video_duration_sec && <div style={{ fontSize: 10, color: "#7c7660", marginTop: 1 }}>{u.video_duration_sec.toFixed(1)}s</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
