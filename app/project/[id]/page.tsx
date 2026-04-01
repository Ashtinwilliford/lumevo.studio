"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Record<string,unknown>|null>(null);
  const [uploads, setUploads] = useState<Record<string,unknown>[]>([]);
  const [generating, setGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string|null>(null);
  const [loading, setLoading] = useState(true);
  const [genError, setGenError] = useState<string|null>(null);
  const [genResult, setGenResult] = useState<{script?:string;caption?:string}|null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) { router.push("/dashboard"); return; }
      const data = await res.json();
      setProject(data.project);
      const gc = data.project?.generated_content;
      if (gc?.videoUrl) setVideoUrl(gc.videoUrl);
      if (gc?.script) setGenResult({ script: gc.script, caption: gc.caption });
      const uRes = await fetch(`/api/uploads?projectId=${id}`);
      if (uRes.ok) { const uData = await uRes.json(); setUploads(uData.uploads || []); }
      setLoading(false);
    }
    load();
  }, [id, router]);

  async function generateVideo() {
    setGenerating(true);
    setGenError(null);
    try {
      const body = {
        title: project?.title || "Untitled",
        uploadIds: uploads.map(u => u.id),
        platform: project?.target_platform || "tiktok",
        duration: project?.target_duration || 30,
        vibe: project?.vibe || null,
        draftProjectId: id,
      };
      const res = await fetch("/api/video/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) {
        setGenError(data.error);
        setGenerating(false);
        return;
      }
      if (data.script) {
        setGenResult({ script: data.script, caption: data.caption });
      }
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Network error - check your connection");
    }
    setGenerating(false);
  }

  if (loading) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#F8F8A6"}}><div style={{width:8,height:8,background:"#FF2D2D",borderRadius:"50%"}} /></div>;

  return (
    <div style={{maxWidth:900,margin:"0 auto",padding:"48px 24px 100px",background:"#F8F8A6",minHeight:"100vh"}}>
      <button onClick={()=>router.push("/dashboard")} style={{background:"none",border:"none",cursor:"pointer",marginBottom:32,fontSize:14,color:"#78716c"}}>Back to Dashboard</button>
      <h1 style={{fontSize:32,fontWeight:800,marginBottom:8}}>{String(project?.title || "Project")}</h1>
      <p style={{color:"#78716c",marginBottom:40}}>{String(project?.vibe || "")} {project?.target_platform ? `· ${String(project.target_platform)}` : ""} {project?.target_duration ? `· ${String(project.target_duration)}s` : ""}</p>

      {videoUrl && (
        <div style={{marginBottom:40}}>
          <h2 style={{fontSize:20,fontWeight:700,marginBottom:16}}>Your Video</h2>
          <video src={videoUrl} controls style={{width:"100%",maxWidth:400,borderRadius:14}} />
          <div style={{marginTop:12}}><a href={videoUrl} download style={{background:"#FF2D2D",color:"#fff",padding:"10px 20px",borderRadius:999,textDecoration:"none",fontWeight:600}}>Download</a></div>
        </div>
      )}

      {genResult?.script && (
        <div style={{marginBottom:40}}>
          <div style={{background:"#fff",borderRadius:16,border:"1px solid rgba(0,0,0,0.07)",overflow:"hidden",marginBottom:16}}>
            <div style={{padding:"16px 20px",borderBottom:"1px solid rgba(0,0,0,0.06)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:11,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:"#7c7660"}}>Script</div>
              <button onClick={()=>navigator.clipboard?.writeText(genResult.script||"")} style={{background:"none",border:"none",fontSize:11,color:"#FF2D2D",cursor:"pointer",fontWeight:700}}>Copy</button>
            </div>
            <div style={{padding:"16px 20px",fontSize:14,lineHeight:1.7,color:"#1a1a1a",whiteSpace:"pre-wrap"}}>{genResult.script}</div>
          </div>
          {genResult.caption && (
            <div style={{background:"#fff",borderRadius:16,border:"1px solid rgba(0,0,0,0.07)",overflow:"hidden"}}>
              <div style={{padding:"16px 20px",borderBottom:"1px solid rgba(0,0,0,0.06)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:11,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:"#7c7660"}}>Caption</div>
                <button onClick={()=>navigator.clipboard?.writeText(genResult.caption||"")} style={{background:"none",border:"none",fontSize:11,color:"#FF2D2D",cursor:"pointer",fontWeight:700}}>Copy</button>
              </div>
              <div style={{padding:"16px 20px",fontSize:14,lineHeight:1.7,color:"#1a1a1a"}}>{genResult.caption}</div>
            </div>
          )}
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:40}}>
        <div onClick={()=>router.push(`/project/${id}/upload`)} style={{background:"#fff",borderRadius:14,padding:24,cursor:"pointer",border:"1px solid rgba(0,0,0,0.08)"}}>
          <div style={{fontSize:24,marginBottom:8}}>📁</div>
          <div style={{fontWeight:700,marginBottom:4}}>Upload Media</div>
          <div style={{fontSize:13,color:"#78716c"}}>{uploads.length > 0 ? `${uploads.length} file${uploads.length!==1?"s":""} uploaded` : "Add photos and videos"}</div>
        </div>
        <div onClick={()=>router.push(`/project/${id}/voice`)} style={{background:"#fff",borderRadius:14,padding:24,cursor:"pointer",border:"1px solid rgba(0,0,0,0.08)"}}>
          <div style={{fontSize:24,marginBottom:8}}>🎙</div>
          <div style={{fontWeight:700,marginBottom:4}}>Voice Clone</div>
          <div style={{fontSize:13,color:"#78716c"}}>Set up your voice for narration</div>
        </div>
      </div>

      {uploads.length > 0 && (
        <div style={{marginBottom:40}}>
          <h2 style={{fontSize:20,fontWeight:700,marginBottom:16}}>Your Uploads ({uploads.length})</h2>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:12}}>
            {uploads.map((u,i)=>(
              <div key={i} style={{background:"#fff",borderRadius:12,overflow:"hidden",border:"1px solid #eee"}}>
                {String(u.file_type)==="image"?<img src={String(u.file_path)} style={{width:"100%",height:100,objectFit:"cover"}} alt=""/>:<div style={{height:100,background:"#f5f5f5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#78716c"}}>VIDEO</div>}
                <div style={{padding:"6px 8px",fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{String(u.file_name)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {genError && (
        <div style={{background:"#fff0f0",border:"1px solid rgba(255,45,45,0.3)",borderRadius:12,padding:"14px 18px",marginBottom:16,fontSize:13,color:"#FF2D2D"}}>{genError}</div>
      )}

      <button
        onClick={generateVideo}
        disabled={generating || uploads.length === 0}
        style={{background:uploads.length===0?"#ccc":"#FF2D2D",color:"#fff",border:"none",borderRadius:999,padding:"16px 40px",fontWeight:700,fontSize:16,cursor:uploads.length===0?"not-allowed":"pointer",width:"100%"}}
      >
        {generating ? "Generating your video..." : uploads.length===0 ? "Upload media first" : "Generate My Video with AI"}
      </button>
    </div>
  );
}
