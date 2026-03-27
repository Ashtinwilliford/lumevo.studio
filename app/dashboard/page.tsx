"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAllProjects, createAndSaveProject, deleteProject } from "../../lib/projectStore";
import type { Project } from "../../lib/types";
import { VIBE_LABELS, TONE_LABELS } from "../../lib/types";

const STATUS_STYLE: Record<Project["status"], { bg: string; text: string; label: string }> = {
  draft:      { bg: "rgba(113,113,122,0.15)", text: "#71717a", label: "Draft" },
  generating: { bg: "rgba(255,224,130,0.15)",  text: "#FFE082", label: "Generating…" },
  ready:      { bg: "rgba(74,222,128,0.12)", text: "#4ade80", label: "Ready" },
};

function ProjectCard({ project, onOpen, onDelete }: { project: Project; onOpen: () => void; onDelete: () => void }) {
  const st = STATUS_STYLE[project.status];
  const fileCount = project.uploadedFiles.length;
  const date = new Date(project.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="card" onClick={onOpen}>
      <div className="card-thumb">
        {project.thumbnail ? (
          <img src={project.thumbnail} alt="" className="card-thumb-img" />
        ) : (
          <div className="card-thumb-placeholder">
            <span>{project.title.slice(0, 2).toUpperCase()}</span>
          </div>
        )}
      </div>
      <div className="card-body">
        <div className="card-top">
          <h3 className="card-title">{project.title}</h3>
          <span className="status-badge" style={{ background: st.bg, color: st.text }}>{st.label}</span>
        </div>
        {project.description && <p className="card-desc">{project.description}</p>}
        <div className="card-meta">
          {project.vibe && <span className="meta-chip">{VIBE_LABELS[project.vibe as keyof typeof VIBE_LABELS]}</span>}
          {project.tone && <span className="meta-chip">{TONE_LABELS[project.tone as keyof typeof TONE_LABELS]}</span>}
          {fileCount > 0 && <span className="meta-chip">📁 {fileCount} file{fileCount > 1 ? "s" : ""}</span>}
        </div>
        <div className="card-footer">
          <span className="card-date">{date}</span>
          <button className="delete-btn" onClick={(e) => { e.stopPropagation(); onDelete(); }}>×</button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">✦</div>
      <h3 className="empty-title">No projects yet</h3>
      <p className="empty-sub">Start creating and your projects will appear here.</p>
      <button className="btn-primary" onClick={onCreate}>New Project</button>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [filter, setFilter] = useState<"all" | "draft" | "ready">("all");

  useEffect(() => { setProjects(getAllProjects()); }, []);

  function handleNew() {
    const p = createAndSaveProject({ title: "Untitled Project" });
    router.push(`/project/${p.id}`);
  }

  function handleDelete(id: string) {
    deleteProject(id);
    setProjects(getAllProjects());
  }

  const filtered = filter === "all" ? projects : projects.filter((p) => p.status === filter);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');
        :root { --bg:#09090b; --surface:#111113; --surface2:#18181b; --border:rgba(255,255,255,0.07); --accent:#FFE082; --accent2:#C62828; --text:#f4f4f5; --muted:#71717a; --radius:14px; }
        * { box-sizing:border-box; margin:0; padding:0; }
        body { background:var(--bg); color:var(--text); font-family:'DM Sans',system-ui,sans-serif; min-height:100vh; }
        .dash-wrap { max-width:1100px; margin:0 auto; padding:48px 24px 80px; }
        .dash-header { display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:36px; gap:16px; flex-wrap:wrap; }
        .dash-logo { font-family:'Syne',sans-serif; font-size:13px; font-weight:800; letter-spacing:3px; text-transform:uppercase; color:var(--accent2); margin-bottom:4px; }
        .dash-title { font-family:'Syne',sans-serif; font-size:34px; font-weight:800; letter-spacing:-0.5px; }
        .btn-primary { display:flex; align-items:center; gap:8px; background:var(--accent2); color:#fff; font-family:inherit; font-size:14px; font-weight:600; border:none; border-radius:999px; padding:12px 24px; cursor:pointer; white-space:nowrap; transition:opacity 0.2s,transform 0.15s; }
        .btn-primary:hover { opacity:0.9; transform:translateY(-1px); }
        .filter-row { display:flex; gap:4px; margin-bottom:28px; background:var(--surface); border:1px solid var(--border); border-radius:999px; padding:4px; width:fit-content; }
        .filter-tab { background:transparent; border:none; color:var(--muted); font-family:inherit; font-size:13px; font-weight:500; padding:7px 18px; border-radius:999px; cursor:pointer; transition:all 0.15s; }
        .filter-tab-active { background:var(--surface2); color:var(--text); }
        .stats-row { display:flex; gap:24px; margin-bottom:32px; flex-wrap:wrap; }
        .stat { display:flex; flex-direction:column; gap:2px; }
        .stat-num { font-family:'Syne',sans-serif; font-size:28px; font-weight:800; color:var(--text); }
        .stat-label { font-size:12px; color:var(--muted); }
        .cards-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:16px; }
        .card { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); overflow:hidden; cursor:pointer; transition:border-color 0.2s,transform 0.2s; }
        .card:hover { border-color:rgba(255,255,255,0.15); transform:translateY(-2px); }
        .card-thumb { height:130px; background:var(--surface2); overflow:hidden; }
        .card-thumb-img { width:100%; height:100%; object-fit:cover; }
        .card-thumb-placeholder { width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg,#18181b 0%,#222226 100%); }
        .card-thumb-placeholder span { font-family:'Syne',sans-serif; font-size:26px; font-weight:800; color:#333336; letter-spacing:2px; }
        .card-body { padding:16px 18px 18px; }
        .card-top { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; margin-bottom:8px; }
        .card-title { font-size:15px; font-weight:600; color:var(--text); line-height:1.3; flex:1; }
        .status-badge { font-size:11px; font-weight:600; padding:3px 10px; border-radius:999px; white-space:nowrap; }
        .card-desc { font-size:13px; color:var(--muted); line-height:1.5; margin-bottom:12px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
        .card-meta { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:14px; }
        .meta-chip { font-size:11px; color:var(--muted); background:var(--surface2); padding:3px 10px; border-radius:999px; }
        .card-footer { display:flex; align-items:center; justify-content:space-between; }
        .card-date { font-size:12px; color:var(--muted); }
        .delete-btn { background:none; border:none; color:var(--muted); font-size:20px; cursor:pointer; line-height:1; padding:0 4px; transition:color 0.15s; }
        .delete-btn:hover { color:var(--accent2); }
        .empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:380px; gap:12px; text-align:center; }
        .empty-icon { font-size:40px; color:var(--accent); margin-bottom:4px; }
        .empty-title { font-family:'Syne',sans-serif; font-size:20px; font-weight:700; color:var(--text); }
        .empty-sub { font-size:14px; color:var(--muted); margin-bottom:8px; }
      `}</style>

      <div className="dash-wrap">
        <div className="dash-header">
          <div>
            <p className="dash-logo">Lumevo</p>
            <h1 className="dash-title">Your Projects</h1>
          </div>
          <button className="btn-primary" onClick={handleNew}>+ New Project</button>
        </div>

        {projects.length > 0 && (
          <div className="stats-row">
            <div className="stat"><span className="stat-num">{projects.length}</span><span className="stat-label">Total</span></div>
            <div className="stat"><span className="stat-num">{projects.filter(p => p.status === "ready").length}</span><span className="stat-label">Ready</span></div>
            <div className="stat"><span className="stat-num">{projects.filter(p => p.status === "draft").length}</span><span className="stat-label">Drafts</span></div>
          </div>
        )}

        {projects.length > 0 && (
          <div className="filter-row">
            {(["all","draft","ready"] as const).map(f => (
              <button key={f} className={`filter-tab ${filter === f ? "filter-tab-active" : ""}`} onClick={() => setFilter(f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        )}

        {filtered.length === 0 ? (
          <EmptyState onCreate={handleNew} />
        ) : (
          <div className="cards-grid">
            {filtered.map(p => (
              <ProjectCard key={p.id} project={p} onOpen={() => router.push(`/project/${p.id}`)} onDelete={() => handleDelete(p.id)} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
