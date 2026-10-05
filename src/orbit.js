/* orbit.js · главная сцена playground: вся книга одним живым организмом (приказ владельца 2026-10-05).
   Организм «цветок · спутники» (Satellites network, README §2.2 B): в сердцевине диск книги, лучами
   веер бумажных листов-стадий, от них лучами диски сегментов, вокруг сегментов семечки-займы спиралью
   филлотаксиса. Площадь круга = объём (честно под значение), дистанция до родителя = доля в родителе,
   высота = степень проверенности (непроверенное, non-performing, печатается плоско). Между семьями воздух.
   Лучи прямые, засечки точками каждые 10 % доли, ни одной перпендикулярной линии, ни одной дырки.
   Живое: src/motion/graph.js (силовая модель, перетаскивание, наведение, фокус, зум, панорама). */
(function () {
  'use strict';
  var R = window.RELIEF, D2R = Math.PI / 180;
  var STAGE_NAME = { performing: 'Performing', watch: 'Watch', 'non-performing': 'Non-performing' };
  var G = null, M = null, built = '';

  function money(v) {
    return v >= 1e6 ? '€' + (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? '€' + Math.round(v / 1e3) + 'k' : '€' + Math.round(v);
  }
  function pct(x) { return (x * 100).toFixed(x < 0.1 ? 1 : 0) + '%'; }

  /* раскладка — чистая функция (данные, параметры, поток) → модель; сид решает только равенства и наклоны */
  function layout(data, P, rand) {
    var b = data.breakdown, loans = data.loans, nodes = [], edges = [];
    var L1 = 250, u = 14, tilt = (+P.tilt || 0) * D2R;
    var hub = { id: 'book', kind: 'circle', role: 'hub', x: 0, y: 0, r: 66, lvl: 3, value: b.value, count: b.count, label: 'Loan book', mass: 6 };
    nodes.push(hub);
    var stages = b.children.slice();
    var leaves = function (s) { return s.children.reduce(function (a, c) { return a + c.count; }, 0); };
    var wsum = stages.reduce(function (a, s) { return a + Math.pow(leaves(s), 0.7); }, 0);
    var gapA = 18 * D2R, usable = Math.PI * 2 - gapA * stages.length;
    var a0 = -Math.PI / 2 - 0.5 * usable * Math.pow(leaves(stages[0]), 0.7) / wsum + (rand() - 0.5) * 0.2;
    var segMax = 0, expMax = 0;
    stages.forEach(function (s) { s.children.forEach(function (c) { segMax = Math.max(segMax, c.value); }); });
    loans.forEach(function (l) { expMax = Math.max(expMax, l.exposure); });
    var ang = a0;
    stages.forEach(function (s) {
      var sec = usable * Math.pow(leaves(s), 0.7) / wsum, dir = ang + sec / 2;
      ang += sec + gapA;
      var share = s.value / b.value, w = 186 + 40 * Math.sqrt(share), h = 112;
      var rr = Math.hypot(w, h) / 2;
      var len = hub.r + rr + u + L1 * share;
      var st = { id: 'st/' + s.label, kind: 'rect', role: 'stage', paper: true, x: Math.cos(dir) * len, y: Math.sin(dir) * len,
        w: w, h: h, r: 5, rot: (rand() < 0.5 ? -1 : 1) * tilt * (0.6 + 0.4 * rand()), lvl: 2, value: s.value, count: s.count,
        label: STAGE_NAME[s.label] || s.label, share: share, dir: dir, len: len, stage: s.label, mass: 3 };
      var si = nodes.length; nodes.push(st);
      edges.push({ a: 0, b: si, ray: true, share: share });
      var segs = s.children.slice().sort(function (p, q) { return q.value - p.value; });
      var fan = Math.min(72 * D2R, sec * 0.46), n = segs.length;
      segs.forEach(function (c, k) {
        // веер внутри сектора: крупнейший по оси, дальше попеременно по сторонам (ритм крупный · мелкий · средний)
        var side = k === 0 ? 0 : (k % 2 ? 1 : -1) * Math.ceil(k / 2) / Math.ceil((n - 1) / 2);
        var sd = dir + side * fan, cs = c.value / s.value, r = Math.max(7, 74 * Math.sqrt(c.value / segMax));
        var l2 = rr + r + u + 0.55 * L1 * cs;
        var sg = { id: 'sg/' + s.label + '/' + c.label, kind: 'circle', role: 'segment', x: st.x + Math.cos(sd) * l2, y: st.y + Math.sin(sd) * l2,
          r: r, lvl: s.label === 'non-performing' ? 1 : 2, value: c.value, count: c.count, label: c.label, share: cs, dir: sd, stage: s.label, mass: 2 };
        var gi = nodes.length; nodes.push(sg);
        edges.push({ a: si, b: gi, ray: true, share: cs });
        if (!+P.loans) return;
        var mine = loans.filter(function (l) { return l.stage === s.label && l.segment === c.label; })
          .sort(function (p, q) { return q.exposure - p.exposure; });
        var off = rand() * 137.508;
        mine.forEach(function (l, j) {
          // семечки: k-й под углом k·137,508° в полуплоскости наружу, радиус ∝ √k (филлотаксис)
          var lr = Math.max(2.4, 15 * Math.sqrt(l.exposure / expMax));
          var t = ((j * 137.508 + off) % 280 - 140) * D2R, rad = r + 7 + lr + 5.6 * Math.sqrt(j + 1);
          var npl = l.stage === 'non-performing';
          nodes.push({ id: l.id, kind: 'circle', role: 'loan', x: sg.x + Math.cos(sd + t) * rad, y: sg.y + Math.sin(sd + t) * rad,
            r: lr, lvl: npl ? 0 : 1, value: l.exposure, loan: l, stage: s.label, label: l.id, mass: 0.6, drift: 1.4 });
          edges.push({ a: gi, b: nodes.length - 1, leaf: true, k: 42 });
        });
      });
    });
    // поворот всей раскладки под пропорцию кадра: правило «максимум масштаба при вписывании», не рука
    var aspect = P._aspect || 1.6, best = 0, bestS = -1;
    for (var th = 0; th < 180; th += 5) {
      var c = Math.cos(th * D2R), sn = Math.sin(th * D2R), x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      nodes.forEach(function (nd) { var x = c * nd.x - sn * nd.y, y = sn * nd.x + c * nd.y, e = nd.kind === 'circle' ? nd.r : 110;
        x0 = Math.min(x0, x - e); x1 = Math.max(x1, x + e); y0 = Math.min(y0, y - e); y1 = Math.max(y1, y + e); });
      var sc0 = Math.min(aspect / (x1 - x0), 1 / (y1 - y0));
      if (sc0 > bestS + 1e-9) { bestS = sc0; best = th; }
    }
    var cR = Math.cos(best * D2R), sR = Math.sin(best * D2R);
    nodes.forEach(function (nd) {
      var x = cR * nd.x - sR * nd.y, y = sR * nd.x + cR * nd.y; nd.x = x; nd.y = y;
      if (nd.dir != null) nd.dir += best * D2R;
    });
    var bb = [1e9, 1e9, -1e9, -1e9];
    nodes.forEach(function (nd) {
      var e = nd.kind === 'circle' ? nd.r : Math.hypot(nd.w, nd.h) / 2;
      bb[0] = Math.min(bb[0], nd.x - e - 30); bb[1] = Math.min(bb[1], nd.y - e - 20);
      bb[2] = Math.max(bb[2], nd.x + e + 30); bb[3] = Math.max(bb[3], nd.y + e + 20);
    });
    // форма столкновения: у листа радиус по меньшей стороне (листы могут заходить друг на друга краем)
    nodes.forEach(function (nd) { nd.cr = nd.kind === 'circle' ? nd.r : Math.min(nd.w, nd.h) / 2; });
    return { nodes: nodes, edges: edges, bbox: bb };
  }

  function key(ctx) { return [ctx.P.loans, ctx.P.tilt, ctx.seed, aspectOf(ctx)].join('|'); }
  function aspectOf(ctx) { return Math.round(Math.max(0.5, Math.min(2.5, ctx.W / Math.max(1, ctx.H))) * 5) / 5; }
  function rebuild(ctx) {
    var data = ctx.data || (R.data && R.data());
    ctx.P._aspect = aspectOf(ctx);
    M = layout(data, ctx.P, ctx.rand);
    G = R.graph.create(M.nodes.map(function (nd) { return { id: nd.id, x: nd.x, y: nd.y, r: nd.cr, mass: nd.mass, drift: nd.drift, fixed: nd.role === 'hub' }; }), M.edges);
    built = key(ctx);
    if (ctx.canvas && !ctx.embedBound) {
      R.graph.bind(G, ctx.canvas, function (sx, sy) { return pick(sx, sy); }, function () {});
      ctx.embedBound = true;
    }
  }

  /* попадание по экранной форме: сверху вниз по высоте, круг — расстоянием, лист — в своей системе */
  var screenPl = [];
  function pick(sx, sy) {
    for (var i = screenPl.length - 1; i >= 0; i--) {
      var s = screenPl[i]; if (s.idx == null) continue;
      if (s.kind === 'circle') { if (Math.hypot(sx - s.x, sy - s.y) <= Math.max(s.w / 2, 6)) return s.idx; continue; }
      var c = Math.cos(-s.rot), n = Math.sin(-s.rot), dx = sx - s.x, dy = sy - s.y;
      var lx = c * dx - n * dy, ly = n * dx + c * dy;
      if (Math.abs(lx) <= s.w / 2 && Math.abs(ly) <= s.h / 2) return s.idx;
    }
    return -1;
  }

  function draw(ctx) {
    var P = ctx.P, W = ctx.W, H = ctx.H, ui = R.ui(W, H), C = R.color;
    if (!G || built !== key(ctx)) rebuild(ctx);
    R.seedFrom(ctx);
    G.fitTo(W, H, M.bbox);
    G.sync(ctx, { anchorK: 5, drift: +P.drift, springK: +P.springK, repel: +P.repel, period: +P.period, amp: 3 * (+P.float || 0) });
    var T = R.tokens(ctx.theme, P.accent), sc = G.scale(), zk = Math.min(1.6, Math.max(0.6, sc * 1.4));
    var mouse = G.mouse || [W / 2, H / 2], par = +P.parallax || 0;
    var hot = G.hover >= 0 ? G.hover : G.focus, hotSet = hot >= 0 ? G.hotSet(hot) : null;
    var focusLoan = (ctx.data || R.data()).focus.loan;

    // мир → экран: позиция после физики, размер × масштаб камеры, высота по лестнице + подъём, параллакс по высоте
    var S = M.nodes.map(function (nd, i) {
      var st = G.state(i), p = G.toScreen(st.x, st.y);
      var z = R.zh(nd.lvl, P, ui) * zk + st.lift * 14 * ui;
      p[0] += (mouse[0] - W / 2) / W * z * par * 1.2; p[1] += (mouse[1] - H / 2) / H * z * par * 1.2;
      return { nd: nd, i: i, x: p[0], y: p[1], z: z, fade: st.fade, lift: st.lift };
    });

    var plates = [];
    S.forEach(function (s) {
      var nd = s.nd;
      if (nd.lvl === 0) return;                                  // плоские печатаются на полу
      var fill = null, fade = 0.55 * s.fade;                     // притухание цветом к грунту кадра (рельс, pseudo-3d §2)
      if (nd.kind === 'circle') plates.push({ id: nd.id, kind: 'circle', x: s.x, y: s.y, w: 2 * nd.r * sc, z: s.z, idx: s.i, fill: fill, fade: fade, env: s.i === G.focus ? 0 : 1 });
      else plates.push({ id: nd.id, kind: 'rect', x: s.x, y: s.y, w: nd.w * sc, h: nd.h * sc, r: nd.r * sc, rot: nd.rot, z: s.z, idx: s.i, fill: fill, fade: fade, paper: true, env: s.i === G.focus ? 0 : 1 });
    });

    // подсказка: маленький бумажный лист z3 над наведённым узлом (README §7.9)
    var tip = null;
    if (G.hover >= 0) {
      var hs = S[G.hover], hn = hs.nd, lines = tipLines(hn, M.nodes[0].value);
      var tw = 172 * ui * 1.1, th = (18 + 15 * lines.length) * ui * 1.1, hr = hn.kind === 'circle' ? hn.r * sc : Math.hypot(hn.w, hn.h) / 2 * sc;
      var tx = hs.x + hr + 14 * ui + tw / 2, ty = hs.y - th / 2 - 6 * ui;
      if (tx + tw / 2 > W - 8) tx = hs.x - hr - 14 * ui - tw / 2;
      ty = Math.max(th / 2 + 8, Math.min(H - th / 2 - 8, ty));
      tip = { id: '__tip', kind: 'rect', x: tx, y: ty, w: tw, h: th, r: 4 * ui, z: R.zh(3, P, ui) * 1.4, paper: 0.02, lines: lines, env: 0 };
      plates.push(tip);
    }
    screenPl = R.frame(ctx, {
      plates: plates,
      floor: function (g, F) { floor(g, F, S, sc, hotSet, focusLoan); },
      print: function (g, s, F) { printPlate(g, s, F, sc, S, focusLoan); },
      above: function (g, F) { above(g, F, S, focusLoan); }
    }).plates.map(function (p) { return { kind: p.kind, x: p.x, y: p.y, w: p.w, h: p.h, rot: p.rot || 0, idx: p.src.idx, z: p.z }; })
      .sort(function (a, b) { return a.z - b.z; });
  }

  function tipLines(nd, total) {
    if (nd.role === 'loan') {
      var l = nd.loan;
      return [l.id + ' · ' + l.segment + ' · ' + l.country, 'Exposure ' + money(l.exposure), 'PD ' + (l.pd * 100).toFixed(1) + '% · DPD ' + l.dpd, l.stage];
    }
    if (nd.role === 'hub') return ['Loan book', money(nd.value) + ' · ' + nd.count + ' loans', 'as of 2026-09-30'];
    return [nd.label + (nd.role === 'segment' ? ' · ' + (STAGE_NAME[nd.stage] || nd.stage) : ''), money(nd.value) + ' · ' + nd.count + ' loans',
      pct(nd.share) + ' of ' + (nd.role === 'stage' ? 'the book' : 'the stage')];
  }

  /* печать на полу: лучи от хаба и от листов, засечки-точки каждые 10 % доли, короткие лучи к семечкам,
     плоские non-performing займы, подписи сегментов наружу по лучу, легенда «How to read» */
  function floor(g, F, S, sc, hotSet, focusLoan) {
    var T = F.T, ui = F.ui, P = F.P, C = R.color;
    R.ink.text(g, F, 'Loan book', F.W * 0.04, F.H * 0.065, { s: 3, w: 500 });
    R.ink.text(g, F, money(M.nodes[0].value) + ' · ' + M.nodes[0].count + ' loans · as of 2026-09-30', F.W * 0.04, F.H * 0.065 + 18 * ui, { s: 0, mono: true, tone: 'ink3' });
    R.ink.fictional(g, F);
    M.edges.forEach(function (e) {
      var a = S[e.a], b = S[e.b], dim = Math.max(a.fade, b.fade);
      var ra = radiusOf(a.nd, sc), rb = radiusOf(b.nd, sc);
      if (e.leaf) return;                       // семечки держатся пружиной, не лучом: «ёж» из связей запрещён (§9)
      R.ink.link(g, F, [a.x, a.y], [b.x, b.y], { ra: ra, rb: rb, gap: 3, tone: 'ink2', alpha: 0.62 * (1 - 0.75 * dim) });
      // засечки: точка каждые 10 % доли вдоль луча (дальше — больше доля), не штрих поперёк
      var dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
      var span = L - ra - rb, steps = Math.floor(e.share * 10 + 1e-6);
      g.fillStyle = C.css(T.ink2, 0.5 * (1 - 0.75 * dim));
      for (var k = 1; k <= steps; k++) {
        var d = ra + span * (k / 10) / Math.max(0.1, e.share) * e.share;
        if (d >= L - rb - 4) break;
        g.beginPath(); g.arc(a.x + ux * d, a.y + uy * d, Math.max(1, 1.4 * ui), 0, Math.PI * 2); g.fill();
      }
    });
    // плоские займы (non-performing): печать на полу, без тени — «отклонено ложится плоско»
    S.forEach(function (s) {
      if (s.nd.lvl !== 0) return;
      var r = s.nd.r * sc;
      g.fillStyle = C.css(T.ink3, 0.22 * (1 - 0.7 * s.fade));
      g.beginPath(); g.arc(s.x, s.y, r, 0, Math.PI * 2); g.fill();
    });
    // подписи сегментов наружу по лучу
    if (P.labels !== 'none' && 11.67 * sc * 0.95 >= 7) {          // мельче 7 px подпись не читается — не печатаем
      var Fw = Object.assign({}, F, { ui: sc * 0.95 }), wu = Fw.ui, segs = S.filter(function (s) { return s.nd.role === 'segment'; });
      // препятствия: все плашки кругами (семечки — облаком вокруг сегмента), уже поставленные подписи
      var obs = S.filter(function (s) { return s.nd.role !== 'loan'; }).map(function (s) {
        var r = radiusOf(s.nd, sc) * (s.nd.kind === 'circle' ? 1 : 1.25); return { x: s.x - r, y: s.y - r, w: 2 * r, h: 2 * r };
      });
      segs.forEach(function (s) { var r = (s.nd.r + 7 + 5.6 * Math.sqrt(s.nd.count + 1) + 8) * sc; obs.push({ x: s.x - r, y: s.y - r, w: 2 * r, h: 2 * r }); });
      g.save(); g.font = '500 ' + (11.67 * wu).toFixed(1) + 'px Geist';
      var placed = R.layout.labels.place(segs.map(function (s) {
        var t1 = s.nd.label, t2 = money(s.nd.value) + ' · ' + pct(s.nd.share);
        var w = Math.max(g.measureText(t1).width, g.measureText(t2).width * 1.08) + 4 * wu;
        return { x: s.x, y: s.y, r: (s.nd.r + 7 + 5.6 * Math.sqrt(s.nd.count + 1)) * sc, w: w, h: 30 * wu, angle: s.nd.dir, pad: 4 * wu };
      }), obs, [0, 0, F.W, F.H]);
      g.restore();
      placed.forEach(function (b, k) {
        var s = segs[k];
        if (!b.ok) {                          // запас: по лучу наружу за облаком семечек, без проверки соседей
          var rr = (s.nd.r + 10 + 5.6 * Math.sqrt(s.nd.count + 1)) * sc, d = s.nd.dir, cx = s.x + Math.cos(d) * rr, cy = s.y + Math.sin(d) * rr;
          b = { x: Math.cos(d) >= 0 ? cx : cx - b.w, y: cy - 15 * wu };
        }
        R.ink.text(g, Fw, s.nd.label, b.x, b.y + 12 * wu, { s: 0, w: 500, tone: 'ink2', alpha: 1 - 0.7 * s.fade });
        R.ink.text(g, Fw, money(s.nd.value) + ' · ' + pct(s.nd.share), b.x, b.y + 26 * wu, { s: 0, mono: true, tone: 'ink3', alpha: 1 - 0.7 * s.fade });
      });
    }
    // легенда «How to read»
    if (F.H < 420) return;                                          // во фрагменте легенду несёт страница (паспорт)
    var lx = F.W * 0.04, ly = F.H - F.H * 0.06 - 52 * ui;
    R.ink.text(g, F, 'How to read', lx, ly, { s: 0, caps: true, tone: 'ink3' });
    ['Area — exposure', 'Distance from the parent — share of it', 'Height — verified · flat — non-performing'].forEach(function (t, k) {
      R.ink.text(g, F, t, lx, ly + (15 + 14 * k) * ui, { s: 0, tone: 'ink2' });
    });
  }

  function radiusOf(nd, sc) { return nd.kind === 'circle' ? nd.r * sc : Math.min(nd.w, nd.h) / 2 * sc * 1.05; }

  function printPlate(g, s, F, sc, S, focusLoan) {
    var src = s.src, ui = F.ui, I = R.ink;
    if (src.id === '__tip') {
      src.lines.forEach(function (t, k) {
        I.text(g, F, t, s.x - s.w / 2 + 10 * ui, s.y - s.h / 2 + (17 + 15 * k) * ui, { s: k ? 0 : 1, w: k ? 400 : 500, mono: k > 0, tone: k ? 'ink2' : 'ink' });
      });
      return;
    }
    var nd = M.nodes[src.idx], st = S[src.idx], al = 1 - 0.7 * st.fade;
    ui = sc * 0.95; F = Object.assign({}, F, { ui: ui });            // текст на плашке живёт в мире: зум растит его вместе с листом
    if (nd.role === 'hub') {
      I.text(g, F, 'Loan book', s.x, s.y - 4 * ui, { s: 2, w: 500, align: 'center', alpha: al });
      I.text(g, F, money(nd.value), s.x, s.y + 16 * ui, { s: 1, mono: true, align: 'center', tone: 'ink2', alpha: al });
    } else if (nd.role === 'stage') {
      g.save(); g.translate(s.x, s.y); g.rotate(s.rot || 0);
      var x0 = -s.w / 2 + 14 * ui, y0 = -s.h / 2;
      if (11.67 * ui < 7) { I.text(g, F, pct(nd.share), x0, s.h / 2 - 14 * ui, { s: 5, mono: true, alpha: al }); g.restore(); return; }
      I.text(g, F, nd.label, x0, y0 + 26 * ui, { s: 2, w: 500, alpha: al });
      I.text(g, F, money(nd.value) + ' · ' + nd.count + ' loans', x0, y0 + 44 * ui, { s: 0, mono: true, tone: 'ink2', alpha: al });
      I.text(g, F, pct(nd.share), x0, s.h / 2 - 14 * ui, { s: 5, w: 400, mono: true, tone: 'ink', alpha: al });
      g.restore();
    }
  }

  /* слой взаимодействия: одно кольцо акцентом у займа решения D-7781 (один акцент, L8), подписи соседей наведённого */
  function above(g, F, S, focusLoan) {
    var T = F.T, ui = F.ui, C = R.color, sc = G.scale();
    S.forEach(function (s) {
      if (s.nd.id !== focusLoan) return;
      var r = s.nd.r * sc + 4 * ui;
      g.strokeStyle = C.css(T.accent); g.lineWidth = F.lineW * 1.2;
      g.beginPath(); g.arc(s.x, s.y, r, 0, Math.PI * 2); g.stroke();
      R.ink.text(g, F, 'D-7781 · blocked', s.x + r + 6 * ui, s.y + 4 * ui, { s: 0, mono: true, tone: 'ink' });
    });
  }

  R.def = {
    id: 'orbit',
    title: 'Loan book orbit',
    blurb: 'The whole book as one living organism: hub, stages, segments, loans.',
    groups: { 'Сцена': [
      ['labels', 'Подписи', ['hubs', 'none'], 'hubs', ['Хабы', 'Нет']],
      ['loans', 'Займы', 0, 1, 1, 1],
      ['tilt', 'Наклон листов, °', 0, 8, 0.5, 6],
      ['parallax', 'Параллакс', 0, 1.5, 0.01, 0.6, 'Выше плашка — сильнее сдвиг за мышью'],
      ['drift', 'Дыхание графа', 0, 2, 0.01, 1],
      ['springK', 'Пружины', 5, 80, 1, 30, 'Как сильно соседи едут за перетаскиваемым'],
      ['repel', 'Отталкивание', 0, 2, 0.01, 1]
    ] },
    init: function (ctx) { rebuild(ctx); },
    draw: draw,
    structural: function (ctx, path) { if (path === 'loans' || path === 'tilt') rebuild(ctx); },
    svg: function (ctx) { return R.export.svg(ctx); }
  };
  window.__orbit = { get graph() { return G; }, get model() { return M; }, pick: function (x, y) { return pick(x, y); } };
})();
