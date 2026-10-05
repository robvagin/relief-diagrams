/* glyph · v1 «Мобиль»: состояния агента висят мобилем Калдера, каждое на своём диске.
   С листом: пять состояний, выбранное наверху в размере ручки, остальные 32 px. Без листа: один знак
   в лестнице размеров (ручка, затем 64 · 48 · 32 · 16). От 48 px точка done поднята на z2 и даёт тень. */
(function () {
  'use strict';
  var R = window.RELIEF, GL = R.glyph, O = R.org, G = R.gate;

  function list(P) {
    var sel = P.stateG, size = Math.round(+P.size || 48);
    if (+P.sheet) return [sel].concat(GL.STATES.filter(function (s) { return s !== sel; })).map(function (s, i) { return { state: s, size: i ? 32 : size }; });
    var ladder = [64, 48, 32, 24, 16].filter(function (x) { return x !== size; }).slice(0, 4);
    return [size].concat(ladder).map(function (x) { return { state: sel, size: x }; });
  }

  R.def = {
    id: 'glyph', title: 'Glyph · Mobile',
    blurb: 'Agent state in 16–96 px hung as a Calder mobile: each state on its own disc, told apart by count, not by motion.',
    groups: GL.rows,
    draw: function (ctx) {
      var P = ctx.P, tsec = R.motion.time(ctx), ui = R.ui(ctx.W, ctx.H), L = list(P);
      var items = L.map(function (q, i) {
        return { id: 'g' + i, q: q, role: i ? 'disc' : 'focus', lab: true, st: { flat: false, lv: i ? 1 : 2, env: 1 },
          z: function (S) { return { kind: 'circle', w: Math.max(S * (i ? 0.1 : 0.15), q.size * 1.9) }; } };
      });
      var Lo = O.fitMobile(ctx, O.mobile(ctx, items, tsec), O.mobile(Object.assign({}, ctx, { reduced: true }), items, 0));
      var V = O.frame(ctx, 'glyph1/' + P.sheet + '/' + P.stateG + '/' + Math.round(P.size), Lo.els.map(function (e, i) {
        return { id: e.step.id, x: e.x, y: e.y, r: e.z.w / 2, nb: [Lo.els[i - 1], Lo.els[i + 1]].filter(Boolean).map(function (q) { return q.step.id; }) };
      }));
      var TN = R.material.tints(R.tokens(ctx.theme, P.accent), +P.temp || 0), T = R.tokens(ctx.theme, P.accent);
      var plates = [], dots = [];
      Lo.els.forEach(function (e) {
        var q = e.step.q, zp = G.zpx(e.st.lv + V.lift(e.step.id) * 0.9, P, ui), sp = V.pos(e.step.id, zp);
        e.sx = sp[0]; e.sy = sp[1];
        var w = Math.max(e.z.w * V.k, q.size * 1.7);
        plates.push({ id: e.step.id, kind: 'circle', x: sp[0], y: sp[1], w: w, z: zp, env: 1, el: e, q: q,
          fill: V.fade(e.step.id) > 0.01 ? O.fadeFill({ tn: TN }, V.fade(e.step.id)) : null });
        var o = { state: q.state, size: q.size, base: zp };
        if (GL.raised(o)) dots.push(GL.disc({ P: P, ui: ui, ink: T.ink }, sp[0], sp[1], o));
      });
      R.frame(ctx, {
        plates: plates.concat(dots),
        floor: function (g, F) {
          var m = Math.min(F.W, F.H) * 0.06, I = R.ink;
          I.text(g, F, 'AGENT STATE · 16–96 PX', m, m * 0.95, { s: G.ts(F, 0), mono: true, caps: true, tone: 'ink3' });
          I.text(g, F, +P.sheet ? 'Five states, told apart by count, not by motion.' : 'One state, five sizes: the count holds at 16 px.', m, m * 0.95 + G.lh(F, G.ts(F, 3)), { s: G.ts(F, 3), w: 500 });
          I.fictional(g, F);
          Lo.wires.forEach(function (w) {
            var pts = w.pts.map(function (p) { return V.pt(p, 0); });
            if (w.el != null) { var e = Lo.els[w.el]; pts = O.threadTo(pts[0], e.sx, e.sy, Math.max(e.z.w * V.k, e.step.q.size * 1.7) / 2, false, ui); }
            O.stem(g, F, pts, { tone: w.tone, alpha: w.a, t: 0.6 });
          });
          Lo.rings.forEach(function (r) { var c = V.pt(r, 0); g.save(); g.lineWidth = F.lineW; g.strokeStyle = R.color.css(F.T.ink, 0.8);
            g.beginPath(); g.arc(c[0], c[1], 3.2 * ui, 0, Math.PI * 2); g.stroke(); g.restore(); });
          plates.forEach(function (s, i) {
            var right = s.x > F.W * 0.47 && s.x + s.w / 2 + 170 * ui < F.W, x = s.x + (right ? 1 : -1) * (s.w / 2 + 12 * ui);
            GL.caption(g, F, x, s.y - 2 * ui, s.q.state, { align: right ? 'left' : 'right', extra: s.q.size + ' px', alpha: V.dim(s.id) });
          });
        },
        print: function (g, s, F) {
          if (s.src.glyphDot) return;
          GL.draw(g, F, s.x, s.y, { state: s.src.q.state, size: s.src.q.size, t: F.tsec, since: F.tsec, reduced: ctx.reduced, alpha: V.dim(s.src.id) });
        },
        above: function (g, F) {
          F.plates.forEach(function (s) {
            if (V.focus === s.id) { g.save(); g.lineWidth = F.lineW; g.strokeStyle = R.color.css(F.T.ink, 0.8); g.setLineDash([3 * ui, 3 * ui]);
              g.beginPath(); g.arc(s.x, s.y, s.w / 2 + 9 * ui, 0, Math.PI * 2); g.stroke(); g.restore(); }
          });
        }
      });
    }
  };
})();
