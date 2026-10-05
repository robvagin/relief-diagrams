/* data.js · выдуманный портфель §6.6. Сборка вклеивает data/portfolio.json строкой в RELIEF.dataText
   (только в те цели сборки, где data: True); здесь ленивый разбор и короткие выборки. */
(function () {
  'use strict';
  var R = window.RELIEF = window.RELIEF || {};
  var parsed = null;
  R.data = function () {
    if (!parsed && R.dataText) parsed = JSON.parse(R.dataText);
    return parsed;
  };
  R.data.byId = function (key, id) {
    var d = R.data(); if (!d || !d[key]) return null;
    for (var i = 0; i < d[key].length; i++) if (d[key][i].id === id) return d[key][i];
    return null;
  };
})();
