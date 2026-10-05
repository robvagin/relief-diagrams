#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build.py — сборка вариантов cascade и stack в single-file (кусок cloud/var-cascade-stack).

  python3 lab/cascade/src/build.py            собрать lab/cascade/v1..v3.html и lab/stack/v1..v3.html
  python3 lab/cascade/src/build.py --check    собрать в память и сверить с файлами (0 = сходится)

Основа: vendor/kit/inline.py (вклейка <script src>, verbatim). Поверх неё вставки по меткам:
  <!--@PANEL-V2@-->   vendor/panel-v2/panel.js байт в байт между маркерами PANEL-V2-BODY/END (README §7.11)
  /*@PANEL-CSS@*/     panel.css + house.tokens.css под префиксом .pv2, шрифт хрома Geist
  /*@FONTS@*/         Geist и Geist Mono (OFL) base64
  /*@DATA@*/          выборка data/portfolio.json (ключи сцены), JSON вклеен строкой
  /*@NOISE@*/         синий шум 128 px (CC0) как серые байты base64: зерно без асинхронной загрузки
  /*@FREEHAND@*/      perfect-freehand (MIT) из ESM в IIFE: слой «рука» §6.9
  /*@PARAMS@*/        ручки §6.10 и варианты: common.params.json + <сцена>.params.json (один источник с паспортом)

Рядом с каждым вариантом пишется паспорт v<N>.passport.json (схема vendor/passport.schema.json, engineHash = sha256 файла).

