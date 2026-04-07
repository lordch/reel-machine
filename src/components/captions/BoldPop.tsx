import React from "react";
import { useCurrentFrame, spring, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Bangers";
import { DEFAULTS } from "../../pipeline/config";

const { fontFamily } = loadFont();

export const BoldPop: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");
  const framesPerWord = Math.max(4, Math.floor((fps * 0.8) / words.length));
  const lastWordIndex = words.length - 1;

  return (
    <div
      style={{
        position: "absolute",
        bottom: DEFAULTS.captionBottomPx,
        left: 0,
        right: 0,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
        gap: "8px 16px",
        padding: "0 60px",
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
              config: { damping: 10, stiffness: 250 },
            })
          : 0;

        // Key word gets extra zoom pop
        const keyScale = isKeyWord && isCurrentWord ? 1.25 : 1;

        return (
          <span
            key={i}
            style={{
              fontSize: 78,
              fontWeight: 400,
              fontFamily,
              color: isCurrentWord ? "#FFD700" : "#FFFFFF",
              textShadow:
                "0 4px 20px rgba(0,0,0,0.8), 3px 3px 0 rgba(0,0,0,1), -3px -3px 0 rgba(0,0,0,1)",
              transform: `scale(${scale * keyScale})`,
              opacity: isVisible ? 1 : 0,
              textTransform: "uppercase",
              lineHeight: 1.3,
              letterSpacing: 2,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};
