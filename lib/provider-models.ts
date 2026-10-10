import {createHash} from "node:crypto";
import {discoverModels,type CatalogModel} from "./model-catalog.ts";
import {discoverOpenRouterModels,orderOpenRouterModels,selectProvider} from "./openrouter.ts";
import {geminiModels} from "./gemini.ts";
import {providerKeys,providerEnabled,type Provider} from "./api-keys.ts";
import {orderModels} from "./model-catalog.ts";
import {ResumeGenerationError} from "./model-fallback.ts";
export const providers:Provider[]=["gateway","openrouter","gemini","openai"];
export const providerNames:Record<Provider,string>={gateway:"Vercel AI Gateway",openrouter:"OpenRouter",gemini:"Google Gemini API",openai:"OpenAI"};
export function normalizeGemini(data:unknown):CatalogModel[] {
 if(!Array.isArray(data))return [];
 return data.flatMap(m=>{
  const id=typeof m?.name==="string"?m.name.replace(/^models\//,""):"";
  if(!/^gemini-[a-zA-Z0-9.-]+$/.test(id)||!/flash|pro/.test(id)||/image|tts|audio|live|robotics|computer-use|transcribe/.test(id)
   ||!m.supportedGenerationMethods?.includes("generateContent")||!(m.inputTokenLimit>=65536)||!(m.outputTokenLimit>=8192))return [];
  return [{id,type:"language",tags:["structured-output"],modalities:{input:["text"],output:["text"]},context_window:m.inputTokenLimit,max_tokens:m.outputTokenLimit}];
 });
}
export function normalizeOpenAI(data:unknown,capabilities:CatalogModel[]) {
 if(!Array.isArray(data))return [];
 const ids=new Set(data.map(x=>x?.id).filter((x):x is string=>typeof x==="string"));
 return capabilities.filter(m=>m.id.startsWith("openai/")).map(m=>({...m,id:m.id.slice(7)}))
  .filter(m=>ids.has(m.id)&&!/(codex|safeguard|-(pro|fast)$)/.test(m.id));
}
const cache=new Map<string,{models:CatalogModel[];expires:number;source:string}>();
export async function discoverNative(provider:"gemini"|"openai",fetcher:typeof fetch=fetch) {
 const keys=providerKeys(provider);
 const fingerprint=createHash("sha256").update(provider+JSON.stringify(keys)).digest("hex");
 const cached=cache.get(fingerprint);
 if(cached && cached.expires>Date.now())return cached;
 const capability=provider==="openai"?await discoverModels():[];
 const results=await Promise.allSettled(keys.map(async key=>{
  const signal=AbortSignal.timeout(7000);
  const rows:unknown[]=[];
  let pageToken="";
  do {
   const url=provider==="openai"?"https://api.openai.com/v1/models":"https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000"+(pageToken?"&pageToken="+encodeURIComponent(pageToken):"");
   const response=await fetcher(url,{signal,cache:"no-store",headers:provider==="openai"?{Authorization:"Bearer "+key}:{"x-goog-api-key":key}});
   if(!response.ok)throw new Error("Model discovery failed");
   const body=await response.json();
   rows.push(...(provider==="openai"?body.data??[]:body.models??[]));
   pageToken=provider==="gemini"&&typeof body.nextPageToken==="string"?body.nextPageToken:"";
  }while(pageToken);
  return provider==="gemini"?normalizeGemini(rows):normalizeOpenAI(rows,capability);
 }));
 const live=results.flatMap(r=>r.status==="fulfilled"?r.value:[]);
 const fallback:CatalogModel[]=provider==="gemini"?geminiModels().map(id=>({id,type:"language",tags:["structured-output"],modalities:{input:["text"],output:["text"]}})):capability.filter(m=>m.id.startsWith("openai/")&&!/(codex|safeguard|-(pro|fast)$)/.test(m.id)).map(m=>({...m,id:m.id.slice(7)}));
 const result={models:[...new Map((live.length?live:cached?.models??fallback).map(m=>[m.id,m])).values()],expires:Date.now()+(live.length?3600000:60000),source:live.length?"live":"cached fallback"};
 if(cache.size>=20)cache.clear();cache.set(fingerprint,result);return result;
}
export async function catalogFor(provider:Provider) {
 if(provider==="gemini"||provider==="openai")return discoverNative(provider);
 return {models:await (provider==="gateway"?discoverModels():discoverOpenRouterModels()),source:"provider catalog"};
}
export function modelOrder(provider:Provider,catalog:CatalogModel[]) {
 if(provider==="gateway")return orderModels(catalog,process.env.RESUME_MODEL,process.env.RESUME_FALLBACK_MODELS);
 if(provider==="openrouter")return orderOpenRouterModels(catalog,process.env.OPENROUTER_MODEL,process.env.OPENROUTER_FALLBACK_MODELS);
 if(provider==="gemini"){
  const configured=geminiModels(process.env.GEMINI_MODEL,process.env.GEMINI_FALLBACK_MODELS);
  return process.env.GEMINI_FALLBACK_MODELS?.trim()?configured:[...new Set([...configured,...catalog.map(m=>m.id).sort().reverse()])];
 }
 const normalize=(s:string)=>s.trim().replace(/^openai\//,"");
 const configured=[process.env.OPENAI_MODEL??"",...(process.env.OPENAI_FALLBACK_MODELS?.split(",")??[])].map(normalize).filter(Boolean);
 if(configured.some(id=>! /^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(id)))throw new ResumeGenerationError("configuration");
 const rest=process.env.OPENAI_FALLBACK_MODELS?.trim()?[]:catalog.toSorted((a,b)=>(b.released??0)-(a.released??0)||a.id.localeCompare(b.id)).map(m=>m.id);
 return [...new Set([...configured,...rest])];
}
export function selectedModelOrder(selected:string|undefined,order:string[],catalog:CatalogModel[]) {
 if(!selected)return order;
 if(!order.includes(selected)||!catalog.some(m=>m.id===selected))throw new ResumeGenerationError("configuration");
 return [selected,...order.filter(id=>id!==selected)];
}
export function providerOrder(choice:string|undefined,allowFallback:boolean) {
 const primary=selectProvider(choice);
 return allowFallback?[primary,...providers.filter(p=>p!==primary&&providerEnabled(p))]:[primary];
}
