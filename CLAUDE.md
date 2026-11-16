# claude-boxed-messages

Claude Code mod (function-hook API): colored bars/background on prompts and replies. Plugin name `boxed-messages`,
marketplace `claude-boxed-messages` (this repo), so the installed id is `boxed-messages@claude-boxed-messages`.

- Code: `hooks/register.tsx` (hooks, `/boxed-messages` command), `hooks/colors.ts` (shared with `docs/make-images.mjs`).
- Try changes: `claude --plugin-dir .` — not alongside a marketplace install of the same plugin (double bars).
- Check: `claude plugin test .` and `claude plugin validate .` (CI runs both + `node docs/make-images.mjs` diff).
- Screenshots: `docs/capture.py` (offscreen PTY + pyte + PIL, no windows). `python docs/screenshots.py` regenerates every PNG (real sessions in a `--sandbox` config dir).
  The other repos of the set download `capture.py` from here at a pinned commit, so keep its CLI stable.
- Release: bump `version` in `.claude-plugin/plugin.json` **and** both versions in `marketplace.json`, add a CHANGELOG
  entry, merge, then `claude plugin tag . --push` (tags `boxed-messages--vX.Y.Z`).
- This mod never touches `settings.json` or the status line; that is claude-statusline's job. Don't add it back.
- README layout and the "Install the whole set" block are shared with the other four repos (canonical copy:
  claude-launcher `docs/bundle-section.md`); keep the block between the `bundle:start`/`bundle:end` markers identical.
