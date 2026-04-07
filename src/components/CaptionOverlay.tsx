import React from "react";
import { Sequence, AbsoluteFill } from "remotion";
import type { CaptionSegment, CaptionStyle } from "../types";
import { BoldPop } from "./captions/BoldPop";
import { Typewriter } from "./captions/Typewriter";
import { GlowNeon } from "./captions/GlowNeon";
import { Karaoke } from "./captions/Karaoke";
import { SlideUp } from "./captions/SlideUp";
import { Glitch } from "./captions/Glitch";
import { KineticSegment } from "./captions/Kinetic";

interface Props {
  captions: CaptionSegment[];
  style: CaptionStyle;
}

const captionComponents: Record<
  Exclude<CaptionStyle, "kinetic">,
  React.FC<{ text: string }>
> = {
  "bold-pop": BoldPop,
  typewriter: Typewriter,
  "glow-neon": GlowNeon,
  karaoke: Karaoke,
  "slide-up": SlideUp,
  glitch: Glitch,
};

export const CaptionOverlay: React.FC<Props> = ({ captions, style }) => {
  if (style === "kinetic") {
    return (
      <AbsoluteFill>
        {captions.map((segment, i) => (
          <Sequence
            key={i}
            from={segment.startFrame}
            durationInFrames={segment.endFrame - segment.startFrame}
          >
            <KineticSegment segment={segment} index={i} />
          </Sequence>
        ))}
      </AbsoluteFill>
    );
  }

  const CaptionComponent = captionComponents[style];

  return (
    <AbsoluteFill>
      {captions.map((segment, i) => (
        <Sequence
          key={i}
          from={segment.startFrame}
          durationInFrames={segment.endFrame - segment.startFrame}
        >
          <CaptionComponent text={segment.text} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
