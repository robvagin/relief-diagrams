/* panel-adapter.js · DG.panel поверх Podacha.Panel (README §7.11).
   kit-scene.js зовёт DG.panel.build/setValue/setTheme/setMode/css и не правится; panel.js вклеен
   verbatim между маркерами. Здесь только перевод грамматики и группы fieldset + legend.
   Перевод kit → v2 (числа совпадают): выбор [k,l,[opts]] → [k,l,[opts],деф,подписи];
   хвост {studio:true} прячет ряд в клиентском режиме; 'tabs' → сегмент; 'chips' → текст «a, b». */
(function () {
  'use strict';
  window.DG = window.DG || {};

  function tail(d) { var t = d[d.length - 1]; return (t && typeof t === 'object' && !Array.isArray(t)) ? t : null; }

  /* одна декларация kit или v2 → [v2-декларация, флаги] */
  function toV2(d, values) {
    var t = tail(d) || {}, core = tail(d) ? d.slice(0, -1) : d.slice();
    if (Array.isArray(core[2])) {
      if (core[3] === 'chips') {
        var cur = values[core[0]];
        if (Array.isArray(cur)) values[core[0]] = cur.join(', ');
        return [[core[0], core[1], 'text', (t.default || []).join(', ')], t, 'chips'];
      }
      var def = (typeof core[3] === 'string' && core[3] !== 'tabs') ? core[3] : (t.default != null ? t.default : core[2][0]);
      var labels = Array.isArray(core[4]) ? core[4] : null;
      var hint = typeof core[5] === 'string' ? core[5] : (typeof core[4] === 'string' ? core[4] : undefined);
      var out = [core[0], core[1], core[2], def, labels];
      if (hint) out.push(hint);
      return [out, t];
    }
    if (core[2] === 'color' || core[2] === 'text') return [core, t];
    var num = [core[0], core[1], +core[2], +core[3], +core[4], core[5] != null && typeof core[5] === 'number' ? core[5] : (t.default != null ? t.default : core[2])];
    if (typeof core[6] === 'string') num.push(core[6]);
    if (core[7] != null) { while (num.length < 7) num.push(undefined); num.push(core[7]); }
    return [num, t];
  }

  /* значения по умолчанию из деклараций (kit-scene берёт дефолт выбора как первый вариант, это неверно для v2) */
  function defaults(rows) {
    var out = {};
    (rows || []).forEach(function (d) {
      var v = toV2(d, {})[0];
      out[v[0]] = (Array.isArray(v[2]) || v[2] === 'color' || v[2] === 'text') ? v[3] : v[5];
    });
    return out;
  }

  var S = { root: null, opts: null, values: null, built: [], chips: {} };

  function build(opts) {
    S.opts = opts; S.values = opts.values || {};
    var mount = opts.mount;
    if (!S.root) {
      S.root = document.createElement('div');
      S.root.className = 'pv2 pv2-panel';
      mount.appendChild(S.root);
    }
    S.root.setAttribute('data-theme', opts.theme === 'night' || opts.theme === 'dark' ? 'dark' : 'light');
    S.root.textContent = '';
    S.built = []; S.chips = {};
    (opts.groups || []).forEach(function (grp) {
      var decls = [];
      (grp.rows || []).forEach(function (d) {
        var tv = toV2(d, S.values), flags = tv[1];
        if (flags.studio && opts.mode === 'client') return;
        if (tv[2] === 'chips') S.chips[tv[0][0]] = 1;
        decls.push(tv[0]);
      });
      if (!decls.length) return;
      var fs = document.createElement('fieldset'), lg = document.createElement('legend');
      fs.className = 'grp'; lg.textContent = grp.name; fs.appendChild(lg);
      S.root.appendChild(fs);
      var api = Podacha.Panel.build(fs, decls, S.values, function (k, v) {
        if (S.chips[k]) v = String(v).split(',').map(function (x) { return x.trim(); }).filter(Boolean);
        if (opts.onChange) opts.onChange(k, v);
      });
      S.built.push(api);
    });
    if (opts.footer) S.root.appendChild(opts.footer);
    return S.root;
  }

  function paint() { S.built.forEach(function (b) { b.paint(); }); }

  DG.panel = {
    build: build,
    /* пишет состояние и перерисовывает ряды; onChange НЕ зовёт никогда (канон) */
    setValue: function (path, v) { if (!S.values) return; S.values[path] = S.chips[path] && Array.isArray(v) ? v.join(', ') : v; paint(); },
    getValues: function () { return S.values; },
    setTheme: function (th) { if (S.root) S.root.setAttribute('data-theme', th === 'night' || th === 'dark' ? 'dark' : 'light'); },
    setMode: function (m) { if (S.opts) { S.opts.mode = m; build(S.opts); } },
    paint: paint,
    css: '',                 // стили панели вклеены сборкой (<style id="pv2-css">), второй копии не нужно
    toV2: toV2, defaults: defaults
  };
})();
