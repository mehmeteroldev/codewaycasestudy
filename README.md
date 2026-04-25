# Codeway — Remote Config Management System

A web panel and REST API for managing mobile-app remote configuration. Admins edit parameters in the panel; mobile clients fetch them as a flat JSON map, optionally tailored per country.

- **Panel** (`frontend/`) — Vue 3 + Vite + Pinia. Admin sign-in via Firebase Auth, parameter CRUD, AI-assisted country overrides.
- **API** (`backend/`) — Node.js + Express + Firestore. Two surfaces: a public mobile endpoint and a Firebase-authenticated panel endpoint.

---

## Table of contents

1. [Functionality](#1-functionality)
2. [Architecture](#2-architecture)
3. [Data model](#3-data-model)
4. [API reference](#4-api-reference)
5. [Concurrency control](#5-concurrency-control)
6. [AI-assisted country suggestions](#6-ai-assisted-country-suggestions)
7. [Local setup](#7-local-setup)
8. [Environment variables](#8-environment-variables)
9. [Deployment](#9-deployment)
10. [Repository layout](#10-repository-layout)

---

## 1. Functionality

### What it does
- **Manage parameters** — admins create/edit/delete typed key/value pairs (strings, numbers, booleans, JSON). Each parameter carries an optional human-readable description.
- **Country audiences** — every parameter can carry per-country overrides (`countryOverrides: { TR: …, DE: … }`). Mobile clients sending `?country=XX` receive the override for that country; everyone else receives the default value.
- **AI-assisted overrides** — when editing a parameter, the admin can ask an LLM to propose locale-appropriate values. Two flows:
  - **Multi-country** — model picks up to 10 globally-distinct markets from its own knowledge of GDP rankings.
  - **Single-country** — admin types a code (e.g. `TR`), the model proposes one value targeted at that country.
  Suggestions are always reviewed by the admin via Apply / Dismiss; nothing is auto-persisted.
- **Concurrency control** — two admins editing the same parameter cannot silently overwrite each other. Updates require an `expectedVersion` and the server rejects stale writes with `409 Conflict` plus the latest server state.
- **Mobile config endpoint** — protected by a pre-shared `x-api-key`, rate-limited, returns a flat `{ key: value }` map with country resolution baked in.

### Roles
- **Admin** — Firebase user (Email/Password). Full CRUD over parameters via the panel.
- **Mobile client** — anonymous, identified by `x-api-key`. Read-only on `/api/config`.

---

## 2. Architecture

```
Mobile app  ──GET /api/config?country=XX── [x-api-key]   ┐
                                                          ├──► Firestore (collection: parameters)
Web panel   ──/api/panel/*                ── [Firebase ID]┘
                                                    │
                                                    └──► LLM Model (optional)
```

Backend layers: `routes → controllers → services → repositories`. Middleware handles Firebase Auth, the mobile API token, rate limiting, and error normalization. All external inputs are validated at the service boundary.

The LLM is provider-agnostic. The SDK is OpenAI's, but `LLM_BASE_URL` lets you point at any OpenAI-compatible endpoint (Gemini, Groq, OpenRouter, Ollama).

---

## 3. Data model

Parameter document — Firestore path `parameters/{id}`:

| Field              | Type                     | Notes                                                   |
| ------------------ | ------------------------ | ------------------------------------------------------- |
| `key`              | string                   | Unique; matches `[a-zA-Z][a-zA-Z0-9_]{0,63}`            |
| `value`            | any JSON-serializable    | Default value. Primitive or JSON object/array.          |
| `description`      | string                   | Human-readable.                                         |
| `countryOverrides` | `{ [ISO-3166 α2]: any }` | Per-country value overrides.                            |
| `version`          | integer                  | Incremented on every update (concurrency control).      |
| `createdAt`        | Timestamp                | Server timestamp.                                       |
| `updatedAt`        | Timestamp                | Server timestamp.                                       |

---

## 4. API reference

| Method | Path                                       | Auth                | Purpose                              |
| ------ | ------------------------------------------ | ------------------- | ------------------------------------ |
| GET    | `/healthz`                                 | none                | Liveness probe.                      |
| GET    | `/api/config?country=XX`                   | `x-api-key`         | Mobile clients fetch merged config.  |
| GET    | `/api/panel/parameters`                    | Firebase ID token   | List parameters.                     |
| POST   | `/api/panel/parameters`                    | Firebase ID token   | Create a parameter.                  |
| PUT    | `/api/panel/parameters/:id`                | Firebase ID token   | Update (requires `expectedVersion`). |
| DELETE | `/api/panel/parameters/:id`                | Firebase ID token   | Delete.                              |
| POST   | `/api/panel/parameters/suggest-countries`  | Firebase ID token   | AI suggestions for country values.   |

### Mobile config response

A flat `{ key: value }` JSON object. For each parameter, the value is `countryOverrides[country]` if that country has an override, otherwise `value`.

```bash
# Default (no country)
curl -H "x-api-key: $TOKEN" https://api.example.com/api/config
# { "minimumVersion": "1.0", "latestVersion": "2.1", ... }

# Country-targeted
curl -H "x-api-key: $TOKEN" "https://api.example.com/api/config?country=TR"
# { "minimumVersion": "1.0", "latestVersion": "2.2", ... }
```

The endpoint is rate-limited (120 req/min/IP) and sets `Cache-Control: public, max-age=60` so clients/CDNs can cache responses.

### Error shape

All errors come back in a consistent shape:

```json
{ "error": { "message": "...", "details": { ... } } }
```

`409 Conflict` from `PUT /api/panel/parameters/:id` includes `details.current` — the latest server state. The panel uses this to refresh its in-memory copy.

---

## 5. Concurrency control

Two admins open the same parameter, both edit, last save wins — that's the failure we prevent. The mechanism is optimistic locking:

1. Every parameter document carries a `version` integer.
2. On `PUT`, the client sends `expectedVersion` — the version it originally loaded.
3. The backend updates inside a Firestore transaction: re-reads the doc, compares versions, then either bumps the version and writes, or rejects with `409 Conflict` and `details.current` containing the latest server state.
4. The panel catches the 409, swaps its in-memory row with the returned current state, and surfaces an inline banner asking the user to review and retry.

No silent overwrites, no extra round-trips on the happy path.

---

## 6. AI-assisted country suggestions

`POST /api/panel/parameters/suggest-countries`

**Request:**
```json
{
  "key": "pricing_tier",
  "description": "User's pricing tier",
  "defaultValue": "t6",
  "country": "TR"   // optional — if present, single-country mode
}
```

**Response:**
```json
{
  "lenses": ["currency"],
  "reasoning": "Pricing tiers are PPP-sensitive...",
  "suggestions": [
    { "country": "TR", "value": "t3", "rationale": "Lower-PPP market." }
  ]
}
```

**Two modes:**
- **Multi-country (default)** — model picks up to 10 high-GDP countries that are most distinct along the inferred localization lens (language, currency, regulation, network, content, rollout, time). No hardcoded country list — the server only validates ISO alpha-2, dedupes, and caps the response.
- **Single-country** — when `country` is provided, the prompt switches to a focused variant that infers the value's *family* (tiers, plans, versions, regional buckets) and proposes another member of that family suited to the target market. This avoids the "model returns the default unchanged" failure mode for opaque codes.

**Robustness:**
- Strict JSON via `response_format: { type: 'json_object' }`, with a markdown-fence-stripping retry as a safety net.
- Validation: ISO alpha-2 codes only, deduped, length-capped.
- Provider/network errors mapped to actionable HTTP statuses (`401/403 → 502`, `429 → 503`, etc.).
- If `LLM_API_KEY` is unset the endpoint returns `503` and the UI surfaces the message cleanly.
- The admin always confirms via "Apply" — nothing is auto-persisted.

---

## 7. Local setup

### Prerequisites
- Node.js ≥ 18
- A Firebase project with **Authentication** and **Firestore** enabled
- (optional) An OpenAI-compatible API key for AI suggestions

### 7.1 Firebase project setup

1. Create a project in the [Firebase Console](https://console.firebase.google.com).
2. **Authentication → Sign-in method:** enable **Email/Password**. Create at least one admin user under **Users**.
3. **Firestore Database:** create a database in production mode. The `parameters` collection is created on first write.
4. **Project settings → Service accounts → Generate new private key** — downloads the credential JSON for the backend.
5. **Project settings → General → Your apps → Web app** — register a web app and copy `apiKey`, `authDomain`, `projectId`, `appId` for the frontend.

### 7.2 Backend

```bash
cd backend
cp .env.example .env
# Fill MOBILE_API_TOKEN (long random string)
# Fill either GOOGLE_APPLICATION_CREDENTIALS (path) OR FIREBASE_SERVICE_ACCOUNT_JSON (inline JSON)
# (optional) LLM_API_KEY for AI suggestions
npm install
npm run dev              # starts on :8080
```

Smoke-test:
```bash
curl http://localhost:8080/healthz
curl -H "x-api-key: $MOBILE_API_TOKEN" http://localhost:8080/api/config
```

### 7.3 Frontend

```bash
cd frontend
cp .env.example .env
# VITE_API_BASE_URL = http://localhost:8080
# VITE_FIREBASE_*   = from your Firebase web-app config
npm install
npm run dev              # starts on :5173
```

Open `http://localhost:5173`, sign in with the Firebase admin account.

**Test admin account** (case-study environment only — do **not** reuse in production):

| Email             | Password |
| ----------------- | -------- |
| `admin@admin.com` | `admin1` |

---

## 8. Environment variables

### Backend (`backend/.env`)

| Variable                          | Required          | Purpose                                                     |
| --------------------------------- | ----------------- | ----------------------------------------------------------- |
| `PORT`                            | no (default 8080) | HTTP port.                                                  |
| `NODE_ENV`                        | no                | `development` or `production`.                              |
| `CORS_ORIGINS`                    | yes in production | Comma-separated allowlist of panel origins.                 |
| `MOBILE_API_TOKEN`                | **yes**           | Pre-shared token for `/api/config`.                         |
| `FIREBASE_SERVICE_ACCOUNT_JSON`   | one of these two  | Firebase Admin credential as inline JSON (best for PaaS).   |
| `GOOGLE_APPLICATION_CREDENTIALS`  | one of these two  | Path to the service-account JSON file on disk.              |
| `LLM_API_KEY` / `OPENAI_API_KEY`  | no                | Enables AI suggestions. Any OpenAI-compatible provider.     |
| `LLM_MODEL` / `OPENAI_MODEL`      | no                | Default `gemini-2.5-flash-lite`.                            |
| `LLM_BASE_URL`                    | no                | Override for non-Gemini OpenAI-compatible endpoints.        |

### Frontend (`frontend/.env`)

| Variable                      | Required | Purpose                                |
| ----------------------------- | -------- | -------------------------------------- |
| `VITE_API_BASE_URL`           | yes      | Backend base URL (no trailing slash).  |
| `VITE_FIREBASE_API_KEY`       | yes      | Firebase web-app config.               |
| `VITE_FIREBASE_AUTH_DOMAIN`   | yes      |                                        |
| `VITE_FIREBASE_PROJECT_ID`    | yes      |                                        |
| `VITE_FIREBASE_APP_ID`        | yes      |                                        |

---

## 9. Deployment

The two services are independent and deploy separately.

### 9.1 Backend → Google Cloud Run (recommended) or any container host

A `Dockerfile` is included.

```bash
# 1. Build & push to Artifact Registry
gcloud auth configure-docker LOCATION-docker.pkg.dev
docker build -t LOCATION-docker.pkg.dev/PROJECT/config-api/config-api:latest ./backend
docker push     LOCATION-docker.pkg.dev/PROJECT/config-api/config-api:latest

# 2. Deploy
gcloud run deploy config-api \
  --image LOCATION-docker.pkg.dev/PROJECT/config-api/config-api:latest \
  --region LOCATION \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production,MOBILE_API_TOKEN=...,CORS_ORIGINS=https://panel.example.com" \
  --set-env-vars "FIREBASE_SERVICE_ACCOUNT_JSON=..."   # paste as one line
```

**Render / Heroku / Fly.io** work the same way — push the `backend/` Dockerfile and set the env vars above. When the service-account JSON is too large for a single env-var field, mount it as a secret file and point `GOOGLE_APPLICATION_CREDENTIALS` at the mount path.

### 9.2 Frontend → Firebase Hosting / Vercel / Netlify

```bash
cd frontend
npm install
npm run build        # outputs to frontend/dist
```

- **Firebase Hosting:** `firebase init hosting` (set public dir to `dist`), then `firebase deploy --only hosting`.
- **Vercel / Netlify:** point at `frontend/`, build command `npm run build`, output `dist`. Add all `VITE_*` env vars in the project settings.
- Any static host works — the app is a pure SPA. Configure a fallback rewrite to `/index.html` so deep links (e.g. `/signin`) work on refresh.

### 9.3 Firestore security

The backend uses the Admin SDK, which bypasses Firestore security rules. If you don't expose Firestore directly to clients, lock down the default rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /{document=**} { allow read, write: if false; }
  }
}
```

### 9.4 Going to production checklist

- [ ] `NODE_ENV=production` and `CORS_ORIGINS` set to the deployed panel origin
- [ ] `MOBILE_API_TOKEN` is a long, random secret distributed to mobile clients via a secure channel
- [ ] Firebase Admin credential supplied via secret/secret-mount, not committed to source
- [ ] Firestore rules locked down (above)
- [ ] Frontend `VITE_API_BASE_URL` points at the deployed backend
- [ ] At least one Firebase user exists with admin Email/Password access
- [ ] Optional: `LLM_API_KEY` set if AI suggestions should be enabled

---

## 10. Repository layout

```
backend/
  src/
    config/          env + firebase admin init
    constants/       shared regex patterns
    middleware/      firebaseAuth, apiToken, errorHandler
    routes/          panelRoutes, configRoutes
    controllers/     thin HTTP adapters
    services/        parameterService, suggestionService (business logic)
    repositories/    parameterRepository (Firestore access)
    utils/           httpError, asyncHandler
    app.js           Express app wiring
    server.js        bootstrap + graceful shutdown
  Dockerfile
  .env.example

frontend/
  src/
    views/           SignInView, ParametersView
    components/      AppHeader, LogoMark, ParameterTable, ParameterCards,
                     EditParameterModal, ValueInput, CountryOverridesEditor
    services/        firebase, api (axios client with ID-token interceptor)
    stores/          auth, parameters (Pinia)
    router/          Vue Router with auth guards
    styles/          main.css (design tokens + base styles)
    utils/           format, validators
  public/fonts/      local font files
  .env.example
  index.html
  vite.config.js

README.md
```
