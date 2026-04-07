# Quality Checklist

## Pre-Generation (after writing scenario.json)

- [ ] Scene 1 is avatar
- [ ] No two consecutive avatar scenes (except short CTA at end)
- [ ] All b-roll scenes have enough words in scriptSegment for ~3+ seconds
- [ ] All broll scenes have `brollAiPrompt`
- [ ] `scriptSegment` values are exact substrings of `script`
- [ ] Word count matches budget (~2.5 words/sec × targetDuration)
- [ ] Product is clearly explained in the script (what Go2EV IS)
- [ ] Script has a clear hook in the first sentence

## Post-Audio

```bash
cat scenarios/{id}/audio/narration-timestamps.json | head -5
```

- [ ] `narration-timestamps.json` exists
- [ ] `totalDuration` within 20% of `targetDuration`
- [ ] Word count in timestamps matches script word count
- If duration is way off: adjust script and regenerate

## Post-Split

```bash
ls scenarios/{id}/audio/avatar-segment-*.mp3 | wc -l
```

- [ ] Number of segments matches number of avatar scenes

## Post-Avatar

```bash
for f in scenarios/{id}/video/avatar-*.mp4; do
  echo "$f: $(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$f")s, $(du -h "$f" | cut -f1)"
done
```

- [ ] All avatar-*.mp4 files exist
- [ ] Each file > 100KB (not empty/corrupted)
- [ ] Durations roughly match expected speech lengths

## Post-Music

```bash
ls -la scenarios/{id}/audio/music.mp3
```

- [ ] `music.mp3` exists
- [ ] File > 50KB (not empty/corrupted)

## Post-B-Roll (CRITICAL)

### Step 1: Check metadata
```bash
for f in scenarios/{id}/video/broll-*.mp4; do
  echo "$f: $(ffprobe -v quiet -show_entries stream=width,height,duration -of csv=p=0 "$f")"
done
```

- [ ] All broll-*.mp4 files exist
- [ ] Resolution is 1080x1920 (or close)
- [ ] Duration >= 3s

### Step 2: Visual inspection
```bash
# Extract frame at 1s from each clip
for i in $(seq 0 $((N-1))); do
  ffmpeg -y -i scenarios/{id}/video/broll-$i.mp4 -ss 1 -frames:v 1 /tmp/broll-$i-preview.jpg 2>/dev/null
done
```

Then Read each `/tmp/broll-{n}-preview.jpg` and check:
- [ ] No distorted faces or melted objects
- [ ] No AI-generated text/gibberish on surfaces
- [ ] Subject matches the scene intent
- [ ] Image has motion potential (not a frozen frame)
- [ ] Lighting and mood match the ad's tone

If a clip fails: rewrite `brollAiPrompt` and re-run `fetch-broll.ts`.

## Post-Assemble

Read the assemble output log. Check:
- [ ] All scenes aligned (no "skipped" or "missing" warnings)
- [ ] No gap > 0.5s between scenes
- [ ] Clip count = scene count
- [ ] `generated-reel.ts` was written

## Post-Render

```bash
ffprobe -v quiet -show_entries format=duration,size -of csv=p=0 scenarios/{id}/output/reel.mp4
```

- [ ] File exists and > 1MB
- [ ] Duration matches expected total
- [ ] Report to user: path, duration, file size
