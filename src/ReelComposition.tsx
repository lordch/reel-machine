import React from "react";
import { AbsoluteFill, Audio, staticFile } from "remotion";
import { ClipSequence } from "./components/ClipSequence";
import { CaptionOverlay } from "./components/CaptionOverlay";
import { BrandingOverlay } from "./components/BrandingOverlay";
import type { ReelProps, ClipInfo } from "./types";

export const ReelComposition: React.FC<
  ReelProps & { narrationSrc: string; musicSrc?: string }
> = ({
  clips,
  captions,
  captionStyle,
  branding,
  fps,
  durationInFrames,
  narrationSrc,
  musicSrc,
}) => {
  const clipInfos = Array.isArray(clips)
    ? clips.filter((c): c is ClipInfo => typeof c !== "string")
    : [];

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Video layer — all clips are mute, visual only */}
      <ClipSequence
        clips={clips}
        durationInFrames={durationInFrames}
        fps={fps}
      />
      {/* Captions synced to narration timestamps */}
      <CaptionOverlay captions={captions} style={captionStyle} />
      {/* Branding */}
      <BrandingOverlay
        logo={branding.logo}
        website={branding.website}
        clips={clipInfos}
      />
      {/* Master audio — single continuous narration from ElevenLabs */}
      <Audio src={staticFile(narrationSrc)} volume={1} />
      {/* Optional background music */}
      {musicSrc && (
        <Audio src={staticFile(musicSrc)} volume={0.15} />
      )}
    </AbsoluteFill>
  );
};
