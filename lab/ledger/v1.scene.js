// ledger v1 · «Один лист»: один чарт на всё поле, форма с ручки «Форма»; сетка и ось вырезаны,
// данные напечатаны, столбцы и маркеры = плашки z1 на базовой линии z0. Подсказка = плашка z3.
LEDGER.run({
  variant: 'v1', name: 'one sheet', chart: 'bars',
  compose: function (ctx, F, L, I, body, FORMS) {
    const P = ctx.P, f = FORMS[P.chart];
    // таблица и число не растягиваются на всё поле: лист по золотой доле, остальное воздух
    let r = body;
    if (P.chart === 'table') r = { x: body.x, y: body.y, w: Math.min(body.w, Math.max(body.w * 0.618, 520 * F.ui)), h: body.h };
    if (P.chart === 'kpi') r = { x: body.x, y: body.y + body.h * 0.12, w: body.w, h: body.h * 0.62 };
    return f(ctx, F, L, I, r, { compact: false });
  }
});
