# Scenario JSON Format

## Minimal scenario (what agent generates by default)

Only these fields are required. Everything else has defaults from `src/pipeline/config.ts`.

```json
{
  "id": "hotel-pain-30s",
  "meta": { "title": "Hotel Pain", "targetDuration": 30 },
  "script": "You get a call from a guest. The EV charger isn't working...",
  "scenes": [
    { "id": "hook", "musicSection": "intro", "scriptSegment": "You get a call from a guest.", "visual": "avatar" },
    { "id": "walkout", "musicSection": "intro", "scriptSegment": "You walk outside, unplug it...", "visual": "broll",
      "brollAiPrompt": "Close-up of hands unplugging a white EV charging cable..." },
    { "id": "cta", "musicSection": "cta", "scriptSegment": "Go2ev.com.", "visual": "avatar" }
  ]
}
```

Defaults applied automatically: avatar (skyler), language (en), captionStyle (bold-pop), music (minimal tech/electronic), branding (logo.svg, go2ev.com).

## Optional overrides (only when user asks)

```json
{
  ...minimal...,
  "avatar": { "name": "zenon", "talkingStyle": "expressive" },
  "captionStyle": "kinetic",
  "music": { "styles": ["dark ambient", "cinematic tension"] }
}
```

## Full schema reference

```
{
  "id": string,                    // kebab-case, e.g. "hotel-pain-30s"
  "meta": {
    "title": string,               // REQUIRED
    "targetDuration": 10-90,       // REQUIRED, seconds
    "language": string             // default: "en"
  },
  "avatar": {                      // OPTIONAL — entire block defaults from config.ts
    "name": string,                // avatar from library (e.g. "skyler", "zenon") — resolves avatarId + voiceId
    "avatarId": string,            // raw HeyGen ID — only for unlisted avatars
    "talkingStyle": "stable"|"expressive",
    "expression": "default"|"happy",
    "matting": boolean,
    "offset": { "x": number, "y": number },
    "circleBackgroundColor": "#hex"
  },
  "script": string,                // REQUIRED — full continuous narration text
  "scenes": [                      // REQUIRED — ordered, min 3
    {
      "id": string,                // REQUIRED — unique scene ID
      "scriptSegment": string,     // REQUIRED — EXACT substring of script
      "visual": "avatar"|"broll"|"screenshot",  // REQUIRED
      "musicSection": "intro"|"product"|"cta",  // REQUIRED
      "brollAiPrompt": string,     // cinematic AI video prompt (when visual=broll)
      "screenshotAsset": string,   // filename in go2ev-assets/ (when visual=screenshot)
      "overlay": {                 // optional text overlay
        "text": string,
        "position": "top-left"|...|"bottom-right",
        "animation": "pop"|"slide-left"|"slide-right"|"slam"|"fade-up"|"rotate-in"|"zoom-out",
        "fontSize": number,
        "color": "#hex",
        "accentColor": "#hex"
      }
    }
  ],
  "music": {                       // OPTIONAL — defaults from config.ts
    "styles": string[],            // global positive styles
    "negativeStyles": string[],    // global negative styles
    "sectionStyles": { ... },      // per-section overrides
    "volume": 0-1
  },
  "captionStyle": string,          // OPTIONAL — default: "bold-pop"
  "branding": {                    // OPTIONAL — defaults from config.ts
    "logo": string,
    "website": string
  }
}
```

## Rules

- `script` is continuous text. Each scene's `scriptSegment` must be an exact substring.
- Scene 1 must be `"visual": "avatar"`.
- Never put two avatar scenes in a row — always interleave with broll (exception: short CTA at end, < 3 words).
- B-roll scenes must be at least 3 seconds.
- Always set `brollAiPrompt` for broll scenes — detailed, cinematic. Read `broll-prompting-guide.md`.
- Every scene MUST have `musicSection`:
  - `intro` = hook/problem scenes (~first 30% of scenes)
  - `product` = solution/features scenes (~middle 50%)
  - `cta` = call-to-action (~last 20%)
- Consecutive scenes with the same `musicSection` are merged into one music section.
- **Do NOT include** `avatar`, `music`, `captionStyle`, or `branding` unless the user explicitly asks to customize them.

## Complete example

```json
{
  "id": "phone-call-30s",
  "meta": { "title": "There Has to Be a Better Way", "targetDuration": 30 },
  "script": "You get a call from a guest. The EV charger isn't working. You walk outside, unplug it, plug it back in. It works. Next week, same thing. Different guest. You think, there has to be a better way. There is. Go2EV is monitoring software for EV chargers. It tells you when something breaks before your guests do. And you can fix most issues remotely, right from your phone. No more parking lot visits. Go2ev.com.",
  "scenes": [
    {
      "id": "hook",
      "musicSection": "intro",
      "scriptSegment": "You get a call from a guest. The EV charger isn't working.",
      "visual": "avatar"
    },
    {
      "id": "walkout",
      "musicSection": "intro",
      "scriptSegment": "You walk outside, unplug it, plug it back in. It works.",
      "visual": "broll",
      "brollAiPrompt": "Close-up of hands unplugging and replugging a white EV charging cable from a modern charging station at a hotel parking lot. Evening light, warm tones. Slow deliberate movement. Shallow depth of field, 35mm film look. No text, no logos, no watermarks."
    },
    {
      "id": "repeat",
      "musicSection": "intro",
      "scriptSegment": "Next week, same thing. Different guest. You think, there has to be a better way.",
      "visual": "avatar"
    },
    {
      "id": "solution-intro",
      "musicSection": "product",
      "scriptSegment": "There is. Go2EV is monitoring software for EV chargers.",
      "visual": "broll",
      "brollAiPrompt": "Over-the-shoulder shot of a person at a desk looking at a laptop. The screen shows a clean dark-themed dashboard with rows of green bar charts, a sidebar with small colored pie charts, and a grid of status cards with green and orange indicators. Warm desk lamp from the side. Photorealistic, 35mm film look, shallow depth of field. No text, no logos, no watermarks, no readable content on screen."
    },
    {
      "id": "benefit-alerts",
      "musicSection": "product",
      "scriptSegment": "It tells you when something breaks before your guests do.",
      "visual": "avatar"
    },
    {
      "id": "benefit-remote",
      "musicSection": "product",
      "scriptSegment": "And you can fix most issues remotely, right from your phone.",
      "visual": "broll",
      "brollAiPrompt": "Close-up of an EV charging station's LED panel switching from blinking red to solid green. Night scene, rain droplets on the charger surface catching reflections from the LED. Slow push-in. Photorealistic, 35mm film look, shallow depth of field. No text, no logos, no watermarks, no screens with visible content."
    },
    {
      "id": "payoff",
      "musicSection": "cta",
      "scriptSegment": "No more parking lot visits.",
      "visual": "avatar"
    },
    {
      "id": "cta",
      "musicSection": "cta",
      "scriptSegment": "Go2ev.com.",
      "visual": "avatar"
    }
  ]
}
```

Note: This example has two avatar scenes at the end (payoff + cta) — acceptable when the last scene is a short CTA (< 3 words).
