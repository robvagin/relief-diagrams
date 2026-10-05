/* RELIEF lab rail · свет, материал, движение, адаптер панели v2, загрузка.
   Временный рельс вариантов horizon и agents (приказ 2026-10-05 (2)): после слияния
   cloud/playground переезжает на src/light/. Формулы README §7.2–§7.5 дословно.
   Цвета только из CSS-токенов страницы (--sc-*), хексов в коде нет (гейт 3-hardcode). */
(function () {
  'use strict';
  var TAU = Math.PI * 2;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function smoother(x) { x = clamp(x, 0, 1); return x * x * x * (x * (x * 6 - 15) + 10); }
  function mix(a, b, t) { return a + (b - a) * t; }

  // cubic-bezier(.23,1,.32,1): сборка и ход Мёбиуса (§7.5)
  function bezier(x1, y1, x2, y2) {
    return function (x) {
      if (x <= 0) return 0; if (x >= 1) return 1;
      var t = x;
      for (var i = 0; i < 10; i++) {
        var mt = 1 - t;
        var fx = 3 * x1 * t * mt * mt + 3 * x2 * t * t * mt + t * t * t - x;
        var dx = 3 * x1 * mt * mt + 6 * (x2 - x1) * t * mt + 3 * (1 - x2) * t * t;
        if (Math.abs(fx) < 1e-6 || Math.abs(dx) < 1e-6) break;
        t = clamp(t - fx / dx, 0, 1);
      }
      var m = 1 - t;
      return 3 * y1 * t * m * m + 3 * y2 * t * t * m + t * t * t;
    };
  }
  var EASE = bezier(0.23, 1, 0.32, 1);

  // хеш строки → [0,1): фазы плавания по id плашки и сиду (не зависят от порядка отрисовки)
  function hash01(s) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995) >>> 0; h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }

  // ── ручки §6.10: общие группы ─────────────────────────────────────────
  var COMMON = {
    'Свет': [
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
    'Материал': [
      ['grain', 'Зерно, %', 0, 4, 0.1, 1.6],
      ['uneven', 'Неровность, %', 0, 2, 0.1, 0.8],
      ['rim', 'Кант', 0, 1, 0.01, 0.5],
      ['radius', 'Радиус плашки', 0, 8, 0.5, 6],
      ['zscale', 'Шкала высот', 0, 2, 0.01, 1],
      ['accent', 'Акцент', ['terracotta', 'cobalt', 'olive'], 'terracotta', ['Терракота', 'Кобальт', 'Олива']],
      ['hand', 'Рука', 0, 1, 1, 0]
    ],
    'Движение': [
      ['float', 'Плавание', 0, 2, 0.01, 1],
      ['period', 'Период, с', 12, 72, 1, 36],
      ['sway', 'Качание, °', 0, 1.5, 0.05, 0.3],
      ['bob', 'Дыхание тени', 0, 0.2, 0.01, 0.08],
      ['settle', 'Оседание, с', 0.3, 2, 0.05, 0.9],
      ['assemble', 'Сборка', 0, 1, 1, 1]
    ],
    'Выгрузка': [
      ['format', 'Формат', ['screen', '16:9', '1:1', '4:5'], 'screen', ['Экран', '16:9', '1:1', '4:5']],
      ['scale', 'Масштаб', 1, 3, 1, 2]
    ]
  };
  var ORDER = ['Сцена', 'Свет', 'Материал', 'Движение', 'Ритм', 'Данные', 'Выгрузка'];

  // §6.3 пресеты света: задают старт, ручки остаются живыми
  var PRESETS = {
    soft:   { az: 135, elev: 42, soft: 0.28, dens: 0.20, amb: 0.72, pool: 0, canopy: 0 },
    raking: { az: 160, elev: 22, soft: 0.20, dens: 0.26, amb: 0.66, pool: 0, canopy: 0 },
    lamp:   { soft: 0.30, dens: 0.30, amb: 0.40, pool: 0.55, lampH: 900, canopy: 0 },
    canopy: { az: 140, elev: 48, soft: 0.30, dens: 0.20, amb: 0.72, pool: 0, canopy: 0.22 }
  };
  var LAMP_XY = [0.32, 0.28];
  var Z = [0, 4, 12, 28];               // §6.2 лестница высот, px на 1440
  var DMAX = 0.6;                       // верх ручки «Плотность тени»: нормировка маски

  // ── токены сцены из CSS ───────────────────────────────────────────────
  function parseColor(s) {
    s = String(s || '').trim();
    if (s.charAt(0) === '#') {
      var h = s.slice(1);
      if (h.length === 3) h = h.replace(/./g, function (c) { return c + c; });
      var n = parseInt(h, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    var m = s.match(/[\d.]+/g);
    return m ? [+m[0], +m[1], +m[2]] : [128, 128, 128];
  }
  function rgba(c, a) { return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + (a === undefined ? 1 : +a.toFixed(4)) + ')'; }
  function lum(c) {
    var f = function (v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  }
  var TOK = null;
  function tokens() {
    if (TOK) return TOK;
    var cs = getComputedStyle(document.documentElement), r = {};
    ['ground', 'plate', 'ink', 'ink2', 'ink3', 'shadow', 'light',
     'acc-terracotta', 'acc-cobalt', 'acc-olive'].forEach(function (k) {
      r[k] = parseColor(cs.getPropertyValue('--sc-' + k));
    });
    r.lineA = parseFloat(cs.getPropertyValue('--sc-line-a')) || 0.22;
    TOK = r;
    return r;
  }

  // ── единицы §7.1 ─────────────────────────────────────────────────────
  function units(ctx) {
    var ui = clamp(Math.min(ctx.W / 1440, ctx.H / 900), 0.34, 1.6);
    var dpr = ctx.canvas.width / ctx.W;
    return {
      ui: ui, dpr: dpr, u: Math.min(ctx.W, ctx.H) / 48,
      margin: 0.06 * Math.min(ctx.W, ctx.H),
      lineW: Math.max(1 / dpr, 1.25 * ui),
      z: function (lv) { return Z[lv] * (+ctx.P.zscale) * ui; },
      fs: function (k) { return [11.67, 14, 16.8, 20.16, 24.19, 29.03, 34.84, 41.8][k - 1] * Math.max(0.8, ui); }
    };
  }

  // ── время §7.5: только номер кадра и fpsNominal ───────────────────────
  var FPS = { nominal: 60, at: 0, base: 0, samples: [], done: false };
  (function measure() {
    var last = null;
    function tick(ts) {
      if (last !== null) FPS.samples.push(ts - last);
      last = ts;
      if (FPS.samples.length < 20) { requestAnimationFrame(tick); return; }
      var s = FPS.samples.slice().sort(function (a, b) { return a - b; });
      var med = s[10];
      FPS.done = true;
      if (med > 0 && med < 11 && window.__CONTEXT !== 'capture') {
        FPS.at = window.__FRAMES; FPS.base = FPS.at / 60; FPS.nominal = 120;
      }
    }
    requestAnimationFrame(tick);
  })();
  function tsec(ctx) {
    if (ctx.exportT !== undefined) return ctx.exportT;
    if (FPS.nominal === 60) return ctx.t / 60;
    return ctx.t < FPS.at ? ctx.t / 60 : FPS.base + (ctx.t - FPS.at) / FPS.nominal;
  }

  // ── свет §7.2 ────────────────────────────────────────────────────────
  function lightState(ctx, U) {
    var P = ctx.P, th = (+P.az) * Math.PI / 180, ph = clamp(+P.elev, 1, 89) * Math.PI / 180;
    var lamp = P.light === 'lamp';
    return {
      lamp: lamp, th: th, ph: ph, cot: Math.cos(ph) / Math.sin(ph),
      d: [-Math.cos(th), Math.sin(th)],
      lxy: [Math.cos(ph) * Math.cos(th), -Math.cos(ph) * Math.sin(th)],
      sin: Math.sin(ph), soft: +P.soft, dens: +P.dens, amb: +P.amb, contact: +P.contact,
      L: [LAMP_XY[0] * ctx.W, LAMP_XY[1] * ctx.H, (+P.lampH) * U.ui],
      pool: +P.pool, canopy: +P.canopy, temp: +P.temp
    };
  }
  function shadowOffset(Lt, c, dh) {
    if (Lt.lamp) {
      var k = dh / Math.max(1, Lt.L[2] - c.zz);
      return [(c.cx - Lt.L[0]) * k, (c.cy - Lt.L[1]) * k];
    }
    return [dh * Lt.cot * Lt.d[0], dh * Lt.cot * Lt.d[1]];
  }
  function density(Lt, dh) { return Lt.dens * (1 - 0.35 * sstep(0, 40, dh)); }
  function lxyAt(Lt, c) {
    if (!Lt.lamp) return Lt.lxy;
    var dx = Lt.L[0] - c.cx, dy = Lt.L[1] - c.cy, dz = Lt.L[2], n = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    return [dx / n, dy / n];
  }

  // ── формы ────────────────────────────────────────────────────────────
  function shapePath(g, p, ox, oy) {
    ox = ox || 0; oy = oy || 0;
    g.beginPath();
    if (p.kind === 'disc') { g.arc(p.cx + ox, p.cy + oy, p.r, 0, TAU); return; }
    var rr = Math.min(p.rad, p.w / 2, p.h / 2);
    if (p.rot) {
      g.save(); g.translate(p.cx + ox, p.cy + oy); g.rotate(p.rot);
      g.roundRect(-p.w / 2, -p.h / 2, p.w, p.h, rr); g.restore();
    } else {
      g.roundRect(p.cx - p.w / 2 + ox, p.cy - p.h / 2 + oy, p.w, p.h, rr);
    }
  }
  function bbox(p) {
    if (p.kind === 'disc') return [p.cx - p.r, p.cy - p.r, p.cx + p.r, p.cy + p.r];
    var ex = p.rot ? Math.abs(Math.sin(p.rot)) * p.h / 2 + 1 : 0, ey = p.rot ? Math.abs(Math.sin(p.rot)) * p.w / 2 + 1 : 0;
    return [p.cx - p.w / 2 - ex, p.cy - p.h / 2 - ey, p.cx + p.w / 2 + ex, p.cy + p.h / 2 + ey];
  }

  // ── спрайты тени: кеш по (форма, σ шагом 0.25 px) §7.3 ─────────────────
  var SPR = new Map();
  function q(v, s) { return Math.round(v / s) * s; }
  function sprite(p, sig, ms) {
    var w = p.kind === 'disc' ? q(p.r * 2, 0.5) : q(p.w, 0.5), h = p.kind === 'disc' ? w : q(p.h, 0.5);
    var rr = p.kind === 'disc' ? w / 2 : q(Math.min(p.rad, w / 2, h / 2), 0.5);
    var s = q(sig, 0.25), key = p.kind + '|' + w + '|' + h + '|' + rr + '|' + s + '|' + ms;
    var c = SPR.get(key);
    if (c) return c;
    if (SPR.size > 600) SPR.clear();
    var pad = Math.ceil(3 * s + 2);
    c = document.createElement('canvas');
    c.width = Math.max(2, Math.ceil((w + pad * 2) * ms)); c.height = Math.max(2, Math.ceil((h + pad * 2) * ms));
    var g = c.getContext('2d');
    g.fillStyle = 'rgb(0,0,0)'; g.fillRect(0, 0, c.width, c.height);
    g.filter = s * ms > 0.05 ? 'blur(' + (s * ms).toFixed(2) + 'px)' : 'none';
    g.fillStyle = 'rgb(255,255,255)';
    g.beginPath(); g.roundRect(pad * ms, pad * ms, w * ms, h * ms, rr * ms); g.fill();
    c.pad = pad; c.sw = w; c.sh = h;
    SPR.set(key, c);
    return c;
  }
  var MASK = { c: null, g: null };
  function scratch(w, h) {
    if (!MASK.c) { MASK.c = document.createElement('canvas'); MASK.g = MASK.c.getContext('2d'); }
    if (MASK.c.width < w || MASK.c.height < h) { MASK.c.width = Math.max(w, MASK.c.width); MASK.c.height = Math.max(h, MASK.c.height); }
    return MASK;
  }

  // тени на один приёмник (null = пол): маска = max по заслонителям §7.3 шаг 3
  function shade(g, ctx, Lt, T, recv, plates, U) {
    var hr = recv ? recv.zz : 0;
    var box = recv ? bbox(recv) : [0, 0, ctx.W, ctx.H];
    box = [Math.floor(box[0]) - 1, Math.floor(box[1]) - 1, Math.ceil(box[2]) + 1, Math.ceil(box[3]) + 1];
    var items = [];
    for (var i = 0; i < plates.length; i++) {
      var c = plates[i];
      if (c === recv || c.zz <= hr + 0.05) continue;
      var dh = c.zz - hr, o = shadowOffset(Lt, c, dh), sig = 0.6 + Lt.soft * dh, D = density(Lt, dh);
      var b = bbox(c), m = 3 * sig + 2;
      if (b[0] + o[0] - m > box[2] || b[2] + o[0] + m < box[0] || b[1] + o[1] - m > box[3] || b[3] + o[1] + m < box[1]) continue;
      if (recv) {   // приёмник ловит только то, что над ним, а не рядом
        var rb = bbox(recv);
        if (b[0] > rb[2] + 3 * sig + Math.abs(o[0]) || b[2] < rb[0] - 3 * sig - Math.abs(o[0]) ||
            b[1] > rb[3] + 3 * sig + Math.abs(o[1]) || b[3] < rb[1] - 3 * sig - Math.abs(o[1])) continue;
      }
      items.push([c, o, sig, D / DMAX]);
      if (dh <= 16) {
        var dc = Lt.contact * Math.max(0, 1 - dh / 16);
        if (dc > 0) items.push([c, [o[0] * 0.25, o[1] * 0.25], 0.8 + 0.06 * dh, dc / DMAX]);
        items.push([c, [0, 0], 2, 0.04 / DMAX]);
      }
    }
    if (!items.length) return;
    // маска только там, где тени реально лежат: объединение следов ∩ приёмник
    var ub = [1e9, 1e9, -1e9, -1e9];
    items.forEach(function (it) {
      var b2 = bbox(it[0]), mm = 3 * it[2] + 2;
      ub[0] = Math.min(ub[0], b2[0] + it[1][0] - mm); ub[1] = Math.min(ub[1], b2[1] + it[1][1] - mm);
      ub[2] = Math.max(ub[2], b2[2] + it[1][0] + mm); ub[3] = Math.max(ub[3], b2[3] + it[1][1] + mm);
    });
    box = [Math.max(box[0], Math.floor(ub[0])), Math.max(box[1], Math.floor(ub[1])), Math.min(box[2], Math.ceil(ub[2])), Math.min(box[3], Math.ceil(ub[3]))];
    if (box[2] <= box[0] || box[3] <= box[1]) return;
    var ms = Math.max(0.5, U.dpr * 0.5);
    var bw = box[2] - box[0], bh = box[3] - box[1];
    var mw = Math.max(1, Math.ceil(bw * ms)), mh = Math.max(1, Math.ceil(bh * ms));
    var PADM = 3, M = scratch(mw + PADM * 2, mh + PADM * 2), mg = M.g;   // поле вокруг маски: билинейная выборка у края не берёт мусор
    mg.setTransform(1, 0, 0, 1, 0, 0);
    mg.globalCompositeOperation = 'source-over'; mg.globalAlpha = 1; mg.filter = 'none';
    mg.fillStyle = 'rgb(0,0,0)'; mg.fillRect(0, 0, mw + PADM * 2, mh + PADM * 2);
    mg.globalCompositeOperation = 'lighten';
    for (var k = 0; k < items.length; k++) {
      var it = items[k], cc = it[0], sp = sprite(cc, it[2], ms);
      mg.globalAlpha = clamp(it[3], 0, 1);
      var px = (cc.cx + it[1][0] - box[0]) * ms + PADM, py = (cc.cy + it[1][1] - box[1]) * ms + PADM;
      if (cc.rot) {
        mg.save(); mg.translate(px, py); mg.rotate(cc.rot);
        mg.drawImage(sp, -sp.width / 2, -sp.height / 2); mg.restore();
      } else mg.drawImage(sp, px - sp.width / 2, py - sp.height / 2);
    }
    // маска m → слой 1 − m·K, K = DMAX/(1−Y)·(1 − tint) по каналам: final = base·(1 − a(1 − tint))
    var tint = T.shadowUse, Y = lum(tint), kk = DMAX / Math.max(0.2, 1 - Y);
    mg.globalAlpha = 1;
    mg.globalCompositeOperation = 'multiply';
    mg.fillStyle = rgba([255 * clamp((1 - tint[0] / 255) * kk, 0, 1), 255 * clamp((1 - tint[1] / 255) * kk, 0, 1), 255 * clamp((1 - tint[2] / 255) * kk, 0, 1)]);
    mg.fillRect(0, 0, mw + PADM * 2, mh + PADM * 2);
    mg.globalCompositeOperation = 'difference';
    mg.fillStyle = 'rgb(255,255,255)'; mg.fillRect(0, 0, mw + PADM * 2, mh + PADM * 2);
    g.save();
    if (recv) { shapePath(g, recv); g.clip(); }
    g.globalCompositeOperation = 'multiply';
    g.imageSmoothingEnabled = true;
    // пол под большой плашкой не виден: сводим только полосы вокруг неё (бюджет кадра)
    var hole = null;
    if (!recv) plates.forEach(function (c) {
      if (c.kind !== 'rect' || c.rot || c.w * c.h < 0.25 * ctx.W * ctx.H) return;
      if (!hole || c.w * c.h > hole.w * hole.h) hole = c;
    });
    var strips = [[box[0], box[1], box[2], box[3]]];
    if (hole) {
      var ins = Math.min(hole.rad, hole.w / 2, hole.h / 2) + 2;
      var hb = [hole.cx - hole.w / 2 + ins, hole.cy - hole.h / 2 + ins, hole.cx + hole.w / 2 - ins, hole.cy + hole.h / 2 - ins];
      hb = [Math.max(box[0], Math.ceil(hb[0])), Math.max(box[1], Math.ceil(hb[1])), Math.min(box[2], Math.floor(hb[2])), Math.min(box[3], Math.floor(hb[3]))];
      if (hb[2] > hb[0] && hb[3] > hb[1]) strips = [[box[0], box[1], box[2], hb[1]], [box[0], hb[3], box[2], box[3]], [box[0], hb[1], hb[0], hb[3]], [hb[2], hb[1], box[2], hb[3]]];
    }
    strips.forEach(function (st) {
      var sw2 = st[2] - st[0], sh2 = st[3] - st[1];
      if (sw2 <= 0 || sh2 <= 0) return;
      g.drawImage(M.c, (st[0] - box[0]) * ms + PADM, (st[1] - box[1]) * ms + PADM, sw2 * ms, sh2 * ms, st[0], st[1], sw2, sh2);
    });
    g.restore();
  }

  function rimOf(g, p, Lt, T, P) {
    var a = +P.rim; if (a <= 0) return;
    var l = lxyAt(Lt, p);
    g.save(); shapePath(g, p); g.clip();
    g.lineWidth = 0.75;
    shapePath(g, p, -0.5 * l[0] * 1.6, -0.5 * l[1] * 1.6);
    g.strokeStyle = rgba(T.light, 0.6 * a); g.stroke();
    shapePath(g, p, 0.5 * l[0] * 1.6, 0.5 * l[1] * 1.6);
    g.strokeStyle = rgba(T.shadowUse, 0.35 * a); g.stroke();
    g.restore();
  }

  // ── материал §7.4: неровность (value-noise ⅙ кадра) и зерно (синий шум) ─
  var NOISE = { img: null, pat: null, uneven: null, key: '' };
  function unevenTex(ctx) {
    var key = ctx.seed + '|' + ctx.W + 'x' + ctx.H;
    if (NOISE.uneven && NOISE.key === key) return NOISE.uneven;
    var cw = 9, ch = Math.max(4, Math.round(9 * ctx.H / ctx.W));  // ячейка ≈ ⅙ кадра с запасом
    var c = document.createElement('canvas'); c.width = cw; c.height = ch;
    var g = c.getContext('2d'), im = g.createImageData(cw, ch);
    for (var y = 0; y < ch; y++) for (var x = 0; x < cw; x++) {
      var v = Math.round(hash01(ctx.seed + '/uneven/' + x + ',' + y) * 255), i = (y * cw + x) * 4;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    NOISE.uneven = c; NOISE.key = key;
    return c;
  }
  function overlayAmount(base, pct) {   // знаковое ±pct % через overlay вокруг серого 0.5
    var b = lum(base), k = Math.max(0.03, 2 * Math.min(b, 1 - b));
    return clamp((pct / 100) / (k * 0.5), 0, 1);
  }
  function material(g, ctx, T, U) {
    var P = ctx.P;
    if (+P.uneven > 0) {
      g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = overlayAmount(T.ground, +P.uneven);
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(unevenTex(ctx), 0, 0, ctx.W, ctx.H); g.restore();
    }
    if (+P.grain > 0 && NOISE.img) {
      if (!NOISE.pat || NOISE.patG !== g) { NOISE.pat = g.createPattern(NOISE.img, 'repeat'); NOISE.patG = g; }
      var sh = Math.floor(hash01(ctx.seed + '/grain') * 128);
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'overlay'; g.globalAlpha = overlayAmount(T.ground, +P.grain);
      g.translate(-sh, -((sh * 7) % 128));
      g.fillStyle = NOISE.pat; g.fillRect(0, 0, g.canvas.width + 128, g.canvas.height + 128);
      g.restore();
    }
  }

  // ── поле света после плашек: общая освещённость, лампа, листва, температура ─
  var E_REF = 0.72 + 0.28 * Math.sin(42 * Math.PI / 180);
  var CAN = { c: null };
  function lightField(g, ctx, Lt, T, U, ts) {
    var W = ctx.W, H = ctx.H;
    g.save();
    g.globalCompositeOperation = 'multiply';
    if (Lt.lamp) {
      // E(p) ∝ (H_L − h)/|P_L − p|³, нормировано под лампой; lit = mix(1, E^0.6, pool)
      var Hl = Lt.L[2], R = Math.hypot(Math.max(Lt.L[0], W - Lt.L[0]), Math.max(Lt.L[1], H - Lt.L[1]));
      var gr = g.createRadialGradient(Lt.L[0], Lt.L[1], 0, Lt.L[0], Lt.L[1], R);
      for (var i = 0; i <= 12; i++) {
        var r = R * i / 12, E = Math.pow(Hl / Math.sqrt(Hl * Hl + r * r), 3);
        var lit = mix(1, Math.pow(E, 0.6), Lt.pool);
        var f = clamp((Lt.amb + (1 - Lt.amb) * lit) / E_REF, 0.05, 1);
        gr.addColorStop(i / 12, rgba([255 * f, 255 * f, 255 * f]));
      }
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    } else {
      var f0 = clamp((Lt.amb + (1 - Lt.amb) * Lt.sin) / E_REF, 0.05, 1);
      if (f0 < 0.999) { g.fillStyle = rgba([255 * f0, 255 * f0, 255 * f0]); g.fillRect(0, 0, W, H); }
    }
    if (Lt.temp > 0) { g.globalAlpha = 0.45 * Lt.temp; g.fillStyle = rgba(T.light); g.fillRect(0, 0, W, H); }
    g.restore();
    if (Lt.canopy > 0) canopy(g, ctx, Lt, U, ts);
  }
  // листва §7.2: 70 кластеров 18–64 px, σ_g = 0.035·600, 12 зайчиков, ветер в три полосы §7.5
  function canopy(g, ctx, Lt, U, ts) {
    var W = ctx.W, H = ctx.H, s = 0.25, cw = Math.ceil(W * s), ch = Math.ceil(H * s);
    if (!CAN.c) { CAN.c = document.createElement('canvas'); CAN.g = CAN.c.getContext('2d'); }
    if (CAN.c.width !== cw || CAN.c.height !== ch) { CAN.c.width = cw; CAN.c.height = ch; }
    var cg = CAN.g, Pp = +ctx.P.period, w = TAU * ((ts % Pp) / Pp);
    var bands = [[1, 6], [3, 2.5], [12, 0.8]].filter(function (b) { return b[0] <= Math.floor(0.5 * Pp); });
    var gust = 0.7 + 0.3 * Math.sin(w + hash01(ctx.seed + '/gust') * TAU);
    cg.setTransform(1, 0, 0, 1, 0, 0); cg.globalCompositeOperation = 'source-over'; cg.filter = 'none';
    cg.fillStyle = 'rgb(255,255,255)'; cg.fillRect(0, 0, cw, ch);
    cg.filter = 'blur(' + (0.035 * 600 * U.ui * s).toFixed(2) + 'px)';
    cg.fillStyle = 'rgb(0,0,0)';
    for (var i = 0; i < 70; i++) {
      var k = ctx.seed + '/leaf/' + i, x = hash01(k + 'x') * W, y = hash01(k + 'y') * H;
      var rx = (18 + hash01(k + 'r') * 46) * U.ui, ry = rx * (0.55 + hash01(k + 'e') * 0.4), dx = 0, dy = 0;
      for (var b = 0; b < bands.length; b++) {
        var ph = hash01(k + 'p' + b) * TAU;
        dx += bands[b][1] * Math.sin(bands[b][0] * w + ph); dy += bands[b][1] * 0.6 * Math.cos(bands[b][0] * w + ph * 1.3);
      }
      cg.globalAlpha = 0.55;
      cg.beginPath(); cg.ellipse((x + dx * gust * U.ui) * s, (y + dy * gust * U.ui) * s, rx * s, ry * s, hash01(k + 'a') * Math.PI, 0, TAU); cg.fill();
    }
    cg.filter = 'blur(' + (2 * U.ui * s).toFixed(2) + 'px)';
    cg.globalAlpha = 1; cg.fillStyle = 'rgb(255,255,255)';
    for (var j = 0; j < 12; j++) {
      var kj = ctx.seed + '/fleck/' + j;
      cg.beginPath(); cg.arc(hash01(kj + 'x') * W * s, hash01(kj + 'y') * H * s, (4 + hash01(kj + 'r') * 7) * U.ui * s, 0, TAU); cg.fill();
    }
    // lit = amb + (1 − amb)·sinφ·G: тёмное в маске = доля прямого света, которую съела крона
    var depth = clamp(Lt.canopy * 2.2, 0, 1) * (1 - Lt.amb) * Lt.sin / (Lt.amb + (1 - Lt.amb) * Lt.sin);
    cg.filter = 'none'; cg.globalCompositeOperation = 'screen'; cg.globalAlpha = 1;
    var v = Math.round(255 * (1 - depth));
    cg.fillStyle = rgba([v, v, v]); cg.fillRect(0, 0, cw, ch);
    g.save(); g.globalCompositeOperation = 'multiply'; g.imageSmoothingEnabled = true;
    g.drawImage(CAN.c, 0, 0, cw, ch, 0, 0, W, H); g.restore();
  }

  // ── движение §7.5: плавание, оседание, сборка ────────────────────────
  function floatOf(p, ctx, ts, U) {
    var P = ctx.P, env = ctx.reduced ? 0 : (p.env === undefined ? 1 : p.env);
    p.dx = 0; p.dy = 0; p.rot = 0; p.zz = p.z;
    if (env <= 0 || p.z <= 0) return;
    var key = ctx.seed + '/' + p.id, ph = [];
    for (var i = 0; i < 10; i++) ph.push(hash01(key + '/' + i) * TAU);
    var Pp = +P.period, w = TAU * ((ts % Pp) / Pp);
    var size = p.kind === 'disc' ? p.r * 2 : Math.min(p.w, p.h);
    var A = (+P.float) * Math.min(2.4, 0.004 * size) * U.ui * env;
    p.dx = A * (0.62 * Math.sin(w + ph[0]) + 0.28 * Math.sin(2 * w + ph[1]) + 0.10 * Math.sin(3 * w + ph[2]));
    p.dy = A * (0.62 * Math.sin(w + ph[3]) + 0.28 * Math.sin(2 * w + ph[4]) + 0.10 * Math.sin(3 * w + ph[5]));
    if (p.kind !== 'disc') p.rot = env * (+P.sway) * Math.PI / 180 * (0.7 * Math.sin(w + ph[6]) + 0.3 * Math.sin(2 * w + ph[7]));
    p.zz = p.z + env * (+P.bob) * p.z * (0.7 * Math.sin(w + ph[8]) + 0.3 * Math.sin(3 * w + ph[9]));
  }
  // огибающая оседания: env 1 → 0 за settle с по smootherstep от момента t0 (с)
  function settleEnv(ts, t0, settle) { return t0 === null || t0 === undefined ? 1 : 1 - smoother((ts - t0) / Math.max(0.05, settle)); }
  // сборка: плашки поднимаются с h = 0 в порядке чтения (h, y, x), шаг 80 мс, 520 мс
  function assembly(plates, ctx, ts) {
    if (!(+ctx.P.assemble) || ctx.reduced) return;
    var order = plates.filter(function (p) { return p.z > 0; }).sort(function (a, b) {
      return (a.z - b.z) || (a.cy - b.cy) || (a.cx - b.cx);
    });
    var step = order.length > 24 ? 1.6 / order.length : 0.08;
    var t0 = (ctx.assembleAt || 0) + 0.25;
    for (var i = 0; i < order.length; i++) {
      var k = EASE((ts - t0 - i * step) / 0.52);
      order[i].z *= k; order[i].lift = k;
    }
  }

  // ── главный проход §7.3 ──────────────────────────────────────────────
  function render(ctx, sc) {
    var g = ctx.g, W = ctx.W, H = ctx.H, P = ctx.P, U = units(ctx), T0 = tokens(), ts = tsec(ctx);
    var Lt = lightState(ctx, U);
    var T = Object.create(T0);
    // температура: тень холоднее при temp > 0, к нейтрали при temp → −1
    var sy = lum(T0.shadow), gray = Math.pow(sy, 1 / 2.2) * 255, tmix = clamp(0.5 + 0.5 * Lt.temp, 0, 1);
    T.shadowUse = [mix(gray, T0.shadow[0], tmix), mix(gray, T0.shadow[1], tmix), mix(gray, T0.shadow[2], tmix)];
    T.accent = T0['acc-' + P.accent] || T0['acc-terracotta'];
    var plates = sc.plates || [];
    plates.forEach(function (p) {
      if (p.kind === 'rect') { p.cx = p.x + p.w / 2; p.cy = p.y + p.h / 2; } else { p.cx = p.x; p.cy = p.y; }
      if (p.rad === undefined && p.kind === 'rect') p.rad = (+P.radius) * U.ui;
    });
    assembly(plates, ctx, ts);
    plates.forEach(function (p) { floatOf(p, ctx, ts, U); p.cx += p.dx; p.cy += p.dy; });

    g.save();
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.fillStyle = rgba(T.ground); g.fillRect(0, 0, W, H);
    if (sc.floor) { g.save(); sc.floor(g, T, U); g.restore(); }
    shade(g, ctx, Lt, T, null, plates, U);
    var order = plates.slice().sort(function (a, b) { return (a.zz - b.zz) || (a.cy - b.cy); });
    for (var i = 0; i < order.length; i++) {
      var p = order[i];
      if (p.zz <= 0.05 && p.flat) continue;
      shapePath(g, p); g.fillStyle = rgba(p.fill || T.plate); g.fill();
      if (p.print) {
        g.save(); shapePath(g, p); g.clip();
        g.translate(p.dx, p.dy);
        if (p.rot) { g.translate(p.cx - p.dx, p.cy - p.dy); g.rotate(p.rot); g.translate(-(p.cx - p.dx), -(p.cy - p.dy)); }
        p.print(g, T, U, p); g.restore();
      }
      shade(g, ctx, Lt, T, p, order.slice(i + 1), U);
      rimOf(g, p, Lt, T, P);
    }
    lightField(g, ctx, Lt, T, U, ts);
    material(g, ctx, T, U);
    if (sc.overlay) { g.save(); sc.overlay(g, T, U); g.restore(); }
    g.restore();
    return { T: T, U: U, L: Lt, ts: ts };
  }

  // ── текст §8: Geist слова, Geist Mono числа, трекинг по размеру ───────
  function font(g, U, k, weight, mono) {
    var px = U.fs(k);
    g.font = (weight || 400) + ' ' + px.toFixed(2) + 'px ' + (mono ? '"Geist Mono"' : 'Geist');
    var tr = px < 14 ? '0.02em' : px <= 20.5 ? '0em' : px < 50 ? '-0.01em' : '-0.02em';
    try { g.letterSpacing = tr; } catch (e) {}
    return px;
  }
  function caps(g, U, k) { font(g, U, k, 500); try { g.letterSpacing = '0.07em'; } catch (e) {} }

  // ── адаптер панели v2 к контракту kit-scene §7.11 ─────────────────────
  var PANELS = [], ROOT = null, OPTS = null;
  function buildPanel(opts) {
    OPTS = opts;
    var mount = opts.mount;
    mount.innerHTML = '';
    ROOT = document.createElement('div');
    ROOT.className = 'pv2';
    ROOT.setAttribute('data-theme', opts.theme === 'night' ? 'dark' : 'light');
    PANELS = [];
    (opts.groups || []).forEach(function (grp) {
      var rows = (grp.rows || []).filter(function (d) {
        var last = d[d.length - 1];
        return !(opts.mode === 'client' && last && typeof last === 'object' && !Array.isArray(last) && last.studio);
      });
      if (!rows.length) return;
      var fs = document.createElement('fieldset'), lg = document.createElement('legend');
      lg.textContent = grp.name; fs.appendChild(lg);
      PANELS.push(Podacha.Panel.build(fs, rows, opts.values, function (k, v) { opts.onChange(k, v); }));
      ROOT.appendChild(fs);
    });
    var act = document.createElement('div'); act.className = 'acts';
    [['PNG', function () { exportPNG(); }], ['Link', function () { copyLink(act); }]].forEach(function (a) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = a[0];
      b.addEventListener('click', a[1]); act.appendChild(b);
    });
    ROOT.appendChild(act);
    mount.appendChild(ROOT);
  }
  window.DG = window.DG || {};
  DG.panel = {
    build: buildPanel,
    setValue: function () { PANELS.forEach(function (p) { p.paint(); }); },
    getValues: function () { return OPTS ? Object.assign({}, OPTS.values) : {}; },
    setTheme: function (t) { if (ROOT) ROOT.setAttribute('data-theme', t === 'night' ? 'dark' : 'light'); },
    setMode: function (m) { if (OPTS) { OPTS.mode = m; buildPanel(OPTS); } },
    css: ''
  };

  // ── выгрузка PNG в формате §6.8 ×scale, тот же сид и номер кадра ──────
  var DEF = null;
  function exportPNG() {
    var c0 = KIT.scene.ctx; if (!c0 || !DEF) return;
    var P = c0.P, sz = { '16:9': [1920, 1080], '1:1': [1080, 1080], '4:5': [1080, 1350] }[P.format] || [c0.W, c0.H];
    var sc = Math.max(1, Math.round(+P.scale || 1));
    var cv = document.createElement('canvas'); cv.width = sz[0] * sc; cv.height = sz[1] * sc;
    var g = cv.getContext('2d'); g.setTransform(sc, 0, 0, sc, 0, 0);
    var x = Object.assign({}, c0, { canvas: cv, g: g, W: sz[0], H: sz[1], exportT: tsec(c0) });
    x.rand.reset(); x.randPal.reset(); x.randNoise.reset();
    var keep = NOISE.patG; NOISE.patG = null;
    DEF.draw(x);
    NOISE.patG = keep; NOISE.pat = null;
    var a = document.createElement('a');
    a.download = (window.RELIEF_DATA && RELIEF_DATA.meta ? RELIEF_DATA.meta.asOf : '2026-10-05') + '_relief_' + DEF.id + '-' + c0.theme + '-' + cv.width + 'x' + cv.height + '_v' + (DEF.variant || '01') + '.png';
    a.href = cv.toDataURL('image/png'); a.click();
  }
  function copyLink(host) {
    var u = new URL(location.href);
    u.searchParams.set('seed', KIT.scene.ctx.seed);
    try { navigator.clipboard.writeText(u.toString()); } catch (e) {}
    host.setAttribute('data-copied', '1');
  }

  // ── сцена: регистрация поверх kit-scene ───────────────────────────────
  function flat(d) {   // v2 → плоская форма kit для паспорта и toObjectParam
    if (Array.isArray(d[2])) return [d[0], d[1], d[2].slice(), { default: d[3] }];
    if (d[2] === 'color' || d[2] === 'text') return [d[0], d[1], { default: d[3] }];
    return d.slice(0, 6);
  }
  function defaultsOf(groups) {
    var v = {};
    groups.forEach(function (gr) { gr.rows.forEach(function (d) { v[d[0]] = Array.isArray(d[2]) || d[2] === 'color' || d[2] === 'text' ? d[3] : d[5]; }); });
    return v;
  }
  function scene(def) {
    DEF = def;
    var groups = ORDER.map(function (name) {
      var rows = (def.groups && def.groups[name]) || [];
      return { name: name, rows: (COMMON[name] || []).concat(rows) };
    }).filter(function (gr) { return gr.rows.length; });
    def.groupsV2 = groups;
    var all = []; groups.forEach(function (gr) { all = all.concat(gr.rows); });
    KIT.scene.register({
      id: def.id, title: def.title, blurb: def.blurb, params: all.map(flat),
      init: function (ctx) {
        if (ctx.theme === 'night') {
          Object.assign(ctx.P, PRESETS.lamp); ctx.P.light = 'lamp'; ctx.P.grain = 2.2;
        }
        if (def.init) def.init(ctx);
      },
      draw: function (ctx) { def.draw(ctx); },
      structural: function (ctx, path) {
        if (path === 'light' && PRESETS[ctx.P.light]) {
          var pr = PRESETS[ctx.P.light];
          Object.keys(pr).forEach(function (k) { ctx.P[k] = pr[k]; });
          if (window.DG && DG.panel) DG.panel.setValue();
        }
        if (path === 'assemble' || path === 'zscale') ctx.assembleAt = tsec(ctx);
        if (def.structural) def.structural(ctx, path);
      },
      svg: def.svg
    });
    def.values = defaultsOf(groups);
  }

  function boot() {
    var done = function () {
      var p = KIT.scene.list()[0];
      KIT.scene.start({
        canvas: document.getElementById('c'), panelMount: document.getElementById('panel'),
        groups: DEF.groupsV2, values: Object.assign({}, DEF.values), data: window.RELIEF_DATA, scene: p
      });
      hotkeys();
      if (DEF.attach) DEF.attach(KIT.scene.ctx);
    };
    var waits = [];
    var img = document.getElementById('bluenoise');
    if (img) waits.push((img.decode ? img.decode() : Promise.resolve()).then(function () { NOISE.img = img; }, function () {}));
    if (document.fonts && document.fonts.load) {
      waits.push(document.fonts.load('400 14px Geist')); waits.push(document.fonts.load('500 14px Geist'));
      waits.push(document.fonts.load('400 12px "Geist Mono"')); waits.push(document.fonts.load('500 12px "Geist Mono"'));
    }
    Promise.all(waits).then(done, done);
  }
  function hotkeys() {
    document.addEventListener('keydown', function (e) {
      if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var k = e.key.toLowerCase();
      if (k === 'r') { window.postMessage({ type: 'es:replay' }, '*'); var c = KIT.scene.ctx; if (c) c.assembleAt = 0; }
      else if (k === 'p') { RAIL.paused = !RAIL.paused; window.postMessage({ type: RAIL.paused ? 'pause' : 'play' }, '*'); }
      else if (k === 'e') exportPNG();
      else if (k === 'i') {
        var u = new URL(location.href);
        u.searchParams.set('theme', KIT.scene.ctx.theme === 'night' ? 'day' : 'night'); location.href = u.toString();
      }
    });
  }

  var RAIL = {
    TAU: TAU, clamp: clamp, mix: mix, sstep: sstep, smoother: smoother, EASE: EASE, bezier: bezier,
    hash01: hash01, rgba: rgba, lum: lum, tokens: tokens, units: units, tsec: tsec,
    render: render, font: font, caps: caps, settleEnv: settleEnv, scene: scene, boot: boot,
    shapePath: shapePath, exportPNG: exportPNG, paused: false
  };
  window.RELIEF = RAIL;
})();
