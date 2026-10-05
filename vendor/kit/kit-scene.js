// kit-scene.js — контракт сцены арсенала: один рельс для движка, фрагмента и витрины.
// Zero-dependency vanilla ES2020. Определяет одну глобаль: window.KIT.scene,
// и по требованию контракта — window.Scene, window.__FRAMES/__READY/__ERROR/__CONTEXT.
//
// Донор: data2d/src/d2-core.js (registerScene, ctx, счётчики, контракт адреса) и
// data-games/src/CONTRACT.md (грамматика деклараций). Взято устройство, не текст:
// у D2 рельс сросся с десятью видами данных, здесь остаётся голый контракт.
//
// Что рельс берёт на себя, чтобы это не переписывал каждый модуль:
//   · разбор адреса ?embed=1&theme&p&seed&preset&mode&reduced (+ алиасы noui, panel=off);
//   · канвас, dpr, ресайз, рамка стейджа;
//   · панель из params через DG.panel (единственный источник рядов);
//   · петля кадров, __FRAMES/__READY/__ERROR, покой при prefers-reduced-motion
//     (в покое сцена получает ctx.reduced и рисует ПОСТЕР, а не один шаг накопления);
//   · сид: cyrb128 + sfc32, отдельные потоки на слой, rand.reset() — число вызовов
//     rand НЕ зависит от размера окна, иначе golden-снимки рассыпаются на другом вьюпорте;
//   · Scene.set/get/export — единственный вход снаружи (setValue не дёргает onChange);
//   · postMessage наружу ready/frame, внутрь es:replay, es:progress, pause, play.
//     Без единого сообщения сцена играет сама: молчащий фрагмент не должен стоять чёрным.

