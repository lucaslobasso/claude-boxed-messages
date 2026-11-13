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
| `/boxed-messages status` | Built-in status line on/off | on |
| `/boxed-messages` | Show current state | |

Colors and tint strength are constants at the top of `hooks/register.tsx`.

## Status line

The mod includes a status line under the prompt, so no separate install is needed. It shows the model and thinking effort, context used, git branch, and on the right your weekly and 5-hour usage with their reset timers (usage appears for Claude subscriptions). Its layout is a built-in copy of a [ccstatusline](https://github.com/sirmalloc/ccstatusline) setup, and there is nothing to configure beyond turning it on or off (`/boxed-messages status`, or in `/config`).

Claude Code only reads `statusLine` from the settings files, so the mod keeps a `statusLine` entry in `~/.claude/settings.json` in step with the switch: on adds it, off removes it again. It only ever touches an entry it wrote itself; if you already have a different `statusLine`, the mod leaves it alone and shows a notice, so remove yours to use the built-in one. It runs with `node`, which must be on your `PATH`. The layout and colors are constants at the top of `statusline/statusline.mjs`.

## Known limits

- Your prompts are redrawn as plain text, so special rows (e.g. pasted-image placeholders) show as their text label.
- The background works best on dark themes close to `#1c2029`–`#282c34`; a faint line may show above messages on very different backgrounds.

## License

MIT
