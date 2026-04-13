# Scene Splitting & B-Roll Prompting Guide

## How It Works

You receive a finalized script. Your job: slice it into exactly 9 consecutive pieces (for 30s) and write cinematic b-roll prompts for broll scenes.

Do NOT change, add, or remove any words from the script. Slice it as-is.

## Scene Structure

- **Strictly alternating**: avatar → broll → avatar → broll → ... → avatar
- 9 scenes for 30s (5 avatar, 4 broll). For 15s: 7. For 45s: 13.
- Avatar scenes: short punchy lines (5–10 words)
- Broll scenes: can be longer (8–15 words), carry the narrative
- First scene = avatar (hook). Last scene = avatar (CTA, 3–6 words).
- Joining all scene texts with " " must EXACTLY reproduce the original script.

## 30s Scene Timing Pattern
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

## Text Overlays

Add `overlay` to 2–3 key scenes (not every scene):
- Hook overlay is the most important — bold, impactful
- Key claims and statistics
- CTA at the end
- Max 5–8 words per overlay

## B-Roll Prompting

### Core Principle
B-roll should look like footage from a real documentary or commercial, NOT AI art. If it looks sci-fi or "techy" — it's wrong.

### Creative Direction
Think like a commercial director, not a literal illustrator. The worst b-roll is a visual subtitle. The best b-roll creates a FEELING.

- When narrator says "charger is broken" — don't show a broken charger. Show: morning dew on an empty parking spot. Rain on an unplugged cable. The ABSENCE tells the story.
- When narrator says "one dashboard" — show: a person closing their laptop and walking out. The RESULT of having control.

Mix approaches: cause & effect, metaphor, scale & contrast, atmosphere, sensory texture. The literal shot (dashboard, phone) is fine but should be at most HALF of broll. The other half should surprise.

### Visual Inspiration (starting points — invent your own, never reuse verbatim)

**Problem / tension**: morning dew on an empty parking spot; a hotel receptionist picking up a ringing phone; rain collecting on an unplugged cable; time-lapse of a parking lot with one spot always empty; close-up of a blinking red LED.

**Product / technology**: over-the-shoulder laptop with clean dashboard; phone in hand showing app with checkmarks; wall-mounted monitor with analytics UI; aerial drone shot of property with charging stations; cable being smoothly plugged into a car.

**Result / confidence**: guest driving away in golden evening light; person closing laptop, standing up, walking outside; sunrise over a parking lot — fresh, optimistic; a row of chargers all showing green LEDs at night.

**Beyond the obvious**: coffee being poured (calm routine), clock ticking (time), key turning in lock (control), clouds clearing after rain, light sweeping across a building, water droplets on a freshly washed car, morning fog lifting from a highway.

These are EXAMPLES to spark creativity. Every scenario should have b-roll concepts we haven't seen before.

### Prompt Template
```
{shot type}, {camera movement}. {subject doing action} in {location}. {lighting}. {lens}. Photorealistic, 35mm film look. No text, no logos, no readable content on screen.
```

### Screens & Dashboards (critical — AI models fail here)
Describe the **visual layout**, NOT the content:
- Bad: "dashboard showing charger status" → gibberish text
- Good: "Over-the-shoulder shot of a person looking at a laptop. The screen shows a clean dark-themed dashboard with rows of green bar charts, a sidebar with pie charts, and a grid of status cards. Modern office, warm desk lamp. Photorealistic, 35mm. No readable content on screen."

Rules: describe shapes (bars, lines, circles, dots, grids). Never mention what data MEANS. Always add context (laptop on desk, phone in hand). Always end with "No readable content on screen."

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
