# Данные (input) и экспорт — «подхватывает всю информацию»

Каждый билдер работает на СИД-генераторе по умолчанию (каркас) и принимает РЕАЛЬНЫЕ данные под свой тип.
`state.data.<custom> != null` ⇒ используем кастом; иначе генератор по `seed`. Смена depth/branch/seed
чистит кастом (`=null`) и пересобирает.

## Форма входа по типу билдера
| Билдер | Модель данных | UI входа | Как подхватывается |
|---|---|---|---|
| **Hexbin** | облако точек `[[x,y],…]` в [−1..1] | seed + count/clusters (каркас); Data-рельс: CSV/JSON точек | `hexBin(points, size)` → ячейки `{x,y,count}`; высота ∝ count |
| **Sunburst** | дерево `{name, value?, children?[]}` | textarea **Dataset(JSON)**: Apply / Load current / Use seed | `layoutSun(root)`: спан ∝ значению; **пилюли берут `name`** |
| **Particle Dance** | `values[]` + `label` | строки Data input + Label; 16 сид-паттернов | значения → амплитуды/паттерн; deepMerge конфиг |

### Sunburst — контракт дерева (пример реального входа)
```json
{ "name":"Company", "children":[
  { "name":"Sales", "children":[ {"name":"EU","value":8}, {"name":"US","value":12} ] },
  { "name":"R&D",  "value":6 },
  { "name":"Ops",  "children":[ {"name":"Cloud","value":4}, {"name":"Support","value":3} ] } ] }
```
Валидатор: узел = объект; если `children` — непустой массив, все валидны рекурсивно; иначе `value` —
конечное число. Значение узла = сумма листьев (агрегируется, не хранится). `treeToJSON(root)` сериализует
текущее дерево обратно в textarea («Load current») — так виден формат.

## Экспорт
- **SVG** — из ТЕХ ЖЕ граней, что и canvas (общий `buildFaces`). Seal-грани получают `stroke=fill
  stroke-width≈0.7`; рёбра — `fill:none stroke:INK`. Полностью векторно.
- **PNG** — `canvas.toDataURL('image/png')`.
- **Config JSON** — Save = полное состояние (`version`+группы+`data`+`motion`); Load = **deepMerge**
  (не теряет новые поля), затем `syncPanel()` + `rebuild()` + обновить data-инпуты.
- **H** — чистый кадр без UI/гизмо для экспорта скринов.

## Data-рельс (живые данные, следующий уровень)
Каркас на сид-генераторе → в проде подменяем источник: локальный CSV/JSON или `window.cowork.callMcpTool`
(в артефактах). Точка подмены — одна функция «дай данные» (`currentRoot()` / points-provider), всё
остальное (раскладка, рендер, пилюли) не меняется. Морфинг на смене данных (лерп cur→target) — как в
Metaballs/Voronoi/Mosaic — переиспользуемый рецепт.

## Аудит экспортов/инпутов (итог сессии)
Все билдеры линии syntax-clean; PNG + config save↔load ключи совпадают; SVG у трёх дешбордов (Hexbin/
Sunburst/Streamgraph), у «шестёрки» — пока только PNG (бэкфилл SVG — отдельная задача). Sunburst имеет
полный JSON-вход + пилюли; Hexbin/Particle Dance — seeded + свои data-входы.
