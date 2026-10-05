# Templates — рабочие эталоны (копируй их, не редактируй на месте)

Три законченные реализации на одном ките. Новый билдер = **копия того, чей способ стоять в глубине
совпадает** (см. `references/render-3d-architecture.md`, правило A vs B).

| Файл | Билдер | Данные (input) | Стратегия глубины | Что уже внутри целиком |
|---|---|---|---|---|
| `Hexbin.html` | плотность big-data → башни | облако точек (count/clusters/seed; Data-рельс CSV/JSON) | **A** — per-object по наземной z + нижние крышки | панель+пресеты+Look, Motion pad, reveal+транспорт, гизмо, SVG/PNG/config, стили towers/floors/peaks, palette, height-map |
| `Sunburst.html` | иерархия → многослойный «пирог» | дерево JSON `{name,value,children}` (Apply/Load current/Use seed) | **B** — тесселяция + back-face cull + global painter + seal | всё из кита + **подписи-пилюли с depth-occlusion «пук»** + JSON-вход + ламберт-затенение |
| `ParticleDance.html` | движение/паттерн | `values[]`+label, 16 сид-паттернов | частицы/оси (не сплошная геометрия) | тот же кит: tabs, autopanel, deepMerge, Motion pad, транспорт, гизмо, Data input, PNG |

Выбор:
- Разнесённые вертикальные объекты (башни, столбцы, блоки) → **Hexbin** (A).
- Вложенные/пересекающиеся объёмы (кольца, стопки, плотные высокие) → **Sunburst** (B).
- Точки/линии/поле частиц → **Particle Dance**.

Меняешь только ядро формы (`layout*` в `@core` + `buildFaces`/рендер). Весь остальной «хром» наследуется.
