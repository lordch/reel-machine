import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/RussoOne";

const { fontFamily } = loadFont();

export const Typewriter: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const chars = text.split("");
  const totalTypingFrames = Math.min(durationInFrames * 0.7, fps * 2);
  const framesPerChar = totalTypingFrames / chars.length;

  return (
    <div
      style={{
        position: "absolute",
        top: 280,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "0 60px",
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.75)",
          padding: "16px 32px",
          borderRadius: 12,
          borderLeft: "4px solid #00ff88",
        }}
      >
        <span
          style={{
            fontSize: 56,
            fontFamily,
            color: "#00ff88",
            letterSpacing: 1,
            lineHeight: 1.4,
          }}
        >
          {chars.map((char, i) => {
            const charStart = i * framesPerChar;
            const isVisible = frame >= charStart;
            return (
              <span key={i} style={{ opacity: isVisible ? 1 : 0 }}>
                {char}
              </span>
            );
          })}
        </span>
        <span
          style={{
            fontSize: 56,
            fontFamily,
            color: "#00ff88",
            opacity: Math.sin(frame * 0.3) > 0 ? 1 : 0,
          }}
        >
          |
        </span>
      </div>
    </div>
  );
};
