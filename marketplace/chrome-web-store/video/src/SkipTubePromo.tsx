import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, FONT } from "./theme";

const DURATION = 1800;

const sceneOpacity = (
  frame: number,
  inStart: number,
  inEnd: number,
  outStart: number,
  outEnd: number
) => {
  const enter = interpolate(frame, [inStart, inEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const exit = interpolate(frame, [outStart, outEnd], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });
  return enter * exit;
};

const pop = (frame: number, start: number, fps: number) =>
  spring({
    frame: Math.max(0, frame - start),
    fps,
    config: { damping: 18, mass: 0.8, stiffness: 120 },
  });

const LogoLockup: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: compact ? 14 : 20,
      fontFamily: FONT,
    }}
  >
    <Img
      src={staticFile("logo.png")}
      style={{
        width: compact ? 58 : 92,
        height: compact ? 58 : 92,
        objectFit: "contain",
      }}
    />
    <div>
      <div
        style={{
          fontSize: compact ? 34 : 62,
          fontWeight: 900,
          lineHeight: 0.95,
          color: COLORS.ink,
        }}
      >
        SkipTube <span style={{ color: COLORS.red }}>AI</span>
      </div>
      <div
        style={{
          marginTop: compact ? 4 : 10,
          fontSize: compact ? 16 : 24,
          fontWeight: 700,
          color: COLORS.inkSoft,
        }}
      >
        Skip content with AI
      </div>
    </div>
  </div>
);

const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, DURATION], [0, 90], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      <AbsoluteFill
        style={{
          opacity: 0.46,
          backgroundImage:
            "radial-gradient(#d8dde6 1.2px, transparent 1.2px)",
          backgroundSize: "28px 28px",
          backgroundPosition: `${drift}px ${drift * 0.4}px`,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: -180,
          bottom: -230,
          width: 1160,
          height: 420,
          transform: `rotate(-9deg) translateX(${Math.sin(frame / 80) * 14}px)`,
          borderTopLeftRadius: 260,
          background:
            "linear-gradient(110deg, rgba(255,16,31,0.96), rgba(255,16,31,0.62))",
          boxShadow: "0 -28px 90px rgba(255,16,31,0.18)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 92,
          width: 560,
          height: 1,
          background:
            "linear-gradient(90deg, rgba(255,16,31,0), rgba(255,16,31,0.35), rgba(255,16,31,0))",
        }}
      />
    </AbsoluteFill>
  );
};

