import React from "react";
import {
  useCurrentFrame,
  spring,
  useVideoConfig,
  random,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/PermanentMarker";

const { fontFamily } = loadFont();

export const Glitch: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");
  const framesPerWord = Math.max(4, Math.floor((fps * 0.7) / words.length));
  const lastWordIndex = words.length - 1;

  return (
    <div
      style={{
        position: "absolute",
        top: 280,
        left: 0,
        right: 0,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
        gap: "8px 18px",
        padding: "0 50px",
      }}
    >
      {words.map((word, i) => {
        const wordStart = i * framesPerWord;
        const isVisible = frame >= wordStart;
        const timeSinceAppear = frame - wordStart;
        const isGlitching = timeSinceAppear >= 0 && timeSinceAppear < 8;
        const isKeyWord = i === lastWordIndex;

        const scale = isVisible
          ? spring({
              frame: timeSinceAppear,
              fps,
              config: { damping: 8, stiffness: 300 },
            })
          : 0;

        const glitchX = isGlitching
          ? (random(`glitch-x-${i}-${frame}`) - 0.5) * 12
          : 0;
        const glitchY = isGlitching
          ? (random(`glitch-y-${i}-${frame}`) - 0.5) * 8
          : 0;
        const glitchSkew = isGlitching
          ? (random(`glitch-skew-${i}-${frame}`) - 0.5) * 10
          : 0;

        const rgbOffset = isGlitching ? 3 : 0;
        const keyZoom = isKeyWord && isGlitching ? 1.2 : 1;

        return (
          <span
            key={i}
            style={{
              fontSize: 68,
              fontFamily,
              color: "#FFFFFF",
              textShadow: `
                ${rgbOffset}px 0 0 rgba(255,0,0,0.7),
                ${-rgbOffset}px 0 0 rgba(0,255,255,0.7),
                0 2px 10px rgba(0,0,0,0.9)
              `,
              transform: `scale(${scale * keyZoom}) translate(${glitchX}px, ${glitchY}px) skewX(${glitchSkew}deg)`,
              opacity: isVisible ? 1 : 0,
              textTransform: "uppercase",
              lineHeight: 1.3,
              letterSpacing: 1,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};
