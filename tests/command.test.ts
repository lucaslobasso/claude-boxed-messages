import { expect, test } from 'claude-code/testing'
import { register } from '../hooks/register'
import { mix, tint } from '../hooks/colors'

// /boxed-messages: each argument flips one setting through $.config.set; anything
// else gets the usage text.
type Hook = (...args: any[]) => Promise<any>

const command = (options: Record<string, unknown> = {}) => {
  let hook: Hook | undefined
  const on = (event: string, ...rest: any[]) => {
    if (event === 'command.run') hook = rest[rest.length - 1]
  }
  ;(register as any)(on, options)
  const sets: { key: string; value: unknown }[] = []
  const $ = { config: { set: async (row: { key: string; value: unknown }) => (sets.push(row), { value: row.value }) } }
  return async (args: string) => ({ out: await hook!($, { args }), sets })
}

test('bars, bg and shade flip their setting', async () => {
  const run = command({ showBars: true, showBackground: false, backgroundShade: 'dark' })

  expect((await run('bars')).sets.at(-1)).toEqual({ key: 'boxed-messages.showBars', value: false })
  expect((await run('BG')).sets.at(-1)).toEqual({ key: 'boxed-messages.showBackground', value: true })
  expect((await run('shade')).sets.at(-1)).toEqual({ key: 'boxed-messages.backgroundShade', value: 'light' })
})

test('no argument shows the state, colors included', async () => {
  const { out } = await command({ userColor: '#112233' })('')

  expect(out.text).toMatch(/Bars: on · Background: off \(dark, strength 0.85\)/)
  expect(out.text).toMatch(/you #112233, Claude #d97757/)
})

test('status is gone in 2.0 and an unknown option says so', async () => {
  const { out, sets } = await command()('status')

  expect(out.text).toMatch(/Unknown option "status"/)
  expect(sets).toEqual([])
})

test('tint math is unchanged from 1.x at the default strength', () => {
  expect(tint('#4c8dff', 'dark')).toBe(mix('#4c8dff', '#1c2029', 0.85))
  expect(tint('#4c8dff', 'light')).toBe(mix('#4c8dff', '#ffffff', 0.82))
})
