// ledger v1 · «Цветок»: двенадцать месяцев лепестками вокруг диска-числа. Лепесток = столбец-пилюля
// целиком скруглённая, длина от общего круга-основания r0 ∝ экспозиции (ноль на r0, честно);
// на кончике тычинка-пузырь: площадь = возвраты месяца. Сетка кругами вырезана под лепестками.
// Цветок дышит: лепестки качаются от сердцевины, тычинки сильнее. T = лист-таблица.
(function () {
  var K = window.RINK, LG = window.LEDGER, TAU = Math.PI * 2;

  function model(F, P, table) {
    var W = F.W, H = F.H, S = Math.min(W, H), cx = W / 2, cy = H / 2 + 0.01 * H, sp = +P.spread;
    var s = LG.series(), n = s.months.length, chain = [], nodes = [], links = [];
    var rc = 0.11 * S, r0 = rc + 0.03 * S, Lmax = (0.34 * S - r0) * sp, vmax = 2.5e8;
    var recMax = Math.max.apply(null, s.recovered);
    nodes.push({ id: 'core', shape: 'disc', w: 2 * rc, h: 2 * rc, z: 2, print: core, info: ['Exposure Sep 2026', K.eur(s.exposure[n - 1]), '+' + K.pct(s.exposure[n - 1] / s.exposure[0] - 1) + ' in 12 months'] });
    chain.push({ id: 'core', rest: [0, 0], amp: 0 });
    var pw = Math.min(0.062 * S, (TAU * r0 / n) * 0.62);
    s.exposure.forEach(function (v, i) {
      var a = -Math.PI / 2 + TAU * (i + 0.5) / n, len = Lmax * v / vmax, c = r0 + len / 2;
      var id = 'm' + i, rb = 0.012 * S + 0.03 * S * Math.sqrt(s.recovered[i] / recMax);
      chain.push({ id: id, parent: 'core', rest: [Math.cos(a) * c, Math.sin(a) * c], amp: 1.2, lag: i * 0.5 });
      nodes.push({ id: id, shape: 'pill', w: pw, h: len, z: i === n - 1 ? 2 : 1, rotBase: a + Math.PI / 2, mark: i === n - 1, print: petal(i, len),
        info: [K.month(s.months[i]) + ' ' + s.months[i].slice(0, 4), 'Exposure ' + K.eur(v), 'Recovered ' + K.eur(s.recovered[i]), 'NPL ' + K.pct(s.npl[i])] });
      var tipd = len / 2 + rb + 0.012 * S;
      chain.push({ id: 'r' + i, parent: id, rest: [Math.cos(a) * tipd, Math.sin(a) * tipd], amp: 4, lag: i * 0.5 + 1 });
      nodes.push({ id: 'r' + i, shape: 'disc', w: 2 * rb, h: 2 * rb, z: 1, print: rb > 13 * F.ui ? bead(K.eur(s.recovered[i])) : null,
        info: ['Recovered ' + K.month(s.months[i]), K.eur(s.recovered[i])] });
      links.push({ a: 'core', b: id, kind: 'stem', alpha: 0.6 });
      links.push({ a: id, b: 'r' + i, kind: 'thread', alpha: 0.45 });
    });
    if (table) { var t = LG.tableNode(F, S); chain.push({ id: 'table', parent: 'core', rest: [0.3 * S, -0.02 * S], amp: 0.6 }); nodes.push(t); links.push({ a: 'core', b: 'table', kind: 'thread' }); }
    var M = ORG.fitModel({ cx: cx, cy: cy, chain: chain, nodes: nodes, links: links, vmax: vmax }, F, null, 1.1);
    M.r0 = r0 * M.k; M.Lmax = Lmax * M.k; M.rc = rc * M.k;
    return M;
  }
  function core(g, F, I, w) {
    var s = LG.series(), n = s.months.length, r = w / 2, num = K.eur(s.exposure[n - 1]);
    var px = K.fit(g, F, num, r * 1.5, r * 0.4, { mono: true, weight: 500, min: 12 });
    K.text(g, F, 'Exposure · Sep', 0, -px * 0.7, { size: 1, caps: true, weight: 500, color: I.ink3, align: 'center', min: 7 });
    K.text(g, F, num, 0, px * 0.34, { px: px, mono: true, weight: 500, color: I.ink, align: 'center' });
    K.text(g, F, '12 months', 0, px * 0.34 + 18 * F.ui, { size: 1, mono: true, color: I.ink2, align: 'center', min: 7 });
  }
  function petal(i, len) {
    return function(g,F,I,w,h,n){var s=LG.series(),str=K.month(s.months[i])+' · '+K.eur(s.exposure[i]);g.save();g.rotate(-Math.PI/2);if(Math.sin(n.rot||0)<0)g.rotate(Math.PI);g.textAlign='center';g.textBaseline='middle';g.fillStyle=I.ink;var px=Math.min(12,w*.30);g.font='400 '+px+'px Geist';var scale=Math.min(1,(h-w*.55)/Math.max(1,g.measureText(str).width));g.font='400 '+px*scale+'px Geist';g.fillText(str,0,0);g.restore();};
  }
  function bead(v) { return function (g, F, I, w) { var px = K.fit(g, F, v, w * 0.7, w * 0.3, { mono: true, weight: 500, min: 7 }); K.text(g, F, v, 0, px * 0.34, { px: px, mono: true, weight: 500, color: I.ink2, align: 'center' }); if (K.measure(g, F, 'recovered', {size:1,min:7}) < w * 0.8) K.text(g, F, 'recovered', 0, -px * 0.8, {size:1,min:7,color:I.ink3,align:'center'}); }; }

  var CACHE = { key: '', m: null };
  ORG.run({
    id: 'ledger', title: 'ledger', blurb: 'Ordinary charts as organisms: a flower of twelve monthly petals',
    hint: 'Petal length = exposure, stamen area = recoveries. Drag a petal, hover for numbers, T for the table.',
    rows: { data: [['labelsL', 'Подписи', ['none', 'key', 'all'], 'key', ['Нет', 'Ключевые', 'Все']]] },
    hotkeys: { t: LG.tableToggle },
    pose: function (ctx, F, t) {
      var P = ctx.P, key = [F.W, F.H, P.spread, !!ctx._table].join('|');
      if (CACHE.key !== key) { CACHE.key = key; CACHE.m = model(F, P, !!ctx._table); }
      var M = CACHE.m, pos = ORG.fk(M.chain, t, P, ctx.seed, [M.cx, M.cy]);
      var nodes = M.nodes.map(function (n) {
        var p = pos[n.id], o = Object.assign({}, n);
        o.x = p.x; o.y = p.y;
        o.rot = n.rotBase != null ? n.rotBase + p.ang : n.shape === 'sheet' ? (+P.tilt) * Math.PI / 360 + p.tilt : 0;
        return o;
      });
      var links = M.links.map(function (l) { return { a: l.a, b: l.b, kind: l.kind, alpha: l.alpha }; });
      return {
        root: 'core', nodes: nodes, links: links, key: 'flower' + !!ctx._table,
        floor: function (g, Fr) {
          var I = Fr.I, s = LG.series();
          LG.header(g, Fr, I, 'Exposure by month', 'ledger · flower', F.m, F.W, F.H);
          // сетка кругами под лепестками: 0 на круге-основании, шаг €50M
          [0, 5e7, 1e8, 1.5e8, 2e8, 2.5e8].forEach(function (v, k) {
            var rr = M.r0 + M.Lmax * v / M.vmax;
            K.relief(g, Fr, function (q, ox, oy) { q.moveTo(M.cx + rr + ox, M.cy + oy); q.arc(M.cx + ox, M.cy + oy, rr, 0, TAU); }, k ? 0.7 : 1);
            if (k && P.labelsL !== 'none') K.text(g, Fr, '€' + (v / 1e6) + 'M', M.cx + 4 * Fr.ui, M.cy - rr - 3 * Fr.ui, { size: 1, mono: true, color: I.ink3, min: 7 });
          });
          // Quarter boundaries make the year readable without changing the encoded lengths.
          for(var q=0;q<4;q++){var a=-Math.PI/2+q*TAU/4,ri=M.r0+M.Lmax+24*Fr.ui,ro=ri+12*Fr.ui;g.save();g.strokeStyle=I.ink3;g.globalAlpha=.24;g.lineWidth=.7;g.beginPath();g.moveTo(M.cx+Math.cos(a)*ri,M.cy+Math.sin(a)*ri);g.lineTo(M.cx+Math.cos(a)*ro,M.cy+Math.sin(a)*ro);g.stroke();g.restore();}
          // месяцы снаружи
          s.months.forEach(function (m, i) {
            if (P.labelsL === 'none') return;
            var a = -Math.PI / 2 + TAU * (i + 0.5) / s.months.length, rr = M.r0 + M.Lmax * 0.84 + 0.1 * Math.min(F.W, F.H);
            var al = Math.cos(a) > 0.2 ? 'left' : Math.cos(a) < -0.2 ? 'right' : 'center';
            K.text(g, Fr, K.month(m) + (i === 0 || m.slice(5) === '01' ? ' ' + m.slice(2, 4) : ''), M.cx + Math.cos(a) * rr, M.cy + Math.sin(a) * rr + 4 * Fr.ui, { size: 1, mono: true, color: I.ink2, align: al, min: 7 });
          });
          LG.howTo(g, Fr, I, F.m, F.H - F.m - 56 * Fr.ui, ['Petal length from the inner ring = exposure', 'Stamen area = recoveries that month', 'Dot = as of 30 Sep 2026']);
        }
      };
    }
  }, { variant: 'v1', name: 'flower', defaults: { tilt: 1, wind: .25, tension: .7, assemble:0, parallax:0, dens:.12 } });
})();
