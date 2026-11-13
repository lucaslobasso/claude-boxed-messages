import type { EngineInterface, Register, RenderChildren } from 'claude-code'

// Change these to recolor the bars; the backgrounds are derived from them.
const USER_COLOR = '#4c8dff'
const CLAUDE_COLOR = '#d97757'

// Mix a #rrggbb color toward another by `amount` (0 = unchanged, 1 = target).
const mix = (hex: string, target: string, amount: number): string => {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16)
  const out = [0, 1, 2].map(i => Math.round(ch(hex, i) + (ch(target, i) - ch(hex, i)) * amount))
  return '#' + out.map(v => v.toString(16).padStart(2, '0')).join('')
}

type Look = { bars: boolean; background: boolean; shade: string }

// dark: mostly a dark blue-grey (like a typical dark theme) with a hint of the
// bar color, so light text stays readable. light: pastel for light themes.
const tint = (color: string, shade: string) =>
  shade === 'light' ? mix(color, '#ffffff', 0.82) : mix(color, '#1c2029', 0.85)

// The bar is a solid 1-column Box beside the message, in the normal flow (no
// absolute positioning, so it can't leak into other rows while scrolling).
//
// Padding: a terminal cell is about twice as tall as it is wide, so 1 row of
// vertical padding matches 2 columns of horizontal padding.
//
// Claude's replies (engine-drawn): the engine's node starts with a blank spacer
// row. The message column gets 1 row of padding above and below; the top padding
// row is painted back to plain (a row of spaces drawn last), so the engine's
// spacer, now tinted, becomes the visible top padding and the bar starts there.
// The background is the column's own backgroundColor, so the letters inherit it.
const decorateReply = (
  $: EngineInterface,
  e: Parameters<EngineInterface['ui']['resolve']>[0],
  inner: RenderChildren,
  color: string,
  look: Look,
) => {
  const { Box, Text } = $.ui.resolve(e)
  const bg = look.background ? tint(color, look.shade) : undefined
  return (
    <Box flexDirection="row">
      {look.bars && (
        <Box width={1} flexShrink={0} flexDirection="column">
          <Box height={1} flexShrink={0} />
          <Box flexGrow={1} backgroundColor={color} />
        </Box>
      )}
      <Box flexDirection="column" flexGrow={1} paddingX={2} paddingTop={1} paddingBottom={1} backgroundColor={bg}>
        {inner}
      </Box>
      {bg && (
        <Box position="absolute" top={0} left={0} right={0} height={1} overflow="hidden">
          <Text>{' '.repeat(500)}</Text>
        </Box>
      )}
    </Box>
  )
}

// Your prompts: drawn by the mod itself as plain text (no "> " marker, no engine
// highlight), with our own blank line above and 1 row of padding inside.
const drawPrompt = (
  $: EngineInterface,
  e: Parameters<EngineInterface['ui']['resolve']>[0],
  text: string,
  color: string,
  look: Look,
) => {
  const { Box, Text } = $.ui.resolve(e)
  const bg = look.background ? tint(color, look.shade) : undefined
  return (
    <Box flexDirection="row" marginTop={1}>
      {look.bars && <Box width={1} flexShrink={0} backgroundColor={color} />}
      <Box flexDirection="column" flexGrow={1} paddingX={2} paddingY={1} backgroundColor={bg}>
        <Text>{text}</Text>
      </Box>
    </Box>
  )
}

// The status line. Claude Code takes `statusLine` only from the settings files, not
// from a plugin, so the mod keeps that entry in ~/.claude/settings.json in step with
// its setting: on adds it (or refreshes our own), off removes it. An entry that is not
// ours is never touched; the person is told instead. The script ships with the mod
// (`statusline/statusline.mjs`); forward slashes survive a bash shell on Windows.
const SCRIPT = 'statusline/statusline.mjs'
const BLOCK = /[ \t]*"statusLine"\s*:\s*\{[^{}]*\}[ \t]*,?[ \t]*\r?\n?/

