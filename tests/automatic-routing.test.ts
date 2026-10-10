import {test} from "node:test";
import assert from "node:assert/strict";
import {automaticProviders,automaticModelOrder} from "../lib/provider-models.ts";
import {runAcrossProviders} from "../lib/model-fallback.ts";
import {profileSchema} from "../lib/resume-schema.ts";
import {demoProfile} from "../lib/demo.ts";
const signal=()=>new AbortController().signal;
test("automatic routing always follows OpenRouter, Gemini, OpenAI and skips missing keys",()=>{
 assert.deepEqual(automaticProviders({OPENAI_API_KEY:"o",GEMINI_API_KEY:"g",OPENROUTER_API_KEY:"r",AI_GATEWAY_API_KEY:"w",RESUME_PROVIDER:"gateway"}),["openrouter","gemini","openai"]);
 assert.deepEqual(automaticProviders({OPENAI_API_KEYS:"a,b",GEMINI_API_KEY:"g"}),["gemini","openai"]);
 assert.throws(()=>automaticProviders({AI_GATEWAY_API_KEY:"w"}));
 assert.deepEqual(automaticProviders({OPENAI_API_KEY:"o",GEMINI_API_KEY:"g",OPENROUTER_API_KEY:"r"},"gemini"),["gemini","openrouter","openai"]);
});
test("model controls remain available and automatic model order uses the catalog",()=>{
 const profile=profileSchema.parse({...demoProfile,aiProvider:"gateway",aiModel:"fake",providerFallback:false});
 assert.equal(profile.aiModel,"fake");
 assert.equal(profile.aiProvider,"gateway");
 assert.deepEqual(automaticModelOrder("openai",[{id:"latest",type:"language",released:2},{id:"older",type:"language",released:1}]),["latest","older"]);
});
test("provider models are exhausted in sequence and generation stops on first success",async()=>{
 const calls:string[]=[];
 const result=await runAcrossProviders({groups:[["openrouter|a","openrouter|b"],["gemini|a"],["openai|a"]],signal:signal(),budgetMs:1000,validate:x=>x,
 run:async id=>{calls.push(id);if(id.startsWith("openrouter"))throw {statusCode:404};return "resume";}});
 assert.equal(result.model,"gemini|a");assert.equal(result.attempts,3);
 assert.deepEqual(calls,["openrouter|a","openrouter|b","gemini|a"]);
});
test("a timed-out provider leaves time for Gemini and OpenAI",async()=>{
 const calls:string[]=[];
 const result=await runAcrossProviders({groups:[["openrouter|slow"],["gemini|bad"],["openai|working"]],signal:signal(),budgetMs:90,validate:x=>x,
 run:async id=>{calls.push(id);if(id.endsWith("slow"))return new Promise(resolve=>setTimeout(()=>resolve("late"),150));if(id.startsWith("gemini"))throw {statusCode:401};return "resume";}});
 assert.equal(result.model,"openai|working");assert.deepEqual(calls,["openrouter|slow","gemini|bad","openai|working"]);
});
test("cancelling generation never starts a backup provider",async()=>{
 const controller=new AbortController();const calls:string[]=[];
 await assert.rejects(runAcrossProviders({groups:[["openrouter|a"],["gemini|a"]],signal:controller.signal,budgetMs:1000,validate:x=>x,
 run:async id=>{calls.push(id);controller.abort();throw {statusCode:500};}}));
 assert.deepEqual(calls,["openrouter|a"]);
});

test("legacy environment model restrictions never narrow automatic candidates",()=>{
 const previous={OPENROUTER_MODEL:process.env.OPENROUTER_MODEL,OPENROUTER_FALLBACK_MODELS:process.env.OPENROUTER_FALLBACK_MODELS};
 try {
  process.env.OPENROUTER_MODEL="invalid-model";
  process.env.OPENROUTER_FALLBACK_MODELS="invalid-model";
  assert.deepEqual(automaticModelOrder("openrouter",[{id:"vendor/first",type:"language"},{id:"vendor/second",type:"language"}]),["vendor/first","vendor/second"]);
 }finally{for(const [key,value]of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
