#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gate.py — единый гейт арсенала. Десять пунктов приёмки §6.9 наряда
HANDOFF_БАЗА-ПОДАЧИ-БРЕНДИНГА_2026-09-10, одна команда, отрицательный контроль.

Собран из трёх доноров, каркас взят verbatim, менялся только реестр проб:
  · _skills-hub/acceptance-harness/scripts/harness.py — каркас, мерж, коды, селф-тест
  · client-05-пилюли-орбита-2026-08-25/_tools/gate_panel.py — функциональная проба закона 1
  · data2d/src/audit.js — DOM-пробы: range в DOM, скрабы против чисел, embed, ночь, кадры

  python3 gate.py <файл|папка> ...        полный прогон
  python3 gate.py --only 3-hardcode,...   частичный прогон (МЕРЖИТ, не затирает)
  python3 gate.py --negative              🔴 отрицательный контроль: ломаем каждую пробу
  python3 gate.py --fleet                 прогон по путям из ../ИНДЕКС.md
  python3 gate.py --stamp <файл>          вписать engineHash и результат в паспорт
  python3 gate.py --report                отчёт из накопленного JSON
  python3 gate.py --list                  реестр проб

Коды возврата:
  0  приёмка закрыта — всё зелёное и всё доказано
  1  есть красное
  2  гейт сломан (нет артефактов, реестр не сошёлся, JSON не читается)
  3  красного нет, НО не всё доказано (пропущенные или протухшие пробы)

Внешних зависимостей нет. Playwright опционален: без него браузерные пробы честно
помечаются skip, а не «зелёными». Идёт на системном python3 macOS.
"""
from __future__ import unicode_literals

import argparse
import hashlib
import io
import json
import os
import re
import shutil
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.realpath(__file__))
ARSENAL = os.path.dirname(HERE)

# ── реестр ───────────────────────────────────────────────────────────────
# Каждая проба посчитана. Проба, выпавшая из прогона, — это НЕ проба, которая
# прошла. Число меняется ВМЕСТЕ с новой пробой, а не вместо неё.
PROBE_COUNT = 19

PROBES = []
FILE, BROWSER = 'file', 'browser'

# Десять пунктов приёмки. Пункт зелёный, когда зелёные ВСЕ его пробы.
POINTS = {
    1: 'один файл, ноль сети',
    2: 'панель по канону',
    3: 'ноль хардкода цвета',
    4: 'случайность только через сид',
    5: 'детерминизм по сиду',
    6: 'живость счётчиками',
    7: 'покой движения',
    8: 'фрагмент embed 320×240',
    9: 'экспорт один-в-один',
    10: 'паспорт и чистота',
}

# 🔴 Таблица алиасов. Флот сегодня зовёт одно и то же тремя именами (§0.2 наряда):
#    счётчик кадров — три имени, контракт фрагмента — три формы. Гейт знает обе
#    таблицы и не считает старое имя нарушением одну волну.
COUNTER_ALIASES = {
    'FRAMES': ['__FRAMES', '__DG_FRAMES', '__D2_FRAMES', '__ES_FRAMES', '__GD_FRAMES'],
    'READY': ['__READY', '__DG_READY', '__D2_READY', '__ES_READY', '__GD_READY'],
    'ERROR': ['__ERROR', '__DG_ERROR', '__D2_ERROR', '__ES_ERROR', '__GD_ERROR'],
}
EMBED_ALIASES = ['embed=1', 'noui=1', 'noui', 'panel=off']
CANON_EMBED = 'embed=1'


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
    __slots__ = ('pid', 'title', 'needs', 'fn', 'dirty', 'point', 'dirty_side')

    def __init__(self, pid, title, needs, fn, dirty, point, dirty_side):
        self.pid, self.title, self.needs = pid, title, needs
        self.fn, self.dirty, self.point, self.dirty_side = fn, dirty, point, dirty_side


def probe(pid, title, point, needs=FILE, dirty=None, dirty_side=False):
    """Регистрирует пробу. dirty(text, dirpath) -> text строит ГРЯЗНЫЙ ДУБЛЬ:
    артефакт, на котором эта проба ОБЯЗАНА покраснеть.
    dirty_side=True — грязь живёт РЯДОМ с артефактом (паспорт, кит), а не в его
    тексте: тогда «дубль не подействовал» не проверяется по тексту."""
    def deco(fn):
        PROBES.append(Probe(pid, title, needs, fn, dirty, point, dirty_side))
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
    def nocomment(self):
        """Текст без комментариев. Ловушка, ради которой это есть: строка
        `// Ноль input[type=range] в DOM.` читалась пробой как сырой range.
        🔴 `//` режется только с оглядкой назад, иначе гибнет `https://`."""
        # 🔴 Комментарий заменяется пробелами ТОЙ ЖЕ ДЛИНЫ (переводы строк на
        #    месте): иначе номер строки в колонке «факт» уезжает и чинить нечем.
        blank = lambda m: re.sub(r'[^\n]', ' ', m.group(0))
        t = re.sub(r'<!--.*?-->', blank, self.body, flags=re.S)
        t = re.sub(r'/\*.*?\*/', blank, t, flags=re.S)
        return re.sub(r'(?<![:\w])//[^\n]*', blank, t)

    @property
    def noscript(self):
        """Текст без ТЕЛ script, теги на месте. Ловушка, ради которой это есть:
        `img.src = "..."`, `<img src="${u}">` в шаблонной строке, `new URL(t)`
        и `'url(' + rec.url + ')'` — это JS, а не внешняя ссылка."""
        return SCRIPTBODY.sub(lambda m: m.group(1) + m.group(2), self.body)

    @property
    def url(self):
        return 'file://' + self.path

    @property
    def sha256(self):
        with io.open(self.path, 'rb') as f:
            return hashlib.sha256(f.read()).hexdigest()

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


# ══ ПУНКТ 1 · один файл, ноль сети ═══════════════════════════════════════
REF = re.compile(r'(?:src|href)\s*=\s*["\']([^"\']+)["\']', re.I)
# 🔴 `url(` без взгляда назад ловит createObjectURL( и отдаёт «внешнюю ссылку»
#    на ровном месте. Ложное срабатывание дороже пропуска.
CSSURL = re.compile(r'(?<![\w.\-])url\(\s*["\']?([^"\')\n]+)', re.I)
NET = re.compile(r'\b(?:fetch|importScripts|XMLHttpRequest|new\s+Worker|@import)\b'
                 r'[^\n]{0,80}?(?:https?:)?//[A-Za-z0-9][\w.\-]*\.', re.I)


def _external(a):
    shell = a.noscript
    out = []
    for m in list(REF.finditer(shell)) + list(CSSURL.finditer(shell)):
        u = m.group(1).strip()
        if not u or u.startswith(('data:', '#', 'javascript:', 'blob:', 'about:', 'mailto:')):
            continue
        if shell[max(0, m.start() - 4):m.start()].lower().endswith('new '):
            continue
        out.append(u[:48])
    out += [m.group(0)[:48] for m in NET.finditer(a.body)]
    return out


@probe('1-single-file', 'внешних ссылок и сети нет', point=1,
       dirty=lambda t, d: t.replace('</head>', '<script src="https://cdn.example.com/x.js"></script></head>', 1))
def p1_single_file(a):
    bad = _external(a)
    return Res(not bad, 'внешних ссылок 0',
               ('%d: %s' % (len(bad), ' · '.join(bad[:2]))) if bad else '0')


CSPMETA = re.compile(r'<meta[^>]+http-equiv\s*=\s*["\']Content-Security-Policy["\'][^>]*>', re.I)


@probe('1-lock', 'CSP-замок объявлен и держит', point=1, needs=BROWSER,
       dirty=lambda t, d: CSPMETA.sub('', t, 1))
def p1_lock(a):
    """Замок §6.9: мета CSP объявлена И живой fetch наружу обязан упасть.
    Одной декларации мало — она проверяется исполнением."""
    has = bool(CSPMETA.search(a.markup))
    if not has:
        return red('CSP-мета + fetch наружу падает', 'меты Content-Security-Policy нет')
    page, errs, why = _page(a)
    if page is None:
        return skipped('CSP-мета + fetch наружу падает', why)
    try:
        got = page.evaluate("""async () => {
          try { await fetch('https://example.com/probe.json', {mode:'no-cors'}); return 'ПРОШЁЛ'; }
          catch (e) { return 'упал'; }
        }""")
    finally:
        page.close()
    return Res(got == 'упал', 'CSP-мета + fetch наружу падает', 'мета есть · fetch ' + got)


# ══ ПРОФИЛЬ ПАНЕЛИ v2 (RELIEF Ф0.4, README §7.11) ═══════════════════════
# Артефакт с панелью v2 несёт вендорный panel.js verbatim между маркерами. Пробы пункта 2
# узнают профиль по маркерам; грязные дубли бьют то место, которое есть в этом профиле.
V2_BEG = '/*<<<PANEL-V2-BODY>>>*/'
V2_END = '/*<<<PANEL-V2-END>>>*/'
V2_SRC = os.path.join(ARSENAL, 'panel-v2', 'panel.js')


def is_v2(text):
    return V2_BEG in text and V2_END in text


def _v2_body(text):
    i, j = text.find(V2_BEG), text.find(V2_END)
    if i < 0 or j < 0 or j < i:
        return None
    return text[i + len(V2_BEG):j]


def _either(t, pairs, fallback=None):
    """Грязный дубль под оба профиля: первая подействовавшая замена, иначе вставка-фолбэк."""
    for a, b in pairs:
        if a in t:
            return t.replace(a, b, 1)
    return fallback(t) if fallback else t


# ══ ПУНКТ 2 · панель ═════════════════════════════════════════════════════
RANGE = re.compile(r'''type\s*=\s*["']?range|\.type\s*=\s*["']range["']''', re.I)
PANELMARK = re.compile(r'kit-panel|dg-panel|d2-panel|data-panel|class\s*=\s*["\'][^"\']*\bpanel\b', re.I)


@probe('2-panel', 'сырых range нет, панель заявлена', point=2,
       dirty=lambda t, d: t.replace('</body>', '<input type="range" min="0" max="1"></body>', 1))
def p2_panel(a):
    n = len(RANGE.findall(a.nocomment))
    has = bool(PANELMARK.search(a.body))
    return Res(n == 0 and has, 'сырых range 0 · панель есть',
               'range %d · панель %s' % (n, 'есть' if has else 'НЕТ'))


JS_PANEL = """
() => {
  // Инвариант канона в терминах ЛЮБОГО префикса (§6.1): у скраба есть число и поле ввода.
  // Инвариант, написанный под .scrub/.sval одного файла, не видит ни одного скраба кита.
  const scrubs = [...document.querySelectorAll('[class*=scrub]')]
        .filter(e => !/-(val|edit|fill)$/.test(e.className.split(/\\s+/).pop() || ''));
  const bad = [];
  for (const s of scrubs) {
    const hasVal = !!s.querySelector('[class*="-val"], input.sval');
    const hasEdit = !!s.querySelector('[class*="-edit"], input');
    if (!hasVal || !hasEdit) bad.push((s.getAttribute('aria-label') || s.className).slice(0, 24));
  }
  const orphan = document.querySelectorAll('input[type=range]').length;
  let spin = '', tnum = '';
  const ed = document.querySelector('[class*=scrub] input, [class*="-edit"]');
  if (ed) spin = getComputedStyle(ed).appearance + '|' + (getComputedStyle(ed).MozAppearance || '');
  const val = document.querySelector('[class*="-val"], .scrub input.sval');
  if (val) tnum = getComputedStyle(val).fontVariantNumeric;
  return {n: scrubs.length, bad, orphan, spin, tnum};
}
"""

JS_SCRUB_LIST = """
() => [...document.querySelectorAll('[class*=scrub]')]
  .filter(e => e.hasAttribute('aria-valuemax'))
  .map((e, i) => ({i, label: e.getAttribute('aria-label') || ('#' + i),
                   max: parseFloat(e.getAttribute('aria-valuemax'))}))
