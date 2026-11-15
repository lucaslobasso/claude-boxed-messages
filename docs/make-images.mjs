#!/usr/bin/env node
// Regenerates the README's light-theme illustration:  node docs/make-images.mjs
//
// They are drawings, not screenshots: the message boxes use the mod's own colors
// and tint math (hooks/colors.ts, imported directly; Node 22.18+ reads .ts files).
// The screenshots next to them come from docs/capture.ps1.
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DARK_BASE, DEFAULT_CLAUDE_COLOR as CLAUDE, DEFAULT_USER_COLOR as USER, LIGHT_BASE, tint } from '../hooks/colors.ts'

const here = dirname(fileURLToPath(import.meta.url))

const themes = {
  dark: { bg: DARK_BASE, chrome: '#171a21', fg: '#d7dae0', dim: '#7f8794', border: '#343a46', tint: c => tint(c, 'dark') },
  light: { bg: LIGHT_BASE, chrome: '#eff1f3', fg: '#24292f', dim: '#6e7781', border: '#d0d7de', tint: c => tint(c, 'light') },
}

// Geometry: one terminal cell is CW x LH.
const CW = 8.4
const LH = 21
const PAD = 24
const TOP = 46
const COLS = 100
const SESSION = 'dark-mode-toggle' // sample session name, shown on the input's top rule
const FONT = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'DejaVu Sans Mono', monospace"
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const REPLY = [
  'I added a `ThemeToggle` component and wired it into the settings',
  'page. It follows the system theme by default and remembers your',
  'choice between sessions.',
]

const scene = (themeName, { bars = true, background = false, prompt = false, label }) => {
  const t = themes[themeName]
  const parts = []
  let row = 0
  const x = col => PAD + col * CW
  const y = r => TOP + r * LH
  const text = (col, r, s, fill) =>
    parts.push(`<text x="${x(col).toFixed(1)}" y="${y(r) + 15}" fill="${fill}" textLength="${(s.length * CW).toFixed(1)}" lengthAdjust="spacing" xml:space="preserve">${esc(s)}</text>`)
  const box = (color, lines) => {
    const h = lines.length + 2 // 1 row of padding above and below
    if (background) parts.push(`<rect x="${x(1).toFixed(1)}" y="${y(row)}" width="${((COLS - 1) * CW).toFixed(1)}" height="${h * LH}" fill="${t.tint(color)}"/>`)
    if (bars) parts.push(`<rect x="${x(0)}" y="${y(row)}" width="${CW}" height="${h * LH}" fill="${color}"/>`)
    lines.forEach((l, i) => text(3, row + 1 + i, l, t.fg)) // bar + 2 columns of padding
    row += h
  }

  row = 1
  box(USER, ['Add a dark mode toggle to the settings page'])
  row += 1
  text(0, row, '● Update(src/Settings.tsx)', t.dim)
  text(0, row + 1, '  └ Added 14 lines', t.dim)
  row += 3
  box(CLAUDE, REPLY)
  row += 1

  if (prompt) {
    // The input is two horizontal rules around the prompt row, with no side borders or
    // rounded corners; the session's name sits on the top rule at the left.
    const rule = (r, from, to) =>
      parts.push(`<line x1="${x(from).toFixed(1)}" y1="${y(r) + LH / 2}" x2="${x(to).toFixed(1)}" y2="${y(r) + LH / 2}" stroke="${t.dim}" stroke-opacity=".55"/>`)
    const name = ` ${SESSION} `
    rule(row, 0, 2)
    text(2, row, name, t.dim)
    rule(row, 2 + name.length, COLS)
    text(0, row + 1, '>', t.fg)
    parts.push(`<rect x="${x(2)}" y="${y(row + 1) + 2}" width="${CW}" height="${LH - 4}" fill="${t.fg}" opacity=".7"/>`)
    rule(row + 2, 0, COLS)
    row += 3
  }

  const width = Math.round(PAD * 2 + COLS * CW)
  const height = Math.round(TOP + (row + 0.5) * LH + PAD / 2)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}" font-family="${FONT}" font-size="14">
<title>${esc(label)}</title>
<rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" rx="10" fill="${t.bg}" stroke="${t.border}"/>
<path d="M.5 38V10.5a10 10 0 0 1 10-10h${width - 21}a10 10 0 0 1 10 10V38z" fill="${t.chrome}"/>
<circle cx="22" cy="19" r="6" fill="#ff5f57"/><circle cx="42" cy="19" r="6" fill="#febc2e"/><circle cx="62" cy="19" r="6" fill="#28c840"/>
<text x="${width / 2}" y="24" fill="${t.dim}" text-anchor="middle" font-size="12">claude</text>
${parts.join('\n')}
</svg>
`
}

const files = {
  // The dark shade has real screenshots (docs/screenshot-*.png); the light one is drawn here.
  'background-light.svg': scene('light', { background: true, label: 'Illustration: bars plus a tinted background, light shade' }),
}
for (const [name, svg] of Object.entries(files)) writeFileSync(join(here, name), svg)
console.log('wrote', Object.keys(files).join(', '))
