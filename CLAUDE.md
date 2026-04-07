# Reel Machine — Automated Video Ad Pipeline

## What This Is

Autonomous pipeline for generating short-form vertical video ads (9:16, 1080x1920, 30fps).
Product-agnostic architecture — each client configured via `products/{id}/`.

## Architecture

See `docs/reel-machine-architecture.md` in the n8n-playground repo for full design.

### Pipeline Flow
```
scenario.json → audio → split → avatar+broll+music (parallel) → assemble → render
```

### Entry Points
- `npm run orchestrate -- <scenario-id> --product=go2ev` — full pipeline with retry
- Individual steps: `npm run pipeline:{audio|split|avatar|broll|music|assemble}`

## Project Structure

```
src/
  pipeline/         # Core pipeline scripts
    product.ts      # Product config loader (branding, TTS rules, assets)
    config.ts       # Generic config (avatar library, broll models, pricing)
    schema.ts       # Zod schemas, scenario loader, audio alignment
    retry.ts        # Exponential backoff wrapper
  orchestrate.ts    # Single entry point — runs full pipeline
  components/       # Remotion React components (captions, overlays, branding)
  types.ts          # Core types (ReelProps, CaptionSegment, ClipInfo)
products/           # Per-client config
  go2ev/
    product.json    # Branding, TTS replacements, social accounts
    knowledge.md    # Product features/audiences (for LLM scenario generation)
    assets/         # Logo, screenshots
    broll-library.json # Proven b-roll prompts per category
knowledge/          # Generic operational knowledge (for LLM)
scenarios/          # Runtime: generated scenarios + assets
```

## Product Config System

Each product has `products/{id}/product.json`:
- `ttsReplacements` — product-specific pronunciation rules for ElevenLabs
- `logo`, `website` — branding (passed to scenario)
- `broll-library.json` — proven b-roll prompts per visual category

Pipeline scripts accept `--product=<id>` flag. Orchestrator passes it through.

## Key Conventions

- All video output is **9:16 portrait** (1080×1920)
- Avatar clips use black background, closeup framing
- B-roll is trimmed to exact scene duration via ffmpeg
- Captions are word-level synced to ElevenLabs timestamps
- Crossfade between clips: 0.2s (6 frames at 30fps)
- narration.mp3 is the single master audio track; all video clips are MUTE

## Environment Variables

See `.env.example`: ELEVENLABS_API_KEY, HEYGEN_API_KEY, FAL_KEY, PEXELS_API_KEY