"""


@probe('2-panel-live', 'скраб несёт число и поле, orphan range 0', point=2, needs=BROWSER,
       dirty=lambda t, d: t.replace('</body>', '<div class="dg-scrub"></div></body>', 1))
def p2_panel_live(a):
    page, errs, why = _page(a)
    if page is None:
        return skipped('у каждого скраба число и ввод · range 0', why)
    try:
        page.wait_for_timeout(900)
        st = page.evaluate(JS_PANEL)
    finally:
        page.close()
    if st['n'] == 0 and st['orphan'] == 0:
        return red('у каждого скраба число и ввод · range 0',
                   'числовых контролов не найдено вовсе')
    problems = []
    if st['bad']:
        problems.append('без числа: %d (%s)' % (len(st['bad']), ' '.join(st['bad'][:2])))
    if st['orphan']:
        problems.append('orphan range %d' % st['orphan'])
    if st['spin'] and 'textfield' not in st['spin'] and 'none' not in st['spin']:
        problems.append('спиннеры видны (%s)' % st['spin'][:18])
    if st['tnum'] and 'tabular-nums' not in st['tnum']:
        problems.append('нет tabular-nums')
    return Res(not problems, 'у каждого скраба число и ввод · range 0 · охват %d' % st['n'],
               ' · '.join(problems) if problems else 'скрабов %d, все с числом' % st['n'])


@probe('2-extend', 'ввод за max доезжает до движка', point=2, needs=BROWSER,
       dirty=lambda t, d: _either(t, [
           ('extendParamRange(p, v); // ввод за диапазон НЕ клампится — расширяем границы',
            'v = clamp(v, p.min, p.max);'),
           ('extendParamRange(p, v); set(v); paint();', 'v = clamp(v, p.min, p.max); set(v); paint();')]))
def p2_extend(a):
    """Функциональная проба закона 1 канона панели. Донор: gate_panel.py, снята
    привязка к n == 9 и к window.obOrbit. «Доехало до движка» доказывается тем,
    что КАДР изменился, а не тем, что панель показывает новое число."""
    page, errs, why = _page(a)
    if page is None:
        return skipped('значение за max доезжает, диапазон расширился', why)
    try:
        page.wait_for_timeout(900)
        rows = page.evaluate(JS_SCRUB_LIST)
        if not rows:
            n = page.evaluate("() => document.querySelectorAll('[class*=scrub]').length")
            return red('значение за max доезжает, диапазон расширился',
                       'скрабов %d, ни у одного нет aria-valuemax — ручку нечем адресовать' % n)
        tested, moved, clamped = 0, 0, []
        for r in rows[:6]:
            target = round(r['max'] * 1.5, 4)
            before = page.evaluate(JS_GRAB)
            page.evaluate("""(i) => {
              const s = [...document.querySelectorAll('[class*=scrub]')]
                        .filter(e => e.hasAttribute('aria-valuemax'))[i];
              s.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, clientX:0, pointerId:1}));
              s.dispatchEvent(new PointerEvent('pointerup',   {bubbles:true, clientX:0, pointerId:1}));
            }""", r['i'])
            page.wait_for_timeout(120)
            page.keyboard.type(str(target))
            page.keyboard.press('Enter')
            page.wait_for_timeout(320)
            after = page.evaluate(JS_GRAB)
            vmax = page.evaluate("""(i) => {
              const s = [...document.querySelectorAll('[class*=scrub]')]
                        .filter(e => e.hasAttribute('aria-valuemax'))[i];
              return parseFloat(s.getAttribute('aria-valuemax'));
            }""", r['i'])
            tested += 1
            if vmax is None or vmax < target - 1e-6:
                clamped.append('%s max=%s' % (r['label'], vmax))
            if before and after and before.get('hash') != after.get('hash'):
                moved += 1
        if clamped:
            return red('диапазон расширяется, не клампит',
                       'клампнуло: %d из %d (%s)' % (len(clamped), tested, clamped[0]))
        return Res(moved > 0, 'значение за max доезжает до движка · охват %d' % tested,
                   'кадр изменился у %d из %d ручек' % (moved, tested))
    finally:
        page.close()


KIT_BEG = '/*<<<KIT-PANEL-BODY>>>*/'
KIT_END = '/*<<<KIT-PANEL-END>>>*/'
KIT_HEAD = re.compile(r'/\* KIT-PANEL v([\d.]+) md5:([0-9a-f]{64}) \*/')


def _kit_body(text):
    i, j = text.find(KIT_BEG), text.find(KIT_END)
    if i < 0 or j < 0 or j < i:
        return None
    return text[i + len(KIT_BEG):j]


@probe('2-kit', 'кит панели тот же самый', point=2,
       dirty=lambda t, d: _either(t, [
           ('function buildScrub(path, min, max, step', 'function buildScrubLocal(path, min, max, step'),
           ('function fmt(v, step) { return (+v).toFixed(decimals(step)); }',
            'function fmt(v, step) { return (+v).toFixed(decimals(step) + 1); }')]))
def p2_kit(a):
    """Профиль v2: тело между /*<<<PANEL-V2-BODY>>>*/ и /*<<<PANEL-V2-END>>>*/ побайтно
    равно vendor/panel-v2/panel.js (md5). Иначе — прежняя сверка kit-panel.js.
    """
    if is_v2(a.text):
        if not os.path.exists(V2_SRC):
            return red('панель v2 совпадает с вендором', 'нет %s' % V2_SRC)
        with io.open(V2_SRC, encoding='utf-8') as f:
            src = f.read()
        mine = _v2_body(a.text)
        ds, dm = hashlib.md5(src.encode('utf-8')).hexdigest(), hashlib.md5(mine.encode('utf-8')).hexdigest()
        return Res(ds == dm, 'md5 тела панели v2 = md5 vendor/panel-v2/panel.js',
                   ('сошёлся %s…' % dm[:12]) if ds == dm else ('разошёлся: %s… против %s…' % (dm[:12], ds[:12])))
    return _p2_kit_v1(a)


def _p2_kit_v1(a):
    """Единственный источник панели — _arsenal/kit/kit-panel.js. Копия здорова,
    пока она побайтно та же (закон 2). Сравнивается ТЕЛО между маркерами: так
    отпечаток проверяется и внутри собранного single-file, куда кит вклеен инлайном."""
    kit = os.path.join(ARSENAL, 'kit', 'kit-panel.js')
    if not os.path.exists(kit):
        return skipped('инлайн кита совпадает с _arsenal/kit/kit-panel.js',
                       'кит не собран (Ф1a наряда)')
    with io.open(kit, encoding='utf-8') as f:
        src = f.read()
    src_body = _kit_body(src)
    if src_body is None:
        return red('кит несёт маркеры тела', 'в источнике кита маркеров нет')
    src_d = hashlib.sha256(src_body.encode('utf-8')).hexdigest()
    m = KIT_HEAD.search(src)
    if not m or m.group(2) != src_d:
        return red('шапка кита сходится с его телом',
                   'источник не заштампован: python3 kit/stamp_kit.py')
    mine = _kit_body(a.text)
    if mine is None:
        return red('инлайн кита совпадает с китом',
                   'кита в артефакте нет — панель своя, а не единственная')
    d = hashlib.sha256(mine.encode('utf-8')).hexdigest()
    return Res(d == src_d, 'отпечаток инлайна = отпечаток кита v%s' % m.group(1),
               ('сошёлся %s…' % d[:12]) if d == src_d
               else ('разошёлся: %s… против %s…' % (d[:12], src_d[:12])))


# ══ ПУНКТ 3 · хардкод цвета ══════════════════════════════════════════════
HEX = re.compile(r'#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b')
TOKENBLOCK = re.compile(r'(?::root|\.dg-panel|\[data-theme[^\]]*\]|\.is-night)[^{]{0,80}\{[^}]*\}', re.S)


@probe('3-hardcode', 'хексы только в токен-блоке', point=3,
       dirty=lambda t, d: _either(t, [('g.lineWidth = 1;', "g.strokeStyle = '#ff00aa'; g.lineWidth = 1;")],
                                  lambda x: x.replace('</body>', "<script>var _hard = '#ff00aa';</script></body>", 1)))
def p3_hardcode(a):
    src = TOKENBLOCK.sub('', a.body)
    hits = HEX.findall(src)
    return Res(not hits, 'хексов вне :root{} и .dg-panel{} 0',
               ('%d: %s' % (len(hits), ' '.join(hits[:3]))) if hits else '0')


# ══ ПУНКТ 4 · случайность через сид ══════════════════════════════════════
RANDOM = re.compile(r'\bMath\.random\s*\(|\bDate\.now\s*\(')


@probe('4-seed', 'Math.random и Date.now в сцене нет', point=4,
       dirty=lambda t, d: t.replace('function loop', 'function _junk(){return Math.random();}\nfunction loop', 1))
def p4_seed(a):
    src = a.nocomment
    hits = [m.group(0) for m in RANDOM.finditer(src)]
    has_seed = 'seed' in a.body.lower()
    if hits:
        lines = []
        for m in RANDOM.finditer(src):
            lines.append(str(src.count('\n', 0, m.start()) + 1))
            if len(lines) >= 3:
                break
        return red('Math.random/Date.now 0 · сид заявлен',
                   '%d, строки %s' % (len(hits), ','.join(lines)))
    return Res(has_seed, 'Math.random/Date.now 0 · сид заявлен',
               '0 · сид %s' % ('есть' if has_seed else 'НЕ ЗАЯВЛЕН'))


# ══ браузер: общее ═══════════════════════════════════════════════════════
_PW = {'state': None}

GRAB_FN = """() => {
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
  // 🔴 Доля НЕПРОЗРАЧНЫХ пикселей врёт на любой сцене с залитым фоном: она даёт
  //    1.0 и читается как «меряем не сцену». Фон определяется как самый частый
  //    цвет, чернила — то, что от него отличается (донор: data2d/src/audit.js).
  const counts = new Map();
  for (let i = 0; i < d.length; i += 4 * 37) {
    const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  let bg = 0, best = -1;
  for (const [k, n] of counts) if (n > best) { best = n; bg = k; }
  const br = (bg >> 16) & 255, bgg = (bg >> 8) & 255, bb = bg & 255;
  let ink = 0, hash = 0x811c9dc5;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 8) continue;                       // прозрачное — это фон
    if (Math.abs(d[i] - br) + Math.abs(d[i+1] - bgg) + Math.abs(d[i+2] - bb) > 24) ink++;
  }
  for (let i = 0; i < d.length; i++) { hash ^= d[i]; hash = Math.imul(hash, 0x01000193) >>> 0; }
  return {kind: kind, share: ink / (w * h), hash: hash.toString(16), w: c.width, h: c.height};
}"""

JS_GRAB = GRAB_FN

# 🔴 Захват, синхронный по НОМЕРУ КАДРА. Опрос счётчика с паузой и отдельный
#    вызов замера ловят разные кадры: между опросом и снимком проходит ещё
#    несколько кадров, и «тот же сид» честно даёт разные отпечатки.
JS_GRAB_AT = """
async (args) => {
  const names = args[0], n = args[1], grab = %s;
  const get = () => { for (const k of names) if (typeof window[k] !== 'undefined') return window[k]; return null; };
  if (get() === null) return {err: 'счётчика кадров нет'};
  const t0 = Date.now();
  while ((get() || 0) < n) {
    if (Date.now() - t0 > 6000) return {err: 'за 6 с не набралось ' + n + ' кадров'};
    await new Promise(r => requestAnimationFrame(r));
  }
  const g = grab();
  if (g) g.at = get();
  return g;
}
""" % GRAB_FN.strip()

JS_COUNTERS = """
(alias) => {
  const pick = names => { for (const n of names) if (typeof window[n] !== 'undefined') return [n, window[n]];
                          return [null, undefined]; };
  const f = pick(alias.FRAMES), r = pick(alias.READY), e = pick(alias.ERROR);
  return {framesName: f[0], frames: f[1], readyName: r[0], ready: r[1],
          errorName: e[0], error: e[1] === undefined ? null : e[1],
          scrollW: document.documentElement.scrollWidth,
          panelVisible: (() => {
            const p = document.querySelector('[class*=panel], #panel, #tweak');
            if (!p) return false;
            const st = getComputedStyle(p);
            return st.display !== 'none' && st.visibility !== 'hidden' && p.offsetWidth > 0;
          })()};
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


def _page(a, query='', reduced=None, viewport=None):
    pw, br = _browser()
    if br is None:
        return None, None, pw
    errs = []
    page = br.new_page(viewport=viewport or {'width': 900, 'height': 640}, reduced_motion=reduced)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:60]))
    page.on('console', lambda m: errs.append('console.error: ' + m.text[:60]) if m.type == 'error' else None)
    page.goto(a.url + query, wait_until='load')
    return page, errs, None


