/* layout/labels.js · подписи и выноски (README §7.6 D; правило донора 01-ellipse-sphere).
   Чистые функции. place: кандидаты по направлению наружу, затем ±90°, первый свободный побеждает.
   callouts: коридор от габарита фигуры, один излом, сортировка по y источника, переполнение «+N». */
(function () {
  'use strict';
  var R = window.RELIEF = window.RELIEF || {};

  function hit(a, b) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }

  /* labels: [{x, y, w, h, angle, pad}] → [{x, y, w, h, ok}] (x,y — левый верх рамки текста) */
  function place(labels, obstacles, bounds) {
    var taken = (obstacles || []).slice(), out = [];
    labels.forEach(function (L) {
      // кандидаты: по направлению наружу, затем веером ±30°…±180° от него, на двух радиусах
      var pad = L.pad || 4, a0 = L.angle || 0, cands = [], radii = [0, L.h || 0];
      radii.forEach(function (dr) { for (var k = 0; k <= 6; k++) { cands.push([a0 + k * Math.PI / 6, dr]); if (k && k < 6) cands.push([a0 - k * Math.PI / 6, dr]); } });
      var best = null;
      for (var i = 0; i < cands.length && !best; i++) {
        var a = cands[i][0], d = (L.r || 0) + pad + cands[i][1], cx = L.x + Math.cos(a) * d, cy = L.y + Math.sin(a) * d;
        var bx = Math.cos(a) >= 0.3 ? cx : Math.cos(a) <= -0.3 ? cx - L.w : cx - L.w / 2;
        var by = Math.sin(a) >= 0.3 ? cy : Math.sin(a) <= -0.3 ? cy - L.h : cy - L.h / 2;
        var box = { x: bx, y: by, w: L.w, h: L.h };
        var inside = !bounds || (box.x >= bounds[0] && box.y >= bounds[1] && box.x + box.w <= bounds[0] + bounds[2] && box.y + box.h <= bounds[1] + bounds[3]);
        if (inside && !taken.some(function (t) { return hit(t, box); })) best = box;
      }
      if (best) taken.push(best);
      out.push(best ? Object.assign({ ok: true }, best) : { ok: false, x: L.x, y: L.y, w: L.w, h: L.h });
    });
    return out;
  }

  /* callouts: источники [{x,y,text}] справа от фигуры (bbox fig), ряды шагом step; лишнее → «+N» */
  function callouts(sources, fig, rect, step) {
    var s = sources.slice().sort(function (a, b) { return a.y - b.y; }), x = fig.x + fig.w + step * 1.5;
    var rows = Math.max(1, Math.floor(rect[3] / step)), shown = s.slice(0, rows), rest = s.length - shown.length;
    var y0 = Math.max(rect[1], Math.min(rect[1] + rect[3] - shown.length * step, (shown[0] ? shown[0].y : rect[1]) - step / 2));
    var out = shown.map(function (src, i) {
      var y = y0 + i * step + step / 2;
      return { src: src, path: [[src.x, src.y], [fig.x + fig.w + step * 0.6, y], [x, y]], at: [x + 4, y] };
    });
    return { items: out, more: rest > 0 ? '+' + rest : null };
  }

  R.layout = R.layout || {};
  R.layout.labels = { place: place, callouts: callouts };
})();
