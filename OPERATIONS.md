# Reel Machine — Operations Manual

> Ten dokument jest **source of truth** dla pracy z tym projektem. Jeśli wracasz po przerwie i nie pamiętasz nic — czytaj od początku.

## 1. TL;DR — co to jest i jak działa

Pipeline generujący pionowe (9:16) reklamy video na YouTube Shorts / Reels.

```
Google Sheet                    Express API + Pipeline
─────────────                   ───────────────────────
 1. Otwierasz Sheet              Generuje scenariusze (Claude)
 2. Klikasz "Generate"     ──→   Generuje audio (ElevenLabs)
 3. Approve scenariusz           Generuje avatar (HeyGen)
 4. Pipeline rusza               Generuje b-roll (fal.ai)
                                 Renderuje (Remotion)
                                 Upload do R2
                                       │
                  ┌────────────────────┘
                  ▼
             n8n workflow
             ───────────
             Email "ready" → klient klika "Approve"
             Pobiera z R2 → upload YouTube
             Email "published"
```

Jeden Sheet = jeden produkt. Koszt per reel zależy od konfiguracji modeli (avatar version, b-roll model, scenario LLM) — patrz sekcja 9.

**Komponenty:**
- **Express API** w Dockerze na VPS-ie — orchestrates pipeline, czyta/pisze do Sheet
- **n8n** w Dockerze obok — cron, email, YouTube upload, approval flow
- **Caddy** w Dockerze — reverse proxy + auto SSL
- **Cloudflare R2** — storage video
- **Google Sheet** — UI dla konfiguracji produktu i statusu scenariuszy

---

## 2. URLs i konta

| Co | URL | Logujesz się jako |
|---|---|---|
| **Produkcja (n8n + API)** | https://reel.darkhelmettechnologies.com | admin account w n8n (osobne) |
| **GitHub repo** | https://github.com/lordch/reel-machine | lordch |
| **Google Sheet** | URL w `GOOGLE_SHEETS_ID` z `.env` | michalchelminski@gmail.com |
| **Hetzner Cloud** | https://console.hetzner.cloud | michalchelminski@gmail.com |
| **Cloudflare R2** | https://dash.cloudflare.com | michalchelminski@gmail.com |
| **Google Cloud Console** | https://console.cloud.google.com → project `reel-machine-492612` | michalchelminski@gmail.com |
| **Anthropic** | https://console.anthropic.com | michalchelminski@gmail.com |
| **ElevenLabs** | https://elevenlabs.io | michalchelminski@gmail.com |
| **HeyGen** | https://heygen.com | michalchelminski@gmail.com |
| **fal.ai** | https://fal.ai/dashboard | michalchelminski@gmail.com |
| **Resend (SMTP)** | https://resend.com | michalchelminski@gmail.com |

**VPS:**
- Host: `reel.darkhelmettechnologies.com` → `204.168.187.130`
- SSH: `ssh root@204.168.187.130` (twój klucz `~/.ssh/id_ed25519` — passphrase-encrypted)
- Pracujesz jako: `root`
- Kod żyje w: `/opt/reel-machine`
- Restart serwerów: w panelu Hetzner Cloud

---

## 3. Credentials Inventory

Wszystkie sekrety żyją w `/opt/reel-machine/.env` na VPS-ie (nie w git). 23 klucze, oto co każdy robi i jak go rotować.

### AI / API klucze

| Klucz | Serwis | Po co | Jak rotować |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic | Generowanie scenariuszy (3-step Claude pipeline z thinking + caching) | console.anthropic.com → API Keys → Create / Revoke |
| `ELEVENLABS_API_KEY` | ElevenLabs | Text-to-speech (głos lektora) | elevenlabs.io → Profile → API Key |
| `ELEVENLABS_VOICE_ID` | ElevenLabs | ID konkretnego głosu (nie wymaga rotacji) | Profile → Voices → klik → ID w URL |
| `HEYGEN_API_KEY` | HeyGen | Generowanie avatar video (Avatar IV) | heygen.com → Settings → API → Generate |
| `HEYGEN_AVATAR_ID` | HeyGen | Default avatar (fallback gdy w Sheecie nie ma listy) | heygen.com → Avatars → ID. Główna lista to **tab Avatars w Sheecie** (rotacja round-robin) |
| `FAL_KEY` | fal.ai | B-roll video generation (veo-3.1-lite etc.) | fal.ai/dashboard → API Keys. Format: `key_id:key_secret` |
| `PEXELS_API_KEY` | Pexels | Stock video fallback (rzadko używane) | pexels.com/api |
| `SCENARIO_MODEL` | (nie klucz) | Który model Claude używać: `claude-sonnet-4-6` lub `claude-haiku-4-5-20251001` | Edit w `.env` |

