#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
stamp_kit.py — проставляет отпечаток кита в его же шапку.

Отпечаток считается по телу МЕЖДУ маркерами `/*<<<KIT-PANEL-BODY>>>*/` и
`/*<<<KIT-PANEL-END>>>*/`. Так его можно пересчитать и внутри собранного
single-file, куда кит вклеен инлайном, и сравнить с источником: копия здорова,
пока она побайтно та же (закон 2 наряда).

  python3 kit/stamp_kit.py           проставить
  python3 kit/stamp_kit.py --check   проверить, что в шапке стоит верный отпечаток

Коды: 0 — сходится, 1 — разошлось (при --check), 2 — маркеров нет.
"""
from __future__ import unicode_literals

import hashlib
import io
import os
import re
import sys

HERE = os.path.dirname(os.path.realpath(__file__))
BEG = '/*<<<KIT-PANEL-BODY>>>*/'
END = '/*<<<KIT-PANEL-END>>>*/'
HEAD = re.compile(r'/\* KIT-PANEL v([\d.]+) md5:([0-9a-f]{64}) \*/')


def body_of(text):
    i = text.find(BEG)
    j = text.find(END)
    if i < 0 or j < 0 or j < i:
        return None
    return text[i + len(BEG):j]


def digest(text):
    b = body_of(text)
    return None if b is None else hashlib.sha256(b.encode('utf-8')).hexdigest()


def main():
    path = os.path.join(HERE, 'kit-panel.js')
    with io.open(path, encoding='utf-8') as f:
        text = f.read()
    d = digest(text)
    if d is None:
        sys.stderr.write('🔴 маркеров тела в ките нет\n')
        return 2
    m = HEAD.search(text)
    if not m:
        sys.stderr.write('🔴 шапки с версией и отпечатком нет\n')
        return 2
    if '--check' in sys.argv:
        if m.group(2) != d:
            sys.stderr.write('🔴 отпечаток кита разошёлся: в шапке %s…, по телу %s…\n'
                             % (m.group(2)[:12], d[:12]))
            return 1
        print('кит v%s · отпечаток сходится · %s…' % (m.group(1), d[:16]))
        return 0
    new = HEAD.sub('/* KIT-PANEL v%s md5:%s */' % (m.group(1), d), text, count=1)
    with io.open(path, 'w', encoding='utf-8') as f:
        f.write(new)
    print('кит v%s · отпечаток %s…' % (m.group(1), d[:16]))
    return 0


if __name__ == '__main__':
    sys.exit(main())
