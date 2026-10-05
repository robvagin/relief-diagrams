// relief.js — временный рельс варианта (lab/desk, lab/ledger): свет §7.2, тени по приёмникам §7.3,
// материал §7.4, движение §7.5. Один свет на всё: каждая тень, кант и пятно выводятся из state L.
// После слияния рельса cloud/playground переезжает на src/light/, src/material/, src/motion/.
// Хексов здесь нет: цвета приходят из токен-блока страницы (:root и html.is-night).
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const smoothstep = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
  const smootherstep = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * k * (k * (k * 6 - 15) + 10); };

  // cubic-bezier(.23,1,.32,1): сборка и переходы §7.5
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = t => ((ax * t + bx) * t + cx) * t, sy = t => ((ay * t + by) * t + cy) * t;
    const dx = t => (3 * ax * t + 2 * bx) * t + cx;
    return function (x) {
      if (x <= 0) return 0; if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) { const e = sx(t) - x, d = dx(t); if (Math.abs(e) < 1e-6 || Math.abs(d) < 1e-6) break; t -= e / d; }
      return sy(clamp(t, 0, 1));
    };
  }
  const EASE = bezier(0.23, 1, 0.32, 1);

  // ── токены: читаются из CSS (единственный источник хексов) ──────────────
  function parseColor(s) {
    s = String(s || '').trim();
    let m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(s);
    if (m) return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
    m = /rgba?\(([^)]+)\)/.exec(s);
    if (m) { const p = m[1].split(',').map(parseFloat); return [p[0], p[1], p[2]]; }
    return [128, 128, 128];
  }
  const ACCENTS = ['terracotta', 'cobalt', 'olive'];
  function readTokens() {
    const cs = getComputedStyle(document.documentElement);
    const g = k => parseColor(cs.getPropertyValue('--r-' + k));
    const T = {
      ground: g('ground'), plate: g('plate'), ink: g('ink'), ink2: g('ink2'), ink3: g('ink3'),
      shadow: g('shadow'), light: g('light'), acc: {}
    };
    ACCENTS.forEach(a => { T.acc[a] = g('acc-' + a); });
    return T;
  }
  const rgba = (c, a) => 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + (a == null ? 1 : +a.toFixed(4)) + ')';
  const mix = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  const scl = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  function lum(c) {
    const f = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  }

  // ── пресеты света §6.3 ──────────────────────────────────────────────────
  const PRESETS = {
    soft:   { az: 135, elev: 42, soft: 0.28, dens: 0.20, amb: 0.72, pool: 0,    canopy: 0 },
    raking: { az: 160, elev: 22, soft: 0.20, dens: 0.26, amb: 0.66, pool: 0,    canopy: 0 },
    lamp:   { az: 135, elev: 42, soft: 0.30, dens: 0.30, amb: 0.40, pool: 0.55, lampH: 900, canopy: 0 },
    canopy: { az: 140, elev: 48, soft: 0.30, dens: 0.20, amb: 0.72, pool: 0,    canopy: 0.22 }
  };
  const LAMP_XY = [0.32, 0.28];

  // общие ряды §6.10 (грамматика панели v2), порядок групп §8 PANEL_V2
  const COMMON = {
    light: [
      ['light', 'Свет', ['soft', 'raking', 'lamp', 'canopy'], 'soft', ['Мягкий', 'Скользящий', 'Лампа', 'Листва']],
      ['az', 'Азимут, °', 0, 360, 1, 135, 'Откуда свет: 135 = слева сверху'],
      ['elev', 'Высота, °', 8, 80, 1, 42, 'Ниже солнце = длиннее тени'],
      ['soft', 'Мягкость', 0, 1, 0.01, 0.28, 'Рост полутени на пиксель высоты'],
      ['dens', 'Плотность тени', 0, 0.6, 0.01, 0.20],
      ['amb', 'Рассеянный', 0.2, 0.95, 0.01, 0.72],
      ['contact', 'Контакт', 0, 0.3, 0.01, 0.12, 'Тонкая тень у самой опоры'],
      ['pool', 'Пятно лампы', 0, 1, 0.01, 0],
      ['lampH', 'Высота лампы', 300, 2000, 10, 900],
      ['canopy', 'Листва', 0, 0.6, 0.01, 0, 'Пятна света сквозь крону'],
      ['temp', 'Температура', -1, 1, 0.01, 0.25, 'Тёплый свет, холодная тень']
    ],
    material: [
      ['grain', 'Зерно, %', 0, 4, 0.1, 1.6],
      ['uneven', 'Неровность, %', 0, 2, 0.1, 0.8],
      ['rim', 'Кант', 0, 1, 0.01, 0.5],
      ['radius', 'Радиус плашки', 0, 8, 0.5, 6],
      ['zscale', 'Шкала высот', 0, 2, 0.01, 1],
      ['accent', 'Акцент', ['terracotta', 'cobalt', 'olive'], 'terracotta', ['Терракота', 'Кобальт', 'Олива']],
      ['hand', 'Рука', 0, 1, 1, 0]
    ],
    motion: [
      ['float', 'Плавание', 0, 2, 0.01, 1],
      ['period', 'Период, с', 12, 72, 1, 36],
      ['sway', 'Качание, °', 0, 1.5, 0.05, 0.3],
      ['bob', 'Дыхание тени', 0, 0.2, 0.01, 0.08],
      ['settle', 'Оседание, с', 0.3, 2, 0.05, 0.9],
      ['assemble', 'Сборка', 0, 1, 1, 1]
    ],
    export: [
      ['format', 'Формат', ['screen', '16:9', '1:1', '4:5'], 'screen', ['Экран', '16:9', '1:1', '4:5']],
      ['scale', 'Масштаб', 1, 3, 1, 2]
    ]
  };

  // ── кадр и единицы §7.1 ─────────────────────────────────────────────────
  function frameOf(ctx) {
    const W = ctx.W, H = ctx.H, P = ctx.P;
    const ui = clamp(Math.min(W / 1440, H / 900), 0.34, 1.6);
    const u = Math.min(W, H) / 48;
    const m = 0.06 * Math.min(W, H);
    const zs = P.zscale * ui;
    return {
      W, H, ui, u, m, lineW: Math.max(1 / (window.devicePixelRatio || 1), 1.25 * ui),
      Z: [0, 4 * zs, 12 * zs, 28 * zs],
      content: { x: m, y: m, w: W - 2 * m, h: H - 2 * m }
    };
  }

  // ── свет §7.2 ───────────────────────────────────────────────────────────
  function lightOf(ctx, F) {
    const P = ctx.P, T = ctx.tok;
    const th = P.az * Math.PI / 180, ph = clamp(P.elev, 1, 89) * Math.PI / 180;
    const lamp = P.light === 'lamp';
    const temp = P.temp;
    // температура: освещённое тонируется lightTint, тень shadowTint; temp сдвигает оба от нейтрали
    const neutralShadow = [lum(T.shadow) * 255, lum(T.shadow) * 255, lum(T.shadow) * 255].map(v => Math.pow(v / 255, 1 / 2.2) * 255);
    const shadowTint = mix(neutralShadow, T.shadow, clamp(0.5 + 0.5 * temp, 0, 1));
    const lightTint = mix([255, 255, 255], T.light, clamp(temp, 0, 1));
    const E = P.amb + (1 - P.amb) * Math.sin(ph);
    const E0 = 0.72 + 0.28 * Math.sin(42 * Math.PI / 180);
    return {
      th, ph, lamp, cot: 1 / Math.tan(ph),
      d: [-Math.cos(th), Math.sin(th)],            // направление тени по плоскости
      lxy: [Math.cos(th), -Math.sin(th)],          // к свету по плоскости (экран)
      soft: P.soft, dens: P.dens, amb: P.amb, contact: P.contact,
      L: [LAMP_XY[0] * F.W, LAMP_XY[1] * F.H], HL: P.lampH * F.ui, pool: lamp ? P.pool : P.pool,
      canopy: P.canopy, E: clamp(E / E0, 0.6, 1.15),
      shadowTint, lightTint, Ys: lum(shadowTint)
    };
  }
  // сдвиг тени заслонителя с центром c на приёмник ниже на dh
  function shadowOffset(L, cx, cy, hc, dh) {
    if (L.lamp) {
      const k = dh / Math.max(1, L.HL - hc);
      return [(cx - L.L[0]) * k, (cy - L.L[1]) * k];
    }
    return [dh * L.cot * L.d[0], dh * L.cot * L.d[1]];
  }
  const sigmaOf = (L, dh) => 0.6 + L.soft * dh;
  const densOf = (L, dh) => L.dens * (1 - 0.35 * smoothstep(0, 40, dh));
  // к свету по плоскости для канта: у лампы своё направление на каждую плашку
  function toLight(L, cx, cy) {
    if (!L.lamp) return L.lxy;
    const dx = L.L[0] - cx, dy = L.L[1] - cy, n = Math.hypot(dx, dy) || 1;
    return [dx / n, dy / n];
  }

  // ── формы: прямоугольник, круг, дуга (кольцо) ──────────────────────────
  function shapePath(g, s, ox, oy) {
    ox = ox || 0; oy = oy || 0;
    g.beginPath();
    if (s.kind === 'circle') { g.arc(s.x + ox, s.y + oy, s.r, 0, TAU); return; }
    if (s.kind === 'arc') {
      const pad = s.pad || 0;
      const a0 = s.a0 + pad / Math.max(1, s.r1), a1 = s.a1 - pad / Math.max(1, s.r1);
      const b0 = s.a0 + pad / Math.max(1, s.r0), b1 = s.a1 - pad / Math.max(1, s.r0);
      if (a1 <= a0) return;
      g.arc(s.cx + ox, s.cy + oy, s.r1, a0, a1);
      g.arc(s.cx + ox, s.cy + oy, s.r0, Math.max(b0, b1), Math.min(b0, b1), true);
      g.closePath();
      return;
    }
    const r = Math.max(0, Math.min(s.rad || 0, s.w / 2, s.h / 2));
    if (g.roundRect) g.roundRect(s.x + ox, s.y + oy, s.w, s.h, r);
    else g.rect(s.x + ox, s.y + oy, s.w, s.h);
  }
  function shapeBox(s) {
    if (s.kind === 'circle') return { x: s.x - s.r, y: s.y - s.r, w: 2 * s.r, h: 2 * s.r };
    if (s.kind === 'arc') return { x: s.cx - s.r1, y: s.cy - s.r1, w: 2 * s.r1, h: 2 * s.r1 };
    return { x: s.x, y: s.y, w: s.w, h: s.h };
  }
  const shapeCenter = s => { const b = s.kind === 'arc' ? arcCenter(s) : null; if (b) return b; const q = shapeBox(s); return [q.x + q.w / 2, q.y + q.h / 2]; };
  function arcCenter(s) { const a = (s.a0 + s.a1) / 2, r = (s.r0 + s.r1) / 2; return [s.cx + Math.cos(a) * r, s.cy + Math.sin(a) * r]; }
  function moved(s, dx, dy) {
    const o = Object.assign({}, s);
    if (s.kind === 'arc') { o.cx += dx; o.cy += dy; } else { o.x += dx; o.y += dy; }
    return o;
  }
  function shapeKey(s) {
    if (s.kind === 'circle') return 'c' + s.r.toFixed(1);
    if (s.kind === 'arc') return 'a' + [s.r0, s.r1, s.a0, s.a1, s.pad || 0].map(v => v.toFixed(3)).join(',');
    return 'r' + [s.w, s.h, Math.min(s.rad || 0, s.w / 2, s.h / 2)].map(v => v.toFixed(1)).join(',');
  }

  // ── спрайты теней: кеш на (форма, σ с шагом 0,25 px, плотность с шагом 1/64) §7.3 ──
  // Спрайт непрозрачный: белое поле и размытая форма тоном X = 1 − m·(1 − shadowTint).
  // Тогда 'darken' даёт ровно попиксельный минимум X, то есть максимум затенения m:
  // объединение заслонителей = максимум, а не сумма (§7.3 п.3). Маска сразу готова к multiply.
  const SPR = new Map();
  const MS = 0.5;                                   // маски в ½ разрешения (§7.3: размытие прячет)
  function sprite(s, sigma, level, tint) {
    const sb = Math.max(0.25, Math.round(sigma * 4) / 4);
    const lv = Math.round(clamp(level, 0, 1) * 64) / 64;
    const key = shapeKey(s) + '|' + sb + '|' + lv + '|' + tint.map(Math.round).join(',');
    let e = SPR.get(key);
    if (e) return e;
    if (SPR.size > 900) SPR.clear();
    const b = shapeBox(s), pad = Math.ceil(sb * 3 + 2);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil((b.w + pad * 2) * MS)); c.height = Math.max(1, Math.ceil((b.h + pad * 2) * MS));
    const g = c.getContext('2d');
    g.fillStyle = 'white'; g.fillRect(0, 0, c.width, c.height);
    g.scale(MS, MS);
    g.filter = 'blur(' + sb + 'px)';
    g.fillStyle = rgba([255 - lv * (255 - tint[0]), 255 - lv * (255 - tint[1]), 255 - lv * (255 - tint[2])]);
    shapePath(g, s, pad - b.x, pad - b.y);
    g.fill();
    e = { c, ox: b.x - pad, oy: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 };
    SPR.set(key, e);
    return e;
  }

  // ── маска затенения приёмника ───────────────────────────────────────────
  const MASK = { c: null };
  function maskCanvas(w, h) {
    if (!MASK.c) MASK.c = document.createElement('canvas');
    const c = MASK.c;
    if (c.width < w || c.height < h) { c.width = Math.max(c.width, w); c.height = Math.max(c.height, h); }
    return c;
  }
  // receiver: null = пол (h = 0), иначе плашка; casters: [{s, h, rot}]
  function castShadows(g, ctx, F, L, receiver, casters) {
    const hr = receiver ? receiver.h : 0;
    const list = casters.filter(c => c.h > hr + 0.05 && c !== receiver);
    if (!list.length) return;
    const rb = receiver ? shapeBox(receiver.s) : { x: 0, y: 0, w: F.W, h: F.H };
    const area = { x: rb.x - 2, y: rb.y - 2, w: rb.w + 4, h: rb.h + 4 };
    // заслонители, чья тень вообще может достать приёмник; рамка маски = их объединение ∩ приёмник
    const hits = []; let ux0 = 1e9, uy0 = 1e9, ux1 = -1e9, uy1 = -1e9;
    list.forEach(c => {
      const dh = c.h - hr, cc = shapeCenter(c.s), o = shadowOffset(L, cc[0], cc[1], c.h, dh);
      const sg = sigmaOf(L, dh), cb = shapeBox(c.s), pad = sg * 3 + 3;
      const x0 = cb.x + Math.min(0, o[0]) - pad, x1 = cb.x + cb.w + Math.max(0, o[0]) + pad;
      const y0 = cb.y + Math.min(0, o[1]) - pad, y1 = cb.y + cb.h + Math.max(0, o[1]) + pad;
      if (x0 > area.x + area.w || x1 < area.x || y0 > area.y + area.h || y1 < area.y) return;
      ux0 = Math.min(ux0, x0); uy0 = Math.min(uy0, y0); ux1 = Math.max(ux1, x1); uy1 = Math.max(uy1, y1);
      hits.push({ c, dh, o, sg });
    });
    if (!hits.length) return;
    const bx = Math.floor(Math.max(area.x, ux0)), by = Math.floor(Math.max(area.y, uy0));
    const bw = Math.ceil(Math.min(area.x + area.w, ux1) - bx), bh = Math.ceil(Math.min(area.y + area.h, uy1) - by);
    if (bw <= 0 || bh <= 0) return;
    const mw = Math.ceil(bw * MS) + 1, mh = Math.ceil(bh * MS) + 1;
    const mc = maskCanvas(mw, mh), ma = mc.getContext('2d');
    ma.setTransform(1, 0, 0, 1, 0, 0); ma.globalCompositeOperation = 'source-over'; ma.globalAlpha = 1; ma.filter = 'none';
    ma.fillStyle = 'white'; ma.fillRect(0, 0, mw, mh);
    ma.globalCompositeOperation = 'darken';
    const k = 1 / Math.max(0.05, 1 - L.Ys), tint = L.shadowTint;
    const zu = 16 * Math.max(0.01, F.ui * ctx.P.zscale);
    hits.forEach(hh => {
      const c = hh.c, dh = hh.dh;
      const put = (sg, ox, oy, a) => {
        if (a <= 0.004) return;
        const sp = sprite(c.s, sg, a, tint);
        if (c.rot) {
          const cc = shapeCenter(c.s);
          ma.save();
          ma.scale(MS, MS);
          ma.translate(cc[0] + ox - bx, cc[1] + oy - by); ma.rotate(c.rot); ma.translate(-cc[0], -cc[1]);
          ma.drawImage(sp.c, sp.ox, sp.oy, sp.w, sp.h);
          ma.restore();
        } else ma.drawImage(sp.c, (sp.ox + ox - bx) * MS, (sp.oy + oy - by) * MS, sp.w * MS, sp.h * MS);
      };
      put(hh.sg, hh.o[0], hh.o[1], densOf(L, dh) * k);
      // контакт §7.3 п.4: узкая тень у опоры и «юбка» независимо от света
      if (dh <= zu + 0.01) {
        const cd = L.contact * Math.max(0, 1 - dh / zu);
        put(0.8 + 0.06 * dh, 0.25 * hh.o[0], 0.25 * hh.o[1], cd * k);
      }
      if (!receiver) put(2, 0, 0, 0.04 * k);
    });
    g.save();
    if (receiver) { plateClip(g, receiver); }
    g.globalCompositeOperation = 'multiply';
    g.imageSmoothingEnabled = true;
    g.drawImage(mc, 0, 0, bw * MS, bh * MS, bx, by, bw, bh);
    g.restore();
  }
  function plateClip(g, p) {
    if (p.rot) {
      const cc = shapeCenter(p.s);
      g.translate(cc[0], cc[1]); g.rotate(p.rot); g.translate(-cc[0], -cc[1]);
      shapePath(g, p.s); g.setTransform(g.getTransform()); g.clip();
      g.translate(cc[0], cc[1]); g.rotate(-p.rot); g.translate(-cc[0], -cc[1]);
    } else { shapePath(g, p.s); g.clip(); }
  }

  // ── материал §7.4: неровность и зерно ──────────────────────────────────
  const GRAIN = { img: null, pos: null, neg: null, ready: false };
  function loadGrain(src, onReady) {
    if (!src) return;
    const im = new Image();
    im.onload = function () {
      const n = im.width, c = document.createElement('canvas'); c.width = n; c.height = n;
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, n, n).data;
      const mk = (sign) => {
        const o = document.createElement('canvas'); o.width = n; o.height = n;
        const og = o.getContext('2d'), id = og.createImageData(n, n);
        for (let i = 0; i < n * n; i++) {
          const v = d[i * 4] / 255 - 0.5, a = Math.max(0, sign * v) * 2;
          const c8 = sign > 0 ? 255 : 0;
          id.data[i * 4] = c8; id.data[i * 4 + 1] = c8; id.data[i * 4 + 2] = c8; id.data[i * 4 + 3] = Math.round(a * 255);
        }
        og.putImageData(id, 0, 0);
        return o;
      };
      GRAIN.pos = mk(1); GRAIN.neg = mk(-1); GRAIN.ready = true;
      if (onReady) onReady();
    };
    im.src = src;
  }
  function drawGrain(g, ctx, amount, ox, oy) {
    if (!GRAIN.ready || amount <= 0) return;
    const c = ctx.canvas;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    [[GRAIN.pos, 1], [GRAIN.neg, 1]].forEach(([src]) => {
      const pat = g.createPattern(src, 'repeat');
      if (pat.setTransform) pat.setTransform(new DOMMatrix().translate(ox, oy));
      g.globalAlpha = clamp(amount / 100, 0, 1);
      g.fillStyle = pat; g.fillRect(0, 0, c.width, c.height);
    });
    g.restore();
  }
  // неровность: value-noise на масштабе ⅙ кадра, статичная (сид randNoise)
  const UNEVEN = { key: '', pos: null, neg: null };
  function drawUneven(g, F, vals, amount) {
    if (amount <= 0) return;
    const nx = 7, ny = 7;
    const key = F.W + 'x' + F.H + ':' + vals.slice(0, 4).map(v => v.toFixed(4)).join(',');
    if (UNEVEN.key !== key) {
      const mk = (sign) => {
        const c = document.createElement('canvas'); c.width = nx; c.height = ny;
        const cg = c.getContext('2d'), id = cg.createImageData(nx, ny);
        for (let i = 0; i < nx * ny; i++) {
          const v = vals[i] - 0.5, a = Math.max(0, sign * v) * 2, c8 = sign > 0 ? 255 : 0;
          id.data[i * 4] = c8; id.data[i * 4 + 1] = c8; id.data[i * 4 + 2] = c8; id.data[i * 4 + 3] = Math.round(a * 255);
        }
        cg.putImageData(id, 0, 0);
        return c;
      };
      UNEVEN.key = key; UNEVEN.pos = mk(1); UNEVEN.neg = mk(-1);
    }
    g.save();
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.globalAlpha = clamp(amount / 100, 0, 1);
    const cw = F.W / (nx - 1), ch = F.H / (ny - 1);
    g.drawImage(UNEVEN.pos, -cw / 2, -ch / 2, F.W + cw, F.H + ch);
    g.drawImage(UNEVEN.neg, -cw / 2, -ch / 2, F.W + cw, F.H + ch);
    g.restore();
  }

  // ── листва §7.2: маска G в ¼ разрешения, ветер §7.5 ────────────────────
  const CAN = { c: null };
  function drawCanopy(g, ctx, F, L, tsec) {
    if (L.canopy <= 0.001) return;
    const w = Math.max(2, Math.ceil(F.W / 4)), h = Math.max(2, Math.ceil(F.H / 4));
    if (!CAN.c) CAN.c = document.createElement('canvas');
    const c = CAN.c; if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const cg = c.getContext('2d');
    cg.setTransform(1, 0, 0, 1, 0, 0); cg.filter = 'none'; cg.globalCompositeOperation = 'source-over';
    cg.fillStyle = 'white'; cg.fillRect(0, 0, w, h);
    const P = ctx.P, Pd = P.period, wph = TAU * ((tsec % Pd) / Pd);
    const rn = ctx.randNoise;
    const sg = 0.035 * 600 * F.ui / 4;
    cg.filter = 'blur(' + sg.toFixed(2) + 'px)';
    cg.fillStyle = 'black';
    const kmax = Math.floor(0.5 * Pd);
    for (let i = 0; i < 70; i++) {
      const x = rn() * F.W, y = rn() * F.H, rx = (18 + rn() * 46) * F.ui, ry = rx * (0.5 + rn() * 0.5), a = rn() * Math.PI;
      const f1 = rn() * TAU, f2 = rn() * TAU, f3 = rn() * TAU, gust = 0.7 + 0.3 * Math.sin(wph + f1);
      let dx = 6 * Math.sin(wph + f1), dy = 6 * Math.cos(wph + f2);
      if (3 <= kmax) { dx += 2.5 * Math.sin(3 * wph + f2); dy += 2.5 * Math.cos(3 * wph + f3); }
      if (12 <= kmax) { dx += 0.8 * Math.sin(12 * wph + f3); dy += 0.8 * Math.cos(12 * wph + f1); }
      cg.beginPath();
      cg.ellipse((x + dx * gust * F.ui) / 4, (y + dy * gust * F.ui) / 4, rx / 4, ry / 4, a, 0, TAU);
      cg.fill();
    }
    cg.filter = 'blur(' + (sg * 0.35).toFixed(2) + 'px)';
    cg.fillStyle = 'white';
    for (let i = 0; i < 12; i++) {
      const x = rn() * F.W, y = rn() * F.H, r = (5 + rn() * 7) * F.ui, f = rn() * TAU;
      cg.beginPath(); cg.arc((x + 3 * Math.sin(wph + f)) / 4, (y + 3 * Math.cos(wph + f)) / 4, r / 4, 0, TAU); cg.fill();
    }
    g.save();
    g.globalCompositeOperation = 'multiply';
    g.globalAlpha = clamp(L.canopy * (1 - L.amb) * Math.sin(L.ph) * 3.2, 0, 0.9);
    g.imageSmoothingEnabled = true;
    g.drawImage(c, 0, 0, F.W, F.H);
    g.restore();
  }

  // ── движение §7.5 ───────────────────────────────────────────────────────
  // fpsNominal: медиана первых 20 интервалов rAF (метка кадра из аргумента rAF), 60 или 120
  const FPS = { v: 60, ts: [], done: false };
  function measureFps() {
    function tick(ts) {
      FPS.ts.push(ts);
      if (FPS.ts.length < 21) { requestAnimationFrame(tick); return; }
      const d = []; for (let i = 1; i < FPS.ts.length; i++) d.push(FPS.ts[i] - FPS.ts[i - 1]);
      d.sort((a, b) => a - b);
      const med = d[d.length >> 1];
      FPS.v = med > 0 && med < 12 ? 120 : 60; FPS.done = true;
    }
    requestAnimationFrame(tick);
  }
  const tsecOf = ctx => (ctx.capture ? ctx.t / 60 : ctx.t / FPS.v);
  // фазы φ1..φ10 на плашку: из ctx.rand в порядке id плашек
  function phases(ctx, n) {
    const out = [];
    for (let i = 0; i < n; i++) { const a = []; for (let k = 0; k < 10; k++) a.push(ctx.rand() * TAU); out.push(a); }
    return out;
  }
  // плавание плашки: гармоники одного периода, цикл замыкается ровно за P
  function floatOf(P, F, ph, w, h, hz, env, tsec) {
    if (env <= 0) return { dx: 0, dy: 0, rot: 0, dh: 0 };
    const wv = TAU * ((tsec % P.period) / P.period);
    const A = P.float * Math.min(2.4, 0.004 * Math.min(w, h)) * F.ui;
    const hm = (a, b, c) => 0.62 * Math.sin(wv + ph[a]) + 0.28 * Math.sin(2 * wv + ph[b]) + 0.10 * Math.sin(3 * wv + ph[c]);
    return {
      dx: env * A * hm(0, 1, 2),
      dy: env * A * hm(3, 4, 5),
      rot: env * (P.sway * Math.PI / 180) * (0.7 * Math.sin(wv + ph[6]) + 0.3 * Math.sin(2 * wv + ph[7])),
      dh: env * P.bob * hz * (0.7 * Math.sin(wv + ph[8]) + 0.3 * Math.sin(3 * wv + ph[9]))
    };
  }
  // сборка: подъём с h = 0 в порядке чтения, шаг 80 мс, 520 мс, cubic-bezier(.23,1,.32,1)
  function assembleK(P, reduced, order, tsec) {
    if (reduced || !P.assemble) return 1;
    return EASE((tsec - 0.25 - order * 0.08) / 0.52);
  }
  const assembleEnd = (P, n) => (P.assemble ? 0.25 + Math.max(0, n - 1) * 0.08 + 0.52 : 0);
  // оседание: env 1 → 0 за settle с по smootherstep
  const settleEnv = (P, t0, tsec) => 1 - smootherstep(t0, t0 + P.settle, tsec);
  // пружина ζ = 1, ω = 2π/0,5 с: точное решение скачка (перелёта нет)
  function spring(from, to, dt) {
    const w = TAU / 0.5;
    if (dt <= 0) return from;
    return to + (from - to) * (1 + w * dt) * Math.exp(-w * dt);
  }

  // ── сцена: пол → печать → тени на пол → плашки по возрастанию h ────────
  // plate: {id, s, h, rot, print(g, plate), env}
  function render(g, ctx, F, L, plates, opt) {
    opt = opt || {};
    const T = ctx.tok;
    const night = ctx.theme === 'night';
    // 1 · пол: альбедо × освещённость
    const ground = scl(T.ground, L.E), plateC = scl(T.plate, L.E);
    g.save();
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = rgba(ground); g.fillRect(0, 0, F.W, F.H);
    g.restore();
    // 2 · печать на полу
    if (opt.floor) { g.save(); opt.floor(g); g.restore(); }
    // 3–4 · тени и контакт на пол
    const casters = plates.filter(p => p.h > 0.05);
    castShadows(g, ctx, F, L, null, casters);
    // 5 · плашки по возрастанию h
    const order = plates.slice().sort((a, b) => a.h - b.h || (a.order || 0) - (b.order || 0));
    order.forEach(p => {
      const cc = shapeCenter(p.s);
      g.save();
      if (p.rot) { g.translate(cc[0], cc[1]); g.rotate(p.rot); g.translate(-cc[0], -cc[1]); }
      // 5.1 верх
      shapePath(g, p.s);
      g.fillStyle = rgba(p.fill ? scl(p.fill, L.E) : plateC);
      g.fill();
      // 5.2 печать на плашке
      if (p.print) { g.save(); shapePath(g, p.s); g.clip(); p.print(g, p); g.restore(); }
      g.restore();
      // 5.3–5.4 тени от всех плашек выше
      castShadows(g, ctx, F, L, p, casters);
      // 5.5 кант: светлый со стороны света, тёмный с другой
      if (ctx.P.rim > 0 && p.h > 0.05) {
        const l = toLight(L, cc[0], cc[1]);
        g.save();
        if (p.rot) { g.translate(cc[0], cc[1]); g.rotate(p.rot); g.translate(-cc[0], -cc[1]); }
        shapePath(g, p.s); g.clip();
        g.lineWidth = 0.75;
        g.strokeStyle = rgba(L.lightTint, (night ? 0.3 : 0.6) * ctx.P.rim);
        shapePath(g, p.s, -0.5 * l[0], -0.5 * l[1]); g.stroke();
        g.strokeStyle = rgba(L.shadowTint, 0.35 * ctx.P.rim);
        shapePath(g, p.s, 0.5 * l[0], 0.5 * l[1]); g.stroke();
        g.restore();
      }
      if (p.over) { g.save(); p.over(g, p); g.restore(); }
    });
    // пятно лампы: освещённость ∝ (H/√(r²+H²))³, lit = mix(1, E^0.6, pool)
    if (L.pool > 0.001) {
      const HL = Math.max(10, L.HL), R = Math.hypot(F.W, F.H);
      const gr = g.createRadialGradient(L.L[0], L.L[1], 0, L.L[0], L.L[1], R);
      for (let i = 0; i <= 8; i++) {
        const r = R * i / 8, E = Math.pow(HL / Math.hypot(r, HL), 3), lit = lerp(1, Math.pow(E, 0.6), L.pool);
        gr.addColorStop(i / 8, rgba(scl(L.lightTint, lit)));
      }
      g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = gr; g.fillRect(0, 0, F.W, F.H); g.restore();
    } else if (ctx.P.temp > 0) {
      g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = rgba(L.lightTint); g.globalAlpha = 0.5; g.fillRect(0, 0, F.W, F.H); g.restore();
    }
    // 6 · листва и зерно последними
    drawCanopy(g, ctx, F, L, opt.tsec || 0);
    if (opt.uneven) drawUneven(g, F, opt.uneven, ctx.P.uneven);
    drawGrain(g, ctx, ctx.P.grain * (night ? 1.375 : 1), opt.gox || 0, opt.goy || 0);
    // 7 · слой взаимодействия
    if (opt.top) { g.save(); opt.top(g); g.restore(); }
  }

  window.RELIEF = {
    TAU, clamp, lerp, smoothstep, smootherstep, EASE, bezier, rgba, mix, scl, lum, parseColor,
    readTokens, PRESETS, COMMON, LAMP_XY, frameOf, lightOf, shadowOffset, sigmaOf, densOf,
    shapePath, shapeBox, shapeCenter, moved, castShadows, render, loadGrain, drawGrain, drawUneven, drawCanopy,
    measureFps, FPS, tsecOf, phases, floatOf, assembleK, assembleEnd, settleEnv, spring
  };
})();
