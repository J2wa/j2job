import type { Profile, Resume } from "./resume-schema";
export function download(blob:Blob,name:string) {const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function exportDocx(r:Resume,p:Profile,demo:boolean) {
 const { Document, Packer, Paragraph, TextRun, HeadingLevel }=await import("docx");
 const heading=(s:string)=>new Paragraph({text:s,heading:HeadingLevel.HEADING_2,spacing:{before:220,after:100}});
 const doc=new Document({sections:[{children:[
 ...(demo?[new Paragraph({text:"FICTIONAL DEMONSTRATION — NOT AN APPLICATION",heading:HeadingLevel.HEADING_2})]:[]),
 new Paragraph({children:[new TextRun({text:p.name,bold:true,size:40})]}),
 new Paragraph([p.email,p.phone,p.location,p.links].filter(Boolean).join(" | ")),
 new Paragraph({text:r.targetRole,spacing:{after:200}}),
 heading("Professional Summary"),new Paragraph(r.summary),heading("Skills"),new Paragraph(r.skills.join(", ")),
 heading("Experience"),...r.experience.flatMap(e=>[
 new Paragraph({children:[new TextRun({text:[e.title,e.organization,e.dates].filter(Boolean).join(" | "),bold:true})]}),
 ...e.bullets.map(b=>new Paragraph({text:b.text,bullet:{level:0}}))]),
 ...(r.education.length?[heading("Education"),...r.education.map(s=>new Paragraph(s))]:[]),
 ...(r.certifications.length?[heading("Certifications"),...r.certifications.map(s=>new Paragraph(s))]:[])
 ]}],styles:{default:{document:{run:{font:"Calibri",size:22}}}}});
 download(await Packer.toBlob(doc),"resume.docx");
}
