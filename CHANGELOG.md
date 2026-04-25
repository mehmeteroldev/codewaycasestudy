# Changelog

All notable changes to this project are logged here in chronological order.

## 2026-04-23 — Remove hardcoded country pool; let model select from its own knowledge

### Changed
- `backend/src/services/suggestionService.js` — dropped the hardcoded country list and `gdpRank` metadata. The prompt now instructs the model to use its own knowledge of nominal-GDP rankings (top ~15 economies) as the candidate pool.
- Validation switched from "whitelist against fixed pool" to "must be well-formed ISO 3166-1 alpha-2". Defense-in-depth (dedupe + `MAX_SUGGESTIONS` cap) preserved.
- Removed `TARGET_COUNTRIES` / `CANDIDATE_COUNTRIES` exports (no longer used).

### Why
- Hardcoding the pool made the algorithm static; moving the GDP selection into the prompt gives the model a proper reasoning step (analyze → pick top-GDP markets relevant to the lens → propose values) without a separate hand-maintained list.

## 2026-04-23 — Use top-GDP countries for AI candidate pool

### Changed
- `backend/src/services/suggestionService.js` — replaced the 37-country regional pool with the **top 10 economies by nominal GDP** (US, CN, DE, JP, IN, GB, FR, IT, BR, CA), per the case-study brief which calls out GDP as the selection criterion.
- Each candidate now carries a `gdpRank` field; the prompt lists countries prefixed with their rank (`#1 US — ...`) so the model naturally favors higher-GDP markets when equally-distinct options exist.
- Kept the 3-step analyze / select / propose prompt structure and the UI reasoning banner — those are prompt-engineering wins independent of which countries are in the pool.

## 2026-04-23 — Smarter AI country-selection algorithm

