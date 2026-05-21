/**
 * Global pipeline configuration.
 *
 * Avatar library maps human-readable names to HeyGen avatar + ElevenLabs voice IDs.
 * Pipeline scripts resolve avatar by name — voice is hardwired to the avatar.
 */

// ── Avatar library ──

export interface AvatarEntry {
  heygenAvatarId: string;
  voiceId: string;
  description?: string;
}

export const AVATAR_LIBRARY: Record<string, AvatarEntry> = {
  skyler: {
    heygenAvatarId: "69ae797df8f44394a8c770464902a5d2",
    voiceId: "FLj50PrMa40MhGHappOt",
    description: "Skyler alternate look",
  },
  brooklyn: {
    heygenAvatarId: "3f3a90b1bce54a6aaceb78139a4d1ce2",
    voiceId: "FLj50PrMa40MhGHappOt",
    description: "Brooklyn",
  },
  paisley: {
    heygenAvatarId: "3f3a90b1bce54a6aaceb78139a4d1ce2",
    voiceId: "FLj50PrMa40MhGHappOt",
    description: "Paisley",
  },
  zenon: {
    heygenAvatarId: "e870559250824765baf179c19cb64469",
    voiceId: "uju3wxzG5OhpWcoi3SMy",
    description: "Zenon — 40s man, polo shirt, hotel owner vibe",
  },
  zenon2: {
    heygenAvatarId: "7566cc4933124e30bdfba26fc5b7458b",
    voiceId: "uju3wxzG5OhpWcoi3SMy",
    description: "Zenon 2 — alternate look, same voice",
  },
  gabrielle: {
    heygenAvatarId: "2f02a0c1fa0b4595b94a9a1a075e73ab",
    voiceId: "Hh0rE70WfnSFN80K8uJC",
    description: "Gabrielle",
  },
};

// ── B-roll model library ──

export interface BrollModelEntry {
  falEndpoint: string;
  minDuration: number;
  maxDuration: number;
  validDurations?: number[];
  maxResolution: "480p" | "540p" | "720p" | "1080p" | "4k";
  costPerSec: number;
  description: string;
  extraParams?: Record<string, unknown>;
  durationFormat?: "with_s";
}

