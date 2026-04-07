# Reel Machine — API Layer Implementation Spec

## Context for the coding agent

You are extending an existing TypeScript/Node.js video pipeline (`reel-machine/`). The pipeline already handles: script → audio → avatar + b-roll + music → assembly → Remotion render → upload to Cloudflare R2. Your job is to build an **Express API layer** and **Google Sheets integration** on top of this pipeline, turning it into a self-service product for a client.

### What already exists (DO NOT modify)
- `src/pipeline/` — video generation pipeline
- `src/orchestrate.ts` — main orchestration logic
- `src/components/` — Remotion components
- `src/types.ts` — shared types
- `products/` — product knowledge bases (markdown, JSON)
- `knowledge/` — narrative guidelines, scenario format specs
- `scenarios/` — generated scenario files

### What you are building (NEW code)
- Express API server with 5 endpoints
- Google Sheets read/write integration (Sheets = database + client UI)
- Claude-powered scenario generation with Zod validation
- Notification system (email + Slack)
- Social media publishing (YouTube + Instagram)
- Apps Script snippet for the client's Google Sheet

---

## Architecture overview

```
Google Sheets (client UI + data store)
    │
    ├── Apps Script button → POST /api/generate-scenarios
    │
    └── System cron (every 30 min) → POST /api/poll-sheets
                                        ├── finds "approved" → POST /api/generate-reel/:id
                                        └── finds "approved_final" → POST /api/publish/:id
                                                    │
Express API (localhost:3001)                        │
    │                                               │
    ▼                                               ▼
Existing pipeline (orchestrate.ts)          YouTube + Instagram APIs
    │
    ▼
Cloudflare R2 (video storage)
```

The Express server runs on the same machine as the pipeline. In production: behind Caddy reverse proxy (auto HTTPS), managed by PM2, deployed via Docker.

---

## Google Sheets structure

The client interacts ONLY through Google Sheets. Three tabs:

### Tab: Config (single row, client edits)

| Column | Example | Purpose |
|---|---|---|
| product_name | Go2EV | Product name |
| website | go2ev.com | URL |
| product_description | AI monitoring for EV chargers... | Main product description (fed to LLM) |
| target_audience | CPO operators, hotels, parking lots | Target segments |
| brand_voice | Professional but energetic, data-driven | Tone guidance |
| language | en | Output language |
| avatar | skyler | Default avatar ID |
| caption_style | bold-pop | Caption style ID |
| broll_model | ltx-2 | AI model for b-roll generation |
| batch_size | 20 | How many scenarios per batch |
| batch_prompt | *(empty or custom)* | Optional steering prompt (e.g. "focus on hotel owners") |
| alert_email | client@go2ev.com | Notification email |
| alert_slack_webhook | *(optional)* | Slack webhook URL |

### Tab: Scenarios (system writes, client reviews and changes statuses)

