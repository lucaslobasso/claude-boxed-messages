import { expect, test } from 'claude-code/testing'
import { register } from '../hooks/register'

// 2.0 dropped the status line. At session.start the mod removes the `statusLine`
// entry 1.x wrote into the user settings.json, and only that one. The hook is
// captured as the mod registers it and called with a stub `$` whose settings file
// lives in memory.
type Hook = (...args: any[]) => Promise<any>

const OLD = 'node "C:/Users/me/.claude/mods/boxed-messages/statusline/statusline.mjs"'
const OLD_MARKET =
  'node "C:/Users/me/.claude/plugins/cache/claude-boxed-messages/boxed-messages/1.1.1/statusline/statusline.mjs"'
const entry = (command: string) =>
  `{"type":"command","command":${JSON.stringify(command)},"padding":0,"refreshInterval":10}`

const run = async (settings: string, env: Record<string, string> = { USERPROFILE: 'C:\\Users\\me' }, options = {}) => {
  let hook: Hook | undefined
  const on = (event: string, ...rest: any[]) => {
    if (event === 'session.start') hook = rest[rest.length - 1]
  }
  ;(register as any)(on, options)

  const state = { file: settings, path: '', writes: 0, toasts: [] as string[] }
  const $ = {
    command: { register: async () => ({}) },
    env: { get: async (name: string) => env[name] },
    fs: {
      read: async (path: string) => {
        state.path = path
        return state.file
      },
      write: async (_path: string, text: string) => {
        state.file = text
        state.writes++
      },
    },
    ui: { toast: (text: string) => state.toasts.push(text) },
  }
  await hook!($, { cwd: '/' }, async (e: unknown) => e)
  return state
}

test('removes the 1.x entry from an inline install and keeps the rest as written', async () => {
  const s = await run(`{\n  "model": "fable",\n  "statusLine": ${entry(OLD)},\n  "env": { "A": "1" }\n}\n`)

  expect(JSON.parse(s.file)).toEqual({ model: 'fable', env: { A: '1' } })
  expect(s.file).toContain('"env": { "A": "1" }') // untouched text, not a reformat
  expect(s.path).toBe('C:/Users/me/.claude/settings.json')
  expect(s.toasts[0]).toMatch(/no longer ships a status line/)
})

test('removes the 1.x entry from a marketplace install, even as the last key', async () => {
  const s = await run(`{\n  "model": "fable",\n  "statusLine": ${entry(OLD_MARKET)}\n}\n`)

  expect(JSON.parse(s.file)).toEqual({ model: 'fable' })
})

test('a different statusLine is never touched', async () => {
  const theirs = `{"statusLine":${entry('node "C:/Users/me/personal-claude/statusline/statusline.mjs"')}}`
  const s = await run(theirs)

  expect(s.file).toBe(theirs)
  expect(s.writes).toBe(0)
  expect(s.toasts).toEqual([])
})

test('no statusLine at all: nothing written, nothing said', async () => {
  const s = await run('{"model":"fable"}')

  expect(s.writes).toBe(0)
  expect(s.toasts).toEqual([])
})

test('honors CLAUDE_CONFIG_DIR', async () => {
  const s = await run(`{"statusLine":${entry(OLD)}}`, { CLAUDE_CONFIG_DIR: 'D:\\cfg', USERPROFILE: 'C:\\Users\\me' })

  expect(s.path).toBe('D:/cfg/settings.json')
  expect(JSON.parse(s.file)).toEqual({})
})

test('works with HOME only (macOS, Linux)', async () => {
  const s = await run(`{"statusLine":${entry('node "/home/me/.claude/mods/boxed-messages/statusline/statusline.mjs"')}}`, {
    HOME: '/home/me',
  })

  expect(s.path).toBe('/home/me/.claude/settings.json')
  expect(JSON.parse(s.file)).toEqual({})
})

test('a settings file that does not parse is left alone', async () => {
  const s = await run('{ not json')

  expect(s.file).toBe('{ not json')
  expect(s.writes).toBe(0)
})

test('a bad color setting is reported once at start', async () => {
  const s = await run('{}', undefined, { userColor: 'blue' })

  expect(s.toasts[0]).toMatch(/userColor must be a #rrggbb color/)
})
