// kit-panel.js — ЕДИНСТВЕННЫЙ источник контрол-панели арсенала.
// Zero-dependency vanilla ES2020: без импортов, без DOM-фреймворков, без внешних таблиц.
// Канон: panel-canon (scrub-field, §1-9), КОНТРАКТ.md §1.
// Определяет ровно одну глобаль: window.DG.panel = { build, setValue, getValues, setTheme, setMode, css }.
// Всё завёрнуто в IIFE, чтобы внутренние хелперы не текли в window.
//
// Донор: data-games/src/kit-panel.js (566 строк, md5 0851ce2abbfbdf558512cb5afa388408),
// взят verbatim. Дельта арсенала, каждая строка с причиной:
//   · тема ночи как оверрайд-класс is-night + setTheme() — из data2d/src/d2-panel.js.
//     Второй файл панели перестаёт существовать: d2-panel это ТЕМА, а не форк;
//   · ряды chips (много выборов) и tabs (полноширинный переключатель) — из панели
//     конструктора наклеек (донор назван в kit/README.md). Грамматика ряда не менялась;
//   · режим client|studio: ряд, помеченный studio, в клиентском режиме не строится.
//     Оттуда же хоткеи S (режим) и H (спрятать панель);
//   · 🔴 aria-valuemin/valuemax/valuenow + role=slider на скрабе, и extendParamRange
//     двигает aria-valuemax. Без этого ручку нечем адресовать ни скринридеру, ни гейту:
//     проба 2-extend на движках августа краснеет именно этим.
//
// Версия и отпечаток ниже проставляются `python3 kit/stamp_kit.py`, руками не пишутся.
// Отпечаток считается по телу между маркерами — так его можно проверить и внутри
// собранного single-file, куда кит вклеен инлайном.

