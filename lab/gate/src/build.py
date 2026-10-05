#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Сборка вариантов кусков gate и glyph в самостоятельные single-file.

    python3 lab/gate/src/build.py            собрать lab/gate/v*.html и lab/glyph/v*.html
    python3 lab/gate/src/build.py --check    собрать в память и сверить с файлами (0 сходится, 1 разошлось)

Источник варианта: lab/<сцена>/src/v<N>.src.html. Внешние <script src> вклеивает vendor/kit/inline.py
(verbatim, импортом), остальное подставляет этот скрипт по меткам:
  <!--@@PANEL-V2@@-->        vendor/panel-v2/panel.js байт в байт между маркерами PANEL-V2-BODY/END
  "@@PANEL-CSS@@"            panel.css + house.tokens.css, скоуп под .pv2 (строка JSON для DG.panel.css)
  /*@@FONTS@@*/              Geist и Geist Mono, сабсет латиницы, woff2 base64
  "@@NOISE@@"                vendor/noise/bluenoise-128.png base64
  /*@@DATA:k1,k2@@*/null     выборка ключей из data/portfolio.json
Собранный файл руками не правится: правится источник.
"""
import base64, hashlib, importlib.util, io, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
SCENES = ['gate', 'glyph']

spec = importlib.util.spec_from_file_location('kit_inline', os.path.join(ROOT, 'vendor', 'kit', 'inline.py'))
kit_inline = importlib.util.module_from_spec(spec)
spec.loader.exec_module(kit_inline)

UNICODES = (list(range(0x20, 0x7F)) + list(range(0xA0, 0x100)) +
            [0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2026, 0x20AC, 0x2192, 0x2190,
             0x2264, 0x2265, 0x2212, 0x2713, 0x2715, 0x00B7, 0x2022, 0x2009, 0x202F])
_cache = {}


def read(p, mode='r'):
    with io.open(p, mode, **({} if 'b' in mode else {'encoding': 'utf-8'})) as f:
        return f.read()


def font_b64(name):
    """Сабсет латиницы с сохранением осей (variable). Детерминирован: тот же вход = те же байты."""
    if name in _cache:
        return _cache[name]
    from fontTools import subset
    from fontTools.ttLib import TTFont
    src = os.path.join(ROOT, 'vendor', 'fonts', name)
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['kern', 'liga', 'tnum', 'case', 'ss01']
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    font = TTFont(src, recalcTimestamp=False)
    sub = subset.Subsetter(options=opts)
    sub.populate(unicodes=UNICODES)
    sub.subset(font)
    if 'head' in font:
        font['head'].modified = font['head'].created   # без отметки времени сборки
    buf = io.BytesIO()
    font.flavor = 'woff2'
    font.save(buf)
    _cache[name] = base64.b64encode(buf.getvalue()).decode('ascii')
    return _cache[name]


def fonts_css():
    out = []
    for fam, f in (('Geist', 'Geist-Variable.woff2'), ('Geist Mono', 'GeistMono-Variable.woff2')):
        out.append("@font-face{font-family:'%s';src:url(data:font/woff2;base64,%s) format('woff2');"
                   "font-weight:100 900;font-style:normal;font-display:block}" % (fam, font_b64(f)))
    return '\n'.join(out)


def scope_rules(css, prefix):
    """Префикс .pv2 к каждому селектору; @media рекурсивно; :root становится самим .pv2."""
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    out, i, n = [], 0, len(css)
    while i < n:
        j = css.find('{', i)
        if j < 0:
            break
        head = css[i:j].strip()
        # стоп-скобки без пары (в выдержке они есть) пропускаем
        while head.startswith('}'):
            head = head[1:].strip()
        depth, k = 1, j + 1
        while k < n and depth:
            if css[k] == '{':
                depth += 1
            elif css[k] == '}':
                depth -= 1
            k += 1
        body = css[j + 1:k - 1]
        if head.startswith('@media'):
            out.append('%s{%s}' % (head, scope_rules(body, prefix)))
        elif head.startswith('@'):
            out.append('%s{%s}' % (head, body))
        else:
            sels = []
            for s in head.split(','):
                s = s.strip()
                if not s:
                    continue
                if s.startswith(':root'):
                    sels.append(prefix + s[len(':root'):])
                else:
                    sels.append('%s %s' % (prefix, s))
            out.append('%s{%s}' % (','.join(sels), body.strip()))
        i = k
    return '\n'.join(out)


def panel_css():
    """Токены хрома: светлые на .pv2[data-theme], тёмные на .pv2[data-theme=dark] (обе ветки
    содержат [data-theme], поэтому живут в токен-блоке по правилу гейта 3-hardcode)."""
    tok = read(os.path.join(ROOT, 'vendor', 'panel-v2', 'house.tokens.css'))
    tok = re.sub(r'/\*.*?\*/', '', tok, flags=re.S)
    light = re.search(r':root\{(.*?)\}', tok, re.S).group(1)
    dark = re.search(r':root\[data-theme="dark"\]\{(.*?)\}', tok, re.S).group(1)
    geist = ("--sans:'Geist',system-ui,sans-serif;--display:'Geist',system-ui,sans-serif;"
             "--mono:'Geist Mono',ui-monospace,monospace;")
    parts = ['.pv2[data-theme]{%s;%s}' % (light.strip().rstrip(';'), geist),
             '.pv2[data-theme="dark"]{%s}' % dark.strip()]
    parts.append(scope_rules(read(os.path.join(ROOT, 'vendor', 'panel-v2', 'panel.css')), '.pv2'))
    return '\n'.join(parts)


def data_subset(keys):
    d = json.loads(read(os.path.join(ROOT, 'data', 'portfolio.json')))
    return json.dumps({k: d[k] for k in keys}, ensure_ascii=False, separators=(',', ':'))


def build(src):
    text, missing = kit_inline.build(src)
    if missing:
        raise SystemExit('не нашлись вложения: %s' % ' '.join(missing))
    pj = read(os.path.join(ROOT, 'vendor', 'panel-v2', 'panel.js'))
    text = text.replace('<!--@@PANEL-V2@@-->',
                        '<script>\n/* инлайн verbatim: vendor/panel-v2/panel.js */\n'
                        '/*<<<PANEL-V2-BODY>>>*/' + pj.replace('</script', '<\\/script') +
                        '/*<<<PANEL-V2-END>>>*/\n</script>')
    text = text.replace('"@@PANEL-CSS@@"', json.dumps(panel_css(), ensure_ascii=False).replace('</', '<\\/'))
    if '/*@@FONTS@@*/' in text:
        text = text.replace('/*@@FONTS@@*/', fonts_css())
    if '"@@NOISE@@"' in text:
        png = base64.b64encode(read(os.path.join(ROOT, 'vendor', 'noise', 'bluenoise-128.png'), 'rb')).decode()
        text = text.replace('"@@NOISE@@"', '"data:image/png;base64,%s"' % png)
    text = re.sub(r'/\*@@DATA:([\w,]+)@@\*/null', lambda m: data_subset(m.group(1).split(',')), text)
    left = re.findall(r'@@[A-Z-]+[^@]*@@', text)
    if left:
        raise SystemExit('метки не подставлены: %s' % left[:3])
    return text


def main():
    check = '--check' in sys.argv
    bad = 0
    for sc in SCENES:
        sdir = os.path.join(ROOT, 'lab', sc, 'src')
        for f in sorted(os.listdir(sdir)) if os.path.isdir(sdir) else []:
            m = re.match(r'(v\d+)\.src\.html$', f)
            if not m:
                continue
            out = os.path.join(ROOT, 'lab', sc, m.group(1) + '.html')
            text = build(os.path.join(sdir, f))
            rel = os.path.relpath(out, ROOT)
            if check:
                old = read(out) if os.path.exists(out) else ''
                if old != text:
                    print('разошёлся с источником: %s' % rel)
                    bad = 1
                else:
                    print('сходится: %s' % rel)
            else:
                with io.open(out, 'w', encoding='utf-8') as fo:
                    fo.write(text)
                print('собран %s · %d КБ · md5 %s' % (rel, len(text.encode('utf-8')) // 1024,
                                                     hashlib.md5(text.encode('utf-8')).hexdigest()[:10]))
    return bad


if __name__ == '__main__':
    sys.exit(main())