/* KIT-SCENE v1.0.0 */
(function () {
  'use strict';

  // ── адрес ────────────────────────────────────────────────────────────
  const Q = new URLSearchParams(location.search);
  const EMBED = Q.get('embed') === '1' || Q.has('noui') || Q.get('panel') === 'off';
  const REDUCED = Q.get('reduced') === '1' ||
    (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const THEME = Q.get('theme') === 'night' ? 'night' : 'day';
  const MODE = Q.get('mode') === 'studio' ? 'studio' : (EMBED ? 'client' : 'studio');
  const SEED = Q.get('seed') || 'arsenal';
  const PRESET = Q.get('preset') || null;
  const PROGRESS0 = Q.has('p') ? Math.max(0, Math.min(1, parseFloat(Q.get('p')) || 0)) : null;

  window.__FRAMES = 0;
  window.__READY = false;
  window.__ERROR = null;
  window.__CONTEXT = EMBED ? 'embed' : 'live';   // live | capture | embed (модель fxhash)

  // ── сид: cyrb128 + sfc32. mulberry32 не берём: пропускает треть значений ──
  function cyrb128(str) {
    let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
    for (let i = 0, k; i < str.length; i++) {
      k = str.charCodeAt(i);
      h1 = h2 ^ Math.imul(h1 ^ k, 597399067); h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
      h3 = h4 ^ Math.imul(h3 ^ k, 951274213);  h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067); h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213); h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
  }
  function sfc32(a, b, c, d) {
    return function () {
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11); d = (d + 1) | 0;
      t = (t + d) | 0; c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }
  // отдельный поток на слой: палитра, геометрия и шум не сдвигают друг друга
  function stream(layer) {
    const make = () => sfc32.apply(null, cyrb128(SEED + '/' + layer));
    let fn = make();
    const r = function () { return fn(); };
    r.reset = function () { fn = make(); };
    return r;
  }

  // ── реестр сцен ──────────────────────────────────────────────────────
  const SCENES = [];
  let active = null;
  let ctx = null;
  let running = false;
  let paused = false;

  function register(def) {
    if (!def || !def.id || typeof def.draw !== 'function') {
      throw new Error('KIT.scene: сцене нужны id и draw');
    }
    SCENES.push(def);
    return def;
  }

  // ── параметры: плоская форма разворачивается в объектную 1:1 ─────────
  function toObjectParam(d) {
    if (!Array.isArray(d)) return d;
    const last = d[d.length - 1];
    const opts = (last && typeof last === 'object' && !Array.isArray(last)) ? last : {};
    const core = opts === last && last ? d.slice(0, -1) : d;
    if (core.length === 5 || (core.length === 6 && typeof core[5] === 'number')) {
      const toggle = core[2] === 0 && core[3] === 1 && core[4] === 1;
      // дефолт — шестой элемент плоской формы §6.3; его отсутствие это min, а не ноль
      const dflt = core.length === 6 ? core[5] : core[2];
      return Object.assign({
        id: core[0], label: core[1], type: toggle ? 'boolean' : 'number',
        min: core[2], max: core[3], step: core[4],
        default: opts.default !== undefined ? opts.default : dflt
      }, opts);
    }
    if (core.length >= 3 && Array.isArray(core[2])) {
      const many = core[3] === 'chips';
      return Object.assign({
        id: core[0], label: core[1], type: 'select', options: core[2].slice(),
        multi: many,
        default: opts.default !== undefined ? opts.default : (many ? [] : core[2][0])
      }, opts);
    }
    return Object.assign({ id: core[0], label: core[1], type: 'string', default: '' }, opts);
  }

  function defaults(def) {
    const out = {};
    (def.params || []).forEach(function (d) {
      const p = toObjectParam(d);
      out[p.id] = p.default;
    });
    const pre = (def.presets || []).filter(function (x) { return x.id === PRESET; })[0];
    if (pre && pre.values) Object.keys(pre.values).forEach(function (k) { out[k] = pre.values[k]; });
    return out;
  }

  // ── холст ────────────────────────────────────────────────────────────
  function fit() {
    if (!ctx) return;
    const r = ctx.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    ctx.W = Math.max(1, Math.round(r.width));
    ctx.H = Math.max(1, Math.round(r.height));
    ctx.canvas.width = Math.round(ctx.W * dpr);
    ctx.canvas.height = Math.round(ctx.H * dpr);
    ctx.g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function frame(force) {
    if (!ctx || !active) return;
    try {
      // 🔴 Потоки сбрасываются ПЕРЕД каждым кадром: иначе картинка зависит от
      //    числа уже нарисованных кадров, и один сид даёт разные отпечатки.
      ctx.rand.reset(); ctx.randPal.reset(); ctx.randNoise.reset();
      active.draw(ctx);
      window.__FRAMES++;
      window.__READY = true;
      if (window.__FRAMES === 1 || (window.__FRAMES % 60 === 0)) post('frame');
    } catch (e) {
      window.__ERROR = String((e && e.message) || e);
      running = false;                     // не молотить исключением шестьдесят раз в секунду
      throw e;
    }
  }

  function loop() {
    if (!running) return;
    if (!paused) { ctx.t = window.__FRAMES; ctx.dt = 1; frame(); }
    requestAnimationFrame(loop);
  }

  // ── связь с хостом ───────────────────────────────────────────────────
  function post(type) {
    try { parent.postMessage({ type: type, seed: SEED, preset: PRESET }, '*'); } catch (e) {}
  }

  window.addEventListener('message', function (e) {
    const d = e && e.data;
    if (!d || typeof d !== 'object') return;
    if (d.type === 'pause') paused = true;
    else if (d.type === 'play') { paused = false; }
    else if (d.type === 'es:replay') { window.__FRAMES = 0; frame(true); }
    else if (d.type === 'es:progress' && ctx) {
      ctx.p = Math.max(0, Math.min(1, +d.value || 0));
      frame(true);
    }
  });

  // ── старт ────────────────────────────────────────────────────────────
  function start(cfg) {
    cfg = cfg || {};
    active = cfg.scene || SCENES[0];
    if (!active) throw new Error('KIT.scene.start: ни одной сцены не зарегистрировано');

    const canvas = cfg.canvas || document.querySelector('canvas');
    if (!canvas) throw new Error('KIT.scene.start: канваса нет');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', active.title || active.id);

    const values = Object.assign(defaults(active), cfg.values || {});
    ctx = {
      canvas: canvas, g: canvas.getContext('2d'), W: 0, H: 0, t: 0, dt: 1,
      P: values, seed: SEED, theme: THEME, embed: EMBED, mode: MODE,
      p: PROGRESS0 === null ? 0 : PROGRESS0, reduced: REDUCED,
      rand: stream('geom'), randPal: stream('pal'), randNoise: stream('noise'),
      data: cfg.data || null
    };
    fit();

    if (typeof active.init === 'function') active.init(ctx);

    // стили панели приходят из кита строкой: один источник и разметки, и вида
    if (window.DG && DG.panel && DG.panel.css && !document.getElementById('kit-panel-css')) {
      const st = document.createElement('style');
      st.id = 'kit-panel-css';
      st.textContent = DG.panel.css;
      document.head.appendChild(st);
    }

    // панель: единственный источник рядов — kit-panel
    const mount = cfg.panelMount || document.querySelector('[data-panel]');
    if (mount && !EMBED && window.DG && DG.panel) {
      DG.panel.build({
        mount: mount,
        theme: THEME === 'night' ? 'night' : 'light',
        mode: MODE,
        values: values,
        groups: cfg.groups || [{ name: active.title || active.id, rows: active.params || [] }],
        onChange: function (path, v) { set(path, v, true); }
      });
    } else if (mount) {
      mount.hidden = true;
    }

    document.documentElement.classList.toggle('is-embed', EMBED);
    document.documentElement.classList.toggle('is-night', THEME === 'night');

    window.addEventListener('resize', function () { fit(); frame(true); });

    if (REDUCED) { frame(true); }          // покой: один кадр, хода нет
    else { running = true; loop(); }
    post('ready');
  }

  // ── единственный вход снаружи ────────────────────────────────────────
  // 🔴 DG.panel.setValue НЕ дёргает onChange (канон). Значит вождение сцены
  //    снаружи идёт только через set(): он пишет состояние И отражает в панели.
  function set(path, v, fromPanel) {
    if (!ctx) return;
    const num = (typeof ctx.P[path] === 'number');
    ctx.P[path] = num ? +v : v;
    if (!fromPanel && window.DG && DG.panel) DG.panel.setValue(path, ctx.P[path]);
    if (active && typeof active.structural === 'function') active.structural(ctx, path);
    frame(true);
  }

  function get(path) { return ctx ? ctx.P[path] : undefined; }

  function exportAs(kind) {
    if (!ctx) return null;
    if (kind === 'svg') {
      return (active && typeof active.svg === 'function') ? active.svg(ctx) : null;
    }
    return ctx.canvas.toDataURL('image/png');
  }

  window.KIT = window.KIT || {};
  KIT.scene = {
    register: register, start: start, list: function () { return SCENES.slice(); },
    toObjectParam: toObjectParam, version: '1.0.0',
    get ctx() { return ctx; }
  };
  window.Scene = { set: set, get: get };
  Scene.export = exportAs;      // объявлено отдельной строкой: контракт §6.2 читаем и грепом

})();
