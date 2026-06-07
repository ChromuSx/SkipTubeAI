import React from "react";
import { Composition, Still } from "remotion";
import { SkipTubePromo } from "./SkipTubePromo";
import { SkipTubePromoThumbnail } from "./SkipTubePromoThumbnail";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SkipTubePromo"
        component={SkipTubePromo}
        durationInFrames={1800}
        fps={60}
        width={1920}
        height={1080}
      />
      <Still
        id="SkipTubePromoThumbnail"
        component={SkipTubePromoThumbnail}
        width={1920}
        height={1080}
      />
    </>
  );
};
