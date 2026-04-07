import React from "react";
import { Composition } from "remotion";
import { ReelComposition } from "./ReelComposition";

// Dynamic import for generated reel — may not exist yet
let generatedReelProps: any = null;
try {
  generatedReelProps = require("./data/generated-reel").generatedReelProps;
} catch {
  // generated-reel.ts doesn't exist yet — that's fine
}

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {generatedReelProps && (
        <Composition
          id="GeneratedReel"
          component={ReelComposition as any}
          durationInFrames={generatedReelProps.durationInFrames}
          fps={generatedReelProps.fps}
          width={1080}
          height={1920}
          defaultProps={generatedReelProps}
        />
      )}
    </>
  );
};
