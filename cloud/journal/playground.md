# Журнал · кусок playground

Ответственный: Claude Code (облако), сессия https://claude.ai/code/session_01QgUKX5ybva4ZaNxBo7hPT2 · ветка `cloud/playground`, пуш в main

Skills applied: autonomous-build-loop, motion-kinematics-canon (+ kin.mjs), canvas-frame-budget (часть 1–2), panel-v2 PANEL_V2.md

| время (UTC) | пункт | что сделано | чем проверено | хеш |
|---|---|---|---|---|
| 2026-10-05T12:50:40Z | 0.1 | automerge cloud/** → main, setup под Chromium облака (playwright 1.56 под chromium-1194) | `bash tools/setup.sh` → «окружение готово», `gate.py --negative` 19/19 на sample | 9e9b904 |
| 2026-10-05T12:50:40Z | 0.2–0.3 | рельс `src/` (свет по SDF, тени по приёмникам, контакт и AO, canopy, зерно синим шумом, кант светом, плавание, адаптер панели v2), `tools/build.py`, `dist/_lab.html`, playground `dist/index.html`, `tools/site.py` в pages.yml | `gate.py dist/_lab.html` → 9/10 (красные 2-panel-live, 2-kit ждут профиля v2); ручка панели playground меняет хеш кадра (gate v1 и _lab) | c8b4cf9, c259d11 |
| 2026-10-05T12:54:40Z | 0.4 | профиль гейта v2 (2-panel-live, 2-kit md5 тела, 2-extend, 3-hardcode, 10-clean + names.h16, --sample); рельс берёт случайность из kit | `gate.py dist/_lab.html` → «итог: 19 зелёных · 0 красных · 0 не доказано · 0 протухло» 10/10; `--negative` и `--negative --sample dist/_lab.html` → «контроль пройден» | 57f7f3b |
| 2026-10-05T13:27:19Z | 0.3–0.4 | пробы P-L1–L6, P-M1, P-M2, P-T2 в `tools/verify/probes.py`, у каждой грязный дубль; по находкам: зерно/неровность без зависимости от светлоты, drop без разрыва, покой при reduce, юбка AO на ручке Контакт | `probes.py --negative` → «все пробы зелёные и все дубли красные» (P-L1 отклонение 0,8 %, P-M1 v ≤ 1,35 px/с); `gate.py dist/_lab.html` → 10/10 | 7f02ad5 |
| 2026-10-05T13:48:09Z | бюджет | тени спрайтами (покрытие из SDF один раз на ключ, объединение 'darken'), поля теней и маска листвы на tq = ⌊кадр/4⌋·4, зерно+неровность одним кешем | `tools/verify/budget.py` → «медиана худшего пресета 19.9 мс = 12.8 полнокадровых multiply этой машины (бюджет 8 мс)», облако без GPU; пробы и gate 10/10 зелёные | f1a3e1a |

## Итог куска

- Playground: **https://robvagin.github.io/relief-diagrams/** · калибровка рельса: **https://robvagin.github.io/relief-diagrams/_lab.html** (`?view=_light|_ruler|_float|_grain`)
- Слева рельс (4 вида _lab + образец гейта) и все `lab/<сцена>/v<N>.html` из `lab/index.json` (собирает `tools/site.py` в pages.yml); в центре живой кадр в iframe `?embed=1`; справа панель v2 (видна всегда, < 768 px нижний лист открыт) строится из деклараций сцены и водит её через `Scene.set`. Тема, сид, Copy link (`?v=…&theme&seed&set.k=v`), PNG (форматы §6.8 у сцен рельса), Replay, Pause; хоткеи P R E I J/K
- Проверка: `python3 tools/build.py --check` · `python3 vendor/gate/gate.py dist/_lab.html` (10/10) · `python3 vendor/gate/gate.py --negative` и `--negative --sample dist/_lab.html` · `python3 tools/verify/probes.py --negative` · `python3 tools/verify/budget.py` · `python3 tools/site.py --serve` (playground по http)

### Решения (вместо NOTES.md, чтобы сессии не сталкивались)

- 2026-10-05 · случайность рельса: база из `ctx.randNoise` (4 числа, затем reset), слои cyrb128+sfc32 от базы на назначение (канопи, неровность, фазы плавания по id плашки): соседи не сдвигают поток сцены (L11)
- 2026-10-05 · пружина §7.5 считается аналитически (критическое демпфирование), не полу-неявным Эйлером: тот же кадр при любом пути к нему
- 2026-10-05 · «юбка» AO (0,04) ведётся ручкой Контакт (0,04 при 0,12; 0 выключает контактный слой целиком)
- 2026-10-05 · лампа поднимает альбедо в пятне (ночь ×(1 + 2,6·pool), день ×(1 + 0,3·pool)): без этого на базальте пятно не читается
- 2026-10-05 · H панель не прячет: приказ «панель видна всегда» главнее хоткея §6.10
- 2026-10-05 · бюджет: поля теней и маска листвы строятся на tq = ⌊кадр/4⌋·4, спрайты покрытия из SDF в LRU-кеше. Ловушка для проб: подмена функций света в живой странице не сбрасывает кеш, пока не сменился ключ (свет, плашки)
- 2026-10-05 · варианты в `lab/` меряют канвас до того, как embed снимает место их панели (кадр сплющен в iframe). Playground лечит это `resize` после подключения; в самих файлах лучше ставить класс `is-embed` до `KIT.scene.start` (их файлы, не мои)

### needs-human

- сила листвы `canopy` и нужна ли она; ночная лампа (усиление пятна 2,6·pool, плотность тени 0,30)
- бюджет кадра на маке владельца: `python3 tools/verify/budget.py` (облако без GPU: медиана 13–20 мс, p90 39–58 мс при полнокадровом multiply 1,55 мс; на GPU-канвасе ожидается в разы меньше)
- акцент, пресет света по умолчанию сцен, амплитуда плавания — ручками в playground

### Что осталось

- `dist/scenes/`, `dist/relief.html`, стенд и контакт-лист — после слияния вариантов на рельс (Ф1–Ф2); сцены переезжают со своего света на `src/light/` через `RELIEF.frame(ctx, {plates, floor, print})`
- P-R1, P-T1, P-C2, P-W как пробы-файлы (P-W проверен разово: 390 · 768 · 1280 · 1440 без горизонтали, панель на 768 = 37–39 % кадра)
- SVG-выгрузка: печать сцен в SVG через `svgPrint(plate, F)` у самих сцен

---

## Волна 3 · приказ владельца «всё не то» (главнее волны 2)

Skills applied: autonomous-build-loop, naryad-crafting, panel-canon, motion-kinematics-canon, ai-presence-canon, gates-that-prove, acceptance-harness, solid-viz-builder (+ references/pseudo-3d-layers.md), canvas-frame-budget, canvas-scene-covers, single-file-delivery-canon, generative-fragment-handoff, gfonts-canon, adaptive-typography, design-tokens-oklch, web-ui-canon, responsive-canon, release-scrub; vendor/panel-v2/PANEL_V2.md

| время (UTC) | пункт | что сделано | чем проверено | хеш |
|---|---|---|---|---|
