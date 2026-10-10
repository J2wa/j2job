import { test } from "node:test";
import assert from "node:assert/strict";
import { evidenceExists, cleanBundle, coverage, profileSchema, plainResume } from "../lib/resume-schema.ts";
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
