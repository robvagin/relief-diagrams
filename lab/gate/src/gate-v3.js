/* gate · v3 «Осьминог»: тело — книга решений, из него изгибаются щупальца, по одному на решение книги.
   По щупальцу бусинами идут шаги проверки: запрос, правило, основание, согласование; на кончике — решение.
   Щупальца колышутся волной вдоль длины, как под водой (гармоники одного периода). Щупальце в фокусе
   крупнее и проигрывает цикл; остальные стоят в состоянии из данных. Клик по бусине переводит фокус. */
(function () {
  'use strict';
  var R = window.RELIEF, G = R.gate, O = R.org;
  var TAU = Math.PI * 2, D2R = Math.PI / 180;

  function layout(ctx, data, P, tsec, still, trs, Ms) {
    var W = ctx.W, H = ctx.H, ui = R.ui(W, H), S = Math.min(W, H), flt = +P.float || 0;
    var cx = W * 0.46, cy = H * 0.58, hubR = S * 0.085;
    var els = [], arms = [];
    var nArm = Ms.length, gapK = (+P.gap || 22) / 22, fi = 0;
    Ms.forEach(function (M, i) { if (M.focus) fi = i; });
    Ms.forEach(function (M, a) {
      var focus = M.focus, tr = trs[a];
      // лучи веером из тела: щупальце фокуса в свободный сектор вправо-вверх, остальные через равный угол;
      // все закручены в одну сторону (вертушка), поэтому не пересекаются
      var order = (a - fi + nArm) % nArm, base = -8 * D2R + order * TAU / nArm;
      var curl = focus ? -0.42 : -0.5;
      var len = S * (focus ? 0.66 : 0.36) * gapK, n = M.steps.length;
      var wave = function (f) { return O.swing(ctx.seed, 'arm' + a + '/' + Math.round(f * 8), tsec, P, 0.22 * f * flt, still ? 0 : 1); };
      var pt = function (f) {
        var th = base + curl * f * f * 1.6 + wave(f), r = hubR * 0.9 + len * f;
        return [cx + Math.cos(th) * r, cy + Math.sin(th) * r * 0.86];
      };
      var spine = []; for (var q = 0; q <= 16; q++) spine.push(pt(q / 16));
      arms.push({ spine: spine, focus: focus, M: M, tr: tr });
      M.steps.forEach(function (s, k) {
        var f = (focus ? 0.2 : 0.24) + (focus ? 0.8 : 0.76) * (k / Math.max(1, n - 1)), c = pt(f), kf = focus ? 1.35 : 1;
        var isDec = s.role === 'decision';
        var z = isDec ? { kind: 'circle', w: S * 0.085 * kf } : s.kind === 'disc' ? { kind: 'circle', w: S * 0.05 * kf }
          : { kind: 'rect', w: S * (s.role === 'request' ? 0.12 : 0.1) * kf, h: S * 0.062 * kf };
        var tan = Math.atan2(pt(Math.min(1, f + 0.02))[1] - c[1], pt(Math.min(1, f + 0.02))[0] - c[0]);
        els.push({ id: M.dec.id + '/' + s.id, step: s, M: M, tr: tr, st: tr.steps[k], z: z, x: c[0], y: c[1], focus: focus, arm: a, k: k,
          rot: z.kind === 'rect' ? Math.max(-8 * D2R, Math.min(8 * D2R, Math.sin(tan) * 0.12)) : 0,
          half: z.kind === 'circle' ? z.w / 2 : z.h / 2 });
      });
    });
    return { els: els, arms: arms, hub: [cx, cy], hubR: hubR, ui: ui, S: S };
  }

  /* габарит в покое → масштаб и сдвиг: организм с подписями решений целиком в кадре (кинематика, закон 9) */
  function fit(ctx, Lo, Lr) {
    var W = ctx.W, H = ctx.H, m = Math.min(W, H) * 0.06, lab = 170 * Lr.ui, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    var hx = Lr.hub[0];
    Lr.els.forEach(function (e) {
      var hw = e.z.w / 2, hh = (e.z.h || e.z.w) / 2, isDec = e.step.role === 'decision';
      x0 = Math.min(x0, e.x - hw - (isDec && e.x < hx ? lab : 0)); x1 = Math.max(x1, e.x + hw + (isDec && e.x >= hx ? lab : 0));
      y0 = Math.min(y0, e.y - hh); y1 = Math.max(y1, e.y + hh);
    });
    var top = m + 80 * Lr.ui, bw = W - 2 * m, bh = H - top - m;
    var k = Math.min(1.1, bw / (x1 - x0), bh / (y1 - y0));
    var dx = m + (bw - (x1 - x0) * k) / 2 - x0 * k, dy = top + (bh - (y1 - y0) * k) / 2 - y0 * k;
    var T = function (p) { return [p[0] * k + dx, p[1] * k + dy]; };
    Lo.els.forEach(function (e) { var q = T([e.x, e.y]); e.x = q[0]; e.y = q[1]; e.half *= k; e.z = { kind: e.z.kind, w: e.z.w * k, h: e.z.h ? e.z.h * k : undefined }; });
    Lo.arms.forEach(function (a) { a.spine = a.spine.map(T); });
    Lo.hub = T(Lo.hub); Lo.hubR *= k;
    return Lo;
  }

  R.def = {
    id: 'gate', title: 'Gate · Octopus',
    blurb: 'Check before action across the book: one body, a tentacle per decision, checks as beads along it; the decision in focus plays its cycle.',
    groups: G.rows,
    draw: function (ctx) {
      var P = ctx.P, data = ctx.data || R.data(), tsec = R.motion.time(ctx);
      var Mf = G.pick(data, P), ui = R.ui(ctx.W, ctx.H);
      var Ms = data.decisions.map(function (d) {
        var M = d.id === Mf.dec.id ? Mf : G.model(data, d.id, 3);
        M.focus = d.id === Mf.dec.id;
        return M;
      });
      var trs = Ms.map(function (M) {
        return M.focus ? G.track(P, M, tsec, ctx.reduced, null)
          : G.track(Object.assign({}, P, { state: M.dec.status === 'allowed' ? 'allowed' : 'blocked' }), M, tsec, true, null);
      });
      var Lo = fit(ctx, layout(ctx, data, P, tsec, !!ctx.reduced, trs, Ms), layout(ctx, data, P, 0, true, trs, Ms));
      var nodes = [{ id: 'hub', x: Lo.hub[0], y: Lo.hub[1], r: Lo.hubR, nb: Ms.map(function (M) { return M.dec.id + '/req'; }) }];
      Lo.els.forEach(function (e, i) {
        var prev = e.k === 0 ? 'hub' : Lo.els[i - 1].id, next = Lo.els[i + 1] && Lo.els[i + 1].arm === e.arm ? Lo.els[i + 1].id : null;
        nodes.push({ id: e.id, x: e.x, y: e.y, r: e.z.kind === 'circle' ? e.z.w / 2 : Math.max(e.z.w, e.z.h) / 2, nb: [prev, next].filter(Boolean) });
      });
      var V = O.frame(ctx, 'gate3/' + Mf.dec.id + '/' + Mf.steps.length, nodes);
      // клик по бусине чужого щупальца переводит фокус решения
      if (V.focus && V.focus !== 'hub') { var did = V.focus.split('/')[0]; if (did !== Mf.dec.id && did !== P.decision) setTimeout(function () { Scene.set('decision', did); }, 0); }
      var TN = R.material.tints(R.tokens(ctx.theme, P.accent), +P.temp || 0);
      var hz = G.zpx(2 + V.lift('hub') * 0.9, P, ui), hp = V.pos('hub', hz);
      var plates = [{ id: 'hub', kind: 'circle', x: hp[0], y: hp[1], w: Lo.hubR * 2 * V.k, z: hz, env: 0.4, hub: true,
        fill: V.fade('hub') > 0.01 ? O.fadeFill({ tn: TN }, V.fade('hub')) : null }];
      Lo.els.forEach(function (e) {
        var zp = G.zpx(e.st.lv + (e.st.flat ? 0 : V.lift(e.id) * 0.9), P, ui), sp = V.pos(e.id, zp);
        e.sx = sp[0]; e.sy = sp[1];
        plates.push({ id: e.id, kind: e.z.kind, x: sp[0], y: sp[1], w: e.z.w * V.k, h: (e.z.h || e.z.w) * V.k, r: e.z.kind === 'rect' ? 3 * ui : null,
          rot: e.rot, z: zp, env: e.st.env, el: e, fill: V.fade(e.id) > 0.01 ? O.fadeFill({ tn: TN }, V.fade(e.id)) : null });
      });
      R.frame(ctx, {
        plates: plates,
        floor: function (g, F) {
          G.header(g, F, Mf, trs[Ms.indexOf(Mf)]);
          // щупальца: от тела через бусины, сужения нет (одна толщина), волна вдоль длины
          Lo.arms.forEach(function (a, ai) {
            var pts = [hp];
            Lo.els.forEach(function (e) { if (e.arm === ai) pts.push([e.sx, e.sy]); });
            var tip = V.pt(a.spine[a.spine.length - 1], 0), last = pts[pts.length - 1];
            pts.push([last[0] + (tip[0] - last[0]) * 0.6, last[1] + (tip[1] - last[1]) * 0.6]);
            O.stem(g, F, pts, { tone: a.focus ? 'ink' : 'ink2', alpha: a.focus ? 0.85 : 0.5, t: 0.75 });
          });
          // подписи: у решений всех щупалец; полные строки только у щупальца в фокусе (как Satellites)
          plates.forEach(function (s) {
            var e = s.el; if (!e) return;
            var dx = s.x - hp[0], dy = s.y - hp[1], right = dx >= 0, x = s.x + (right ? 1 : -1) * (s.w / 2 + 8 * ui);
            if (e.step.role === 'decision') {
              O.label(g, F, x, s.y - 2 * ui, e.M.dec.id + ' · ' + G.title(e.M, e.step, e.tr), e.M.dec.action, { align: right ? 'left' : 'right', s: G.ts(F, 1), ss: G.ts(F, 0), lh: G.lh(F, G.ts(F, 1)), alpha: V.dim(s.id) });
            } else if (e.focus && s.kind === 'circle') {
              R.ink.text(g, F, G.sub(e.step, e.tr), x, s.y + 4 * ui, { s: G.ts(F, 0), mono: true, tone: e.st.st === 'fail' ? 'ink' : 'ink3', align: right ? 'left' : 'right', alpha: V.dim(s.id) });
            }
          });
        },
        print: function (g, s, F) {
          var src = s.src;
          if (src.hub) {
            R.ink.text(g, F, 'Loan book', s.x, s.y - 2 * ui, { s: G.ts(F, 2), w: 600, align: 'center', alpha: V.dim('hub') });
            R.ink.text(g, F, data.decisions.length + ' decisions', s.x, s.y + G.lh(F, G.ts(F, 0)) + 2 * ui, { s: G.ts(F, 0), mono: true, tone: 'ink3', align: 'center', alpha: V.dim('hub') });
            return;
          }
          var e = src.el, al = V.dim(src.id);
          if (e.step.role === 'decision') {
            if (e.st.st === 'pass' || e.st.st === 'fail') { g.save(); g.fillStyle = R.color.css(F.T.accent, al); g.beginPath(); g.arc(s.x, s.y, Math.max(2.5, s.w * 0.07), 0, TAU); g.fill(); g.restore(); }
            return;
          }
          if (src.kind === 'rect') {
            if (e.focus) G.printSheet(g, s, F, e.step, e.tr, { alpha: al });
            else R.ink.text(g, F, G.fit(e.step.role === 'request' ? 'Request' : e.step.title, s.w - 10 * ui, 7.4 * ui * (G.ts(F, 0) ? 1.2 : 1)), s.x, s.y + 4 * ui, { s: G.ts(F, 0), mono: true, tone: 'ink2', align: 'center', alpha: al });
          } else if (e.focus) G.printDisc(g, s, F, e.step, e.tr, { alpha: al });
        },
        above: function (g, F) {
          F.plates.forEach(function (s) {
            var e = s.src.el;
            if (e && e.st.st === 'fail' && e.focus) G.blockRing(g, F, s);
            if (V.focus === s.id) { g.save(); g.lineWidth = F.lineW; g.strokeStyle = R.color.css(F.T.ink, 0.8); g.setLineDash([3 * ui, 3 * ui]);
              g.beginPath(); g.arc(s.x, s.y, Math.max(s.w, s.h) / 2 + 9 * ui, 0, TAU); g.stroke(); g.restore(); }
          });
        }
      });
    }
  };
})();
