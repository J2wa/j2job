import { ResumeGenerationError } from "./model-fallback.ts";
// Current text models verified against Google's model documentation on 2026-10-11.
export function geminiModels(primary?:string, fallbacks?:string) {
  const normalize=(id:string)=>id.trim().replace(/^(models\/|google\/)/,"");
  const models=[...(primary?.trim()?[normalize(primary)]:[]),
    ...(fallbacks?.trim()?fallbacks.split(",").map(normalize):["gemini-3.8-flash","gemini-3.6-flash","gemini-3.5-flash-lite"])];
  if (models.some(id=>!/^gemini-[a-zA-Z0-9.-]+$/.test(id))) throw new ResumeGenerationError("configuration");
  return [...new Set(models)];
}
