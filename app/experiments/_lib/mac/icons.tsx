import { ReactNode } from "react";

export function TempleMark({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1.5 6 8 1.8 14.5 6z" />
      <path d="M3.5 7.8v4.4M6.5 7.8v4.4M9.5 7.8v4.4M12.5 7.8v4.4" />
      <path d="M2 13.2h12M1 15h14" />
    </svg>
  );
}

export const RippleMark = TempleMark;

const sine = Array.from({ length: 17 }, (_, i) => {
  const x = 8 + i;
  const y = 20 + Math.sin(i * 0.8) * 4;
  return `${x},${y.toFixed(1)}`;
}).join(" ");

const MOTIFS: Record<string, ReactNode> = {
  "wave-field": <polyline points={sine} fill="none" />,
  "ripple-interference-multi": (
    <>
      <circle cx="13" cy="20" r="2" fill="none" />
      <circle cx="13" cy="20" r="5" fill="none" />
      <circle cx="19" cy="20" r="2" fill="none" />
      <circle cx="19" cy="20" r="5" fill="none" />
    </>
  ),
  "ripple-interference-shader": (
    <>
      <circle cx="16" cy="20" r="2" fill="currentColor" />
      <circle cx="16" cy="20" r="4.500" fill="none" />
      <circle cx="16" cy="20" r="7" fill="none" />
    </>
  ),
  "glyph-field": (
    <>
      {[0, 1, 2].flatMap((r) =>
        [0, 1, 2].map((c) => {
          const s = 2 + ((r * 3 + c * 2) % 4);
          return (
            <rect
              key={`${r}${c}`}
              x={9 + c * 5 + (4 - s) / 2}
              y={14 + r * 5 + (4 - s) / 2}
              width={s}
              height={s}
              fill="currentColor"
            />
          );
        }),
      )}
    </>
  ),
  "sonic-field": (
    <>
      <polygon points="9,18 13,18 17,14 17,26 13,22 9,22" fill="currentColor" />
      <path d="M20 17 q3 3 0 6 M23 14 q6 6 0 12" fill="none" />
    </>
  ),
  mycelium: (
    <path
      d="M16 27 V19 M16 22 L11 17 M16 19 L21 14 M11 17 L9 13 M11 17 L14 13 M21 14 L19 10 M21 14 L24 13"
      fill="none"
    />
  ),
  "box-grid": (
    <>
      <rect x="8.500" y="12.500" width="15" height="14" fill="none" />
      <path d="M16 12.500 V26.500 M16 19 H23.500 M20 19 V26.500" fill="none" />
    </>
  ),
  radial: (
    <>
      <circle cx="16" cy="20" r="7" fill="none" strokeDasharray="2 1.500" />
      <circle cx="16" cy="20" r="3" fill="none" />
      <circle cx="16" cy="20" r="1" fill="currentColor" />
    </>
  ),
  flower: (
    <>
      <path d="M16 27 V20" fill="none" />
      {[0, 72, 144, 216, 288].map((a) => (
        <circle
          key={a}
          cx={16 + Math.cos((a * Math.PI) / 180) * 4}
          cy={16 + Math.sin((a * Math.PI) / 180) * 4}
          r="2.500"
          fill="none"
        />
      ))}
      <circle cx="16" cy="16" r="1.500" fill="currentColor" />
    </>
  ),
  ascii: <path d="M10 26 L16 13 L22 26 M12.500 22 H19.500" fill="none" />,
};

export function ExperimentIcon({ slug }: { slug: string }) {
  return (
    <svg viewBox="0 0 32 32" className="mac-glyph">
      <path d="M5.500 2.500 H21.500 L27.500 8.500 V29.500 H5.500 Z" />
      <path d="M21.500 2.500 V8.500 H27.500" fill="none" />
      <g className="motif">{MOTIFS[slug] ?? null}</g>
    </svg>
  );
}

export function DiskIcon() {
  return (
    <svg viewBox="0 0 32 32" className="mac-glyph">
      <rect x="3.500" y="8.500" width="25" height="16" />
      <rect x="6.500" y="11.500" width="19" height="7" />
      <path d="M6 22 H16" fill="none" />
      <rect x="22" y="21" width="3" height="2" fill="currentColor" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg viewBox="0 0 32 32" className="mac-glyph">
      <rect x="8.500" y="9.500" width="15" height="18" />
      <rect x="7.500" y="6.500" width="17" height="3" />
      <rect x="13.500" y="4.500" width="5" height="2" />
      <path d="M12.500 13 V24 M16 13 V24 M19.500 13 V24" fill="none" />
    </svg>
  );
}
