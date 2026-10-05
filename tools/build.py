#!/usr/bin/env python3
"""Сборка RELIEF в single-file (README Ф0.2, §7.11).

    python3 tools/build.py              собрать все цели в dist/
    python3 tools/build.py --check      собрать в память и сверить с dist/ (собранное руками не правится)
    python3 tools/build.py --fonts      пересобрать сабсеты шрифтов в tools/build_cache/ (нужен fonttools)

Что вклеивается:
  · <script src> источника — инлайном (как vendor/kit/inline.py);
  · vendor/panel-v2/panel.js — verbatim между маркерами /*<<<PANEL-V2-BODY>>>*/ … /*<<<PANEL-V2-END>>>*/
    (гейт 2-kit сверяет тело с файлом вендора побайтно);
  · <!--@pv2-css--> — хром панели под .pv2 (tools/scope_css.py);
  · <!--@fonts--> — Geist и Geist Mono (OFL) сабсетом base64; <!--@assets--> — синий шум 128 base64 и ручки
    src/knobs.json; <!--@data--> — data/portfolio.json строкой; <!--@scene--> — скрипты сцены цели.
Паспорт цели пишется рядом (dist/<имя>.passport.json), engineHash считает гейт (--stamp) или эта сборка.
Коды: 0 собрано или сходится · 1 разошлось · 2 вход сломан.
"""
import base64
import hashlib
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
DIST = os.path.join(ROOT, 'dist')
CACHE = os.path.join(ROOT, 'tools', 'build_cache')
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from scope_css import pv2_css  # noqa: E402

PANEL = os.path.join(ROOT, 'vendor', 'panel-v2', 'panel.js')
BEG, END = '/*<<<PANEL-V2-BODY>>>*/', '/*<<<PANEL-V2-END>>>*/'
SCRIPT = re.compile(r'[ \t]*<script([^>]*?)\ssrc\s*=\s*["\']([^"\']+)["\']([^>]*)>\s*</script\s*>', re.I)

# латиница, латиница-1, кириллица (хром панели по-русски), пунктуация, стрелки, математика, галочки
UNICODES = 'U+0020-007E,U+00A0-00FF,U+0131,U+0152-0153,U+02C6,U+02DA,U+02DC,U+0400-045F,U+2002-2015,' \
           'U+2018-201E,U+2022,U+2026,U+2030,U+2032-2033,U+2039-203A,U+2044,U+20AC,U+2116,U+2122,U+2190-2195,' \
           'U+2212,U+2215,U+2219,U+221E,U+2248,U+2260,U+2264-2265,U+25CF,U+25CB,U+2713,U+2715,U+00B7'
FONTS = [('Geist', 'Geist-Variable.woff2'), ('Geist Mono', 'GeistMono-Variable.woff2')]

TARGETS = [
    {'out': 'dist/_lab.html', 'src': 'src/shell.src.html', 'title': 'Relief · rail calibration',
     'scene': ['lab.js'], 'data': False, 'passport': {
         'id': 'lab', 'title': 'Rail calibration', 'blurb': 'Калибровка рельса RELIEF: свет, линия, плавание, зерно.'}},
    {'out': 'dist/index.html', 'src': 'src/playground.src.html', 'title': 'Relief · playground',
     'scene': [], 'data': False, 'passport': None},
]


def md5(b):
    return hashlib.md5(b).hexdigest()


def read(p, mode='r'):
    with io.open(p, mode + ('b' if mode == 'r' and p.endswith(('.woff2', '.png')) else ''),
                 **({} if p.endswith(('.woff2', '.png')) else {'encoding': 'utf-8'})) as f:
        return f.read()