### Google

| Klucz | Po co | Jak rotować |
|---|---|---|
| `GOOGLE_SHEETS_ID` | ID twojego Sheeta (Config + Scenarios + Log + Models + Avatars) | URL Sheeta → fragment między `/d/` a `/edit` |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Ścieżka do pliku JSON z SA keys (default: `./reel-machine-492612-b8601a4a2d33.json`) | console.cloud.google.com → IAM → Service Accounts → `reel-service@reel-machine-492612.iam.gserviceaccount.com` → Keys → Add. **Po rotacji:** wgraj nowy plik na VPS, podmień ścieżkę w `.env`, restart API |
| `YOUTUBE_CLIENT_ID` + `YOUTUBE_CLIENT_SECRET` | OAuth aplikacji w GCP (do publikacji Shortów) | console.cloud.google.com → APIs → Credentials → OAuth 2.0 Client. **Nie ruszaj jeśli działa** — zmiana wymaga re-konfiguracji w n8n |
| `YOUTUBE_REFRESH_TOKEN` | Token long-lived do uploadu (wygenerowany przez OAuth flow) | **Najczęstsza przyczyna problemu**: wygasa po 6 miesiącach jeśli app w trybie "Testing". Re-login w n8n: Credentials → YouTube account → Reconnect |

**SA email do podzielenia się w Sheecie (jeśli kiedyś tworzysz nowy Sheet):**
`reel-service@reel-machine-492612.iam.gserviceaccount.com` (Editor access)

### Cloudflare R2 (storage)

| Klucz | Po co |
|---|---|
| `R2_ACCOUNT_ID` | ID konta Cloudflare |
| `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` | S3-compatible token (Manage R2 API Tokens → Create) |
| `R2_BUCKET_NAME` | `reel-machine` |
| `R2_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `R2_PUBLIC_URL` | `https://pub-0d3d4b6fb3bc49848e9437aa22daca01.r2.dev` (publiczny URL bucketa) |

Rotacja tokenu: dash.cloudflare.com → R2 → Manage R2 API Tokens → Roll. Nie kasuj starego dopóki nowy nie działa.

### Wewnętrzne (nie zewnętrzne API)

| Klucz | Po co |
|---|---|
| `PORT` | 3001, Express słucha na tym porcie wewnątrz kontenera |
| `API_SECRET` | Bearer token autoryzujący Apps Script → Express. **Musi być spójny w 3 miejscach:** `.env` na VPS, Apps Script w Sheecie (Extensions → Apps Script), HTTP Request nodes w n8n |
| `N8N_WEBHOOK_URL` | `http://n8n:5678/webhook/reel-pipeline` (komunikacja API → n8n po wewnętrznej sieci Docker) |
| `NGROK_AUTHTOKEN` | **Relikt** z lokalnego dev. Na VPS-ie nie używany. Można usunąć (ale nie szkodzi) |
| `RESEND_API_KEY` | **Relikt** — SMTP dla notyfikacji przeniesionych do n8n. Sam klucz w `.env` jest nieużywany — żywy klucz Resenda siedzi w n8n credentials (SMTP account) |

---

## 4. Jak zmienić kod (deploy)

```
1. Lokalnie albo na github.dev: edytujesz pliki
2. git add ... && git commit -m "..."
3. git push origin main
4. GitHub → repo lordch/reel-machine → Actions → "Deploy to VPS" → Run workflow
5. Czekasz ~2-3 min na zielony check
6. Smoke test step woła curl /api/health → musi zwrócić 200
```

**Bez SSH, bez kluczy lokalnie, bez Dockera lokalnie.** Wszystko klikasz na GitHubie.

**Co się dzieje pod spodem** ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)):
1. GH Actions runner SSH-uje do VPS-a deploy keyem ze secretów
2. Na VPS: `cd /opt/reel-machine && git fetch origin && git reset --hard origin/main`
3. `docker compose up -d --build` — rebuild API container, restart n8n+caddy zostają jak są
4. Sleep 15s, curl `/api/health`

**Rollback przy złym deploy:**
```bash
# lokalnie:
git revert HEAD
git push origin main
# Actions → Run workflow ponownie
```

---

## 5. Jak zmienić workflow n8n

n8n **nie deployuje się przez Git**. Workflow żyje w bazie SQLite na VPS-ie (`/var/lib/docker/volumes/reel-machine_n8n_data/_data/database.sqlite`).