export const BROLL_MODEL_LIBRARY: Record<string, BrollModelEntry> = {
  "kling-3.0-std": {
    falEndpoint: "fal-ai/kling-video/v3/standard/text-to-video",
    minDuration: 3,
    maxDuration: 15,
    maxResolution: "1080p",
    costPerSec: 0.084,
    description: "Kling 3.0 Standard no audio — $0.084/s, proven quality",
    extraParams: { audio: false },
  },
  "kling-3.0-pro": {
    falEndpoint: "fal-ai/kling-video/v3/pro/text-to-video",
    minDuration: 3,
    maxDuration: 15,
    maxResolution: "1080p",
    costPerSec: 0.126,
    description: "Kling 3.0 Pro no audio — $0.126/s, best coherence",
    extraParams: { audio: false },
  },
  "kling-2.6-pro": {
    falEndpoint: "fal-ai/kling-video/v2.6/pro/text-to-video",
    minDuration: 5,
    maxDuration: 10,
    validDurations: [5, 10],
    maxResolution: "1080p",
    costPerSec: 0.07,
    description: "Kling 2.6 Pro no audio — cheaper, older gen",
    extraParams: { audio: false },
  },
  "veo-3-fast": {
    falEndpoint: "fal-ai/veo3/fast",
    minDuration: 4,
    maxDuration: 8,
    maxResolution: "1080p",
    costPerSec: 0.25,
    description: "Veo 3 Fast — best realism, premium tier",
    extraParams: { generate_audio: false },
    durationFormat: "with_s",
  },
  "veo-3.1-lite": {
    falEndpoint: "fal-ai/veo3.1/lite",
    minDuration: 4,
    maxDuration: 8,
    validDurations: [4, 6, 8],
    maxResolution: "720p",
    costPerSec: 0.03,
    description: "Veo 3.1 Lite 720p no audio — $0.03/s, best realism at budget price",
    extraParams: { generate_audio: false, resolution: "720p" },
    durationFormat: "with_s",
  },
  "veo-3.1-lite-1080": {
    falEndpoint: "fal-ai/veo3.1/lite",
    minDuration: 4,
    maxDuration: 8,
    validDurations: [4, 6, 8],
    maxResolution: "1080p",
    costPerSec: 0.05,
    description: "Veo 3.1 Lite 1080p no audio — $0.05/s, great realism",
    extraParams: { generate_audio: false, resolution: "1080p" },
    durationFormat: "with_s",
  },
  "hailuo-02-std": {
    falEndpoint: "fal-ai/minimax/hailuo-02/standard/text-to-video",
    minDuration: 6,
    maxDuration: 10,
    validDurations: [6, 10],
    maxResolution: "720p",
    costPerSec: 0.047,
    description: "MiniMax Hailuo-02 Standard — $0.28/video, 6 or 10s, budget 720p",
  },
  "hailuo-02-pro": {
    falEndpoint: "fal-ai/minimax/hailuo-02/pro/text-to-video",
    minDuration: 6,
    maxDuration: 10,
    validDurations: [6, 10],
    maxResolution: "1080p",
    costPerSec: 0.08,
    description: "MiniMax Hailuo-02 Pro — $0.49/video, 6 or 10s, 1080p",
  },
  "vidu-q3": {
    falEndpoint: "fal-ai/vidu/q3/text-to-video",
    minDuration: 3,
    maxDuration: 8,
    maxResolution: "1080p",
    costPerSec: 0.077,
    description: "Vidu Q3 no audio — $0.077/s at 1080p",
    extraParams: { bgm: false },
  },
  // ── Budget / draft models ──
  "wan-2.5": {
    falEndpoint: "fal-ai/wan-25-preview/text-to-video",
    minDuration: 5,
    maxDuration: 10,
    validDurations: [5, 10],
    maxResolution: "480p",
    costPerSec: 0.05,
    description: "Wan 2.5 480p — cheapest, good for drafts, fast processing",
  },
  "ltx-2.3-fast": {
    falEndpoint: "fal-ai/ltx-2.3/text-to-video/fast",
    minDuration: 6,
    maxDuration: 20,
    maxResolution: "1080p",
    costPerSec: 0.04,
    description: "LTX 2.3 Fast — cheapest 1080p, open-source, 6-20s",
    extraParams: { generate_audio: false },
  },
  "ltx-2.0-fast": {
    falEndpoint: "fal-ai/ltx-2/text-to-video/fast",
    minDuration: 6,
    maxDuration: 20,
    maxResolution: "1080p",
    costPerSec: 0.04,
    description: "LTX 2.0 Fast — budget 1080p, 6-20s",
    extraParams: { generate_audio: false },
  },
  "kling-1.6-std": {
    falEndpoint: "fal-ai/kling-video/v1.6/standard/text-to-video",
    minDuration: 5,
    maxDuration: 10,
    validDurations: [5, 10],
    maxResolution: "1080p",
    costPerSec: 0.045,
    description: "Kling 1.6 Standard no audio — budget, older gen",
    extraParams: { audio: false },
  },
  "kling-2.5-turbo": {
    falEndpoint: "fal-ai/kling-video/v2.5-turbo/pro/text-to-video",
    minDuration: 5,
    maxDuration: 10,
    validDurations: [5, 10],
    maxResolution: "1080p",
    costPerSec: 0.07,
    description: "Kling 2.5 Turbo Pro no audio — good motion",
    extraParams: { audio: false },
  },
};

// ── Defaults (product-agnostic) ──

