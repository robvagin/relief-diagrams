// gate-common.js — общее у трёх вариантов сцены gate (README §6.1, §7.8):
// модель решения из data/portfolio.json, расписание цикла, стопка плашек с окнами,
// выравнивание окон по свету, путь проверок (по образцу ccc-pipeline: упорядоченные шаги +
// рёбра, бегущий пунктир на активном ребре, шеврон; пошаговое зажигание дописано здесь).
(function () {
  'use strict';
  const RL = window.RL, G = window.GATE = {};
  const clamp = RL.clamp, mix = RL.mix, TAU = RL.TAU;

  // ── ручки сцены §6.10 ─────────────────────────────────────────────────────
  G.rows = {
    scene: [RL.C('state', 'Состояние', ['instruction', 'blocked', 'allowed', 'loop'], 'loop', ['Инструкция', 'Блок', 'Пропуск', 'Цикл'])],
    rhythm: [RL.N('plates', 'Слоёв', 2, 4, 1, 3), RL.N('gap', 'Шаг слоёв', 6, 60, 1, 22), RL.N('aperture', 'Окно', 0.04, 0.3, 0.005, 0.12)],
    data: [RL.C('decision', 'Решение', ['D-7781', 'D-7782', 'D-7790', 'D-7804'], 'D-7781'), RL.N('trace', 'Протокол', 0, 1, 1, 1)]
  };

  const money = (v) => '€' + String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  G.money = money;
  const KIND_ORDER = { action: 0, evidence: 1, approval: 2, rule: 3 };
  function layerLabel(k, c, dec) {
    if (k === 'action') return /payment/i.test(dec.action) ? 'Payment' : /purchase/i.test(dec.action) ? 'Purchase' : /sale/i.test(dec.action) ? 'Sale' : 'Action';
    if (k === 'evidence') return /^contract/i.test(c.ref) ? 'Contract' : c.ref.split(' ')[0];
    if (k === 'approval') return 'Approval';
    return 'Rule';
  }
  // модель решения: слои = действие + проверки; упорядочены Payment · Contract · Approval · Rule
  G.model = function (data, id, n) {
    const decs = data.decisions, dec = decs.filter((d) => d.id === id)[0] || decs[0];
    const rule = (ref) => (data.rules || []).filter((r) => r.id === ref)[0];
    let layers = [{ kind: 'action', label: layerLabel('action', null, dec), ref: dec.amount ? money(dec.amount) : dec.loan,
      input: dec.action, result: 'pass', ok: true }];
    dec.checks.forEach(function (c) {
      const bad = c.result === 'fail' || c.result === 'missing';
      const lab = layerLabel(c.kind, c, dec);
      layers.push({ kind: c.kind, label: lab, ref: c.ref.indexOf(lab) === 0 && c.ref.length > lab.length ? c.ref.slice(lab.length).trim() : c.ref, full: c.ref, input: c.input, result: c.result, ok: !bad,
        text: c.kind === 'rule' && rule(c.ref) ? rule(c.ref).text : null });
    });
    layers.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
    n = clamp(Math.round(n), 2, 4);
    let use = layers.slice(0, n);
    const fail = layers.filter((l) => !l.ok)[0];
    if (fail && use.indexOf(fail) < 0) use[use.length - 1] = fail;
    use.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
    const pair = decs.filter((d) => d !== dec && d.loan === dec.loan && d.action === dec.action)[0] || null;
    const ruleRef = dec.checks.filter((c) => c.kind === 'rule')[0];
    return { dec: dec, layers: use, all: layers, failIdx: use.indexOf(fail), pair: pair,
      rule: ruleRef && rule(ruleRef.ref) ? rule(ruleRef.ref) : (data.rules || [])[0] };
  };
  // какое решение показывает состояние: blocked и allowed берут пару решения по тому же платежу
  G.pick = function (data, P) {
    const base = G.model(data, P.decision, P.plates);
    const pair = base.pair;
    if (P.state === 'blocked' && base.dec.status === 'allowed' && pair && pair.status === 'blocked') return G.model(data, pair.id, P.plates);
    if (P.state === 'allowed' && base.dec.status === 'blocked' && pair && pair.status === 'allowed') return G.model(data, pair.id, P.plates);
    return base;
  };

  // ── расписание (§7.8 loop): инструкция 2 с → сборка по одной → блок 2.5 с → доезд пружиной 0.6 с
  //    → пятно 420 мс → покой 3 с → обратно. Чистая функция времени: детерминирована кадром
  G.timeline = function (P, M, tsec, reduced, p) {
    const n = M.layers.length, fail = M.failIdx >= 0, canFix = fail && M.pair && M.pair.status === 'allowed';
    const STEP = 0.5, T0 = 2, tA = T0 + n * STEP + 0.3;
    let tB = tA, tFix = tA, tLit = tA;
    if (fail) { tB = tA + 2.5; tFix = tB; tLit = canFix ? tFix + 0.6 : Infinity; }
    const tRest = (canFix || !fail ? tLit + 0.42 : tB + 1.5) + 3, cycle = tRest + 0.8;
    const st = { n: n, cycle: cycle, appear: [], shift: 0, lit: 0, checks: 0, leave: 0, mode: 'assembled', fixed: false, landed: [] };
    let t;
    if (P.state === 'loop') {
      if (reduced) t = canFix || !fail ? tRest - 0.01 : tB - 0.01;
      else if (p != null) t = p * cycle;
      else t = ((tsec % cycle) + cycle) % cycle;
    } else if (P.state === 'instruction') {
      st.mode = 'instruction'; for (let i = 0; i < n; i++) { st.appear.push(0); st.landed.push(-1); }
      return st;
    } else {
      // статичные состояния: собрано, окна как в данных (blocked сдвинут, allowed совпало)
      for (let i = 0; i < n; i++) { st.appear.push(1); st.landed.push(1e9); }
      st.checks = n; st.mode = fail ? 'blocked' : 'allowed';
      st.shift = fail ? 1 : 0; st.lit = fail ? 0 : 1; st.fixed = !fail;
      return st;
    }
    st.t = t;
    if (t < T0) st.mode = 'instruction';
    else if (t < tA) st.mode = 'assemble';
    else if (fail && t < tFix + (canFix ? 0.6 : 99)) st.mode = 'blocked';
    else st.mode = 'allowed';
    for (let i = 0; i < n; i++) {
      const s0 = T0 + i * STEP;
      st.appear.push(P.assemble ? RL.ease((t - s0) / 0.52) : (t >= T0 ? 1 : 0));
      st.landed.push(t - (s0 + 0.52));               // > 0: плашка легла, секунд назад
    }
    st.checks = clamp((t - T0) / STEP, 0, n);
    if (fail) {
      st.shift = 1;
      if (canFix && t >= tFix) { st.shift = 1 - RL.spring(t - tFix); st.fixed = t >= tFix + 0.3; }
      if (!canFix) st.shift = 1;
    }
    st.lit = (canFix || !fail) ? clamp((t - tLit) / 0.42, 0, 1) : 0;
    st.sinceLit = t - tLit;
    st.sinceFix = t - tFix;
    st.leave = clamp((t - tRest) / 0.8, 0, 1);
    if (st.leave > 0) st.appear = st.appear.map((a) => a * (1 - RL.ease(st.leave)));
    if (t >= tRest + 0.8) st.mode = 'instruction';
    st.canFix = canFix;
    return st;
  };

  // ── выравнивание окон по свету: след окна F_i = A_i + o(h_i) попадает в точку S ──
  G.alignAt = function (L, S, h) {
    if (L.lamp) { const k = h / Math.max(1, L.LH - h); return [(S[0] + L.Lx * k) / (1 + k), (S[1] + L.Ly * k) / (1 + k)]; }
    return [S[0] - h * L.cot * L.dx, S[1] - h * L.cot * L.dy];
  };
  // доля совпадения: площадь пересечения всех следов / площадь окна (§7.8, порог 60 %)
  G.overlap = function (L, plates) {
    let x0 = -1e9, y0 = -1e9, x1 = 1e9, y1 = 1e9, area = 1;
    plates.forEach(function (p) {
      const hz = p.z + p.dz, ax = (p.ax != null ? p.ax : p.x + p.w / 2) + p.dx, ay = (p.ay != null ? p.ay : p.y + p.h / 2) + p.dy;
      const o = RL.offset(L, ax, ay, hz, hz), w = p.hole.w, h = p.hole.h;
      const fx = p.hole.x + p.dx + o[0], fy = p.hole.y + p.dy + o[1];
      x0 = Math.max(x0, fx); y0 = Math.max(y0, fy); x1 = Math.min(x1, fx + w); y1 = Math.min(y1, fy + h); area = w * h;
    });
    return Math.max(0, x1 - x0) * Math.max(0, y1 - y0) / area;
  };

  // ── стопка: плашки с окнами вокруг точки пятна S ──────────────────────────
  // o = {S:[x,y], pw, ph, fan:[fx,fy] (шаг плашки на уровень), rel:[rx,ry] (окно внутри нижней плашки 0..1)}
  G.stack = function (ctx, R, M, st, o) {
    const P = ctx.P, U = R.U, L = R.L, n = M.layers.length, tsec = R.t;
    const gap = P.gap * U.ui * P.zscale, win = clamp(P.aperture, 0.02, 0.6) * o.pw, rad = P.radius * U.ui;
    const ph = RL.phases(ctx, n), plates = [];
    // направление сдвига блокирующей плашки: поперёк света
    const sx = L.dy, sy = -L.dx;
    // якорь: нижняя плашка стоит на месте (o.B), точка пятна S выводится из её окна и света
    if (o.B) {
      const a0 = [o.B[0] + o.rel[0] * o.pw, o.B[1] + o.rel[1] * o.ph], h0 = gap;
      if (L.lamp) { const k = h0 / Math.max(1, L.LH - h0); o.S = [a0[0] + (a0[0] - L.Lx) * k, a0[1] + (a0[1] - L.Ly) * k]; }
      else o.S = [a0[0] + h0 * L.cot * L.dx, a0[1] + h0 * L.cot * L.dy];
    }
    for (let i = 0; i < n; i++) {
      const lay = M.layers[i], h = (i + 1) * gap;
      const a = G.alignAt(L, o.S, h);
      // окно в плашке: rel нижней плашки, выше по уровню смещается против веера
      const rx = o.rel[0] * o.pw - i * o.fan[0], ry = o.rel[1] * o.ph - i * o.fan[1];
      let px = a[0] - rx, py = a[1] - ry;
      const failing = i === M.failIdx;
      const sh = failing ? st.shift * 1.2 * win : 0;
      px += sx * sh; py += sy * sh;
      const ap = st.appear[i];
      if (ap <= 0.001) continue;
      // сборка: плашка опускается сверху на своё место, тень растёт сама вместе с высотой
      const hz = h + (1 - ap) * 3 * gap;
      const verified = lay.ok ? st.landed[i] : (st.fixed ? st.sinceFix - 0.3 : -1);
      const env = ctx.reduced ? 0 : (verified > 0 ? RL.settleEnv(P, verified) : 1);
      const f = RL.float(P, tsec, ph[i], o.pw, o.ph, hz, env);
      const shape = { k: 'rr', x: px, y: py, w: o.pw, h: o.ph, r: rad };
      const hole = { k: 'rr', x: px + rx - win / 2, y: py + ry - win / 2, w: win, h: win, r: Math.min(rad, win * 0.18) };
      plates.push(RL.plate({ id: 'L' + i, shape: shape, hole: hole, z: hz, dx: f.dx, dy: f.dy, rot: f.rot, dz: f.dh,
        ax: px + rx + sx * 0, ay: py + ry, alpha: Math.min(1, ap * 1.4), layer: lay, idx: i, failing: failing,
        win: win, rx: rx, ry: ry }));
    }
    return { plates: plates, win: win, gap: gap, S: o.S };
  };

  // ── печать на плашке: подпись слоя, ссылка, метка окна ────────────────────
  G.printLayer = function (g, p, R, st, o) {
    o = o || {};
    const T = R.T, U = R.U, lay = p.layer, pad = Math.max(8, 10 * U.ui);
    const x = p.x + p.dx + (o.labelX != null ? o.labelX : pad), y = p.y + p.dy + p.h - pad;
    const bad = p.failing && st.shift > 0.02 && !st.fixed;
    RL.text(g, R, lay.label, x, y - RL.fs(R, 't1') * 1.35, { size: 't2', weight: 500, color: RL.css(T.ink) });
    RL.text(g, R, lay.ref, x, y, { size: 't1', mono: true, color: RL.css(bad ? T.accent : T.ink3) });
    if (bad) {   // блок: метка акцентом у окна слабейшей плашки
      const hx = p.hole.x + p.dx, hy = p.hole.y + p.dy, s = p.hole.w;
      g.lineWidth = U.lineW; g.strokeStyle = RL.css(T.accent);
      g.beginPath(); g.moveTo(hx - 4, hy + s + 4); g.lineTo(hx + s + 4, hy - 4); g.stroke();
    }
  };

  // ── путь проверок (ccc-pipeline: шаги + рёбра; здесь зажигание по одному) ──
  // nodes: [{x,y,title,sub,state:'pending'|'active'|'pass'|'fail'}]
  G.steps = function (M, st, show) {
    const out = [{ title: 'Request', sub: M.dec.action, state: 'pass' }];
    M.layers.slice(1).forEach(function (l, i) {
      const k = st.checks - (i + 1);
      let s = k >= 1 ? (l.ok || st.fixed ? 'pass' : 'fail') : k > 0 ? 'active' : 'pending';
      out.push({ title: l.full || l.ref, sub: l.input + ' · ' + (l.ok || st.fixed ? (l.result === 'needs approval' ? 'needs approval' : 'pass') : l.result), state: s, layer: l });
    });
    const fail = M.failIdx >= 0 && !st.fixed, done = st.checks >= M.layers.length;
    out.push({ title: done ? (fail ? 'Blocked' : 'Allowed') : 'Decision', sub: done ? (fail ? (st.canFix === false && M.failIdx >= 0 ? M.layers[M.failIdx].label + ' · ' + M.layers[M.failIdx].result : 'Director approval · missing') : '') : '…',
      state: done ? (fail ? 'fail' : (st.lit > 0 ? 'pass' : 'active')) : 'pending', decision: true });
    return out;
  };
  G.drawPath = function (g, R, nodes, tsec, o) {
    o = o || {};
    const T = R.T, U = R.U, r = Math.max(3.5, 5 * U.ui), lw = U.lineW;
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i], b = nodes[i + 1], live = b.state !== 'pending';
      const path = (gg) => {
        const dx = b.x - a.x, dy = b.y - a.y, c = 0.35;
        // кривизна одним c на сцену (§7.9), зазор у узла 3 px
        const ux = dx / (Math.hypot(dx, dy) || 1), uy = dy / (Math.hypot(dx, dy) || 1), gp = r + 3;
        gg.moveTo(a.x + ux * gp, a.y + uy * gp);
        if (o.curve) gg.bezierCurveTo(a.x + dx * c, a.y + dy * 0, b.x - dx * c, b.y - dy * 0, b.x - ux * gp, b.y - uy * gp);
        else gg.lineTo(b.x - ux * gp, b.y - uy * gp);
      };
      RL.relief(g, R, path, live ? 1 : 0.6);
      if (b.state === 'active') RL.inkLine(g, R, path, { dash: [4 * U.ui, 4 * U.ui], offset: -tsec * 18 * U.ui, alpha: 0.8 });
      else if (live) RL.inkLine(g, R, path, { alpha: 0.55 });
    }
    nodes.forEach(function (nd) {
      const ink = RL.css(T.ink), faint = RL.css(T.ink3, 0.55);
      g.lineWidth = lw;
      if (nd.state === 'pass') RL.dot(g, nd.x, nd.y, r, nd.decision ? RL.css(T.accent) : ink);
      else if (nd.state === 'fail') { g.beginPath(); g.arc(nd.x, nd.y, r, 0, TAU); g.strokeStyle = RL.css(T.accent); g.stroke(); RL.dot(g, nd.x, nd.y, r * 0.45, RL.css(T.accent)); }
      else if (nd.state === 'active') { g.beginPath(); g.arc(nd.x, nd.y, r, 0, TAU); g.strokeStyle = ink; g.stroke(); }
      else { g.beginPath(); g.arc(nd.x, nd.y, r, 0, TAU); g.strokeStyle = faint; g.stroke(); }
      if (o.labels === false) return;
      const al = nd.state === 'pending' ? 0.45 : 1, side = o.side || 'right', tx = side === 'right' ? nd.x + r + 8 * U.ui : side === 'below' ? nd.x : nd.x - r - 8 * U.ui;
      const ty = side === 'below' ? nd.y + r + RL.fs(R, 't2') * 1.3 : nd.y - 2;
      const align = side === 'right' ? 'left' : side === 'below' ? 'center' : 'right';
      RL.text(g, R, nd.title, tx, ty, { size: 't2', weight: nd.decision ? 600 : 500, align: align, color: RL.css(T.ink, al) });
      if (nd.sub) {
        const so = { size: 't1', mono: true, align: align, color: RL.css(nd.state === 'fail' ? T.ink : T.ink3, al) };
        const subs = o.colW ? G.wrap(g, R, nd.sub, o.colW, so).slice(0, 3) : [nd.sub];
        subs.forEach((l, k) => RL.text(g, R, l, tx, ty + RL.fs(R, 't1') * (1.35 + 1.3 * k), so));
      }
    });
  };
  // протокол решения одной строкой (§7.8)
  G.protocol = function (M, st) {
    const d = M.dec;
    if (M.failIdx >= 0 && !st.fixed) {
      const f = M.layers[M.failIdx];
      return 'BLOCKED · ' + d.id + ' · ' + (f.kind === 'approval' ? 'Director approval · missing' : (f.full || f.ref) + ' · ' + f.result);
    }
    const D = st.fixed && M.failIdx >= 0 && M.pair ? M.pair : d;
    const parts = ['ALLOWED', D.id, d.amount ? 'Payment ' + money(d.amount) : d.action];
    D.checks.forEach(function (c) { parts.push((c.kind === 'approval' ? c.ref + ' ' + (c.input.match(/\d\d:\d\d/) || [''])[0] : c.ref).trim() + ' ✓'); });
    return parts.join(' · ');
  };
  // правило плоско на полу: «инструкция плоская» (Geist t5, чернила)
  G.ruleText = function (M) { return M.rule ? M.rule.text : ''; };
  G.wrapProto = function (g, R, str, maxW) {
    const parts = str.split(' · '), lines = []; let cur = '';
    parts.forEach(function (w) { const t = cur ? cur + ' · ' + w : w; if (RL.measure(g, R, t, { size: 't1', mono: true }) > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur);
    return lines;
  };
  // выделение: кольцо акцентом вокруг окна верхней плашки (слой взаимодействия §7.3 п.7)
  G.ring = function (g, R, p, k) {
    if (!p || k <= 0) return;
    const pad = 4 * R.U.ui, hx = p.hole.x + p.dx - pad, hy = p.hole.y + p.dy - pad, s = p.hole.w + pad * 2;
    g.save(); g.globalAlpha = k; g.lineWidth = R.U.lineW; g.strokeStyle = RL.css(R.T.accent);
    g.beginPath(); RL.shapePath(g, { k: 'rr', x: hx, y: hy, w: s, h: s, r: (p.hole.r || 0) + pad }, 0, 0); g.stroke(); g.restore();
  };
  G.wrap = function (g, R, str, maxW, o) {
    const words = String(str).split(' '), lines = []; let cur = '';
    words.forEach(function (w) { const t = cur ? cur + ' ' + w : w; if (RL.measure(g, R, t, o) > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur);
    return lines;
  };
})();