def _counters(page):
    return page.evaluate(JS_COUNTERS, COUNTER_ALIASES)


def verdict_share(kind, share, moving):
    """Чистое суждение о доле ЧЕРНИЛ (пикселей, отличных от фона) — отдельно от
    браузера,
    чтобы ЗАКОН диапазона проверялся селф-тестом без Chromium.
    🔴 0.0 и 1.0 — не «плохо» и не «отлично», а подозрение на сломанный ЗАМЕР."""
    if share <= 0.0:
        extra = ' (WebGL без preserveDrawingBuffer?)' if kind == 'gl' else ''
        return red('0.004 <= чернил < 1.0', 'пусто: 0.0000' + extra)
    if share >= 0.999:
        return red('0.004 <= чернил < 1.0', 'всё отличается от фона: %.4f — меряем не сцену' % share)
    return Res(share >= 0.004 and moving, 'чернил >= 0.004 · кадры разные',
               'чернил %.4f · %s' % (share, 'движется' if moving else 'СТОИТ'))


# ══ ПУНКТ 5 · детерминизм ════════════════════════════════════════════════
def _hash_at_frame(a, seed, n=45):
    """Отпечаток на N-м кадре, снятый В ТОТ ЖЕ кадр (JS_GRAB_AT)."""
    page, errs, why = _page(a, query='?seed=' + str(seed))
    if page is None:
        return None, why
    try:
        g = page.evaluate(JS_GRAB_AT, [COUNTER_ALIASES['FRAMES'], n])
    finally:
        page.close()
    if not g or g.get('err') or not g.get('hash'):
        return None, (g or {}).get('err', 'кадр не снят')
    return g['hash'], None


