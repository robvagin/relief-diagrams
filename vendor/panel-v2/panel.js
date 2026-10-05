/* ПАНЕЛЬ v2 · перенос из mascot (mascot, галерея маскота client, stand.ui.js 02.10) почти дословно
   одна грамматика ряда «подпись · контрол»; число = скраб-поле: число внутри дорожки, drag = скраб, клик = ввод,
   ввод за диапазон расширяет диапазон (extendParamRange), стрелки ±step, Shift ×10
   декларация ряда: [ключ, подпись, min, max, step, деф, подсказка?] · выбор: [ключ, подпись, [варианты], деф, [подписи]?] · тумблер: [ключ, подпись, 0, 1, 1, деф] */
(function (root) {
  'use strict';
  var UID = 0;
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function decimals(step) { return step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3; }
  function fmt(v, step) { return (+v).toFixed(decimals(step)); }
  function extendParamRange(p, v) { if (isNaN(v)) return; if (v > p.max) p.max = v; if (v < p.min) p.min = v; }
  function mkLabel(text, hint) {
    var lab = el('span', 'lab'); lab.id = 'pl' + (++UID);
    lab.appendChild(el('span', null, text));
    if (hint) {
      var i = el('button', 'info', 'i'); i.type = 'button'; i.title = hint; i.setAttribute('aria-label', hint); i.setAttribute('aria-expanded', 'false');
      i.addEventListener('click', function (e) {
        e.stopPropagation(); var row = lab.parentNode, h = row && row.nextSibling && row.nextSibling.classList && row.nextSibling.classList.contains('hint') ? row.nextSibling : null;
        if (h) { h.remove(); i.setAttribute('aria-expanded', 'false'); } else if (row) { row.parentNode.insertBefore(el('p', 'hint', hint), row.nextSibling); i.setAttribute('aria-expanded', 'true'); }
      });
      lab.appendChild(i);
    }
    return lab;
  }
  function mkScrub(text, p, get, set, hint) {
    var row = el('div', 'row'), lab = mkLabel(text, hint), sc = el('div', 'scrub'), fill = el('i', 'fill'), num = el('input', 'sval');
    num.type = 'text'; num.inputMode = 'decimal'; num.tabIndex = -1; num.readOnly = true; num.setAttribute('aria-label', text); num.autocomplete = 'off';
    sc.tabIndex = 0; sc.setAttribute('role', 'slider'); sc.setAttribute('aria-labelledby', lab.id);
    sc.appendChild(fill); sc.appendChild(num); row.appendChild(lab); row.appendChild(sc);
    function paint() {
      var v = +get(), k = (v - p.min) / ((p.max - p.min) || 1);
      fill.style.transform = 'scaleX(' + clamp(k, 0, 1) + ')';
      if (document.activeElement !== num) num.value = fmt(v, p.step);
      sc.setAttribute('aria-valuemin', p.min); sc.setAttribute('aria-valuemax', p.max);
      sc.setAttribute('aria-valuenow', v); sc.setAttribute('aria-valuetext', fmt(v, p.step));
    }
    function commit(v) {
      v = parseFloat(String(v).replace(',', '.'));
      if (!isFinite(v)) { paint(); return; }
      v = p.step >= 1 ? Math.round(v) : +v.toFixed(6);
      if (p.lo != null && v < p.lo) v = p.lo;
      extendParamRange(p, v); set(v); paint();
    }
    var drag = null;
    sc.addEventListener('pointerdown', function (e) {
      if (sc.classList.contains('editing') || e.button > 0) return;
      var touch = e.pointerType === 'touch';
      if (!touch) { e.preventDefault(); sc.focus(); try { sc.setPointerCapture(e.pointerId); } catch (er) { } }
      drag = { x: e.clientX, y: e.clientY, v: +get(), moved: false, touch: touch, t: e.timeStamp, id: e.pointerId, w: sc.getBoundingClientRect().width || 1 };
    });
    sc.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved) {
        if (drag.touch) {
          if (Math.abs(dy) > 8 && Math.abs(dy) >= Math.abs(dx)) { drag = null; return; }   /* вертикаль: это прокрутка страницы */
          if (Math.abs(dx) < 8) return;
          try { sc.setPointerCapture(drag.id); } catch (er) { }
        } else if (Math.abs(dx) < 3) return;
      }
      drag.moved = true; sc.classList.add('active');
      var v = drag.v + dx / drag.w * (p.max - p.min) * (e.shiftKey ? 0.1 : 1);
      v = clamp(v, Math.min(p.min, drag.v), Math.max(p.max, drag.v));
      v = Math.round(v / p.step) * p.step;
      set(+v.toFixed(6)); paint();
    });
    function end(e) { if (!drag) return; var d = drag; drag = null; sc.classList.remove('active'); if (!d.moved && (!d.touch || (e && e.timeStamp - d.t < 300))) edit(); }
    sc.addEventListener('pointerup', end);
    sc.addEventListener('pointercancel', function () { drag = null; sc.classList.remove('active'); });
    row.param = p;
    function edit() { sc.classList.add('editing'); num.readOnly = false; num.style.pointerEvents = 'auto'; num.value = fmt(get(), p.step); num.focus(); num.select(); }
    num.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); commit(num.value); close(); sc.focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); num.value = fmt(get(), p.step); close(); sc.focus(); }
    });
    function close() { sc.classList.remove('editing'); num.readOnly = true; num.style.pointerEvents = 'none'; paint(); }
    num.addEventListener('blur', function () { if (sc.classList.contains('editing')) { commit(num.value); close(); } });
    sc.addEventListener('keydown', function (e) {
      if (sc.classList.contains('editing')) return;
      var st = p.step * (e.shiftKey ? 10 : 1);
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); commit(+get() + st); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); commit(+get() - st); }
      else if (e.key === 'Enter') { e.preventDefault(); edit(); }
    });
    row.paint = paint; paint();
    return row;
  }
  function mkSwitch(text, get, set, hint) {
    var row = el('div', 'row'), lab = mkLabel(text, hint), b = el('button', 'sw');
    b.type = 'button'; b.setAttribute('role', 'switch'); b.setAttribute('aria-labelledby', lab.id);
    function paint() { b.setAttribute('aria-checked', get() ? 'true' : 'false'); }
    b.addEventListener('click', function () { set(get() ? 0 : 1); paint(); });
    row.appendChild(lab); row.appendChild(b); row.paint = paint; paint();
    return row;
  }
  function mkSeg(text, opts, get, set, labels, hint) {
    var row = el('div', 'row'), lab = mkLabel(text, hint), g = el('div', 'seg'), bs = [];
    g.setAttribute('role', 'radiogroup'); g.setAttribute('aria-labelledby', lab.id);
    opts.forEach(function (o, i) {
      var b = el('button', null, labels ? labels[i] : o); b.type = 'button'; b.setAttribute('role', 'radio'); b.title = labels ? labels[i] : o;
      b.addEventListener('click', function () { set(o); paint(); });
      b.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (!d) return; e.preventDefault(); var n = (i + d + opts.length) % opts.length; set(opts[n]); paint(); bs[n].focus();
      });
      bs.push(b); g.appendChild(b);
    });
    function paint() { var v = get(); bs.forEach(function (b, i) { var on = String(opts[i]) === String(v); b.setAttribute('aria-checked', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; }); }
    row.appendChild(lab); row.appendChild(g); row.paint = paint; paint();
    return row;
  }
  function mkSelect(text, opts, get, set, labels, hint) {
    var row = el('div', 'row'), lab = mkLabel(text, hint), s = el('select', 'tin');
    s.setAttribute('aria-labelledby', lab.id);
    opts.forEach(function (o, i) { var op = el('option', null, labels ? labels[i] : o); op.value = o; s.appendChild(op); });
    s.addEventListener('change', function () { set(s.value); });
    function paint() { s.value = get(); }
    row.appendChild(lab); row.appendChild(s); row.paint = paint; paint();
    return row;
  }
  function mkColor(text, get, set) {
    var row = el('div', 'row'), lab = mkLabel(text), w = el('div', 'colrow'), c = el('input', 'colr'), h = el('input', 'hex');
    c.type = 'color'; c.setAttribute('aria-labelledby', lab.id);
    h.type = 'text'; h.spellcheck = false; h.setAttribute('aria-label', text + ', hex'); h.maxLength = 7;
    c.addEventListener('input', function () { set(c.value); h.value = c.value; });
    h.addEventListener('change', function () { var v = h.value.trim(); if (v[0] !== '#') v = '#' + v; if (/^#[0-9a-f]{6}$/i.test(v)) set(v.toLowerCase()); paint(); });
    function paint() { c.value = get(); h.value = get(); }
    w.appendChild(c); w.appendChild(h); row.appendChild(lab); row.appendChild(w); row.paint = paint; paint();
    return row;
  }
  function mkText(text, get, set) {
    var row = el('div', 'row'), lab = mkLabel(text), i = el('input', 'hex txt');
    i.type = 'text'; i.maxLength = 40; i.spellcheck = false; i.setAttribute('aria-labelledby', lab.id);
    i.addEventListener('input', function () { set(i.value); });
    function paint() { if (document.activeElement !== i) i.value = get(); }
    row.appendChild(lab); row.appendChild(i); row.paint = paint; paint();
    return row;
  }
  /* ряд из декларации; длинные варианты уходят в список, чтобы подписи не резались (правило mascot)
     число [ключ, подпись, min, max, step, деф, подсказка?, пол?] · выбор [ключ, подпись, [..], деф, [подписи]?, подсказка?]
     тумблер [ключ, подпись, 0, 1, 1, деф] · цвет [ключ, подпись, 'color', '#rrggbb'] · текст [ключ, подпись, 'text', 'строка'] */
  function rowFromDecl(d, get, set) {
    if (d[2] === 'color') return mkColor(d[1], get, set);
    if (d[2] === 'text') return mkText(d[1], get, set);
    if (Array.isArray(d[2])) {
      var labels = d[4] || null, txt = (labels || d[2]).join('');
      return (d[2].length > 3 || txt.length > 16) ? mkSelect(d[1], d[2], get, set, labels, d[5]) : mkSeg(d[1], d[2], get, set, labels, d[5]);
    }
    if (typeof d[2] !== 'number' || typeof d[3] !== 'number' || typeof d[4] !== 'number') throw new Error('панель: неизвестный вид ряда ' + JSON.stringify(d));
    if (d[2] === 0 && d[3] === 1 && d[4] === 1) return mkSwitch(d[1], get, set, d[6]);
    return mkScrub(d[1], { min: d[2], max: d[3], step: d[4], lo: d[7] }, get, set, d[6]);
  }
  /* Panel.build(контейнер, декларации, состояние, onChange) → {paint()} */
  function build(host, decls, state, onChange) {
    var rows = el('div', 'rows'), list = [];
    decls.forEach(function (d) {
      if (!(d[0] in state)) state[d[0]] = (Array.isArray(d[2]) || d[2] === 'color' || d[2] === 'text') ? d[3] : d[5];
      var r = rowFromDecl(d, function () { return state[d[0]]; }, function (v) { state[d[0]] = v; if (onChange) onChange(d[0], v, state); });
      r.dataset.key = d[0]; list.push(r); rows.appendChild(r);
    });
    host.appendChild(rows);
    return {
      rows: rows,
      paint: function () { list.forEach(function (r) { r.paint(); }); },
      param: function (k) { var r = list.filter(function (x) { return x.dataset.key === k; })[0]; return r && r.param; }
    };
  }
  root.Podacha = root.Podacha || {};
  root.Podacha.Panel = { build: build, extendParamRange: extendParamRange, fmt: fmt };
})(window);
