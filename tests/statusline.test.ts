import { expect, test } from 'claude-code/testing'
import { register } from '../hooks/register'

// The mod keeps `statusLine` in ~/.claude/settings.json in step with its setting, at
// session.start. The hook is captured as the mod registers it and called with a stub
// `$` whose settings file lives in memory.
type Hook = (...args: any[]) => Promise<any>

const ROOT = 'C:\\Users\\me\\.claude\\mods\\boxed-messages'
const COMMAND = 'node "C:/Users/me/.claude/mods/boxed-messages/statusline/statusline.mjs"'
const OURS = `{"type":"command","command":${JSON.stringify(COMMAND)},"padding":0,"refreshInterval":10}`

const run = async (settings: string, options: Record<string, unknown> = {}) => {
  let hook: Hook | undefined
  const on = (event: string, ...rest: any[]) => {
    if (event === 'session.start') hook = rest[rest.length - 1]
  }
  ;(register as any)(on, options)

  const state = { file: settings, writes: 0, toast: undefined as string | undefined }
  const $ = {
    plugin: { root: ROOT },
    command: { register: async () => ({}) },
    env: { get: async (name: string) => (name === 'USERPROFILE' ? 'C:\\Users\\me' : undefined) },
    fs: {
      read: async (path: string) => {
        expect(path).toBe('C:/Users/me/.claude/settings.json')
        return state.file
      },
      write: async (_path: string, text: string) => {
        state.file = text
        state.writes++
      },
    },
    ui: { toast: (text: string) => (state.toast = text) },
  }
  await hook!($, { cwd: '/' }, async (e: unknown) => e)
  return state
}

test('on: adds the entry and keeps the file as it was', async () => {
  const before = '{\n  "model": "fable",\n  "env": { "A": "1" }\n}\n'
  const s = await run(before)

  const parsed = JSON.parse(s.file)
  expect(parsed.statusLine).toEqual({ type: 'command', command: COMMAND, padding: 0, refreshInterval: 10 })
  expect(parsed.model).toBe('fable')
  expect(parsed.env).toEqual({ A: '1' })
  expect(s.file).toContain('"env": { "A": "1" }') // untouched text, not a reformat
})

test('on: an empty settings object gets the entry', async () => {
  const s = await run('{}')

  expect(JSON.parse(s.file).statusLine.command).toBe(COMMAND)
})

test('on: our own entry at an old path is refreshed in place', async () => {
  const old = '{"statusLine":{"type":"command","command":"node \\"D:/old/statusline/statusline.mjs\\"","padding":0},"model":"fable"}'
  const s = await run(old)

  expect(JSON.parse(s.file)).toEqual({ statusLine: JSON.parse(OURS), model: 'fable' })
})

test('on: already current writes nothing', async () => {
  const s = await run(`{"model":"fable","statusLine":${OURS}}`)

  expect(s.writes).toBe(0)
})

test('on: a different statusLine is left alone and the person is told', async () => {
  const theirs = '{"statusLine":{"type":"command","command":"my-line"}}'
  const s = await run(theirs)

  expect(s.file).toBe(theirs)
  expect(s.writes).toBe(0)
  expect(s.toast).toMatch(/different statusLine/)
})

test('off: our entry is removed, the rest kept', async () => {
  const s = await run(`{\n  "model": "fable",\n  "statusLine": ${OURS},\n  "env": {}\n}\n`, { showStatusLine: false })

  expect(JSON.parse(s.file)).toEqual({ model: 'fable', env: {} })
})

test('off: removing the last key still leaves valid JSON', async () => {
  const s = await run(`{\n  "model": "fable",\n  "statusLine": ${OURS}\n}\n`, { showStatusLine: false })

  expect(JSON.parse(s.file)).toEqual({ model: 'fable' })
})

test('off: a different statusLine is not ours to remove', async () => {
  const theirs = '{"statusLine":{"type":"command","command":"my-line"}}'
  const s = await run(theirs, { showStatusLine: false })

  expect(s.file).toBe(theirs)
  expect(s.writes).toBe(0)
})

test('a settings file that does not parse is left alone', async () => {
  const s = await run('{ not json')

  expect(s.file).toBe('{ not json')
  expect(s.writes).toBe(0)
})
