# Журнал · кусок playground

Ответственный: Claude Code (облако), сессия https://claude.ai/code/session_01QgUKX5ybva4ZaNxBo7hPT2 · ветка `cloud/playground`, пуш в main

Skills applied: autonomous-build-loop, motion-kinematics-canon (+ kin.mjs), canvas-frame-budget (часть 1–2), panel-v2 PANEL_V2.md

| время (UTC) | пункт | что сделано | чем проверено | хеш |
|---|---|---|---|---|
| 2026-10-05T12:50:40Z | 0.1 | automerge cloud/** → main, setup под Chromium облака (playwright 1.56 под chromium-1194) | `bash tools/setup.sh` → «окружение готово», `gate.py --negative` 19/19 на sample | 9e9b904 |
| 2026-10-05T12:50:40Z | 0.2–0.3 | рельс `src/` (свет по SDF, тени по приёмникам, контакт и AO, canopy, зерно синим шумом, кант светом, плавание, адаптер панели v2), `tools/build.py`, `dist/_lab.html`, playground `dist/index.html`, `tools/site.py` в pages.yml | `gate.py dist/_lab.html` → 9/10 (красные 2-panel-live, 2-kit ждут профиля v2); ручка панели playground меняет хеш кадра (gate v1 и _lab) | c8b4cf9, c259d11 |
| 2026-10-05T12:54:40Z | 0.4 | профиль гейта v2 (2-panel-live, 2-kit md5 тела, 2-extend, 3-hardcode, 10-clean + names.h16, --sample); рельс берёт случайность из kit | `gate.py dist/_lab.html` → «итог: 19 зелёных · 0 красных · 0 не доказано · 0 протухло» 10/10; `--negative` и `--negative --sample dist/_lab.html` → «контроль пройден» | 57f7f3b |
