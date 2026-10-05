/* light/shade.js · маски затенения по приёмникам (README §7.3, L1, L2).
   Для каждого приёмника (пол, каждая плашка) считается своё поле затенения от всех, кто выше:
   Δh постоянна на паре «заслонитель · приёмник», значит сдвиг, σ и плотность тоже; покрытие
   читается из поля расстояний (light/sdf.js). Объединение заслонителей = максимум, не сумма.
   Контакт и «юбка» (AO у опоры) — тем же полем расстояний, отдельным слоем.
   Поле живёт в ½ CSS-разрешения на больших кадрах (размытие прячет), кладётся одним multiply. */
(function () {
  'use strict';
  var R = window.RELIEF = window.RELIEF || {};
  var SD = function () { return R.sdf; };

  var scratch = null, sg = null;
  function scratchFor(w, h) {
    if (!scratch) { scratch = document.createElement('canvas'); sg = scratch.getContext('2d'); }
    if (scratch.width < w || scratch.height < h) {
      scratch.width = Math.max(scratch.width, w, 64); scratch.height = Math.max(scratch.height, h, 64);
    }
    return sg;
  }

  /* Поле затенения приёмника высоты hr в прямоугольнике (x0,y0,w,h).
     occs: формы (w, h — размер) с полем z (высота над полом). Возвращает {k: Float32Array, fw, fh, s} или null */
  function field(L, rect, hr, occs, opts) {
    var s = opts.scale, x0 = rect[0], y0 = rect[1];
    var fw = Math.max(1, Math.ceil(rect[2] * s)), fh = Math.max(1, Math.ceil(rect[3] * s));
    var n = fw * fh, Sd = null, So = null, Cd = null, any = false;
    var sd = SD().sd, cover = SD().cover, ui = L.ui;
    for (var ci = 0; ci < occs.length; ci++) {
      var c = occs[ci], dh = c.z - hr;
      if (dh <= 1e-3 || c.noShadow) continue;
      var o = R.light.offset(L, c.x, c.y, c.z, hr);
      var sig = R.light.sigma(L, dh), D = R.light.density(L, dh);
      var cont = dh <= 16 * ui, sc = (0.8 + 0.06 * dh / ui) * ui, oc = [0.25 * o[0], 0.25 * o[1]];
      // «юбка» AO у опоры: 0,04 при контакте по умолчанию (0,12); ручка Контакт ведёт весь контактный слой
      var Dc = cont ? L.contact * Math.max(0, 1 - dh / (16 * ui)) : 0, skirt = cont ? 0.04 * Math.min(2, L.contact / 0.12) : 0, ss = 2 * ui;
      var ex = SD().extent(c);
      var reach = 3.2 * sig, reachC = 3.2 * Math.max(sc, ss);
      var bx0 = Math.min(c.x + o[0] - ex[0] - reach, cont ? c.x - ex[0] - reachC : 1e9);
      var bx1 = Math.max(c.x + o[0] + ex[0] + reach, cont ? c.x + ex[0] + reachC : -1e9);
      var by0 = Math.min(c.y + o[1] - ex[1] - reach, cont ? c.y - ex[1] - reachC : 1e9);
      var by1 = Math.max(c.y + o[1] + ex[1] + reach, cont ? c.y + ex[1] + reachC : -1e9);
      var i0 = Math.max(0, Math.floor((bx0 - x0) * s)), i1 = Math.min(fw - 1, Math.ceil((bx1 - x0) * s));
      var j0 = Math.max(0, Math.floor((by0 - y0) * s)), j1 = Math.min(fh - 1, Math.ceil((by1 - y0) * s));
      if (i0 > i1 || j0 > j1) continue;
      if (!Sd) { Sd = new Float32Array(n); So = new Float32Array(n); Cd = new Float32Array(n); }
      any = true;
      var cut = 4.2 * sig, cutC = 4.2 * Math.max(sc, ss);
      for (var j = j0; j <= j1; j++) {
        var py = y0 + (j + 0.5) / s, row = j * fw;
        for (var i = i0; i <= i1; i++) {
          var px = x0 + (i + 0.5) / s, k = row + i;
          var d = sd(c, px - o[0], py - o[1]);
          if (d < cut) {
            var cv = cover(d, sig), v = D * cv;
            if (v > Sd[k]) Sd[k] = v;
            if (cv > So[k]) So[k] = cv;
          }
          if (cont) {
            var d0 = sd(c, px - oc[0], py - oc[1]);
            if (d0 < cutC) {
              var vc = Dc * cover(d0, sc) + skirt * cover(sd(c, px, py), ss);
              if (vc > Cd[k]) Cd[k] = vc;
            }
          }
        }
      }
    }
    var lamp = L.mode === 'lamp' && L.lamp.pool > 0, can = L.canopy > 0 && opts.G;
    if (!any && !lamp && !can) return null;
    var K = new Float32Array(n), G = opts.G, dirFrac = (1 - L.amb) * Math.sin(L.elev) / L.E0;
    for (var jj = 0; jj < fh; jj++) {
      var yy = y0 + (jj + 0.5) / s, rr = jj * fw;
      for (var ii = 0; ii < fw; ii++) {
        var kk = rr + ii, keep = 1, so = 0;
        if (Sd) { keep = (1 - Sd[kk]) * (1 - Cd[kk]); so = So[kk]; }
        if (lamp) keep *= R.light.lampLit(L, x0 + (ii + 0.5) / s, yy, hr);
        // листва гасит только прямой свет и только там, где его не забрали плашки (L1)
        if (can) keep *= 1 - Math.min(0.95, L.canopy * 2.2) * dirFrac * (1 - G.at(x0 + (ii + 0.5) / s, yy)) * (1 - so);
        K[kk] = 1 - keep;
      }
    }
    return { k: K, fw: fw, fh: fh, s: s };
  }

  /* Положить поле одним проходом multiply тоном тени: a = k/(1 − Y(tint)) */
  function apply(g, F, rect, tint) {
    if (!F) return;
    var ys = (0.2126 * tint[0] + 0.7152 * tint[1] + 0.0722 * tint[2]) / 255, inv = 1 / Math.max(0.05, 1 - ys);
    var sgc = scratchFor(F.fw, F.fh), img = sgc.createImageData(F.fw, F.fh), d = img.data, K = F.k;
    var r = tint[0], gg = tint[1], b = tint[2];
    for (var i = 0, p = 0; i < K.length; i++, p += 4) {
      var a = K[i] * inv; if (a > 1) a = 1;
      d[p] = r; d[p + 1] = gg; d[p + 2] = b; d[p + 3] = a * 255 + 0.5;
    }
    sgc.putImageData(img, 0, 0);
    g.save();
    g.globalCompositeOperation = 'multiply';
    g.imageSmoothingEnabled = true;
    g.drawImage(scratch, 0, 0, F.fw, F.fh, rect[0], rect[1], F.fw / F.s, F.fh / F.s);
    g.restore();
  }

  R.shade = { field: field, apply: apply };
})();
