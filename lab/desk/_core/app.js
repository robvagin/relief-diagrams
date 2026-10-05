// app.js — адаптер панели v2 к контракту kit-scene (README §7.11) и оболочка варианта:
// DG.panel поверх Podacha.Panel без правки обоих файлов; панель видна всегда (приказ 2026-10-05 (2)),
// хоткеи §6.10 (кроме H: панель не прячется), действия PNG и Ссылка в подвале панели.
(function () {
  'use strict';
  const R = window.RELIEF;

  // ── DG.panel: build / setValue / getValues / setTheme / setMode / css ──
  const PANEL = { root: null, built: [], state: null, opts: null };
  function v2theme(t) { return t === 'night' || t === 'dark' ? 'dark' : 'light'; }
  function buildPanel(opts) {
    PANEL.opts = opts; PANEL.state = opts.values; PANEL.built = [];
    const mount = opts.mount;
    mount.textContent = '';
    const root = document.createElement('div');
    root.className = 'pv2 pv2-root';
    root.setAttribute('data-theme', v2theme(opts.theme));
    const head = document.createElement('div');
    head.className = 'pv2-head';
    head.innerHTML = '<b></b><span></span>';
    head.querySelector('b').textContent = opts.title || '';
    head.querySelector('span').textContent = opts.sub || '';
    root.appendChild(head);
    (opts.groups || []).forEach(gr => {
      const rows = gr.rows.filter(d => {
        const tail = d[d.length - 1];
        return !(opts.mode === 'client' && tail && typeof tail === 'object' && !Array.isArray(tail) && tail.studio);
      });
      if (!rows.length) return;
      const fs = document.createElement('fieldset');
      const lg = document.createElement('legend'); lg.textContent = gr.name; fs.appendChild(lg);
      PANEL.built.push(window.Podacha.Panel.build(fs, rows, PANEL.state, function (k, v) { opts.onChange(k, v); }));
      root.appendChild(fs);
    });
    if (opts.actions) {
      const ft = document.createElement('div'); ft.className = 'pv2-foot';
      opts.actions.forEach(a => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = a.label;
        b.title = a.title || a.label; b.addEventListener('click', a.run); ft.appendChild(b);
      });
      root.appendChild(ft);
    }
    mount.appendChild(root);
    PANEL.root = root;
  }
  function paintAll() { PANEL.built.forEach(b => b.paint()); }
  window.DG = window.DG || {};
  window.DG.panel = {
    build: function (opts) { buildPanel(Object.assign({}, APP.panelExtra || {}, opts)); },
    setValue: function (path, v) { if (PANEL.state) { PANEL.state[path] = v; paintAll(); } },
    getValues: function () { return Object.assign({}, PANEL.state || {}); },
    setTheme: function (t) { if (PANEL.root) PANEL.root.setAttribute('data-theme', v2theme(t)); },
    setMode: function (m) { if (PANEL.opts) buildPanel(Object.assign({}, PANEL.opts, { mode: m })); },
    css: ''
  };

  // ── значения по умолчанию из деклараций v2 ──────────────────────────────
  function defaultsOf(groups) {
    const out = {};
    groups.forEach(gr => gr.rows.forEach(d => {
      out[d[0]] = (Array.isArray(d[2]) || d[2] === 'color' || d[2] === 'text') ? d[3] : d[5];
    }));
    return out;
  }

  // ── оболочка ────────────────────────────────────────────────────────────
  const APP = {};
  const FORMATS = { '16:9': [1920, 1080], '1:1': [1080, 1080], '4:5': [1080, 1350] };

  function applyPreset(ctx, id, quiet) {
    const pr = R.PRESETS[id]; if (!pr) return;
    ['az', 'elev', 'soft', 'dens', 'amb', 'pool', 'canopy'].forEach(k => { if (pr[k] != null) ctx.P[k] = pr[k]; });
    if (pr.lampH) ctx.P.lampH = pr.lampH;
    if (!quiet) paintAll();
  }

  // кадр в офскрине того же сида и номера кадра (§7.10)
  function renderOffscreen(w, h, scale) {
    const ctx = KIT.scene.ctx;
    const save = { canvas: ctx.canvas, g: ctx.g, W: ctx.W, H: ctx.H, capture: ctx.capture };
    const c = document.createElement('canvas');
    c.width = Math.round(w * scale); c.height = Math.round(h * scale);
    const g = c.getContext('2d'); g.setTransform(scale, 0, 0, scale, 0, 0);
    Object.assign(ctx, { canvas: c, g: g, W: w, H: h, capture: true });
    try {
      ctx.rand.reset(); ctx.randPal.reset(); ctx.randNoise.reset();
      APP.scene.draw(ctx);
    } finally { Object.assign(ctx, save); }
    return c.toDataURL('image/png');
  }
  function download(url, name) {
    const a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  }
  function exportPng() {
    const ctx = KIT.scene.ctx, P = ctx.P;
    const f = FORMATS[P.format];
    const w = f ? f[0] : ctx.W, h = f ? f[1] : ctx.H, sc = f ? 1 : Math.max(1, Math.round(P.scale));
    const url = renderOffscreen(w, h, sc);
    const d = new Date(0).toISOString ? '' : '';
    download(url, 'relief_' + APP.scene.id + '-' + ctx.theme + '-' + Math.round(w * sc) + 'x' + Math.round(h * sc) + '_' + APP.variant + d + '.png');
  }
  function linkOf() {
    const ctx = KIT.scene.ctx, q = new URLSearchParams(location.search);
    q.set('seed', ctx.seed); q.set('theme', ctx.theme); q.set('preset', ctx.P.light);
    return location.origin + location.pathname + '?' + q.toString();
  }
  function copyLink(e) {
    const s = linkOf(), b = e && e.currentTarget;
    const done = () => { if (b) { const t = b.textContent; b.textContent = 'Copied'; setTimeout(() => { b.textContent = t; }, 1200); } };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(s).then(done, done);
    else done();
  }

  function setTheme(ctx, th) {
    ctx.theme = th;
    document.documentElement.classList.toggle('is-night', th === 'night');
    ctx.tok = R.readTokens();
    DG.panel.setTheme(th);
  }

  // вход варианта: scene = {id, title, blurb, groups, draw(ctx), init?, structural?, hotkeys?}
  function run(scene, opt) {
    opt = opt || {};
    APP.scene = scene; APP.variant = opt.variant || 'v1';
    const Q = new URLSearchParams(location.search);
    const groups = [
      { name: 'Сцена', rows: scene.rows.scene || [] },
      { name: 'Свет', rows: R.COMMON.light },
      { name: 'Материал', rows: R.COMMON.material },
      { name: 'Движение', rows: R.COMMON.motion },
      { name: 'Ритм', rows: scene.rows.rhythm || [] },
      { name: 'Данные', rows: scene.rows.data || [] },
      { name: 'Выгрузка', rows: R.COMMON.export }
    ].filter(gr => gr.rows.length);
    const values = defaultsOf(groups);
    // свет по умолчанию: soft днём, lamp ночью; ?preset= главнее
    const pre = Q.get('preset');
    values.light = R.PRESETS[pre] ? pre : (Q.get('theme') === 'night' ? 'lamp' : 'soft');
    const pr = R.PRESETS[values.light];
    Object.keys(pr).forEach(k => { if (k in values) values[k] = pr[k]; });
    APP.panelExtra = {
      title: scene.title, sub: opt.variant + ' · ' + (opt.name || ''),
      actions: [
        { label: 'PNG', title: 'Export PNG (E)', run: exportPng },
        { label: 'Copy link', title: 'Link with seed and preset', run: copyLink }
      ]
    };
    const def = {
      id: scene.id, title: scene.title, blurb: scene.blurb, params: [],
      init: function (ctx) {
        ctx.tok = R.readTokens();
        ctx.data = window.RELIEF_DATA;
        if (scene.init) scene.init(ctx);
      },
      draw: function (ctx) { scene.draw(ctx); },
      structural: function (ctx, path) {
        if (path === 'light') applyPreset(ctx, ctx.P.light);
        if (path === 'accent') ctx.tok = R.readTokens();
        if (scene.structural) scene.structural(ctx, path);
      }
    };
    KIT.scene.register(def);
    R.measureFps();
    KIT.scene.start({
      canvas: document.getElementById('scene'),
      panelMount: document.getElementById('panel'),
      values: values, groups: groups, data: window.RELIEF_DATA
    });
    const ctx = KIT.scene.ctx;
    // перерисовать, когда доехали шрифты и шум (покой рисует один кадр)
    const redraw = () => window.dispatchEvent(new Event('resize'));
    R.loadGrain(window.RELIEF_NOISE, redraw);
    if (document.fonts && document.fonts.load) {
      Promise.all([document.fonts.load('500 16px Geist'), document.fonts.load('500 16px "Geist Mono"')]).then(redraw, redraw);
    }
    if (window.ResizeObserver) {
      let first = true;
      new ResizeObserver(() => { if (first) { first = false; return; } redraw(); }).observe(document.getElementById('stage'));
    }
    // хоткеи §6.10 (H не вешается: панель видна всегда)
    let paused = false;
    window.addEventListener('keydown', function (e) {
      if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'i') setTheme(ctx, ctx.theme === 'night' ? 'day' : 'night'), redraw();
      else if (k === 's') { ctx.mode = ctx.mode === 'studio' ? 'client' : 'studio'; DG.panel.setMode(ctx.mode); }
      else if (k === 'r') { window.__FRAMES = 0; }
      else if (k === 'p') { paused = !paused; window.postMessage({ type: paused ? 'pause' : 'play' }, '*'); }
      else if (k === 'e') exportPng();
      else if (scene.hotkeys && scene.hotkeys[k]) { scene.hotkeys[k](ctx); redraw(); }
    });
    // ховер: сцена получает указатель в координатах канваса
    const cv = document.getElementById('scene');
    cv.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); ctx.pointer = { x: e.clientX - r.left, y: e.clientY - r.top, f: window.__FRAMES }; if (ctx.reduced) redraw(); });
    cv.addEventListener('pointerleave', () => { ctx.pointer = null; if (ctx.reduced) redraw(); });
  }

  window.RELIEF_APP = { run, exportPng, renderOffscreen, linkOf, defaultsOf, paintAll };
})();
