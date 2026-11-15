import { expect, test } from 'claude-code/testing'
import { unwrapPaste } from '../hooks/register'

// Pasted text is wrapped as <pasted_content id="N">…</pasted_content id="N">; the
// box must show only the content.
test('removes the wrapper, closing tag repeats the id', () => {
  expect(unwrapPaste('<pasted_content id="6115">\nhello\nworld\n</pasted_content id="6115">')).toBe('hello\nworld')
})

test('keeps surrounding text when the wrapper is inline', () => {
  expect(unwrapPaste('look at <pasted_content id="1">abc</pasted_content id="1"> please')).toBe('look at abc please')
})

test('handles several pasted blocks', () => {
  const text = '<pasted_content id="1">a</pasted_content id="1">\n<pasted_content id="2">b</pasted_content id="2">'
  expect(unwrapPaste(text)).toBe('a\nb')
})

test('also accepts a plain closing tag', () => {
  expect(unwrapPaste('<pasted_content>x</pasted_content>')).toBe('x')
})

test('leaves text without the wrapper unchanged', () => {
  expect(unwrapPaste('just a prompt\n')).toBe('just a prompt\n')
})
