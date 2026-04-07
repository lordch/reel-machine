import React from "react";
import { useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { loadFont } from "@remotion/google-fonts/Oswald";

const { fontFamily } = loadFont("normal", {
  weights: ["700"],
  subsets: ["latin"],
});

export const SlideUp: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");
  const framesPerWord = Math.max(3, Math.floor((fps * 0.6) / words.length));

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
        gap: "6px 14px",
        padding: "0 50px",
      }}
    >
      {words.map((word, i) => {
        const wordStart = i * framesPerWord;
        const isVisible = frame >= wordStart;

        const progress = isVisible
          ? spring({
              frame: frame - wordStart,
              fps,
              config: { damping: 14, stiffness: 180 },
            })
          : 0;

        const translateY = interpolate(progress, [0, 1], [60, 0]);
        const opacity = interpolate(progress, [0, 0.3, 1], [0, 1, 1]);

        return (
          <span
            key={i}
            style={{
              fontSize: 70,
              fontWeight: 700,
              fontFamily,
              color: "#FFFFFF",
              textShadow:
                "0 4px 15px rgba(0,0,0,0.9), 0 0 30px rgba(230, 57, 70, 0.5)",
              transform: `translateY(${translateY}px)`,
              opacity,
              textTransform: "uppercase",
              lineHeight: 1.3,
              letterSpacing: 3,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};
