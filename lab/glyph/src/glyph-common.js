/* glyph-common.js · знак состояния агента на рельсе RELIEF (README §6.5, канон ai-presence):
   пять состояний различимы топологией (счёт элементов: 3 точки · 5 точек · кольцо · 1 точка · 1 точка с разрывом
   кольца), не амплитудой. Ритм: idle 0,2 Гц яркостью, work 0,8 Гц направленный обход, wait маяк раз в 4 с,
   done и error статичны после одного жеста. Яркость идёт только вниз (притухание). Все формы круглые.
   До 48 px знак печатается плоско; от 48 px точка done поднята на z2 диском и даёт тень (решает рельс). */
(function () {
  'use strict';
  var R = window.RELIEF, GL = R.glyph = {};
  var TAU = Math.PI * 2;
  var smoother = function (x) { x = Math.max(0, Math.min(1, x)); return x * x * x * (x * (x * 6 - 15) + 10); };

  GL.STATES = ['idle', 'work', 'wait', 'done', 'error'];
  GL.META = {
    idle: { label: 'Idle', means: 'On call', rhythm: '0.2 Hz · brightness', count: '3 dots' },
    work: { label: 'Work', means: 'Reads, checks, acts', rhythm: '0.8 Hz · directed', count: '5 dots' },
    wait: { label: 'Wait', means: 'Needs a person', rhythm: 'beacon every 4 s', count: '1 ring' },
    done: { label: 'Done', means: 'Verified', rhythm: 'static · raised', count: '1 dot' },
    error: { label: 'Error', means: 'Blocked', rhythm: 'one gesture · static', count: '1 dot · open ring' }
  };
  GL.rows = {
    'Сцена': [['stateG', 'Состояние', ['idle', 'work', 'wait', 'done', 'error'], 'work', ['Покой', 'Работа', 'Ждёт', 'Готово', 'Сбой']],
      ['sheet', 'Лист состояний', 0, 1, 1, 1, 'Все пять состояний в организме; без листа — только выбранное']],
    'Ритм': [['size', 'Размер, px', 16, 96, 1, 48, 'Размер знака в фокусе']]
  };

  // под-глагол работы: меняет характер шага, не силуэт (read ровно · check по шагу · act толчком)
  GL.verbAt = function (t) { return ['read', 'check', 'act'][Math.floor((((t % 7.5) + 7.5) % 7.5) / 2.5)]; };
  function head(t, verb) {
    var laps = 0.8 * t, u = laps * 5, k = Math.floor(u), f = u - k;
    if (verb === 'check') return (k + smoother(f)) / 5 * TAU;
    if (verb === 'act') return (k + smoother(Math.min(1, f * 1.6))) / 5 * TAU;
    return laps * TAU;
  }
  GL.raised = function (o) { return o.state === 'done' && o.size >= 48 && !o.flat; };
  /* поднятая точка done: диск того же вещества, напечатанный чернилами, на z2 над основанием */
  GL.disc = function (F0, cx, cy, o) {
    var r = o.size * 0.2;
    return { id: o.id || 'done', kind: 'circle', x: cx, y: cy, w: 2 * r, z: (o.base || 0) + R.zh(2, F0.P, F0.ui), fill: F0.ink, env: 0, glyphDot: true };
  };
  /* печать знака в точке (cx, cy). o: {state, size, t, since, verb, reduced, alpha} */
  GL.draw = function (g, F, cx, cy, o) {
    var s = o.size, ink = F.T.ink, t = o.reduced ? 0 : o.t, since = o.reduced ? 99 : (o.since == null ? 99 : o.since);
    var al = o.alpha == null ? 1 : o.alpha, lw = Math.max(1, Math.min(F.lineW, s / 18)), C = R.color.css;
    var dotR = Math.max(1.4, s * 0.085), ringR = s * 0.3;
    var dot = function (x, y, r, c) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = c; g.fill(); };
    g.save(); g.lineCap = 'round';
    if (o.state === 'idle') {
      for (var k = 0; k < 3; k++) {
        var a = 1 - 0.38 * (0.5 - 0.5 * Math.cos(TAU * 0.2 * t - k * 0.5));
        dot(cx + (k - 1) * s * 0.24, cy, dotR, C(ink, a * al));
      }
    } else if (o.state === 'work') {
      var hd = head(t, o.verb || GL.verbAt(t));
      for (var j = 0; j < 5; j++) {
        var ang = j / 5 * TAU, d = ((hd - ang) % TAU + TAU) % TAU;
        dot(cx + Math.sin(ang) * ringR, cy - Math.cos(ang) * ringR, dotR * 0.9, C(ink, (0.22 + 0.78 * Math.pow(1 - d / TAU, 2.2)) * al));
      }
    } else if (o.state === 'wait') {
      var ph = ((t % 4) + 4) % 4, b = ph < 0.8 ? Math.pow(Math.sin(Math.PI * ph / 0.8), 2) : 0;
      g.lineWidth = lw; g.strokeStyle = C(ink, (1 - 0.55 * b) * al);
      g.beginPath(); g.arc(cx, cy, ringR, 0, TAU); g.stroke();
    } else if (o.state === 'done') {
      if (!GL.raised(o)) dot(cx, cy, s * 0.2, C(ink, al));
    } else if (o.state === 'error') {
      var kk = smoother(since / 0.4), gap = (8 + 52 * kk) * Math.PI / 180, st = -Math.PI / 4 + gap / 2;
      g.lineWidth = lw; g.strokeStyle = C(ink, al);
      g.beginPath(); g.arc(cx, cy, ringR, st, st + TAU - gap); g.stroke();
      dot(cx, cy, Math.max(1.6, s * 0.12), C(F.T.accent, al));
    }
    g.restore();
  };
  /* подпись состояния: заголовок и моно-строка ритма */
  GL.caption = function (g, F, x, y, state, o) {
    o = o || {};
    var M = GL.META[state], s = F.ui < 0.5 ? 2 : F.ui < 0.72 ? 1 : 0;
    R.ink.text(g, F, M.label + (o.extra ? ' · ' + o.extra : ''), x, y, { s: s + 1, w: 500, align: o.align || 'center', alpha: o.alpha });
    R.ink.text(g, F, M.count + ' · ' + M.rhythm, x, y + R.ink.SIZES[s + 1] * F.ui * 1.3, { s: s, mono: true, tone: 'ink3', align: o.align || 'center', alpha: o.alpha });
  };
})();
