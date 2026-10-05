# Журнал · cloud/var-desk-ledger

Skills applied: autonomous-build-loop, panel-canon (+ vendor/panel-v2/PANEL_V2.md), motion-kinematics-canon, canvas-frame-budget, solid-viz-builder, dataviz (§7.9)

Ответственный: Claude Code (облако), сессия https://claude.ai/code/session_01NaVCDiSYuufc1cLkGRErgr

| время (UTC) | пункт | что сделано | чем проверено | хеш |
|---|---|---|---|---|
| 2026-10-05T12:56:03Z | desk v1 | ядро варианта `lab/desk/_core/` (свет §7.2, тени по приёмникам §7.3 спрайтами с max-объединением, материал §7.4, движение §7.5, адаптер DG.panel поверх Podacha.Panel v2), сборка `lab/desk/build.py`; v1 «Дробление» §7.6 A | Chromium: кадр 5 мс (было 77), ошибок 0; метрики P-R1 на кадре: air .42 · z3 1 · z2 3 · overlaps 1 · min side 7.3u | 3989684, ea52bc5 |
| 2026-10-05T12:56:03Z | desk v2 | «Колонка героя»: слайд по донору pitch-composer, герой 0.382 ширины × 0.618 высоты, число вписано в ширину, остальное сеткой 12 колонок | Chromium, день и ночь (лампа) | 3c95613 |
| 2026-10-05T12:56:03Z | desk v3 | «Лотки»: группы Book · Checks · Agents на плашках z1, виджеты z2 бросают тень на лоток, прочие напечатаны на лотке | Chromium; тень на лоток короче и резче, чем на пол | 82a2482 |
| 2026-10-05T12:56:03Z | ledger ядро | `_core/charts.js`: столбцы (плашки z1, band 0.28, зазор 2 px), линия (печать, маркеры-диски ≥ 8 px), кольцо (дуги-плашки, уровни = серии), таблица (лист z1), число (плашка z2); одна ось: ≥ 2 серий = индекс Oct 2025 = 100; подсказка z3 + перекрестие; T = таблица | node --check, Chromium по 5 формам | 3ef30ae |
| 2026-10-05T12:56:03Z | ledger v1 | «Один лист»: одна форма на всё поле | 5 форм, ручка двигает кадр | 089cf3a |
| 2026-10-05T12:56:03Z | ledger v2 | «Пять видов»: выбранная форма 0.618 в рельефе, четыре листа z1 напечатаны плоско, клик по листу выбирает форму; портрет 768 = герой сверху | Chromium 1440 и 768 | 64b2469, 6315f5a |
| 2026-10-05T12:56:03Z | ledger v3 | «Орбита»: кольцо стадий в центре, радиальные столбцы r0 → r0 + v/max·(R − r0) (донор radial), полярная линия, солнечные слои (sunburst), таблица с выносками по y источника, число на диске z2 | Chromium, день и ночь | 87ccf94 |
| 2026-10-05T12:56:03Z | паспорта + гейт | паспорт рядом с каждым вариантом по `vendor/passport.schema.json` | `python3 vendor/gate/gate.py lab/desk` и `lab/ledger`: каждый вариант 9/10; красный только пункт 2 (2-panel-live ищет `-val`, 2-kit ищет KIT-PANEL): профиль гейта под панель v2 = Ф0.4 сессии playground | 77b6477 |

## Где смотреть

- Pages: https://robvagin.github.io/relief-diagrams/ (playground, список слева); прямые ссылки https://robvagin.github.io/relief-diagrams/lab/desk/v1.html … v3.html и https://robvagin.github.io/relief-diagrams/lab/ledger/v1.html … v3.html
- Пересобрать и проверить: `python3 lab/desk/build.py` · `python3 lab/desk/build.py --check` · `python3 vendor/gate/gate.py lab/desk` · `python3 vendor/gate/gate.py lab/ledger` · `python3 tools/clean_check.py`
- Правится `lab/<сцена>/v<N>.scene.js` и `lab/desk/_core/*`; собранные `v<N>.html` руками не правятся

## Что осталось и needs-human

- needs-human: раскладка desk из трёх (дробление · колонка героя · лотки) и герой по умолчанию; композиция ledger (один лист · пять видов · орбита); сила рельефа столбцов ledger на z1 (тень 4 px едва видна, ручка «Шкала высот»)
- после слияния рельса `src/light/` варианты переезжают на общий свет (сейчас свой `lab/desk/_core/relief.js` по §7.2–7.4)
- гейт пункт 2 позеленеет с профилем панели v2 (Ф0.4); SVG-выгрузка у вариантов не объявлена (Scene.export svg = null)
- на 390 px мелкий текст виджетов desk упирается в пол кегля 7–8 px и местами наезжает: нужна мобильная раскладка
- ledger v3: радиальные столбцы от нуля почти равны (честно, но плоско); развилка: оставить или показать прирост к прошлому месяцу
