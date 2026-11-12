import { expect, test } from 'claude-code/testing'
import { register } from '../hooks/register'

// The test kit cannot raise `settings.read` (it has no settings noun), so the hook
// is captured as the mod registers it and called with a stub `$`, event and `next`.
type Hook = (...args: any[]) => Promise<any>

const settingsHook = (options: Record<string, unknown>): Hook => {
  let hook: Hook | undefined
  const on = (event: string, ...rest: any[]) => {
    if (event === 'settings.read') hook = rest[rest.length - 1]
  }
  ;(register as any)(on, options)
  if (!hook) throw new Error('no settings.read hook registered')
  return hook
}

// What the engine's own merge holds: another status line the mod must replace.
const merged = { theme: 'dark', statusLine: { type: 'command', command: 'ccstatusline' } }
const $ = { plugin: { root: 'C:\\Users\\me\\.claude\\mods\\boxed-messages' } }
const next = async () => merged

test('on (the default): the merged settings carry the mod status line', async () => {
  const out = await settingsHook({})($, { layers: [] }, next)

  expect(out.theme).toBe('dark')
  expect(out.statusLine.type).toBe('command')
  expect(out.statusLine.command).toBe('node "C:/Users/me/.claude/mods/boxed-messages/statusline/statusline.mjs"')
  expect(out.statusLine.padding).toBe(0)
})

test('on: a read of one source is left alone', async () => {
  const out = await settingsHook({})($, { source: 'user', layers: [] }, next)

  expect(out.statusLine.command).toBe('ccstatusline')
})

test('off: the settings pass through untouched', async () => {
  const out = await settingsHook({ showStatusLine: false })($, { layers: [] }, next)

  expect(out).toEqual(merged)
})
