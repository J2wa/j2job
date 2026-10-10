import {test} from "node:test";
import assert from "node:assert/strict";
import {z} from "zod";
import {geminiModels} from "../lib/gemini.ts";
import {selectProvider,generateOpenRouter} from "../lib/openrouter.ts";
import {runWithFallback,ResumeGenerationError,generationMessage} from "../lib/model-fallback.ts";
test("native Gemini keys and explicit selection use the Google provider",()=>{
 assert.equal(selectProvider("auto",{GEMINI_API_KEY:"test"}),"gemini");
 assert.equal(selectProvider("auto",{GOOGLE_GENERATIVE_AI_API_KEY:"test"}),"gemini");
 assert.equal(selectProvider("gemini",{AI_GATEWAY_API_KEY:"test"}),"gemini");
 assert.equal(selectProvider("auto",{RESUME_PROVIDER:"gemini",OPENROUTER_API_KEY:"test"}),"gemini");
 assert.deepEqual(geminiModels("google/gemini-3.8-flash","models/gemini-3.6-flash"),["gemini-3.8-flash","gemini-3.6-flash"]);
 assert.throws(()=>geminiModels("https://example.com"),ResumeGenerationError);
});
test("Gemini request uses native key at Google's compatible endpoint without OpenRouter routing fields",async()=>{
 const result=await generateOpenRouter({provider:"gemini",apiKey:"test-google-key",model:"gemini-3.8-flash",schema:z.object({summary:z.string()}),signal:new AbortController().signal,system:"Rules",prompt:"Background",fetcher:async(url,init)=>{
  assert.equal(url,"https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
  assert.equal(new Headers(init?.headers).get("Authorization"),"Bearer test-google-key");
  const body=JSON.parse(init?.body as string);assert.ok(!body.provider);
  assert.equal(body.reasoning_effort,"low");assert.equal(body.response_format.type,"json_schema");
  return Response.json({choices:[{finish_reason:"stop",message:{content:'{"summary":"Supported resume"}'}}]});
 }});
 assert.deepEqual(result,{summary:"Supported resume"});
});
test("Google invalid-key HTTP 400 is terminal and not retried across models",async()=>{
 let calls=0;
 await assert.rejects(runWithFallback({models:geminiModels(),signal:new AbortController().signal,budgetMs:1000,validate:x=>x,run:(model,signal)=>generateOpenRouter({provider:"gemini",apiKey:"invalid-test-key",model,signal,system:"",prompt:"",schema:z.object({summary:z.string()}),fetcher:async()=>{
  calls++;return Response.json({error:{details:[{reason:"API_KEY_INVALID"}]}},{status:400});
 }})}),e=>e instanceof ResumeGenerationError&&e.code==="access");
 assert.equal(calls,1);
});
test("exhausted-model message exposes safe quota diagnosis and no upstream content",async()=>{
 try {
  await runWithFallback({models:["model"],signal:new AbortController().signal,budgetMs:1000,validate:x=>x,run:async()=>{throw {statusCode:429,message:"sensitive details"};}});
  assert.fail("Should reject");
 }catch(error){const message=generationMessage(error,"Gemini");assert.ok(message.includes("quota"));assert.ok(!message.includes("sensitive"));}
});
