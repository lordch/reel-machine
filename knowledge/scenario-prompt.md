# Video Ad Scenario Generation — Complete Guide

## How the Pipeline Works (read first)

You do NOT write a `script` field. Instead, you write `scriptSegment` for each scene. The system concatenates them into the full script automatically.

Think of each scene's `scriptSegment` as the narrator's lines for that scene. Together they form the full narration:
```
scene1 (avatar):  "Hook line."
scene2 (broll):   "Context and setup."
scene3 (avatar):  "Product intro."
scene4 (broll):   "Benefit explained."
...
```
→ becomes script: "Hook line. Context and setup. Product intro. Benefit explained."

Each scene has its own unique text. No scene repeats another's words.

## Scene Structure Rules

- **Strictly alternating**: avatar → broll → avatar → broll → ... → avatar
- First scene is ALWAYS avatar (face stops the scroll). Last scene is ALWAYS avatar (CTA with eye contact).
- **9 scenes for 30s** (5 avatar, 4 broll). For 15s: 7 scenes. For 45s: 13 scenes.
- Avatar scenes: 2–3 seconds, 1–2 short sentences. Punch lines, not monologues.
- Broll scenes: 3–5 seconds. Can span multiple sentences.
- The second-to-last scene (broll) carries its own narrative — NOT the CTA text. The last scene (avatar) is the CTA alone, 3–6 words.

## JSON Format

```json
{
  "id": "kebab-case-30s",
  "meta": { "title": "Human Readable Title", "targetDuration": 30 },
  "scenes": [
    { "id": "hook", "visual": "avatar", "musicSection": "intro",
      "scriptSegment": "Hook line that grabs attention." },
    { "id": "context", "visual": "broll", "musicSection": "intro",
      "scriptSegment": "Context that sets up the problem visually.",
      "brollAiPrompt": "Detailed cinematic prompt. Shot type, camera movement, subject, location, lighting. Photorealistic, 35mm film look. No text, no logos." },
    { "id": "product", "visual": "avatar", "musicSection": "product",
      "scriptSegment": "Product intro — what it is." },
    { "id": "benefit", "visual": "broll", "musicSection": "product",
      "scriptSegment": "Concrete benefit shown visually.",
      "brollAiPrompt": "Different shot type, location, time of day from previous broll." }
  ]
}
```

Only include: `id`, `meta`, `scenes`. Do NOT include `script`, `avatar`, `music`, `captionStyle`, or `branding` — the system builds `script` from your scenes automatically.

Every broll scene MUST have `brollAiPrompt`. musicSection progresses: `intro` → `product` → `cta` (never backwards).

## Text Overlays

Add `overlay` to 3–5 key scenes (not every scene):
- Hook overlay is the most important — bold, impactful
- Key claims and statistics
- CTA at the end
- Max 5–8 words per overlay

```json
"overlay": { "text": "Max 8 words here", "position": "center", "animation": "slam" }
```
Positions: `top-center`, `center`, `bottom-center`. Animations: `slam` (impact), `pop` (features), `zoom-out` (reveal).

## Writing the Script

### Style
Flowing, natural narration. Sounds like a real person talking to a peer — NOT a sales pitch with framework labels.

Bad: "[HOOK] Did you know 35%...? [PROBLEM] Downtime costs money."
Good: "You get a call from a guest. The EV charger isn't working."

### Word Budget
Total word count for ALL scenes combined: 30s = 65–90 words. 45s = 100–130 words. That's ~7–10 words per scene. Avatar scenes should be punchy (5–9 words). Broll scenes can be slightly longer (8–12 words). ElevenLabs tends to run 10–20% longer — write under budget.

### Script Proportions (critical)
Most drafts over-invest in the problem. Be quick and sharp — the viewer gets it fast.

- **Problem/context: max 30%** (2–3 short sentences)
- **Product + benefits: min 50%** — explain what the product IS, then 2–3 concrete things it does
- **CTA: ~10%** — short, 1 sentence

### Script Arc (maps to scene positions)
1. **Scenes 1–3: Hook + Problem** — a relatable moment the viewer recognizes, then the pain.
2. **Scene 3 (avatar): Product definition — MANDATORY.** This scene MUST contain a sentence in the format: "[Product] is a [product category] for [target audience]." Example: "Go2EV is a monitoring platform for EV charging operators." Without this, the viewer doesn't know what the product IS. Never skip this.
3. **Scenes 4–7: Product working** — concrete, tangible benefits. Each benefit pairs with a broll scene.
4. **Scene 9 (avatar): CTA** — short, 3–6 words. "Start free at website.com."

### Script Style Examples (inspiration only — invent your own, don't copy)
Bad: "[HOOK] Did you know 35%...? [PROBLEM] Downtime costs money. [SOLUTION] Our product..."
Bad: "Hi, I'm Sarah and today I want to tell you about..."
Good: "You get a call from a guest. The EV charger isn't working. You walk outside, unplug it, plug it back in — and hope."
Good: "Three chargers. One parking lot. And you have no idea which one stopped working last night."

### 30s Scene Timing Pattern (reference — adapt creatively, don't follow rigidly)
```
avatar 2-3s  → hook, face to camera
broll  3-4s  → problem visual
avatar 2-3s  → product intro
broll  3-4s  → product in action
avatar 2-3s  → key benefit
broll  3-4s  → benefit visual
avatar 2-3s  → second benefit
broll  3-4s  → result visual
avatar 2-3s  → CTA
```

