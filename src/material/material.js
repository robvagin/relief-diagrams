/* material/material.js · вещество плашек и пола (README §7.4, L3, L4).
   Альбедо из токенов, неровность (value-noise ⅙ кадра), зерно синим шумом (дизер), кант светом.
   Обводок нет: кромку рисует свет — кант это серп «верх минус верх, сдвинутый от света»,
   залитый по правилу even-odd, а не штрих по контуру. Статично: зерно и неровность не дышат. */
(function () {
  'use strict';
  var R = window.RELIEF = window.RELIEF || {};

  /* Альбедо под тёплым светом: множитель lightTint(temp)/lightTint(умолч.), умолчание даёт ровно токен */
  function tints(T, temp) {
    var C = R.color, k = Math.max(0, (1 + temp) * 0.8);
    var white = [255, 255, 255], ns = T.shadowTint, ys = C.lum(ns), gray = Math.round(255 * Math.pow(ys, 1 / 2.2));
    var shadow = C.mix([gray, gray, gray], ns, Math.min(1.6, k));
    var light = C.mix(white, T.lightTint, Math.min(1.6, k)), base = C.mix(white, T.lightTint, 1);
    var mul = [light[0] / base[0], light[1] / base[1], light[2] / base[2]];
    var lit = function (c) { return [Math.min(255, c[0] * mul[0]), Math.min(255, c[1] * mul[1]), Math.min(255, c[2] * mul[2])]; };
    return { shadow: shadow, light: light, ground: lit(T.ground), plate: lit(T.plate) };
  }

  /* ── неровность: value-noise на сетке ⅙ кадра, ±uneven %, бикубически сглажено апскейлом ── */
  var unevenCache = null;
  function unevenTiles(W, H, seed, pct, T) {
    var key = [R.streamBase, W, H, seed, pct, T.theme].join('|');
    if (!unevenCache || unevenCache.key !== key) {
      var cols = 8, rows = Math.max(4, Math.round(8 * H / W)), r = R.stream(seed, 'uneven'), vals = [];
      for (var vi = 0; vi < cols * rows; vi++) vals.push(r() - 0.5);       // одно знаковое поле на обе половины
      var mk = function (sign) {
        var c = document.createElement('canvas'); c.width = cols; c.height = rows;
        var cx = c.getContext('2d'), im = cx.createImageData(cols, rows);
        for (var i = 0; i < cols * rows; i++) {
          var v = Math.max(0, vals[i] * sign) * 2 * pct / 100;
          var Y = Math.max(0.05, Math.pow(T.groundY, 1 / 2.2));
          // как у зерна: плюс сложением ('lighter'), минус множителем ('multiply'), у грунта ровно ±v
          var c8 = sign > 0 ? Math.round(v * 255) : Math.round(255 * Math.max(0, 1 - v / Y));
          im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = c8;
          im.data[i * 4 + 3] = 255;
        }
        cx.putImageData(im, 0, 0);
        return c;
      };
      unevenCache = { key: key, pos: mk(1), neg: mk(-1) };
    }
    return unevenCache;
  }
  function uneven(g, W, H, seed, pct, T) {
    if (!(pct > 0)) return;
    unevenTiles(W, H, seed, pct, T);
    g.save(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.globalCompositeOperation = 'lighter'; g.drawImage(unevenCache.pos, -W / 12, -H / 12, W * 7 / 6, H * 7 / 6);
    g.globalCompositeOperation = 'multiply'; g.drawImage(unevenCache.neg, -W / 12, -H / 12, W * 7 / 6, H * 7 / 6);
    g.restore();
  }

  /* ── зерно: тайл синего шума 128 px по физическим пикселям, сдвиг от сида; c += (n − .5)·2·grain % ── */
  var noise = null, grainCache = {};
  function loadNoise() {
    return new Promise(function (res) {
      if (noise || !R.noise128) return res(noise);
      var img = new Image();
      img.onload = function () {
        var c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        var cx = c.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0);
        var d = cx.getImageData(0, 0, c.width, c.height).data, n = new Float32Array(c.width * c.height);
        for (var i = 0; i < n.length; i++) n[i] = d[i * 4] / 255;
        noise = { w: c.width, h: c.height, n: n };
        res(noise);
      };
      img.onerror = function () { res(null); };
      img.src = R.noise128;
    });
  }
  function grainTiles(pct, T) {
    var key = pct + '|' + T.theme;
    if (grainCache[key]) return grainCache[key];
    var Y = Math.max(0.05, Math.pow(T.groundY, 1 / 2.2)), mk = function (sign) {
      var c = document.createElement('canvas'); c.width = noise.w; c.height = noise.h;
      var cx = c.getContext('2d'), im = cx.createImageData(noise.w, noise.h), d = im.data;
      for (var i = 0; i < noise.n.length; i++) {
        var v = Math.max(0, (noise.n[i] - 0.5) * 2 * pct / 100 * sign);
        // плюс: прибавка v·255 поверх ('lighter'); минус: множитель 1 − v/Y ('multiply') — у грунта ровно −v·255
        var c8 = sign > 0 ? Math.round(v * 255) : Math.round(255 * Math.max(0, 1 - v / Y));
        d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = c8; d[i * 4 + 3] = 255;
      }
      cx.putImageData(im, 0, 0);
      return c;
    };
    grainCache[key] = { pos: mk(1), neg: mk(-1) };
    return grainCache[key];
  }
  function grain(g, seed, pct, T) {
    if (!(pct > 0) || !noise) return;
    var tiles = grainTiles(Math.round(pct * 10) / 10, T), r = R.stream(seed, 'grain');
    var ox = Math.floor(r() * noise.w), oy = Math.floor(r() * noise.h), cw = g.canvas.width, ch = g.canvas.height;
    g.save();
    g.setTransform(1, 0, 0, 1, -ox, -oy);                       // физические пиксели, сдвиг тайла от сида
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = g.createPattern(tiles.pos, 'repeat'); g.fillRect(0, 0, cw + ox, ch + oy);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = g.createPattern(tiles.neg, 'repeat'); g.fillRect(0, 0, cw + ox, ch + oy);
    g.restore();
  }

  /* ── кант: серп верха со стороны света (светлый) и с обратной (тёмный), клип по верху ── */
  function rim(g, s, L, tn, amount, ui) {
    if (!(amount > 0)) return;
    var l = R.light.toLight(L, s.x, s.y, s.z), n = Math.hypot(l[0], l[1]);
    if (n < 1e-4) return;
    var ux = l[0] / n, uy = l[1] / n, k = 0.75 * ui;
    var C = R.color, P = R.sdf.path;
    g.save();
    g.beginPath(); P(g, s); g.clip('evenodd');
    g.beginPath(); P(g, s); P(g, s, -ux * k, -uy * k);
    g.fillStyle = C.css(tn.light, 0.6 * amount); g.fill('evenodd');
    g.beginPath(); P(g, s); P(g, s, ux * k, uy * k);
    g.fillStyle = C.css(tn.shadow, 0.35 * amount); g.fill('evenodd');
    g.restore();
  }

  /* ── вещество кадра: неровность + зерно статичны, поэтому печатаются один раз в два полноразмерных
     холста (плюс — 'lighter', минус — 'multiply') и кладутся двумя проходами (бюджет кадра) ── */
  var matCache = null;
  function surface(g, W, H, seed, P, T) {
    var cw = g.canvas.width, ch = g.canvas.height, gr = P.grain == null ? T.grainDefault : +P.grain, un = +P.uneven || 0;
    if (!(gr > 0) && !(un > 0)) return;
    var key = [R.streamBase, cw, ch, W, H, seed, gr, un, T.theme, !!noise].join('|');
    if (!matCache || matCache.key !== key) {
      var mk = function (fill) { var c = document.createElement('canvas'); c.width = cw; c.height = ch;
        var x = c.getContext('2d'); x.fillStyle = fill; x.fillRect(0, 0, cw, ch); return c; };
      var pos = mk('rgb(0,0,0)'), neg = mk('rgb(255,255,255)'), pg = pos.getContext('2d'), ng = neg.getContext('2d');
      var sx = cw / W, sy = ch / H;
      [pg, ng].forEach(function (x) { x.setTransform(sx, 0, 0, sy, 0, 0); });
      // неровность: тот же знак-раздел, что в uneven(), но в кеш
      if (un > 0) {
        var ut = unevenTiles(W, H, seed, un, T);
        pg.imageSmoothingQuality = ng.imageSmoothingQuality = 'high';
        pg.globalCompositeOperation = 'lighter'; pg.drawImage(ut.pos, -W / 12, -H / 12, W * 7 / 6, H * 7 / 6);
        ng.globalCompositeOperation = 'multiply'; ng.drawImage(ut.neg, -W / 12, -H / 12, W * 7 / 6, H * 7 / 6);
      }
      if (gr > 0 && noise) {
        var tiles = grainTiles(Math.round(gr * 10) / 10, T), r = R.stream(seed, 'grain');
        var ox = Math.floor(r() * noise.w), oy = Math.floor(r() * noise.h);
        pg.setTransform(1, 0, 0, 1, -ox, -oy); ng.setTransform(1, 0, 0, 1, -ox, -oy);
        pg.globalCompositeOperation = 'lighter'; pg.fillStyle = pg.createPattern(tiles.pos, 'repeat'); pg.fillRect(0, 0, cw + ox, ch + oy);
        ng.globalCompositeOperation = 'multiply'; ng.fillStyle = ng.createPattern(tiles.neg, 'repeat'); ng.fillRect(0, 0, cw + ox, ch + oy);
      }
      matCache = { key: key, pos: pos, neg: neg };
    }
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'lighter'; g.drawImage(matCache.pos, 0, 0);
    g.globalCompositeOperation = 'multiply'; g.drawImage(matCache.neg, 0, 0);
    g.restore();
  }

  R.material = { tints: tints, uneven: uneven, grain: grain, rim: rim, loadNoise: loadNoise, surface: surface };
})();
