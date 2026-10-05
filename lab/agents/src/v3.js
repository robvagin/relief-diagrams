/* agents · v3 «Graph»: граф книги как в Obsidian. В центре модель, вокруг на мягких дугах пять
   агентов-дисков; каждый займ — узел на пружинах, его тянет к тем агентам, которым он интересен
   (флаг A1, пакет A2, неполный перенос A3, просрочка A4, шаг взыскания A5). Площадь круга = сумма
   займа, дистанция от модели = доля внимания агентов. Тянешь агента — его займы едут следом;
   наведение поднимает узел с соседями, остальное притухает; клик по займу = след, по агенту = фокус. */
(function () {
  'use strict';
  var R = window.RELIEF, O = R.org, AV = window.AVIEWS, TAU = Math.PI * 2, GOLD = 137.508 * Math.PI / 180;
  var GROUPS = {
    'Сцена': [
      ['view', 'Вид', ['row', 'morph'], 'row', ['Ряд', 'Морф']],
      ['trace', 'Связь займа', 0, 1, 1, 1]
    ],
    'Ритм': [['spacing', 'Шаг плашек', 0, 48, 1, 16]],
    'Данные': [['dots', 'Займов', 60, 240, 10, 240]]
  };
  var S = { loans: [], sel: null, focus: null, sim: new O.Sim(), view: O.View(), st: { hover: null }, shown: [] };

  function subset(ctx) {
    var all = ctx.data.loans.slice().sort(function (a, b) { return a.id < b.id ? -1 : 1; });
    var n = O.clamp(Math.round(+ctx.P.dots), 1, all.length), f = ctx.data.focus.loan, pick = all.slice(0, n);
    if (!pick.some(function (l) { return l.id === f; })) pick[pick.length - 1] = all.filter(function (l) { return l.id === f; })[0];
    S.loans = pick; S.maxE = Math.max.apply(null, pick.map(function (l) { return l.exposure; }));
    var big = pick.slice().sort(function (a, b) { return b.exposure - a.exposure; }).slice(0, 28);
    S.plateIds = new Set(big.map(function (l) { return l.id; })); S.plateIds.add(f);
    S.w = new Map(pick.map(function (l) { return [l.id, AV.AG.map(function (a) { return AV.interest(a, l); })]; }));
    if (!S.sel) S.sel = f;
    S.sim.reset();
  }

  function draw(ctx) {
    if (!S.loans.length) subset(ctx);
    var P = ctx.P, W = ctx.W, H = ctx.H, ui = R.ui(W, H), ts = R.motion.time(ctx), per = Math.max(1, +P.period || 36);
    var ws = TAU * ((ts % per) / per), wind = ctx.reduced ? 0 : +P.float;
    var cx = W / 2, cy = H / 2 + 16 * ui, Ra = Math.min(W * 0.36, H * 0.37) + (+P.spacing - 16) * ui;
    // морф: фокус по кругу переходит от агента к агенту, его займы подтягиваются к нему
    var foc = S.focus;
    if (P.view === 'morph' && !ctx.reduced) foc = Math.floor(ts / Math.max(2.4, per / 5)) % 5;
    var agents = AV.AG.map(function (a, i) {
      var ang = -Math.PI / 2 + i * TAU / 5 + 0.05 * wind * Math.sin(ws + i * 1.7);
      return { id: a, i: i, ax: cx + Ra * Math.cos(ang) * 1.08, ay: cy + Ra * Math.sin(ang) * 0.92, r: 24 * ui };
    });
    var sim = S.sim; sim.begin();
    var hub = sim.node('model', { x: cx, y: cy, r: 34 * ui, ka: 90 }); hub.ax = cx; hub.ay = cy; hub.r = 34 * ui;
    agents.forEach(function (a) { var q = sim.node(a.id, { x: a.ax, y: a.ay, r: a.r, ka: 30, m: 2 }); q.ax = a.ax; q.ay = a.ay; q.r = a.r; a.q = q; sim.link('model', a.id, Math.hypot(a.ax - cx, a.ay - cy), 4); });
    // семьи: займ живёт у агента, которому он нужнее всего (веер вокруг его хаба, сильнее = ближе);
    // никому не нужный — спокойно у модели филлотаксисом. Вторичные интересы — пружины и линии при наведении
    var fam = [[], [], [], [], []], rest = [];
    S.loans.forEach(function (l) {
      var w = S.w.get(l.id), best = -1, bv = 0;
      w.forEach(function (v, i) { var vv = v * (foc === i ? 3 : 1); if (vv > 0 && vv >= bv) { bv = vv; best = i; } });   // равенство уходит к агенту позже в ряду: семьи не пустеют
      if (best < 0) rest.push(l); else fam[best].push(l);
    });
    function place(l, bx, by, k) {
      var ph = O.hash01(l.id) * TAU, drift = 2.2 * ui * wind;
      bx += drift * (0.7 * Math.sin(ws + ph) + 0.3 * Math.sin(2 * ws + ph * 1.4));
      by += drift * (0.7 * Math.cos(ws + ph * 0.8) + 0.3 * Math.sin(3 * ws + ph));
      var r = Math.max(1.7 * ui, 14 * ui * Math.sqrt(l.exposure / S.maxE));
      var q = sim.node(l.id, { x: bx, y: by, r: r + 1, ka: 16 }); q.ax = bx; q.ay = by; q.r = r + 1.2 * ui; q.loan = l; q.rad = r;
    }
    rest.forEach(function (l, k) {
      var rr = 44 * ui + 5.6 * ui * Math.sqrt(k + 1), a0 = k * GOLD;
      place(l, cx + rr * Math.cos(a0), cy + rr * Math.sin(a0), k);
    });
    fam.forEach(function (list, i) {
      var a = agents[i], out = Math.atan2(a.ay - cy, a.ax - cx);
      list.sort(function (p, q) { return S.w.get(q.id)[i] - S.w.get(p.id)[i] || (p.id < q.id ? -1 : 1); });
      list.forEach(function (l, k) {   // веер наружу от модели: ±75° вокруг направления агента
        var rr = a.r + 10 * ui + 7.4 * ui * Math.sqrt(k + 1), th = out + Math.sin(k * GOLD) * 1.3;
        place(l, a.ax + rr * Math.cos(th), a.ay + rr * Math.sin(th), k);
        l._fam = i;
      });
    });
    S.loans.forEach(function (l) {
      var w = S.w.get(l.id), q = sim.byId[l.id];
      w.forEach(function (v, i) { if (v > 0) sim.link(l.id, AV.AG[i], Math.hypot(agents[i].ax - q.ax, agents[i].ay - q.ay), i === l._fam ? 3 : 0.3 * v); });
    });
    rest.forEach(function (l) { l._fam = -1; });
    sim.end(); sim.advance(ctx); O.viewStep(S.sim, ctx); O.hoverStep(sim, S.st, ctx);

    var z1 = R.zh(1, P, ui), z2 = R.zh(2, P, ui), z3 = R.zh(3, P, ui), zoom = S.sim.zoom(), plates = [], shown = [];
    function scr(q, z) { var p = O.toScreen(S.sim, ctx, q.x, q.y, z); return p; }
    var hp = scr(hub, z3 + hub.lift * 10 * ui);
    plates.push({ id: 'model', kind: 'circle', x: hp[0], y: hp[1], w: 2 * hub.r * zoom, h: 2 * hub.r * zoom, z: z3, env: 0, label: 'model' });
    shown.push({ id: 'model', x: hp[0], y: hp[1], r: hub.r * zoom, kind: 'model' });
    agents.forEach(function (a, i) {
      var z = z2 + a.q.lift * 10 * ui, p = scr(a.q, z);
      a.sx = p[0]; a.sy = p[1]; a.sr = a.r * zoom;
      plates.push({ id: a.id, kind: 'circle', x: p[0], y: p[1], w: 2 * a.sr, h: 2 * a.sr, z: z, env: 1, assembleIndex: i + 1, agent: a });
      shown.push({ id: a.id, x: p[0], y: p[1], r: a.sr, kind: 'agent', a: a });
    });
    S.loans.forEach(function (l, k) {
      var q = sim.byId[l.id], plate = S.plateIds.has(l.id), z = (plate ? z1 : 0) + q.lift * 10 * ui, p = scr(q, z);
      var n = { id: l.id, x: p[0], y: p[1], r: q.rad * zoom, kind: 'loan', l: l, plate: plate, q: q };
      shown.push(n);
      if (plate) {
        var tilt = (O.hash01(l.id + 't') - 0.5) * 0.14;
        if (l.collateral) plates.push({ id: l.id, kind: 'rect', x: p[0], y: p[1], w: n.r * 2.3, h: n.r * 1.6, r: 2 * ui, rot: tilt, z: z, env: 1, assembleIndex: 7 + (k % 12), loanN: n });
        else plates.push({ id: l.id, kind: 'circle', x: p[0], y: p[1], w: n.r * 2, h: n.r * 2, z: z, env: 1, assembleIndex: 7 + (k % 12), loanN: n });
      }
    });
    S.shown = shown; S.agents = agents; S.hubP = hp;
    R.frame(ctx, {
      plates: plates,
      floor: function (g, F) { floor(g, F, ctx); },
      print: function (g, s, F) { print(g, s, F, ctx); },
      above: function (g, F) { overlay(g, F, ctx); }
    });
  }

  function floor(g, F, ctx) {
    var dim = S.st.dim || 0, hov = S.st.hover, hp = S.hubP;
    // щупальца модель → агент: мягкие дуги
    S.agents.forEach(function (a, i) { O.arc(g, F, hp, [a.sx, a.sy], (i % 2 ? 0.1 : -0.1), { alpha: 0.5 * (1 - 0.5 * dim) }); });
    // связи займ → агент: тонкие дуги; у наведённого и выбранного — ярче
    S.shown.forEach(function (n) {
      if (n.kind !== 'loan') return;
      var w = S.w.get(n.id), lit = n.id === hov || n.id === S.sel && +ctx.P.trace;
      w.forEach(function (v, i) {
        if (!(v > 0)) return;
        var a = S.agents[i], fam = n.l._fam === i, al = lit ? 0.62 : fam ? 0.26 * (1 - 0.7 * dim) : 0;
        if (hov && hov === a.id && fam) al = 0.6;
        if (al <= 0.004) return;
        if (fam && !lit) O.ray(g, F, [a.sx, a.sy], [n.x, n.y], { ra: a.sr, rb: n.r, alpha: al, tone: 'ink2' });   // веер семьи: прямые лучи из хаба
        else O.arc(g, F, [n.x, n.y], [a.sx, a.sy], 0.08, { alpha: al, tone: 'ink' });
      });
      if (!n.plate) {
        g.beginPath(); g.arc(n.x, n.y, Math.max(1.2 * F.ui, n.r), 0, TAU);
        g.fillStyle = R.color.css(F.T.ink2, (n.id === hov ? 1 : 0.6) * (1 - 0.5 * dim * (n.id === hov ? 0 : 1))); g.fill();
      }
    });
    var sel = S.shown.filter(function (n) { return n.id === S.sel; })[0];
    if (sel && +ctx.P.trace && !sel.plate) { g.beginPath(); g.arc(sel.x, sel.y, sel.r + 4 * F.ui, 0, TAU); g.strokeStyle = R.color.css(F.T.accent); g.lineWidth = F.lineW; g.stroke(); }
    // подписи агентов наружу от модели
    S.agents.forEach(function (a) {
      // подпись со стороны модели, со сдвигом от щупальца: наружу смотрит веер семьи
      var ag = ctx.data.agents[a.i], base = Math.atan2(a.sy - hp[1], a.sx - hp[0]) + Math.PI, c1 = base + 0.75, c2 = base - 0.75;
      var ang = a.sy > hp[1] ? (Math.sin(c1) < Math.sin(c2) ? c1 : c2) : (Math.abs(Math.cos(c1)) > Math.abs(Math.cos(c2)) ? c1 : c2), d = a.sr + 12 * F.ui;
      var x = a.sx + Math.cos(ang) * d, y = a.sy + Math.sin(ang) * d, al = Math.cos(ang) > 0.3 ? 'left' : Math.cos(ang) < -0.3 ? 'right' : 'center';
      var fade = 1 - 0.5 * dim * (hov === a.id ? 0 : 1);
      R.ink.text(g, F, ag.id + ' · ' + ag.name, x, y, { s: 1, w: 500, align: al, base: 'middle', alpha: fade });
      R.ink.text(g, F, ag.job, x, y + 15 * F.ui, { s: 0, mono: true, tone: 'ink3', align: al, base: 'middle', alpha: fade });
    });
  }
  function print(g, s, F, ctx) {
    var ui = F.ui;
    if (s.src.label === 'model') {
      R.ink.text(g, F, 'model', s.x, s.y - 2 * ui, { s: 1, w: 500, align: 'center' });
      R.ink.text(g, F, S.loans.length + ' loans', s.x, s.y + 13 * ui, { s: 0, mono: true, tone: 'ink3', align: 'center' });
    } else if (s.src.agent) {
      var a = s.src.agent, cnt = S.loans.filter(function (l) { return S.w.get(l.id)[a.i] > 0; }).length;
      R.ink.text(g, F, a.id, s.x, s.y - 1 * ui, { s: 1, w: 500, align: 'center' });
      R.ink.text(g, F, String(cnt), s.x, s.y + 12 * ui, { s: 0, mono: true, tone: 'ink3', align: 'center' });
      if (S.focus === a.i || ctx.P.view === 'morph' && !ctx.reduced && Math.floor(R.motion.time(ctx) / Math.max(2.4, (+ctx.P.period || 36) / 5)) % 5 === a.i) {
        g.beginPath(); g.arc(s.x, s.y - s.w * 0.3, 2.4 * ui, 0, TAU); g.fillStyle = R.color.css(F.T.ink2); g.fill();
      }
    } else if (s.src.loanN && s.src.loanN.id === S.sel && +ctx.P.trace) {
      g.beginPath(); g.arc(s.x, s.y, 2.6 * ui, 0, TAU); g.fillStyle = R.color.css(F.T.accent); g.fill();
    }
  }
  function overlay(g, F, ctx) {
    var m = Math.min(F.W, F.H) * 0.06, l = S.loans.filter(function (q) { return q.id === S.sel; })[0];
    R.ink.text(g, F, 'Five agents · one model · Graph', m, m, { s: 0, caps: true, tone: 'ink3' });
    R.ink.text(g, F, 'Every loan, pulled by the agents that care about it', m, m + 24 * F.ui, { s: 2, w: 500 });
    if (l) {
      var w = S.w.get(l.id), who = AV.AG.filter(function (a, i) { return w[i] > 0; });
      R.ink.text(g, F, l.id + ' · ' + AV.money(l.exposure) + ' · ' + (who.length ? 'read by ' + who.join(' ') : 'no agent flags it'), m, m + 42 * F.ui, { s: 0, mono: true, tone: 'ink3' });
    }
    var hv = S.st.hover && S.shown.filter(function (n) { return n.id === S.st.hover && n.kind === 'loan'; })[0];
    if (hv) {
      R.ink.text(g, F, hv.l.id + ' · ' + AV.money(hv.l.exposure), hv.x + hv.r + 8 * F.ui, hv.y - 6 * F.ui, { s: 0, w: 500, mono: true });
      R.ink.text(g, F, hv.l.segment + ' · ' + hv.l.country + ' · ' + hv.l.stage, hv.x + hv.r + 8 * F.ui, hv.y + 8 * F.ui, { s: 0, mono: true, tone: 'ink2' });
    }
    var ly = F.H - m - 15 * F.ui;
    R.ink.text(g, F, 'How to read', m, ly, { s: 0, caps: true, tone: 'ink3' });
    R.ink.text(g, F, 'Area = exposure · pulled toward the agents that read it · drag an agent, scroll to zoom', m, ly + 15 * F.ui, { s: 0, mono: true, tone: 'ink3' });
    R.ink.fictional(g, F);
  }

  function attach(ctx) {
    O.interact(ctx, {
      view: S.view, sim: S.sim, state: S.st,
      pick: function (x, y) {
        var best = null, bd = 1e9;
        S.shown.forEach(function (n) { var d = Math.hypot(n.x - x, n.y - y); if (d < Math.max(n.r, 4) + 4 && d < bd) { bd = d; best = n; } });
        return best ? { id: best.id, n: best } : null;
      },
      onClick: function (h) {
        if (h.n.kind === 'loan') S.sel = h.n.id;
        else if (h.n.kind === 'agent') S.focus = S.focus === h.n.a.i ? null : h.n.a.i;
        else S.focus = null;
      },
      onHome: function () { S.focus = null; }
    });
  }

  RELIEF.def = {
    id: 'agents', title: 'Agents · Graph',
    blurb: 'Five agents on one model as a living graph: every loan pulled by the agents that read it.',
    groups: GROUPS,
    init: function (ctx) { subset(ctx); setTimeout(function () { attach(ctx); }, 0); },
    structural: function (ctx, path) { if (path === 'dots') { S.loans = []; subset(ctx); } },
    draw: draw
  };
})();
