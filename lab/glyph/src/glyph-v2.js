// glyph · v2 «Журнал»: пять агентов книги строками-плашками, знак слева в размере ручки,
// состояние каждого выведено из данных (решения, правила). Агент в фокусе (A4, тот, что ведёт
// платёж D-7781) берёт состояние из ручки и поднят на z2. Лист: легенда пяти состояний внизу.
(function () {
  'use strict';
  const RL = window.RL, GL = window.GLYPH;
  function agentRows(data, sel) {
    const dec = (id) => data.decisions.filter((d) => d.id === id)[0];
    const d81 = dec('D-7781'), d82 = dec('D-7782'), d90 = dec('D-7790'), d04 = dec('D-7804');
    const a4 = {
      idle: 'On call · ' + d81.loan,
      work: 'Checking ' + d81.id + ' · ' + d81.checks[0].ref + ' · ' + d81.checks[0].input,
      wait: d81.id + ' · Director approval · waiting',
      done: d82.id + ' · ' + d82.action + ' · allowed',
      error: d81.id + ' · blocked · approval missing'
    };
    return data.agents.map(function (a) {
      let state = 'idle', line = a.job, verb = null;
      if (a.id === 'A1') { state = 'work'; verb = 'read'; line = 'Reading ' + data.meta.counts.loans + ' loans · risk view'; }
      if (a.id === 'A2') { state = 'error'; line = d90.id + ' · ' + d90.checks[0].ref + ' · ' + d90.checks[0].input; }
      if (a.id === 'A3') { state = 'idle'; line = 'On call · ' + a.job.toLowerCase(); }
      if (a.id === 'A4') { state = sel; line = a4[sel]; }
      if (a.id === 'A5') { state = 'done'; line = d04.id + ' · ' + d04.action + ' · allowed'; }
      return { a: a, state: state, line: line, verb: verb, focus: a.id === 'A4' };
    });
  }
  RL.start({
    id: 'glyph',
    title: 'Glyph · Roster',
    blurb: 'Agent state in a roster: five agents on one model, each glyph driven by the book.',
    draw: function (ctx) {
      const P = ctx.P, U = RL.units(ctx), W = U.W, H = U.H, m = U.m, t = RL.time(ctx);
      const T = RL.tokens(ctx.theme, P.accent), portrait = W / H < 1.05;
      const rows = agentRows(ctx.data, P.stateG), n = rows.length;
      const head = m + 64 * Math.max(0.6, U.ui), legend = P.sheet ? 70 * Math.max(0.7, U.ui) : 0;
      const listW = portrait ? W - 2 * m : Math.min(W * 0.7, 860 * Math.max(0.8, U.ui)), x0 = (W - listW) / 2;
      const gapY = 12 * U.ui, rowH = Math.min((H - head - m - legend - gapY * (n - 1)) / n, 120 * Math.max(0.8, U.ui));
      const y0 = head + (H - head - m - legend - (rowH * n + gapY * (n - 1))) / 2;
      const size = Math.min(Math.round(P.size), rowH * 0.8);
      const ph = RL.phases(ctx, n), plates = [], glyphs = [];
      rows.forEach(function (r, i) {
        const z = r.focus ? U.z[2] : U.z[1], verified = r.state === 'done' || r.state === 'error';
        const f = RL.float(P, t, ph[i], listW, rowH, z, ctx.reduced || verified ? 0 : 1);
        const p = RL.plate({ id: r.a.id, x: x0, y: y0 + i * (rowH + gapY), w: listW, h: rowH, r: P.radius * U.ui, z: z, dx: f.dx, dy: f.dy, rot: f.rot * 0.3, dz: f.dh, row: r });
        plates.push(p);
        const gx = x0 + 18 * U.ui + Math.max(size, 24) / 2 + 8 * U.ui, gy = p.y + rowH / 2;
        const o = { state: r.state, size: size, t: t, since: t, verb: r.verb, reduced: ctx.reduced, base: z };
        p.g = { x: gx, y: gy, o: o };
        if (GL.raised(o)) { const d = GL.disc(U, T, gx, gy, o); d.dx = p.dx; d.dy = p.dy; plates.push(d); }
      });
      RL.render(ctx, {
        plates: plates,
        floor: function (g, R) {
          RL.text(g, R, 'AGENT STATE · ROSTER', m, m + RL.fs(R, 't1'), { size: 't1', mono: true, color: RL.css(T.ink3), track: 0.07 });
          RL.text(g, R, 'Five agents, one model, one glance.', m, m + RL.fs(R, 't1') * 1.6 + RL.fs(R, 't4'), { size: 't4', weight: 500 });
          if (P.sheet) {
            const ly = H - m - legend * 0.45, step = Math.min(listW / 5, 170 * R.U.ui);
            GL.STATES.forEach(function (st, i) {
              const x = W / 2 + (i - 2) * step;
              GL.draw(g, R, x - 22, ly, { state: st, size: 24, t: R.t, since: R.t, reduced: ctx.reduced });
              RL.text(g, R, GL.META[st].label, x - 4, ly + 4, { size: 't1', mono: true, color: RL.css(st === P.stateG ? T.ink : T.ink3) });
            });
          }
          RL.fictional(g, R);
        },
        print: function (g, p, R) {
          const r = p.row;
          if (!r) return;
          const G0 = p.g, tx = G0.x + Math.max(size, 24) / 2 + 18 * R.U.ui, ty = p.y + p.dy + rowH / 2;
          GL.draw(g, R, G0.x + p.dx, G0.y + p.dy, G0.o);
          const M = GL.META[r.state];
          RL.text(g, R, r.a.id + ' · ' + r.a.name, tx + p.dx, ty - 4, { size: rowH > 70 ? 't3' : 't2', weight: r.focus ? 600 : 500 });
          const so = { size: 't1', mono: true, color: RL.css(r.state === 'error' ? T.ink : T.ink3) };
          const room = listW - (tx - x0) - 24 * R.U.ui - (portrait ? 0 : 150 * R.U.ui);
          let line = r.line;
          while (line.length > 8 && RL.measure(g, R, line, so) > room) line = line.slice(0, -2);
          if (line !== r.line) line = line.trim() + '…';
          RL.text(g, R, line, tx + p.dx, ty + RL.fs(R, 't1') * 1.35, so);
          if (!portrait) RL.text(g, R, M.label.toUpperCase() + (r.state === 'work' ? ' · ' + (r.verb || GL.verbAt(ctx.reduced ? 0 : R.t)) : ''), p.x + p.dx + listW - 18 * R.U.ui, ty + 4, { size: 't1', mono: true, align: 'right', color: RL.css(r.state === 'error' ? T.ink : T.ink2), track: 0.07 });
        }
      });
    }
  }, {
    variant: 'v2', name: 'Glyph · v2 Roster',
    blurb: 'Five agents of the book as rows on plates, glyph at the knob size, each state read from the data. The focused agent takes the state from the knob and sits one level higher.',
    scene: GL.rows.scene, rhythm: GL.rows.rhythm, noise: window.RELIEF_NOISE
  });
})();
