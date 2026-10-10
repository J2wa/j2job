import {z} from "zod";
import {profileSchema,resumeSchema,resumeRequirementGaps,type Profile,type Resume,type Analysis} from "./resume-schema.ts";
const regenerationSchema=z.object({
 previousResume:resumeSchema,
 gaps:z.array(z.object({requirement:z.string().min(1).max(2000),recommendation:z.string().max(4000)})).max(100),
});
export const generationRequestSchema=profileSchema.and(z.object({regeneration:regenerationSchema.optional()}));
export type GenerationRequest=z.infer<typeof generationRequestSchema>;
export function gapRegenerationRequest(profile:Profile,resume:Resume,analysis:Analysis):GenerationRequest {
 const uncovered=new Set(resumeRequirementGaps(resume,analysis));
 return {...profile,hypothetical:true,regeneration:{previousResume:resume,gaps:analysis.requirements
  .filter(item=>item.status!=="supported"||uncovered.has(item.requirement))
  .map(item=>({requirement:item.requirement,recommendation:item.recommendation}))}};
}
