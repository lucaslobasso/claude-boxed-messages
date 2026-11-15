#!/usr/bin/env python3
"""Regenerates every README screenshot:  python docs/screenshots.py [name ...]

Each shot runs a real Claude Code session offscreen (docs/capture.py --sandbox), so it
uses your login and a few tokens, but none of your own settings, plugins or history.
Needs `pip install pyte pillow pywinpty` (ptyprocess instead of pywinpty off Windows).
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile

DOCS = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(DOCS)
PROMPT = 'Read notes.md and tell me in two short sentences what we need to build.'
NOTES = '# Next up\n\nAdd a dark mode switch to the settings page.\nIt follows the system theme by default and remembers the choice.\n'

# file name -> boxed-messages options for that shot
SHOTS = {
    'screenshot-bg.png': {'showBackground': True},
    'screenshot-bars.png': {},
    'screenshot-colors.png': {'showBackground': True, 'userColor': '#3fb950', 'claudeColor': '#c678dd'},
    'screenshot-strength.png': {'showBackground': True, 'tintStrength': 0.65},
    'screenshot-bg-only.png': {'showBars': False, 'showBackground': True},
}


def shoot(name: str, options: dict, work: str) -> None:
    settings = {'promptSuggestionEnabled': False, 'pluginConfigs': {'boxed-messages@inline': {'options': options}}}
    subprocess.run([
        sys.executable, os.path.join(DOCS, 'capture.py'), '--out', os.path.join(DOCS, name),
        '--cwd', work, '--sandbox', json.dumps(settings), '--wait', '45', '--rows', '28',
        '--from-text', 'Read notes.md and tell',
        '--send', f'{PROMPT}@4', '--send', '\\r@5', '--title', 'claude',
        '--', 'claude', '--plugin-dir', REPO, '--model', 'sonnet',
    ], check=True)


def main() -> int:
    wanted = sys.argv[1:] or list(SHOTS)
    with tempfile.TemporaryDirectory(prefix='boxed-shots-') as work:
        with open(os.path.join(work, 'notes.md'), 'w', encoding='utf-8') as f:
            f.write(NOTES)
        for name in wanted:
            shoot(name, SHOTS[name], work)
    return 0


if __name__ == '__main__':
    sys.exit(main())
