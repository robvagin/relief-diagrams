#!/usr/bin/env python3
"""Сборка вариантов horizon и agents на рельсе src/ (свет, тени, материал, движение, панель v2).

    python3 lab/horizon/src/build.py            собрать lab/horizon/v*.html и lab/agents/v*.html
    python3 lab/horizon/src/build.py --check    собрать в память и сверить с файлами

Вклейка — функциями tools/build.py (панель v2 verbatim между маркерами, шрифты, шум, данные):
сборщик рельса один, второй копии нет. Источник страницы: lab/horizon/src/page.src.html.
Коды: 0 собрано или сходится · 1 разошлось · 2 вход сломан.
"""
import hashlib, io, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import build as RB  # noqa: E402

PAGE = 'lab/horizon/src/page.src.html'
TARGETS = [
    ('horizon', 1, 'Horizon · Flower', ['hyper.js', 'horizon.js', 'v1.js']),
    ('horizon', 2, 'Horizon · Octopus', ['hyper.js', 'horizon.js', 'v2.js']),
    ('horizon', 3, 'Horizon · Plant', ['hyper.js', 'horizon.js', 'v3.js']),
    ('agents', 1, 'Agents · Mobile', ['../../agents/src/views.js', '../../agents/src/agents.js', '../../agents/src/v1.js']),
    ('agents', 2, 'Agents · Flower', ['../../agents/src/views.js', '../../agents/src/agents.js', '../../agents/src/v2.js']),
    ('agents', 3, 'Agents · Graph', ['../../agents/src/views.js', '../../agents/src/agents.js', '../../agents/src/v3.js']),
]


def passport(scene, n, title, html, old):
    data = {
        'id': scene, 'title': title, 'blurb': 'Living organism in the RELIEF language: paper sheets and discs on springs, one light.',
        'version': '0.2.0', 'engineHash': hashlib.sha256(html.encode('utf-8')).hexdigest(), 'kind': 'fragment',
        'contract': {'embed': {'params': ['embed', 'theme', 'p', 'seed', 'preset', 'mode', 'reduced'], 'aliases': ['noui', 'panel=off']},
                     'postMessage': {'out': ['ready', 'frame'], 'in': ['es:progress', 'es:replay', 'pause', 'play'], 'selfplay': True},
                     'api': ['Scene.set', 'Scene.get', 'Scene.export', 'KIT.scene.register', 'KIT.scene.start']},
        'params': [], 'aspect': 'auto', 'minHeight': 320,
        'hover': 'узел поднимается вместе с соседями, остальное притухает',
        'click': 'фокус: в horizon ход Мёбиуса к узлу, в agents выбор займа или агента; тяга узла — соседи едут на пружинах; колесо = зум',
        'reducedMotion': 'ветер, плавание и сборка сняты, узлы стоят на якорях; клик переводит фокус без хода',
        'narrow390': 'панель нижним листом 44vh, сцена над ней; в embed панели нет',
        'forbidden': ['вырезать окна в плашках', 'рисовать прямые углы связей', 'задавать тени вне src/light/'],
        'export': {'png': True, 'svg': False, 'pdf': False, 'zpl': False},
        'fonts': [{'family': 'Geist', 'license': 'OFL-1.1', 'embedded': 'subset'},
                  {'family': 'Geist Mono', 'license': 'OFL-1.1', 'embedded': 'subset'}],
        'tokensIn': ['--r-ground', '--r-plate', '--r-ink', '--r-ink2', '--r-ink3', '--r-shadow', '--r-light',
                     '--r-acc-terracotta', '--r-acc-cobalt', '--r-acc-olive'],
        'brandFree': True,
        'gate': (old or {}).get('gate') or {'date': '2026-10-05', 'score': '0/10'},
    }
    return json.dumps(data, ensure_ascii=False, indent=2) + '\n'


def main():
    check = '--check' in sys.argv
    bad = 0
    for scene, n, title, scripts in TARGETS:
        if scene=='agents': continue
        if not all(os.path.exists(os.path.normpath(os.path.join(ROOT, 'lab/horizon/src', s))) for s in scripts):
            continue
        html = RB.build({'src': PAGE, 'title': title, 'scene': scripts, 'data': False})
        html = html.replace('<!--@lab-data-->', RB.data_js(), 1)   # своя метка: @data встречается в комментарии src/data.js
        out = os.path.join(ROOT, 'lab', scene, 'v%d.html' % n)
        pp = os.path.join(ROOT, 'lab', scene, 'v%d.passport.json' % n)
        old = json.load(io.open(pp, encoding='utf-8')) if os.path.exists(pp) else None
        files = [(out, html), (pp, passport(scene, n, title, html, old))]
        for p, body in files:
            rel = os.path.relpath(p, ROOT)
            if check:
                cur = io.open(p, encoding='utf-8').read() if os.path.exists(p) else ''
                if p.endswith('.json'):
                    a, b = json.loads(cur or '{}'), json.loads(body); a.pop('gate', None); b.pop('gate', None)
                    ok = a == b
                else:
                    ok = cur == body
                bad |= 0 if ok else 1
                print(('сходится ' if ok else '🔴 разошёлся ') + rel)
            else:
                with io.open(p, 'w', encoding='utf-8') as f:
                    f.write(body)
                print('собран %s · %d КБ' % (rel, len(body.encode('utf-8')) // 1024))
    return bad


if __name__ == '__main__':
    sys.exit(main())
