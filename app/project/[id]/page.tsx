"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getProject, deleteProject } from "../../../lib/projectStore";
import type { Project } from "../../../lib/types";
import { VIBE_LABELS, TONE_LABELS, AUDIENCE_GOAL_LABELS } from "../../../lib/types";

const STATUS_STYLE: Record<Project["status"], { bg: string; text: string; label: string }> = {
  draft:      { bg: "rgba(0,0,0,0.06)", text: "#78716c", label: "Draft" },
  generating: { bg: "rgba(255,45,45,0.1)",  text: "#FF2D2D", label: "Generating…" },
  ready:      { bg: "rgba(22,163,74,0.1)", text: "#16a34a", label: "Ready" },
};

interface NavCard {
  title: string;
  description: string;
  icon: string;
  href: string;
  ready: boolean;
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    const p = getProject(id);
    if (!p) { router.push("/dashboard"); return; }
    setProject(p);
  }, [id, router]);

  function handleDelete() {
    if (!confirm("Delete this project? This can't be undone.")) return;
    deleteProject(id);
    router.push("/dashboard");
  }

  if (!project) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#F8F8A6" }}>
        <div style={{ width: 8, height: 8, background: "#FF2D2D", borderRadius: "50%" }} />
      </div>
    );
  }

  const st = STATUS_STYLE[project.status];
  const fileCount = project.uploadedFiles.length;

  const navCards: NavCard[] = [
    {
      title: "Content Brief",
      description: "Set vibe, tone, audience goal — then generate captions, titles & structure.",
      icon: "✦",
      href: `/project/${id}/script`,
      ready: true,
    },
    {
      title: "Upload Media",
      description: "Add images and videos for your project.",
      icon: "📁",
      href: `/project/${id}/upload`,
      ready: true,
    },
    {
      title: "Voice Clone",
      description: "Clone your voice and hear generated captions read back in your own voice.",
      icon: "🎙",
      href: `/project/${id}/voice`,
      ready: true,
    },
    {
      title: "Brand Style",
      description: "Set your color palette, fonts, and visual identity.",
      icon: "🎨",
      href: `/project/${id}/brand`,
      ready: false,
    },
    {
      title: "Export & Publish",
      description: "Render final video and publish to platforms.",
      icon: "🚀",
      href: `/project/${id}/export`,
      ready: false,
    },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');
        :root { --bg:#F8F8A6; --surface:#ffffff; --surface2:#F2F29A; --border:rgba(0,0,0,0.08); --accent:#FF2D2D; --accent2:#FF2D2D; --text:#1a1a1a; --muted:#78716c; --radius:14px; }
        * { box-sizing:border-box; margin:0; padding:0; }
        body { background:var(--bg); color:var(--text); font-family:'DM Sans',system-ui,sans-serif; min-height:100vh; }

        .page-wrap { max-width:900px; margin:0 auto; padding:48px 24px 100px; }

        .back-btn { display:flex; align-items:center; gap:6px; color:var(--muted); background:none; border:none; cursor:pointer; font-size:14px; font-family:inherit; transition:color 0.2s; margin-bottom:40px; }
        .back-btn:hover { color:var(--text); }

        .project-header { margin-bottom:48px; }
        .project-status { display:inline-block; font-size:11px; font-weight:600; padding:4px 12px; border-radius:999px; margin-bottom:12px; }
        .project-title { font-family:'Syne',sans-serif; font-size:34px; font-weight:800; letter-spacing:-0.5px; margin-bottom:8px; }
        .project-desc { font-size:15px; color:var(--muted); line-height:1.6; margin-bottom:16px; max-width:600px; }
        .project-meta { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:20px; }
        .meta-chip { font-size:12px; color:var(--muted); background:var(--surface); border:1px solid var(--border); padding:4px 12px; border-radius:999px; }

        .action-row { display:flex; gap:10px; flex-wrap:wrap; }
        .btn-delete { display:flex; align-items:center; gap:6px; background:transparent; color:var(--muted); font-family:inherit; font-size:13px; font-weight:500; border:1px solid var(--border); border-radius:999px; padding:8px 18px; cursor:pointer; transition:all 0.15s; }
        .btn-delete:hover { border-color:rgba(255,45,45,0.4); color:var(--accent); }

        .divider { border:none; border-top:1px solid var(--border); margin:0 0 40px; }

        .section-title { font-family:'Syne',sans-serif; font-size:20px; font-weight:700; margin-bottom:20px; }

        .nav-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:14px; }

        .nav-card { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:22px 24px; cursor:pointer; transition:border-color 0.2s,transform 0.2s,box-shadow 0.2s; text-decoration:none; display:block; position:relative; }
        .nav-card:hover { border-color:rgba(255,45,45,0.3); transform:translateY(-2px); box-shadow:0 4px 20px rgba(0,0,0,0.06); }
        .nav-card-disabled { opacity:0.45; cursor:default; pointer-events:none; }

        .nav-icon { font-size:24px; margin-bottom:12px; display:block; }
        .nav-title { font-size:15px; font-weight:600; color:var(--text); margin-bottom:6px; }
        .nav-desc { font-size:13px; color:var(--muted); line-height:1.5; }

        .coming-badge { position:absolute; top:14px; right:14px; font-size:10px; font-weight:600; letter-spacing:1px; text-transform:uppercase; color:var(--muted); background:var(--surface2); padding:3px 10px; border-radius:999px; }
      `}</style>

      <div className="page-wrap">
        <button className="back-btn" onClick={() => router.push("/dashboard")}>← Dashboard</button>

        <div className="project-header">
          <span className="project-status" style={{ background: st.bg, color: st.text }}>{st.label}</span>
          <h1 className="project-title">{project.title}</h1>
          {project.description && <p className="project-desc">{project.description}</p>}

          <div className="project-meta">
            {project.vibe && <span className="meta-chip">{VIBE_LABELS[project.vibe as keyof typeof VIBE_LABELS]}</span>}
            {project.tone && <span className="meta-chip">{TONE_LABELS[project.tone as keyof typeof TONE_LABELS]}</span>}
            {project.audienceGoal && <span className="meta-chip">{AUDIENCE_GOAL_LABELS[project.audienceGoal as keyof typeof AUDIENCE_GOAL_LABELS]}</span>}
            {fileCount > 0 && <span className="meta-chip">📁 {fileCount} file{fileCount > 1 ? "s" : ""}</span>}
          </div>

          <div className="action-row">
            <button className="btn-delete" onClick={handleDelete}>🗑 Delete Project</button>
          </div>
        </div>

        <hr className="divider" />

        <h2 className="section-title">Project Steps</h2>
        <div className="nav-grid">
          {navCards.map((card) => (
            <a
              key={card.title}
              className={`nav-card ${!card.ready ? "nav-card-disabled" : ""}`}
              href={card.ready ? card.href : undefined}
              onClick={(e) => {
                if (card.ready) { e.preventDefault(); router.push(card.href); }
              }}
            >
              {!card.ready && <span className="coming-badge">Coming Soon</span>}
              <span className="nav-icon">{card.icon}</span>
              <p className="nav-title">{card.title}</p>
              <p className="nav-desc">{card.description}</p>
            </a>
          ))}
        </div>
      </div>
    </>
  );
}
