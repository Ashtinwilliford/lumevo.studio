"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getProject, patchProject } from "../../../../lib/projectStore";
import type { Project, UploadedFile } from "../../../../lib/types";

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');
  :root { --bg:#FFF9E6; --surface:#ffffff; --surface2:#FFF3CC; --border:rgba(0,0,0,0.08); --accent:#C62828; --text:#1a1a1a; --muted:#78716c; --radius:14px; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { background:var(--bg); color:var(--text); font-family:'DM Sans',system-ui,sans-serif; min-height:100vh; }
  .page-wrap { max-width:860px; margin:0 auto; padding:48px 24px 120px; }
  .back-btn { display:flex; align-items:center; gap:6px; color:var(--muted); background:none; border:none; cursor:pointer; font-size:14px; font-family:inherit; margin-bottom:40px; transition:color 0.2s; }
  .back-btn:hover { color:var(--text); }
  .page-title { font-family:'Syne',sans-serif; font-size:32px; font-weight:800; letter-spacing:-0.5px; }
  .page-subtitle { color:var(--muted); font-size:15px; margin-top:6px; margin-bottom:40px; }
  .drop-zone { border:2px dashed var(--border); border-radius:var(--radius); padding:60px 24px; display:flex; flex-direction:column; align-items:center; gap:14px; text-align:center; cursor:pointer; transition:border-color 0.2s,background 0.2s; }
  .drop-zone:hover, .drop-zone-active { border-color:rgba(198,40,40,0.4); background:rgba(198,40,40,0.02); }
  .drop-icon { width:52px; height:52px; border-radius:50%; background:var(--surface2); display:flex; align-items:center; justify-content:center; font-size:22px; }
  .drop-title { font-size:16px; font-weight:600; color:var(--text); }
  .drop-sub { font-size:13px; color:var(--muted); }
  .drop-link { color:var(--accent); font-weight:500; cursor:pointer; text-decoration:none; }
  .drop-types { font-size:12px; color:var(--muted); margin-top:4px; }
  .files-section { margin-top:40px; }
  .files-title { font-family:'Syne',sans-serif; font-size:18px; font-weight:700; margin-bottom:16px; }
  .files-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:12px; }
  .file-card { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); overflow:hidden; position:relative; }
  .file-thumb { height:130px; object-fit:cover; width:100%; background:var(--surface2); display:flex; align-items:center; justify-content:center; color:var(--muted); font-size:32px; }
  .file-thumb img, .file-thumb video { width:100%; height:100%; object-fit:cover; }
  .file-info { padding:10px 12px; }
  .file-name { font-size:12px; font-weight:500; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .file-size { font-size:11px; color:var(--muted); margin-top:2px; }
  .file-remove { position:absolute; top:8px; right:8px; width:24px; height:24px; border-radius:50%; background:rgba(0,0,0,0.5); border:none; color:#fff; font-size:14px; line-height:1; cursor:pointer; display:flex; align-items:center; justify-content:center; }
  .btn-primary { display:flex; align-items:center; gap:8px; background:var(--accent); color:#fff; font-family:inherit; font-size:14px; font-weight:600; border:none; border-radius:999px; padding:12px 24px; cursor:pointer; margin-top:32px; transition:opacity 0.2s,transform 0.15s; }
  .btn-primary:hover { opacity:0.9; transform:translateY(-1px); }
  .saved-badge { font-size:13px; color:#16a34a; font-weight:500; margin-top:16px; }
`;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const p = getProject(id);
    if (!p) { router.push("/dashboard"); return; }
    setProject(p);
    setFiles(p.uploadedFiles ?? []);
  }, [id, router]);

  function processFiles(rawFiles: FileList | null) {
    if (!rawFiles) return;
    const added: UploadedFile[] = [];
    const newPreviews: Record<string, string> = {};

    Array.from(rawFiles).forEach((f) => {
      const isImage = f.type.startsWith("image/");
      const isVideo = f.type.startsWith("video/");
      if (!isImage && !isVideo) return;
      const entry: UploadedFile = { name: f.name, type: isImage ? "image" : "video", size: f.size };
      added.push(entry);
      const url = URL.createObjectURL(f);
      newPreviews[f.name] = url;
    });

    setFiles((prev) => [...prev, ...added]);
    setPreviews((prev) => ({ ...prev, ...newPreviews }));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  }

  function handleRemove(name: string) {
    setFiles((prev) => prev.filter((f) => f.name !== name));
    setPreviews((prev) => { const next = { ...prev }; delete next[name]; return next; });
  }

  function handleSave() {
    const thumbnail = files.find((f) => f.type === "image") ? previews[files.find((f) => f.type === "image")!.name] : undefined;
    patchProject(id, { uploadedFiles: files, thumbnail });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!project) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#FFF9E6" }}><div style={{ width: 8, height: 8, background: "#C62828", borderRadius: "50%" }} /></div>;

  return (
    <>
      <style>{STYLES}</style>
      <div className="page-wrap">
        <button className="back-btn" onClick={() => router.push(`/project/${id}`)}>← Back</button>
        <h1 className="page-title">Upload Media</h1>
        <p className="page-subtitle">Add the raw images and videos for this project.</p>

        <div
          className={`drop-zone ${isDragging ? "drop-zone-active" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <div className="drop-icon">+</div>
          <p className="drop-title">Drop files here</p>
          <p className="drop-sub">or <span className="drop-link">browse your files</span></p>
          <p className="drop-types">JPG, PNG, GIF, MP4, MOV, WEBM</p>
          <input ref={inputRef} type="file" multiple accept="image/*,video/*" style={{ display: "none" }} onChange={(e) => processFiles(e.target.files)} />
        </div>

        {files.length > 0 && (
          <div className="files-section">
            <p className="files-title">{files.length} file{files.length !== 1 ? "s" : ""} added</p>
            <div className="files-grid">
              {files.map((f) => (
                <div key={f.name} className="file-card">
                  <div className="file-thumb">
                    {previews[f.name] ? (
                      f.type === "image" ? <img src={previews[f.name]} alt={f.name} /> : <video src={previews[f.name]} muted />
                    ) : (
                      <span>{f.type === "image" ? "IMG" : "VID"}</span>
                    )}
                  </div>
                  <div className="file-info">
                    <p className="file-name">{f.name}</p>
                    <p className="file-size">{formatBytes(f.size)}</p>
                  </div>
                  <button className="file-remove" onClick={() => handleRemove(f.name)}>×</button>
                </div>
              ))}
            </div>

            <button className="btn-primary" onClick={handleSave}>Save Media</button>
            {saved && <p className="saved-badge">Saved to project</p>}
          </div>
        )}
      </div>
    </>
  );
}
