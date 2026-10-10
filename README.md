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
5. Configure an AI provider: set `OPENROUTER_API_KEY` and `RESUME_PROVIDER=openrouter`, or configure Vercel AI Gateway with `AI_GATEWAY_API_KEY` / available project OIDC.
6. Deploy. Select **Unlock AI workspace** and enter your access password.
7. Configure appropriate AI Gateway spend limits: a successful kit normally runs three model calls; fallback attempts can add calls and cost.
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

## OpenRouter option
Set `OPENROUTER_API_KEY` in Vercel environment variables and redeploy. Never enter an API key into the public app or commit one.
To use OpenRouter by default, also set `RESUME_PROVIDER=openrouter`. The **AI provider** menu in the final form step offers Automatic, Vercel AI Gateway and OpenRouter. Automatic uses the workspace default; with `RESUME_PROVIDER=auto`, it uses OpenRouter if only the OpenRouter key is configured, otherwise Gateway.
OpenRouter mode does not require an AI Gateway key. It uses OpenRouter's own model IDs and direct chat-completions endpoint with strict JSON schema plus `require_parameters: true`, followed by the same local schema validation and evidence review.
Set `OPENROUTER_MODEL` for a first choice and `OPENROUTER_FALLBACK_MODELS` for a comma-separated ordered allowlist. Blank uses hourly catalog discovery: text models with structured output, sufficient context/output limits, excluding image output and batch variants. The initial order is GPT-6 Luna → Claude Haiku 5.5 → Gemini 3.8 Flash → Claude Sonnet 5.5 → DeepSeek V4.1 Flash → GPT-6.1 Sol, then remaining compatible models by release date. Catalog outages use cached metadata or a verified six-model snapshot.
The existing stage/attempt deadlines and account-error handling apply to both providers. The selected provider processes candidate text; keys stay on the server. Fallbacks remain within that provider and do not switch between OpenRouter and Gateway. The separate eve coach continues to use AI Gateway.

## Resume model failover
In Gateway mode, all resume calls use the same `AI_GATEWAY_API_KEY` (or Vercel OIDC); no extra provider keys are required.
The app refreshes the public Gateway catalog hourly and filters for text input/output, structured output, at least 65,536 context tokens and 8,192 output tokens. Image-producing models are excluded. Each prompt is also checked against the model context size using a conservative UTF-8 byte bound.
The preferred order is GPT-6 Luna Fast → Claude Haiku 5.5 → Gemini 3.8 Flash → Claude Sonnet 5.5 → DeepSeek V4.1 Flash → GPT-6.1 Sol, when present in the live catalog. Remaining compatible models follow in release-date order (newest first, then model ID). A bundled catalog snapshot is used if discovery is down.
Each stage tries models sequentially until a schema-valid result succeeds or its time budget expires. Provider errors, unavailable models, rate limits, timeouts and invalid structured outputs move to the next candidate. Successful stages are retained, and the last successful model is preferred for the next stage. Models that failed are skipped for the rest of that request.
Attempts have a 40-second limit; analysis, draft and review have 70/95/85-second limits, within the 260-second total generation deadline. A request may finish before exhausting the entire catalog. SDK retries are disabled to avoid repeatedly calling the same failing model; Gateway's provider routing still applies.
Authentication, access-policy and exhausted-credit/budget errors stop immediately because another model cannot repair those account conditions. Progress reports backup attempts; final response metadata includes the model and attempt count for each stage. Logs contain only stage/model identifiers, never prompts or credentials.
Use `RESUME_FALLBACK_MODELS` to restrict providers/models or set your own order. Catalog compatibility is metadata, not proof of output quality or access under your key. Review and evidence cleanup still apply after fallbacks. The separate eve coach continues to use `agent/agent.ts`.

## Generation and factual review
Requirements are mapped to supplied evidence. The model drafts an application kit, then another model call reviews unsupported claims. Bullets whose source quotes cannot be found are removed.
AI review can still make mistakes; users review claims before exports. Evidence coverage is a weighted drafting heuristic, not a universal ATS score or hiring probability. There is no guarantee of perfect fit or a top-hire outcome.
Hypothetical examples are proposed practice projects, kept separate from application materials and excluded from resume exports.

## Privacy and access
Documents and photos are processed in the browser. Entered and extracted resume text is sent through the selected AI provider (AI Gateway or OpenRouter) during generation. The app does not intentionally store documents or generated kits in a server database.
Local saving happens only after Save on device; personal data remains in that browser until cleared.
Coach conversations use eve durable sessions and the retention settings of your Vercel/eve configuration.
The shared password is for a private personal or team workspace, not multi-tenant SaaS. Everyone holding the password shares coach workspace access. Password rotation invalidates cookies.
For public multi-user use, add individual authentication, scoped storage, distributed usage quotas, and rate limiting.

## Configuration
- `APP_ACCESS_PASSWORD`: required for AI, at least 12 characters.
- `AI_GATEWAY_API_KEY`: explicit Gateway credential; useful for local development.
- `RESUME_PROVIDER`: workspace default (`auto`, `gateway`, `openrouter`).
- `OPENROUTER_API_KEY`: server-only credential for direct OpenRouter calls.
- `OPENROUTER_MODEL` / `OPENROUTER_FALLBACK_MODELS`: OpenRouter-specific first choice and ordered fallback allowlist.
- `RESUME_MODEL`: optional first-choice Gateway resume model.
- `RESUME_FALLBACK_MODELS`: optional comma-separated fallback IDs in order. Setting this replaces automatic catalog discovery as the candidate list (with `RESUME_MODEL` first if set). Blank uses all compatible catalog models.
- Coach model is configured separately in `agent/agent.ts`.
Live AI testing requires Gateway access and credits. A successful build does not prove generation quality.

## Verification performed
- Next.js production build and TypeScript checks passed.
- Nineteen unit tests passed, including ordered fallback, invalid output, rate limits, missing models, catalog outage, cancellation, attempt/stage deadlines, terminal account errors, evidence checks, and cookie access.
- HTTP checks passed for page serving, password rejection/login, generation payload validation, cross-origin rejection, PDF worker, and coach access gates.
- The authenticated coach session endpoint accepted a session with its compiled runtime running.
- Browser automation was blocked by a missing system library in the test environment. Live model generation and visual/export behavior require verification on the configured deployment.
For local production preview, run the compiled eve service alongside Next.js (`PORT=4274 npm run start:eve` in a second terminal). `npm run dev` uses the integrated development setup.