| Column | Type | Description |
|---|---|---|
| id | string | UUID (auto-generated) |
| batch_id | string | Batch identifier (e.g. "2026-04-07-hotels") |
| title | string | Scenario title |
| framework | string | PAS / AIDA / BAB |
| script | string | Full narration text |
| scenes_json | string | JSON array of scenes (client doesn't edit this) |
| duration_sec | number | Target duration in seconds |
| status | string | State machine value (see below) |
| reel_url | string | R2 public URL after reel generation |
| publish_urls | string | "YT: ..., IG: ..." after publishing |
| cost | number | Generation cost in USD |
| created_at | string | ISO datetime |
| generated_at | string | ISO datetime |
| published_at | string | ISO datetime |
| error | string | Last error message (if any) |

### Tab: Log (system appends, client reads)

| Column | Type |
|---|---|
| timestamp | ISO datetime |
| action | generate-scenarios / generate-reel / publish / error |
| scenario_id | string |
| message | string |
| cost | number |

---

## Status state machine

```
draft ──────────► approved ──────────► generating
  │                  ▲                     │
  │                  │ (retry on fail)     │
  │                  └─────────────────────┘
  │                                        │
  ▼                                        ▼
(deleted/ignored)      ready_for_review
                            │
                            ▼
                      approved_final ─────► publishing ─────► published
                                                │
                                                ▼ (fail → retry)
                                          approved_final
```

**Client changes manually:** `draft → approved`, `ready_for_review → approved_final`
**System changes:** all other transitions. On failure: revert to previous actionable status + write error message.

---

## API endpoints

All endpoints are prefixed `/api/`. All except `poll-sheets` require `Authorization: Bearer <API_SECRET>` header.

### POST /api/generate-scenarios

**Trigger:** Apps Script button in Sheets
**Response:** synchronous, ~10-30s

Flow:
1. Read Config tab from Sheets (all fields)
2. Read existing scenario titles from Scenarios tab (to avoid duplicates)
3. Call Claude API with:
   - System prompt built from: `products/{product}/knowledge.md` + Config fields + `knowledge/narrative-guidelines.md` + `knowledge/scenario-format.md` + `products/{product}/broll-library.json`
   - User message: batch_prompt (if provided) + instruction to generate `batch_size` scenarios + list of existing titles to avoid
4. Parse Claude response as JSON array of scenarios
5. Validate each scenario with Zod schema
6. On Zod failure: retry with validation error feedback (max 2 retries)
7. Write validated scenarios to Scenarios tab with status `draft`
8. Append to Log tab
9. Return `{ success: true, count: N }`

### POST /api/generate-reel/:scenarioId

**Trigger:** poll-sheets cron
**Response:** immediate `{ status: "generating", scenarioId }`, processing is async

Flow:
1. Read scenario row from Sheets by ID
2. Update status → `generating`
3. Write `scenario.json` to `scenarios/{id}/`
4. Spawn `orchestrate.ts` as child process (async)
5. Return immediately
6. On pipeline completion:
   - Upload `reel.mp4` to Cloudflare R2 → get public URL
   - Update Sheets: status → `ready_for_review`, set `reel_url`, `cost`, `generated_at`
   - Send notification (email and/or Slack): "Reel ready for review: {title} — {reel_url}"
   - Append to Log
7. On pipeline failure:
   - Update Sheets: status → `approved` (back to queue), set `error`
   - Send alert: "Pipeline failed: {title} — {error}"
   - Append to Log

### POST /api/publish/:scenarioId

**Trigger:** poll-sheets cron
**Response:** synchronous

Flow:
1. Download reel from R2 (or use local path if still on disk)
2. Upload to YouTube via Data API v3 (title, description, tags, #Shorts)
3. Upload to Instagram via Meta Graph API
4. Update Sheets: status → `published`, set `publish_urls`, `published_at`
5. Send notification: "Published: {title} — YT: {url}, IG: {url}"
6. Append to Log

### POST /api/poll-sheets

**Trigger:** system cron every 30 min: `*/30 * * * * curl -s -X POST http://localhost:3001/api/poll-sheets`
**No auth required** (localhost only)

Flow:
1. Read all rows from Scenarios tab
2. Find first row with status `approved` → call `/api/generate-reel/:id`
3. Find first row with status `approved_final` → call `/api/publish/:id`
4. **Concurrency guard:** never generate more than 1 reel at a time (use in-memory mutex or flag file)

### GET /api/status/:scenarioId

Simple status check. Returns current status from Sheets + pipeline progress info if currently generating.

---

## File structure (new files only)

```
src/
├── api/
│   ├── server.ts              # Express app, middleware setup, route mounting
│   ├── routes/
│   │   ├── scenarios.ts       # POST /generate-scenarios handler
│   │   ├── reel.ts            # POST /generate-reel/:id handler
│   │   ├── publish.ts         # POST /publish/:id handler
│   │   └── poll.ts            # POST /poll-sheets handler
│   ├── sheets.ts              # Google Sheets API wrapper:
│   │                          #   readConfig(), readScenarios(), writeScenarios(),
│   │                          #   updateScenarioStatus(), appendLog()
│   ├── notifications.ts       # sendEmail() via Resend, sendSlack() via webhook
│   ├── storage.ts             # uploadToR2(), getPublicUrl()
│   └── auth.ts                # Bearer token middleware
│
├── scenario/
│   └── generate.ts            # buildPrompt(), callClaude(), zodValidate(), retryLoop()
│
├── publish/
│   ├── youtube.ts             # YouTube Data API v3 upload
│   └── instagram.ts           # Meta Graph API upload
```

---

## Apps Script (deliver to client)

Single file, pasted into the Sheet's Apps Script editor:

```javascript
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Reel Machine')
    .addItem('Generate scenarios', 'generateScenarios')
    .addToMenu();
}

function generateScenarios() {
  const ui = SpreadsheetApp.getUi();
  try {
    const response = UrlFetchApp.fetch('https://API_DOMAIN/api/generate-scenarios', {
      method: 'post',
      headers: { 'Authorization': 'Bearer API_SECRET' },
      contentType: 'application/json',
      muteHttpExceptions: true,
    });
    const result = JSON.parse(response.getContentText());
    if (result.success) {
      ui.alert('Done! Generated ' + result.count + ' scenarios.');
    } else {
      ui.alert('Error: ' + (result.error || 'Unknown error'));
    }
  } catch (e) {
    ui.alert('Connection error: ' + e.message);
  }
}
```

Client replaces `API_DOMAIN` and `API_SECRET` with values from `.env`.

---

## Security

- All external-facing endpoints require `Authorization: Bearer <API_SECRET>` header
- `auth.ts` middleware: compare header value to `process.env.API_SECRET`, return 401 on mismatch
- `poll-sheets` endpoint: either skip auth (bind Express to localhost only for this route) or require the same token
- Google Sheets API access: via service account (JSON key file, path in `.env`)
- HTTPS: handled by Caddy reverse proxy in production (not Express's concern)

---

## Environment variables (.env)

```bash
# Express server
PORT=3001
API_SECRET=                          # shared secret for Bearer auth

# Google Sheets
GOOGLE_SHEETS_ID=                    # spreadsheet ID from URL
GOOGLE_SERVICE_ACCOUNT_KEY=./google-sa-key.json

# Claude (scenario generation)
ANTHROPIC_API_KEY=

# Cloudflare R2 (video storage)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=reel-machine
R2_PUBLIC_URL=                       # e.g. https://pub-xxx.r2.dev

# Notifications
RESEND_API_KEY=
RESEND_FROM=                         # e.g. noreply@domain.com
SLACK_WEBHOOK_URL=                   # optional

# YouTube publishing
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
YOUTUBE_REFRESH_TOKEN=

# Instagram publishing
INSTAGRAM_ACCESS_TOKEN=
```

---

## Key libraries to use

- `express` — HTTP server
- `googleapis` (google-spreadsheet or raw googleapis) — Sheets API
- `@anthropic-ai/sdk` — Claude API
- `zod` — scenario validation
- `resend` — email notifications
- `@aws-sdk/client-s3` — R2 upload (S3-compatible)
- `googleapis` — YouTube upload
- No ORM, no database — Sheets IS the database

---

## Implementation order

Build and test in this sequence. Each phase should be independently testable.

### Phase 1: Express + Sheets integration
1. `server.ts` — Express app with auth middleware, health check endpoint
2. `sheets.ts` — full CRUD wrapper for all 3 tabs
3. `poll.ts` — reads Scenarios, logs what it would do (dry run)
4. **Test:** run locally, verify reads/writes against a test Sheet

### Phase 2: Scenario generation
1. `scenario/generate.ts` — Claude prompt builder + Zod validation + retry
2. `routes/scenarios.ts` — wires it together with Sheets
3. **Test:** call endpoint → verify scenarios appear in Sheet with status `draft`

### Phase 3: Pipeline integration
1. `routes/reel.ts` — spawn orchestrate.ts, handle completion callback
2. `storage.ts` — R2 upload
3. `notifications.ts` — email + Slack
4. Wire into poll-sheets (trigger on `approved`)
5. **Test:** set status to `approved` in Sheet → reel generated → link appears → notification sent

### Phase 4: Publishing
1. `publish/youtube.ts` + `publish/instagram.ts`
2. `routes/publish.ts`
3. Wire into poll-sheets (trigger on `approved_final`)
4. **Test:** set status to `approved_final` → published → links in Sheet

### Phase 5: Dockerize
1. `Dockerfile` — Node.js + ffmpeg + Chromium (for Remotion)
2. `docker-compose.yml` — Express + cron + env vars
3. `.env.example`
4. `README.md` — setup instructions for the client (devops)

---

## Deployment (production)

The client is an experienced devops engineer. Deliverable is a Docker setup:

```
git clone <repo>
cp .env.example .env
# fill in .env
docker compose up -d
```

`docker-compose.yml` should include:
- Express app (PM2 inside container for process management)
- Cron job (either separate container or cron inside main container)
- Restart policy: `unless-stopped`
- Health check

The client handles: VPS provisioning, reverse proxy (Caddy/Nginx), DNS, domain, HTTPS. The app binds to `localhost:${PORT}` and assumes a reverse proxy in front.

---

## Notes and constraints

- Google Sheets API rate limit: 60 req/min/user — use batch reads/writes where possible
- Apps Script timeout: 6 minutes — the `/generate-scenarios` endpoint must respond within that
- Remotion render is CPU-intensive — the concurrency mutex in poll-sheets is critical, never run 2 renders in parallel
- Claude API call for 20 scenarios: expect ~10-30s, budget for retries
- R2 free tier: 10GB storage, 10M reads/month — more than enough
- Scenario `scenes_json` column: store as stringified JSON, it's opaque to the client
