/* horizon.js · онтология в фокусе как живой организм (README §6.1 №05, §7.7; приказ волны 3).
   Общая часть трёх организмов: граф онтологии из data/portfolio.json, дерево от фокуса, раскладка
   Лэмпинга в диске Пуанкаре, ход фокуса Мёбиусом (клик), протяжка фона = непрерывный Мёбиус,
   узлы на пружинах (тянешь — соседи едут), наведение поднимает узел с соседями, колесо = зум.
   Вариант задаёт организм: как диск ложится в кадр (map), ветер (wind) и чем рисуются связи (links).
   Бумага и диски вперемешку: объекты-документы — листы, субъекты и решения — диски. Дырок нет. */
(function () {
  'use strict';
  var R = window.RELIEF, H = window.HYPER, O = R.org, C = H.C, TAU = Math.PI * 2;
  var PAPER = { Loan: 1, Rule: 1, Covenant: 1, Collateral: 1, Evidence: 1 };
  var REL = { owes: 'owes', secured_by: 'secured by', governed_by: 'governed by', applies_to: 'applies to', watches: 'watches',
    checks: 'checks', maps: 'maps', services: 'services', recovers: 'recovers', proposes: 'proposes', about: 'about',
    checked_by: 'checked by', approved_by: 'approved by', evidenced_by: 'evidenced by', more: 'more' };
  var WORD = { Loan: 'Loan', Borrower: 'Borrower', Collateral: 'Collateral', Covenant: 'Covenant', Rule: 'Rule', Decision: 'Decision',
    Agent: 'Agent', Approval: 'Approval', Evidence: 'Evidence', More: 'More' };

  var TW = {};
  function textW(g, str, px, w, mono) {   // ширина строки шрифтом сцены (кеш по строке и кеглю)
    var k = str + '|' + px.toFixed(1) + '|' + w + mono;
    if (TW[k] == null) {
      g.save(); g.font = w + ' ' + px.toFixed(2) + 'px ' + (mono ? '"Geist Mono"' : '"Geist"');
      try { g.letterSpacing = (px < 13 ? 0.02 * px : px > 20.2 ? -0.01 * px : 0).toFixed(2) + 'px'; } catch (e) {}
      TW[k] = g.measureText(str).width; g.restore();
    }
    return TW[k];
  }
  function money(v) { return v >= 1e6 ? '€' + (v / 1e6).toFixed(2) + 'M' : v >= 1e3 ? '€' + Math.round(v / 1e3) + 'k' : '€' + Math.round(v); }
  function name1(t) {
    var n = t.n;
    if (n.type === 'More') return n.label;
    if (n.type === 'Agent') return n.id + ' ' + n.label;
    if (n.type === 'Approval' || n.type === 'Evidence') return n.label;
    return n.id;
  }
  function sub1(t) {
    var n = t.n;
    if (n.type === 'Loan') return n.label + ' · ' + money(n.value);
    if (n.type === 'Collateral') return money(n.value) + ' · ' + n.months + ' mo';
    if (n.type === 'Decision') return n.status;
    if (n.type === 'Borrower') return n.label;
    if (n.type === 'Agent') return n.label;
    return WORD[n.type];
  }
  function focusLine(t) {
    var n = t.n;
    if (n.type === 'Loan') return n.label + ' · ' + money(n.value) + ' · ' + n.stage;
    if (n.type === 'Borrower') return n.label + ' · ' + n.segment + ' · ' + n.country;
    if (n.type === 'Rule' || n.type === 'Covenant') return n.label.length > 46 ? n.label.slice(0, 45) + '…' : n.label;
    if (n.type === 'Agent') return n.job;
    if (n.type === 'Decision') return n.label + ' · ' + n.status;
    return WORD[n.type];
  }

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

  function make(V) {
    if(V.name==='Plant')GROUPS['Ритм'][1][5]=4;
    var S = { G: null, tree: null, nav: H.Nav(), sim: new O.Sim(), view: O.View(), st: { hover: null }, shown: [], rot: 0 };

    function rebuild(ctx) {
      if (!S.G) S.G = H.buildGraph(ctx.data);
      S.tree = H.buildTree(S.G, ctx.P.focus, Math.round(+ctx.P.depthH));
      H.layout(S.tree, +ctx.P.link, V.wedge ? V.wedge[0] : undefined, V.wedge ? V.wedge[1] : undefined);
      S.nav = H.Nav(); S.nav.center = S.tree.root.id; S.sim.reset(); S.settledAt = -10;
    }

    function draw(ctx) {
      if (!S.tree) rebuild(ctx);
      var P = ctx.P, ts = R.motion.time(ctx), ui = R.ui(ctx.W, ctx.H);
      var k = H.navStep(S.nav, ts, ctx.reduced ? function () { return 1; } : R.motion.ease);
      if (!S.nav.anim && S.wasAnim) { S.settledAt = ts; S.wasAnim = false; }
      if (S.nav.anim) S.wasAnim = true;
      var center = S.nav.anim ? S.nav.anim.target : (S.nav.center || S.tree.root.id);
      var dNew = H.distFrom(S.tree, center), dOld = H.distFrom(S.tree, S.nav.anim ? (S.nav.anim.prevCenter || center) : center);
      var G = V.frame(S, ctx, ui);
      var per = Math.max(1, +P.period || 36), ws = TAU * ((ts % per) / per), wind = ctx.reduced ? 0 : +P.float;
      var zs = [R.zh(3, P, ui), R.zh(2, P, ui), R.zh(1, P, ui), 0];

      // узлы: диск → якорь кадра (+ ветер организма), роль по кольцу, форма по типу
      var nodes = S.tree.all.map(function (t) {
        var w = H.apply(S.nav.m, t.z), base = V.map(S, ctx, w, ui), dn = dNew.get(t), dO = dOld.get(t);
        var ring = k < 0.5 ? dO : dn, sz = O.clamp(Math.sqrt(Math.max(0, V.size ? V.size(w) : 1 - C.abs2(w))), 0.3, 1);
        var off = V.wind ? V.wind(S, t, w, base, ws, wind, ui) : [0, 0];
        return { t: t, w: w, ax: base[0] + off[0], ay: base[1] + off[1], ring: ring, sz: sz, vis: base[2] !== false,
          z: t.more ? 0 : zs[Math.min(3, dO)] + (zs[Math.min(3, dn)] - zs[Math.min(3, dO)]) * k, paper: !!PAPER[t.n.type] };
      });
      // физика: якоря, связи родитель—ребёнок на текущей длине, диски расталкиваются
      var sim = S.sim; sim.begin();
      nodes.forEach(function (n) {
        var r = n.ring <= 2 && !n.t.more ? (n.ring === 0 ? 40 : n.ring === 1 ? 26 : 9) * ui * n.sz : 0;
        var q = sim.node(n.t.id, { x: n.ax, y: n.ay, r: r, ka: n.ring === 0 ? 60 : 22 });
        q.ax = n.ax; q.ay = n.ay; q.r = r; n.q = q;
      });
      var byT = new Map(nodes.map(function (n) { return [n.t, n]; }));
      nodes.forEach(function (n) {   // связь держит длину, какую ей дал якорь: тянешь узел — ветка едет
        var pa = n.t.parent && byT.get(n.t.parent); if (pa) sim.link(pa.t.id, n.t.id, Math.hypot(n.ax - pa.ax, n.ay - pa.ay), 10);
      });
      sim.end(); sim.advance(ctx); O.viewStep(S.sim, ctx);
      O.hoverStep(sim, S.st, ctx);

      // экран: зум и параллакс по высоте
      nodes.forEach(function (n) {
        var lift = n.q.lift * 10 * ui, z = n.z + lift, s = O.toScreen(S.sim, ctx, n.q.x, n.q.y, z);
        n.x = s[0]; n.y = s[1]; n.zz = z; n.zoom = S.sim.zoom();
      });
      S.shown = nodes;
      var plates = [];
      nodes.forEach(function (n, i) {
        if (!n.vis || n.t.more || n.ring >= (V.name==='Plant'?4:3)) return;
        var zoom = S.sim.zoom(), sz = n.sz * zoom, env = n.ring === 0 && !S.nav.anim ? R.motion.settle(ts, S.settledAt, +P.settle) : 1;
        var tilt = (O.hash01(ctx.seed + n.t.id) - 0.5) * 2 * (1 + .7 * O.hash01(n.t.id + 't')) * Math.PI / 180;
        var p = { id: n.t.id, z: n.zz, env: env, assembleIndex: i, x: n.x, y: n.y, node: n };
        if (n.paper) {
          // ширина листа по тексту, который на нём напечатан (лист не режет подпись)
          var tw = n.ring === 0 ? Math.max(textW(ctx.g, name1(n.t), 24.19 * ui, 500, false), textW(ctx.g, focusLine(n.t), 11.67 * ui, 400, true)) + 24 * ui
            : n.ring === 1 ? Math.max(textW(ctx.g, name1(n.t), 14 * ui, 500, false), textW(ctx.g, (REL[n.t.rel] || '') + ' · ' + sub1(n.t), 11.67 * ui, 400, true)) + 22 * ui : 30 * ui * sz;
          var hh = n.ring === 0 ? 88 * ui : n.ring === 1 ? 46 * ui : 20 * ui * sz;
          p.kind = 'rect'; p.w = tw * (n.ring <= 1 ? zoom : 1); p.h = hh * (n.ring <= 1 ? zoom : 1); p.r = Math.min(6 * ui, p.h / 3); p.rot = n.ring === 0 ? tilt * 0.5 : tilt;
        } else {
          var rad = n.ring === 0 ? 46 : n.ring === 1 ? 22 : 8;
          p.kind = 'circle'; p.w = 2 * rad * ui * sz; p.h = p.w;
        }
        n.plate = p; n.hw = p.kind === 'rect' ? Math.max(p.w, p.h) / 2 : p.w / 2;
        plates.push(p);
      });
      R.frame(ctx, {
        plates: plates,
        floor: function (g, F) { floor(g, F, ctx, nodes); },
        print: function (g, s, F) { if (s.src.node) mark(g, s, F, s.src.node); },
        above: function (g, F) { overlay(g, F, ctx, nodes); }
      });
    }

    // печать пола: горизонт, связи организма, точки дальних колец, подписи дисков
    function floor(g, F, ctx, nodes) {
      var dim = S.st.dim || 0, hov = S.st.hover;
      if (+ctx.P.horizon && V.horizon) V.horizon(g, F, ctx, S);
      var by = new Map(nodes.map(function (n) { return [n.t, n]; }));
      nodes.forEach(function (b) {
        var a = b.t.parent && by.get(b.t.parent); if (!a || (!a.vis && !b.vis)) return;
        var depth = Math.max(a.ring, b.ring), alpha = depth <= 1 ? 0.55 : depth === 2 ? 0.36 : 0.2;
        var lit = hov && (a.t.id === hov || b.t.id === hov);
        if (dim > 0.01 && !lit) alpha *= 1 - 0.65 * dim;
        V.links(g, F, a, b, alpha, nodes, by);
      });
      nodes.forEach(function (n) {
        if (!n.vis || n.plate) return;
        var r = n.t.more ? 2.6 * F.ui : 1.6 * F.ui;
        g.beginPath(); g.arc(n.x, n.y, r, 0, TAU);
        if (n.t.more) { g.lineWidth = F.lineW; g.strokeStyle = R.color.css(F.T.ink2, 0.5); g.stroke(); }
        else { g.fillStyle = R.color.css(F.T.ink2, 0.55 * (1 - 0.6 * dim)); g.fill(); }
      });
      var mode = ctx.P.labels, maxRing = mode === 'focus' ? 0 : mode === 'ring1' ? 1 : 2;
      nodes.forEach(function (n) {
        if (!n.vis || n.ring > maxRing || n.ring === 0 || n.paper && n.ring === 1) return;
        if (n.ring === 2 && n.t.more) return;
        var o = V.origin(ctx), a = Math.atan2(n.y - o[1], n.x - o[0]), d = (n.hw || 3) + 6 * F.ui;
        var x = n.x + Math.cos(a) * d, y = n.y + Math.sin(a) * d, al = Math.cos(a) > 0.3 ? 'left' : Math.cos(a) < -0.3 ? 'right' : 'center';
        var fade = 1 - 0.6 * dim * (hov === n.t.id ? 0 : 1);
        if (n.ring === 1) {
          R.ink.text(g, F, name1(n.t), x, y, { s: 1, w: 500, align: al, base: 'middle', alpha: fade });
          R.ink.text(g, F, REL[n.t.rel] || '', x, y + 14 * F.ui, { s: 0, mono: true, tone: 'ink3', align: al, base: 'middle', alpha: fade });
        } else {
          var m = String(n.t.n.value ? money(n.t.n.value) : (String(n.t.id).match(/\d+/) || [''])[0]);
          R.ink.text(g, F, m, x, y, { s: 0, mono: true, tone: 'ink2', align: al, base: 'middle', alpha: fade });
        }
      });
    }

    // печать на плашке: лист несёт текст, диск — знак типа; заблокированное решение = точка акцента
    function mark(g, s, F, n) {
      var t = n.t, ui = F.ui;
      if (s.kind === 'rect') {
        O.paper(g, F, s);
        g.save(); g.translate(s.x, s.y); if (s.rot) g.rotate(s.rot);
        var x = -s.w / 2 + 11 * ui, y = -s.h / 2;
        if (n.ring === 0) {
          R.ink.text(g, F, WORD[t.n.type], x, y + 20 * ui, { s: 0, caps: true, tone: 'ink3' });
          R.ink.text(g, F, name1(t), x, y + 48 * ui, { s: 4, w: 500 });
          R.ink.text(g, F, focusLine(t), x, y + 70 * ui, { s: 0, mono: true, tone: 'ink2' });
        } else if (n.ring === 1 && s.h > 30 * ui) {
          R.ink.text(g, F, name1(t), x, y + s.h * 0.44, { s: 1, w: 500 });
          R.ink.text(g, F, (REL[t.rel] || '') + ' · ' + sub1(t), x, y + s.h * 0.44 + 15 * ui, { s: 0, mono: true, tone: 'ink3' });
        }
        g.restore();
        return;
      }
      var r = s.w / 2, k = r * 0.3;
      g.save(); g.translate(s.x, s.y);
      if (n.ring === 0) {
        R.ink.text(g, F, WORD[t.n.type], 0, -10 * ui, { s: 0, caps: true, tone: 'ink3', align: 'center' });
        R.ink.text(g, F, name1(t), 0, 12 * ui, { s: 3, w: 500, align: 'center' });
      } else if (r > 5 * ui) {
        g.beginPath();
        if (t.n.type === 'Decision') { g.moveTo(0, -k); g.lineTo(k, 0); g.lineTo(0, k); g.lineTo(-k, 0); g.closePath(); }
        else if (t.n.type === 'Agent') { g.arc(0, 0, k * 0.8, 0, TAU); g.lineWidth = F.lineW; g.strokeStyle = R.color.css(F.T.ink2, 0.7); g.stroke(); g.beginPath(); }
        else if (t.n.type === 'Borrower') { g.arc(-k * 0.5, 0, k * 0.32, 0, TAU); g.arc(k * 0.5, 0, k * 0.32, 0, TAU); }
        else g.arc(0, 0, k * 0.4, 0, TAU);
        g.fillStyle = t.n.status === 'blocked' ? R.color.css(F.T.accent) : R.color.css(F.T.ink2, 0.7); g.fill();
      }
      g.restore();
    }

    function overlay(g, F, ctx, nodes) {
      var m = Math.min(F.W, F.H) * 0.06, foc = nodes.filter(function (n) { return n.ring === 0; })[0];
      R.ink.text(g, F, 'Ontology in focus · ' + V.name, m, m, { s: 0, caps: true, tone: 'ink3' });
      if (foc) R.ink.text(g, F, WORD[foc.t.n.type] + ' ' + name1(foc.t), m, m + 24 * F.ui, { s: 2, w: 500 });
      R.ink.text(g, F, S.tree.all.length + ' objects · ' + Math.round(+ctx.P.depthH) + ' steps', m, m + 42 * F.ui, { s: 0, mono: true, tone: 'ink3' });
      var ly = F.H - m - 30 * F.ui;
      R.ink.text(g, F, 'How to read', m, ly, { s: 0, caps: true, tone: 'ink3' });
      R.ink.text(g, F, V.legend, m, ly + 15 * F.ui, { s: 0, mono: true, tone: 'ink3' });
      R.ink.text(g, F, 'Click a node to bring it forward · drag it, its neighbours follow · scroll to zoom', m, ly + 30 * F.ui, { s: 0, mono: true, tone: 'ink3' });
      var sel = S.nav.sel >= 0 && S.ring1 && S.ring1.length ? S.ring1[S.nav.sel % S.ring1.length] : null;
      var n = sel && nodes.filter(function (q) { return q.t === sel; })[0];
      if (n) { g.beginPath(); g.arc(n.x, n.y, (n.hw || 4) + 5 * F.ui, 0, TAU); g.strokeStyle = R.color.css(F.T.accent); g.lineWidth = F.lineW; g.stroke(); }
      S.ring1 = nodes.filter(function (q) { return q.ring === 1 && q.vis && !q.t.more; }).sort(function (a, b) {
        var o = V.origin(ctx); return Math.atan2(a.y - o[1], a.x - o[0]) - Math.atan2(b.y - o[1], b.x - o[0]);
      }).map(function (q) { return q.t; });
      R.ink.fictional(g, F);
    }

    // ── взаимодействие ──────────────────────────────────────────────────
    function redraw(ctx) { if (ctx.reduced) window.postMessage({ type: 'es:progress', value: ctx.p }, '*'); }
    function goTo(ctx, n) {
      var ts = R.motion.time(ctx);
      S.nav.sel = -1; H.navGo(S.nav, n.w, ts, n.t.id);
      if (ctx.reduced) H.navStep(S.nav, ts + 1, R.motion.ease);
      redraw(ctx);
    }
    function attach(ctx) {
      O.interact(ctx, {
        view: S.view, sim: S.sim, state: S.st,
        pick: function (x, y) {
          var best = null, bd = 1e9;
          S.shown.forEach(function (n) { if (!n.vis || n.t.more) return; var d = Math.hypot(n.x - x, n.y - y); if (d < Math.max(n.hw || 4, 6) + 4 && d < bd) { bd = d; best = n; } });
          return best ? { id: best.t.id, n: best } : null;
        },
        onClick: function (h) { goTo(ctx, h.n); },
        onHome: function () { var r = S.shown.filter(function (q) { return q.t === S.tree.root; })[0]; if (r) goTo(ctx, r); }
      });
      document.addEventListener('keydown', function (e) {
        if (e.target && (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || (e.target.closest && e.target.closest('.pv2')))) return;
        if (!S.ring1 || !S.ring1.length) return;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { S.nav.sel = (S.nav.sel + 1) % S.ring1.length; e.preventDefault(); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { S.nav.sel = (S.nav.sel - 1 + S.ring1.length) % S.ring1.length; e.preventDefault(); }
        else if (e.key === 'Enter' && S.nav.sel >= 0) {
          var t = S.ring1[S.nav.sel % S.ring1.length], n = S.shown.filter(function (q) { return q.t === t; })[0];
          if (n) goTo(ctx, n);
        }
        redraw(ctx);
      });
    }

    RELIEF.def = {
      id: 'horizon', title: 'Horizon · ' + V.name,
      blurb: 'Ontology in focus as a living organism: the object at the heart, its grounds around it, the rest compressed toward the horizon.',
      groups: GROUPS,
      init: function (ctx) { rebuild(ctx); setTimeout(function () { attach(ctx); }, 0); },
      structural: function (ctx, path) { if (path === 'focus' || path === 'depthH' || path === 'link') rebuild(ctx); },
      draw: draw
    };
    return S;
  }
  window.HORIZON = { make: make, money: money, name1: name1, REL: REL };
})();
