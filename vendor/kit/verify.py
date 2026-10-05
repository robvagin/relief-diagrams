#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
verify.py — приёмка ДЕЛЬТЫ кита: того, чего не было у донора и что гейт не проверяет.
Гейт судит модуль по десяти пунктам; здесь доказывается, что тема, режимы, ряды
tabs/chips и хоткеи действительно работают, а не просто написаны.

  python3 kit/verify.py [файл.html]     по умолчанию gate/sample/index.html

Каждая проба объявляет ОЖИДАНИЕ до прогона и печатает факт. Коды: 0 · 1 · 2.
"""
from __future__ import unicode_literals

import os
import sys

HERE = os.path.dirname(os.path.realpath(__file__))
ARSENAL = os.path.dirname(HERE)

CHECKS = []


def check(title, exp, got):
    ok = (exp == got) if not callable(exp) else exp(got)
    CHECKS.append((ok, title, exp if not callable(exp) else 'по правилу', got))
    return ok


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ARSENAL, 'gate', 'sample', 'index.html')
    if not os.path.exists(target):
        sys.stderr.write('🔴 нет файла: %s\n' % target)
        return 2
    try:
        from playwright.sync_api import sync_playwright
    except Exception as e:
        sys.stderr.write('🔴 нет Playwright: %s\n' % str(e)[:60])
        return 2
    url = 'file://' + os.path.abspath(target)

    with sync_playwright() as pw:
        b = pw.chromium.launch()

        # ── студия по умолчанию: ряд {studio:true} на месте ────────────
        pg = b.new_page(viewport={'width': 1000, 'height': 700})
        pg.goto(url, wait_until='load'); pg.wait_for_timeout(700)
        rows = pg.evaluate("() => [...document.querySelectorAll('.dg-row')].map(r => r.dataset.path)")
        check('студия: ряд grid построен', True, 'grid' in rows)
        check('студия: рядов восемь', 8, len(rows))
        kinds = pg.evaluate("() => [...document.querySelectorAll('.dg-row')].map(r => r.dataset.kind)")
        check('ряд tabs построен', True, 'tabs' in kinds)
        check('ряд chips построен', True, 'chips' in kinds)

        # ── chips: клик переключает и значение остаётся МАССИВОМ ───────
        before = pg.evaluate("() => JSON.stringify(DG.panel.getValues().marks)")
        pg.click(".dg-chips .dg-chip:nth-child(2)")
        pg.wait_for_timeout(200)
        after = pg.evaluate("() => DG.panel.getValues().marks")
        check('chips: значение массив', True, isinstance(after, list))
        check('chips: клик добавил выбор', True, len(after) == 2 and before != str(after))
        pressed = pg.evaluate("() => document.querySelectorAll('.dg-chip[aria-pressed=true]').length")
        check('chips: aria-pressed сходится с выбором', len(after), pressed)

        # ── tabs: один выбор, aria-selected ровно у одного ─────────────
        pg.click(".dg-tabs .dg-tab:nth-child(2)")
        pg.wait_for_timeout(200)
        sel = pg.evaluate("() => document.querySelectorAll('.dg-tab[aria-selected=true]').length")
        check('tabs: выбран ровно один', 1, sel)
        check('tabs: значение доехало', 'дуги', pg.evaluate("() => DG.panel.getValues().look"))

        # ── хоткей S: клиентский режим убирает ряд студии ──────────────
        pg.keyboard.press('s')
        pg.wait_for_timeout(400)
        rows2 = pg.evaluate("() => [...document.querySelectorAll('.dg-row')].map(r => r.dataset.path)")
        check('хоткей S: режим client', 'client',
              pg.evaluate("() => document.querySelector('.dg-panel').classList.contains('is-client') ? 'client' : 'studio'"))
        check('client: ряда grid нет вовсе', False, 'grid' in rows2)
        check('client: значения ручек пережили пересборку', 'дуги',
              pg.evaluate("() => DG.panel.getValues().look"))

        # ── хоткей H: панель прячется ──────────────────────────────────
        pg.keyboard.press('h')
        pg.wait_for_timeout(200)
        check('хоткей H: панель спрятана', True,
              pg.evaluate("() => document.querySelector('.dg-panel').classList.contains('is-hidden')"))
        pg.keyboard.press('h')
        pg.wait_for_timeout(200)
        check('хоткей H: панель вернулась', False,
              pg.evaluate("() => document.querySelector('.dg-panel').classList.contains('is-hidden')"))

        # ── правка числа: за max, диапазон едет и в aria ───────────────
        pg.evaluate("""() => { const s = document.querySelector('.dg-scrub[data-path=rings]');
            s.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, clientX:0, pointerId:1}));
            s.dispatchEvent(new PointerEvent('pointerup',   {bubbles:true, clientX:0, pointerId:1})); }""")
        pg.wait_for_timeout(150)
        pg.keyboard.type('96'); pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
        check('ввод за max доехал до состояния', 96, pg.evaluate("() => DG.panel.getValues().rings"))
        check('aria-valuemax расширился', True, pg.evaluate(
            "() => +document.querySelector('.dg-scrub[data-path=rings]').getAttribute('aria-valuemax') >= 96"))
        check('aria-valuenow сходится со значением', '96', pg.evaluate(
            "() => document.querySelector('.dg-scrub[data-path=rings]').getAttribute('aria-valuenow')"))
        pg.close()

        # ── ночь: класс темы и ЗНАЧЕНИЕ токена, а не только класс ──────
        pg = b.new_page(viewport={'width': 1000, 'height': 700})
        pg.goto(url + '?theme=night', wait_until='load'); pg.wait_for_timeout(700)
        check('ночь: класс на панели', True,
              pg.evaluate("() => document.querySelector('.dg-panel').classList.contains('is-night')"))
        ink = pg.evaluate("() => getComputedStyle(document.querySelector('.dg-panel'))"
                          ".getPropertyValue('--dg-ink').trim()")
        check('ночь: значение токена подменилось', '#F4F0E3', ink)
        check('ночь: панель не под filter', 'none',
              pg.evaluate("() => getComputedStyle(document.querySelector('.dg-panel')).filter"))
        pg.close()

        # ── embed: панель не строится вовсе ────────────────────────────
        pg = b.new_page(viewport={'width': 320, 'height': 240})
        pg.goto(url + '?embed=1', wait_until='load'); pg.wait_for_timeout(600)
        check('embed: рядов ноль', 0, pg.evaluate("() => document.querySelectorAll('.dg-row').length"))
        pg.close()
        b.close()

    bad = [c for c in CHECKS if not c[0]]
    print('\nПРИЁМКА ДЕЛЬТЫ КИТА · %s\n' % os.path.relpath(target, ARSENAL))
    for ok, title, exp, got in CHECKS:
        print('%-46s ожидание %-12s факт %-12s %s'
              % (title[:45], str(exp)[:12], str(got)[:12], 'ok' if ok else '🔴 ПРОВАЛ'))
    print('\nпроб %d · провалов %d' % (len(CHECKS), len(bad)))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
