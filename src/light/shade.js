/* light/shade.js · тени по приёмникам (README §7.3, L1, L2) в бюджете кадра (canvas-frame-budget).
   Для каждого приёмника (пол, каждая плашка) — своё поле затенения от всех, кто выше: Δh постоянна
   на паре «заслонитель · приёмник», значит сдвиг, σ и плотность тоже.
   Покрытие читается из поля расстояний (light/sdf.js: Φ(−sd/σ)) ОДИН раз на спрайт
   (форма, σ с шагом 0,25 px, плотность с шагом 0,005); плавание двигает спрайт, не пересчитывая его.
   Спрайт хранится сразу множителем тона тени M = 1 − k·(1 − tint)/(1 − Y); M монотонно убывает по k,
   поэтому объединение заслонителей «максимум затемнения» = минимум множителей = composite 'darken'
   (не сумма). Контакт и «юбка» AO — такие же спрайты. Поле кладётся на кадр одним multiply. Пятно лампы и листва — свои кешированные слои multiply (shade.pool, shade.canopy). */
(function () {
  'use strict';
  var R = window.RELIEF = window.RELIEF || {};

  function canvas(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; }
  function ensure(c, w, h) { if (c.width < w || c.height < h) { c.width = Math.max(c.width, w); c.height = Math.max(c.height, h); } }

  /* ── спрайты: покрытие из поля расстояний, один раз на ключ ─────────── */
  var SPR = new Map(), LIMIT = 2400;
  function sprite(c, sig, dens, tint) {
    var sq = Math.max(0.25, Math.round(sig * 4) / 4), dq = Math.round(dens * 200) / 200;
    if (dq <= 0) return null;
    var qs = function (v) { return (Math.round(v * 2) / 2).toFixed(1); };        // размер квантуется 0,5 px: семья мелких дисков делит спрайты
    var key = [tint.join(','), c.kind, qs(c.w), qs(c.h), qs(c.r || 0), sq, dq, c.holes ? JSON.stringify(c.holes) : ''].join('|');
    var s = SPR.get(key);
    if (s) { SPR.delete(key); SPR.set(key, s); return s; }      // LRU: свежий в конец
    var pad = Math.ceil(3.4 * sq) + 2, w = Math.ceil(+qs(c.w)) + 2 * pad, h = Math.ceil(+qs(c.h)) + 2 * pad;
    var cv = canvas(w, h), g = cv.getContext('2d'), im = g.createImageData(w, h), d = im.data;
    var shape = { kind: c.kind, x: w / 2, y: h / 2, w: +qs(c.w), h: +qs(c.h), r: +qs(c.r || 0), holes: c.holes };
    var sd = R.sdf.sd, cover = R.sdf.cover;
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) {
      var v = Math.min(1, dq * cover(sd(shape, i + 0.5, j + 0.5), sq)), p = (j * w + i) * 4;
      d[p] = Math.round(255 - v * (255 - tint[0])); d[p + 1] = Math.round(255 - v * (255 - tint[1]));
      d[p + 2] = Math.round(255 - v * (255 - tint[2])); d[p + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    s = { cv: cv, w: w, h: h };
    SPR.set(key, s);
    if (SPR.size > LIMIT) SPR.delete(SPR.keys().next().value);
    return s;
  }

  var dark = canvas(64, 64), dg = dark.getContext('2d');
  var tmp = canvas(64, 64), tg = tmp.getContext('2d');

  function stamp(sp, c, ox, oy, x0, y0) {
    dg.save();
    dg.translate(c.x + ox - x0, c.y + oy - y0);
    if (c.rot) dg.rotate(c.rot);
    dg.drawImage(sp.cv, -sp.w / 2, -sp.h / 2);
    dg.restore();
  }

  /* Поле на прямоугольник rect = [x, y, w, h] приёмника высоты hr; occs: формы (w, h — размер) с z.
     Возвращает поле-множитель {cv, x, y, w, h} или null; кладёт его на кадр shade.put (multiply). */
  function layer(L, rect, hr, occs, tint) {
    var x0 = Math.floor(rect[0]), y0 = Math.floor(rect[1]), w = Math.ceil(rect[2]), h = Math.ceil(rect[3]);
    var ys = (0.2126 * tint[0] + 0.7152 * tint[1] + 0.0722 * tint[2]) / 255, inv = 1 / Math.max(0.05, 1 - ys), ui = L.ui;
    var started = false;
    for (var i = 0; i < occs.length; i++) {
      var c = occs[i], dh = c.z - hr;
      if (dh <= 1e-3 || c.noShadow) continue;
      var o = R.light.offset(L, c.x, c.y, c.z, hr), sig = R.light.sigma(L, dh), D = R.light.density(L, dh);
      var ex = R.sdf.extent(c), reach = 3.4 * sig + 2, cont = dh <= 16 * ui;
      // отсев: след не задевает приёмник
      var fx0 = Math.min(c.x + o[0], c.x) - ex[0] - reach, fx1 = Math.max(c.x + o[0], c.x) + ex[0] + reach;
      var fy0 = Math.min(c.y + o[1], c.y) - ex[1] - reach, fy1 = Math.max(c.y + o[1], c.y) + ex[1] + reach;
      if (fx1 < x0 || fx0 > x0 + w || fy1 < y0 || fy0 > y0 + h) continue;
      if (!started) {
        ensure(dark, w, h);
        dg.setTransform(1, 0, 0, 1, 0, 0); dg.globalCompositeOperation = 'source-over';
        dg.fillStyle = 'rgb(255,255,255)'; dg.fillRect(0, 0, w, h);
        dg.globalCompositeOperation = 'darken';
        started = true;
      }
      var sp = sprite(c, sig, Math.min(1, D * inv), tint);
      if (sp) stamp(sp, c, o[0], o[1], x0, y0);
      if (cont) {
        // контакт: σ = 0,8 + 0,06·h, сдвиг 0,25·o, плотность contact·(1 − h/16); «юбка» AO σ 2 px,
        // 0,04 при контакте по умолчанию (0,12): ручка Контакт ведёт весь контактный слой
        var sc = (0.8 + 0.06 * dh / ui) * ui, Dc = L.contact * Math.max(0, 1 - dh / (16 * ui));
        var sk = 0.04 * Math.min(2, L.contact / 0.12);
        var spc = sprite(c, sc, Math.min(1, Dc * inv), tint); if (spc) stamp(spc, c, 0.25 * o[0], 0.25 * o[1], x0, y0);
        var sps = sprite(c, 2 * ui, Math.min(1, sk * inv), tint); if (sps) stamp(sps, c, 0, 0, x0, y0);
      }
    }
    if (!started) return null;
    // поле уходит в собственный холст: рельс держит его в кеше и кладёт multiply сколько угодно кадров
    var out = pooled(w, h); out.getContext('2d').drawImage(dark, 0, 0, w, h, 0, 0, w, h);
    return { cv: out, x: x0, y: y0, w: w, h: h };
  }
  /* пул холстов полей: кадр берёт новые, прошлый кадр отдаёт свои (shade.recycle в начале сборки) */
  var POOL = [], USED = [];
  function pooled(w, h) {
    var c = null;
    for (var i = 0; i < POOL.length; i++) if (POOL[i].width >= w && POOL[i].height >= h) { c = POOL.splice(i, 1)[0]; break; }
    if (!c) c = canvas(w, h);
    var x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'copy';
    USED.push(c); return c;
  }
  function recycle() { POOL = POOL.concat(USED); USED = []; if (POOL.length > 600) POOL.length = 600; }
  function put(g, F) {
    if (!F) return;
    g.save(); g.globalCompositeOperation = 'multiply';
    g.drawImage(F.cv, 0, 0, F.w, F.h, F.x, F.y, F.w, F.h); g.restore();
  }

  /* ── пятно лампы: lit = mix(1, E^0.6, pool), E = cos³; кеш на размер и лампу, ¼ разрешения ── */
  var poolCache = null;
  function pool(g, L, W, H, tint) {
    if (L.mode !== 'lamp' || !(L.lamp.pool > 0)) return;
    var key = [W, H, L.lamp.x, L.lamp.y, L.lamp.h, L.lamp.pool, tint.join(',')].join('|');
    if (!poolCache || poolCache.key !== key) {
      var q = 0.25, w = Math.ceil(W * q), h = Math.ceil(H * q), cv = canvas(w, h), cg = cv.getContext('2d'), im = cg.createImageData(w, h);
      var ys = (0.2126 * tint[0] + 0.7152 * tint[1] + 0.0722 * tint[2]) / 255, inv = 1 / Math.max(0.05, 1 - ys);
      for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) {
        var k = Math.min(1, (1 - R.light.lampLit(L, (i + 0.5) / q, (j + 0.5) / q, 0)) * inv), p = (j * w + i) * 4;
        for (var ch = 0; ch < 3; ch++) im.data[p + ch] = Math.round(255 * (1 - k + k * tint[ch] / 255));
        im.data[p + 3] = 255;
      }
      cg.putImageData(im, 0, 0);
      poolCache = { key: key, cv: cv };
    }
    g.save(); g.globalCompositeOperation = 'multiply'; g.imageSmoothingEnabled = true;
    g.drawImage(poolCache.cv, 0, 0, W, H); g.restore();
  }

  /* ── листва: множитель 1 − a·(1 − G) на прямой свет, a = canopy·доля прямого света ── */
  function canopy(g, L, W, H, G) {
    if (!G || !(L.canopy > 0)) return;
    var dirFrac = (1 - L.amb) * Math.sin(L.elev) / L.E0, a = Math.min(0.95, L.canopy * 2.2) * dirFrac;
    var w = G.cv.width, h = G.cv.height;
    ensure(tmp, w, h);
    tg.setTransform(1, 0, 0, 1, 0, 0); tg.globalAlpha = 1; tg.globalCompositeOperation = 'source-over';
    var base = Math.round(255 * (1 - a));
    tg.fillStyle = 'rgb(' + base + ',' + base + ',' + base + ')'; tg.fillRect(0, 0, w, h);
    tg.globalCompositeOperation = 'lighter'; tg.globalAlpha = a; tg.drawImage(G.cv, 0, 0);
    tg.globalAlpha = 1;
    g.save(); g.globalCompositeOperation = 'multiply'; g.imageSmoothingEnabled = true;
    g.drawImage(tmp, 0, 0, w, h, 0, 0, W, H); g.restore();
  }

  R.shade = { layer: layer, put: put, recycle: recycle, pool: pool, canopy: canopy, sprite: sprite };
})();
