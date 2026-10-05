// charts.js — общее для организмов ledger (§7.9 в языке организма): лист-таблица по T, легенда
// «How to read», серии данных. Одна ось, двойных нет; площадь пузыря = величина; акцент метит одну
// сущность (последний месяц); подписи выборочно; числа Geist Mono.
(function () {
  'use strict';
  var K = window.RINK, D = function () { return window.RELIEF_DATA; };

  function series() {
    var s = D().series;
    return { months: s.months, exposure: s.exposure, recovered: s.recovered, npl: s.nplShareByCount };
  }
  // сегмент → стадия: перевёрнутое дерево breakdown (книга → стадия → сегмент)
  function bySegment() {
    var b = D().breakdown, seg = {};
    b.children.forEach(function (st) {
      (st.children || []).forEach(function (sg) {
        var o = seg[sg.label] || (seg[sg.label] = { label: sg.label, value: 0, count: 0, children: [] });
        o.value += sg.value; o.count += sg.count;
        o.children.push({ label: st.label, value: sg.value, count: sg.count });
      });
    });
    return Object.keys(seg).map(function (k) { return seg[k]; }).sort(function (a, c) { return c.value - a.value; });
  }

  // лист-таблица: 12 месяцев × экспозиция, возвраты, NPL; строка «на дату» метится точкой акцента
  function tablePrint(g, F, I, w, h) {
    var s = series(), p = Math.max(8, 14 * F.ui), n = s.months.length, rh = (h - 2 * p) / (n + 1.8);
    var cols = [['Exposure', s.exposure, function (v) { return K.eur(v); }], ['Recovered', s.recovered, function (v) { return K.eur(v); }], ['NPL', s.npl, function (v) { return K.pct(v); }]];
    var x0 = -w / 2 + p, cw = (w - 2 * p) / 4, y = -h / 2 + p + rh * 0.8;
    K.text(g, F, 'Month', x0, y, { size: 1, caps: true, weight: 500, color: I.ink3, min: 7 });
    cols.forEach(function (c, j) { K.text(g, F, c[0], x0 + cw * (j + 2), y, { size: 1, caps: true, weight: 500, color: I.ink3, align: 'right', min: 7 }); });
    K.relief(g, F, function (q, ox, oy) { q.moveTo(x0 + ox, y + rh * 0.45 + oy); q.lineTo(w / 2 - p + ox, y + rh * 0.45 + oy); });
    s.months.forEach(function (m, i) {
      var yy = y + rh * (i + 1.35), last = i === n - 1;
      K.text(g, F, K.month(m) + ' ' + m.slice(0, 4), x0, yy, { size: 1, mono: true, color: I.ink2, min: 7 });
      cols.forEach(function (c, j) { K.text(g, F, c[2](c[1][i]), x0 + cw * (j + 2), yy, { size: 1, mono: true, color: last ? I.ink : I.ink2, weight: last ? 500 : 400, align: 'right', min: 7 }); });
      if (last) K.dot(g, x0 - 6 * F.ui, yy - 4 * F.ui, Math.max(2.5, 3 * F.ui), I.acc);
    });
  }
  // легенда «How to read» печатью на полу
  function howTo(g, F, I, x, y, lines) {
    if (F.W < 700) return;                       // узкий кадр и фрагмент: легенда уходит в подсказку панели
    K.text(g, F, 'How to read', x, y, { size: 1, caps: true, weight: 500, color: I.ink3, min: 7 });
    lines.forEach(function (l, i) { K.text(g, F, l, x, y + (16 + 14 * i) * F.ui, { size: 1, color: I.ink2, min: 7 }); });
  }
  function header(g, F, I, title, sub, m, W, H) {
    K.text(g, F, title, m, m + 20 * F.ui, { size: 5, weight: 600, color: I.ink, min: 10 });
    K.text(g, F, sub, m, m + 40 * F.ui, { size: 1, mono: true, color: I.ink3, min: 7 });
    K.text(g, F, 'Fictional data · as of 30 Sep 2026', W - m, H - m * 0.5, { size: 1, mono: true, color: I.ink3, align: 'right', min: 7 });
  }
  // T: лист-таблица висит на хабе; переключатель живёт в ctx (ручки не нужен: вид, а не параметр)
  function tableToggle(ctx) { ctx._table = !ctx._table; window.dispatchEvent(new Event('resize')); }
  function tableNode(F, S) {
    return { id: 'table', shape: 'sheet', w: 0.42 * S, h: 0.5 * S, z: 3, print: tablePrint, info: ['Table view', 'T to close'] };
  }

  window.LEDGER = { series: series, bySegment: bySegment, tablePrint: tablePrint, howTo: howTo, header: header, tableToggle: tableToggle, tableNode: tableNode };
})();
