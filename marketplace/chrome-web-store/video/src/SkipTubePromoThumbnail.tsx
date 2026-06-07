import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { COLORS, FONT } from "./theme";

export const SkipTubePromoThumbnail: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.bg, fontFamily: FONT }}>
    <AbsoluteFill
      style={{
        opacity: 0.5,
        backgroundImage: "radial-gradient(#d8dde6 1.2px, transparent 1.2px)",
        backgroundSize: "28px 28px",
      }}
    />
    <div
      style={{
        position: "absolute",
        right: -180,
        bottom: -220,
        width: 1160,
        height: 420,
        transform: "rotate(-9deg)",
        borderTopLeftRadius: 260,
        background:
          "linear-gradient(110deg, rgba(255,16,31,0.96), rgba(255,16,31,0.62))",
      }}
    />
    <div
      style={{
        position: "absolute",
        left: 96,
        top: 96,
        display: "flex",
        alignItems: "center",
        gap: 24,
      }}
    >
      <Img
        src={staticFile("logo.png")}
        style={{ width: 104, height: 104, objectFit: "contain" }}
      />
      <div>
        <div
          style={{
            fontSize: 72,
            fontWeight: 950,
            color: COLORS.ink,
            lineHeight: 1,
          }}
        >
          SkipTube <span style={{ color: COLORS.red }}>AI</span>
        </div>
        <div
          style={{
            marginTop: 12,
            fontSize: 28,
            fontWeight: 800,
            color: COLORS.inkSoft,
          }}
        >
          AI-powered Chrome extension for YouTube
        </div>
      </div>
    </div>
    <div
      style={{
        position: "absolute",
        left: 106,
        top: 316,
        width: 780,
        fontSize: 84,
        lineHeight: 1,
        fontWeight: 950,
        letterSpacing: 0,
        color: COLORS.ink,
      }}
    >
      Skip sponsors, intros and promos automatically.
    </div>
    <div
      style={{
        position: "absolute",
        left: 112,
        bottom: 118,
        width: 590,
        height: 76,
        borderRadius: 999,
        background: COLORS.red,
        color: COLORS.surface,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 28,
        fontWeight: 950,
        boxShadow: "0 26px 70px rgba(255,16,31,0.28)",
      }}
    >
      Add SkipTube AI to Chrome
    </div>
    <div
      style={{
        position: "absolute",
        right: 78,
        top: 210,
        width: 880,
        height: 352,
        borderRadius: 28,
        overflow: "hidden",
        border: `1px solid ${COLORS.hairline}`,
        boxShadow: `0 34px 90px ${COLORS.shadow}`,
        transform: "rotate(-1deg)",
        background: COLORS.surface,
      }}
    >
      <Img
        src={staticFile("screenshots/featured.png")}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
    <div
      style={{
        position: "absolute",
        right: 190,
        bottom: 132,
        width: 620,
        height: 132,
        borderRadius: 28,
        background: COLORS.surface,
        border: `1px solid ${COLORS.hairline}`,
        boxShadow: `0 30px 72px ${COLORS.shadow}`,
        padding: "24px 30px",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 30,
          fontSize: 20,
          fontWeight: 900,
          color: COLORS.ink,
          marginBottom: 18,
        }}
      >
        <span style={{ color: COLORS.blue }}>● Intro</span>
        <span style={{ color: COLORS.pink }}>● Sponsor</span>
        <span style={{ color: COLORS.orange }}>● Promo</span>
      </div>
      <div
        style={{
          height: 18,
          borderRadius: 999,
          background: "#e7ebf1",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "36%", background: COLORS.blue }} />
        <div style={{ position: "absolute", left: "34%", top: 0, bottom: 0, width: "24%", background: COLORS.pink }} />
        <div style={{ position: "absolute", left: "68%", top: 0, bottom: 0, width: "18%", background: COLORS.orange }} />
      </div>
    </div>
  </AbsoluteFill>
);
