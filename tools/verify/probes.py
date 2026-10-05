#!/usr/bin/env python3
"""Пробы рельса P-L1…P-L6, P-M1, P-M2, P-T2 по dist/_lab.html (README §11, Ф0.3–0.4).

    python3 tools/verify/probes.py              чистый прогон: все пробы обязаны быть зелёными
    python3 tools/verify/probes.py --negative   + грязный дубль каждой пробы обязан покраснеть
    python3 tools/verify/probes.py --only P-L1,P-L2

Грязный дубль ломает ровно то, что меряет проба, подменой функции рельса в живой странице
(RELIEF.light.offset, .sigma, рекорд плавания …) или флагом калибровки (__lab.flag). Замер идёт
по кадру при reduced=1 (стоит) на равном номере кадра, viewport 1000×700, dpr 1.
Коды: 0 зелёное (и при --negative все дубли красные) · 1 красное · 2 сломан замер.
"""
import io
import math
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LAB = 'file://' + os.path.join(ROOT, 'dist', '_lab.html')
VW, VH = 1000, 700

GRAB = """() => { const c = document.querySelector('canvas'), g = c.getContext('2d');
  const d = g.getImageData(0, 0, c.width, c.height).data, L = new Array(c.width * c.height);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) L[j] = 0.2126 * d[i] + 0.7152 * d[i+1] + 0.0722 * d[i+2];
  return {w: c.width, h: c.height, L: L}; }"""
RAW = """() => { const c = document.querySelector('canvas'), g = c.getContext('2d');
  return Array.from(g.getImageData(0, 0, c.width, c.height).data); }"""


class Page(object):
    def __init__(self, br, query):
        self.p = br.new_page(viewport={'width': VW, 'height': VH}, device_scale_factor=1, reduced_motion='reduce')
        self.errs = []
        self.p.on('pageerror', lambda e: self.errs.append(str(e)[:80]))
        self.p.goto(LAB + '?embed=1&reduced=1&seed=probe' + query)
        for _ in range(80):                      # CSP запрещает eval: опрос через evaluate, не wait_for_function
            if self.p.evaluate('() => window.__READY === true && !!(window.RELIEF && RELIEF.last)'):
                break
            self.p.wait_for_timeout(100)

    def js(self, code, arg=None):
        return self.p.evaluate(code, arg) if arg is not None else self.p.evaluate(code)

    def redraw(self):
        self.js("() => Scene.set('view', Scene.get('view'))")

    def setk(self, k, v):
        self.js("([k, v]) => Scene.set(k, v)", [k, v])

    def grab(self):
        return self.js(GRAB)

    def plates(self):
        return self.js("() => RELIEF.last.plates.map(p => ({id: p.id, x: p.x, y: p.y, w: p.w, h: p.h, z: p.z}))")

    def close(self):
        self.p.close()


def diff(a, b):
    """затемнение: насколько кадр b темнее кадра a, по пикселям"""
    return [max(0.0, x - y) for x, y in zip(a['L'], b['L'])]


def centroid(D, w, box=None, floor=1.0):
    sx = sy = s = 0.0
    for i, v in enumerate(D):
        if v < floor:
            continue
        x, y = i % w, i // w
        if box and not (box[0] <= x < box[2] and box[1] <= y < box[3]):
            continue
        sx += v * x; sy += v * y; s += v
    return (sx / s, sy / s, s) if s else (None, None, 0)


def edge_width(profile):
    """ширина края 10–90 % по профилю затемнения (монотонный склон), субпиксельно"""
    m = max(profile) if profile else 0
    if m <= 0:
        return None
    k = profile.index(m)
    tail = profile[k:]
    def cross(level):
        for i in range(1, len(tail)):
            if tail[i - 1] >= level > tail[i]:
                return i - 1 + (tail[i - 1] - level) / (tail[i - 1] - tail[i])
        return None
    a, b = cross(0.9 * m), cross(0.1 * m)
    return (b - a) if a is not None and b is not None else None


def _profile(D, w, h, x0, x1, y0, y1, horiz):
    """усреднённый профиль затемнения: вдоль x по полосе строк [y0,y1) или вдоль y по полосе столбцов"""
    out = []
    if horiz:
        for x in range(max(0, x0), min(w, x1)):
            out.append(sum(D[y * w + x] for y in range(y0, y1)) / max(1, y1 - y0))
    else:
        for y in range(max(0, y0), min(h, y1)):
            out.append(sum(D[y * w + x] for x in range(x0, x1)) / max(1, x1 - x0))
    return out


