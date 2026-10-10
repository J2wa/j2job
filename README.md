# J2Job — Resume Studio
An evidence-based resume and application builder by ACES Intelligence.

## Features
- Enter any job description, name, contact information, experience, education, certifications and skills.
- Browser-side PDF, DOCX, TXT and Markdown imports (4 MB / 20-page limits).
- Optional local photo processing; photos appear only in the Modern PDF layout.
- Three AI stages: evidence mapping, application drafting, claim review.
- ATS Classic, Modern, Executive and Compact layouts.
- Editable draft, Word (ATS), text, and browser PDF exports.
- Requirement report, evidence coverage, and follow-up questions.
- Cover letter, interview preparation and clearly fictional practice project ideas.
- Optional on-device saving and password-protected AI endpoints.
- Durable eve career coach with a keyword comparison tool.
- Fictional demo works without credentials.

## Vercel deployment
This standalone app lives at the root of the `J2wa/j2job` repository.
1. Import `J2wa/j2job` into a **new** Vercel project.
2. Set production branch to `main`.
3. Set **Root Directory** to `.` (the repository root); framework **Next.js**; Node.js **24.x**.
4. Add `APP_ACCESS_PASSWORD`: a unique password of at least 12 characters.
5. Add any of `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY` or their plural key pools. Resume generation detects configured providers automatically.
6. Deploy. Select **Unlock AI workspace** and enter your access password.
7. Configure appropriate provider spend limits: a successful kit normally runs three model calls; fallback attempts can add calls and cost.
Use a new project, not the existing j2viddd production project. The app does not need GitHub credentials at runtime.

`withEve` compiles the coach routes and durable workflow integration. For CLI provisioning:
```sh
npx eve link --project j2job --non-interactive
npx eve deploy --non-interactive --yes --project j2job
```

## Local development
```sh
git clone https://github.com/J2wa/j2job.git
cd j2job
npm install
cp .env.example .env.local
# Fill credentials, then:
npm run dev
npm run typecheck
npm test
npm run build
```
The postinstall script copies the PDF worker. Scanned PDF OCR is not included; paste the text instead.
PDF export uses browser Print → Save as PDF. Word/text use ATS layout. Page count depends on content and print settings.

## Automatic API routing and key pools
Resume generation automatically tries **OpenRouter → Gemini → OpenAI**, skipping providers with no configured keys. The provider and model controls remain available: Automatic follows this order; an explicit selection is tried first, with the other configured providers kept as backups. Every stage follows the chosen provider order; a successful model is preferred only within its own provider. Gateway remains available to the separate career coach.
The app discovers compatible text models with structured output and sufficient token limits. OpenRouter reads its capability catalog; Gemini uses authenticated Google model discovery with pagination; OpenAI unions accessible model IDs across configured keys and intersects structured-output capability metadata. Discovery outages use cached fallback metadata. Catalog access is not proof of generation access or quota: actual generation attempts establish that.
Configure multiple keys, for example:
```env
OPENROUTER_API_KEYS=["first_openrouter_key","second_openrouter_key"]
GEMINI_API_KEYS=["first_gemini_key","second_gemini_key"]
OPENAI_API_KEYS=["first_openai_key","second_openai_key"]
```
JSON arrays, comma-separated values and one key per line are accepted. Singular variables are also supported; each pool accepts up to 32 unique keys. Providers use only their own credentials. Keys never appear in the browser or response metadata.
Within a provider, eligible models and keys are tried until a valid result succeeds, its provider budget expires, or its credentials are rejected/exhausted. Then routing moves to the next provider. Stages reserve time for remaining providers so a slow OpenRouter call cannot consume the whole stage budget. Unused time carries forward to backups. Generation stops at the first schema-valid result; it does not make unnecessary generation calls to later providers.
Analysis, drafting and review retain 70/95/85-second stage limits, 40-second maximum model attempts and the 260-second request deadline. Multiple-key attempts have a 25-second key limit inside their model/provider budget. Deadlines may prevent trying every key/model in a large catalog. Keys from the same account/project may share quotas.
The app displays configuration availability and compatible model counts alongside the provider/model controls. Progress identifies the provider/model currently being attempted. Completed stages are retained. `/api/models` requires workspace access and returns no credentials or key counts.
Legacy `RESUME_PROVIDER` and all `*_MODEL` / `*_FALLBACK_MODELS` environment settings no longer restrict resume routing. Remove them from Vercel if desired; only keys are needed. A saved provider/model choice is treated as a first preference; the old providerFallback flag cannot disable automatic backups.

