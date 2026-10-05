/* export.js · выгрузка PNG и SVG (README §6.8, §7.10).
   PNG: форматы screen · 16:9 · 1:1 · 4:5, масштаб ×1–×3; кадр рисуется заново в офскрине тем же
   сидом и номером кадра (потоки kit сбрасываются, часы не трогаются).
   SVG: плашки <rect rx>/<circle>, тени одним фильтром на корзину Δh (feOffset + feGaussianBlur +
   feFlood + feComposite), клип по приёмнику, кант светом через feDiffuseLighting + feDistantLight
   (тот же азимут и высота, что у кадра), зерно feTurbulence. Печать сцены в SVG — svgPrint(plate, F). */
(function () {
  'use strict';
  var R = window.RELIEF = window.RELIEF || {};
  var FORMATS = { '16:9': [1920, 1080], '1:1': [1080, 1080], '4:5': [1080, 1350] };

  function sceneDef() { return (window.KIT && KIT.scene && KIT.scene.list()[0]) || null; }

  /* PNG выбранного формата; screen = как на экране */
  function png(format, scale) {
    var ctx = KIT.scene.ctx, def = sceneDef();
    if (!ctx || !def) return null;
    format = format || ctx.P.format || 'screen';
    if (format === 'screen' || !FORMATS[format]) return ctx.canvas.toDataURL('image/png');
    var sz = FORMATS[format], k = Math.max(1, Math.min(3, Math.round(+scale || 1)));
    var W = sz[0], H = sz[1], c = document.createElement('canvas');
    c.width = W * k; c.height = H * k;
    var g = c.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0);
    var x = Object.assign({}, ctx, { canvas: c, g: g, W: W, H: H });
    ctx.rand.reset(); ctx.randPal.reset(); ctx.randNoise.reset();
    var keep = R.last;
    def.draw(x);
    R.last = keep;
    return c.toDataURL('image/png');
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function rgb(c, a) { return R.color.css(c, a); }

  function shapeEl(s, extra) {
    var t = s.rot ? ' transform="rotate(' + (s.rot * 180 / Math.PI).toFixed(3) + ' ' + s.x.toFixed(2) + ' ' + s.y.toFixed(2) + ')"' : '';
    if (s.kind === 'circle') return '<circle cx="' + s.x.toFixed(2) + '" cy="' + s.y.toFixed(2) + '" r="' + (s.w / 2).toFixed(2) + '"' + t + (extra || '') + '/>';
    return '<rect x="' + (s.x - s.w / 2).toFixed(2) + '" y="' + (s.y - s.h / 2).toFixed(2) + '" width="' + s.w.toFixed(2) + '" height="' + s.h.toFixed(2) +
      '" rx="' + (s.r || 0).toFixed(2) + '"' + t + (extra || '') + '/>';
  }

  /* SVG последнего кадра */
  function svg(ctx) {
    var F = R.last; if (!F) return null;
    var L = F.L, tn = F.tn, W = F.W, H = F.H, P = F.P, def = sceneDef();
    var out = [], defs = [], buckets = {};
    var plates = F.plates.slice().sort(function (a, b) { return a.z - b.z; });
    var filt = function (dh) {
      var k = Math.round(dh * 2) / 2; if (buckets[k]) return buckets[k];
      var id = 'sh' + String(k).replace('.', '_'), o = R.light.offset(L, W / 2, H / 2, k, 0), sg = R.light.sigma(L, k), D = R.light.density(L, k);
      defs.push('<filter id="' + id + '" x="-30%" y="-30%" width="160%" height="160%"><feOffset in="SourceAlpha" dx="' + o[0].toFixed(2) + '" dy="' + o[1].toFixed(2) +
        '"/><feGaussianBlur stdDeviation="' + sg.toFixed(2) + '"/><feComponentTransfer><feFuncA type="linear" slope="' + D.toFixed(3) +
        '"/></feComponentTransfer><feComposite in2="SourceAlpha" operator="out" result="s"/><feFlood flood-color="' + rgb(tn.shadow) +
        '"/><feComposite in2="s" operator="in"/></filter>');
      return (buckets[k] = id);
    };
    var az = (L.az * 180 / Math.PI), el = (L.elev * 180 / Math.PI);
    // кант светом: рельеф альфы плашки под тем же светом, что у кадра (MDN feDiffuseLighting)
    defs.push('<filter id="rim" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur in="SourceAlpha" stdDeviation="' + (0.6 * F.ui).toFixed(2) +
      '" result="b"/><feDiffuseLighting in="b" surfaceScale="2" diffuseConstant="1" lighting-color="' + rgb(tn.light) + '" result="d"><feDistantLight azimuth="' +
      (360 - az).toFixed(1) + '" elevation="' + el.toFixed(1) + '"/></feDiffuseLighting><feComposite in="d" in2="SourceGraphic" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="m"/>' +
      '<feComposite in="m" in2="SourceAlpha" operator="in"/></filter>');
    var gpct = (P.grain == null ? F.T.grainDefault : +P.grain) / 100;
    defs.push('<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7"/>' +
      '<feColorMatrix type="matrix" values="0 0 0 0 .5  0 0 0 0 .5  0 0 0 0 .5  ' + (2 * gpct).toFixed(4) + ' 0 0 0 0"/></filter>');
    out.push('<rect width="' + W + '" height="' + H + '" fill="' + rgb(tn.ground) + '"/>');
    // тени на пол
    plates.forEach(function (s) { if (s.z > 0 && !s.noShadow) out.push('<g filter="url(#' + filt(s.z) + ')">' + shapeEl(s, ' fill="' + rgb(tn.plate) + '"') + '</g>'); });
    plates.forEach(function (s, i) {
      var id = 'cp' + i;
      defs.push('<clipPath id="' + id + '">' + shapeEl(s) + '</clipPath>');
      out.push(shapeEl(s, ' fill="' + rgb(s.fill || tn.plate) + '"'));
      if (def && def.svgPrint) out.push('<g clip-path="url(#' + id + ')">' + (def.svgPrint(s, F) || '') + '</g>');
      // тени плашек выше на эту плашку, клип по приёмнику
      var above = plates.filter(function (c) { return c.z > s.z && !c.noShadow; });
      if (above.length) out.push('<g clip-path="url(#' + id + ')">' + above.map(function (c) {
        return '<g filter="url(#' + filt(c.z - s.z) + ')">' + shapeEl(c, ' fill="' + rgb(tn.plate) + '"') + '</g>';
      }).join('') + '</g>');
      if (s.z > 0 && +P.rim > 0) out.push('<g filter="url(#rim)" opacity="' + (0.35 * P.rim).toFixed(3) + '" style="mix-blend-mode:soft-light">' + shapeEl(s, ' fill="' + rgb(tn.plate) + '"') + '</g>');
    });
    if (gpct > 0) out.push('<rect width="' + W + '" height="' + H + '" filter="url(#grain)" style="mix-blend-mode:overlay"/>');
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' +
      '<title>' + esc((def && def.title) || 'relief') + '</title><defs>' + defs.join('') + '</defs>' + out.join('') + '</svg>';
  }

  /* имя кадра §3: ГГГГ-ММ-ДД_relief_<сцена>-<тема>-<ш>x<в>_vNN.png */
  function filename(id, theme, w, h, ext, ver) {
    var d = new Date().toISOString().slice(0, 10);
    return d + '_relief_' + id + '-' + theme + '-' + w + 'x' + h + '_v' + String(ver || 1).padStart(2, '0') + '.' + ext;
  }

  function download(url, name) {
    var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }

  R.export = { png: png, svg: svg, filename: filename, download: download, FORMATS: FORMATS };
})();
