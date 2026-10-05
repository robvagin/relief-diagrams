#!/usr/bin/env python3
"""scrub_scan.py — детектор чужого и личного в том, что уезжает наружу.

    python3 scrub_scan.py [ПАПКА] [--map scrub-map.json] [--tol 2] [--json]
    python3 scrub_scan.py --selftest      # проба на заведомо грязном файле

Код возврата: 0 — чисто · 1 — есть находки · 2 — карта или проба сломаны.
Только стандартная библиотека: python3 из системы macOS, ставить нечего.

Цвет ищется во ВСЕХ формах записи сразу: hex, rgb()/rgba(), hsl()/hsla(),
голый триплет `0,74,78` и именованный CSS-цвет. Хекс-скан один раз уже
не увидел фирменный тил, записанный триплетом, — поэтому сравниваются не
строки, а РАСПАКОВАННЫЕ RGB с допуском (hsl округляется на ±1).
"""
from __future__ import annotations
import argparse, hashlib, json, os, re, sys, tempfile
from pathlib import Path

SKIP_DIRS = {'node_modules', '__pycache__', '.venv', 'venv', '_backups', 'archive',
             '.idea', '.vscode', '.next', 'dist-cache'}
FONT_EXT = {'.ttf', '.otf', '.woff', '.woff2', '.eot'}
BIN_EXT = FONT_EXT | {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.icns',
                      '.pdf', '.zip', '.mp4', '.mov', '.psd', '.ai', '.sketch', '.fig', '.aep'}
MAX_BYTES = 24 << 20
B64_MIN = 8 * 1024          # порог только для НЕобъявленного MIME — объявленный шрифт ловится любым

CSS_NAMED = """aliceblue f0f8ff antiquewhite faebd7 aqua 00ffff aquamarine 7fffd4 azure f0ffff
beige f5f5dc bisque ffe4c4 black 000000 blanchedalmond ffebcd blue 0000ff blueviolet 8a2be2
brown a52a2a burlywood deb887 cadetblue 5f9ea0 chartreuse 7fff00 chocolate d2691e coral ff7f50
cornflowerblue 6495ed cornsilk fff8dc crimson dc143c cyan 00ffff darkblue 00008b darkcyan 008b8b
darkgoldenrod b8860b darkgray a9a9a9 darkgreen 006400 darkgrey a9a9a9 darkkhaki bdb76b
darkmagenta 8b008b darkolivegreen 556b2f darkorange ff8c00 darkorchid 9932cc darkred 8b0000
darksalmon e9967a darkseagreen 8fbc8f darkslateblue 483d8b darkslategray 2f4f4f darkslategrey 2f4f4f
darkturquoise 00ced1 darkviolet 9400d3 deeppink ff1493 deepskyblue 00bfff dimgray 696969
dimgrey 696969 dodgerblue 1e90ff firebrick b22222 floralwhite fffaf0 forestgreen 228b22
fuchsia ff00ff gainsboro dcdcdc ghostwhite f8f8ff gold ffd700 goldenrod daa520 gray 808080
green 008000 greenyellow adff2f grey 808080 honeydew f0fff0 hotpink ff69b4 indianred cd5c5c
indigo 4b0082 ivory fffff0 khaki f0e68c lavender e6e6fa lavenderblush fff0f5 lawngreen 7cfc00
lemonchiffon fffacd lightblue add8e6 lightcoral f08080 lightcyan e0ffff lightgoldenrodyellow fafad2
lightgray d3d3d3 lightgreen 90ee90 lightgrey d3d3d3 lightpink ffb6c1 lightsalmon ffa07a
lightseagreen 20b2aa lightskyblue 87cefa lightslategray 778899 lightslategrey 778899
lightsteelblue b0c4de lightyellow ffffe0 lime 00ff00 limegreen 32cd32 linen faf0e6 magenta ff00ff
maroon 800000 mediumaquamarine 66cdaa mediumblue 0000cd mediumorchid ba55d3 mediumpurple 9370db
mediumseagreen 3cb371 mediumslateblue 7b68ee mediumspringgreen 00fa9a mediumturquoise 48d1cc
mediumvioletred c71585 midnightblue 191970 mintcream f5fffa mistyrose ffe4e1 moccasin ffe4b5
navajowhite ffdead navy 000080 oldlace fdf5e6 olive 808000 olivedrab 6b8e23 orange ffa500
orangered ff4500 orchid da70d6 palegoldenrod eee8aa palegreen 98fb98 paleturquoise afeeee
palevioletred db7093 papayawhip ffefd5 peachpuff ffdab9 peru cd853f pink ffc0cb plum dda0dd
powderblue b0e0e6 purple 800080 rebeccapurple 663399 red ff0000 rosybrown bc8f8f royalblue 4169e1
saddlebrown 8b4513 salmon fa8072 sandybrown f4a460 seagreen 2e8b57 seashell fff5ee sienna a0522d
silver c0c0c0 skyblue 87ceeb slateblue 6a5acd slategray 708090 slategrey 708090 snow fffafa
springgreen 00ff7f steelblue 4682b4 tan d2b48c teal 008080 thistle d8bfd8 tomato ff6347
turquoise 40e0d0 violet ee82ee wheat f5deb3 white ffffff whitesmoke f5f5f5 yellow ffff00
yellowgreen 9acd32""".split()
NAMED = dict(zip(CSS_NAMED[0::2], CSS_NAMED[1::2]))

