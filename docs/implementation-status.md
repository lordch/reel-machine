# Reel Machine — Implementation Status

## Current state: Phase 1 COMPLETE

API server + Google Sheets integration working end-to-end.
Tested via ngrok → Apps Script → Express → Sheets API.

---

## What's done

### Phase 1: Express + Sheets integration
- [x] Express server (`src/api/server.ts`) — port 3001, health check
- [x] Auth middleware (`src/api/auth.ts`) — Bearer token validation
- [x] Google Sheets CRUD (`src/api/sheets.ts`) — readConfig, readScenarios, writeScenarios, updateScenarioStatus, appendLog
- [x] Poll dry-run route (`src/api/routes/poll.ts`) — reads Scenarios tab, reports pending actions
- [x] Generate scenarios stub (`src/api/routes/scenarios.ts`) — reads Config + Scenarios, placeholder for Claude
- [x] Sheet setup script (`scripts/setup-sheet.ts`) — creates tabs + headers programmatically
- [x] Apps Script (`docs/apps-script.js`) — custom menu in Sheet, calls API via ngrok
- [x] Dockerfile + docker-compose.yml (Docker build has credential issue, see below)
- [x] .env.example updated with all new vars
- [x] .gitignore updated for SA keys

### Infrastructure
- Google Sheet: 3 tabs (Config, Scenarios, Log) with headers + test data
- Service account: `reel-service@reel-machine-492612.iam.gserviceaccount.com`
- ngrok tunnel for local dev testing
- Apps Script authorized and working

### Known issues
- Docker build fails due to `docker-credential-desktop` not found (Docker Desktop config issue, not our code) — fix: either remove ECR auth from `~/.docker/config.json` or build with `--no-cache`
- ngrok URL changes on each restart (free tier) — update Apps Script accordingly

---

## What's next

### Phase 2: Scenario generation
1. `src/scenario/generate.ts` — buildPrompt() from product knowledge + config + guidelines
2. Claude API call with Zod validation + retry loop (max 2 retries with error feedback)
3. Wire into `POST /api/generate-scenarios` route
4. Test: Apps Script button → scenarios appear in Sheet with status `draft`

### Phase 3: Pipeline integration
1. `src/api/routes/reel.ts` — POST /generate-reel/:id, spawn orchestrate.ts
2. `src/api/storage.ts` — R2 upload (S3-compatible via @aws-sdk/client-s3)
3. `src/api/notifications.ts` — email (Resend) + Slack webhook
4. Concurrency mutex in poll-sheets (max 1 render at a time)
5. Pipeline completion/failure handlers with Sheet status updates
6. Test: set status `approved` → reel generated → link + notification

### Phase 4: Publishing
1. `src/publish/youtube.ts` — YouTube Data API v3 upload
2. `src/publish/instagram.ts` — Meta Graph API upload
3. `src/api/routes/publish.ts` — POST /publish/:id
4. Wire into poll-sheets (trigger on `approved_final`)
5. Test: set status `approved_final` → published → links in Sheet

### Phase 5: Production deployment
1. Fix Dockerfile (add ffmpeg + Chromium for Remotion)
2. docker-compose with PM2 + cron
3. README with client setup instructions
4. Replace ngrok with Caddy reverse proxy + real domain

---

## File structure (API layer)

```
src/api/
├── server.ts          # Express app, middleware, route mounting
├── auth.ts            # Bearer token middleware
├── sheets.ts          # Google Sheets CRUD (Config, Scenarios, Log)
└── routes/
    ├── scenarios.ts   # POST /generate-scenarios (stub, Phase 2 fills in Claude)
    └── poll.ts        # POST /poll-sheets (dry-run, Phase 3 adds triggers)

src/scenario/          # (Phase 2) Claude prompt builder + Zod validation
src/publish/           # (Phase 4) YouTube + Instagram uploaders

scripts/
└── setup-sheet.ts     # One-time Sheet setup (tabs + headers)

docs/
├── apps-script.js     # Client-side Apps Script for Google Sheet
├── reel-machine-api-spec.md  # Full API specification
└── implementation-status.md  # This file
```

---

## Environment

| Var | Purpose | Status |
|-----|---------|--------|
| PORT | Express server port | ✅ 3001 |
| API_SECRET | Bearer auth token | ✅ set |
| GOOGLE_SHEETS_ID | Spreadsheet ID | ✅ set |
| GOOGLE_SERVICE_ACCOUNT_KEY | SA key file path | ✅ set |
| NGROK_AUTHTOKEN | ngrok tunnel auth | ✅ set |
| ANTHROPIC_API_KEY | Claude API | ⏳ Phase 2 |
| R2_* | Cloudflare R2 storage | ⏳ Phase 3 |
| RESEND_API_KEY | Email notifications | ⏳ Phase 3 |
| YOUTUBE_* | YouTube publishing | ⏳ Phase 4 |
| INSTAGRAM_* | Instagram publishing | ⏳ Phase 4 |
