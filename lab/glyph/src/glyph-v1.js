// glyph · v1 «Лист»: контакт-лист состояний × размеров 16–96 px печатью на полу, граница теней
// между 32 и 48 px вырезана рельефом; справа карточка-плашка с выбранным состоянием в размере
// ручки и его профилем. Без листа: один знак крупно и ряд всех пяти в том же размере.
(function () {
  'use strict';
  const RL = window.RL, GL = window.GLYPH;
  RL.start({
    id: 'glyph',
    title: 'Glyph · Sheet',
    blurb: 'Agent state in 16–96 px: five states told apart by topology, not amplitude.',
    draw: function (ctx) {
      const P = ctx.P, U = RL.units(ctx), W = U.W, H = U.H, m = U.m, t = RL.time(ctx);
      const T = RL.tokens(ctx.theme, P.accent), portrait = W / H < 1.05;
      const size = Math.round(P.size), sel = P.stateG;
      const head = m + 64 * Math.max(0.6, U.ui);
      const plates = [], marks = [];
      // карточка справа: плашка z1 со знаком в размере ручки
      const card = portrait ? { x: m, y: H - m - Math.max(150, size + 96), w: W - 2 * m, h: Math.max(150, size + 96) }
        : { x: W * 0.72, y: head, w: W * 0.28 - m, h: Math.min(H - head - m, Math.max(210, size * 1.3 + 150)) };
      if (P.sheet) plates.push(RL.plate({ id: 'card', x: card.x, y: card.y, w: card.w, h: card.h, r: P.radius * U.ui, z: U.z[1] }));
      // сетка листа: строки состояния, столбцы размеры
      const grid = P.sheet ? (portrait ? { x: m, y: head, w: W - 2 * m, h: card.y - head - m } : { x: m, y: head, w: card.x - 2 * m, h: H - head - m * 1.4 })
        : { x: m, y: head, w: W - 2 * m, h: H - head - m };
      const labW = Math.min(grid.w * 0.26, 220 * Math.max(0.7, U.ui)), colW = (grid.w - labW) / GL.SIZES.length;
      const rowH = (grid.h - 30 * U.ui) / GL.STATES.length;
      const k = Math.min(1, colW / 110, rowH / 108);             // знак в своём размере, пока клетка вмещает
      const cellX = (j) => grid.x + labW + colW * (j + 0.5), rowY = (i) => grid.y + 30 * U.ui + rowH * (i + 0.5);
      if (P.sheet) {
        GL.STATES.forEach(function (st, i) {
          GL.SIZES.forEach(function (sz, j) {
            const o = { state: st, size: sz * k, t: t, since: t, reduced: ctx.reduced };
            if (GL.raised(o)) plates.push(GL.disc(U, T, cellX(j), rowY(i), o));
            marks.push([cellX(j), rowY(i), o]);
          });
        });
      } else {
        // без листа: один знак крупно в центре и ряд пяти в размере ручки
        const cx = W / 2, cy = head + (H - head) * 0.38;
        const o = { state: sel, size: size, t: t, since: t, reduced: ctx.reduced };
        if (GL.raised(o)) plates.push(GL.disc(U, T, cx, cy, o));
        marks.push([cx, cy, o]);
        GL.STATES.forEach(function (st, i) {
          const x = W / 2 + (i - 2) * Math.max(size * 1.9, 96 * U.ui), y = head + (H - head) * 0.74;
          const oo = { state: st, size: size, t: t, since: t, reduced: ctx.reduced };
          if (GL.raised(oo)) plates.push(GL.disc(U, T, x, y, oo));
          marks.push([x, y, oo, true]);
        });
      }
      const cg = { x: card.x + card.w * 0.5, y: card.y + Math.max(70, size * 0.9 + 30) * 0.5 + 24 * U.ui };
      const co = { state: sel, size: size, t: t, since: t, reduced: ctx.reduced, base: U.z[1] };
      if (P.sheet && GL.raised(co)) plates.push(GL.disc(U, T, cg.x, cg.y, co));
      RL.render(ctx, {
        plates: plates,
        floor: function (g, R) {
          RL.text(g, R, 'AGENT STATE · 16–96 PX', m, m + RL.fs(R, 't1'), { size: 't1', mono: true, color: RL.css(T.ink3), track: 0.07 });
          RL.text(g, R, 'Five states, told apart by count, not by motion.', m, m + RL.fs(R, 't1') * 1.6 + RL.fs(R, 't4'), { size: 't4', weight: 500 });
          if (P.sheet) {
            GL.SIZES.forEach(function (sz, j) {
              const on = Math.abs(sz - size) < 0.5;
              RL.text(g, R, sz + ' px', cellX(j), grid.y + RL.fs(R, 't1'), { size: 't1', mono: true, align: 'center', color: RL.css(on ? T.ink : T.ink3) });
              if (on) RL.inkLine(g, R, (gg) => { gg.moveTo(cellX(j) - 10, grid.y + RL.fs(R, 't1') * 1.6); gg.lineTo(cellX(j) + 10, grid.y + RL.fs(R, 't1') * 1.6); });
            });
            // граница теней: ниже 48 px знак печатается плоско
            const xb = grid.x + labW + colW * 3;
            RL.relief(g, R, (gg) => { gg.moveTo(xb, grid.y + 24 * R.U.ui); gg.lineTo(xb, grid.y + grid.h); }, 0.7);
            RL.text(g, R, 'shadow from 48 px', xb + 6, grid.y + grid.h - 4, { size: 't1', mono: true, color: RL.css(T.ink3) });
            GL.STATES.forEach(function (st, i) {
              const on = st === sel, y = rowY(i), M = GL.META[st];
              RL.text(g, R, M.label, grid.x, y - 2, { size: 't2', weight: on ? 600 : 500, color: RL.css(on ? T.ink : T.ink2) });
              if (labW > 150) RL.text(g, R, M.count + ' · ' + M.means, grid.x, y + RL.fs(R, 't1') * 1.3, { size: 't1', mono: true, color: RL.css(T.ink3) });
              if (i) RL.relief(g, R, (gg) => { gg.moveTo(grid.x, y - rowH / 2); gg.lineTo(grid.x + grid.w, y - rowH / 2); }, 0.35);
            });
          } else {
            const M = GL.META[sel];
            RL.text(g, R, M.label + ' · ' + size + ' px', W / 2, head + (H - head) * 0.38 + size * 0.5 + 34 * R.U.ui, { size: 't3', weight: 600, align: 'center' });
            RL.text(g, R, M.means + ' · ' + M.rhythm, W / 2, head + (H - head) * 0.38 + size * 0.5 + 34 * R.U.ui + RL.fs(R, 't1') * 1.6, { size: 't1', mono: true, align: 'center', color: RL.css(T.ink3) });
          }
          marks.forEach(function (mk) {
            GL.draw(g, R, mk[0], mk[1], mk[2]);
            if (mk[3]) RL.text(g, R, GL.META[mk[2].state].label, mk[0], mk[1] + Math.max(mk[2].size * 0.5, 12) + RL.fs(R, 't1') * 1.6, { size: 't1', mono: true, align: 'center', color: RL.css(mk[2].state === sel ? T.ink : T.ink3) });
          });
          RL.fictional(g, R);
        },
        print: function (g, p, R) {
          if (p.id !== 'card') return;
          const M = GL.META[sel], x = card.x + 16 * R.U.ui;
          GL.draw(g, R, cg.x, cg.y, co);
          let y = card.y + card.h - 16 * R.U.ui - RL.fs(R, 't1') * 4.2;
          RL.text(g, R, M.label + ' · ' + size + ' px', x, y, { size: 't3', weight: 600 });
          RL.text(g, R, M.means, x, y + RL.fs(R, 't1') * 1.6, { size: 't1', color: RL.css(T.ink2) });
          RL.text(g, R, M.count + ' · ' + M.rhythm, x, y + RL.fs(R, 't1') * 3.0, { size: 't1', mono: true, color: RL.css(T.ink3) });
          if (sel === 'work') RL.text(g, R, 'now: ' + GL.verbAt(ctx.reduced ? 0 : t), x, y + RL.fs(R, 't1') * 4.3, { size: 't1', mono: true, color: RL.css(T.ink3) });
        }
      });
    }
  }, {
    variant: 'v1', name: 'Glyph · v1 Sheet',
    blurb: 'Contact sheet: five states by six sizes printed on the floor, the shadow line cut between 32 and 48 px; a card shows the chosen state at the knob size.',
    scene: GL.rows.scene, rhythm: GL.rows.rhythm, noise: window.RELIEF_NOISE
  });
})();
