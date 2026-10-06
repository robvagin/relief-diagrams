/* stack · model of record как стопка висящих листов и дисков, разнесённых по высоте (волна 3).
   Четыре слоя по лестнице высот (L5): данные z1 → знания z1 → правила z2 → решение z3. Выше = ближе к
   решению: тень длиннее и мягче, верхние роняют тень на нижние и на пол. Выноски — лучами от слоя к подписи.
   Три варианта = три организма (RELIEF_VARIANT):
     v1 · chandelier: всё висит на нитях из одной точки, ярусы кольцами, решение у самого крюка;
     v2 · graph: решение в центре, правила, знания и данные кольцами на пружинах, связи лучами и дугами;
     v3 · flower: сердцевина-решение, лепестки-правила, внешние лепестки-знания, венчик данных раскрывается. */
(function () {
  'use strict';
  var R = window.RELIEF, V = window.RELIEF_VARIANT || 'v1';
  var D2R = Math.PI / 180, TAU = Math.PI * 2;

  // правило → классы онтологии, которые оно читает (по смыслу текста правила)
  var READS = { 'R-104': ['Payment', 'Approval'], 'R-221': ['Loan', 'Payment'], 'R-305': ['Collateral', 'Evidence'],
    'R-412': ['Loan', 'Evidence'], 'R-518': ['Borrower', 'Portfolio'] };
  var FEEDS = { loans: ['Loan', 'Payment'], borrowers: ['Borrower', 'Covenant'], collateral: ['Collateral'] };

  function layers(D) {
    var dec = D.decisions.filter(function (d) { return d.id === D.focus.decision; })[0] || D.decisions[0];
    var C = D.meta.counts;
    return {
      dec: dec,
      rules: D.rules,
      classes: D.ontology.classes,
      relations: D.ontology.relations,
      data: [{ key: 'loans', n: C.loans, label: C.loans + ' loans' }, { key: 'borrowers', n: C.borrowers, label: C.borrowers + ' borrowers' }, { key: 'collateral', n: C.collateral, label: C.collateral + ' collateral' }]
    };
  }

  function node(o) { return Object.assign({ parent: -1, len: 0, ang: 0, rot: 0, sway: 0, depth: 0, z: 1 }, o); }

  /* ── v1 · chandelier ─────────────────────────────────────────────────── */
  function chandelier(Ly, rect, ui, u, P) {
    var N = [], cx = rect.x + rect.w * 0.42, hookY = rect.y + rect.h * 0.02;
    var hook = N.push(node({ id: 'hook', kind: 'disc', r: 7 * ui, x: cx, y: hookY, z: 3, layer: 'hook' })) - 1;
    var E = Math.max(0.28, Math.min(1, P.explode));
    // ярусы: кольцо-эллипс на своей глубине; длина нити = расстояние от крюка, угол = направление
    function tier(items, ry, rx, flat, z, layer) {
      var out = [];
      items.forEach(function (it, k) {
        var a = (k + 0.5) / items.length * TAU + (layer === 'rules' ? 0.3 : layer === 'data' ? 0.15 : 0);
        var x = cx + Math.cos(a) * rx, y = hookY + ry * E + Math.sin(a) * rx * flat;
        var dx = x - cx, dy = y - hookY, len = Math.hypot(dx, dy);
        out.push(N.push(node(Object.assign({ parent: hook, len: len, ang: Math.atan2(dy, dx), sway: 1.4 + 0.3 * k % 3, depth: 1, z: z, layer: layer }, it))) - 1);
      });
      return out;
    }
    var H = rect.h, W = rect.w;
    tier([{ id: 'dec', kind: 'disc', r: 46 * ui, label: Ly.dec.id, dec: true }], H * 0.22, 0.0001, 0.3, 3, 'decision');
    tier(Ly.rules.map(function (r) { return { id: r.id, kind: 'sheet', w: 136 * ui, h: 76 * ui, label: r.id, rule: r }; }), H * 0.40, W * 0.23, 0.34, 2, 'rules');
    tier(Ly.classes.map(function (c) { return { id: 'k-' + c, kind: 'disc', r: 15 * ui, label: c, cls: c }; }), H * 0.62, W * 0.28, 0.28, 1, 'knowledge');
    // листы данных через равные промежутки кольца, точки займов между ними
    var dat = [];
    for (var i = 0; i < 15; i++) {
      if (i % 5 === 0) { var d = Ly.data[i / 5]; dat.push({ id: 'd-' + d.key, kind: 'sheet', w: 150 * ui, h: 86 * ui, label: d.label, data: d }); }
      else dat.push({ id: 'dot' + i, kind: 'disc', r: 7 * ui, label: '', dot: true });
    }
    tier(dat, H * 0.86, W * 0.38, 0.22, 1, 'data');
    N.forEach(function (n) { if (n.kind === 'sheet') n.rot = (n.ang > Math.PI / 2 ? 1 : -1) * 4 * D2R; });
    return { nodes: N, wires: true, callX: rect.x + rect.w * 0.80 };
  }

  /* ── v2 · graph ──────────────────────────────────────────────────────── */
  function graph(Ly, rect, ui, u, P) {
    var N = [], cx = rect.x + rect.w * 0.44, cy = rect.y + rect.h * 0.5, Rm = Math.min(rect.w * 0.8, rect.h) * 0.5;
    var E = 0.6 + 0.5 * Math.max(0, Math.min(1, P.explode));
    var dec = N.push(node({ id: 'dec', kind: 'disc', r: 46 * ui, x: cx, y: cy, z: 3, label: Ly.dec.id, dec: true, layer: 'decision' })) - 1;
    var ruleIx = {};
    Ly.rules.forEach(function (r, k) {
      var a = -Math.PI / 2 + k / Ly.rules.length * TAU;
      ruleIx[r.id] = N.push(node({ id: r.id, kind: 'sheet', w: 140 * ui, h: 80 * ui, parent: dec, len: Rm * 0.48 * E, ang: a, sway: 1.2, depth: 1, z: 2, label: r.id, rule: r, layer: 'rules', rot: (k % 2 ? 1 : -1) * 5 * D2R })) - 1;
    });
    // класс висит на первом правиле, которое его читает; остальные чтения — мягкими дугами
    var clsIx = {}, extra = [];
    Ly.classes.forEach(function (c) {
      var rd = Object.keys(READS).filter(function (k) { return READS[k].indexOf(c) >= 0; });
      var host = rd.length ? ruleIx[rd[0]] : dec, sib = Object.keys(clsIx).filter(function (q) { return N[clsIx[q]].parent === host; }).length;
      var base = N[host].ang == null || host === dec ? 0 : N[host].ang, a = base + (sib - 0.5) * 48 * D2R + (host === dec ? Ly.classes.indexOf(c) * 0.9 : 0);
      clsIx[c] = N.push(node({ id: 'k-' + c, kind: 'disc', r: 15 * ui, parent: host, len: Rm * (host === dec ? 0.7 : 0.32) * E, ang: a, sway: 2, depth: 2, z: 1, label: c, cls: c, layer: 'knowledge' })) - 1;
      rd.slice(1).forEach(function (k) { extra.push({ a: ruleIx[k], b: clsIx[c] }); });
    });
    Ly.data.forEach(function (d, k) {
      var cls = FEEDS[d.key], host = clsIx[cls[0]];
      var a = N[host].ang + (k - 1) * 10 * D2R;
      var di = N.push(node({ id: 'd-' + d.key, kind: 'sheet', w: 156 * ui, h: 88 * ui, parent: host, len: Rm * 0.48 * E, ang: N[host].ang + (k % 2 ? 0.25 : -0.25), sway: 2.4, depth: 3, z: 1, label: d.label, data: d, layer: 'data', rot: (k % 2 ? -1 : 1) * 6 * D2R })) - 1;
      cls.slice(1).forEach(function (c) { if (clsIx[c] != null) extra.push({ a: clsIx[c], b: di }); });
      // точки займов: по 20 займов на диск, веером за листом данных
      if (d.key === 'loans') for (var i = 0; i < 6; i++) N.push(node({ id: 'dot' + i, kind: 'disc', r: 7 * ui, parent: di, len: 64 * ui + i * 4 * ui, ang: N[host].ang + (i - 2.5) * 16 * D2R, sway: 3, depth: 4, z: 1, dot: true, layer: 'data' }));
    });
    return { nodes: N, extra: extra, callX: rect.x + rect.w * 0.86 };
  }

  /* ── v3 · flower ─────────────────────────────────────────────────────── */
  function flower(Ly, rect, ui, u, P) {
    var N = [], cx = rect.x + rect.w * 0.42, cy = rect.y + rect.h * 0.52, Rm = Math.min(rect.w * 0.8, rect.h) * 0.5;
    var E = 0.55 + 0.55 * Math.max(0, Math.min(1, P.explode));
    var core = N.push(node({ id: 'dec', kind: 'disc', r: 52 * ui, x: cx, y: cy, z: 3, label: Ly.dec.id, dec: true, layer: 'decision' })) - 1;
    // лепестки-правила: длинные листы по радиусу, внутренним краем под сердцевиной (тень сердцевины на них)
    Ly.rules.forEach(function (r, k) {
      var a = -Math.PI / 2 + k / Ly.rules.length * TAU;
      N.push(node({ id: r.id, kind: 'sheet', w: 176 * ui, h: 84 * ui, parent: core, len: (52 + 112) * ui * E, ang: a, rot: (k%2?1:-1)*.02, spin: .1, sway: 1.3, depth: 1, z: 2, label: r.id, rule: r, layer: 'rules', petal: true }));
    });
    // внешние лепестки-знания: диски в просветах между правилами, частично под ними
    Ly.classes.forEach(function (c, k) {
      var a = -Math.PI / 2 + (k + 0.5) / Ly.classes.length * TAU;
      N.push(node({ id: 'k-' + c, kind: 'disc', r: 18 * ui, parent: core, len: Rm * 0.62 * E, ang: a, sway: 2, depth: 2, z: 1, label: c, cls: c, layer: 'knowledge' }));
    });
    // венчик данных: три листа и точки займов по внешнему кругу
    Ly.data.forEach(function (d, k) {
      var a = -Math.PI / 2 + Math.PI / 3 + k / 3 * TAU;
      N.push(node({ id: 'd-' + d.key, kind: 'sheet', w: 156 * ui, h: 88 * ui, parent: core, len: Rm * 0.88 * E, ang: a, rot: (k%2?1:-1)*.02, spin: .1, sway: 2.4, depth: 3, z: 1, label: d.label, data: d, layer: 'data', petal: true }));
    });
    for (var i = 0; i < 18; i++) {
      var a = -Math.PI / 2 + (i + 0.5) / 18 * TAU;
      N.push(node({ id: 'dot' + i, kind: 'disc', r: 6 * ui, parent: core, len: Rm * (0.82 + (i % 2) * 0.12) * E, ang: a, sway: 3, depth: 3, z: 1, dot: true, layer: 'data' }));
    }
    return { nodes: N, callX: rect.x + rect.w * 0.84, petals: true };
  }

  /* вписать: длины и размеры одним множителем вокруг корня, центр габарита в поле */
  function fit(N, rect) {
    var p = []; N.forEach(function (n, i) { p[i] = n.parent < 0 ? [n.x, n.y] : [p[n.parent][0] + Math.cos(n.ang) * n.len, p[n.parent][1] + Math.sin(n.ang) * n.len]; });
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    N.forEach(function (n, i) { var e = n.kind === 'disc' ? n.r : Math.max(n.w, n.h) / 2; x0 = Math.min(x0, p[i][0] - e); x1 = Math.max(x1, p[i][0] + e); y0 = Math.min(y0, p[i][1] - e); y1 = Math.max(y1, p[i][1] + e); });
    var s = Math.min(2.2, rect.w / (x1 - x0), rect.h / (y1 - y0));
    N.forEach(function (n) { n.len *= s; if (n.kind === 'disc') n.r *= s; else { n.w *= s; n.h *= s; } });
    var root = N[0];
    root.x = rect.x + rect.w / 2 + (root.x - (x0 + x1) / 2) * s; root.y = rect.y + rect.h / 2 + (root.y - (y0 + y1) / 2) * s;
    return s;
  }

  var CALL = [
    { layer: 'decision', head: function (L) { return 'Decision · ' + L.dec.id; }, sub: function (L) { return L.dec.status + ' · ' + L.dec.action; } },
    { layer: 'rules', head: function (L) { return 'Rules · ' + L.rules.length + ' checks'; }, sub: function () { return 'run before any action'; } },
    { layer: 'knowledge', head: function (L) { return 'Knowledge · ' + L.classes.length + ' classes'; }, sub: function (L) { return L.relations.length + ' relations: what the data means'; } },
    { layer: 'data', head: function () { return 'Data · as received'; }, sub: function (L) { return L.data.map(function (d) { return d.label; }).join(' · '); } }
  ];

  function build(ctx) {
    var P = ctx.P, W = ctx.W, H = ctx.H, ui = R.ui(W, H), u = Math.min(W, H) / 48, D = ctx.data, Ly = layers(D);
    var m = 0.06 * Math.min(W, H), rect = { x: m, y: m + 52 * ui, w: (W - 2 * m) * (W < 700 ? 1 : 0.74), h: H - 2 * m - 96 * ui };
    var L = V === 'v2' ? graph(Ly, rect, ui, u, P) : V === 'v3' ? flower(Ly, rect, ui, u, P) : chandelier(Ly, rect, ui, u, P);
    var N = L.nodes;
    fit(N, rect);
    N.forEach(function (n, i) { n.order = (3 - n.z) * 40 + i; n.corner = 2.5; });
    var acc = R.tokens(ctx.theme, P.accent).accent;
    var links = [];
    if (L.wires) N.forEach(function (n, i) { if (n.parent >= 0) links.push({ a: n.parent, b: i, alpha: n.dot ? 0.45 : 0.8 }); });
    else if (!L.petals) N.forEach(function (n, i) { if (n.parent >= 0) links.push({ a: n.parent, b: i, alpha: n.dot ? 0.5 : 1 }); });
    (L.extra || []).forEach(function (e) { links.push({ a: e.a, b: e.b, bend: 0.18, alpha: 0.18, secondary:true }); });
    if (L.petals) N.forEach(function (n, i) { if (n.cls) links.push({ a: 0, b: i, bend: 0.12, alpha: 0.5 }); });

    return {
      nodes: N, links: links,
      tip: function (n) {
        if (n.dec) return { lines: [Ly.dec.id + ' · ' + Ly.dec.status, Ly.dec.action].concat(Ly.dec.checks.map(function (c) { return c.ref + ' · ' + c.result; })), w: 230 };
        if (n.rule) return { lines: [n.rule.id + ' · ' + n.rule.kind, n.rule.text.slice(0, 34) + (n.rule.text.length > 34 ? '…' : '')], w: 250 };
        if (n.cls) return { lines: [n.cls, 'ontology class'], w: 140 };
        if (n.data) return { lines: [n.data.label, 'source system, as received'], w: 200 };
        if (n.dot) return { lines: ['Loan records', 'Illustrative sample, not a count'], w: 150 };
        return null;
      },
      floorAfter: function (g, F, sc) {
        // подписи классов знаний на полу у дисков
        N.forEach(function (n, i) {
          if (!n.cls) return;
          var q = sc[i], a = 1 - 0.75 * q.dim, r = n.r * F.zoom;
          R.ink.text(g, F, n.cls, q.x, q.y + r + 13 * F.ui, { s: 0, mono: true, tone: 'ink2', align: 'center', alpha: a });
        });
        callouts(g, F, sc, N, Ly, L, ui);
        title(g, F, Ly);
      },
      print: function (g, s, F, n) {
        if(n.dot){R.cardInk(g,s,F,['',String(1+Number(n.id.replace('dot','')))]);return;}
        var lines=n.dec?[Ly.dec.id,Ly.dec.status,Ly.dec.action]:n.rule?[n.rule.id,n.rule.kind,n.rule.text]:n.data?[n.data.label,String(n.data.n)+' records','Source checked']:n.cls?[n.cls,'Class']:['Record'];
        R.cardInk(g,s,F,lines);

      }
    };
  }

  /* выноски лучами: от самого правого элемента слоя прямой луч к подписи в колонке справа,
     подписи по высоте источников, лучи не пересекаются (сортировка по y источника, донор 01) */
  function callouts(g, F, sc, N, Ly, L, ui) {
    // узкий кадр: колонке выносок нет места, основания слоя показывает карточка наведения
    if (!F.P.callouts || F.W < 700) return;
    var src = CALL.map(function (c) {
      var best = -1, bx = -1e9;
      N.forEach(function (n, i) { if (n.layer === c.layer && sc[i].x + (n.kind === 'disc' ? n.r : n.w / 2) > bx) { bx = sc[i].x + (n.kind === 'disc' ? n.r : n.w / 2) * F.zoom; best = i; } });
      return best < 0 ? null : { c: c, i: best, x: bx, y: sc[best].y, dim: sc[best].dim };
    }).filter(Boolean).sort(function (a, b) { return a.y - b.y; });
    var x = Math.max(L.callX, Math.max.apply(null, src.map(function (q) { return q.x; })) + 40 * ui), y = -1e9, gap = 46 * ui;
    var labX = Math.min(F.W - 0.06 * Math.min(F.W, F.H) - 250 * ui, x);
    src.forEach(function (q) {
      var ly = Math.max(q.y, y + gap); y = ly;
      var a = 1 - 0.7 * q.dim, p0 = [q.x + 6 * ui, q.y], p1 = [labX - 8 * ui, ly - 4 * ui];
      g.save(); g.lineWidth = F.lineW; g.lineCap = 'round'; g.strokeStyle = R.color.css(F.T.ink2, 0.7 * a);
      g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke();
      g.fillStyle = R.color.css(q.c.layer === 'decision' ? F.T.accent : F.T.ink2, a); g.beginPath(); g.arc(p0[0], p0[1], 2.5 * ui, 0, TAU); g.fill();
      g.restore();
      R.ink.text(g, F, q.c.head(Ly), labX, ly, { s: 1, w: 500, alpha: a });
      R.ink.text(g, F, q.c.sub(Ly), labX, ly + 17 * ui, { s: 0, mono: true, tone: 'ink3', alpha: a });
    });
  }

  function title(g, F, Ly) {
    var m = 0.06 * Math.min(F.W, F.H), ui = F.ui;
    R.ink.text(g, F, 'Model of record: one company, four layers', m, m + 8 * ui, { s: 2, w: 500 });
    R.ink.text(g, F, 'Height = workflow layer, not approval · drag, hover, click to focus, scroll to zoom', m, m + 28 * ui, { s: 0, mono: true, tone: 'ink3' });
    var lines = ['How to read', 'Floor: data as received', 'Low plates: knowledge, what the data means', 'Raised sheets: rules that run before an action', 'Highest disc: the decision, with its reasons'];
    var y = F.H - m - (lines.length - 1) * 16 * ui;
    lines.forEach(function (s, i) { R.ink.text(g, F, s, m, y, { s: 0, mono: i > 0, caps: i === 0, w: i === 0 ? 500 : 400, tone: 'ink3' }); y += 16 * ui; });
  }

  var TITLES = { v1: 'Stack · chandelier', v2: 'Stack · graph', v3: 'Stack · flower' };
  RELIEF.def = R.org.scene({
    id: 'stack', title: TITLES[V] || TITLES.v1,
    blurb: 'Model of record as hanging paper sheets and discs lifted by height: data, knowledge, rules, decision.',
    layoutKeys: ['explode', 'callouts', 'zscale'],
    defaults: { zscale: 1.6, rim: 0, dens: .15, assemble:0, float:.3 },
    build: build,
    groups: {
      'Сцена': [['explode', 'Разнос', 0, 1, 0.01, V === 'v1' ? 0.8 : 0.6]],
      'Данные': [['callouts', 'Выноски', 0, 1, 1, 1]]
    }
  });
})();
