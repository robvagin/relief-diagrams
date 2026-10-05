/* RELIEF lab · horizon: онтология в фокусе (README §6.1 №05, механика §7.7).
   Общая часть трёх вариантов: граф, дерево, раскладка, навигация, плашки, подписи.
   Вариант задаёт только ВИД (как диск ложится в кадр) и свою печать: HORIZON.make({view}). */
(function () {
  'use strict';
  var R = window.RELIEF, H = window.HYPER, Cx = H.C, TAU = Math.PI * 2;

  var GROUPS = {
    'Сцена': [
      ['focus', 'Фокус', ['L-0005', 'B-0005', 'R-104', 'A4'], 'L-0005'],
      ['labels', 'Подписи', ['focus', 'ring1', 'ring2'], 'ring1', ['Фокус', 'Кольцо 1', 'Кольцо 2']],
      ['horizon', 'Горизонт', 0, 1, 1, 1]
    ],
    'Ритм': [
      ['link', 'Дистанция связи', 0.8, 2, 0.01, 1.25],
      ['depthH', 'Глубина', 1, 4, 1, 3]
    ]
  };
  var TYPE_WORD = { Loan: 'Loan', Borrower: 'Borrower', Collateral: 'Collateral', Covenant: 'Covenant', Rule: 'Rule',
    Decision: 'Decision', Agent: 'Agent', Approval: 'Approval', Evidence: 'Evidence', More: 'More' };
  var REL = { owes: 'owes', secured_by: 'secured by', governed_by: 'governed by', applies_to: 'applies to', watches: 'watches',
    checks: 'checks', maps: 'maps', services: 'services', recovers: 'recovers', proposes: 'proposes', about: 'about',
    checked_by: 'checked by', approved_by: 'approved by', evidenced_by: 'evidenced by', more: 'more' };

  function money(v) {
    if (v >= 1e6) return '€' + (v / 1e6).toFixed(2) + 'M';
    if (v >= 1e3) return '€' + Math.round(v / 1e3) + 'k';
    return '€' + Math.round(v);
  }
  function moneyFull(v) { return '€' + Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function name1(t) {
    var n = t.n;
    if (n.type === 'More') return n.label;
    if (n.type === 'Agent') return n.id + ' ' + n.label;
    if (n.type === 'Approval' || n.type === 'Evidence') return n.label;
    return n.id;
  }
  function num2(t) {
    var n = t.n;
    if (n.type === 'More') return n.label;
    if (n.value) return money(n.value);
    var m = String(n.id).match(/\d+/);
    return m ? m[0] : '';
  }
  function focusLine(t) {
    var n = t.n;
    if (n.type === 'Loan') return n.label + ' · ' + moneyFull(n.value) + ' · ' + n.stage;
    if (n.type === 'Borrower') return n.label + ' · ' + n.segment + ' · ' + n.country;
    if (n.type === 'Collateral') return n.label + ' · ' + moneyFull(n.value) + ' · appraised ' + n.months + ' mo ago';
    if (n.type === 'Agent') return n.job;
    if (n.type === 'Decision') return n.label + ' · ' + n.status;
    return n.label;
  }

  function make(V) {
    var S = { G: null, tree: null, nav: H.Nav(), nodes: [], drag: null, beta: 0 };

    function rebuild(ctx, keepNav) {
      if (!S.G) S.G = H.buildGraph(ctx.data);
      S.tree = H.buildTree(S.G, ctx.P.focus, Math.round(+ctx.P.depthH));
      H.layout(S.tree, +ctx.P.link);
      if (!keepNav) { S.nav = H.Nav(); S.nav.center = S.tree.root.id; S.settledAt = -10; }
      if (V.prepare) V.prepare(S, ctx);
    }
    function nodeById(id) { return S.tree.all.filter(function (t) { return t.id === id; })[0]; }

    function draw(ctx) {
      var U = R.units(ctx), ts = R.tsec(ctx), P = ctx.P;
      if (!S.tree) rebuild(ctx);
      var k = H.navStep(S.nav, ts, ctx.reduced ? function () { return 1; } : R.EASE);
      if (!S.nav.anim && S.wasAnim) { S.settledAt = ts; S.wasAnim = false; }
      if (S.nav.anim) S.wasAnim = true;
      var center = S.nav.center || S.tree.root.id;
      var dNew = H.distFrom(S.tree, S.nav.anim ? S.nav.anim.target : center);
      var dOld = H.distFrom(S.tree, S.nav.anim ? (S.nav.anim.prevCenter || center) : center);
      V.frame(S, ctx, U);
      var zl = [U.z(3), U.z(2), U.z(1), 0];
      var nodes = S.tree.all.map(function (t) {
        var w = H.apply(S.nav.m, t.z), xy = V.map(w), dn = dNew.get(t), dO = dOld.get(t);
        var zz = R.mix(zl[Math.min(3, dO)], zl[Math.min(3, dn)], k);
        var ring = k < 0.5 ? dO : dn;
        var rho = R.clamp(18 * V.size(w), 1.5, 18) * U.ui;
        if (t.more) rho = Math.min(rho, 4 * U.ui);
        return { t: t, w: w, x: xy[0], y: xy[1], rho: rho, z: t.more ? 0 : zz, ring: ring, vis: xy[2] !== false };
      });
      S.nodes = nodes;
      var plates = [];
      nodes.forEach(function (nd) {
        if (!nd.vis || nd.z <= 0.3 || nd.rho < 1.6 * U.ui) return;
        var settled = nd.ring === 0 && !S.nav.anim;
        plates.push({
          id: nd.t.id, kind: 'disc', x: nd.x, y: nd.y, r: nd.rho, z: nd.z,
          env: settled ? R.settleEnv(ts, S.settledAt, +P.settle) : 1,
          print: function (g, T, U2, p) { mark(g, T, U2, nd, p); }
        });
        nd.plate = plates[plates.length - 1];
      });
      var out = R.render(ctx, {
        plates: plates,
        floor: function (g, T, U2) { floor(g, T, U2, ctx, nodes); },
        overlay: function (g, T, U2) { overlay(g, T, U2, ctx, nodes); }
      });
      void out;
    }

    // печать на полу: горизонт, геодезические рёбра, точки z0, подписи
    function floor(g, T, U, ctx, nodes) {
      var P = ctx.P;
      if (+P.horizon) V.horizon(g, T, U, ctx, S);
      var byT = new Map(nodes.map(function (n) { return [n.t, n]; }));
      g.lineWidth = U.lineW; g.lineCap = 'round';
      nodes.forEach(function (b) {
        var a = b.t.parent && byT.get(b.t.parent);
        if (!a || !a.vis && !b.vis) return;
        var depth = Math.max(a.ring, b.ring);
        var alpha = depth <= 1 ? 0.55 : depth === 2 ? 0.35 : 0.2;
        var pts = H.geodesic(a.w, b.w, 28).map(function (w) { return V.map(w); });
        trimDraw(g, pts, a, b, U, R.rgba(T.ink, alpha));
      });
      if (V.floorExtra) V.floorExtra(g, T, U, ctx, S, nodes);
      // z0: печатные точки без тени; «+N» полым кольцом
      nodes.forEach(function (n) {
        if (!n.vis) return;
        if (n.t.more) {
          g.beginPath(); g.arc(n.x, n.y, Math.max(1.5 * U.ui, n.rho), 0, TAU);
          g.strokeStyle = R.rgba(T.ink2, 0.55); g.lineWidth = U.lineW; g.stroke(); return;
        }
        if (n.plate) return;
        g.beginPath(); g.arc(n.x, n.y, Math.max(1.2 * U.ui, Math.min(n.rho, 3 * U.ui)), 0, TAU);
        g.fillStyle = R.rgba(T.ink2, n.ring >= 3 ? 0.45 : 0.7); g.fill();
      });
      labels(g, T, U, ctx, nodes);
    }
    // ребро с зазором 3 px у узла (Joint gap донора 04) и ореолом поверхности
    function trimDraw(g, pts, a, b, U, color) {
      var gap = 3 * U.ui, ra = (a.plate ? a.rho : Math.min(a.rho, 3 * U.ui)) + gap, rb = (b.plate ? b.rho : Math.min(b.rho, 3 * U.ui)) + gap;
      var keep = pts.filter(function (p) {
        return Math.hypot(p[0] - a.x, p[1] - a.y) > ra && Math.hypot(p[0] - b.x, p[1] - b.y) > rb && Math.abs(p[0]) < 1e5 && Math.abs(p[1]) < 1e5;
      });
      if (keep.length < 2) return;
      g.beginPath(); g.moveTo(keep[0][0], keep[0][1]);
      for (var i = 1; i < keep.length; i++) g.lineTo(keep[i][0], keep[i][1]);
      g.strokeStyle = color; g.stroke();
    }

    // подписи §7.7: фокус Geist 500 t4, кольцо 1 t2, кольцо 2 только числа Mono t1
    function labels(g, T, U, ctx, nodes) {
      var mode = ctx.P.labels, maxRing = mode === 'focus' ? 0 : mode === 'ring1' ? 1 : 2;
      var boxes = nodes.filter(function (n) { return n.vis; }).map(function (n) { return [n.x - n.rho - 2, n.y - n.rho - 2, n.x + n.rho + 2, n.y + n.rho + 2, n]; });
      if (V.reserve) V.reserve(boxes, ctx, U);
      var c = V.origin(ctx, U);
      var list = nodes.filter(function (n) { return n.vis && n.ring <= maxRing && !(n.t.more && n.ring > 1); })
        .sort(function (a, b) { return a.ring - b.ring || b.rho - a.rho; });
      list.forEach(function (n) {
        var lines;
        if (n.ring === 0) lines = [[name1(n.t), 4, 500, false, T.ink], [focusLine(n.t), 1, 400, true, T.ink3]];
        else if (n.ring === 1) lines = [[name1(n.t), 2, 500, false, T.ink], [REL[n.t.rel] || (n.t.parent ? '' : ''), 1, 400, true, T.ink3]];
        else lines = [[num2(n.t), 1, 400, true, T.ink2]];
        if (n.ring === 1 && n.t.parent && n.t.parent.id !== (S.nav.center || S.tree.root.id)) {
          lines[1][0] = REL[n.t.rel] ? 'via ' + n.t.parent.id : '';   // кольцо 1 через ребёнка фокуса
        }
        if (n.ring === 1 && n.t.more) lines = [[n.t.n.label + ' more', 1, 400, true, T.ink3]];
        var wmax = 0, hs = [];
        lines.forEach(function (L) { R.font(g, U, L[1], L[2], L[3]); wmax = Math.max(wmax, g.measureText(L[0]).width); hs.push(U.fs(L[1]) * 1.2); });
        var hh = hs.reduce(function (s, v) { return s + v; }, 0);
        var ang = Math.atan2(n.y - c[1], n.x - c[0]);
        if (n.ring === 0) ang = V.focusLabelAngle !== undefined ? V.focusLabelAngle : -Math.PI / 2 - 0.6;
        var tries = [ang, ang + Math.PI / 2, ang - Math.PI / 2, ang + Math.PI];
        for (var i = 0; i < tries.length; i++) {
          var a = tries[i], d = n.rho + 6 * U.ui + (n.ring === 0 ? 8 * U.ui : 0);
          var ax = n.x + Math.cos(a) * d, ay = n.y + Math.sin(a) * d;
          var x0 = Math.cos(a) >= 0.3 ? ax : Math.cos(a) <= -0.3 ? ax - wmax : ax - wmax / 2;
          var y0 = Math.sin(a) >= 0.3 ? ay : Math.sin(a) <= -0.3 ? ay - hh : ay - hh / 2;
          var bx = [x0 - 2, y0 - 2, x0 + wmax + 2, y0 + hh + 2];
          if (bx[0] < U.margin * 0.5 || bx[2] > ctx.W - U.margin * 0.5 || bx[1] < U.margin * 0.5 || bx[3] > ctx.H - U.margin * 0.5) continue;
          var hit = boxes.some(function (b) { return b[4] !== n && !(bx[2] < b[0] || bx[0] > b[2] || bx[3] < b[1] || bx[1] > b[3]); });
          if (hit) continue;
          boxes.push(bx);
          var yy = y0;
          g.textBaseline = 'top'; g.textAlign = 'left';
          lines.forEach(function (L, j) {
            R.font(g, U, L[1], L[2], L[3]); g.fillStyle = R.rgba(L[4]);
            if (L[0]) g.fillText(L[0], x0, yy + (hs[j] - U.fs(L[1])) / 2);
            yy += hs[j];
          });
          break;
        }
      });
    }

    // печать на диске: тип формой, не цветом (L8); заблокированное решение = точка акцента
    function mark(g, T, U, nd, p) {
      var r = p.r, x = p.cx - p.dx, y = p.cy - p.dy, type = nd.t.n.type, s = r * 0.32;
      if (r < 5 * U.ui) return;
      g.strokeStyle = R.rgba(T.ink2, 0.75); g.fillStyle = R.rgba(T.ink2, 0.75); g.lineWidth = U.lineW;
      g.beginPath();
      if (type === 'Loan') { g.arc(x, y, s * 0.42, 0, TAU); g.fill(); return; }
      if (type === 'Borrower') { g.arc(x - s * 0.45, y, s * 0.28, 0, TAU); g.arc(x + s * 0.45, y, s * 0.28, 0, TAU); g.fill(); return; }
      if (type === 'Collateral') { g.rect(x - s * 0.4, y - s * 0.4, s * 0.8, s * 0.8); g.fill(); return; }
      if (type === 'Covenant') { g.moveTo(x - s * 0.6, y - s * 0.22); g.lineTo(x + s * 0.6, y - s * 0.22); g.moveTo(x - s * 0.6, y + s * 0.22); g.lineTo(x + s * 0.6, y + s * 0.22); g.stroke(); return; }
      if (type === 'Rule') { g.moveTo(x - s * 0.7, y); g.lineTo(x + s * 0.7, y); g.stroke(); return; }
      if (type === 'Agent') { g.arc(x, y, s * 0.5, 0, TAU); g.stroke(); return; }
      if (type === 'Decision') {
        g.moveTo(x, y - s * 0.6); g.lineTo(x + s * 0.6, y); g.lineTo(x, y + s * 0.6); g.lineTo(x - s * 0.6, y); g.closePath();
        if (nd.t.n.status === 'blocked') { g.fillStyle = R.rgba(T.accent); }
        g.fill(); return;
      }
      if (type === 'Approval') { g.arc(x, y, s * 0.5, 0, TAU); g.stroke(); g.beginPath(); g.arc(x, y, s * 0.16, 0, TAU); g.fill(); return; }
      if (type === 'Evidence') { g.moveTo(x, y - s * 0.55); g.lineTo(x + s * 0.55, y + s * 0.4); g.lineTo(x - s * 0.55, y + s * 0.4); g.closePath(); g.fill(); }
    }

    // слой взаимодействия: кольцо выбора акцентом; заголовок, легенда, «Fictional data»
    function overlay(g, T, U, ctx, nodes) {
      var sel = S.nav.sel >= 0 && S.ring1 ? S.ring1[S.nav.sel % S.ring1.length] : null;
      if (sel) {
        var n = nodes.filter(function (q) { return q.t === sel; })[0];
        if (n && n.vis) { g.beginPath(); g.arc(n.x, n.y, n.rho + 4 * U.ui, 0, TAU); g.strokeStyle = R.rgba(T.accent); g.lineWidth = U.lineW; g.stroke(); }
      }
      var o = V.origin(ctx, U);
      S.ring1 = nodes.filter(function (q) { return q.ring === 1 && q.vis && !q.t.more; })
        .sort(function (a, b) { return Math.atan2(a.y - o[1], a.x - o[0]) - Math.atan2(b.y - o[1], b.x - o[0]); })
        .map(function (q) { return q.t; });
      var m = U.margin, c = S.nodes.filter(function (q) { return q.ring === 0; })[0];
      g.textBaseline = 'top'; g.textAlign = 'left';
      R.caps(g, U, 1); g.fillStyle = R.rgba(T.ink3); g.fillText('ONTOLOGY IN FOCUS', m, m);
      R.font(g, U, 3, 500); g.fillStyle = R.rgba(T.ink);
      g.fillText(c ? (TYPE_WORD[c.t.n.type] + ' ' + name1(c.t)) : '', m, m + U.fs(1) * 1.6);
      R.font(g, U, 1, 400, true); g.fillStyle = R.rgba(T.ink3);
      g.fillText(S.tree.all.length + ' objects · ' + Math.round(+ctx.P.depthH) + ' steps from focus', m, m + U.fs(1) * 1.6 + U.fs(3) * 1.3);
      if (V.legend !== false) {
        var ly = ctx.H - m - U.fs(1) * 1.3 * 3;
        R.caps(g, U, 1); g.fillStyle = R.rgba(T.ink3); g.fillText('HOW TO READ', m, ly);
        R.font(g, U, 1, 400, true);
        g.fillText('Height and size = closeness to the focus', m, ly + U.fs(1) * 1.3);
        g.fillText('Click to bring forward · drag to pan · double-click: home', m, ly + U.fs(1) * 2.6);
      }
      R.font(g, U, 1, 400, true); g.textAlign = 'right'; g.fillStyle = R.rgba(T.ink3);
      g.fillText('Fictional data', ctx.W - m, ctx.H - m - U.fs(1));
      g.textAlign = 'left';
      if (V.overlayExtra) V.overlayExtra(g, T, U, ctx, S, nodes);
    }

    // ── взаимодействие §7.7 ───────────────────────────────────────────
    function redraw(ctx) { if (ctx.reduced || RELIEF.paused) window.postMessage({ type: 'es:progress', value: ctx.p }, '*'); }
    function pick(ctx, x, y) {
      var best = null, bd = 1e9;
      S.nodes.forEach(function (n) { if (!n.vis || n.t.more) return; var d = Math.hypot(n.x - x, n.y - y); if (d < Math.max(n.rho, 6) + 4 && d < bd) { bd = d; best = n; } });
      return best;
    }
    function goTo(ctx, n) {
      var ts = R.tsec(ctx);
      S.nav.sel = -1;
      H.navGo(S.nav, n.w, ts, n.t.id);
      if (ctx.reduced) { H.navStep(S.nav, ts + 1, R.EASE); }
      redraw(ctx);
    }
    function attach(ctx) {
      var cv = ctx.canvas, lastClick = 0;
      function local(e) { var r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
      cv.addEventListener('pointerdown', function (e) {
        var p = local(e);
        S.drag = { x: p[0], y: p[1], m0: S.nav.m, w0: V.unmap(p), moved: false };
        try { cv.setPointerCapture(e.pointerId); } catch (er) {}
      });
      cv.addEventListener('pointermove', function (e) {
        if (!S.drag) return;
        var p = local(e);
        if (!S.drag.moved && Math.hypot(p[0] - S.drag.x, p[1] - S.drag.y) < 4) return;
        S.drag.moved = true; S.nav.anim = null;
        H.navDrag(S.nav, S.drag.m0, S.drag.w0, V.unmap(p));
        var best = null, bd = 9;   // центр протяжки = узел ближе всех к 0
        S.tree.all.forEach(function (t) { var d = Cx.abs(H.apply(S.nav.m, t.z)); if (d < bd) { bd = d; best = t; } });
        if (best && best.id !== S.nav.center) { S.nav.center = best.id; }
        redraw(ctx);
      });
      cv.addEventListener('pointerup', function (e) {
        var d = S.drag; S.drag = null; if (!d || d.moved) { if (d) S.settledAt = R.tsec(ctx); return; }
        var p = local(e), n = pick(ctx, p[0], p[1]), now = e.timeStamp;
        if (n) { goTo(ctx, n); }
        else if (now - lastClick < 350) {   // двойной клик по пустому = домой
          var root = S.nodes.filter(function (q) { return q.t === S.tree.root; })[0];
          if (root) goTo(ctx, root);
        }
        lastClick = now;
      });
      document.addEventListener('keydown', function (e) {
        if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
        if (e.target && e.target.closest && e.target.closest('.pv2')) return;
        if (!S.ring1 || !S.ring1.length) return;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { S.nav.sel = (S.nav.sel + 1) % S.ring1.length; e.preventDefault(); redraw(ctx); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { S.nav.sel = (S.nav.sel - 1 + S.ring1.length) % S.ring1.length; e.preventDefault(); redraw(ctx); }
        else if (e.key === 'Enter' && S.nav.sel >= 0) {
          var t = S.ring1[S.nav.sel % S.ring1.length], n = S.nodes.filter(function (q) { return q.t === t; })[0];
          if (n) goTo(ctx, n);
        }
      });
    }

    R.scene({
      id: 'horizon', variant: V.variant, title: 'Horizon · ' + V.name,
      blurb: 'Ontology in focus: the object sits in the centre, its grounds around it, the rest compressed toward the horizon.',
      groups: GROUPS,
      init: function (ctx) { rebuild(ctx); },
      structural: function (ctx, path) { if (path === 'focus' || path === 'depthH' || path === 'link') rebuild(ctx, false); },
      draw: draw, attach: attach
    });
    return S;
  }

  window.HORIZON = { make: make, money: money, moneyFull: moneyFull, name1: name1, REL: REL };
})();
