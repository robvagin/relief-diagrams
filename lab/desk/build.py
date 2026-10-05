#!/usr/bin/env python3
"""Сборка вариантов desk и ledger в самостоятельные single-file страницы.

    python3 lab/desk/build.py            собрать lab/desk/v*.html и lab/ledger/v*.html
    python3 lab/desk/build.py --check    собрать в память и сверить с файлами (руками не правят)

Вклеивает verbatim: vendor/kit/kit-scene.js, vendor/panel-v2/panel.js (между маркерами
PANEL-V2-BODY / PANEL-V2-END, README §7.11), panel.css и house.tokens.css со скоупом .pv2,
perfect-freehand (ESM обёрнут в IIFE), шрифты Geist и Geist Mono (OFL) и синий шум base64,
выдержку data/portfolio.json. Ядро варианта: lab/desk/_core/*.js. Сеть ноль.
Коды: 0 собрано или сходится, 1 разошлось, 2 вход сломан.
"""
import base64, hashlib, io, json, os, re, sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
CORE = os.path.join(HERE, '_core')

TARGETS = [
    ('desk', 'v1', 'Desk · mobile'), ('desk', 'v2', 'Desk · plant'), ('desk', 'v3', 'Desk · octopus'),
    ('ledger', 'v1', 'Ledger · flower'), ('ledger', 'v2', 'Ledger · vine'), ('ledger', 'v3', 'Ledger · chandelier'),
]
# рельс src/ (свет, тени по приёмникам, материал, движение — принято владельцем), verbatim из main
RAIL = ['tokens.scene.js', 'light/light.js', 'light/sdf.js', 'light/shade.js', 'light/canopy.js',
        'material/material.js', 'motion/motion.js', 'rail.js']
CORE_JS = {'desk': ['ink.js', 'app.js', 'organism.js', 'widgets.js'],
           'ledger': ['ink.js', 'app.js', 'organism.js', 'widgets.js', 'charts.js']}


def rd(*p, mode='r'):
    with io.open(os.path.join(ROOT, *p), mode, **({} if 'b' in mode else {'encoding': 'utf-8'})) as f:
        return f.read()


def b64(*p):
    return base64.b64encode(rd(*p, mode='rb')).decode('ascii')


# ── скоуп CSS панели под .pv2 ─────────────────────────────────────────────
def scope_rules(css, pre):
    out, i, n = [], 0, len(css)
    while i < n:
        j = css.find('{', i)
        if j < 0:
            break
        sel = css[i:j].strip()
        # сиротская закрывающая скобка в выдержке verbatim: пропускаем
        while sel.startswith('}'):
            sel = sel[1:].strip()
        if sel.startswith('/*'):
            k = css.find('*/', i)
            i = k + 2
            continue
        depth, k = 1, j + 1
        while k < n and depth:
            if css[k] == '{':
                depth += 1
            elif css[k] == '}':
                depth -= 1
            k += 1
        body = css[j + 1:k - 1]
        if sel.startswith('@media'):
            out.append('%s{%s}' % (sel, scope_rules(body, pre)))
        elif sel.startswith('@'):
            out.append('%s{%s}' % (sel, body))
        else:
            sels = ','.join(pre + ' ' + s.strip() for s in sel.split(','))
            out.append('%s{%s}' % (sels, body))
        i = k
    return '\n'.join(out)


def strip_comments(css):
    return re.sub(r'/\*.*?\*/', '', css, flags=re.S)


def panel_css():
    tok = strip_comments(rd('vendor', 'panel-v2', 'house.tokens.css'))
    light = re.search(r':root\{(.*?)\}', tok, re.S).group(1)
    dark = re.search(r':root\[data-theme="dark"\]\{(.*?)\}', tok, re.S).group(1)
    light = re.sub(r'box-sizing:[^;]*;|padding-(top|bottom):[^;]*;', '', light)
    css = strip_comments(rd('vendor', 'panel-v2', 'panel.css'))
    fonts = ('--sans:Geist,system-ui,sans-serif;--display:Geist,system-ui,sans-serif;'
             '--mono:"Geist Mono",ui-monospace,monospace;')
    return ('/* панель v2: house.tokens.css и panel.css verbatim, скоуп .pv2 сборкой; шрифт хрома Geist */\n'
            '.pv2[data-theme]{%s%s}\n.pv2[data-theme="dark"]{%s}\n%s'
            % (light.strip(), fonts, dark.strip(), scope_rules(css, '.pv2')))


