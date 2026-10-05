// desk v1 · «Люстра»: hero (desk v2 «Loan book», принятый владельцем) доведён до подвешенных листов.
// Сверху видна подвесная люстра Калдера: хаб «Loan book» в центре, от него нити-коромысла веером,
// на концах бумажные листы и диски на разной высоте. Равновесие неравных масс: тяжёлое ближе к
// подвесу (дистанция ∝ 1/√площади), лёгкое дальше. Каждое коромысло качается вокруг своей точки
// подвеса, под-люстры (стадии, агенты) — вокруг своей; листы чуть наклонены (±tilt°).
(function () {
  var K = window.RINK, Wd = window.WIDGETS, D = Wd.D, TAU = Math.PI * 2;

  function model(F, P) {
    var W = F.W, H = F.H, S = Math.min(W, H), cx = W / 2, cy = H / 2 + 0.02 * H, sp = +P.spread;
    var RX = (W / 2 - F.m) * sp, RY = (H / 2 - F.m) * sp;
    var unit = 0.3 * S, chain = [], nodes = [], links = [];
    var hub = { id: 'hub', shape: 'disc', w: 0.13 * S, h: 0.13 * S, z: 2, info: ['Loan book', '240 loans', '€200.4M'] };
    hub.print = Wd.W.bead('Loan book', '240');
    chain.push({ id: 'hub', rest: [0, 0], amp: 0 }); nodes.push(hub);
    // элементы люстры по кругу: угол по ритму «крупный · мелкий · средний · мелкий», hero слева сверху (к свету)
    var items = [
      { id: 'hero', ang: -152, f: 0.6, sheet: 'hero', z: 3, amp: 1.6 },
      { id: 'stages', ang: -38, f: 0.62, cluster: 'stages', z: 2, amp: 2.4 },
      { id: 'gate', ang: 18, f: 0.66, sheet: 'gate', z: 2, amp: 2.0 },
      { id: 'rule', ang: 62, f: 0.86, sheet: 'rule', z: 1, amp: 3.0 },
      { id: 'agents', ang: 102, f: 0.62, cluster: 'agents', z: 2, amp: 2.6 },
      { id: 'bars', ang: 136, f: 0.74, sheet: 'bars', z: 1, amp: 2.2 },
      { id: 'npl', ang: 176, f: 0.9, sheet: 'npl', z: 1, amp: 3.2 },
      { id: 'counts', ang: -92, f: 0.88, sheet: 'counts', z: 1, amp: 3.4 }
    ];
    items.forEach(function (it, i) {
      var a = it.ang * Math.PI / 180, dx = Math.cos(a) * RX * it.f, dy = Math.sin(a) * RY * it.f;
      if (it.sheet) {
        var sh = Wd.SHEETS.filter(function (s) { return s.id === it.sheet; })[0];
        var area = unit * unit * sh.w, w = Math.sqrt(area * sh.ar), h = w / sh.ar;
        if (it.id === 'hero') { w *= 1.05; h *= 1.05; }
        chain.push({ id: it.id, parent: 'hub', rest: [dx, dy], amp: it.amp });
        nodes.push({ id: it.id, shape: 'sheet', w: w, h: h, z: it.z, rot0: ((i % 2 ? 1 : -1) * (0.5 + (i % 3) * 0.25)), print: sh.print, info: sh.info(),
          env: it.id === 'hero' ? 'settle' : 1 });
        links.push({ a: 'hub', b: it.id, kind: 'thread', bend: (i % 2 ? 1 : -1) * 0.22 });
      } else if (it.cluster === 'stages') {
        // под-люстра стадий: коромысло с тремя дисками, площадь = объём, тяжёлое ближе к подвесу
        var b = D().breakdown, vmax = b.children[0].value, rmax = 0.085 * S;
        chain.push({ id: 'stages', parent: 'hub', rest: [dx, dy], amp: it.amp });
        nodes.push({ id: 'stages', shape: 'disc', w: 0.06 * S, h: 0.06 * S, z: 2, print: Wd.W.bead('stages', '3'), info: ['Book by stage', '3 stages'] });
        links.push({ a: 'hub', b: 'stages', kind: 'thread', bend: -0.18 });
        b.children.forEach(function (c, j) {
          var r = Math.max(10, rmax * Math.sqrt(c.value / vmax)), aa = a + (j - 1) * 1.05, dd = r + 0.06 * S + (j === 0 ? 0 : 0.05 * S);
          var nd = { id: 'st' + j, shape: 'disc', w: 2 * r, h: 2 * r, z: 1, data: c, info: [c.label, K.eur(c.value), c.count + ' loans', K.pct(c.value / b.value) + ' of book'] };
          nd.print = Wd.W.stage(nd);
          chain.push({ id: 'st' + j, parent: 'stages', rest: [Math.cos(aa) * dd, Math.sin(aa) * dd], amp: 4 + j });
          nodes.push(nd);
          links.push({ a: 'stages', b: 'st' + j, kind: 'thread', bend: (j - 1) * 0.3, ticks: [0.25, 0.5, 0.75] });
        });
      } else if (it.cluster === 'agents') {
        // нитка агентов: пять бусин A1–A5 веером от своей точки подвеса
        var A = D().agents, states = ['work', 'idle', 'idle', 'wait', 'done'];
        chain.push({ id: 'agents', parent: 'hub', rest: [dx, dy], amp: it.amp });
        nodes.push({ id: 'agents', shape: 'disc', w: 0.06 * S, h: 0.06 * S, z: 2, print: Wd.W.bead('agents', '5'), info: ['Five agents', 'one model of record'] });
        links.push({ a: 'hub', b: 'agents', kind: 'thread', bend: 0.2 });
        A.forEach(function (ag, j) {
          var aa = a + (j - 2) * 0.62, dd = 0.11 * S + (j % 2) * 0.045 * S, r = 0.032 * S;
          var nd = { id: 'ag' + j, shape: 'disc', w: 2 * r, h: 2 * r, z: 1, data: ag, state: states[j], info: [ag.id + ' · ' + ag.name, ag.job, 'state: ' + states[j]] };
          nd.print = Wd.W.agent(nd);
          chain.push({ id: 'ag' + j, parent: 'agents', rest: [Math.cos(aa) * dd, Math.sin(aa) * dd], amp: 5 });
          nodes.push(nd);
          links.push({ a: 'agents', b: 'ag' + j, kind: 'thread', bend: (j - 2) * 0.12 });
        });
      }
    });
    var M = { cx: cx, cy: cy, chain: chain, nodes: nodes, links: links };
    nodes[0].fixed = true;
    return ORG.fitModel(ORG.relax(M, 0.012 * S), F, null, 1.15);
  }

  var CACHE = { key: '', m: null };
  ORG.run({
    id: 'desk', title: 'desk', blurb: 'Dashboard as a hanging mobile of paper sheets and discs',
    hint: 'Drag a sheet: its neighbours follow on springs. Hover lifts, click focuses, wheel zooms, drag the floor to pan.',
    rows: { data: [['labelsL', 'Подписи', ['none', 'key', 'all'], 'key', ['Нет', 'Ключевые', 'Все']]] },
    pose: function (ctx, F, t) {
      var P = ctx.P, key = [F.W, F.H, P.spread].join('|');
      if (CACHE.key !== key) { CACHE.key = key; CACHE.m = model(F, P); }
      var M = CACHE.m, pos = ORG.fk(M.chain, t, P, ctx.seed, [M.cx, M.cy]);
      var tEnd = R_END(P, M.nodes.length);
      var nodes = M.nodes.map(function (n) {
        var p = pos[n.id], o = Object.assign({}, n);
        o.x = p.x; o.y = p.y;
        o.rot = n.shape === 'sheet' ? ((n.rot0 || 0) * (+P.tilt) * Math.PI / 180 + p.tilt + p.sw * 0.6) : 0;
        // проверенное оседает: hero (решение принято) замирает после сборки
        o.env = n.env === 'settle' ? window.RELIEF.motion.settle(t, tEnd + 1.2, +P.settle) : 1;
        return o;
      });
      var links = M.links.map(function (l) {
        var a = pos[l.a], b = pos[l.b], u = ORG.unit([a.x, a.y], [b.x, b.y]);
        return { a: l.a, b: l.b, kind: l.kind, ticks: l.ticks, ta: ORG.rot(u, l.bend), tb: ORG.rot(u, -l.bend) };
      });
      return {
        root: 'hub', nodes: nodes, links: links,
        floor: function (g, Fr) {
          var I = Fr.I, c = { x: Fr.ui * 0 + F.m, y: F.m };
          K.text(g, Fr, 'Loan book', c.x, c.y + 20 * Fr.ui, { size: 5, weight: 600, color: I.ink, min: 10 });
          K.text(g, Fr, 'Fictional data · as of 30 Sep 2026', F.W - F.m, F.H - F.m * 0.5, { size: 1, mono: true, color: I.ink3, align: 'right', min: 7 });
          if (P.labelsL !== 'none') {
            // подписи под листами: печать на полу, видна сквозь воздух между листами
            K.text(g, Fr, 'desk · mobile', c.x, c.y + 40 * Fr.ui, { size: 1, mono: true, color: I.ink3, min: 7 });
          }
        }
      };
    }
  }, { variant: 'v1', name: 'mobile', defaults: { tilt: 6, wind: 1 } });
  function R_END(P, n) { return P.assemble ? 0.08 * (n - 1) + 0.52 : 0; }
})();