def _cross(prof, level, start, step):
    """первое пересечение уровня от индекса start в сторону step, субпиксельно"""
    i = start
    while 0 <= i + step < len(prof):
        a, b = prof[i], prof[i + step]
        if (a - level) * (b - level) <= 0 and a != b:
            return i + step * (a - level) / (a - b)
        i += step
    return None


def edges(D, w, h, P, band=0.25):
    """тень плашки P по профилям через центр: левый/правый край 50 % по x, верх/низ по y,
    и ширина края 10–90 % (среднее по четырём сторонам). Плато = медиана середины."""
    bw, bh = int(P['w'] * band), int(P['h'] * band)
    cx, cy, m = int(round(P['x'])), int(round(P['y'])), int(max(P['w'], P['h']))
    px = _profile(D, w, h, cx - m, cx + m, cy - bh, cy + bh, True)
    py = _profile(D, w, h, cx - bw, cx + bw, cy - m, cy + m, False)
    out = {}
    for name, prof, base in (('x', px, cx - m), ('y', py, cy - m)):
        mid = sorted(prof[len(prof) // 2 - 10:len(prof) // 2 + 10])
        plat = mid[len(mid) // 2]
        c = len(prof) // 2
        lo, hi = _cross(prof, 0.5 * plat, c, -1), _cross(prof, 0.5 * plat, c, 1)
        if lo is None or hi is None or plat <= 0.5:
            return None
        out[name] = base + (lo + hi) / 2.0 + 0.5        # центр пикселя i лежит в i + 0,5
        ws = []
        for step in (-1, 1):
            a9, a1 = _cross(prof, 0.9 * plat, c, step), _cross(prof, 0.1 * plat, c, step)
            if a9 is not None and a1 is not None:
                ws.append(abs(a1 - a9))
        out['w' + name] = sum(ws) / len(ws) if ws else None
    out['plateau'] = plat
    return out


DIRTY = {}


def probe(pid, dirty):
    def deco(fn):
        PROBES.append((pid, fn))
        DIRTY[pid] = dirty
        return fn
    return deco


PROBES = []

# ── P-L1 · сдвиг тени ∝ Δh ────────────────────────────────────────────────
D_CONST_OFFSET = """() => { const L = RELIEF.light, o = L.offset;
  L.offset = function (S, cx, cy, hc, hr) { if (hc - hr <= 0) return [0, 0]; return [S.d[0] * 10, S.d[1] * 10]; }; }"""


def shadow_of(pg, pid, ghost=True):
    """центроид тени одной плашки: кадр «призрак» минус кадр без плашки"""
    pg.js("(id) => { __lab.reset(); __lab.only([id]); __lab.flag('ghost', [id]); }", pid); pg.redraw()
    with_ = pg.grab(); P = [p for p in pg.plates() if p['id'] == pid][0]
    pg.js("() => { __lab.only(['__none__']); }"); pg.redraw()
    without = pg.grab()
    D = diff(without, with_)
    E = edges(D, with_['w'], with_['h'], P)
    if not E:
        return P, None, None, 0, D, with_['w']
    return P, E['x'], E['y'], E, D, with_['w']


@probe('P-L1', D_CONST_OFFSET)
def p_l1(pg):
    pg.setk('contact', 0)
    L = pg.js("() => { const s = RELIEF.light.state(Scene.get ? KIT.scene.ctx.P : {}, 1, 1, 1); return {az: s.az, cot: s.cot}; }")
    rows, worst = [], 0
    for pid in ('z1', 'z2', 'z3'):
        P, cx, cy, s, _, _ = shadow_of(pg, pid)
        if cx is None:
            return False, '%s: тени нет' % pid
        got = math.hypot(cx - P['x'], cy - P['y'])          # середина краёв 50 % минус центр плашки
        want = P['z'] * L['cot']
        e = abs(got - want) / want
        worst = max(worst, e)
        rows.append('%s %.1f/%.1f' % (pid, got, want))
    return worst <= 0.08, 'сдвиг факт/ожид px: %s · отклонение ≤ %.1f %%' % (' · '.join(rows), worst * 100)


# ── P-L2 · полутень растёт с высотой ──────────────────────────────────────
D_CONST_SIGMA = "() => { RELIEF.light.sigma = function () { return 3; }; }"


@probe('P-L2', D_CONST_SIGMA)
def p_l2(pg):
    pg.setk('contact', 0)
    ws = []
    for pid in ('z1', 'z2', 'z3'):
        P, cx, cy, E, D, w = shadow_of(pg, pid)
        if cx is None:
            return False, '%s: тени нет' % pid
        ws.append((E['wx'] + E['wy']) / 2.0)
    ok = ws[0] * 1.15 < ws[1] and ws[1] * 1.15 < ws[2]          # строго и заметно: шум растра не в счёт
    return ok, 'край 10–90 %%: z1 %.2f · z2 %.2f · z3 %.2f px' % tuple(ws)


# ── P-L3 · один свет: направление всех теней ──────────────────────────────
D_HAND = """() => { const o = RELIEF.light.offset;
  RELIEF.light.offset = function (S, cx, cy, hc, hr) { const v = o(S, cx, cy, hc, hr);
    if (cx > 600) { const a = 25 * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [v[0]*c - v[1]*s, v[0]*s + v[1]*c]; }
    return v; }; }"""


@probe('P-L3', D_HAND)
def p_l3(pg):
    pg.setk('contact', 0)
    worst, rows = 0, []
    for pre in ('soft', 'raking', 'canopy'):
        pg.setk('light', pre)
        az = pg.js("() => KIT.scene.ctx.P.az") * math.pi / 180
        want = math.atan2(math.sin(az), -math.cos(az))
        for pid in ('z2', 'z3', 'disc'):
            P, cx, cy, s, _, _ = shadow_of(pg, pid)
            if cx is None:
                return False, '%s/%s: тени нет' % (pre, pid)
            got = math.atan2(cy - P['y'], cx - P['x'])
            d = abs((got - want + math.pi) % (2 * math.pi) - math.pi) * 180 / math.pi
            worst = max(worst, d)
        rows.append(pre)
    pg.setk('light', 'soft')
    return worst <= 3, 'пресеты %s · худшее отклонение направления %.2f°' % (' '.join(rows), worst)


# ── P-L4 · приёмник: на близкой плашке край тени уже, чем на полу ────────
D_ONE_RECEIVER = """() => { const L = RELIEF.light, o = L.offset, s = L.sigma;
  L.offset = function (S, cx, cy, hc, hr) { return o(S, cx, cy, hc, 0); };
  L.sigma = function (S, dh) { return s(S, 28 * S.ui); }; }"""


@probe('P-L4', D_ONE_RECEIVER)
def p_l4(pg):
    pg.setk('contact', 0)
    pg.setk('soft', 1)                       # шире полутень — виднее разница приёмников (порядок величин тот же)
    # тень z3 (top) на плашке z1 (base): кадр base+призрак top минус кадр base
    pg.js("() => { __lab.reset(); __lab.only(['base', 'top']); __lab.flag('ghost', ['top']); }"); pg.redraw()
    a = pg.grab()
    top = [p for p in pg.plates() if p['id'] == 'top'][0]
    pg.js("() => { __lab.only(['base']); }"); pg.redraw()
    b = pg.grab()
    Ep = edges(diff(b, a), a['w'], a['h'], top)
    # та же высота над полом: плашка z3
    P, cx, cy, Ef, D, w = shadow_of(pg, 'z3')
    if not Ep or not Ef:
        return False, 'край не найден'
    wp, wf = (Ep['wx'] + Ep['wy']) / 2, (Ef['wx'] + Ef['wy']) / 2
    op, of = math.hypot(Ep['x'] - top['x'], Ep['y'] - top['y']), math.hypot(cx - P['x'], cy - P['y'])
    return wp < wf * 0.97 and op < of * 0.97, \
        'на плашке: край %.2f px, сдвиг %.1f · на полу: край %.2f px, сдвиг %.1f' % (wp, op, wf, of)


# ── P-L5 · матовость: светлее освещённого верха + кант быть нельзя ────────
@probe('P-L5', "() => { __lab.flag('gloss'); }")
def p_l5(pg):
    pg.js("() => { __lab.only(['z2', 'disc', 'base']); }"); pg.redraw()
    a = pg.grab(); w = a['w']
    top = pg.js("() => { const t = RELIEF.last.tn.plate; return 0.2126*t[0] + 0.7152*t[1] + 0.0722*t[2]; }")
    rim = pg.js("() => { const t = RELIEF.last.tn.light; return 0.2126*t[0] + 0.7152*t[1] + 0.0722*t[2]; }")
    grain = pg.js("() => KIT.scene.ctx.P.grain") / 100.0
    limit = max(top, top + (rim - top) * 0.6 * 0.5) + 255 * grain * 1.2 + 2
    mx = 0
    for p in pg.plates():
        x0, x1 = int(p['x'] - p['w'] / 2 + 3), int(p['x'] + p['w'] / 2 - 3)
        y0, y1 = int(p['y'] - p['h'] / 2 + 3), int(p['y'] + p['h'] / 2 - 3)
        for y in range(y0, y1, 2):
            row = a['L'][y * w + x0:y * w + x1]
            if row:
                mx = max(mx, max(row))
    return mx <= limit, 'максимум светлоты на плашке %.1f ≤ %.1f (верх %.1f + кант + зерно)' % (mx, limit, top)


# ── P-L6 · ступеньки на мягком перепаде ───────────────────────────────────
@probe('P-L6', "() => { Scene.set('grain', 0); }")
def p_l6(pg):
    pg.setk('view', '_grain')
    raw = pg.js(RAW); w, h = VW, VH
    worst, where = 0, None
    for y in range(int(h * 0.25), int(h * 0.9), 23):
        for ch in range(3):
            run, prev = 0, None
            for x in range(int(w * 0.04), int(w * 0.55)):
                v = raw[(y * w + x) * 4 + ch]
                run = run + 1 if v == prev else 1
                prev = v
                if run > worst:
                    worst, where = run, (x, y)
    pg.setk('view', '_light')
    return worst <= 6, 'самый длинный пробег одинаковых 8-бит значений %d px %s' % (worst, where)


# ── P-M1 · кинематика плавания (канон: kin.mjs) ───────────────────────────
D_BROKEN = """() => { const f = RELIEF.motion.float;
  RELIEF.motion.float = function (seed, id, t, P, w, h, hgt, env) { const m = f(seed, id, t, P, w, h, hgt, env);
    const ph = (t % 7.3) / 7.3; m.dx += 1.5 * Math.sin(6.283 * ph) * env; return m; }; }"""
KIN = """() => {
  const ids = __fxlist().map(f => f.id), P = KIT.scene.ctx.P, per = +P.period, out = [];
  for (const id of ids) {
    const keys = ['dx', 'dy', 'rot', 'dh', 'z', 'env'], rep = {id, loop: [], c0: [], c1: [], vmax: 0, still: 0};
    const s = (N) => { const r = []; for (let i = 0; i <= N; i++) r.push(__probe(id, i * per / N)); return r; };
    const A = s(1800), B = s(3600);
    for (const k of keys) {
      const ca = A.map(o => o[k]), cb = B.map(o => o[k]);
      const amp = Math.max(...ca) - Math.min(...ca); if (amp < 1e-6) continue;
      let worst = 0;
      for (const q of [0, .13, .27, .41, .55, .69, .83, .96]) worst = Math.max(worst, Math.abs(__probe(id, q*per)[k] - __probe(id, q*per + per)[k]));
      if (worst / amp > 0.03) rep.loop.push(k);
      const d1 = c => { let m = 0; for (let i = 1; i < c.length; i++) m = Math.max(m, Math.abs(c[i] - c[i-1])); return m; };
      const d2 = c => { let m = 0; for (let i = 2; i < c.length; i++) m = Math.max(m, Math.abs(c[i] - 2*c[i-1] + c[i-2])); return m; };
      const m1a = d1(ca), m1b = d1(cb), m2a = d2(ca), m2b = d2(cb);
      if (m1a / amp > 0.004 && m1b / m1a > 0.72) rep.c0.push(k);
      else if (m2a / amp > 0.004 && m2b / m2a > 0.40 && k !== 'env' && k !== 'z') rep.c1.push(k);
    }
    // скорость плавания px/с и покой после оседания
    for (let i = 1; i < A.length; i++) {
      const dt = per / 1800, v = Math.hypot(A[i].dx - A[i-1].dx, A[i].dy - A[i-1].dy) / dt;
      rep.vmax = Math.max(rep.vmax, v);
      if (id === 'settle' && A[i].env === 0 && A[i-1].env === 0) rep.still = Math.max(rep.still, v);
    }
    out.push(rep);
  }
  return out; }"""


@probe('P-M1', D_BROKEN)
def p_m1(pg):
    pg.setk('view', '_float')
    reps = pg.js(KIN)
    pg.setk('view', '_light')
    bad = []
    for r in reps:
        if r['loop'] or r['c0'] or r['c1'] or r['vmax'] > 2.0 or r['still'] > 1e-9:
            bad.append('%s loop%s c0%s c1%s v%.2f' % (r['id'], r['loop'], r['c0'], r['c1'], r['vmax']))
    vmax = max(r['vmax'] for r in reps)
    return not bad, ('чисто: 5 состояний, замкнуто в 8 точках, C0 C1, v ≤ %.2f px/с, после оседания 0' % vmax) if not bad else '; '.join(bad)


# ── P-M2 · покой: при reduced=1 кадр не зависит от времени ────────────────
@probe('P-M2', "() => { Object.defineProperty(KIT.scene.ctx, 'reduced', {value: false, writable: true}); }")
def p_m2(pg):
    pg.setk('view', '_float')
    a = pg.js(RAW)
    pg.js("() => { __freeze(7.3); }")
    pg.p.wait_for_timeout(200)
    b = pg.js(RAW)
    pg.js("() => { RELIEF.motion.clock.override = null; }")
    pg.setk('view', '_light')
    n = sum(1 for x, y in zip(a, b) if x != y)
    return n == 0, 'кадр t=0 против t=7,3 с при reduce: различных байт %d' % n


# ── P-T2 · одна толщина линии на зуме .5 · 1 · 2 ──────────────────────────
@probe('P-T2', "() => { __lab.flag('ctxscale'); }")
def p_t2(pg):
    pg.js("() => { __lab.flag('nogrid'); }")
    pg.setk('view', '_ruler')
    a = pg.grab(); w = a['w']; L = a['L']
    pls = sorted([p for p in pg.plates() if str(p['id']).startswith('r')], key=lambda p: p['id'])
    ui = pg.js("() => RELIEF.ui(KIT.scene.ctx.W, KIT.scene.ctx.H)")
    ink = pg.js("() => { const t = RELIEF.last.T.ink; return 0.2126*t[0] + 0.7152*t[1] + 0.0722*t[2]; }")
    widths = []
    for i, p in enumerate(pls):
        r = 46 * ui * [0.5, 1, 2][i]
        vals = []
        for dy in range(-4, 5):
            y = int(round(p['y'])) + dy
            xs = range(int(round(p['x'] - r - 7)), int(round(p['x'] - r + 7)))
            row = [L[y * w + x] for x in xs]
            bg = sorted(row)[-3]
            vals.append(sum(max(0.0, bg - v) for v in row) / max(1.0, bg - ink))
        vals.sort()
        widths.append(vals[len(vals) // 2])
    pg.setk('view', '_light')
    spread = max(widths) - min(widths)
    return spread <= 0.25, 'ширина штриха (интеграл/контраст, px) ×0.5 %.2f · ×1 %.2f · ×2 %.2f · разброс %.2f' % (tuple(widths) + (spread,))


def run(only, negative):
    from playwright.sync_api import sync_playwright
    pw = sync_playwright().start()
    br = pw.chromium.launch()
    bad = 0
    print('%-6s %-8s %s' % ('проба', 'чистый', 'замер'))
    for pid, fn in PROBES:
        if only and pid not in only:
            continue
        pg = Page(br, '')
        try:
            ok, msg = fn(pg)
        except Exception as e:
            ok, msg = False, 'замер упал: %s' % str(e)[:100]
        errs = pg.errs[:]
        pg.close()
        line = '%-6s %-8s %s' % (pid, 'green' if ok else 'RED', msg + (' · ошибки: %s' % errs[0] if errs else ''))
        if not ok:
            bad = 1
        if negative:
            pg = Page(br, '')
            try:
                pg.js(DIRTY[pid]); pg.redraw()
                ok2, msg2 = fn(pg)
            except Exception as e:
                ok2, msg2 = False, 'упала на дубле: %s' % str(e)[:60]
            pg.close()
            line += '\n%-6s %-8s %s' % ('', 'дубль ' + ('🔴 ПРОШЁЛ' if ok2 else 'red ok'), msg2)
            if ok2 or not ok:
                bad = 1
        print(line)
    br.close(); pw.stop()
    print('итог: %s' % ('все пробы зелёные' + (' и все дубли красные' if negative else '') if not bad else '🔴 есть провал'))
    return bad


if __name__ == '__main__':
    only = []
    for a in sys.argv[1:]:
        if a.startswith('--only'):
            only = a.split('=', 1)[1].split(',') if '=' in a else []
    if '--only' in sys.argv:
        only = sys.argv[sys.argv.index('--only') + 1].split(',')
    sys.exit(run(only, '--negative' in sys.argv))
