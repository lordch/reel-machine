import React from "react";
import { Img, staticFile, spring, useCurrentFrame, useVideoConfig, AbsoluteFill, Sequence } from "remotion";
import type { ClipInfo } from "../types";

interface Props {
  logo: string;
  website: string;
  clips?: ClipInfo[];
}

export const BrandingOverlay: React.FC<Props> = ({ logo, website, clips }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  // If no clip info, show default branding on all frames
  if (!clips || clips.length === 0) {
    return (
      <AbsoluteFill>
        <div
          style={{
            position: "absolute",
            top: 80,
            right: 40,
            opacity,
          }}
        >
          <Img src={staticFile(logo)} style={{ width: 120, height: 120 }} />
        </div>
      </AbsoluteFill>
    );
  }

  // Scene-type-aware branding: prominent on avatar, subtle on broll
  let frameOffset = 0;
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const isAvatar = clip.sceneType === "avatar";

    elements.push(
      <Sequence key={i} from={frameOffset} durationInFrames={clip.durationInFrames}>
        <AbsoluteFill>
          <div
            style={{
              position: "absolute",
              top: 50,
              right: 36,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              opacity: isAvatar ? 1 : 0.8,
            }}
          >
            <Img
              src={staticFile(logo)}
              style={{ width: 400, height: 400 }}
            />
            <span
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: "#FFFFFF",
                textShadow: "0 2px 8px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.5)",
                fontFamily: "Arial, sans-serif",
                letterSpacing: 1.5,
              }}
            >
              {website}
            </span>
          </div>
        </AbsoluteFill>
      </Sequence>,
    );

    frameOffset += clip.durationInFrames;
  }

  return <AbsoluteFill>{elements}</AbsoluteFill>;
};
