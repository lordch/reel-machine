import React from "react";
import { AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { ClipInfo } from "../types";

interface OverlayData {
  text: string;
  position: string;
  animation: string;
  fontSize?: number;
  color?: string;
  emoji?: string;
}

interface SceneOverlayInfo {
  overlay: OverlayData;
  startFrame: number;
  durationInFrames: number;
}

interface Props {
  overlays: SceneOverlayInfo[];
}

const OverlayItem: React.FC<{ overlay: OverlayData }> = ({ overlay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 200 },
  });

  // Animation styles based on type
  let animStyle: React.CSSProperties = {};
  switch (overlay.animation) {
    case "slam":
      animStyle = {
        transform: `scale(${1 + (1 - progress) * 2})`,
        opacity: progress,
      };
      break;
    case "pop":
      animStyle = {
        transform: `scale(${progress})`,
        opacity: progress,
      };
      break;
    case "zoom-out":
      animStyle = {
        transform: `scale(${2 - progress})`,
        opacity: progress,
      };
      break;
    case "slide-left":
      animStyle = {
        transform: `translateX(${(1 - progress) * 200}px)`,
        opacity: progress,
      };
      break;
    case "slide-right":
      animStyle = {
        transform: `translateX(${(progress - 1) * 200}px)`,
        opacity: progress,
      };
      break;
    case "fade-up":
      animStyle = {
        transform: `translateY(${(1 - progress) * 50}px)`,
        opacity: progress,
      };
      break;
    default:
      animStyle = { opacity: progress };
  }

  // Position mapping — safe zone aware (top 14%, bottom 35%)
  let posStyle: React.CSSProperties = {};
  switch (overlay.position) {
    case "top-center":
      posStyle = { top: 320, left: 0, right: 0, textAlign: "center" as const };
      break;
    case "center":
      posStyle = { top: "40%", left: 40, right: 40, textAlign: "center" as const };
      break;
    case "bottom-center":
      posStyle = { bottom: 700, left: 40, right: 40, textAlign: "center" as const };
      break;
    default:
      posStyle = { top: "40%", left: 40, right: 40, textAlign: "center" as const };
  }

  return (
    <div
      style={{
        position: "absolute",
        ...posStyle,
        ...animStyle,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      {overlay.emoji && (
        <span style={{ fontSize: 80, lineHeight: 1 }}>{overlay.emoji}</span>
      )}
      <span
        style={{
          fontSize: overlay.fontSize || 64,
          fontWeight: 900,
          color: overlay.color || "#FFFFFF",
          textShadow: "0 4px 20px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.5)",
          fontFamily: "'Arial Black', Arial, sans-serif",
          textTransform: "uppercase",
          letterSpacing: 1,
          lineHeight: 1.1,
          WebkitTextStroke: "2px rgba(0,0,0,0.3)",
        }}
      >
        {overlay.text}
      </span>
    </div>
  );
};

export const SceneOverlay: React.FC<Props> = ({ overlays }) => {
  return (
    <AbsoluteFill>
      {overlays.map((item, i) => (
        <Sequence
          key={i}
          from={item.startFrame}
          durationInFrames={item.durationInFrames}
        >
          <OverlayItem overlay={item.overlay} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
