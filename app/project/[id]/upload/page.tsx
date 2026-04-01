"use client";
import { useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface FileEntry { file: File; preview: string; status: "pending"|"uploading"|"done"|"error"; }
interface GDriveEntry { url: string; status: "pending"|"importing"|"done"|"error"; name?: string; }

export default function UploadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string|null>(null);

  // Google Drive state
  const [showGDrive, setShowGDrive] = useState(false);
  const [gdriveInput, setGdriveInput] = useState("");
  const [gdriveFiles, setGdriveFiles] = useState<GDriveEntry[]>([]);
  const [gdriveImporting, setGdriveImporting] = useState(false);

  async function uploadOne(entry: FileEntry, index: number) {
    setFiles(p=>p.map((f,i)=>i===index?{...f,status:"uploading"}:f));
    try {
      const sigRes = await fetch("/api/uploads/sign");
      if (!sigRes.ok) throw new Error(`Sign failed: ${sigRes.status}`);
      const sig = await sigRes.json();
      if (!sig.cloudName || !sig.apiKey || !sig.signature) throw new Error("Missing Cloudinary credentials");
      const form = new FormData();
      form.append("file",entry.file); form.append("signature",sig.signature); form.append("timestamp",String(sig.timestamp)); form.append("folder",sig.folder); form.append("api_key",sig.apiKey);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`,{method:"POST",body:form});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Upload error: ${res.status}`);
      await fetch("/api/uploads",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({projectId:id,fileName:entry.file.name,fileType:entry.file.type.startsWith("video/")?"video":"image",mimeType:entry.file.type,fileSize:entry.file.size,filePath:data.secure_url})});
      setFiles(p=>p.map((f,i)=>i===index?{...f,status:"done"}:f));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Upload failed");
      setFiles(p=>p.map((f,i)=>i===index?{...f,status:"error"}:f));
    }
  }

  function addFiles(raw: FileList|null) {
    if (!raw) return;
    setFiles(p=>[...p,...Array.from(raw).filter(f=>f.type.startsWith("image/")||f.type.startsWith("video/")).map(f=>({file:f,preview:URL.createObjectURL(f),status:"pending" as const}))]);
  }

  async function handleUpload() { setUploading(true); await Promise.all(files.map((e,i)=>uploadOne(e,i))); setUploading(false); setDone(true); }

  function addGDriveLink() {
    const url = gdriveInput.trim();
    if (!url) return;
    setGdriveFiles(p => [...p, { url, status: "pending" }]);
    setGdriveInput("");
  }

  function removeGDriveLink(idx: number) {
    setGdriveFiles(p => p.filter((_, i) => i !== idx));
  }

  async function importGDriveFiles() {
    setGdriveImporting(true);
    setErrorMsg(null);

    for (let i = 0; i < gdriveFiles.length; i++) {
      if (gdriveFiles[i].status === "done") continue;
      setGdriveFiles(p => p.map((f, j) => j === i ? { ...f, status: "importing" } : f));
      try {
        const res = await fetch("/api/uploads/gdrive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: gdriveFiles[i].url, projectId: id }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        const upload = data.uploads?.[0];
        setGdriveFiles(p => p.map((f, j) => j === i ? { ...f, status: "done", name: upload?.file_name || "Imported" } : f));
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Import failed");
        setGdriveFiles(p => p.map((f, j) => j === i ? { ...f, status: "error" } : f));
      }
    }
    setGdriveImporting(false);
  }

  const allGDriveDone = gdriveFiles.length > 0 && gdriveFiles.every(f => f.status === "done");

  return (
    <div style={{maxWidth:860,margin:"0 auto",padding:"48px 24px",background:"#F8F8A6",minHeight:"100vh"}}>
      <button onClick={()=>router.back()} style={{background:"none",border:"none",cursor:"pointer",marginBottom:32,fontSize:14,color:"#78716c"}}>Back</button>
      <h1 style={{fontSize:32,fontWeight:800,marginBottom:8}}>Upload Your Content</h1>
      <p style={{color:"#78716c",marginBottom:32}}>Photos and videos - upload as many as you want.</p>

      {errorMsg && <div style={{background:"#fff0f0",border:"1px solid rgba(255,45,45,0.3)",borderRadius:10,padding:"12px 16px",marginBottom:16,fontSize:13,color:"#FF2D2D"}}>{errorMsg}</div>}

      {/* Upload method tabs */}
      <div style={{display:"flex",gap:8,marginBottom:24}}>
        <button onClick={()=>setShowGDrive(false)}
          style={{padding:"10px 20px",borderRadius:999,border:!showGDrive?"2px solid #FF2D2D":"1.5px solid rgba(0,0,0,0.1)",background:!showGDrive?"#FF2D2D":"#fff",color:!showGDrive?"#fff":"#1a1a1a",fontFamily:"inherit",fontSize:13,fontWeight:600,cursor:"pointer"}}>
          From Device
        </button>
        <button onClick={()=>setShowGDrive(true)}
          style={{padding:"10px 20px",borderRadius:999,border:showGDrive?"2px solid #FF2D2D":"1.5px solid rgba(0,0,0,0.1)",background:showGDrive?"#FF2D2D":"#fff",color:showGDrive?"#fff":"#1a1a1a",fontFamily:"inherit",fontSize:13,fontWeight:600,cursor:"pointer"}}>
          From Google Drive
        </button>
      </div>

      {/* Device upload */}
      {!showGDrive && (
        <>
          <div onClick={()=>inputRef.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();addFiles(e.dataTransfer.files);}} style={{border:"2px dashed rgba(0,0,0,0.12)",borderRadius:14,padding:60,textAlign:"center",cursor:"pointer",background:"#fff",marginBottom:24}}>
            <div style={{fontSize:32,marginBottom:8,color:"#FF2D2D"}}>+</div>
            <div style={{fontWeight:600,fontSize:14,color:"#1a1a1a"}}>Click to browse or drag and drop</div>
            <div style={{fontSize:12,color:"#78716c",marginTop:4}}>Photos and videos - any size - unlimited files</div>
            <input ref={inputRef} type="file" multiple accept="image/*,video/*" style={{display:"none"}} onChange={e=>addFiles(e.target.files)} />
          </div>

          {files.length>0&&<div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12,marginBottom:24}}>
              {files.map((f,i)=><div key={i} style={{background:"#fff",borderRadius:12,overflow:"hidden",border:"1px solid #eee"}}>
                {f.file.type.startsWith("image/")?<img src={f.preview} style={{width:"100%",height:120,objectFit:"cover"}} alt=""/>:<div style={{height:120,background:"#f5f5f5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#78716c",fontWeight:600}}>VIDEO</div>}
                <div style={{padding:"8px 10px"}}><div style={{fontSize:12,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.file.name}</div>
                <div style={{fontSize:11,color:f.status==="done"?"#16a34a":f.status==="error"?"#FF2D2D":"#78716c"}}>{f.status==="pending"&&"Ready"}{f.status==="uploading"&&"Uploading..."}{f.status==="done"&&"Done!"}{f.status==="error"&&"Failed"}</div></div>
              </div>)}
            </div>
            {!done?<button onClick={handleUpload} disabled={uploading} style={{background:"#FF2D2D",color:"#fff",border:"none",borderRadius:999,padding:"14px 28px",fontWeight:700,fontSize:14,cursor:"pointer"}}>{uploading?"Uploading...":"Upload All Files"}</button>
            :<div><p style={{color:"#16a34a",fontWeight:600,marginBottom:16}}>All uploaded!</p><button onClick={()=>router.back()} style={{background:"#FF2D2D",color:"#fff",border:"none",borderRadius:999,padding:"14px 28px",fontWeight:700,fontSize:14,cursor:"pointer"}}>Done - Back to Project</button></div>}
          </div>}
        </>
      )}

      {/* Google Drive import */}
      {showGDrive && (
        <div>
          <div style={{background:"#fff",borderRadius:16,border:"1px solid rgba(0,0,0,0.07)",padding:24,marginBottom:24}}>
            <div style={{fontSize:11,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:"#7c7660",marginBottom:16}}>Google Drive Import</div>
            <p style={{fontSize:13,color:"#78716c",marginBottom:16,lineHeight:1.6}}>
              Paste Google Drive share links below. Make sure each file is shared as "Anyone with the link". Add as many as you want.
            </p>

            <div style={{display:"flex",gap:8,marginBottom:16}}>
              <input
                value={gdriveInput}
                onChange={e=>setGdriveInput(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter")addGDriveLink();}}
                placeholder="Paste Google Drive link here..."
                style={{flex:1,padding:"12px 16px",borderRadius:12,border:"1.5px solid rgba(0,0,0,0.1)",fontFamily:"inherit",fontSize:13,outline:"none"}}
              />
              <button onClick={addGDriveLink} disabled={!gdriveInput.trim()}
                style={{background:gdriveInput.trim()?"#FF2D2D":"#f5f5f0",color:gdriveInput.trim()?"#fff":"#b5b09a",border:"none",borderRadius:12,padding:"12px 20px",fontFamily:"inherit",fontSize:13,fontWeight:700,cursor:gdriveInput.trim()?"pointer":"default"}}>
                Add
              </button>
            </div>

            {gdriveFiles.length > 0 && (
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
                {gdriveFiles.map((g, i) => (
                  <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:"#fafaf4",borderRadius:10}}>
                    <div style={{flex:1,fontSize:12,color:"#1a1a1a",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {g.name || g.url.slice(0, 60)}...
                    </div>
                    <div style={{fontSize:11,fontWeight:600,flexShrink:0,color:
                      g.status==="done"?"#16a34a":g.status==="error"?"#FF2D2D":g.status==="importing"?"#7B61FF":"#78716c"}}>
                      {g.status==="pending"&&"Ready"}
                      {g.status==="importing"&&"Importing..."}
                      {g.status==="done"&&"Imported!"}
                      {g.status==="error"&&"Failed"}
                    </div>
                    {g.status==="pending"&&<button onClick={()=>removeGDriveLink(i)} style={{background:"none",border:"none",fontSize:16,color:"#b5b09a",cursor:"pointer"}}>x</button>}
                  </div>
                ))}
              </div>
            )}

            {gdriveFiles.length > 0 && !allGDriveDone && (
              <button onClick={importGDriveFiles} disabled={gdriveImporting}
                style={{background:"#FF2D2D",color:"#fff",border:"none",borderRadius:999,padding:"14px 28px",fontFamily:"inherit",fontSize:14,fontWeight:700,cursor:"pointer"}}>
                {gdriveImporting ? "Importing..." : `Import ${gdriveFiles.filter(f=>f.status==="pending").length} File${gdriveFiles.filter(f=>f.status==="pending").length!==1?"s":""}`}
              </button>
            )}

            {allGDriveDone && (
              <div>
                <p style={{color:"#16a34a",fontWeight:600,marginBottom:16}}>All files imported!</p>
                <button onClick={()=>router.back()} style={{background:"#FF2D2D",color:"#fff",border:"none",borderRadius:999,padding:"14px 28px",fontFamily:"inherit",fontSize:14,fontWeight:700,cursor:"pointer"}}>
                  Done - Back to Project
                </button>
              </div>
            )}
          </div>

          <div style={{background:"#fff",borderRadius:16,border:"1px solid rgba(0,0,0,0.07)",padding:24}}>
            <div style={{fontSize:11,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:"#7c7660",marginBottom:12}}>How to share from Google Drive</div>
            <ol style={{fontSize:13,color:"#78716c",lineHeight:1.8,paddingLeft:20,margin:0}}>
              <li>Open Google Drive</li>
              <li>Right-click your file</li>
              <li>Click "Share" → "Share"</li>
              <li>Change to "Anyone with the link"</li>
              <li>Copy the link and paste it above</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
