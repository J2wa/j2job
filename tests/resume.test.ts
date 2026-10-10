import { test } from "node:test";
import assert from "node:assert/strict";
import { evidenceExists, cleanBundle, coverage, profileSchema, plainResume, generationBundleSchema, resumeRequirementGaps } from "../lib/resume-schema.ts";
import { demoProfile, demoBundle, demoAnalysis } from "../lib/demo.ts";
import { authorized, matches, token } from "../lib/access.ts";
test("evidence matching rejects unsupported quotes",()=>{
 assert.equal(evidenceExists("Built Python reports","Built\n Python reports"),true);
 assert.equal(evidenceExists("Led a team of 100","Led a team of 10"),false);
 assert.equal(evidenceExists("SQL","SQL"),false);
});
test("unsupported claims removed and fictional projects kept out of exports",()=>{
 const input=structuredClone(demoBundle);input.resume.experience[0].bullets.push({text:"Earned AWS certification",evidence:"Made up qualification"});
 const result=cleanBundle(input,demoProfile.experience,false);
 assert.equal(result.hypotheticalExamples.length,0);
 assert.ok(!plainResume(result.resume,demoProfile).includes("Earned AWS"));
 assert.ok(result.warnings.some(w=>w.includes("removed")));
 assert.ok(!plainResume(result.resume,demoProfile).includes("SQL quality dashboard"));
});
test("weighted coverage reflects missing qualifications",()=>{
 assert.equal(coverage(demoAnalysis),75);
 assert.equal(coverage({role:"Role",requirements:[],questions:[]}),0);
});
test("profile requires meaningful job description and background",()=>{
 assert.equal(profileSchema.safeParse({...demoProfile,jobDescription:"short"}).success,false);
 assert.equal(profileSchema.safeParse({...demoProfile,experience:"",resumeText:""}).success,false);
 assert.equal(profileSchema.safeParse(demoProfile).success,true);
});
test("AI access fails closed without configured password and valid cookie",()=>{
 delete process.env.APP_ACCESS_PASSWORD;
 assert.equal(authorized(new Request("https://example.com")),false);
 process.env.APP_ACCESS_PASSWORD="test-password-long-enough";
 assert.equal(matches("a","b"),false);
 assert.equal(authorized(new Request("https://example.com",{headers:{cookie:"resume_session="+token()}})),true);
 assert.equal(authorized(new Request("https://example.com",{headers:{cookie:"resume_session=wrong"}})),false);
});

test("only roles mapped to analyzed job requirements survive relevance filtering",()=>{
 const input=structuredClone(demoBundle);
 input.resume.experience[0].matchedRequirements=[demoAnalysis.requirements[0].requirement];
 input.resume.experience.push({...structuredClone(input.resume.experience[0]),title:"Unrelated job",matchedRequirements:["Not a listing requirement"]});
 const result=cleanBundle(input,demoProfile.experience,false,demoAnalysis);
 assert.equal(result.resume.experience.length,1);
 assert.ok(result.warnings.some(w=>w.includes("omitted")));
});
test("illustrative mode retains relevant project entries with standard headings but no invented company or dates",()=>{
 const input=structuredClone(demoBundle);
 input.resume.experience=[{title:"SQL Analyst",organization:"Invented Corporation",dates:"2010–2026",basis:"illustrative",matchedRequirements:["SQL"],bullets:[{text:"Built SQL queries for a quality dashboard.",evidence:""}]}];
 const result=cleanBundle(input,demoProfile.experience,true,demoAnalysis);
 assert.equal(result.resume.experience[0].organization,"Confidential Project");
 assert.equal(result.resume.experience[0].dates,"");
 const output=plainResume(result.resume,demoProfile);
 assert.ok(output.includes("SQL Analyst | Confidential Project"));
 assert.ok(!output.includes("illustrative")&&!output.includes("Invented Corporation"));
 assert.ok(result.warnings.some(w=>w.includes("generated project details")));
 assert.equal(cleanBundle(input,demoProfile.experience,false,demoAnalysis).resume.experience.length,0);
});
test("illustrative option never bypasses evidence checks for provided roles",()=>{
 const input=structuredClone(demoBundle);
 input.resume.experience[0].basis="provided";
 input.resume.experience[0].matchedRequirements=["SQL"];
 input.resume.experience[0].bullets=[{text:"Invented achievement",evidence:""}];
 assert.equal(cleanBundle(input,demoProfile.experience,true,demoAnalysis).resume.experience.length,0);
});

test("generation requires provenance and relevance metadata while old saved drafts remain readable",()=>{
 assert.equal(generationBundleSchema.safeParse(demoBundle).success,false);
 const draft=structuredClone(demoBundle);
 draft.resume.experience[0].basis="provided";
 draft.resume.experience[0].matchedRequirements=["Evaluator calibration"];
 assert.equal(generationBundleSchema.safeParse(draft).success,true);
});

test("resume gap review catches requirements missing from usable experience",()=>{
 const draft=structuredClone(demoBundle);
 draft.resume.experience[0].matchedRequirements=["Evaluator calibration","Python automation and reporting","Multilingual team coordination"];
 assert.deepEqual(resumeRequirementGaps(draft.resume,demoAnalysis),["SQL"]);
 draft.resume.experience.push({title:"SQL Project",organization:"Freelance",dates:"",basis:"illustrative",matchedRequirements:["SQL"],bullets:[]});
 assert.deepEqual(resumeRequirementGaps(draft.resume,demoAnalysis),["SQL"]);
 draft.resume.experience[1].bullets=[{text:"Built SQL queries for quality reports.",evidence:""}];
 assert.deepEqual(resumeRequirementGaps(cleanBundle(draft,demoProfile.experience,true,demoAnalysis).resume,demoAnalysis),[]);
 assert.deepEqual(resumeRequirementGaps(cleanBundle(draft,demoProfile.experience,false,demoAnalysis).resume,demoAnalysis),["SQL"]);
});
test("resume gap review normalizes and deduplicates requirement labels",()=>{
 const draft=structuredClone(demoBundle);
 draft.resume.experience[0].matchedRequirements=["  EVALUATOR   CALIBRATION "];
 const requirement=demoAnalysis.requirements[0];
 const analysis={role:"QA",questions:[],requirements:[requirement,{...requirement,requirement:"SQL"},{...requirement,requirement:" sql "}]};
 assert.deepEqual(resumeRequirementGaps(draft.resume,analysis),["SQL"]);
});
