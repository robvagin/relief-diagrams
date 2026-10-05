#!/usr/bin/env python3
"""Сборка вариантов horizon и agents в single-file: lab/<сцена>/v<N>.html.

  python3 lab/horizon/src/build.py            собрать все варианты, у которых есть исходник
  python3 lab/horizon/src/build.py --check    собрать в память и сверить с файлами

Вклеивается verbatim: vendor/kit/kit-scene.js, vendor/panel-v2/panel.js (между маркерами
/*<<<PANEL-V2-BODY>>>*/ … /*<<<PANEL-V2-END>>>*/), panel.css и house.tokens.css со скоупом
.pv2, шрифты Geist base64, синий шум base64, data/portfolio.json. Собранный файл руками
не правится: правится источник. Коды: 0 собрано или сходится, 1 разошлось, 2 вход сломан.
"""
import base64
import io
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
LAB = os.path.join(ROOT, 'lab')


def rd(*p):
    with io.open(os.path.join(ROOT, *p), encoding='utf-8') as f:
        return f.read()


def b64(*p):
    with open(os.path.join(ROOT, *p), 'rb') as f:
        return base64.b64encode(f.read()).decode('ascii')


def scope_rules(css, prefix='.pv2'):
    """Префикс селекторов; @media сохраняются; непарные `}` выдержки отбрасываются."""
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    out, i, n, depth_media = [], 0, len(css), 0
    while i < n:
        j = css.find('{', i)
        k = css.find('}', i)
        if j < 0 and k < 0:
            break
        if k >= 0 and (j < 0 or k < j):           # закрытие блока
            if depth_media > 0:
                out.append('}')
                depth_media -= 1
            i = k + 1
            continue
        head = css[i:j].strip()
        if head.startswith('@media'):
            out.append(head + '{')
            depth_media += 1
            i = j + 1
            continue
        end = css.find('}', j)
        body = css[j + 1:end]
        sels = []
        for s in head.split(','):
            s = s.strip()
            if not s:
                continue
            sels.append(prefix if s == ':root' else prefix + ' ' + s)
        if sels:
            out.append(','.join(sels) + '{' + body.strip() + '}')
        i = end + 1
    return '\n'.join(out)


def scope_tokens(css):
    """house.tokens.css: :root → .pv2[data-theme], тёмная ветка → .pv2[data-theme="dark"].
    Ветка prefers-color-scheme снята: тема хрома следует теме сцены (?theme)."""
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    light = re.search(r':root\{(.*?)\}', css, re.S).group(1)
    dark = re.search(r':root\[data-theme="dark"\]\{(.*?)\}', css, re.S).group(1)
    font = ('--sans:Geist,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;'
            '--display:Geist,-apple-system,BlinkMacSystemFont,sans-serif;'
            '--mono:"Geist Mono",ui-monospace,Menlo,monospace;')
    return ('.pv2[data-theme]{' + light.strip() + '}\n'
            '.pv2[data-theme="dark"]{' + dark.strip() + '}\n'
            '.pv2[data-theme]{' + font + '}')


def fonts():
    return ('@font-face{font-family:Geist;src:url(data:font/woff2;base64,%s) format("woff2");'
            'font-weight:100 900;font-display:block}\n'
            '@font-face{font-family:"Geist Mono";src:url(data:font/woff2;base64,%s) format("woff2");'
            'font-weight:100 900;font-display:block}'
            % (b64('vendor', 'fonts', 'Geist-Variable.woff2'), b64('vendor', 'fonts', 'GeistMono-Variable.woff2')))


VARIANTS = {
    # сцена: (общие исходники, папка вариантов)
    'horizon': (['lab/horizon/src/rail.js', 'lab/horizon/src/hyper.js', 'lab/horizon/src/horizon.js'], 'lab/horizon/src'),
    'agents': (['lab/horizon/src/rail.js', 'lab/agents/src/views.js'], 'lab/agents/src'),
}
TITLES = {'horizon': 'horizon', 'agents': 'agents'}


def build_one(scene, n):
    common, folder = VARIANTS[scene]
    src = os.path.join(folder, 'v%d.js' % n)
    if not os.path.exists(os.path.join(ROOT, src)):
        return None
    shell = rd('lab', 'horizon', 'src', 'shell.html')
    data = json.dumps(json.loads(rd('data', 'portfolio.json')), ensure_ascii=False, separators=(',', ':'))
    scripts = []
    for p in common + [src]:
        body = rd(*p.split('/')).replace('</script', '<\\/script')
        scripts.append('<script>\n/* инлайн: %s · правится ИСТОЧНИК */\n%s\n</script>' % (p, body.rstrip()))
    panel_css = scope_tokens(rd('vendor', 'panel-v2', 'house.tokens.css')) + '\n' + \
        scope_rules(rd('vendor', 'panel-v2', 'panel.css'))
    rep = {
        '{{TITLE}}': '%s · v%d' % (TITLES[scene], n),
        '{{FONTS}}': fonts(),
        '{{PANEL_CSS}}': panel_css,
        '{{NOISE}}': 'data:image/png;base64,' + b64('vendor', 'noise', 'bluenoise-128.png'),
        '{{KIT_SCENE}}': rd('vendor', 'kit', 'kit-scene.js').rstrip(),
        '{{PANEL_JS}}': rd('vendor', 'panel-v2', 'panel.js'),
        '{{DATA}}': data,
        '{{SCRIPTS}}': '\n'.join(scripts),
    }
    out = shell
    for k, v in rep.items():
        out = out.replace(k, v)
    return out


def main():
    check = '--check' in sys.argv
    bad = 0
    for scene in VARIANTS:
        for n in (1, 2, 3):
            text = build_one(scene, n)
            if text is None:
                continue
            dst = os.path.join(LAB, scene, 'v%d.html' % n)
            if check:
                old = io.open(dst, encoding='utf-8').read() if os.path.exists(dst) else ''
                ok = old == text
                bad += 0 if ok else 1
                print('%s %s/v%d.html' % ('сходится' if ok else '🔴 разошёлся', scene, n))
            else:
                with io.open(dst, 'w', encoding='utf-8') as f:
                    f.write(text)
                print('собран lab/%s/v%d.html · %d КБ' % (scene, n, len(text.encode('utf-8')) // 1024))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
