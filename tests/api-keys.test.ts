import {test} from "node:test";
import assert from "node:assert/strict";
import {z} from "zod";
import {parseKeys,providerKeys,createKeyRunner} from "../lib/api-keys.ts";
import {normalizeGemini,normalizeOpenAI,selectedModelOrder} from "../lib/provider-models.ts";
import {runWithFallback} from "../lib/model-fallback.ts";
import {generateOpenRouter,selectProvider} from "../lib/openrouter.ts";
const signal=()=>new AbortController().signal;
test("key pools accept JSON, comma/newline values, deduplicate and stay provider-scoped",()=>{
 assert.deepEqual(parseKeys('["a"," b ","a"]',"c"),["a","b","c"]);
 assert.deepEqual(parseKeys("a,b\na","b"),["a","b"]);
 assert.throws(()=>parseKeys('[1]'));assert.throws(()=>parseKeys('['));
 assert.deepEqual(providerKeys("openai",{OPENAI_API_KEYS:'["one","two"]',GEMINI_API_KEY:"google"}),["one","two"]);
 assert.equal(selectProvider("auto",{OPENAI_API_KEYS:"one,two"}),"openai");
});
test("failed key rotates; a successful key is reused for later stages",async()=>{
 const run=createKeyRunner(["invalid","working"]);const calls:string[]=[];
 const call=async(key:string)=>{calls.push(key);if(key==="invalid")throw {statusCode:401};return "resume";};
 assert.equal(await run(call,signal()),"resume");assert.equal(await run(call,signal()),"resume");
 assert.deepEqual(calls,["invalid","working","working"]);
});
test("quota-exhausted keys are skipped for the request and status is preserved",async()=>{
 const run=createKeyRunner(["a","b"]);let calls=0;
 for(let i=0;i<2;i++)await assert.rejects(run(async()=>{calls++;throw {statusCode:429};},signal()),e=>(e as {statusCode:number;poolExhausted:boolean}).statusCode===429&&(e as {poolExhausted:boolean}).poolExhausted);
 assert.equal(calls,2);
});
test("model request errors move to another model rather than burning all keys",async()=>{
 const run=createKeyRunner(["a","b"]);let calls=0;
 await assert.rejects(run(async()=>{calls++;throw {statusCode:400};},signal()));assert.equal(calls,1);
 const abort=new AbortController();abort.abort();await assert.rejects(run(async()=>"bad",abort.signal));
});
test("a stuck key transport times out and the backup key runs",async()=>{
 const run=createKeyRunner(["slow","working"],10);
 const result=await run(async key=>key==="slow"?new Promise<string>(resolve=>setTimeout(()=>resolve("late"),60)):"resume",signal());
 assert.equal(result,"resume");
});
test("Gemini picker excludes non-text and undersized models; OpenAI intersects capabilities and access",()=>{
 const m={name:"models/gemini-3.8-flash",supportedGenerationMethods:["generateContent"],inputTokenLimit:1000000,outputTokenLimit:64000};
 const gemini=normalizeGemini([m,{...m,name:"models/gemini-3.8-flash-tts"},{...m,name:"models/gemini-3.8-flash-image"},{...m,name:"models/gemini-short",inputTokenLimit:2000}]);
 assert.deepEqual(gemini.map(x=>x.id),["gemini-3.8-flash"]);
 assert.deepEqual(normalizeOpenAI([{id:"gpt-6-luna"},{id:"gpt-6-sol-pro"}],gemini.concat([{id:"openai/gpt-6-luna",type:"language"},{id:"openai/gpt-6-sol-pro",type:"language"}])).map(x=>x.id),["gpt-6-luna"]);
 assert.deepEqual(selectedModelOrder("gemini-3.8-flash",["backup","gemini-3.8-flash"],gemini),["gemini-3.8-flash","backup"]);
 assert.throws(()=>selectedModelOrder("unavailable",["backup"],gemini));
});
test("account failure can fall back across providers while skipping exhausted provider models",async()=>{
 const disabled=new Set<string>();const calls:string[]=[];
 const result=await runWithFallback({models:["openai|first","openai|second","gemini|backup"],signal:signal(),budgetMs:1000,validate:x=>x,
 shouldSkip:id=>disabled.has(id.split("|")[0]),onTerminalFailure:id=>{disabled.add(id.split("|")[0]);return true;},
 run:async id=>{calls.push(id);if(id.startsWith("openai"))throw {statusCode:402};return "resume";}});
 assert.equal(result.model,"gemini|backup");assert.deepEqual(calls,["openai|first","gemini|backup"]);
});
test("direct OpenAI keys are sent only to OpenAI, with its completion-token parameter",async()=>{
 const run=createKeyRunner(["invalid-test","working-test"]);const urls:string[]=[];
 const result=await run(key=>generateOpenRouter({provider:"openai",apiKey:key,model:"gpt-6-luna",schema:z.object({summary:z.string()}),system:"rules",prompt:"facts",signal:signal(),fetcher:async(url,init)=>{
  urls.push(String(url));assert.equal(url,"https://api.openai.com/v1/chat/completions");
  const body=JSON.parse(init?.body as string);assert.equal(body.max_completion_tokens,8192);assert.ok(!body.max_tokens);assert.ok(!body.provider);
  if(new Headers(init?.headers).get("Authorization")==="Bearer invalid-test")return Response.json({}, {status:401});
  return Response.json({choices:[{message:{content:'{"summary":"Resume"}'}}]});
 }}),signal());
 assert.deepEqual(result,{summary:"Resume"});assert.equal(urls.length,2);
});
