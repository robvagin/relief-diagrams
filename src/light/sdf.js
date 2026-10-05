/* light/sdf.js · поля расстояний форм плашек и мягкое покрытие по ним.
   Ход из sdf-2d (ISC) и ronja «2D SDF Shadows»: тень не размывается фильтром, а читается
   из поля расстояний; полутень = функция расстояния до контура и разницы высот.
   Покрытие гауссово размытой формы: Φ(−sd/σ) — точно для прямой кромки, у углов честное приближение. */
(function () {
  'use strict';
  var R = window.RELIEF = window.RELIEF || {};

  /* скруглённый прямоугольник: полуразмеры hw, hh, радиус r; точка в локальных координатах */
  function sdBox(px, py, hw, hh, r) {
    r = Math.min(r, hw, hh);
    var qx = Math.abs(px) - hw + r, qy = Math.abs(py) - hh + r;
    var ox = qx > 0 ? qx : 0, oy = qy > 0 ? qy : 0;
    return Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(qx, qy), 0) - r;
  }

  /* форма: {kind:'rect'|'circle', x, y — центр, w, h, r, rot (рад), holes:[{x,y,w,h,r} локально]} */
  function sd(s, px, py) {
    var dx = px - s.x, dy = py - s.y;
    if (s.rot) {
      var c = s._c, sn = s._s;
      if (c === undefined) { c = s._c = Math.cos(s.rot); sn = s._s = Math.sin(s.rot); }
      var lx = c * dx + sn * dy, ly = -sn * dx + c * dy; dx = lx; dy = ly;
    }
    var d = s.kind === 'circle' ? Math.sqrt(dx * dx + dy * dy) - s.w / 2 : sdBox(dx, dy, s.w / 2, s.h / 2, s.r || 0);
    if (s.holes) for (var i = 0; i < s.holes.length; i++) {
      var hl = s.holes[i];
      d = Math.max(d, -sdBox(dx - hl.x, dy - hl.y, hl.w / 2, hl.h / 2, hl.r || 0));
    }
    return d;
  }

  /* Φ(x) нормального распределения (Bowling 2009, ошибка < 1.4e-4) */
  function Phi(x) {
    if (x < -6) return 0;
    if (x > 6) return 1;
    return 1 / (1 + Math.exp(-1.5976 * x - 0.07056 * x * x * x));
  }
  /* мягкое покрытие: доля формы, размытой гауссом σ, в точке с расстоянием sd */
  function cover(d, sigma) { return sigma <= 0.05 ? (d < 0 ? 1 : 0) : Phi(-d / sigma); }

  /* габарит формы: радиус описанного круга по осям */
  function extent(s) {
    if (s.kind === 'circle') return [s.w / 2, s.w / 2];
    if (!s.rot) return [s.w / 2, s.h / 2];
    var c = Math.abs(Math.cos(s.rot)), n = Math.abs(Math.sin(s.rot));
    return [c * s.w / 2 + n * s.h / 2, n * s.w / 2 + c * s.h / 2];
  }

  /* контур формы в путь канваса (подпуть; сдвиг dx,dy) */
  function path(g, s, dx, dy) {
    dx = dx || 0; dy = dy || 0;
    var cx = s.x + dx, cy = s.y + dy;
    if (s.kind === 'circle') { g.moveTo(cx + s.w / 2, cy); g.arc(cx, cy, s.w / 2, 0, Math.PI * 2); return; }
    var c = Math.cos(s.rot || 0), n = Math.sin(s.rot || 0);
    function box(ox, oy, w, h, r) {
      r = Math.max(0, Math.min(r || 0, w / 2, h / 2));
      var pts = [], k = 0.5522847498 * r;
      // скруглённый прямоугольник кривыми Безье, чтобы поворот жил в координатах, а не в ctx.rotate
      var x0 = ox - w / 2, y0 = oy - h / 2, x1 = ox + w / 2, y1 = oy + h / 2;
      var P = function (x, y) { return [cx + c * x - n * y, cy + n * x + c * y]; };
      var seq = [
        ['M', x0 + r, y0], ['L', x1 - r, y0], ['C', x1 - r + k, y0, x1, y0 + r - k, x1, y0 + r],
        ['L', x1, y1 - r], ['C', x1, y1 - r + k, x1 - r + k, y1, x1 - r, y1],
        ['L', x0 + r, y1], ['C', x0 + r - k, y1, x0, y1 - r + k, x0, y1 - r],
        ['L', x0, y0 + r], ['C', x0, y0 + r - k, x0 + r - k, y0, x0 + r, y0]
      ];
      seq.forEach(function (q) {
        if (q[0] === 'M') { var a = P(q[1], q[2]); g.moveTo(a[0], a[1]); }
        else if (q[0] === 'L') { var b = P(q[1], q[2]); g.lineTo(b[0], b[1]); }
        else { var p1 = P(q[1], q[2]), p2 = P(q[3], q[4]), p3 = P(q[5], q[6]); g.bezierCurveTo(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]); }
      });
      g.closePath();
      return pts;
    }
    box(0, 0, s.w, s.h, s.r);
    if (s.holes) s.holes.forEach(function (hl) { box(hl.x, hl.y, hl.w, hl.h, hl.r); });
  }

  R.sdf = { sd: sd, sdBox: sdBox, Phi: Phi, cover: cover, extent: extent, path: path };
})();
