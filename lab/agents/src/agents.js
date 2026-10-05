/* agents.js · пять агентов на одной модели как подвешенный организм (README §6.1 №06, §7.6 C).
   Общая часть листовых организмов (v1 мобиль, v2 цветок): листы агентов на пружинах, на каждом
   свой взгляд на одни и те же займы; выбранный займ — кольцо акцентом во всех видах и линии,
   сходящиеся в его запись (донор 04: собирающая дуга, монотонный вход). Морф: одна большая плашка
   перебирает виды, точки держат идентичность (900 мс, ступенька 15 мс). Наведение поднимает лист,
   тянешь лист — нити и соседи едут на пружинах, колесо = зум, клик по точке = займ для следа. */
(function () {
  'use strict';
  var R = window.RELIEF, O = R.org, AV = window.AVIEWS, TAU = Math.PI * 2;
  var GROUPS = {
    'Сцена': [
      ['view', 'Вид', ['row', 'morph'], 'row', ['Ряд', 'Морф']],
      ['trace', 'Связь займа', 0, 1, 1, 1]
    ],
    'Ритм': [['spacing', 'Шаг плашек', 0, 48, 1, 16]],
    'Данные': [['dots', 'Займов', 60, 240, 10, 240]]
  };

  function make(V) {
    var S = { loans: [], byId: new Map(), sel: null, cache: new Map(), sim: new O.Sim(), view: O.View(), st: { hover: null }, hit: [], sheets: [] };

    function subset(ctx) {
      var all = ctx.data.loans.slice().sort(function (a, b) { return a.id < b.id ? -1 : 1; });
      var n = O.clamp(Math.round(+ctx.P.dots), 1, all.length), f = ctx.data.focus.loan, pick = all.slice(0, n);
      if (!pick.some(function (l) { return l.id === f; })) pick[pick.length - 1] = all.filter(function (l) { return l.id === f; })[0];
      S.loans = pick; S.byId = new Map(pick.map(function (l) { return [l.id, l]; })); S.cache.clear();
      if (!S.sel || !S.byId.has(S.sel)) S.sel = f;
    }
    // вид в локальных координатах листа (центр 0,0), кеш по размеру
    function view(a, w, h, F) {
      var pad = 12 * F.ui, head = 46 * F.ui, rc = [-w / 2 + pad + 4 * F.ui, -h / 2 + head + pad * 0.6, w - 2 * pad - 8 * F.ui, h - head - pad * 2 - 14 * F.ui];
      var key = a + '|' + Math.round(w) + 'x' + Math.round(h) + '|' + S.loans.length;
      var v = S.cache.get(key);
      if (!v) { v = AV.VIEWS[a](S.loans, rc, F); S.cache.set(key, v); if (S.cache.size > 80) S.cache.clear(); }
      return v;
    }
    function morphState(ctx, ts) {
      if (ctx.reduced) return { cur: 0, prev: null, tau: 99 };
      var dwell = Math.max(2.4, (+ctx.P.period || 36) / 5), k = Math.floor(ts / dwell);
      return { cur: k % 5, prev: (k + 4) % 5, tau: k === 0 ? 99 : ts - k * dwell };
    }

    function draw(ctx) {
      if (!S.loans.length) subset(ctx);
      var P = ctx.P, ui = R.ui(ctx.W, ctx.H), ts = R.motion.time(ctx), per = Math.max(1, +P.period || 36);
      var ws = TAU * ((ts % per) / per), wind = ctx.reduced ? 0 : +P.float, ms = morphState(ctx, ts);
      var morph = P.view === 'morph' || ctx.W < 560;
      var L = V.layout(ctx, ui, P, ws, wind, morph);
      // физика: каждый лист тянется к своему якорю (ветер уже в якоре), подвес держит нить
      var sim = S.sim; sim.begin();
      L.sheets.forEach(function (s) { var q = sim.node(s.id, { x: s.x, y: s.y, r: 0, ka: 18, m: 1.4 }); q.ax = s.x; q.ay = s.y; s.q = q; });
      if (L.record) { var qr = sim.node('record', { x: L.record.x, y: L.record.y, ka: 40 }); qr.ax = L.record.x; qr.ay = L.record.y; L.record.q = qr; }
      if (L.hub) { var qh = sim.node('hub', { x: L.hub.x, y: L.hub.y, ka: 80 }); qh.ax = L.hub.x; qh.ay = L.hub.y; L.hub.q = qh; }
      (L.springs || []).forEach(function (sp) { sim.link(sp[0], sp[1], sp[2], sp[3]); });
      sim.end(); sim.advance(ctx); O.viewStep(S.view, ctx); O.hoverStep(sim, S.st, ctx);

      var plates = [];
      S.hit = [];
      L.sheets.forEach(function (s, i) {
        var lift = s.q.lift * 10 * ui, z = s.z + lift, p = O.toScreen(S.view, ctx, s.q.x, s.q.y, z), zoom = S.view.zoom;
        var a = morph ? AV.AG[ms.cur] : s.a, dx = s.q.x - s.x;
        s.sx = p[0]; s.sy = p[1]; s.sw = s.w * zoom; s.sh = s.h * zoom; s.sz = z;
        s.srot = (s.rot || 0) + (V.swingRot ? dx * 0.004 : 0);
        s.agent = a; s.v = view(a, s.sw, s.sh, { ui: ui * zoom });
        s.from = morph && ms.prev !== null && ms.tau < 0.9 + S.loans.length * 0.015 ? view(AV.AG[ms.prev], s.sw, s.sh, { ui: ui * zoom }) : null;
        s.mt = ms.tau;
        // где выбранный займ лежит на этом листе (для сходимости на полу: пол рисуется раньше листа)
        var sp = s.v.pos.get(S.sel), cr = Math.cos(s.srot), sr = Math.sin(s.srot);
        s.selG = sp && !s.from ? [p[0] + sp[0] * cr - sp[1] * sr, p[1] + sp[0] * sr + sp[1] * cr] : null;
        plates.push({ id: 'sheet/' + s.id, kind: 'rect', x: p[0], y: p[1], w: s.sw, h: s.sh, z: z, rot: s.srot, r: 6 * ui, env: 1, assembleIndex: i, sheet: s });
      });
      if (L.record) {
        var rp = O.toScreen(S.view, ctx, L.record.q.x, L.record.q.y, L.record.z);
        L.record.sx = rp[0]; L.record.sy = rp[1]; L.record.sr = L.record.r * S.view.zoom;
        plates.push({ id: 'record', kind: 'circle', x: rp[0], y: rp[1], w: 2 * L.record.sr, h: 2 * L.record.sr, z: L.record.z, env: 0, assembleIndex: 9, record: true });
      }
      if (L.hub) {
        var hp = O.toScreen(S.view, ctx, L.hub.q.x, L.hub.q.y, L.hub.z);
        L.hub.sx = hp[0]; L.hub.sy = hp[1]; L.hub.sr = L.hub.r * S.view.zoom;
        plates.push({ id: 'hub', kind: 'circle', x: hp[0], y: hp[1], w: 2 * L.hub.sr, h: 2 * L.hub.sr, z: L.hub.z, env: 0.3, hub: true });
      }
      S.L = L; S.sheets = L.sheets;
      R.frame(ctx, {
        plates: plates,
        floor: function (g, F) { if (V.floor) V.floor(g, F, ctx, L, S); converge(g, F, ctx, L); },
        print: function (g, s, F) {
          if (s.src.sheet) printSheet(g, s, F, s.src.sheet, ctx);
          else if (s.src.record) printRecord(g, s, F, ctx);
          else if (s.src.hub && V.printHub) V.printHub(g, s, F, ctx);
        },
        above: function (g, F) { overlay(g, F, ctx, L); }
      });
    }

    // лист агента: шапка, взгляд точками, выбранный займ кольцом акцентом
    function printSheet(g, s, F, sh, ctx) {
      O.paper(g, F, s);
      var ag = ctx.data.agents[AV.AG.indexOf(sh.agent)], ui = F.ui * S.view.zoom, dim = S.st.dim || 0;
      var fade = sh.q.lift > 0.3 ? 1 : 1 - 0.55 * dim;
      g.save(); g.translate(s.x, s.y); if (s.rot) g.rotate(s.rot);
      var x0 = -s.w / 2 + 14 * ui, y0 = -s.h / 2 + 22 * ui;
      R.ink.text(g, F, ag.id + ' · ' + ag.name, x0, y0, { s: 1, w: 500, alpha: fade });
      R.ink.text(g, F, sh.v.caption, x0, y0 + 14 * ui, { s: 0, mono: true, tone: 'ink3', alpha: fade });
      var v = sh.v, from = sh.from, mt = sh.mt, N = S.loans.length, step = 0.015, selP = null;
      g.save(); g.globalAlpha = from ? O.clamp((mt - N * step * 0.5) / 0.45, 0, 1) : 1; v.marks(g, F, fade); g.restore();
      var c = Math.cos(s.rot || 0), sn = Math.sin(s.rot || 0);
      S.loans.forEach(function (l, i) {
        var p = v.pos.get(l.id); if (!p) return;
        var x = p[0], y = p[1], shp = p[2], rr = v.r;
        if (from) {
          var q = from.pos.get(l.id), e = R.motion.ease(O.clamp((mt - i * step) / 0.9, 0, 1));
          if (q) { x = q[0] + (p[0] - q[0]) * e; y = q[1] + (p[1] - q[1]) * e; shp = e < 0.5 ? q[2] : p[2]; rr = from.r + (v.r - from.r) * e; }
        }
        var faint = shp === 'faint';
        AV.shapeDraw(g, x, y, rr, faint ? 'dot' : shp, R.color.css(F.T.ink2, (faint ? 0.32 : 0.82) * fade), F);
        var gx = s.x + x * c - y * sn, gy = s.y + x * sn + y * c;
        S.hit.push([gx, gy, l.id, sh.agent]);
        if (l.id === S.sel) selP = [x, y, rr, gx, gy];
        if (l.id === S.st.loanHover) S.hoverAt = [gx, gy, sh.agent];
      });
      if (selP && +ctx.P.trace) {
        g.beginPath(); g.arc(selP[0], selP[1], selP[2] + 3.5 * ui, 0, TAU);
        g.strokeStyle = R.color.css(F.T.accent); g.lineWidth = F.lineW; g.stroke();
      }
      g.restore();
    }
    function printRecord(g, s, F, ctx) {
      var l = S.byId.get(S.sel), ui = F.ui;
      g.save(); g.translate(s.x, s.y);
      g.beginPath(); g.arc(0, -s.w * 0.22, 2.8 * ui, 0, TAU); g.fillStyle = R.color.css(F.T.accent); g.fill();
      if (l && s.w > 70 * ui) {
        R.ink.text(g, F, l.id, 0, 4 * ui, { s: 2, w: 500, align: 'center' });
        R.ink.text(g, F, 'one record', 0, 20 * ui, { s: 0, mono: true, tone: 'ink3', align: 'center' });
      }
      g.restore();
    }
    // сходимость: от займа в каждом виде к его записи; печать на полу, под листами
    function converge(g, F, ctx, L) {
      if (!+ctx.P.trace || !L.record || L.record.sx == null) return;
      var srcs = S.sheets.filter(function (s) { return s.selG; }).map(function (s) { return s.selG; });
      if (!srcs.length) return;
      O.converge(g, F, srcs, [L.record.sx, L.record.sy, L.record.sr], { alpha: 0.5 });
      srcs.forEach(function (p) { g.beginPath(); g.arc(p[0], p[1], 1.6 * F.ui, 0, TAU); g.fillStyle = R.color.css(F.T.ink, 0.5); g.fill(); });
    }
    function overlay(g, F, ctx, L) {
      var m = Math.min(F.W, F.H) * 0.06, l = S.byId.get(S.sel);
      R.ink.text(g, F, 'Five agents · one model · ' + V.name, m, m, { s: 0, caps: true, tone: 'ink3' });
      R.ink.text(g, F, 'The same ' + S.loans.length + ' loans, read five ways', m, m + 24 * F.ui, { s: 2, w: 500 });
      if (l) R.ink.text(g, F, l.id + ' · ' + l.segment + ' · ' + l.country + ' · ' + AV.money(l.exposure) + ' · ' + l.stage, m, m + 42 * F.ui, { s: 0, mono: true, tone: 'ink3' });
      var ly = F.H - m - 15 * F.ui;
      R.ink.text(g, F, 'How to read', m, ly, { s: 0, caps: true, tone: 'ink3' });
      R.ink.text(g, F, 'A dot is a loan, the same in every sheet · click one to trace it · drag a sheet', m, ly + 15 * F.ui, { s: 0, mono: true, tone: 'ink3' });
      if (S.hoverAt) {   // подсказка: печать над слоем, без тени (слой взаимодействия)
        var lh = S.byId.get(S.st.loanHover);
        if (lh) {
          var x = S.hoverAt[0] + 10 * F.ui, y = S.hoverAt[1] - 12 * F.ui;
          R.ink.text(g, F, lh.id, x, y, { s: 0, w: 500, mono: true });
          R.ink.text(g, F, AV.tipOf(S.hoverAt[2], lh), x, y + 13 * F.ui, { s: 0, mono: true, tone: 'ink2' });
        }
      }
      S.hoverAt = null;
      R.ink.fictional(g, F);
    }

    function attach(ctx) {
      O.interact(ctx, {
        view: S.view, sim: S.sim, state: S.st,
        pick: function (x, y) {
          var best = null, bd = 7;
          S.hit.forEach(function (h) { var d = Math.hypot(h[0] - x, h[1] - y); if (d < bd) { bd = d; best = h; } });
          S.st.loanHover = best ? best[2] : null;
          if (best) return { id: null, loan: best[2] };
          for (var i = S.sheets.length - 1; i >= 0; i--) {
            var s = S.sheets[i], c = Math.cos(-s.srot), sn = Math.sin(-s.srot), dx = x - s.sx, dy = y - s.sy;
            var lx = dx * c - dy * sn, ly = dx * sn + dy * c;
            if (Math.abs(lx) < s.sw / 2 && Math.abs(ly) < s.sh / 2) return { id: s.id };
          }
          return null;
        },
        onClick: function (h) { if (h.loan) S.sel = h.loan; }
      });
    }

    RELIEF.def = {
      id: 'agents', title: 'Agents · ' + V.name,
      blurb: 'Five agents on one model as a hanging organism: the same loans in five readings, one loan traced through all of them.',
      groups: GROUPS,
      init: function (ctx) { subset(ctx); setTimeout(function () { attach(ctx); }, 0); },
      structural: function (ctx, path) { if (path === 'dots') subset(ctx); },
      draw: draw
    };
    return S;
  }
  window.AGENTS = { make: make };
})();
