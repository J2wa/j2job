import { z } from "zod";
const text = z.string().max(12000);
export const profileSchema = z.object({
 aiProvider:z.enum(["auto","gateway","openrouter","gemini","openai"]).optional(),
 aiModel:z.string().max(200).optional(),
 providerFallback:z.boolean().optional(),
 name: z.string().min(2).max(120), email: z.string().max(200), phone: z.string().max(80),
 location: z.string().max(160), links: z.string().max(500), experience: text,
 education: text, certifications: text, skills: text, resumeText: z.string().max(45000),
 jobDescription: z.string().min(40).max(25000),
 tone: z.enum(["Professional","Confident","Concise"]), length: z.enum(["Focused","Detailed"]),
 hypothetical: z.boolean(),
}).refine(p => (p.experience + p.resumeText).trim().length >= 30, "Add your experience or an existing resume (at least 30 characters).");
export type Profile = z.infer<typeof profileSchema>;
const bullet = z.object({ text: z.string(), evidence: z.string().describe("Exact quote from candidate source supporting the entire claim.") });
export const resumeSchema = z.object({
 targetRole: z.string(), summary: z.string(), skills: z.array(z.string()),
 experience: z.array(z.object({title:z.string(),organization:z.string(),dates:z.string(),bullets:z.array(bullet)})),
 education: z.array(z.string()), certifications: z.array(z.string()),
});
export const analysisSchema = z.object({
 role:z.string(), requirements:z.array(z.object({
 requirement:z.string(), status:z.enum(["supported","partial","missing"]),
 evidence:z.string(), recommendation:z.string(),
 })), questions:z.array(z.string()),
});
export const bundleSchema = z.object({
 resume:resumeSchema, coverLetter:z.string(),
 interviewPrep:z.array(z.object({question:z.string(), guidance:z.string()})),
 hypotheticalExamples:z.array(z.object({title:z.string(),description:z.string()})),
 warnings:z.array(z.string()),
});
export type Bundle = z.infer<typeof bundleSchema>;
export type Analysis = z.infer<typeof analysisSchema>;
export type Resume = z.infer<typeof resumeSchema>;
export function sources(p:Profile) { return [p.experience,p.education,p.certifications,p.skills,p.resumeText].join("\n"); }
export function evidenceExists(quote:string, source:string) {
 return quote.trim().length>=8 && source.toLowerCase().replace(/\s+/g," ").includes(quote.trim().toLowerCase().replace(/\s+/g," "));
}
export function cleanBundle(bundle:Bundle, source:string, hypothetical:boolean):Bundle {
 const removed:string[]=[];
 const resume={...bundle.resume,experience:bundle.resume.experience.map(e=>({...e,bullets:e.bullets.filter(b=>{
  const ok=evidenceExists(b.evidence,source); if(!ok) removed.push(b.text); return ok;
 })})).filter(e=>e.bullets.length)};
 return {...bundle,resume,hypotheticalExamples:hypothetical?bundle.hypotheticalExamples:[],
  warnings:[...bundle.warnings,...(removed.length?[removed.length+" bullet(s) removed because their quoted evidence could not be found."]:[])]};
}
export function coverage(a:Analysis) {
 return a.requirements.length?Math.round(100*a.requirements.reduce((n,r)=>n+(r.status==="supported"?1:r.status==="partial"?.5:0),0)/a.requirements.length):0;
}
export function plainResume(r:Resume,p:Pick<Profile,"name"|"email"|"phone"|"location"|"links">) {
 return [p.name,[p.email,p.phone,p.location,p.links].filter(Boolean).join(" | "),r.targetRole,
 "SUMMARY",r.summary,"SKILLS",r.skills.join(", "),"EXPERIENCE",
 ...r.experience.flatMap(e=>[[e.title,e.organization,e.dates].filter(Boolean).join(" | "),...e.bullets.map(b=>"• "+b.text)]),
 ...(r.education.length?["EDUCATION",...r.education]:[]),...(r.certifications.length?["CERTIFICATIONS",...r.certifications]:[])].join("\n");
}
