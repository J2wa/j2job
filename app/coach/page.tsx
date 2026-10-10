"use client";
import { useEveAgent } from "eve/react";
import { useState } from "react";
export default function Coach(){
 const agent=useEveAgent(),[text,setText]=useState(""),[error,setError]=useState("");
 const busy=agent.status==="submitted"||agent.status==="streaming"||agent.status==="resuming";
 async function send(){if(!text.trim()||busy)return;const value=text;setText("");setError("");try{await agent.send(value);}catch(e){setError(e instanceof Error?e.message:"Unable to send.");}}
 return <div className="coach-shell"><a href="/">← Back to Resume Studio</a><h1>Career coach</h1><p>Unlock the workspace in the builder first. Paste your background and the role to discuss evidence gaps, resume wording, and interview preparation.</p><p className="privacy">Coach conversations use durable eve sessions. Everyone with the workspace password shares workspace access. Use this as a private personal app.</p>
 <div className="coach-conversation" aria-live="polite">{agent.data.messages.map(m=><div key={m.id} className={"coach-message "+m.role}><strong>{m.role==="user"?"You":"Career coach"}</strong>{m.parts.map((part,i)=>part.type==="text"?<p key={i}>{part.text}</p>:null)}</div>)}</div>
 {(error||agent.error)&&<p role="alert">{error||agent.error?.message}</p>}
 <label className="field"><span>Your question</span><textarea rows={4} value={text} onChange={e=>setText(e.target.value)} placeholder="How can I present my experience for this role?"/></label><button disabled={busy||!text.trim()} className="primary" onClick={()=>void send()}>{busy?"Working…":"Ask your coach"}</button>{busy&&<button className="quiet" onClick={()=>void agent.cancel()}>Stop</button>}
 </div>;
}