export const DEFAULTS = {
  avatar: "skyler" as string,
  avatarVersion: "III" as "III" | "IV" | "V",
  avatarStyle: "normal" as const,
  talkingStyle: "stable" as const,
  expression: "default" as const,
  matting: false,

  captionStyle: "bold-pop" as const,
  captionBottomPx: 160,

  music: {
    regenerate: false,
    fallbackDurationSec: 40,
    styles: ["minimal tech", "electronic", "clean production", "modern corporate"],
    negativeStyles: ["vocals", "singing", "acoustic guitar", "jazz", "classical orchestra"],
    sectionStyles: {
      intro: {
        positive: ["soft ambient pads", "subtle bass pulse", "minimal percussion"],
        negative: [],
      },
      product: {
        positive: ["rising energy", "adding percussion", "synth layers", "building momentum", "driving beat"],
        negative: [],
      },
      cta: {
        positive: ["full energy", "triumphant", "powerful resolution", "confident"],
        negative: [],
      },
    },
    volume: 0.15,
  },

  musicPresets: {
    "corporate-pulse": {
      styles: ["minimal tech", "electronic", "clean production", "modern corporate"],
      negativeStyles: ["vocals", "singing", "acoustic guitar", "jazz", "classical orchestra"],
      sectionStyles: {
        intro:   { positive: ["soft ambient pads", "subtle bass pulse", "minimal percussion"], negative: [] },
        product: { positive: ["rising energy", "adding percussion", "synth layers", "driving beat"], negative: [] },
        cta:     { positive: ["full energy", "triumphant", "powerful resolution", "confident"], negative: [] },
      },
    },
    "dark-drive": {
      styles: ["dark electronic", "aggressive synth", "pulsing bassline", "high energy"],
      negativeStyles: ["vocals", "acoustic", "jazz", "orchestral", "ambient"],
      sectionStyles: {
        intro:   { positive: ["tense buildup", "low rumble", "sparse percussion", "suspense"], negative: [] },
        product: { positive: ["hard-hitting beat", "fast tempo", "synth stabs", "relentless momentum"], negative: [] },
        cta:     { positive: ["peak energy", "explosive drop", "driving rhythm", "unstoppable"], negative: [] },
      },
    },
    "cinematic-tech": {
      styles: ["cinematic electronic", "hybrid orchestral", "epic trailer", "modern sci-fi"],
      negativeStyles: ["vocals", "jazz", "acoustic guitar", "lo-fi", "classical only"],
      sectionStyles: {
        intro:   { positive: ["orchestral tension", "sparse piano", "building dread", "anticipation"], negative: [] },
        product: { positive: ["epic swell", "brass stabs", "electronic pulse", "building intensity"], negative: [] },
        cta:     { positive: ["massive drop", "orchestral climax", "triumphant brass", "cinematic resolution"], negative: [] },
      },
    },
    "warm-momentum": {
      styles: ["upbeat electronic", "warm synth", "positive energy", "startup vibe"],
      negativeStyles: ["vocals", "dark", "aggressive", "orchestral", "jazz"],
      sectionStyles: {
        intro:   { positive: ["warm pad", "light groove", "optimistic feel", "gentle pulse"], negative: [] },
        product: { positive: ["growing confidence", "layered synths", "bright arpeggios", "forward motion"], negative: [] },
        cta:     { positive: ["energetic peak", "bright and open", "feel-good energy", "aspirational"], negative: [] },
      },
    },
  } as const,

  /** B-roll model name (key in BROLL_MODEL_LIBRARY) */
  brollModel: "kling-3.0-std" as string,

  /** Negative prompt appended to every AI b-roll generation */
  brollNegativePrompt:
    "text, words, letters, numbers, subtitles, captions, titles, watermark, logo, sign, label, UI elements, written content, blur, distort, low quality",
};

// ── Pricing (USD, approximate) ──

export const PRICING = {
  elevenlabsTtsPerKChar: 0.3,
  elevenlabsMusicPerMinute: 0.5,
  heygenAvatarIIIPerSec: 0.0167,
  heygenAvatarIVPerSec: 0.1,
  heygenAvatarVPerSec: 0.05,
};

// ── Helpers ──

export function resolveAvatar(name: string): AvatarEntry {
  const entry = AVATAR_LIBRARY[name.toLowerCase()];
  if (!entry) {
    const available = Object.keys(AVATAR_LIBRARY).join(", ");
    throw new Error(`Unknown avatar "${name}". Available: ${available}`);
  }
  return entry;
}

export function resolveBrollModel(name: string): BrollModelEntry {
  const entry = BROLL_MODEL_LIBRARY[name.toLowerCase()];
  if (!entry) {
    const available = Object.keys(BROLL_MODEL_LIBRARY).join(", ");
    throw new Error(`Unknown b-roll model "${name}". Available: ${available}`);
  }
  return entry;
}