@probe('5-determinism', 'один сид — один отпечаток', point=5, needs=BROWSER,
       dirty=lambda t, d: t.replace(
           "const make = () => sfc32.apply(null, cyrb128(SEED + '/' + layer));",
           'const make = () => (() => (performance.now() % 997) / 997);', 1))
def p5_determinism(a):
    """Две половины в одной пробе. Совпадение отпечатков на одном сиде ничего не
    значит, пока не доказано, что сид ВООБЩЕ влияет на кадр: неизменная картинка
    совпадает сама с собой (грабли D2 со «стабильной толщиной линии»)."""
    if 'seed' not in a.body.lower():
        return skipped('сид ×2 -> один хеш, другой сид -> другой', 'сид не заявлен в артефакте')
    h1, why = _hash_at_frame(a, 7)
    if h1 is None:
        return skipped('сид ×2 -> один хеш, другой сид -> другой', why) if 'нет' in (why or '') \
            else red('сид ×2 -> один хеш, другой сид -> другой', why)
    h2, why = _hash_at_frame(a, 7)
    if h2 is None:
        return red('сид ×2 -> один хеш, другой сид -> другой', why)
    if h1 != h2:
        return red('сид ×2 -> один хеш (на равном числе кадров)', '%s / %s' % (h1, h2))
    h3, why = _hash_at_frame(a, 424242)
    if h3 is None:
        return red('другой сид -> другой хеш', why)
    if h3 == h1:
        return red('другой сид -> другой хеш', 'сид не влияет на кадр: отпечаток тот же')
    return Res(True, 'сид ×2 -> один хеш · другой сид -> другой',
               '%s ×2 · чужой сид %s' % (h1, h3))


# ══ ПУНКТ 6 · живость ════════════════════════════════════════════════════
@probe('6-liveness-decl', 'счётчики живости заявлены', point=6,
       dirty=lambda t, d: t.replace('__FRAMES', '_frames_local'))
def p6_liveness_decl(a):
    miss = []
    for role, names in sorted(COUNTER_ALIASES.items()):
        if not any(n in a.body for n in names):
            miss.append(role)
    return Res(not miss, 'три счётчика (с учётом алиасов)',
               ('нет: ' + ' '.join(miss)) if miss else 'все три')


@probe('6-liveness', 'кадры растут, ошибок нет, холст не пуст', point=6, needs=BROWSER,
       dirty=lambda t, d: t.replace('<head>', '<head><script>window.requestAnimationFrame=function(){return 0};</script>', 1))
def p6_liveness(a):
    page, errs, why = _page(a)
    if page is None:
        return skipped('кадры растут · __ERROR пуст · холст жив', why)
    try:
        page.wait_for_timeout(800)
        c1 = _counters(page)
        one = page.evaluate(JS_GRAB)
        page.wait_for_timeout(520)
        c2 = _counters(page)
        two = page.evaluate(JS_GRAB)
    finally:
        page.close()
    if c1['framesName'] is None:
        return red('кадры растут · __ERROR пуст · холст жив', 'счётчика кадров в окне нет')
    grew = (c2['frames'] or 0) > (c1['frames'] or 0)
    if c2['error']:
        return red('кадры растут · __ERROR пуст · холст жив',
                   '%s: %s' % (c2['errorName'], str(c2['error'])[:40]))
    if errs:
        return red('кадры растут · __ERROR пуст · холст жив', errs[0])
    if not one or not two:
        return red('кадры растут · __ERROR пуст · холст жив', 'канваса на странице нет')
    if one.get('err'):
        return red('кадры растут · __ERROR пуст · холст жив', 'снять кадр нельзя: ' + one['err'])
    v = verdict_share(one['kind'], one['share'], one['hash'] != two['hash'])
    if not v.ok:
        return v
    return Res(grew, 'кадры растут · __ERROR пуст · холст жив',
               '%s %s->%s · %s' % (c1['framesName'], c1['frames'], c2['frames'], v.act))


# ══ ПУНКТ 7 · покой ══════════════════════════════════════════════════════
@probe('7-calm-decl', 'ветка покоя объявлена', point=7,
       dirty=lambda t, d: t.replace('prefers-reduced-motion', 'prefers-color-scheme'))
