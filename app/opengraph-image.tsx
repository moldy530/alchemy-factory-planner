import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Alchemy Factory Tools - Production Planner & Calculator";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #0c0814 0%, #1a1025 50%, #0c0814 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "serif",
          position: "relative",
        }}
      >
        {/* Decorative border */}
        <div
          style={{
            position: "absolute",
            top: 20,
            left: 20,
            right: 20,
            bottom: 20,
            border: "2px solid #d4a43a",
            borderRadius: 8,
            display: "flex",
          }}
        />

        {/* Corner accents */}
        <div
          style={{
            position: "absolute",
            top: 30,
            left: 30,
            width: 40,
            height: 40,
            borderTop: "3px solid #9b6dff",
            borderLeft: "3px solid #9b6dff",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 30,
            right: 30,
            width: 40,
            height: 40,
            borderTop: "3px solid #9b6dff",
            borderRight: "3px solid #9b6dff",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 30,
            left: 30,
            width: 40,
            height: 40,
            borderBottom: "3px solid #9b6dff",
            borderLeft: "3px solid #9b6dff",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 30,
            right: 30,
            width: 40,
            height: 40,
            borderBottom: "3px solid #9b6dff",
            borderRight: "3px solid #9b6dff",
            display: "flex",
          }}
        />

        {/* Main title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 20,
          }}
        >
          <h1
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: "#d4a43a",
              margin: 0,
              textShadow: "0 0 40px rgba(212, 164, 58, 0.5)",
              letterSpacing: 2,
            }}
          >
            Alchemy Factory
          </h1>
          <h2
            style={{
              fontSize: 48,
              fontWeight: 400,
              color: "#9b6dff",
              margin: 0,
              letterSpacing: 4,
            }}
          >
            TOOLS
          </h2>
        </div>

        {/* Subtitle */}
        <p
          style={{
            fontSize: 28,
            color: "#a0a0a0",
            marginTop: 40,
            letterSpacing: 1,
          }}
        >
          Production Planner & Calculator
        </p>

        {/* Features */}
        <div
          style={{
            display: "flex",
            gap: 40,
            marginTop: 50,
            color: "#d4a43a",
            fontSize: 20,
          }}
        >
          <span>Plan Crafting Chains</span>
          <span style={{ color: "#9b6dff" }}>|</span>
          <span>Optimize Production</span>
          <span style={{ color: "#9b6dff" }}>|</span>
          <span>Calculate Resources</span>
        </div>

        {/* URL */}
        <p
          style={{
            position: "absolute",
            bottom: 50,
            fontSize: 22,
            color: "#666",
          }}
        >
          alchemyfactorytools.com
        </p>
      </div>
    ),
    {
      ...size,
    }
  );
}
