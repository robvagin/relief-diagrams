// ledger v2 · «Пять видов»: страница отчёта. Выбранная форма забирает 0.618 ширины и строится в
// полном рельефе; остальные четыре лежат колонкой справа на листах z1 и напечатаны плоско,
// клик по листу выбирает форму (те же числа в пяти взглядах, одна ось на каждом).
LEDGER.run({
  variant: 'v2', name: 'five views', chart: 'line', series: 2,
  compose: function (ctx, F, L, I, body, FORMS) {
    const P = ctx.P, gap = F.u * 1.2, R = window.RELIEF, K = window.RINK;
    const order = ['bars', 'line', 'donut', 'table', 'kpi'];
    // альбом: герой слева 0.618 ширины, колонка справа; портрет: герой сверху 0.618 высоты, ряд снизу
    const tall = body.h > body.w * 1.1;
    const rest = order.filter(f => f !== P.chart);
    const heroW = tall ? body.w : (body.w - gap) * 0.618, heroH = tall ? (body.h - gap) * 0.618 : body.h;
    const hero = { x: body.x, y: body.y, w: heroW, h: heroH };
    const colX = tall ? body.x : body.x + heroW + gap, colW = tall ? (body.w - gap) / 2 : body.w - heroW - gap;
    const sh = tall ? (body.h - heroH - gap * 2) / 2 : (body.h - gap * (rest.length - 1)) / rest.length;
    const main = FORMS[P.chart](ctx, F, L, I, hero, { compact: false });
    const plates = main.plates.slice();
    ctx._views = [];
    rest.forEach((f, i) => {
      const r = tall ? { x: colX + (i % 2) * (colW + gap), y: body.y + heroH + gap + Math.floor(i / 2) * (sh + gap), w: colW, h: sh }
                     : { x: colX, y: body.y + i * (sh + gap), w: colW, h: sh };
      ctx._views.push({ f, r });
      const inner = { x: r.x + 10 * F.ui, y: r.y + 22 * F.ui, w: r.w - 20 * F.ui, h: r.h - 30 * F.ui };
      plates.push({ id: 'view-' + f, z: 1, s: { kind: 'rect', x: r.x, y: r.y, w: r.w, h: r.h, rad: P.radius * F.ui },
        print: (g, p) => {
          const dx = p.s.x - r.x, dy = p.s.y - r.y;
          g.translate(dx, dy);
          K.text(g, F, LEDGER.FORM_NAMES[f], r.x + 10 * F.ui, r.y + 16 * F.ui, { size: 1, caps: true, weight: 500, color: I.ink3, min: 7 });
          const comp = FORMS[f](ctx, F, L, I, inner, { compact: true, flat: true });
          LEDGER.printFlat(g, ctx, F, comp);
        } });
    });
    if (!ctx._click) {
      ctx._click = true;
      ctx.canvas.addEventListener('click', e => {
        const b = ctx.canvas.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
        const v = (ctx._views || []).find(v => x >= v.r.x && x <= v.r.x + v.r.w && y >= v.r.y && y <= v.r.y + v.r.h);
        if (v) Scene.set('chart', v.f);
      });
    }
    return { plates, floor: main.floor, hover: main.hover };
  }
});