```
1. Otwierasz https://reel.darkhelmettechnologies.com → logujesz się
2. Edit workflow → Save
3. Zmiana natychmiastowa, kontener nie wymaga restartu
```

**Backup robi się automatycznie** — patrz sekcja 7.

**Eksport do repo (opcjonalnie, dla dokumentacji):**
1. n8n UI → Workflows → ⋮ → Download
2. Nadpisz [config/n8n-workflow.json](config/n8n-workflow.json) w repo
3. Commit + push

To NIE jest CI/CD dla n8n — to tylko snapshot do disaster recovery.

---

## 6. Architektura — co gdzie żyje

```
┌─────────────────────────────────────────────────────────────┐
│  VPS Hetzner (204.168.187.130, reel.darkhelmettechnologies)  │
│                                                              │
│  /opt/reel-machine/        ← kod z GitHuba (git repo)        │
│    .env                    ← sekrety (NIE w git)             │
│    reel-machine-*.json     ← Google SA key (NIE w git)       │
│    scenarios/              ← runtime, generowane przez pipe  │
│                                                              │
│  Docker:                                                     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  reel-machine-api-1     (Express, Remotion, port 3001) │ │
│  │  reel-machine-n8n-1     (n8n, port 5678)              │ │
│  │  reel-machine-caddy-1   (Caddy, ports 80/443)         │ │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Docker volumes:                                            │
│    reel-machine_n8n_data    ← workflow + credentials       │
│    caddy_data, caddy_config ← SSL certs                    │
└─────────────────────────────────────────────────────────────┘
       │
       │ HTTPS via Caddy (auto SSL)
       ▼
   ┌────────────────────┐
   │  Klient            │
   │  (Google Sheet)    │  ← Apps Script woła API
   │  (n8n UI)          │  ← logujesz się tutaj
   └────────────────────┘

   ┌────────────────────┐
   │  Cloudflare R2     │  ← gotowe reele i backupy n8n
   └────────────────────┘
```

**Co przeżywa restart/redeploy:**
- ✅ `.env`, SA key (untracked w `.git`)
- ✅ n8n volume (wszystkie workflows + credentials + execution history)
- ✅ Caddy SSL certs

**Co NIE przeżywa `docker compose down -v`:**
- ❌ N8n volume (cała historia + OAuth tokens)
- ❌ Caddy certs (Caddy musi je wygenerować od nowa)

**Nigdy nie używaj `docker compose down -v` na produkcji** chyba że masz świeży backup n8n i akceptujesz utratę OAuth.

---

## 7. Backup n8n

### Co jest backupowane

Cały wolumen `reel-machine_n8n_data` — czyli:
- `database.sqlite` — workflow, credentials (zaszyfrowane), execution history
- `config` — **klucz szyfrowania credentiali** (bez niego SQLite jest bezużyteczny)
- `nodes/`, `storage/`

### Gdzie i kiedy

- **Częstotliwość:** codziennie 03:00 (cron na VPS)
- **Lokalizacja:** Cloudflare R2 bucket `reel-machine`, prefix `backups/n8n/n8n-YYYY-MM-DD.tar.gz`
- **Retention:** ustaw ręcznie w R2 lifecycle policy → 30 dni (lub manualne czyszczenie)
- **Skrypt:** [scripts/backup-n8n.sh](scripts/backup-n8n.sh) na hoście, [scripts/backup-upload.ts](scripts/backup-upload.ts) wewnątrz API kontenera
- **Downtime n8n:** ~5-10s podczas tworzenia tarballa

### Restore

```bash
# 1. SSH do VPS
ssh root@204.168.187.130

# 2. Pobierz najnowszy backup z R2 (przez Cloudflare UI lub aws cli/curl)
#    Zapisz lokalnie jako /tmp/n8n-restore.tar.gz

# 3. Stop n8n
cd /opt/reel-machine
docker compose stop n8n

# 4. WAŻNE: backup current state przed restorem (na wszelki wypadek)
mv /var/lib/docker/volumes/reel-machine_n8n_data/_data /var/lib/docker/volumes/reel-machine_n8n_data/_data.bak.$(date +%s)
mkdir /var/lib/docker/volumes/reel-machine_n8n_data/_data

# 5. Rozpakuj backup
tar xzf /tmp/n8n-restore.tar.gz -C /var/lib/docker/volumes/reel-machine_n8n_data/_data

# 6. Start n8n
docker compose start n8n

# 7. Weryfikacja: zaloguj się do n8n UI, sprawdź workflows i credentials
```

