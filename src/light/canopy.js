/* light/canopy.js · пресет canopy: пятна света сквозь крону (README §7.2, §7.5).
   Ход komorebi-light (MIT): свет сквозь листву это интеграл по диску солнца, поэтому ближние
   листья дают резкую кромку, дальние мягкую, а просветы проецируются круглыми «зайчиками»
   с логарифмическим спадом яркости. Ветер тремя полосами (ствол · ветка · лист, иерархия
   пружин из eljojo/komorebi, только прочитано). Маска G ∈ [0,1] умножает ТОЛЬКО прямой свет:
   её читает light/shade.js, отдельного слоя «поверх» нет (L1). Офскрин ¼ разрешения. */
(function () {
  'use strict';
  var R = window.RELIEF = window.RELIEF || {};
  var TAU = Math.PI * 2, Q = 0.25, HC = 600;
  var LAYERS = [{ h: 0.55, wind: 1.3, a: 0.52 }, { h: 1.0, wind: 1.0, a: 0.44 }, { h: 1.5, wind: 0.7, a: 0.36 }];
  var cv = null, cg = null, lay = null, lg = null, cache = null;

  function layout(seed, W, H, ui) {
    var key = R.streamBase + '|' + seed + '|' + W + '|' + H + '|' + ui;
    if (cache && cache.key === key) return cache;
    var r = R.stream(seed, 'canopy'), cl = [], fl = [], M = 80 * ui;
    for (var i = 0; i < 70; i++) {
      // кластер = горсть листьев: 7 эллипсов 18–64 px вокруг центра ветки
      var cx = -M + r() * (W + 2 * M), cy = -M + r() * (H + 2 * M), spread = (30 + 50 * r()) * ui, leaves = [];
      for (var q = 0; q < 7; q++) {
        var len = (18 + 46 * r()) * ui;
        leaves.push({ dx: (r() - 0.5) * 2 * spread, dy: (r() - 0.5) * 2 * spread, rx: len / 2, ry: len * (0.18 + 0.14 * r()), rot: r() * Math.PI });
      }
      cl.push({ x: cx, y: cy, leaves: leaves, layer: i % 3, branch: Math.floor(r() * 7),
        p1: r() * TAU, p2: r() * TAU, p3: r() * TAU });
    }
    for (var k = 0; k < 12; k++) fl.push({ x: r() * W, y: r() * H, rad: (7 + 12 * r()) * ui, p: r() * TAU, rank: k });
    var br = []; for (var b = 0; b < 7; b++) br.push([r() * TAU, r() * TAU]);
    cache = { key: key, cl: cl, fl: fl, br: br, gust: r() * TAU, trunk: [r() * TAU, r() * TAU] };
    return cache;
  }

  /* Маска G для кадра: w = 2π·(t mod P)/P, полосы ветра k=1 (6 px), 3 (2.5 px), 12 (0.8 px) × порыв */
  function mask(seed, W, H, ui, tsec, period, still) {
    var c = layout(seed, W, H, ui);
    var fw = Math.max(8, Math.ceil(W * Q)), fh = Math.max(8, Math.ceil(H * Q));
    if (!cv) { cv = document.createElement('canvas'); cg = cv.getContext('2d', { willReadFrequently: true });
      lay = document.createElement('canvas'); lg = lay.getContext('2d'); }
    if (cv.width !== fw || cv.height !== fh) { cv.width = lay.width = fw; cv.height = lay.height = fh; }
    var w = still ? 0 : TAU * ((tsec % period) / period);
    var kmax = Math.max(1, Math.floor(0.5 * period));            // полоса ветра не быстрее 0,5 Гц
    var gust = 0.7 + 0.3 * Math.sin(w + c.gust);
    var band = function (k, amp, ph) { return k <= kmax ? amp * Math.sin(k * w + ph) : 0; };
    cg.setTransform(1, 0, 0, 1, 0, 0);
    cg.globalCompositeOperation = 'source-over'; cg.filter = 'none';
    cg.fillStyle = 'rgb(255,255,255)'; cg.fillRect(0, 0, fw, fh);
    var sigG = 0.035 * HC * ui;
    for (var L = 2; L >= 0; L--) {
      var Ld = LAYERS[L];
      lg.setTransform(1, 0, 0, 1, 0, 0); lg.globalCompositeOperation = 'source-over';
      lg.fillStyle = 'rgb(255,255,255)'; lg.fillRect(0, 0, fw, fh);
      lg.fillStyle = 'rgba(0,0,0,' + Ld.a + ')';
      for (var i = 0; i < c.cl.length; i++) {
        var e = c.cl[i]; if (e.layer !== L) continue;
        var bp = c.br[e.branch];
        var dx = (band(1, 6, c.trunk[0]) + band(3, 2.5, bp[0]) + band(12, 0.8, e.p1)) * gust * Ld.wind * ui;
        var dy = (band(1, 3, c.trunk[1]) + band(3, 1.5, bp[1]) + band(12, 0.6, e.p2)) * gust * Ld.wind * ui;
        var tw = 0.04 * band(3, 1, e.p3);
        lg.beginPath();
        for (var q = 0; q < e.leaves.length; q++) {
          var lf = e.leaves[q], lx = (e.x + lf.dx + dx) * Q, ly = (e.y + lf.dy + dy) * Q;
          lg.moveTo(lx + lf.rx * Q, ly);
          lg.ellipse(lx, ly, lf.rx * Q, lf.ry * Q, lf.rot + tw, 0, TAU);
        }
        lg.fill();
      }
      // ближняя крона резче, дальняя мягче: σ растёт с высотой слоя
      cg.globalCompositeOperation = 'multiply';
      cg.filter = 'blur(' + (sigG * Ld.h * Q).toFixed(2) + 'px)';
      cg.drawImage(lay, 0, 0);
    }
    // «зайчики»: изображения солнечного диска в просветах, яркость спадает логарифмически по рангу
    cg.filter = 'blur(' + (2.2 * ui * Q).toFixed(2) + 'px)';
    cg.globalCompositeOperation = 'lighter';
    for (var f = 0; f < c.fl.length; f++) {
      var s = c.fl[f], a = 0.55 / (1 + Math.log(1 + s.rank)) * (0.75 + 0.25 * Math.sin(w + s.p));
      cg.fillStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
      cg.beginPath(); cg.arc((s.x + band(1, 6, c.trunk[0]) * gust) * Q, (s.y + band(1, 3, c.trunk[1]) * gust) * Q, s.rad * Q, 0, TAU); cg.fill();
    }
    cg.filter = 'none'; cg.globalCompositeOperation = 'source-over';
    var d = cg.getImageData(0, 0, fw, fh).data, A = new Float32Array(fw * fh);
    for (var p = 0, q = 0; q < A.length; p += 4, q++) A[q] = d[p] / 255;
    return {
      fw: fw, fh: fh, A: A,
      at: function (x, y) {
        var fx = Math.max(0, Math.min(fw - 1.001, x * Q - 0.5)), fy = Math.max(0, Math.min(fh - 1.001, y * Q - 0.5));
        var ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy, o = iy * fw + ix;
        var a0 = A[o] + (A[o + 1] - A[o]) * tx, a1 = A[o + fw] + (A[o + fw + 1] - A[o + fw]) * tx;
        return a0 + (a1 - a0) * ty;
      }
    };
  }

  R.canopy = { mask: mask, layout: layout };
})();
