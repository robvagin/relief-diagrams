/* shell.js · оболочка сцены: группы ручек, пресеты света, ожидание шрифтов и шума, старт kit-scene,
   подвал действий (PNG · SVG · Ссылка), хоткеи. Панель видна всегда (приказ 2026-10-05 (2)):
   H её не прячет; в embed её нет вовсе (контракт фрагмента). */
(function () {
  'use strict';
  var R = window.RELIEF;
  var Q = new URLSearchParams(location.search);

  function groupsFor(def) {
    var K = R.knobs, own = def.groups || {}, out = [];
    K.order.forEach(function (name) {
      var rows = (own[name] || []).concat(K.common[name] || []);
      if (rows.length) out.push({ name: name, rows: rows });
    });
    return out;
  }

  function presetValues(id) { return (R.knobs.presets || {})[id] || null; }

  function button(label, title, fn) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = label;
    if (title) b.title = title; b.addEventListener('click', fn); return b;
  }

  function link() {
    var ctx = KIT.scene.ctx, u = new URL(location.href), q = u.searchParams;
    q.set('seed', ctx.seed); q.set('theme', ctx.theme); q.set('preset', ctx.P.light);
    return u.toString();
  }

  R.boot = function (def) {
    def.params = (def.params || []);
    var groups = groupsFor(def), rows = [];
    groups.forEach(function (g) { rows = rows.concat(g.rows); });
    // паспорт и kit читают params: даём полный список (сцена + общие группы)
    def.params = rows;
    var values = DG.panel.defaults(rows);
    var theme = Q.get('theme') === 'night' ? 'night' : 'day';
    var pre = presetValues(Q.get('preset') || (theme === 'night' ? 'lamp' : null));
    if (pre) Object.keys(pre).forEach(function (k) { values[k] = pre[k]; });
    if (theme === 'night' && values.grain === 1.6) values.grain = R.knobs.nightGrain;
    var RESERVED = { embed: 1, theme: 1, p: 1, seed: 1, preset: 1, mode: 1, reduced: 1, noui: 1, panel: 1 };
    Q.forEach(function (v, k) {                                    // ?view=_float, ?set.az=120 → ручка
      var key = k.indexOf('set.') === 0 ? k.slice(4) : (RESERVED[k] ? null : k);
      if (key && key in values) values[key] = typeof values[key] === 'number' ? +v : v;
    });
    // класс фрагмента до первого fit(): иначе канвас меряется с местом под панель и кадр сплющен
    var EMB = Q.get('embed') === '1' || Q.has('noui') || Q.get('panel') === 'off';
    document.documentElement.classList.toggle('is-embed', EMB);
    document.documentElement.classList.toggle('is-night', theme === 'night');

    var userStructural = def.structural;
    def.structural = function (ctx, path) {
      if (path === 'light') {
        var p = presetValues(ctx.P.light);
        if (p) Object.keys(p).forEach(function (k) { if (k !== 'light') { ctx.P[k] = p[k]; DG.panel.setValue(k, p[k]); } });
      }
      if (userStructural) userStructural(ctx, path);
    };
    KIT.scene.register(def);

    var footer = document.createElement('div'); footer.className = 'cf acts';
    footer.appendChild(button('PNG', 'E', function () { exportPNG(); }));
    footer.appendChild(button('SVG', null, function () {
      var s = Scene.export('svg'); if (!s) return;
      R.export.download('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s),
        R.export.filename(def.id, KIT.scene.ctx.theme, KIT.scene.ctx.W, KIT.scene.ctx.H, 'svg'));
    }));
    footer.appendChild(button('Link', null, function () {
      var u = link(); try { navigator.clipboard.writeText(u); } catch (e) { }
      history.replaceState(null, '', u);
    }));

    function exportPNG() {
      var ctx = KIT.scene.ctx, url = R.export.png(ctx.P.format, ctx.P.scale);
      var f = R.export.FORMATS[ctx.P.format], w = f ? f[0] * ctx.P.scale : ctx.canvas.width, h = f ? f[1] * ctx.P.scale : ctx.canvas.height;
      R.export.download(url, R.export.filename(def.id, ctx.theme, w, h, 'png'));
    }

    var ready = Promise.all([
      document.fonts ? Promise.all([document.fonts.load('400 14px "Geist"'), document.fonts.load('500 14px "Geist"'),
        document.fonts.load('400 14px "Geist Mono"')]).catch(function () { }) : null,
      R.material.loadNoise(),
      R.motion.measureFps(20)
    ]);
    var started = false;
    function go() {
      if (started) return; started = true;
      KIT.scene.start({
        canvas: document.getElementById('c'), panelMount: document.getElementById('panel'),
        values: values, groups: groups, data: R.data ? R.data() : null
      });
      var root = document.querySelector('#panel .pv2');
      if (root) root.appendChild(footer);
      // размер сцены меряется по коробке: любая смена коробки = fit() рельса (kit слушает resize)
      if (window.ResizeObserver) {
        var last = '';
        new ResizeObserver(function (en) {
          var r = en[0].contentRect, k = Math.round(r.width) + 'x' + Math.round(r.height);
          if (k !== last) { var first = !last; last = k; if (!first) window.dispatchEvent(new Event('resize')); }
        }).observe(document.getElementById('stage'));
      }
      document.documentElement.setAttribute('data-ready', '1');
    }
    ready.then(go, go);
    setTimeout(go, 1500);

    var paused = false;
    window.addEventListener('keydown', function (e) {
      if (e.target && /input|select|textarea/i.test(e.target.tagName)) return;
      var k = e.key.toLowerCase();
      if (k === 'p') { paused = !paused; window.postMessage({ type: paused ? 'pause' : 'play' }, '*'); }
      else if (k === 'r') window.postMessage({ type: 'es:replay' }, '*');
      else if (k === 'e') exportPNG();
      else if (k === 'i') { var u = new URL(location.href); u.searchParams.set('theme', KIT.scene.ctx.theme === 'night' ? 'day' : 'night'); location.href = u.toString(); }
      else if (k === 's' && window.DG) DG.panel.setMode(KIT.scene.ctx.mode = KIT.scene.ctx.mode === 'client' ? 'studio' : 'client');
    });

    /* стенды кинематики: точный кадр и перемотка (канон §«Служебные входы») */
    window.__freeze = function (t) { R.motion.clock.override = t; window.postMessage({ type: 'pause' }, '*'); Scene.set('view', Scene.get('view')); };
    window.__jump = function (t) { R.motion.clock.override = null; window.postMessage({ type: 'es:replay' }, '*'); };
    window.__unfreeze = function () { R.motion.clock.override = null; window.postMessage({ type: 'play' }, '*'); };
  };
})();
