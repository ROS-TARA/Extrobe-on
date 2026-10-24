/*
  theme.js — small shared helper.

  tint(color, "NN")  →  the same colour at NN/255 opacity, as valid CSS.
  Works for hex colours AND the theme variables (var(--sp-signal) ...).

  Why it exists: the app's colours are CSS variables, and code like
      DS.signal + "44"          →  "var(--sp-signal)44"
  is NOT valid CSS, so the browser silently drops the border / tint.
  tint() builds a real colour-mix() value instead.
*/
export const tint = (color, hex) =>
  `color-mix(in srgb, ${color} ${Math.round(parseInt(hex, 16) / 2.55)}%, transparent)`;
