import React from "react";
import {
  useCurrentFrame,
  spring,
  useVideoConfig,
  interpolate,
} from "remotion";
import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";
import { loadFont as loadBangers } from "@remotion/google-fonts/Bangers";
import { loadFont as loadBebas } from "@remotion/google-fonts/BebasNeue";
import type { CaptionSegment, TextPosition, TextAnimation } from "../../types";

const poppins = loadPoppins("normal", { weights: ["900"], subsets: ["latin", "latin-ext"] });
const bangers = loadBangers();
const bebas = loadBebas();

const fonts = [poppins.fontFamily, bangers.fontFamily, bebas.fontFamily];

interface Props {
  segment: CaptionSegment;
  index: number;
}

const positionStyles: Record<TextPosition, React.CSSProperties> = {
  "top-left":      { top: 220, left: 50, textAlign: "left" as const },
  "top-center":    { top: 220, left: 0, right: 0, textAlign: "center" as const },
  "top-right":     { top: 220, right: 50, textAlign: "right" as const },
  "center-left":   { top: "40%", left: 50, textAlign: "left" as const },
  "center":        { top: "40%", left: 0, right: 0, textAlign: "center" as const },
  "center-right":  { top: "40%", right: 50, textAlign: "right" as const },
  "bottom-left":   { bottom: 750, left: 50, textAlign: "left" as const },
  "bottom-center": { bottom: 750, left: 0, right: 0, textAlign: "center" as const },
  "bottom-right":  { bottom: 750, right: 50, textAlign: "right" as const },
};

function getAnimationTransform(
  animation: TextAnimation,
  progress: number,
  fps: number,
  frame: number
): { transform: string; opacity: number } {
  switch (animation) {
    case "pop": {
      const s = spring({ frame, fps, config: { damping: 10, stiffness: 250 } });
      return { transform: `scale(${s})`, opacity: s > 0.01 ? 1 : 0 };
    }
    case "slide-left": {
      const s = spring({ frame, fps, config: { damping: 15, stiffness: 180 } });
      const x = interpolate(s, [0, 1], [-400, 0]);
      return { transform: `translateX(${x}px)`, opacity: s };
    }
    case "slide-right": {
      const s = spring({ frame, fps, config: { damping: 15, stiffness: 180 } });
      const x = interpolate(s, [0, 1], [400, 0]);
      return { transform: `translateX(${x}px)`, opacity: s };
    }
    case "slam": {
      const s = spring({ frame, fps, config: { damping: 8, stiffness: 400 } });
      const scale = interpolate(s, [0, 1], [3, 1]);
      return { transform: `scale(${scale})`, opacity: Math.min(s * 3, 1) };
    }
    case "fade-up": {
      const s = spring({ frame, fps, config: { damping: 18, stiffness: 120 } });
      const y = interpolate(s, [0, 1], [80, 0]);
      return { transform: `translateY(${y}px)`, opacity: s };
    }
    case "rotate-in": {
      const s = spring({ frame, fps, config: { damping: 12, stiffness: 200 } });
      const r = interpolate(s, [0, 1], [-15, 0]);
      const scale = interpolate(s, [0, 1], [0.5, 1]);
      return { transform: `rotate(${r}deg) scale(${scale})`, opacity: s };
    }
    case "zoom-out": {
      const s = spring({ frame, fps, config: { damping: 14, stiffness: 160 } });
      const scale = interpolate(s, [0, 1], [2.5, 1]);
      return { transform: `scale(${scale})`, opacity: Math.min(s * 2, 1) };
    }
  }
}

export const KineticSegment: React.FC<Props> = ({ segment, index }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const position = segment.position || "center";
  const animation = segment.animation || "pop";
  const rotation = segment.rotation || 0;
  const fontSize = segment.fontSize || 72;
  const color = segment.color || "#FFFFFF";
  const accentColor = segment.accentColor || "#FFD700";

  // Pick font based on index for variety
  const fontFamily = fonts[index % fonts.length];

  const { transform: animTransform, opacity } = getAnimationTransform(
    animation,
    0,
    fps,
    frame
  );

  // Exit animation: fade out in last 8 frames
  const exitStart = durationInFrames - 8;
  const exitOpacity = frame >= exitStart
    ? interpolate(frame, [exitStart, durationInFrames], [1, 0], { extrapolateRight: "clamp" })
    : 1;

  // Split text: last word gets accent color
  const words = segment.text.split(" ");
  const mainWords = words.slice(0, -1).join(" ");
  const keyWord = words[words.length - 1];

  return (
    <div
      style={{
        position: "absolute",
        ...positionStyles[position],
        padding: "0 50px",
        opacity: opacity * exitOpacity,
        transform: `${animTransform} rotate(${rotation}deg)`,
        zIndex: 10,
      }}
    >
      <span
        style={{
          fontSize,
          fontWeight: 900,
          fontFamily,
          color,
          textShadow:
            "0 4px 25px rgba(0,0,0,0.9), 3px 3px 0 rgba(0,0,0,1), -2px -2px 0 rgba(0,0,0,0.8)",
          textTransform: "uppercase",
          lineHeight: 1.2,
          letterSpacing: 3,
          display: "inline",
        }}
      >
        {mainWords}{mainWords ? " " : ""}
        <span style={{ color: accentColor }}>{keyWord}</span>
      </span>
    </div>
  );
};
