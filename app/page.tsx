import Link from "next/link";
import RippleInterferenceShader from "./experiments/ripple-interference-shader/RippleInterferenceShader";
import {
  PALETTES,
  DEFAULT_PALETTE,
  DEFAULT_SOURCES,
  DEFAULTS,
} from "./experiments/ripple-interference-shader/defaults";
import { TempleMark } from "./experiments/_lib/mac/icons";

export default function Home() {
  return (
    <main style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <RippleInterferenceShader
        palette={PALETTES[DEFAULT_PALETTE]}
        sources={DEFAULT_SOURCES}
        {...DEFAULTS}
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
        <div className="mac-alert">
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <TempleMark size={48} />
            <div style={{ lineHeight: 1.5 }}>
              <div style={{ fontSize: 17 }}>Welcome to Generative Art Lab</div>
              <div style={{ marginTop: 6 }}>
                Wave physics, ripples, glyphs and sound. Pixels and math.
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: 14,
            }}
          >
            <Link href="/experiments" className="mac-btn default">
              Open Experiments
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
