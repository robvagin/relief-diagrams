// ledger v3 · «Орбита»: полярная композиция по донорам radial и sunburst. В центре всегда кольцо
// стадий (структура книги), выбранная форма ложится орбитой вокруг: столбцы = радиальные плашки
// r0 → r0 + v/max·(R − r0), линия = полярная печать с маркерами-дисками, кольцо = солнечные слои
// (уровни = серии), таблица = лист справа с выносками от дуг, число = диск z2 в центре кольца.
LEDGER.run({
  variant: 'v3', name: 'orbit', chart: 'bars',
  compose: function (ctx, F, L, I, body, FORMS) {
    const P = ctx.P, R = window.RELIEF, K = window.RINK, TAU = R.TAU;
    const S = LEDGER.seriesOf(P.series), n = S.months.length, b = window.RELIEF_DATA.breakdown;
    const side = P.chart === 'table';
    const cx = side ? body.x + body.h * 0.5 : body.x + body.w / 2, cy = body.y + body.h / 2;
    const Rm = Math.min(side ? body.w * 0.5 : body.w, body.h) * 0.46;
    const ringR = P.chart === 'donut' ? Rm : Rm * 0.42;
    const comp = FORMS.donut(ctx, F, L, I, body, { compact: P.chart !== 'donut', ring0: P.chart === 'kpi' ? 0.62 : 0.5, center: [cx, cy, ringR], noLabels: P.chart === 'bars' || P.chart === 'line' });
    const plates = comp.plates.filter(p => P.chart === 'donut' || p.depth === 1);
    const floors = [];
    const r0 = ringR + 18 * F.ui, slot = TAU / n, a0 = -Math.PI / 2;
    const lab = (g, i, rr) => {
      const a = a0 + slot * (i + 0.5), x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr + 4 * F.ui;
      const al = Math.cos(a) > 0.05 ? 'left' : Math.cos(a) < -0.05 ? 'right' : 'center';
      K.text(g, F, K.monthOf(S.months[i]), x, y, { size: 1, mono: true, color: I.ink3, align: al, min: 7 });
    };
    if (P.chart === 'bars') {
      const hi = Math.max.apply(null, S.list.map(se => Math.max.apply(null, se.y))), k = S.list.length;
      const sc = K.niceScale(0, hi, 3);
      S.list.forEach((se, si) => se.y.forEach((v, i) => {
        const gapA = slot * 0.18, sub = (slot - gapA) / k;
        const aa = a0 + slot * i + gapA / 2 + sub * si;
        plates.push({ id: 'rb' + si + '-' + i, z: 1, s: { kind: 'arc', cx, cy, r0, r1: r0 + (Rm - r0) * v / sc.hi, a0: aa, a1: aa + sub, pad: 1 },
          fill: si ? R.mix(ctx.tok.plate, ctx.tok.ink, [0, 0.12, 0.26, 0.4][si]) : null, mark: si === 0 && i === n - 1 });
      }));
      floors.push(g => {
        sc.ticks.forEach(t => { if (t <= 0) return; const rr = r0 + (Rm - r0) * t / sc.hi;
          K.relief(g, ctx, F, L, (q, ox, oy) => { q.beginPath(); q.arc(cx + ox, cy + oy, rr, 0, TAU); }, P.relief !== 0);
          K.text(g, F, S.yfmt(t), cx + 4 * F.ui, cy - rr - 4 * F.ui, { size: 1, mono: true, color: I.ink3, min: 7 }); });
        for (let i = 0; i < n; i++) if (P.labelsL === 'all' || i % 3 === 2 || i === 0) lab(g, i, Rm + 14 * F.ui);
        const se = S.list[0];
        if (P.labelsL !== 'none') K.text(g, F, se.fmt(se.v[n - 1]) + ' · Sep', cx + 8 * F.ui, cy - Rm - 26 * F.ui, { size: 2, mono: true, weight: 500, color: I.ink, min: 8 });
      });
    } else if (P.chart === 'line') {
      let lo = Infinity, hi = -Infinity;
      S.list.forEach(se => se.y.forEach(v => { lo = Math.min(lo, v); hi = Math.max(hi, v); }));
      const sc = K.niceScale(lo - (hi - lo) * 0.1, hi + (hi - lo) * 0.1, 3);
      const pos = (v, i) => { const a = a0 + slot * (i + 0.5), rr = r0 + (Rm - r0) * (v - sc.lo) / (sc.hi - sc.lo); return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]; };
      S.list[0].y.forEach((v, i) => { const p = pos(v, i); plates.push({ id: 'pm' + i, z: 1, s: { kind: 'circle', x: p[0], y: p[1], r: Math.max(4, 5 * F.ui) }, mark: i === n - 1 }); });
      floors.push(g => {
        sc.ticks.forEach(t => { const rr = r0 + (Rm - r0) * (t - sc.lo) / (sc.hi - sc.lo);
          K.relief(g, ctx, F, L, (q, ox, oy) => { q.beginPath(); q.arc(cx + ox, cy + oy, rr, 0, TAU); }, P.relief !== 0);
          K.text(g, F, S.yfmt(t), cx + 4 * F.ui, cy - rr - 4 * F.ui, { size: 1, mono: true, color: I.ink3, min: 7 }); });
        S.list.slice().reverse().forEach(se => {
          const si = S.list.indexOf(se);
          g.save(); g.strokeStyle = si ? I.ink3 : I.ink; g.lineWidth = F.lineW; g.lineJoin = 'round';
          g.setLineDash([[], [6, 3], [2, 3], [8, 3, 2, 3]][si].map(v => v * F.ui));
          g.beginPath(); se.y.forEach((v, i) => { const p = pos(v, i); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }); g.stroke(); g.restore();
        });
        for (let i = 0; i < n; i++) if (P.labelsL === 'all' || i % 3 === 2 || i === 0) lab(g, i, Rm + 14 * F.ui);
        if (P.labelsL !== 'none' && S.list.length > 1) {
          let x = body.x, y = body.y + 8 * F.ui;
          S.list.forEach((se, si) => { K.text(g, F, (si ? ['', '- -', '· ·', '-·-'][si] : '—') + '  ' + se.name, x, y + si * 16 * F.ui, { size: 1, color: si ? I.ink3 : I.ink2, min: 7 }); });
          K.text(g, F, S.unit, x, y + S.list.length * 16 * F.ui + 4 * F.ui, { size: 1, color: I.ink3, min: 7 });
        }
      });
    } else if (P.chart === 'table') {
      const kids = b.children;
      const th = Math.min(body.h * 0.76, 64 * F.ui + kids.length * 64 * F.ui);
      const tr = { x: cx + Rm + 64 * F.ui, y: cy - th / 2, w: body.x + body.w - (cx + Rm + 64 * F.ui), h: th };
      // строки по y источника (середины дуг): выноски не пересекаются (§7.6 D)
      let acc = -Math.PI / 2;
      const anc = kids.map(c => { const span = TAU * c.value / b.value, am = acc + span / 2; acc += span; return { c, am, y: Math.sin(am) }; });
      anc.sort((p, q) => p.y - q.y);
      const rowH = (tr.h - 60 * F.ui) / kids.length;
      plates.push({ id: 'sheet', z: 1, s: { kind: 'rect', x: tr.x, y: tr.y, w: tr.w, h: tr.h, rad: P.radius * F.ui }, print: (g, p) => {
        const q = p.s, pd = 16 * F.ui, cw = (q.w - 2 * pd) / 4;
        ['Stage', 'Exposure', 'Loans', 'Share'].forEach((h, j) => K.text(g, F, h, j ? q.x + pd + cw * (j + 1) : q.x + pd, q.y + pd + 12 * F.ui, { size: 1, caps: true, weight: 500, color: I.ink3, align: j ? 'right' : 'left', min: 7 }));
        K.relief(g, ctx, F, L, K.hline(q.x + pd, q.x + q.w - pd, q.y + pd + 24 * F.ui), P.relief !== 0);
        anc.forEach((an, i) => {
          const c = an.c, y = q.y + 50 * F.ui + rowH * (i + 0.5);
          const vals = [c.label, K.eur(c.value), String(c.count), K.pct(c.value / b.value)];
          vals.forEach((v, j) => K.text(g, F, v, j ? q.x + pd + cw * (j + 1) : q.x + pd, y, { size: 2, mono: j > 0, color: c.label === 'non-performing' ? I.ink : I.ink2, weight: c.label === 'non-performing' ? 500 : 400, align: j ? 'right' : 'left', min: 7 }));
          if (c.label === 'non-performing') { g.fillStyle = I.acc; g.beginPath(); g.arc(q.x + pd - 8 * F.ui, y - 4 * F.ui, Math.max(2.5, 3.5 * F.ui), 0, TAU); g.fill(); }
        });
      } });
      floors.push(g => {
        // выноски: от середины дуги стадии к строке, один излом (§7.6 D)
        anc.forEach((an, i) => {
          const am = an.am;
          const x0 = cx + Math.cos(am) * (ringR + 4 * F.ui), y0 = cy + Math.sin(am) * (ringR + 4 * F.ui);
          const y1 = tr.y + 50 * F.ui + rowH * (i + 0.5) - 4 * F.ui, xm = cx + Rm + 24 * F.ui;
          g.save(); g.strokeStyle = I.line; g.lineWidth = F.lineW; g.beginPath(); g.moveTo(x0, y0); g.lineTo(xm, y1); g.lineTo(tr.x - 4 * F.ui, y1); g.stroke(); g.restore();
        });
      });
    } else if (P.chart === 'kpi') {
      const dr = ringR * 0.58, se = S.list[0];
      plates.push({ id: 'core', z: 2, s: { kind: 'circle', x: cx, y: cy, r: dr }, print: (g, p) => {
        const num = se.fmt(se.v[n - 1]);
        const w100 = K.measure(g, F, num, { size: 100 / F.ui, mono: true, weight: 500, min: 1 }) / 100;
        const px = Math.min(dr * 1.5 / Math.max(0.01, w100), dr * 0.45);
        K.text(g, F, num, p.s.x, p.s.y + px * 0.3, { size: px / F.ui, mono: true, weight: 500, color: I.ink, align: 'center', min: 8 });
        K.text(g, F, se.name.toUpperCase() + ' · SEP 2026', p.s.x, p.s.y - px * 0.55, { size: 1, color: I.ink3, align: 'center', weight: 500, min: 7 });
        const d = se.v[n - 1] / se.v[0] - 1;
        K.text(g, F, '+' + K.pct(d) + ' in 12 months', p.s.x, p.s.y + px * 0.3 + 20 * F.ui, { size: 1, mono: true, color: I.ink2, align: 'center', min: 7 });
      } });
      // соседние числа серий 2–4 печатью по орбите
      floors.push(g => S.list.slice(1).forEach((s2, i) => {
        const a = -Math.PI / 2 + TAU * (i + 1) / (S.list.length) + 0.4, rr = Rm * 0.82;
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr, al = Math.cos(a) >= 0 ? 'left' : 'right';
        K.text(g, F, s2.name, x, y, { size: 1, caps: true, weight: 500, color: I.ink3, align: al, min: 7 });
        K.text(g, F, s2.fmt(s2.v[n - 1]), x, y + 26 * F.ui, { size: 5, mono: true, weight: 500, color: I.ink, align: al, min: 9 });
      }));
    }
    return {
      plates, title: { bars: 'Exposure by month, around the book', line: 'Twelve months, around the book', donut: 'Book by stage, segment, country', table: 'Book by stage', kpi: 'Exposure' }[P.chart],
      floor: g => { comp.floor(g); floors.forEach(f => f(g)); }
    };
  }
});
