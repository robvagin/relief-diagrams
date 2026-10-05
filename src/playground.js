/* playground.js · одна страница: слева сцены и варианты, в центре живой кадр, справа панель v2.
   Список: lab/index.json (собирает шаг Pages из lab/<сцена>/<вариант>.html) + рельс (калибровка _lab, образец гейта).
   Кадр живёт в iframe того же источника с ?embed=1: своей панели у него нет, ручки строятся здесь
   из деклараций сцены (KIT.scene) и водят её через Scene.set. Панель видна всегда: не прячется,
   не сворачивается; на узком экране нижний лист открыт. Чужой источник (file://) или сцена без
   kit-контракта: кадр открывается со своей панелью, здесь остаются тема, сид, ссылка. */
(function () {
  'use strict';
  var SCENES = ['gate', 'desk', 'cascade', 'stack', 'horizon', 'agents', 'ledger', 'glyph'];
  var RAIL = [
    { group: 'rail', id: '_light', path: '_lab.html?view=_light', title: 'Light: z0–z3, plate over plate' },
    { group: 'rail', id: '_ruler', path: '_lab.html?view=_ruler', title: 'Ruler: one line width' },
    { group: 'rail', id: '_float', path: '_lab.html?view=_float', title: 'Float: five plate states' },
    { group: 'rail', id: '_grain', path: '_lab.html?view=_grain', title: 'Grain: blue-noise dither' },
    { group: 'rail', id: 'sample', path: 'sample/index.html', title: 'Gate sample, positive control' }
  ];
  /* общие группы ручек §6.10 для сцен, которые сами групп не объявили */
  var COMMON = {
    'Свет': ['light', 'az', 'elev', 'soft', 'dens', 'amb', 'contact', 'pool', 'lampH', 'canopy', 'temp'],
    'Материал': ['grain', 'uneven', 'rim', 'radius', 'zscale', 'accent', 'hand'],
    'Движение': ['float', 'period', 'sway', 'bob', 'settle', 'assemble'],
    'Выгрузка': ['format', 'scale']
  };
  var ORDER = ['Сцена', 'Свет', 'Материал', 'Движение', 'Ритм', 'Данные', 'Выгрузка'];

  var Q = new URLSearchParams(location.search);
  var st = {
    items: RAIL.slice(), cur: null, theme: Q.get('theme') === 'night' ? 'night' : 'day',
    seed: Q.get('seed') || 'relief-01', preset: Q.get('preset') || '', set: {}, paused: false, cw: null, live: false
  };
  Q.forEach(function (v, k) { if (k.indexOf('set.') === 0) st.set[k.slice(4)] = v; });

  var $ = function (id) { return document.getElementById(id); };
  var pg = $('pg'), view = $('view'), knobs = $('knobs'), note = $('note');

  function toast(t) { var e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(function () { e.classList.remove('on'); }, 1600); }

  /* ── список ─────────────────────────────────────────────────────────── */
  function renderList() {
    var box = $('items'); box.textContent = '';
    var groups = [['rail', 'Rail']].concat(SCENES.map(function (s) { return [s, s]; }));
    groups.forEach(function (gp) {
      var its = st.items.filter(function (i) { return i.group === gp[0]; });
      var h = document.createElement('div'); h.className = 'grp-h';
      h.innerHTML = '<span></span><span class="n"></span>';
      h.firstChild.textContent = gp[1]; h.lastChild.textContent = its.length ? String(its.length) : '';
      box.appendChild(h);
      if (!its.length) { var n = document.createElement('div'); n.className = 'none'; n.textContent = 'No variants yet'; box.appendChild(n); return; }
      its.forEach(function (it) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'it';
        b.innerHTML = '<span class="id"></span><span class="tt"></span>';
        b.firstChild.textContent = it.id; b.lastChild.textContent = it.title || it.path;
        b.title = it.path;
        b.setAttribute('aria-current', st.cur && st.cur.path === it.path ? 'true' : 'false');
        b.addEventListener('click', function () { st.set = {}; select(it); });
        box.appendChild(b);
      });
    });
  }

  function loadIndex() {
    return fetch('lab/index.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : { items: [] }; })
      .then(function (j) {
        (j.items || []).forEach(function (it) {
          st.items.push({ group: it.scene, id: it.id, path: it.path, title: it.title });
        });
      }).catch(function () { });
  }

  /* ── кадр ───────────────────────────────────────────────────────────── */
  function frameURL(it, embed) {
    var u = it.path, q = [];
    if (embed) { q.push('embed=1'); q.push('mode=studio'); }
    q.push('theme=' + st.theme); q.push('seed=' + encodeURIComponent(st.seed));
    if (st.preset) q.push('preset=' + encodeURIComponent(st.preset));
    return u + (u.indexOf('?') >= 0 ? '&' : '?') + q.join('&');
  }

  var token = 0;
  function select(it, embed) {
    st.cur = it; renderList(); setTheme();
    var my = ++token;
    view.removeAttribute('data-ready');
    var old = view.querySelector('iframe'); if (old) old.remove();
    var f = document.createElement('iframe');
    f.title = 'Live frame: ' + it.id;
    f.src = frameURL(it, embed !== false);
    view.appendChild(f);
    st.cw = null; st.live = false;
    knobs.textContent = ''; note.hidden = true;
    $('meta').textContent = it.path;
    syncURL();
    var t0 = 0;
    (function poll() {
      if (my !== token) return;
      var cw = null, ok = false;
      try { cw = f.contentWindow; ok = !!(cw && cw.KIT && cw.KIT.scene && cw.KIT.scene.ctx && cw.Scene); } catch (e) { cw = null; }
      if (ok) return attach(f, cw);
      t0 += 100;
      if (cw === null && t0 > 300 && embed !== false) return fallback(it, 'Cross-origin frame (open via http). The frame shows its own panel.');
      if (t0 > 6000) return embed !== false ? fallback(it, 'No kit contract found in this frame: it shows its own panel.') : null;
      setTimeout(poll, 100);
    })();
  }

  function fallback(it, why) {
    select(it, false);
    note.textContent = why; note.hidden = false;
    view.setAttribute('data-ready', '1');
  }

  function attach(f, cw) {
    st.cw = cw; st.live = true;
    view.setAttribute('data-ready', '1');
    var def = cw.KIT.scene.list()[0], ctx = cw.KIT.scene.ctx;
    Object.keys(st.set).forEach(function (k) {
      if (k in ctx.P) cw.Scene.set(k, typeof ctx.P[k] === 'number' ? +st.set[k] : st.set[k]);
    });
    buildKnobs(def, ctx, cw);
    meta2();
  }

  function groupsOf(def, cw) {
    var rows = def.params || [], seen = {}, out = [];
    // рельс RELIEF объявляет группы сам (shell.js); остальным раскладываем по ключам §6.10
    var own = def.groups && !Array.isArray(def.groups) ? def.groups : null;
    var key = function (d) { return d[0]; };
    ORDER.forEach(function (name) {
      var list = [];
      if (own && own[name]) own[name].forEach(function (d) { if (!seen[key(d)]) { seen[key(d)] = 1; list.push(d); } });
      (COMMON[name] || []).forEach(function (k) {
        rows.forEach(function (d) { if (key(d) === k && !seen[k]) { seen[k] = 1; list.push(d); } });
      });
      if (list.length) out.push({ name: name, rows: list });
    });
    var rest = rows.filter(function (d) { return !seen[key(d)]; });
    if (rest.length) out.unshift({ name: 'Сцена', rows: rest });
    // если «Сцена» оказалась дважды — склеить
    var sc = out.filter(function (g) { return g.name === 'Сцена'; });
    if (sc.length > 1) { sc[0].rows = sc[0].rows.concat(sc[1].rows); out.splice(out.indexOf(sc[1]), 1); }
    return out;
  }

  function buildKnobs(def, ctx, cw) {
    knobs.textContent = '';
    DG.panel.build({
      mount: knobs, theme: st.theme, mode: 'studio', values: ctx.P, groups: groupsOf(def, cw),
      onChange: function (k, v) {
        st.set[k] = v;
        cw.Scene.set(k, v);
        if (k === 'light') DG.panel.paint();          // пресет света переписал соседние ручки
        syncURL(); meta2();
      }
    });
  }

  function meta2() {
    var ctx = st.cw && st.cw.KIT && st.cw.KIT.scene.ctx;
    $('meta2').textContent = ctx ? ('seed ' + ctx.seed + ' · ' + ctx.theme + ' · ' + ctx.W + '×' + ctx.H) : '';
  }

  /* ── верх панели: тема, сид, действия ──────────────────────────────── */
  var top = { theme: st.theme, seed: st.seed };
  function buildTop() {
    var host = $('top'); host.textContent = '';
    var fs = document.createElement('fieldset'), lg = document.createElement('legend');
    fs.className = 'grp'; lg.textContent = 'Кадр'; fs.appendChild(lg); host.appendChild(fs);
    Podacha.Panel.build(fs, [
      ['theme', 'Тема', ['day', 'night'], 'day', ['День', 'Ночь']],
      ['seed', 'Сид', 'text', 'relief-01']
    ], top, function (k, v) {
      if (k === 'theme') { st.theme = v; select(st.cur); }
      if (k === 'seed') { clearTimeout(buildTop.h); buildTop.h = setTimeout(function () { st.seed = v || 'relief-01'; select(st.cur); }, 450); }
    });
    var acts = $('acts'); acts.textContent = '';
    [['Copy link', copyLink], ['PNG', png], ['Replay', replay], ['Pause', pause]].forEach(function (a) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = a[0];
      if (a[0] === 'Pause') { b.id = 'pauseb'; b.setAttribute('aria-pressed', 'false'); }
      b.addEventListener('click', a[1]); acts.appendChild(b);
    });
  }

  function setTheme() { pg.setAttribute('data-theme', st.theme === 'night' ? 'dark' : 'light'); document.body.style.background = ''; }

  function shareURL() {
    var u = new URL(location.href), q = new URLSearchParams();
    if (st.cur) q.set('v', st.cur.path);
    q.set('theme', st.theme); q.set('seed', st.seed);
    if (st.preset) q.set('preset', st.preset);
    Object.keys(st.set).forEach(function (k) { q.set('set.' + k, st.set[k]); });
    u.search = q.toString();
    return u.toString();
  }
  function syncURL() { try { history.replaceState(null, '', shareURL()); } catch (e) { } }
  function copyLink() {
    var u = shareURL();
    var done = function () { toast('Link copied'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(u).then(done, function () { prompt('Copy link', u); });
    else prompt('Copy link', u);
  }
  function png() {
    if (!st.cw) return toast('PNG needs a same-origin frame');
    var ctx = st.cw.KIT.scene.ctx, R = st.cw.RELIEF, url;
    var fmt = ctx.P.format, sc = ctx.P.scale;
    url = (R && R.export && fmt && fmt !== 'screen') ? R.export.png(fmt, sc) : st.cw.Scene.export('png');
    if (!url) return toast('Export failed');
    var sz = R && R.export && R.export.FORMATS[fmt], w = sz ? sz[0] * sc : ctx.canvas.width, h = sz ? sz[1] * sc : ctx.canvas.height;
    var id = (st.cur.group === 'rail' ? 'lab' : st.cur.group) + (st.cur.group === 'rail' ? '' : '-' + st.cur.id);
    var d = new Date().toISOString().slice(0, 10);
    var a = document.createElement('a'); a.href = url; a.download = d + '_relief_' + id + '-' + st.theme + '-' + w + 'x' + h + '_v01.png';
    document.body.appendChild(a); a.click(); a.remove();
    toast('PNG saved');
  }
  function post(type) { try { view.querySelector('iframe').contentWindow.postMessage({ type: type }, '*'); } catch (e) { } }
  function replay() { post('es:replay'); }
  function pause() {
    st.paused = !st.paused; post(st.paused ? 'pause' : 'play');
    var b = $('pauseb'); if (b) { b.setAttribute('aria-pressed', st.paused ? 'true' : 'false'); b.textContent = st.paused ? 'Play' : 'Pause'; }
  }

  window.addEventListener('keydown', function (e) {
    if (e.target && /input|select|textarea/i.test(e.target.tagName)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key.toLowerCase();
    if (k === 'p') pause();
    else if (k === 'r') replay();
    else if (k === 'e') png();
    else if (k === 'i') { top.theme = st.theme = st.theme === 'night' ? 'day' : 'night'; buildTop(); select(st.cur); }
    else if (k === 'j' || k === 'k') {
      var i = st.items.indexOf(st.cur), n = st.items.length;
      st.set = {}; select(st.items[(i + (k === 'j' ? 1 : -1) + n) % n]);
    }
  });
  window.addEventListener('message', function (e) { if (e.data && e.data.type === 'frame') meta2(); });

  buildTop(); setTheme();
  loadIndex().then(function () {
    var want = Q.get('v'), it = st.items.filter(function (i) { return i.path === want; })[0];
    if (!it) it = st.items.filter(function (i) { return i.group !== 'rail'; })[0] || st.items[0];
    select(it);
  });
})();
