// gate · v2 «Маршрут»: стопка разложена лентой слева направо, каждая плашка показывает свою
// кромку-этап; под лентой печатный маршрут проверок (ccc-pipeline: шаги, рёбра, бегущий
// пунктир на активном ребре), от узла к своей плашке поднимается выноска. Широкий низкий кадр.
(function () {
  'use strict';
  const RL = window.RL, G = window.GATE;
  RL.start({
    id: 'gate',
    title: 'Gate · Route',
    blurb: 'Check before action: the layers laid out as a route; light reaches the floor only when every window lines up.',
    draw: function (ctx) {
      const data = ctx.data, P = ctx.P, U0 = RL.units(ctx), W = U0.W, H = U0.H, m = U0.m;
      const portrait = W / H < 1.05, compact = Math.min(W, H) < 360;
      const M = G.pick(data, P), tsec = RL.time(ctx), n = M.layers.length;
      const st = G.timeline(P, M, tsec, ctx.reduced, RL.progress(ctx));
      // лента: плашки шагают вправо на 0.24 ширины, окна выстроены по свету
      const band = portrait ? W - 2 * m : W * 0.86;
      const fanK = 0.3, pw = band / (1 + fanK * (n - 1) * 1.02), ph = Math.min(pw * 0.5, H * (portrait ? 0.22 : 0.28));
      const fan = [fanK * pw, 0], rel = [0.86, 0.46];
      const yMid = portrait ? H * 0.42 : H * 0.47;
      const B = [(W - band) / 2, yMid - ph / 2];
      const R0 = { U: U0, L: RL.light(P, W, H, U0.ui), t: tsec };
      const geo = G.stack(ctx, R0, M, st, { B: B, pw: pw, ph: ph, fan: fan, rel: rel });
      const steps = G.steps(M, st);
      // маршрут: узел под видимой кромкой своей плашки; решение под шахтой
      const yR = portrait ? H * 0.70 : H * 0.79;
      // узлы маршрута ровным шагом по ширине ленты; выноска с одним изломом к кромке своей плашки
      // видимая кромка: шаг веера минус сдвиг окна на уровень по свету (без сдвига блокирующей плашки)
      const gapPx = P.gap * U0.ui * P.zscale, L0 = R0.L;
      const strip = Math.max(40, fan[0] - (L0.lamp ? 0 : gapPx * L0.cot * L0.dx));
      const top = B[1] + ph + 6 * U0.ui;
      steps.forEach(function (s, i) {
        s.x = i < n ? B[0] + i * strip + strip * 0.5 : Math.max(B[0] + n * strip + strip * 0.5, geo.plates.length ? geo.plates[geo.plates.length - 1].hole.x + geo.win / 2 : 0);
        s.y = yR;
      });
      const col = Math.max(60, strip - 12 * U0.ui);
      const show = st.appear.some((a) => a > 0.01);
      RL.render(ctx, {
        plates: geo.plates,
        floor: function (g, R) {
          const T = R.T, rule = G.ruleText(M);
          const hero = st.mode === 'instruction' && !show;
          const rs = hero ? 't6' : compact ? 't2' : 't5';
          const maxW = hero ? W - 2 * m : portrait ? W - 2 * m : W * 0.56;
          const lines = G.wrap(g, R, rule, maxW, { size: rs, weight: 500 });
          const lh = RL.fs(R, rs) * 1.15;
          const y0 = hero ? H * 0.5 - (lines.length - 1) * lh / 2 : m + RL.fs(R, 't1') * 1.6 + lh;
          RL.text(g, R, (M.rule ? M.rule.id : '') + (hero ? ' · INSTRUCTION' : ' · RULE'), m, y0 - lh - RL.fs(R, 't1') * 0.4, { size: 't1', mono: true, color: RL.css(T.ink3), track: 0.07 });
          lines.forEach((l, i) => RL.text(g, R, l, m, y0 + i * lh, { size: rs, weight: 500 }));
          if (hero) { RL.fictional(g, R); return; }
          if (P.trace) {
            // выноски: от узла маршрута вверх к кромке плашки (рельеф, вырезано в материале)
            steps.forEach(function (s, i) {
              if ((i < n && st.appear[i] <= 0.01) || (i === n && st.checks < n)) return;
              RL.relief(g, R, (gg) => { gg.moveTo(s.x, s.y - 8 * R.U.ui); gg.lineTo(s.x, top); }, 0.7);
            });
            G.drawPath(g, R, steps, R.t, { side: 'below', labels: !compact, colW: col });
            if (st.checks >= n && !compact) {
              const lines2 = G.wrapProto(g, R, G.protocol(M, st), portrait ? W - 2 * m : W * 0.56);
              const lh2 = RL.fs(R, 't1') * 1.5;
              lines2.forEach((l, i) => RL.text(g, R, l, m, y0 + lines.length * lh + i * lh2 + lh2 * 0.4, { size: 't1', mono: true, color: RL.css(T.ink2) }));
            }
          }
          if (st.lit > 0) RL.dot(g, geo.S[0], geo.S[1], Math.max(2.5, 3.5 * R.U.ui) * st.lit, RL.css(T.accent, st.lit));
          RL.fictional(g, R);
        },
        print: function (g, p, R) { G.printLayer(g, p, R, st, { labelX: 10 * R.U.ui }); },
        over: function (g, R) { G.ring(g, R, geo.plates[geo.plates.length - 1], st.lit); }
      });
    }
  }, {
    variant: 'v2', name: 'Gate · v2 Route',
    blurb: 'The same stack laid out as a band left to right; each plate shows its edge as a stage. A printed route of checks runs underneath with leaders up to the plates.',
    scene: G.rows.scene, rhythm: G.rows.rhythm, data: G.rows.data, noise: window.RELIEF_NOISE
  });
})();
