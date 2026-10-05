/* layout/subdivide.js · дробление поля (README §7.6 A, сцена desk). Чистая функция:
   (items, rect, params, rand) → {cells, air}. Рекурсивное деление по длинной стороне, доля разреза
   из {0.5, 0.382, 0.618} ближе всего к доле весов; зазор 1u; листья без виджета = воздух. */
(function () {
  'use strict';
  var R = window.RELIEF = window.RELIEF || {};
  var CUTS = [0.5, 0.382, 0.618];

  function subdivide(items, rect, params, rand) {
    params = params || {};
    var depthMax = params.depth || 4, gap = params.gap || 0, air = params.air == null ? 0.45 : params.air;
    var drift = params.drift ? (params.u || 8) * 0.5 : 0, cells = [];
    var total = items.reduce(function (s, it) { return s + (it.weight || 1); }, 0) / Math.max(0.05, 1 - air);
    function split(list, r, depth) {
      var w = list.reduce(function (s, it) { return s + (it.weight || 1); }, 0);
      if (!list.length) { cells.push({ x: r[0], y: r[1], w: r[2], h: r[3], item: null }); return; }
      if (list.length === 1 && (depth >= depthMax || w / total > 0.6 * (r[2] * r[3]) / (rect[2] * rect[3]))) {
        cells.push({ x: r[0], y: r[1], w: r[2], h: r[3], item: list[0] }); return;
      }
      if (depth >= depthMax) { cells.push({ x: r[0], y: r[1], w: r[2], h: r[3], item: list[0] }); return; }
      // делим список по весам пополам, пустая сторона = воздух
      var acc = 0, k = 0, half = w / 2;
      while (k < list.length && acc + (list[k].weight || 1) <= half + 1e-9) { acc += list[k].weight || 1; k++; }
      if (k === 0) k = 1;
      var A = list.slice(0, k), B = list.slice(k);
      var wa = A.reduce(function (s, it) { return s + (it.weight || 1); }, 0), share = (B.length ? wa / w : wa / (wa + w * air));
      var cut = CUTS.reduce(function (best, c) { return Math.abs(c - share) < Math.abs(best - share) ? c : best; }, 0.5);
      if (rand && drift) cut += (rand() - 0.5) * drift / Math.max(r[2], r[3]);
      var vert = r[2] >= r[3];
      if (vert) {
        var wA = r[2] * cut - gap / 2;
        split(A, [r[0], r[1], wA, r[3]], depth + 1);
        split(B, [r[0] + wA + gap, r[1], r[2] - wA - gap, r[3]], depth + 1);
      } else {
        var hA = r[3] * cut - gap / 2;
        split(A, [r[0], r[1], r[2], hA], depth + 1);
        split(B, [r[0], r[1] + hA + gap, r[2], r[3] - hA - gap], depth + 1);
      }
    }
    split(items.slice(), rect, 0);
    var used = cells.filter(function (c) { return c.item; }).reduce(function (s, c) { return s + c.w * c.h; }, 0);
    return { cells: cells, air: 1 - used / (rect[2] * rect[3]) };
  }

  R.layout = R.layout || {};
  R.layout.subdivide = subdivide;
})();
