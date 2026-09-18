import Link from "next/link";

interface Experiment {
  slug: string;
  name: string;
  status: "done" | "todo";
  blurb: string;
}

const EXPERIMENTS: Experiment[] = [
  {
    slug: "ripple-interference-multi",
    name: "Ripple / Interference (multi-source)",
    status: "done",
    blurb:
      "Multiple ripple sources summed into caustic cusps, lattices, and grain.",
  },
  {
    slug: "ripple-interference-shader",
    name: "Ripple / Interference (shader)",
    status: "done",
    blurb:
      "Same ripple field as a WebGL2 fragment shader with an IQ cosine palette.",
  },
  {
    slug: "ascii",
    name: "ASCII Art Suite",
    status: "todo",
    blurb: "Image → ASCII converter + a shaded, noise-mottled ASCII orb.",
  },
  {
    slug: "wave-field",
    name: "Generative Wave / Particle Field",
    status: "todo",
    blurb: "Grid of points animated with sine + simplex noise.",
  },
  {
    slug: "glyph-field",
    name: "Glyph Field (wave interference)",
    status: "done",
    blurb:
      "Wave-interference field on the GPU, rendered as a live grid of glyphs that react to amplitude - pluck it, wall it off, watch it ring.",
  },
  {
    slug: "box-grid",
    name: "Recursive Box/Grid Art",
    status: "todo",
    blurb: "Randomised recursive subdivision with per-leaf fill styles.",
  },
  {
    slug: "radial",
    name: "Radial Print",
    status: "todo",
    blurb: "SVG concentric rings, keyboard band, scattered markers.",
  },
  {
    slug: "mycelium",
    name: "Mycelium / Space Colonisation",
    status: "todo",
    blurb: "Branching growth toward scattered attraction points.",
  },
  {
    slug: "flower",
    name: "Procedural Flower Growth",
    status: "todo",
    blurb: "L-system branching plant with progressive growth + bloom.",
  },
];

export default function ExperimentsIndex() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#c9c9c9",
        fontFamily: "monospace",
        padding: "64px 32px",
      }}
    >
      <h1
        style={{
          fontSize: 14,
          letterSpacing: "0.16em",
          color: "#e8e8e8",
          marginBottom: 8,
        }}
      >
        EXPERIMENTS
      </h1>
      <p style={{ fontSize: 12, color: "#6b6b6b", marginBottom: 40 }}>
        Generative art & creative coding studies.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 16,
        }}
      >
        {EXPERIMENTS.map((exp) => (
          <Link
            key={exp.slug}
            href={`/experiments/${exp.slug}`}
            style={{
              display: "block",
              border: "1px solid #2a2a2a",
              borderRadius: 4,
              padding: "16px 18px",
              textDecoration: "none",
              color: "inherit",
              opacity: exp.status === "todo" ? 0.55 : 1,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 8,
              }}
            >
              <span style={{ fontSize: 13, color: "#e8e8e8" }}>{exp.name}</span>
              <span
                style={{
                  fontSize: 10,
                  letterSpacing: "0.06em",
                  color: exp.status === "done" ? "#7fbf8f" : "#6b6b6b",
                }}
              >
                {exp.status === "done" ? "READY" : "TODO"}
              </span>
            </div>
            <span style={{ fontSize: 11, color: "#8a8a8a" }}>{exp.blurb}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
