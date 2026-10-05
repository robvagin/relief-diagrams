/* tokens.scene.js · единственный вход бренда в сцену (README §8, L10).
   Хексы сцены живут ТОЛЬКО здесь и только в CSS-блоках :root (гейт 3-hardcode читает их как токены).
   Хром панели держит свои токены (house.tokens.css под .pv2), смешивать нельзя. */
(function () {
  'use strict';
  var R = window.RELIEF = window.RELIEF || {};

  R.tokensCSS = [
    ':root{--r-ground:#f0ece4;--r-plate:#f4f1ea;--r-ink:#191713;--r-ink2:#44423e;--r-ink3:#65635e;' +
      '--r-shadow:#464e58;--r-light:#fff9e8;--r-line-a:.22;--r-grain:1.6;' +
      '--r-acc-terracotta:#c16139;--r-acc-cobalt:#345fb2;--r-acc-olive:#70843c}',
    ':root.is-night{--r-ground:#13110e;--r-plate:#171512;--r-ink:#ebe7e0;--r-ink2:#c0bdb8;--r-ink3:#94928d;' +
      '--r-shadow:#000102;--r-light:#ffefd8;--r-line-a:.26;--r-grain:2.2;' +
      '--r-acc-terracotta:#d2764a;--r-acc-cobalt:#638bd5;--r-acc-olive:#889c54}'
  ].join('\n');

  (function inject() {
    if (document.getElementById('relief-tokens')) return;
    var st = document.createElement('style');
    st.id = 'relief-tokens';
    st.textContent = R.tokensCSS;
    (document.head || document.documentElement).appendChild(st);
  })();

  function rgb(s) {
    s = String(s || '').trim();
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(s);
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [128, 128, 128];
  }
  function lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function lum(c) { return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]); }
  function css(c, a) {
    return a == null ? 'rgb(' + c.map(Math.round).join(',') + ')'
      : 'rgba(' + c.map(Math.round).join(',') + ',' + (+a).toFixed(4) + ')';
  }
  function mix(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }

  var cache = {};
  /* Палитра кадра: читается из CSS-токенов один раз на тему и акцент */
  R.tokens = function (theme, accent) {
    var key = theme + '|' + accent;
    if (cache[key]) return cache[key];
    var root = document.documentElement;
    var was = root.classList.contains('is-night');
    root.classList.toggle('is-night', theme === 'night');
    var cs = getComputedStyle(root), v = function (n) { return cs.getPropertyValue(n).trim(); };
    var T = {
      theme: theme,
      ground: rgb(v('--r-ground')), plate: rgb(v('--r-plate')),
      ink: rgb(v('--r-ink')), ink2: rgb(v('--r-ink2')), ink3: rgb(v('--r-ink3')),
      shadowTint: rgb(v('--r-shadow')), lightTint: rgb(v('--r-light')),
      lineA: parseFloat(v('--r-line-a')) || 0.22,
      grainDefault: parseFloat(v('--r-grain')) || 1.6,
      accent: rgb(v('--r-acc-' + (accent || 'terracotta')))
    };
    root.classList.toggle('is-night', was);
    T.groundY = lum(T.ground);
    cache[key] = T;
    return T;
  };
  R.color = { rgb: rgb, lum: lum, css: css, mix: mix, lin: lin };
})();
