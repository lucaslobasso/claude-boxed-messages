#!/usr/bin/env python3
"""Real screenshots of a terminal program, taken offscreen.

Runs a command in a pseudo-terminal of a fixed size (no window opens), feeds what it
prints to a terminal emulator (pyte), and draws the emulated screen to a PNG, or to an
animated GIF with --frames. Nothing on your desktop is touched.

    pip install pyte pillow pywinpty      # pywinpty on Windows; ptyprocess elsewhere
    python docs/capture.py --out docs/screenshot.png --wait 30 -- claude "Say hi"

Options worth knowing:
    --send TEXT@SECONDS   type TEXT (\\r = Enter) into the program after SECONDS; repeatable
    --frames N --every MS take N frames MS apart (after --wait) and write a GIF
    --rows-from/--rows-to keep only part of the screen (blank rows at the end are trimmed)
    --from-text REGEX     start one row above the first row that matches (overrides --rows-from)
    --hide REGEX          blank out every match on screen (paths, names) before drawing
    --sandbox SETTINGS    run in a throwaway CLAUDE_CONFIG_DIR: SETTINGS (a JSON file or inline JSON)
                          becomes its settings.json, your login is copied in, onboarding and the
                          trust prompt are pre-answered, and the folder is deleted afterwards. Your
                          own plugins, status line and history stay out of the picture.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import tempfile
import sys
import threading
import time

import pyte
from PIL import Image, ImageDraw, ImageFont

THEME = {  # One Half Dark-ish, close to the Windows Terminal default
    'background': (0x1c, 0x20, 0x29), 'foreground': (0xd7, 0xda, 0xe0), 'chrome': (0x17, 0x1a, 0x21),
    'black': (0x28, 0x2c, 0x34), 'red': (0xe0, 0x6c, 0x75), 'green': (0x98, 0xc3, 0x79),
    'brown': (0xe5, 0xc0, 0x7b), 'yellow': (0xe5, 0xc0, 0x7b), 'blue': (0x61, 0xaf, 0xef),
    'magenta': (0xc6, 0x78, 0xdd), 'cyan': (0x56, 0xb6, 0xc2), 'white': (0xdc, 0xdf, 0xe4),
    'brightblack': (0x7f, 0x84, 0x8e), 'brightred': (0xe0, 0x6c, 0x75), 'brightgreen': (0x98, 0xc3, 0x79),
    'brightbrown': (0xe5, 0xc0, 0x7b), 'brightyellow': (0xe5, 0xc0, 0x7b), 'brightblue': (0x61, 0xaf, 0xef),
    'brightmagenta': (0xc6, 0x78, 0xdd), 'brightcyan': (0x56, 0xb6, 0xc2), 'brightwhite': (0xff, 0xff, 0xff),
}
FONT_CANDIDATES = [
    'C:/Windows/Fonts/CascadiaMono.ttf', 'C:/Windows/Fonts/consola.ttf',
    '/System/Library/Fonts/Menlo.ttc', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf',
]
SYMBOL_CANDIDATES = ['C:/Windows/Fonts/seguisym.ttf', '/System/Library/Fonts/Apple Symbols.ttf',
                     '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']
CJK_CANDIDATES = ['C:/Windows/Fonts/YuGothM.ttc', 'C:/Windows/Fonts/msgothic.ttc', 'C:/Windows/Fonts/meiryo.ttc',
                  '/System/Library/Fonts/Hiragino Sans GB.ttc', '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc']


def spawn(argv: list[str], cols: int, rows: int, env: dict[str, str]):
    if os.name == 'nt':
        from winpty import PtyProcess  # pywinpty
        import subprocess
        return PtyProcess.spawn(subprocess.list2cmdline(argv), dimensions=(rows, cols), env=env)
    from ptyprocess import PtyProcessUnicode
    return PtyProcessUnicode.spawn(argv, dimensions=(rows, cols), env=env)


SANDBOXES: list[str] = []  # removed on exit, even after an error (they hold a copy of the login)


def make_sandbox(settings: str, cwd: str) -> str:
    """A throwaway config dir with SETTINGS, a copy of the login, and CWD already trusted."""
    real = os.environ.get('CLAUDE_CONFIG_DIR') or os.path.join(os.path.expanduser('~'), '.claude')
    box = tempfile.mkdtemp(prefix='capture-cfg-')
    data = json.loads(open(settings, encoding='utf-8').read() if os.path.isfile(settings) else settings)
    with open(os.path.join(box, 'settings.json'), 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
    login = os.path.join(real, '.credentials.json')  # Windows/Linux; macOS keeps it in the keychain
    if os.path.isfile(login):
        shutil.copy(login, box)
    key = os.path.abspath(cwd).replace('\\', '/')
    state = {'hasCompletedOnboarding': True, 'projects': {key: {'hasTrustDialogAccepted': True, 'hasClaudeMdExternalIncludesApproved': False, 'hasClaudeMdExternalIncludesWarningShown': True}}}
    with open(os.path.join(box, '.claude.json'), 'w', encoding='utf-8') as f:
        json.dump(state, f)
    return box


def color(value: str, default: tuple[int, int, int]) -> tuple[int, int, int]:
    if value == 'default':
        return default
    if re.fullmatch(r'[0-9a-fA-F]{6}', value):
        return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]
    return THEME.get(value, default)


def load_font(paths: list[str], size: int):
    for p in paths:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def pick(cp: int, font, sym, cjk):
    """The monospace font, except for symbols it lacks (dingbats, media keys) and CJK."""
    if cp >= 0x2e80:
        return cjk
    if (0x2300 <= cp <= 0x23ff) or (0x2600 <= cp <= 0x27bf) or (0x2b00 <= cp <= 0x2bff):
        return sym
    return font


def render(screen: pyte.Screen, args, hide: list[re.Pattern]) -> Image.Image:
    font = load_font(FONT_CANDIDATES, args.font_size)
    cjk = load_font(CJK_CANDIDATES, args.font_size)
    sym = load_font(SYMBOL_CANDIDATES, args.font_size)
    cw = round(font.getlength('M'))
    lh = round(args.font_size * 1.4)
    start = args.rows_from
    if args.from_text:
        hit = next((i for i, row in enumerate(screen.display) if re.search(args.from_text, row)), None)
        if hit is not None:
            start = max(0, hit - 1)
    lines = list(range(screen.lines))[start:args.rows_to]
    # Trim blank rows at the bottom.
    while lines and not ''.join(screen.buffer[lines[-1]][c].data for c in range(screen.columns)).strip():
        lines.pop()
    masked = {}
    for y in lines:
        text = ''.join(screen.buffer[y][c].data for c in range(screen.columns))
        for rx in hide:
            for m in rx.finditer(text):
                for c in range(m.start(), m.end()):
                    masked[(y, c)] = True
    pad, top = 16, (34 if args.chrome else 12)
    width = pad * 2 + cw * screen.columns
    height = top + lh * len(lines) + 12
    img = Image.new('RGB', (width, height), THEME['background'])
    d = ImageDraw.Draw(img)
    if args.chrome:
        d.rectangle([0, 0, width, 26], fill=THEME['chrome'])
        for i, c in enumerate([(0xff, 0x5f, 0x57), (0xfe, 0xbc, 0x2e), (0x28, 0xc8, 0x40)]):
            d.ellipse([12 + i * 20, 8, 24 + i * 20, 20], fill=c)
        if args.title:
            d.text((width / 2, 13), args.title, fill=THEME['brightblack'], font=load_font(FONT_CANDIDATES, 12), anchor='mm')
    for row, y in enumerate(lines):
        line = screen.buffer[y]
        py = top + row * lh
        for x in range(screen.columns):
            ch = line[x]
            fg = color(ch.fg, THEME['foreground'])
            bg = color(ch.bg, THEME['background'])
            if ch.reverse:
                fg, bg = bg, fg
            px = pad + x * cw
            if bg != THEME['background']:
                d.rectangle([px, py, px + cw, py + lh], fill=bg)
            if masked.get((y, x)) or not ch.data.strip():
                continue
            if ch.bold and ch.fg in ('default',):
                fg = THEME['brightwhite']
            d.text((px, py + lh / 2), ch.data, fill=fg, font=pick(ord(ch.data[0]), font, sym, cjk), anchor='lm')
    return img


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--out', required=True)
    ap.add_argument('--cols', type=int, default=100)
    ap.add_argument('--rows', type=int, default=32)
    ap.add_argument('--wait', type=float, default=10)
    ap.add_argument('--send', action='append', default=[], help='TEXT@SECONDS')
    ap.add_argument('--frames', type=int, default=1)
    ap.add_argument('--every', type=int, default=250, help='ms between frames')
    ap.add_argument('--rows-from', type=int, default=None)
    ap.add_argument('--rows-to', type=int, default=None)
    ap.add_argument('--from-text', default=None, help='start one row above the first row matching this regex')
    ap.add_argument('--hide', action='append', default=[])
    ap.add_argument('--font-size', type=int, default=15)
    ap.add_argument('--no-chrome', dest='chrome', action='store_false')
    ap.add_argument('--title', default='')
    ap.add_argument('--cwd', default=None)
    ap.add_argument('--dump', action='store_true', help='also print the final screen as text')
    ap.add_argument('--sandbox', default=None, help='settings.json (file or inline JSON) for a throwaway config dir')
    ap.add_argument('command', nargs=argparse.REMAINDER)
    args = ap.parse_args()
    argv = args.command[1:] if args.command[:1] == ['--'] else args.command
    if not argv:
        ap.error('give the command after --')

    args.out = os.path.abspath(args.out)
    env = dict(os.environ, COLUMNS=str(args.cols), LINES=str(args.rows), TERM='xterm-256color', COLORTERM='truecolor')
    if args.cwd:
        os.chdir(args.cwd)
    if args.sandbox:
        SANDBOXES.append(make_sandbox(args.sandbox, os.getcwd()))
        # A capture started from inside a Claude session would inherit its markers (no transcript, no color).
        for k in [k for k in env if k.startswith(('CLAUDE_CODE_', 'CLAUDECODE')) or k == 'NO_COLOR']:
            del env[k]
        env['CLAUDE_CONFIG_DIR'] = SANDBOXES[-1]
    screen = pyte.Screen(args.cols, args.rows)
    stream = pyte.Stream(screen)
    lock = threading.Lock()
    proc = spawn(argv, args.cols, args.rows, env)

    def pump():
        while True:
            try:
                data = proc.read(65536)
            except EOFError:
                return
            except Exception:
                return
            if data:
                with lock:
                    stream.feed(data)

    threading.Thread(target=pump, daemon=True).start()
    start = time.time()
    sends = sorted((float(s.rsplit('@', 1)[1]), s.rsplit('@', 1)[0].encode().decode('unicode_escape')) for s in args.send)
    while time.time() - start < args.wait:
        while sends and time.time() - start >= sends[0][0]:
            proc.write(sends.pop(0)[1])
        time.sleep(0.05)

    hide = [re.compile(h) for h in args.hide]
    frames = []
    for i in range(max(1, args.frames)):
        with lock:
            frames.append(render(screen, args, hide))
        if i < args.frames - 1:
            time.sleep(args.every / 1000)
    if args.dump:
        with lock:
            print('\n'.join(screen.display))
    try:
        proc.terminate(force=True)
    except Exception:
        pass

    if len(frames) == 1:
        frames[0].save(args.out)
    else:
        h = max(f.height for f in frames)
        frames = [f if f.height == h else f.crop((0, 0, f.width, h)) for f in frames]
        frames[0].save(args.out, save_all=True, append_images=frames[1:], duration=args.every, loop=0, optimize=True)
    print('wrote', args.out)
    return 0


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    try:
        sys.exit(main())
    finally:
        for box in SANDBOXES:
            time.sleep(0.5)
            shutil.rmtree(box, ignore_errors=True)
