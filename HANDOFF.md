# Reel Machine — Client Handoff Guide

## What You're Getting

An autonomous pipeline that generates short-form vertical video ads (9:16, 30fps, ~30s). You configure a product in a Google Sheet, click a button, review and approve scenarios, and the system renders videos and publishes them to YouTube.

**Stack:** Express API + n8n + Caddy on Docker, deployed to a VPS.

---

## Prerequisites

You need accounts on these services (all have free tiers):

| Service | What For | Sign Up |
|---------|----------|---------|
| **Anthropic** | AI scenario generation (Claude) | https://console.anthropic.com |
| **ElevenLabs** | Text-to-speech narration | https://elevenlabs.io |
| **HeyGen** | AI avatar video generation | https://heygen.com |
| **fal.ai** | AI b-roll video generation | https://fal.ai |
| **Google Cloud** | Sheets API + YouTube OAuth | https://console.cloud.google.com |
| **Cloudflare** | R2 video storage | https://dash.cloudflare.com |
| **VPS provider** | Hosting (Docker, 4GB+ RAM) | Hetzner, DigitalOcean, etc. |
| **Domain** | SSL + stable URL | Any registrar |

Optional:
| **Resend** | Email notifications (SMTP) | https://resend.com |
| **Pexels** | Stock video fallback | https://pexels.com/api |

---

## Step 1: Get API Keys

### Anthropic
1. https://console.anthropic.com → API Keys → Create Key
2. Copy the `sk-ant-...` key

### ElevenLabs
1. https://elevenlabs.io → Profile → API Key
2. Also note your **Voice ID** (Profile → Voices → click voice → ID in URL)

### HeyGen
1. https://heygen.com → Settings → API → Generate Key
2. Note your **Avatar ID** (Avatars → click avatar → ID)

### fal.ai
1. https://fal.ai → Dashboard → API Keys → Create
2. Format: `key_id:key_secret`

### Google Cloud (Sheets API)
1. Create project at https://console.cloud.google.com
2. Enable **Google Sheets API** (APIs & Services → Library)
3. Create **Service Account** (APIs & Services → Credentials → Create → Service Account)
4. Download JSON key → save as `google-sa-key.json`
5. Note the service account email (e.g. `name@project.iam.gserviceaccount.com`)

### Google Cloud (YouTube API)
1. Enable **YouTube Data API v3** in same project
2. Create **OAuth 2.0 credentials** (Credentials → Create → OAuth client ID → Web application)
3. Add redirect URI: `https://YOUR_DOMAIN/rest/oauth2-credential/callback`
4. Note **Client ID** and **Client Secret** — you'll use these in n8n

### Cloudflare R2
1. https://dash.cloudflare.com → R2 Object Storage → Create bucket (name: `reel-machine`)
2. Enable **Public Development URL** (bucket Settings → Public Development URL → Enable)
3. Create **API Token** (R2 overview → Manage R2 API Tokens → Create)
4. Note: **Account ID** (from URL), **Access Key ID**, **Secret Access Key**, **S3 Endpoint** (from bucket Settings), **Public URL**

---

## Step 2: Setup VPS

Requirements: Ubuntu 22+, Docker installed, 4GB+ RAM, domain pointed to VPS IP.

```bash
# Clone repo
git clone <repo-url> /opt/reel-machine
cd /opt/reel-machine

# Create .env from template
cp .env.example .env
nano .env  # fill in all keys (see below)

# Copy Google service account key
scp google-sa-key.json server:/opt/reel-machine/

# Start everything
docker compose up -d --build
```

### .env Configuration

```bash
# ── API keys ──
ELEVENLABS_API_KEY=sk_...
ELEVENLABS_VOICE_ID=...          # Your chosen voice
HEYGEN_API_KEY=sk_...
HEYGEN_AVATAR_ID=...             # Your chosen avatar
FAL_KEY=key_id:key_secret
PEXELS_API_KEY=...               # Optional

# ── API Server ──
PORT=3001
API_SECRET=<generate-random-string>  # openssl rand -hex 32

# ── Google Sheets ──
GOOGLE_SHEETS_ID=<from-sheet-url>
GOOGLE_SERVICE_ACCOUNT_KEY=./google-sa-key.json

# ── Claude ──
ANTHROPIC_API_KEY=sk-ant-...
SCENARIO_MODEL=claude-sonnet-4-6     # or claude-haiku-4-5-20251001 (cheaper)

# ── Cloudflare R2 ──
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=reel-machine
R2_ENDPOINT=https://<ACCOUNT_ID>.<REGION>.r2.cloudflarestorage.com
R2_PUBLIC_URL=https://pub-<ID>.r2.dev

# ── n8n (internal Docker network) ──
N8N_WEBHOOK_URL=http://n8n:5678/webhook/reel-pipeline
```

### Caddyfile

Edit `Caddyfile` — replace domain:
```
your-domain.com {
    handle /api/* {
        reverse_proxy api:3001
    }
    handle /* {
        reverse_proxy n8n:5678
    }
}
```

### DNS

Add A record: `your-domain.com` → VPS IP address (Cloudflare: proxy OFF for Caddy SSL).

---

## Step 3: Setup Google Sheet

```bash
# From your local machine or VPS
npx tsx scripts/setup-sheet.ts
```

This creates 5 tabs: **Config**, **Scenarios**, **Log**, **Models**, **Avatars**.

