# B-Roll Prompting Guide

## Core Principle

B-roll should look like footage from a **real documentary or commercial**, not like AI art. Every shot must feel like it was filmed by a real camera crew at a real location. If it looks sci-fi, futuristic, or "techy" — it's wrong.

## Prompt Template

```
{shot type}, {camera movement}. {subject doing action} in {location}. {lighting}. {lens/depth of field}. Photorealistic, 35mm film look. No text, no logos, no watermarks, no screens with visible content.
```

## Screens, Dashboards, Charts (CRITICAL)

Screens, dashboards, and charts ARE wanted — they show the product working. But AI models produce sci-fi artifacts when prompted wrong. The key: **describe the visual layout of the interface, not its content.**

**Rules for screen prompts:**
1. **Describe the UI layout visually** — "a clean dark dashboard with rows of green and orange bar charts, pie charts in the sidebar, a map with colored dots" — NOT "a dashboard showing charger status at 85%"
2. **Never mention what the data MEANS** — no "showing revenue", "displaying alerts", "status indicators". Just describe shapes: bars, lines, circles, dots, grids.
3. **Use real-world UI descriptors** — "clean SaaS dashboard", "modern analytics interface", "dark-themed monitoring panel with grid layout" — these anchor the model in realistic software, not sci-fi.
4. **Combine screen + context** — laptop on a desk, phone in a hand, monitor in an office. The environment grounds the screen in reality.
5. **Always include**: "Photorealistic. No text, no logos, no watermarks, no readable content on screen."

**Bad → Good examples:**
- Bad: "dashboard showing charger status" → gibberish text
- Bad: "phone screen glowing with abstract colorful shapes" → sci-fi orbs
- Bad: "laptop with green and blue glowing dots on dark background" → particle effects
- Good: "Over-the-shoulder shot of a person looking at a laptop. The screen shows a clean dark-themed dashboard with rows of green bar charts, a sidebar with colored pie charts, and a grid of small status cards. Modern office, warm desk lamp. Photorealistic, 35mm film look, shallow depth of field. No text, no logos, no readable content on screen."
- Good: "Close-up of a phone held in hand. The screen shows a modern mobile app with a clean white interface, green checkmark icons in a list, a circular progress ring at the top. Coffee shop background blurred. Photorealistic, shot on 35mm film. No text, no logos, no readable content on screen."
- Good: "Slow push-in on a widescreen monitor mounted on a wall in a bright office. The screen displays a real-time map with colored pins and a line graph trending upward. Clean modern UI, light theme. Natural window light. Photorealistic, 35mm film look. No text, no logos, no readable content on screen."

## Visual Diversity

**Be creative.** Don't limit yourself to charging stations and dashboards. B-roll should tell a visual story that FEELS like the narration — it doesn't have to literally illustrate every word. Think like a commercial director: mood, atmosphere, metaphor, contrast.

The examples below are **starting inspiration, not a menu to pick from**. Invent new concepts. Vary time of day, weather, location, shot type, and subject across every scene. If two b-roll scenes in the same reel look similar — one of them needs to change.

### Inspiration: Problem / Tension
- Guest walking toward parking lot in rain, moody atmosphere
- A row of chargers, one with a dangling cable, dim light
- Close-up of a charger's red blinking LED
- Empty parking spot with a "reserved for EV" marking, no car
- Hotel receptionist picking up a ringing phone, concerned expression
- Time-lapse of a parking lot — cars coming and going, one spot always empty

### Inspiration: Product / Technology
- Over-the-shoulder: laptop with clean dashboard (bar charts, status grid, map)
- Phone in hand showing app with checkmarks and progress ring
- Wall-mounted monitor with analytics UI (line graphs, colored pins on map)
- EV charger LED switching from red to solid green
- Aerial drone shot of a property with neat rows of charging stations
- Close-up of a cable being smoothly plugged into a car's charge port

