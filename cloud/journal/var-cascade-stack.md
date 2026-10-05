# Журнал · cloud/var-cascade-stack

Skills applied: autonomous-build-loop, panel-canon, motion-kinematics-canon, solid-viz-builder, canvas-frame-budget, single-file-delivery-canon, vendor/panel-v2/PANEL_V2.md

Ответственный: Claude Code (облако), сессия https://claude.ai/code/session_01QXqAnC167MADjU6coxjQ5Y

Кусок: сцены `cascade` и `stack`, по 3 варианта, файлы `lab/cascade/`, `lab/stack/`. Сборка `python3 lab/cascade/src/build.py` (исходники в `lab/<сцена>/src/`, общий свет `lab/cascade/src/relief-lite.js`)

| время (UTC) | пункт | что сделано | чем проверено | хеш |
|---|---|---|---|---|
| 2026-10-05T12:41:16Z | cascade v1 | радиальное дерево: площадь диска = объём (r = K·√v, один K), дистанция = доля, засечки 10 %, хабы z2 оседают, листья z1 плавают; панель v2 справа всегда | build --check сходится; node --check; headless: 0 ошибок, P-R1 discOverlaps 0, labelDiscCross 0, air .93 (выше коридора), top3 .12 (ниже .22) | e8a2721 |
| 2026-10-05T12:43:05Z | cascade v2, v3 | v2 веер: книга у левого края, стадии одной полудугой 150° вправо, ветви читаются линейкой; v3 мобиль: ярусы сверху вниз, коромысло висит в центре масс (Σw·x = 0 точно), нить = доля в share | build --check, headless 0 ошибок; P-R1 overlaps 0, label×disc 0 в обоих | 7dd8ed4 |