Собранный файл руками не правится: правится источник в lab/<сцена>/src/.
"""
import base64, hashlib, importlib.util, io, json, os, re, struct, sys, zlib

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
spec = importlib.util.spec_from_file_location('inline', os.path.join(ROOT, 'vendor', 'kit', 'inline.py'))
inline = importlib.util.module_from_spec(spec)
spec.loader.exec_module(inline)

SCENES = {
    'cascade': ['meta', 'breakdown'],
    'stack': ['meta', 'ontology', 'rules', 'covenants', 'decisions', 'agents', 'focus'],
}
VARIANTS = 3


def rd(p, mode='r'):
    with io.open(os.path.join(ROOT, p), mode, **({} if 'b' in mode else {'encoding': 'utf-8'})) as f:
        return f.read()


# ── CSS: префикс .pv2 у каждого селектора, медиа-запросы сохраняются ─────────
def scope_css(css, pre='.pv2'):
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    out, i, depth_media = [], 0, []
    tok = re.compile(r'([^{}]*)\{|\}')
    while True:
        m = tok.search(css, i)
        if not m:
            break
        if m.group(0) == '}':
            out.append('}')
            if depth_media:
                depth_media.pop()
            i = m.end()
            continue
        sel = m.group(1).strip()
        if sel.startswith('@'):
            out.append(sel + '{')
            depth_media.append(sel)
            i = m.end()
            continue
        end = css.index('}', m.end())
        body = css[m.end():end]
        sels = []
        for s in sel.split(','):
            s = s.strip()
            if not s:
                continue
            if s.startswith(':root'):
                s = pre + s[len(':root'):]
            else:
                s = pre + ' ' + s
            sels.append(s)
        if sels:
            out.append(','.join(sels) + '{' + body.strip() + '}')
        i = end + 1
    # выдержка podacha.css несёт лишнюю закрывающую скобку (обрезок медиа-блока): балансируем
    txt = '\n'.join(out)
    bal = txt.count('{') - txt.count('}')
    while bal < 0:
        k = txt.find('\n}\n')
        if k < 0:
            break
        txt = txt[:k] + txt[k + 2:]
        bal += 1
    return txt


def tokens_css():
    t = rd('vendor/panel-v2/house.tokens.css')
    # тёмная ветка по prefers-color-scheme не нужна: тему панели ведёт сцена (data-theme)
    t = re.sub(r'@media \(prefers-color-scheme:dark\)\{:root:not\(\[data-theme="light"\]\)\{(.*?)\}\}', '', t, flags=re.S)
    # светлая ветка остаётся под :root (гейт 3-hardcode читает хексы только в токен-блоках)
    t = t.replace(':root[data-theme="dark"]', ':root .pv2[data-theme="dark"]').replace(':root{', ':root .pv2{')
    # RELIEF: шрифт хрома Geist (PANEL_V2 §2)
    t += '\n.pv2{--sans:"Geist",system-ui,sans-serif;--display:"Geist",system-ui,sans-serif;--mono:"Geist Mono",ui-monospace,monospace}'
    return t


def panel_css():
    return tokens_css() + '\n' + scope_css(rd('vendor/panel-v2/panel.css'))


def fonts_css():
    out = []
    for fam, f in (('Geist', 'Geist-Variable.woff2'), ('Geist Mono', 'GeistMono-Variable.woff2')):
        b = base64.b64encode(rd('vendor/fonts/' + f, 'rb')).decode()
        out.append('@font-face{font-family:"%s";src:url(data:font/woff2;base64,%s) format("woff2");'
                   'font-weight:100 900;font-display:block}' % (fam, b))
    return '\n'.join(out)


# ── PNG → серые байты (минимальный декодер: 8 бит, RGBA, фильтры 0–4) ───────
def png_gray(path):
    b = rd(path, 'rb')
    w, h, bd, ct = struct.unpack('>IIBB', b[16:26])
    assert bd == 8 and ct in (0, 2, 4, 6), 'noise png: формат'
    ch = {0: 1, 2: 3, 4: 2, 6: 4}[ct]
    i, idat = 8, b''
    while i < len(b):
        n, typ = struct.unpack('>I4s', b[i:i + 8])
        if typ == b'IDAT':
            idat += b[i + 8:i + 8 + n]
        i += 12 + n
    raw = zlib.decompress(idat)
    stride = w * ch
    prev = bytearray(stride)
    out = bytearray()
    p = 0
    for y in range(h):
        f = raw[p]; p += 1
        line = bytearray(raw[p:p + stride]); p += stride
        for x in range(stride):
            a = line[x - ch] if x >= ch else 0
            up = prev[x]
            c = prev[x - ch] if x >= ch else 0
            if f == 1: line[x] = (line[x] + a) & 255
            elif f == 2: line[x] = (line[x] + up) & 255
            elif f == 3: line[x] = (line[x] + ((a + up) >> 1)) & 255
            elif f == 4:
                pa, pb, pc = abs(up - c), abs(a - c), abs(a + up - 2 * c)
                pr = a if (pa <= pb and pa <= pc) else (up if pb <= pc else c)
                line[x] = (line[x] + pr) & 255
        out += bytes(line[0::ch])
        prev = line
    # hex, а не base64: в base64 знаки + и / режут строку на «слова», и проверка чистоты ловит случайные совпадения
    return w, bytes(out).hex()


def freehand_iife():
    src = rd('vendor/libs/perfect-freehand.esm.js')
    src = re.sub(r'//# sourceMappingURL=.*', '', src)
    src = src.replace('export{z as default,R as getStroke,P as getStrokeOutlinePoints,L as getStrokePoints};',
                      'window.PF={getStroke:R,getStrokeOutlinePoints:P,getStrokePoints:L};')
    assert 'export' not in src, 'perfect-freehand: экспорт не переписан'
    return '(function(){' + src.strip() + '\n})();'


def params_js(scene):
    common, sp = params_of(scene)
    return 'window.RELIEF_PARAMS=' + json.dumps({'common': common, 'scene': sp}, ensure_ascii=False, separators=(',', ':')) + ';'


def data_js(scene):
    d = json.loads(rd('data/portfolio.json'))
    sub = {k: d[k] for k in SCENES[scene]}
    return 'window.RELIEF_DATA=' + json.dumps(sub, ensure_ascii=False, separators=(',', ':')) + ';'


def params_of(scene):
    common = json.loads(rd('lab/cascade/src/common.params.json'))
    sp = json.loads(rd('lab/%s/src/%s.params.json' % (scene, scene)))
    return common, sp


def obj_param(d, group):
    if isinstance(d[2], list):
        return {'id': d[0], 'label': d[1], 'type': 'select', 'options': d[2], 'default': d[3], 'group': group}
    t = 'boolean' if (d[2], d[3], d[4]) == (0, 1, 1) else 'number'
    return {'id': d[0], 'label': d[1], 'type': t, 'default': d[5], 'min': d[2], 'max': d[3], 'step': d[4], 'group': group}


def passport(scene, n, html):
    common, sp = params_of(scene)
    v = sp['variants']['v%d' % n]
    params = []
    for gr in sp['groups']:
        rows = common[gr['common']] if 'common' in gr else gr['rows']
        for d in rows:
            p = obj_param(d, gr['name'])
            if d[0] in v.get('values', {}):
                p['default'] = v['values'][d[0]]
            params.append(p)
    return {
        'id': '%s-v%d' % (scene, n), 'title': v['title'],
        'blurb': 'RELIEF lab variant. ' + v['sub'] + '. Own light §7.2–7.4 until the rail lands.',
        'version': '0.1.0', 'engineHash': hashlib.sha256(html.encode('utf-8')).hexdigest(), 'kind': 'engine',
        'contract': {
            'embed': {'params': ['embed', 'theme', 'p', 'seed', 'preset', 'mode', 'reduced'], 'aliases': ['noui', 'panel=off']},
            'postMessage': {'out': ['ready', 'frame'], 'in': ['es:progress', 'es:replay', 'pause', 'play'], 'selfplay': True},
            'api': ['Scene.set', 'Scene.get', 'Scene.export', 'KIT.scene.register', 'KIT.scene.start']},
        'params': params, 'presets': [], 'frozen': [],
        'aspect': 'auto', 'minHeight': 240,
        'hover': 'nothing',
        'click': 'click on a scrub without drag opens number input; R replay, P pause, E PNG, I theme',
        'reducedMotion': 'float and assembly removed, one final frame',
        'narrow390': 'panel becomes an open bottom sheet, the scene fits its box; no panel in embed',
        'forbidden': ['stretch unevenly', 'put on a coloured ground', 'edit the built v%d.html instead of src/' % n],
        'export': {'png': True, 'svg': False, 'pdf': False, 'zpl': False},
        'fonts': [{'family': 'Geist', 'license': 'OFL-1.1', 'embedded': 'local'},
                  {'family': 'Geist Mono', 'license': 'OFL-1.1', 'embedded': 'local'}],
        'tokensIn': [], 'brandFree': True,
        'gate': {'date': '2026-10-05', 'score': '0/10'},
    }


def build_one(scene, n):
    src = os.path.join(ROOT, 'lab', scene, 'src', 'v%d.src.html' % n)
    text, missing = inline.build(src)
    if missing:
        raise SystemExit('🔴 не нашлись вложения: %s' % ' '.join(missing))
    nw, nb = png_gray('vendor/noise/bluenoise-128.png')
    panel = rd('vendor/panel-v2/panel.js')
    rep = {
        '<!--@PANEL-V2@-->': '<script>\n/*<<<PANEL-V2-BODY>>>*/' + panel + '/*<<<PANEL-V2-END>>>*/\n</script>',
        '/*@PANEL-CSS@*/': panel_css(),
        '/*@FONTS@*/': fonts_css(),
        '/*@DATA@*/': data_js(scene),
        '/*@NOISE@*/': 'window.RELIEF_NOISE={size:%d,hex:"%s"};' % (nw, nb),
        '/*@FREEHAND@*/': freehand_iife(),
        '/*@PARAMS@*/': params_js(scene),
    }
    for k, v in rep.items():
        if k not in text:
            raise SystemExit('🔴 %s: нет метки %s' % (src, k))
        text = text.replace(k, v)
    return text


def main():
    check = '--check' in sys.argv
    bad = 0
    for scene in SCENES:
        for n in range(1, VARIANTS + 1):
            if not os.path.exists(os.path.join(ROOT, 'lab', scene, 'src', 'v%d.src.html' % n)):
                continue
            out = os.path.join(ROOT, 'lab', scene, 'v%d.html' % n)
            text = build_one(scene, n)
            rel = os.path.relpath(out, ROOT)
            pp = os.path.join(ROOT, 'lab', scene, 'v%d.passport.json' % n)
            ptxt = json.dumps(passport(scene, n, text), ensure_ascii=False, indent=2) + '\n'
            if os.path.exists(pp):
                # счёт гейта вписывает gate.py --stamp: сборка его не затирает
                try:
                    old_g = json.loads(io.open(pp, encoding='utf-8').read()).get('gate')
                    if old_g:
                        pj = json.loads(ptxt); pj['gate'] = old_g; ptxt = json.dumps(pj, ensure_ascii=False, indent=2) + '\n'
                except ValueError:
                    pass
            if check:
                old = io.open(out, encoding='utf-8').read() if os.path.exists(out) else ''
                oldp = io.open(pp, encoding='utf-8').read() if os.path.exists(pp) else ''
                if old != text or oldp != ptxt:
                    print('🔴 %s разошёлся с источником' % rel); bad = 1
                else:
                    print('%s сходится с источником' % rel)
            else:
                with io.open(out, 'w', encoding='utf-8') as f:
                    f.write(text)
                with io.open(pp, 'w', encoding='utf-8') as f:
                    f.write(ptxt)
                print('собран %s · %d КБ + паспорт' % (rel, len(text.encode('utf-8')) // 1024))
    return bad


if __name__ == '__main__':
    sys.exit(main())
