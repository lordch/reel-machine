# Reel Machine — Automated Video Ad Pipeline

## What This Is

Autonomous pipeline for generating short-form vertical video ads (9:16, 1080x1920, 30fps).
One Google Sheet = one product. Configure product knowledge, approve scenarios, get published reels.

## Architecture

```
Google Sheet (Config + Scenarios)
  → Apps Script menu → Express API
  → Generate scenarios (3-step Claude pipeline)
  → Approve in Sheet → Pipeline (audio→avatar→broll→render)
  → R2 upload → n8n webhook → email notification
  → Client clicks Approve → YouTube upload → Sheet: published
```

### Components
- **Express API** (`src/api/`) — scenario generation, pipeline orchestration, Sheets CRUD
- **n8n** — cron scheduling, email notifications, YouTube publishing, approval flow
- **Caddy** — reverse proxy with auto SSL
- **Docker Compose** — all three on one VPS

## Project Structure

```
src/
  api/              # Express server
    server.ts       # Entry point, route mounting
    auth.ts         # Bearer token middleware
    sheets.ts       # Google Sheets CRUD (Config, Scenarios, Log, Models)
    storage.ts      # R2 upload via S3 API
    routes/
      scenarios.ts  # POST /generate-scenarios
      reel.ts       # POST /generate-reel/:id, POST /update-status
      poll.ts       # POST /poll-sheets
  scenario/
    generate.ts     # 3-step: script → review → scenes (Claude API)
  pipeline/         # Video pipeline (audio, avatar, broll, music, assemble)
  orchestrate.ts    # Full pipeline runner
  components/       # Remotion React components
  types.ts          # Core types

config/
  apps-script.js    # Google Sheet menu script
  n8n-workflow.json # n8n workflow for import

knowledge/
  script-writing.md   # Prompt for script generation (step 1+2)
  scene-splitting.md  # Prompt for scene splitting + broll (step 3)

products/go2ev/     # Product assets (logo)
scripts/            # Setup scripts (setup-sheet.ts)
```

## Google Sheet Tabs

- **Config** — vertical key-value. Product knowledge, video settings, TTS replacements.
- **Scenarios** — one row per scenario. Status: draft→approved→generating→ready_for_review→approved_final→published
- **Log** — pipeline events, costs, errors
- **Models** — b-roll model library with pricing

## Key Conventions

- All video output is **9:16 portrait** (1080×1920, 30fps)
- Scenarios have **9 scenes** (5 avatar, 4 broll) strictly alternating A-B-A-B
- Scripts target **75 words** (±15) for 30s ads
- B-roll audio disabled on all models (we use our own narration + music)
- TTS replacements configured in Sheet (e.g. Go2EV → go to EV)
- Scenario generation uses extended thinking (1024 budget) + prompt caching
- Local files cleaned up after R2 upload

## Environment Variables

See `.env.example` for full list. Key services:
- ElevenLabs (TTS), HeyGen (avatar), fal.ai (b-roll), Anthropic (Claude)
- Google Sheets (service account), Cloudflare R2 (storage)
- n8n webhook URL (internal Docker: http://n8n:5678)
