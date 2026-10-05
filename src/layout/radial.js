/* layout/radial.js · радиальное дерево (README §7.6 B, сцена cascade). Чистая функция:
   (tree, rect, params) → {nodes:[{node, x, y, r, depth, parent}]}.
   Радиус r = max(3, rmax·√(v / v_max первого уровня)): площадь честно под значение.
   share: ветвь ℓ = r_parent + r_child + u + L1·доля (L1 = 0.38·min(W,H), ниже ×0.55);
   balance: братья попеременно по обе стороны оси, плечо ∝ 1/w (тяжёлое ближе).
   Дети корня по дуге spread° от −90° + 137.5°·k0; сектор ∝ листья^0.7; зазор между семьями ≥ 7°. */
(function () {
  'use strict';
  var R = window.RELIEF = window.RELIEF || {};
  var D2R = Math.PI / 180;

  function leaves(n) { return n.children && n.children.length ? n.children.reduce(function (s, c) { return s + leaves(c); }, 0) : 1; }

  function radial(tree, rect, params) {
    params = params || {};
    var W = rect[2], H = rect[3], cx = rect[0] + W / 2, cy = rect[1] + H / 2, u = Math.min(W, H) / 48;
    var metric = params.metric || 'value', levels = params.levels || 3, rmax = params.rmax || 118;
    var spread = (params.spread || 320) * D2R, mode = params.mode || 'share';
    var val = function (n) { return metric === 'count' ? (n.count || 0) : (n.value || 0); };
    var kids = tree.children || [], vmax = Math.max.apply(null, kids.map(val).concat([1]));
    var rad = function (n) { return Math.max(3, rmax * Math.sqrt(val(n) / vmax)); };
    var out = [{ node: tree, x: cx, y: cy, r: rad(tree) * 0.0 + Math.max(6, rmax * 0.18), depth: 0, parent: -1 }];
    var weights = kids.map(function (k) { return Math.pow(leaves(k), 0.7); }), wsum = weights.reduce(function (a, b) { return a + b; }, 0) || 1;
    var gapA = 7 * D2R, usable = spread - gapA * Math.max(0, kids.length - (spread >= 2 * Math.PI - 1e-6 ? 0 : 1));
    var a = -Math.PI / 2 - spread / 2 + 137.5 * D2R * (params.k0 || 0) * 0;
    var L1 = 0.38 * Math.min(W, H);
    function place(node, px, py, pr, ang, sector, depth, pi, L) {
      var r = rad(node), total = val(node.__parent || tree) || 1, share = val(node) / total;
      var len = mode === 'balance' ? pr + r + u + L * 0.5 : pr + r + u + L * share;
      var x = px + Math.cos(ang) * len, y = py + Math.sin(ang) * len, idx = out.length;
      out.push({ node: node, x: x, y: y, r: r, depth: depth, parent: pi, angle: ang, share: share, len: len });
      if (depth >= levels || !node.children || !node.children.length) return;
      var ch = node.children.slice().sort(function (p, q) { return val(q) - val(p); });
      var fan = Math.min(60 * D2R, sector / 2), n = ch.length;
      ch.forEach(function (c, k) {
        c.__parent = node;
        var off;
        if (mode === 'balance') { var side = k % 2 ? -1 : 1; off = side * fan * (0.25 + 0.75 * (Math.floor((k + 1) / 2) / Math.max(1, Math.ceil(n / 2)))); }
        else off = n === 1 ? 0 : -fan + 2 * fan * k / (n - 1);
        place(c, x, y, r, ang + off, sector / Math.max(1, n), depth + 1, idx, L * 0.55);
      });
    }
    kids.forEach(function (k, i) {
      var sec = usable * weights[i] / wsum, mid = a + sec / 2;
      k.__parent = tree;
      place(k, cx, cy, out[0].r, mid, sec, 1, 0, L1);
      a += sec + gapA;
    });
    out.forEach(function (o) { delete o.node.__parent; });
    return { nodes: out, u: u };
  }

  R.layout = R.layout || {};
  R.layout.radial = radial;
})();
