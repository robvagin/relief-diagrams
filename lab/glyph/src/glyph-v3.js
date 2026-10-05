// glyph · v3 «Эпизод»: один агент (A4) на оси времени платежа D-7781 → D-7782:
// покой → чтение → сверка → блок → ждёт согласования → действие → готово. Знак-герой на плашке
// сверху живёт текущим состоянием, под ним печатная шкала со станциями и бегущей меткой времени.
// Без листа: герой держит состояние ручки, на шкале подсвечены станции этого состояния.
(function () {
  'use strict';
  const RL = window.RL, GL = window.GLYPH;
  function episode(data) {
    const d81 = data.decisions.filter((d) => d.id === 'D-7781')[0], d82 = data.decisions.filter((d) => d.id === 'D-7782')[0];
    const c = d81.checks;
    return [
      { state: 'idle', dur: 2, title: 'On call', sub: d81.loan },
      { state: 'work', verb: 'read', dur: 2.5, title: 'Read', sub: d81.loan + ' · schedule' },
      { state: 'work', verb: 'check', dur: 2.5, title: 'Check', sub: c[0].ref + ' · ' + c[1].ref },
      { state: 'error', dur: 2, title: 'Blocked', sub: d81.id + ' · ' + c[2].result },
      { state: 'wait', dur: 4, title: 'Wait', sub: 'Director approval' },
      { state: 'work', verb: 'act', dur: 1.5, title: 'Act', sub: d82.action },
      { state: 'done', dur: 3, title: 'Done', sub: d82.id + ' · allowed' }
    ];
  }
  RL.start({
    id: 'glyph',
    title: 'Glyph · Episode',
    blurb: 'Agent state over time: one agent through one payment, from idle to done.',
    draw: function (ctx) {
      const P = ctx.P, U = RL.units(ctx), W = U.W, H = U.H, m = U.m, t = RL.time(ctx);
      const T = RL.tokens(ctx.theme, P.accent), portrait = W / H < 1.05;
      const EP = episode(ctx.data), total = EP.reduce((a, s) => a + s.dur, 0);
      const pr = RL.progress(ctx);
      const play = !!P.sheet && !ctx.reduced;
      const tt = play ? (pr != null ? pr * total : ((t % total) + total) % total) : total - 0.001;
      let acc = 0, cur = 0;
      EP.forEach((s, i) => { s.t0 = acc; acc += s.dur; if (tt >= s.t0) cur = i; });
      const now = EP[cur], since = tt - now.t0;
      const heroState = play ? now.state : P.stateG, heroVerb = play ? now.verb : null;
      const size = Math.round(P.size);
      const head = m + 64 * Math.max(0.6, U.ui);
      const card = portrait ? { x: m, y: head, w: W - 2 * m, h: Math.max(size + 120, H * 0.34) }
        : { w: Math.min(W * 0.44, 560 * Math.max(0.8, U.ui)), h: Math.max(size + 130, H * 0.32), y: head + H * 0.04 };
      if (!portrait) card.x = (W - card.w) / 2;
      const plates = [RL.plate({ id: 'card', x: card.x, y: card.y, w: card.w, h: card.h, r: P.radius * U.ui, z: U.z[1] })];
      const hg = { x: card.x + card.w / 2, y: card.y + (card.h - 70 * U.ui) / 2 };
      const ho = { state: heroState, size: size, t: t, since: play ? since : t, verb: heroVerb, reduced: ctx.reduced, base: U.z[1] };
      if (GL.raised(ho)) plates.push(GL.disc(U, T, hg.x, hg.y, ho));
      // шкала: длина станции ∝ её длительности
      const ax0 = m * 1.2, ax1 = W - m * 1.2, ay = portrait ? card.y + card.h + (H - card.y - card.h) * 0.36 : H * 0.70;
      const X = (s) => ax0 + (ax1 - ax0) * s / total;
      RL.render(ctx, {
        plates: plates,
        floor: function (g, R) {
          RL.text(g, R, 'AGENT STATE · EPISODE · A4 SERVICING', m, m + RL.fs(R, 't1'), { size: 't1', mono: true, color: RL.css(T.ink3), track: 0.07 });
          RL.text(g, R, 'One payment, one agent, five states.', m, m + RL.fs(R, 't1') * 1.6 + RL.fs(R, 't4'), { size: 't4', weight: 500 });
          // ось: вырезана рельефом, пройденное напечатано
          RL.relief(g, R, (gg) => { gg.moveTo(ax0, ay); gg.lineTo(ax1, ay); });
          if (play) RL.inkLine(g, R, (gg) => { gg.moveTo(ax0, ay); gg.lineTo(X(tt), ay); }, { alpha: 0.8 });
          const narrow = (ax1 - ax0) / EP.length < 120;
          EP.forEach(function (s, i) {
            const x0 = X(s.t0), xm = X(s.t0 + s.dur / 2);
            RL.relief(g, R, (gg) => { gg.moveTo(x0, ay - 6 * R.U.ui); gg.lineTo(x0, ay + 6 * R.U.ui); }, 0.8);
            const on = play ? i <= cur : s.state === P.stateG, al = on ? 1 : 0.4;
            const gsz = narrow ? 16 : 24;
            g.save(); g.globalAlpha = al;
            GL.draw(g, R, xm, ay - 26 * R.U.ui, { state: s.state, size: gsz, t: R.t, since: play ? Math.max(0, tt - s.t0) : 99, verb: s.verb, reduced: ctx.reduced || (play && i < cur) });
            g.restore();
            const ty = ay + RL.fs(R, 't2') * 1.6, k = (i % 2 && narrow) ? RL.fs(R, 't1') * 3 : 0;
            RL.text(g, R, s.title, xm, ty + k, { size: 't2', weight: i === cur && play ? 600 : 500, align: 'center', color: RL.css(T.ink, al) });
            if (!narrow) RL.text(g, R, s.sub, xm, ty + k + RL.fs(R, 't1') * 1.35, { size: 't1', mono: true, align: 'center', color: RL.css(T.ink3, al) });
          });
          RL.text(g, R, '0 s', ax0, ay - 44 * R.U.ui, { size: 't1', mono: true, color: RL.css(T.ink3) });
          RL.text(g, R, total.toFixed(1) + ' s', ax1, ay - 44 * R.U.ui, { size: 't1', mono: true, align: 'right', color: RL.css(T.ink3) });
          if (play) {   // метка времени: волосяная линия чернилами
            const x = X(tt);
            RL.inkLine(g, R, (gg) => { gg.moveTo(x, ay - 54 * R.U.ui); gg.lineTo(x, ay + 8 * R.U.ui); }, { alpha: 0.9 });
          }
          RL.fictional(g, R);
        },
        print: function (g, p, R) {
          if (p.id !== 'card') return;
          GL.draw(g, R, hg.x, hg.y, ho);
          const M = GL.META[heroState], x = card.x + 18 * R.U.ui, y = card.y + card.h - 18 * R.U.ui;
          RL.text(g, R, M.label + (heroState === 'work' ? ' · ' + (heroVerb || GL.verbAt(ctx.reduced ? 0 : R.t)) : '') + ' · ' + size + ' px', x, y - RL.fs(R, 't1') * 1.5, { size: 't3', weight: 600 });
          RL.text(g, R, M.means + ' · ' + M.rhythm, x, y, { size: 't1', mono: true, color: RL.css(T.ink3) });
          if (play) RL.text(g, R, tt.toFixed(1) + ' s', card.x + card.w - 18 * R.U.ui, y, { size: 't1', mono: true, align: 'right', color: RL.css(T.ink3) });
        }
      });
    }
  }, {
    variant: 'v3', name: 'Glyph · v3 Episode',
    blurb: 'One agent on a time axis through one payment: idle, read, check, blocked, wait, act, done. The hero glyph lives the current station; turn the sheet off to hold the knob state.',
    scene: GL.rows.scene, rhythm: GL.rows.rhythm, noise: window.RELIEF_NOISE
  });
})();
