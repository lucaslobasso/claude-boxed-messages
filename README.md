# claude-boxed-messages

A Claude Code mod that makes the conversation easier to scan by boxing each message:

- A colored bar on the left of every message: **blue** for your prompts, **orange** for Claude's replies.
- An optional tinted background behind each message (a dimmed version of its bar color).
- Even padding inside each box (1 row top/bottom, 2 columns left/right).
- No `>` marker on your prompts and no `●` bullet on Claude's replies.

Tool rows ("Ran command"), summaries and notifications are left as they are.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install boxed-messages --marketplace lucaslobasso/claude-boxed-messages
```

Answer `y` to add the marketplace, then pick a scope (user scope = every project).

From a shell:

```
claude plugin install boxed-messages --marketplace lucaslobasso/claude-boxed-messages
```

In the desktop app: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `lucaslobasso/claude-boxed-messages`, then **Add plugin**.

Requires a Claude Code version with the function-hook plugin API (2.1.3xx). That API is in early access and may change between releases.

## Settings

In `/config` under `boxed-messages`, or toggle from the prompt:

| Command | Setting | Default |
| --- | --- | --- |
| `/boxed-messages bars` | Message bars on/off | on |
| `/boxed-messages bg` | Message background on/off | off |
| `/boxed-messages shade` | Background shade: `dark` (dark terminals) / `light` (light terminals) | dark |
| `/boxed-messages` | Show current state | |

Colors and tint strength are constants at the top of `hooks/register.tsx`.

## Matching status line (optional)

`ccstatusline/settings.json` is the [ccstatusline](https://github.com/sirmalloc/ccstatusline) config I use alongside this mod: model, thinking effort, context percentage, git branch, and weekly/session usage with their reset timers.

```
npm i -g ccstatusline
mkdir -p ~/.config/ccstatusline
cp ccstatusline/settings.json ~/.config/ccstatusline/settings.json
```

Then add this to `~/.claude/settings.json`:

```json
"statusLine": { "type": "command", "command": "ccstatusline", "padding": 0 }
```

## Known limits

- Your prompts are redrawn as plain text, so special rows (e.g. pasted-image placeholders) show as their text label.
- The background works best on dark themes close to `#1c2029`–`#282c34`; a faint line may show above messages on very different backgrounds.

## License

MIT