### Restore na nowy VPS (disaster recovery)

Patrz sekcja 10.

---

## 8. Typowe problemy + diagnostyka

### Reel się nie generuje (status zostaje w `approved`)

```bash
# 1. Sprawdź status API
curl https://reel.darkhelmettechnologies.com/api/health
# Expected: {"ok": true, "timestamp": "..."}

# 2. Sprawdź logi API (ostatnie 50 linii)
ssh root@204.168.187.130 "docker logs --tail 50 reel-machine-api-1"

# 3. Sprawdź czy n8n cron leci — schedule jest w workflow node, sprawdź harmonogram + Executions tab
# Otwórz n8n UI → Workflows → Reel Machine → Schedule Trigger node

# 4. Sprawdź czy któryś klucz nie wygasł
# - HeyGen czasem rate-limituje przy darmowym koncie
# - Anthropic ma limity per minutę
# - fal.ai może mieć low balance

# 5. Sprawdź Log tab w Sheecie — może być błąd z poprzedniego runa
```

### YouTube upload nie działa

**Najczęstsza przyczyna:** OAuth refresh token wygasł (6 miesięcy w trybie "Testing").

```
1. Otwórz n8n UI → Credentials → YouTube account
2. Klik "Reconnect" → Sign in with Google → potwierdź uprawnienia
3. Save. Następny upload powinien już zadziałać
```

Jeśli credential w n8n ma `Sign in with Google` zamiast `Reconnect` — znaczy że klient OAuth się zmienił. Sprawdź `YOUTUBE_CLIENT_ID` w `.env` vs n8n.

### SSL nie działa (cert wygasł?)

```bash
ssh root@204.168.187.130 "docker logs --tail 20 reel-machine-caddy-1"
```

Caddy automatycznie odnawia. Jeśli widać błąd:
- DNS nie wskazuje na VPS? `dig reel.darkhelmettechnologies.com` → musi zwrócić `204.168.187.130`
- Port 80 zablokowany przez firewall? Caddy potrzebuje 80 do ACME challenge

### VPS pełen (no space)

```bash
ssh root@204.168.187.130 "df -h && docker system prune -af"
```

Najczęstsze winowajcy: stare obrazy Dockera, `/var/log` (auth.log), `scenarios/` (pipeline powinien sprzątać, ale czasem zostaje).

### n8n wolne / nie reaguje

```bash
ssh root@204.168.187.130 "docker stats --no-stream reel-machine-n8n-1"
```

3.7 GB RAM na VPS-ie + Remotion render może OOM-ować n8n. Jeśli powtarza się: upgrade Hetznera, ew. dodaj swap.

### Apps Script w Sheecie wyrzuca 401/403

API_SECRET się rozjechał. Sprawdź:
- `.env` na VPS → `cat /opt/reel-machine/.env | grep API_SECRET`
- Apps Script → Sheet → Extensions → Apps Script → `API_SECRET` const
- Musi być identyczny

---

## 9. Koszty

**Ważne:** pipeline jest **agnostyczny modelowo** — koszt per reel zależy od tego co masz wybrane w Configu (Sheet → Config tab). Liczby poniżej to **rzędy wielkości**, nie hardkodowane totale. Aktualne koszty per komponent zapisują się do Log tab w Sheecie po każdej generacji (kolumna `scenario_cost`).

### Co wpływa na koszt

| Komponent | Determinant | Zakres typowy |
|---|---|---|
| Scenariusz (Claude) | `SCENARIO_MODEL` w `.env` | Sonnet: ~$0.10-0.15 / Haiku: ~$0.02-0.04 |
| Audio narracji | długość skryptu w znakach (ElevenLabs per char) | ~$0.10-0.20 dla 30s reela |
| Avatar video | `avatar_version` w Sheet Config (III vs IV) | Avatar III: ~$0.20-0.30 / Avatar IV: ~$1.50 (7x droższy) |
| B-roll video | `broll_model` w Sheet Config (lista w Models tab) | $0.10-0.50 zależnie od modelu i ilości klipów |
| Render Remotion + R2 storage | wliczone w koszt VPS-a + R2 free tier (10 GB/mo) | ~$0 |

**Decyzje które realnie wpływają na koszt:**
- **Avatar III vs IV** — różnica ~7x. Avatar IV ma lepszą jakość lip-sync, ale przy dużej skali boli budżet
- **B-roll model** — w Models tab w Sheecie widzisz aktualne ceny. `veo-3.1-lite` ($0.03/sec) jest sweet-spotem; `kling-3.0-std` ($0.084/sec) lepszy ale 3x droższy
- **SCENARIO_MODEL** — Haiku do testów, Sonnet do produkcji (różnica jakości scenariuszy zauważalna)