/* KIT-PANEL v1.0.0 md5:ca14db07c77063aa152b019098858e901b589ee55d3338df6ada9c60f989a942 */
/*<<<KIT-PANEL-BODY>>>*/
(function () {
  'use strict';

  // ===================================================================
  // §1. Состояние единственного активного инстанса панели
  // ===================================================================
  // API документа не принимает mount в setValue/getValues — значит панель
  // одна на страницу одновременно. Пересборка (повторный build) полностью
  // сбрасывает состояние ниже.

  let _onChange = function () {};
  let _values = Object.create(null);   // path -> текущее значение (плоское состояние)
  let _params = Object.create(null);   // path -> {kind, min,max,step | options | el,...}
  let _mount = null;                   // корень панели — на нём живут классы темы и режима
  let _theme = 'light';                // light | night
  let _mode = 'studio';                // studio | client
  let _cfg = null;                     // последняя конфигурация — для пересборки при смене режима

  // ===================================================================
  // §2. Числовые утилиты
  // ===================================================================

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  // нормализация лейбла: декларации сцен пишут &nbsp; как текст (правило
  // no-orphan — «не разрывать короткие служебные слова»), но textContent
  // сущности не парсит и печатает их буквально. Меняем на РЕАЛЬНЫЙ символ
  // U+00A0 (неразрывный пробел), а не на обычный пробел — иначе no-orphan
  // ломается: обычный пробел даёт браузеру право перенести строку тут же.
  // innerHTML сознательно не используем (XSS, нарушение канона).
  function normalizeLabel(label) {
    return String(label).replace(/&nbsp;/g, ' ');
  }

  // формат по step, канон: step<1 ? toFixed(2) : toFixed(0)
  function fmt(v, step) {
    v = +v;
    if (!isFinite(v)) v = 0;
    return step < 1 ? v.toFixed(2) : v.toFixed(0);
  }

  // extendParamRange — дословно канон (Закон №3): ввод за диапазон НЕ клампится,
  // а расширяет границы параметра, чтобы значение реально доехало до onChange.
  // 🔴 Дельта арсенала: вместе с границей едет aria-valuemin/valuemax. Диапазон,
  //    расширенный только внутри объекта, снаружи неотличим от клампа.
  function extendParamRange(p, v) {
    if (!p || isNaN(v)) return;
    if (v > p.max) { p.max = v; if (p.el) p.el.setAttribute('aria-valuemax', String(v)); }
    if (v < p.min) { p.min = v; if (p.el) p.el.setAttribute('aria-valuemin', String(v)); }
  }

  // ===================================================================
  // §3. Классификация rowDecl (три формы, четыре вида ряда)
  // ===================================================================
  //   число:    ['path','Label', min, max, step]                 (5 эл.)
  //   число+дефолт: ['path','Label', min, max, step, default]      (6 эл., форма §6.3)
  //   тумблер:  ['path','Label', 0, 1, 1]                         (5 эл., min===0&&max===1&&step===1)
  //   enum:     ['path','Label', ['soft','hard','wire']]          (3 эл., 3-й — массив)
  //   действие: ['@id','Label', 'action']                         (3 эл., 3-й === 'action')
  //   табы:     ['path','Label', ['day','night'], 'tabs']         (4 эл., один выбор, во всю ширину)
  //   чипы:     ['path','Label', ['a','b','c'], 'chips']          (4 эл., МНОГО выборов, значение — массив)
  //
  // Ряд может нести последним элементом флаг режима: {studio:true} — тогда в режиме
  // client он не строится вовсе (донор назван в kit/README.md, режимы CLIENT/STUDIO).

  function classifyRow(rawDecl) {
    const decl = declCore(rawDecl);
    if (!Array.isArray(decl) || decl.length < 3) {
      throw new Error('DG.panel: неверная rowDecl ' + JSON.stringify(rawDecl));
    }
    if (decl.length >= 4 && (decl[3] === 'tabs' || decl[3] === 'chips')) {
      if (!Array.isArray(decl[2])) {
        throw new Error('DG.panel: ' + decl[3] + ' требует список опций ' + JSON.stringify(decl));
      }
      return decl[3];
    }
    if (decl.length === 5 || (decl.length === 6 && typeof decl[5] === 'number')) {
      const min = decl[2], max = decl[3], step = decl[4];
      if (min === 0 && max === 1 && step === 1) return 'toggle';
      return 'number';
    }
    if (decl.length === 3) {
      if (Array.isArray(decl[2])) return 'enum';
      if (decl[2] === 'action') return 'action';
    }
    throw new Error('DG.panel: нераспознанная форма rowDecl ' + JSON.stringify(decl));
  }

  // флаг режима лежит последним элементом объектом: ['p','L',0,10,1,{studio:true}]
  function rowOpts(decl) {
    const last = decl[decl.length - 1];
    return (last && typeof last === 'object' && !Array.isArray(last)) ? last : {};
  }

  // декларация без хвостового объекта опций — форма, которую разбирает classifyRow
  function declCore(decl) {
    if (!Array.isArray(decl)) return decl;
    const last = decl[decl.length - 1];
    return (last && typeof last === 'object' && !Array.isArray(last)) ? decl.slice(0, -1) : decl;
  }

  // ===================================================================
  // §4. build — сборка панели из деклараций
  // ===================================================================

  function build(cfg) {
    cfg = cfg || {};
    const mount = cfg.mount;
    if (!mount) throw new Error('DG.panel.build: mount обязателен');
    const groups = cfg.groups || [];
    const values = cfg.values || {};

    _onChange = typeof cfg.onChange === 'function' ? cfg.onChange : function () {};
    _values = Object.create(null);
    _params = Object.create(null);
    _mount = mount;
    _cfg = cfg;
    if (cfg.mode === 'client' || cfg.mode === 'studio') _mode = cfg.mode;

    mount.innerHTML = '';
    mount.classList.add('dg-panel');

    for (let i = 0; i < groups.length; i++) {
      const g = buildGroup(groups[i], values);
      if (g) mount.appendChild(g);
    }

    // тема и режим переживают пересборку панели
    setTheme(cfg.theme || _theme);
    mount.classList.toggle('is-client', _mode === 'client');
    if (cfg.hotkeys !== false) bindHotkeys();
  }

  // ---- хоткеи S (режим) и H (спрятать панель) — донор: панель наклеек ----
  let _hotkeysBound = false;
  function bindHotkeys() {
    if (_hotkeysBound) return;
    _hotkeysBound = true;
    document.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      // 🔴 Хоткей не должен срабатывать, пока человек печатает число в скрабе.
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 's' || e.key === 'S' || e.key === 'ы' || e.key === 'Ы') {
        setMode(_mode === 'studio' ? 'client' : 'studio');
      } else if (e.key === 'h' || e.key === 'H' || e.key === 'р' || e.key === 'Р') {
        if (_mount) _mount.classList.toggle('is-hidden');
      }
    });
  }

  function buildGroup(g, values) {
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'dg-group';
    if (g.open === false) fieldset.classList.add('is-closed');

    const legend = document.createElement('legend');
    legend.className = 'dg-legend dg-ctrl';
    legend.tabIndex = 0;
    legend.setAttribute('role', 'button');
    legend.setAttribute('aria-expanded', g.open === false ? 'false' : 'true');

    const caret = document.createElement('span');
    caret.className = 'dg-legend-caret';
    caret.textContent = g.open === false ? '▸' : '▾'; // ▸ / ▾
    const text = document.createElement('span');
    text.className = 'dg-legend-text';
    text.textContent = g.name || '';
    legend.appendChild(caret);
    legend.appendChild(text);

    const body = document.createElement('div');
    body.className = 'dg-group-body';

    const rows = g.rows || [];
    let shown = 0;
    for (let i = 0; i < rows.length; i++) {
      // ряд студии в клиентском режиме не строится вовсе: спрятанный, но живой
      // контрол это тот же обман, что и мёртвая ручка
      if (_mode === 'client' && rowOpts(rows[i]).studio) continue;
      body.appendChild(buildRow(rows[i], values));
      shown++;
    }
    // группа, у которой в этом режиме не осталось рядов, не показывается пустой
    if (!shown && (g.studio || rows.length)) return null;

    function toggleGroup() {
      const closed = fieldset.classList.toggle('is-closed');
      caret.textContent = closed ? '▸' : '▾';
      legend.setAttribute('aria-expanded', closed ? 'false' : 'true');
    }
    legend.addEventListener('click', toggleGroup);
    legend.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleGroup(); }
    });

    fieldset.appendChild(legend);
    fieldset.appendChild(body);
    return fieldset;
  }

  function buildRow(rawDecl, values) {
    const kind = classifyRow(rawDecl);
    const decl = declCore(rawDecl);
    if (kind === 'action') return buildActionRow(decl);

    const path = decl[0];
    const label = decl[1];

    const row = document.createElement('div');
    row.className = 'dg-row';
    row.dataset.path = path;
    row.dataset.kind = kind;

    const lab = document.createElement('label');
    lab.className = 'dg-row-label';
    lab.textContent = normalizeLabel(label);
    row.appendChild(lab);

    let ctrl;
    if (kind === 'number') ctrl = buildScrub(path, decl[2], decl[3], decl[4], values, label, decl[5]);
    else if (kind === 'toggle') ctrl = buildToggle(path, values, decl[5]);
    else if (kind === 'tabs') { row.classList.add('dg-row-wide'); ctrl = buildTabs(path, decl[2], values); }
    else if (kind === 'chips') { row.classList.add('dg-row-wide'); ctrl = buildChips(path, decl[2], values); }
    else {
      const opts = decl[2];
      const wide = Array.isArray(opts) && opts.length > 4;
      if (wide) row.classList.add('dg-row-wide');
      ctrl = buildEnum(path, opts, values, wide);
    }

    row.appendChild(ctrl);
    return row;
  }

  // ---------------------------------------------------------------
  // число — скраб-поле (Закон №1/№2): один виджет, число живёт в треке
  // ---------------------------------------------------------------

  function buildScrub(path, min, max, step, values, label, dflt) {
    const p = { kind: 'number', min: min, max: max, step: step };

    let v = values[path];
    // 🔴 Дефолт берётся из декларации, а не из clamp(0,…): «ноль, прижатый к min»
    //    делал сцену пустой при любом min > 0 и убивал влияние сида на кадр.
    if (v === undefined || isNaN(v)) v = (dflt === undefined) ? clamp(0, min, max) : +dflt;
    else v = +v;

    const wrap = document.createElement('div');
    wrap.className = 'dg-scrub dg-ctrl';
    wrap.tabIndex = 0;
    wrap.dataset.path = path;
    // 🔴 Дельта арсенала: скраб объявляет себя ползунком и свой диапазон.
    //    Без этого значение ручки нельзя ни озвучить, ни проверить снаружи.
    wrap.setAttribute('role', 'slider');
    wrap.setAttribute('aria-label', normalizeLabel(String(label === undefined ? path : label)));
    wrap.setAttribute('aria-valuemin', String(min));
    wrap.setAttribute('aria-valuemax', String(max));

    const fill = document.createElement('div');
    fill.className = 'dg-scrub-fill';

    const val = document.createElement('span');
    val.className = 'dg-scrub-val';

    const edit = document.createElement('input');
    edit.className = 'dg-scrub-edit';
    edit.type = 'text';
    edit.inputMode = 'decimal';
    edit.autocomplete = 'off';
    edit.spellcheck = false;

    wrap.appendChild(fill);
    wrap.appendChild(val);
    wrap.appendChild(edit);

    p.el = wrap; p.fillEl = fill; p.valEl = val; p.editEl = edit;
    _params[path] = p;
    _values[path] = v;
    renderScrub(path);

    // ---- drag = скраб (клампится к диапазону; Shift = ×0.1 точность) ----
    const RANGE_PX = 150; // px горизонтального свайпа на весь диапазон min..max
    let dragged = false, startX = 0, startV = 0;

    function onMove(e) {
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 3) dragged = true;
      const st = _params[path];
      const range = (st.max - st.min) || 1;
      const sens = e.shiftKey ? 0.1 : 1;
      const nv = clamp(startV + (dx / RANGE_PX) * range * sens, st.min, st.max);
      commitValue(path, nv, true);
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (!dragged) enterEdit(path); // клик без драга = правка числом на месте
    }
    wrap.addEventListener('pointerdown', function (e) {
      if (wrap.classList.contains('is-editing')) return;
      if (e.button !== undefined && e.button !== 0) return;
      dragged = false;
      startX = e.clientX;
      startV = _values[path];
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      e.preventDefault();
    });

    // ---- стрелки ±step на фокусе, Shift ×10; Enter — тоже правка на месте ----
    wrap.addEventListener('keydown', function (e) {
      if (wrap.classList.contains('is-editing')) return;
      const st = _params[path];
      let d = 0;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') d = st.step;
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') d = -st.step;
      else if (e.key === 'Enter') { e.preventDefault(); enterEdit(path); return; }
      else return;
      if (e.shiftKey) d *= 10;
      e.preventDefault();
      const nv = clamp(_values[path] + d, st.min, st.max);
      commitValue(path, nv, true);
    });

    // ---- правка числом: Enter/blur коммит (extendParamRange), Esc отмена ----
    edit.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); commitEdit(path); }
      else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(path); }
    });
    edit.addEventListener('blur', function () { commitEdit(path); });

    return wrap;
  }

  function enterEdit(path) {
    const p = _params[path];
    if (!p || p.kind !== 'number') return;
    p.el.classList.add('is-editing');
    p.editEl.value = fmt(_values[path], p.step);
    p.editEl.focus();
    p.editEl.select();
  }

  function commitEdit(path) {
    const p = _params[path];
    if (!p || !p.el.classList.contains('is-editing')) return;
    p.el.classList.remove('is-editing');
    const raw = String(p.editEl.value).trim().replace(',', '.');
    const v = parseFloat(raw);
    if (raw === '' || isNaN(v)) { renderScrub(path); return; } // мусор — без изменений
    extendParamRange(p, v); // ввод за диапазон НЕ клампится — расширяем границы
    commitValue(path, v, true);
  }

  function cancelEdit(path) {
    const p = _params[path];
    if (!p) return;
    p.el.classList.remove('is-editing');
    renderScrub(path); // возврат к значению до правки
  }

  function renderScrub(path) {
    const p = _params[path];
    if (!p) return;
    const v = _values[path];
    const range = (p.max - p.min) || 1;
    const frac = clamp((v - p.min) / range, 0, 1);
    p.fillEl.style.setProperty('--fill', String(frac));
    p.valEl.textContent = fmt(v, p.step);
    p.el.setAttribute('aria-valuenow', String(v));      // значение живёт и в дереве доступности
  }

  // ---------------------------------------------------------------
  // тумблер (0,1,1)
  // ---------------------------------------------------------------

  function buildToggle(path, values, dflt) {
    const p = { kind: 'toggle' };
    let v = values[path];
    v = (v === undefined) ? (dflt ? 1 : 0) : (v ? 1 : 0);

    const wrap = document.createElement('div');
    wrap.className = 'dg-toggle dg-ctrl';
    wrap.tabIndex = 0;
    wrap.dataset.path = path;
    wrap.setAttribute('role', 'switch');

    const thumb = document.createElement('span');
    thumb.className = 'dg-toggle-thumb';
    wrap.appendChild(thumb);

    p.el = wrap;
    _params[path] = p;
    _values[path] = v;
    renderToggle(path);

    function flip() { commitValue(path, _values[path] ? 0 : 1, true); }
    wrap.addEventListener('click', flip);
    wrap.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); }
    });

    return wrap;
  }

  function renderToggle(path) {
    const p = _params[path];
    if (!p) return;
    const on = !!_values[path];
    p.el.classList.toggle('is-on', on);
    p.el.setAttribute('aria-checked', on ? 'true' : 'false');
  }

  // ---------------------------------------------------------------
  // enum — сегмент-контрол (донор Unicorn Studio, .seg)
  // ---------------------------------------------------------------

  function buildEnum(path, options, values, wide) {
    const p = { kind: 'enum', options: options.slice() };
    let v = values[path];
    if (v === undefined || options.indexOf(v) === -1) v = options[0];

    const wrap = document.createElement('div');
    wrap.className = wide ? 'dg-seg dg-seg-grid' : 'dg-seg';
    wrap.dataset.path = path;

    const optEls = options.map(function (opt) {
      const b = document.createElement('div');
      b.className = 'dg-seg-opt dg-ctrl';
      b.tabIndex = 0;
      b.textContent = opt;
      b.dataset.value = opt;
      b.addEventListener('click', function () { commitValue(path, opt, true); });
      b.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); commitValue(path, opt, true); }
      });
      wrap.appendChild(b);
      return b;
    });

    p.el = wrap; p.optEls = optEls;
    _params[path] = p;
    _values[path] = v;
    renderEnum(path);
    return wrap;
  }

  function renderEnum(path) {
    const p = _params[path];
    if (!p) return;
    const v = _values[path];
    for (let i = 0; i < p.optEls.length; i++) {
      p.optEls[i].classList.toggle('is-active', p.optEls[i].dataset.value === String(v));
    }
  }

  // ---------------------------------------------------------------
  // tabs — один выбор во всю ширину (донор: buildSeg панели наклеек)
  // ---------------------------------------------------------------

  function buildTabs(path, options, values) {
    const p = { kind: 'tabs', options: options.slice() };
    let v = values[path];
    if (v === undefined || options.indexOf(v) === -1) v = options[0];

    const wrap = document.createElement('div');
    wrap.className = 'dg-tabs';
    wrap.dataset.path = path;
    wrap.setAttribute('role', 'tablist');

    const optEls = options.map(function (opt) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dg-tab dg-ctrl';
      b.textContent = normalizeLabel(opt);
      b.dataset.value = opt;
      b.setAttribute('role', 'tab');
      b.addEventListener('click', function () { commitValue(path, opt, true); });
      wrap.appendChild(b);
      return b;
    });

    p.el = wrap; p.optEls = optEls;
    _params[path] = p;
    _values[path] = v;
    renderTabs(path);
    return wrap;
  }

  function renderTabs(path) {
    const p = _params[path];
    if (!p) return;
    const v = _values[path];
    for (let i = 0; i < p.optEls.length; i++) {
      const on = p.optEls[i].dataset.value === String(v);
      p.optEls[i].classList.toggle('is-active', on);
      p.optEls[i].setAttribute('aria-selected', on ? 'true' : 'false');
    }
  }

  // ---------------------------------------------------------------
  // chips — МНОГО выборов, значение массив (донор: buildChips панели наклеек)
  // ---------------------------------------------------------------

  function buildChips(path, options, values) {
    const p = { kind: 'chips', options: options.slice() };
    let v = values[path];
    // значение чипов всегда массив: одиночное значение и undefined приводятся к нему,
    // иначе первый же toggle превратит состояние в строку и сломает getValues
    if (!Array.isArray(v)) v = (v === undefined || v === null) ? [] : [v];
    v = v.filter(function (x) { return options.indexOf(x) !== -1; });

    const wrap = document.createElement('div');
    wrap.className = 'dg-chips';
    wrap.dataset.path = path;

    const optEls = options.map(function (opt) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dg-chip dg-ctrl';
      b.textContent = normalizeLabel(opt);
      b.dataset.value = opt;
      b.addEventListener('click', function () {
        const cur = _values[path].slice();
        const i = cur.indexOf(opt);
        if (i === -1) cur.push(opt); else cur.splice(i, 1);
        commitValue(path, cur, true);
      });
      wrap.appendChild(b);
      return b;
    });

    p.el = wrap; p.optEls = optEls;
    _params[path] = p;
    _values[path] = v;
    renderChips(path);
    return wrap;
  }

  function renderChips(path) {
    const p = _params[path];
    if (!p) return;
    const v = _values[path] || [];
    for (let i = 0; i < p.optEls.length; i++) {
      const on = v.indexOf(p.optEls[i].dataset.value) !== -1;
      p.optEls[i].classList.toggle('is-active', on);
      p.optEls[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  // ---------------------------------------------------------------
  // действие — полноширинный ряд-кнопка
  // ---------------------------------------------------------------

  function buildActionRow(decl) {
    const path = decl[0];
    const label = decl[1];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dg-action dg-ctrl';
    btn.textContent = normalizeLabel(label);
    btn.dataset.path = path;
    btn.dataset.kind = 'action';
    btn.addEventListener('click', function () { _onChange(path, true); });
    return btn;
  }

  // ===================================================================
  // §5. Единая точка изменения значения — обновляет UI и (опционально) зовёт onChange
  // ===================================================================

  function commitValue(path, v, fireChange) {
    _values[path] = v;
    const p = _params[path];
    if (p) {
      if (p.kind === 'number') renderScrub(path);
      else if (p.kind === 'toggle') renderToggle(path);
      else if (p.kind === 'enum') renderEnum(path);
      else if (p.kind === 'tabs') renderTabs(path);
      else if (p.kind === 'chips') renderChips(path);
    }
    if (fireChange) _onChange(path, v);
  }

  // ===================================================================
  // §6. Публичное API: setValue / getValues
  // ===================================================================

  // программно (например после хоткея) — обновляет UI БЕЗ onChange
  function setValue(path, value) {
    const p = _params[path];
    if (!p) { _values[path] = value; return; } // путь вне текущей панели — просто запомнить
    if (p.kind === 'number') {
      const v = +value;
      extendParamRange(p, v); // тот же закон №3 — программный сдвиг тоже не клампится
      commitValue(path, v, false);
    } else if (p.kind === 'toggle') {
      commitValue(path, value ? 1 : 0, false);
    } else if (p.kind === 'enum' || p.kind === 'tabs') {
      if (p.options.indexOf(value) === -1) return;
      commitValue(path, value, false);
    } else if (p.kind === 'chips') {
      const list = (Array.isArray(value) ? value : [value])
        .filter(function (x) { return p.options.indexOf(x) !== -1; });
      commitValue(path, list, false);
    }
  }

  // ---- тема: подмена значений токенов классом на корне, без filter/invert ----
  // Донор: data2d/src/d2-panel.js. Второй файл панели не нужен — d2-panel это ТЕМА.
  function setTheme(theme) {
    _theme = (theme === 'night') ? 'night' : 'light';
    if (_mount) _mount.classList.toggle('is-night', _theme === 'night');
    return _theme;
  }

  // ---- режим: client прячет ряды студии. Пересборка обязательна, потому что
  //      ряд студии в клиенте не строится вовсе, а не скрывается стилем ----
  function setMode(mode) {
    const next = (mode === 'client') ? 'client' : 'studio';
    if (next === _mode) return _mode;
    _mode = next;
    if (_cfg) {
      const keep = getValues();
      build(Object.assign({}, _cfg, { values: Object.assign({}, _cfg.values, keep), mode: _mode }));
    }
    return _mode;
  }

  function getValues() {
    const out = {};
    for (const k in _values) if (Object.prototype.hasOwnProperty.call(_values, k)) out[k] = _values[k];
    return out;
  }

  // ===================================================================
  // §7. CSS — токены + грамматика ряда + матрица состояний
  // ===================================================================
  // Хардкод-хекс живёт ТОЛЬКО внутри .dg-panel{...} (блок определения токенов).
  // Везде дальше — только var(...). Ширина/цвет/шрифт контролов — токены;
  // геометрия конкретных виджетов (высота скраба/тумблера/сегмента), которую
  // канон токеном не называет, оставлена литеральной (см. отчёт).

  const css = ''
    + '.dg-panel{'
    + '--fz-s:9px;--fz-m:10px;--fz-l:11px;'
    + '--sp-1:4px;--sp-2:8px;--sp-3:12px;'
    + '--ease-out:cubic-bezier(.23,1,.32,1);--dur-press:140ms;--dur-pop:180ms;'
    + '--dg-bg:#eae7e0;'
    + '--dg-surface:#f4f2ee;'
    + '--dg-surface-hover:#ece8e0;'
    + '--dg-track:#e1ddd0;'
    + '--dg-fill:#cdc4ac;'
    + '--dg-ink:#1b1a17;'
    + '--dg-muted:#8d897c;'
    + '--dg-border:#d7d2c4;'
    + '--dg-focus:#3568d4;'
    + '--dg-accent-live:#b4531f;'
    + '--dg-accent-warn:#b3261e;'
    + '--dg-radius-panel:6px;'
    + '--dg-radius-ctrl:4px;'
    + 'box-sizing:border-box;'
    + 'width:232px;min-width:232px;max-width:232px;'
    + 'max-height:100%;overflow-y:auto;overflow-x:hidden;'
    + 'background:var(--dg-bg);'
    + 'border:1px solid var(--dg-border);'
    + 'border-radius:var(--dg-radius-panel);'
    + 'padding:var(--sp-2);'
    + 'font-family:ui-monospace,SFMono-Regular,Menlo,monospace;'
    + 'font-size:var(--fz-m);line-height:1.4;'
    + 'color:var(--dg-ink);'
    + 'font-variant-numeric:tabular-nums;'
    + 'user-select:none;'
    + 'filter:none;' // панель НЕ инвертируется вместе со сценой — фильтров нет
    + '}'

    // ---- ночная тема: честная подмена ЗНАЧЕНИЙ токенов, без filter/invert.
    // Донор механики: data2d/src/d2-panel.js. Значения — из §9 справочника наряда.
    + '.dg-panel.is-night{'
    + '--dg-bg:#1F1C17;'
    + '--dg-surface:rgba(244,240,227,.07);'
    + '--dg-surface-hover:rgba(244,240,227,.13);'
    + '--dg-track:rgba(244,240,227,.10);'
    + '--dg-fill:#C7A985;'
    + '--dg-ink:#F4F0E3;'
    + '--dg-muted:#A6A19B;'
    + '--dg-border:rgba(244,240,227,.16);'
    + '--dg-focus:#75ABC1;'
    + '--dg-accent-live:#C7A985;'
    + '--dg-accent-warn:#C3AFBE;'
    + '}'

    + '.dg-panel.is-hidden{display:none;}'   // хоткей H
    + '.dg-panel *{box-sizing:border-box;}'
    + '.dg-panel :focus{outline:none;}'

    // ---- группа: fieldset+legend, ритм 12 между группами ----
    + '.dg-group{border:0;margin:0 0 var(--sp-3) 0;padding:0;min-width:0;}'
    + '.dg-group:last-child{margin-bottom:0;}'
    + '.dg-legend{display:flex;align-items:center;gap:var(--sp-1);padding:var(--sp-1) var(--sp-1);'
    + 'font-size:var(--fz-s);letter-spacing:.06em;text-transform:uppercase;color:var(--dg-muted);'
    + 'cursor:pointer;border-radius:var(--dg-radius-ctrl);'
    + 'transition:background-color var(--dur-press) var(--ease-out);}'
    + '.dg-legend-caret{display:inline-block;width:1em;text-align:center;color:var(--dg-muted);}'
    + '.dg-legend-text{flex:1 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
    + '.dg-group-body{display:flex;flex-direction:column;gap:var(--sp-2);padding:var(--sp-1) var(--sp-1) 0;}'
    + '.dg-group.is-closed .dg-group-body{display:none;}'

    // ---- ряд: label слева, контрол справа. Ритм 4 внутри ряда ----
    + '.dg-row{display:flex;align-items:center;gap:var(--sp-1);min-width:0;}'
    + '.dg-row-label{flex:0 0 44%;max-width:44%;overflow:hidden;text-overflow:ellipsis;'
    + 'white-space:nowrap;font-size:var(--fz-m);color:var(--dg-muted);}'
    // ---- enum "широкий" ряд (>4 опций): лейбл на своей строке сверху,
    // сегменты сеткой ниже, во всю ширину панели ----
    + '.dg-row.dg-row-wide{flex-direction:column;align-items:stretch;gap:var(--sp-1);}'
    + '.dg-row.dg-row-wide .dg-row-label{flex:0 0 auto;max-width:none;width:100%;}'

    // ---- общий контрол: матрица состояний (default/hover/focus-visible/active/disabled) ----
    + '.dg-ctrl{position:relative;background:var(--dg-surface);border:1px solid transparent;'
    + 'border-radius:var(--dg-radius-ctrl);color:var(--dg-ink);'
    + 'transition:background-color var(--dur-press) var(--ease-out),transform var(--dur-press) var(--ease-out);}'
    + '@media (hover:hover) and (pointer:fine){.dg-ctrl:hover{background:var(--dg-surface-hover);}}'
    + '.dg-ctrl:focus-visible{outline:2px solid var(--dg-focus);outline-offset:-2px;}'
    + '.dg-ctrl:active{transform:scale(.97);}'
    + '.dg-ctrl.is-disabled,.dg-ctrl:disabled{opacity:.42;pointer-events:none;}'

    // ---- скраб-поле: число живёт в треке, заливка = (v-min)/(max-min) ----
    + '.dg-scrub{flex:1 1 auto;min-width:96px;height:22px;display:flex;align-items:center;'
    + 'justify-content:flex-end;padding:0 var(--sp-1);overflow:hidden;cursor:ew-resize;touch-action:none;}'
    + '.dg-scrub-fill{position:absolute;left:0;top:0;bottom:0;width:calc(var(--fill,0) * 100%);'
    + 'background:var(--dg-fill);pointer-events:none;}'
    + '.dg-scrub-val{position:relative;z-index:1;font-variant-numeric:tabular-nums;'
    + 'font-size:var(--fz-m);pointer-events:none;}'
    + '.dg-scrub-edit{display:none;position:absolute;inset:0;width:100%;height:100%;border:0;'
    + 'background:transparent;text-align:right;padding:0 var(--sp-1);font:inherit;'
    + 'font-variant-numeric:tabular-nums;color:var(--dg-ink);z-index:2;}'
    + '.dg-scrub.is-editing .dg-scrub-val{visibility:hidden;}'
    + '.dg-scrub.is-editing .dg-scrub-edit{display:block;}'
    + '.dg-scrub-edit::-webkit-inner-spin-button,.dg-scrub-edit::-webkit-outer-spin-button{'
    + '-webkit-appearance:none;margin:0;}'
    + '.dg-scrub-edit{-moz-appearance:textfield;appearance:textfield;}'

    // ---- тумблер ----
    + '.dg-toggle{flex:0 0 auto;margin-left:auto;width:34px;height:18px;border-radius:999px;'
    + 'background:var(--dg-track);cursor:pointer;}'
    + '.dg-toggle-thumb{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;'
    + 'background:var(--dg-bg);'
    + 'transition:transform var(--dur-press) var(--ease-out),background-color var(--dur-press) var(--ease-out);}'
    + '.dg-toggle.is-on{background:var(--dg-accent-live);}'
    + '.dg-toggle.is-on .dg-toggle-thumb{transform:translateX(16px);}'

    // ---- enum: сегмент-контрол ----
    + '.dg-seg{flex:1 1 auto;min-width:0;display:flex;height:24px;border-radius:var(--dg-radius-ctrl);'
    + 'background:var(--dg-track);overflow:hidden;}'
    + '.dg-seg-opt{flex:1 1 0;min-width:0;display:flex;align-items:center;justify-content:center;'
    + 'font-size:var(--fz-s);color:var(--dg-muted);cursor:pointer;border-radius:0;'
    + 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
    + '.dg-seg-opt.is-active{background:var(--dg-ink);color:var(--dg-bg);}'
    + '.dg-seg.dg-seg-grid{display:grid;grid-template-columns:repeat(3,1fr);height:auto;'
    + 'background:transparent;gap:var(--sp-1);overflow:visible;}'
    + '.dg-seg.dg-seg-grid .dg-seg-opt{height:24px;background:var(--dg-track);'
    + 'border-radius:var(--dg-radius-ctrl);}'
    + '.dg-seg.dg-seg-grid .dg-seg-opt.is-active{background:var(--dg-ink);color:var(--dg-bg);}'

    // ---- tabs: один выбор, во всю ширину ряда ----
    + '.dg-tabs{display:flex;width:100%;height:24px;border-radius:var(--dg-radius-ctrl);'
    + 'background:var(--dg-track);overflow:hidden;}'
    + '.dg-tab{flex:1 1 0;min-width:0;font:inherit;font-size:var(--fz-s);letter-spacing:.04em;'
    + 'text-transform:uppercase;color:var(--dg-muted);background:transparent;cursor:pointer;'
    + 'border:0;border-radius:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
    + '.dg-tab.is-active{background:var(--dg-ink);color:var(--dg-bg);}'

    // ---- chips: много выборов, перенос по строкам. Пилюля = радиус 999 (закон 1) ----
    + '.dg-chips{display:flex;flex-wrap:wrap;gap:var(--sp-1);width:100%;}'
    + '.dg-chip{font:inherit;font-size:var(--fz-s);padding:2px var(--sp-2);height:20px;'
    + 'border-radius:999px;color:var(--dg-muted);background:var(--dg-track);'
    + 'border:1px solid transparent;cursor:pointer;}'
    + '.dg-chip.is-active{background:var(--dg-ink);color:var(--dg-bg);}'

    // ---- действие: полноширинный ряд-кнопка ----
    + '.dg-action{display:block;width:100%;text-align:left;padding:var(--sp-1) var(--sp-2);'
    + 'font:inherit;font-size:var(--fz-m);cursor:pointer;border-color:var(--dg-border);}';

  // ===================================================================
  // §8. Экспорт — ровно одна глобаль
  // ===================================================================

  window.DG = window.DG || {};
  DG.panel = {
    build: build, setValue: setValue, getValues: getValues,
    setTheme: setTheme, setMode: setMode, css: css,
    version: '1.0.0'
  };

})();
/*<<<KIT-PANEL-END>>>*/
