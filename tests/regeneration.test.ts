import {test} from "node:test";
import assert from "node:assert/strict";
import {gapRegenerationRequest,generationRequestSchema} from "../lib/regeneration.ts";
import {demoProfile,demoBundle,demoAnalysis} from "../lib/demo.ts";
import {sources} from "../lib/resume-schema.ts";
test("gap regeneration prioritizes missing, partial and uncovered requirements without converting generated work to candidate sources",()=>{
 const resume=structuredClone(demoBundle.resume);
 resume.experience[0].matchedRequirements=[demoAnalysis.requirements[0].requirement,demoAnalysis.requirements[1].requirement];
 const analysis=structuredClone(demoAnalysis);
 analysis.requirements[1].status="partial";
 const request=gapRegenerationRequest({...demoProfile,hypothetical:false},resume,analysis);
 assert.equal(request.hypothetical,true);
 assert.deepEqual(request.regeneration?.gaps.map(g=>g.requirement),["Python automation and reporting","Multilingual team coordination","SQL"]);
 assert.equal(sources(request),sources(demoProfile));
 assert.equal(request.regeneration?.previousResume,resume);
 assert.equal(generationRequestSchema.safeParse(request).success,true);
});
test("regular generation remains compatible and malformed regeneration is rejected",()=>{
 assert.equal(generationRequestSchema.safeParse(demoProfile).success,true);
 assert.equal(generationRequestSchema.safeParse({...demoProfile,regeneration:{previousResume:{},gaps:[]}}).success,false);
 assert.equal(generationRequestSchema.safeParse({...demoProfile,regeneration:{previousResume:demoBundle.resume,gaps:Array.from({length:101},()=>({requirement:"SQL",recommendation:"Add example"}))}}).success,false);
});
test("regeneration preserves edited resume content and profile preferences",()=>{
 const resume=structuredClone(demoBundle.resume);resume.summary="My edited summary";
 const request=gapRegenerationRequest({...demoProfile,aiProvider:"gemini",aiModel:"gemini-3.8-flash",tone:"Concise"},resume,demoAnalysis);
 assert.equal(request.regeneration?.previousResume.summary,"My edited summary");
 assert.equal(request.aiProvider,"gemini");assert.equal(request.tone,"Concise");
 assert.equal(request.jobDescription,demoProfile.jobDescription);
});