def p7_calm_decl(a):
    has = 'prefers-reduced-motion' in a.body
    return Res(has, 'prefers-reduced-motion в файле', 'есть' if has else 'НЕТ')


@probe('7-calm', 'при покое ход снят, кадр на месте', point=7, needs=BROWSER,
       dirty=lambda t, d: t.replace(
           'if (REDUCED) { frame(true); }          // покой: один кадр, хода нет',
           'if (false) { frame(true); }', 1))
def p7_calm(a):
    page, errs, why = _page(a, reduced='reduce')
    if page is None:
        return skipped('кадры не растут · холст не пуст', why)
    try:
        page.wait_for_timeout(800)
        c1 = _counters(page)
        g = page.evaluate(JS_GRAB)
        page.wait_for_timeout(700)
        c2 = _counters(page)
    finally:
        page.close()
    if c1['framesName'] is None:
        return red('кадры не растут · холст не пуст', 'счётчика кадров нет')
    delta = (c2['frames'] or 0) - (c1['frames'] or 0)
    if not g or g.get('err'):
        return red('кадры не растут · холст не пуст', 'кадр не снят')
    if g['share'] < 0.004:
        return red('кадры не растут · холст не пуст', 'при покое холст пуст: %.4f' % g['share'])
    return Res(delta == 0, 'кадры не растут · холст не пуст',
               'прирост кадров %d · доля %.4f' % (delta, g['share']))


# ══ ПУНКТ 8 · фрагмент ═══════════════════════════════════════════════════
# Ключ читается двумя формами: через URLSearchParams (`get('embed')`) и через
# собственный парсер адреса (`q.embed`, как в data2d). Узкая форма давала ложное
# красное на движке, который функциональной пробой embed проходит.
# 🔴 Литерал 'embed' есть в любом файле с классом is-embed и в __CONTEXT.
#    Считается только ЧТЕНИЕ ключа: get/has('embed') либо свойство q.embed
#    собственного парсера адреса (форма data2d). Иначе проба зелена всегда.
EMBEDKEY = re.compile(r'''(?:get|has)\s*\(\s*["'](embed|noui|panel)["']|[A-Za-z_$][\w$.]*\.(embed|noui)\b''')


@probe('8-embed-decl', 'контракт фрагмента читается из адреса', point=8,
       dirty=lambda t, d: t.replace(
           "const EMBED = Q.get('embed') === '1' || Q.has('noui') || Q.get('panel') === 'off';",
           'const EMBED = false;', 1))
def p8_embed_decl(a):
    # 🔴 Подстрока «embed» есть в любом файле, где встречается класс is-embed.
    #    Проверяется ЧТЕНИЕ КЛЮЧА из адреса, иначе проба зелена всегда.
    reads = re.search(r'URLSearchParams|location\.search', a.body) is not None
    keys = sorted(set(x for m in EMBEDKEY.findall(a.nocomment) for x in m if x))
    return Res(reads and bool(keys), 'ключ embed (или алиас) читается из адреса',
               ('%s · ключи: %s' % ('читает' if reads else 'НЕ читает', ','.join(keys) or 'нет')))


@probe('8-embed', 'embed 320×240 не разваливается', point=8, needs=BROWSER,
       dirty=lambda t, d: t.replace('html.is-embed #panel{display:none}',
                                    'html.is-embed #panel{display:block}', 1)
                           .replace('if (mount && !EMBED && window.DG && DG.panel) {',
                                    'if (mount && window.DG && DG.panel) {', 1))
def p8_embed(a):
    page, errs, why = _page(a, query='?' + CANON_EMBED,
                            viewport={'width': 320, 'height': 240})
    if page is None:
        return skipped('панель скрыта · холст жив · нет горизонтали', why)
    try:
        page.wait_for_timeout(900)
        c = _counters(page)
        g = page.evaluate(JS_GRAB)
    finally:
        page.close()
    problems = []
    if c['panelVisible']:
        problems.append('панель видна')
    if c['scrollW'] > 321:
        problems.append('горизонтальная прокрутка %d px' % c['scrollW'])
    if not g or g.get('err'):
        problems.append('кадр не снят')
    elif g['share'] < 0.004:
        problems.append('холст пуст: %.4f' % g['share'])
    return Res(not problems, 'панель скрыта · холст жив · ширина <= 320',
               ' · '.join(problems) if problems else 'чисто, доля %.4f' % (g['share'] if g else 0))


# ══ ПУНКТ 9 · экспорт ════════════════════════════════════════════════════
JS_EXPORT = """
async () => {
  const c = document.querySelector('canvas');
  if (!c) return {err: 'канваса нет'};
  const w = c.width, h = c.height;
  // 🔴 Оба чтения в ОДНОЙ задаче: между ними rAF не бежит, кадр один и тот же.
  const o1 = document.createElement('canvas'); o1.width = w; o1.height = h;
  const g1 = o1.getContext('2d', {willReadFrequently: true});
  try { g1.drawImage(c, 0, 0); } catch (e) { return {err: String(e).slice(0, 50)}; }
  const live = g1.getImageData(0, 0, w, h).data;
  // 🔴 Зовём ЭКСПОРТ АРТЕФАКТА, а не toDataURL браузера: иначе проба меряет
  //    Chromium и остаётся зелёной при любом сломанном экспорте модуля.
  const fn = (window.Scene && window.Scene.export) || window.__EXPORT;
  if (typeof fn !== 'function') return {err: 'нет Scene.export(kind) — контракт §6.2'};
  let url;
  try { url = await fn('png'); } catch (e) { return {err: 'Scene.export: ' + String(e).slice(0, 40)}; }
  if (typeof url !== 'string' || url.indexOf('data:image/') !== 0)
    return {err: 'Scene.export вернул не data:image/…'};
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('png не декодировался')); img.src = url; });
  const o2 = document.createElement('canvas'); o2.width = w; o2.height = h;
  const g2 = o2.getContext('2d', {willReadFrequently: true});
  g2.drawImage(img, 0, 0);
  const shot = g2.getImageData(0, 0, w, h).data;
  let diff = 0;
  for (let i = 0; i < live.length; i += 4) {
    if (Math.abs(live[i] - shot[i]) > 8 || Math.abs(live[i+1] - shot[i+1]) > 8 ||
        Math.abs(live[i+2] - shot[i+2]) > 8 || Math.abs(live[i+3] - shot[i+3]) > 8) diff++;
  }
  return {diff: diff / (w * h), w, h, bytes: url.length};
}
"""

EXPORTMARK = re.compile(r'Scene\.export|__EXPORT\s*=')


@probe('9-export-decl', 'путь выгрузки объявлен', point=9,
       dirty=lambda t, d: t.replace('Scene.export', 'localExport'))
def p9_export_decl(a):
    n = len(EXPORTMARK.findall(a.nocomment))
    return Res(n > 0, 'Scene.export(kind) объявлен', str(n))


@probe('9-export', 'PNG совпадает с экраном', point=9, needs=BROWSER,
       dirty=lambda t, d: t.replace("return ctx.canvas.toDataURL('image/png');",
                                    "return ctx.canvas.toDataURL('image/jpeg', 0.15);", 1))
def p9_export(a):
    """🔴 Кадр замораживается покоем, иначе сравнение меряет разницу во времени,
    а не разницу экспорта. Порог 0.005 — доля различающихся пикселей."""
    page, errs, why = _page(a, query='?reduced=1', reduced='reduce')
    if page is None:
        return skipped('доля расхождения <= 0.005', why)
    try:
        page.wait_for_timeout(900)
        r = page.evaluate(JS_EXPORT)
    finally:
        page.close()
    if not r or r.get('err'):
        return red('доля расхождения <= 0.005', (r or {}).get('err', 'проба не отработала'))
    return Res(r['diff'] <= 0.005, 'доля расхождения <= 0.005 (%dx%d)' % (r['w'], r['h']),
               'расхождение %.5f' % r['diff'])


