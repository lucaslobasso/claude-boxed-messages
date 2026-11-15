# claude-boxed-messages

Claude Code mod (function-hook API): colored bars/background on prompts and replies. Plugin name `boxed-messages`,
marketplace `claude-boxed-messages` (this repo), so the installed id is `boxed-messages@claude-boxed-messages`.

- Code: `hooks/register.tsx` (hooks, `/boxed-messages` command, 1.x status line cleanup), `hooks/colors.ts` (shared with `docs/make-images.mjs`).
- Try changes: `claude --plugin-dir .` — not alongside a marketplace install of the same plugin (double bars).
- Check: `claude plugin test .` and `claude plugin validate .` (CI runs both + `node docs/make-images.mjs` diff).
- Screenshots: `docs/capture.py` (offscreen PTY + pyte + PIL). Running 2.x against your real config triggers the 1.x
  status line cleanup, so back up `~/.claude/settings.json` first if it still has the 1.x entry.
- Release: bump `version` in `.claude-plugin/plugin.json` **and** both versions in `marketplace.json`, add a CHANGELOG
  entry, merge, then `claude plugin tag . --push` (tags `boxed-messages--vX.Y.Z`).
- The status line moved out of this repo in 2.0 (it lives in the owner's private personal-claude repo). Don't add it back.