## Complete resume targeting
The final resume targets every distinct substantive job requirement, including preferred tools and domain skills. Analysis no longer stops at fourteen requirements. Drafting uses the job's exact terminology naturally and connects skills to concrete role/project bullets. Before the final review, unsupported bullets are removed and a requirement-gap check identifies missing examples. The reviewer uses those gaps to strengthen the resume's skills, headline, summary and relevant project experience. Remaining gaps are shown in the match-report warnings, outside exports. Mandatory eligibility facts such as degrees, licenses and years of experience are not invented. This targets complete content coverage; the evidence score still measures supplied background rather than assigning an automatic 100%.

## Generation and factual review
Requirements are mapped to supplied evidence. The model drafts an application kit, then another model call reviews unsupported claims. Bullets whose source quotes cannot be found are removed.
AI review can still make mistakes; users review claims before exports. Evidence coverage is a weighted drafting heuristic, not a universal ATS score or hiring probability. There is no guarantee of perfect fit or a top-hire outcome.
The resume includes only roles mapped to requirements in the analyzed listing; unrelated jobs are omitted. Relevant achievements are prioritized rather than copying the full work history.
**Add relevant freelance/project experience** enables a fictional draft mode. New briefs enable this option by default. It can add relevant project roles, normally two to four, with ordinary titles under `Freelance` or `Confidential Project`. No added/fictional labels appear inside the document; the app banner and warnings prompt review of generated project details. Internal `basis` metadata distinguishes provided and illustrative roles, while `matchedRequirements` maps each role to the listing. Fictional entries cannot invent real employer names, dates, credentials or numerical results. Replace invented work with completed experience before applying.
With this option off, source evidence is still required for every experience bullet. Actual-candidate evidence coverage, cover letters and interview guidance do not count fictional roles as real qualifications. Separate practice-project examples remain outside resume exports.

## Privacy and access
Documents and photos are processed in the browser. Entered and extracted resume text may be sent to configured OpenRouter, Gemini and OpenAI providers during automatic fallback. The app does not intentionally store documents or generated kits in a server database.
Local saving happens only after Save on device; personal data remains in that browser until cleared.
Coach conversations use eve durable sessions and the retention settings of your Vercel/eve configuration.
The shared password is for a private personal or team workspace, not multi-tenant SaaS. Everyone holding the password shares coach workspace access. Password rotation invalidates cookies.
For public multi-user use, add individual authentication, scoped storage, distributed usage quotas, and rate limiting.

## Configuration
- `APP_ACCESS_PASSWORD`: required for AI, at least 12 characters.
- `OPENROUTER_API_KEY` / `OPENROUTER_API_KEYS`: direct OpenRouter credentials.
- `GEMINI_API_KEY` / `GEMINI_API_KEYS`: native Google AI Studio credentials (`GOOGLE_GENERATIVE_AI_API_KEY` remains a legacy alias).
- `OPENAI_API_KEY` / `OPENAI_API_KEYS`: native OpenAI credentials.
- `AI_GATEWAY_API_KEY`: optional for the separate eve career coach; its model is in `agent/agent.ts`.
Live AI testing requires configured provider access and quota. A successful build does not prove generation quality.

## Verification performed
- Next.js production build and TypeScript checks passed.
- 43 unit tests passed, including ordered fallback, invalid output, rate limits, missing models, catalog outage, cancellation, attempt/stage deadlines, terminal account errors, evidence checks, and cookie access.
- HTTP checks passed for page serving, password rejection/login, generation payload validation, cross-origin rejection, PDF worker, and coach access gates.
- The authenticated coach session endpoint accepted a session with its compiled runtime running.
- Browser automation was blocked by a missing system library in the test environment. Live model generation and visual/export behavior require verification on the configured deployment.
For local production preview, run the compiled eve service alongside Next.js (`PORT=4274 npm run start:eve` in a second terminal). `npm run dev` uses the integrated development setup.