### Hook Techniques (use a different one per scenario)
- **Relatable situation**: Put viewer in a specific moment they recognize
- **Pain question**: Ask something they can't confidently answer
- **The math**: Lead with a concrete number that reframes the problem
- **Contrast**: Easy thing vs the hard thing nobody talks about
- **Provocation**: Challenge an assumption the audience holds
- **Story**: Start mid-action, drop the viewer in

What kills hooks: starting with company name, logo animations, "Hi, I'm...", generic statements.

## Pacing & Retention

- Visual change every 1.5–3 seconds. Static frame > 4s = viewer scrolls away.
- 71% of viewers decide in first 2 seconds. Hook is everything.
- Avatar/broll ratio: 30–40% avatar / 60–70% broll
- Front-load value — reward the viewer fast
- One problem, one solution, one CTA per reel. Don't overload.

### Common Mistakes
1. Avatar talks too long without visual change (max 3s)
2. Too much problem, not enough product (flip the ratio)
3. Vague product description — viewer must understand WHAT it is within 10s
4. Same visual concept repeated in multiple broll scenes
5. CTA text repeated across two scenes

## B-Roll Prompting

### Core Principle
B-roll should look like footage from a real documentary or commercial, NOT AI art. If it looks sci-fi or "techy" — it's wrong.

### Creative Direction
Think like a commercial director, not a literal illustrator. The worst b-roll is a visual subtitle. The best b-roll creates a FEELING.

- When narrator says "charger is broken" — don't show a broken charger. Show: morning dew on an empty parking spot. Rain on an unplugged cable. The ABSENCE tells the story.
- When narrator says "one dashboard" — show: a person closing their laptop and walking out. The RESULT of having control.

Mix approaches: cause & effect, metaphor, scale & contrast, atmosphere, sensory texture. The literal shot (dashboard, phone) is fine but should be at most HALF of broll. The other half should surprise.

### Visual Inspiration (starting points — invent your own, never reuse these verbatim)

**Problem / tension**: morning dew on an empty parking spot; a hotel receptionist picking up a ringing phone; rain collecting on an unplugged cable; time-lapse of a parking lot with one spot always empty; close-up of a blinking red LED.

**Product / technology**: over-the-shoulder laptop with clean dashboard; phone in hand showing app with checkmarks; wall-mounted monitor with analytics UI; aerial drone shot of property with charging stations; cable being smoothly plugged into a car.

**Result / confidence**: guest driving away in golden evening light; person closing laptop, standing up, walking outside; sunrise over a parking lot — fresh, optimistic; a row of chargers all showing green LEDs at night.

**Beyond the obvious**: coffee being poured (calm routine), clock ticking (time), key turning in lock (control), clouds clearing after rain, light sweeping across a building, water droplets on a freshly washed car, morning fog lifting from a highway.

These are EXAMPLES to spark creativity. Every scenario should have b-roll concepts we haven't seen before. If a prompt feels like something you've written before — rewrite it.

### Prompt Template
```
{shot type}, {camera movement}. {subject doing action} in {location}. {lighting}. {lens}. Photorealistic, 35mm film look. No text, no logos, no readable content on screen.
```

### Screens & Dashboards (critical — AI models fail here)
Describe the **visual layout**, NOT the content:
- Bad: "dashboard showing charger status" → gibberish text
- Good: "Over-the-shoulder shot of a person looking at a laptop. The screen shows a clean dark-themed dashboard with rows of green bar charts, a sidebar with pie charts, and a grid of status cards. Modern office, warm desk lamp. Photorealistic, 35mm. No readable content on screen."

Rules: describe shapes (bars, lines, circles, dots, grids). Never mention what data MEANS. Always add context (laptop on desk, phone in hand). Always end with "No readable content on screen."

More good examples (adapt freely — vary device, environment, UI style):
- "Close-up of a phone held in hand. The screen shows a modern mobile app with a clean white interface, green checkmark icons in a list, a circular progress ring at the top. Coffee shop background blurred. Photorealistic, 35mm. No readable content on screen."
- "Slow push-in on a widescreen monitor mounted on a wall in a bright office. The screen displays a real-time map with colored pins and a line graph trending upward. Clean modern UI, light theme. Natural window light. Photorealistic, 35mm. No readable content on screen."

### Shot Types
- Close-up: objects, hands, LEDs, cables (NOT faces — AI distorts them)
- Medium shot: person from waist up
- Wide/establishing: property, parking lot, building
- Aerial/drone: overhead views (AI does this well)

### Camera Movement (always include one)
- `slow push-in` — most versatile
- `slow tracking left/right` — good for rows
- `pull-back reveal` — starts close, reveals context
- Avoid static shots — feels lifeless

### Lighting
- `golden hour` — warm, flattering
- `night + practical lights` — LEDs, headlights, street lamps
- `morning light, fresh tones` — positive/outcome scenes
- Avoid: harsh noon sun, neon/sci-fi glow

### Always Include
- `photorealistic` — always
- `35mm film look` — always
- `shallow depth of field` — always

### What to Avoid in Prompts
- Screen content descriptions ("showing revenue", "displaying alerts")
- "Abstract shapes", "glowing dots" → produces sci-fi
- Human faces close-up → distorted
- Multiple people interacting → artifacts
- Brand names → use generic ("dark SUV", "modern phone")
- Readable text → end every prompt with "No readable content on screen"
