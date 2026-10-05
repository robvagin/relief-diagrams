/* lab.js · калибровка рельса dist/_lab.html (Ф0.3): _light · _ruler · _float · _grain.
   Не сцена наряда, а стенд света, линии, плавания и зерна; пробы P-L, P-M, P-T2 гоняются по нему.
   Расстановка — правило сетки по полям кадра (L12), ручных координат нет. */
(function () {
  'use strict';
  var R = window.RELIEF;
  var VIEWS = ['_light', '_ruler', '_float', '_grain'];
  var only = null;                       // пробы: __lab.only(['z2']) оставляет в кадре одну плашку
  var flags = {};                        // пробы: __lab.flag('nograin') и т.п.

  function grid(F, cols, rows, pad) {
    var m = Math.min(F.W, F.H) * 0.06, x0 = m, y0 = m * 1.6, w = F.W - 2 * m, h = F.H - y0 - m * 1.4;
    var cw = w / cols, ch = h / rows, out = [];
    for (var j = 0; j < rows; j++) for (var i = 0; i < cols; i++)
      out.push({ x: x0 + cw * (i + 0.5), y: y0 + ch * (j + 0.5), w: cw * (1 - pad), h: ch * (1 - pad) });
    return out;
  }

  function header(g, F, title, sub) {
    var m = Math.min(F.W, F.H) * 0.06, I = R.ink;
    I.text(g, F, title, m, m * 0.9, { s: 2, w: 500 });
    if (sub) I.text(g, F, sub, m, m * 0.9 + 18 * F.ui, { s: 0, mono: true, tone: 'ink3' });
    I.fictional(g, F);
  }

  function lightLabel(F) {
    var P = F.P;
    return P.light === 'lamp' ? 'lamp · x .32 y .28 · h ' + P.lampH + ' · pool ' + (+P.pool).toFixed(2)
      : P.light + ' · az ' + P.az + '° · elev ' + P.elev + '° · soft ' + (+P.soft).toFixed(2) + ' · dens ' + (+P.dens).toFixed(2);
  }

  /* _light: плашки z0–z3 на полу, плашка z3 над плашкой z1, диск z2 */
  function viewLight(ctx) {
    var P = ctx.P, ui = R.ui(ctx.W, ctx.H), plates = [], labels = [];
    var cells = grid({ W: ctx.W, H: ctx.H }, 3, 2, 0.30);
    [0, 1, 2, 3].forEach(function (lv, i) {
      var c = cells[i], s = Math.min(c.w, c.h) * 0.62;
      plates.push({ id: 'z' + lv, x: c.x, y: c.y, w: s * 1.3, h: s, z: R.zh(lv, P, ui), assembleIndex: i });
      labels.push([c.x, c.y + s / 2 + 26 * ui, 'z' + lv + ' · ' + R.Z[lv] + ' px']);
    });
    var c4 = cells[4], b = Math.min(c4.w, c4.h) * 0.86;
    plates.push({ id: 'base', x: c4.x, y: c4.y, w: b * 1.25, h: b * 0.9, z: R.zh(1, P, ui), assembleIndex: 4 });
    plates.push({ id: 'top', x: c4.x + b * 0.08, y: c4.y - b * 0.04, w: b * 0.42, h: b * 0.34, z: R.zh(3, P, ui), assembleIndex: 5 });
    labels.push([c4.x, c4.y + b * 0.45 + 26 * ui, 'z3 over z1 · receiver']);
    var c5 = cells[5], d = Math.min(c5.w, c5.h) * 0.62;
    plates.push({ id: 'disc', kind: 'circle', x: c5.x, y: c5.y, w: d, z: R.zh(2, P, ui), assembleIndex: 6 });
    labels.push([c5.x, c5.y + d / 2 + 26 * ui, 'disc · z2']);
    if (only) plates = plates.filter(function (p) { return only.indexOf(p.id) >= 0; });
    plates.forEach(function (p) { if (flags.ghost && flags.ghost.indexOf(p.id) >= 0) p.ghost = true; });
    return {
      print: flags.gloss ? function (g, s) {          // грязный дубль P-L5: глянцевый блик
        var gr = g.createRadialGradient(s.x - s.w * 0.2, s.y - s.h * 0.2, 0, s.x, s.y, Math.max(s.w, s.h) * 0.6);
        gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(s.x - s.w, s.y - s.h, s.w * 2, s.h * 2);
      } : null,
      plates: plates,
      floor: function (g, F) {
        header(g, F, 'Rail calibration · light', lightLabel(F));
        labels.forEach(function (l) { R.ink.text(g, F, l[2], l[0], l[1], { s: 0, mono: true, tone: 'ink3', align: 'center' }); });
      }
    };
  }

  /* _ruler: одна толщина линии на зуме .5 · 1 · 2 (координаты масштабируются, перо нет) */
  function viewRuler(ctx) {
    var cells = grid({ W: ctx.W, H: ctx.H }, 3, 1, 0.12), Z = [0.5, 1, 2], ui = R.ui(ctx.W, ctx.H);
    var plates = cells.map(function (c, i) { return { id: 'r' + i, x: c.x, y: c.y, w: c.w, h: Math.min(c.h, c.w * 1.1), z: R.zh(1, ctx.P, ui), env: 0 }; });
    return {
      plates: plates,
      floor: function (g, F) { header(g, F, 'Rail calibration · ruler', 'one line width at zoom 0.5 · 1 · 2 · lineW ' + F.lineW.toFixed(2) + ' px'); },
      print: function (g, s, F) {
        var i = +String(s.id).slice(1), z = Z[i], step = 22 * F.ui * z, x0 = s.x - s.w / 2, y0 = s.y - s.h / 2;
        if (!flags.nogrid) for (var x = x0 + step; x < x0 + s.w; x += step) R.ink.relief(g, F, [[x, y0], [x, y0 + s.h]], { alpha: 0.7 });
        if (!flags.nogrid) for (var y = y0 + step; y < y0 + s.h; y += step) R.ink.relief(g, F, [[x0, y], [x0 + s.w, y]], { alpha: 0.7 });
        var pts = [], r = 46 * F.ui * z;
        if (flags.ctxscale) {                         // грязный дубль P-T2: масштаб пером вместо координат
          g.save(); g.translate(s.x, s.y); g.scale(z, z);
          for (var q = 0; q <= 64; q++) pts.push([46 * F.ui * Math.cos(q / 64 * Math.PI * 2), 46 * F.ui * Math.sin(q / 64 * Math.PI * 2)]);
          R.ink.print(g, F, pts, { tone: 'ink' }); g.restore(); pts = null;
        } else {
          for (var k = 0; k <= 64; k++) pts.push([s.x + r * Math.cos(k / 64 * Math.PI * 2), s.y + r * Math.sin(k / 64 * Math.PI * 2)]);
          R.ink.print(g, F, pts, { tone: 'ink' });
        }
        R.ink.print(g, F, [[x0 + 12 * F.ui, y0 + s.h - 12 * F.ui], [x0 + s.w - 12 * F.ui, y0 + 12 * F.ui]], { tone: 'ink' });
        R.ink.text(g, F, '×' + z, x0 + 10 * F.ui, y0 + 20 * F.ui, { s: 1, mono: true, w: 500 });
      }
    };
  }

  /* _float: пять состояний плашки §6.4 по циклу 6 с и поле плавающих плашек */
  var STATES = ['rest', 'float', 'lift', 'settle', 'drop'];
  function stateAt(name, ts, P, ui) {
    var cyc = 6, u = ((ts % cyc) + cyc) % cyc, M = R.motion, z1 = R.zh(1, P, ui), z3 = R.zh(3, P, ui);
    var env = 1, z = z1;
    if (name === 'rest') env = 0;
    if (name === 'lift') { z = u < 1 ? z1 : u < 4 ? M.spring(z1, z3, u - 1) : M.spring(M.spring(z1, z3, 3), z1, u - 4); }
    if (name === 'settle') {
      // оседание за settle с, затем мягкое пробуждение до конца цикла: огибающая гладкая на стыке
      var s = +P.settle || 0.9;
      env = u < 1.5 ? 1 : u < 1.5 + s ? M.settle(u, 1.5, s) : u < 4.5 ? 0 : M.smootherstep((u - 4.5) / 1.4);
    }
    if (name === 'drop') {
      z = u < 1.5 ? z1 : u < 4.5 ? M.spring(z1, 0, u - 1.5) : M.spring(M.spring(z1, 0, 3), z1, u - 4.5);
      // отклонено: плавание гаснет за settle с, пока плашка опускается; пробуждение мягкое
      env = u < 1.5 ? 1 : u < 4.5 ? M.settle(u, 1.5, +P.settle || 0.9) : M.smootherstep((u - 4.5) / 1.4);
    }
    return { env: env, z: z };
  }
  function viewFloat(ctx) {
    var P = ctx.P, ui = R.ui(ctx.W, ctx.H), ts = R.motion.time(ctx), plates = [];
    var cells = grid({ W: ctx.W, H: ctx.H }, 5, 2, 0.34);
    STATES.forEach(function (st, i) {
      var c = cells[i], q = stateAt(st, ts, P, ui), s = Math.min(c.w, c.h);
      plates.push({ id: st, x: c.x, y: c.y, w: s * 1.15, h: s * 0.8, z: q.z, env: ctx.reduced ? 0 : q.env });
    });
    for (var i = 5; i < 10; i++) {
      var c = cells[i], s = Math.min(c.w, c.h);
      plates.push({ id: 'f' + i, x: c.x, y: c.y, w: s * (0.8 + 0.1 * (i % 3)), h: s * 0.62, z: R.zh(1 + (i % 3), P, ui) });
    }
    return {
      plates: plates,
      floor: function (g, F) {
        header(g, F, 'Rail calibration · float', 'period ' + P.period + ' s · float ' + (+P.float).toFixed(2) + ' · sway ' + P.sway + '° · bob ' + P.bob);
        STATES.forEach(function (st, i) { var c = cells[i]; R.ink.text(g, F, st, c.x, c.y + c.h * 0.55, { s: 0, mono: true, tone: 'ink3', align: 'center' }); });
      }
    };
  }

  /* _grain: мягкий перепад (пятно лампы на весь кадр) и высокая мягкая плашка — проба ступенек */
  function viewGrain(ctx) {
    var ui = R.ui(ctx.W, ctx.H), cells = grid({ W: ctx.W, H: ctx.H }, 3, 1, 0.5);
    return {
      lightOverride: { light: 'lamp', pool: Math.max(0.6, +ctx.P.pool || 0) },
      plates: [{ id: 'g', x: cells[2].x, y: cells[2].y, w: cells[2].w, h: cells[2].w * 0.6, z: R.zh(3, ctx.P, ui) * 2, env: 0 }],
      floor: function (g, F) { header(g, F, 'Rail calibration · grain', 'blue noise 128 px · grain ' + (+F.P.grain).toFixed(1) + ' % · static'); }
    };
  }

  var def = {
    id: 'lab',
    title: 'Rail calibration',
    blurb: 'Light, line, float and grain calibration of the RELIEF rail.',
    params: [['view', 'Вид', VIEWS, '_light', ['Свет', 'Линейка', 'Плавание', 'Зерно']]],
    groups: { 'Сцена': [['view', 'Вид', VIEWS, '_light', ['Свет', 'Линейка', 'Плавание', 'Зерно']]] },
    draw: function (ctx) {
      var v = ctx.P.view, spec = v === '_ruler' ? viewRuler(ctx) : v === '_float' ? viewFloat(ctx) : v === '_grain' ? viewGrain(ctx) : viewLight(ctx);
      if (flags.nograin) { var g0 = ctx.P.grain; ctx.P.grain = 0; }
      if (flags.ghost && spec.plates) spec.plates.forEach(function (p) { if (flags.ghost.indexOf(p.id) >= 0) p.ghost = true; });
      if (spec.lightOverride) {
        var keep = {}; Object.keys(spec.lightOverride).forEach(function (k) { keep[k] = ctx.P[k]; ctx.P[k] = spec.lightOverride[k]; });
        R.frame(ctx, spec);
        Object.keys(keep).forEach(function (k) { ctx.P[k] = keep[k]; });
      } else R.frame(ctx, spec);
      if (flags.nograin) ctx.P.grain = g0;
    },
    svg: function (ctx) { return R.export.svg(ctx); }
  };

  /* служебные входы стендов (канон кинематики): __probe(id, t) без отрисовки, __freeze, __jump */
  window.__lab = {
    only: function (ids) { only = ids; }, flag: function (k, v) { flags[k] = v == null ? 1 : v; },
    reset: function () { only = null; flags = {}; },
    stateAt: stateAt
  };
  window.__fxlist = function () { return STATES.map(function (s) { return { id: s, name: s, group: 'float' }; }); };
  window.__vals = function () { return KIT.scene.ctx ? KIT.scene.ctx.P : {}; };
  window.__probe = function (id, t) {
    var ctx = KIT.scene.ctx, P = ctx.P, ui = R.ui(ctx.W, ctx.H), q = stateAt(id, t, P, ui), s = 200;
    var m = R.motion.float(ctx.seed, id, t, P, s * 1.15, s * 0.8, q.z, q.env);
    return { dx: m.dx, dy: m.dy, rot: m.rot, dh: m.dh, z: q.z, env: q.env };
  };
  R.def = def;
})();
