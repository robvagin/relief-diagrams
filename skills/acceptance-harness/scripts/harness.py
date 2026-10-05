#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
harness.py — каркас приёмки артефакта. Канон: acceptance-harness.

  python3 harness.py <файл|папка> ...             полный прогон
  python3 harness.py --only single-file,panel ...  частичный прогон (МЕРЖИТ, не затирает)
  python3 harness.py --selftest                    самопроверка + ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ
  python3 harness.py --report                      отчёт из накопленного JSON, без прогона
  python3 harness.py --list                        список проб

Коды возврата:
  0  приёмка закрыта — всё зелёное и всё доказано
  1  есть красное
  2  харнесс сломан (нет артефактов, реестр не сошёлся, JSON не читается)
  3  красного нет, НО не всё доказано (пропущенные или протухшие пробы)

Внешних зависимостей нет. Playwright опционален: без него пробы браузера
честно помечаются skip, а не «зелёными». Идёт на системном python3 macOS.
"""
from __future__ import unicode_literals

import argparse
import io
import json
import os
import re
import shutil
import sys
import tempfile
import time

# ── реестр ───────────────────────────────────────────────────────────────
# Каждая проба посчитана. Проба, выпавшая из прогона, — это НЕ проба, которая
# прошла. Число меняется ВМЕСТЕ с новой пробой, а не вместо неё.
PROBE_COUNT = 13

PROBES = []
FILE, BROWSER = 'file', 'browser'


class Res(object):
    """Вердикт одной пробы: явный, с ожиданием и фактом."""
    __slots__ = ('ok', 'exp', 'act', 'skip')

    def __init__(self, ok, exp, act, skip=False):
        self.ok, self.exp, self.act, self.skip = bool(ok), exp, act, skip


def red(exp, act):
    return Res(False, exp, act)


def skipped(exp, why):
    return Res(False, exp, why, skip=True)


class Probe(object):
    __slots__ = ('pid', 'title', 'needs', 'fn', 'dirty')

    def __init__(self, pid, title, needs, fn, dirty):
        self.pid, self.title, self.needs, self.fn, self.dirty = pid, title, needs, fn, dirty


def probe(pid, title, needs=FILE, dirty=None):
    """Регистрирует пробу. dirty(text, dirpath) -> text строит ГРЯЗНЫЙ ДУБЛЬ:
    артефакт, на котором эта проба ОБЯЗАНА покраснеть."""
    def deco(fn):
        PROBES.append(Probe(pid, title, needs, fn, dirty))
        return fn
    return deco


# ── артефакт ─────────────────────────────────────────────────────────────
BASE64 = re.compile(r'(data:[^;,"\'\)\s]{0,90};base64,)[A-Za-z0-9+/=\s]{40,}')
TAGBODY = re.compile(r'<(script|style)\b[^>]*>.*?</\1>', re.I | re.S)
# 🔴 Тела script — но НЕ открывающие теги. Снести тег целиком нельзя: в нём
#    живёт `src`, и грязный дубль с внешним скриптом позеленел бы.
SCRIPTBODY = re.compile(r'(<script\b[^>]*>).*?(</script\s*>)', re.I | re.S)


class Artefact(object):
    def __init__(self, path):
        self.path = os.path.abspath(path)
        self.name = os.path.basename(self.path)
        self.stem = os.path.splitext(self.name)[0]
        self.dir = os.path.dirname(self.path)
        self._text = None

    @property
    def text(self):
        if self._text is None:
            with io.open(self.path, encoding='utf-8', errors='replace') as f:
                self._text = f.read()
        return self._text

    @property
    def body(self):
        """Текст без base64-нагрузки. Ловушка: в девяти мегабайтах вшитых кадров
        найдётся любая четырёхбуквенная строка, включая «TODO» и любой хекс."""
        return BASE64.sub(lambda m: m.group(1) + 'PAYLOAD', self.text)

    @property
    def markup(self):
        """Разметка без тел script/style — чтобы `if(a<b)` не читался как тег."""
        return TAGBODY.sub('', self.body)

    @property
    def noscript(self):
        """Текст без ТЕЛ script, теги на месте. Ловушка, ради которой это есть:
        `img.src = \"...\"`, `<img src="${u}">` в шаблонной строке, `new URL(t)`
        и `'url(' + rec.url + ')'` — это JS, а не внешняя ссылка. Греп по всему
        файлу читал их как разметку и давал ложное красное."""
        return SCRIPTBODY.sub(lambda m: m.group(1) + m.group(2), self.body)

    @property
    def url(self):
        return 'file://' + self.path

    def sibling(self, *names):
        for n in names:
            p = os.path.join(self.dir, n)
            if os.path.exists(p):
                return p
        return None

    @property
    def passport(self):
        return self.sibling(self.stem + '.паспорт.json', self.stem + '.passport.json',
                            'паспорт.json', 'passport.json')


# ── пробы файловые ───────────────────────────────────────────────────────
REF = re.compile(r'(?:src|href)\s*=\s*["\']([^"\']+)["\']', re.I)
# 🔴 `url(` без взгляда назад ловит createObjectURL( и отдаёт «внешнюю ссылку»
#    на ровном месте. Ложное срабатывание дороже пропуска: от него отучаются
#    отключать пробу целиком.
CSSURL = re.compile(r'(?<![\w.\-])url\(\s*["\']?([^"\')\n]+)', re.I)
NET = re.compile(r'\b(?:fetch|importScripts|XMLHttpRequest|new\s+Worker|@import)\b'
                 r'[^\n]{0,80}?(?:https?:)?//[A-Za-z0-9][\w.\-]*\.', re.I)


def _external(a):
    # Разметку читаем БЕЗ тел script (иначе JS-строки — «внешние ссылки»),
    # сеть — по всему телу: fetch/Worker живут именно в скрипте.
    shell = a.noscript
    out = []
    for m in list(REF.finditer(shell)) + list(CSSURL.finditer(shell)):
        u = m.group(1).strip()
        if not u or u.startswith(('data:', '#', 'javascript:', 'blob:', 'about:', 'mailto:')):
            continue
        if shell[max(0, m.start() - 4):m.start()].lower().endswith('new '):
            continue          # `new URL(x)` в обработчике — конструктор, не ссылка
        out.append(u[:48])
    out += [m.group(0)[:48] for m in NET.finditer(a.body)]
    return out


@probe('single-file', 'один файл, ноль сети',
       dirty=lambda t, d: t.replace('</head>', '<script src="https://cdn.example.com/x.js"></script></head>', 1))
def p_single_file(a):
    bad = _external(a)
    return Res(not bad, 'внешних ссылок 0',
               ('%d: %s' % (len(bad), ' · '.join(bad[:2]))) if bad else '0')


RANGE = re.compile(r'''type\s*=\s*["']?range|\.type\s*=\s*["']range["']''', re.I)
PANEL = re.compile(r'kit-panel|data-panel|class\s*=\s*["\'][^"\']*\bpanel\b', re.I)


@probe('panel', 'панель по канону',
       dirty=lambda t, d: t.replace('</body>', '<input type="range" min="0" max="1"></body>', 1))
def p_panel(a):
    n = len(RANGE.findall(a.body))
    has = bool(PANEL.search(a.body))
    return Res(n == 0 and has, 'сырых range 0 · панель есть',
               'range %d · панель %s' % (n, 'есть' if has else 'НЕТ'))


HEX = re.compile(r'#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b')
ROOTBLOCK = re.compile(r':root[^{]*\{[^}]*\}', re.S)


@probe('hardcode', 'ноль хардкода цвета',
       dirty=lambda t, d: t.replace('ctx.strokeStyle', "ctx.strokeStyle = '#ff00aa'; ctx.strokeStyle", 1))
def p_hardcode(a):
    src = ROOTBLOCK.sub('', a.body)
    hits = HEX.findall(src)
    return Res(not hits, 'хексов вне токен-блока 0',
               ('%d: %s' % (len(hits), ' '.join(hits[:3]))) if hits else '0')


RANDOM = re.compile(r'\bMath\.random\s*\(|\bDate\.now\s*\(')


@probe('no-random', 'случайности вне сида нет',
       dirty=lambda t, d: t.replace('function draw', 'function _junk(){return Math.random();}\nfunction draw', 1))
def p_no_random(a):
    hits = RANDOM.findall(a.body)
    return Res(not hits, 'Math.random / Date.now в сцене 0', '%d' % len(hits))


COUNTERS = ('__FRAMES', '__READY', '__ERROR')


@probe('liveness', 'счётчики живости заявлены',
       dirty=lambda t, d: t.replace('__FRAMES', '_frames_local'))
def p_liveness(a):
    miss = [c for c in COUNTERS if c not in a.body]
    return Res(not miss, 'три счётчика', ('нет: ' + ' '.join(miss)) if miss else 'все три')


@probe('calm', 'покой движения',
       dirty=lambda t, d: t.replace('prefers-reduced-motion', 'prefers-color-scheme'))
def p_calm(a):
    has = 'prefers-reduced-motion' in a.body
    return Res(has, 'ветка есть', 'есть' if has else 'НЕТ')


@probe('fragment', 'фрагмент ?embed=1',
       dirty=lambda t, d: t.replace('embed', 'panel_off'))
def p_fragment(a):
    has = 'embed' in a.body and re.search(r'URLSearchParams|location\.search', a.body) is not None
    return Res(has, 'embed читается из адреса', 'да' if has else 'НЕТ')


EXPORT = re.compile(r'toBlob\s*\(|toDataURL\s*\(|createObjectURL\s*\(')


@probe('export', 'экспорт кадра', dirty=lambda t, d: t.replace('toBlob', 'noop'))
def p_export(a):
    n = len(EXPORT.findall(a.body))
    return Res(n > 0, 'путь выгрузки >= 1', str(n))


PASSPORT_KEYS = ('id', 'family', 'essence', 'axes', 'size')


def _dirty_passport(t, d):
    for n in sorted(os.listdir(d)):
        if n.endswith('.json'):
            p = os.path.join(d, n)
            with io.open(p, encoding='utf-8') as f:
                data = json.load(f)
            data.pop('axes', None)
            with io.open(p, 'w', encoding='utf-8') as f:
                f.write(json.dumps(data, ensure_ascii=False))
            break
    return t


@probe('passport', 'паспорт рядом', dirty=_dirty_passport)
def p_passport(a):
    p = a.passport
    if not p:
        return red('паспорт + 5 ключей', 'файла нет')
    try:
        with io.open(p, encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        return red('паспорт + 5 ключей', 'не читается: %s' % str(e)[:30])
    miss = [k for k in PASSPORT_KEYS if k not in data]
    return Res(not miss, 'паспорт + 5 ключей', ('нет: ' + ' '.join(miss)) if miss else 'полный')


ATTR = re.compile(r'<[a-zA-Z][^>]*>')
ATTRNAME = re.compile(r'([^\s=<>"\']+)\s*=')


@probe('clean', 'чисто: кириллицы в атрибутах нет',
       dirty=lambda t, d: t.replace('<canvas', '<canvas data-имя="сцена"', 1))
def p_clean(a):
    bad = []
    for tag in ATTR.findall(a.markup):
        for nm in ATTRNAME.findall(tag):
            if re.search(r'[а-яёА-ЯЁ]', nm):
                bad.append(nm[:24])
    return Res(not bad, 'кириллических имён атрибутов 0',
               ('%d: %s' % (len(bad), ' '.join(bad[:2]))) if bad else '0')


# ── пробы браузера ───────────────────────────────────────────────────────
# 🔴 Канвас судит ТОЛЬКО настоящий браузер. jsdom не рисует: getImageData вернёт
#    прозрачный ноль, и проба живости станет вечнозелёным украшением.
_PW = {'state': None}

JS_GRAB = """
() => {
  const c = document.querySelector('canvas');
  if (!c) return null;
  const kind = c.getContext('2d') ? '2d' : 'gl';
  const w = Math.max(8, Math.min(c.width  || 240, 240));
  const h = Math.max(8, Math.min(c.height || 240, 240));
  const o = document.createElement('canvas'); o.width = w; o.height = h;
  const g = o.getContext('2d', {willReadFrequently: true});
  g.clearRect(0, 0, w, h);
  try { g.drawImage(c, 0, 0, w, h); } catch (e) { return {kind: kind, err: String(e).slice(0, 60)}; }
  const d = g.getImageData(0, 0, w, h).data;
  let opaque = 0, hash = 0x811c9dc5;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 8) opaque++;
  for (let i = 0; i < d.length; i++) { hash ^= d[i]; hash = Math.imul(hash, 0x01000193) >>> 0; }
  return {kind: kind, share: opaque / (w * h), hash: hash.toString(16), w: c.width, h: c.height};
}
"""


def _browser():
    if _PW['state'] is None:
        try:
            from playwright.sync_api import sync_playwright
            pw = sync_playwright().start()
            _PW['state'] = (pw, pw.chromium.launch())
        except Exception as e:
            _PW['state'] = ('нет Chromium/Playwright: %s' % str(e)[:40], None)
    return _PW['state']


def _close_browser():
    st = _PW['state']
    if st and st[1] is not None:
        try:
            st[1].close()
            st[0].stop()
        except Exception:
            pass
    _PW['state'] = None


def _page(a, url=None, reduced=None):
    pw, br = _browser()
    if br is None:
        return None, None, pw
    errs = []
    page = br.new_page(viewport={'width': 900, 'height': 640}, reduced_motion=reduced)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:60]))
    page.on('console', lambda m: errs.append('console.error: ' + m.text[:60]) if m.type == 'error' else None)
    page.goto(url or a.url, wait_until='load')
    return page, errs, None


@probe('canvas-alive', 'канвас жив, не blank-render', needs=BROWSER,
       dirty=lambda t, d: t.replace('<head>', '<head><script>window.requestAnimationFrame=function(){return 0};</script>', 1))
def p_canvas_alive(a):
    page, errs, why = _page(a)
    if page is None:
        return skipped('доля >= 0.004 и кадры разные', why)
    try:
        page.wait_for_timeout(700)
        one = page.evaluate(JS_GRAB)
        page.wait_for_timeout(420)
        two = page.evaluate(JS_GRAB)
    finally:
        page.close()
    if not one or not two:
        return red('доля >= 0.004 и кадры разные', 'канваса на странице нет')
    if one.get('err'):
        return red('доля >= 0.004 и кадры разные', 'снять кадр нельзя: ' + one['err'])
    # Суждение вынесено в verdict_share() — чистую функцию, которую селф-тест
    # проверяет БЕЗ браузера шестью случаями, включая 0.0 и 1.0.
    return verdict_share(one['kind'], one['share'], one['hash'] != two['hash'])


@probe('determinism', 'детерминизм по сиду', needs=BROWSER,
       dirty=lambda t, d: t.replace('</body>', '<script>addEventListener("load",()=>setTimeout(()=>{const c=document.querySelector("canvas"),g=c.getContext("2d");g.fillRect((Math.random()*c.width)|0,0,4,4);},250))</script></body>', 1))
def p_determinism(a):
    if 'seed' not in a.body:
        return skipped('два прогона сида -> один хеш', 'сид не заявлен в артефакте')
    hs = []
    for _ in (0, 1):
        page, errs, why = _page(a, url=a.url + '?seed=7')
        if page is None:
            return skipped('два прогона сида -> один хеш', why)
        try:
            page.wait_for_timeout(900)
            g = page.evaluate(JS_GRAB)
        finally:
            page.close()
        if not g or g.get('err') or not g.get('hash'):
            return red('два прогона сида -> один хеш', 'кадр не снят')
        hs.append(g['hash'])
    return Res(hs[0] == hs[1], 'один сид -> один FNV', '%s / %s' % (hs[0], hs[1]))


@probe('console', 'ноль ошибок страницы', needs=BROWSER,
       dirty=lambda t, d: t.replace('</body>', '<script>setTimeout(()=>{throw new Error("намеренная поломка")},60)</script></body>', 1))
def p_console(a):
    page, errs, why = _page(a)
    if page is None:
        return skipped('ошибок 0', why)
    try:
        page.evaluate("() => { addEventListener('unhandledrejection', e => "
                      "console.error('unhandledrejection: ' + e.reason)); }")
        page.wait_for_timeout(1400)
    finally:
        page.close()
    return Res(not errs, 'ошибок 0', ('%d: %s' % (len(errs), errs[0])) if errs else '0')


# ── обнаружение, прогон, мерж ────────────────────────────────────────────
SKIPDIRS = {'node_modules', '_backups', '__pycache__', 'frames', '_frames', '.git'}


def discover(paths):
    out = []
    for p in paths:
        p = os.path.abspath(p)
        if os.path.isfile(p):
            out.append(Artefact(p))
            continue
        for root, dirs, files in os.walk(p):
            dirs[:] = [d for d in dirs if d not in SKIPDIRS and not d.startswith('.')]
            for f in sorted(files):
                if f.endswith('.html'):
                    out.append(Artefact(os.path.join(root, f)))
    return out


def key_of(a):
    try:
        rel = os.path.relpath(a.path, os.getcwd())
        return rel if not rel.startswith('..') else a.path
    except ValueError:
        return a.path


def run(artefacts, chosen):
    rows = []
    for a in artefacts:
        for pr in chosen:
            t0 = time.time()
            try:
                r = pr.fn(a)
            except Exception as e:
                r = red('проба отработала', 'ИСКЛЮЧЕНИЕ: %s' % str(e)[:50])
            rows.append((key_of(a), a.path, pr.pid, {
                'title': pr.title, 'ok': r.ok, 'exp': r.exp, 'act': r.act,
                'skip': r.skip, 'needs': pr.needs, 'ts': int(time.time()),
                'ms': int((time.time() - t0) * 1000),
                'mtime': int(os.path.getmtime(a.path)) if os.path.exists(a.path) else 0,
            }))
    _close_browser()
    return rows


def load(path):
    if not os.path.exists(path):
        return {'harness': 'acceptance-harness', 'runs': {}}
    try:
        with io.open(path, encoding='utf-8') as f:
            data = json.load(f)
        if not isinstance(data.get('runs'), dict):
            raise ValueError('нет ключа runs')
        return data
    except Exception as e:
        sys.stderr.write('🔴 накопленный результат не читается (%s). '
                         'Он НЕ затирается — переименуй и разберись.\n' % str(e)[:60])
        sys.exit(2)


def write_atomic(path, data):
    """🔴 temp + rename в той же папке. Полузаписанный JSON после Ctrl-C — это
    потерянный прогон флота, а не «ну перезапустим»."""
    d = os.path.dirname(os.path.abspath(path)) or '.'
    if not os.path.isdir(d):
        os.makedirs(d)
    fd, tmp = tempfile.mkstemp(prefix='.harness-', suffix='.tmp', dir=d)
    try:
        with io.open(fd, 'w', encoding='utf-8') as f:
            f.write(json.dumps(data, ensure_ascii=False, indent=1, sort_keys=True))
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    except Exception:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise


def merge(data, rows):
    """🔴 Частичный прогон ДОПИСЫВАЕТ. Перезаписывается ровно та клетка
    (артефакт x проба), которая в этом прогоне действительно бежала."""
    runs = data.setdefault('runs', {})
    for key, path, pid, row in rows:
        slot = runs.setdefault(key, {'path': path, 'probes': {}})
        slot['path'] = path
        slot['probes'][pid] = row
    # выбывшее чистится: артефакта нет на диске — строка не «хранится на память»
    for key in list(runs.keys()):
        if not os.path.exists(runs[key].get('path', key)):
            del runs[key]
    live = set(p.pid for p in PROBES)
    for key in runs:
        for pid in list(runs[key]['probes'].keys()):
            if pid not in live:
                del runs[key]['probes'][pid]
    data['ts'] = int(time.time())
    return data


def state_of(row, path):
    if row.get('skip'):
        return 'skip'
    if os.path.exists(path) and int(os.path.getmtime(path)) != row.get('mtime', -1):
        return 'stale'
    return 'green' if row.get('ok') else 'RED'


# ── отчёт человеку, код возврата машине ──────────────────────────────────
W = (16, 30, 30, 40)


def report(data, title='ПРИЁМКА'):
    runs = data.get('runs', {})
    tally = {'green': 0, 'RED': 0, 'skip': 0, 'stale': 0}
    order = [p.pid for p in PROBES]
    print('\n%s · артефактов %d · реестр %d проб\n' % (title, len(runs), len(PROBES)))
    head = ('проба'.ljust(W[0]) + 'что проверяет'.ljust(W[1]) +
            'ожидание'.ljust(W[2]) + 'факт'.ljust(W[3]) + 'вердикт')
    rule = '-' * (sum(W) + 8)
    for key in sorted(runs):
        slot = runs[key]
        probes = slot.get('probes', {})
        print('· %s' % key)
        print(head)
        print(rule)
        for pid in order + [k for k in sorted(probes) if k not in order]:
            row = probes.get(pid)
            if row is None:
                print(pid.ljust(W[0]) + '-'.ljust(W[1]) + '-'.ljust(W[2]) +
                      'в этом прогоне не бежала'.ljust(W[3]) + 'skip')
                tally['skip'] += 1
                continue
            st = state_of(row, slot.get('path', key))
            tally[st] += 1
            act = 'файл менялся после прогона' if st == 'stale' else str(row.get('act', ''))
            print(pid.ljust(W[0]) + str(row.get('title', ''))[:W[1] - 1].ljust(W[1]) +
                  str(row.get('exp', ''))[:W[2] - 1].ljust(W[2]) +
                  act[:W[3] - 1].ljust(W[3]) + st)
        print(rule)
    print('итог: %d зелёных · %d красных · %d не доказано · %d протухло'
          % (tally['green'], tally['RED'], tally['skip'], tally['stale']))
    if tally['RED']:
        return 1
    if tally['skip'] or tally['stale']:
        print('🔴 красного нет, но приёмка НЕ закрыта: часть проб не доказана.')
        return 3
    print('приёмка закрыта.')
    return 0


def verdict_share(kind, share, moving):
    """Чистое суждение о доле непрозрачных пикселей — отдельно от браузера,
    чтобы ЗАКОН диапазона проверялся селф-тестом без Chromium.
    🔴 0.0 и 1.0 — не «плохо» и не «отлично», а подозрение на сломанный ЗАМЕР:
    пустой буфер и залитый прямоугольник выглядят одинаково уверенно."""
    if share <= 0.0:
        extra = ' (WebGL без preserveDrawingBuffer?)' if kind == 'gl' else ''
        return red('0.004 <= доля < 1.0', 'пусто: 0.0000' + extra)
    if share >= 0.999:
        return red('0.004 <= доля < 1.0', 'залито целиком: %.4f — меряем не сцену' % share)
    return Res(share >= 0.004 and moving, 'доля >= 0.004 · кадры разные',
               'доля %.4f · %s' % (share, 'движется' if moving else 'СТОИТ'))


# ── чистый образец и грязные дубли ───────────────────────────────────────
CLEAN = """<!doctype html><html lang="ru"><head><meta charset="utf-8">
<title>Образец сцены</title>
<style>
:root{--ink:#111111;--bg:#f2f0ec;--acc:#6a6f7a}
html,body{margin:0;background:var(--bg);color:var(--ink)}
canvas{display:block;width:100%;height:70vh}
.panel{position:fixed;right:16px;top:16px;padding:12px;background:var(--bg)}
.panel button{color:var(--acc)}
@media (prefers-reduced-motion: reduce){canvas{animation:none}}
</style></head><body>
<canvas id="c" width="480" height="320"></canvas>
<div class="panel" data-panel><button id="save">Снять кадр</button></div>
<script>
var __FRAMES = 0, __READY = false, __ERROR = null;
var params = new URLSearchParams(location.search);
var isEmbed = params.get('embed') === '1';
var seed = parseInt(params.get('seed') || '1', 10);
if (isEmbed) document.querySelector('.panel').style.display = 'none';
var cs = getComputedStyle(document.documentElement);
var INK = cs.getPropertyValue('--ink').trim();
function rnd(){ seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
var ctx = document.getElementById('c').getContext('2d');
function draw(){
  ctx.clearRect(0, 0, 480, 320);
  ctx.strokeStyle = INK;
  for (var i = 0; i < 24; i++) {
    ctx.beginPath();
    ctx.arc(240, 160, 10 + i * 5 + Math.sin(__FRAMES / 30 + i + rnd() * 0.01) * 4, 0, 6.28318);
    ctx.stroke();
  }
  __FRAMES++; __READY = true;
  requestAnimationFrame(draw);
}
draw();
document.getElementById('save').onclick = function(){
  document.getElementById('c').toBlob(function(b){ __ERROR = b ? null : 'blob'; });
};
</script></body></html>
"""

CLEAN_PASSPORT = {
    "id": "obrazec", "family": "линии", "essence": "кольца по сиду",
    "axes": [["rings", "Колец", 4, 48, 1, 24]], "size": "0.004 МБ",
}


def _sample(dirpath):
    if not os.path.isdir(dirpath):
        os.makedirs(dirpath)
    html = os.path.join(dirpath, 'sample.html')
    with io.open(html, 'w', encoding='utf-8') as f:
        f.write(CLEAN)
    with io.open(os.path.join(dirpath, 'sample.паспорт.json'), 'w', encoding='utf-8') as f:
        f.write(json.dumps(CLEAN_PASSPORT, ensure_ascii=False))
    return html


# ── селф-тест ────────────────────────────────────────────────────────────
SANITY = [
    ('2d', 0.0000, True,  False, 'пустой буфер'),
    ('gl', 0.0000, True,  False, 'WebGL без preserveDrawingBuffer'),
    ('2d', 1.0000, True,  False, 'кадр залит целиком'),
    ('2d', 0.0020, True,  False, 'ниже порога непустоты'),
    ('2d', 0.3100, False, False, 'картинка есть, но стоит'),
    ('2d', 0.3100, True,  True,  'живая сцена'),
]


def selftest():
    print('\nСЕЛФ-ТЕСТ ХАРНЕССА · чистый образец · грязные дубли · мерж · атомарность\n')
    bad, notes = [], []
    if len(PROBES) != PROBE_COUNT:
        print('🔴 реестр не сошёлся: PROBE_COUNT=%d, проб %d' % (PROBE_COUNT, len(PROBES)))
        return 2
    root = tempfile.mkdtemp(prefix='harness-selftest-')
    try:
        a = Artefact(_sample(os.path.join(root, 'clean')))
        print('%-14s%-30s%-30s%s' % ('проба', 'на чистом образце', 'на ГРЯЗНОМ дубле', 'вердикт'))
        print('-' * 90)
        for pr in PROBES:
            if pr.needs == BROWSER:
                notes.append(pr.pid)
                continue
            r = pr.fn(a)
            clean_ok = r.ok and not r.skip
            # 🔴 ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ: ломаем нарочно — проба ОБЯЗАНА упасть.
            dd = os.path.join(root, 'dirty-' + pr.pid)
            dh = _sample(dd)
            with io.open(dh, encoding='utf-8') as f:
                txt = f.read()
            txt = pr.dirty(txt, dd) if pr.dirty else txt
            with io.open(dh, 'w', encoding='utf-8') as f:
                f.write(txt)
            r2 = pr.fn(Artefact(dh))
            fell = (not r2.ok) and (not r2.skip)
            if not (clean_ok and fell):
                bad.append(pr.pid)
            print('%-14s%-30s%-30s%s' % (
                pr.pid,
                (('green · ' + str(r.act)) if clean_ok else ('🔴 НЕ ЗЕЛЁНАЯ · ' + str(r.act)))[:29],
                (('RED · ' + str(r2.act)) if fell else ('🔴 ПРОШЛА · ' + str(r2.act)))[:29],
                'ok' if (clean_ok and fell) else 'ПРОВАЛ'))
        print('-' * 90)

        # диапазон-санити замера: 0.0 и 1.0 не считаются успехом
        san_bad = [w for k, s, m, want, w in SANITY if verdict_share(k, s, m).ok != want]
        if san_bad:
            bad.append('диапазон')
        print('диапазон      %d случаев замера, 0.0 и 1.0 отбиты      %s'
              % (len(SANITY), 'ok' if not san_bad else '🔴 ПРОВАЛ: ' + ' · '.join(san_bad)))

        # закон мержа: два частичных прогона — обе половины на месте
        res = os.path.join(root, 'acceptance.json')
        a1 = Artefact(_sample(os.path.join(root, 'm1')))
        first = [p for p in PROBES if p.pid in ('single-file', 'panel')]
        second = [p for p in PROBES if p.pid in ('calm', 'export')]
        write_atomic(res, merge(load(res), run([a1], first)))
        write_atomic(res, merge(load(res), run([a1], second)))
        want = set(['single-file', 'panel', 'calm', 'export'])
        got = set(load(res)['runs'][key_of(a1)]['probes'].keys())
        if got != want:
            bad.append('мерж')
        print('мерж          два частичных прогона -> %d строк(и)      %s'
              % (len(got), 'ok' if got == want else '🔴 ПРОВАЛ: потеряно ' + ' '.join(sorted(want - got))))

        write_atomic(res, merge(load(res), run([a1], first)))
        got2 = set(load(res)['runs'][key_of(a1)]['probes'].keys())
        if got2 != want:
            bad.append('мерж-повтор')
        print('мерж-повтор   повтор пробы не унёс соседей            %s'
              % ('ok' if got2 == want else '🔴 ПРОВАЛ'))

        junk = [n for n in os.listdir(root) if n.startswith('.harness-')]
        if junk:
            bad.append('атомарность')
        print('атомарность   temp+rename, огрызков %d                 %s'
              % (len(junk), 'ok' if not junk else '🔴 ПРОВАЛ'))

        if state_of({'ok': True, 'mtime': -1}, a.path) != 'stale':
            bad.append('протухание')
        print('протухание    правка файла гасит старое зелёное       %s'
              % ('ok' if 'протухание' not in bad else '🔴 ПРОВАЛ'))
    finally:
        shutil.rmtree(root, ignore_errors=True)

    print('')
    if notes:
        print('не доказано без Chromium (%d): %s' % (len(notes), ' '.join(notes)))
        print('   поставить: pip3 install playwright && python3 -m playwright install chromium')
        print('   грязные дубли для них уже зашиты в реестре (dirty=...) и сработают,')
        print('   как только браузер появится — прогнать этот же --selftest.')
    if bad:
        print('🔴 СЕЛФ-ТЕСТ ПРОВАЛЕН: %s' % ' '.join(bad))
        return 1
    print('селф-тест пройден: %d файловых проб зелёные на чистом и КРАСНЫЕ на грязном.'
          % len([p for p in PROBES if p.needs == FILE]))
    return 0


# ── точка входа ──────────────────────────────────────────────────────────
def main(argv=None):
    ap = argparse.ArgumentParser(description='Харнесс приёмки артефакта.')
    ap.add_argument('paths', nargs='*', help='файлы или папки с артефактами')
    ap.add_argument('--only', default='', help='id проб через запятую — частичный прогон, МЕРЖИТ')
    ap.add_argument('--json', default='acceptance.json', help='файл накопленного результата')
    ap.add_argument('--selftest', action='store_true', help='самопроверка с отрицательным контролем')
    ap.add_argument('--report', action='store_true', help='только отчёт из JSON')
    ap.add_argument('--list', action='store_true', help='список проб')
    args = ap.parse_args(argv)

    if args.list:
        for p in PROBES:
            print('%-16s%-9s%s' % (p.pid, p.needs, p.title))
        return 0
    if args.selftest:
        return selftest()
    if len(PROBES) != PROBE_COUNT:
        sys.stderr.write('🔴 реестр не сошёлся: PROBE_COUNT=%d, проб %d. '
                         'Проба, выпавшая из прогона, — не проба, которая прошла.\n'
                         % (PROBE_COUNT, len(PROBES)))
        return 2
    if args.report:
        return report(load(args.json))
    if not args.paths:
        ap.print_usage()
        sys.stderr.write('🔴 артефакты не заданы.\n')
        return 2

    ids = [s.strip() for s in args.only.split(',') if s.strip()]
    known = [p.pid for p in PROBES]
    unknown = [i for i in ids if i not in known]
    if unknown:
        sys.stderr.write('🔴 нет таких проб: %s (см. --list)\n' % ' '.join(unknown))
        return 2
    chosen = [p for p in PROBES if not ids or p.pid in ids]
    artefacts = discover(args.paths)
    if not artefacts:
        sys.stderr.write('🔴 артефактов не найдено — пустой прогон это не «всё зелено».\n')
        return 2
    rows = run(artefacts, chosen)
    write_atomic(args.json, merge(load(args.json), rows))
    return report(load(args.json))


if __name__ == '__main__':
    sys.exit(main())
