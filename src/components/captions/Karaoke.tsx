import React from "react";
import { useCurrentFrame, spring, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Montserrat";
import { DEFAULTS } from "../../pipeline/config";

const { fontFamily } = loadFont("normal", {
  weights: ["900"],
  subsets: ["latin"],
});

export const Karaoke: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");
  const framesPerWord = Math.max(4, Math.floor((fps * 0.8) / words.length));

  const containerScale = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 120 },
  });

  return (
    <div
      style={{
        position: "absolute",
        bottom: DEFAULTS.captionBottomPx,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        padding: "0 40px",
        transform: `scale(${containerScale})`,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "6px 12px",
        }}
      >
        {words.map((word, i) => {
          const wordStart = i * framesPerWord;
          const isActive =
            frame >= wordStart && frame < wordStart + framesPerWord;
          const isPast = frame >= wordStart + framesPerWord;

          const highlightScale = isActive
            ? spring({
                frame: frame - wordStart,
                fps,
                config: { damping: 10, stiffness: 300 },
              })
            : 1;

          return (
            <span
              key={i}
              style={{
                fontSize: 64,
                fontWeight: 900,
                fontFamily,
                color: isActive
                  ? "#000"
                  : isPast
                    ? "#FFFFFF"
                    : "rgba(255,255,255,0.4)",
                backgroundColor: isActive ? "#FFD700" : "transparent",
                padding: isActive ? "4px 12px" : "4px 0",
                borderRadius: 8,
                transform: `scale(${highlightScale})`,
                textTransform: "uppercase",
                lineHeight: 1.4,
                textShadow: isActive
                  ? "none"
                  : "0 2px 10px rgba(0,0,0,0.8)",
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </div>
  );
};