**Share the Sheet** with your service account email (Editor access).

### Config Tab

Fill in the vertical key-value pairs:

| Key | What to fill |
|-----|-------------|
| product_name | Your product name |
| website | Your domain |
| product_description | 2-3 paragraph description |
| product_features | Bullet list of features |
| target_audience | Who are they, what do they need |
| pain_points | Problems your product solves |
| key_messages | Main selling points |
| competitors_diff | What makes you different |
| brand_voice | Tone, style guidance |
| language | `en` |
| caption_style | `bold-pop` |
| broll_model | Pick from Models tab (e.g. `veo-3.1-lite`) |
| tts_replacements | One per line: `YourProduct → pronunciation` |
| batch_size | How many scenarios per generation (1-5) |
| alert_email | Email for notifications |

### Avatars Tab

Pipeline rotates through active avatars (round-robin). Each row:

| Column | What |
|--------|------|
| Name | Short name (e.g. `skyler`) |
| HeyGen Avatar ID | From HeyGen dashboard (Avatars → click → ID) |
| Voice ID | ElevenLabs voice ID |
| Description | Human-readable note |
| Active | `yes` or `no` — only active avatars are used |

Add as many avatars as you want. Set `Active` to `no` to temporarily disable one without deleting it.

### Apps Script

1. Open Sheet → Extensions → Apps Script
2. Paste contents of `config/apps-script.js`
3. Update `API_URL` to your domain and `API_SECRET` to match `.env`
4. Save → refresh Sheet → "Reel Machine" menu appears

---

## Step 4: Setup n8n

1. Open `https://your-domain.com/` → create admin account
2. Import workflow: Workflows → Import → paste `config/n8n-workflow.json`
3. Configure credentials:
   - **SMTP** (for email): host `smtp.resend.com`, port 587, user `resend`, password = Resend API key
   - **YouTube** (for publishing): Client ID + Client Secret from Google Cloud OAuth → Sign in with Google
4. Update API URLs in HTTP Request nodes if your domain differs
5. Activate workflow (toggle ON)

### n8n Workflow Overview

```
Cron (Mon+Thu 10:00) → Poll Sheets → triggers reel generation

Pipeline Webhook ← API calls after render
  → Success? → Email with "Approve & Publish" link
  → Failed? → Error email

Approve Webhook ← client clicks email link
  → Update Sheet: approved_final
  → Download video from R2
  → YouTube Upload
  → Update Sheet: published
  → Email: Published with YT link
```

---

## Step 5: Deploy to Production

```bash
ssh root@your-vps
cd /opt/reel-machine
docker compose up -d --build
```

Verify:
```bash
curl https://your-domain.com/api/health
# → {"ok":true,"timestamp":"..."}
```

---

## Daily Usage

### Generate Scenarios
1. Open Google Sheet → menu **Reel Machine → Generate scenarios**
2. Wait ~30s → new rows appear in Scenarios tab with status `draft`

### Approve for Rendering
1. Review scripts in Scenarios tab
2. Change status from `draft` to `approved`
3. Pipeline picks it up on next poll (or click Reel Machine → Poll status)
4. Status changes: `approved` → `generating` → `ready_for_review`

### Publish
1. You receive email "Reel ready" with video preview link
2. Click "Approve & Publish"
3. Video uploads to YouTube as Short
4. You receive "Published" email with YouTube link
5. Status in Sheet changes to `published`

---

## Costs per Reel (approximate)

| Component | Cost |
|-----------|------|
| Scenario generation (Claude Sonnet) | ~$0.11 |
| Audio narration (ElevenLabs) | ~$0.14 |
| Avatar video (HeyGen, 5 clips) | ~$0.23 |
| B-roll video (veo-3.1-lite, 4 clips) | ~$0.12 |
| **Total per reel** | **~$0.60** |

B-roll cost varies by model. See Models tab in Sheet.

---

## B-Roll Models

Available in the Models tab. Cheapest tested options:

| Model | $/sec | Resolution | Notes |
|-------|-------|-----------|-------|
| `veo-3.1-lite` | $0.03 | 720p | Best value, great realism |
| `ltx-2.3-fast` | $0.04 | 1080p | Cheapest 1080p |
| `kling-3.0-std` | $0.084 | 1080p | Proven, reliable |

Change `broll_model` in Config tab to switch.

---

## Troubleshooting

### Pipeline fails
- Check Log tab in Sheet for error messages
- SSH to VPS: `docker logs reel-machine-api-1`
- Status auto-reverts to `approved` for retry

### n8n webhook not working
- Verify workflow is **active** (toggle ON)
- Check n8n Executions tab for errors
- Verify `N8N_WEBHOOK_URL` in `.env` is `http://n8n:5678/webhook/reel-pipeline` (internal Docker)

### YouTube upload fails
- Check YouTube OAuth credentials in n8n (may need re-auth)
- Ensure YouTube Data API v3 is enabled in Google Cloud
- Check n8n Executions for error details

### Remotion render OOM
- VPS needs 4GB+ RAM
- Only one render at a time (mutex in API)
- If persistent: upgrade VPS or use smaller resolution b-roll model

### Google Sheet "Unauthorized"
- Verify service account has Editor access to Sheet
- Check `GOOGLE_SERVICE_ACCOUNT_KEY` path in `.env`
