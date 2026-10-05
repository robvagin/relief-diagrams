/* motion/motion.js · время, плавание, оседание, пружины, сборка (README §7.5, L6, канон кинематики).
   Время только из номера кадра: t_sec = ctx.t / fpsNominal. Плавание = гармоники ОДНОГО периода
   (целые k → цикл замыкается ровно за P, скорость непрерывна по построению). Огибающая env
   гасится smootherstep: непрерывны значение, скорость и ускорение. Пружина критически
   демпфирована (ζ = 1) и считается аналитически: без накопления, тот же кадр при любом пути к нему. */
(function () {
  'use strict';
  var R = window.RELIEF = window.RELIEF || {};
  var TAU = Math.PI * 2;
  var clock = { fps: 60, override: null };

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function smootherstep(x) { x = clamp(x, 0, 1); return x * x * x * (x * (x * 6 - 15) + 10); }
  /* cubic-bezier(.23,1,.32,1) как функция времени (Ньютон по x) */
  function bezier(x1, y1, x2, y2) {
    var cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    return function (x) {
      x = clamp(x, 0, 1); var t = x;
      for (var i = 0; i < 8; i++) {
        var fx = ((ax * t + bx) * t + cx) * t - x, d = (3 * ax * t + 2 * bx) * t + cx;
        if (Math.abs(fx) < 1e-6 || Math.abs(d) < 1e-6) break; t -= fx / d;
      }
      t = clamp(t, 0, 1);
      return ((ay * t + by) * t + cy) * t;
    };
  }
  var EASE = bezier(0.23, 1, 0.32, 1);

  /* время кадра в секундах; __freeze/__jump держат override */
  function time(ctx) {
    if (clock.override !== null) return clock.override;
    return (ctx.t || 0) / clock.fps;
  }

  /* фазы плашки: десять из собственного потока по id плашки (добавление плашки не сдвигает соседей) */
  var phaseCache = {};
  function phases(seed, id) {
    var k = R.streamBase + '|' + seed + '|' + id;
    if (!phaseCache[k]) { var r = R.stream(seed, 'float/' + id), a = []; for (var i = 0; i < 10; i++) a.push(r() * TAU); phaseCache[k] = a; }
    return phaseCache[k];
  }

  /* Плавание §7.5: dx, dy, rot (рад), dh; env ∈ [0,1] множит всё */
  function float(seed, id, tsec, P, w, h, hgt, env) {
    if (!(env > 0)) return { dx: 0, dy: 0, rot: 0, dh: 0 };
    var ph = phases(seed, id), per = Math.max(1, +P.period || 36), ww = TAU * ((tsec % per) / per);
    var A = (+P.float || 0) * Math.min(2.4, 0.004 * Math.min(w, h)) * env;
    var harm = function (a, b, c) { return 0.62 * Math.sin(ww + ph[a]) + 0.28 * Math.sin(2 * ww + ph[b]) + 0.10 * Math.sin(3 * ww + ph[c]); };
    return {
      dx: A * harm(0, 1, 2),
      dy: A * harm(3, 4, 5),
      rot: (+P.sway || 0) * Math.PI / 180 * env * (0.7 * Math.sin(ww + ph[6]) + 0.3 * Math.sin(2 * ww + ph[7])),
      dh: (+P.bob || 0) * hgt * env * (0.7 * Math.sin(ww + ph[8]) + 0.3 * Math.sin(3 * ww + ph[9]))
    };
  }

  /* Оседание: env 1 → 0 за settle с от момента t0 (smootherstep) */
  function settle(tsec, t0, dur) { return t0 == null ? 1 : 1 - smootherstep((tsec - t0) / Math.max(0.05, dur)); }

  /* Критически демпфированная пружина ω = 2π/0,5 с: x(τ) = b + (a − b)(1 + ωτ)e^(−ωτ); перелёта нет */
  function spring(a, b, tau, omega) {
    if (tau <= 0) return a;
    var w = omega || TAU / 0.5, e = Math.exp(-w * tau);
    return b + (a - b) * (1 + w * tau) * e;
  }

  /* Сборка: i-я плашка в порядке чтения поднимается с h = 0, шаг 80 мс, длительность 520 мс */
  function assemble(tsec, i, on) {
    if (!on) return 1;
    return EASE((tsec - 0.08 * i) / 0.52);
  }

  /* fpsNominal: медиана первых 20 интервалов rAF (60 или 120); съёмка и выгрузка всегда 60 */
  function measureFps(n) {
    return new Promise(function (res) {
      var last = null, ds = [];
      function step(ts) {
        if (last !== null) ds.push(ts - last);
        last = ts;
        if (ds.length >= (n || 20)) {
          ds.sort(function (a, b) { return a - b; });
          var m = ds[ds.length >> 1];
          clock.fps = m < 12 ? 120 : 60; res(clock.fps);
        } else requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
      setTimeout(function () { res(clock.fps); }, 900);
    });
  }

  R.motion = {
    clock: clock, time: time, float: float, settle: settle, spring: spring, assemble: assemble,
    ease: EASE, smootherstep: smootherstep, phases: phases, measureFps: measureFps, TAU: TAU
  };
})();
