#!/usr/bin/env node
/* perf-probe.js — честный замер канвас-сцены. Канон — skill canvas-frame-budget.
   Запуск:  node perf-probe.js /абсолютный/путь/scene.html
   Нужен playwright + chromium (в контейнере: executablePath ниже).

   ЧТО МЕРИТ И ПОЧЕМУ ИМЕННО ТАК
     · прогрев (JIT + первый GC) гоняется и НЕ идёт в зачёт — но о нём сообщается;
     · переходный процесс при резкой смене сцены — ОТДЕЛЬНАЯ проба (пропуски за 90 кадров);
     · установившийся fps меряется ПОСЛЕ паузы: пауза без пробы на переход = подгонка;
     · метрика двойная: средний кадр И доля кадров >25 мс (один пропущенный vsync = 33 мс);
     · нагрузка кадра (штрихи/точки) — чтобы было видно ПОЧЕМУ просело;
     · пиксель фона — тема проверяется цветом, а не верой.

   НАСТРОЙКА: правь SCENES и LIMITS, логику не трогай.
*/
const { chromium } = require('playwright');

const FILE = process.argv[2];
const LIMITS = { avg: 17.6, drops: 4, transientSkips: 8 };   /* 60 Гц: норма кадра ≈16.7 мс */
const FRAMES = 300;                                          /* 5 с на замер */
const SETTLE = 2500;                                         /* мс на устаканивание после смены сцены */

/* Сцены: label + то, что надо сделать на странице. Первая строка — «худший угол». */
const SCENES = [
  { label: 'default',            setup: () => {} },
  { label: 'worst (плотность×шлейф)', transient: true,
    setup: () => { PANEL.commit('show.density', 40); PANEL.commit('show.trail', 1); } },
  { label: 'тело B',             setup: () => { document.querySelector('#variantSeg [data-v="barley"]')?.click(); } },
];

