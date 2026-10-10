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
5. Configure Vercel AI Gateway access. Add `AI_GATEWAY_API_KEY` for explicit key authentication. Project OIDC may also authenticate Gateway calls when enabled and available.
6. Deploy. Select **Unlock AI workspace** and enter your access password.
7. Configure appropriate AI Gateway spend limits: a kit generation runs three model calls.
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

## Generation and factual review
Requirements are mapped to supplied evidence. The model drafts an application kit, then another model call reviews unsupported claims. Bullets whose source quotes cannot be found are removed.
AI review can still make mistakes; users review claims before exports. Evidence coverage is a weighted drafting heuristic, not a universal ATS score or hiring probability. There is no guarantee of perfect fit or a top-hire outcome.
Hypothetical examples are proposed practice projects, kept separate from application materials and excluded from resume exports.

## Privacy and access
Documents and photos are processed in the browser. Entered and extracted resume text is sent through AI Gateway during generation. The app does not intentionally store documents or generated kits in a server database.
Local saving happens only after Save on device; personal data remains in that browser until cleared.
Coach conversations use eve durable sessions and the retention settings of your Vercel/eve configuration.
The shared password is for a private personal or team workspace, not multi-tenant SaaS. Everyone holding the password shares coach workspace access. Password rotation invalidates cookies.
For public multi-user use, add individual authentication, scoped storage, distributed usage quotas, and rate limiting.

## Configuration
- `APP_ACCESS_PASSWORD`: required for AI, at least 12 characters.
- `AI_GATEWAY_API_KEY`: explicit Gateway credential; useful for local development.
- `RESUME_MODEL`: optional form pipeline override; default `openai/gpt-6-luna-fast`.
- Coach model is configured separately in `agent/agent.ts`.
Live AI testing requires Gateway access and credits. A successful build does not prove generation quality.

## Verification performed
- Next.js production build and TypeScript checks passed.
- Five unit tests passed for evidence checks, fictional-content separation, coverage, validation, and cookie access.
- HTTP checks passed for page serving, password rejection/login, generation payload validation, cross-origin rejection, PDF worker, and coach access gates.
- The authenticated coach session endpoint accepted a session with its compiled runtime running.
- Browser automation was blocked by a missing system library in the test environment. Live model generation and visual/export behavior require verification on the configured deployment.
For local production preview, run the compiled eve service alongside Next.js (`PORT=4274 npm run start:eve` in a second terminal). `npm run dev` uses the integrated development setup.
