import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { compatible, orderModels, discoverModels, type CatalogModel } from "../lib/model-catalog.ts";
import { runWithFallback, ResumeGenerationError, generationMessage } from "../lib/model-fallback.ts";

const schema=z.object({summary:z.string().min(1)});
const model=(id:string, released=1):CatalogModel=>({id,type:"language",tags:["structured-output"],modalities:{input:["text"],output:["text"]},context_window:131072,max_tokens:8192,released});
test("catalog filters incompatible modalities, output and context limits",()=>{
 assert.ok(compatible(model("test/good")));
 assert.ok(!compatible({...model("test/image"),modalities:{input:["text"],output:["text","image"]}}));
 assert.ok(!compatible({...model("test/no-schema"),tags:[]}));
 assert.ok(!compatible({...model("test/small"),context_window:8000}));
 assert.ok(!compatible({...model("test/short"),max_tokens:4000}));
});
test("all compatible models follow preferred IDs in deterministic order; explicit list restricts candidates",()=>{
 const catalog=[model("test/old",1),model("test/new",2),model("google/gemini-3.8-flash"),model("openai/gpt-6-luna-fast")];
 assert.deepEqual(orderModels(catalog),["openai/gpt-6-luna-fast","google/gemini-3.8-flash","test/new","test/old"]);
 assert.deepEqual(orderModels(catalog,"test/custom"," test/b, test/b,test/c "),["test/custom","test/b","test/c"]);
 assert.throws(()=>orderModels(catalog,"invalid"));
});
test("catalog outage uses a compatible snapshot without requiring credentials",async()=>{
 const models=await discoverModels(async()=>{throw new Error("offline");});
 assert.ok(models.length>6); assert.ok(models.every(compatible));
});
test("rate limit, invalid JSON shape and missing models fall back in order",async()=>{
 const calls:string[]=[];
 const result=await runWithFallback({models:["a","a","b","c","d"],signal:new AbortController().signal,budgetMs:1000,validate:x=>schema.parse(x),
 run:async m=>{calls.push(m);if(m==="a")throw {statusCode:429};if(m==="b")return {wrong:"shape"};if(m==="c")throw {statusCode:404};return {summary:"Valid resume"};}});
 assert.deepEqual(calls,["a","b","c","d"]);assert.equal(result.model,"d");assert.equal(result.attempts,4);
 assert.equal(result.output.summary,"Valid resume");
});
test("authentication, access and credit failures never call another model",async()=>{
 for(const error of [{statusCode:401},{statusCode:403},{cause:{statusCode:402}},{message:"Gateway budget exhausted"}]) {
  let calls=0;
  await assert.rejects(runWithFallback({models:["a","b"],signal:new AbortController().signal,budgetMs:1000,validate:x=>x,run:async()=>{calls++;throw error;}}),ResumeGenerationError);
  assert.equal(calls,1);
 }
});
test("per-attempt timeout escapes even an uncooperative transport",async()=>{
 const result=await runWithFallback({models:["slow","backup"],signal:new AbortController().signal,budgetMs:1000,attemptMs:10,validate:x=>schema.parse(x),
 run:async m=>m==="slow"?new Promise(resolve=>setTimeout(()=>resolve({summary:"Late"}),60)):{summary:"Backup"}});
 assert.equal(result.model,"backup");
});
test("cancelled requests never start another attempt",async()=>{
 const controller=new AbortController();let calls=0;
 await assert.rejects(runWithFallback({models:["a","b"],signal:controller.signal,budgetMs:1000,validate:x=>x,run:async()=>{calls++;controller.abort();throw new Error("provider failed");}}));
 assert.equal(calls,1);
});
test("stage deadline and exhausted candidates return safe actionable errors",async()=>{
 let tick=0;let calls=0;
 await assert.rejects(runWithFallback({models:["a","b"],signal:new AbortController().signal,budgetMs:50,now:()=>tick,validate:x=>x,run:async()=>{calls++;tick=51;throw new Error("provider failed");}}),e=>e instanceof ResumeGenerationError&&e.code==="timeout");
 assert.equal(calls,1);
 await assert.rejects(runWithFallback({models:["a"],signal:new AbortController().signal,budgetMs:1000,validate:x=>x,run:async()=>{throw new Error("private upstream text");}}),e=>e instanceof ResumeGenerationError&&e.code==="exhausted");
 assert.ok(!generationMessage(new Error("private upstream text")).includes("private upstream"));
});
