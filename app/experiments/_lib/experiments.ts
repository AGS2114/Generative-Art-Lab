export interface Experiment {
  slug: string;
  name: string;
  status: "done" | "todo";
  blurb: string;
  hideUi?: boolean;
}

export const EXPERIMENTS: Experiment[] = [
  {
    slug: "ascii",
    name: "ASCII Art Suite",
    status: "todo",
    blurb: "Image → ASCII converter + a shaded, noise-mottled ASCII orb.",
  },
  {
    slug: "wave-field",
    name: "Generative Wave",
    status: "done",
    hideUi: true,
    blurb:
      "Finite-depth wave physics on a canvas: dispersion, shoaling, refraction and group velocity, rendered as ASCII glyphs or dots.",
  },
  {
    slug: "ripple-interference-multi",
    name: "Ripples (multi-source)",
    status: "done",
    blurb:
      "Multiple ripple sources summed into caustic cusps, lattices, and grain.",
  },
  {
    slug: "ripple-interference-shader",
    name: "Ripples (shader)",
    status: "done",
    blurb:
      "Same ripple field as a WebGL2 fragment shader with an IQ cosine palette.",
  },
  {
    slug: "glyph-field",
    name: "Glyph Field (wave interference)",
    status: "done",
    hideUi: true,
    blurb:
      "Wave-interference field on the GPU, rendered as a live grid of glyphs that react to amplitude - pluck it, wall it off, watch it ring.",
  },
  {
    slug: "sonic-field",
    name: "Sonic Field (audio-reactive)",
    status: "done",
    hideUi: true,
    blurb:
      "Tempo/key/mood picker drives a generative synth whose notes pluck a wave-interference field live.",
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
    status: "done",
    hideUi: true,
    blurb: "Branching growth toward scattered attraction points.",
  },
  {
    slug: "flower",
    name: "Procedural Flower Growth",
    status: "todo",
    blurb: "L-system branching plant with progressive growth + bloom.",
  },
];
