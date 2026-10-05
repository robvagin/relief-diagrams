/* rail.js · сборщик кадра RELIEF: одна функция рисует пол, плашки, тени, кант, материал.
   Сцена отдаёт ТОЛЬКО список плашек и печать (что на них напечатано); свет, тени, плавание,
   зерно и порядок отрисовки (README §7.3) живут здесь. Painter снизу вверх:
   пол → печать пола → тени на пол → [плашка: верх → печать → тени сверху → кант] → неровность → зерно → слой взаимодействия. */
(function () {
  'use strict';
  var R = window.RELIEF = window.RELIEF || {};

  /* поток случайности рельса (L11): база берётся из потока kit-scene ctx.randNoise (четыре числа,
     затем reset — сцена получает свой поток нетронутым), слой на назначение — cyrb128 + sfc32 от базы,
     чтобы канопи, неровность и фазы не сдвигали поток геометрии сцены и друг друга */
  R.streamBase = '';
  R.seedFrom = function (ctx) {
    var b = [ctx.randNoise(), ctx.randNoise(), ctx.randNoise(), ctx.randNoise()].join(',');
    ctx.randNoise.reset();
    R.streamBase = b;
    return b;
  };
  function cyrb128(str) {
    var h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
    for (var i = 0, k; i < str.length; i++) {
      k = str.charCodeAt(i);
      h1 = h2 ^ Math.imul(h1 ^ k, 597399067); h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
      h3 = h4 ^ Math.imul(h3 ^ k, 951274213); h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067); h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213); h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
  }
  R.stream = function (seed, layer) {
    var s = cyrb128(R.streamBase + '/' + String(seed) + '/relief/' + layer), a = s[0], b = s[1], c = s[2], d = s[3];
    return function () {
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      var t = (a + b) | 0;
      a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11); d = (d + 1) | 0;
      t = (t + d) | 0; c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  };

  /* uiScale §7.1 и единица раскладки u; толщина линии L7 */
  R.ui = function (W, H) { return Math.max(0.34, Math.min(1.6, Math.min(W / 1440, H / 900))); };
  R.lineW = function (ui) { var dpr = Math.min(2, window.devicePixelRatio || 1); return Math.max(1 / dpr, 1.25 * ui); };
  /* лестница высот §6.2: z0–z3 × zscale × ui */
  R.Z = [0, 4, 12, 28];
  R.zh = function (level, P, ui) { return R.Z[level] * (P.zscale == null ? 1 : +P.zscale) * ui; };

  function sortPlates(ps) {
    return ps.map(function (p, i) { return [p, i]; })
      .sort(function (a, b) { return (a[0].z - b[0].z) || (a[1] - b[1]); })
      .map(function (x) { return x[0]; });
  }

  /* Кадр. spec = {plates:[{id, kind:'rect'|'circle', x, y — центр, w, h — размер, r, z — высота px,
                             rot, holes, env (0 покой … 1 плавает), assembleIndex, fill, noShadow}],
                    floor(g,F), print(g,plate,F), above(g,F)}
     Плашка в F.plates: та же форма после плавания и сборки, z — итоговая высота. */
  R.frame = function (ctx, spec) {
    R.seedFrom(ctx);
    var g = ctx.g, P = ctx.P, W = ctx.W, H = ctx.H, ui = R.ui(W, H), C = R.color;
    var T = R.tokens(ctx.theme, P.accent), tn = R.material.tints(T, +P.temp || 0);
    var L = R.light.state(P, W, H, ui), tsec = R.motion.time(ctx), still = !!ctx.reduced;
    var F = { ctx: ctx, g: g, P: P, W: W, H: H, ui: ui, u: Math.min(W, H) / 48, T: T, tn: tn, L: L, tsec: tsec,
      lineW: R.lineW(ui), still: still };

    var plates = (spec.plates || []).map(function (p, i) {
      var env = still ? 0 : (p.env == null ? 1 : p.env);
      var sz = p.kind === 'circle' ? p.w : p.h;
      var m = R.motion.float(ctx.seed, p.id == null ? i : p.id, tsec, P, p.w, sz, p.z || 0, env);
      var asm = (still || p.assembleIndex == null) ? 1 : R.motion.assemble(tsec, p.assembleIndex, +P.assemble);
      return {
        id: p.id, kind: p.kind || 'rect', x: p.x + m.dx, y: p.y + m.dy, w: p.w, h: sz,
        r: p.r == null ? (+P.radius || 0) * ui : p.r, rot: (p.rot || 0) + m.rot, holes: p.holes,
        z: Math.max(0, ((p.z || 0) + m.dh) * asm), fill: p.fill, noShadow: p.noShadow, src: p
      };
    });
    F.plates = plates;
    var occ = plates.filter(function (s) { return s.z > 0 && !s.noShadow; });
    var scale = W * H > 700000 ? 0.5 : 1;
    var G = (L.canopy > 0) ? R.canopy.mask(ctx.seed, W, H, ui, tsec, Math.max(1, +P.period || 36), still) : null;
    F.G = G;

    g.save();
    // 1–2 · пол и печать на полу
    g.fillStyle = C.css(tn.ground); g.fillRect(0, 0, W, H);
    if (spec.floor) spec.floor(g, F);
    // 3–4 · тени и контакт на пол (+ пятно лампы и листва по прямому свету)
    var floorRect = [0, 0, W, H];
    R.shade.apply(g, R.shade.field(L, floorRect, 0, occ, { scale: scale, G: G }), floorRect, tn.shadow);
    // 5 · плашки по возрастанию высоты
    sortPlates(plates).forEach(function (s) {
      g.save();
      g.beginPath(); R.sdf.path(g, s);
      g.fillStyle = C.css(s.fill || tn.plate); g.fill('evenodd');
      g.clip('evenodd');
      if (spec.print) spec.print(g, s, F);
      var above = occ.filter(function (c) { return c.z > s.z + 1e-3; });
      var ex = R.sdf.extent(s);
      var rect = [Math.floor(s.x - ex[0] - 2), Math.floor(s.y - ex[1] - 2), Math.ceil(2 * ex[0] + 4), Math.ceil(2 * ex[1] + 4)];
      R.shade.apply(g, R.shade.field(L, rect, s.z, above, { scale: scale, G: G }), rect, tn.shadow);
      g.restore();
      if (s.z > 0) R.material.rim(g, s, L, tn, +P.rim, ui);
    });
    // 6 · неровность и зерно последними (зерно оно же дизер, P-L6)
    R.material.uneven(g, W, H, ctx.seed, +P.uneven, T);
    R.material.grain(g, ctx.seed, P.grain == null ? T.grainDefault : +P.grain, T);
    g.restore();
    // 7 · слой взаимодействия
    if (spec.above) { g.save(); spec.above(g, F); g.restore(); }
    R.last = F;
    return F;
  };
})();