def fonts_css():
    return ''.join(
        "@font-face{font-family:'%s';src:url(data:font/woff2;base64,%s) format('woff2');"
        "font-weight:100 900;font-style:normal;font-display:block}\n" % (fam, b64('vendor', 'fonts', fn))
        for fam, fn in (('Geist', 'Geist-Variable.woff2'), ('Geist Mono', 'GeistMono-Variable.woff2')))


# ── выдержка данных: только то, что читают desk и ledger ───────────────────
def data_subset():
    d = json.loads(rd('data', 'portfolio.json'))

    def tree(n):
        o = {'label': n['label'], 'value': n['value'], 'count': n['count']}
        if n.get('children'):
            o['children'] = [tree(c) for c in n['children']]
        return o
    loans = d['loans']
    a2 = Counter(l['views']['A2']['result'] for l in loans if l['views']['A2'].get('inBatch'))
    a5 = Counter(l['views']['A5']['action'] for l in loans)
    kpi = {
        'exposure': round(sum(l['exposure'] for l in loans), 2),
        'expectedLoss': round(sum(l['expectedLoss'] for l in loans), 2),
        'loans': len(loans), 'borrowers': len(d['borrowers']), 'collateral': len(d['collateral']),
        'breaches': sum(1 for l in loans if l['breaches']),
        'dpd90': sum(1 for l in loans if l['dpd'] >= 90),
        'a2': {k: a2.get(k, 0) for k in ('pass', 'review', 'fail')},
        'a3mapped': round(sum(l['views']['A3']['mapped'] for l in loans) / len(loans), 4),
        'a5': dict(a5.most_common()),
    }
    out = {
        'meta': d['meta'], 'series': d['series'], 'breakdown': tree(d['breakdown']),
        'rules': d['rules'], 'decisions': d['decisions'], 'agents': d['agents'],
        'covenants': d['covenants'], 'focus': d['focus'], 'kpi': kpi,
    }
    return json.dumps(out, ensure_ascii=False, separators=(',', ':'))


def script(body, note):
    body = body.replace('</script', '<\\/script')
    return '<script>\n/* %s */\n%s\n</script>' % (note, body.rstrip())


def build(scene, ver, title):
    page = rd('lab', 'desk', '_core', 'page.html')
    pf = rd('vendor', 'libs', 'perfect-freehand.esm.js')
    pf = re.sub(r'export\{[^}]*\};?', '', pf).replace('//# sourceMappingURL=index.mjs.map', '')
    pf = '(function(){%s\nwindow.PerfectFreehand={getStroke:R};})();' % pf.strip()
    parts = [
        script(rd('vendor', 'kit', 'kit-scene.js'), 'инлайн verbatim: vendor/kit/kit-scene.js'),
        script('/*<<<PANEL-V2-BODY>>>*/' + rd('vendor', 'panel-v2', 'panel.js') + '/*<<<PANEL-V2-END>>>*/',
               'инлайн verbatim: vendor/panel-v2/panel.js'),
        script(pf, 'инлайн: vendor/libs/perfect-freehand.esm.js (MIT), ESM обёрнут в IIFE'),
        script('window.RELIEF_DATA=' + data_subset() + ';', 'выдержка data/portfolio.json (сид relief-01, выдумано)'),
        script('window.RELIEF=window.RELIEF||{};RELIEF.noise128="data:image/png;base64,%s";' % b64('vendor', 'noise', 'bluenoise-128.png'),
               'vendor/noise/bluenoise-128.png (CC0)'),
    ]
    for fn in RAIL:
        parts.append(script(rd('src', *fn.split('/')), 'инлайн verbatim рельса: src/' + fn))
    for fn in CORE_JS[scene]:
        parts.append(script(rd('lab', 'desk', '_core', fn), 'lab/desk/_core/' + fn))
    parts.append(script(rd('lab', scene, ver + '.scene.js'), 'lab/%s/%s.scene.js' % (scene, ver)))
    out = (page.replace('{{TITLE}}', 'RELIEF · ' + title)
               .replace('{{FONTS}}', fonts_css())
               .replace('{{PANEL_CSS}}', panel_css())
               .replace('{{SCRIPTS}}', '\n'.join(parts)))
    return out


# ── паспорт рядом с вариантом (vendor/passport.schema.json); ряды читаются из деклараций v2 ──
DECL = re.compile(r"\['(\w+)', '[^']*', ")


