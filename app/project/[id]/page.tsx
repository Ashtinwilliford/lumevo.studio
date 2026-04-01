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
  const [genStatus, setGenStatus] = useState<string|null>(null);
  const [genResult, setGenResult] = useState<{script?:string;caption?:string}|null>(null);

  // Script editing state
  const [editingScript, setEditingScript] = useState(false);
  const [editedScript, setEditedScript] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [feedbackInput, setFeedbackInput] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);

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

  async function generateScript() {
    setGenerating(true);
    setGenError(null);
    setGenStatus("Generating script with AI...");
    try {
      const scriptRes = await fetch("/api/video/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: project?.title || "Untitled",
          uploadIds: uploads.map(u => u.id),
          platform: project?.target_platform || "instagram",
          duration: project?.target_duration || 30,
          vibe: project?.vibe || null,
          draftProjectId: id,
        }),
      });
      const scriptData = await scriptRes.json();
      if (scriptData.error) { setGenError(scriptData.error); setGenerating(false); setGenStatus(null); return; }
      if (scriptData.script) {
        setGenResult({ script: scriptData.script, caption: scriptData.caption });
      }
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Network error");
    }
    setGenerating(false);
    setGenStatus(null);
  }

  async function regenerateScript(feedback: string) {
    setRegenerating(true);
    setGenError(null);
    setShowFeedback(false);
    setFeedbackInput("");
    try {
      const scriptRes = await fetch("/api/video/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: project?.title || "Untitled",
          uploadIds: uploads.map(u => u.id),
          platform: project?.target_platform || "instagram",
          duration: project?.target_duration || 30,
          vibe: `${project?.vibe || ""} — FEEDBACK: ${feedback}`.trim(),
          draftProjectId: id,
        }),
      });
      const scriptData = await scriptRes.json();
      if (scriptData.error) { setGenError(scriptData.error); setRegenerating(false); return; }
      if (scriptData.script) {
        setGenResult({ script: scriptData.script, caption: scriptData.caption });
      }
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Network error");
    }
    setRegenerating(false);
  }

  function saveCustomScript() {
    setGenResult({ script: editedScript, caption: genResult?.caption || "" });
    setEditingScript(false);
    // Save to DB
    fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generated_content: { script: editedScript, caption: genResult?.caption || "" } }),
    }).catch(() => {});
  }

  async function renderVideo() {
    setGenerating(true);
    setGenError(null);
    setGenStatus("Starting video render...");
    try {
      const renderRes = await fetch("/api/video/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id }),
      });
      const renderData = await renderRes.json();
      if (renderData.error) { setGenError(renderData.error); setGenerating(false); setGenStatus(null); return; }

      const renderId = renderData.renderId;
      if (!renderId) { setGenError("No render ID returned"); setGenerating(false); setGenStatus(null); return; }

      // Poll for render completion
      setGenStatus("Rendering your video... this takes 30-60 seconds");
      let attempts = 0;
      const maxAttempts = 40; // ~2 minutes max
      while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 3000)); // wait 3s between checks
        attempts++;
        try {
          const statusRes = await fetch(`/api/video/status?renderId=${renderId}`);
          const statusData = await statusRes.json();

          if (statusData.status === "succeeded") {
            setVideoUrl(statusData.url);
            setGenStatus(null);
            setGenerating(false);
            return;
          } else if (statusData.status === "failed") {
            setGenError(statusData.errorMessage || "Video render failed");
            setGenStatus(null);
            setGenerating(false);
            return;
          }
          // Still rendering - update status
          setGenStatus(`Rendering your video... ${Math.min(attempts * 3, 90)}s elapsed`);
        } catch {
          // Network blip, keep trying
        }
      }
      setGenError("Render timed out. Check your project later - it may still complete.");
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Network error");
    }
    setGenerating(false);
    setGenStatus(null);
  }

  async function generateAll() {
    await generateScript();
  }

  if (loading) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#F8F8A6"}}><div style={{width:8,height:8,background:"#FF2D2D",borderRadius:"50%"}} /></div>;

  const platform = (project?.target_platform as string) || "instagram";
  const PLATFORM_LABELS: Record<string,string> = { tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube", general: "General" };

  return (
    <div style={{maxWidth:900,margin:"0 auto",padding:"48px 24px 100px",background:"#F8F8A6",minHeight:"100vh"}}>
      <button onClick={()=>router.push("/dashboard")} style={{background:"none",border:"none",cursor:"pointer",marginBottom:32,fontSize:14,color:"#78716c"}}>Back to Dashboard</button>
      <h1 style={{fontSize:32,fontWeight:800,marginBottom:8}}>{String(project?.title || "Project")}</h1>
      <p style={{color:"#78716c",marginBottom:40}}>
        {String(project?.vibe || "")}
        {platform ? ` · ${PLATFORM_LABELS[platform] || platform}` : ""}
        {project?.target_duration ? ` · ${String(project.target_duration)}s` : ""}
      </p>

      {videoUrl && (
        <div style={{marginBottom:40}}>
          <h2 style={{fontSize:20,fontWeight:700,marginBottom:16}}>Your Video</h2>
          <video src={videoUrl} controls style={{width:"100%",maxWidth:400,borderRadius:14}} />
          <div style={{marginTop:12}}><a href={videoUrl} download style={{background:"#FF2D2D",color:"#fff",padding:"10px 20px",borderRadius:999,textDecoration:"none",fontWeight:600}}>Download</a></div>
        </div>
      )}

      {genResult?.script && !editingScript && (
        <div style={{marginBottom:40}}>
          <div style={{background:"#fff",borderRadius:16,border:"1px solid rgba(0,0,0,0.07)",overflow:"hidden",marginBottom:12}}>
            <div style={{padding:"16px 20px",borderBottom:"1px solid rgba(0,0,0,0.06)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:11,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:"#7c7660"}}>Script</div>
              <div style={{display:"flex",gap:12}}>
                <button onClick={()=>navigator.clipboard?.writeText(genResult.script||"")} style={{background:"none",border:"none",fontSize:11,color:"#FF2D2D",cursor:"pointer",fontWeight:700}}>Copy</button>
                <button onClick={()=>{setEditedScript(genResult.script||"");setEditingScript(true);}} style={{background:"none",border:"none",fontSize:11,color:"#7B61FF",cursor:"pointer",fontWeight:700}}>Edit</button>
              </div>
            </div>
            <div style={{padding:"16px 20px",fontSize:14,lineHeight:1.7,color:"#1a1a1a",whiteSpace:"pre-wrap"}}>{genResult.script}</div>
          </div>

          {/* Regenerate options */}
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
            {["Make it shorter","Make it sassier","More energy","Less generic","More personal"].map(fb=>(
              <button key={fb} onClick={()=>regenerateScript(fb)} disabled={regenerating}
                style={{padding:"8px 14px",borderRadius:999,border:"1.5px solid rgba(0,0,0,0.1)",background:"#fff",fontFamily:"inherit",fontSize:12,cursor:"pointer",color:"#1a1a1a",fontWeight:500}}>
                {fb}
              </button>
            ))}
            <button onClick={()=>setShowFeedback(!showFeedback)}
              style={{padding:"8px 14px",borderRadius:999,border:"1.5px solid #7B61FF",background:"#fff",fontFamily:"inherit",fontSize:12,cursor:"pointer",color:"#7B61FF",fontWeight:600}}>
              Custom feedback...
            </button>
          </div>

          {showFeedback && (
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              <input value={feedbackInput} onChange={e=>setFeedbackInput(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&feedbackInput.trim())regenerateScript(feedbackInput.trim());}}
                placeholder="Tell AI what to change... e.g. 'too long, make it punchy and fun'"
                style={{flex:1,padding:"10px 14px",borderRadius:12,border:"1.5px solid rgba(0,0,0,0.1)",fontFamily:"inherit",fontSize:13,outline:"none"}} />
              <button onClick={()=>{if(feedbackInput.trim())regenerateScript(feedbackInput.trim());}} disabled={!feedbackInput.trim()||regenerating}
                style={{background:"#7B61FF",color:"#fff",border:"none",borderRadius:12,padding:"10px 18px",fontFamily:"inherit",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                {regenerating?"...":"Regenerate"}
              </button>
            </div>
          )}

          {regenerating && <div style={{fontSize:13,color:"#7B61FF",fontWeight:600,marginBottom:12}}>Regenerating script...</div>}

          {genResult.caption && (
            <div style={{background:"#fff",borderRadius:16,border:"1px solid rgba(0,0,0,0.07)",overflow:"hidden",marginBottom:12}}>
              <div style={{padding:"16px 20px",borderBottom:"1px solid rgba(0,0,0,0.06)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:11,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:"#7c7660"}}>Caption</div>
                <button onClick={()=>navigator.clipboard?.writeText(genResult.caption||"")} style={{background:"none",border:"none",fontSize:11,color:"#FF2D2D",cursor:"pointer",fontWeight:700}}>Copy</button>
              </div>
              <div style={{padding:"16px 20px",fontSize:14,lineHeight:1.7,color:"#1a1a1a"}}>{genResult.caption}</div>
            </div>
          )}

          {/* Render video button - only shows after script is ready */}
          {!videoUrl && (
            <button onClick={renderVideo} disabled={generating}
              style={{width:"100%",background:"#FF2D2D",color:"#fff",border:"none",borderRadius:999,padding:"16px 40px",fontWeight:700,fontSize:16,cursor:"pointer",marginTop:8}}>
              {generating ? "Rendering..." : "Render Video with This Script"}
            </button>
          )}
        </div>
      )}

      {/* Custom script editor */}
      {editingScript && (
        <div style={{marginBottom:40}}>
          <div style={{background:"#fff",borderRadius:16,border:"1px solid #7B61FF",overflow:"hidden",marginBottom:12}}>
            <div style={{padding:"16px 20px",borderBottom:"1px solid rgba(0,0,0,0.06)"}}>
              <div style={{fontSize:11,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:"#7B61FF"}}>Edit Script</div>
            </div>
            <textarea value={editedScript} onChange={e=>setEditedScript(e.target.value)}
              rows={8}
              style={{width:"100%",padding:"16px 20px",border:"none",fontFamily:"inherit",fontSize:14,lineHeight:1.7,resize:"vertical",outline:"none",boxSizing:"border-box"}} />
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={saveCustomScript}
              style={{background:"#7B61FF",color:"#fff",border:"none",borderRadius:999,padding:"12px 24px",fontFamily:"inherit",fontSize:14,fontWeight:700,cursor:"pointer"}}>
              Use This Script
            </button>
            <button onClick={()=>setEditingScript(false)}
              style={{background:"none",border:"1px solid rgba(0,0,0,0.1)",borderRadius:999,padding:"12px 24px",fontFamily:"inherit",fontSize:14,cursor:"pointer",color:"#7c7660"}}>
              Cancel
            </button>
          </div>
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

      {genStatus && (
        <div style={{background:"#f0f0ff",border:"1px solid rgba(123,97,255,0.3)",borderRadius:12,padding:"14px 18px",marginBottom:16,fontSize:13,color:"#7B61FF",fontWeight:600}}>{genStatus}</div>
      )}

      {/* Initial generate button - only shows if no script yet */}
      {!genResult?.script && (
        <button
          onClick={generateAll}
          disabled={generating || uploads.length === 0}
          style={{background:uploads.length===0?"#ccc":"#FF2D2D",color:"#fff",border:"none",borderRadius:999,padding:"16px 40px",fontWeight:700,fontSize:16,cursor:uploads.length===0?"not-allowed":"pointer",width:"100%"}}
        >
          {generating ? "Generating..." : uploads.length===0 ? "Upload media first" : "Generate Script with AI"}
        </button>
      )}
    </div>
  );
}
