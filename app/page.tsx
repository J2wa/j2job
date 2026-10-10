"use client";
import { useRef, useState, useEffect } from "react";
import { ArrowUpRight, FileText, Sparkles, Upload, Check, Download, ShieldCheck, BriefcaseBusiness, Plus, X, ChevronRight, LoaderCircle, Eye, WandSparkles, LockKeyhole } from "lucide-react";
import { profileSchema, resumeSchema, bundleSchema, analysisSchema, plainResume, type Profile, type Bundle, type Analysis } from "@/lib/resume-schema";
import { demoProfile, demoBundle, demoAnalysis } from "@/lib/demo";
import { download, exportDocx } from "@/lib/export";
const empty:Profile={name:"",email:"",phone:"",location:"",links:"",experience:"",education:"",certifications:"",skills:"",resumeText:"",jobDescription:"",tone:"Professional",length:"Focused",hypothetical:false};
type Style="ats"|"modern"|"executive"|"compact";
const styles:{id:Style;name:string;detail:string}[]=[{id:"ats",name:"ATS Classic",detail:"Clean · one column"},{id:"modern",name:"Modern",detail:"Contemporary · optional photo"},{id:"executive",name:"Executive",detail:"Editorial · strong hierarchy"},{id:"compact",name:"Compact",detail:"Dense · concise presentation"}];
export default function Studio(){
 const [p,setP]=useState<Profile>(empty),[bundle,setBundle]=useState<Bundle|null>(null),[analysis,setAnalysis]=useState<Analysis|null>(null),[score,setScore]=useState(0);
 const [resultProfile,setResultProfile]=useState<Profile>(empty),[style,setStyle]=useState<Style>("ats"),[tab,setTab]=useState("resume"),[step,setStep]=useState(0),[photo,setPhoto]=useState(""),[resultPhoto,setResultPhoto]=useState("");
 const [busy,setBusy]=useState(false),[stage,setStage]=useState(""),[error,setError]=useState(""),[demo,setDemo]=useState(false),[reviewed,setReviewed]=useState(false),[editing,setEditing]=useState(false),[json,setJson]=useState(""),[password,setPassword]=useState(""),[unlocked,setUnlocked]=useState(false),[accessOpen,setAccessOpen]=useState(false),[notice,setNotice]=useState("");
 const upload=useRef<HTMLInputElement>(null),avatar=useRef<HTMLInputElement>(null),abort=useRef<AbortController|null>(null);
 const [modelOptions,setModelOptions]=useState<{id:string;name:string;enabled:boolean;source:string;models:{id:string}[]}[]>([]);
 const [defaultProvider,setDefaultProvider]=useState("openrouter");
 const [modelStatus,setModelStatus]=useState("Unlock the workspace to check API availability."),[loadingModels,setLoadingModels]=useState(false);
 async function refreshModels(signal?:AbortSignal){
  setLoadingModels(true);try{const response=await fetch("/api/models",{signal});const data=await response.json();if(!response.ok)throw new Error(data.error);
   setModelOptions(data.providers);setDefaultProvider(data.defaultProvider??"openrouter");setModelStatus("Configured APIs and compatible models are detected automatically. Generation verifies access and quota.");
  }catch(error){if(!signal?.aborted)setModelStatus(error instanceof Error?error.message:"Model options unavailable.");}finally{if(!signal?.aborted)setLoadingModels(false);}
 }
 useEffect(()=>{if(step!==2&&!unlocked)return;const controller=new AbortController();void refreshModels(controller.signal);return()=>controller.abort();},[step,unlocked]);
 const effectiveProvider=p.aiProvider&&p.aiProvider!=="auto"&&p.aiProvider!=="gateway"?p.aiProvider:defaultProvider;
 const currentModels=modelOptions.find(option=>option.id===effectiveProvider);
 function field(key:keyof Profile,value:string|boolean){setP(v=>({...v,[key]:value}));}
 function message(e:unknown){setError(e instanceof Error?e.message:"Something went wrong.");}
 async function importResume(file?:File){
 if(!file)return;setError("");setNotice("Reading resume…");
 try{
 if(file.size>4*1024*1024)throw new Error("Please use a resume smaller than 4 MB.");
 const ext=file.name.split(".").pop()?.toLowerCase();let text="";
 if(ext==="txt"||ext==="md")text=await file.text();
 else if(ext==="docx"){const mammoth=await import("mammoth");text=(await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()})).value;}
 else if(ext==="pdf"){const pdfjs=await import("pdfjs-dist");pdfjs.GlobalWorkerOptions.workerSrc="/pdf.worker.min.mjs";const doc=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
 if(doc.numPages>20)throw new Error("Use a resume with 20 pages or fewer.");
 const lines=[];for(let i=1;i<=doc.numPages;i++){const content=await(await doc.getPage(i)).getTextContent();lines.push(content.items.map(item=>"str" in item?item.str:"").join(" "));}text=lines.join("\n");await doc.loadingTask.destroy();}
 else throw new Error("Supported formats: PDF, DOCX, TXT, and Markdown.");
 if(text.trim().length<30)throw new Error("No readable text found. For scanned PDFs, paste the resume text.");
 if(text.length>45000)throw new Error("Resume text exceeds 45,000 characters. Please shorten it.");
 field("resumeText",text);setNotice("Imported "+file.name+". Review the extracted text below.");
 }catch(e){message(e);setNotice("");}}
 async function importPhoto(file?:File){
 if(!file)return;
 try{if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>4*1024*1024)throw new Error("Use a JPG, PNG, or WebP image under 4 MB.");
 const bitmap=await createImageBitmap(file);const canvas=document.createElement("canvas");canvas.width=256;canvas.height=256;const ctx=canvas.getContext("2d")!;const size=Math.min(bitmap.width,bitmap.height);ctx.drawImage(bitmap,(bitmap.width-size)/2,(bitmap.height-size)/2,size,size,0,0,256,256);bitmap.close();setPhoto(canvas.toDataURL("image/jpeg",.85));
 }catch(e){message(e);}}
 async function unlock(){
 setError("");try{const res=await fetch("/api/access",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password})});const data=await res.json();if(!res.ok)throw new Error(data.error);setUnlocked(true);setAccessOpen(false);setPassword("");setNotice("Workspace unlocked for this browser session.");}catch(e){message(e);}}
 async function generate(){
 const valid=profileSchema.safeParse(p);if(!valid.success){setError(valid.error.issues[0].message);return;}
 setBusy(true);setError("");setStage("Starting your application kit");setReviewed(false);abort.current=new AbortController();
 try{
 const res=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(p),signal:abort.current.signal});
 if(!res.ok){const data=await res.json();if(res.status===401)setAccessOpen(true);throw new Error(data.error);}
 const reader=res.body!.getReader(),decoder=new TextDecoder();let pending="",completed=false;
 for(;;){const {value,done}=await reader.read();pending+=decoder.decode(value,{stream:!done});
 const lines=pending.split("\n");pending=lines.pop()||"";
 for(const line of lines){if(!line.trim())continue;const event=JSON.parse(line);if(event.stage)setStage(event.stage);if(event.error)throw new Error(event.error);if(event.done){setBundle(event.bundle);setAnalysis(event.analysis);setScore(event.coverage);setResultProfile({...p});setResultPhoto(photo);setDemo(false);setTab("resume");completed=true;}}
 if(done)break;}if(!completed)throw new Error("The response was interrupted. Please retry.");
 }catch(e){if(e instanceof Error&&e.name==="AbortError")setNotice("Generation stopped.");else message(e);}finally{setBusy(false);setStage("");}}
 function loadDemo(){setP({...demoProfile});setBundle(demoBundle);setAnalysis(demoAnalysis);setResultProfile({...demoProfile});setScore(75);setDemo(true);setReviewed(false);setPhoto("");setResultPhoto("");setError("");}
 function saveLocal(){try{localStorage.setItem("resume-studio-draft",JSON.stringify({version:1,p,photo,bundle,analysis,resultProfile,resultPhoto,style,score,demo}));setNotice("Draft saved on this device. Use Clear saved draft to remove it.");}catch{setError("This browser could not save the draft.");}}
 function loadLocal(){try{const raw=localStorage.getItem("resume-studio-draft");if(!raw){setNotice("No saved draft on this device.");return;}const d=JSON.parse(raw);if(d.version!==1)throw new Error("Unsupported draft version");if(!d.p||Object.keys(empty).some(k=>typeof d.p[k]!==typeof empty[k as keyof Profile]))throw new Error("Invalid draft");if(d.bundle)bundleSchema.parse(d.bundle);if(d.analysis)analysisSchema.parse(d.analysis);if(d.bundle)profileSchema.parse(d.resultProfile);if(!styles.some(s=>s.id===d.style))throw new Error("Invalid style");setP(d.p);setPhoto(d.photo||"");setBundle(d.bundle);setAnalysis(d.analysis);setResultProfile(d.resultProfile);setResultPhoto(d.resultPhoto||"");setStyle(d.style);setScore(d.score);setDemo(!!d.demo);setReviewed(false);setNotice("Saved draft restored. Review before exporting.");}catch{setError("Saved draft is invalid or unavailable.");}}
 function exportText(){if(bundle)download(new Blob([(demo?"FICTIONAL DEMONSTRATION — NOT AN APPLICATION\n\n":"")+plainResume(bundle.resume,resultProfile)],{type:"text/plain;charset=utf-8"}),"resume.txt");}
 function saveEdits(){try{const r=resumeSchema.parse(JSON.parse(json));setBundle(b=>b?{...b,resume:r}:b);setEditing(false);setReviewed(false);setNotice("Edits saved. Review the updated resume before export.");}catch{setError("Use valid resume JSON and preserve all required fields.");}}
 const r=bundle?.resume;
 const input=(key:keyof Profile,label:string,placeholder:string,type="text")=><label className="field" key={key}><span>{label}</span><input type={type} value={String(p[key])} onChange={e=>field(key,e.target.value)} placeholder={placeholder}/></label>;
 const area=(key:keyof Profile,label:string,placeholder:string,rows=5)=><label className="field" key={key}><span>{label}</span><textarea rows={rows} value={String(p[key])} onChange={e=>field(key,e.target.value)} placeholder={placeholder}/></label>;
 return <div className="studio">
 <aside className="sidebar"><a className="brand" href="/"><span className="brand-icon"><FileText size={22}/></span>resume<span className="brand-light">studio</span></a>
 <div className="workspace-label">YOUR WORKSPACE</div><button className="nav-active"><BriefcaseBusiness size={18}/> Resume builder <ChevronRight size={15}/></button><a className="nav-link" href="/coach" target="_blank" rel="noreferrer"><Sparkles size={18}/> Career coach <ArrowUpRight size={15}/></a>
 <div className="sidebar-bottom"><div className="small-card"><ShieldCheck size={20}/><strong>Your story. Better told.</strong><p>Grounded in your experience. Tailored to your next opportunity.</p></div><button className="nav-link" onClick={()=>setAccessOpen(true)}><LockKeyhole size={17}/>{unlocked?"Workspace unlocked":"Unlock AI workspace"}</button><span className="version">ACES INTELLIGENCE · RESUME STUDIO</span></div></aside>
 <main><header className="topbar"><span>Workspace <ChevronRight size={12}/> Resume builder</span><div><button className="quiet" onClick={loadLocal}>Load draft</button><button className="quiet" onClick={saveLocal}>Save on device</button></div></header>
 <section className="intro"><div><span className="eyebrow"><span className="dot"/> BUILT FOR YOUR NEXT CHAPTER</span><h1>Your experience.<br/><em>The right words.</em></h1><p>Turn your background and a job description into<br className="desktop"/> a thoughtful, tailored application.</p></div><button className="demo-button" onClick={loadDemo}><Eye size={16}/> Explore a sample <ArrowUpRight size={16}/></button></section>
 <div className="builder-grid">
 <section className="input-panel">
 <div className="panel-heading"><span className="section-number">01</span><div><h2>Build your brief</h2><p>A little context makes a big difference.</p></div></div>
 <div className="steps">{["The role","Your story","Preferences"].map((s,i)=><button key={s} className={step===i?"selected":""} onClick={()=>setStep(i)}><span>{i+1}</span>{s}</button>)}</div>
 <div className="form-body">
 {step===0&&<><div className="form-kicker">START WITH THE OPPORTUNITY</div>{area("jobDescription","Job description","Paste the full job description, including responsibilities, required skills, and qualifications.",13)}<div className="tip"><WandSparkles size={18}/><span>The agent maps requirements to your experience, writes a draft, then reviews its claims.</span></div></>}
 {step===1&&<><div className="upload-box"><Upload size={23}/><div><strong>Already have a resume?</strong><p>PDF, DOCX, or text · up to 4 MB</p></div><button className="small-button" onClick={()=>upload.current?.click()}>Import</button></div><input ref={upload} type="file" accept=".pdf,.docx,.txt,.md" hidden onChange={e=>{void importResume(e.target.files?.[0]);e.target.value="";}}/>
 <div className="two-col">{input("name","Full name *","Your name")}{input("email","Email","you@example.com","email")}{input("phone","Phone","Country code + number")}{input("location","Location","City, country")}</div>
 {input("links","Portfolio / LinkedIn","Your professional links")}
 {area("experience","Your experience","Include real roles, employers, dates, projects, achievements, and measurable results.",7)}
 {area("skills","Skills","Tools, technical skills, languages, and strengths.",3)}
 <div className="two-col">{area("education","Education","School, degree, graduation year.",3)}{area("certifications","Certifications","Exact certification and issuer. Mark anything still in progress.",3)}</div>
 {p.resumeText&&area("resumeText","Imported resume text — review and correct","",6)}
 <div className="photo-row">{photo?<img src={photo} alt="Profile preview"/>:<div className="avatar-placeholder">+</div>}<div><strong>Profile photo <span className="optional">optional</span></strong><p>Available in Modern. ATS exports use text only.</p></div><button className="quiet" onClick={()=>avatar.current?.click()}>Add photo</button>{photo&&<button aria-label="Remove photo" className="quiet" onClick={()=>setPhoto("")}><X size={16}/></button>}</div><input ref={avatar} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e=>{void importPhoto(e.target.files?.[0]);e.target.value="";}}/></>}
 {step===2&&<><div className="form-kicker">MAKE IT FEEL LIKE YOU</div><label className="field"><span>Writing tone</span><select value={p.tone} onChange={e=>field("tone",e.target.value)}>{["Professional","Confident","Concise"].map(x=><option key={x}>{x}</option>)}</select></label>
 <label className="field"><span>Detail level</span><select value={p.length} onChange={e=>field("length",e.target.value)}><option>Focused</option><option>Detailed</option></select></label>
 <label className="field"><span>AI provider</span><select disabled={busy} value={p.aiProvider==="gateway"?"auto":p.aiProvider??"auto"} onChange={e=>setP(value=>({...value,aiProvider:e.target.value as Profile["aiProvider"],aiModel:""}))}><option value="auto">Automatic — OpenRouter → Gemini → OpenAI</option><option value="openrouter">OpenRouter</option><option value="gemini">Google Gemini API</option><option value="openai">OpenAI</option></select></label>
 <label className="field"><span>Model {currentModels?"("+currentModels.models.length+" compatible options)":""}</span><select disabled={busy||loadingModels||!currentModels?.enabled} value={p.aiModel??""} onChange={e=>field("aiModel",e.target.value)}><option value="">Automatic — all compatible models</option>{p.aiModel&&!currentModels?.models.some(m=>m.id===p.aiModel)&&<option value={p.aiModel}>{p.aiModel} — saved selection</option>}{currentModels?.models.map(model=><option key={model.id} value={model.id}>{model.id}</option>)}</select></label>
 <p className="privacy" role="status">{loadingModels?"Checking API availability…":modelStatus}{modelOptions.map(option=>" "+option.name+": "+(option.enabled?"configured ("+option.models.length+" compatible models)":"not configured")+".").join("")}</p>
 <button type="button" className="quiet" disabled={busy||loadingModels} onClick={()=>void refreshModels()}>Refresh API availability</button>
 <div className="tip"><WandSparkles size={18}/><span>Your selection is tried first. Automatic mode uses OpenRouter → Gemini → OpenAI. All configured key pools and compatible models are available for fallback.</span></div>
 <div className="style-options">{styles.map(s=><button key={s.id} className={style===s.id?"chosen":""} onClick={()=>setStyle(s.id)}><div className={"mini-page "+s.id}><i/><i/><i/><i/></div><strong>{s.name}</strong><small>{s.detail}</small>{style===s.id&&<Check size={15}/>}</button>)}</div>
 <label className="checkbox-row"><input type="checkbox" checked={p.hypothetical} onChange={e=>field("hypothetical",e.target.checked)}/><span><strong>Add relevant freelance/project experience</strong><small>Drafts additional project roles aligned with the listing. Review generated details and use only work you have completed when applying.</small></span></label><div className="tip"><ShieldCheck size={18}/><span>Your match report highlights supported qualifications and gaps. It does not predict hiring decisions.</span></div></>}
 <div className="form-actions">{step<2?<button className="secondary" onClick={()=>setStep(step+1)}>Continue <ChevronRight size={16}/></button>:null}<button className="primary" disabled={busy} onClick={()=>void generate()}>{busy?<LoaderCircle className="spin" size={17}/>:<Sparkles size={17}/>} {busy?"Creating your kit…":"Create application kit"}</button></div>
 {busy&&<div className="progress" role="status"><span className="dot"/>{stage}<button className="quiet" onClick={()=>abort.current?.abort()}>Stop</button></div>}
 <p className="privacy">Imported files and photos stay in this browser. Generation sends your entered and extracted text to the configured AI model. Device saving is optional.</p>
 </div></section>
 <section className="output-panel"><div className="panel-heading"><span className="section-number">02</span><div><h2>Your application kit</h2><p>Review, refine, and make your next move.</p></div><span className="draft-badge">{bundle?"DRAFT":"PREVIEW"}</span></div>
 <div className="output-tabs">{["resume","match","letter","interview","examples"].map(t=><button key={t} onClick={()=>setTab(t)} className={tab===t?"selected":""}>{t==="letter"?"Cover letter":t==="match"?"Job match":t[0].toUpperCase()+t.slice(1)}</button>)}</div>
 {!bundle?<div className="empty-state"><div className="empty-illustration"><FileText size={38}/><span><Sparkles size={18}/></span></div><h3>Your next chapter starts here.</h3><p>Add the role and your background.<br/>We’ll help you connect the dots.</p><div className="empty-features"><span><Check size={14}/> Tailored resume</span><span><Check size={14}/> Match report</span><span><Check size={14}/> Interview prep</span></div><button className="quiet" onClick={loadDemo}>See how it works <ArrowUpRight size={14}/></button></div>:
 <div className="result-body">
 {demo&&<div className="sample-banner">Fictional sample profile · demonstration only</div>}
 {r?.experience.some(e=>e.basis==="illustrative")&&<div className="sample-banner">Review generated project details before applying. Keep only work you have completed.</div>}
 {tab==="resume"&&r&&<><div className="preview-tools"><select aria-label="Resume layout" value={style} onChange={e=>setStyle(e.target.value as Style)}>{styles.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><button className="quiet" onClick={()=>{setJson(JSON.stringify(r,null,2));setEditing(true);}}>Edit draft <Plus size={14}/></button></div>
 <article id="print-resume" className={"resume-paper "+style}>{demo&&<div className="print-label">FICTIONAL DEMONSTRATION — NOT AN APPLICATION</div>}<header className="resume-header">{style==="modern"&&resultPhoto&&<img src={resultPhoto} alt={resultProfile.name}/>}<div><h2>{resultProfile.name}</h2><p className="role">{r.targetRole}</p><p className="contact">{[resultProfile.email,resultProfile.phone,resultProfile.location,resultProfile.links].filter(Boolean).join(" · ")}</p></div></header>
 <section><h3>Professional summary</h3><p>{r.summary}</p></section>{r.skills.length>0&&<section><h3>Skills</h3><p>{r.skills.join(" · ")}</p></section>}
 {r.experience.length>0&&<section><h3>Experience</h3>{r.experience.map((e,i)=><div className="resume-job" key={i}><div><strong>{e.title}</strong><span>{e.dates}</span></div>{e.organization&&<p className="company">{e.organization}</p>}<ul>{e.bullets.map((b,j)=><li key={j}>{b.text}</li>)}</ul></div>)}</section>}
 {r.education.length>0&&<section><h3>Education</h3>{r.education.map((s,i)=><p key={i}>{s}</p>)}</section>}
 {r.certifications.length>0&&<section><h3>Certifications</h3>{r.certifications.map((s,i)=><p key={i}>{s}</p>)}</section>}</article>
 <label className="checkbox-row review"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/><span>I have reviewed the draft and checked its claims.</span></label>
 <div className="exports"><button disabled={!reviewed} className="secondary" onClick={()=>window.print()}><Download size={15}/> PDF / Print</button><button disabled={!reviewed} className="secondary" onClick={()=>void exportDocx(r,resultProfile,demo).catch(message)}><Download size={15}/> Word (ATS)</button><button disabled={!reviewed} className="quiet" onClick={exportText}>Text</button></div><p className="privacy">PDF uses the selected layout. Word and text use a clean ATS layout. Page count depends on content; Compact reduces spacing.</p></>}
 {tab==="match"&&analysis&&<><div className="score-card"><div className="score">{score}<small>%</small></div><div><h3>Evidence coverage</h3><p>Supported = 1 · partial = 0.5 · missing = 0.<br/>A drafting aid, not an ATS score or hiring probability.</p></div></div>{analysis.requirements.map((q,i)=><div className="requirement" key={i}><div><strong>{q.requirement}</strong><span className={"status "+q.status}>{q.status}</span></div>{q.evidence&&<blockquote>{q.evidence}</blockquote>}<p>{q.recommendation}</p></div>)}<h3>Strengthen your brief</h3>{analysis.questions.map((q,i)=><p key={i} className="question">{q}</p>)}<p className="privacy">Add answers to Your experience, then generate again.</p>{bundle.warnings.map((w,i)=><div className="warning" key={i}>{w}</div>)}</>}
 {tab==="letter"&&<><h3>A tailored introduction</h3><textarea className="letter-editor" aria-label="Cover letter" rows={18} value={bundle.coverLetter} onChange={e=>{setBundle({...bundle,coverLetter:e.target.value});setReviewed(false);}}/><label className="checkbox-row"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/><span>I have reviewed these claims.</span></label><button disabled={!reviewed} className="secondary" onClick={()=>download(new Blob([(demo?"FICTIONAL DEMONSTRATION\n\n":"")+bundle.coverLetter],{type:"text/plain"}),"cover-letter.txt")}>Download letter</button></>}
 {tab==="interview"&&<><h3>Walk in prepared.</h3><p className="muted">Use real examples to turn these prompts into your own answers.</p>{bundle.interviewPrep.map((q,i)=><div className="interview-card" key={i}><span>0{i+1}</span><h4>{q.question}</h4><p>{q.guidance}</p></div>)}</>}
 {tab==="examples"&&<><h3>Practice, then build evidence.</h3><p className="muted">These are hypothetical ideas, not claims of completed work. They are excluded from resume exports.</p>{bundle.hypotheticalExamples.length?bundle.hypotheticalExamples.map((q,i)=><div className="interview-card" key={i}><span>FICTIONAL PRACTICE EXAMPLE</span><h4>{q.title}</h4><p>{q.description}</p></div>):<div className="tip">Enable relevant freelance/project experience in Preferences to generate examples.</div>}</>}
 </div>}</section></div>
 <footer><span>Built to present your strongest supported story.</span><button className="quiet" onClick={()=>{localStorage.removeItem("resume-studio-draft");setNotice("Saved draft cleared from this device.");}}>Clear saved draft</button></footer>
 </main>
 {notice&&<div className="toast" role="status">{notice}<button onClick={()=>setNotice("")} aria-label="Dismiss"><X size={15}/></button></div>}
 {error&&<div className="error-toast" role="alert">{error}<button onClick={()=>setError("")} aria-label="Dismiss"><X size={15}/></button></div>}
 {accessOpen&&<div className="modal-overlay"><div className="modal"><button className="close" onClick={()=>setAccessOpen(false)} aria-label="Close"><X/></button><LockKeyhole size={28}/><h2>Unlock your workspace</h2><p>Enter the access password configured for this deployment.</p><label className="field"><span>Access password</span><input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void unlock();}}/></label><button className="primary" onClick={()=>void unlock()}>Unlock AI</button><p className="privacy">Owner setup: APP_ACCESS_PASSWORD and OpenRouter, Gemini or OpenAI API keys in Vercel. You can explore the sample without credentials.</p>{unlocked&&<button className="quiet" onClick={()=>{void fetch("/api/access",{method:"DELETE"});setUnlocked(false);setAccessOpen(false);}}>Lock workspace</button>}</div></div>}
 {editing&&<div className="modal-overlay"><div className="modal editor-modal"><button className="close" onClick={()=>setEditing(false)} aria-label="Close"><X/></button><h2>Edit your draft</h2><p>Edit the text fields below. Keep the JSON structure and evidence quotes intact.</p><textarea rows={22} value={json} onChange={e=>setJson(e.target.value)} aria-label="Resume JSON editor"/><button className="primary" onClick={saveEdits}>Save changes</button></div></div>}
 </div>;
}