const FeaturePill: React.FC<{
  label: string;
  color: string;
  delay: number;
}> = ({ label, color, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = pop(frame, delay, fps);

  return (
    <div
      style={{
        height: 58,
        padding: "0 24px",
        borderRadius: 16,
        background: COLORS.surface,
        border: `1px solid ${COLORS.hairline}`,
        boxShadow: `0 18px 42px ${COLORS.shadow}`,
        display: "flex",
        alignItems: "center",
        gap: 12,
        transform: `scale(${interpolate(s, [0, 1], [0.92, 1])})`,
        opacity: s,
      }}
    >
      <div
        style={{
          width: 13,
          height: 13,
          borderRadius: 999,
          background: color,
        }}
      />
      <span style={{ fontSize: 22, fontWeight: 850, color: COLORS.ink }}>
        {label}
      </span>
    </div>
  );
};

const ScreenshotCard: React.FC<{
  src: string;
  width: number;
  height: number;
  rotate?: number;
  shadow?: boolean;
}> = ({ src, width, height, rotate = 0, shadow = true }) => (
  <div
    style={{
      width,
      height,
      borderRadius: 24,
      overflow: "hidden",
      background: COLORS.surface,
      border: `1px solid ${COLORS.hairline}`,
      boxShadow: shadow ? `0 32px 88px ${COLORS.shadow}` : undefined,
      transform: `rotate(${rotate}deg)`,
    }}
  >
    <Img
      src={staticFile(src)}
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
  </div>
);

const HeroScene: React.FC<{ opacity: number }> = ({ opacity }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const intro = pop(frame, 0, fps);
  const imageIn = pop(frame, 42, fps);

  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 96,
          transform: `translateY(${interpolate(intro, [0, 1], [36, 0])}px)`,
        }}
      >
        <LogoLockup />
      </div>
      <div
        style={{
          position: "absolute",
          left: 118,
          top: 286,
          width: 780,
          fontFamily: FONT,
        }}
      >
        <div
          style={{
            fontSize: 82,
            lineHeight: 0.98,
            fontWeight: 950,
            letterSpacing: 0,
            color: COLORS.ink,
          }}
        >
          Skip sponsors, intros and promos automatically.
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 30,
            lineHeight: 1.3,
            fontWeight: 700,
            color: COLORS.inkSoft,
            width: 710,
          }}
        >
          AI transcript analysis detects the parts you do not want, then keeps
          playback moving.
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 118,
          bottom: 120,
          display: "flex",
          gap: 18,
        }}
      >
        <FeaturePill label="Auto-skip" color={COLORS.blue} delay={72} />
        <FeaturePill label="Local cache" color={COLORS.green} delay={88} />
        <FeaturePill label="BYO API key" color={COLORS.red} delay={104} />
      </div>
      <div
        style={{
          position: "absolute",
          right: 82,
          top: 178,
          transform: `translateY(${interpolate(imageIn, [0, 1], [44, 0])}px) scale(${interpolate(
            imageIn,
            [0, 1],
            [0.94, 1]
          )})`,
          opacity: imageIn,
        }}
      >
        <ScreenshotCard
          src="screenshots/featured.png"
          width={860}
          height={344}
          rotate={-1.2}
        />
        <div
          style={{
            position: "absolute",
            left: 84,
            bottom: -118,
            width: 620,
            height: 98,
            borderRadius: 28,
            background: COLORS.surface,
            border: `1px solid ${COLORS.hairline}`,
            boxShadow: `0 24px 64px ${COLORS.shadow}`,
            display: "flex",
            alignItems: "center",
            padding: "0 28px",
            gap: 20,
          }}
        >
          <TimelineMini progress={interpolate(frame, [90, 250], [0.12, 0.7])} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const TimelineMini: React.FC<{ progress: number }> = ({ progress }) => {
  const markers = [
    { left: 10, width: 18, color: COLORS.blue, label: "Intro" },
    { left: 31, width: 22, color: COLORS.pink, label: "Sponsor" },
    { left: 64, width: 18, color: COLORS.orange, label: "Promo" },
  ];

  return (
    <div style={{ width: "100%", fontFamily: FONT }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 12,
          fontSize: 15,
          fontWeight: 850,
          color: COLORS.inkSoft,
        }}
      >
        {markers.map((marker) => (
          <div key={marker.label} style={{ display: "flex", gap: 8 }}>
            <span style={{ color: marker.color }}>●</span>
            {marker.label}
          </div>
        ))}
      </div>
      <div
        style={{
          position: "relative",
          height: 12,
          borderRadius: 999,
          background: "#e7ebf1",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${Math.max(4, Math.min(100, progress * 100))}%`,
            background: COLORS.blue,
          }}
        />
        {markers.map((marker) => (
          <div
            key={marker.label}
            style={{
              position: "absolute",
              left: `${marker.left}%`,
              width: `${marker.width}%`,
              top: 0,
              bottom: 0,
              background: marker.color,
            }}
          />
        ))}
      </div>
    </div>
  );
};

const BrowserMock: React.FC<{ localFrame: number }> = ({ localFrame }) => {
  const markerProgress = interpolate(localFrame, [0, 250], [0.18, 0.76], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scan = interpolate(localFrame, [34, 220], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width: 1060,
        height: 642,
        borderRadius: 30,
        overflow: "hidden",
        background: COLORS.surface,
        border: `1px solid ${COLORS.hairline}`,
        boxShadow: `0 32px 90px ${COLORS.shadow}`,
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          height: 64,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 24px",
          borderBottom: `1px solid ${COLORS.hairline}`,
          color: COLORS.inkSoft,
          fontSize: 18,
          fontWeight: 800,
        }}
      >
        <span style={{ color: COLORS.red }}>●</span>
        <span style={{ color: COLORS.orange }}>●</span>
        <span style={{ color: COLORS.green }}>●</span>
        <div
          style={{
            marginLeft: 12,
            height: 36,
            flex: 1,
            borderRadius: 999,
            background: "#f0f2f6",
            display: "flex",
            alignItems: "center",
            paddingLeft: 20,
          }}
        >
          youtube.com/watch
        </div>
      </div>
      <div
        style={{
          position: "relative",
          height: 578,
          background:
            "linear-gradient(135deg, #15171c 0%, #242833 52%, #121316 100%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 50,
            top: 54,
            width: 512,
            height: 272,
            borderRadius: 22,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: `${scan * 82}%`,
              height: 84,
              background:
                "linear-gradient(180deg, rgba(255,16,31,0), rgba(255,16,31,0.34), rgba(255,16,31,0))",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 32,
              top: 32,
              color: "rgba(255,255,255,0.86)",
              fontSize: 28,
              fontWeight: 900,
            }}
          >
            Inside the AI Creator Workflow
          </div>
          <div
            style={{
              position: "absolute",
              left: 32,
              bottom: 34,
              color: "rgba(255,255,255,0.72)",
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            transcript detected
          </div>
        </div>
        <TranscriptPanel localFrame={localFrame} />
        <div
          style={{
            position: "absolute",
            left: 54,
            right: 54,
            bottom: 52,
            height: 58,
            display: "flex",
            alignItems: "center",
            gap: 20,
          }}
        >
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: 999,
              background: COLORS.red,
              color: COLORS.surface,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              fontWeight: 900,
            }}
          >
            ▶
          </div>
          <div style={{ flex: 1 }}>
            <TimelineMini progress={markerProgress} />
          </div>
        </div>
      </div>
    </div>
  );
};

const TranscriptPanel: React.FC<{ localFrame: number }> = ({ localFrame }) => {
  const rows = [
    { time: "0:00", text: "Welcome back to the channel", color: COLORS.blue },
    { time: "2:14", text: "This video is sponsored by...", color: COLORS.pink },
    { time: "8:56", text: "Check out my course and links", color: COLORS.orange },
    { time: "12:48", text: "Thanks for watching", color: COLORS.purple },
  ];

  return (
    <div
      style={{
        position: "absolute",
        right: 52,
        top: 54,
        width: 382,
        borderRadius: 24,
        background: "rgba(255,255,255,0.92)",
        border: "1px solid rgba(255,255,255,0.65)",
        boxShadow: "0 24px 70px rgba(0,0,0,0.28)",
        padding: 22,
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          fontSize: 20,
          fontWeight: 950,
          color: COLORS.ink,
          marginBottom: 16,
        }}
      >
        AI transcript analysis
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        {rows.map((row, index) => {
          const visible = interpolate(
            localFrame,
            [40 + index * 30, 64 + index * 30],
            [0, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.cubic),
            }
          );
          return (
            <div
              key={row.time}
              style={{
                height: 54,
                boxSizing: "border-box",
                borderRadius: 15,
                background: "#f7f9fc",
                border: `1px solid ${COLORS.hairline}`,
                display: "flex",
                alignItems: "center",
                padding: "0 14px",
                gap: 12,
                opacity: visible,
                transform: `translateX(${(1 - visible) * 18}px)`,
              }}
            >
              <span
                style={{
                  width: 52,
                  fontSize: 16,
                  fontWeight: 900,
                  color: row.color,
                }}
              >
                {row.time}
              </span>
              <span
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  color: COLORS.ink,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {row.text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Headline: React.FC<{
  eyebrow: string;
  title: string;
  body: string;
  align?: "left" | "center";
}> = ({ eyebrow, title, body, align = "left" }) => (
  <div style={{ fontFamily: FONT, textAlign: align }}>
    <div
      style={{
        color: COLORS.red,
        fontSize: 24,
        fontWeight: 950,
        textTransform: "uppercase",
        letterSpacing: 0,
        marginBottom: 16,
      }}
    >
      {eyebrow}
    </div>
    <div
      style={{
        color: COLORS.ink,
        fontSize: 64,
        fontWeight: 950,
        lineHeight: 1.02,
        letterSpacing: 0,
      }}
    >
      {title}
    </div>
    <div
      style={{
        color: COLORS.inkSoft,
        fontSize: 27,
        fontWeight: 700,
        lineHeight: 1.35,
        marginTop: 22,
      }}
    >
      {body}
    </div>
  </div>
);

const ScanScene: React.FC<{ opacity: number }> = ({ opacity }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = frame - 300;
  const browserIn = pop(frame, 305, fps);
  const textIn = pop(frame, 355, fps);

  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          left: 76,
          top: 210,
          transform: `translateX(${interpolate(browserIn, [0, 1], [-42, 0])}px) scale(${interpolate(
            browserIn,
            [0, 1],
            [0.96, 1]
          )})`,
        }}
      >
        <BrowserMock localFrame={Math.max(0, localFrame)} />
      </div>
      <div
        style={{
          position: "absolute",
          right: 118,
          top: 228,
          width: 560,
          opacity: textIn,
          transform: `translateY(${interpolate(textIn, [0, 1], [30, 0])}px)`,
        }}
      >
        <Headline
          eyebrow="Detect the segments"
          title="Markers appear before the skip."
          body="SkipTube AI finds the sections that interrupt the video and paints them directly on the timeline."
        />
        <div style={{ marginTop: 34, display: "grid", gap: 14 }}>
          <SegmentBadge label="Intro" time="0s-28s" color={COLORS.blue} />
          <SegmentBadge label="Sponsor" time="2:14-4:52" color={COLORS.pink} />
          <SegmentBadge label="Self-Promo" time="8:56-9:12" color={COLORS.orange} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const SegmentBadge: React.FC<{ label: string; time: string; color: string }> = ({
  label,
  time,
  color,
}) => (
  <div
    style={{
      height: 58,
      borderRadius: 16,
      background: COLORS.surface,
      border: `1px solid ${COLORS.hairline}`,
      boxShadow: `0 16px 36px ${COLORS.shadow}`,
      display: "flex",
      alignItems: "center",
      gap: 14,
      padding: "0 18px",
      fontFamily: FONT,
      width: 360,
    }}
  >
    <div
      style={{
        width: 12,
        height: 12,
        borderRadius: 999,
        background: color,
      }}
    />
    <div style={{ fontSize: 21, fontWeight: 950, color }}>{label}</div>
    <div
      style={{
        marginLeft: "auto",
        fontSize: 18,
        fontWeight: 800,
        color: COLORS.inkSoft,
      }}
    >
      {time}
    </div>
  </div>
);

const SettingsScene: React.FC<{ opacity: number }> = ({ opacity }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mainIn = pop(frame, 710, fps);
  const sideIn = pop(frame, 780, fps);

  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          left: 112,
          top: 104,
          width: 560,
        }}
      >
        <Headline
          eyebrow="Stay in control"
          title="Choose what gets skipped."
          body="Pick the AI provider, adjust confidence, enable categories, and exclude channels that should stay untouched."
        />
      </div>
      <div
        style={{
          position: "absolute",
          right: 700,
          bottom: 126,
          transform: `translateY(${interpolate(mainIn, [0, 1], [42, 0])}px) scale(${interpolate(
            mainIn,
            [0, 1],
            [0.96, 1]
          )})`,
          opacity: mainIn,
        }}
      >
        <ScreenshotCard src="screenshots/settings.png" width={512} height={320} />
      </div>
      <div
        style={{
          position: "absolute",
          right: 330,
          bottom: 232,
          opacity: sideIn,
          transform: `translateY(${interpolate(sideIn, [0, 1], [34, 0])}px) rotate(1.5deg)`,
        }}
      >
        <ScreenshotCard src="screenshots/advanced.png" width={438} height={274} />
      </div>
      <div
        style={{
          position: "absolute",
          right: 74,
          bottom: 124,
          opacity: sideIn,
          transform: `translateY(${interpolate(sideIn, [0, 1], [48, 0])}px) rotate(-1deg)`,
        }}
      >
        <ScreenshotCard src="screenshots/whitelist.png" width={438} height={274} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 112,
          bottom: 126,
          display: "grid",
          gap: 16,
        }}
      >
        <ControlRow label="Sponsorships" color={COLORS.pink} checked />
        <ControlRow label="Intros and outros" color={COLORS.blue} checked />
        <ControlRow label="Self-promotion" color={COLORS.orange} checked />
      </div>
    </AbsoluteFill>
  );
};

const ControlRow: React.FC<{
  label: string;
  color: string;
  checked: boolean;
}> = ({ label, color, checked }) => (
  <div
    style={{
      width: 480,
      height: 66,
      boxSizing: "border-box",
      borderRadius: 18,
      background: COLORS.surface,
      border: `1px solid ${COLORS.hairline}`,
      boxShadow: `0 18px 40px ${COLORS.shadow}`,
      display: "flex",
      alignItems: "center",
      padding: "0 22px",
      gap: 14,
      fontFamily: FONT,
    }}
  >
    <div style={{ width: 13, height: 13, borderRadius: 999, background: color }} />
    <div style={{ fontSize: 23, fontWeight: 900, color: COLORS.ink }}>
      {label}
    </div>
    <div
      style={{
        marginLeft: "auto",
        width: 58,
        height: 34,
        borderRadius: 999,
        background: checked ? COLORS.blue : "#d3d8e0",
        padding: 4,
      }}
    >
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 999,
          background: COLORS.surface,
          marginLeft: checked ? 24 : 0,
        }}
      />
    </div>
  </div>
);

const AutoSkipScene: React.FC<{ opacity: number }> = ({ opacity }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = frame - 1080;
  const skipJump = interpolate(localFrame, [92, 122], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const statsIn = pop(frame, 1180, fps);

  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          left: 100,
          top: 104,
          width: 650,
        }}
      >
        <Headline
          eyebrow="Auto-skip in action"
          title="Jump over the filler. Keep the context."
          body="Segments are cached locally, so repeated videos do not need another analysis for 30 days."
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: 104,
          bottom: 116,
          width: 690,
          height: 188,
          borderRadius: 28,
          background: COLORS.surface,
          border: `1px solid ${COLORS.hairline}`,
          boxShadow: `0 28px 72px ${COLORS.shadow}`,
          padding: 28,
          fontFamily: FONT,
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 950,
            color: COLORS.ink,
            marginBottom: 24,
          }}
        >
          Sponsor segment detected
        </div>
        <div
          style={{
            position: "relative",
            height: 22,
            borderRadius: 999,
            background: "#e7ebf1",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: "30%",
              width: "26%",
              top: 0,
              bottom: 0,
              background: COLORS.pink,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: `${interpolate(skipJump, [0, 1], [32, 56])}%`,
              top: -8,
              width: 5,
              height: 38,
              borderRadius: 999,
              background: COLORS.red,
              boxShadow: "0 0 0 10px rgba(255,16,31,0.13)",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 18,
            color: COLORS.inkSoft,
            fontSize: 19,
            fontWeight: 850,
          }}
        >
          <span>2:14</span>
          <span style={{ color: COLORS.pink }}>skipping sponsor</span>
          <span>4:52</span>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          right: 80,
          top: 112,
          opacity: statsIn,
          transform: `translateY(${interpolate(statsIn, [0, 1], [42, 0])}px)`,
        }}
      >
        <ScreenshotCard src="screenshots/stats.png" width={610} height={381} />
      </div>
      <div
        style={{
          position: "absolute",
          right: 80,
          bottom: 98,
          opacity: statsIn,
          transform: `translateY(${interpolate(statsIn, [0, 1], [56, 0])}px)`,
        }}
      >
        <ScreenshotCard src="screenshots/cache.png" width={740} height={463} />
      </div>
    </AbsoluteFill>
  );
};

const PrivacyScene: React.FC<{ opacity: number }> = ({ opacity }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cardIn = pop(frame, 1450, fps);

  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          left: 122,
          top: 104,
        }}
      >
        <LogoLockup compact />
      </div>
      <div
        style={{
          position: "absolute",
          left: 122,
          top: 238,
          width: 890,
          fontFamily: FONT,
        }}
      >
        <div
          style={{
            fontSize: 76,
            lineHeight: 1.03,
            fontWeight: 950,
            color: COLORS.ink,
            letterSpacing: 0,
          }}
        >
          Skip the parts you do not care about.
        </div>
        <div
          style={{
            marginTop: 28,
            width: 780,
            fontSize: 30,
            lineHeight: 1.35,
            fontWeight: 750,
            color: COLORS.inkSoft,
          }}
        >
          Bring your own Claude or OpenAI API key. Settings and cached analyses
          stay local in Chrome storage.
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          right: 126,
          top: 178,
          width: 540,
          display: "grid",
          gap: 18,
          opacity: cardIn,
          transform: `translateY(${interpolate(cardIn, [0, 1], [48, 0])}px)`,
        }}
      >
        <PrivacyCard title="No developer backend" body="The extension talks directly to the provider you choose." />
        <PrivacyCard title="Local cache" body="Previously analyzed videos can be reused for 30 days." />
        <PrivacyCard title="Open source" body="Review the project, privacy policy, and issue tracker on GitHub." />
      </div>
      <div
        style={{
          position: "absolute",
          left: 122,
          bottom: 110,
          width: 600,
          height: 74,
          borderRadius: 999,
          background: COLORS.red,
          color: COLORS.surface,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: FONT,
          fontSize: 28,
          fontWeight: 950,
          boxShadow: "0 26px 70px rgba(255,16,31,0.28)",
        }}
      >
        Add SkipTube AI to Chrome
      </div>
    </AbsoluteFill>
  );
};

const PrivacyCard: React.FC<{ title: string; body: string }> = ({
  title,
  body,
}) => (
  <div
    style={{
      minHeight: 126,
      borderRadius: 24,
      background: COLORS.surface,
      border: `1px solid ${COLORS.hairline}`,
      boxShadow: `0 22px 58px ${COLORS.shadow}`,
      padding: "24px 26px",
      fontFamily: FONT,
    }}
  >
    <div
      style={{
        fontSize: 25,
        fontWeight: 950,
        color: COLORS.ink,
        marginBottom: 10,
      }}
    >
      {title}
    </div>
    <div
      style={{
        fontSize: 20,
        fontWeight: 750,
        color: COLORS.inkSoft,
        lineHeight: 1.3,
      }}
    >
      {body}
    </div>
  </div>
);

export const SkipTubePromo: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ fontFamily: FONT, background: COLORS.bg }}>
      <Background />
      <HeroScene opacity={sceneOpacity(frame, 0, 28, 270, 335)} />
      <ScanScene opacity={sceneOpacity(frame, 300, 360, 662, 735)} />
      <SettingsScene opacity={sceneOpacity(frame, 704, 765, 1024, 1098)} />
      <AutoSkipScene opacity={sceneOpacity(frame, 1068, 1134, 1375, 1460)} />
      <PrivacyScene opacity={sceneOpacity(frame, 1428, 1500, 1792, 1800)} />
      <Sequence from={0} durationInFrames={DURATION}>
        <Audio src={staticFile("audio/ambient.wav")} volume={0.42} />
      </Sequence>
    </AbsoluteFill>
  );
};
