// ledger v3 · «Пузыри»: книга по сегментам и стадиям языком «Satellites network» (README §2.2 B).
// Хаб «Book» в центре; лучи веером к четырём сегментам; дистанция до хаба = доля сегмента в книге,
// площадь пузыря = экспозиция; от каждого сегмента веер стадий (дистанция = доля стадии в сегменте).
// На лучах засечки каждые 10 % доли; между семьями воздух ≥ 7°; встроенная легенда How to read.
// Связи — прямые лучи веером (без углов), всё качается от своей точки подвеса. T = лист-таблица.
(function () {
  var K = window.RINK, LG = window.LEDGER, TAU = Math.PI * 2, D2R = Math.PI / 180;

  function model(F, P, table) {
    var W = F.W, H = F.H, S = Math.min(W, H), cx = W / 2 + 0.03 * W, cy = H / 2 + 0.02 * H, sp = +P.spread;
    var book = window.RELIEF_DATA.breakdown, segs = LG.bySegment(), u = S / 48;
    var rmax = 0.1 * S, vmax = segs[0].value, chain = [], nodes = [], links = [];
    var rh = 0.07 * S;
    nodes.push({ id: 'hub', shape: 'disc', w: 2 * rh, h: 2 * rh, z: 2, print: hubPrint, info: ['Book', K.eur(book.value), book.count + ' loans'] });
    chain.push({ id: 'hub', rest: [0, 0], amp: 0 });
    var L1 = 0.2 * S * sp, L2 = 0.75 * L1;
    // сектор семьи ∝ объём^0.3 (асимметрия по правилу, а не крест), зазор между семьями 7°, старт −90° + 137,5°
    var w = segs.map(function (sg) { return Math.pow(sg.value, 0.3); }), tw = w.reduce(function (a, b) { return a + b; }, 0);
    var gap = 7 * D2R, avail = TAU - gap * segs.length, a = -Math.PI / 2 + 137.5 * D2R;
    segs.forEach(function (sg, i) {
      var sec = avail * w[i] / tw, mid = a + sec / 2; a += sec + gap;
      var share = sg.value / book.value, r = Math.max(8, rmax * Math.sqrt(sg.value / vmax));
      var smax = segs[0].value / book.value, len = rh + r + u + L1 * share / smax;
      var id = 's' + i;
      chain.push({ id: id, parent: 'hub', rest: [Math.cos(mid) * len, Math.sin(mid) * len], amp: 1.6, lag: i * 0.7 });
      nodes.push({ id: id, shape: 'disc', w: 2 * r, h: 2 * r, z: 2, print: segPrint(sg), info: [sg.label, K.eur(sg.value), sg.count + ' loans', K.pct(share) + ' of book'] });
      links.push({ a: 'hub', b: id, ticks: ticks(share, L1 / smax, len) });
      // веер стадий внутри сектора: ±min(60°, сектор/2)
      var fan = Math.min(60 * D2R, sec / 2), kids = sg.children.slice().sort(function (p, q) { return q.value - p.value; });
      kids.forEach(function (c, j) {
        var sh2 = c.value / sg.value, rr = Math.max(5, rmax * 0.62 * Math.sqrt(c.value / vmax));
        var ang = mid + (kids.length > 1 ? -fan + 2 * fan * j / (kids.length - 1) : 0) * (j % 2 ? -1 : 1) * 0.9;
        var l2 = r + rr + u + L2 * sh2;
        var cid = id + 'c' + j, npl = c.label === 'non-performing';
        chain.push({ id: cid, parent: id, rest: [Math.cos(ang) * l2, Math.sin(ang) * l2], amp: 3.5, lag: i * 0.7 + 1 + j * 0.3 });
        nodes.push({ id: cid, shape: 'disc', w: 2 * rr, h: 2 * rr, z: npl ? 1 : 1, mark: npl, print: stagePrint(c),
          info: [sg.label + ' · ' + c.label, K.eur(c.value), c.count + ' loans', K.pct(sh2) + ' of segment'] });
        links.push({ a: id, b: cid, ticks: ticks(sh2, L2, l2) });
      });
    });
    if (table) { chain.push({ id: 'table', parent: 'hub', rest: [-0.33 * W, -0.22 * H], amp: 0.5 }); nodes.push(LG.tableNode(F, S)); links.push({ a: 'hub', b: 'table' }); }
    return ORG.fitModel({ cx: cx, cy: cy, chain: chain, nodes: nodes, links: links }, F, null, 1.2);
  }
  // засечки каждые 10 % доли вдоль луча (в долях длины луча)
  function ticks(share, Lunit, len) { var out = []; for (var k = 1; k * 0.1 <= share + 1e-9 && k < 12; k++) out.push(1 - (share - k * 0.1) * Lunit / len); return out.filter(function (f) { return f > 0.05 && f < 0.98; }); }
  function hubPrint(g, F, I, w) {
    var b = window.RELIEF_DATA.breakdown, r = w / 2, num = K.eur(b.value);
    var px = K.fit(g, F, num, r * 1.5, r * 0.42, { mono: true, weight: 500, min: 10 });
    K.text(g, F, 'Book', 0, -px * 0.7, { size: 1, caps: true, weight: 500, color: I.ink3, align: 'center', min: 7 });
    K.text(g, F, num, 0, px * 0.34, { px: px, mono: true, weight: 500, color: I.ink, align: 'center' });
  }
  function segPrint(sg) {
    return function (g, F, I, w) {
      var r = w / 2, v = K.eur(sg.value), px = K.fit(g, F, v, r * 1.4, r * 0.42, { mono: true, weight: 500, min: 8 });
      K.text(g, F, v, 0, px * 0.34, { px: px, mono: true, weight: 500, color: I.ink, align: 'center' });
      if (K.measure(g, F, sg.label, { size: 1, min: 7 }) < r * 1.7) K.text(g, F, sg.label, 0, -px * 0.62, { size: 1, color: I.ink3, align: 'center', min: 7 });
    };
  }
  function stagePrint(c) {
    return function (g, F, I, w, h, n) {
      if (n.mark) K.dot(g, 0, 0, Math.max(2.5, Math.min(w * 0.18, 3.5 * F.ui)), I.acc);
      else if (w > 40 * F.ui) { var v = K.eur(c.value), px = K.fit(g, F, v, w * 0.7, w * 0.3, { mono: true, weight: 500, min: 7 }); K.text(g, F, v, 0, px * 0.34, { px: px, mono: true, weight: 500, color: I.ink2, align: 'center' }); }
    };
  }

  var CACHE = { key: '', m: null };
  ORG.run({
    id: 'ledger', title: 'ledger', blurb: 'Ordinary charts as organisms: bubbles of the book by segment and stage',
    hint: 'Area = exposure, distance from the root = share. Ticks every 10 %. Drag a bubble, hover for numbers, T for the table.',
    rows: { data: [['labelsL', 'Подписи', ['none', 'key', 'all'], 'key', ['Нет', 'Ключевые', 'Все']]] },
    hotkeys: { t: LG.tableToggle },
    pose: function (ctx, F, t) {
      var P = ctx.P, key = [F.W, F.H, P.spread, !!ctx._table].join('|');
      if (CACHE.key !== key) { CACHE.key = key; CACHE.m = model(F, P, !!ctx._table); }
      var M = CACHE.m, pos = ORG.fk(M.chain, t, P, ctx.seed, [M.cx, M.cy]);
      var nodes = M.nodes.map(function (n) {
        var p = pos[n.id], o = Object.assign({}, n);
        o.x = p.x; o.y = p.y; o.rot = n.shape === 'sheet' ? (+P.tilt) * Math.PI / 360 + p.tilt : 0;
        return o;
      });
      // лучи прямые: касательные по линии центров (ровный веер, как у референса)
      var links = M.links.map(function (l) { return { a: l.a, b: l.b, kind: 'thread', alpha: 0.55, ticks: l.ticks }; });
      return {
        root: 'hub', nodes: nodes, links: links, key: 'bubbles' + !!ctx._table,
        floor: function (g, Fr) {
          var I = Fr.I;
          LG.header(g, Fr, I, 'Book by segment and stage', 'ledger · bubbles', F.m, F.W, F.H);
          LG.howTo(g, Fr, I, F.m, F.H - F.m - 64 * Fr.ui, ['Bubble area = exposure', 'Distance from the root = share of the parent', 'Ticks every 10 % of share', 'Dot = non-performing']);
        },
        floorTop: function (g, Fr, F0, byScr) {
          var I = Fr.I;
          if (P.labelsL === 'none') return;
          // подписи стадий у ключевых пузырей: снаружи по лучу (направление от сегмента наружу)
          M.nodes.forEach(function (n) {
            if (!/c\d$/.test(n.id)) return;
            var s = byScr[n.id], pr = byScr[n.id.replace(/c\d$/, '')];
            if (!s || !pr || (P.labelsL === 'key' && s.sw < 30 * Fr.ui && !n.mark)) return;
            var d = ORG.unit([pr.sx, pr.sy], [s.sx, s.sy]), x = s.sx + d[0] * (s.sw / 2 + 8 * Fr.ui), y = s.sy + d[1] * (s.sw / 2 + 8 * Fr.ui) + 4 * Fr.ui;
            K.text(g, Fr, n.info[0].split(' · ')[1], x, y, { size: 1, color: I.ink3, align: d[0] > 0.2 ? 'left' : d[0] < -0.2 ? 'right' : 'center', min: 7 });
          });
        }
      };
    }
  }, { variant: 'v3', name: 'bubbles', defaults: { tilt: 4, wind: 1, tension: 0.95 } });
})();
