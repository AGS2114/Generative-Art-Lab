import Link from "next/link";
import RippleInterferenceShader from "./experiments/ripple-interference-shader/RippleInterferenceShader";

export default function Home() {
  return (
    <main style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <RippleInterferenceShader
        sources={[
          { x: 0.62, y: 0.4, frequency: 0.05, speed: 0.4, amplitude: 1 },
        ]}
        rippleStrength={0.16}
        driftSpeed={0.12}
        causticStrength={0.5}
        grainAmount={0.06}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Link
          href="/experiments"
          style={{
            fontFamily: "monospace",
            fontSize: 13,
            letterSpacing: "0.12em",
            color: "#f2f2f2",
            background: "rgba(0,0,0,0.35)",
            border: "1px solid rgba(255,255,255,0.25)",
            borderRadius: 4,
            padding: "10px 20px",
            textDecoration: "none",
            backdropFilter: "blur(2px)",
          }}
        >
          VIEW EXPERIMENTS →
        </Link>
      </div>
    </main>
  );
}
