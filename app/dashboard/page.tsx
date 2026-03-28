"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAllProjects, createAndSaveProject, deleteProject } from "../../lib/projectStore";
import { getAllVoices } from "../../lib/voiceStore";
import { getCurrentUser, logout } from "../../lib/auth";
import type { User } from "../../lib/auth";
import type { Project } from "../../lib/types";
import { VIBE_LABELS, TONE_LABELS } from "../../lib/types";

type Section = "overview" | "projects" | "brand" | "voice" | "settings";

const NAV_ITEMS: { id: Section; icon: string; label: string }[] = [
  { id: "overview", icon: "⌂", label: "Overview" },
  { id: "projects", icon: "◻", label: "Projects" },
  { id: "brand", icon: "✦", label: "Brand Profile" },
  { id: "voice", icon: "◉", label: "Voice Library" },
  { id: "settings", icon: "◈", label: "Settings" },
];

const PLAN_LABELS: Record<string, string> = {
  free: "Free Plan",
  creator: "Creator",
  pro: "Pro",
  elite: "Elite",
};

function BrandProfile({ projects }: { projects: Project[] }) {
  const voices = getAllVoices();
  const allGenerated = projects.filter(p => p.generated);
  const vibeMap: Record<string, number> = {};
  const toneMap: Record<string, number> = {};
  projects.forEach(p => {
    if (p.vibe) vibeMap[p.vibe] = (vibeMap[p.vibe] || 0) + 1;
    if (p.tone) toneMap[p.tone] = (toneMap[p.tone] || 0) + 1;
  });
  const topVibe = Object.entries(vibeMap).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topTone = Object.entries(toneMap).sort((a, b) => b[1] - a[1])[0]?.[0];
  const uploadCount = projects.reduce((s, p) => s + (p.uploadedFiles?.length || 0), 0);
  const learningPct = Math.min(100, Math.round(
    (projects.length * 10) + (allGenerated.length * 15) + (voices.length * 20) + (uploadCount * 8)
  ));

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Brand Profile</h2>
        <p className="section-sub">Lumevo is building your brand identity. The more you create, the smarter it gets.</p>
      </div>

      <div className="brand-learning-card">
        <div className="brand-learning-top">
          <div>
            <div className="brand-learning-label">Learning Progress</div>
            <div className="brand-learning-score">{learningPct}%</div>
          </div>
          <div className="brand-learning-desc">
            {learningPct < 20 ? "Just getting started — create your first project to begin training." :
             learningPct < 50 ? "Good start — keep uploading and generating to sharpen your profile." :
             learningPct < 80 ? "Strong foundation — your style is becoming clear." :
             "Well-trained — Lumevo knows your brand well."}
          </div>
        </div>
        <div className="learning-bar-track">
          <div className="learning-bar-fill" style={{ width: `${learningPct}%` }} />
        </div>
      </div>

      <div className="brand-grid">
        <div className="brand-card">
          <div className="brand-card-label">Brand Voice</div>
          <div className="brand-card-value">{topVibe ? VIBE_LABELS[topVibe as keyof typeof VIBE_LABELS] : "Not set yet"}</div>
          <div className="brand-card-sub">{topTone ? `Tone: ${TONE_LABELS[topTone as keyof typeof TONE_LABELS]}` : "Upload and generate to reveal your tone"}</div>
        </div>
        <div className="brand-card">
          <div className="brand-card-label">Content Output</div>
          <div className="brand-card-value">{allGenerated.length}</div>
          <div className="brand-card-sub">AI generations across {projects.length} project{projects.length !== 1 ? "s" : ""}</div>
        </div>
        <div className="brand-card">
          <div className="brand-card-label">Voice Identity</div>
          <div className="brand-card-value">{voices.length > 0 ? `${voices.length} clone${voices.length !== 1 ? "s" : ""}` : "None yet"}</div>
          <div className="brand-card-sub">{voices.length > 0 ? voices.map(v => v.name).join(", ") : "Clone your voice from any project"}</div>
        </div>
        <div className="brand-card">
          <div className="brand-card-label">Media Library</div>
          <div className="brand-card-value">{uploadCount}</div>
          <div className="brand-card-sub">files uploaded across all projects</div>
        </div>
      </div>

      <div className="brand-sections">
        {[
          { title: "Content Themes", value: topVibe ? "Emerging pattern detected" : "Upload content to reveal themes", ready: !!topVibe },
          { title: "Audience Style", value: projects.some(p => p.audienceGoal) ? "Audience signals collected" : "Set audience goals in your projects", ready: projects.some(p => p.audienceGoal) },
          { title: "Visual Identity", value: uploadCount > 0 ? `${uploadCount} media samples analyzed` : "Upload images and videos to map your visual style", ready: uploadCount > 0 },
          { title: "Confidence Score", value: `${learningPct}% trained`, ready: learningPct > 0 },
        ].map(item => (
          <div key={item.title} className="brand-section-row">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div className={`brand-dot ${item.ready ? "brand-dot-on" : "brand-dot-off"}`} />
              <div>
                <div className="brand-row-title">{item.title}</div>
                <div className="brand-row-value">{item.value}</div>
              </div>
            </div>
            <div className="brand-row-status">{item.ready ? "Active" : "Pending"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VoiceSection() {
  const router = useRouter();
  const voices = getAllVoices();
  const projects = getAllProjects();

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Voice Library</h2>
        <p className="section-sub">Your cloned voices live here and can be used across any project.</p>
      </div>
      {voices.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">◉</div>
          <h3 className="empty-title">No voices cloned yet</h3>
          <p className="empty-sub">Open a project and go to Voice Clone to add your first voice.</p>
          {projects.length > 0 && (
            <button className="btn-red-sm" onClick={() => router.push(`/project/${projects[0].id}/voice`)}>
              Go to Voice Clone →
            </button>
          )}
        </div>
      ) : (
        <div className="voice-grid">
          {voices.map(v => (
            <div key={v.id} className="voice-card">
              <div className="voice-icon">◉</div>
              <div className="voice-name">{v.name}</div>
              <div className="voice-tags">{v.personality.join(" · ")}</div>
              <div className="voice-meta">{v.sampleCount} sample{v.sampleCount !== 1 ? "s" : ""} · Used in {v.usedInProjects.length} project{v.usedInProjects.length !== 1 ? "s" : ""}</div>
              <div className="voice-date">Added {new Date(v.createdAt).toLocaleDateString()}</div>
            </div>
          ))}
          <div className="voice-card voice-card-add" onClick={() => projects.length > 0 && router.push(`/project/${projects[0].id}/voice`)}>
            <div style={{ fontSize: 28, color: "#FF2D2D", marginBottom: 8 }}>+</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#FF2D2D" }}>Clone a New Voice</div>
            <div style={{ fontSize: 12, color: "#7c7660", marginTop: 4 }}>Open any project to upload samples</div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsSection({ user }: { user: User }) {
  const router = useRouter();
  function handleLogout() {
    logout();
    router.push("/");
  }

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Account & Settings</h2>
        <p className="section-sub">Manage your account and subscription.</p>
      </div>
      <div className="settings-grid">
        <div className="settings-card">
          <div className="settings-card-label">Account</div>
          <div className="settings-row">
            <span className="settings-key">Name</span>
            <span className="settings-val">{user.name}</span>
          </div>
          <div className="settings-row">
            <span className="settings-key">Email</span>
            <span className="settings-val">{user.email}</span>
          </div>
          <div className="settings-row">
            <span className="settings-key">Member since</span>
            <span className="settings-val">{new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
          </div>
        </div>
        <div className="settings-card">
          <div className="settings-card-label">Subscription</div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 28, color: "#FF2D2D", lineHeight: 1, marginBottom: 4 }}>
              {PLAN_LABELS[user.plan] || "Free"}
            </div>
            <div style={{ fontSize: 13, color: "#7c7660" }}>
              {user.plan === "free" ? "Upgrade to unlock brand learning and more." :
               user.plan === "creator" ? "Growing your content presence." :
               user.plan === "pro" ? "Full brand training active." :
               "Full AI content system running."}
            </div>
          </div>
          <button className="btn-red-sm" onClick={() => router.push("/pricing")}>
            {user.plan === "free" ? "Upgrade Plan" : "Manage Subscription"} →
          </button>
        </div>
      </div>
      <div style={{ marginTop: 28 }}>
        <button className="btn-ghost-danger" onClick={handleLogout}>Log out of Lumevo</button>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [section, setSection] = useState<Section>("overview");
  const [projects, setProjects] = useState<Project[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const u = getCurrentUser();
    if (!u) { router.push("/login"); return; }
    setUser(u);
    setProjects(getAllProjects());
  }, [router]);

  function handleNew() {
    const p = createAndSaveProject({ title: "Untitled Project" });
    router.push(`/project/${p.id}`);
  }

  function handleDelete(id: string) {
    deleteProject(id);
    setProjects(getAllProjects());
  }

  if (!user) return null;

  const voices = getAllVoices();
  const readyProjects = projects.filter(p => p.status === "ready").length;
  const uploadCount = projects.reduce((s, p) => s + (p.uploadedFiles?.length || 0), 0);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #F8F8A6; font-family: 'DM Sans', system-ui, sans-serif; color: #1a1a1a; -webkit-font-smoothing: antialiased; min-height: 100vh; }

        .layout { display: flex; min-height: 100vh; }

        /* SIDEBAR */
        .sidebar { width: 240px; flex-shrink: 0; background: #1a1a1a; display: flex; flex-direction: column; padding: 0; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
        @media (max-width: 768px) { .sidebar { position: fixed; top: 0; left: 0; z-index: 200; transform: translateX(-100%); transition: transform 0.3s; width: 220px; } .sidebar-open { transform: translateX(0); } }
        .sidebar-logo { padding: 28px 24px 24px; border-bottom: 1px solid rgba(255,255,255,0.07); }
        .sb-lumevo { font-family: 'Fredoka One', cursive; font-size: 26px; color: #FF2D2D; letter-spacing: 1px; line-height: 1; display: block; }
        .sb-studio { font-size: 10px; font-style: italic; color: rgba(255,255,255,0.4); letter-spacing: 3px; text-transform: uppercase; display: block; margin-top: 3px; }
        .sidebar-nav { flex: 1; padding: 20px 12px; }
        .nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 10px; cursor: pointer; margin-bottom: 3px; transition: background 0.15s; border: none; background: transparent; color: rgba(255,255,255,0.5); font-family: inherit; font-size: 14px; font-weight: 500; width: 100%; text-align: left; }
        .nav-item:hover { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.8); }
        .nav-item-active { background: rgba(255,45,45,0.15) !important; color: #FF6B6B !important; }
        .nav-icon { font-size: 16px; width: 20px; text-align: center; }
        .sidebar-bottom { padding: 16px 12px; border-top: 1px solid rgba(255,255,255,0.07); }
        .user-pill { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 10px; }
        .user-avatar { width: 28px; height: 28px; border-radius: 50%; background: #FF2D2D; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 12px; font-weight: 700; flex-shrink: 0; }
        .user-info { min-width: 0; }
        .user-name { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.85); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .user-plan { font-size: 11px; color: rgba(255,255,255,0.35); }

        /* TOPBAR (mobile) */
        .topbar { display: none; background: rgba(248,248,166,0.95); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(0,0,0,0.08); height: 56px; padding: 0 20px; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; }
        @media (max-width: 768px) { .topbar { display: flex; } }
        .topbar-logo { font-family: 'Fredoka One', cursive; font-size: 20px; color: #FF2D2D; }
        .menu-btn { background: none; border: none; font-size: 20px; cursor: pointer; color: #1a1a1a; }

        /* MAIN */
        .main { flex: 1; min-width: 0; padding: 48px 40px 80px; }
        @media (max-width: 768px) { .main { padding: 28px 20px 60px; } }

        /* OVERVIEW */
        .overview-greeting { margin-bottom: 40px; }
        .greeting-tag { font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #FF2D2D; margin-bottom: 10px; }
        .greeting-title { font-family: 'Syne', sans-serif; font-size: 32px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 6px; }
        .greeting-sub { font-size: 15px; color: #7c7660; line-height: 1.5; }

        .stats-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; margin-bottom: 44px; }
        .stat-card { background: #fff; border-radius: 16px; padding: 20px 22px; border: 1px solid rgba(0,0,0,0.07); }
        .stat-num { font-family: 'Syne', sans-serif; font-size: 34px; font-weight: 800; color: #1a1a1a; line-height: 1; }
        .stat-num-red { color: #FF2D2D; }
        .stat-label { font-size: 12px; color: #7c7660; margin-top: 6px; }

        .quick-actions { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 44px; }
        .qa-btn { display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid rgba(0,0,0,0.08); border-radius: 12px; padding: 14px 20px; cursor: pointer; font-family: inherit; font-size: 14px; font-weight: 600; color: #1a1a1a; transition: border-color 0.2s, transform 0.15s; }
        .qa-btn:hover { border-color: #FF2D2D; transform: translateY(-1px); }
        .qa-btn-primary { background: #FF2D2D; color: #fff; border-color: #FF2D2D; }
        .qa-btn-primary:hover { opacity: 0.88; border-color: #FF2D2D; }

        .recent-label { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 700; margin-bottom: 16px; }

        /* PROJECTS */
        .projects-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; flex-wrap: wrap; gap: 12px; }
        .section-header { margin-bottom: 36px; }
        .section-title { font-family: 'Syne', sans-serif; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 6px; }
        .section-sub { font-size: 15px; color: #7c7660; line-height: 1.5; }
        .btn-red { background: #FF2D2D; color: #fff; border: none; font-family: inherit; font-size: 14px; font-weight: 700; padding: 11px 22px; border-radius: 999px; cursor: pointer; transition: opacity 0.2s, transform 0.15s; }
        .btn-red:hover { opacity: 0.88; transform: translateY(-1px); }
        .btn-red-sm { background: #FF2D2D; color: #fff; border: none; font-family: inherit; font-size: 13px; font-weight: 700; padding: 9px 18px; border-radius: 999px; cursor: pointer; transition: opacity 0.2s; }
        .btn-red-sm:hover { opacity: 0.88; }

        .cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
        .card { background: #fff; border-radius: 16px; overflow: hidden; cursor: pointer; border: 1px solid rgba(0,0,0,0.07); transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s; }
        .card:hover { border-color: rgba(255,45,45,0.2); transform: translateY(-2px); box-shadow: 0 6px 24px rgba(0,0,0,0.07); }
        .card-thumb { height: 120px; background: linear-gradient(135deg,#F8F8A6 0%,#F2F29A 100%); overflow: hidden; }
        .card-thumb-img { width: 100%; height: 100%; object-fit: cover; }
        .card-thumb-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
        .card-thumb-placeholder span { font-family: 'Fredoka One', cursive; font-size: 28px; color: rgba(255,45,45,0.25); letter-spacing: 2px; }
        .card-body { padding: 16px 18px 18px; }
        .card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
        .card-title { font-size: 15px; font-weight: 600; color: #1a1a1a; flex: 1; line-height: 1.3; }
        .status-badge { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 999px; white-space: nowrap; }
        .card-desc { font-size: 13px; color: #7c7660; line-height: 1.5; margin-bottom: 10px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .card-meta { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 12px; }
        .meta-chip { font-size: 11px; color: #7c7660; background: #F8F8A6; padding: 3px 10px; border-radius: 999px; }
        .card-footer { display: flex; align-items: center; justify-content: space-between; }
        .card-date { font-size: 12px; color: #7c7660; }
        .delete-btn { background: none; border: none; color: #b5b09a; font-size: 18px; cursor: pointer; line-height: 1; padding: 0 2px; transition: color 0.15s; }
        .delete-btn:hover { color: #FF2D2D; }

        .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 320px; gap: 10px; text-align: center; }
        .empty-icon { font-size: 38px; color: #FF2D2D; margin-bottom: 4px; }
        .empty-title { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; }
        .empty-sub { font-size: 14px; color: #7c7660; margin-bottom: 8px; max-width: 320px; }

        /* BRAND PROFILE */
        .brand-learning-card { background: #fff; border-radius: 16px; padding: 28px; border: 1px solid rgba(0,0,0,0.07); margin-bottom: 20px; }
        .brand-learning-top { display: flex; gap: 24px; align-items: flex-start; margin-bottom: 20px; }
        .brand-learning-label { font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #7c7660; margin-bottom: 8px; }
        .brand-learning-score { font-family: 'Fredoka One', cursive; font-size: 48px; color: #FF2D2D; line-height: 1; }
        .brand-learning-desc { font-size: 15px; color: #7c7660; line-height: 1.6; flex: 1; padding-top: 8px; }
        .learning-bar-track { height: 6px; background: #F8F8A6; border-radius: 999px; overflow: hidden; }
        .learning-bar-fill { height: 100%; background: #FF2D2D; border-radius: 999px; transition: width 0.6s ease; }
        .brand-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-bottom: 20px; }
        .brand-card { background: #fff; border-radius: 14px; padding: 20px; border: 1px solid rgba(0,0,0,0.07); }
        .brand-card-label { font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #7c7660; margin-bottom: 8px; }
        .brand-card-value { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 800; color: #1a1a1a; margin-bottom: 6px; }
        .brand-card-sub { font-size: 12px; color: #7c7660; line-height: 1.5; }
        .brand-sections { background: #fff; border-radius: 16px; border: 1px solid rgba(0,0,0,0.07); overflow: hidden; }
        .brand-section-row { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid rgba(0,0,0,0.05); }
        .brand-section-row:last-child { border-bottom: none; }
        .brand-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .brand-dot-on { background: #FF2D2D; }
        .brand-dot-off { background: #d4cfc3; }
        .brand-row-title { font-size: 14px; font-weight: 600; color: #1a1a1a; margin-bottom: 3px; }
        .brand-row-value { font-size: 13px; color: #7c7660; }
        .brand-row-status { font-size: 11px; font-weight: 700; color: #7c7660; letter-spacing: 1px; text-transform: uppercase; }

        /* VOICE */
        .voice-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
        .voice-card { background: #fff; border-radius: 16px; padding: 22px; border: 1px solid rgba(0,0,0,0.07); }
        .voice-card-add { border-style: dashed; border-color: rgba(255,45,45,0.25); cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 140px; transition: background 0.2s, border-color 0.2s; text-align: center; }
        .voice-card-add:hover { background: rgba(255,45,45,0.02); border-color: rgba(255,45,45,0.5); }
        .voice-icon { font-size: 24px; color: #FF2D2D; margin-bottom: 10px; }
        .voice-name { font-size: 15px; font-weight: 600; color: #1a1a1a; margin-bottom: 4px; }
        .voice-tags { font-size: 12px; color: #7c7660; margin-bottom: 8px; }
        .voice-meta { font-size: 12px; color: #7c7660; }
        .voice-date { font-size: 11px; color: #b5b09a; margin-top: 4px; }

        /* SETTINGS */
        .settings-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
        .settings-card { background: #fff; border-radius: 16px; padding: 24px; border: 1px solid rgba(0,0,0,0.07); }
        .settings-card-label { font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #7c7660; margin-bottom: 16px; }
        .settings-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(0,0,0,0.05); }
        .settings-row:last-child { border-bottom: none; }
        .settings-key { font-size: 14px; color: #7c7660; }
        .settings-val { font-size: 14px; font-weight: 500; color: #1a1a1a; }
        .btn-ghost-danger { background: none; border: 1px solid rgba(255,45,45,0.2); color: #FF2D2D; font-family: inherit; font-size: 14px; font-weight: 600; padding: 10px 22px; border-radius: 999px; cursor: pointer; transition: background 0.2s; }
        .btn-ghost-danger:hover { background: rgba(255,45,45,0.06); }

        /* OVERLAY */
        .overlay { display: none; }
        @media (max-width: 768px) { .overlay-show { display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 150; } }
      `}</style>

      {/* Mobile topbar */}
      <div className="topbar">
        <span className="topbar-logo">LUMEVO</span>
        <button className="menu-btn" onClick={() => setSidebarOpen(o => !o)}>☰</button>
      </div>

      {/* Mobile overlay */}
      <div className={sidebarOpen ? "overlay overlay-show" : "overlay"} onClick={() => setSidebarOpen(false)} />

      <div className="layout">
        {/* SIDEBAR */}
        <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
          <div className="sidebar-logo">
            <span className="sb-lumevo">LUMEVO</span>
            <span className="sb-studio">Studio</span>
          </div>
          <nav className="sidebar-nav">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                className={`nav-item ${section === item.id ? "nav-item-active" : ""}`}
                onClick={() => { setSection(item.id); setSidebarOpen(false); }}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="user-pill">
              <div className="user-avatar">{user.name.charAt(0).toUpperCase()}</div>
              <div className="user-info">
                <div className="user-name">{user.name}</div>
                <div className="user-plan">{PLAN_LABELS[user.plan] || "Free Plan"}</div>
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="main">
          {section === "overview" && (
            <div>
              <div className="overview-greeting">
                <div className="greeting-tag">Welcome back</div>
                <h1 className="greeting-title">Hey, {user.name.split(" ")[0]} 👋</h1>
                <p className="greeting-sub">Your content system is {projects.length === 0 ? "ready to train. Start your first project below." : `learning. ${projects.length} project${projects.length !== 1 ? "s" : ""}, ${voices.length} voice clone${voices.length !== 1 ? "s" : ""}.`}</p>
              </div>

              <div className="stats-row">
                <div className="stat-card"><div className="stat-num stat-num-red">{projects.length}</div><div className="stat-label">Projects</div></div>
                <div className="stat-card"><div className="stat-num stat-num-red">{readyProjects}</div><div className="stat-label">Ready</div></div>
                <div className="stat-card"><div className="stat-num stat-num-red">{voices.length}</div><div className="stat-label">Voice Clones</div></div>
                <div className="stat-card"><div className="stat-num stat-num-red">{uploadCount}</div><div className="stat-label">Files Uploaded</div></div>
              </div>

              <div className="quick-actions">
                <button className="qa-btn qa-btn-primary" onClick={handleNew}>+ New Project</button>
                <button className="qa-btn" onClick={() => setSection("brand")}>✦ Brand Profile</button>
                <button className="qa-btn" onClick={() => setSection("voice")}>◉ Voice Library</button>
              </div>

              {projects.length > 0 && (
                <>
                  <div className="recent-label">Recent Projects</div>
                  <div className="cards-grid">
                    {projects.slice(0, 6).map(p => {
                      const st = p.status === "ready" ? { bg: "rgba(22,163,74,0.1)", text: "#16a34a", label: "Ready" } :
                                 p.status === "generating" ? { bg: "rgba(255,45,45,0.1)", text: "#FF2D2D", label: "Generating…" } :
                                 { bg: "rgba(0,0,0,0.06)", text: "#7c7660", label: "Draft" };
                      return (
                        <div key={p.id} className="card" onClick={() => router.push(`/project/${p.id}`)}>
                          <div className="card-thumb">
                            {p.thumbnail ? <img src={p.thumbnail} alt="" className="card-thumb-img" /> :
                              <div className="card-thumb-placeholder"><span>{p.title.slice(0, 2).toUpperCase()}</span></div>}
                          </div>
                          <div className="card-body">
                            <div className="card-top">
                              <h3 className="card-title">{p.title}</h3>
                              <span className="status-badge" style={{ background: st.bg, color: st.text }}>{st.label}</span>
                            </div>
                            {p.description && <p className="card-desc">{p.description}</p>}
                            <div className="card-footer">
                              <span className="card-date">{new Date(p.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                              <button className="delete-btn" onClick={e => { e.stopPropagation(); handleDelete(p.id); }}>×</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {projects.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon">✦</div>
                  <h3 className="empty-title">Create your first project</h3>
                  <p className="empty-sub">Upload content, define your vibe, and let Lumevo start learning your brand.</p>
                  <button className="btn-red" onClick={handleNew}>+ New Project</button>
                </div>
              )}
            </div>
          )}

          {section === "projects" && (
            <div>
              <div className="projects-header">
                <div>
                  <h2 className="section-title">Projects</h2>
                  <p style={{ fontSize: 14, color: "#7c7660" }}>{projects.length} project{projects.length !== 1 ? "s" : ""} total</p>
                </div>
                <button className="btn-red" onClick={handleNew}>+ New Project</button>
              </div>
              {projects.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">◻</div>
                  <h3 className="empty-title">No projects yet</h3>
                  <p className="empty-sub">Start creating and your projects will appear here.</p>
                  <button className="btn-red" onClick={handleNew}>New Project</button>
                </div>
              ) : (
                <div className="cards-grid">
                  {projects.map(p => {
                    const st = p.status === "ready" ? { bg: "rgba(22,163,74,0.1)", text: "#16a34a", label: "Ready" } :
                               p.status === "generating" ? { bg: "rgba(255,45,45,0.1)", text: "#FF2D2D", label: "Generating…" } :
                               { bg: "rgba(0,0,0,0.06)", text: "#7c7660", label: "Draft" };
                    return (
                      <div key={p.id} className="card" onClick={() => router.push(`/project/${p.id}`)}>
                        <div className="card-thumb">
                          {p.thumbnail ? <img src={p.thumbnail} alt="" className="card-thumb-img" /> :
                            <div className="card-thumb-placeholder"><span>{p.title.slice(0, 2).toUpperCase()}</span></div>}
                        </div>
                        <div className="card-body">
                          <div className="card-top">
                            <h3 className="card-title">{p.title}</h3>
                            <span className="status-badge" style={{ background: st.bg, color: st.text }}>{st.label}</span>
                          </div>
                          {p.description && <p className="card-desc">{p.description}</p>}
                          <div className="card-meta">
                            {p.vibe && <span className="meta-chip">{VIBE_LABELS[p.vibe as keyof typeof VIBE_LABELS]}</span>}
                            {p.tone && <span className="meta-chip">{TONE_LABELS[p.tone as keyof typeof TONE_LABELS]}</span>}
                            {(p.uploadedFiles?.length || 0) > 0 && <span className="meta-chip">📁 {p.uploadedFiles.length}</span>}
                          </div>
                          <div className="card-footer">
                            <span className="card-date">{new Date(p.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                            <button className="delete-btn" onClick={e => { e.stopPropagation(); handleDelete(p.id); }}>×</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {section === "brand" && <BrandProfile projects={projects} />}
          {section === "voice" && <VoiceSection />}
          {section === "settings" && <SettingsSection user={user} />}
        </main>
      </div>
    </>
  );
}
