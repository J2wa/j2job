import { z } from "zod";
import { configuredModels, type CatalogModel } from "./model-catalog.ts";
import { ResumeGenerationError } from "./model-fallback.ts";
import { providerEnabled } from "./api-keys.ts";

export type ResumeProvider = "gateway" | "openrouter" | "gemini" | "openai";
export function selectProvider(choice: string | undefined, env: Record<string,string|undefined> = process.env): ResumeProvider {
  const selected = choice && choice !== "auto" ? choice : env.RESUME_PROVIDER ?? "auto";
  if (!["auto","gateway","openrouter","gemini","openai"].includes(selected)) throw new ResumeGenerationError("configuration");
  if (selected === "openai") return "openai";
  if (selected === "gemini") return "gemini";
  if (selected === "openrouter") return "openrouter";
  if (selected === "gateway") return "gateway";
  if (!providerEnabled("gateway",env)) {
    if (providerEnabled("openrouter",env)) return "openrouter";
    if (providerEnabled("gemini",env)) return "gemini";
    if (providerEnabled("openai",env)) return "openai";
  }
  return "gateway";
}
const preferred = ["openai/gpt-6-luna","anthropic/claude-haiku-5.5","google/gemini-3.8-flash","anthropic/claude-sonnet-5.5","deepseek/deepseek-v4.1-flash","openai/gpt-6.1-sol"];
// Metadata fetched from the OpenRouter catalog on 2026-10-11.
const snapshot: CatalogModel[] = [{"id":"openai/gpt-6-luna","type":"language","tags":["structured-output"],"modalities":{"input":["text"],"output":["text"]},"context_window":1050000,"max_tokens":128000,"released":1790100786},{"id":"anthropic/claude-haiku-5.5","type":"language","tags":["structured-output"],"modalities":{"input":["text"],"output":["text"]},"context_window":1000000,"max_tokens":128000,"released":1791397883},{"id":"google/gemini-3.8-flash","type":"language","tags":["structured-output"],"modalities":{"input":["text"],"output":["text"]},"context_window":1048576,"max_tokens":65536,"released":1788362056},{"id":"anthropic/claude-sonnet-5.5","type":"language","tags":["structured-output"],"modalities":{"input":["text"],"output":["text"]},"context_window":1000000,"max_tokens":128000,"released":1790618686},{"id":"deepseek/deepseek-v4.1-flash","type":"language","tags":["structured-output"],"modalities":{"input":["text"],"output":["text"]},"context_window":1048576,"max_tokens":943718,"released":1789021285},{"id":"openai/gpt-6.1-sol","type":"language","tags":["structured-output"],"modalities":{"input":["text"],"output":["text"]},"context_window":1050000,"max_tokens":128000,"released":1790702882}];
export function normalizeOpenRouterModels(data: unknown): CatalogModel[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap(m=>{
    if (!m || typeof m.id !== "string" || !/^[a-z0-9][a-z0-9.-]*\/[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(m.id) || m.id.includes(":batch")
      || !Array.isArray(m.supported_parameters) || !m.supported_parameters.includes("structured_outputs")
      || !m.architecture?.input_modalities?.includes("text") || !m.architecture?.output_modalities?.includes("text")
      || m.architecture.output_modalities.includes("image") || !(m.context_length >= 65536)
      || !(m.top_provider?.max_completion_tokens >= 8192)) return [];
    return [{id:m.id,type:"language",tags:["structured-output"],modalities:{input:["text"],output:["text"]},context_window:m.context_length,max_tokens:m.top_provider.max_completion_tokens,released:m.created}];
  });
}
let cached: { models: CatalogModel[]; expires: number } | undefined;
let pending: Promise<CatalogModel[]> | undefined;
export async function discoverOpenRouterModels(fetcher: typeof fetch = fetch): Promise<CatalogModel[]> {
  if (cached && cached.expires > Date.now()) return cached.models;
  if (pending) return pending;
  pending = (async()=>{
    try {
      const response=await fetcher("https://openrouter.ai/api/v1/models",{signal:AbortSignal.timeout(3000),cache:"no-store"});
      if (!response.ok) throw new Error("Catalog unavailable");
      const body=await response.json();
      const models=normalizeOpenRouterModels(body?.data);
      if (!models.length) throw new Error("No compatible models");
      cached={models,expires:Date.now()+3600000}; return models;
    } catch {
      const models=cached?.models ?? snapshot;
      cached={models,expires:Date.now()+60000}; return models;
    } finally {pending=undefined;}
  })();
  return pending;
}
export function orderOpenRouterModels(catalog: CatalogModel[], primary?: string, fallbacks?: string) {
  const configured=configuredModels(primary,fallbacks);
  if (fallbacks?.trim()) return configured;
  const available=new Set(catalog.map(m=>m.id));
  return [...new Set([...configured,...preferred.filter(id=>available.has(id)),...catalog.toSorted((a,b)=>(b.released??0)-(a.released??0)||a.id.localeCompare(b.id)).map(m=>m.id)])];
}
class OpenRouterError extends Error {
  statusCode: number;
  constructor(statusCode:number,provider="OpenRouter") {super(provider+" request failed");this.name="ModelProviderError";this.statusCode=statusCode;}
}
export async function generateOpenRouter<T>(options: {
  model: string; system: string; prompt: string; schema: z.ZodType<T>;
  signal: AbortSignal; apiKey?: string; fetcher?: typeof fetch;
  provider?: "openrouter" | "gemini" | "openai";
}): Promise<unknown> {
  const gemini=options.provider==="gemini";
  const openai=options.provider==="openai";
  const label=gemini?"Gemini":openai?"OpenAI":"OpenRouter";
  const apiKey=options.apiKey ?? (gemini?(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY):openai?process.env.OPENAI_API_KEY:process.env.OPENROUTER_API_KEY);
  if (!apiKey?.trim()) throw new OpenRouterError(401,label);
  const response=await (options.fetcher ?? fetch)(gemini?"https://generativelanguage.googleapis.com/v1beta/openai/chat/completions":openai?"https://api.openai.com/v1/chat/completions":"https://openrouter.ai/api/v1/chat/completions",{
    method:"POST",signal:options.signal,headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},
    body:JSON.stringify({model:options.model,stream:false,...(openai?{max_completion_tokens:8192}:{max_tokens:8192}),
      messages:[{role:"system",content:options.system},{role:"user",content:options.prompt}],
      ...(gemini?{reasoning_effort:"low"}:openai?{}:{provider:{require_parameters:true}}),
      response_format:{type:"json_schema",json_schema:{name:"resume_output",strict:true,schema:z.toJSONSchema(options.schema)}}}),
  });
  if (!response.ok) {
    // Gemini reports invalid API keys as HTTP 400, rather than always 401.
    if (gemini && response.status===400) {
      const error=await response.json().catch(()=>null);
      if (Array.isArray(error?.error?.details) && error.error.details.some((d:{reason?:string})=>d.reason==="API_KEY_INVALID")) throw new OpenRouterError(401,label);
    }
    throw new OpenRouterError(response.status,label);
  }
  const body=await response.json();
  if (body?.error) throw new OpenRouterError(typeof body.error.code==="number"?body.error.code:502);
  const choice=body?.choices?.[0];
  if (choice?.finish_reason==="length" || choice?.finish_reason==="error" || choice?.message?.refusal || typeof choice?.message?.content!=="string") throw new OpenRouterError(502);
  return JSON.parse(choice.message.content);
}