# ══ ПУНКТ 10 · паспорт и чистота ═════════════════════════════════════════
# 🔴 Список запретных имён хранится ХЕШАМИ: иначе гейт сам становится
#    упоминанием и роняет тот закон, который проверяет (AGENTS §9).
NAME_HASHES = frozenset((
    'cbde66cdb61b4f59', '7a9160cf04bf591d', 'd5c196115b189bc8', 'ccf7ace31902ec60',
    '6deb28064af98dec', '8c37072e3249378e', '739123b666a7b12e', 'f9a8231a33305dbb',
    '93817ec0f05d394e', 'b643bb79110ffc11', '6b20e9b742e448a5', '4007d46292298e83',
    '1703346aa5f8bea9', '8233f525a1f618f9',
))
FONT_HASHES = frozenset((
    '2221e424a73f688a', '956e22b93147d413', '63e00133baf50a87', '1ab254fb03b52e91',
    'f5a351ed7dbf1adb', '6c58160fe1935610', '5ade25fe949a26cb', '472f794339870b41',
    '055e6f4594365380', 'f79b8c4e29a3c781', '31282ae569dd880d',
))
# Донор списка секретов: release-scrub/scripts/scrub_scan.py, гнездо «ключ».
SECRET = re.compile(
    r'(?:sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{12,}|AIza[0-9A-Za-z_-]{30,}'
    r'|Bearer\s+[A-Za-z0-9._\-]{16,}'
    r'|(?:api[_-]?key|secret|token|password|authorization)\s*[:=]\s*["\'][^"\']{12,}["\'])', re.I)
WORD = re.compile(r'[A-Za-zА-Яа-яЁё]{3,}')
ATTR = re.compile(r'<[a-zA-Z][^>]*>')
ATTRNAME = re.compile(r'([^\s=<>"\']+)\s*=')


def _h16(s):
    return hashlib.sha256(s.encode('utf-8')).hexdigest()[:16]


def _repo_hashes():
    """tools/names.h16 репозитория (RELIEF Ф0.4): «name <h16>» и «font <h16>» построчно."""
    names, fonts = set(), set()
    p = os.path.join(os.path.dirname(ARSENAL), 'tools', 'names.h16')
    if os.path.exists(p):
        for line in io.open(p, encoding='utf-8'):
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            kind, _, h = line.partition(' ')
            (fonts if kind == 'font' else names).add(h.strip())
    return frozenset(names), frozenset(fonts)


REPO_NAMES, REPO_FONTS = _repo_hashes()


@probe('10-clean', 'чисто: имён, лицензионных шрифтов, секретов нет', point=10,
       dirty=lambda t, d: t.replace('<title>', '<title>token = "abcdefghijklmnop" ', 1))
def p10_clean(a):
    src = a.body
    problems = []
    sec = SECRET.findall(src)
    if sec:
        problems.append('секретов %d' % len(sec))
    found = WORD.findall(src)
    words = [w.lower() for w in found]
    hits, lines = set(), []
    for m in WORD.finditer(src):
        w = m.group(0).lower()
        hw = _h16(w)
        if hw in NAME_HASHES or hw in FONT_HASHES or hw in REPO_NAMES or hw in REPO_FONTS:
            hits.add(w[:2] + '…')
            if len(lines) < 3:
                lines.append(str(src.count('\n', 0, m.start()) + 1))
    for i, w in enumerate(words[:-1]):
        hp = _h16(w + ' ' + words[i + 1])
        if hp in FONT_HASHES or hp in REPO_FONTS or hp in REPO_NAMES:
            hits.add(w[:2] + '…')
    if hits:
        problems.append('запретных слов %d (%s) строки %s'
                        % (len(hits), ' '.join(sorted(hits)[:3]), ','.join(lines) or '?'))
    cyr = []
    for tag in ATTR.findall(a.markup):
        for nm in ATTRNAME.findall(tag):
            if re.search(r'[а-яёА-ЯЁ]', nm):
                cyr.append(nm[:20])
    if cyr:
        problems.append('кириллица в атрибутах: %s' % ' '.join(cyr[:2]))
    return Res(not problems, 'имён 0 · шрифтов 0 · секретов 0 · кириллицы в атрибутах 0',
               ' · '.join(problems) if problems else 'чисто, слов %d' % len(words))


def _dirty_passport(t, d):
    for n in sorted(os.listdir(d)):
        if n.endswith('.json'):
            p = os.path.join(d, n)
            with io.open(p, encoding='utf-8') as f:
                data = json.load(f)
            data.pop('params', None)
            with io.open(p, 'w', encoding='utf-8') as f:
                f.write(json.dumps(data, ensure_ascii=False))
            break
    return t


def validate_passport(data, schema):
    """Минимальный валидатор под нашу схему: required, type, enum, const, pattern.
    Полный JSON Schema не тянем — в паках ноль зависимостей."""
    errs = []

    def walk(node, sch, path):
        t = sch.get('type')
        if 'const' in sch and node != sch['const']:
            errs.append('%s: ожидалось %r' % (path, sch['const']))
            return
        if 'enum' in sch and node not in sch['enum']:
            errs.append('%s: не из списка %s' % (path, sch['enum']))
            return
        if t == 'object' or 'properties' in sch:
            if not isinstance(node, dict):
                errs.append('%s: не объект' % path)
                return
            for k in sch.get('required', []):
                if k not in node:
                    errs.append('%s: нет ключа %s' % (path or 'корень', k))
            props = sch.get('properties', {})
            if sch.get('additionalProperties') is False:
                for k in node:
                    if k not in props:
                        errs.append('%s: лишний ключ %s' % (path or 'корень', k))
            for k, v in node.items():
                if k in props:
                    walk(v, props[k], (path + '.' if path else '') + k)
        elif t == 'array':
            if not isinstance(node, list):
                errs.append('%s: не список' % path)
                return
            it = sch.get('items')
            if it:
                for i, v in enumerate(node):
                    walk(v, it, '%s[%d]' % (path, i))
        elif t == 'string':
            if not isinstance(node, str):
                errs.append('%s: не строка' % path)
                return
            pat = sch.get('pattern')
            if pat and not re.search(pat, node):
                errs.append('%s: не по форме %s' % (path, pat))
        elif t == 'integer' and not isinstance(node, int):
            errs.append('%s: не целое' % path)
        elif t == 'boolean' and not isinstance(node, bool):
            errs.append('%s: не булево' % path)

    walk(data, schema, '')
    return errs


@probe('10-passport', 'паспорт валиден и не протух', point=10,
       dirty=_dirty_passport, dirty_side=True)
def p10_passport(a):
    p = a.passport
    if not p:
        return red('паспорт по схеме + engineHash сходится', 'паспорта рядом нет')
    sp = os.path.join(ARSENAL, 'passport.schema.json')
    if not os.path.exists(sp):
        return red('паспорт по схеме', 'схемы нет: ' + sp)
    try:
        with io.open(p, encoding='utf-8') as f:
            data = json.load(f)
        with io.open(sp, encoding='utf-8') as f:
            schema = json.load(f)
    except Exception as e:
        return red('паспорт по схеме', 'не читается: %s' % str(e)[:40])
    errs = validate_passport(data, schema)
    if errs:
        return red('паспорт по схеме', '%d: %s' % (len(errs), errs[0][:52]))
    real = a.sha256
    if data.get('engineHash') != real:
        return red('engineHash сходится с файлом',
                   'паспорт %s… против файла %s…' % (data.get('engineHash', '')[:10], real[:10]))
    return Res(True, 'паспорт по схеме + engineHash сходится', 'валиден, hash сошёлся')


