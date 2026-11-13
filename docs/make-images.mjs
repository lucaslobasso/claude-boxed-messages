#!/usr/bin/env node
// Regenerates the README illustrations in this folder:  node docs/make-images.mjs
//
// They are drawings, not screenshots. The status line is the real output of
// statusline/statusline.mjs (run here against sample data and converted from ANSI
// colors to SVG); the message boxes are drawn from the same colors and tint math as
// hooks/register.tsx. A real terminal differs in font and spacing.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const script = join(here, '..', 'statusline', 'statusline.mjs')

// Same as hooks/register.tsx.
const USER = '#4c8dff'
const CLAUDE = '#d97757'
const mix = (hex, target, amount) => {
  const ch = (h, i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16)
  const out = [0, 1, 2].map(i => Math.round(ch(hex, i) + (ch(target, i) - ch(hex, i)) * amount))
  return '#' + out.map(v => v.toString(16).padStart(2, '0')).join('')
}

const themes = {
  dark: { bg: '#1c2029', chrome: '#171a21', fg: '#d7dae0', dim: '#7f8794', border: '#343a46', tint: c => mix(c, '#1c2029', 0.85) },
  light: { bg: '#ffffff', chrome: '#eff1f3', fg: '#24292f', dim: '#6e7781', border: '#d0d7de', tint: c => mix(c, '#ffffff', 0.82) },
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

// The status line, as the script prints it for this sample, in a throwaway repo on `main`.
const statusLineAnsi = () => {
  const repo = mkdtempSync(join(tmpdir(), 'boxed-messages-'))
  try {
    spawnSync('git', ['init', '-q', '-b', 'main'], { cwd: repo })
    const now = Math.floor(Date.now() / 1000)
    const input = {
      model: { id: 'claude-opus-5-5', display_name: 'Opus 5.5 (1M context)' },
      effort: { level: 'high' },
      cwd: repo,
      context_window: { used_percentage: 23 },
      rate_limits: {
        seven_day: { used_percentage: 61, resets_at: now + 3 * 86400 + 4 * 3600 + 12 * 60 + 30 },
        five_hour: { used_percentage: 18, resets_at: now + 2 * 3600 + 13 * 60 + 30 },
      },
    }
    // Claude Code runs the command with COLUMNS set to the terminal's width (verified:
    // 120 in a 120-column terminal); the script right-aligns to it, leaving 5 columns.
    const env = { ...process.env, COLUMNS: String(COLS) }
    delete env.CCSTATUSLINE_WIDTH
    const r = spawnSync('node', [script], { input: JSON.stringify(input), env, encoding: 'utf8' })
    if (!r.stdout.trim()) throw new Error('statusline.mjs printed nothing: ' + r.stderr)
    return r.stdout.replace(/\n$/, '')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
}

// ANSI (reset, 24-bit foreground, default foreground, gray) to SVG tspans.
const ansiToTspans = (ansi, defaultFill, gray) => {
  let fill
  let svg = ''
  let cells = 0
  for (const [, code, text] of ansi.matchAll(/\x1b\[([0-9;]*)m|([^\x1b]+)/g)) {
    if (text === undefined) {
      if (code.startsWith('38;2;')) fill = `rgb(${code.slice(5).split(';').join(',')})`
      else if (code === '90') fill = gray
      else fill = undefined // 0, 39
      continue
    }
    cells += [...text].length
    svg += `<tspan fill="${fill ?? defaultFill}">${esc(text)}</tspan>`
  }
  return { svg, cells }
}

const REPLY = [
  'I added a `ThemeToggle` component and wired it into the settings',
  'page. It follows the system theme by default and remembers your',
  'choice between sessions.',
]

const scene = (themeName, { bars = true, background = false, messages = true, prompt = false, status = false, label }) => {
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

  if (messages) {
    row = 1
    box(USER, ['Add a dark mode toggle to the settings page'])
    row += 1
    text(0, row, '● Update(src/Settings.tsx)', t.dim)
    text(0, row + 1, '  └ Added 14 lines', t.dim)
    row += 3
    box(CLAUDE, REPLY)
    row += 1
  }
  if (prompt) {
    // The input is two horizontal rules around the prompt row, with no side borders or
    // rounded corners; the session's name sits on the top rule at the left.
    const rule = (r, from, to) =>
      parts.push(`<line x1="${x(from).toFixed(1)}" y1="${y(r) + LH / 2}" x2="${x(to).toFixed(1)}" y2="${y(r) + LH / 2}" stroke="${t.dim}" stroke-opacity=".55"/>`)
    const label = ` ${SESSION} `
    rule(row, 0, 2)
    text(2, row, label, t.dim)
    rule(row, 2 + label.length, COLS)
    text(0, row + 1, '>', t.fg)
    parts.push(`<rect x="${x(2)}" y="${y(row + 1) + 2}" width="${CW}" height="${LH - 4}" fill="${t.fg}" opacity=".7"/>`)
    rule(row + 2, 0, COLS)
    row += 3
  }
  if (status) {
    const { svg, cells } = ansiToTspans(statusLineAnsi(), t.fg, '#8b949e')
    parts.push(`<text x="${x(0)}" y="${y(row) + 15}" textLength="${(cells * CW).toFixed(1)}" lengthAdjust="spacing" xml:space="preserve">${svg}</text>`)
    row += 1
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
  'hero.svg': scene('dark', { background: true, prompt: true, status: true, label: 'Illustration: boxed messages with a tinted background and the built-in status line' }),
  'bars.svg': scene('dark', { label: 'Illustration: a colored bar beside each message (the default)' }),
  'background.svg': scene('dark', { background: true, label: 'Illustration: bars plus a tinted background, dark shade' }),
  'background-light.svg': scene('light', { background: true, label: 'Illustration: bars plus a tinted background, light shade' }),
  'statusline.svg': scene('dark', { messages: false, prompt: true, status: true, label: 'The built-in status line, as the script prints it' }),
}
for (const [name, svg] of Object.entries(files)) writeFileSync(join(here, name), svg)
console.log('wrote', Object.keys(files).join(', '))
