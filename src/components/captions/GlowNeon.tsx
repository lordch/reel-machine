import React from "react";
import { useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { loadFont } from "@remotion/google-fonts/BebasNeue";

const { fontFamily } = loadFont();

export const GlowNeon: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");
  const framesPerWord = Math.max(4, Math.floor((fps * 0.6) / words.length));
  const lastWordIndex = words.length - 1;

  const glowPulse = interpolate(
    Math.sin(frame * 0.15),
    [-1, 1],
    [0.6, 1]
  );

  return (
    <div
      style={{
        position: "absolute",
        top: 260,
        left: 0,
        right: 0,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
        gap: "4px 20px",
        padding: "0 50px",
      }}
    >
      {words.map((word, i) => {
        const wordStart = i * framesPerWord;
        const isVisible = frame >= wordStart;
        const isCurrentWord =
          frame >= wordStart && frame < wordStart + framesPerWord;
        const isKeyWord = i === lastWordIndex;

        const scale = isVisible
          ? spring({
              frame: frame - wordStart,
              fps,
              config: { damping: 15, stiffness: 150 },
            })
          : 0;

        const neonColor = isCurrentWord ? "#ff00ff" : "#00f0ff";
        const glowSize = isCurrentWord ? 30 * glowPulse : 15 * glowPulse;
        const keyZoom = isKeyWord && isCurrentWord ? 1.3 : 1;

        return (
          <span
            key={i}
            style={{
              fontSize: 74,
              fontFamily,
              color: neonColor,
              textShadow: `
                0 0 ${glowSize}px ${neonColor},
                0 0 ${glowSize * 2}px ${neonColor},
                0 0 ${glowSize * 3}px ${neonColor}40
              `,
              transform: `scale(${scale * keyZoom})`,
              opacity: isVisible ? 1 : 0,
              textTransform: "uppercase",
              lineHeight: 1.3,
              letterSpacing: 6,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};
