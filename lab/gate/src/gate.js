/* gate.js · общее у трёх организмов сцены gate (приказ 3): проверка = ветка листов и дисков от запроса
   к решению. Пройденная проверка поднимает плашку (z1 → z2 с мягким горбом к z3), и она оседает (env → 0);
   блок = плашка ложится на пол плоско (z → 0, тени нет). Окон, дырок и вырезов нет ни в одной плашке.
   Расписание — чистая функция времени (детерминизм кадра), цикл замкнут: старт и конец на полу. */
(function () {
  'use strict';
  var R = window.RELIEF, G = R.gate = {};
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var sin2 = function (u) { u = clamp(u, 0, 1); var s = Math.sin(Math.PI * u); return s * s; };

  G.rows = {
    'Сцена': [['state', 'Состояние', ['instruction', 'blocked', 'allowed', 'loop'], 'loop', ['Инструкция', 'Блок', 'Пропуск', 'Цикл']]],
    'Ритм': [['plates', 'Проверок', 1, 3, 1, 3, 'Сколько проверок на ветке'], ['gap', 'Шаг ветки', 6, 60, 1, 22, 'Длина шага между проверками']],
    'Данные': [['decision', 'Решение', ['D-7781', 'D-7782', 'D-7790', 'D-7804'], 'D-7781'], ['trace', 'Протокол', 0, 1, 1, 1]]
  };

  var money = function (v) { return '€' + String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  G.money = money;
  var ORDER = { rule: 1, evidence: 2, approval: 3 };

  /* модель решения: запрос → проверки (правило · основание · согласование) → решение; лист и диск чередуются */
  G.model = function (data, id, nChecks) {
    var decs = data.decisions, dec = decs.filter(function (d) { return d.id === id; })[0] || decs[0];
    var pair = decs.filter(function (d) { return d !== dec && d.loan === dec.loan && d.action === dec.action; })[0] || null;
    var checks = dec.checks.slice().sort(function (a, b) { return ORDER[a.kind] - ORDER[b.kind]; });
    var bad = function (c) { return c.result === 'fail' || c.result === 'missing'; };
    var fail = checks.filter(bad)[0];
    checks = checks.slice(0, clamp(Math.round(nChecks || 3), 1, 3));
    if (fail && checks.indexOf(fail) < 0) checks[checks.length - 1] = fail;
    var steps = [{ id: 'req', role: 'request', title: dec.amount ? 'Release payment' : dec.action, sub: (dec.amount ? money(dec.amount) + ' · ' : '') + dec.id, ok: true }];
    checks.forEach(function (c, i) {
      var pc = pair && pair.checks.filter(function (q) { return q.ref === c.ref; })[0];
      steps.push({ id: 'c' + i, role: c.kind, title: c.ref, sub: c.input, result: c.result, ok: !bad(c),
        fixSub: pc ? pc.input : null, rule: c.kind === 'rule' ? (data.rules || []).filter(function (r) { return r.id === c.ref; })[0] : null });
    });
    steps.push({ id: 'dec', role: 'decision', title: dec.status === 'allowed' ? 'Allowed' : 'Blocked', sub: dec.id, ok: dec.status === 'allowed' });
    steps.forEach(function (s, i) { s.kind = (s.role === 'decision' || i % 2) ? 'disc' : 'sheet'; s.i = i; });
    var fi = -1; steps.forEach(function (s, i) { if (!s.ok && s.role !== 'decision' && fi < 0) fi = i; });
    var canFix = fi >= 0 && pair && pair.status === 'allowed';
    var rule = dec.checks.filter(function (c) { return c.kind === 'rule'; })[0];
    return { dec: dec, pair: pair, steps: steps, fail: fi, canFix: !!canFix,
      rule: rule ? (data.rules || []).filter(function (r) { return r.id === rule.ref; })[0] : (data.rules || [])[0] };
  };
  /* состояние «блок» и «пропуск» берут пару решения по тому же платежу (D-7781 ↔ D-7782) */
  G.pick = function (data, P) {
    var M = G.model(data, P.decision, P.plates), pr = M.pair;
    if (P.state === 'blocked' && M.dec.status === 'allowed' && pr && pr.status === 'blocked') return G.model(data, pr.id, P.plates);
    if (P.state === 'allowed' && M.dec.status === 'blocked' && pr && pr.status === 'allowed') return G.model(data, pr.id, P.plates);
    return M;
  };

  /* высота в уровнях лестницы (0…3, дробная) → px */
  G.zpx = function (lv, P, ui) {
    var Z = R.Z, i = Math.floor(clamp(lv, 0, 2.999)), f = clamp(lv, 0, 3) - i;
    return (Z[i] + (Z[i + 1] - Z[i]) * f) * (P.zscale == null ? 1 : +P.zscale) * ui;
  };

  /* расписание цикла: каждая плашка → {lv, env, flat, st: pending|active|pass|fail}, плюс итог */
  G.track = function (P, M, tsec, still, p) {
    var n = M.steps.length, STEP = 1.15, T0 = 0.7;
    var times = [], t, cyc;
    for (var i = 0; i < n - 1; i++) times.push(T0 + i * STEP);
    var tf = M.fail >= 0 ? times[M.fail] : null;
    var tFix = tf != null && M.canFix ? times[n - 2] + 2.6 : null;
    var tDec = tFix != null ? tFix + 0.9 : (tf != null ? times[n - 2] + 1.0 : times[n - 2] + 1.0);
    var tRest = tDec + 3.2, tDown = tRest + 0.9;
    cyc = tDown + 1.4;
    var mode = P.state;
    if (mode === 'loop') {
      if (still) t = tRest - 0.01;
      else if (p != null) t = p * cyc;
      else t = ((tsec % cyc) + cyc) % cyc;
    }
    var out = [], allowed = false, blocked = false;
    for (var k = 0; k < n; k++) {
      var s = M.steps[k], isDec = s.role === 'decision', o = { lv: 1, env: 1, st: 'pending' };
      if (mode === 'instruction') { o.lv = 0; o.env = 0; o.st = 'pending'; }
      else if (mode === 'blocked' || mode === 'allowed') {
        var okNow = isDec ? (M.fail < 0 && M.dec.status === 'allowed') : s.ok;
        o.lv = okNow ? (isDec ? 3 : 2) : 0; o.env = 0; o.st = okNow ? 'pass' : 'fail';
      } else {
        var tv = isDec ? tDec : times[k];
        var rise = clamp(t / 0.6, 0, 1), base = rise * rise * (3 - 2 * rise);       // подъём с пола в начале круга
        var down = 1 - clamp((t - tRest) / 0.9, 0, 1); down = down * down * (3 - 2 * down); // уход на пол в конце
        if (t < tv) { o.lv = 1 * base; o.st = t > tv - STEP && k > 0 ? 'active' : 'pending'; o.env = 1; }
        else {
          var fixed = tFix != null && t >= tFix && k === M.fail;
          var good = isDec ? (M.fail < 0 ? M.dec.status === 'allowed' : (tFix != null)) : (s.ok || fixed);
          if (!isDec && !s.ok && !fixed) {                                            // блок: ложится плоско
            o.lv = 1 - R.motion.spring(0, 1, t - tv); o.env = 0; o.st = 'fail';
          } else if (isDec && !good) { o.lv = 1 - R.motion.spring(0, 1, t - tv); o.env = 0; o.st = 'fail'; }
          else {
            var t1 = fixed ? tFix : tv, from = fixed ? 0 : 1, top = isDec ? 3 : 2;
            o.lv = R.motion.spring(from, top, t1 > tv ? t - t1 : t - tv) + 0.8 * sin2((t - t1) / 0.9) * (isDec ? 0 : 1);
            o.env = R.motion.settle(t, t1 + 0.9, +P.settle || 0.9); o.st = 'pass';
          }
        }
        o.lv *= down;
        if (t >= tDown) { o.env = 0; }
        if (o.lv < 0.02) o.lv = 0;
      }
      o.flat = o.lv <= 0.001;
      out.push(o);
    }
    var d = out[n - 1];
    allowed = d.st === 'pass'; blocked = d.st === 'fail';
    return { steps: out, t: t, cycle: cyc, allowed: allowed, blocked: blocked, fixed: tFix != null && t >= tFix,
      done: mode !== 'loop' || t >= tDec };
  };

  /* подпись шага в текущем состоянии (после согласования берётся вход пары: approved 14:02) */
  G.sub = function (s, tr) { return tr.fixed && s.fixSub ? s.fixSub : s.sub; };
  G.title = function (M, s, tr) {
    if (s.role !== 'decision') return s.title;
    return tr.allowed ? 'Allowed' : tr.blocked ? 'Blocked' : 'Decision';
  };
  /* протокол одной строкой (§7.8) */
  G.protocol = function (M, tr) {
    var d = M.dec;
    if (tr.blocked) {
      var f = M.steps[M.fail];
      return 'BLOCKED · ' + d.id + ' · ' + (f ? (f.role === 'approval' ? 'Director approval · missing' : f.title + ' · ' + f.result) : '');
    }
    if (!tr.allowed) return '';
    var D = tr.fixed && M.pair ? M.pair : d, parts = ['ALLOWED', D.id, d.amount ? 'Payment ' + money(d.amount) : d.action];
    D.checks.forEach(function (c) { parts.push((c.kind === 'approval' ? c.ref + ' ' + ((c.input.match(/\d\d:\d\d/) || [''])[0]) : c.ref).trim() + ' ✓'); });
    return parts.join(' · ');
  };

  /* ступень кегля под узкий кадр: шкала рельса множит кегль на ui, на 390 px это 0,34 — текст поднимается на 1–2 ступени */
  G.lh = function (F, s) { return R.ink.SIZES[s] * F.ui * 1.3; };
  G.ts = function (F, s) { return F.ui < 0.5 ? s + 2 : F.ui < 0.72 ? s + 1 : s; };

  /* моно-строка в ширину: по ширине знака Geist Mono (0,6 кегля), хвост многоточием */
  G.fit = function (str, w, cw) { var n = Math.floor(w / cw); str = String(str); return str.length <= n ? str : str.slice(0, Math.max(1, n - 1)).trim() + '…'; };

  /* печать на листе: заголовок, моно-строка; провис бумаги — едва заметная тень вдоль середины */
  G.printSheet = function (g, s, F, step, tr, o) {
    o = o || {};
    var I = R.ink, w = s.w, h = s.h, pad = Math.max(8, 11 * F.ui), al = o.alpha == null ? 1 : o.alpha;
    g.save(); g.translate(s.x, s.y); g.rotate(s.rot || 0);
    var gr = g.createLinearGradient(0, -h / 2, 0, h / 2), sh = R.color.css(F.tn.shadow, 0.035);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.55, sh); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(-w / 2, -h / 2, w, h);
    var x = -w / 2 + pad;
    I.text(g, F, step.role === 'request' ? 'REQUEST' : step.role.toUpperCase(), x, -h / 2 + pad + G.lh(F, G.ts(F, 0)) * 0.8, { s: G.ts(F, 0), mono: true, caps: true, tone: 'ink3', alpha: al });
    I.text(g, F, G.title(null, step, tr), x, h / 2 - pad - G.lh(F, G.ts(F, 0)) - 2 * F.ui, { s: G.ts(F, 2), w: 500, alpha: al });
    var sub = G.fit(G.sub(step, tr), w - 2 * pad, 7.6 * F.ui * (G.ts(F, 0) ? 1.2 : 1)), bad = tr.steps[step.i].st === 'fail';
    I.text(g, F, sub, x, h / 2 - pad, { s: G.ts(F, 0), mono: true, tone: bad ? 'ink' : 'ink3', alpha: al });
    g.restore();
  };
  /* печать на диске: короткая метка по центру; решение несёт одну тёплую точку (акцент) */
  G.printDisc = function (g, s, F, step, tr, o) {
    o = o || {};
    var I = R.ink, st = tr.steps[step.i].st, al = o.alpha == null ? 1 : o.alpha;
    if (step.role === 'decision') {
      if (st === 'pass' || st === 'fail') {
        g.save(); g.fillStyle = R.color.css(F.T.accent, al); g.beginPath(); g.arc(s.x, s.y + s.w * 0.18, Math.max(2.5, 3.2 * F.ui), 0, Math.PI * 2); g.fill(); g.restore();
      }
      I.text(g, F, G.title(null, step, tr), s.x, s.y + 2 * F.ui, { s: G.ts(F, s.w > 90 * F.ui ? 2 : 1), w: 600, align: 'center', alpha: al });
      I.text(g, F, step.sub, s.x, s.y - s.w * 0.22, { s: G.ts(F, 0), mono: true, tone: 'ink3', align: 'center', alpha: al });
      return;
    }
    I.text(g, F, step.title, s.x, s.y + 4 * F.ui, { s: G.ts(F, s.w > 70 * F.ui ? 1 : 0), w: 500, align: 'center', alpha: al });
  };
  /* метка блока у плашки на полу: кольцо акцентом (слой взаимодействия, выделение) */
  G.blockRing = function (g, F, s) {
    g.save(); g.lineWidth = F.lineW; g.strokeStyle = R.color.css(F.T.accent);
    g.beginPath();
    if (s.kind === 'circle') g.arc(s.x, s.y, s.w / 2 + 5 * F.ui, 0, Math.PI * 2);
    else { g.translate(s.x, s.y); g.rotate(s.rot || 0); var w = s.w / 2 + 5 * F.ui, h = s.h / 2 + 5 * F.ui, r = 8 * F.ui;
      g.moveTo(-w + r, -h); g.arcTo(w, -h, w, h, r); g.arcTo(w, h, -w, h, r); g.arcTo(-w, h, -w, -h, r); g.arcTo(-w, -h, w, -h, r); g.closePath(); }
    g.stroke(); g.restore();
  };
  G.header = function (g, F, M, tr) {
    var I = R.ink, m = Math.min(F.W, F.H) * 0.06;
    I.text(g, F, (M.rule ? M.rule.id : '') + ' · RULE', m, m * 0.95, { s: G.ts(F, 0), mono: true, caps: true, tone: 'ink3' });
    I.text(g, F, M.rule ? M.rule.text : '', m, m * 0.95 + G.lh(F, G.ts(F, 3)), { s: G.ts(F, 3), w: 500 });
    if (+F.P.trace) { var pr = G.protocol(M, tr); if (pr) I.text(g, F, pr, m, m * 0.95 + G.lh(F, G.ts(F, 3)) + G.lh(F, G.ts(F, 0)) * 1.3, { s: G.ts(F, 0), mono: true, tone: 'ink2' }); }
    I.fictional(g, F);
  };
})();
