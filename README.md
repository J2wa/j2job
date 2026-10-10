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

## Model switch and multiple API keys
In the final form step, choose **AI provider** and **Model**. Unlock the workspace, then use **Refresh model options** to load compatible Gemini, OpenRouter, Gateway and OpenAI models. The list excludes audio/image/embedding/batch models that cannot generate this app's structured resume. An environment fallback allowlist also limits what the selector offers.
Gemini discovery reads the authenticated Google model catalog (including pagination and token limits); OpenRouter uses its capability catalog. OpenAI discovery unions `/v1/models` across configured keys and intersects current structured-output metadata, excluding specialized/Responses-only variants. Capability metadata is a filter, not proof of access or generation quality. Catalog outages show cached fallback options, visibly labeled.
The selected model is tried first. **Try other configured AI providers if needed** is enabled by default and can be turned off to keep candidate text within one provider. Backups are interleaved across configured providers so one provider cannot monopolize every attempt. Progress shows the current provider/model, and completed stages keep their results.
Set multiple OpenAI keys in Vercel using:
```env
RESUME_PROVIDER=openai
OPENAI_API_KEYS=["your_first_openai_key","your_second_openai_key"]
```
Comma-separated values or one key per line also work. These are placeholders; enter real keys only in Vercel's secret environment settings. `OPENAI_API_KEY` is supported as an additional single key. `OPENAI_MODEL` and `OPENAI_FALLBACK_MODELS` set a first choice and optional ordered allowlist using native OpenAI IDs.
Equivalent pools are `GEMINI_API_KEYS`, `OPENROUTER_API_KEYS`, and `AI_GATEWAY_API_KEYS`; singular variables remain supported. Up to 32 unique keys per provider are accepted. OpenAI keys authenticate only OpenAI; Gemini/OpenRouter/Gateway each require their own service's keys. Provider-specific credentials are never sent to another service.
Within a request, keys are tried sequentially. The successful key is preferred for subsequent stages. Invalid, exhausted, rate-limited and timed-out keys are skipped for that request; access/provider failures can move to another eligible key. Request/schema/model errors move to another model. With multiple keys, each key has a 25-second deadline inside the existing 40-second model-attempt deadline; total stage/request deadlines still apply, so not every key/model is guaranteed an attempt. Keys sharing a project/account may share quotas.
The protected `/api/models` response exposes model IDs and configuration availability, never key values, key identifiers or credential counts. All key rotation happens server-side. The separate eve coach retains its original Gateway configuration.

## Native Gemini API option / troubleshooting
A Google AI Studio key belongs in `GEMINI_API_KEY`, not `AI_GATEWAY_API_KEY` or `OPENROUTER_API_KEY`. Set `RESUME_PROVIDER=gemini`, redeploy Vercel, then choose **Google Gemini API** (or Automatic with that default) in the final form step. `GOOGLE_GENERATIVE_AI_API_KEY` is also accepted as a legacy alias.
Native Gemini calls use Google's OpenAI-compatible endpoint with JSON Schema, low reasoning effort and the existing evidence-review pipeline. No Gateway or OpenRouter key is required for resume generation in this mode.
`GEMINI_MODEL` defaults to `gemini-3.8-flash`; blank fallback settings try `gemini-3.8-flash`, `gemini-3.6-flash`, and `gemini-3.5-flash-lite` in order, deduplicated after the first choice. `GEMINI_FALLBACK_MODELS` can replace the list. Native IDs use `gemini-...`; `google/` and `models/` prefixes are normalized.
A valid key still needs access and quota for the chosen model. Invalid-key responses stop with an access error; exhaustion messages now distinguish quota/rate limits, missing models, rejected schema, timeouts and invalid output without disclosing upstream response text. A generic exhausted-model message alone does not establish which condition occurred. These transport paths were verified with mocked responses; live calls still require configured credentials. The separate eve coach still uses Gateway.

## OpenRouter option
Set `OPENROUTER_API_KEY` in Vercel environment variables and redeploy. Never enter an API key into the public app or commit one.
To use OpenRouter by default, also set `RESUME_PROVIDER=openrouter`. The **AI provider** menu offers Automatic, Vercel AI Gateway, OpenRouter, Google Gemini API and OpenAI API. Automatic uses the workspace default; with `RESUME_PROVIDER=auto`, it prefers configured Gateway credentials, then OpenRouter, Gemini and OpenAI.
OpenRouter mode does not require an AI Gateway key. It uses OpenRouter's own model IDs and direct chat-completions endpoint with strict JSON schema plus `require_parameters: true`, followed by the same local schema validation and evidence review.
Set `OPENROUTER_MODEL` for a first choice and `OPENROUTER_FALLBACK_MODELS` for a comma-separated ordered allowlist. Blank uses hourly catalog discovery: text models with structured output, sufficient context/output limits, excluding image output and batch variants. The initial order is GPT-6 Luna → Claude Haiku 5.5 → Gemini 3.8 Flash → Claude Sonnet 5.5 → DeepSeek V4.1 Flash → GPT-6.1 Sol, then remaining compatible models by release date. Catalog outages use cached metadata or a verified six-model snapshot.
The existing stage/attempt deadlines and account-error handling apply to both providers. The selected provider processes candidate text; keys stay on the server. Turn off the provider fallback checkbox to keep retries within that provider. The separate eve coach continues to use AI Gateway.

