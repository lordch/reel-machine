export type CaptionStyle =
  | "bold-pop"       // Classic TikTok: bold uppercase, spring pop-in, gold highlight
  | "typewriter"     // Letters appear one by one, monospace feel
  | "glow-neon"      // Neon glow effect, cyberpunk vibes
  | "karaoke"        // Full text visible, current word highlighted with background
  | "slide-up"       // Words slide up from below with stagger
  | "glitch"         // Glitch/shake effect on word appear
  | "kinetic";       // Dynamic positions, rotations, scales — cinematic feel

export type TextPosition =
  | "top-left" | "top-center" | "top-right"
  | "center-left" | "center" | "center-right"
  | "bottom-left" | "bottom-center" | "bottom-right";

export type TextAnimation =
  | "pop"         // Spring scale from 0
  | "slide-left"  // Slide in from left
  | "slide-right" // Slide in from right
  | "slam"        // Oversized then snaps to size
  | "fade-up"     // Fade in while moving up
  | "rotate-in"   // Rotates in from angle
  | "zoom-out";   // Starts big, shrinks to final size

export interface CaptionSegment {
  text: string;
  startFrame: number;
  endFrame: number;
  // Kinetic-mode fields (optional, ignored by other styles)
  position?: TextPosition;
  animation?: TextAnimation;
  rotation?: number;       // degrees
  fontSize?: number;       // override default
  color?: string;          // override default
  accentColor?: string;    // for key word highlight
}

export interface ClipInfo {
  src: string;
  durationInFrames: number;           // timeline slot (speech + gap to next scene)
  videoDurationInFrames?: number;     // actual video length (speech only, no gap)
  sceneType?: "avatar" | "broll" | "screenshot";
}

export interface SceneOverlayInfo {
  overlay: {
    text: string;
    position: string;
    animation: string;
    fontSize?: number;
    color?: string;
    emoji?: string;
  };
  startFrame: number;
  durationInFrames: number;
}

export interface ReelProps {
  clips: ClipInfo[] | string[];
  captions: CaptionSegment[];
  captionStyle: CaptionStyle;
  branding: {
    logo: string;
    website: string;
  };
  fps: number;
  durationInFrames: number;
  sceneOverlays?: SceneOverlayInfo[];
}
