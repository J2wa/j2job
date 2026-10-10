import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { selectProvider, normalizeOpenRouterModels, orderOpenRouterModels, generateOpenRouter } from "../lib/openrouter.ts";
import { runWithFallback, ResumeGenerationError } from "../lib/model-fallback.ts";
const schema=z.object({summary:z.string()});
const signal=()=>new AbortController().signal;
const json=(body:unknown,status=200)=>Response.json(body,{status});
test("provider selection respects form, workspace default and available credentials",()=>{
 assert.equal(selectProvider("auto",{OPENROUTER_API_KEY:"test"}),"openrouter");
 assert.equal(selectProvider(undefined,{OPENROUTER_API_KEY:"test",AI_GATEWAY_API_KEY:"test"}),"gateway");
 assert.equal(selectProvider("auto",{OPENROUTER_API_KEY:"test",VERCEL_OIDC_TOKEN:"test"}),"gateway");
 assert.equal(selectProvider("auto",{RESUME_PROVIDER:"openrouter",AI_GATEWAY_API_KEY:"test"}),"openrouter");
 assert.equal(selectProvider("gateway",{RESUME_PROVIDER:"openrouter"}),"gateway");
 assert.equal(selectProvider("openrouter",{}),"openrouter");
 assert.throws(()=>selectProvider("auto",{RESUME_PROVIDER:"unknown"}),ResumeGenerationError);
});
test("OpenRouter catalog excludes batch, non-structured, image and undersized models",()=>{
 const entry={id:"test/valid",supported_parameters:["structured_outputs"],architecture:{input_modalities:["text"],output_modalities:["text"]},context_length:131072,top_provider:{max_completion_tokens:8192}};
 const models=normalizeOpenRouterModels([entry,{...entry,id:"test/valid:batch"},{...entry,id:"test/image",architecture:{...entry.architecture,output_modalities:["text","image"]}},{...entry,id:"test/no-json",supported_parameters:[]},{...entry,id:"test/short",context_length:8000}]);
 assert.deepEqual(models.map(m=>m.id),["test/valid"]);
 assert.deepEqual(orderOpenRouterModels(models,"test/custom","test/backup,test/backup"),["test/custom","test/backup"]);
});
test("OpenRouter request targets only its endpoint with strict schema and abort signal",async()=>{
 const abortSignal=signal();
 const fetcher:typeof fetch=async(url,init)=>{
  assert.equal(url,"https://openrouter.ai/api/v1/chat/completions");
  assert.equal(init?.signal,abortSignal);
  assert.equal(new Headers(init?.headers).get("Authorization"),"Bearer test-key");
  const body=JSON.parse(init?.body as string);
  assert.equal(body.model,"test/model");
  assert.equal(body.response_format.type,"json_schema");
  assert.equal(body.response_format.json_schema.strict,true);
  assert.equal(body.response_format.json_schema.schema.additionalProperties,false);
  assert.deepEqual(body.provider,{require_parameters:true});
  assert.equal(body.stream,false);
  return json({choices:[{finish_reason:"stop",message:{content:JSON.stringify({summary:"Resume"})}}]});
 };
 assert.deepEqual(await generateOpenRouter({model:"test/model",system:"Rules",prompt:"Background",schema,signal:abortSignal,apiKey:"test-key",fetcher}),{summary:"Resume"});
});
test("OpenRouter HTTP failures and malformed JSON retry with the next model",async()=>{
 let calls=0;
 const result=await runWithFallback({models:["a","b","c"],signal:signal(),budgetMs:1000,validate:x=>schema.parse(x),run:(model,abortSignal)=>generateOpenRouter({model,signal:abortSignal,system:"",prompt:"",schema,apiKey:"test-key",fetcher:async()=>{
  calls++;if(calls===1)return json({},429);
  return json({choices:[{message:{content:calls===2?"broken JSON":'{"summary":"Valid"}'}}]});
 }})});
 assert.equal(result.model,"c");assert.equal(calls,3);
});
test("OpenRouter missing key, denied access and payment errors stop without leaking response text",async()=>{
 await assert.rejects(generateOpenRouter({model:"a",signal:signal(),system:"",prompt:"",schema,apiKey:"",fetcher:async()=>{throw new Error("Must not call");}}));
 for (const status of [401,402,403]) {
  let calls=0;
  await assert.rejects(runWithFallback({models:["a","b"],signal:signal(),budgetMs:1000,validate:x=>x,run:(model,abortSignal)=>generateOpenRouter({model,signal:abortSignal,system:"",prompt:"",schema,apiKey:"test-key",fetcher:async()=>{calls++;return json({error:{message:"private upstream error"}},status);}})}),ResumeGenerationError);
  assert.equal(calls,1);
 }
});
test("HTTP 200 upstream errors, refusals and truncated outputs cannot become a resume",async()=>{
 for(const body of [{error:{code:402}},{choices:[{finish_reason:"length",message:{content:'{"summary":"Truncated"}'}}]},{choices:[{message:{refusal:"Refused",content:'{"summary":"Refused"}'}}]}]) {
  await assert.rejects(generateOpenRouter({model:"a",signal:signal(),system:"",prompt:"",schema,apiKey:"test-key",fetcher:async()=>json(body)}));
 }
});