# ── обнаружение, прогон, мерж ────────────────────────────────────────────
SKIPDIRS = {'node_modules', '_backups', '__pycache__', 'frames', '_frames', '.git', '_to_delete'}


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
                # 🔴 Источник сборки это не артефакт: `*.src.html` носит внешние
                #    <script src> и не должен считаться нарушением single-file.
                if f.endswith('.html') and not f.endswith('.src.html'):
                    out.append(Artefact(os.path.join(root, f)))
    return out


ROOT = os.path.dirname(ARSENAL)          # рабочая папка Projects


def key_of(a):
    """🔴 Ключ по АРТЕФАКТУ, а не по месту запуска. Путь от текущей папки давал
    один и тот же файл двумя строками (`gate/sample/index.html` и
    `_arsenal/gate/sample/index.html`) — ровно те фантомные строки, против
    которых написан закон мержа."""
    for base in (ROOT, os.path.expanduser('~')):
        try:
            rel = os.path.relpath(a.path, base)
        except ValueError:
            continue
        if not rel.startswith('..'):
            return rel
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
                'skip': r.skip, 'needs': pr.needs, 'point': pr.point,
                'ts': int(time.time()), 'ms': int((time.time() - t0) * 1000),
                'mtime': int(os.path.getmtime(a.path)) if os.path.exists(a.path) else 0,
            }))
    _close_browser()
    return rows


def load(path):
    if not os.path.exists(path):
        return {'gate': 'arsenal', 'runs': {}}
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
    fd, tmp = tempfile.mkstemp(prefix='.gate-', suffix='.tmp', dir=d)
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


def score_of(probes, path):
    """n/10: пункт зелёный, когда зелёные ВСЕ его пробы и ни одна не пропущена."""
    by_point = {}
    for pid, row in probes.items():
        by_point.setdefault(row.get('point', 0), []).append(state_of(row, path))
    green, unproven = 0, 0
    for pt in POINTS:
        st = by_point.get(pt)
        if not st:
            unproven += 1
            continue
        if all(s == 'green' for s in st):
            green += 1
        elif any(s in ('skip', 'stale') for s in st) and not any(s == 'RED' for s in st):
            unproven += 1
    return green, unproven


# ── отчёт человеку, код возврата машине ──────────────────────────────────
W = (16, 30, 34, 40)


def report(data, title='ГЕЙТ АРСЕНАЛА'):
    runs = data.get('runs', {})
    tally = {'green': 0, 'RED': 0, 'skip': 0, 'stale': 0}
    order = [p.pid for p in PROBES]
    print('\n%s · артефактов %d · реестр %d проб · десять пунктов §6.9\n'
          % (title, len(runs), len(PROBES)))
    head = ('проба'.ljust(W[0]) + 'что проверяет'.ljust(W[1]) +
            'ожидание'.ljust(W[2]) + 'факт'.ljust(W[3]) + 'вердикт')
    rule = '-' * (sum(W) + 8)
    for key in sorted(runs):
        slot = runs[key]
        probes = slot.get('probes', {})
        path = slot.get('path', key)
        green, unproven = score_of(probes, path)
        print('· %s   %d/10%s' % (key, green, (' · не доказано %d' % unproven) if unproven else ''))
        print(head)
        print(rule)
        for pid in order + [k for k in sorted(probes) if k not in order]:
            row = probes.get(pid)
            if row is None:
                print(pid.ljust(W[0]) + '-'.ljust(W[1]) + '-'.ljust(W[2]) +
                      'в этом прогоне не бежала'.ljust(W[3]) + 'skip')
                tally['skip'] += 1
                continue
            st = state_of(row, path)
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


# ── чистый образец и грязные дубли ───────────────────────────────────────
SAMPLE = os.path.join(HERE, 'sample')


SAMPLE_FILE = {'path': None}       # --sample: чистый артефакт профиля v2 вместо gate/sample/


def _sample(dirpath):
    """Положительный контроль: образец, который ОБЯЗАН быть 10/10.
    Лежит на диске (gate/sample/), а не в строке — он же документация контракта.
    С --sample <файл.html> образцом служит этот файл и его паспорт (<имя>.passport.json)."""
    if os.path.isdir(dirpath):
        shutil.rmtree(dirpath)
    if SAMPLE_FILE['path']:
        src = os.path.abspath(SAMPLE_FILE['path'])
        os.makedirs(dirpath)
        shutil.copy(src, os.path.join(dirpath, 'index.html'))
        stem = os.path.splitext(src)[0]
        for pp in (stem + '.passport.json', stem + '.паспорт.json'):
            if os.path.exists(pp):
                shutil.copy(pp, os.path.join(dirpath, 'passport.json'))
                break
        return os.path.join(dirpath, 'index.html')
    shutil.copytree(SAMPLE, dirpath)
    return os.path.join(dirpath, 'index.html')


def _restamp(html):
    """Паспорт образца несёт engineHash. Грязный дубль меняет байты — hash обязан
    быть пересчитан, иначе 10-passport краснеет у ВСЕХ дублей и доказывает не то."""
    d = os.path.dirname(html)
    p = os.path.join(d, 'паспорт.json')
    if not os.path.exists(p):
        p = os.path.join(d, 'passport.json')
    if not os.path.exists(p):
        return
    with io.open(p, encoding='utf-8') as f:
        data = json.load(f)
    with io.open(html, 'rb') as f:
        data['engineHash'] = hashlib.sha256(f.read()).hexdigest()
    with io.open(p, 'w', encoding='utf-8') as f:
        f.write(json.dumps(data, ensure_ascii=False, indent=2))


# ── отрицательный контроль ───────────────────────────────────────────────
SANITY = [
    ('2d', 0.0000, True,  False, 'пустой буфер'),
    ('gl', 0.0000, True,  False, 'WebGL без preserveDrawingBuffer'),
    ('2d', 1.0000, True,  False, 'кадр залит целиком'),
    ('2d', 0.0020, True,  False, 'ниже порога непустоты'),
    ('2d', 0.3100, False, False, 'картинка есть, но стоит'),
    ('2d', 0.3100, True,  True,  'живая сцена'),
]


