# Current State

> Best-effort snapshot. Może drftować od rzeczywistości. Operacyjne fakty weryfikuj bezpośrednio (curl, docker ps, git log).

**Stage:** pre-launch, faza setupu infrastruktury.

## Działa

- Wszystkie 3 kontenery na VPS Up od ~połowy kwietnia: API, n8n, Caddy
- SSL via Caddy aktywny
- `/api/health` odpowiada 200
- n8n cron palił poprawnie 21 kwietnia – 5 maja (30 successful executions)

## Otwarte sprawy

- n8n cron przestał palić po 5 maja — przyczyna niezweryfikowana (kandydaci: brak `approved` w Sheecie, time drift, schedule trigger inactive)
- Ostatni reel produkcyjny: 14 kwietnia 2026 (`go2ev-you-d-know-30s-30s`)
- Brak `.git` w `/opt/reel-machine` na VPS — kod wgrany ręcznie
- CI/CD nie wdrożone (plan w `/Users/higher/.claude/plans/ok-teraz-zr-b-plan-lucky-sutherland.md`)
- Cadence 2x/tydz nieoptwierdzona z Filipem

## W trakcie tej sesji (2026-05-21)

- Setup architektury kontekstu (CLAUDE.md + context/ + hooks)
- Repo GitHub utworzone: `lordch/reel-machine` (puste, nie pushowane jeszcze)
- OPERATIONS.md spisane przez usera

## Otwarte pytania do Filipa

Zarządzane przez Michała w [`notes/busines_questions.md`](notes/busines_questions.md) — nie dotykaj bez prośby.