### Changed
- `backend/src/services/suggestionService.js` — replaced the hardcoded top-10-by-GDP country list with a **context-aware three-step algorithm**:
  1. **Analyze** the parameter to identify which localization *lenses* apply (language / currency / regulation / network / content / rollout / time, or *none*).
  2. **Select** ≤6 countries from a broader curated pool (~37 markets covering every major region, language, and regulatory bloc) that are most *distinct* along the identified lenses. Avoids duplicates along the same lens (e.g. won't propose both US and GB for a language-sensitive value).
  3. **Propose** values that strictly preserve the default's type.
- The model may return an empty suggestion list when the parameter does not warrant localization (e.g. `maxRetries`, API keys). This is a feature, not a failure — reflected in the UI.
- Response shape expanded from `{ suggestions }` to `{ lenses, reasoning, suggestions }`.
- Defense-in-depth preserved: whitelist + dedupe + cap to `MAX_SUGGESTIONS`.
- `backend/src/controllers/parameterController.js` — pass through the new shape unchanged.
- `frontend/src/services/api.js` — `suggestCountries` now returns the full `{ lenses, reasoning, suggestions }` object.
- `frontend/src/components/CountryOverridesEditor.vue` — renders a **reasoning banner** above the suggestion cards showing the detected lenses (as chips) and the model's one-sentence justification. Handles the "nothing proposed" case by showing the reasoning with an explanatory hint instead of a bare error.

### Why
- The original prompt (top-10 GDP) was context-free: `latestVersion` and `supportEmail` would draw suggestions from the same country pool even though their localization needs are fundamentally different. The new algorithm reasons about *why* a parameter might need localization, then picks countries that matter for that reason — and can decline to propose anything when the parameter is globally uniform.

## 2026-04-23 — Switch AI provider to Gemini (OpenAI-compatible endpoint)

### Changed
- `backend/src/config/env.js` — introduced `llm.{apiKey, model, baseUrl}` keyed off `LLM_*` env vars. Falls back to the legacy `OPENAI_*` vars for backwards compatibility. Default base URL: `https://generativelanguage.googleapis.com/v1beta/openai/` (Google Gemini's OpenAI-compat endpoint). Default model: `gemini-2.0-flash`.
- `backend/src/services/suggestionService.js` — client now passes `baseURL` to the OpenAI SDK, making it provider-agnostic. Renamed `mapOpenAiError` → `mapLlmError`; error messages no longer name OpenAI specifically.
- `backend/.env.example` — documented new `LLM_*` vars with preset examples for Gemini, OpenAI, Groq, and OpenRouter.

### Why
- OpenAI's API no longer has a free tier; `insufficient_quota` errors were surfacing as "Internal server error" on the panel because the error wasn't mapped. Now: error messages are accurate, and the default provider is free (Gemini's free tier gives ~1,500 req/day).

## 2026-04-23 — Initial implementation

### Added — Repository

- Monorepo scaffold: `backend/` (Node + Express) and `frontend/` (Vue 3 + Vite).
- Root `README.md` (architecture, API surface, deployment instructions for Cloud Run / Firebase Hosting / Vercel, env-var reference, concurrency-control write-up, AI-flow write-up).
- Root `.gitignore` covering Node, Vite, env files, Firebase service account keys.
- This `CHANGELOG.md`.

### Added — Backend (`backend/`)

- `package.json` with dependencies: `express`, `cors`, `helmet`, `express-rate-limit`, `dotenv`, `firebase-admin`, `openai`.
- `Dockerfile` (multi-stage, non-root `node` user).
- `.env.example` documenting every required variable.
- **`src/config/env.js`** — typed config loader; fails fast if required vars are missing.
- **`src/config/firebase.js`** — Firebase Admin init; supports both inline JSON (`FIREBASE_SERVICE_ACCOUNT_JSON`, recommended for PaaS) and `GOOGLE_APPLICATION_CREDENTIALS` paths. Exposes `auth`, `firestore`, `FieldValue`, `Timestamp`.
- **`src/utils/httpError.js`** — `HttpError` class + helpers (`badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`, `serviceUnavailable`).
- **`src/utils/asyncHandler.js`** — wraps async Express handlers so thrown errors reach the error middleware.
- **`src/middleware/errorHandler.js`** — central error normalizer + 404 handler; never leaks internals.
- **`src/middleware/firebaseAuth.js`** — verifies `Authorization: Bearer <Firebase ID token>` and attaches `req.user`.
- **`src/middleware/apiToken.js`** — verifies pre-shared token (`x-api-key` or `Authorization: Bearer`) using `crypto.timingSafeEqual` to prevent timing attacks.
- **`src/repositories/parameterRepository.js`** — Firestore CRUD for the `parameters` collection. Key function: `updateWithVersion(id, expectedVersion, patch)` runs a Firestore transaction that re-reads the doc, compares versions, and either bumps or throws `VERSION_MISMATCH` with the current state.
- **`src/services/parameterService.js`** — business logic: key/format validation, country-code validation (ISO-3166 α2, uppercased), conflict checks on create, concurrency enforcement on update, and `buildConfigForCountry()` that merges default values with per-country overrides for the serving endpoint.
- **`src/services/suggestionService.js`** — OpenAI integration for AI-assisted country suggestions. Curated list of 10 high-value mobile markets; prompt engineered to preserve the default value's type and only propose when localization is appropriate; uses `response_format: { type: 'json_object' }`; server-side filters out any countries the model invents outside the curated list.
- **`src/controllers/parameterController.js`** — thin HTTP adapters for panel CRUD + suggest.
- **`src/controllers/configController.js`** — thin HTTP adapter for public `/api/config?country=XX`, sets a short `Cache-Control` header.
- **`src/routes/panelRoutes.js`** — Firebase-auth'd routes: `GET/POST/PUT/DELETE /parameters`, `POST /parameters/suggest-countries`.
- **`src/routes/configRoutes.js`** — API-token'd route: `GET /`.
- **`src/app.js`** — Express wiring: Helmet, CORS (strict allowlist in prod, permissive in dev), JSON body limit, rate limiter on `/api/config`, `/healthz`, routes, error handlers.
- **`src/server.js`** — bootstrap with graceful SIGTERM/SIGINT shutdown.

### Added — Frontend (`frontend/`)

- `package.json` with dependencies: `vue` 3.5, `vue-router` 4, `pinia` 2, `axios`, `firebase`.
- `vite.config.js`, `index.html`, `.env.example`.
- **`src/main.js`** — app bootstrap with Pinia + Router + global CSS.
- **`src/App.vue`** — waits for auth bootstrap before rendering the router view.
- **`src/styles/main.css`** — design tokens (dark theme matching the reference screenshots), base element styles, button/badge/input classes.
- **`src/services/firebase.js`** — Firebase web-SDK init from `VITE_FIREBASE_*` env vars.
- **`src/services/api.js`** — axios client with request interceptor that attaches a fresh Firebase ID token; response interceptor normalizes errors into `{ message, status, details }`. Exports a `parametersApi` object with typed methods.
- **`src/stores/auth.js`** — Pinia auth store with `bootstrap()` (resolves the initial auth-state check), `signIn()`, `signOut()`.
- **`src/stores/parameters.js`** — Pinia store for the parameter list. On 409 during update, it automatically swaps the local row with `details.current` and returns `{ ok: false, conflict: true, current }` so the UI can show the latest state.
- **`src/router/index.js`** — routes for `/` (requires auth) and `/signin` (guest-only) with nav guards.
- **`src/views/SignInView.vue`** — centered sign-in form matching the reference screenshot (pink gradient top bar, logo, email/password, "Sign in" button, footer); Firebase error-code → user-friendly message mapping.
- **`src/views/ParametersView.vue`** — main panel. Uses a `matchMedia` listener to render `ParameterTable` on desktop and `ParameterCards` on mobile; always-visible "new parameter" row at the bottom of the table (matches the reference screenshot); wires up edit modal and delete confirmation. Surfaces conflict banner inside the modal when an update loses to a concurrent edit.
- **`src/components/LogoMark.vue`** — inline SVG logo mark (pink gradient) matching the screenshots.
- **`src/components/AppHeader.vue`** — header with logo + user dropdown (shows email, sign-out action); proper click-outside-to-close behavior.
- **`src/components/ParameterTable.vue`** — desktop grid-based table with `Parameter Key / Value / Description / Create Date ↓` columns, edit/delete actions, and a small badge showing count of country overrides.
- **`src/components/ParameterCards.vue`** — mobile card view matching the reference mobile screenshot.
- **`src/components/ValueInput.vue`** — dual-mode input. Defaults to a single-line text input; toggles to a multi-line JSON editor with validation. Auto-switches to JSON mode when the incoming value is an object/array. Emits `valid-change` so the parent can disable Save while JSON is malformed.
- **`src/components/CountryOverridesEditor.vue`** — UI for managing per-country overrides: add/remove countries, per-country `ValueInput`, and an **AI suggestions** panel that calls the backend and shows each proposal with its rationale, an "Apply" button, and a "Dismiss" button. Validates country codes as ISO 3166-1 alpha-2.
- **`src/components/EditParameterModal.vue`** — modal for editing a parameter: default-value editor, description, and the country-overrides section. Sends `expectedVersion` so the server can detect conflicts. Accepts a ref-based `setError()` so the parent can inject a conflict banner without closing the modal.

### Architecture decisions logged

- **Optimistic concurrency via a `version` field.** Simpler than pessimistic locking; aligned with Firestore transactions. No silent overwrites.
- **Two auth modes, one codebase.** Panel uses Firebase ID tokens (matches Firebase-Auth-based admin login); mobile clients use a pre-shared token (no per-device state needed, easy to rotate).
- **Country resolution happens server-side at read time.** Keeps the mobile response a flat `{ key: value }` map — clients don't need to know overrides exist.
- **AI is assistive, not autonomous.** Backend only returns suggestions; `countryOverrides` can only change through an explicit PUT that includes `expectedVersion`. Nothing bypasses the review step.
- **Separate services, separate containers.** Backend is deployable on any container host (Cloud Run recommended); frontend is a static SPA deployable anywhere.
