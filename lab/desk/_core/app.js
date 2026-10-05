// app.js — оболочка варианта desk/ledger на рельсе src/ (свет, тени, материал, движение приняты владельцем):
// адаптер DG.panel поверх Podacha.Panel v2 (README §7.11, файлы вендора не правятся), панель видна всегда,
// хоткеи §6.10 (кроме H), выгрузка PNG и ссылка в подвале панели, старт после шрифтов, шума и fpsNominal.
(function () {
  'use strict';
  var R = window.RELIEF;

  // ── DG.panel: build / setValue / getValues / setTheme / setMode / css ──
  var PANEL = { root: null, built: [], state: null, opts: null };
  function v2theme(t) { return t === 'night' || t === 'dark' ? 'dark' : 'light'; }
  function buildPanel(opts) {
    PANEL.opts = opts; PANEL.state = opts.values; PANEL.built = [];
    var mount = opts.mount;
    mount.textContent = '';
    var root = document.createElement('div');
    root.className = 'pv2 pv2-root';
    root.setAttribute('data-theme', v2theme(opts.theme));
    var head = document.createElement('div');
    head.className = 'pv2-head';
    var b = document.createElement('b'); b.textContent = opts.title || '';
    var s = document.createElement('span'); s.textContent = opts.sub || '';
    head.appendChild(b); head.appendChild(s); root.appendChild(head);
    if (opts.hint) { var h = document.createElement('p'); h.className = 'pv2-hint'; h.textContent = opts.hint; root.appendChild(h); }
    (opts.groups || []).forEach(function (gr) {
      var rows = gr.rows.filter(function (d) {
        var tail = d[d.length - 1];
        return !(opts.mode === 'client' && tail && typeof tail === 'object' && !Array.isArray(tail) && tail.studio);
      });
      if (!rows.length) return;
      var fs = document.createElement('fieldset');
      var lg = document.createElement('legend'); lg.textContent = gr.name; fs.appendChild(lg);
      PANEL.built.push(window.Podacha.Panel.build(fs, rows, PANEL.state, function (k, v) { opts.onChange(k, v); }));
      root.appendChild(fs);
    });
    if (opts.actions) {
      var ft = document.createElement('div'); ft.className = 'pv2-foot';
      opts.actions.forEach(function (a) {
        var bt = document.createElement('button'); bt.type = 'button'; bt.className = 'btn'; bt.textContent = a.label;
        bt.title = a.title || a.label; bt.addEventListener('click', a.run); ft.appendChild(bt);
      });
      root.appendChild(ft);
    }
    mount.appendChild(root);
    PANEL.root = root;
  }
  function paintAll() { PANEL.built.forEach(function (b) { b.paint(); }); }
  window.DG = window.DG || {};
  window.DG.panel = {
    build: function (opts) { buildPanel(Object.assign({}, APP.panelExtra || {}, opts)); },
    setValue: function (path, v) { if (PANEL.state) { PANEL.state[path] = v; paintAll(); } },
    getValues: function () { return Object.assign({}, PANEL.state || {}); },
    setTheme: function (t) { if (PANEL.root) PANEL.root.setAttribute('data-theme', v2theme(t)); },
    setMode: function (m) { if (PANEL.opts) buildPanel(Object.assign({}, PANEL.opts, { mode: m })); },
    css: ''
  };

  // общие ряды §6.10 (грамматика v2)
  var COMMON = {
    light: [
      ['light', 'Свет', ['soft', 'raking', 'lamp', 'canopy'], 'soft', ['Мягкий', 'Скользящий', 'Лампа', 'Листва']],
      ['az', 'Азимут, °', 0, 360, 1, 135, 'Откуда свет: 135 = слева сверху'],
      ['elev', 'Высота, °', 8, 80, 1, 42, 'Ниже солнце = длиннее тени'],
      ['soft', 'Мягкость', 0, 1, 0.01, 0.28, 'Рост полутени на пиксель высоты'],
      ['dens', 'Плотность тени', 0, 0.6, 0.01, 0.20],
      ['amb', 'Рассеянный', 0.2, 0.95, 0.01, 0.72],
      ['contact', 'Контакт', 0, 0.3, 0.01, 0.12, 'Тонкая тень у самой опоры'],
      ['pool', 'Пятно лампы', 0, 1, 0.01, 0],
      ['lampH', 'Высота лампы', 300, 2000, 10, 900],
      ['canopy', 'Листва', 0, 0.6, 0.01, 0, 'Пятна света сквозь крону'],
      ['temp', 'Температура', -1, 1, 0.01, 0.25, 'Тёплый свет, холодная тень']
    ],
    material: [
      ['grain', 'Зерно, %', 0, 4, 0.1, 1.6],
      ['uneven', 'Неровность, %', 0, 2, 0.1, 0.8],
      ['rim', 'Кант', 0, 1, 0.01, 0.5],
      ['radius', 'Радиус листа', 0, 8, 0.5, 6],
      ['zscale', 'Шкала высот', 0, 2, 0.01, 1],
      ['sag', 'Провис бумаги', 0, 1, 0.01, 0.5, 'Едва заметный прогиб листа под светом'],
      ['accent', 'Акцент', ['terracotta', 'cobalt', 'olive'], 'terracotta', ['Терракота', 'Кобальт', 'Олива']]
    ],
    motion: [
      ['float', 'Плавание', 0, 2, 0.01, 1],
      ['period', 'Период, с', 12, 72, 1, 36],
      ['sway', 'Качание, °', 0, 1.5, 0.05, 0.3],
      ['bob', 'Дыхание тени', 0, 0.2, 0.01, 0.08],
      ['settle', 'Оседание, с', 0.3, 2, 0.05, 0.9],
      ['assemble', 'Сборка', 0, 1, 1, 1]
    ],
    organism: [
      ['wind', 'Ветер', 0, 2, 0.01, 1, 'Размах колыхания организма'],
      ['tilt', 'Наклон листов, °', 0, 10, 0.1, 6],
      ['parallax', 'Параллакс', 0, 2, 0.01, 1, 'Выше лист — сильнее сдвиг за мышью'],
      ['tension', 'Натяжение', 0, 1, 0.01, 0.5, 'Мягкость стеблей и нитей'],
      ['spread', 'Раскрытие', 0.6, 1.4, 0.01, 1],
      ['springs', 'Пружины', 0.2, 2, 0.01, 1, 'Как соседи едут за перетащенным узлом']
    ],
    export: [
      ['format', 'Формат', ['screen', '16:9', '1:1', '4:5'], 'screen', ['Экран', '16:9', '1:1', '4:5']],
      ['scale', 'Масштаб', 1, 3, 1, 2]
    ]
  };

  function defaultsOf(groups) {
    var out = {};
    groups.forEach(function (gr) { gr.rows.forEach(function (d) {
      out[d[0]] = (Array.isArray(d[2]) || d[2] === 'color' || d[2] === 'text') ? d[3] : d[5];
    }); });
    return out;
  }

  var APP = {};
  var FORMATS = { '16:9': [1920, 1080], '1:1': [1080, 1080], '4:5': [1080, 1350] };

  function applyPreset(ctx, id) {
    var pr = R.light.PRESETS[id]; if (!pr) return;
    Object.keys(pr).forEach(function (k) { if (k in ctx.P) ctx.P[k] = pr[k]; });
    paintAll();
  }
  // кадр в офскрине того же сида и номера кадра (§7.10)
  function renderOffscreen(w, h, scale) {
    var ctx = KIT.scene.ctx;
    var save = { canvas: ctx.canvas, g: ctx.g, W: ctx.W, H: ctx.H, capture: ctx.capture };
    var c = document.createElement('canvas');
    c.width = Math.round(w * scale); c.height = Math.round(h * scale);
    var g = c.getContext('2d'); g.setTransform(scale, 0, 0, scale, 0, 0);
    if (w === ctx.W && h === ctx.H) { g.drawImage(ctx.canvas, 0, 0, w, h); return c.toDataURL('image/png'); }
    Object.assign(ctx, { canvas: c, g: g, W: w, H: h, capture: true });
    try { ctx.rand.reset(); ctx.randPal.reset(); ctx.randNoise.reset(); (APP.scene.capture || APP.scene.draw)(ctx); }
    finally { Object.assign(ctx, save); R._shade = null; }
    return c.toDataURL('image/png');
  }
  function download(url, name) {
    var a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  }
  function exportPng() {
    var ctx = KIT.scene.ctx, P = ctx.P, f = FORMATS[P.format];
    var w = f ? f[0] : ctx.W, h = f ? f[1] : ctx.H, sc = Math.max(1, Math.min(3, Math.round(P.scale) || 1));
    download(renderOffscreen(w, h, sc), 'relief_' + APP.scene.id + '-' + ctx.theme + '-' + Math.round(w * sc) + 'x' + Math.round(h * sc) + '_' + APP.variant + '.png');
  }
  function copyLink(e) {
    var ctx = KIT.scene.ctx, q = new URLSearchParams(location.search), b = e && e.currentTarget;
    Object.keys(ctx.P).forEach(function (k) { q.set('set.' + k, ctx.P[k]); });
    q.set('seed', ctx.seed); q.set('theme', ctx.theme); q.set('preset', ctx.P.light);
    var s = location.origin + location.pathname + '?' + q.toString();
    var done = function () { if (b) { var t = b.textContent; b.textContent = 'Copied'; setTimeout(function () { b.textContent = t; }, 1200); } };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(s).then(done, function () { prompt('Copy link', s); }); else prompt('Copy link', s);
  }

  // вход варианта: scene = {id, title, blurb, rows:{scene, data}, draw(ctx), structural?, hotkeys?, hint}
  function run(scene, opt) {
    opt = opt || {};
    APP.scene = scene; APP.variant = opt.variant || 'v1';
    var Q = new URLSearchParams(location.search);
    var groups = [
      { name: 'Сцена', rows: scene.rows.scene || [] },
      { name: 'Организм', rows: COMMON.organism },
      { name: 'Свет', rows: COMMON.light },
      { name: 'Материал', rows: COMMON.material },
      { name: 'Движение', rows: COMMON.motion },
      { name: 'Данные', rows: scene.rows.data || [] },
      { name: 'Выгрузка', rows: COMMON.export }
    ].filter(function (gr) { return gr.rows.length; });
    var values = defaultsOf(groups);
    Object.keys(opt.defaults || {}).forEach(function (k) { values[k] = opt.defaults[k]; });
    // свет по умолчанию: soft днём, lamp ночью; ?preset= главнее
    var pre = Q.get('preset');
    values.light = R.light.PRESETS[pre] ? pre : (Q.get('theme') === 'night' ? 'lamp' : 'soft');
    var pr = R.light.PRESETS[values.light];
    Object.keys(pr).forEach(function (k) { if (k in values) values[k] = pr[k]; });
    Q.forEach(function (v, k) { var key = k.indexOf('set.') === 0 ? k.slice(4) : k; if (key in values) values[key] = typeof values[key] === 'number' ? +v : v; });
    APP.panelExtra = {
      title: scene.title, sub: APP.variant + ' · ' + (opt.name || ''), hint: scene.hint,
      actions: [{ label: 'PNG', title: 'Export PNG (E)', run: exportPng }, { label: 'Copy link', title: 'Link with seed and preset', run: copyLink }]
    };
    KIT.scene.register({
      id: scene.id, title: scene.title, blurb: scene.blurb, params: groups.reduce(function (all, gr) { return all.concat(gr.rows); }, []),
      groups: groups.reduce(function (all, gr) { all[gr.name] = gr.rows; return all; }, {}),
      init: function (ctx) { ctx.data = window.RELIEF_DATA; if (scene.init) scene.init(ctx); },
      draw: function (ctx) { scene.draw(ctx); },
      structural: function (ctx, path) {
        R._shade = null;
        if (path === 'light') applyPreset(ctx, ctx.P.light);
        if (scene.structural) scene.structural(ctx, path);
      }
    });
    function go() {
      if (APP.started) return; APP.started = true;
      KIT.scene.start({ canvas: document.getElementById('scene'), panelMount: document.getElementById('panel'),
        values: values, groups: groups, data: window.RELIEF_DATA });
      var ctx = KIT.scene.ctx;
      if (window.ResizeObserver) {
        var last = '';
        new ResizeObserver(function (en) {
          var r = en[0].contentRect, k = Math.round(r.width) + 'x' + Math.round(r.height);
          if (k !== last) { var first = !last; last = k; if (!first) window.dispatchEvent(new Event('resize')); }
        }).observe(document.getElementById('stage'));
      }
      var paused = false;
      window.addEventListener('keydown', function (e) {
        if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        var k = e.key.toLowerCase();
        if (k === 'i') { var u = new URL(location.href); u.searchParams.set('theme', ctx.theme === 'night' ? 'day' : 'night'); location.href = u.toString(); }
        else if (k === 's') { ctx.mode = ctx.mode === 'studio' ? 'client' : 'studio'; DG.panel.setMode(ctx.mode); }
        else if (k === 'r') { window.postMessage({ type: 'es:replay' }, '*'); }
        else if (k === 'p') { paused = !paused; window.postMessage({ type: paused ? 'pause' : 'play' }, '*'); }
        else if (k === 'e') exportPng();
        else if (scene.hotkeys && scene.hotkeys[k]) scene.hotkeys[k](ctx);
      });
      if (scene.mount) scene.mount(ctx);
      document.documentElement.setAttribute('data-ready', '1');
    }
    var ready = Promise.all([
      document.fonts ? Promise.all([document.fonts.load('400 14px "Geist"'), document.fonts.load('500 14px "Geist"'),
        document.fonts.load('600 14px "Geist"'), document.fonts.load('400 14px "Geist Mono"'), document.fonts.load('500 14px "Geist Mono"')]).catch(function () {}) : null,
      R.material.loadNoise(), R.motion.measureFps(20)
    ]);
    ready.then(go, go);
    setTimeout(go, 1500);
    // стенды кинематики (канон §«Служебные входы»): точный кадр и перемотка
    window.__freeze = function (t) { R.motion.clock.override = t; window.postMessage({ type: 'pause' }, '*'); window.dispatchEvent(new Event('resize')); };
    window.__unfreeze = function () { R.motion.clock.override = null; window.postMessage({ type: 'play' }, '*'); };
  }

  window.RELIEF_APP = { run: run, exportPng: exportPng, renderOffscreen: renderOffscreen, paintAll: paintAll, COMMON: COMMON };
})();
