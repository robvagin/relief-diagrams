/* RELIEF lab · гиперболика для horizon (README §7.7).
   Диск Пуанкаре, Мёбиус матрицей 2×2 над ℂ, раскладка Лэмпинга по клиньям.
   Устройство навигации по образцу d3-hypertree (github.com/glouwa/d3-hypertree, MIT):
   раскладка считается один раз от корня, навигация = композиция преобразований диска
   (ход по геодезической к центру, протяжка = непрерывный Мёбиус), LOD подписей по кольцам.
   Код написан заново по формулам наряда, не скопирован. */
(function () {
  'use strict';
  var TAU = Math.PI * 2;
  // ── ℂ ────────────────────────────────────────────────────────────────
  var C = {
    add: function (a, b) { return [a[0] + b[0], a[1] + b[1]]; },
    sub: function (a, b) { return [a[0] - b[0], a[1] - b[1]]; },
    mul: function (a, b) { return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]]; },
    div: function (a, b) { var d = b[0] * b[0] + b[1] * b[1] || 1e-12; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; },
    conj: function (a) { return [a[0], -a[1]]; },
    abs: function (a) { return Math.hypot(a[0], a[1]); },
    abs2: function (a) { return a[0] * a[0] + a[1] * a[1]; },
    scale: function (a, k) { return [a[0] * k, a[1] * k]; },
    polar: function (r, t) { return [r * Math.cos(t), r * Math.sin(t)]; },
    arg: function (a) { return Math.atan2(a[1], a[0]); }
  };
  // ── Мёбиус: z ↦ (A z + B)/(Cz + D) ───────────────────────────────────
  function M(A, B, Cc, D) { return { A: A, B: B, C: Cc, D: D }; }
  var ID = M([1, 0], [0, 0], [0, 0], [1, 0]);
  function apply(m, z) { return C.div(C.add(C.mul(m.A, z), m.B), C.add(C.mul(m.C, z), m.D)); }
  function compose(m, n) {   // m ∘ n
    return canon(M(
      C.add(C.mul(m.A, n.A), C.mul(m.B, n.C)), C.add(C.mul(m.A, n.B), C.mul(m.B, n.D)),
      C.add(C.mul(m.C, n.A), C.mul(m.D, n.C)), C.add(C.mul(m.C, n.B), C.mul(m.D, n.D))));
  }
  // T_a(z) = (z − a)/(1 − ā z): a → 0
  function T(a) { return M([1, 0], C.scale(a, -1), C.scale(C.conj(a), -1), [1, 0]); }
  function rot(t) { return M(C.polar(1, t), [0, 0], [0, 0], [1, 0]); }
  // каноническая форма автоморфизма диска e^{iθ}(z − z0)/(1 − z̄0 z): дрейф округления не копится
  function canon(m) {
    var z0 = C.div(C.scale(m.B, -1), m.A);
    if (C.abs(z0) > 0.999999) z0 = C.scale(z0, 0.999999 / C.abs(z0));
    var e = C.div(m.A, m.D), n = C.abs(e) || 1; e = C.scale(e, 1 / n);
    return M(e, C.scale(C.mul(e, z0), -1), C.scale(C.conj(z0), -1), [1, 0]);
  }
  function inverse(m) { return canon(M(m.D, C.scale(m.B, -1), C.scale(m.C, -1), m.A)); }
  // точка на геодезической от 0 к b, доля s по гиперболической длине §7.7
  function along(b, s) {
    var r = C.abs(b); if (r < 1e-9) return [0, 0];
    var at = 0.5 * Math.log((1 + r) / (1 - r));
    var k = Math.tanh(s * at) / r;
    return C.scale(b, k);
  }
  function clampDisk(z, lim) { var r = C.abs(z); lim = lim || 0.985; return r > lim ? C.scale(z, lim / r) : z; }

  // ── геодезическая p→q: прямая через 0 или дуга через p, q, p* = p/|p|² ─
  function geodesic(p, q, n) {
    n = n || 24;
    var cr = p[0] * q[1] - p[1] * q[0], pts = [];
    var pp = C.abs2(p), qq = C.abs2(q);
    if (Math.abs(cr) < 1e-6 || pp < 1e-8 || qq < 1e-8) {
      for (var i = 0; i <= n; i++) pts.push([p[0] + (q[0] - p[0]) * i / n, p[1] + (q[1] - p[1]) * i / n]);
      return pts;
    }
    // центр окружности, ортогональной единичной: |c|² = r² + 1, проходит через p и q
    var a1 = 2 * p[0], b1 = 2 * p[1], c1 = pp + 1, a2 = 2 * q[0], b2 = 2 * q[1], c2 = qq + 1;
    var det = a1 * b2 - a2 * b1;
    var cx = (c1 * b2 - c2 * b1) / det, cy = (a1 * c2 - a2 * c1) / det;
    var R = Math.hypot(p[0] - cx, p[1] - cy);
    var t0 = Math.atan2(p[1] - cy, p[0] - cx), t1 = Math.atan2(q[1] - cy, q[0] - cx);
    var dt = t1 - t0; while (dt > Math.PI) dt -= TAU; while (dt < -Math.PI) dt += TAU;
    for (var j = 0; j <= n; j++) { var t = t0 + dt * j / n; pts.push([cx + R * Math.cos(t), cy + R * Math.sin(t)]); }
    return pts;
  }

  // ── граф онтологии из data/portfolio.json ────────────────────────────
  // классы и связи §6.6; связь «правило применимо» заводится там, где правило кусает
  function buildGraph(D) {
    var N = new Map(), adj = new Map();
    function node(id, type, label, extra) {
      if (!N.has(id)) { N.set(id, Object.assign({ id: id, type: type, label: label }, extra || {})); adj.set(id, []); }
      return N.get(id);
    }
    function link(a, b, rel) { if (!N.has(a) || !N.has(b) || a === b) return; adj.get(a).push({ to: b, rel: rel }); adj.get(b).push({ to: a, rel: rel }); }
    var loans = D.loans, coll = new Map(D.collateral.map(function (c) { return [c.id, c]; }));
    D.agents.forEach(function (a) { node(a.id, 'Agent', a.name, { job: a.job }); });
    D.rules.forEach(function (r) { node(r.id, 'Rule', r.text, { kind: r.kind }); });
    D.covenants.forEach(function (c) { node(c.id, 'Covenant', c.text); });
    D.borrowers.forEach(function (b) { node(b.id, 'Borrower', b.kind, { segment: b.segment, country: b.country }); });
    D.collateral.forEach(function (c) { node(c.id, 'Collateral', c.kind, { value: c.value, months: c.appraisedMonthsAgo }); });
    loans.forEach(function (l) { node(l.id, 'Loan', l.segment + ' · ' + l.country, { value: l.exposure, stage: l.stage, dpd: l.dpd }); });
    loans.forEach(function (l) {
      link(l.borrower, l.id, 'owes');
      if (l.collateral) link(l.id, l.collateral, 'secured_by');
      l.covenants.forEach(function (c) { link(l.id, c, 'governed_by'); });
      if (l.dpd > 0 || l.stage !== 'performing') link('R-221', l.id, 'applies_to');
      var c = l.collateral && coll.get(l.collateral);
      if (c && c.appraisedMonthsAgo > 12) link('R-305', l.id, 'applies_to');
      if (l.views.A2.inBatch && l.views.A2.result !== 'pass') link('R-412', l.id, 'applies_to');
      if (l.views.A1.flag) link('A1', l.id, 'watches');
      if (l.views.A2.inBatch && l.views.A2.result === 'fail') link('A2', l.id, 'checks');
      if (l.views.A3.mapped < 1) link('A3', l.id, 'maps');
      if (l.dpd > 0) link('A4', l.id, 'services');
      if (l.views.A5.action !== 'monitor') link('A5', l.id, 'recovers');
    });
    D.decisions.forEach(function (d) {
      node(d.id, 'Decision', d.action, { status: d.status });
      link(d.agent, d.id, 'proposes'); link(d.id, d.loan, 'about');
      d.checks.forEach(function (c) {
        if (c.kind === 'rule') link(d.id, c.ref, 'checked_by');
        else {
          var id = c.ref, type = c.kind === 'approval' ? 'Approval' : 'Evidence';
          node(id, type, c.ref); link(d.id, id, c.kind === 'approval' ? 'approved_by' : 'evidenced_by');
        }
      });
    });
    return { N: N, adj: adj };
  }
  var PRIO = { Decision: 0, Rule: 1, Borrower: 2, Collateral: 3, Covenant: 4, Approval: 5, Evidence: 6, Agent: 7, Loan: 8 };
  var CAP = [8, 5, 4, 3, 3];   // ветвление по глубине: «ёж» из листьев запрещён §2.2 A

  // дерево BFS от корня, глубина ≤ depth, лишнее агрегируется в «+N» до рендера
  function buildTree(G, rootId, depth) {
    var seen = new Set([rootId]);
    var root = { id: rootId, n: G.N.get(rootId), depth: 0, kids: [], parent: null, rel: null };
    var q = [root], all = [root];
    while (q.length) {
      var t = q.shift();
      if (t.depth >= depth || t.more) continue;
      var nb = G.adj.get(t.id).filter(function (e) { return !seen.has(e.to); });
      var uniq = new Map(); nb.forEach(function (e) { if (!uniq.has(e.to)) uniq.set(e.to, e); });
      nb = Array.from(uniq.values()).sort(function (a, b) {
        var na = G.N.get(a.to), nb2 = G.N.get(b.to);
        return (PRIO[na.type] - PRIO[nb2.type]) || ((nb2.value || 0) - (na.value || 0)) || (a.to < b.to ? -1 : 1);
      });
      var cap = CAP[Math.min(t.depth, CAP.length - 1)];
      var take = nb.length > cap ? nb.slice(0, cap - 1) : nb, rest = nb.length - take.length;
      take.forEach(function (e) {
        seen.add(e.to);
        var k = { id: e.to, n: G.N.get(e.to), depth: t.depth + 1, kids: [], parent: t, rel: e.rel };
        t.kids.push(k); all.push(k); q.push(k);
      });
      if (rest > 0) {
        var m = { id: t.id + '/+', n: { id: t.id + '/+', type: 'More', label: '+' + rest, count: rest }, depth: t.depth + 1, kids: [], parent: t, rel: 'more', more: true };
        t.kids.push(m); all.push(m);
      }
    }
    // вес поддерева = листья^0.7 (как сектор в cascade), он делит клин
    (function w(t) { t.w = t.kids.length ? t.kids.reduce(function (s, k) { return s + w(k); }, 0) : 1; return t.w; })(root);
    return { root: root, all: all };
  }

  // раскладка Лэмпинга: ребёнок на гипер-дистанции link в системе родителя,
  // клин ребёнка = концы клина родителя, увиденные из ребёнка, × 0.7 на уровень
  function layout(tree, link, a0, half) {
    var r = Math.tanh(link / 2);
    function place(t, F, a0, half) {
      t.z = apply(F, [0, 0]);
      if (!t.kids.length) return;
      var tot = t.kids.reduce(function (s, k) { return s + Math.pow(k.w, 0.7); }, 0), acc = a0 - half;
      t.kids.forEach(function (k) {
        var share = Math.pow(k.w, 0.7) / tot * 2 * half, ang = acc + share / 2; acc += share;
        var p = C.polar(r, ang), Tp = T(p);
        var Fk = compose(F, T(C.scale(p, -1)));
        var e1 = C.arg(apply(Tp, C.polar(1, ang - share / 2))), e2 = C.arg(apply(Tp, C.polar(1, ang + share / 2)));
        var d1 = e1 - ang, d2 = e2 - ang;
        while (d1 > Math.PI) d1 -= TAU; while (d1 < -Math.PI) d1 += TAU;
        while (d2 > Math.PI) d2 -= TAU; while (d2 < -Math.PI) d2 += TAU;
        var kh = Math.min(Math.abs(d1), Math.abs(d2)) * 0.7;
        place(k, Fk, ang, Math.min(kh, Math.PI * 0.45));
      });
    }
    place(tree.root, ID, a0 === undefined ? -Math.PI / 2 : a0, half === undefined ? Math.PI : half);
  }

  // дистанции по дереву от узла (для высот и колец подписей)
  function distFrom(tree, id) {
    var map = new Map(), start = tree.all.filter(function (t) { return t.id === id; })[0] || tree.root;
    var q = [[start, 0]]; map.set(start, 0);
    while (q.length) {
      var it = q.shift(), t = it[0], d = it[1];
      var nb = t.kids.slice(); if (t.parent) nb.push(t.parent);
      nb.forEach(function (k) { if (!map.has(k)) { map.set(k, d + 1); q.push([k, d + 1]); } });
    }
    return map;
  }

  // ── навигация: состояние вида и анимации, детерминированные по номеру кадра ─
  function Nav() {
    return { m: ID, anim: null, center: null, sel: -1 };
  }
  // ход фокуса по геодезической: a(s) = tanh(s·atanh|b|)·b/|b|, 720 мс §7.5
  function navGo(nav, w, ts, targetId) {
    nav.anim = { from: nav.m, w: w, t0: ts, dur: 0.72, target: targetId, prevCenter: nav.center };
  }
  function navStep(nav, ts, ease) {
    if (!nav.anim) return 1;
    var a = nav.anim, s = Math.min(1, Math.max(0, (ts - a.t0) / a.dur)), k = ease(s);
    nav.m = compose(T(along(a.w, k)), a.from);
    if (s >= 1) { nav.center = a.target; nav.anim = null; return 1; }
    return k;
  }
  // протяжка: U(p0) = p1, U = T_{−p1} ∘ T_{p0}
  function navDrag(nav, m0, p0, p1) {
    p0 = clampDisk(p0, 0.97); p1 = clampDisk(p1, 0.97);
    nav.m = compose(compose(T(C.scale(p1, -1)), T(p0)), m0);
  }

  window.HYPER = {
    C: C, ID: ID, apply: apply, compose: compose, T: T, rot: rot, inverse: inverse, along: along,
    geodesic: geodesic, clampDisk: clampDisk, buildGraph: buildGraph, buildTree: buildTree, layout: layout,
    distFrom: distFrom, Nav: Nav, navGo: navGo, navStep: navStep, navDrag: navDrag
  };
})();
