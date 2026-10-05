// desk v3 · «Осьминог»: тело-диск «Loan book» с одним числом (hero) в центре, из него семь
// изогнутых щупалец. По щупальцу идут бусины-диски с данными (чем ближе к телу, тем крупнее),
// на кончике лист-виджет. Под водой: волна бежит от тела к кончику (сдвиг фазы по звену),
// гармоники одного периода — цикл замкнут; щупальце S-образное, без углов.
(function () {
  var K = window.RINK, Wd = window.WIDGETS, D = Wd.D, TAU = Math.PI * 2;

  // тело: hero на диске
  function body(g, F, I, w) {
    var k = D().kpi, s = D().series, r = w / 2, num = K.eur(k.exposure);
    var px = K.fit(g, F, num, r * 1.5, r * 0.36, { mono: true, weight: 500, min: 14 });
    K.text(g, F, 'Loan book · exposure', 0, -px * 0.75, { size: 1, caps: true, weight: 500, color: I.ink3, align: 'center', min: 7 });
    K.text(g, F, num, 0, px * 0.34, { px: px, mono: true, weight: 500, color: I.ink, align: 'center' });
    K.text(g, F, '+' + K.pct(s.exposure[11] / s.exposure[0] - 1) + ' in 12 months', 0, px * 0.34 + 20 * F.ui, { size: 1, mono: true, color: I.ink2, align: 'center', min: 7 });
    K.dot(g, 0, px * 0.34 + 34 * F.ui, Math.max(2.5, 3.5 * F.ui), I.acc);
  }
  function arms() {
    var d = D(), s = d.series, b = d.breakdown, k = d.kpi, dc = d.decisions[0];
    var q = [2, 5, 8, 11];
    return [
      { tip: 'gate', beads: dc.checks.map(function (c) { return { label: c.ref.split(' ')[0], value: c.result === 'pass' ? '✓' : c.result === 'missing' ? 'missing' : 'needs', acc: c.result === 'missing' }; }) },
      { tip: 'bars', beads: q.map(function (i) { return { label: K.month(s.months[i]), value: K.eur(s.exposure[i], 0) }; }) },
      { tip: null, stages: b.children },
      { tip: null, agents: d.agents },
      { tip: 'npl', beads: [{ label: 'Oct', value: K.pct(s.nplShareByCount[0]) }, { label: 'Mar', value: K.pct(s.nplShareByCount[5]) }] },
      { tip: 'rule', beads: [{ label: 'limit', value: '€10k' }] },
      { tip: 'counts', beads: [{ label: 'borrowers', value: String(k.borrowers) }, { label: 'collateral', value: String(k.collateral) }] }
    ];
  }

  function model(F, P) {
    var W = F.W, H = F.H, S = Math.min(W, H), cx = W / 2, cy = H / 2, sp = +P.spread, unit = 0.26 * S;
    var RX = (W / 2 - F.m) * sp, RY = (H / 2 - F.m) * sp, chain = [], nodes = [], arm = [];
    var br = 0.12 * S;
    var b0 = { id: 'body', shape: 'disc', w: 2 * br, h: 2 * br, z: 3, print: body, env: 'settle',
      info: ['Loan book', K.eur(D().kpi.exposure), D().kpi.loans + ' loans', 'EL ' + K.eur(D().kpi.expectedLoss)] };
    chain.push({ id: 'body', rest: [0, 0], amp: 0 }); nodes.push(b0);
    var A = arms(), n = A.length;
    A.forEach(function (a, i) {
      var th = -Math.PI / 2 + 0.3 + i * TAU / n, curl = (i % 2 ? 1 : -1) * 0.36;
      var items = [];
      if (a.stages) {
        var vmax = a.stages[0].value;
        a.stages.forEach(function (c, j) { var r = Math.max(10, 0.075 * S * Math.sqrt(c.value / vmax)); items.push({ id: 'st' + j, r: r, data: c, kind: 'stage', z: j === 2 ? 2 : 1 }); });
      } else if (a.agents) {
        var states = ['work', 'idle', 'idle', 'wait', 'done'];
        a.agents.forEach(function (ag, j) { items.push({ id: 'ag' + j, r: 0.03 * S, data: ag, state: states[j], kind: 'agent', z: j === 3 ? 2 : 1 }); });
      } else {
        a.beads.forEach(function (bd, j) { items.push({ id: 't' + i + 'b' + j, r: (0.034 - 0.004 * j) * S, bead: bd, kind: 'bead', z: 1 }); });
      }
      var sh = a.tip ? Wd.SHEETS.filter(function (s) { return s.id === a.tip; })[0] : null, sw = 0, shh = 0;
      if (sh) { var area = unit * unit * sh.w * 0.95; sw = Math.sqrt(area * sh.ar); shh = sw / sh.ar; }
      // длина щупальца: кончик на эллипсе кадра; звенья S-образно: кривизна меняет знак к середине
      var target = Math.hypot(Math.cos(th) * (RX - sw / 2), Math.sin(th) * (RY - shh / 2)) * (sh ? 0.86 : 0.8);
      var segs = items.length + (sh ? 1 : 0), dirs = [], acc = th;
      for (var j = 0; j < segs; j++) { acc += curl * (j < segs / 2 ? 1 : -1.3); dirs.push(acc); }
      var ex = 0, ey = 0; dirs.forEach(function (d) { ex += Math.cos(d); ey += Math.sin(d); });
      var L = (target - br) / Math.max(0.5, Math.hypot(ex, ey));
      var prev = 'body', ids = ['body'];
      var start = [Math.cos(th) * br * 0.9, Math.sin(th) * br * 0.9];
      items.forEach(function (it, j) {
        var d = dirs[j], rest = [Math.cos(d) * L + (j === 0 ? start[0] : 0), Math.sin(d) * L + (j === 0 ? start[1] : 0)];
        chain.push({ id: it.id, parent: prev, rest: rest, amp: 3 + j * 1.6, lag: 0.9 * (j + 1) });
        var nd = { id: it.id, shape: 'disc', w: 2 * it.r, h: 2 * it.r, z: it.z };
        if (it.kind === 'stage') { nd.data = it.data; nd.print = Wd.W.stage(nd); nd.info = [it.data.label, K.eur(it.data.value), it.data.count + ' loans']; }
        else if (it.kind === 'agent') { nd.data = it.data; nd.state = it.state; nd.print = Wd.W.agent(nd); nd.info = [it.data.id + ' · ' + it.data.name, it.data.job]; }
        else { nd.print = Wd.W.bead(it.bead.label, it.bead.value); nd.info = [it.bead.label + ' · ' + it.bead.value]; if (it.bead.acc) nd.accDot = true; }
        nodes.push(nd); ids.push(it.id); prev = it.id;
      });
      if (sh) {
        var d2 = dirs[segs - 1], rest2 = [Math.cos(d2) * (L + Math.min(sw, shh) * 0.62) + (items.length ? 0 : start[0]), Math.sin(d2) * (L + Math.min(sw, shh) * 0.62) + (items.length ? 0 : start[1])];
        chain.push({ id: a.tip, parent: prev, rest: rest2, amp: 4 + items.length * 1.6, lag: 0.9 * (items.length + 1) });
        nodes.push({ id: a.tip, shape: 'sheet', w: sw, h: shh, z: a.tip === 'gate' || a.tip === 'bars' ? 2 : 1, rot0: (i % 2 ? 1 : -1), print: sh.print, info: sh.info() });
        ids.push(a.tip);
      }
      arm.push(ids);
    });
    return { cx: cx, cy: cy, chain: chain, nodes: nodes, arms: arm };
  }

  var CACHE = { key: '', m: null };
  ORG.run({
    id: 'desk', title: 'desk', blurb: 'Dashboard as an octopus: one number in the body, data beads along the tentacles',
    hint: 'Drag a sheet or a bead: the tentacle follows on springs. Hover lifts, click focuses, wheel zooms, drag the floor to pan.',
    rows: {},
    pose: function (ctx, F, t) {
      var P = ctx.P, key = [F.W, F.H, P.spread].join('|');
      if (CACHE.key !== key) { CACHE.key = key; CACHE.m = model(F, P); }
      var M = CACHE.m, pos = ORG.fk(M.chain, t, P, ctx.seed, [M.cx, M.cy]);
      var tEnd = P.assemble ? 0.08 * (M.nodes.length - 1) + 0.52 : 0;
      var nodes = M.nodes.map(function (n) {
        var p = pos[n.id], o = Object.assign({}, n);
        o.x = p.x; o.y = p.y;
        o.rot = n.shape === 'sheet' ? (n.rot0 || 0) * (+P.tilt) * Math.PI / 180 + p.tilt + p.sw * 0.4 : 0;
        o.env = n.env === 'settle' ? window.RELIEF.motion.settle(t, tEnd + 1.2, +P.settle) : 1;
        return o;
      });
      var links = [];
      M.arms.forEach(function (ids) { links = links.concat(ORG.chainLinks(pos, ids, 'tentacle', { alpha: 0.6 })); });
      return {
        root: 'body', nodes: nodes, links: links, key: 'octopus',
        floor: function (g, Fr) {
          var I = Fr.I;
          K.text(g, Fr, 'Loan book', F.m, F.m + 20 * Fr.ui, { size: 5, weight: 600, color: I.ink, min: 10 });
          K.text(g, Fr, 'desk · octopus', F.m, F.m + 40 * Fr.ui, { size: 1, mono: true, color: I.ink3, min: 7 });
          K.text(g, Fr, 'Fictional data · as of 30 Sep 2026', F.W - F.m, F.H - F.m * 0.5, { size: 1, mono: true, color: I.ink3, align: 'right', min: 7 });
        }
      };
    }
  }, { variant: 'v3', name: 'octopus', defaults: { tilt: 6, wind: 1.3, tension: 0.6 } });
})();