def negative(only=None):
    print('\nОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ · чистый образец · грязные дубли · мерж · атомарность\n')
    bad, notes = [], []
    if len(PROBES) != PROBE_COUNT:
        print('🔴 реестр не сошёлся: PROBE_COUNT=%d, проб %d' % (PROBE_COUNT, len(PROBES)))
        return 2
    if not os.path.isdir(SAMPLE):
        print('🔴 образца нет: %s' % SAMPLE)
        return 2
    ids = [s.strip() for s in (only or '').split(',') if s.strip()]
    root = tempfile.mkdtemp(prefix='gate-negative-')
    try:
        clean = Artefact(_sample(os.path.join(root, 'clean')))
        print('%-16s%-32s%-32s%s' % ('проба', 'на чистом образце', 'на ГРЯЗНОМ дубле', 'вердикт'))
        print('-' * 96)
        for pr in PROBES:
            if ids and pr.pid not in ids:
                continue
            if pr.needs == BROWSER and _browser()[1] is None:
                notes.append(pr.pid)
                continue
            r = pr.fn(clean)
            if r.skip:
                # Проба не может судить на чистом образце (нет кита, нет браузера):
                # это «не доказано», а не провал. Молча зелёной она не становится.
                notes.append(pr.pid + ' (' + str(r.act)[:40] + ')')
                continue
            clean_ok = r.ok
            dd = os.path.join(root, 'dirty-' + pr.pid)
            dh = _sample(dd)
            with io.open(dh, encoding='utf-8') as f:
                txt = f.read()
            new = pr.dirty(txt, dd) if pr.dirty else txt
            if new == txt and pr.dirty and not pr.dirty_side:
                bad.append(pr.pid + ' (дубль не подействовал)')
            with io.open(dh, 'w', encoding='utf-8') as f:
                f.write(new)
            _restamp(dh)
            r2 = pr.fn(Artefact(dh))
            fell = (not r2.ok) and (not r2.skip)
            if not (clean_ok and fell):
                bad.append(pr.pid)
            print('%-16s%-32s%-32s%s' % (
                pr.pid,
                (('green · ' + str(r.act)) if clean_ok else ('🔴 НЕ ЗЕЛЁНАЯ · ' + str(r.act)))[:31],
                (('RED · ' + str(r2.act)) if fell else ('🔴 ПРОШЛА · ' + str(r2.act)))[:31],
                'ok' if (clean_ok and fell) else 'ПРОВАЛ'))
        _close_browser()
        print('-' * 96)

        san_bad = [w for k, s, m, want, w in SANITY if verdict_share(k, s, m).ok != want]
        if san_bad:
            bad.append('диапазон')
        print('диапазон        %d случаев замера, 0.0 и 1.0 отбиты        %s'
              % (len(SANITY), 'ok' if not san_bad else '🔴 ПРОВАЛ: ' + ' · '.join(san_bad)))

        res = os.path.join(root, 'acceptance.json')
        a1 = Artefact(_sample(os.path.join(root, 'm1')))
        first = [p for p in PROBES if p.pid in ('1-single-file', '3-hardcode')]
        second = [p for p in PROBES if p.pid in ('4-seed', '10-clean')]
        write_atomic(res, merge(load(res), run([a1], first)))
        write_atomic(res, merge(load(res), run([a1], second)))
        want = set(['1-single-file', '3-hardcode', '4-seed', '10-clean'])
        got = set(load(res)['runs'][key_of(a1)]['probes'].keys())
        if got != want:
            bad.append('мерж')
        print('мерж            два частичных прогона -> %d строк(и)        %s'
              % (len(got), 'ok' if got == want else '🔴 ПРОВАЛ: потеряно ' + ' '.join(sorted(want - got))))

        write_atomic(res, merge(load(res), run([a1], first)))
        got2 = set(load(res)['runs'][key_of(a1)]['probes'].keys())
        if got2 != want:
            bad.append('мерж-повтор')
        print('мерж-повтор     повтор пробы не унёс соседей               %s'
              % ('ok' if got2 == want else '🔴 ПРОВАЛ'))

        junk = [n for n in os.listdir(root) if n.startswith('.gate-')]
        if junk:
            bad.append('атомарность')
        print('атомарность     temp+rename, огрызков %d                    %s'
              % (len(junk), 'ok' if not junk else '🔴 ПРОВАЛ'))

        if state_of({'ok': True, 'mtime': -1}, clean.path) != 'stale':
            bad.append('протухание')
        print('протухание      правка файла гасит старое зелёное          %s'
              % ('ok' if 'протухание' not in bad else '🔴 ПРОВАЛ'))
    finally:
        _close_browser()
        shutil.rmtree(root, ignore_errors=True)

    print('')
    if notes:
        print('не доказано без Chromium (%d): %s' % (len(notes), ' '.join(notes)))
        print('   поставить: pip3 install playwright && python3 -m playwright install chromium')
    if bad:
        print('🔴 ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ ПРОВАЛЕН: %s' % ' '.join(bad))
        return 1
    print('контроль пройден: пробы зелёные на чистом образце и КРАСНЫЕ на грязных дублях.')
    return 0


# ── штамп паспорта ───────────────────────────────────────────────────────
def stamp(path, jsonpath):
    """Паспорт не пишется руками: engineHash и результат гейта вписывает прогон."""
    a = Artefact(path)
    p = a.passport
    if not p:
        sys.stderr.write('🔴 паспорта рядом нет: %s\n' % path)
        return 2
    with io.open(p, encoding='utf-8') as f:
        data = json.load(f)
    data['engineHash'] = a.sha256
    acc = load(jsonpath)
    slot = acc.get('runs', {}).get(key_of(a))
    if slot:
        green, unproven = score_of(slot['probes'], slot.get('path', path))
        data['gate'] = {'date': time.strftime('%Y-%m-%d'), 'score': '%d/10' % green,
                        'report': os.path.relpath(jsonpath, ARSENAL)}
    with io.open(p, 'w', encoding='utf-8') as f:
        f.write(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    print('паспорт обновлён: %s · engineHash %s… · %s'
          % (os.path.relpath(p, ARSENAL), data['engineHash'][:12], data['gate']['score']))
    return 0


def fleet_paths():
    """Пути из ИНДЕКС.md: строки таблицы, второй столбец."""
    idx = os.path.join(ARSENAL, 'ИНДЕКС.md')
    if not os.path.exists(idx):
        return []
    out = []
    with io.open(idx, encoding='utf-8') as f:
        for line in f:
            if not line.startswith('|'):
                continue
            cells = [c.strip().strip('`') for c in line.strip().strip('|').split('|')]
            if len(cells) > 1 and cells[1].endswith('.html'):
                p = os.path.join(ARSENAL, cells[1])
                if os.path.exists(p):
                    out.append(p)
    return out


# ── точка входа ──────────────────────────────────────────────────────────
def main(argv=None):
    ap = argparse.ArgumentParser(description='Гейт арсенала: десять пунктов приёмки §6.9.')
    ap.add_argument('paths', nargs='*', help='файлы или папки с артефактами')
    ap.add_argument('--only', default='', help='id проб через запятую — частичный прогон, МЕРЖИТ')
    ap.add_argument('--json', default=os.path.join(HERE, 'acceptance.json'),
                    help='файл накопленного результата')
    ap.add_argument('--negative', action='store_true', help='отрицательный контроль')
    ap.add_argument('--selftest', action='store_true', help='синоним --negative')
    ap.add_argument('--sample', default='', help='--negative на этом чистом артефакте (профиль панели v2)')
    ap.add_argument('--fleet', action='store_true', help='прогон по путям из ИНДЕКС.md')
    ap.add_argument('--stamp', default='', help='вписать engineHash и результат в паспорт')
    ap.add_argument('--report', action='store_true', help='только отчёт из JSON')
    ap.add_argument('--list', action='store_true', help='список проб')
    args = ap.parse_args(argv)

    if args.list:
        for p in sorted(PROBES, key=lambda x: (x.point, x.pid)):
            print('%-16s пункт %-3s %-9s%s' % (p.pid, p.point, p.needs, p.title))
        print('\nдесять пунктов: ' + ' · '.join('%d %s' % (k, v) for k, v in sorted(POINTS.items())))
        return 0
    if args.negative or args.selftest:
        SAMPLE_FILE['path'] = args.sample or None
        return negative(args.only)
    if len(PROBES) != PROBE_COUNT:
        sys.stderr.write('🔴 реестр не сошёлся: PROBE_COUNT=%d, проб %d. '
                         'Проба, выпавшая из прогона, — не проба, которая прошла.\n'
                         % (PROBE_COUNT, len(PROBES)))
        return 2
    if args.stamp:
        return stamp(args.stamp, args.json)
    if args.report:
        return report(load(args.json))

    paths = list(args.paths)
    if args.fleet:
        paths += fleet_paths()
    if not paths:
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
    artefacts = discover(paths)
    if not artefacts:
        sys.stderr.write('🔴 артефактов не найдено — пустой прогон это не «всё зелено».\n')
        return 2
    rows = run(artefacts, chosen)
    write_atomic(args.json, merge(load(args.json), rows))
    return report(load(args.json))


if __name__ == '__main__':
    sys.exit(main())