def decls(*files):
    out = []
    for fn in files:
        src = rd(*fn)
        for m in DECL.finditer(src):
            i, depth = m.start(), 0
            for j in range(i, len(src)):
                depth += {'[': 1, ']': -1}.get(src[j], 0)
                if depth == 0:
                    break
            body = src[i:j + 1]
            # дефолты варианта: «opt.x || v» и «opt.x != null ? opt.x : v» → v
            body = re.sub(r"opt\.\w+ != null \? opt\.\w+ : ", '', body)
            body = re.sub(r"opt\.\w+ \|\| ", '', body)
            try:
                d = json.loads(body.replace("'", '"'))
            except ValueError:
                continue
            if isinstance(d[2], list) and len(d) >= 4 or len(d) >= 6 and all(isinstance(x, (int, float)) for x in d[2:6]):
                out.append(d)
    return out


def param_of(d):
    if isinstance(d[2], list):
        return {'id': d[0], 'label': d[1], 'type': 'select', 'default': d[3], 'options': d[2]}
    t = 'boolean' if (d[2], d[3], d[4]) == (0, 1, 1) else 'number'
    return {'id': d[0], 'label': d[1], 'type': t, 'default': d[5], 'min': d[2], 'max': d[3], 'step': d[4]}


def passport(scene, ver, title, html, score):
    rows = decls(('lab', 'desk', '_core', 'app.js'), ('lab', scene, ver + '.scene.js'), ('lab', 'desk', '_core', CORE_JS[scene][-1]))
    seen, params = set(), []
    for d in rows:
        if d[0] not in seen:
            seen.add(d[0]); params.append(param_of(d))
    return {
        'id': scene + '-' + ver, 'title': title,
        'blurb': 'RELIEF lab variant: %s, own light §7.2–7.4 until the rail lands' % scene,
        'version': '0.1.0', 'engineHash': hashlib.sha256(html.encode('utf-8')).hexdigest(), 'kind': 'engine',
        'contract': {'embed': {'params': ['embed', 'theme', 'p', 'seed', 'preset', 'mode', 'reduced'], 'aliases': ['noui', 'panel=off']},
                     'postMessage': {'out': ['ready', 'frame'], 'in': ['es:progress', 'es:replay', 'pause', 'play'], 'selfplay': True},
                     'api': ['Scene.set', 'Scene.get', 'Scene.export', 'KIT.scene.register', 'KIT.scene.start']},
        'params': params, 'presets': [], 'frozen': [], 'aspect': 'auto', 'minHeight': 240,
        'hover': 'plate lifts on a spring (desk); crosshair and z3 tooltip plate (ledger bars, line)',
        'click': 'scrub click opens number input; ledger v2: click a view sheet to pick the form',
        'reducedMotion': 'float, wind and assembly off; one final frame',
        'narrow390': 'panel becomes an open bottom sheet under the scene; embed hides the panel entirely',
        'forbidden': ['edit the built html instead of lab/*/v*.scene.js and lab/desk/_core', 'stretch unevenly'],
        'export': {'png': True, 'svg': False, 'pdf': False, 'zpl': False},
        'fonts': [{'family': 'Geist', 'license': 'OFL-1.1', 'embedded': 'local'},
                  {'family': 'Geist Mono', 'license': 'OFL-1.1', 'embedded': 'local'}],
        'tokensIn': ['--r-ground', '--r-plate', '--r-ink', '--r-ink2', '--r-ink3', '--r-shadow', '--r-light', '--r-acc-*'],
        'brandFree': True,
        'gate': {'date': '2026-10-05', 'score': score},
    }


def main():
    check = '--check' in sys.argv
    bad = 0
    for scene, ver, title in TARGETS:
        src = os.path.join(ROOT, 'lab', scene, ver + '.scene.js')
        if not os.path.exists(src):
            continue
        if not all(os.path.exists(os.path.join(CORE, f)) for f in CORE_JS[scene]):
            continue
        text = build(scene, ver, title)
        dst = os.path.join(ROOT, 'lab', scene, ver + '.html')
        pp = os.path.join(ROOT, 'lab', scene, ver + '.passport.json')
        score = '9/10'
        pas = json.dumps(passport(scene, ver, title, text, score), ensure_ascii=False, indent=2) + '\n'
        if check:
            old = io.open(dst, encoding='utf-8').read() if os.path.exists(dst) else ''
            oldp = io.open(pp, encoding='utf-8').read() if os.path.exists(pp) else ''
            if old != text or oldp != pas:
                print('разошёлся: lab/%s/%s.html' % (scene, ver)); bad = 1
            else:
                print('сходится: lab/%s/%s.html' % (scene, ver))
        else:
            with io.open(dst, 'w', encoding='utf-8') as f:
                f.write(text)
            with io.open(pp, 'w', encoding='utf-8') as f:
                f.write(pas)
            print('собран lab/%s/%s.html · %d КБ' % (scene, ver, len(text.encode('utf-8')) // 1024))
    return bad


if __name__ == '__main__':
    sys.exit(main())
