# Changelog

All notable changes to this project. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [2.0.0] - 2026-11-15

### Removed
- **The built-in status line.** The mod is now only about message boxes. It no longer writes to `settings.json` and no longer needs Node. The `showStatusLine` setting and `/boxed-messages status` are gone.

### Added
- One-time cleanup: on its first start after updating, 2.0 removes the `statusLine` entry that 1.x wrote to your user `settings.json`. It only removes the entry when it points at this mod's own `statusline/statusline.mjs`. Any other status line is left alone.
- Settings for colors and background strength: `userColor`, `claudeColor` and `tintStrength`, in `/config`. They replace editing constants in the source.
- `/boxed-messages <unknown>` now says the option is unknown, instead of quietly showing the state.
- Honors `CLAUDE_CONFIG_DIR`.
- Tests for the cleanup and the command (`claude plugin test .`). CI runs them along with `claude plugin validate`.

### Changed
- The README illustrations share `hooks/colors.ts` with the mod, so they can no longer drift from it.
- The blank top row under a tinted reply covers terminals up to 2000 columns wide (it was 500).

## [1.1.1] - 2026-11-12
### Changed
- The status line is written into `settings.json` instead of using a `settings.read` hook.

## [1.1.0] - 2026-11-12
### Added
- Built-in status line (model, effort, context, git branch, usage with reset timers), replacing the separate ccstatusline setup.

## [1.0.0] - 2026-11-09
### Added
- First release: colored bars and optional tinted background on prompts and replies, `/boxed-messages` toggles.

[2.0.0]: https://github.com/lucaslobasso/claude-boxed-messages/compare/boxed-messages--v1.1.1...boxed-messages--v2.0.0
[1.1.1]: https://github.com/lucaslobasso/claude-boxed-messages/compare/boxed-messages--v1.1.0...boxed-messages--v1.1.1
[1.1.0]: https://github.com/lucaslobasso/claude-boxed-messages/compare/boxed-messages--v1.0.0...boxed-messages--v1.1.0
[1.0.0]: https://github.com/lucaslobasso/claude-boxed-messages/releases/tag/boxed-messages--v1.0.0
