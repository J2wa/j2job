import type { Profile, Bundle, Analysis } from "./resume-schema";
export const demoProfile:Profile={name:"Morgan Sample",email:"morgan@example.com",phone:"+63 900 000 0000",location:"Manila, Philippines",links:"portfolio.example.com",
 experience:"QA Coordinator, Example Studio, 2023–2026. Led evaluator calibration and built automated checks for scoring inconsistencies. Created Python reports and coordinated multilingual evaluation teams.",
 education:"BS Information Technology, Example University, 2023",certifications:"",skills:"Python, quality assurance, evaluator calibration, reporting, team coordination",resumeText:"",
 jobDescription:"Seeking an AI Quality Analyst to lead evaluator calibration, automate scoring checks using Python, coordinate multilingual teams, and report quality trends. SQL experience preferred.",
 tone:"Professional",length:"Focused",hypothetical:true};
export const demoBundle:Bundle={resume:{targetRole:"AI Quality Analyst",summary:"Quality assurance coordinator experienced in evaluator calibration, automated scoring checks, and multilingual team coordination. Uses Python reporting to make evaluation findings easier to act on.",
 skills:["Python","Quality assurance","Evaluator calibration","Reporting","Team coordination"],
 experience:[{title:"QA Coordinator",organization:"Example Studio",dates:"2023–2026",bullets:[
 {text:"Led evaluator calibration and coordinated multilingual evaluation teams.",evidence:"Led evaluator calibration and built automated checks for scoring inconsistencies."},
 {text:"Built automated checks to identify scoring inconsistencies.",evidence:"built automated checks for scoring inconsistencies"},
 {text:"Created Python reports to support evaluation workflows.",evidence:"Created Python reports"}]}],
 education:["BS Information Technology — Example University, 2023"],certifications:[]},
 coverLetter:"Dear Hiring Team,\n\nI am interested in your AI Quality Analyst role. My background in evaluator calibration, automated scoring checks, and multilingual team coordination aligns with the core responsibilities. At Example Studio, I created Python reports and supported consistent evaluation practices.\n\nI would welcome the opportunity to discuss how this experience could support your team.\n\nSincerely,\nMorgan Sample",
 interviewPrep:[{question:"How do you calibrate evaluators?",guidance:"Use a real example of a calibration session: the disagreement, your process, and the outcome. Add an actual metric only if documented."},{question:"How would you automate scoring checks?",guidance:"Explain the checks you built, how you tested them, and how your team used the Python reports."}],
 hypotheticalExamples:[{title:"FICTIONAL PRACTICE EXAMPLE — SQL quality dashboard",description:"Proposed learning project: build a SQL dashboard on synthetic evaluation data. Complete it before describing it as completed work."}],warnings:["This demonstration uses a fictional profile.","SQL experience is not supported by the supplied background."]};
export const demoAnalysis:Analysis={role:"AI Quality Analyst",requirements:[
 {requirement:"Evaluator calibration",status:"supported",evidence:"Led evaluator calibration",recommendation:"Explain your calibration process."},
 {requirement:"Python automation and reporting",status:"supported",evidence:"Created Python reports",recommendation:"Add a real example of your checks."},
 {requirement:"Multilingual team coordination",status:"supported",evidence:"coordinated multilingual evaluation teams",recommendation:"Add verified team size if available."},
 {requirement:"SQL",status:"missing",evidence:"",recommendation:"Provide genuine SQL experience or complete a practice project."}],questions:["What measurable results did your scoring checks achieve?","Do you have SQL experience?"]};
