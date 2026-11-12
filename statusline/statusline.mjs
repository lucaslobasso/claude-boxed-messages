#!/usr/bin/env node
// boxed-messages status line. Claude Code runs this as its `statusLine` command
// (the mod registers it) and pipes the status JSON on stdin; one line goes to
// stdout. It reproduces the ccstatusline layout this mod used to ship a config
// for (minimalist mode): model + effort | context | git branch, then, pushed to
// the right, weekly usage + reset | session usage + reset.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// ---- look: edit here ------------------------------------------------------
const WHITE = [238, 238, 236]
const BLUE = [114, 159, 207]
const MAGENTA = [173, 127, 168]
const SEPARATOR = [85, 87, 83]

// Left group, then the right group. `color` undefined = terminal default.
const LEFT = [
  { id: 'model', color: WHITE },
  { id: 'effort' },
  { id: 'sep' },
  { id: 'context', color: BLUE },
  { id: 'sep' },
  { id: 'branch' },
]
const RIGHT = [
  { id: 'weekly', color: WHITE },
  { id: 'weeklyReset' },
  { id: 'sep' },
  { id: 'session', color: MAGENTA },
  { id: 'sessionReset' },
]
// ---------------------------------------------------------------------------

const ESC = '\x1b['
const paint = (text, rgb) => (rgb ? `${ESC}38;2;${rgb.join(';')}m${text}${ESC}39m` : text)
const pad = text => `${ESC}0m ${ESC}0m${text}${ESC}0m ${ESC}0m`
const visibleLength = s => [...s.replace(/\x1b\[[0-9;]*m/g, '')].length

const git = (args, cwd) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] }).trim()

const pct = n => `${Math.min(100, Math.max(0, n)).toFixed(1)}%`

const countdown = epochSeconds => {
  const left = Math.max(0, epochSeconds * 1000 - Date.now())
  const d = Math.floor(left / 86_400_000)
  const h = Math.floor((left % 86_400_000) / 3_600_000)
  const m = Math.floor((left % 3_600_000) / 60_000)
  return [d > 0 && `${d}d`, h > 0 && `${h}hr`, m > 0 && `${m}m`].filter(Boolean).join(' ') || '0m'
}

const KNOWN_EFFORT = new Set(['low', 'medium', 'high', 'xhigh', 'max'])

const effortOf = input => {
  let level = typeof input.effort?.level === 'string' ? input.effort.level.toLowerCase() : undefined
  if (!level && typeof input.transcript_path === 'string') {
    try {
      const lines = readFileSync(input.transcript_path, 'utf8').split('\n')
      for (let i = lines.length - 1; i >= 0 && !level; i--) {
        const hit =
          /Set effort level to ([a-z0-9-]+)/i.exec(lines[i]) ?? /Set model to .*? with ([a-z0-9-]+) effort/i.exec(lines[i])
        if (hit) level = hit[1].toLowerCase()
      }
    } catch {}
  }
  if (!level) {
    try {
      const saved = JSON.parse(readFileSync(join(homedir(), '.claude', 'settings.json'), 'utf8')).effortLevel
      if (typeof saved === 'string') level = saved.toLowerCase()
    } catch {}
  }
  if (!level) return 'default'
  return KNOWN_EFFORT.has(level) ? level : /^[a-z0-9-]{2,20}$/.test(level) ? `${level}?` : 'default'
}

const contextOf = input => {
  const w = input.context_window
  if (typeof w?.used_percentage === 'number') return pct(w.used_percentage)
  const u = w?.current_usage
  if (u && w?.context_window_size > 0) {
    const used = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0)
    return pct((used / w.context_window_size) * 100)
  }
}

const branchOf = input => {
  const cwd = input.cwd || input.workspace?.current_dir || input.workspace?.project_dir || process.cwd()
  try {
    if (git(['rev-parse', '--is-inside-work-tree'], cwd) !== 'true') return '⎇ no git'
  } catch {
    return '⎇ no git'
  }
  try {
    return git(['symbolic-ref', 'HEAD'], cwd).replace(/^refs\/heads\//, '')
  } catch {
    try {
      return `(${git(['rev-parse', '--short', 'HEAD'], cwd)})`
    } catch {
      return undefined
    }
  }
}

const widgetText = (id, input) => {
  const limits = input.rate_limits
  switch (id) {
    case 'model': {
      const m = input.model
      const name = typeof m === 'string' ? m : (m?.display_name ?? m?.id)
      return name ? name.replace(/\s*\(.*\)$/, '') : undefined
    }
    case 'effort':
      return effortOf(input)
    case 'context':
      return contextOf(input)
    case 'branch':
      return branchOf(input)
    case 'weekly':
      return typeof limits?.seven_day?.used_percentage === 'number' ? pct(limits.seven_day.used_percentage) : undefined
    case 'weeklyReset':
      return typeof limits?.seven_day?.resets_at === 'number' ? countdown(limits.seven_day.resets_at) : undefined
    case 'session':
      return typeof limits?.five_hour?.used_percentage === 'number' ? pct(limits.five_hour.used_percentage) : undefined
    case 'sessionReset':
      return typeof limits?.five_hour?.resets_at === 'number' ? countdown(limits.five_hour.resets_at) : undefined
  }
}

// One group of widgets joined as ccstatusline does: widgets with nothing to show
// vanish, and a separator needs content before it and after it.
const render = (spec, input) => {
  const parts = []
  for (const w of spec) {
    if (w.id === 'sep') {
      if (parts.length && parts[parts.length - 1].sep === false) parts.push({ sep: true, text: paint(' | ', SEPARATOR) })
      continue
    }
    const text = widgetText(w.id, input)
    if (text) parts.push({ sep: false, text: pad(paint(text, w.color)) })
  }
  while (parts.length && parts[parts.length - 1].sep) parts.pop()
  return parts.map(p => p.text).join('')
}

// Cut to `max` visible cells, keeping the colour codes before the cut, marking it "...".
const truncate = (line, max) => {
  let out = ''
  let seen = 0
  for (const [, code, ch] of line.matchAll(/(\x1b\[[0-9;]*m)|([\s\S])/gu)) {
    if (code) out += code
    else if (seen < max - 3) {
      out += ch
      seen++
    } else break
  }
  return `${out}...`
}

const main = input => {
  const left = render(LEFT, input)
  const right = render(RIGHT, input)
  const width = Number(process.env.CCSTATUSLINE_WIDTH || process.env.COLUMNS) || 0
  let line
  if (!right) {
    line = left
  } else if (!left) {
    line = right
  } else if (width > 0) {
    const usable = width - 5
    const gap = Math.max(0, usable - visibleLength(left) - visibleLength(right))
    line = left + ' '.repeat(gap) + right
    if (visibleLength(line) > usable) line = truncate(line, usable)
  } else {
    // Terminal width unknown (always so on Windows): ccstatusline draws a gray bar.
    line = left + `${ESC}90m | ${ESC}39m` + right
  }
  // Non-breaking spaces so the terminal keeps the padding.
  return `${ESC}0m${line}`.replace(/ /g, ' ')
}

let raw = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', c => (raw += c))
process.stdin.on('end', () => {
  try {
    process.stdout.write(main(JSON.parse(raw || '{}')) + '\n')
  } catch {}
})
