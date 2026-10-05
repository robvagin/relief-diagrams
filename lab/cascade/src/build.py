#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build.py — варианты cascade и stack на общем рельсе RELIEF (src/light, src/motion, rail.js).

  python3 lab/cascade/src/build.py            собрать lab/cascade/v1..v3.html, lab/stack/v1..v3.html + паспорта
  python3 lab/cascade/src/build.py --check    собрать в память и сверить с файлами (0 = сходится)

Каркас — src/shell.src.html, вклейка — функции tools/build.py (панель v2 verbatim между маркерами,
шрифты Geist OFL, синий шум, ручки src/knobs.json, data/portfolio.json). Сцене добавляются
lab/cascade/src/organism.js (живой организм: качание, физика, наведение, фокус, зум) и файл сцены.
Собранный файл руками не правится: правится источник.
"""
import hashlib, importlib.util, io, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
spec = importlib.util.spec_from_file_location('relief_build', os.path.join(ROOT, 'tools', 'build.py'))
B = importlib.util.module_from_spec(spec)
sys.path.insert(0, os.path.join(ROOT, 'tools'))
spec.loader.exec_module(B)

VARIANTS = {
    'cascade': {'v1': 'Cascade · satellites', 'v2': 'Cascade · octopus', 'v3': 'Cascade · plant'},
    'stack': {'v1': 'Stack · chandelier', 'v2': 'Stack · graph', 'v3': 'Stack · flower'},
}
BLURB = {
    'cascade': 'Loan book as a living organism of matte discs and paper sheets: area is exposure, distance is share.',
    'stack': 'Model of record as hanging paper sheets and discs lifted by height: data, knowledge, rules, decision.',
}


def build_one(scene, v):
    srcp = os.path.join(ROOT, 'src', 'shell.src.html')
    text = io.open(srcp, encoding='utf-8').read()
    text = text.replace('<!--@title-->', 'RELIEF · %s' % VARIANTS[scene][v])
    scripts = ['<script>window.RELIEF_VARIANT = %s;</script>' % json.dumps(v),
               '<script src="../lab/cascade/src/organism.js"></script>',
               '<script src="../lab/%s/src/%s.js"></script>' % (scene, scene)]
    text = text.replace('<!--@scene-->', '\n'.join(scripts))
    missing = []
    text = B.inline_scripts(text, os.path.dirname(srcp), missing)
    text = text.replace('<!--@fonts-->', B.fonts_css())
    text = text.replace('<!--@pv2-css-->', '<style id="pv2-css">\n%s\n</style>' % B.pv2_css())
    text = text.replace('<!--@assets-->', B.assets_js())
    text = text.replace('<!--@data-->', '')
    # данные: вклейка перед сценой (RELIEF.dataText), иначе ctx.data пуст
    text = text.replace('<script>window.RELIEF_VARIANT', B.data_js() + '\n<script>window.RELIEF_VARIANT', 1)
    if missing:
        raise SystemExit('не нашлись вложения: %s' % ' '.join(missing))
    return text


def scene_rows(scene, v):
    """ручки для паспорта: группы сцены из исходника (литералы декларации) + общие из src/knobs.json"""
    knobs = json.load(io.open(os.path.join(ROOT, 'src', 'knobs.json'), encoding='utf-8'))
    rows = []
    for g in knobs['order']:
        rows += knobs['common'].get(g, [])
    return rows


def passport(scene, v, html):
    params = []
    for d in scene_rows(scene, v):
        if isinstance(d[2], list):
            params.append({'id': d[0], 'label': d[1], 'type': 'select', 'default': d[3], 'options': d[2]})
        else:
            tg = d[2] == 0 and d[3] == 1 and d[4] == 1
            params.append({'id': d[0], 'label': d[1], 'type': 'boolean' if tg else 'number', 'default': d[5],
                           'min': d[2], 'max': d[3], 'step': d[4]})
    return {
        'id': '%s-%s' % (scene, v), 'title': VARIANTS[scene][v], 'blurb': BLURB[scene], 'version': '0.3.0',
        'engineHash': hashlib.sha256(html.encode('utf-8')).hexdigest(), 'kind': 'engine',
        'contract': {'embed': {'params': ['embed', 'theme', 'p', 'seed', 'preset', 'mode', 'reduced'],
                               'aliases': ['noui', 'panel=off']},
                     'postMessage': {'out': ['ready', 'frame'], 'in': ['es:progress', 'es:replay', 'pause', 'play'],
                                     'selfplay': True},
                     'api': ['Scene.set', 'Scene.get', 'Scene.export', 'KIT.scene.register', 'KIT.scene.start']},
        'params': params, 'presets': [], 'frozen': [], 'aspect': 'auto', 'minHeight': 240,
        'hover': 'node lifts with its neighbours, the rest dims by colour; a small z3 card shows the values',
        'click': 'click = focus on a node, drag = pull a node (neighbours follow on springs), wheel = zoom, drag on the floor = pan, double click = home',
        'reducedMotion': 'sway and assembly removed, one final frame',
        'narrow390': 'panel becomes an open bottom sheet, the organism fits its box; no panel in embed',
        'forbidden': ['stretch unevenly', 'put on a coloured ground', 'edit the built file instead of lab/<scene>/src/'],
        'export': {'png': True, 'svg': True, 'pdf': False, 'zpl': False},
        'fonts': [{'family': 'Geist', 'license': 'OFL-1.1', 'embedded': 'subset'},
                  {'family': 'Geist Mono', 'license': 'OFL-1.1', 'embedded': 'subset'}],
        'tokensIn': ['--r-ground', '--r-plate', '--r-ink', '--r-ink2', '--r-ink3', '--r-shadow', '--r-light',
                     '--r-acc-terracotta', '--r-acc-cobalt', '--r-acc-olive'],
        'brandFree': True,
        'gate': {'date': '2026-10-05', 'score': '0/10'},
    }


def main():
    check = '--check' in sys.argv
    only = [a for a in sys.argv[1:] if not a.startswith('--')]
    bad = 0
    for scene, vs in VARIANTS.items():
        if only and scene not in only:
            continue
        for v in vs:
            if not os.path.exists(os.path.join(ROOT, 'lab', scene, 'src', scene + '.js')):
                continue
            html = build_one(scene, v)
            out = os.path.join(ROOT, 'lab', scene, v + '.html')
            pp = os.path.join(ROOT, 'lab', scene, v + '.passport.json')
            pj = passport(scene, v, html)
            if os.path.exists(pp):
                try:
                    old = json.load(io.open(pp, encoding='utf-8'))
                    if old.get('gate') and old.get('engineHash') == pj['engineHash']:
                        pj['gate'] = old['gate']        # счёт гейта вписывает gate.py --stamp
                except ValueError:
                    pass
            ptxt = json.dumps(pj, ensure_ascii=False, indent=2) + '\n'
            rel = os.path.relpath(out, ROOT)
            if check:
                cur = io.open(out, encoding='utf-8').read() if os.path.exists(out) else ''
                curp = io.open(pp, encoding='utf-8').read() if os.path.exists(pp) else ''
                if cur != html or curp != ptxt:
                    print('🔴 %s разошёлся с источником' % rel); bad = 1
                else:
                    print('%s сходится с источником' % rel)
            else:
                io.open(out, 'w', encoding='utf-8').write(html)
                io.open(pp, 'w', encoding='utf-8').write(ptxt)
                print('собран %s · %d КБ + паспорт' % (rel, len(html.encode('utf-8')) // 1024))
    return bad


if __name__ == '__main__':
    sys.exit(main())