### Inspiration: Result / Confidence
- Guest driving away from hotel, evening golden light
- Wide establishing shot of a well-lit property at dusk, everything running
- Person closing a laptop, standing up, walking away with confidence
- Sunrise over a parking lot — fresh, optimistic morning feel
- A row of chargers all showing green LEDs, cars connected, night scene with practical lights

### Think beyond the obvious
- Metaphor shots: coffee being poured (calm morning routine), clock ticking (time passing), a key turning in a lock (control)
- Atmosphere shots: clouds clearing after rain, light sweeping across a building, traffic flowing smoothly on a highway
- Detail shots: water droplets on a freshly washed car, a clean white cable coiled neatly, morning dew on a charger
- Scale shots: aerial views of urban infrastructure, rows of solar panels + chargers, city skyline at dawn

## Shot Types
- `Close-up` — objects, hands, LEDs, cables (NOT faces — AI distorts them)
- `Medium shot` — person from waist up, desk/reception context
- `Wide / establishing` — property, parking lot, building exterior
- `Aerial / drone` — overhead views of properties (AI does this well)
- `Low angle` — looking up at a charger or building (dramatic)

## Camera Movement
- `slow push-in` — gradual zoom toward subject (most versatile)
- `slow tracking left/right` — lateral movement (good for rows of chargers)
- `pull-back reveal` — starts close, reveals wider context
- `handheld` — subtle documentary sway (adds realism)
- `rack focus` — shift between foreground/background (depth)
- Avoid `static shot` — feels lifeless in AI video

## Lighting
- `golden hour` — warm, flattering (hotel/hospitality)
- `overcast soft light` — neutral outdoor scenes
- `warm interior lighting` — desk lamps, lobby lights
- `night + practical lights` — charger LEDs, car headlights, street lamps
- `morning light, fresh tones` — positive/outcome scenes
- Avoid: harsh noon sun, neon/sci-fi glow, mixed color temps

## Film Look (always include)
- `photorealistic` — ALWAYS use this word
- `35mm film look` or `shot on 35mm film`
- `shallow depth of field` — always
- `natural skin tones` — when people are in frame
- `film grain` — optional, adds texture

## What AI Video Does Well
- Physical objects with simple motion (cables, plugs, LEDs, cars)
- Architecture and environments (buildings, parking lots, lobbies)
- Atmospheric shots (weather, lighting changes, time of day)
- Aerial/drone perspectives
- Single person doing simple action (walking, sitting, looking)

## What Fails — Always Avoid
- **Describing screen CONTENT** — "showing revenue", "displaying alert", "charger status at 85%". Describe the UI layout visually instead.
- **"Abstract shapes", "glowing dots", "colorful orbs"** — produces sci-fi. Use real UI terms: "bar charts", "grid of cards", "line graph".
- **Human faces close-up** — distorted eyes, melted features. Medium shot or wider.
- **Multiple people interacting** — conversation, handshakes = artifacts.
- **Specific hand gestures** — pointing, typing on keyboard.
- **Brand names** — "Tesla", "iPhone" → use "dark SUV", "modern phone".
- **Any readable text** — no signs, labels, numbers on screens. End every prompt with "No readable content on screen."

## Negative Prompt (auto-included by pipeline)
```
text, words, letters, numbers, subtitles, captions, titles, watermark, logo, sign, label, UI elements, written content, blur, distort, low quality, cartoon, 3D render, anime, illustration, sci-fi, futuristic interface, hologram, neon glow on screen
```

## Improving Failed Clips
1. **Sci-fi looking?** → Remove ANY screen/interface reference. Focus on person or environment.
2. **Distorted face?** → Switch to hands-only or object close-up. Or widen to medium shot.
3. **Wrong subject?** → Add more environment detail, less action description.
4. **Static/frozen?** → Add explicit camera movement keyword.
5. **Too similar to other clips?** → Change time of day, location, shot type, and subject completely.
