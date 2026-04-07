import React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  interpolate,
} from "remotion";
import type { ClipInfo } from "../types";

interface Props {
  clips: ClipInfo[] | string[];
  durationInFrames: number;
  fps: number;
}

const FADE_FRAMES = 6; // ~0.2s crossfade at 30fps

/**
 * Renders a single clip with fade-in transition.
 * The clip fades in over FADE_FRAMES, creating a crossfade
 * with the previous clip that's still visible underneath.
 */
const ClipWithFade: React.FC<{
  src: string;
  isFirst: boolean;
  videoDuration: number;
  slotDuration: number;
}> = ({ src, isFirst, videoDuration, slotDuration }) => {
  const frame = useCurrentFrame();

  // Fade in (skip for first clip)
  const fadeIn = isFirst
    ? 1
    : interpolate(frame, [0, FADE_FRAMES], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

  // If video is shorter than slot (gap at end), hold last frame
  // OffthreadVideo naturally holds last frame when Sequence extends beyond video

  return (
    <AbsoluteFill style={{ opacity: fadeIn }}>
      <OffthreadVideo
        src={staticFile(src)}
        volume={0}
        muted
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * Hard-cut clip sequence with CSS crossfade transitions.
 *
 * Timeline = narration timeline (no compression).
 * Each clip occupies its full slot (speech + gap).
 * Clips fade in over ~0.2s, creating crossfade with previous clip.
 * The "gap" between speech segments is covered by the transition.
 */
export const ClipSequence: React.FC<Props> = ({
  clips,
  durationInFrames,
  fps,
}) => {
  const normalizedClips: ClipInfo[] = clips.map((clip) => {
    if (typeof clip === "string") {
      return {
        src: clip,
        durationInFrames: Math.floor(durationInFrames / clips.length),
      };
    }
    return clip;
  });

  let frameOffset = 0;

  return (
    <AbsoluteFill>
      {normalizedClips.map((clip, i) => {
        const startFrame = frameOffset;
        frameOffset += clip.durationInFrames;

        // Start the clip FADE_FRAMES early so it overlaps with previous clip's end
        const overlapStart = i === 0 ? startFrame : Math.max(0, startFrame - FADE_FRAMES);
        const overlapDuration = clip.durationInFrames + (i === 0 ? 0 : FADE_FRAMES);

        return (
          <Sequence
            key={i}
            from={overlapStart}
            durationInFrames={overlapDuration}
            layout="none"
          >
            <ClipWithFade
              src={clip.src}
              isFirst={i === 0}
              videoDuration={clip.videoDurationInFrames || clip.durationInFrames}
              slotDuration={overlapDuration}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
