// glyph-common.js — знак состояния агента (README §6.5, канон ai-presence): пять состояний,
// различимых топологией (счёт элементов: 3 · 5 · кольцо · 1 · 1 с разрывом), а не амплитудой.
// Ритм: idle 0.2 Гц яркостью, work 0.8 Гц направленный обход, wait маяк раз в 4 с,
// done и error статичны после одного жеста. Яркость идёт только вниз (притухание).
// До 48 px знак печатается плоско; от 48 px сплошная точка done поднята на z2 и даёт тень.
(function () {
  'use strict';
  const RL = window.RL, GL = window.GLYPH = {};
  const TAU = RL.TAU, clamp = RL.clamp;

  GL.STATES = ['idle', 'work', 'wait', 'done', 'error'];
  GL.META = {
    idle: { label: 'Idle', means: 'On call', rhythm: '0.2 Hz · brightness', count: '3 dots' },
    work: { label: 'Work', means: 'Reads, checks, acts', rhythm: '0.8 Hz · directed', count: '5 dots' },
    wait: { label: 'Wait', means: 'Needs a person', rhythm: 'beacon · every 4 s', count: '1 ring' },
    done: { label: 'Done', means: 'Verified', rhythm: 'static · raised', count: '1 dot' },
    error: { label: 'Error', means: 'Blocked', rhythm: 'one gesture · static', count: '1 dot · open ring' }
  };
  GL.SIZES = [16, 24, 32, 48, 64, 96];
  GL.rows = {
    scene: [RL.C('stateG', 'Состояние', ['idle', 'work', 'wait', 'done', 'error'], 'work', ['Покой', 'Работа', 'Ждёт', 'Готово', 'Сбой']),
      RL.N('sheet', 'Лист состояний', 0, 1, 1, 1)],
    rhythm: [RL.N('size', 'Размер, px', 16, 96, 1, 32)]
  };

  // под-глагол работы: меняет характер шага, не силуэт (read плавно · check по шагу · act толчком)
  GL.verbAt = (t) => ['read', 'check', 'act'][Math.floor(((t % 7.5) + 7.5) % 7.5 / 2.5)];
  function headAngle(t, verb) {
    const laps = 0.8 * t, u = laps * 5, k = Math.floor(u), f = u - k;
    if (verb === 'check') return (k + RL.smoother(f)) / 5 * TAU;                  // шаг от точки к точке
    if (verb === 'act') return (k + RL.smoother(Math.min(1, f * 1.6))) / 5 * TAU; // толчок и задержка
    return laps * TAU;                                                              // read: ровный ход
  }

  // нарисовать знак. o: {state, size, t, since (с момента входа в состояние), verb, ink, accent, lineW,
  // reduced}. Возвращает плашки, если знак поднят (done ≥ 48 px), иначе печатает сразу в g.
  GL.raised = (o) => o.state === 'done' && o.size >= 48 && !o.flat;
  // поднятая точка done: диск того же вещества, напечатанный чернилами, на z2 над своим основанием
  GL.disc = function (U, T, cx, cy, o) {
    const r = o.size * 0.2;
    return RL.plate({ id: 'done', k: 'disc', x: cx - r, y: cy - r, w: 2 * r, h: 2 * r, z: (o.base || 0) + U.z[2], albedo: o.ink || T.ink });
  };
  GL.draw = function (g, R, cx, cy, o) {
    const s = o.size, T = R.T, ink = o.ink || T.ink, t = o.reduced ? 0 : o.t, since = o.reduced ? 99 : (o.since == null ? 99 : o.since);
    const lw = Math.max(1, Math.min(R.U.lineW, s / 18));
    const dotR = Math.max(1.4, s * 0.085), ringR = s * 0.3;
    const out = [];
    g.lineCap = 'round';
    switch (o.state) {
      case 'idle': {
        for (let k = 0; k < 3; k++) {
          const a = 1 - 0.38 * (0.5 - 0.5 * Math.cos(TAU * 0.2 * t - k * 0.5));
          RL.dot(g, cx + (k - 1) * s * 0.24, cy, dotR, RL.css(ink, a));
        }
        break;
      }
      case 'work': {
        const verb = o.verb || GL.verbAt(t), h = headAngle(t, verb);
        for (let k = 0; k < 5; k++) {
          const ang = k / 5 * TAU;
          let d = ((h - ang) % TAU + TAU) % TAU;        // дуга позади головы: хвост гаснет
          const a = 0.22 + 0.78 * Math.pow(1 - d / TAU, 2.2);
          RL.dot(g, cx + Math.sin(ang) * ringR, cy - Math.cos(ang) * ringR, dotR * 0.9, RL.css(ink, a));
        }
        break;
      }
      case 'wait': {
        const ph = ((t % 4) + 4) % 4, beacon = ph < 0.8 ? Math.pow(Math.sin(Math.PI * ph / 0.8), 2) : 0;
        g.lineWidth = lw; g.strokeStyle = RL.css(ink, 1 - 0.55 * beacon);
        g.beginPath(); g.arc(cx, cy, ringR, 0, TAU); g.stroke();
        break;
      }
      case 'done': {
        const r = s * 0.2;
        if (!GL.raised(o)) RL.dot(g, cx, cy, r, RL.css(ink));   // поднятую точку рисует проход плашек
        break;
      }
      case 'error': {
        // жест: кольцо размыкается за 0.4 с, потом статика (без отскока)
        const k = RL.smoother(since / 0.4), gap = (8 + 52 * k) * Math.PI / 180, start = -Math.PI / 4 + gap / 2;
        g.lineWidth = lw; g.strokeStyle = RL.css(ink);
        g.beginPath(); g.arc(cx, cy, ringR, start, start + TAU - gap); g.stroke();
        RL.dot(g, cx, cy, Math.max(1.6, s * 0.12), RL.css(o.accent || T.accent));
        break;
      }
    }
    return out;
  };
})();