## Resume model failover
In Gateway mode, resume calls use `AI_GATEWAY_API_KEYS`, `AI_GATEWAY_API_KEY` or Vercel OIDC. Other providers require their own keys when cross-provider fallback is enabled.
The app refreshes the public Gateway catalog hourly and filters for text input/output, structured output, at least 65,536 context tokens and 8,192 output tokens. Image-producing models are excluded. Each prompt is also checked against the model context size using a conservative UTF-8 byte bound.
The preferred order is GPT-6 Luna Fast → Claude Haiku 5.5 → Gemini 3.8 Flash → Claude Sonnet 5.5 → DeepSeek V4.1 Flash → GPT-6.1 Sol, when present in the live catalog. Remaining compatible models follow in release-date order (newest first, then model ID). A bundled catalog snapshot is used if discovery is down.
Each stage tries models sequentially until a schema-valid result succeeds or its time budget expires. Provider errors, unavailable models, rate limits, timeouts and invalid structured outputs move to the next candidate. Successful stages are retained, and the last successful model is preferred for the next stage. Models that failed are skipped for the rest of that request.
Attempts have a 40-second limit; analysis, draft and review have 70/95/85-second limits, within the 260-second total generation deadline. A request may finish before exhausting the entire catalog. SDK retries are disabled to avoid repeatedly calling the same failing model; Gateway's provider routing still applies.
Authentication, access-policy and exhausted-credit/budget errors skip the affected provider after eligible key retries. Generation continues with another configured provider when provider fallback is enabled; otherwise it stops. Progress reports backup attempts; final response metadata includes the model and attempt count for each stage. Logs contain only stage/model identifiers, never prompts or credentials.
Use `RESUME_FALLBACK_MODELS` to restrict providers/models or set your own order. Catalog compatibility is metadata, not proof of output quality or access under your key. Review and evidence cleanup still apply after fallbacks. The separate eve coach continues to use `agent/agent.ts`.

## Generation and factual review
Requirements are mapped to supplied evidence. The model drafts an application kit, then another model call reviews unsupported claims. Bullets whose source quotes cannot be found are removed.
AI review can still make mistakes; users review claims before exports. Evidence coverage is a weighted drafting heuristic, not a universal ATS score or hiring probability. There is no guarantee of perfect fit or a top-hire outcome.
The resume includes only roles mapped to requirements in the analyzed listing; unrelated jobs are omitted. Relevant achievements are prioritized rather than copying the full work history.
**Add relevant freelance/project experience** enables a fictional draft mode. It can add up to two relevant project roles with ordinary titles under `Freelance` or `Confidential Project`. No added/fictional labels appear inside the document; the app banner and warnings prompt review of generated project details. Internal `basis` metadata distinguishes provided and illustrative roles, while `matchedRequirements` maps each role to the listing. Fictional entries cannot invent real employer names, dates, credentials or numerical results. Replace invented work with completed experience before applying.
With this option off, source evidence is still required for every experience bullet. Actual-candidate evidence coverage, cover letters and interview guidance do not count fictional roles as real qualifications. Separate practice-project examples remain outside resume exports.

## Privacy and access
Documents and photos are processed in the browser. Entered and extracted resume text is sent through the selected AI provider (AI Gateway, OpenRouter or Gemini) during generation. The app does not intentionally store documents or generated kits in a server database.
Local saving happens only after Save on device; personal data remains in that browser until cleared.
Coach conversations use eve durable sessions and the retention settings of your Vercel/eve configuration.
The shared password is for a private personal or team workspace, not multi-tenant SaaS. Everyone holding the password shares coach workspace access. Password rotation invalidates cookies.
For public multi-user use, add individual authentication, scoped storage, distributed usage quotas, and rate limiting.

## Configuration
- `APP_ACCESS_PASSWORD`: required for AI, at least 12 characters.
- `AI_GATEWAY_API_KEY`: explicit Gateway credential; useful for local development.
- `RESUME_PROVIDER`: workspace default (`auto`, `gateway`, `openrouter`, `gemini`, `openai`).
- `OPENROUTER_API_KEY`: server-only credential for direct OpenRouter calls.
- `GEMINI_API_KEY` / `GEMINI_MODEL` / `GEMINI_FALLBACK_MODELS`: native Google credential and model order.
- `OPENROUTER_MODEL` / `OPENROUTER_FALLBACK_MODELS`: OpenRouter-specific first choice and ordered fallback allowlist.
- `RESUME_MODEL`: optional first-choice Gateway resume model.
- `RESUME_FALLBACK_MODELS`: optional comma-separated fallback IDs in order. Setting this replaces automatic catalog discovery as the candidate list (with `RESUME_MODEL` first if set). Blank uses all compatible catalog models.
- Coach model is configured separately in `agent/agent.ts`.
Live AI testing requires Gateway access and credits. A successful build does not prove generation quality.

## Verification performed
- Next.js production build and TypeScript checks passed.
- Thirty-one unit tests passed, including ordered fallback, invalid output, rate limits, missing models, catalog outage, cancellation, attempt/stage deadlines, terminal account errors, evidence checks, and cookie access.
- HTTP checks passed for page serving, password rejection/login, generation payload validation, cross-origin rejection, PDF worker, and coach access gates.
- The authenticated coach session endpoint accepted a session with its compiled runtime running.
- Browser automation was blocked by a missing system library in the test environment. Live model generation and visual/export behavior require verification on the configured deployment.
For local production preview, run the compiled eve service alongside Next.js (`PORT=4274 npm run start:eve` in a second terminal). `npm run dev` uses the integrated development setup.
