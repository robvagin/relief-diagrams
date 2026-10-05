#!/usr/bin/env python3
"""Нормализация обложек: единый вес, единый фон, пропорциональный кроп.

Правь COVERS и константы сверху. Запуск: python3 normalize.py
"""
import numpy as np
from PIL import Image, ImageDraw

W, H = 1200, 750              # размер обложки
GROUND = (235, 232, 223)      # общий грунт набора
TARGET = 0.175                # целевой визуальный вес (доля закрытых пикселей)
MAX_FILL = 0.94               # потолок масштаба (поле ≥6%)

# name, файл, порог отличия от фона, чистить артефакты?, это фото?
COVERS = [
    ("sphere",  "raw/sphere.png",  22, False, True),
    ("stack",   "raw/stack.png",    6, False, False),
    ("gallery", "raw/gallery_0.png", 14, True, False),
]


def ghost_cut(img, zone=0.42, thr_var=26):
    """Правая граница светлой плашки-призрака в левой части кадра (легенда/панель,
    нарисованная ВНУТРИ канваса — DOM-чисткой её не убрать). 0 = плашки нет."""
    a = np.asarray(img.convert("RGB")).astype(np.int16)
    h, w, _ = a.shape
    left = a[:, :int(w * zone)]
    colvar, colmean = left.std(axis=(0, 2)), left.mean(axis=(0, 2))
    bgm = np.median(a[:, int(w * 0.55):].mean(axis=2))
    cand = np.where((colmean > bgm + 3) & (colvar < thr_var))[0]
    if len(cand) < 10:
        return 0
    return int(min(cand.max() + 6, w * zone))

def _bg(a):
    b = np.concatenate([a[:8].reshape(-1, 3), a[-8:].reshape(-1, 3),
                        a[:, :8].reshape(-1, 3), a[:, -8:].reshape(-1, 3)])
    return np.median(b, axis=0)

def load(path, thr, clean=False, photo=False, cut_ghost=True):
    """→ (обрезанный по контенту кадр, маска контента)"""
    im = Image.open(path).convert("RGB")
    if cut_ghost:
        cut = ghost_cut(im)
        if cut:
            im = im.crop((cut, 0, im.width, im.height))
    a = np.asarray(im).astype(np.int16)
    bg = _bg(a)
    d = np.abs(a - bg).sum(axis=2)
    if photo:
        src = im
    else:
        arr = np.clip(a - bg + np.array(GROUND, dtype=np.int16), 0, 255).astype(np.uint8)
        if clean:
            arr[d < thr + 8] = GROUND      # линии-разделители, сетки, шум фона
        src = Image.fromarray(arr)
    m = d > thr
    ys, xs = np.where(m.any(axis=1))[0], np.where(m.any(axis=0))[0]
    if not len(ys) or not len(xs):
        return src, m
    box = (xs[0], ys[0], xs[-1] + 1, ys[-1] + 1)
    return src.crop(box), m[box[1]:box[3], box[0]:box[2]]

def render(c, mask, scale):
    """вписать объект с долей scale, вернуть (кадр, вес)"""
    s = min(W * scale / c.width, H * scale / c.height)
    nw, nh = max(1, int(c.width * s)), max(1, int(c.height * s))
    mk = np.asarray(Image.fromarray((mask * 255).astype(np.uint8))
                    .resize((nw, nh), Image.NEAREST)) > 127
    cv = Image.new("RGB", (W, H), GROUND)
    cv.paste(c.resize((nw, nh), Image.LANCZOS), ((W - nw) // 2, (H - nh) // 2))
    return cv, mk.sum() / (W * H)

def make(name, path, thr, clean, photo, out_dir="covers"):
    """бинарным поиском подобрать масштаб под целевой ВЕС"""
    c, mask = load(path, thr, clean, photo)
    lo, hi, best = 0.30, MAX_FILL, None
    for _ in range(22):
        mid = (lo + hi) / 2
        img, cov = render(c, mask, mid)
        best = (img, cov, mid)
        if cov < TARGET: lo = mid
        else: hi = mid
    img, cov, sc = best
    img.save(f"{out_dir}/{name}.jpg", quality=88, optimize=True, progressive=True)
    print(f"{name:14s} вес {cov*100:4.1f}%  масштаб {sc*100:3.0f}%")

def contact_sheet(names, out="contact.png", cols=6, tw=240, th=150, src="covers"):
    """контактный лист — разнобой виден только в наборе"""
    rows = (len(names) + cols - 1) // cols
    sh = Image.new("RGB", (cols * tw, rows * (th + 18)), "#DDD9CE")
    d = ImageDraw.Draw(sh)
    for i, n in enumerate(names):
        im = Image.open(f"{src}/{n}.jpg").resize((tw - 6, th - 6))
        x, y = (i % cols) * tw, (i // cols) * (th + 18)
        sh.paste(im, (x + 3, y + 3)); d.text((x + 4, y + th - 2), n, fill="#403D38")
    sh.save(out); print("контактный лист →", out)

if __name__ == "__main__":
    import os
    os.makedirs("covers", exist_ok=True)
    for name, path, thr, clean, photo in COVERS:
        make(name, path, thr, clean, photo)
    contact_sheet([c[0] for c in COVERS])
