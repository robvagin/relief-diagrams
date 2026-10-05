// lab-core.js — рельс одного варианта до слияния общего рельса (README §10, приказ 2):
// адаптер панели v2 к kit-scene (§7.11), свет и тени по приёмникам (§7.2–7.3), материал (§7.4),
// плавание и пружины (§7.5), оболочка страницы (действия, хоткеи, выгрузка §7.10).
// После слияния cloud/playground свет переезжает на src/light/, этот файл уходит.
// Случайность только из потоков kit-scene; время только из номера кадра (L11).
(function () {
  'use strict';
  const RL = window.RL = {};
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const mix = (a, b, k) => a + (b - a) * k;
  const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const smoother = (x) => { const t = clamp(x, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
  RL.clamp = clamp; RL.mix = mix; RL.smoothstep = smoothstep; RL.smoother = smoother; RL.TAU = TAU;

  // cubic-bezier(.23,1,.32,1) — кривая сборки и переходов (§7.5)
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t;
    const dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return function (x) {
      x = clamp(x, 0, 1); let t = x;
      for (let i = 0; i < 6; i++) { const d = dX(t); if (Math.abs(d) < 1e-6) break; t -= (X(t) - x) / d; }
      return Y(clamp(t, 0, 1));
    };
  }
  RL.ease = bezier(0.23, 1, 0.32, 1);
  // критически демпфированная пружина ζ = 1, ω = 2π/0.5 с, замкнутая форма: детерминирована по t
  RL.spring = (t, w) => t <= 0 ? 0 : 1 - (1 + (w || TAU / 0.5) * t) * Math.exp(-(w || TAU / 0.5) * t);

  // ── токены сцены: читаются из :root (хексы только в CSS-блоке) ────────────
  function rgb(s) {
    s = String(s).trim();
    if (s[0] === '#') {
      const h = s.length === 4 ? s.replace(/#(.)(.)(.)/, '#$1$1$2$2$3$3') : s;
      return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    }
    const m = s.match(/[\d.]+/g) || [0, 0, 0];
    return [+m[0], +m[1], +m[2]];
  }
  const css = (c, a) => 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + (a == null ? 1 : +a.toFixed(4)) + ')';
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  RL.css = css; RL.rgb = rgb;
  let TOK = null, TOKKEY = '';
  RL.tokens = function (theme, accent) {
    const key = theme + '/' + accent;
    if (TOK && TOKKEY === key) return TOK;
    const cs = getComputedStyle(document.documentElement), v = (n) => rgb(cs.getPropertyValue(n));
    TOK = {
      ground: v('--ground'), plate: v('--plate'), ink: v('--ink'), ink2: v('--ink2'), ink3: v('--ink3'),
      shadow: v('--shadow-tint'), light: v('--light-tint'), accent: v('--acc-' + (accent || 'terracotta')),
      night: theme === 'night'
    };
    TOK.shadowY = lum(TOK.shadow);
    TOKKEY = key;
    return TOK;
  };

  // ── свет: одно состояние на кадр (L1) ─────────────────────────────────────
  RL.PRESETS = {
    soft: { az: 135, elev: 42, soft: 0.28, dens: 0.20, amb: 0.72, pool: 0, canopy: 0 },
    raking: { az: 160, elev: 22, soft: 0.20, dens: 0.26, amb: 0.66, pool: 0, canopy: 0 },
    lamp: { az: 135, elev: 42, soft: 0.30, dens: 0.30, amb: 0.40, pool: 0.55, lampH: 900, canopy: 0 },
    canopy: { az: 140, elev: 48, soft: 0.30, dens: 0.20, amb: 0.72, pool: 0, canopy: 0.22 }
  };
  RL.light = function (P, W, H, ui) {
    const th = P.az * Math.PI / 180, ph = clamp(P.elev, 4, 89) * Math.PI / 180;
    const lamp = P.light === 'lamp';
    const L = {
      lamp: lamp, th: th, ph: ph, cot: 1 / Math.tan(ph), soft: P.soft, dens: P.dens, amb: P.amb,
      contact: P.contact, pool: P.pool, canopy: P.canopy, temp: P.temp,
      lx: Math.cos(ph) * Math.cos(th), ly: -Math.cos(ph) * Math.sin(th), lz: Math.sin(ph),
      dx: -Math.cos(th), dy: Math.sin(th),
      Lx: 0.32 * W, Ly: 0.28 * H, LH: P.lampH * ui
    };
    L.E = P.amb + (1 - P.amb) * Math.sin(ph);
    return L;
  };
  // сдвиг тени заслонителя c (центр cx, cy, высота hc) на приёмник ниже на dh
  RL.offset = function (L, cx, cy, hc, dh) {
    if (L.lamp) { const k = dh / Math.max(1, L.LH - hc); return [(cx - L.Lx) * k, (cy - L.Ly) * k]; }
    return [dh * L.cot * L.dx, dh * L.cot * L.dy];
  };
  RL.sigma = (L, dh) => 0.6 + L.soft * dh;
  RL.density = (L, dh) => L.dens * (1 - 0.35 * smoothstep(0, 40, dh));
  // направление «к свету» в плоскости экрана для канта и рельефа
  RL.lxy = function (L, cx, cy) {
    if (!L.lamp) return [L.lx, L.ly];
    const vx = L.Lx - cx, vy = L.Ly - cy, d = Math.hypot(vx, vy) || 1, c = Math.cos(Math.atan2(L.LH, d));
    return [vx / d * c, vy / d * c];
  };

  // ── единицы кадра (§7.1) ──────────────────────────────────────────────────
  RL.units = function (ctx) {
    const W = ctx.W, H = ctx.H, dpr = ctx.canvas.width / Math.max(1, W);
    const ui = clamp(Math.min(W / 1440, H / 900), 0.34, 1.6);
    return { W: W, H: H, dpr: dpr, ui: ui, u: Math.min(W, H) / 48, m: 0.06 * Math.min(W, H),
      lineW: Math.max(1.25 * ui, 1 / dpr), z: [0, 4, 12, 28].map((h) => h * ui * ctx.P.zscale) };
  };

  // ── время: только номер кадра / fpsNominal (§7.5) ─────────────────────────
  RL.fps = 60;
  RL.time = (ctx) => ctx.t / RL.fps;

  // ── плавание плашки (§7.5): гармоники одного периода, цикл замыкается ─────
  RL.phases = function (ctx, n) {           // φ1..φ10 по порядку id плашек, поток сброшен перед кадром
    const out = [];
    for (let i = 0; i < n; i++) { const f = []; for (let k = 0; k < 10; k++) f.push(ctx.rand() * TAU); out.push(f); }
    return out;
  };
  RL.float = function (P, tsec, ph, w, h, hz, env) {
    if (!env || !P.float) return { dx: 0, dy: 0, rot: 0, dh: 0 };
    const per = Math.max(1, P.period), wv = TAU * (((tsec % per) + per) % per) / per;
    const A = P.float * Math.min(2.4, 0.004 * Math.min(w, h)) * env;
    const s = Math.sin;
    return {
      dx: A * (0.62 * s(wv + ph[0]) + 0.28 * s(2 * wv + ph[1]) + 0.10 * s(3 * wv + ph[2])),
      dy: A * (0.62 * s(wv + ph[3]) + 0.28 * s(2 * wv + ph[4]) + 0.10 * s(3 * wv + ph[5])),
      rot: P.sway * env * (0.7 * s(wv + ph[6]) + 0.3 * s(2 * wv + ph[7])) * Math.PI / 180,
      dh: P.bob * hz * env * (0.7 * s(wv + ph[8]) + 0.3 * s(3 * wv + ph[9]))
    };
  };
  // огибающая оседания: 1 → 0 за settle с, smootherstep (непрерывны значение, скорость, ускорение)
  RL.settleEnv = (P, since) => since <= 0 ? 1 : 1 - smoother(since / Math.max(0.05, P.settle));

  // ── геометрия плашек ─────────────────────────────────────────────────────
  // shape: {k:'rr', x, y, w, h, r} | {k:'disc', x, y, w, h} (x, y — левый верх); hole: та же форма или null
  function shapePath(g, s, ox, oy) {
    if (s.k === 'disc') { g.moveTo(s.x + ox + s.w, s.y + oy + s.h / 2); g.arc(s.x + ox + s.w / 2, s.y + oy + s.h / 2, s.w / 2, 0, TAU); return; }
    const r = Math.max(0, Math.min(s.r || 0, s.w / 2, s.h / 2)), x = s.x + ox, y = s.y + oy, w = s.w, h = s.h;
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  RL.shapePath = shapePath;
  function platePath(g, p, ox, oy) {
    const cx = p.x + p.w / 2 + p.dx, cy = p.y + p.h / 2 + p.dy;
    g.beginPath();
    g.save();
    if (p.rot) { g.translate(cx + ox, cy + oy); g.rotate(p.rot); g.translate(-cx - ox, -cy - oy); }
    shapePath(g, p.shape, p.dx + ox, p.dy + oy);
    if (p.hole) shapePath(g, p.hole, p.dx + ox, p.dy + oy);
    g.restore();
  }
  RL.platePath = platePath;
  RL.plate = function (o) {          // нормализует описание плашки
    const s = o.shape || { k: o.k || 'rr', x: o.x, y: o.y, w: o.w, h: o.h, r: o.r };
    return Object.assign({ id: o.id, x: s.x, y: s.y, w: s.w, h: s.h, z: o.z || 0, dx: 0, dy: 0, rot: 0, hole: o.hole || null, shape: s }, o, { shape: s, x: s.x, y: s.y, w: s.w, h: s.h });
  };

  // ── спрайты теней: кеш по (форма, σ шагом 0.25 px, плотность шагом 0.01) ──
  const SPR = new Map();
  let SPRN = 0;
  function shapeKey(p) {
    const s = p.shape, h = p.hole;
    return s.k + (s.w).toFixed(1) + 'x' + (s.h).toFixed(1) + 'r' + (s.r || 0).toFixed(1) +
      (h ? 'h' + h.k + (h.x - s.x).toFixed(1) + ',' + (h.y - s.y).toFixed(1) + ',' + h.w.toFixed(1) + 'x' + h.h.toFixed(1) + 'r' + (h.r || 0).toFixed(1) : '');
  }
  // спрайт: белое поле, форма серым (1 − a), размыто σ. Рисуется в карту света режимом darken:
  // минимум яркостей = максимум затенений (объединение заслонителей, а не сумма, §7.3)
  function sprite(p, sigma, a, q) {
    sigma = Math.max(0.25, Math.round(sigma * 4) / 4); a = clamp(Math.round(a * 100) / 100, 0, 0.98);
    const key = shapeKey(p) + '|' + sigma + '|' + a + '|' + q.toFixed(3);
    let s = SPR.get(key);
    if (s) return s;
    if (SPRN > 400) { SPR.clear(); SPRN = 0; }
    const pad = Math.ceil(sigma * 3 + 2), w = p.shape.w + pad * 2, h = p.shape.h + pad * 2;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * q)); c.height = Math.max(1, Math.ceil(h * q));
    const g = c.getContext('2d');
    g.fillStyle = 'rgb(255,255,255)'; g.fillRect(0, 0, c.width, c.height);
    g.setTransform(q, 0, 0, q, 0, 0);
    g.filter = 'blur(' + (sigma * q).toFixed(2) + 'px)';
    const v = Math.round(255 * (1 - a));
    g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
    g.beginPath();
    shapePath(g, p.shape, pad - p.shape.x, pad - p.shape.y);
    if (p.hole) shapePath(g, p.hole, pad - p.shape.x, pad - p.shape.y);
    g.fill('evenodd');
    s = { c: c, pad: pad, w: w, h: h };
    SPR.set(key, s); SPRN++;
    return s;
  }
  function drawSprite(lg, p, s, ox, oy) {
    const cx = p.x + p.w / 2 + p.dx + ox, cy = p.y + p.h / 2 + p.dy + oy;
    lg.save();
    lg.translate(cx, cy);
    if (p.rot) lg.rotate(p.rot);
    lg.drawImage(s.c, -p.w / 2 - s.pad, -p.h / 2 - s.pad, s.w, s.h);
    lg.restore();
  }

  // карта света: ½ физического разрешения (размытие прячет), серым, белое = прямой свет
  let LC = null, LG = null, LQ = 1;
  function lightCanvas(U) {
    const q = Math.max(0.5, U.dpr * 0.5), w = Math.ceil(U.W * q), h = Math.ceil(U.H * q);
    if (!LC) { LC = document.createElement('canvas'); LG = LC.getContext('2d'); }
    if (LC.width !== w || LC.height !== h) { LC.width = w; LC.height = h; }
    LQ = q;
    LG.setTransform(1, 0, 0, 1, 0, 0); LG.globalCompositeOperation = 'source-over'; LG.globalAlpha = 1; LG.filter = 'none';
    LG.fillStyle = 'rgb(255,255,255)'; LG.fillRect(0, 0, w, h);
    LG.setTransform(q, 0, 0, q, 0, 0);
    LG.globalCompositeOperation = 'darken';
    return LG;
  }
  // тени заслонителей casters на приёмник высоты hr; затем тон: screen по shadowTint и multiply в кадр
  function castShadows(R, casters, hr) {
    const L = R.L, T = R.T, lg = lightCanvas(R.U), any = { n: 0 };
    const tint = R.shadowTint, aK = 1 / Math.max(0.05, 1 - lum(tint));
    casters.forEach(function (c) {
      const dh = c.z + c.dz - hr;
      if (dh <= 0.01) return;
      const cx = (c.ax != null ? c.ax : c.x + c.w / 2) + c.dx, cy = (c.ay != null ? c.ay : c.y + c.h / 2) + c.dy;
      const o = RL.offset(L, cx, cy, c.z + c.dz, dh);
      const D = RL.density(L, dh);
      drawSprite(lg, c, sprite(c, RL.sigma(L, dh), clamp(D * aK, 0, 0.95), LQ), o[0], o[1]);
      // контакт: узкая тень у опоры, гаснет к 16 px высоты; плюс «юбка» независимо от света
      const cd = L.contact * Math.max(0, 1 - dh / (16 * R.U.ui));
      if (cd > 0.003) drawSprite(lg, c, sprite(c, 0.8 + 0.06 * dh, clamp(cd * aK, 0, 0.9), LQ), o[0] * 0.25, o[1] * 0.25);
      if (dh <= 16 * R.U.ui) drawSprite(lg, c, sprite(c, 2, 0.04 * aK, LQ), 0, 0);
      any.n++;
    });
    if (!any.n) return null;
    lg.setTransform(1, 0, 0, 1, 0, 0);
    lg.globalCompositeOperation = 'screen';
    lg.fillStyle = css(tint); lg.fillRect(0, 0, LC.width, LC.height);
    return LC;
  }

  // ── неровность и зерно: статичные, от сида (§7.4) ─────────────────────────
  let NOISE = null, GRAIN = null, GRAINKEY = '', UNEVEN = null, UNEVENKEY = '';
  RL.loadNoise = function (src) {
    return new Promise(function (res) {
      if (!src) return res();
      const im = new Image(); im.onload = function () { NOISE = im; res(); }; im.onerror = function () { res(); }; im.src = src;
    });
  };
  function grainTiles(pct, ctx) {
    const key = pct.toFixed(2) + '/' + ctx.seed;
    if (GRAIN && GRAINKEY === key) return GRAIN;
    if (!NOISE) return null;
    const n = NOISE.width, src = document.createElement('canvas'); src.width = n; src.height = n;
    const sg = src.getContext('2d'); sg.drawImage(NOISE, 0, 0);
    const d = sg.getImageData(0, 0, n, n).data;
    const mk = function (sign) {
      const c = document.createElement('canvas'); c.width = n; c.height = n;
      const g = c.getContext('2d'), im = g.createImageData(n, n), o = im.data;
      for (let i = 0; i < n * n; i++) {
        const v = d[i * 4] / 255 - 0.5, a = sign > 0 ? Math.max(0, v) : Math.max(0, -v);
        const k = sign > 0 ? 255 : 0;
        o[i * 4] = k; o[i * 4 + 1] = k; o[i * 4 + 2] = k; o[i * 4 + 3] = Math.round(255 * a * 2 * pct / 100);
      }
      g.putImageData(im, 0, 0); return c;
    };
    GRAIN = { up: mk(1), dn: mk(-1), sx: Math.floor(ctx.randNoise() * n), sy: Math.floor(ctx.randNoise() * n) };
    GRAINKEY = key;
    return GRAIN;
  }
  function unevenCanvas(ctx) {
    const key = ctx.seed;
    if (UNEVEN && UNEVENKEY === key) return UNEVEN;
    const n = 9, c = document.createElement('canvas'); c.width = n; c.height = n;
    const g = c.getContext('2d'), im = g.createImageData(n, n);
    for (let i = 0; i < n * n; i++) {
      const v = ctx.randNoise();
      im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = Math.round(v * 255); im.data[i * 4 + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    UNEVEN = c; UNEVENKEY = key;
    return c;
  }
  // пятно лампы: E(p) ∝ (H_L − h)/|P_L − p|³, нормировано на 1 под лампой; lit = mix(1, E^0.6, pool)
  let LAMP = null, LAMPKEY = '';
  function lampCanvas(R) {
    const L = R.L, U = R.U, key = [U.W, U.H, L.LH.toFixed(0), L.pool.toFixed(2)].join('/');
    if (LAMP && LAMPKEY === key) return LAMP;
    const s = 8, w = Math.ceil(U.W / s), h = Math.ceil(U.H / s), c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d'), im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = x * s - L.Lx, dy = y * s - L.Ly, r2 = dx * dx + dy * dy + L.LH * L.LH;
      const E = Math.pow(L.LH * L.LH * L.LH / Math.pow(r2, 1.5), 0.6), v = Math.round(255 * mix(1, E, L.pool)), i = (y * w + x) * 4;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    LAMP = c; LAMPKEY = key;
    return c;
  }
  // листва: маска G в ¼ разрешения, кластеры листьев от сида, ветер тремя полосами (§7.2, §7.5)
  let CAN = null;
  function canopyCanvas(R, ctx, tsec) {
    const U = R.U, P = ctx.P, L = R.L, w = Math.ceil(U.W / 4), h = Math.ceil(U.H / 4);
    if (!CAN) CAN = document.createElement('canvas');
    if (CAN.width !== w || CAN.height !== h) { CAN.width = w; CAN.height = h; }
    const g = CAN.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.filter = 'none'; g.globalCompositeOperation = 'source-over';
    g.fillStyle = 'rgb(255,255,255)'; g.fillRect(0, 0, w, h);
    const per = Math.max(1, P.period), wv = ctx.reduced ? 0 : TAU * ((tsec % per) / per);
    const bands = [[1, 6], [3, 2.5], [12, 0.8]].filter((b) => b[0] <= Math.floor(0.5 * per));
    g.filter = 'blur(' + (0.035 * 600 * U.ui / 4).toFixed(2) + 'px)';
    const base = 1 - L.canopy / 0.6 * 0.85;
    g.fillStyle = 'rgba(0,0,0,' + clamp(1 - base, 0, 1).toFixed(3) + ')';
    for (let i = 0; i < 70; i++) {
      const x = ctx.randNoise() * w, y = ctx.randNoise() * h, rx = (18 + ctx.randNoise() * 46) * U.ui / 4, ry = rx * (0.5 + ctx.randNoise() * 0.5);
      const f = ctx.randNoise() * TAU, gust = 0.7 + 0.3 * Math.sin(wv + f);
      let ox = 0, oy = 0;
      bands.forEach(function (b) { ox += b[1] * Math.sin(b[0] * wv + f); oy += b[1] * 0.6 * Math.cos(b[0] * wv + f * 1.3); });
      g.beginPath(); g.ellipse(x + ox * gust * U.ui / 4, y + oy * gust * U.ui / 4, rx, ry, f, 0, TAU); g.fill();
    }
    g.filter = 'none';
    g.fillStyle = 'rgba(255,255,255,0.9)';     // «зайчики» в просветах: круглые пятна солнца
    for (let i = 0; i < 12; i++) {
      const x = ctx.randNoise() * w, y = ctx.randNoise() * h, r = (2 + ctx.randNoise() * 3) * U.ui;
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    return CAN;
  }

  // ── главный проход (§7.3) ─────────────────────────────────────────────────
  // S = {plates, floor(g,R), print(g,p,R), over(g,R), flat}
  RL.render = function (ctx, S) {
    const g = ctx.g, P = ctx.P, U = RL.units(ctx), T = RL.tokens(ctx.theme, P.accent);
    const L = RL.light(P, U.W, U.H, U.ui), tsec = RL.time(ctx);
    // температура: тёплый свет, холодная тень; temp = 0 нейтраль
    const warm = clamp(P.temp, 0, 1), cool = clamp((P.temp + 1) / 2, 0, 1);
    const grey = T.shadow.map(() => 255 * Math.pow(T.shadowY, 1 / 2.2));
    const shadowTint = T.shadow.map((v, i) => mix(grey[i], v, cool));
    const lit = (c) => { const k = clamp(L.E / 0.907, 0.55, 1.06); return c.map((v, i) => clamp(v * k * mix(1, T.light[i] / 255, warm * 0.6), 0, 255)); };
    const R = { ctx: ctx, g: g, P: P, U: U, T: T, L: L, t: tsec, shadowTint: shadowTint, lit: lit };
    const plates = (S.plates || []).map(function (p) { p.dz = p.dz || 0; return p; });
    // 1 пол
    g.save();
    g.setTransform(U.dpr, 0, 0, U.dpr, 0, 0);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.filter = 'none';
    g.fillStyle = css(lit(T.ground)); g.fillRect(0, 0, U.W, U.H);
    // 2 печать на полу
    if (S.floor) { g.save(); S.floor(g, R); g.restore(); }
    // 3–4 тени и контакт на полу
    const casters = S.flat ? [] : plates.filter((p) => p.z + p.dz > 0.01 && !p.noShadow);
    if (casters.length) {
      const lc = castShadows(R, casters, 0);
      if (lc) { g.globalCompositeOperation = 'multiply'; g.drawImage(lc, 0, 0, U.W, U.H); g.globalCompositeOperation = 'source-over'; }
    }
    // 5 плашки по возрастанию высоты
    const order = plates.map((p, i) => [p, i]).sort((a, b) => (a[0].z - b[0].z) || (a[1] - b[1])).map((x) => x[0]);
    order.forEach(function (p) {
      if (p.hidden) return;
      const hr = p.z + p.dz;
      g.save();
      if (p.alpha != null && p.alpha < 1) g.globalAlpha = p.alpha;
      platePath(g, p, 0, 0);
      g.fillStyle = css(lit(p.albedo || T.plate));
      g.fill('evenodd');
      g.clip('evenodd');
      if (S.print) { g.save(); S.print(g, p, R); g.restore(); }
      const above = S.flat ? [] : casters.filter((c) => c !== p && c.z + c.dz > hr + 0.01 && overlaps(c, p, L, hr));
      if (above.length) {
        const lc = castShadows(R, above, hr);
        if (lc) { g.globalCompositeOperation = 'multiply'; g.drawImage(lc, 0, 0, U.W, U.H); g.globalCompositeOperation = 'source-over'; }
      }
      // кант: свет рисует кромку (L3), обводки нет
      if (P.rim > 0 && !p.noRim) {
        const l = RL.lxy(L, p.x + p.w / 2, p.y + p.h / 2), lw = 0.75 * Math.max(1, U.ui);
        g.lineWidth = lw;
        platePath(g, p, -0.5 * l[0] * lw * 1.6, -0.5 * l[1] * lw * 1.6);
        g.strokeStyle = css(T.light, 0.6 * P.rim); g.stroke();
        platePath(g, p, 0.5 * l[0] * lw * 1.6, 0.5 * l[1] * lw * 1.6);
        g.strokeStyle = css(shadowTint, 0.35 * P.rim); g.stroke();
      }
      g.restore();
    });
    // 6 листва, лампа, неровность, зерно
    if (L.canopy > 0.001 && !S.flat) {
      const cc = canopyCanvas(R, ctx, tsec);
      const k = (1 - L.amb) * Math.sin(L.ph);
      g.globalCompositeOperation = 'multiply'; g.globalAlpha = clamp(k / (L.amb + k) * 1.6, 0, 1);
      g.imageSmoothingEnabled = true; g.drawImage(cc, 0, 0, U.W, U.H);
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
    if (L.lamp && L.pool > 0.001) {
      g.globalCompositeOperation = 'multiply'; g.imageSmoothingEnabled = true;
      g.drawImage(lampCanvas(R), 0, 0, U.W, U.H); g.globalCompositeOperation = 'source-over';
    }
    if (P.uneven > 0) {
      g.globalCompositeOperation = 'soft-light'; g.globalAlpha = clamp(P.uneven / 100 * 3, 0, 1);
      g.imageSmoothingEnabled = true; g.drawImage(unevenCanvas(ctx), -U.W / 12, -U.H / 12, U.W * 7 / 6, U.H * 7 / 6);
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
    if (P.grain > 0) {
      const gt = grainTiles(P.grain, ctx);
      if (gt) {
        g.setTransform(1, 0, 0, 1, 0, 0);        // по физическим пикселям
        ['up', 'dn'].forEach(function (k) {
          const pat = g.createPattern(gt[k], 'repeat');
          g.save(); g.translate(-gt.sx, -gt.sy); g.fillStyle = pat;
          g.fillRect(gt.sx, gt.sy, ctx.canvas.width, ctx.canvas.height); g.restore();
        });
        g.setTransform(U.dpr, 0, 0, U.dpr, 0, 0);
      }
    }
    // 7 слой взаимодействия и подписи
    if (S.over) { g.save(); S.over(g, R); g.restore(); }
    g.restore();
    return R;
  };
  function overlaps(c, p, L, hr) {
    const dh = c.z + c.dz - hr, o = RL.offset(L, c.ax != null ? c.ax : c.x + c.w / 2, c.ay != null ? c.ay : c.y + c.h / 2, c.z + c.dz, dh), s = RL.sigma(L, dh) * 3 + 4;
    return !(c.x + c.dx + o[0] - s > p.x + p.w + p.dx || c.x + c.w + c.dx + o[0] + s < p.x + p.dx ||
             c.y + c.dy + o[1] - s > p.y + p.h + p.dy || c.y + c.h + c.dy + o[1] + s < p.y + p.dy);
  }

  // ── чернила: текст, рельефная и печатная линия (§7.4, L7, L9) ─────────────
  const SIZES = { t1: 11.67, t2: 14, t3: 16.8, t4: 20.16, t5: 24.19, t6: 29.03, t7: 34.84, t8: 41.8, n1: 50.2, n2: 60.2, n3: 72.2 };
  RL.fs = (R, t) => Math.max(8.5, (SIZES[t] || t) * clamp(R.U.ui * 1.1, 0.62, 1.6));
  RL.text = function (g, R, str, x, y, o) {
    o = o || {};
    const px = RL.fs(R, o.size || 't2');
    const track = o.track != null ? o.track : (px < 14 ? 0.02 : px <= 20.2 ? 0 : px < 50 ? -0.01 : -0.02);
    g.font = (o.weight || 400) + ' ' + px.toFixed(2) + 'px ' + (o.mono ? "'Geist Mono',ui-monospace,monospace" : "'Geist',system-ui,sans-serif");
    g.letterSpacing = (track * px).toFixed(2) + 'px';
    g.fontVariantNumeric = 'tabular-nums';
    g.textAlign = o.align || 'left'; g.textBaseline = o.base || 'alphabetic';
    g.fillStyle = o.color || css(R.T.ink, o.alpha == null ? 1 : o.alpha);
    if (o.caps) str = String(str).toUpperCase();
    g.fillText(str, x, y);
    const w = g.measureText(str).width;
    g.letterSpacing = '0px';
    return w;
  };
  RL.measure = function (g, R, str, o) {
    o = o || {}; const px = RL.fs(R, o.size || 't2');
    g.font = (o.weight || 400) + ' ' + px.toFixed(2) + 'px ' + (o.mono ? "'Geist Mono',ui-monospace,monospace" : "'Geist',system-ui,sans-serif");
    const track = o.track != null ? o.track : (px < 14 ? 0.02 : px <= 20.2 ? 0 : px < 50 ? -0.01 : -0.02);
    g.letterSpacing = (track * px).toFixed(2) + 'px';
    const w = g.measureText(o.caps ? String(str).toUpperCase() : str).width; g.letterSpacing = '0px'; return w;
  };
  // рельефная линия: структура вырезана в материале (тёмный штрих + светлый со сдвигом к свету)
  RL.relief = function (g, R, pathFn, alpha) {
    const l = RL.lxy(R.L, R.U.W / 2, R.U.H / 2), lw = R.U.lineW, k = alpha == null ? 1 : alpha;
    g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
    g.save(); g.translate(-0.75 * l[0] * lw, -0.75 * l[1] * lw);
    g.beginPath(); pathFn(g); g.strokeStyle = css(R.T.light, (R.T.night ? 0.16 : 0.55) * k); g.stroke(); g.restore();
    g.beginPath(); pathFn(g); g.strokeStyle = css(R.T.ink2, 0.45 * k); g.stroke();
  };
  // печатная линия: данные, чернилами
  RL.inkLine = function (g, R, pathFn, o) {
    o = o || {};
    g.lineWidth = R.U.lineW; g.lineCap = 'round'; g.lineJoin = 'round';
    g.setLineDash(o.dash || []); g.lineDashOffset = o.offset || 0;
    g.beginPath(); pathFn(g); g.strokeStyle = o.color || css(o.ink || R.T.ink, o.alpha == null ? 1 : o.alpha); g.stroke();
    g.setLineDash([]);
  };
  RL.dot = function (g, x, y, r, color) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = color; g.fill(); };
  RL.fictional = function (g, R) {
    RL.text(g, R, 'Fictional data', R.U.W - R.U.m * 0.5, R.U.H - R.U.m * 0.42, { size: 't1', mono: true, align: 'right', color: css(R.T.ink3, 0.9) });
  };

  // ── адаптер панели v2 поверх kit-scene (§7.11): DG.panel ───────────────────
  function toV2(row) {
    const last = row[row.length - 1], o = (last && typeof last === 'object' && !Array.isArray(last)) ? last : {};
    const core = o === last ? row.slice(0, -1) : row;
    if (Array.isArray(core[2])) return [core[0], core[1], core[2], o.default !== undefined ? o.default : core[2][0], o.labels || null, o.hint];
    return [core[0], core[1], core[2], core[3], core[4], core[5], o.hint];
  }
  RL.toV2 = toV2;
  const PANEL = { root: null, apis: [], opts: null };
  function buildPanel(opts) {
    PANEL.opts = opts;
    const root = opts.mount;
    root.textContent = '';
    PANEL.apis = [];
    (opts.groups || []).forEach(function (gr) {
      const rows = gr.rows.filter(function (r) {
        const l = r[r.length - 1];
        return !(opts.mode === 'client' && l && typeof l === 'object' && !Array.isArray(l) && l.studio);
      });
      if (!rows.length) return;
      const fs = document.createElement('fieldset'), lg = document.createElement('legend');
      lg.textContent = gr.name; fs.appendChild(lg); root.appendChild(fs);
      PANEL.apis.push(Podacha.Panel.build(fs, rows.map(toV2), opts.values, function (k, v) { opts.onChange(k, v); }));
    });
  }
  window.DG = window.DG || {};
  DG.panel = {
    build: buildPanel,
    setValue: function (path, v) { if (PANEL.opts) { PANEL.opts.values[path] = v; PANEL.apis.forEach((a) => a.paint()); } },
    getValues: function () { return PANEL.opts ? PANEL.opts.values : {}; },
    setTheme: function (t) { const s = document.querySelector('.rl-side'); if (s) s.dataset.theme = t === 'night' ? 'dark' : 'light'; },
    setMode: function (m) { if (PANEL.opts) { PANEL.opts.mode = m; buildPanel(PANEL.opts); } },
    css: "@@PANEL-CSS@@"
  };

  // ── ручки §6.10: общие группы ─────────────────────────────────────────────
  const N = (k, l, a, b, s, d, hint) => hint ? [k, l, a, b, s, d, { hint: hint }] : [k, l, a, b, s, d];
  const C = (k, l, opts, d, labels, hint) => [k, l, opts, { default: d, labels: labels, hint: hint }];
  RL.N = N; RL.C = C;
  RL.common = {
    light: [
      C('light', 'Свет', ['soft', 'raking', 'lamp', 'canopy'], 'soft', ['Мягкий', 'Скользящий', 'Лампа', 'Листва']),
      N('az', 'Азимут, °', 0, 360, 1, 135, 'Откуда свет: 135 = слева сверху'),
      N('elev', 'Высота, °', 8, 80, 1, 42, 'Ниже солнце = длиннее тени'),
      N('soft', 'Мягкость', 0, 1, 0.01, 0.28, 'Рост полутени на пиксель высоты'),
      N('dens', 'Плотность тени', 0, 0.6, 0.01, 0.20),
      N('amb', 'Рассеянный', 0.2, 0.95, 0.01, 0.72),
      N('contact', 'Контакт', 0, 0.3, 0.01, 0.12, 'Тонкая тень у самой опоры'),
      N('pool', 'Пятно лампы', 0, 1, 0.01, 0),
      N('lampH', 'Высота лампы', 300, 2000, 10, 900),
      N('canopy', 'Листва', 0, 0.6, 0.01, 0, 'Пятна света сквозь крону'),
      N('temp', 'Температура', -1, 1, 0.01, 0.25, 'Тёплый свет, холодная тень')
    ],
    material: [
      N('grain', 'Зерно, %', 0, 4, 0.1, 1.6),
      N('uneven', 'Неровность, %', 0, 2, 0.1, 0.8),
      N('rim', 'Кант', 0, 1, 0.01, 0.5),
      N('radius', 'Радиус плашки', 0, 8, 0.5, 6),
      N('zscale', 'Шкала высот', 0, 2, 0.01, 1),
      C('accent', 'Акцент', ['terracotta', 'cobalt', 'olive'], 'terracotta', ['Терракота', 'Кобальт', 'Олива']),
      N('hand', 'Рука', 0, 1, 1, 0)
    ],
    motion: [
      N('float', 'Плавание', 0, 2, 0.01, 1),
      N('period', 'Период, с', 12, 72, 1, 36),
      N('sway', 'Качание, °', 0, 1.5, 0.05, 0.3),
      N('bob', 'Дыхание тени', 0, 0.2, 0.01, 0.08),
      N('settle', 'Оседание, с', 0.3, 2, 0.05, 0.9),
      N('assemble', 'Сборка', 0, 1, 1, 1)
    ],
    export: [
      C('format', 'Формат', ['screen', '16:9', '1:1', '4:5'], 'screen', ['Экран', '16:9', '1:1', '4:5']),
      N('scale', 'Масштаб', 1, 3, 1, 2)
    ]
  };
  // группы в порядке канона: Сцена · Свет · Материал · Движение · Ритм · Данные · Выгрузка
  RL.groups = function (sc) {
    const out = [];
    if (sc.scene && sc.scene.length) out.push({ name: 'Сцена', rows: sc.scene });
    out.push({ name: 'Свет', rows: RL.common.light }, { name: 'Материал', rows: RL.common.material }, { name: 'Движение', rows: RL.common.motion });
    if (sc.rhythm && sc.rhythm.length) out.push({ name: 'Ритм', rows: sc.rhythm });
    if (sc.data && sc.data.length) out.push({ name: 'Данные', rows: sc.data });
    out.push({ name: 'Выгрузка', rows: RL.common.export });
    return out;
  };
  RL.params = (groups) => groups.reduce((a, g) => a.concat(g.rows), []);

  // ── оболочка: старт, действия, хоткеи, выгрузка ───────────────────────────
  const Q = new URLSearchParams(location.search);
  RL.query = Q;
  // прогресс 0..1 из адреса или от хоста (es:progress) фиксирует фазу цикла; иначе цикл идёт сам
  let DRIVEN = Q.has('p');
  window.addEventListener('message', function (e) {
    const d = e && e.data;
    if (d && d.type === 'es:progress') DRIVEN = true;
    if (d && d.type === 'es:replay') DRIVEN = false;
  });
  RL.progress = (ctx) => DRIVEN ? ctx.p : null;
  function toast(msg) {
    const t = document.querySelector('.rl-toast'); if (!t) return;
    t.textContent = msg; t.classList.add('on');
    clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 1400);
  }
  RL.toast = toast;
  function setTheme(th) {
    const ctx = KIT.scene.ctx; if (!ctx) return;
    ctx.theme = th;
    document.documentElement.classList.toggle('is-night', th === 'night');
    DG.panel.setTheme(th === 'night' ? 'night' : 'light');
    TOK = null; GRAIN = null;
    Scene.set('format', ctx.P.format);          // перерисовать кадр без смены значений
  }
  RL.setTheme = setTheme;
  function link() {
    const ctx = KIT.scene.ctx, u = new URL(location.href);
    u.searchParams.set('seed', ctx.seed); u.searchParams.set('theme', ctx.theme);
    u.searchParams.set('preset', ctx.P.light);
    return u.toString();
  }
  // выгрузка: формат §6.8 рисуется в том же холсте с тем же сидом и номером кадра
  const FMT = { '16:9': [1920, 1080], '1:1': [1080, 1080], '4:5': [1080, 1350] };
  function exportPNG() {
    const ctx = KIT.scene.ctx, def = KIT.scene.list()[0], P = ctx.P;
    const f = FMT[P.format], c = ctx.canvas;
    const save = { W: ctx.W, H: ctx.H, w: c.width, h: c.height };
    const W = f ? f[0] : ctx.W, H = f ? f[1] : ctx.H, s = f ? 1 : Math.round(P.scale);
    c.width = W * s; c.height = H * s; ctx.W = W; ctx.H = H;
    ctx.g.setTransform(s, 0, 0, s, 0, 0);
    ctx.rand.reset(); ctx.randPal.reset(); ctx.randNoise.reset();
    def.draw(ctx);
    const url = c.toDataURL('image/png');
    c.width = save.w; c.height = save.h; ctx.W = save.W; ctx.H = save.H;
    ctx.g.setTransform(save.w / save.W, 0, 0, save.w / save.W, 0, 0);
    Scene.set('format', P.format);
    return url;
  }
  RL.exportPNG = exportPNG;
  function download(url, name) { const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
  function fileName(ext) {
    const ctx = KIT.scene.ctx, def = KIT.scene.list()[0], f = FMT[ctx.P.format] || [ctx.W, ctx.H];
    return 'relief_' + def.id + '-' + RL.variant + '-' + ctx.theme + '-' + f[0] + 'x' + f[1] + '_' + ctx.seed + '.' + ext;
  }
  let paused = false;
  const ACTS = {
    png: function () { download(exportPNG(), fileName('png')); toast('PNG saved'); },
    link: function () {
      const s = link();
      if (navigator.clipboard) navigator.clipboard.writeText(s).then(() => toast('Link copied'), () => toast(s));
      else toast(s);
    },
    theme: function () { setTheme(KIT.scene.ctx.theme === 'night' ? 'day' : 'night'); },
    replay: function () { window.postMessage({ type: 'es:replay' }, '*'); toast('Replay'); },
    pause: function () { paused = !paused; window.postMessage({ type: paused ? 'pause' : 'play' }, '*'); toast(paused ? 'Paused' : 'Playing'); }
  };
  function actions(host) {
    [['png', 'PNG'], ['link', 'Copy link'], ['theme', 'Day / Night'], ['replay', 'Replay'], ['pause', 'Pause']].forEach(function (a) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = a[1];
      b.addEventListener('click', ACTS[a[0]]); host.appendChild(b);
    });
  }
  // fpsNominal: медиана первых 20 интервалов rAF (60 или 120), в съёмке всегда 60
  function measureFps() {
    return new Promise(function (res) {
      if (Q.get('capture') === '1' || Q.get('reduced') === '1') return res(60);
      const ts = []; let n = 0;
      function tick(t) { ts.push(t); if (++n < 21) requestAnimationFrame(tick); else {
        const d = ts.slice(1).map((v, i) => v - ts[i]).sort((a, b) => a - b), m = d[10];
        res(m && m < 11 ? 120 : 60); } }
      requestAnimationFrame(tick);
      setTimeout(() => res(60), 1500);
    });
  }
  RL.start = function (def, sc) {
    RL.variant = sc.variant;
    const groups = RL.groups(sc);
    def.params = RL.params(groups);
    def.presets = Object.keys(RL.PRESETS).map((k) => ({ id: k, values: Object.assign({ light: k }, RL.PRESETS[k]) }));
    const userInit = def.init, userStruct = def.structural;
    def.init = function (ctx) {
      // ночь по умолчанию под лампой (§10 Ф1), если пресет не задан адресом
      if (ctx.theme === 'night' && !Q.get('preset')) Object.assign(ctx.P, { light: 'lamp' }, RL.PRESETS.lamp);
      // ручки из адреса (?state=allowed&gap=30): ссылка воспроизводит кадр
      Object.keys(ctx.P).forEach(function (k) {
        if (!Q.has(k) || k === 'seed' || k === 'theme') return;
        const v = Q.get(k);
        ctx.P[k] = typeof ctx.P[k] === 'number' ? (isFinite(+v) ? +v : ctx.P[k]) : v;
      });
      if (userInit) userInit(ctx);
    };
    def.structural = function (ctx, path) {
      if (path === 'light' && RL.PRESETS[ctx.P.light]) {
        const pre = RL.PRESETS[ctx.P.light];
        Object.keys(pre).forEach(function (k) { ctx.P[k] = pre[k]; DG.panel.setValue(k, pre[k]); });
      }
      if (path === 'accent') TOK = null;
      if (userStruct) userStruct(ctx, path);
    };
    KIT.scene.register(def);
    const side = document.querySelector('.rl-side');
    if (side) {
      side.dataset.theme = Q.get('theme') === 'night' ? 'dark' : 'light';
      const h = side.querySelector('.rl-head');
      if (h) h.innerHTML = '<span class="rl-k">' + def.id + ' · ' + sc.variant + '</span><h1></h1><p></p>';
      if (h) { h.querySelector('h1').textContent = sc.name; h.querySelector('p').textContent = sc.blurb; }
      const acts = side.querySelector('.rl-acts'); if (acts) actions(acts);
    }
    window.addEventListener('keydown', function (e) {
      if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'i') ACTS.theme(); else if (k === 'r') ACTS.replay(); else if (k === 'p') ACTS.pause();
      else if (k === 'e') ACTS.png();
      else if (k === 's') { const c = KIT.scene.ctx; c.mode = c.mode === 'client' ? 'studio' : 'client'; DG.panel.setMode(c.mode); toast(c.mode); }
      // H (спрятать панель) намеренно нет: по приказу панель видна всегда
    });
    const fonts = document.fonts ? Promise.all([
      document.fonts.load("400 14px 'Geist'"), document.fonts.load("500 14px 'Geist'"), document.fonts.load("600 14px 'Geist'"),
      document.fonts.load("400 14px 'Geist Mono'"), document.fonts.load("500 14px 'Geist Mono'")]).catch(() => null) : Promise.resolve();
    Promise.all([fonts, RL.loadNoise(sc.noise), measureFps()]).then(function (r) {
      RL.fps = r[2] || 60;
      KIT.scene.start({ canvas: document.getElementById('c'), panelMount: document.querySelector('[data-panel]'), groups: groups, data: window.RELIEF_DATA });
    });
  };
})();
