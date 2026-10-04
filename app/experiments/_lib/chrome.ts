import type { CSSProperties } from "react";

/**
 * Shared chrome for the /experiments/* pages, so the menu bar, the desktop and every sketch agree on one backdrop. `--wp-base` is the base colour of the
 * user's wallpaper palette; MenuBar publishes it on mount and the desktop Settings window keeps it current. The fallback is the default palette.
 */
export const BACKDROP = "var(--wp-base, #060b14)";

/* "← EXPERIMENTS" link, top-left */
export const backLink: CSSProperties = {
  position: "absolute",
  top: 16,
  left: 16,
  color: "rgba(255,255,255,0.4)",
  fontFamily: "monospace",
  fontSize: 11,
  letterSpacing: "0.1em",
  textDecoration: "none",
  transition: "color 0.15s ease",
};

/* HIDE UI / FULLSCREEN buttons, bottom-right */
export const pill: CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.25)",
  color: "#d0d0d0",
  fontFamily: "monospace",
  fontSize: 10,
  letterSpacing: "0.06em",
  padding: "6px 10px",
  borderRadius: 2,
  cursor: "pointer",
};
