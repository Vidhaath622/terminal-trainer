import { ImageResponse } from "next/og";

export const alt = "Terminal Trainer: graded Linux practice";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          backgroundColor: "#0a0e14",
          color: "#dbe4ee",
          fontFamily: "monospace",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "#3fb950", fontSize: 44, fontWeight: 600 }}>&gt;_</span>
          <span style={{ color: "#8b98a9", fontSize: 28 }}>student@trainer:~$</span>
          <span style={{ color: "#dbe4ee", fontSize: 28 }}>grep -c ERROR app.log</span>
        </div>
        <div style={{ color: "#dbe4ee", fontSize: 28, marginTop: 8 }}>3</div>
        <div
          style={{
            display: "flex",
            fontSize: 64,
            fontWeight: 600,
            marginTop: 48,
            letterSpacing: "-0.02em",
          }}
        >
          Terminal Trainer: graded Linux practice
        </div>
        <div style={{ display: "flex", color: "#8b98a9", fontSize: 28, marginTop: 16 }}>
          A simulated shell with graded, step-by-step problems.
        </div>
      </div>
    ),
    size
  );
}
