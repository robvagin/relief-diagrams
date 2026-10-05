/* relief-lite.js — свет, материал, движение и обвязка панели v2 для вариантов cascade и stack.
   Временный рельс внутри варианта (приказ владельца 2026-10-05 (2)): после слияния cloud/playground
   свет переезжает на src/light/. Формулы README §7.2–7.5 дословно, один свет на кадр (L1):
   каждая тень, кант и пятно выводятся из одного объекта light, ручных теней нет.
   Глобали: window.RL (движок кадра) и window.DG.panel (адаптер панели v2 к kit-scene, §7.11). */
(function () {
  'use strict';
  const D2R = Math.PI / 180, TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const mix = (a, b, t) => a + (b - a) * t;
  const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const smootherstep = (x) => { x = clamp(x, 0, 1); return x * x * x * (x * (x * 6 - 15) + 10); };

  // cubic-bezier(.23,1,.32,1) — кривая сборки и переходов (§8)
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const fx = (t) => ((ax * t + bx) * t + cx) * t;
    const fy = (t) => ((ay * t + by) * t + cy) * t;
    const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return function (x) {
      x = clamp(x, 0, 1);
      let t = x;
      for (let i = 0; i < 8; i++) { const e = fx(t) - x, d = dx(t); if (Math.abs(e) < 1e-6 || Math.abs(d) < 1e-6) break; t -= e / d; }
      return fy(clamp(t, 0, 1));
    };
  }
  const EASE = bezier(0.23, 1, 0.32, 1);

  // ── пресеты света §6.3 ────────────────────────────────────────────────
  const PRESETS = {
    soft:   { az: 135, elev: 42, soft: 0.28, dens: 0.20, amb: 0.72, pool: 0,    canopy: 0 },
    raking: { az: 160, elev: 22, soft: 0.20, dens: 0.26, amb: 0.66, pool: 0,    canopy: 0 },
    lamp:   { az: 135, elev: 42, soft: 0.30, dens: 0.30, amb: 0.40, pool: 0.55, canopy: 0, lampH: 900 },
    canopy: { az: 140, elev: 48, soft: 0.30, dens: 0.20, amb: 0.72, pool: 0,    canopy: 0.22 }
  };

  // ── общие ручки §6.10 (грамматика панели v2): один источник с паспортом, common.params.json ─
  const COMMON = window.RELIEF_PARAMS.common;
  const FORMATS = { '16:9': [1920, 1080], '1:1': [1080, 1080], '4:5': [1080, 1350] };

  // декларация v2 → плоская форма kit (шесть элементов): дефолты и паспорт читает kit-scene
  function toKit(d) {
    if (Array.isArray(d[2])) return [d[0], d[1], d[2].slice(), { default: d[3] }];
    return [d[0], d[1], d[2], d[3], d[4], d[5]];
  }
  function defaultsOf(groups) {
    const out = {};
    groups.forEach((gr) => gr.rows.forEach((d) => { out[d[0]] = Array.isArray(d[2]) ? d[3] : d[5]; }));
    return out;
  }

  // ── цвета: токены сцены из CSS (хексы только в page.css) ─────────────
  const probe = document.createElement('canvas').getContext('2d');
  function rgb(css) {
    probe.fillStyle = 'black'; probe.fillStyle = css;
    const s = probe.fillStyle;
    if (s[0] === '#') return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
    const m = s.match(/[\d.]+/g); return [+m[0], +m[1], +m[2]];
  }
  const css = (c, a) => 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + (a == null ? 1 : +a.toFixed(4)) + ')';
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  let TOK = null, TOKTHEME = null;
  function tokens(theme) {
    if (TOK && TOKTHEME === theme) return TOK;
    const cs = getComputedStyle(document.documentElement);
    const v = (k) => rgb(cs.getPropertyValue(k).trim());
    TOK = {
      ground: v('--r-ground'), plate: v('--r-plate'), ink: v('--r-ink'), ink2: v('--r-ink2'), ink3: v('--r-ink3'),
      shadow: v('--r-shadow'), light: v('--r-light'),
      acc: { terracotta: v('--r-acc-terracotta'), cobalt: v('--r-acc-cobalt'), olive: v('--r-acc-olive') }
    };
    TOKTHEME = theme;
    return TOK;
  }

  // ── время: fpsNominal по медиане первых 20 интервалов rAF (§7.5) ──────
  let FPS = 60;
  (function measure() {
    const ts = [];
    function tick(t) { ts.push(t); if (ts.length < 21) requestAnimationFrame(tick); else {
      const d = []; for (let i = 1; i < ts.length; i++) d.push(ts[i] - ts[i - 1]);
      d.sort((a, b) => a - b); const med = d[10];
      FPS = med > 0 && med < 12 ? 120 : 60;
    } }
    if (window.requestAnimationFrame) requestAnimationFrame(tick);
  })();

  // ── офскрины ─────────────────────────────────────────────────────────
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; }
  const MASK = { c: null, g: null };
  function mask(W, H) {
    if (!MASK.c || MASK.c.width !== W || MASK.c.height !== H) { MASK.c = canvas(W, H); MASK.g = MASK.c.getContext('2d'); }
    return MASK;
  }

  // зерно: синий шум 128 физ. px, знаковое наложение двумя проходами (lighter + multiply)
  const NOISE = { key: '', plus: null, minus: null };
  function noiseTiles(g, amt) {
    const key = amt.toFixed(3);
    if (NOISE.key === key) return NOISE;
    const N = window.RELIEF_NOISE, s = N.size, hx = N.hex;
    const p = canvas(s, s), m = canvas(s, s), pi = p.getContext('2d').createImageData(s, s), mi = m.getContext('2d').createImageData(s, s);
    for (let i = 0; i < s * s; i++) {
      const n = parseInt(hx.substr(i * 2, 2), 16) / 255 - 0.5;
      const up = Math.max(0, n) * 2 * amt * 255, dn = 255 * (1 - Math.max(0, -n) * 2 * amt);
      pi.data[i * 4] = pi.data[i * 4 + 1] = pi.data[i * 4 + 2] = up; pi.data[i * 4 + 3] = 255;
      mi.data[i * 4] = mi.data[i * 4 + 1] = mi.data[i * 4 + 2] = dn; mi.data[i * 4 + 3] = 255;
    }
    p.getContext('2d').putImageData(pi, 0, 0); m.getContext('2d').putImageData(mi, 0, 0);
    NOISE.key = key; NOISE.plus = g.createPattern(p, 'repeat'); NOISE.minus = g.createPattern(m, 'repeat');
    return NOISE;
  }

  // неровность: value-noise на масштабе ⅙ кадра, статичная, из потока randNoise
  function unevenTiles(ctx, amt) {
    const n = 7, a = canvas(n, n), b = canvas(n, n);
    const ai = a.getContext('2d').createImageData(n, n), bi = b.getContext('2d').createImageData(n, n);
    for (let i = 0; i < n * n; i++) {
      const v = ctx.randNoise() * 2 - 1;
      const up = Math.max(0, v) * amt * 255, dn = 255 * (1 - Math.max(0, -v) * amt);
      ai.data[i * 4] = ai.data[i * 4 + 1] = ai.data[i * 4 + 2] = up; ai.data[i * 4 + 3] = 255;
      bi.data[i * 4] = bi.data[i * 4 + 1] = bi.data[i * 4 + 2] = dn; bi.data[i * 4 + 3] = 255;
    }
    a.getContext('2d').putImageData(ai, 0, 0); b.getContext('2d').putImageData(bi, 0, 0);
    return { plus: a, minus: b };
  }

  // ── свет кадра: одно состояние на всё (L1) ───────────────────────────
  function lightOf(ctx) {
    const P = ctx.P, W = ctx.W, H = ctx.H;
    const S = clamp(Math.min(W / 1440, H / 900), 0.34, 1.6);
    const th = P.az * D2R, ph = clamp(P.elev, 1, 89) * D2R;
    const lamp = P.light === 'lamp';
    const T = tokens(ctx.theme);
    const temp = clamp(P.temp, -1, 1);
    // температура: тёплый свет и холодная тень сдвигаются от нейтрали вместе
    const neutral = (c) => { const y = Math.pow(lum(c), 1 / 2.2) * 255; return [y, y, y]; };
    const lt = [0, 1, 2].map((i) => mix(255, T.light[i], clamp(0.5 + 0.5 * temp, 0, 1)));
    const nt = neutral(T.shadow);
    const st = [0, 1, 2].map((i) => mix(nt[i], T.shadow[i], clamp(0.5 + 0.5 * temp, 0, 1)));
    return {
      S, W, H, th, ph, lamp, temp,
      lx: Math.cos(th), ly: -Math.sin(th),             // направление к свету на экране
      dx: -Math.cos(th), dy: Math.sin(th),             // направление тени по плоскости
      cot: 1 / Math.tan(ph), sin: Math.sin(ph),
      soft: P.soft, dens: P.dens, amb: P.amb, contact: P.contact, rim: P.rim,
      Lx: 0.32 * W, Ly: 0.28 * H, LH: P.lampH * S, pool: lamp ? P.pool : P.pool * 0,
      canopy: P.canopy, lightTint: lt, shadowTint: st, Yst: lum(st) , T,
      lineW: Math.max(1.25 * S, 1 / Math.min(2, window.devicePixelRatio || 1))
    };
  }
  // сдвиг тени для заслонителя c (центр cx,cy на высоте hc) над приёмником на высоте hr
  function offset(L, cx, cy, hc, hr) {
    const dh = Math.max(0, hc - hr);
    if (L.lamp) { const k = dh / Math.max(1, L.LH - hc); return [(cx - L.Lx) * k, (cy - L.Ly) * k]; }
    return [dh * L.cot * L.dx, dh * L.cot * L.dy];
  }
  const sigma = (L, dh) => 0.6 + L.soft * dh;
  // высота для света: у разнесённого вида (stack) геометрия поднята для чтения, а свет считается
  // по лестнице высот z0–z3 (L5); у остальных сцен это одна и та же высота
  const lh = (p) => (p.hl != null ? p.hl : p.h);
  const density = (L, dh) => L.dens * (1 - 0.35 * smoothstep(0, 40, dh / L.S));
  // маска: тон shadowTint с альфой a = D/(1 − Y(tint)); на белом darken и multiply дают 1 − a·(1 − tint).
  // Спрайт хранит форму в чистом тоне, плотность едет альфой: кеш не зависит от плотности
  const shade = (L, D) => clamp(D / Math.max(0.05, 1 - L.Yst), 0, 1);
  function lightDir(L, x, y) {
    if (!L.lamp) return [L.lx, L.ly];
    const vx = L.Lx - x, vy = L.Ly - y, n = Math.hypot(vx, vy) || 1;
    return [vx / n, vy / n];
  }

  // ── камера: орто сверху, у stack наклон τ (§7.3): screen_y = y·cos τ − h·sin τ ─
  function camera(tilt, y0) { const t = clamp(tilt || 0, 0, 80) * D2R; return { cos: Math.cos(t), sin: Math.sin(t), y0: y0 || 0, tilt: t }; }
  const FLAT = camera(0, 0);
  function onPlane(g, cam, h) { g.transform(1, 0, 0, cam.cos, 0, cam.y0 * (1 - cam.cos) - h * cam.sin); }
  function project(cam, x, y, h) { return [x, cam.y0 + (y - cam.y0) * cam.cos - h * cam.sin]; }

  // путь плашки в мировых координатах (центр x,y); disc | rect
  function trace(g, p, ox, oy, grow) {
    const e = grow || 0;
    g.beginPath();
    if (p.kind === 'disc') { g.arc(p.x + ox, p.y + oy, Math.max(0.5, p.r + e), 0, TAU); return; }
    const w = p.w + 2 * e, d = p.d + 2 * e, r = clamp((p.rad || 0) + e, 0, Math.min(w, d) / 2);
    if (p.rot) {
      const c = Math.cos(p.rot), s = Math.sin(p.rot), x0 = p.x + ox, y0 = p.y + oy;
      const pts = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
      if (r < 0.5) { pts.forEach((q, i) => { const X = x0 + q[0] * c - q[1] * s, Y = y0 + q[0] * s + q[1] * c; i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.closePath(); return; }
      // скруглённый поворот: дуги по углам
      const cr = [[w / 2 - r, -d / 2 + r, -90], [w / 2 - r, d / 2 - r, 0], [-w / 2 + r, d / 2 - r, 90], [-w / 2 + r, -d / 2 + r, 180]];
      cr.forEach((q) => { const X = x0 + q[0] * c - q[1] * s, Y = y0 + q[0] * s + q[1] * c; const a0 = q[2] * D2R + p.rot; g.arc(X, Y, r, a0, a0 + Math.PI / 2); });
      g.closePath(); return;
    }
    g.roundRect(p.x + ox - w / 2, p.y + oy - d / 2, w, d, r);
  }
  function bbox(p) {
    if (p.kind === 'disc') return [p.x - p.r, p.y - p.r, p.x + p.r, p.y + p.r];
    const e = p.rot ? Math.hypot(p.w, p.d) / 2 : 0;
    return e ? [p.x - e, p.y - e, p.x + e, p.y + e] : [p.x - p.w / 2, p.y - p.d / 2, p.x + p.w / 2, p.y + p.d / 2];
  }

  // спрайт размытой формы (кеш по форме, корзине σ 0,25 px и наклону, §7.3): плавание двигает спрайт,
  // перерисовка только при смене корзины. Наклон камеры аффинный, поэтому спрайт рисуется
  // в проекции плоскости (y × cos τ) и ставится в проекцию центра заслонителя
  const SPR = new Map();
  function sprite(p, sg, col, cos) {
    // корзины σ: 0,25 px до 4 px, дальше логарифмически (шаг ≈ 4,4 %): широкая полутень глазом не различима
    const sb = sg < 4 ? Math.round(sg * 4) / 4 : Math.pow(2, Math.round(Math.log2(sg) * 16) / 16), cb = Math.round(cos * 1000) / 1000;
    const key = (p.kind === 'disc' ? 'd' + p.r.toFixed(1) : 'r' + p.w.toFixed(1) + 'x' + p.d.toFixed(1) + 'r' + (p.rad || 0).toFixed(1)) + '|' + sb.toFixed(2) + '|' + cb + '|' + col.map((v) => v | 0).join(',');
    let s = SPR.get(key);
    if (s) return s;
    const q = Object.assign({}, p, { x: 0, y: 0, rot: 0 });
    const b = bbox(q), pad = Math.ceil(3 * sb + 2);
    const w = b[2] - b[0] + 2 * pad, h = (b[3] - b[1]) * cb + 2 * pad;
    // широкое размытие считается в уменьшенном спрайте и растягивается билинейно (бюджет кадра §7.3)
    const f = clamp(3 / Math.max(sb, 0.01), 0.1, 1);
    const c = canvas(Math.ceil(w * f), Math.ceil(h * f)), g = c.getContext('2d');
    g.filter = sb > 0.05 ? 'blur(' + (sb * f).toFixed(2) + 'px)' : 'none';
    g.fillStyle = css(col);
    g.setTransform(f, 0, 0, cb * f, (pad - b[0]) * f, (pad - b[1] * cb) * f);
    trace(g, q, 0, 0, 0);
    g.fill();
    s = { c, ox: b[0] - pad, oy: b[1] * cb - pad, w: c.width / f, h: c.height / f };
    if (SPR.size > 600) SPR.clear();
    SPR.set(key, s);
    return s;
  }

  // одна тень формы p в маску m: сдвиг o (мир), размытие σ, цвет маски col, приёмник на высоте hr
  function castInto(m, cam, p, o, sg, a, hr, tint) {
    if (a <= 0.001) return;
    const s = sprite(p, sg, tint, cam.cos), c = project(cam, p.x + o[0], p.y + o[1], hr);
    m.globalAlpha = a;
    m.drawImage(s.c, c[0] + s.ox, c[1] + s.oy, s.w, s.h);
    m.globalAlpha = 1;
  }

  // тени всех заслонителей на приёмник в маску (объединение = максимум: darken).
  // recv = null → пол. У разнесённого вида (stack) пол под каждым слоем свой: тень на пол
  // считается по высоте лестницы hl и едет вместе со слоем; тень слоя на слой — по честной Δh
  function shadowMask(L, cam, M, plates, recv, rect) {
    const m = M.g;
    m.setTransform(1, 0, 0, 1, 0, 0);
    m.globalCompositeOperation = 'source-over';
    m.filter = 'none';
    m.fillStyle = 'white';
    m.fillRect(0, 0, M.c.width, M.c.height);
    m.setTransform(1, 0, 0, 1, -rect[0], -rect[1]);
    const hr = recv ? recv.h : 0;
    const geo = (c) => recv ? { dh: c.h - hr, at: hr, base: hr } : { dh: lh(c), at: c.h - lh(c), base: 0 };
    m.globalCompositeOperation = 'darken';
    for (const c of plates) {
      const q = geo(c);
      if (q.dh <= 0.01) continue;
      const o = offset(L, c.x, c.y, q.base + q.dh, q.base);
      castInto(m, cam, c, o, sigma(L, q.dh), shade(L, density(L, q.dh)), q.at, L.shadowTint);
    }
    // контакт у опоры: узкая тень σ = 0,8 + 0,06·h, сдвиг 0,25·o, плотность contact·(1 − h/16)₊;
    // юбка σ 2 px плотностью 0,04 независимо от света (небо загорожено у опоры)
    m.globalCompositeOperation = 'multiply';
    for (const c of plates) {
      const q = geo(c);
      if (q.dh <= 0.01) continue;
      if (recv && q.dh > 16 * L.S) continue;
      const k = L.contact * Math.max(0, 1 - q.dh / (16 * L.S));
      const o = offset(L, c.x, c.y, q.base + q.dh, q.base);
      if (k > 0.002) castInto(m, cam, c, [o[0] * 0.25, o[1] * 0.25], 0.8 + 0.06 * q.dh, shade(L, k), q.at, L.shadowTint);
      castInto(m, cam, c, [0, 0], 2 * L.S, shade(L, 0.04), q.at, L.shadowTint);
    }
    m.globalCompositeOperation = 'source-over';
    m.filter = 'none';
    return true;
  }

  // ── кадр целиком: painter снизу вверх (§7.3) ──────────────────────────
  // scene = { plates:[{id,kind,x,y,r|w,d,rad,h,thick,print(g)}], floor(g,L), over(g,L), cam }
  function render(ctx, scene) {
    const g = ctx.g, W = ctx.W, H = ctx.H, P = ctx.P;
    const L = lightOf(ctx), T = L.T, cam = scene.cam || FLAT;
    const plates = scene.plates.slice().sort((a, b) => (a.h - b.h) || (a.y - b.y) || (a.x - b.x));

    // 1 · пол: альбедо, тёплый свет
    g.save();
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = css(T.ground); g.fillRect(0, 0, W, H);
    // 2 · печать на полу
    if (scene.floor) { g.save(); scene.floor(g, L); g.restore(); }
    // 3–4 · тени на пол и контакт: одна маска, один multiply
    const M = mask(W, H);
    if (shadowMask(L, cam, M, plates, null, [0, 0])) {
      g.globalCompositeOperation = 'multiply'; g.drawImage(M.c, 0, 0, W, H); g.globalCompositeOperation = 'source-over';
    }
    // 5 · плашки по возрастанию h
    const lit = T.plate;
    for (let i = 0; i < plates.length; i++) {
      const p = plates[i];
      if (p.h <= 0.01 && !p.flatPlate) continue;
      // торец толщины 3 px виден только при наклоне: грань светлеет по своей нормали к l
      if (cam.tilt > 0 && p.kind === 'rect') {
        const th = (p.thick || 3) * L.S;
        const nl = -Math.cos(L.ph) * Math.sin(L.th) * -1;       // нормаль торца +y к свету
        const E = L.amb + (1 - L.amb) * Math.max(0, -nl);
        const Etop = L.amb + (1 - L.amb) * L.sin;
        const k = E / Etop;
        g.save();
        g.fillStyle = css(lit.map((v) => v * k));
        for (let s = th; s > 0; s -= Math.max(0.5, th / 4)) { g.save(); onPlane(g, cam, p.h - s); trace(g, p, 0, 0, 0); g.fill(); g.restore(); }
        g.restore();
      }
      // 5.1 · верх
      g.save(); onPlane(g, cam, p.h); trace(g, p, 0, 0, 0); g.fillStyle = css(lit); g.fill();
      // 5.2 · печать на плашке
      g.clip();
      if (p.print) { g.save(); p.print(g, L, p); g.restore(); }
      g.restore();
      // 5.3–5.4 · тени выше лежащих плашек на этот приёмник, клип по верху
      const above = plates.filter((c) => c.h > p.h + 0.01 && overlaps(L, cam, c, p));
      if (above.length) {
        const b = screenBox(cam, p, p.h), pad = 2;
        const rect = [Math.floor(b[0] - pad), Math.floor(b[1] - pad), Math.ceil(b[2] + pad), Math.ceil(b[3] + pad)];
        const MW = rect[2] - rect[0], MH = rect[3] - rect[1];
        if (MW > 0 && MH > 0) {
          const R = recv(MW, MH);
          shadowMask(L, cam, R, above, p, rect);
          const base = g.getTransform();
          g.save(); onPlane(g, cam, p.h); trace(g, p, 0, 0, 0); g.clip(); g.setTransform(base);
          g.globalCompositeOperation = 'multiply'; g.drawImage(R.c, rect[0], rect[1]); g.restore();
        }
      }
      // 5.5 · кант: светлый со стороны света, тёмный с другой, оба с клипом по верху (L3: обводок нет)
      if (L.rim > 0) {
        const ld = lightDir(L, p.x, p.y), lw = 0.75;
        g.save(); onPlane(g, cam, p.h); trace(g, p, 0, 0, 0); g.clip();
        g.lineWidth = lw;
        g.strokeStyle = css(L.lightTint, 0.6 * L.rim); trace(g, p, -0.5 * ld[0], -0.5 * ld[1], 0); g.stroke();
        g.strokeStyle = css(L.shadowTint, 0.35 * L.rim); trace(g, p, 0.5 * ld[0], 0.5 * ld[1], 0); g.stroke();
        g.restore();
      }
    }
    // 6 · пятно лампы, листва, тёплый свет, неровность и зерно последними
    if (L.lamp && L.pool > 0) lampPool(g, L);
    if (L.canopy > 0) canopy(ctx, g, L);
    if (L.temp > 0) { g.globalCompositeOperation = 'multiply'; g.fillStyle = css(L.lightTint, 0.6 * L.temp); g.fillRect(0, 0, W, H); }
    g.globalCompositeOperation = 'source-over';
    // 7 · слой взаимодействия и подписи поверх света
    if (scene.over) { g.save(); scene.over(g, L); g.restore(); }
    texture(ctx, g, P);
    g.restore();
    return L;
  }
  const RECV = { c: null, g: null };
  function recv(w, h) {
    if (!RECV.c || RECV.c.width < w || RECV.c.height < h) { RECV.c = canvas(Math.max(w, RECV.c ? RECV.c.width : 0), Math.max(h, RECV.c ? RECV.c.height : 0)); RECV.g = RECV.c.getContext('2d'); }
    return RECV;
  }
  function screenBox(cam, p, h) {
    const b = bbox(p), a = project(cam, b[0], b[1], h), c = project(cam, b[2], b[3], h);
    return [a[0], Math.min(a[1], c[1]), c[0], Math.max(a[1], c[1])];
  }
  function overlaps(L, cam, c, r) {
    const o = offset(L, c.x, c.y, c.h, r.h), sg = sigma(L, c.h - r.h) * 3 + 2;
    const a = bbox(c), b = bbox(r);
    return a[0] + o[0] - sg < b[2] && a[2] + o[0] + sg > b[0] && a[1] + o[1] - sg < b[3] && a[3] + o[1] + sg > b[1];
  }

  function lampPool(g, L) {
    // E(p) ∝ (H_L − h)/|P_L − p|³, нормировано на 1 под лампой; lit = mix(1, E^0.6, pool)
    const R = Math.hypot(L.W, L.H) * 1.2, gr = g.createRadialGradient(L.Lx, L.Ly, 0, L.Lx, L.Ly, R);
    for (let i = 0; i <= 12; i++) {
      const r = (i / 12) * R, E = Math.pow(L.LH / Math.hypot(L.LH, r), 3), lit = mix(1, Math.pow(E, 0.6), L.pool);
      const v = Math.round(255 * clamp(lit, 0, 1));
      gr.addColorStop(i / 12, css([v, v, v]));
    }
    g.globalCompositeOperation = 'multiply'; g.fillStyle = gr; g.fillRect(0, 0, L.W, L.H); g.globalCompositeOperation = 'source-over';
  }

  // листва §7.2: маска G в ¼ разрешения, 70 кластеров 18–64 px, σ_g = 0,035·H_c, 12 зайчиков; ветер §7.5
  const CAN = { c: null, g: null };
  function canopy(ctx, g, L) {
    const w = Math.ceil(L.W / 4), h = Math.ceil(L.H / 4);
    if (!CAN.c || CAN.c.width !== w || CAN.c.height !== h) { CAN.c = canvas(w, h); CAN.g = CAN.c.getContext('2d'); }
    const m = CAN.g, P = ctx.P, tsec = ctx.reduced ? 0 : ctx.t / FPS, Pd = Math.max(1, P.period);
    const wv = TAU * ((tsec % Pd) / Pd);
    const kmax = Math.floor(0.5 * Pd);
    const Etop = L.amb + (1 - L.amb) * L.sin, dark = L.amb / Etop;
    m.setTransform(1, 0, 0, 1, 0, 0); m.filter = 'none'; m.globalCompositeOperation = 'source-over';
    m.fillStyle = 'white'; m.fillRect(0, 0, w, h);
    m.filter = 'blur(' + (0.035 * 600 * L.S / 4).toFixed(2) + 'px)';
    const v = Math.round(255 * dark), a = clamp(L.canopy / 0.6, 0, 1);
    m.fillStyle = css([v, v, v], a);
    const r = ctx.randNoise;
    for (let i = 0; i < 70; i++) {
      const x = r() * w, y = r() * h, rx = (18 + r() * 46) * L.S / 4, ry = rx * (0.5 + r() * 0.5), rot = r() * Math.PI, f1 = r() * TAU, f2 = r() * TAU, f3 = r() * TAU, fg = r() * TAU;
      const gust = 0.7 + 0.3 * Math.sin(wv + fg);
      let ox = 6 * Math.sin(wv + f1);
      if (kmax >= 3) ox += 2.5 * Math.sin(3 * wv + f2);
      if (kmax >= 12) ox += 0.8 * Math.sin(12 * wv + f3);
      ox *= gust * L.S / 4;
      m.beginPath(); m.ellipse(x + ox, y + ox * 0.4, rx, ry, rot, 0, TAU); m.fill();
    }
    m.filter = 'blur(' + (2 * L.S / 4).toFixed(2) + 'px)';
    m.fillStyle = 'white';
    for (let i = 0; i < 12; i++) { const x = r() * w, y = r() * h, rr = (3 + r() * 5) * L.S / 4; m.beginPath(); m.arc(x, y, rr, 0, TAU); m.fill(); }
    m.filter = 'none';
    g.save(); g.globalCompositeOperation = 'multiply'; g.imageSmoothingEnabled = true; g.drawImage(CAN.c, 0, 0, L.W, L.H); g.restore();
  }

  // материал: неровность ±uneven % на масштабе ⅙ кадра и зерно ±grain % синим шумом, статичные.
  // Статичное собирается один раз в два полноэкранных слоя (плюс и минус), кадр платит два блита (§7.3 кеш)
  const TEX = { key: '', plus: null, minus: null };
  function texture(ctx, g, P) {
    const cw = ctx.canvas.width, ch = ctx.canvas.height;
    if (!(P.uneven > 0) && !(P.grain > 0)) return;
    const key = [cw, ch, ctx.W, ctx.H, P.uneven, P.grain, ctx.seed].join('|');
    // поток шума читается каждый кадр одинаково: детерминизм не зависит от кеша
    const u = unevenTiles(ctx, P.uneven / 100), sx = Math.floor(ctx.randNoise() * 128), sy = Math.floor(ctx.randNoise() * 128);
    if (TEX.key !== key) {
      const mk = (fill) => { const c = canvas(cw, ch), x = c.getContext('2d'); x.fillStyle = fill; x.fillRect(0, 0, cw, ch); return c; };
      const plus = mk('black'), minus = mk('white'), gp = plus.getContext('2d'), gm = minus.getContext('2d');
      const kx = cw / ctx.W, ky = ch / ctx.H;
      if (P.uneven > 0) {
        [gp, gm].forEach((x, i) => { x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.globalCompositeOperation = i ? 'multiply' : 'lighter'; x.drawImage(i ? u.minus : u.plus, -cw / 12, -ch / 12, cw * 7 / 6, ch * 7 / 6); });
      }
      if (P.grain > 0 && window.RELIEF_NOISE) {
        const N = noiseTiles(gp, P.grain / 100);
        gp.setTransform(1, 0, 0, 1, -sx, -sy); gp.globalCompositeOperation = 'lighter'; gp.fillStyle = N.plus; gp.fillRect(0, 0, cw + 128, ch + 128);
        const M = noiseTiles(gm, P.grain / 100);
        gm.setTransform(1, 0, 0, 1, -sx, -sy); gm.globalCompositeOperation = 'multiply'; gm.fillStyle = M.minus; gm.fillRect(0, 0, cw + 128, ch + 128);
      }
      TEX.key = key; TEX.plus = plus; TEX.minus = minus; void kx; void ky;
    }
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'lighter'; g.drawImage(TEX.plus, 0, 0);
    g.globalCompositeOperation = 'multiply'; g.drawImage(TEX.minus, 0, 0);
    g.restore();
  }

  // ── движение §7.5 ────────────────────────────────────────────────────
  function tsec(ctx) { return ctx.t / FPS; }
  // фазы φ1..φ10 из ctx.rand в порядке id плашек
  function phases(ctx, n) { const out = []; for (let i = 0; i < n; i++) { const f = []; for (let k = 0; k < 10; k++) f.push(ctx.rand() * TAU); out.push(f); } return out; }
  function float(ctx, f, size, h, env) {
    const P = ctx.P;
    if (ctx.reduced || env <= 0) return { dx: 0, dy: 0, rot: 0, dh: 0 };
    const Pd = Math.max(1, P.period), w = TAU * ((tsec(ctx) % Pd) / Pd);
    const A = P.float * Math.min(2.4, 0.004 * size) * env;
    return {
      dx: A * (0.62 * Math.sin(w + f[0]) + 0.28 * Math.sin(2 * w + f[1]) + 0.10 * Math.sin(3 * w + f[2])),
      dy: A * (0.62 * Math.sin(w + f[3]) + 0.28 * Math.sin(2 * w + f[4]) + 0.10 * Math.sin(3 * w + f[5])),
      rot: P.sway * D2R * env * (0.7 * Math.sin(w + f[6]) + 0.3 * Math.sin(2 * w + f[7])),
      dh: P.bob * h * env * (0.7 * Math.sin(w + f[8]) + 0.3 * Math.sin(3 * w + f[9]))
    };
  }
  // сборка: подъём с h = 0 в порядке чтения, шаг 80 мс, 520 мс, cubic-bezier(.23,1,.32,1)
  function assemble(ctx, k) {
    if (ctx.reduced || !ctx.P.assemble) return 1;
    return EASE((tsec(ctx) - 0.25 - k * 0.08) / 0.52);
  }
  function assembleEnd(ctx, n) { return (ctx.reduced || !ctx.P.assemble) ? 0 : 0.25 + n * 0.08 + 0.52; }
  // оседание: env 1 → 0 за settle с по smootherstep; проверенное больше не плавает
  function settle(ctx, t0) { if (ctx.reduced) return 0; return 1 - smootherstep((tsec(ctx) - t0) / Math.max(0.05, ctx.P.settle)); }

  // ── чернила §7.4, §7.9 ───────────────────────────────────────────────
  function font(size, weight, mono) { return (weight || 400) + ' ' + size.toFixed(2) + 'px ' + (mono ? '"Geist Mono",ui-monospace,monospace' : '"Geist",system-ui,sans-serif'); }
  function text(g, s, x, y, o) {
    o = o || {};
    const size = o.size || 14;
    g.font = font(size, o.weight, o.mono);
    g.textAlign = o.align || 'left'; g.textBaseline = o.base || 'alphabetic';
    // трекинг по размеру (§8): +.02em мелкое, +.07em капс, 0 на 14–20, −.01em на 24–42, −.02em от 50
    const tr = o.caps ? 0.07 : size < 13 ? 0.02 : size < 21 ? 0 : size < 45 ? -0.01 : -0.02;
    if ('letterSpacing' in g) g.letterSpacing = (tr * size).toFixed(2) + 'px';
    if ('fontVariantNumeric' in g) g.fontVariantNumeric = 'tabular-nums';
    g.fillStyle = o.color;
    g.fillText(o.caps ? s.toUpperCase() : s, x, y);
    if ('letterSpacing' in g) g.letterSpacing = '0px';
  }
  function measure(g, s, o) {
    o = o || {}; const size = o.size || 14;
    g.font = font(size, o.weight, o.mono);
    const tr = o.caps ? 0.07 : size < 13 ? 0.02 : size < 21 ? 0 : size < 45 ? -0.01 : -0.02;
    if ('letterSpacing' in g) g.letterSpacing = (tr * size).toFixed(2) + 'px';
    const w = g.measureText(o.caps ? s.toUpperCase() : s).width;
    if ('letterSpacing' in g) g.letterSpacing = '0px';
    return w;
  }
  // строка в заданную ширину: длинное режется многоточием, а не уходит за край кадра
  function fit(g, s, o, maxW) {
    if (maxW <= 0) return '';
    if (measure(g, s, o) <= maxW) return s;
    let lo = 0, hi = s.length;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (measure(g, s.slice(0, mid) + '…', o) <= maxW) lo = mid; else hi = mid - 1; }
    return lo > 0 ? s.slice(0, lo).trimEnd() + '…' : '';
  }
  // рельефная линия: структура вырезана (тёмный штрих ink2 α .45 + светлый со сдвигом −0,75·l)
  function relief(g, L, pathFn) {
    g.save(); g.lineWidth = L.lineW; g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = css(L.T.ink2, 0.45); pathFn(0, 0); g.stroke();
    g.strokeStyle = css(L.lightTint, 0.55); pathFn(-0.75 * L.lx, -0.75 * L.ly); g.stroke();
    g.restore();
  }
  function printLine(g, L, pathFn, color, alpha) {
    g.save(); g.lineWidth = L.lineW; g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = css(color || L.T.ink2, alpha == null ? 1 : alpha); pathFn(0, 0); g.stroke(); g.restore();
  }
  // слой «рука» §6.9: штрих perfect-freehand, графит ink2 α .75
  function hand(g, L, pts) {
    if (!window.PF) return;
    const out = window.PF.getStroke(pts, { size: 1.6 * Math.max(1, L.S * 1.4), thinning: 0.5, smoothing: 0.6, streamline: 0.5 });
    if (!out.length) return;
    g.save(); g.fillStyle = css(L.T.ink2, 0.75); g.beginPath();
    out.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); g.fill(); g.restore();
  }
  function handRing(g, L, x, y, rx, ry, rand) {
    const pts = [], n = 40, a0 = -2.2 + rand() * 0.4;
    for (let i = 0; i <= n + 6; i++) {
      const a = a0 + (i / n) * TAU, k = 1 + 0.06 * Math.sin(i * 0.7 + rand()) + (i > n ? 0.08 : 0);
      pts.push([x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k, 0.5]);
    }
    hand(g, L, pts);
  }

  // ── адаптер панели v2 к kit-scene (§7.11): DG.panel поверх Podacha.Panel ─
  const PANEL = { root: null, opts: null, built: [] };
  function panelBuild(opts) {
    PANEL.opts = opts;
    const host = opts.mount;
    host.textContent = '';
    const root = document.createElement('div');
    root.className = 'pv2';
    root.setAttribute('data-theme', opts.theme === 'night' ? 'dark' : 'light');
    PANEL.root = root; PANEL.built = [];
    if (PANEL.head) root.appendChild(PANEL.head());
    opts.groups.forEach((gr) => {
      const rows = gr.rows.filter((d) => !(opts.mode === 'client' && d[d.length - 1] && d[d.length - 1].studio));
      if (!rows.length) return;
      const fs = document.createElement('fieldset'), lg = document.createElement('legend');
      lg.textContent = gr.name; fs.appendChild(lg);
      PANEL.built.push(Podacha.Panel.build(fs, rows, opts.values, (k, v) => opts.onChange(k, v)));
      root.appendChild(fs);
    });
    if (PANEL.foot) root.appendChild(PANEL.foot());
    host.appendChild(root);
  }
  window.DG = window.DG || {};
  window.DG.panel = {
    build: panelBuild,
    setValue: function (path, v) { if (!PANEL.opts) return; PANEL.opts.values[path] = v; PANEL.built.forEach((b) => b.paint()); },
    getValues: function () { return PANEL.opts ? Object.assign({}, PANEL.opts.values) : {}; },
    setTheme: function (t) { if (PANEL.root) PANEL.root.setAttribute('data-theme', t === 'night' ? 'dark' : 'light'); },
    setMode: function (m) { if (PANEL.opts) { PANEL.opts.mode = m; panelBuild(PANEL.opts); } },
    css: ''
  };

  // ── выгрузка PNG в формате §6.8: тот же сид и номер кадра в офскрине ─
  function exportPNG(fmt, scale) {
    const ctx = KIT.scene.ctx, def = KIT.scene.list()[0];
    if (!ctx || !def) return null;
    const dims = fmt && FORMATS[fmt] ? FORMATS[fmt] : [ctx.W, ctx.H];
    const k = clamp(Math.round(scale || 1), 1, 3);
    const save = { canvas: ctx.canvas, g: ctx.g, W: ctx.W, H: ctx.H };
    const c = canvas(dims[0] * k, dims[1] * k), g = c.getContext('2d');
    g.setTransform(k, 0, 0, k, 0, 0);
    Object.assign(ctx, { canvas: c, g, W: dims[0], H: dims[1] });
    SPR.clear();
    try { ctx.rand.reset(); ctx.randPal.reset(); ctx.randNoise.reset(); def.draw(ctx); }
    finally { Object.assign(ctx, save); SPR.clear(); }
    return c.toDataURL('image/png');
  }

  // ── загрузка варианта: шрифты, панель видна всегда, хоткеи, действия ─
  // cfg = { scene: def (без register), groups: [{name, rows}], head:{title,sub}, values:{} }
  function boot(cfg) {
    const Q = new URLSearchParams(location.search);
    const night = Q.get('theme') === 'night';
    const groups = cfg.groups.map((gr) => (gr.common ? { name: gr.name, rows: COMMON[gr.common] } : gr));
    const def = Object.assign({}, cfg.scene);
    def.params = [];
    groups.forEach((gr) => gr.rows.forEach((d) => def.params.push(toKit(d))));
    const values = defaultsOf(groups);
    if (night) { Object.assign(values, PRESETS.lamp, { light: 'lamp', grain: 2.2 }); }
    Object.assign(values, cfg.values || {});
    const userStructural = def.structural;
    def.structural = function (ctx, path) {
      // пресет света задаёт старт, не запрет: ручки остаются живыми (§6.3)
      if (path === 'light' && PRESETS[ctx.P.light]) {
        const pr = PRESETS[ctx.P.light];
        Object.keys(pr).forEach((k) => { ctx.P[k] = pr[k]; DG.panel.setValue(k, pr[k]); });
      }
      SPR.clear();
      if (userStructural) userStructural(ctx, path);
    };
    KIT.scene.register(def);

    PANEL.head = function () {
      const h = document.createElement('div'); h.className = 'head';
      const b = document.createElement('b'); b.textContent = cfg.head.title;
      const s = document.createElement('span'); s.textContent = cfg.head.sub;
      h.appendChild(b); h.appendChild(s); return h;
    };
    PANEL.foot = function () {
      const f = document.createElement('div'); f.className = 'acts';
      const btn = (label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = label; b.addEventListener('click', fn); f.appendChild(b); return b; };
      btn('PNG', savePNG);
      btn('Copy link', copyLink);
      btn(night ? 'Day' : 'Night', toggleTheme);
      btn('Replay', replay);
      return f;
    };
    function savePNG() {
      const ctx = KIT.scene.ctx, url = exportPNG(ctx.P.format === 'screen' ? null : ctx.P.format, ctx.P.scale);
      if (!url) return;
      const a = document.createElement('a');
      const fmt = ctx.P.format === 'screen' ? ctx.W + 'x' + ctx.H : FORMATS[ctx.P.format].join('x');
      a.href = url; a.download = 'relief_' + def.id + '-' + cfg.variant + '-' + (night ? 'night' : 'day') + '-' + fmt + '.png';
      document.body.appendChild(a); a.click(); a.remove();
    }
    function linkURL() {
      const u = new URL(location.href), ctx = KIT.scene.ctx;
      u.searchParams.set('seed', ctx.seed); u.searchParams.set('theme', night ? 'night' : 'day');
      return u.toString();
    }
    function copyLink() { const s = linkURL(); if (navigator.clipboard) navigator.clipboard.writeText(s).catch(() => {}); }
    function toggleTheme() { const u = new URL(location.href); u.searchParams.set('theme', night ? 'day' : 'night'); location.href = u.toString(); }
    function replay() { window.postMessage({ type: 'es:replay' }, '*'); }
    let paused = false;
    window.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tg = e.target && e.target.tagName;
      if (tg === 'INPUT' || tg === 'SELECT' || tg === 'TEXTAREA') return;
      const k = e.key.toLowerCase();
      if (k === 'r') replay();
      else if (k === 'p') { paused = !paused; window.postMessage({ type: paused ? 'pause' : 'play' }, '*'); }
      else if (k === 'e') savePNG();
      else if (k === 'i') toggleTheme();
    });

    const go = () => KIT.scene.start({ canvas: document.getElementById('c'), panelMount: document.getElementById('side'), groups, values });
    const fonts = document.fonts && document.fonts.load
      ? Promise.all([document.fonts.load('400 14px "Geist"'), document.fonts.load('500 14px "Geist Mono"')]) : Promise.resolve();
    fonts.then(go, go);
  }

  window.RL = {
    COMMON, PRESETS, FORMATS, clamp, mix, smoothstep, smootherstep, EASE, D2R, TAU,
    rgb, css, tokens, lightOf, offset, sigma, render, camera, onPlane, project, trace,
    phases, float, assemble, assembleEnd, settle, tsec, text, measure, fit, relief, printLine, hand, handRing,
    exportPNG, boot, get fps() { return FPS; }, get sprites() { return SPR.size; }
  };
})();
