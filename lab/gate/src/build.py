#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Сборка вариантов кусков gate и glyph на принятом рельсе src/ (свет, тени, материал, панель v2).

    python3 lab/gate/src/build.py            собрать lab/gate/v1–v3.html и lab/glyph/v1–v3.html
    python3 lab/gate/src/build.py --check    собрать в память и сверить с файлами (0 сходится, 1 разошлось)

Сборка идёт функцией build() из tools/build.py (импортом, без правки): шаблон lab/gate/src/page.src.html
= src/shell.src.html + данные + org.js; сцена варианта вклеивается в <!--@scene-->.
Собранный файл руками не правится: правится источник.
"""
import hashlib, importlib.util, io, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
spec = importlib.util.spec_from_file_location('relief_build', os.path.join(ROOT, 'tools', 'build.py'))
B = importlib.util.module_from_spec(spec)
sys.argv_saved = sys.argv
spec.loader.exec_module(B)

TEMPLATE = 'lab/gate/src/page.src.html'
# ряды сцены (зеркало R.gate.rows и R.glyph.rows в JS; меняются вместе) — для паспорта
ROWS = {
    'gate': [['state', 'Состояние', ['instruction', 'blocked', 'allowed', 'loop'], 'loop'],
             ['plates', 'Проверок', 1, 3, 1, 3], ['gap', 'Шаг ветки', 6, 60, 1, 22],
             ['decision', 'Решение', ['D-7781', 'D-7782', 'D-7790', 'D-7804'], 'D-7781'], ['trace', 'Протокол', 0, 1, 1, 1]],
    'glyph': [['stateG', 'Состояние', ['idle', 'work', 'wait', 'done', 'error'], 'work'],
              ['sheet', 'Лист состояний', 0, 1, 1, 1], ['size', 'Размер, px', 16, 96, 1, 48]],
}
BLURB = {
    'gate': 'Check before action as a living organism of paper sheets and discs: a passed check lifts and settles, a blocked one lies flat on the floor.',
    'glyph': 'Agent state in 16–96 px as a living organism of discs: five states told apart by count, not by motion.',
}


def passport(out, title, html):
    scene, v = out.split('/')[1], os.path.splitext(os.path.basename(out))[0]
    knobs = json.load(io.open(os.path.join(ROOT, 'src', 'knobs.json'), encoding='utf-8'))
    rows = list(ROWS[scene])
    for g in knobs['order']:
        rows += knobs['common'].get(g, [])
    params = []
    for d in rows:
        if isinstance(d[2], list):
            params.append({'id': d[0], 'label': d[1], 'type': 'select', 'default': d[3], 'options': d[2]})
        else:
            tg = d[2] == 0 and d[3] == 1 and d[4] == 1
            params.append({'id': d[0], 'label': d[1], 'type': 'boolean' if tg else 'number', 'default': d[5],
                           'min': d[2], 'max': d[3], 'step': d[4]})
    return json.dumps({
        'id': '%s-%s' % (scene, v), 'title': title, 'blurb': BLURB[scene], 'version': '0.3.0',
        'engineHash': hashlib.sha256(html.encode('utf-8')).hexdigest(), 'kind': 'engine',
        'contract': {'embed': {'params': ['embed', 'theme', 'p', 'seed', 'preset', 'mode', 'reduced'], 'aliases': ['noui', 'panel=off']},
                     'postMessage': {'out': ['ready', 'frame'], 'in': ['es:progress', 'es:replay', 'pause', 'play'], 'selfplay': True},
                     'api': ['Scene.set', 'Scene.get', 'Scene.export', 'KIT.scene.register', 'KIT.scene.start']},
        'params': params, 'presets': [], 'frozen': [], 'aspect': 'auto', 'minHeight': 240,
        'hover': 'node lifts with its neighbours, the rest dims by colour',
        'click': 'click = focus, drag = pull a node (neighbours follow on springs), wheel = zoom, drag on the floor = pan, double click or Esc = home',
        'reducedMotion': 'sway, growth and float removed, one final frame',
        'narrow390': 'panel becomes an open bottom sheet, the organism fits its box; no panel in embed',
        'forbidden': ['stretch unevenly', 'put on a coloured ground', 'edit the built file instead of lab/<scene>/src/'],
        'export': {'png': True, 'svg': False, 'pdf': False, 'zpl': False},
        'fonts': [{'family': 'Geist', 'license': 'OFL-1.1', 'embedded': 'subset'}, {'family': 'Geist Mono', 'license': 'OFL-1.1', 'embedded': 'subset'}],
        'tokensIn': ['--r-ground', '--r-plate', '--r-ink', '--r-ink2', '--r-ink3', '--r-shadow', '--r-light', '--r-acc-terracotta', '--r-acc-cobalt', '--r-acc-olive'],
        'brandFree': True,
        'gate': {'date': '2026-10-05', 'score': '0/10'},
    }, ensure_ascii=False, indent=2) + '\n'
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
            pp = os.path.splitext(p)[0] + '.passport.json'
            if not os.path.exists(pp) or json.load(io.open(pp, encoding='utf-8')).get('engineHash') != hashlib.sha256(html.encode('utf-8')).hexdigest():
                io.open(pp, 'w', encoding='utf-8').write(passport(out, title, html))
            print('собран %s · %d КБ · md5 %s' % (out, len(html.encode()) // 1024, hashlib.md5(html.encode()).hexdigest()[:10]))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