### Gdzie sprawdzić rzeczywiste koszty

1. **Log tab w Sheecie** — każda generacja zapisuje wiersz z kosztem komponentów i sumą. Najdokładniejsze źródło bo z prawdziwego API response.
2. **Logi API** — po każdym pipeline'ie API loguje breakdown: `audio elevenlabs $X.XXX | broll fal.ai $X.XXX | avatar heygen $X.XXX | TOTAL $X.XXX`. Sprawdź: `ssh root@204.168.187.130 "docker logs reel-machine-api-1 | grep TOTAL | tail"`

### Gdzie sprawdzić billing per serwis

| Serwis | URL |
|---|---|
| Anthropic | console.anthropic.com → Usage |
| ElevenLabs | elevenlabs.io → Profile → Subscription |
| HeyGen | heygen.com → Settings → Billing |
| fal.ai | fal.ai/dashboard → Billing |
| Hetzner | console.hetzner.cloud → Billing (~€5/mo za VPS) |
| Cloudflare | dash.cloudflare.com → Billing (R2 praktycznie free do 10 GB/mo) |

---

## 10. Disaster recovery

### "VPS umarł, muszę postawić od zera"

Założenia: kupiłeś nowy VPS Hetzner z Ubuntu 24, masz IP i SSH access.

```bash
# 1. Na nowym VPS-ie zainstaluj Docker
ssh root@NEW_IP
curl -fsSL https://get.docker.com | sh
apt install -y git

# 2. Sklonuj repo
cd /opt
git clone https://github.com/lordch/reel-machine.git
cd reel-machine

# 3. Wgraj sekrety z laptopa (lokalnie):
scp .env root@NEW_IP:/opt/reel-machine/.env
scp reel-machine-492612-b8601a4a2d33.json root@NEW_IP:/opt/reel-machine/

# 4. Pobierz najnowszy backup n8n z R2 i restore (sekcja 7)

# 5. Start
docker compose up -d --build

# 6. DNS: w panelu domain registrar zmień A record reel.darkhelmettechnologies.com
#    na NEW_IP. Caddy automatycznie wygeneruje cert SSL.

# 7. Apps Script w Sheecie — jeśli API_SECRET zmieniłeś, zaktualizuj też w Apps Script
```

### "Laptop padł — straciłem .env i SA key"

Te dwa pliki **nie są w gicie**. Ale są na VPS-ie:

```bash
# Z innego komputera, SSH do VPS-a (klucz musisz mieć/odzyskać z 1Password etc.)
ssh root@204.168.187.130
cat /opt/reel-machine/.env > /tmp/env-backup.txt
# scp na nowy laptop
```

Jeśli zarówno laptop jak i VPS padły jednocześnie:
- `.env`: musisz zregenerować każdy klucz manualnie (sekcja 3 — pokazane gdzie każdy żyje)
- SA key: console.cloud.google.com → Service Accounts → `reel-service@reel-machine-492612.iam.gserviceaccount.com` → Keys → Add new key

### "n8n volume zepsuł się (corrupted SQLite)"

Patrz sekcja 7, "Restore".

### "Cały Google Workspace account padł"

Niska szansa, ale jeśli — wszystkie OAuth credentiale i SA key są związane z `michalchelminski@gmail.com`. Nowy account = od zera:
- Sheet — utwórz nowy, podziel z nowym SA email
- SA — nowy w GCP
- YouTube OAuth — nowy w GCP, re-konfiguracja w n8n
- Anthropic, ElevenLabs etc. — niezależne od Google, OK

---

## 11. Mental model na powrót po przerwie

Jeśli wracasz po pół roku i nie pamiętasz nic:

1. **Przeczytaj sekcję 1 i 6** (TL;DR + architektura)
2. **Zaloguj się na n8n UI** — zobacz workflow, kliknij Executions, zobacz czy coś leci
3. **Otwórz Sheet** — zobacz Scenarios tab, czy są scenariusze, jakie statusy
4. **`curl /api/health`** — sprawdź czy API żyje
5. **Sprawdź billing** wszystkich serwisów — czy któryś nie wygasł
6. **Sprawdź backup**: czy w R2 są codzienne pliki `backups/n8n/n8n-YYYY-MM-DD.tar.gz`

Jeśli wszystko ✅ — możesz zacząć tweakować kod (sekcja 4) albo workflow (sekcja 5).
