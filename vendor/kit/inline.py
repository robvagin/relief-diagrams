#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
inline.py — сборка single-file: внешние <script src> и <link rel=stylesheet>
вклеиваются в документ. Донор устройства: data2d/src/build.js, client-ellipse-sphere/build.py.

  python3 kit/inline.py <src.html> <out.html>           собрать
  python3 kit/inline.py <src.html> <out.html> --check   собрать в память и сверить с файлом

🔴 Собранный файл руками не правится: правится источник. `--check` существует ровно
для того, чтобы это было проверяемо, а не обещано (закон «вторая копия правды —
артефакт сборки, а не файл»).

Коды: 0 — собрано или сходится, 1 — при --check разошлось, 2 — вход сломан.
"""
from __future__ import unicode_literals

import io
import os
import re
import sys

SCRIPT = re.compile(r'[ \t]*<script([^>]*?)\ssrc\s*=\s*["\']([^"\']+)["\']([^>]*)>\s*</script\s*>', re.I)
LINK = re.compile(r'[ \t]*<link[^>]*\srel\s*=\s*["\']stylesheet["\'][^>]*\shref\s*=\s*["\']([^"\']+)["\'][^>]*>', re.I)


def build(src):
    base = os.path.dirname(os.path.abspath(src))
    with io.open(src, encoding='utf-8') as f:
        text = f.read()
    missing = []

    def js(m):
        p = os.path.join(base, m.group(2))
        if not os.path.exists(p):
            missing.append(m.group(2))
            return m.group(0)
        with io.open(p, encoding='utf-8') as f:
            body = f.read()
        # 🔴 `</script` внутри строки JS закрыл бы тег раньше времени
        body = body.replace('</script', '<\\/script')
        rel = os.path.relpath(p, base)
        return ('<script>\n/* инлайн: %s — правится ИСТОЧНИК, не этот файл */\n%s\n</script>'
                % (rel, body.rstrip()))

    def css(m):
        p = os.path.join(base, m.group(1))
        if not os.path.exists(p):
            missing.append(m.group(1))
            return m.group(0)
        with io.open(p, encoding='utf-8') as f:
            return '<style>\n/* инлайн: %s */\n%s\n</style>' % (m.group(1), f.read().rstrip())

    text = SCRIPT.sub(js, text)
    text = LINK.sub(css, text)
    return text, missing


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) != 2:
        sys.stderr.write(__doc__)
        return 2
    src, out = args
    if not os.path.exists(src):
        sys.stderr.write('🔴 нет источника: %s\n' % src)
        return 2
    text, missing = build(src)
    if missing:
        sys.stderr.write('🔴 не нашлись вложения: %s\n' % ' '.join(missing))
        return 2
    if '--check' in sys.argv:
        old = io.open(out, encoding='utf-8').read() if os.path.exists(out) else ''
        if old != text:
            sys.stderr.write('🔴 %s разошёлся с источником. Собрать: python3 kit/inline.py %s %s\n'
                             % (out, src, out))
            return 1
        print('%s сходится с источником' % os.path.basename(out))
        return 0
    with io.open(out, 'w', encoding='utf-8') as f:
        f.write(text)
    print('собран %s · %d КБ' % (out, len(text.encode('utf-8')) // 1024))
    return 0


if __name__ == '__main__':
    sys.exit(main())