RE_HEX = re.compile(r'#([0-9a-fA-F]{3,8})\b|\b([0-9a-fA-F]{6})\b')
RE_FUNC = re.compile(r'\b(rgba?|hsla?)\(([^)]{0,80})\)', re.I)
RE_TRIP = re.compile(r'(?<![\w.])(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?![\d.])')
RE_NUM = re.compile(r'-?\d*\.?\d+')
RE_WORD = re.compile(r'[0-9A-Za-zА-Яа-яЁё_-]{3,}')

# 🔴 блоб base64 — это шум: внутри него находится что угодно, включая AKIA…, TODO
# и шестизначный хекс. Правила делятся надвое: эти три работают по СЫРОЙ строке…
B64_RULES = [
    (re.compile(r'data:(?:font|application/(?:x-)?font)[\w./+-]*;\s*base64,[A-Za-z0-9+/=]{64,}', re.I), 'шрифт'),
    (re.compile(r'data:image/[\w.+-]+;\s*base64,[A-Za-z0-9+/=]{%d,}' % B64_MIN, re.I), 'base64'),
    (re.compile(r'data:application/octet-stream;\s*base64,[A-Za-z0-9+/=]{%d,}' % B64_MIN, re.I), 'base64'),
]
#: …а всё остальное — по строке, из которой блобы уже вырезаны.
RE_B64_BLOB = re.compile(r'[A-Za-z0-9+/=]{200,}')
TEXT_RULES = [
    (re.compile(r'(?:sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{12,}|AIza[0-9A-Za-z_-]{30,}'
                r'|(?:api[_-]?key|secret|token|password|authorization)\s*[:=]\s*["\'][^"\']{12,}["\'])', re.I), 'ключ'),
    (re.compile(r'(?:/Users/[A-Za-z0-9._-]+|/home/[A-Za-z0-9._-]+|C:\\Users\\[A-Za-z0-9._-]+)'), 'путь'),
    (re.compile(r'\b(?:TODO|FIXME|HACK|XXX|WIP|[A-Z]{1,4}-[A-Z]{2,5}-\d{1,4}|ЗАМЕТКА|ПОТОМ)\b'), 'пометка'),
    (re.compile(r'(?:<meta[^>]+(?:name=["\'](?:author|generator)|property=["\']og:site_name)'
                r'|<dc:creator|inkscape:|sodipodi:|Adobe\s+Illustrator|xmp:CreatorTool|/Author\s*\()', re.I), 'мета'),
]
RE_TITLE = re.compile(r'<title[^>]*>(.{0,200}?)</title>|content=["\']([^"\']{0,200})["\']', re.I | re.S)
RE_CONSOLE = re.compile(r'console\.(?:log|warn|info|debug|error)\s*\(.{0,200}', re.I)
KITCHEN_DEFAULT = ['наряд', 'вердикт', 'хендофф', 'handoff', 'аудит', 'ревизия', 'кухня',
                   'внутренн', 'черновик', 'не показывать', 'клиент']


# ─── цвет: распаковать любую форму записи в RGB ──────────────────────────────
def hex_rgb(h):
    h = h.lower()
    if len(h) in (3, 4):
        h = ''.join(c * 2 for c in h[:3])
    if len(h) < 6:
        return None
    try:
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))
    except ValueError:
        return None


