import type { EngineInterface, Register, RenderChildren } from 'claude-code'
import { DEFAULT_CLAUDE_COLOR, DEFAULT_TINT, DEFAULT_USER_COLOR, isHex, tint } from './colors'

type Look = { bars: boolean; background: boolean; shade: string; user: string; claude: string; strength: number }

// Wide enough for any realistic terminal; the row is clipped to the message width.
const PLAIN_ROW = ' '.repeat(2000)

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
  look: Look,
) => {
  const { Box, Text } = $.ui.resolve(e)
  const bg = look.background ? tint(look.claude, look.shade, look.strength) : undefined
  return (
    <Box flexDirection="row">
      {look.bars && (
        <Box width={1} flexShrink={0} flexDirection="column">
          <Box height={1} flexShrink={0} />
          <Box flexGrow={1} backgroundColor={look.claude} />
        </Box>
      )}
      <Box flexDirection="column" flexGrow={1} paddingX={2} paddingTop={1} paddingBottom={1} backgroundColor={bg}>
        {inner}
      </Box>
      {bg && (
        <Box position="absolute" top={0} left={0} right={0} height={1} overflow="hidden">
          <Text>{PLAIN_ROW}</Text>
        </Box>
      )}
    </Box>
  )
}

// Pasted text arrives wrapped as <pasted_content id="N">…</pasted_content id="N">
// (the closing tag repeats the id). The engine's own render hides the wrapper; we
// draw the text ourselves, so drop the tags and the blank edge lines they leave.
const PASTE_TAG = /<\/?pasted_content\b[^>]*>/g

export const unwrapPaste = (text: string): string =>
  text.includes('pasted_content')
    ? text
        .replace(PASTE_TAG, '')
        .replace(/^[ \t]*\r?\n+/, '')
        .replace(/\r?\n[ \t]*$/, '')
    : text

// Your prompts: drawn by the mod itself as plain text (no "> " marker, no engine
// highlight), with our own blank line above and 1 row of padding inside.
const drawPrompt = (
  $: EngineInterface,
  e: Parameters<EngineInterface['ui']['resolve']>[0],
  text: string,
  look: Look,
) => {
  const { Box, Text } = $.ui.resolve(e)
  const bg = look.background ? tint(look.user, look.shade, look.strength) : undefined
  return (
    <Box flexDirection="row" marginTop={1}>
      {look.bars && <Box width={1} flexShrink={0} backgroundColor={look.user} />}
      <Box flexDirection="column" flexGrow={1} paddingX={2} paddingY={1} backgroundColor={bg}>
        <Text>{text}</Text>
      </Box>
    </Box>
  )
}

// Up to 1.1.x the mod shipped a status line and kept a `statusLine` entry in the
// user settings.json pointing at its own copy of statusline/statusline.mjs. 2.0
// dropped it, so that entry would point at a script that no longer exists. Remove
// it, and only when it is plainly ours: a command naming a boxed-messages folder
// and that script. Anything else is left alone. Can go in a later release.
const OLD_SCRIPT = /boxed-messages[\\/][^"]*statusline[\\/]statusline\.mjs/
const OLD_BLOCK = /[ \t]*"statusLine"\s*:\s*\{[^{}]*\}[ \t]*,?[ \t]*\r?\n?/

export const removeOldStatusLine = async ($: EngineInterface): Promise<boolean> => {
  const configDir = await $.env.get('CLAUDE_CONFIG_DIR')
  const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))
  const dir = configDir || (home ? `${home}/.claude` : undefined)
  if (!dir) return false
  const file = `${dir.replace(/\\/g, '/')}/settings.json`
  let text: string
  let settings: Record<string, any>
  try {
    text = (await $.fs.read(file)) as string
    settings = JSON.parse(text)
  } catch {
    return false
  }
  const command = settings.statusLine?.command
  if (typeof command !== 'string' || !OLD_SCRIPT.test(command)) return false

  const want: Record<string, any> = { ...settings }
  delete want.statusLine
  // Keep the file's own formatting when the cut parses to what we meant; else rewrite it whole.
  let next = text.replace(OLD_BLOCK, '')
  try {
    if (JSON.stringify(JSON.parse(next)) !== JSON.stringify(want)) next = JSON.stringify(want, null, 2) + '\n'
  } catch {
    next = JSON.stringify(want, null, 2) + '\n'
  }
  await $.fs.write(file, next)
  return true
}

const USAGE = 'Usage: /boxed-messages bars | bg | shade   (each toggles; colors and tint strength are in /config)'

export const register: Register = (on, options) => {
  const strength = Number(options.tintStrength)
  const look: Look = {
    bars: options.showBars !== false,
    background: options.showBackground === true,
    shade: options.backgroundShade === 'light' ? 'light' : 'dark',
    user: isHex(options.userColor) ? options.userColor : DEFAULT_USER_COLOR,
    claude: isHex(options.claudeColor) ? options.claudeColor : DEFAULT_CLAUDE_COLOR,
    strength:
      options.tintStrength !== undefined && Number.isFinite(strength) && strength >= 0 && strength <= 1
        ? strength
        : DEFAULT_TINT,
  }
  const isOff = !look.bars && !look.background
  const badColors = (['userColor', 'claudeColor'] as const).filter(
    k => options[k] !== undefined && options[k] !== '' && !isHex(options[k]),
  )

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'boxed-messages',
      description: 'Toggle message bars/background/shade: /boxed-messages bars|bg|shade',
    })
    try {
      if (await removeOldStatusLine($)) {
        $.ui.toast('boxed-messages 2.0 no longer ships a status line, so its statusLine entry was removed from settings.json.')
      }
    } catch {}
    if (badColors.length) {
      $.ui.toast(`boxed-messages: ${badColors.join(' and ')} must be a #rrggbb color; using the default.`)
    }
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
    if (arg !== '' && arg !== 'help') return { text: `Unknown option "${arg}".\n${USAGE}` }
    return {
      text:
        `Bars: ${look.bars ? 'on' : 'off'} · Background: ${look.background ? 'on' : 'off'} ` +
        `(${look.shade}, strength ${look.strength}) · Colors: you ${look.user}, Claude ${look.claude}\n${USAGE}`,
    }
  })

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    if (isOff || e.props.origin.kind !== 'composer') return next(e)
    const text = unwrapPaste(e.props.text)
    if (text.trim() === '') return next(e)
    return drawPrompt($, e, text, look)
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    // Grey summary rows between tool calls aren't real messages, and blocks with
    // no visible text (empty fragments between tool rows) would show a stray bar.
    if (isOff || e.props.isSummary || e.props.text.trim() === '') {
      return next(e)
    }
    // isFirstOfReply false: the engine leaves off the "●" bullet.
    const inner = await next({ ...e, props: { ...e.props, isFirstOfReply: false } })
    return decorateReply($, e, inner, look)
  })
}
