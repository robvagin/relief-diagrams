#!/usr/bin/env python3
"""Скоуп панели v2 под корень `.pv2` (README §7.11).

    python3 tools/scope_css.py            печатает собранный CSS хрома
    from scope_css import pv2_css         то же для tools/build.py

Что делает:
  · panel.css: каждый селектор получает префикс `.pv2 `, медиа-запросы сохраняются,
    сиротская `}` в выдержке (обрывок медиа-блока источника) отбрасывается;
  · house.tokens.css: светлая ветка `:root{}` и тёмная `:root[data-theme="dark"]{}`
    переобъявляются на `:root .pv2` и `:root .pv2[data-theme="dark"]` (тема хрома
    задаётся атрибутом корня панели, а не системой); шрифт хрома Geist (PANEL_V2 §2).
Исходники в vendor/ не правятся: правится только этот вывод.
"""
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PV2 = os.path.join(ROOT, 'vendor', 'panel-v2')
FONTS = {
    '--sans': '"Geist",system-ui,sans-serif',
    '--display': '"Geist",system-ui,sans-serif',
    '--mono': '"Geist Mono",ui-monospace,monospace',
}


def _strip_comments(css):
    return re.sub(r'/\*.*?\*/', '', css, flags=re.S)


def _blocks(css):
    """Разбор верхнего уровня: [(prelude, body)], тело может быть вложенным."""
    out, i, n = [], 0, len(css)
    while i < n:
        j = i
        while j < n and css[j] not in '{}':
            j += 1
        if j >= n:
            break
        if css[j] == '}':            # сирота: закрывает то, чего в выдержке нет
            i = j + 1
            continue
        pre = css[i:j].strip()
        depth, k = 1, j + 1
        while k < n and depth:
            if css[k] == '{':
                depth += 1
            elif css[k] == '}':
                depth -= 1
            k += 1
        out.append((pre, css[j + 1:k - 1]))
        i = k
    return out


def _prefix(sel, scope):
    parts = []
    for s in sel.split(','):
        s = s.strip()
        if not s:
            continue
        parts.append(scope + ' ' + s)
    return ','.join(parts)


def scope(css, scope='.pv2'):
    res = []
    for pre, body in _blocks(_strip_comments(css)):
        if pre.startswith('@media') or pre.startswith('@supports'):
            res.append('%s{%s}' % (pre, scope_inner(body, scope)))
        elif pre.startswith('@'):
            res.append('%s{%s}' % (pre, body.strip()))
        elif pre:
            res.append('%s{%s}' % (_prefix(pre, scope), body.strip()))
    return '\n'.join(res)


def scope_inner(css, scope):
    return ''.join('%s{%s}' % (_prefix(p, scope), b.strip()) for p, b in _blocks(css) if p)


def _vars(body):
    out = []
    for m in re.finditer(r'(--[\w-]+)\s*:\s*([^;]+);?', body):
        out.append((m.group(1), m.group(2).strip()))
    return out


def tokens(path):
    css = _strip_comments(io.open(path, encoding='utf-8').read())
    light, dark = None, None
    for pre, body in _blocks(css):
        if pre == ':root':
            light = _vars(body)
        elif pre.startswith(':root[data-theme="dark"]'):
            dark = _vars(body)
    if light is None or dark is None:
        raise SystemExit('house.tokens.css: не нашлись ветки :root и :root[data-theme="dark"]')
    light = [(k, FONTS.get(k, v)) for k, v in light]
    fmt = lambda kv: ';'.join('%s:%s' % x for x in kv)
    return (':root .pv2{%s;color-scheme:light}\n:root .pv2[data-theme="dark"]{%s;color-scheme:dark}'
            % (fmt(light), fmt(dark)))


def pv2_css():
    panel = io.open(os.path.join(PV2, 'panel.css'), encoding='utf-8').read()
    return ('/* хром панели v2: house.tokens.css + panel.css, скоуп .pv2 (tools/scope_css.py) */\n'
            + tokens(os.path.join(PV2, 'house.tokens.css')) + '\n' + scope(panel))


if __name__ == '__main__':
    sys.stdout.write(pv2_css() + '\n')
