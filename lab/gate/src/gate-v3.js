// gate · v3 «Сравнение»: фокус и контекст. Выбранное решение крупной стопкой слева, три других
// решения книги малыми стопками колонкой справа, каждое в своём состоянии из данных: где окна
// совпали, свет дошёл; где нет, метка у слабейшего слоя. Клик по малой стопке переводит фокус.
(function () {
  'use strict';
  const RL = window.RL, G = window.GATE;
  let HITS = [];
  RL.start({
    id: 'gate',
    title: 'Gate · Compare',
    blurb: 'Check before action across the book: one decision in focus, the others as small stacks in context.',
    init: function (ctx) {
      ctx.canvas.addEventListener('pointerup', function (e) {
        const r = ctx.canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        const h = HITS.filter((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h)[0];
        if (h) Scene.set('decision', h.id);
      });
    },
    draw: function (ctx) {
      const data = ctx.data, P = ctx.P, U0 = RL.units(ctx), W = U0.W, H = U0.H, m = U0.m;
      const portrait = W / H < 1.05, compact = Math.min(W, H) < 360;
      const M = G.pick(data, P), tsec = RL.time(ctx);
      const st = G.timeline(P, M, tsec, ctx.reduced, RL.progress(ctx));
      const R0 = { U: U0, L: RL.light(P, W, H, U0.ui), t: tsec };
      const head = m + RL.fs(R0, 't1') * 1.6 + RL.fs(R0, 't4') * 2.6;
      // сетка: фокус 0.6 ширины слева, контекст колонкой справа (портрет: контекст рядом снизу)
      const hero = portrait ? { x: m, y: head, w: W - 2 * m, h: (H - head - m) * 0.62 }
        : { x: m, y: head, w: (W - 2 * m) * 0.6, h: H - head - m * 1.4 };
      const side = portrait ? { x: m, y: hero.y + hero.h + m * 0.5, w: W - 2 * m, h: H - hero.y - hero.h - m * 1.2 }
        : { x: hero.x + hero.w + m, y: head, w: W - hero.w - 3 * m, h: H - head - m * 1.4 };
      const plates = [];
      // фокус
      const hn = M.layers.length;
      const hpw = Math.min(hero.w * 0.62, hero.h * 1.05), hph = hpw * 0.6;
      const hfan = [0.12 * hpw, -0.16 * hph];
      const hB = [hero.x + (hero.w - hpw - hfan[0] * (hn - 1)) * 0.42, hero.y + (hero.h - hph) * (portrait ? 0.2 : 0.42) - hfan[1] * (hn - 1) / 2];
      const hg = G.stack(ctx, R0, M, st, { B: hB, pw: hpw, ph: hph, fan: hfan, rel: [0.7, 0.24] });
      hg.plates.forEach((p) => { p.hero = true; plates.push(p); });
      // контекст: остальные решения книги, состояние из данных
      const others = data.decisions.filter((d) => d.id !== M.dec.id);
      const ctxs = [];
      const k = others.length, cellH = portrait ? side.h : side.h / k, cellW = portrait ? side.w / k : side.w;
      HITS = [];
      others.forEach(function (d, i) {
        const Mc = G.model(data, d.id, P.plates);
        const sc = G.timeline(Object.assign({}, P, { state: d.status === 'allowed' ? 'allowed' : 'blocked' }), Mc, tsec, true, null);
        const cx = portrait ? side.x + i * cellW : side.x, cy = portrait ? side.y : side.y + i * cellH;
        const cn = Mc.layers.length, cpw = Math.min(cellW * 0.5, cellH * 0.78 * 1.4), cph = cpw * 0.6;
        const cfan = [0.12 * cpw, -0.16 * cph];
        const cB = [cx + cellW * 0.04, cy + (cellH - cph) * 0.42 - cfan[1] * (cn - 1) / 2];
        const cg = G.stack(ctx, R0, Mc, sc, { B: cB, pw: cpw, ph: cph, fan: cfan, rel: [0.7, 0.24] });
        cg.plates.forEach((p) => { p.small = true; plates.push(p); });
        ctxs.push({ M: Mc, st: sc, g: cg, x: cx, y: cy, w: cellW, h: cellH, tx: cB[0] + cpw + cfan[0] * (cn - 1) + 14 * U0.ui });
        HITS.push({ id: d.id, x: cx, y: cy, w: cellW, h: cellH });
      });
      const steps = G.steps(M, st);
      RL.render(ctx, {
        plates: plates,
        floor: function (g, R) {
          const T = R.T, rule = G.ruleText(M);
          const rs = compact ? 't2' : 't4';
          RL.text(g, R, (M.rule ? M.rule.id : '') + ' · RULE', m, m + RL.fs(R, 't1'), { size: 't1', mono: true, color: RL.css(T.ink3), track: 0.07 });
          G.wrap(g, R, rule, portrait ? W - 2 * m : W * 0.5, { size: rs, weight: 500 }).slice(0, 2)
            .forEach((l, i) => RL.text(g, R, l, m, m + RL.fs(R, 't1') * 1.6 + RL.fs(R, rs) * (1.15 * i + 1), { size: rs, weight: 500 }));
          // раздел фокуса и контекста: одна рельефная волосяная линия
          if (!portrait) RL.relief(g, R, (gg) => { gg.moveTo(side.x - m * 0.5, side.y); gg.lineTo(side.x - m * 0.5, side.y + side.h); }, 0.6);
          // контекст: подписи справа от малых стопок
          ctxs.forEach(function (c) {
            const ok = c.M.failIdx < 0, x = portrait ? c.x : c.tx, y0 = portrait ? c.y + c.h - RL.fs(R, 't1') * 3.6 : c.y + c.h * 0.42;
            if (compact) return;
            RL.text(g, R, c.M.dec.id, x, y0, { size: 't2', weight: 600 });
            RL.text(g, R, c.M.dec.action, x, y0 + RL.fs(R, 't1') * 1.5, { size: 't1', color: RL.css(T.ink2) });
            const f = c.M.layers[c.M.failIdx];
            RL.dot(g, x + 3, y0 + RL.fs(R, 't1') * 2.85 - 3.5, 3, ok ? RL.css(T.ink) : RL.css(T.accent));
            RL.text(g, R, ok ? 'ALLOWED' : 'BLOCKED · ' + (f ? (f.full || f.ref) + ' ' + f.result : ''), x + 12, y0 + RL.fs(R, 't1') * 2.9, { size: 't1', mono: true, color: RL.css(T.ink3) });
          });
          // фокус: протокол строкой проверок под стопкой
          if (P.trace && !compact && st.mode !== 'instruction') {
            const y = hero.y + hero.h - RL.fs(R, 't1') * 5.2, colW = hero.w / steps.length;
            steps.forEach((s, i) => { s.x = hero.x + colW * (i + 0.5); s.y = y; });
            G.drawPath(g, R, steps, R.t, { side: 'below', colW: colW - 10 * R.U.ui });
          }
          if (st.mode === 'instruction' && !st.appear.some((a) => a > 0.01)) {
            RL.text(g, R, 'INSTRUCTION · printed flat, nothing casts a shadow', hero.x, hero.y + hero.h * 0.5, { size: 't1', mono: true, color: RL.css(T.ink3), track: 0.07 });
          }
          RL.fictional(g, R);
        },
        print: function (g, p, R) {
          if (p.hero) G.printLayer(g, p, R, st);
          else if (p.failing) {    // малая стопка: только метка блока у окна, без подписей
            const hx = p.hole.x + p.dx, hy = p.hole.y + p.dy, s = p.hole.w;
            g.lineWidth = R.U.lineW; g.strokeStyle = RL.css(R.T.accent);
            g.beginPath(); g.moveTo(hx - 3, hy + s + 3); g.lineTo(hx + s + 3, hy - 3); g.stroke();
          }
        },
        over: function (g, R) {
          G.ring(g, R, hg.plates[hg.plates.length - 1], st.lit);
          ctxs.forEach((c) => { if (c.M.failIdx < 0) G.ring(g, R, c.g.plates[c.g.plates.length - 1], 0.85); });
        }
      });
    }
  }, {
    variant: 'v3', name: 'Gate · v3 Compare',
    blurb: 'Focus and context: the chosen decision as a large stack, the rest of the book as small stacks in a column, each in its state from the data. Click a small stack to bring it into focus.',
    scene: G.rows.scene, rhythm: G.rows.rhythm, data: G.rows.data, noise: window.RELIEF_NOISE
  });
})();