def subset_font(name, fn):
    src = os.path.join(ROOT, 'vendor', 'fonts', fn)
    raw = open(src, 'rb').read()
    out = os.path.join(CACHE, fn.replace('.woff2', '.subset.woff2'))
    stamp = out + '.md5'
    if os.path.exists(out) and os.path.exists(stamp) and open(stamp).read().strip() == md5(raw):
        return open(out, 'rb').read(), 'subset'
    if '--fonts' not in sys.argv:
        return raw, 'full'
    from fontTools import subset
    os.makedirs(CACHE, exist_ok=True)
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['kern', 'liga', 'calt', 'tnum', 'case', 'ss01', 'zero']
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    font = subset.load_font(src, opts)
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=subset.parse_unicodes(UNICODES))
    sub.subset(font)
    subset.save_font(font, out, opts)
    open(stamp, 'w').write(md5(raw) + '\n')
    return open(out, 'rb').read(), 'subset'


def fonts_css():
    rules = []
    for fam, fn in FONTS:
        data, _ = subset_font(fam, fn)
        rules.append('@font-face{font-family:"%s";src:url(data:font/woff2;base64,%s) format("woff2");'
                     'font-weight:100 900;font-style:normal;font-display:block}'
                     % (fam, base64.b64encode(data).decode('ascii')))
    return '<style id="fonts">\n/* Geist, Geist Mono · SIL OFL 1.1 (vendor/fonts/OFL.txt) · сабсет */\n%s\n</style>' % '\n'.join(rules)


def assets_js():
    noise = base64.b64encode(open(os.path.join(ROOT, 'vendor', 'noise', 'bluenoise-128.png'), 'rb').read()).decode('ascii')
    knobs = json.load(io.open(os.path.join(SRC, 'knobs.json'), encoding='utf-8'))
    return ('<script>\n/* вклеено сборкой: синий шум 128 (CC0, vendor/noise) и ручки src/knobs.json */\n'
            'window.RELIEF=window.RELIEF||{};RELIEF.noise128="data:image/png;base64,%s";\n'
            'RELIEF.knobs=%s;\n</script>' % (noise, json.dumps(knobs, ensure_ascii=False, separators=(',', ':'))))


def data_js():
    d = json.load(io.open(os.path.join(ROOT, 'data', 'portfolio.json'), encoding='utf-8'))
    s = json.dumps(json.dumps(d, ensure_ascii=False, separators=(',', ':')), ensure_ascii=False)
    return '<script>\n/* вклеено сборкой: data/portfolio.json, выдуманные данные (§6.6) */\nwindow.RELIEF=window.RELIEF||{};RELIEF.dataText=%s;\n</script>' % s.replace('</', '<\\/')


def inline_scripts(text, base, missing):
    def js(m):
        p = os.path.normpath(os.path.join(base, m.group(2)))
        if not os.path.exists(p):
            missing.append(m.group(2))
            return m.group(0)
        body = io.open(p, encoding='utf-8').read()
        rel = os.path.relpath(p, ROOT)
        if os.path.samefile(p, PANEL):
            # verbatim: тело между маркерами байт в байт как в vendor/panel-v2/panel.js
            if '</script' in body:
                raise SystemExit('panel.js содержит </script: verbatim-вклейка невозможна')
            return '<script>\n/* инлайн: %s · verbatim, правится вендор, не этот файл */\n%s%s%s\n</script>' % (rel, BEG, body, END)
        body = body.replace('</script', '<\\/script')
        return '<script>\n/* инлайн: %s · правится ИСТОЧНИК, не этот файл */\n%s\n</script>' % (rel, body.rstrip())
    return SCRIPT.sub(js, text)


def build(t):
    srcp = os.path.join(ROOT, t['src'])
    text = io.open(srcp, encoding='utf-8').read()
    text = text.replace('<!--@title-->', t['title'])
    text = text.replace('<!--@scene-->', '\n'.join('<script src="%s"></script>' % s for s in t['scene']))
    missing = []
    text = inline_scripts(text, os.path.dirname(srcp), missing)
    text = text.replace('<!--@fonts-->', fonts_css())
    text = text.replace('<!--@pv2-css-->', '<style id="pv2-css">\n%s\n</style>' % pv2_css())
    text = text.replace('<!--@assets-->', assets_js())
    text = text.replace('<!--@data-->', data_js() if t.get('data') else '')
    if missing:
        raise SystemExit('не нашлись вложения: %s' % ' '.join(missing))
    return text