const syncStatusLine = async ($: EngineInterface, isOn: boolean): Promise<string | undefined> => {
  const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))
  if (!home) return undefined
  const file = `${home.replace(/\\/g, '/')}/.claude/settings.json`
  let text: string
  let settings: Record<string, any>
  try {
    text = (await $.fs.read(file)) as string
    settings = JSON.parse(text)
  } catch {
    return undefined // no settings file, or one we can't parse: leave it be
  }

  const current = settings.statusLine
  const isOurs = typeof current?.command === 'string' && current.command.includes(SCRIPT)
  const script = `${$.plugin.root}/${SCRIPT}`.replace(/\\/g, '/')
  const wanted = { type: 'command', command: `node "${script}"`, padding: 0, refreshInterval: 10 }
  const entry = `  "statusLine": ${JSON.stringify(wanted)}`

  let next: string | undefined
  if (isOn) {
    if (current !== undefined && !isOurs) {
      return 'Status line not set: your settings.json already has a different statusLine. Remove it to use the built-in one.'
    }
    if (isOurs && JSON.stringify(current) === JSON.stringify(wanted)) return undefined
    next = isOurs
      ? text.replace(BLOCK, m => m.replace(/"statusLine"[\s\S]*\}/, entry.trim()))
      : text.replace('{', `{\n${entry}${Object.keys(settings).length ? ',' : ''}`)
  } else if (isOurs) {
    next = text.replace(BLOCK, '')
  }
  if (next === undefined) return undefined

  // Keep the file's own formatting when the edit parses to what we meant; else rewrite it whole.
  const want = { ...settings }
  if (isOn) want.statusLine = wanted
  else delete want.statusLine
  const rest = (o: Record<string, any>) => JSON.stringify(Object.entries(o).filter(([k]) => k !== 'statusLine').sort())
  let ok = false
  try {
    const got = JSON.parse(next)
    ok = rest(got) === rest(settings) && JSON.stringify(got.statusLine) === JSON.stringify(want.statusLine)
  } catch {}
  await $.fs.write(file, ok ? next : JSON.stringify(want, null, 2) + '\n')
  return undefined
}

export const register: Register = (on, options) => {
  const look: Look = {
    bars: options.showBars !== false,
    background: options.showBackground === true,
    shade: typeof options.backgroundShade === 'string' ? options.backgroundShade : 'dark',
  }
  const isOff = !look.bars && !look.background
  const statusOn = options.showStatusLine !== false

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'boxed-messages',
      description: 'Toggle message bars/background/status line: /boxed-messages bars|bg|shade|status',
    })
    // Runs on every load, so flipping the setting (which reloads the mod) applies it.
    const blocked = await syncStatusLine($, statusOn)
    if (blocked) $.ui.toast(blocked)
    return next(e)
  })

  on('command.run', { command: 'boxed-messages' }, async ($, e) => {
    const arg = (typeof e.args === 'string' ? e.args : '').trim().toLowerCase()
    const flip = async (field: string, value: boolean | string, label: string) => {
      const { deny } = await $.config.set({ key: `boxed-messages.${field}`, value })
      return { text: deny ? `Couldn't change ${label}: ${deny}` : `${label}: ${String(value)}` }
    }
    if (arg === 'bars') return flip('showBars', !look.bars, 'Message bars')
    if (arg === 'bg' || arg === 'background') return flip('showBackground', !look.background, 'Message background')
    if (arg === 'shade') return flip('backgroundShade', look.shade === 'light' ? 'dark' : 'light', 'Background shade')
    if (arg === 'status' || arg === 'statusline') return flip('showStatusLine', !statusOn, 'Status line')
    return {
      text:
        `Bars: ${look.bars ? 'on' : 'off'} · Background: ${look.background ? 'on' : 'off'} (${look.shade}) · Status line: ${statusOn ? 'on' : 'off'}\n` +
        'Usage: /boxed-messages bars | bg | shade | status   (each toggles; also in /config)',
    }
  })

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    if (isOff || e.props.origin.kind !== 'composer' || e.props.text.trim() === '') {
      return next(e)
    }
    return drawPrompt($, e, e.props.text, USER_COLOR, look)
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    // Grey summary rows between tool calls aren't real messages, and blocks with
    // no visible text (empty fragments between tool rows) would show a stray bar.
    if (isOff || e.props.isSummary || e.props.text.trim() === '') {
      return next(e)
    }
    // isFirstOfReply false: the engine leaves off the "●" bullet.
    const inner = await next({ ...e, props: { ...e.props, isFirstOfReply: false } })
    return decorateReply($, e, inner, CLAUDE_COLOR, look)
  })
}
