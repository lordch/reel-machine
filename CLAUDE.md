# Reel Machine — Automated Video Ad Pipeline

## What This Is

Autonomous pipeline for generating short-form vertical video ads (9:16, 1080x1920, 30fps).
One Google Sheet = one product. Configure product knowledge, approve scenarios, get published reels.

## Working with Me (Michał)

**Domyślny tryb pracy = rozmowa.** Michał zadaje dużo pytań, lubi przedyskutowywać, brainstormować, odbijać pomysły. Z rozmowy może wyniknąć decyzja o zmianie, ale często wynika tylko zrozumienie. **Nie zakładaj że pytanie = prośba o akcję.** Jeśli Michał pisze "powiedz mi co o tym sądzisz" / "jak myślisz?" — odpowiadasz tekstem, nie tool callami.

**Three-stage methodology** (gdy faktycznie idziemy w stronę zmiany):
1. **Dyskusja** — alignment, założenia, odbijanie pomysłów
2. **Propozycja** — konkretny plan opisany w czacie, jeszcze nie wykonany
3. **Implementacja** — dopiero po jawnej zgodzie

*Why:* wcześniej w tym projekcie Michał wielokrotnie powiedział "powiedz mi jak myślisz" i dostał zamiast tego edytowane pliki. To psuje zaufanie i traci kontekst, który nie był jeszcze gotowy do zapisania.

**Hard rules** (twarde brzegi):
- **Nie odpalaj płatnych API** (Anthropic, ElevenLabs, HeyGen, fal.ai) bez zgody. Każdy call kosztuje realne $; testy generowania video to ~$1+. Free operations (Google Sheets read, health checks, file ops) bez pytania
- **Nie modyfikuj wartości w Google Sheecie** ustawionych przez Michała bez pytania. Historyczny incydent: zmieniłem batch_size z 1 na 5 "żeby było szybciej" — Michał celowo trzymał 1 do oszczędzania tokenów
- **Nie edytuj plików w `context/` bez aprobaty per plik.** Kontekst rozlewa się szybko gdy AI ma swobodę pisania o sobie i o projekcie; kontrola Michała jest kluczowa dla utrzymania porządku i weryfikowalności
- **Komunikacja po polsku**

**Diagnose before recommending:** zanim zaproponujesz fix wymagający ode mnie roboty (reset czegoś, instalacja, zmiana configa, ssh-add), uruchom **falsifiable test** który potwierdza diagnozę. *Why:* w maju 2026 zdiagnozowałem brak autoryzacji klucza SSH na VPS-ie i poleciłem reset hasła roota przez Hetzner web console (~30 min roboty). Faktyczna przyczyna: passphrase-encrypted klucz lokalnie, agent pusty, fix = `ssh-add` (15 sekund). Sygnałem był pushback Michała "może źle szukamy?" — bez tego pchnąłbym go w niepotrzebne kroki.

**Push back to sygnał, nie grzeczność.** Gdy Michał pyta "czy nie wydaje ci się dziwne?" / "może coś źle robimy?" / "może brakuje ci kontekstu?" — **nie broń hipotezy, rozszerz śledztwo**. To są pytania diagnostyczne, nie konwersacyjne.

## Context Files

Po dodatkowy kontekst zaglądaj do:
- [`context/PRODUCT.md`](context/PRODUCT.md) — biznesowy: kto, co, czemu (rzadko się zmienia)
- [`context/STATE.md`](context/STATE.md) — aktualny snapshot stanu projektu. **Best-effort, może się rozjeżdżać z rzeczywistością.** Operacyjne fakty (czy API żyje, czy cron leci) weryfikuj komendą, nie ufaj plikowi na ślepo
- [`context/history.md`](context/history.md) — chronologiczny log decyzji i nieoczywistych ustaleń z odnośnikami do sesji
- [`context/notes/`](context/notes/) — luźne notatki Michała. **Nie edytuj bez wyraźnej prośby.**

SessionStart hook automatycznie wstrzykuje STATE.md i ogon history.md przy każdym starcie — masz to top of mind bez ręcznego czytania.

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
