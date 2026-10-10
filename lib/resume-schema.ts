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
const bullet = z.object({ text: z.string(), evidence: z.string().describe("Exact quote from candidate source supporting the entire claim; empty only for illustrative draft experience.") });
export const resumeSchema = z.object({
 targetRole: z.string(), summary: z.string(), skills: z.array(z.string()),
 experience: z.array(z.object({title:z.string(),organization:z.string(),dates:z.string(),basis:z.enum(["provided","illustrative"]).optional(),matchedRequirements:z.array(z.string()).optional().describe("Exact requirement strings from the job analysis that this role demonstrates. Empty for an unrelated role."),bullets:z.array(bullet)})),
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
// Generated output must include metadata. The editor schema accepts older saved drafts.
export const generationBundleSchema=bundleSchema.extend({resume:resumeSchema.extend({experience:z.array(resumeSchema.shape.experience.element.extend({
 basis:z.enum(["provided","illustrative"]),
 matchedRequirements:z.array(z.string()).describe("Exact job-analysis requirement strings demonstrated by this role."),
}))})});
export type Bundle = z.infer<typeof bundleSchema>;
export type Analysis = z.infer<typeof analysisSchema>;
export type Resume = z.infer<typeof resumeSchema>;
export function sources(p:Profile) { return [p.experience,p.education,p.certifications,p.skills,p.resumeText].join("\n"); }
export function evidenceExists(quote:string, source:string) {
 return quote.trim().length>=8 && source.toLowerCase().replace(/\s+/g," ").includes(quote.trim().toLowerCase().replace(/\s+/g," "));
}
export function cleanBundle(bundle:Bundle, source:string, hypothetical:boolean, analysis?:Analysis):Bundle {
 const removed:string[]=[];
 let unrelated=0;
 const requirements=new Set(analysis?.requirements.map(r=>r.requirement.trim().toLowerCase()));
 const relevant=bundle.resume.experience.filter(e=>{
  if(!analysis)return true;
  const ok=e.matchedRequirements?.some(r=>requirements.has(r.trim().toLowerCase()));
  if(!ok)unrelated++;
  return ok;
 });
 const resume={...bundle.resume,experience:relevant.map(e=>{
  const illustrative=e.basis==="illustrative";
  const bullets=e.bullets.filter(b=>{
   const ok=illustrative?hypothetical:evidenceExists(b.evidence,source);
   if(!ok)removed.push(b.text);
   return ok;
  });
  // Fictional drafts use generic project headings, never fabricated real employers or dates.
  return {...e,organization:illustrative?(e.organization==="Freelance"?"Freelance":"Confidential Project"):e.organization,
   dates:illustrative?"":e.dates,bullets};
 }).filter(e=>e.bullets.length)};
 const hasIllustrative=resume.experience.some(e=>e.basis==="illustrative");
 return {...bundle,resume,hypotheticalExamples:hypothetical?bundle.hypotheticalExamples:[],
  warnings:[...bundle.warnings,
   ...(unrelated?[unrelated+" role(s) omitted because they did not map to a job requirement."]:[]),
   ...(removed.length?[removed.length+" bullet(s) removed because their quoted evidence could not be found or illustrative mode is off."]:[]),
   ...(hasIllustrative?["Review generated project details and use only work you have actually completed in an application."]:[])]};
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
