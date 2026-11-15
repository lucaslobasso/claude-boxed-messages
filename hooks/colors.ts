// Shared by hooks/register.tsx and docs/make-images.mjs, so the pictures always
// use the mod's real colors.

export const DEFAULT_USER_COLOR = '#4c8dff'
export const DEFAULT_CLAUDE_COLOR = '#d97757'
// How far the background moves from the bar color toward the theme color (0..1).
export const DEFAULT_TINT = 0.85

export const DARK_BASE = '#1c2029'
export const LIGHT_BASE = '#ffffff'

export const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)

// Mix a #rrggbb color toward another by `amount` (0 = unchanged, 1 = target).
export const mix = (hex: string, target: string, amount: number): string => {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16)
  const out = [0, 1, 2].map(i => Math.round(ch(hex, i) + (ch(target, i) - ch(hex, i)) * amount))
  return '#' + out.map(v => v.toString(16).padStart(2, '0')).join('')
}

// dark: mostly a dark blue-grey (like a typical dark theme) with a hint of the
// bar color, so light text stays readable. light: pastel for light themes, a
// little less mixed (0.82 at the default 0.85) so the pastel keeps some color.
export const tint = (color: string, shade: string, strength: number = DEFAULT_TINT): string =>
  shade === 'light' ? mix(color, LIGHT_BASE, Math.max(0, strength - 0.03)) : mix(color, DARK_BASE, strength)
