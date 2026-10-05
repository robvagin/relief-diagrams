/* layout/hyper.js · гиперболика диска Пуанкаре (README §7.7, сцена horizon; ход d3-hypertree, MIT).
   Комплексные числа парами [re, im]. Мёбиус T_a(z) = (z − a)/(1 − ā·z); раскладка Лампинга:
   фокус в 0, дети на гиперболической дистанции link (евклидов радиус tanh(link/2) в системе родителя),
   углы внутри клина ∝ размеру поддерева, клин × 0,7 на уровень. Геодезическая: дуга через p, q и p*. */
(function () {
  'use strict';
  var R = window.RELIEF = window.RELIEF || {};

  function add(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
  function mul(a, b) { return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]]; }
  function div(a, b) { var d = b[0] * b[0] + b[1] * b[1] || 1e-12; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; }
  function conj(a) { return [a[0], -a[1]]; }
  function abs(a) { return Math.hypot(a[0], a[1]); }

  function mobius(z, a) { return div(sub(z, a), sub([1, 0], mul(conj(a), z))); }
  function rotate(z, th) { return mul(z, [Math.cos(th), Math.sin(th)]); }
  /* точка на пути фокуса к b при s ∈ [0,1]: a(s) = tanh(s·atanh|b|)·b/|b| */
  function path(b, s) { var r = abs(b); if (r < 1e-9) return [0, 0]; var k = Math.tanh(s * Math.atanh(Math.min(0.999999, r))) / r; return [b[0] * k, b[1] * k]; }

  function size(n) { return 1 + (n.children || []).reduce(function (s, c) { return s + size(c); }, 0); }

  /* layout(tree, link, depthMax) → [{node, z, depth, parent}] в системе фокуса (корень = фокус) */
  function layout(tree, link, depthMax) {
    var out = [], rr = Math.tanh((link || 1.25) / 2);
    function rec(node, z, dir, wedge, depth, pi) {
      var idx = out.length; out.push({ node: node, z: z, depth: depth, parent: pi });
      var ch = node.children || []; if (!ch.length || depth >= (depthMax || 3)) return;
      var tot = ch.reduce(function (s, c) { return s + size(c); }, 0), a = dir - wedge;
      ch.forEach(function (c) {
        var w = 2 * wedge * size(c) / tot, ang = a + w / 2; a += w;
        // ребёнок в системе родителя (родитель в 0), затем обратно T_{−p}
        var local = [rr * Math.cos(ang), rr * Math.sin(ang)], world = mobius(local, [-z[0], -z[1]]);
        rec(c, world, ang, wedge * 0.7 * (depth === 0 ? 0.5 : 1), depth + 1, idx);
      });
    }
    rec(tree, [0, 0], 0, Math.PI, 0, -1);
    return out;
  }

  /* геодезическая через p и q: прямая, если 0, p, q на одной прямой; иначе окружность через p, q, p* */
  function geodesic(p, q) {
    var cr = p[0] * q[1] - p[1] * q[0];
    if (Math.abs(cr) < 1e-9) return { line: true };
    var ps = abs(p) > 1e-9 ? [p[0] / (p[0] * p[0] + p[1] * p[1]), p[1] / (p[0] * p[0] + p[1] * p[1])] : null;
    if (!ps) return { line: true };
    var ax = p[0], ay = p[1], bx = q[0], by = q[1], cx = ps[0], cy = ps[1];
    var d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    if (Math.abs(d) < 1e-12) return { line: true };
    var ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
    var uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
    return { line: false, c: [ux, uy], r: Math.hypot(ax - ux, ay - uy) };
  }

  /* экранный радиус узла ρ = 18·(1 − |z|²), клампом в [1,5; 18] */
  function nodeR(z, ui) { return Math.max(1.5, Math.min(18, 18 * (1 - (z[0] * z[0] + z[1] * z[1])))) * (ui || 1); }

  R.layout = R.layout || {};
  R.layout.hyper = { mobius: mobius, rotate: rotate, path: path, layout: layout, geodesic: geodesic, nodeR: nodeR,
    c: { add: add, sub: sub, mul: mul, div: div, conj: conj, abs: abs } };
})();
