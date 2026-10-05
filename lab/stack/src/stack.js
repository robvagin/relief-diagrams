/* stack — model of record слоями: данные · знания · правила · решение (README §6.1, §7.3 наклон).
   Камера с наклоном τ: screen_y = y·cos τ − h·sin τ; торцы светлеют и темнеют по своей нормали;
   тени считаются в мире и ложатся на каждый нижний слой отдельно (σ растёт с Δh, L2).
   Выноски по правилу донора 01-ellipse-sphere (§7.6 D): коридор от габарита фигуры, один излом,
   сортировка по y источника, переполнение честным «+N».
   Три варианта отличаются композицией (RELIEF_VARIANT), не цветом:
     v1 · разнесённая стопка: равные слои друг над другом, выноски справа;
     v2 · терраса: каждый слой выше и сдвинут вверх-вправо, лестница проверки, выноски слева;
     v3 · зиккурат: слои сужаются к решению, выноски по обе стороны. */
(function () {
  'use strict';
  const V = window.RELIEF_VARIANT || 'v1';
  const D = window.RELIEF_DATA;
  const { clamp, D2R, TAU, css } = RL;
  const Z = { z0: 0, z1: 4, z2: 12, z3: 28 };
  // ELEVATION (L5): данные z1, знания и правила z2, решение z3; разнос добавляет высоту по порядку слоя
  const ELEVATION = { data: 'z1', knowledge: 'z1', rules: 'z2', decision: 'z3', callouts: 'z0' };
  window.RELIEF_ELEVATION = ELEVATION;

  const SP = window.RELIEF_PARAMS.scene, VARIANTS = SP.variants;
  const VC = VARIANTS[V] || VARIANTS.v1;

  const dec = D.decisions.filter((d) => d.id === D.focus.decision)[0] || D.decisions[0];
  const C = D.meta.counts;

  function layersOf(P) {
    const all = [
      { key: 'data', name: 'Data', head: C.loans + ' loans · ' + C.borrowers + ' borrowers · ' + C.collateral + ' collateral', sub: 'From source systems, as received' },
      { key: 'knowledge', name: 'Knowledge', head: D.ontology.classes.length + ' classes · ' + D.ontology.relations.length + ' relations', sub: 'What the data means and how it links' },
      { key: 'rules', name: 'Rules', head: D.rules.length + ' rules · ' + D.covenants.length + ' covenants', sub: 'Checks that run before any action' },
      { key: 'decision', name: 'Decision', head: dec.id + ' · ' + dec.status, sub: dec.action }
    ];
    return P.layers >= 4 ? all : [all[0], all[2], all[3]];
  }

  // ── раскладка (L12): чистая функция (data, rect, P) → слои в мире и выноски ─
  function layout(ctx) {
    const P = ctx.P, W = ctx.W, H = ctx.H;
    const S = clamp(Math.min(W / 1440, H / 900), 0.34, 1.6), u = Math.min(W, H) / 48;
    const m = 0.06 * Math.min(W, H);
    const rect = { x: m, y: m + 64 * S, w: W - 2 * m, h: H - 2 * m - 96 * S };
    const Ls = layersOf(P), n = Ls.length;
    const tilt = clamp(P.tilt, 0, 60) * D2R, cos = Math.cos(tilt), sin = Math.sin(tilt);
    const zs = P.zscale * S;
    // разнос: подъём по порядку слоя, шаг от высоты поля, чтобы стопка читалась при любом наклоне
    // разнос: шаг подъёма в долях «расстояния без нахлёста» d·cos τ / sin τ; 0 = слои сложены, 0,55 ≈ встык, 1 = с воздухом.
    // Размер слоя подбирается так, чтобы стопка при разносе до 0,55 влезала в поле по высоте
    const sinS = Math.max(0.2, sin), kExp = (e) => 0.25 + 1.4 * e;
    const colW = 320 * S;                                    // коридор выносок
    const cfg = V === 'v2' ? { aspect: 0.56, sx: 0.24, sy: 0.34, k: 0.6, shrink: 1, wMax: (rect.w - colW) * 0.50 }
      : V === 'v3' ? { aspect: 0.62, sx: 0, sy: 0, k: 1, shrink: 0.80, wMax: rect.w * 0.44 }
      : { aspect: 0.56, sx: 0, sy: 0, k: 1, shrink: 1, wMax: (rect.w - colW) * 0.72 };
    const e0 = Math.max(P.explode, 0.55);
    const fd = Math.min(rect.h / (cos * (1 + (n - 1) * (kExp(e0) * cfg.k + cfg.sy)) + 0.001), cfg.wMax * cfg.aspect);
    const fw = fd / cfg.aspect, shrink = cfg.shrink;
    const step = fd * cos / sinS * kExp(P.explode) * cfg.k;
    const shiftX = fw * cfg.sx, shiftY = -fd * cfg.sy;
    const cx = V === 'v2' ? rect.x + colW + (rect.w - colW) / 2 - shiftX * (n - 1) / 2
      : V === 'v3' ? rect.x + rect.w / 2 : rect.x + (rect.w - colW) / 2;
    const plates = Ls.map((l, i) => {
      const k = Math.pow(shrink, i);
      const h = Z[ELEVATION[l.key]] * zs + i * step;
      const hl = (Z[ELEVATION[l.key]] + i * 4 * P.explode) * zs;     // свет по лестнице z1–z3 (+ малый разнос, чтобы равные уровни не слипались)
      return Object.assign({}, l, { i, hl, kind: 'rect', x: cx + shiftX * i, y: shiftY * i, w: fw * k, d: fd * k, h, rad: 0, thick: 3 + (V === 'v3' ? 2 : 0) });
    });
    // экранная высота фигуры → вертикальная центровка через y0 камеры
    let top = 1e9, bot = -1e9;
    plates.forEach((p) => {
      [-1, 1].forEach((sy) => { const yy = (p.y + sy * p.d / 2) * cos - p.h * sin; top = Math.min(top, yy); bot = Math.max(bot, yy); });
    });
    const offY = rect.y + rect.h / 2 - (top + bot) / 2;
    const cam = { cos, sin, tilt, y0: 0 };
    plates.forEach((p) => { p.y += offY / cos; });
    // камера: y0 = 0, мир сдвинут так, что фигура по центру поля
    return { S, u, m, rect, plates, cam, n, colW, fw, fd };
  }

  // ── печать на слоях (мир, под проекцией плоскости) ────────────────────
  function printLayer(g, L, p, P, ink, accent, S) {
    const x0 = p.x - p.w / 2, y0 = p.y - p.d / 2, pad = Math.max(10, 18 * S * Math.sqrt(p.w / (520 * S)));
    const t1 = Math.max(11.67, 11.67 * S * 1.15);
    RL.text(g, p.name, x0 + pad, y0 + pad + t1 * 0.8, { size: t1, caps: true, weight: 500, color: css(ink.ink3) });
    const ax = x0 + pad, ay = y0 + pad * 1.6 + t1, aw = p.w - 2 * pad, ah = p.d - pad * 2.6 - t1;
    p.anchors = [];
    if (p.key === 'data') {
      // 240 займов точками печати: сетка 24 × 10, каждая точка = один займ
      const cols = 24, rows = Math.ceil(C.loans / cols), sx = aw / cols, sy = ah / rows, r = Math.max(1.1, Math.min(sx, sy) * 0.18);
      g.fillStyle = css(ink.ink2, 0.8);
      for (let i = 0; i < C.loans; i++) { const c = i % cols, rr = (i / cols) | 0; g.beginPath(); g.arc(ax + (c + 0.5) * sx, ay + (rr + 0.5) * sy, r, 0, TAU); g.fill(); }
      p.anchors.push({ x: ax + aw, y: ay + ah * 0.5, text: p.head, sub: p.sub, main: true });
    } else if (p.key === 'knowledge') {
      // онтология: классы по эллипсу, связи рельефом (структура вырезана)
      const cl = D.ontology.classes, pos = {};
      cl.forEach((c, i) => { const a = -Math.PI / 2 + i / cl.length * TAU; pos[c] = [ax + aw / 2 + Math.cos(a) * aw * 0.36, ay + ah / 2 + Math.sin(a) * ah * 0.40]; });
      D.ontology.relations.forEach((r) => {
        const a = pos[r[0]], b = pos[r[2]]; if (!a || !b) return;
        RL.relief(g, L, (ox, oy) => { g.beginPath(); g.moveTo(a[0] + ox, a[1] + oy); g.quadraticCurveTo((a[0] + b[0]) / 2 + (ax + aw / 2 - (a[0] + b[0]) / 2) * 0.35 + ox, (a[1] + b[1]) / 2 + (ay + ah / 2 - (a[1] + b[1]) / 2) * 0.35 + oy, b[0] + ox, b[1] + oy); });
      });
      cl.forEach((c) => { const q = pos[c]; g.fillStyle = css(ink.ink2); g.beginPath(); g.arc(q[0], q[1], Math.max(2, 3 * S), 0, TAU); g.fill(); });
      if (aw > 220) ['Loan', 'Borrower', 'Rule'].forEach((c) => { const q = pos[c]; if (q) RL.text(g, c, q[0] + 6 * S, q[1] - 5 * S, { size: t1, color: css(ink.ink2) }); });
      p.anchors.push({ x: ax + aw, y: ay + ah * 0.45, text: p.head, sub: p.sub, main: true });
    } else if (p.key === 'rules') {
      const rows = D.rules, rh = ah / rows.length;
      rows.forEach((r, i) => {
        const yy = ay + rh * (i + 0.62);
        if (rh >= t1 * 1.2) RL.text(g, r.id, ax, yy, { size: t1, mono: true, weight: 500, color: css(ink.ink) });
        const bx = rh >= t1 * 1.2 ? ax + 64 * S : ax, bw = Math.max(10, aw - (bx - ax) - 6 * S);
        RL.relief(g, L, (ox, oy) => { g.beginPath(); g.moveTo(bx + ox, yy - t1 * 0.32 + oy); g.lineTo(bx + bw * (0.45 + 0.1 * i) + ox, yy - t1 * 0.32 + oy); });
        p.anchors.push({ x: ax + aw, y: yy - t1 * 0.3, text: r.id, sub: r.text, main: false, rule: r.id });
      });
      p.anchors.unshift({ x: ax + aw, y: ay - pad * 0.4, text: p.head, sub: p.sub, main: true });
    } else {
      const big = Math.max(16.8, 24.19 * S);
      RL.text(g, dec.id, ax, ay + big * 0.9, { size: big, weight: 500, color: css(ink.ink) });
      const st = dec.status === 'blocked' ? 'Blocked' : 'Allowed';
      g.fillStyle = css(accent); g.beginPath(); g.arc(ax + 5 * S, ay + big * 1.55 + t1 * 0.1, Math.max(3, 4 * S), 0, TAU); g.fill();
      RL.text(g, RL.fit(g, st + ' · ' + dec.action, { size: t1, mono: true }, aw - 14 * S), ax + 14 * S, ay + big * 1.55 + t1 * 0.4, { size: t1, mono: true, color: css(ink.ink2) });
      const ch = dec.checks; let yy = ay + big * 1.55 + t1 * 2.2;
      ch.forEach((c) => {
        const ok = c.result === 'pass';
        RL.text(g, RL.fit(g, (ok ? '✓ ' : '× ') + c.ref + ' · ' + c.result, { size: t1, mono: true }, aw), ax, yy, { size: t1, mono: true, color: css(ok ? ink.ink3 : ink.ink) });
        yy += t1 * 1.45;
      });
      p.anchors.push({ x: ax + aw, y: ay + big * 0.6, text: p.name + ' · ' + dec.id, sub: st + ': ' + ch.filter((c) => c.result !== 'pass').map((c) => c.ref + ' ' + c.result).join(', '), main: true, accent: true });
    }
    p.anchors.forEach((a) => { a.lxw = ax; });
  }

  // ── выноски §7.6 D ────────────────────────────────────────────────────
  function callouts(g, L, ctx, Lay, live, ink, accent) {
    const S = Lay.S, cam = Lay.cam, t1 = Math.max(11.67, 11.67 * S * 1.15), t2 = Math.max(12.5, 14 * S);
    // источники: якоря печати каждого слоя, переведённые на экран (проекция плоскости + плавание)
    const src = [];
    Lay.plates.forEach((p) => {
      const q = live.get(p.key);
      (p.anchors || []).forEach((a, k) => {
        const s = RL.project(cam, a.x + q.dx, a.y + q.dy, q.h);
        const sl = RL.project(cam, a.lxw + q.dx, a.y + q.dy, q.h);
        src.push(Object.assign({ sx: s[0], sy: s[1], lx: sl[0], layer: p.i, k }, a));
      });
    });
    // габарит фигуры на экране
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    Lay.plates.forEach((p) => {
      const q = live.get(p.key);
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach((c) => { const s = RL.project(cam, p.x + c[0] * p.w / 2 + q.dx, p.y + c[1] * p.d / 2 + q.dy, q.h); x0 = Math.min(x0, s[0]); x1 = Math.max(x1, s[0]); y0 = Math.min(y0, s[1]); y1 = Math.max(y1, s[1]); });
    });
    const side = (a, i) => V === 'v2' ? -1 : V === 'v3' ? (a.main ? (a.layer % 2 ? -1 : 1) : 1) : 1;
    const groups = { '1': [], '-1': [] };
    src.forEach((a, i) => { a.side = side(a, i); groups[a.side].push(a); });
    const gap = 28 * S, lineH = t2 * 1.25 + t1 * 1.3 + 10 * S, lineHs = t1 * 1.35 + 6 * S;
    const yTop = Lay.rect.y, yBot = Lay.rect.y + Lay.rect.h;
    Object.keys(groups).forEach((sk) => {
      const sd = +sk, arr = groups[sk].sort((a, b) => a.sy - b.sy);
      if (!arr.length) return;
      const cx = sd > 0 ? x1 + gap : x0 - gap;
      // ряды: высота по виду, сдвиг вниз при тесноте, затем вверх при выходе за низ
      let y = -1e9; arr.forEach((a) => { a.h = a.main ? lineH : lineHs; a.ly = Math.max(a.sy - (a.main ? t2 * 0.9 : t1 * 0.4), y); y = a.ly + a.h; });
      let over = 0;
      const last = arr[arr.length - 1];
      if (last.ly + last.h > yBot) {
        const sh = Math.min(last.ly + last.h - yBot, Math.max(0, arr[0].ly - yTop));
        arr.forEach((a) => { a.ly -= sh; });
      }
      // переполнение: что не поместилось в коридор, честно «+N»
      // узкий кадр: вторичные выноски (строки правил) уходят в «+N», главные остаются
      const keep = arr.filter((a) => a.ly >= yTop - 1 && a.ly + a.h <= yBot + 1 && (a.main || ctx.W >= 600));
      over = arr.length - keep.length;
      if (!ctx.P.callouts) return;
      keep.forEach((a) => {
        const lx = cx + sd * (a.main ? 18 : 30) * S;
        const ex = cx, ey = a.ly + (a.main ? t2 * 0.85 : t1 * 0.75) - t1 * 0.35;
        const fromX = sd > 0 ? a.sx : a.lx;
        g.save(); g.lineWidth = L.lineW; g.lineCap = 'round'; g.lineJoin = 'round';
        g.strokeStyle = css(ink.ink2, a.main ? 0.75 : 0.45);
        g.beginPath(); g.moveTo(fromX + sd * 4 * S, a.sy); g.lineTo(ex, ey); g.lineTo(lx - sd * 6 * S, ey); g.stroke();
        g.fillStyle = css(a.accent ? accent : ink.ink2); g.beginPath(); g.arc(fromX, a.sy, Math.max(2, 2.5 * S), 0, TAU); g.fill();
        g.restore();
        const al = sd > 0 ? 'left' : 'right';
        const room = sd > 0 ? ctx.W - Lay.m * 0.5 - lx : lx - Lay.m * 0.5;
        if (a.main) {
          const o1 = { size: t2, weight: 500 }, o2 = { size: t1, mono: true };
          RL.text(g, RL.fit(g, a.text, o1, room), lx, a.ly + t2 * 0.85 + 2 * S, Object.assign({ align: al, color: css(ink.ink) }, o1));
          RL.text(g, RL.fit(g, a.sub, o2, room), lx, a.ly + t2 * 0.85 + t1 * 1.35 + 4 * S, Object.assign({ align: al, color: css(ink.ink3) }, o2));
        } else {
          const o2 = { size: t1, mono: true };
          RL.text(g, RL.fit(g, a.text + '  ' + a.sub, o2, room), lx, a.ly + t1 * 0.75, Object.assign({ align: al, color: css(ink.ink3) }, o2));
        }
      });
      if (over > 0) {
        const lastK = keep[keep.length - 1], yy = lastK ? lastK.ly + lastK.h + t1 : yBot - t1;
        RL.text(g, '+' + over + ' more', cx + sd * 30 * S, Math.min(yBot, yy), { size: t1, mono: true, align: sd > 0 ? 'left' : 'right', color: css(ink.ink3) });
      }
    });
  }

  let CACHE = null;
  function draw(ctx) {
    const g = ctx.g, P = ctx.P;
    const ph = RL.phases(ctx, 4);
    const key = [ctx.W, ctx.H, P.layers, P.tilt, P.explode, P.zscale].join('|');
    if (!CACHE || CACHE.key !== key) { CACHE = layout(ctx); CACHE.key = key; }
    const Lay = CACHE, S = Lay.S;
    const T = RL.tokens(ctx.theme), ink = T, accent = T.acc[P.accent] || T.acc.terracotta;
    const tEnd = RL.assembleEnd(ctx, Lay.n);
    // живые слои: сборка снизу вверх, плавание; решение проверено и оседает после сборки
    const live = new Map();
    Lay.plates.forEach((p, k) => {
      const env = p.key === 'decision' ? RL.settle(ctx, tEnd + 0.6) : (ctx.reduced ? 0 : 1);
      const f = RL.float(ctx, ph[k], Math.min(p.w, p.d), p.h, env);
      const up = RL.assemble(ctx, k);
      const fdh = RL.float(ctx, ph[k], Math.min(p.w, p.d), p.hl, env).dh;
      live.set(p.key, { dx: f.dx, dy: f.dy, rot: f.rot, h: Math.max(0, p.h * up), hl: Math.max(0, (p.hl + fdh) * up) });
    });
    const plates = Lay.plates.map((p) => {
      const q = live.get(p.key);
      return {
        id: p.i, kind: 'rect', x: p.x + q.dx, y: p.y + q.dy, w: p.w, d: p.d, rad: P.radius * S, rot: q.rot * 0.5, h: q.h, hl: q.hl, thick: p.thick, flatPlate: true,
        print: (gg, L) => { gg.translate(q.dx, q.dy); printLayer(gg, L, p, P, ink, accent, S); }
      };
    });
    const floor = (gg, L) => {
      // опорный крест на полу: ось стопки рельефом (структура), без декоративной сетки
      const b = Lay.plates[0];
      gg.save(); RL.onPlane(gg, Lay.cam, 0);
      RL.relief(gg, L, (ox, oy) => { gg.beginPath(); gg.moveTo(b.x - b.w * 0.62 + ox, b.y + b.d * 0.62 + oy); gg.lineTo(b.x + b.w * 0.62 + ox, b.y + b.d * 0.62 + oy); });
      gg.restore();
      chrome(gg, L, ctx, Lay);
    };
    const over = (gg, L) => {
      callouts(gg, L, ctx, Lay, live, ink, accent);
      if (P.hand) {
        const d = Lay.plates[Lay.n - 1], q = live.get('decision'), s = RL.project(Lay.cam, d.x - d.w * 0.25 + q.dx, d.y - d.d * 0.12 + q.dy, q.h);
        RL.handRing(gg, L, s[0], s[1], d.w * 0.2, d.d * 0.16 * Lay.cam.cos, ctx.randPal);
      }
    };
    RL.render(ctx, { plates, floor, over, cam: Lay.cam });
  }

  function chrome(g, L, ctx, Lay) {
    const m = Lay.m, S = Lay.S;
    const t1 = Math.max(11.67, 11.67 * Math.min(1.2, S * 1.2)), t3 = Math.max(14, 16.8 * Math.min(1.2, S * 1.2));
    RL.text(g, RL.fit(g, 'Model of record: one company, four layers', { size: t3, weight: 500 }, ctx.W - 2 * m), m, m + t3 * 0.4, { size: t3, weight: 500, color: css(L.T.ink) });
    RL.text(g, RL.fit(g, 'Data is lifted into meaning, meaning into rules, rules into one decision', { size: t1, mono: true }, ctx.W - 2 * m), m, m + t3 * 0.4 + t1 * 1.6, { size: t1, mono: true, color: css(L.T.ink3) });
    RL.text(g, 'Height = how far a layer is verified', m, ctx.H - m, { size: t1, mono: true, color: css(L.T.ink3) });
    // узкий кадр: строка о данных уходит под заголовок, чтобы не встретиться с легендой
    if (ctx.W < 600) RL.text(g, 'Fictional data', m, m + t3 * 0.4 + t1 * 3.1, { size: t1, mono: true, color: css(L.T.ink3) });
    else RL.text(g, 'Fictional data', ctx.W - m, ctx.H - m, { size: t1, mono: true, align: 'right', color: css(L.T.ink3) });
  }

  RL.boot({
    variant: V,
    head: { title: VC.title, sub: VC.sub },
    values: VC.values,
    scene: {
      id: 'stack',
      title: 'Stack · ' + V,
      blurb: SP.blurb,
      draw,
      structural: function () { CACHE = null; }
    },
    groups: SP.groups
  });
})();
