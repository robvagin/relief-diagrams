# Журнал · cloud/var-horizon-agents

Skills applied: vendor/panel-v2/PANEL_V2.md (канон панели v2), README §6–§7, vendor/kit/CONTRACT.md

Ответственный: Claude Code (облако), сессия https://claude.ai/code/session_015jj9XrrRu5nchqhyT2B5Xo

| время (UTC) | пункт | что сделано | чем проверено | хеш |
|---|---|---|---|---|
| 2026-10-05T12:44:37Z | horizon v1 | рельс вариантов (свет §7.2–7.4, тени по приёмникам, кант, зерно, плавание, адаптер панели v2) + гиперболика (Мёбиус, Лэмпинг) + `lab/horizon/v1.html` «Disk» | сборка `python3 lab/horizon/src/build.py`, `node --check`, headless-кадр 1440×900 без ошибок, `clean_check` 0 | см. git log |
| 2026-10-05T12:48:47Z | horizon v2, v3 | v2 «Lens»: диск слева + колонка оснований z1, линии сходятся в фокус по донору 04; v3 «Horizon line»: Кэли в полуплоскость, край диска = линия горизонта с засечками, клин корня вниз | сборка, `node --check`, headless-кадры, клик = ход Мёбиуса к центру, `Scene.set('elev',15)` меняет кадр | см. git log |
| 2026-10-05T12:57:15Z | agents v1 | движок взглядов A1–A5 (разброс PD×exposure, пакет pass·review·fail, доля полей, рой dpd с порогом R-221, группы действий), след займа кольцом акцентом + ломаная на модели, сходимость в узел записи по донору 04, морф 900 мс со ступенькой 15 мс, подсказка z3; `lab/agents/v1.html` «Row»; рельс: маска тени по объединению следов, полосы вокруг большой плашки, поле маски от мусора выборки | сборка, `node --check`, кадры ряд и морф, ховер; кадр horizon 2,1 мс, agents ≈ 24 мс в headless без GPU | см. git log |
| 2026-10-05T12:59:58Z | agents v2, v3 | v2 «Column»: агенты колонкой широких плашек, горизонтальная сходимость донора 04 в узел записи, плашка записи z2 с пятью прочтениями; v3 «Stage»: одна сцена-плашка морфом A1→A5, колонка прочтений z2 (текущее z3), сходимость строк в узел и пунктир к займу; «Ряд» = выбор агента кликом | сборка, `node --check`, headless-кадры без ошибок | см. git log |
| 2026-10-05T13:08:24Z | гейт и паспорта | паспорта `v<N>.passport.json` рядом с каждым вариантом (`build.py --passport`, ручки читаются из собранного файла), `gate.py --stamp`; зерно в ночи по sRGB (было пересвечено), узкий кадр < 560: agents одной сценой, v3 сцена над списком; `shell.src.html` вне обхода гейта; спиннеры скраба сняты | `python3 vendor/gate/gate.py lab/horizon/ lab/agents/` → итог: 114 зелёных · 0 красных · 0 не доказано · 0 протухло (6 × 10/10) | см. git log |

## Итог куска

На Pages (собирается из main, `pages.yml` копирует `lab/`):
- horizon: https://robvagin.github.io/relief-diagrams/lab/horizon/v1.html · v2.html · v3.html
- agents: https://robvagin.github.io/relief-diagrams/lab/agents/v1.html · v2.html · v3.html
- playground: https://robvagin.github.io/relief-diagrams/ (список из `lab/index.json`)

Варианты различаются раскладкой, не цветом:
- horizon v1 «Disk»: диск Пуанкаре по центру, горизонт окружностью · v2 «Lens»: диск слева, колонка оснований z1 со сходимостью в фокус · v3 «Horizon line»: полуплоскость Кэли, край диска = линия горизонта с засечками
- agents v1 «Row»: пять агентов в ряд, сходимость сверху вниз в запись · v2 «Column»: колонка широких плашек, горизонтальная сходимость донора 04 и плашка записи · v3 «Stage»: одна сцена с морфом A1→A5 и колонка прочтений

Проверка: `python3 lab/horizon/src/build.py --check` · `python3 vendor/gate/gate.py lab/horizon/ lab/agents/` (6 × 10/10) · `python3 tools/clean_check.py`

Осталось / needs-human:
- бюджет кадра: headless без GPU показывает horizon ≈ 2 мс, agents ≈ 24 мс (почти всё уходит на композит маски тени); на настоящем GPU не мерил
- SVG-выгрузки нет (`svg: false` в паспорте), PNG через `E` и кнопку PNG с форматом и масштабом
- d3-hypertree (MIT) взят как образец устройства, код не копировался; строку лицензии в `vendor/README.md` не вписал (файл не мой): нужен владелец или сессия playground
- после слияния рельса свет переезжает с `lab/horizon/src/rail.js` на `src/light/`
- на глаз владельца: размер узлов horizon (ρ ≤ 18 по §7.7 выходит мелко), клин корня в v3, морф agents (P/5 на вид), лестница высот прочтений в agents v3 (z2 → z3)
