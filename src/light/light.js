/* light/light.js · одно состояние света (L1) и его формулы (README §7.2).
   Каждая тень, блик, кант и перепад светлоты выводятся отсюда; руками у элемента ничего не задаётся. */
(function () {
  'use strict';
  var R = window.RELIEF = window.RELIEF || {};
  var D2R = Math.PI / 180;

  /* Пресеты света §6.3: старт, не запрет — ручки остаются живыми */
  var PRESETS = {
    soft:   { az: 135, elev: 42, soft: 0.28, dens: 0.20, amb: 0.72, pool: 0, canopy: 0 },
    raking: { az: 160, elev: 22, soft: 0.20, dens: 0.26, amb: 0.66, pool: 0, canopy: 0 },
    lamp:   { soft: 0.30, dens: 0.30, amb: 0.40, pool: 0.55, lampH: 900, canopy: 0 },
    canopy: { az: 140, elev: 48, soft: 0.30, dens: 0.20, amb: 0.72, pool: 0, canopy: 0.22 }
  };
  var LAMP_XY = { x: 0.32, y: 0.28 };

  function smoothstep(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  /* Состояние света кадра из плоских ручек P. uiScale множит пиксельные величины */
  function state(P, W, H, ui) {
    var mode = P.light === 'lamp' ? 'lamp' : 'dir';
    var az = (+P.az || 0) * D2R, el = Math.max(1, Math.min(89, +P.elev || 42)) * D2R;
    var L = {
      mode: mode, preset: P.light, az: az, elev: el,
      soft: +P.soft, dens: +P.dens, amb: +P.amb, contact: +P.contact, temp: +P.temp,
      canopy: +P.canopy || 0, ui: ui || 1, W: W, H: H,
      cot: Math.cos(el) / Math.sin(el),
      // вектор к свету и направление тени по плоскости (экран: y вниз)
      l: [Math.cos(el) * Math.cos(az), -Math.cos(el) * Math.sin(az), Math.sin(el)],
      d: [-Math.cos(az), Math.sin(az)],
      lamp: { x: LAMP_XY.x * W, y: LAMP_XY.y * H, h: (+P.lampH || 900) * (ui || 1), pool: +P.pool || 0 }
    };
    L.E0 = L.amb + (1 - L.amb) * Math.sin(el);
    return L;
  }

  /* Сдвиг тени заслонителя (центр cx,cy, высота hc) на приёмник высоты hr: o = Δh·cot φ·d,
     у лампы лучами от лампы: o = (c − L)·Δh/(H_L − h_c) */
  function offset(L, cx, cy, hc, hr) {
    var dh = hc - hr;
    if (dh <= 0) return [0, 0];
    if (L.mode === 'lamp') {
      var k = dh / Math.max(1, L.lamp.h - hc);
      return [(cx - L.lamp.x) * k, (cy - L.lamp.y) * k];
    }
    return [L.d[0] * dh * L.cot, L.d[1] * dh * L.cot];
  }
  /* Полутень σ = 0.6 + soft·Δh (px × ui) */
  function sigma(L, dh) { return (0.6 * L.ui) + L.soft * Math.max(0, dh); }
  /* Плотность D(Δh) = dens·(1 − 0.35·smoothstep(0, 40, Δh)): высокое подсвечено рассеянным */
  function density(L, dh) { return L.dens * (1 - 0.35 * smoothstep(0, 40 * L.ui, dh)); }
  /* Горизонтальный вектор к свету в точке (для канта и рельефа); у лампы свой у каждой точки */
  function toLight(L, x, y, h) {
    if (L.mode === 'lamp') {
      var dx = L.lamp.x - x, dy = L.lamp.y - y, dz = L.lamp.h - (h || 0), n = Math.hypot(dx, dy, dz) || 1;
      return [dx / n, dy / n, dz / n];
    }
    return L.l;
  }
  /* Освещённость лампы, нормированная на 1 под лампой: cos³ угла падения; пятно lit = mix(1, E^0.6, pool) */
  function lampLit(L, x, y, h) {
    if (L.mode !== 'lamp' || L.lamp.pool <= 0) return 1;
    var dz = Math.max(1, L.lamp.h - (h || 0)), dx = x - L.lamp.x, dy = y - L.lamp.y;
    var c = dz / Math.sqrt(dx * dx + dy * dy + dz * dz), E = c * c * c;
    return 1 + (Math.pow(E, 0.6) - 1) * L.lamp.pool;
  }

  R.light = {
    PRESETS: PRESETS, LAMP_XY: LAMP_XY, state: state, offset: offset, sigma: sigma,
    density: density, toLight: toLight, lampLit: lampLit, smoothstep: smoothstep
  };
})();
