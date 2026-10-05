#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Сборка вариантов кусков gate и glyph на принятом рельсе src/ (свет, тени, материал, панель v2).

    python3 lab/gate/src/build.py            собрать lab/gate/v1–v3.html и lab/glyph/v1–v3.html
    python3 lab/gate/src/build.py --check    собрать в память и сверить с файлами (0 сходится, 1 разошлось)

Сборка идёт функцией build() из tools/build.py (импортом, без правки): шаблон lab/gate/src/page.src.html
= src/shell.src.html + данные + org.js; сцена варианта вклеивается в <!--@scene-->.
Собранный файл руками не правится: правится источник.
"""
import hashlib, importlib.util, io, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
spec = importlib.util.spec_from_file_location('relief_build', os.path.join(ROOT, 'tools', 'build.py'))
B = importlib.util.module_from_spec(spec)
sys.argv_saved = sys.argv
spec.loader.exec_module(B)

TEMPLATE = 'lab/gate/src/page.src.html'
TARGETS = [
    ('lab/gate/v1.html', 'Gate · v1 Mobile', ['gate.js', 'gate-v1.js']),
    ('lab/gate/v2.html', 'Gate · v2 Sprout', ['gate.js', 'gate-v2.js']),
    ('lab/gate/v3.html', 'Gate · v3 Octopus', ['gate.js', 'gate-v3.js']),
    ('lab/glyph/v1.html', 'Glyph · v1 Mobile', ['gate.js', '../../glyph/src/glyph-common.js', '../../glyph/src/glyph-v1.js']),
    ('lab/glyph/v2.html', 'Glyph · v2 Octopus', ['gate.js', '../../glyph/src/glyph-common.js', '../../glyph/src/glyph-v2.js']),
    ('lab/glyph/v3.html', 'Glyph · v3 Sprout', ['gate.js', '../../glyph/src/glyph-common.js', '../../glyph/src/glyph-v3.js']),
]


def main():
    check = '--check' in sys.argv
    only = [a for a in sys.argv[1:] if not a.startswith('--')]
    bad = 0
    for out, title, scene in TARGETS:
        if only and not any(o in out for o in only):
            continue
        if not all(os.path.exists(os.path.join(HERE, s)) for s in scene):
            continue
        html = B.build({'src': TEMPLATE, 'title': title, 'scene': scene, 'data': False})
        # своя метка: комментарий src/data.js сам содержит текст общей метки данных
        html = html.replace('<!--@lab-data-->', B.data_js())
        p = os.path.join(ROOT, out)
        if check:
            old = io.open(p, encoding='utf-8').read() if os.path.exists(p) else ''
            print(('сходится: ' if old == html else 'разошёлся с источником: ') + out)
            bad |= old != html
        else:
            io.open(p, 'w', encoding='utf-8').write(html)
            print('собран %s · %d КБ · md5 %s' % (out, len(html.encode()) // 1024, hashlib.md5(html.encode()).hexdigest()[:10]))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
