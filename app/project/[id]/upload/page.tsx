"use client";
import { useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
interface FileEntry { file: File; preview: string; status: "pending"|"uploading"|"done"|"error"; }
export default function UploadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string|null>(null);
  async function uploadOne(entry: FileEntry, index: number) {
    setFiles(p=>p.map((f,i)=>i===index?{...f,status:"uploading"}:f));
    try {
      const sigRes = await fetch("/api/uploads/sign");
      if (!sigRes.ok) throw new Error(`Sign failed: ${sigRes.status}`);
      const sig = await sigRes.json();
      if (!sig.cloudName || !sig.apiKey || !sig.signature) throw new Error("Missing Cloudinary credentials - check env vars");
      const form = new FormData();
      form.append("file",entry.file); form.append("signature",sig.signature); form.append("timestamp",String(sig.timestamp)); form.append("folder",sig.folder); form.append("api_key",sig.apiKey);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`,{method:"POST",body:form});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Cloudinary error: ${res.status}`);
      await fetch("/api/uploads",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({projectId:id,fileName:entry.file.name,fileType:entry.file.type.startsWith("video/")?"video":"image",mimeType:entry.file.type,fileSize:entry.file.size,filePath:data.secure_url})});
      setFiles(p=>p.map((f,i)=>i===index?{...f,status:"done"}:f));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      console.error(`Upload error for ${entry.file.name}:`, msg);
      setErrorMsg(msg);
      setFiles(p=>p.map((f,i)=>i===index?{...f,status:"error"}:f));
    }
  }
  function addFiles(raw: FileList|null) {
    if (!raw) return;
    setFiles(p=>[...p,...Array.from(raw).filter(f=>f.type.startsWith("image/")||f.type.startsWith("video/")).map(f=>({file:f,preview:URL.createObjectURL(f),status:"pending" as const}))]);
  }
  async function handleUpload() { setUploading(true); await Promise.all(files.map((e,i)=>uploadOne(e,i))); setUploading(false); setDone(true); }
  return (
    <div style={{maxWidth:860,margin:"0 auto",padding:"48px 24px",background:"#F8F8A6",minHeight:"100vh"}}>
      <button onClick={()=>router.back()} style={{background:"none",border:"none",cursor:"pointer",marginBottom:32,fontSize:14}}>Back</button>
      <h1 style={{fontSize:32,fontWeight:800,marginBottom:8}}>Upload Your Content</h1>
      <p style={{color:"#78716c",marginBottom:40}}>Photos and videos - any size.</p>
      {errorMsg && <div style={{background:"#fff0f0",border:"1px solid rgba(255,45,45,0.3)",borderRadius:10,padding:"12px 16px",marginBottom:16,fontSize:13,color:"#FF2D2D"}}>{errorMsg}</div>}
      <div onClick={()=>inputRef.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();addFiles(e.dataTransfer.files);}} style={{border:"2px dashed #ccc",borderRadius:14,padding:60,textAlign:"center",cursor:"pointer",background:"#fff"}}>
        <div style={{fontSize:32,marginBottom:8}}>+</div>
        <div style={{fontWeight:600}}>Click to browse or drag and drop</div>
        <input ref={inputRef} type="file" multiple accept="image/*,video/*" style={{display:"none"}} onChange={e=>addFiles(e.target.files)} />
      </div>
      {files.length>0&&<div style={{marginTop:32}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12,marginBottom:24}}>
          {files.map((f,i)=><div key={i} style={{background:"#fff",borderRadius:12,overflow:"hidden",border:"1px solid #eee"}}>
            {f.file.type.startsWith("image/")?<img src={f.preview} style={{width:"100%",height:120,objectFit:"cover"}} alt=""/>:<div style={{height:120,background:"#f5f5f5",display:"flex",alignItems:"center",justifyContent:"center"}}>VIDEO</div>}
            <div style={{padding:"8px 10px"}}><div style={{fontSize:12,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.file.name}</div>
            <div style={{fontSize:11,color:f.status==="done"?"#16a34a":f.status==="error"?"#FF2D2D":"#78716c"}}>{f.status==="pending"&&"Ready"}{f.status==="uploading"&&"Uploading..."}{f.status==="done"&&"Done!"}{f.status==="error"&&"Failed"}</div></div>
          </div>)}
        </div>
        {!done?<button onClick={handleUpload} disabled={uploading} style={{background:"#FF2D2D",color:"#fff",border:"none",borderRadius:999,padding:"12px 28px",fontWeight:600,cursor:"pointer"}}>{uploading?"Uploading...":"Upload All Files"}</button>
        :<div><p style={{color:"#16a34a",fontWeight:600,marginBottom:16}}>All uploaded!</p><button onClick={()=>router.back()} style={{background:"#FF2D2D",color:"#fff",border:"none",borderRadius:999,padding:"12px 28px",fontWeight:600,cursor:"pointer"}}>Done</button></div>}
      </div>}
    </div>
  );
}