(async () => {
  if (!FILE) { console.error('usage: node perf-probe.js /path/scene.html'); process.exit(2); }
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
                                    args: ['--force-device-scale-factor=1'] });
  const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await pg.goto('file://' + FILE);
  await pg.waitForTimeout(800);

  const R = []; const ok = (n, d) => R.push(['✓', n, d]); const bad = (n, d) => R.push(['✗', n, d]);
  const check = (n, c, d) => (c ? ok : bad)(n, d);

  /* один замер: FRAMES кадров rAF-дельт */
  const fps = () => pg.evaluate(N => new Promise(res => {
    const ds = []; let prev = performance.now(), n = 0;
    const f = t => { ds.push(t - prev); prev = t; if (++n < N) requestAnimationFrame(f);
      else res({ avg: +(ds.reduce((s, v) => s + v, 0) / ds.length).toFixed(2),
                 drops: +(ds.filter(d => d > 25).length / ds.length * 100).toFixed(1) }); };
    requestAnimationFrame(f);
  }), FRAMES);

  /* переходный процесс: 90 кадров начиная С МОМЕНТА команды */
  const transient = setupFn => pg.evaluate(([src, N]) => new Promise(res => {
    const ds = []; let prev = performance.now(), n = 0;
    (new Function(src))();                       /* смена сцены ровно в нулевом кадре */
    const f = t => { ds.push(t - prev); prev = t; if (++n < N) requestAnimationFrame(f);
      else res({ skips: ds.filter(d => d > 25).length, max: +Math.max(...ds).toFixed(1) }); };
    requestAnimationFrame(f);
  }), ['(' + setupFn.toString() + ')()', 90]);

  /* 0. ПРОГРЕВ — гоняем и не засчитываем, но показываем */
  const warm = await fps();
  /* прогрев не идёт в зачёт fps, но и не уходит в тишину: десятикратная деградация прогрева —
     это регрессия загрузки, и её должно быть видно красным */
  check('прогрев (вне зачёта fps, но под порогом ×3)', warm.avg <= LIMITS.avg * 3,
        `avg ${warm.avg}мс · дропы ${warm.drops}%`);

  /* 0-бис. КАЛИБРОВКА МАШИНЫ. Абсолютные миллисекунды без неё не значат ничего: один и тот же
     файл даёт 16.8 мс на восьми ядрах и 22 мс на двух. Синтетическая сцена рисует известное
     число полилиний и показывает ЁМКОСТЬ этой машины в точках за кадр. Заодно она разделяет
     два разных диагноза: «канвас не тянет столько линий» и «наш JS дорог на точку». */
  const cal = await (async () => {
    const cpg = await b.newPage({ viewport: { width: 1440, height: 900 } });
    await cpg.setContent(`<body style="margin:0;background:#111"><canvas id=c width=1440 height=900></canvas>
      <script>const cx=document.getElementById('c').getContext('2d');window.__N=40;window.__P=110;
      (function loop(){cx.clearRect(0,0,1440,900);cx.strokeStyle='#ccc';cx.lineWidth=1;
        for(let s=0;s<window.__N;s++){cx.beginPath();
          for(let i=0;i<window.__P;i++){const a=i/window.__P*6.283+s*.1,r=200+60*Math.sin(a*3+s);
            const x=720+Math.cos(a)*r,y=450+Math.sin(a)*r;i?cx.lineTo(x,y):cx.moveTo(x,y);}
          cx.stroke();}requestAnimationFrame(loop);})();<\/script></body>`);
    const cfps = () => cpg.evaluate(() => new Promise(res => { const ds = []; let p = performance.now(), n = 0;
      const f = t => { ds.push(t - p); p = t; if (++n < 180) requestAnimationFrame(f);
        else res(+(ds.reduce((s, v) => s + v, 0) / ds.length).toFixed(2)); }; requestAnimationFrame(f); }));
    await cfps();
    let cap = 0;
    for (const N of [40, 80, 160, 320, 640, 1280]) {
      await cpg.evaluate(n => window.__N = n, N);
      const avg = await cfps();
      if (avg > 18) break;
      cap = N * 110;
    }
    await cpg.close();
    return cap;
  })();
  /* Ноль здесь означает, что машина не вытянула даже первую ступеньку (4400 точек) — это
     не «ок без данных», это красный флаг: дальше все абсолютные мс бессмысленны. Проба,
     которая в таком случае молча ставит галочку, — ровно тот дефект, о котором Часть 3. */
  check('ёмкость машины (калибровка)', cal > 0,
        cal ? `${cal} точек/кадр держит 60 Гц` + (cal >= 140800 ? ' (лестница пройдена целиком — потолок выше)' : '')
            : 'машина не вытянула и 4400 точек/кадр — абсолютные мс не показательны');

  /* 1..N. Сцены */
  const perf = [];
  for (const sc of SCENES) {
    if (sc.transient) {
      const tr = await transient(sc.setup);
      check(`переход → ${sc.label}: ≤${LIMITS.transientSkips} пропусков за 90 кадров`,
            tr.skips <= LIMITS.transientSkips, `пропусков ${tr.skips} · максимум ${tr.max}мс`);
    } else {
      await pg.evaluate(src => (new Function(src))(), '(' + sc.setup.toString() + ')()');
    }
    await pg.waitForTimeout(SETTLE);                       /* устаканивание — и только потом замер */
    const r = await fps();
    perf.push({ ...r, label: sc.label });
    ok(`перф · ${sc.label}`, `avg ${r.avg}мс · дропы ${r.drops}%`);
  }
  const wAvg = Math.max(...perf.map(p => p.avg)), wDrp = Math.max(...perf.map(p => p.drops));
  check(`60 fps (avg ≤${LIMITS.avg} · дропов ≤${LIMITS.drops}%)`,
        wAvg <= LIMITS.avg && wDrp <= LIMITS.drops, `худший avg ${wAvg}мс · дропы ${wDrp}%`);

  /* нагрузка кадра — объясняет цифры выше */
  /* ГРАБЛЯ: `const LAST = …` на верхнем уровне классического скрипта НЕ становится свойством
     window — `window.LAST` даёт undefined, а голое `LAST` работает. Проба, написанная через
     window.*, молча вернёт null и «пройдёт». Обращаться по голому имени через typeof-охрану. */
  const load = await pg.evaluate(() => {
    const L = (typeof LAST !== 'undefined' && LAST.strokes) ? LAST.strokes : null;
    return L ? { штрихов: L.length, точек: L.reduce((s, x) => s + (x.pts ? x.pts.length : 0), 0) } : null;
  });
  if (load) {
    ok('нагрузка кадра', JSON.stringify(load));
    /* Диагноз: сцена сильно ниже ёмкости, но кадр не держится → узкое место НЕ отрисовка,
       а JS на точку (замыкания-трансформы, объект на точку, сортировка, GC). Оптимизировать
       надо аллокации, а не число линий. Замер Blend Trail: 6 140 точек при ёмкости 35 200. */
    if (cal && load.точек < cal * .4 && wAvg > LIMITS.avg)
      ok('диагноз', `узкое место — JS/GC на точку, не канвас (${load.точек} из ${cal} возможных)`);
  }

  /* пиксель фона — тема проверяется цветом */
  const px = await pg.evaluate(() => {
    const c = document.querySelector('canvas'); if (!c) return null;
    const d = c.getContext('2d').getImageData(10, 10, 1, 1).data;
    return '#' + [...d].slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join('');
  });
  if (px) ok('фон сцены (пиксель)', px);

  /* ресайзы: фигура остаётся в кадре */
  for (const vp of [{ width: 780, height: 620 }, { width: 1920, height: 1080 }]) {
    await pg.setViewportSize(vp); await pg.waitForTimeout(900);
    const com = await pg.evaluate(() => {
      const L = (typeof LAST !== 'undefined' && LAST.strokes) ? LAST.strokes : null; if (!L) return null;
      let sx = 0, sy = 0, n = 0;
      for (const s of L) for (const p of (s.pts || [])) { sx += p.x; sy += p.y; n++; }
      return n ? { x: sx / n / innerWidth, y: sy / n / innerHeight } : null;
    });
    if (com) check(`ресайз ${vp.width}×${vp.height}: фигура у центра`,
                   com.x > .2 && com.x < .8 && com.y > .2 && com.y < .8,
                   `цм ${(com.x * 100) | 0}%·${(com.y * 100) | 0}%`);
  }

  check('ноль ошибок страницы', errs.length === 0, errs.slice(0, 3).join(' | '));

  await b.close();
  const fails = R.filter(r => r[0] === '✗');
  console.log((fails.length ? 'PERF FAIL' : 'PERF OK') + ` · ${R.length - fails.length}/${R.length}`);
  R.forEach(r => console.log(`  ${r[0]} ${r[1]}${r[2] ? ' · ' + r[2] : ''}`));
  process.exit(fails.length ? 1 : 0);
})();
