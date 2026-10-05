#!/usr/bin/env python3
"""Бюджет кадра рельса (README §7.3: ≤ 8 мс при 1440×900 и 40 плашках; навык canvas-frame-budget).

    python3 tools/verify/budget.py

З4 навыка: миллисекунды без калибровки машины ничего не значат. Поэтому в том же прогоне меряется
ёмкость машины: стоимость полнокадрового прохода multiply и 120 штампов 150×120 'darken' — это
ровно те операции, из которых рельс собирает тени. Отчёт: кадр (медиана, p90, максимум) по пресетам
soft · canopy · lamp после прогрева на полном периоде (прогрев вне зачёта, но печатается: З2).
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LAB = 'file://' + os.path.join(ROOT, 'dist', '_lab.html') + '?embed=1'

CAL = """() => { const g = KIT.scene.ctx.g; window.postMessage({type: 'pause'}, '*');
  const mk = (w, h, f) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = f; x.fillRect(0, 0, w, h); return c; };
  const A = mk(1440, 900, 'rgb(200,200,200)'), S = mk(150, 120, 'rgb(120,120,120)'), D = mk(1440, 900, 'rgb(255,255,255)'), dx = D.getContext('2d');
  const T = (f) => { g.getImageData(0, 0, 1, 1); const a = performance.now(); for (let i = 0; i < 10; i++) { f(); g.getImageData(0, 0, 1, 1); } return (performance.now() - a) / 10; };
  const mul = T(() => { g.save(); g.globalCompositeOperation = 'multiply'; g.drawImage(A, 0, 0); g.restore(); });
  const st = T(() => { dx.globalCompositeOperation = 'darken'; for (let i = 0; i < 120; i++) dx.drawImage(S, (i * 97) % 1290, (i * 53) % 780); dx.getImageData(0, 0, 1, 1); });
  return {multiply_full: +mul.toFixed(2), stamps120: +st.toFixed(2)}; }"""

RUN = """(pre) => { const ctx = KIT.scene.ctx, R = RELIEF; Scene.set('light', pre); window.postMessage({type: 'pause'}, '*');
  const pl = []; for (let i = 0; i < 40; i++) { const c = i % 8, r = Math.floor(i / 8);
    pl.push({id: 'b' + i, x: 120 + c * 170, y: 120 + r * 160, w: 120 + (i % 3) * 20, h: 90, z: R.zh(1 + (i % 3), ctx.P, R.ui(ctx.W, ctx.H)), kind: i % 5 ? 'rect' : 'circle'}); }
  let a = performance.now(); for (let k = 0; k < 2160; k += 12) { ctx.t = k; R.frame(ctx, {plates: pl}); } ctx.g.getImageData(0, 0, 1, 1);
  const warm = performance.now() - a, ts = [];
  for (let k = 0; k < 120; k++) { ctx.t = 3000 + k; const b = performance.now(); R.frame(ctx, {plates: pl}); ctx.g.getImageData(0, 0, 1, 1); ts.push(performance.now() - b); }
  ts.sort((x, y) => x - y);
  return {warm_s: +(warm / 1000).toFixed(1), med: +ts[60].toFixed(1), p90: +ts[108].toFixed(1), max: +ts[119].toFixed(1)}; }"""


def main():
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)
        pg.goto(LAB)
        for _ in range(80):
            if pg.evaluate('() => window.__READY === true'):
                break
            pg.wait_for_timeout(100)
        cal = pg.evaluate(CAL)
        print('калибровка машины: полнокадровый multiply %.2f мс · 120 штампов darken %.2f мс' % (cal['multiply_full'], cal['stamps120']))
        print('   (GPU-канвас десктопного Chrome: доли миллисекунды; программный растр облака: единицы)')
        worst = 0
        for pre in ('soft', 'canopy', 'lamp'):
            r = pg.evaluate(RUN, pre)
            worst = max(worst, r['med'])
            print('%-7s кадр медиана %5.1f мс · p90 %5.1f · максимум %5.1f · прогрев %.1f с (вне зачёта)' % (pre, r['med'], r['p90'], r['max'], r['warm_s']))
        units = worst / max(0.05, cal['multiply_full'])
        print('итог: медиана худшего пресета %.1f мс = %.1f полнокадровых multiply этой машины (бюджет 8 мс)' % (worst, units))
        b.close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
