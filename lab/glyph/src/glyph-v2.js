/* glyph · v2 «Осьминог»: тело — одна модель книги, пять щупалец к пяти агентам. На кончике щупальца
   диск агента с живым знаком состояния из данных (A2 блок по D-7790, A5 готово по D-7804, A1 читает книгу,
   A3 на связи); агент A4 в фокусе берёт состояние из ручки и крупнее. По щупальцу бусинами — объекты,
   с которыми агент сейчас работает. Щупальца колышутся волной вдоль длины. */
(function () {
  'use strict';
  var R = window.RELIEF, GL = R.glyph, O = R.org, G = R.gate;
  var TAU = Math.PI * 2, D2R = Math.PI / 180;

  function agents(data, P) {
    var by = function (a) { return data.decisions.filter(function (d) { return d.agent === a; }); };
    return data.agents.map(function (a) {
      var ds = by(a.id), st = 'idle', verb = null, beads = [];
      ds.forEach(function (d) { beads.push(d.id); d.checks.forEach(function (c) { if (/^R-/.test(c.ref) && beads.indexOf(c.ref) < 0) beads.push(c.ref); }); });
      if (a.id === 'A1') { st = 'work'; verb = 'read'; beads = [data.meta.counts.loans + ' loans', 'R-221', 'R-518']; }
      if (a.id === 'A2') st = 'error';
      if (a.id === 'A3') { beads = [data.meta.counts.borrowers + ' borrowers']; }
      if (a.id === 'A5') st = 'done';
      if (a.id === 'A4') st = P.stateG;
      return { a: a, state: st, verb: verb, beads: beads.slice(0, 3), focus: a.id === 'A4' };
    });
  }

  R.def = {
    id: 'glyph', title: 'Glyph · Octopus',
    blurb: 'Agent state on one model: five tentacles, an agent at each tip with its live state glyph, the objects it works on as beads.',
    groups: GL.rows,
    draw: function (ctx) {
      var P = ctx.P, data = ctx.data || R.data(), tsec = R.motion.time(ctx), W = ctx.W, H = ctx.H, ui = R.ui(W, H);
      var A = agents(data, P), S = Math.min(W, H), flt = +P.float || 0, still = !!ctx.reduced, size = Math.round(+P.size || 48);
      var m = S * 0.06, top = m + 80 * ui, cx = W * 0.5, cy = top + (H - top - m) * 0.52, hubR = S * 0.085;
      var R0 = Math.min((W - 2 * m) * 0.5 - 170 * ui, (H - top - m) * 0.5) * 0.95;
      var els = [], arms = [];
      A.forEach(function (ag, a) {
        var base = -90 * D2R + a * TAU / A.length + 36 * D2R, curl = -0.45;
        var wave = function (f) { return O.swing(ctx.seed, 'ag' + a + '/' + Math.round(f * 8), tsec, P, 0.2 * f * flt, still ? 0 : 1); };
        var len = R0 - hubR, pt = function (f) { var th = base + curl * f * f * 1.4 + wave(f), r = hubR * 0.9 + len * f; return [cx + Math.cos(th) * r, cy + Math.sin(th) * r * 0.9]; };
        var spine = []; for (var q = 0; q <= 14; q++) spine.push(pt(q / 14));
        arms.push(spine);
        ag.beads.forEach(function (b, k) {
          var c = pt(0.26 + k * 0.25);
          els.push({ id: ag.a.id + '/b' + k, kind: 'bead', x: c[0], y: c[1], w: S * 0.035, label: b, arm: a, ag: ag });
        });
        var tip = pt(1), gs = ag.focus ? size : 32;
        els.push({ id: ag.a.id, kind: 'agent', x: tip[0], y: tip[1], w: Math.max(S * (ag.focus ? 0.13 : 0.095), gs * 1.8), gs: gs, arm: a, ag: ag });
      });
      var nodes = [{ id: 'hub', x: cx, y: cy, r: hubR, nb: A.map(function (ag) { return ag.beads.length ? ag.a.id + '/b0' : ag.a.id; }) }];
      els.forEach(function (e, i) {
        var prevSame = els[i - 1] && els[i - 1].arm === e.arm ? els[i - 1].id : 'hub', next = els[i + 1] && els[i + 1].arm === e.arm ? els[i + 1].id : null;
        nodes.push({ id: e.id, x: e.x, y: e.y, r: e.w / 2, nb: [prevSame, next].filter(Boolean) });
      });
      var V = O.frame(ctx, 'glyph2/' + size + '/' + P.stateG, nodes);
      var T = R.tokens(ctx.theme, P.accent), TN = R.material.tints(T, +P.temp || 0);
      var hz = R.zh(2, P, ui) + V.lift('hub') * R.zh(1, P, ui), hp = V.pos('hub', hz);
      var plates = [{ id: 'hub', kind: 'circle', x: hp[0], y: hp[1], w: hubR * 2 * V.k, z: hz, env: 0.5, hub: true }], dots = [];
      els.forEach(function (e) {
        var lv = e.kind === 'agent' ? (e.ag.focus ? 2 : (e.ag.state === 'done' ? 2 : e.ag.state === 'error' ? 0 : 1)) : 1;
        var zp = G.zpx(lv + V.lift(e.id) * 0.9, P, ui), sp = V.pos(e.id, zp);
        e.sx = sp[0]; e.sy = sp[1];
        plates.push({ id: e.id, kind: 'circle', x: sp[0], y: sp[1], w: e.w * V.k, z: zp, env: e.ag.state === 'done' || e.ag.state === 'error' ? 0 : 1, el: e,
          fill: V.fade(e.id) > 0.01 ? O.fadeFill({ tn: TN }, V.fade(e.id)) : null });
        if (e.kind === 'agent' && (+P.sheet || e.ag.focus)) {
          var o = { state: e.ag.state, size: e.gs, base: zp };
          if (GL.raised(o)) dots.push(GL.disc({ P: P, ui: ui, ink: T.ink }, sp[0], sp[1], o));
        }
      });
      R.frame(ctx, {
        plates: plates.concat(dots),
        floor: function (g, F) {
          var I = R.ink;
          I.text(g, F, 'AGENT STATE · ONE MODEL', m, m * 0.95, { s: G.ts(F, 0), mono: true, caps: true, tone: 'ink3' });
          I.text(g, F, 'Five agents read the same loans the same way.', m, m * 0.95 + G.lh(F, G.ts(F, 3)), { s: G.ts(F, 3), w: 500 });
          I.fictional(g, F);
          arms.forEach(function (sp, a) {
            var pts = [hp];
            plates.forEach(function (s) { if (s.el && s.el.arm === a) pts.push([s.x, s.y]); });
            O.stem(g, F, pts, { tone: A[a].focus ? 'ink' : 'ink2', alpha: A[a].focus ? 0.85 : 0.6, t: 0.75 });
          });
          plates.forEach(function (s) {
            var e = s.el; if (!e) return;
            var right = s.x >= hp[0], x = s.x + (right ? 1 : -1) * (s.w / 2 + 9 * ui), al = V.dim(s.id);
            if (e.kind === 'agent') {
              O.label(g, F, x, s.y - 2 * ui, e.ag.a.id + ' · ' + e.ag.a.name, GL.META[e.ag.state].label + (e.ag.state === 'work' ? ' · ' + (e.ag.verb || GL.verbAt(ctx.reduced ? 0 : F.tsec)) : '') + ' · ' + e.gs + ' px',
                { align: right ? 'left' : 'right', s: G.ts(F, 1), ss: G.ts(F, 0), lh: G.lh(F, G.ts(F, 1)), alpha: al });
            }
          });
        },
        print: function (g, s, F) {
          var src = s.src;
          if (src.hub) {
            R.ink.text(g, F, 'One model', s.x, s.y - 2 * ui, { s: G.ts(F, 2), w: 600, align: 'center', alpha: V.dim('hub') });
            R.ink.text(g, F, data.meta.counts.loans + ' loans', s.x, s.y + G.lh(F, G.ts(F, 0)) + 2 * ui, { s: G.ts(F, 0), mono: true, tone: 'ink3', align: 'center', alpha: V.dim('hub') });
            return;
          }
          if (src.glyphDot || !src.el || src.el.kind !== 'agent') return;
          var e = src.el;
          if (+P.sheet || e.ag.focus) GL.draw(g, F, s.x, s.y, { state: e.ag.state, size: e.gs, t: F.tsec, since: F.tsec, verb: e.ag.verb, reduced: ctx.reduced, alpha: V.dim(src.id) });
        },
        above: function (g, F) {
          // подписи бусин поверх: соседняя бусина их не закрывает
          plates.forEach(function (s) {
            var e = s.el; if (!e || e.kind !== 'bead') return;
            var right = s.x >= hp[0], x = s.x + (right ? 1 : -1) * (s.w / 2 + 7 * ui);
            R.ink.text(g, F, e.label, x, s.y + 4 * ui, { s: G.ts(F, 0), mono: true, tone: 'ink2', align: right ? 'left' : 'right', alpha: V.dim(s.id) });
          });
          F.plates.forEach(function (s) {
            if (V.focus === s.id) { g.save(); g.lineWidth = F.lineW; g.strokeStyle = R.color.css(F.T.ink, 0.8); g.setLineDash([3 * ui, 3 * ui]);
              g.beginPath(); g.arc(s.x, s.y, s.w / 2 + 9 * ui, 0, TAU); g.stroke(); g.restore(); }
          });
        }
      });
    }
  };
})();
