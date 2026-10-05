// ledger v2 · «Лоза»: линейный чарт как растение. Лоза идёт от корня «Loan book» через двенадцать
// месяцев: высота точки = экспозиция (одна ось, сетка вырезана под плашками), пузырь на узле =
// возвраты месяца (площадь = сумма). На кварталах от лозы отходят листья-итоги. Ветер бежит по лозе
// от корня к концу (сдвиг фазы по звену), амплитуда малая: данные стоят на месте, лоза живёт.
(function () {
  var K = window.RINK, LG = window.LEDGER, TAU = Math.PI * 2;

  function model(F, P, table) {
    var W = F.W, H = F.H, S = Math.min(W, H), s = LG.series(), n = s.months.length;
    var x0 = F.m + 0.1 * W, x1 = W - F.m - 0.04 * W, yT = F.m + 0.22 * H, yB = H - F.m - 0.18 * H;
    var lo = 1.8e8, hi = 2.05e8, X = function (i) { return x0 + (x1 - x0) * i / (n - 1); }, Y = function (v) { return yB - (yB - yT) * (v - lo) / (hi - lo); };
    var recMax = Math.max.apply(null, s.recovered), chain = [], nodes = [], links = [];
    var rx = x0 - 0.075 * W, ry = yB + 0.05 * H, rr = 0.055 * S;
    nodes.push({ id: 'root', shape: 'disc', w: 2 * rr, h: 2 * rr, z: 2, print: rootPrint, info: ['Loan book', '12 months of exposure'] });
    chain.push({ id: 'root', rest: [0, 0], amp: 0 });
    var px = rx, py = ry, prev = 'root', ids = ['root'];
    s.exposure.forEach(function (v, i) {
      var x = X(i), y = Y(v), id = 'm' + i, rb = 0.014 * S + 0.032 * S * Math.sqrt(s.recovered[i] / recMax);
      chain.push({ id: id, parent: prev, rest: [x - px, y - py], amp: 0.22, lag: 0.45 * (i + 1) });
      nodes.push({ id: id, shape: 'disc', w: 2 * rb, h: 2 * rb, z: i === n - 1 ? 2 : 1, mark: i === n - 1, print: bubble(i),
        info: [K.month(s.months[i]) + ' ' + s.months[i].slice(0, 4), 'Exposure ' + K.eur(v), 'Recovered ' + K.eur(s.recovered[i]), 'NPL ' + K.pct(s.npl[i])] });
      ids.push(id); prev = id; px = x; py = y;
    });
    // листья кварталов: на ножке вверх или вниз от узла лозы, по очереди
    [2, 5, 8, 11].forEach(function (i, q) {
      var up = q % 2 === 0, w = 0.17 * S, h = 0.12 * S, dy = (up ? -1 : 1) * (0.11 * S + h / 2), dx = q === 3 ? -0.1 * S : (q % 2 ? 1 : -1) * 0.03 * S;
      chain.push({ id: 'q' + q, parent: 'm' + i, rest: [dx, dy], amp: 3.5, lag: 0.45 * (i + 1) + 0.8 });
      nodes.push({ id: 'q' + q, shape: 'sheet', w: w, h: h, z: q === 3 ? 3 : 2, rot0: up ? -1 : 1, print: quarter(i), info: ['Quarter to ' + K.month(s.months[i]), K.eur(s.exposure[i])] });
      links.push({ a: 'm' + i, b: 'q' + q, kind: 'stem', bend: (up ? -1 : 1) * 0.35 });
    });
    if (table) { chain.push({ id: 'table', parent: 'root', rest: [0.35 * W, -0.42 * H], amp: 0.5 }); nodes.push(LG.tableNode(F, S)); links.push({ a: 'root', b: 'table', kind: 'thread', bend: 0.2 }); }
    return { chain: chain, nodes: nodes, vine: ids, links: links, rx: rx, ry: ry, X: X, Y: Y, x0: x0, x1: x1, yT: yT, yB: yB, lo: lo, hi: hi };
  }
  function rootPrint(g, F, I, w) {
    var r = w / 2; K.text(g, F, 'Loan', 0, -r * 0.08, { size: 1, caps: true, weight: 500, color: I.ink3, align: 'center', min: 7 });
    K.text(g, F, 'book', 0, r * 0.3, { size: 1, caps: true, weight: 500, color: I.ink3, align: 'center', min: 7 });
  }
  function bubble(i) {
    return function (g, F, I, w, h, n) {
      var s = LG.series(), v = K.eur(s.recovered[i]);
      if (w > 34 * F.ui) { var px = K.fit(g, F, v, w * 0.72, w * 0.3, { mono: true, weight: 500, min: 7 }); K.text(g, F, v, 0, px * 0.34, { px: px, mono: true, weight: 500, color: I.ink2, align: 'center' }); }
      if (n.mark) K.dot(g, 0, w * 0.3, Math.max(2.5, 3 * F.ui), I.acc);
    };
  }
  function quarter(i) {
    return function (g, F, I, w, h) {
      var s = LG.series(), p = Math.max(6, 11 * F.ui), q0 = i - 2;
      K.text(g, F, K.month(s.months[q0]) + '–' + K.month(s.months[i]), -w / 2 + p, -h / 2 + p + 8 * F.ui, { size: 1, caps: true, weight: 500, color: I.ink3, min: 7 });
      var num = K.eur(s.exposure[i]), px = K.fit(g, F, num, w - 2 * p, h * 0.32, { mono: true, weight: 500, min: 9 });
      K.text(g, F, num, -w / 2 + p, -h / 2 + p + 14 * F.ui + px * 0.85, { px: px, mono: true, weight: 500, color: I.ink });
      var rec = s.recovered[q0] + s.recovered[q0 + 1] + s.recovered[i];
      K.text(g, F, 'rec ' + K.eur(rec) + ' · NPL ' + K.pct(s.npl[i]), -w / 2 + p, h / 2 - p, { px: Math.min(K.px(F, 1), K.fit(g, F, 'rec ' + K.eur(rec) + ' · NPL ' + K.pct(s.npl[i]), w - 2 * p, 99, { mono: true, min: 7 })), mono: true, color: I.ink2 });
    };
  }

  var CACHE = { key: '', m: null };
  ORG.run({
    id: 'ledger', title: 'ledger', blurb: 'Ordinary charts as organisms: a vine through twelve months',
    hint: 'Height = exposure, bubble area = recoveries, leaves = quarters. Drag a node: the vine follows. T for the table.',
    rows: { data: [['labelsL', 'Подписи', ['none', 'key', 'all'], 'key', ['Нет', 'Ключевые', 'Все']]] },
    hotkeys: { t: LG.tableToggle },
    pose: function (ctx, F, t) {
      var P = ctx.P, key = [F.W, F.H, !!ctx._table].join('|');
      if (CACHE.key !== key) { CACHE.key = key; CACHE.m = model(F, P, !!ctx._table); }
      var M = CACHE.m, pos = ORG.fk(M.chain, t, P, ctx.seed, [M.rx, M.ry]);
      var nodes = M.nodes.map(function (n) {
        var p = pos[n.id], o = Object.assign({}, n);
        o.x = p.x; o.y = p.y; o.rot = n.shape === 'sheet' ? (n.rot0 || 0) * (+P.tilt) * Math.PI / 180 + p.tilt + p.sw * 0.5 : 0;
        return o;
      });
      var links = ORG.chainLinks(pos, M.vine, 'stem').concat(M.links.map(function (l) {
        var a = pos[l.a], b = pos[l.b], u = ORG.unit([a.x, a.y], [b.x, b.y]);
        return { a: l.a, b: l.b, kind: l.kind, ta: ORG.rot(u, l.bend || 0), tb: ORG.rot(u, -(l.bend || 0)) };
      }));
      return {
        root: 'root', nodes: nodes, links: links, key: 'vine' + !!ctx._table,
        floor: function (g, Fr) {
          var I = Fr.I, s = LG.series();
          LG.header(g, Fr, I, 'Exposure and recoveries', 'ledger · vine', F.m, F.W, F.H);
          // одна ось: сетка вырезана под плашками, шаг €5M
          for (var v = M.lo; v <= M.hi + 1; v += 5e6) {
            var y = M.Y(v);
            K.relief(g, Fr, function (q, ox, oy) { q.moveTo(M.x0 - 10 * Fr.ui + ox, y + oy); q.lineTo(M.x1 + 10 * Fr.ui + ox, y + oy); }, 0.75);
            if (P.labelsL !== 'none') K.text(g, Fr, '€' + (v / 1e6).toFixed(0) + 'M', M.x0 - 16 * Fr.ui, y + 4 * Fr.ui, { size: 1, mono: true, color: I.ink3, align: 'right', min: 7 });
          }
          s.months.forEach(function (m, i) {
            if (P.labelsL === 'none' || (P.labelsL === 'key' && i % 3 !== 2 && i !== 0)) return;
            K.text(g, Fr, K.month(m) + (i === 0 || m.slice(5) === '01' ? ' ' + m.slice(2, 4) : ''), M.X(i), M.yB + 0.12 * F.H, { size: 1, mono: true, color: I.ink2, align: 'center', min: 7 });
          });
          LG.howTo(g, Fr, I, F.W - F.m - 230 * Fr.ui, F.m + 8 * Fr.ui, ['Height of a node = exposure (one axis)', 'Bubble area = recoveries that month', 'Leaves = quarter totals']);
        }
      };
    }
  }, { variant: 'v2', name: 'vine', defaults: { tilt: 5, wind: 1, tension: 0.6 } });
})();