def hsl_rgb(h, s, l):
    h, s, l = h % 360, max(0.0, min(1.0, s / 100.0)), max(0.0, min(1.0, l / 100.0))
    c = (1 - abs(2 * l - 1)) * s
    x = c * (1 - abs((h / 60.0) % 2 - 1))
    m = l - c / 2
    r, g, b = [(c, x, 0), (x, c, 0), (0, c, x), (0, x, c), (x, 0, c), (c, 0, x)][int(h // 60) % 6]
    return tuple(int(round((v + m) * 255)) for v in (r, g, b))


def color_literals(line, watch):
    """[(текст, rgb, форма)] — все цветовые записи строки, без двойного счёта."""
    found, spans = [], []
    for m in RE_HEX.finditer(line):
        rgb = hex_rgb(m.group(1) or m.group(2))
        if rgb:
            found.append((m.group(0), rgb, 'hex')); spans.append(m.span())
    for m in RE_FUNC.finditer(line):
        fn, nums = m.group(1).lower(), RE_NUM.findall(m.group(2))
        if len(nums) < 3:
            continue
        a, b, c = (float(x) for x in nums[:3])
        rgb = (int(a), int(b), int(c)) if fn.startswith('rgb') else hsl_rgb(a, b, c)
        if all(0 <= v <= 255 for v in rgb):
            found.append((m.group(0), rgb, fn[:3])); spans.append(m.span())
    for m in RE_TRIP.finditer(line):
        if any(s <= m.start() and m.end() <= e for s, e in spans):
            continue                                   # это внутренности rgb() — уже посчитано
        rgb = tuple(int(x) for x in m.groups())
        if all(v <= 255 for v in rgb):
            found.append((m.group(0), rgb, 'триплет'))
    for name in watch:
        for m in re.finditer(r'\b%s\b' % name, line, re.I):
            found.append((m.group(0), hex_rgb(NAMED[name]), 'имя-цвета'))
    return found


# ─── карта ──────────────────────────────────────────────────────────────────
def load_map(path):
    cfg = {'names': [], 'names_sha256': [], 'colors': [], 'fonts_deny': [],
           'kitchen': KITCHEN_DEFAULT, 'allow': []}
    if path and Path(path).exists():
        raw = json.loads(Path(path).read_text(encoding='utf-8'))
        for k in list(cfg):
            if k in raw:
                cfg[k] = raw[k]
        cfg['replace'] = raw.get('replace', {})
    targets = {}
    for c in cfg['colors']:
        rgb = hex_rgb(c['hex'].lstrip('#')) if isinstance(c, dict) else hex_rgb(str(c).lstrip('#'))
        if rgb is None:
            raise SystemExit('карта: не разобрать цвет %r' % c)
        targets[rgb] = (c.get('as', c['hex']) if isinstance(c, dict) else str(c))
    cfg['targets'] = targets
    cfg['watch'] = [n for n, hx in NAMED.items()
                    if any(max(abs(a - b) for a, b in zip(hex_rgb(hx), t)) <= 2 for t in targets)]
    cfg['name_res'] = [re.compile(r'(?<![0-9A-Za-zА-Яа-яЁё])%s' % re.escape(n), re.I) for n in cfg['names']]
    cfg['hashes'] = set(cfg['names_sha256'])
    cfg['fonts_re'] = [re.compile(r'\b%s\b' % re.escape(f), re.I) for f in cfg['fonts_deny']]
    cfg['kitchen_re'] = [re.compile(re.escape(k), re.I) for k in cfg['kitchen']]
    cfg['allow_re'] = [(re.compile(a['re']), a.get('why', '')) for a in cfg['allow']]
    return cfg


# ─── скан ───────────────────────────────────────────────────────────────────
def scan_line(line, cfg, hit):
    for pat, kind in B64_RULES:
        for m in pat.finditer(line):
            hit(m.group(0)[:70], kind)
    line = RE_B64_BLOB.sub('<base64>', line)       # 🔴 дальше — по строке без блобов
    for pat, kind in TEXT_RULES:
        for m in pat.finditer(line):
            hit(m.group(0)[:70], kind)
    for lit, rgb, form in color_literals(line, cfg['watch']):
        for t, label in cfg['targets'].items():
            if max(abs(a - b) for a, b in zip(rgb, t)) <= cfg['tol']:
                hit('%s → %s' % (lit, label), 'цвет/' + form)
                break
    for rx in cfg['name_res']:
        for m in rx.finditer(line):
            hit(m.group(0), 'имя')
    if cfg['hashes']:
        for m in RE_WORD.finditer(line):
            if hashlib.sha256(m.group(0).lower().encode()).hexdigest() in cfg['hashes']:
                hit(m.group(0), 'имя')
    for rx in cfg['fonts_re']:
        for m in rx.finditer(line):
            hit(m.group(0), 'шрифт')
    for rx in cfg['kitchen_re']:
        if rx.search(line):
            hit(line.strip()[:70], 'кухня')
            break
    m = RE_CONSOLE.search(line)
    if m and (any(r.search(m.group(0)) for r in cfg['name_res'])
              or any(r.search(m.group(0)) for r in cfg['kitchen_re'])):
        hit(m.group(0)[:70], 'консоль')
    m = RE_TITLE.search(line)
    if m and any(r.search(m.group(0)) for r in cfg['name_res']):
        hit(m.group(0)[:70], 'мета')


def scan(root, cfg):
    root, out = Path(root), []
    for dirpath, dirnames, filenames in os.walk(root):
        here = Path(dirpath)
        if '.git' in dirnames:
            out.append((str((here / '.git').relative_to(root)), 0, 'каталог истории', 'история'))
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and d != '.git']
        for fn in filenames:
            p = here / fn
            rel = str(p.relative_to(root))
            if not rel.isascii():
                out.append((rel, 0, 'путь не латиницей — zip отдаст кракозябры', 'не-латиница'))
            if fn.startswith('scrub-map') and fn.endswith('.json'):
                out.append((rel, 0, 'карта замен перечисляет запретное открытым текстом', 'карта'))
                continue                               # внутрь не лезем: там всё запретное по определению
            if p.suffix.lower() in FONT_EXT:
                out.append((rel, 0, 'файл гарнитуры ' + p.suffix, 'шрифт'))
            try:
                big = p.stat().st_size > MAX_BYTES
            except OSError:
                continue
            if p.suffix.lower() in BIN_EXT or big:
                if p.suffix.lower() in ('.pdf', '.jpg', '.jpeg', '.png'):
                    head = p.read_bytes()[:400000]
                    for mark, kind in ((b'/Author', 'мета'), (b'Exif', 'мета'), (b'xmp:CreatorTool', 'мета')):
                        if mark in head:
                            out.append((rel, 0, 'метаданные: ' + mark.decode(), kind))
                continue
            try:
                text = p.read_bytes().decode('utf-8', 'replace')
            except OSError:
                continue
            for i, line in enumerate(text.splitlines(), 1):
                scan_line(line, cfg, lambda what, kind, _r=rel, _i=i: out.append((_r, _i, what, kind)))
    kept, allowed = [], 0
    for f in out:
        key = '%s:%s:%s' % (f[0], f[1], f[2])
        if any(rx.search(key) for rx, _ in cfg['allow_re']):
            allowed += 1
        else:
            kept.append(f)
    return kept, allowed


def report(findings, allowed, as_json):
    if as_json:
        print(json.dumps([{'файл': f[0], 'строка': f[1], 'что': f[2], 'тип': f[3]} for f in findings],
                         ensure_ascii=False, indent=1))
    else:
        if findings:
            w = min(46, max(len(f[0]) for f in findings) + 1)
            print('%-*s %6s  %-46s %s' % (w, 'файл', 'строка', 'что нашли', 'тип'))
            print('─' * (w + 62))
            for f in sorted(findings, key=lambda x: (x[3], x[0], x[1])):
                what = f[2].replace('\t', ' ')
                print('%-*s %6s  %-46s %s' % (w, f[0][-w:], f[1] or '·', what[:46], f[3]))
        by = {}
        for f in findings:
            by[f[3]] = by.get(f[3], 0) + 1
        print()
        print('находок: %d — %s' % (len(findings), ', '.join('%s %d' % kv for kv in sorted(by.items())) or '—'))
        if allowed:
            print('санкционировано (учтено, в зачёт не идёт): %d' % allowed)
    return 1 if findings else 0


# ─── 🔴 проба: скан принимается, только если он поймал заведомо грязное ──────
DIRTY = '''<!doctype html><html><head>
<title>Ромашка — внутренний стенд</title>
<meta name="author" content="Ivan Ivanov">
<style>:root{--brand:#004A4E;--b2:rgb(0, 74, 78);--b3:hsl(183,100%,15%);--b4:teal}
@font-face{font-family:'Shapiro';src:url(data:font/woff2;base64,{FONT})}</style>
<img src="data:image/png;base64,{IMG}">
</head><body><script>
// W-ROB-17 — вердикт по наряду, кухня наружу не едет
var pal = [0,74,78];
var p = "/Users/robertvagin/Claude/Projects/x.html";
var key = "sk-abcdefghij0123456789abcdefghij";
console.log("Ромашка: строим", p);
</script></body></html>'''
CLEAN = '''<!doctype html><html><head><title>Neutral demo</title>
<style>:root{--paper:#f6f5f2;--ink:#1a1a1a}.a{color:rgb(24,24,24)}</style>
</head><body><script>var n=[1,2,3];var s="сцена собрана";</script></body></html>'''
EXPECT = {'base64', 'имя', 'цвет/hex', 'цвет/rgb', 'цвет/hsl', 'цвет/триплет', 'цвет/имя-цвета',
          'шрифт', 'пометка', 'путь', 'ключ', 'консоль', 'мета', 'кухня', 'история',
          'не-латиница', 'карта'}


def selftest(tol):
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / '.git').mkdir()
        (root / 'сцена.html').write_text(
            DIRTY.replace('{FONT}', 'd09GMgABAAAAAAaQ' * 8).replace('{IMG}', 'iVBORw0KGgoAAAA' * 700),
            encoding='utf-8')
        (root / 'font.woff2').write_bytes(b'wOF2' + b'\0' * 64)
        (root / 'scrub-map.json').write_text('{}', encoding='utf-8')
        raw = {'names': ['Ромашка', 'Ivan Ivanov'],
               'colors': [{'hex': '#004A4E', 'as': 'бренд'}, {'hex': '#008080', 'as': 'бренд-2'}],
               'fonts_deny': ['Shapiro']}
        mp = root / '_map.json'
        mp.write_text(json.dumps(raw, ensure_ascii=False), encoding='utf-8')
        cfg = load_map(mp); cfg['tol'] = tol
        found, _ = scan(root, cfg)
        kinds = {f[3] for f in found}
        missed = sorted(EXPECT - kinds)

        clean = root / '_clean'
        clean.mkdir()
        (clean / 'demo.html').write_text(CLEAN, encoding='utf-8')
        cfg2 = load_map(mp); cfg2['tol'] = tol
        false_hits, _ = scan(clean, cfg2)

    print('ПРОБА · грязный файл: поймано %d находок, типов %d из %d'
          % (len(found), len(kinds & EXPECT), len(EXPECT)))
    for k in sorted(kinds & EXPECT):
        print('   ✓ %s' % k)
    for k in missed:
        print('   ✗ НЕ ПОЙМАЛ: %s' % k)
    print('ПРОБА · чистый файл: находок %d (должно быть 0)' % len(false_hits))
    for f in false_hits:
        print('   ✗ ложняк: %s:%s %s [%s]' % f)
    ok = not missed and not false_hits
    print('\n%s' % ('ПРОБА ПРОЙДЕНА — детектор ловит все %d гнёзд и не врёт на чистом' % len(EXPECT)
                    if ok else 'ПРОБА ПРОВАЛЕНА — «чисто» от этого скана ничего не стоит'))
    return 0 if ok else 2


def main():
    ap = argparse.ArgumentParser(description='детектор чужого и личного перед отдачей наружу')
    ap.add_argument('root', nargs='?', default='.', help='папка, которая реально уезжает')
    ap.add_argument('--map', default=None, help='scrub-map.json (по умолчанию — рядом с папкой)')
    ap.add_argument('--tol', type=int, default=2, help='допуск на канал при сверке цвета (hsl округляет)')
    ap.add_argument('--json', action='store_true')
    ap.add_argument('--selftest', action='store_true', help='🔴 проверить детектор на грязном файле')
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.tol)
    mp = a.map or next((str(p) for p in (Path(a.root) / 'scrub-map.json', Path('scrub-map.json')) if p.exists()), None)
    cfg = load_map(mp)
    cfg['tol'] = a.tol
    if not a.json:
        print('карта: %s · цветов %d · имён %d · допуск ±%d\n'
              % (mp or 'нет (работают только безымянные детекторы)', len(cfg['targets']),
                 len(cfg['names']) + len(cfg['hashes']), a.tol))
    found, allowed = scan(a.root, cfg)
    return report(found, allowed, a.json)


if __name__ == '__main__':
    sys.exit(main())
