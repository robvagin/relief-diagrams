/* cascade · чарт в языке RELIEF как живой организм (волна 3, приказ владельца).
   Книга → стадия → сегмент → страна из breakdown. Площадь круга И листа = значение (донор magnitude:
   один K на кадр, r = K·√v; у листа w·h = π·r²), дистанция до родителя = доля, засечки каждые 10 %,
   встроенная легенда How to read. Перпендикуляров и ортогональных деревьев нет: лучи веером из хаба,
   мягкие дуги, щупальца и стебли сплайном с натяжением.
   Три варианта = три организма (RELIEF_VARIANT):
     v1 · satellites: хаб-лист в центре, лучи стадий веером, сегменты-листы, веер дисков-стран (референс §2.2 B);
     v2 · octopus: голова-диск, из неё изогнутые щупальца по сегментам, бусины-страны колышутся волной;
     v3 · plant: горшок-лист внизу, стебли стадий растут вверх (высота = доля), листья-сегменты, плоды-страны. */
(function () {
  'use strict';
  var R = window.RELIEF, V = window.RELIEF_VARIANT || 'v1';
  var D2R = Math.PI / 180, TAU = Math.PI * 2;
  var LEVEL = ['root', 'stage', 'segment', 'country'];

  function fmtEUR(v) { return v >= 1e9 ? '€' + (v / 1e9).toFixed(2) + 'B' : v >= 1e6 ? '€' + (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? '€' + Math.round(v / 1e3) + 'K' : '€' + Math.round(v); }
  function fmt(n, metric) { return metric === 'count' ? n.count + ' loans' : fmtEUR(n.value); }

  /* дерево из данных, глубина по ручке levels */
  function tree(D, P) {
    var out = [];
    (function walk(src, depth, parent) {
      var n = { label: src.label, value: src.value, count: src.count, depth: depth, parent: parent, kind: LEVEL[depth], kids: [] };
      n.v = P.metric === 'count' ? src.count : src.value;
      n.i = out.length; out.push(n);
      if (parent >= 0) out[parent].kids.push(n.i);
      if (depth < P.levels && src.children) src.children.forEach(function (c) { walk(c, depth + 1, n.i); });
    })(D.breakdown, 0, -1);
    out.forEach(function (n) { n.share = n.parent >= 0 ? n.v / out[n.parent].v : 1; });
    var leaves = function (n) { return n.kids.length ? n.kids.reduce(function (s, k) { return s + leaves(out[k]); }, 0) : 1; };
    out.forEach(function (n) { n.leaves = leaves(n); });
    return out;
  }

  /* размеры: площадь честно под значение, один K (magnitude); лист той же площади, пропорция 1,45 */
  function sizes(T, P, ui, sheetAt) {
    var v1 = Math.max.apply(null, T[0].kids.map(function (k) { return T[k].v; }).concat([1e-9]));
    var K = P.rmax * ui / Math.sqrt(v1);
    T.forEach(function (n) {
      var r = Math.max(3 * ui, K * Math.sqrt(n.v));
      n.r = r; n.re = r;
      if (sheetAt(n)) { var A = Math.PI * r * r, a = n.depth === 0 ? 1.5 : 1.35; n.sheet = true; n.w = Math.sqrt(A * a); n.h = A / n.w; n.re = Math.sqrt(n.w * n.w + n.h * n.h) / 2 * 0.86; }
    });
    return K;
  }

  /* узлы для движка: kind, размеры, высота, полярная привязка к родителю */
  function toNodes(T, z) {
    return T.map(function (n) {
      var o = { id: 'c' + n.i, label: n.label, src: n, depth: n.depth, parent: n.parent, z: z(n), order: n.order,
        kind: n.sheet ? 'sheet' : 'disc', r: n.r, w: n.w, h: n.h, len: n.len || 0, ang: n.ang || 0, rot: n.rot || 0, sway: n.sway || 0, spin: n.spin };
      if (n.parent < 0) { o.x = n.x; o.y = n.y; }
      return o;
    });
  }

  /* вписать: все длины и размеры одним множителем вокруг корня, затем центр габарита в поле */
  function fit(T, rect, P) {
    var pose = function () {
      var p = T.map(function () { return null; });
      T.forEach(function (n, i) { p[i] = n.parent < 0 ? [n.x, n.y] : [p[n.parent][0] + Math.cos(n.ang) * n.len, p[n.parent][1] + Math.sin(n.ang) * n.len]; });
      return p;
    };
    var p = pose(), x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    T.forEach(function (n, i) { var e = n.sheet ? Math.max(n.w, n.h) / 2 : n.r; x0 = Math.min(x0, p[i][0] - e); x1 = Math.max(x1, p[i][0] + e); y0 = Math.min(y0, p[i][1] - e); y1 = Math.max(y1, p[i][1] + e); });
    var s = Math.min(1, rect.w / (x1 - x0), rect.h / (y1 - y0));
    T.forEach(function (n) { n.len *= s; n.r *= s; n.re *= s; if (n.full) n.full *= s; if (n.sheet) { n.w *= s; n.h *= s; } });
    var root = T[0];
    root.x = rect.x + rect.w / 2 + (root.x - (x0 + x1) / 2) * s; root.y = rect.y + rect.h / 2 + (root.y - (y0 + y1) / 2) * s;
    return s;
  }

  /* разнос столкновений: угол ветви держится, удлиняется ветвь младшего; доля читается засечками */
  function relax(T, u) {
    var pos = function () { var p = []; T.forEach(function (n, i) { p[i] = n.parent < 0 ? [n.x, n.y] : [p[n.parent][0] + Math.cos(n.ang) * n.len, p[n.parent][1] + Math.sin(n.ang) * n.len]; }); return p; };
    for (var it = 0; it < 80; it++) {
      var p = pos(), moved = false;
      for (var i = 0; i < T.length; i++) for (var j = i + 1; j < T.length; j++) {
        var a = T[i], b = T[j];
        if (a.parent === j || b.parent === i || (a.parent === b.parent && a.depth === 3)) continue;
        var need = a.re + b.re + u * 0.5, d = Math.hypot(p[i][0] - p[j][0], p[i][1] - p[j][1]);
        if (d >= need) continue;
        var m = b.depth >= a.depth ? b : a;
        if (m.parent < 0) continue;
        m.len += Math.min(need - d, u * 2) * 0.5 + 0.5; moved = true;
      }
      if (!moved) break;
    }
  }

  /* ── v1 · satellites ─────────────────────────────────────────────────── */
  function satellites(T, P, rect, ui, u, rand) {
    var root = T[0], minWH = Math.min(rect.w, rect.h), L1 = 0.40 * minWH;
    root.x = rect.x + rect.w * 0.5; root.y = rect.y + rect.h * 0.52;
    var kids = root.kids.map(function (k) { return T[k]; }), spread = Math.min(360, Math.max(60, P.spread)) * D2R;
    var gap = 7 * D2R, gaps = spread >= TAU - 1e-6 ? kids.length : kids.length - 1, avail = Math.max(0.1, spread - gap * gaps);
    var Wt = kids.map(function (k) { return Math.pow(k.leaves, 0.7); }), SW = Wt.reduce(function (a, b) { return a + b; }, 0);
    var a = (-90 + 137.5 * Math.floor(rand() * 8)) * D2R;
    kids.forEach(function (k, i) {
      var sec = avail * Wt[i] / SW; k.ang = a + sec / 2; k.sector = sec; a += sec + gap;
      k.len = root.re + k.re + u + L1 * k.share; k.full = L1; k.sway = 0.9;
    });
    // уровни ниже стадий: веер внутри сектора своей стадии
    kids.forEach(function (k) {
      (function rec(p, depth) {
        if (!p.kids.length) return;
        var Ld = L1 * Math.pow(0.55, depth - 1), half = Math.min(60 * D2R, (p.sector || TAU) / 2) * 0.92;
        var ks = p.kids.map(function (q) { return T[q]; }), Wk = ks.map(function (c) { return Math.pow(c.leaves, 0.7); }), SWk = Wk.reduce(function (x, y) { return x + y; }, 0), acc = 0;
        ks.forEach(function (c, j) {
          var f = ks.length === 1 ? 0.5 : (acc + Wk[j] / 2) / SWk; acc += Wk[j];
          if (P.phyllo) { c.ang = p.ang + (j + 1) * 137.508 * D2R; c.len = p.re + c.re + u + Ld * 0.42 * Math.sqrt(j + 1); }
          else { c.ang = p.ang - half + 2 * half * f; c.len = (depth === 3 ? 0.9 : 1) * (p.re + c.re) + u * (depth === 3 ? 0.2 : 1) + Ld * c.share; }
          c.sector = 2 * half * Wk[j] / SWk; c.full = Ld; c.sway = depth === 3 ? 1.6 : 1.2;
          if (c.sheet) c.rot = ((j % 2) ? 1 : -1) * (4 + 3 * (j % 3) / 2) * D2R;
          rec(c, depth + 1);
        });
      })(k, 2);
    });
    relax(T, u);
    T.forEach(function (n) { if (n.parent >= 0) n.ray = true; });
  }

  /* ── v2 · octopus ────────────────────────────────────────────────────── */
  function octopus(T, P, rect, ui, u) {
    var root = T[0], minWH = Math.min(rect.w, rect.h), L1 = 0.42 * minWH;
    root.x = rect.x + rect.w * 0.5; root.y = rect.y + rect.h * 0.24;
    root.sheet = false; root.re = root.r;
    // щупальца растут из головы: одно на сегмент, основания по нижней дуге семьями стадий, между семьями воздух
    var arms = [];
    root.kids.forEach(function (s) { T[s].kids.forEach(function (g) { arms.push({ stage: s, seg: g }); }); });
    var spread = Math.min(170, Math.max(90, P.spread * 0.45)) * D2R, gapF = 10 * D2R, fams = root.kids.length;
    var step = (spread - gapF * (fams - 1)) / Math.max(1, arms.length - 1), a = Math.PI / 2 - spread / 2, prev = -1;
    arms.forEach(function (A) { if (prev >= 0 && A.stage !== prev) a += gapF; A.ang = a; a += step; prev = A.stage; });
    // стадия: «юбка» под головой (z2 под z3): видна краем, голова роняет на неё тень
    root.kids.forEach(function (s) {
      var st = T[s], my = arms.filter(function (A) { return A.stage === s; });
      st.ang = my.length ? my.reduce(function (q, A) { return q + A.ang; }, 0) / my.length : Math.PI / 2;
      st.len = root.r * 0.62 + st.r * 0.3; st.sway = 0.8; st.full = 0;
    });
    arms.forEach(function (A, k) {
      var st = T[A.stage], sg = T[A.seg], side = Math.cos(A.ang) >= 0 ? 1 : -1;
      sg.parent = 0; sg.ang = A.ang; sg.len = root.r + sg.re + u * 0.8 + L1 * sg.share; sg.sway = 2.2; sg.full = L1;
      sg.rot = A.ang - Math.PI / 2;
      // бусины-страны цепочкой: родитель = предыдущая бусина, изгиб наружу нарастает к кончику (кончик закручен)
      var prevI = sg.i, ang = sg.ang, curl = -side * (9 + (k % 3) * 3) * D2R;
      var cs = sg.kids.map(function (q) { return T[q]; }).sort(function (x, y) { return y.v - x.v; });
      cs.forEach(function (c, j) {
        ang += curl * (0.5 + j * 0.45);
        c.parent = prevI; c.ang = ang; c.len = T[prevI].re + c.re + u * (0.3 + 0.6 * (1 - c.share)); c.sway = 3.4; c.full = 0;
        prevI = c.i;
      });
      A.chain = [A.seg].concat(cs.map(function (c) { return c.i; }));
    });
    T.arms = arms;
  }

  /* ── v3 · plant ──────────────────────────────────────────────────────── */
  function plant(T, P, rect, ui, u) {
    var root = T[0], H = rect.h;
    root.x = rect.x + rect.w * 0.5; root.y = rect.y + rect.h - root.h / 2;
    var st0 = root.kids.map(function (k) { return T[k]; }).sort(function (x, y) { return y.share - x.share; }), n = st0.length;
    var st = n === 3 ? [st0[1], st0[0], st0[2]] : st0;
    // стебли: веер вверх, высота = доля стадии; на стебле листья-сегменты по очереди слева и справа
    var span = Math.min(80, P.spread * 0.25) * D2R;
    T.stems = [];
    st.forEach(function (s, i) {
      var base = -Math.PI / 2 + (n === 1 ? 0 : -span / 2 + span * i / (n - 1));
      var segs = s.kids.map(function (q) { return T[q]; }).sort(function (x, y) { return y.v - x.v; });
      var total = root.h * 0.4 + 0.86 * H * (0.25 + 0.75 * Math.sqrt(s.share));
      var nseg = Math.max(1, segs.length), stepL = total / (nseg + 1), prev = 0, ang = base, bend = (i - (n - 1) / 2) * 14 * D2R;
      var chain = [0];
      segs.forEach(function (g, j) {
        ang += bend / nseg;
        g.parent = prev; g.ang = ang; g.len = j === 0 ? root.h / 2 + stepL * 0.8 : stepL; g.sway = 1.3 + 0.35 * j; g.full = 0;
        g.rot = ang + Math.PI / 2 + ((j % 2) ? 1 : -1) * 0.5;      // лист отогнут от стебля
        prev = g.i; chain.push(g.i);
        // плоды: висят под листом, вниз и наружу, на короткой ножке
        var side = (j % 2) ? 1 : -1;
        g.kids.forEach(function (ci, k) {
          var c = T[ci]; c.parent = g.i; c.ang = Math.PI / 2 + side * (55 - k * 14) * D2R; c.len = g.re * 0.7 + c.re + u * 0.3 + 0.08 * H * c.share; c.sway = 2.2; c.full = 0;
        });
      });
      // цветок стадии на вершине стебля
      s.parent = prev; s.ang = ang; s.len = prev === 0 ? total : stepL; s.sway = 1.8; s.full = 0;
      chain.push(s.i);
      T.stems.push({ stage: s.i, chain: chain });
    });
  }

  /* перенумерация: родитель раньше ребёнка (после переподвеса цепочек) */
  function topo(T) {
    var order = [], seen = {};
    function visit(i) { if (seen[i]) return; var p = T[i].parent; if (p >= 0) visit(p); seen[i] = 1; order.push(i); }
    T.forEach(function (n, i) { visit(i); });
    var map = {}; order.forEach(function (o, k) { map[o] = k; });
    var out = order.map(function (o) { var n = T[o]; n.parent = n.parent >= 0 ? map[n.parent] : -1; return n; });
    out.forEach(function (n, k) { n.old = n.i; n.i = k; });
    out.remap = map;
    return out;
  }

  /* подписи: направление наружу от родителя, первый свободный кандидат (по покою) */
  function placeLabels(T, pose, ui, W, H) {
    var placed = [], m = 0.06 * Math.min(W, H);
    placed.push([0, 0, W * 0.6, m + 56 * ui], [0, H - m - 96 * ui, m + 360 * ui, H], [W - m - 140 * ui, H - m - 30 * ui, W, H]);
    var discHit = function (b) { return T.some(function (n, i) { var e = n.sheet ? Math.max(n.w, n.h) / 2 : n.r, q = pose[i]; return b[0] < q[0] + e && b[2] > q[0] - e && b[1] < q[1] + e && b[3] > q[1] - e; }); };
    T.slice().sort(function (a, b) { return a.depth - b.depth || b.r - a.r; }).forEach(function (n) {
      n.lab = null;
      if (n.depth === 0) return;
      // подпись внутри: большой диск стадии, крупный лист сегмента, диск страны от 12 px
      n.inside = (!n.sheet && n.depth === 1 && n.r >= 30 * ui && V !== 'v2') || (n.sheet && n.w > 74 * ui && n.h > 36 * ui) || (!n.sheet && n.depth === 3 && n.r >= 12 * ui);
      if (n.inside) return;
      if (n.depth === 3 && n.r < 6 * ui) return;
      var big = n.depth === 1, sz = big ? 14 : 11.67, wch = (n.label.length + (n.depth < 3 ? 9 : 0)) * sz * 0.58 * ui, hh = (n.depth < 3 ? 2.4 : 1.2) * sz * ui;
      var q = pose[n.i], pq = n.parent >= 0 ? pose[n.parent] : [q[0], q[1] - 1], base = Math.atan2(q[1] - pq[1], q[0] - pq[0]);
      var e = n.sheet ? Math.max(n.w, n.h) / 2 : n.r;
      var cands = [base, base + Math.PI / 2, base - Math.PI / 2, base + Math.PI];
      for (var k = 0; k < cands.length; k++) {
        var a = cands[k], gx = Math.cos(a), gy = Math.sin(a), cx = q[0] + gx * (e + 6 * ui), cy = q[1] + gy * (e + 6 * ui);
        var x0 = gx > 0.35 ? cx : gx < -0.35 ? cx - wch : cx - wch / 2, y0 = gy > 0.35 ? cy : gy < -0.35 ? cy - hh : cy - hh / 2;
        var b = [x0, y0, x0 + wch, y0 + hh];
        if (b[0] < 4 || b[1] < 4 || b[2] > W - 4 || b[3] > H - 4) continue;
        if (discHit(b) || placed.some(function (r) { return b[0] < r[2] && b[2] > r[0] && b[1] < r[3] && b[3] > r[1]; })) continue;
        placed.push(b); n.lab = { dx: x0 - q[0], dy: y0 - q[1], hh: hh }; break;
      }
    });
  }

  function build(ctx) {
    var P = ctx.P, W = ctx.W, H = ctx.H, ui = R.ui(W, H), u = Math.min(W, H) / 48, D = ctx.data;
    var m = 0.06 * Math.min(W, H), rect = { x: m, y: m + 52 * ui, w: W - 2 * m, h: H - 2 * m - 110 * ui };
    var T = tree(D, P);
    sizes(T, P, ui, V === 'v1' ? function (n) { return n.depth === 0 || n.depth === 2; } : V === 'v2' ? function (n) { return n.depth === 2; } : function (n) { return n.depth === 0 || n.depth === 2; });
    if (V === 'v2') octopus(T, P, rect, ui, u); else if (V === 'v3') plant(T, P, rect, ui, u); else satellites(T, P, rect, ui, u, ctx.rand);
    var arms = T.arms, stems = T.stems;
    T = topo(T);
    var s = fit(T, rect, P);
    var z = function (n) { return n.depth === 0 ? 3 : n.depth === 3 ? 1 : 2; };
    var nodes = toNodes(T, z);
    T.forEach(function (n, i) { nodes[i].order = n.depth * 20 + i; });
    var pose0 = R.org.pose({ nodes: nodes }, ctx.seed, 0, P, true).map(function (q) { return [q.x, q.y]; });
    placeLabels(T, pose0, ui, W, H);
    var map = T.remap;
    var acc = R.tokens(ctx.theme, P.accent).accent;
    var focusStage = -1; T.forEach(function (n, i) { if (n.depth === 1 && n.label === 'non-performing') focusStage = i; });

    var links = [];
    if (V === 'v1') T.forEach(function (n, i) { if (n.parent >= 0) links.push({ a: n.parent, b: i, ticks: n.depth <= 2 ? { share: n.share, full: n.full } : null, alpha: n.depth === 3 ? 0.75 : 1 }); });
    var mod = {
      nodes: nodes, links: links,
      tip: function (n) { var t = n.src; return { lines: [t.depth === 0 ? 'Loan book' : t.label, fmtEUR(t.value) + ' · ' + t.count + ' loans', t.depth ? (t.share * 100).toFixed(1) + ' % of parent' : 'as of ' + D.meta.asOf], w: 176 }; },
      floor: function (g, F, sc) {
        var al = function (i) { return 1 - 0.7 * (sc[i] ? sc[i].dim : 0); };
        if (V === 'v2') {
          // щупальца: сплайн через голову → присоску → сегмент → бусины; одна толщина
          arms.forEach(function (A) {
            if (!A.chain) return;
            var ch = [0].concat(A.chain.map(function (o) { return map[o]; }));
            var pts = ch.map(function (i) { return [sc[i].x, sc[i].y]; });
            R.org.strokeRelief(g, F, function (ox, oy) { R.org.curveThrough(g, pts.map(function (q) { return [q[0] + ox, q[1] + oy]; })); }, Math.min.apply(null, ch.map(al)));
          });
          // засечки доли на отрезке «присоска → сегмент»
          T.forEach(function (n, i) { if (n.depth === 2 && P.ticks) { var p = sc[n.parent], q = sc[i]; R.org.ticks(g, F, [p.x, p.y], [q.x, q.y], n.share, n.full * R.org.zoom(), al(i)); } });
        }
        if (V === 'v3') {
          stems.forEach(function (S) {
            var ch = S.chain.map(function (o) { return map[o]; }), pts = ch.map(function (i) { return [sc[i].x, sc[i].y]; });
            R.org.strokeRelief(g, F, function (ox, oy) { R.org.curveThrough(g, pts.map(function (q) { return [q[0] + ox, q[1] + oy]; })); }, Math.min.apply(null, ch.map(al)));
          });
          // ножки плодов: мягкая дуга от листа
          T.forEach(function (n, i) {
            if (n.depth !== 3) return;
            var p = sc[n.parent], q = sc[i], mx = (p.x + q.x) / 2 + (q.y - p.y) * 0.18, my = (p.y + q.y) / 2 - (q.x - p.x) * 0.18;
            R.org.strokeRelief(g, F, function (ox, oy) { g.moveTo(p.x + ox, p.y + oy); g.quadraticCurveTo(mx + ox, my + oy, q.x + ox, q.y + oy); }, al(i) * 0.8);
          });
        }
      },
      floorAfter: function (g, F, sc) {
        // подписи на полу у узлов (z0), притухают вместе с узлом
        T.forEach(function (n, i) {
          if (!n.lab) return;
          var q = sc[i], x = q.x + n.lab.dx * R.org.zoom(), y = q.y + n.lab.dy * R.org.zoom(), a = 1 - 0.75 * q.dim;
          if (n.depth === 3) { R.ink.text(g, F, n.label, x, y + 11.67 * F.ui, { s: 0, mono: true, tone: 'ink2', alpha: a }); return; }
          R.ink.text(g, F, n.label, x, y + (n.depth === 1 ? 14 : 11.67) * F.ui, { s: n.depth === 1 ? 1 : 0, w: n.depth === 1 ? 500 : 400, tone: 'ink', alpha: a });
          R.ink.text(g, F, fmt(n, P.metric), x, y + (n.depth === 1 ? 30 : 26) * F.ui, { s: 0, mono: true, tone: 'ink3', alpha: a });
        });
        legend(g, F, P, D, T);
      },
      print: function (g, s2, F, nd) {
        var n = nd.src, i = s2.id, ui = F.ui;
        if (n.depth === 0) {
          if (!n.sheet) {
            R.ink.text(g, F, 'Loan book', s2.x, s2.y - 6 * ui, { s: 3, w: 500, align: 'center' });
            R.ink.text(g, F, fmt(n, P.metric), s2.x, s2.y + 16 * ui, { s: 1, mono: true, tone: 'ink2', align: 'center' });
            return;
          }
          var k = Math.min(1.2, s2.w / (240 * ui));
          g.save(); g.translate(s2.x, s2.y); g.rotate(s2.rot || 0);
          R.ink.text(g, F, 'Loan book', -s2.w / 2 + 14 * ui, -s2.h / 2 + 24 * ui * k, { s: 2, w: 500 });
          R.ink.text(g, F, fmt(n, P.metric), -s2.w / 2 + 14 * ui, -s2.h / 2 + 24 * ui * k + 32 * ui * k, { s: k > 0.9 ? 5 : 4, w: 500 });
          R.ink.text(g, F, n.count + ' loans', -s2.w / 2 + 14 * ui, s2.h / 2 - 14 * ui, { s: 0, mono: true, tone: 'ink3' });
          g.restore();
          return;
        }
        if (!n.sheet) {
          // семя: графитовая точка в центре диска, данные напечатаны (§2.4)
          if (!n.inside || n.depth === 3) { g.fillStyle = R.color.css(F.T.ink2, 0.7 * (1 - 0.7 * (nd ? 0 : 0))); g.beginPath(); g.arc(s2.x, s2.y + (n.inside ? 7 * ui : 0), Math.max(1.2 * ui, Math.min(2.6 * ui, s2.w * 0.06)), 0, TAU); g.fill(); }
          if (i === focusStage) { g.fillStyle = R.color.css(acc); g.beginPath(); g.arc(s2.x + s2.w * 0.24, s2.y - s2.w * 0.24, Math.max(3, 3.5 * ui), 0, TAU); g.fill(); }
          if (n.inside && n.depth === 1) {
            R.ink.text(g, F, n.label, s2.x, s2.y - 2 * ui, { s: 1, w: 500, align: 'center' });
            R.ink.text(g, F, fmt(n, P.metric), s2.x, s2.y + 14 * ui, { s: 0, mono: true, tone: 'ink3', align: 'center' });
          } else if (n.inside) {
            R.ink.text(g, F, n.label, s2.x, s2.y + 1 * ui, { s: 0, mono: true, tone: 'ink2', align: 'center' });
          }
          return;
        }
        if (n.inside) {
          g.save(); g.translate(s2.x, s2.y); g.rotate(s2.rot || 0);
          R.ink.text(g, F, n.label, -s2.w / 2 + 8 * ui, -s2.h / 2 + 16 * ui, { s: 0, w: 500 });
          R.ink.text(g, F, fmt(n, P.metric), -s2.w / 2 + 8 * ui, -s2.h / 2 + 31 * ui, { s: 0, mono: true, tone: 'ink3' });
          g.restore();
        }
      }
    };
    return mod;
  }

  function legend(g, F, P, D, T) {
    var m = 0.06 * Math.min(F.W, F.H), ui = F.ui;
    R.ink.text(g, F, 'Loan book, ' + (P.metric === 'count' ? 'loans' : 'exposure') + ' by stage, segment and country', m, m + 8 * ui, { s: 2, w: 500 });
    R.ink.text(g, F, 'As of ' + D.meta.asOf + ' · drag a node, hover to lift, click to focus, scroll to zoom', m, m + 28 * ui, { s: 0, mono: true, tone: 'ink3' });
    var lines = ['How to read',
      'Area = ' + (P.metric === 'count' ? 'number of loans' : 'exposure, EUR') + ' (discs and sheets alike)',
      V === 'v3' ? 'Stem height = share of the book' : V === 'v2' ? 'Arm length = share of its stage' : 'Distance to the parent = share of the parent',
      P.ticks ? 'Tick = 10 % of the parent' : 'Ticks off',
      'Height above the floor = level: book, stage, segment, country'];
    var y = F.H - m - (lines.length - 1) * 16 * ui;
    lines.forEach(function (s, i) { R.ink.text(g, F, s, m, y, { s: 0, mono: i > 0, caps: i === 0, w: i === 0 ? 500 : 400, tone: 'ink3' }); y += 16 * ui; });
  }

  var TITLES = { v1: 'Cascade · satellites', v2: 'Cascade · octopus', v3: 'Cascade · plant' };
  RELIEF.def = R.org.scene({
    id: 'cascade', title: TITLES[V] || TITLES.v1,
    blurb: 'Loan book as a living organism of matte discs and paper sheets: area is exposure, distance is share.',
    layoutKeys: ['levels', 'spread', 'phyllo', 'rmax', 'metric', 'ticks', 'zscale'],
    build: build,
    groups: {
      'Сцена': [['levels', 'Уровней', 1, 3, 1, 3]],
      'Ритм': [['spread', 'Раскрытие, °', 90, 360, 1, V === 'v1' ? 320 : V === 'v2' ? 300 : 240], ['ticks', 'Засечки', 0, 1, 1, 1],
        ['phyllo', 'Филлотаксис', 0, 1, 1, 0], ['rmax', 'Крупнейший, px', 40, 200, 1, V === 'v1' ? 96 : V === 'v2' ? 70 : 78]],
      'Данные': [['metric', 'Мера', ['value', 'count'], 'value', ['Объём', 'Число']]]
    }
  });
})();
