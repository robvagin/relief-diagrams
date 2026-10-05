// gate · v1 «Шахта»: одна стопка-герой веером вверх-вправо, окна выстроены по лучу света,
// пятно на полу видно сквозь окно нижней плашки. Правило плоско на полу слева сверху,
// путь проверок колонкой справа загорается по мере того, как ложатся плашки.
(function () {
  'use strict';
  const RL = window.RL, G = window.GATE;
  RL.start({
    id: 'gate',
    title: 'Gate · Shaft',
    blurb: 'Check before action: light reaches the floor only when the windows of every layer line up.',
    init: function () {},
    draw: function (ctx) {
      const data = ctx.data, P = ctx.P, U0 = RL.units(ctx), W = U0.W, H = U0.H, m = U0.m;
      const portrait = W / H < 1.05, compact = Math.min(W, H) < 360;
      const M = G.pick(data, P), tsec = RL.time(ctx);
      const st = G.timeline(P, M, tsec, ctx.reduced, RL.progress(ctx));
      // раскладка: правило, стопка, путь (портрет: сверху вниз)
      const pw = portrait ? Math.min(W * 0.62, H * 0.42) : compact ? Math.min(W * 0.36, H * 0.6) : Math.min(W * 0.34, H * 0.62 * 1.3);
      const ph = pw * 0.62, n = M.layers.length;
      const stackC = portrait ? [W * 0.46, H * 0.46] : compact ? [W * 0.40, H * 0.64] : [W * 0.40, H * 0.56];
      const fan = [0.14 * pw, -0.2 * ph], rel = [0.72, 0.2];
      const B = [stackC[0] - pw / 2 - fan[0] * (n - 1) / 2, stackC[1] - ph / 2 - fan[1] * (n - 1) / 2];
      let geo = null, nodes = null;
      const show = st.mode !== 'instruction' || st.appear.some((a) => a > 0);
      const R0 = { U: U0, L: RL.light(P, W, H, U0.ui), t: tsec };
      geo = G.stack(ctx, R0, M, st, { B: B, pw: pw, ph: ph, fan: fan, rel: rel });
      const steps = G.steps(M, st);
      const tx = portrait ? m : W * 0.70, ty0 = portrait ? H * 0.74 : H * 0.24, ty1 = portrait ? H - m * 1.6 : H * 0.78;
      nodes = steps.map(function (s, i) {
        const k = i / Math.max(1, steps.length - 1);
        return portrait ? Object.assign(s, { x: m + k * (W - 2 * m), y: ty0 }) : Object.assign(s, { x: tx, y: RL.mix(ty0, ty1, k) });
      });
      RL.render(ctx, {
        plates: geo.plates,
        floor: function (g, R) {
          const T = R.T, k = show ? 1 : 0;
          const rule = G.ruleText(M);
          // правило плоско: в инструкции оно герой по центру стопки, дальше уходит в угол
          const hero = st.mode === 'instruction' && !st.appear.some((a) => a > 0.01);
          if (hero) {
            const lines = G.wrap(g, R, rule, Math.min(W - 2 * m, pw * 1.5), { size: 't6', weight: 500 });
            const lh = RL.fs(R, 't6') * 1.15, y0 = stackC[1] - lines.length * lh / 2 + lh * 0.8;
            RL.text(g, R, (M.rule ? M.rule.id : '') + ' · INSTRUCTION', stackC[0] - pw * 0.75, y0 - lh * 1.1, { size: 't1', mono: true, color: RL.css(T.ink3), caps: true, track: 0.07 });
            lines.forEach((l, i) => RL.text(g, R, l, stackC[0] - pw * 0.75, y0 + i * lh, { size: 't6', weight: 500 }));
          } else {
            const rs = compact ? 't2' : 't4', lines = G.wrap(g, R, rule, portrait ? W - 2 * m : W * 0.34, { size: rs, weight: 500 });
            RL.text(g, R, (M.rule ? M.rule.id : '') + ' · RULE', m, m + RL.fs(R, 't1'), { size: 't1', mono: true, color: RL.css(T.ink3), track: 0.07 });
            lines.forEach((l, i) => RL.text(g, R, l, m, m + RL.fs(R, 't1') * 1.6 + RL.fs(R, rs) * (1.15 * i + 1), { size: rs, weight: 500 }));
          }
          if (P.trace && !hero) {
            G.drawPath(g, R, nodes, R.t, { side: portrait ? 'below' : 'right', labels: !compact && (!portrait || W > 520) });
            if (st.checks >= n && !compact) {
              const px = portrait ? m : W * 0.70, lines = G.wrapProto(g, R, G.protocol(M, st), W - px - m);
              const lh = RL.fs(R, 't1') * 1.5, py = portrait ? H - m * 0.6 - (lines.length - 1) * lh : ty1 + RL.fs(R, 't2') * 3.2;
              lines.forEach((l, i) => RL.text(g, R, l, px, py + i * lh, { size: 't1', mono: true, color: RL.css(T.ink2) }));
            }
          }
          // решение: одна тёплая точка в пятне, когда окна совпали
          if (st.lit > 0) RL.dot(g, geo.S[0], geo.S[1], Math.max(2.5, 3.5 * R.U.ui) * st.lit, RL.css(T.accent, st.lit));
          RL.fictional(g, R);
          void k;
        },
        print: function (g, p, R) { G.printLayer(g, p, R, st); },
        over: function (g, R) { G.ring(g, R, geo.plates[geo.plates.length - 1], st.lit); }
      });
    }
  }, {
    variant: 'v1', name: 'Gate · v1 Shaft',
    blurb: 'One hero stack fanned up and right; windows line up along the light ray. Rule printed flat, checks lit one by one in a column.',
    scene: G.rows.scene, rhythm: G.rows.rhythm, data: G.rows.data, noise: window.RELIEF_NOISE
  });
})();