def passport(t, html):
    """Паспорт по схеме vendor/passport.schema.json; params — объектная форма деклараций."""
    p = t['passport']
    knobs = json.load(io.open(os.path.join(SRC, 'knobs.json'), encoding='utf-8'))
    rows = [['view', 'Вид', ['_light', '_ruler', '_float', '_grain'], '_light', ['Свет', 'Линейка', 'Плавание', 'Зерно']]]
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
    out = {
        'id': p['id'], 'title': p['title'], 'blurb': p['blurb'], 'version': '0.1.0',
        'engineHash': hashlib.sha256(html.encode('utf-8')).hexdigest(), 'kind': 'tool',
        'contract': {'embed': {'params': ['embed', 'theme', 'p', 'seed', 'preset', 'mode', 'reduced'],
                               'aliases': ['noui', 'panel=off']},
                     'postMessage': {'out': ['ready', 'frame'], 'in': ['es:progress', 'es:replay', 'pause', 'play'],
                                     'selfplay': True},
                     'api': ['Scene.set', 'Scene.get', 'Scene.export', 'KIT.scene.register', 'KIT.scene.start',
                             '__probe', '__freeze', '__jump', '__lab']},
        'params': params, 'presets': [], 'frozen': [], 'aspect': 'auto', 'minHeight': 240,
        'hover': 'ничего', 'click': 'клик по скрабу без протяжки открывает ввод числа; P пауза, R переиграть, E PNG, I тема',
        'reducedMotion': 'плавание снято, листва стоит на w = 0, сборка пропущена: один финальный кадр',
        'narrow390': 'панель нижним листом 44vh, открыта всегда; в embed панели нет',
        'forbidden': ['править dist/ руками вместо src/', 'задавать тени вне src/light/'],
        'export': {'png': True, 'svg': True, 'pdf': False, 'zpl': False},
        'fonts': [{'family': 'Geist', 'license': 'OFL-1.1', 'embedded': 'subset'},
                  {'family': 'Geist Mono', 'license': 'OFL-1.1', 'embedded': 'subset'}],
        'tokensIn': ['--r-ground', '--r-plate', '--r-ink', '--r-ink2', '--r-ink3', '--r-shadow', '--r-light',
                     '--r-acc-terracotta', '--r-acc-cobalt', '--r-acc-olive'],
        'brandFree': True,
        'gate': {'date': '2026-10-05', 'score': '0/10', 'report': 'gate/acceptance.json'},
    }
    return json.dumps(out, ensure_ascii=False, indent=2) + '\n'


def main():
    check = '--check' in sys.argv
    bad = 0
    for t in TARGETS:
        html = build(t)
        outp = os.path.join(ROOT, t['out'])
        files = [(outp, html)]
        if t.get('passport'):
            pp = os.path.splitext(outp)[0] + '.passport.json'
            old = None
            if os.path.exists(pp):
                try:
                    old = json.load(io.open(pp, encoding='utf-8'))
                except Exception:
                    old = None
            new = json.loads(passport(t, html))
            if old and old.get('gate'):
                new['gate'] = old['gate']           # счёт гейта вписывает gate.py --stamp, сборка его не затирает
            files.append((pp, json.dumps(new, ensure_ascii=False, indent=2) + '\n'))
        for p, body in files:
            if check:
                cur = io.open(p, encoding='utf-8').read() if os.path.exists(p) else ''
                if cur != body:
                    print('🔴 %s разошёлся с источником: python3 tools/build.py' % os.path.relpath(p, ROOT))
                    bad = 1
                else:
                    print('%s сходится с источником' % os.path.relpath(p, ROOT))
            else:
                os.makedirs(os.path.dirname(p), exist_ok=True)
                with io.open(p, 'w', encoding='utf-8') as f:
                    f.write(body)
                print('собран %s · %d КБ' % (os.path.relpath(p, ROOT), len(body.encode('utf-8')) // 1024))
    return bad


if __name__ == '__main__':
    sys.exit(main())
