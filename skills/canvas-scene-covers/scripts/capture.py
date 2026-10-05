#!/usr/bin/env python3
"""Съёмка канвасных сцен для обложек.

Правь SCENES сверху. Логику ниже трогать не нужно.
Запуск: python3 capture.py
"""
import pathlib
from playwright.sync_api import sync_playwright

SRC = pathlib.Path("./scenes")     # где лежат html сцен
OUT = pathlib.Path("./raw")        # куда класть кадры
CHROMIUM = "/opt/pw-browsers/chromium"

# name, file, query, webgl?, multi (сколько канвасов снять поштучно; 0 = один большой)
SCENES = [
    ("sphere",  "01-hero.html",   "?embed=1", True,  0),
    ("stack",   "03-stack.html",  "?embed=1", False, 0),
    ("gallery", "gallery.html",   "",         False, 4),
]

CLEAN = """() => {
  const keep = new Set();
  document.querySelectorAll('canvas').forEach(c => { let e = c;
    while (e && e !== document.body) { keep.add(e); e = e.parentElement; } });
  [...document.body.querySelectorAll('*')].forEach(el => {
    if (keep.has(el)) return;
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed' || cs.position === 'absolute' || cs.position === 'sticky' ||
        el.querySelectorAll('input,select,button,label').length > 0 ||
        ['INPUT','SELECT','BUTTON','LABEL'].includes(el.tagName)) el.remove();
  });
  // служебные мини-канвасы (motion pad, кривая easing) — оставить только самый большой
  const arr = [...document.querySelectorAll('canvas')];
  let big = arr[0], ba = 0;
  arr.forEach(c => { const r = c.getBoundingClientRect();
    if (r.width * r.height > ba) { ba = r.width * r.height; big = c; } });
  arr.forEach(c => { if (c !== big) c.remove(); });
  // белые плашки-призраки
  [...document.body.querySelectorAll('*')].forEach(el => {
    if (keep.has(el) || (big && el.contains(big))) return;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    const opaque = cs.backgroundColor && !cs.backgroundColor.includes('rgba(0, 0, 0, 0)');
    if ((opaque || cs.boxShadow !== 'none') && r.width * r.height > 1500) el.remove();
  });
}"""

def biggest_index(page):
    return page.evaluate("""() => { let bi = -1, ba = 0;
      document.querySelectorAll('canvas').forEach((c, i) => {
        const r = c.getBoundingClientRect();
        if (r.width * r.height > ba) { ba = r.width * r.height; bi = i; } });
      return bi; }""")

def main():
    OUT.mkdir(exist_ok=True, parents=True)
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROMIUM,
                              args=["--use-gl=angle", "--no-sandbox"])
        # DPR 2 — для 2D-канваса; DPR 1 — для WebGL (иначе screenshot-таймаут)
        hi = b.new_page(viewport={"width": 1280, "height": 800}, device_scale_factor=2)
        lo = b.new_page(viewport={"width": 1280, "height": 800}, device_scale_factor=1)
        tall = b.new_page(viewport={"width": 1400, "height": 1000}, device_scale_factor=2)
        for pg in (hi, lo, tall): pg.set_default_timeout(90_000)

        for name, f, q, webgl, multi in SCENES:
            url = (SRC / f).absolute().as_uri() + q
            if multi:
                tall.goto(url); tall.wait_for_timeout(4500)
                cs = tall.locator("canvas"); n = cs.count()
                for j in range(min(multi, n)):
                    el = cs.nth(j)
                    el.scroll_into_view_if_needed(); tall.wait_for_timeout(1200)
                    el.screenshot(path=str(OUT / f"{name}_{j}.png"))
                print(f"{name}: {min(multi, n)} кадров из {n} канвасов")
            else:
                pg = lo if webgl else hi
                pg.goto(url); pg.wait_for_timeout(6000 if webgl else 4500)
                pg.evaluate(CLEAN); pg.wait_for_timeout(800)
                idx = biggest_index(pg)
                if idx >= 0:
                    pg.locator("canvas").nth(idx).screenshot(path=str(OUT / f"{name}.png"))
                else:
                    pg.screenshot(path=str(OUT / f"{name}.png"))
                print(f"{name}: ok (dpr {'1 webgl' if webgl else '2'})")
        b.close()

if __name__ == "__main__":
    main()
