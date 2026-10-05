---
name: solid-viz-builder
description: >-
  Build and extend single-file, zero-dependency HTML "builders" that render interactive
  3D-volumetric data/identity visuals in grayscale — extruded prisms, layered cakes,
  particle fields — on one shared builder-kit (left panel from state-paths, Motion pad,
  reveal+transport, XYZ gizmo, label pills, JSON data in/out, SVG/PNG). Reference builders:
  Hexbin (density towers), Sunburst (hierarchy cake), Particle Dance (motion field). Use
  whenever the user wants a new interactive 3D data builder / dashboard / "конструктор" /
  "скелетон", a volumetric chart that tilts and rotates, big-data density as volume,
  hierarchy as a layered cake, or wants to fix/extend an existing skeleton (occlusion,
  walls disappearing, tilt range, labels through geometry, presets, data input, export).
  Триггерить и на русском: «сделай билдер / конструктор / скелетон / вариатив», «3D-дешборд»,
  «объёмная диаграмма которая крутится», «плотность объёмом», «многослойный пирог», «частицы»,
  «пропадают грани / стенки», «подписи проходят сквозь», «добавь пресеты / дату / экспорт».
  Enforces the shared grammar and the hardened 3D render pipeline. Single-file HTML, no CDN/npm.
---

# Solid Viz Builder — линия объёмных дата-билдеров на одном ките

Ты работаешь с **линией одностраничных HTML-билдеров**: каждый — один `.html`, **ноль зависимостей**
(всё инлайн, никаких CDN/npm), серые чернила по бумаге, моно-типографика, векторная имитация 3D на
2D-canvas. Все они говорят на одной грамматике — «builder-kit» — и рендерят объём одинаковым способом.

Эталоны (в `templates/`, это рабочие реализации, а не псевдокод):
| Билдер | Архетип данных | Данные (input) | Особое в рендере |
|---|---|---|---|
| **Hexbin** (`templates/Hexbin.html`) | плотность big-data | облако точек (count/clusters/seed → хекс-биннинг) | башни-призмы; **per-object** сорт по наземной глубине |
| **Sunburst** (`templates/Sunburst.html`) | иерархия | дерево JSON `{name,value,children}` | многослойный «пирог»; **тесселяция + cull + global painter** |
| **Particle Dance** (`templates/ParticleDance.html`) | движение/паттерн | `values[]` + label, 16 сид-паттернов | частицы/оси, не сплошная геометрия |

## Железное правило: копия-основа
**Скелеты не редактируются на месте.** Новый вариатив = **копия ближайшего эталона** в отдельном файле.
Наследуешь весь «хром» (панель, конфиг, камеру, Motion pad, reveal, пилюли, гизмо, экспорт, H) и меняешь
только **ядро формы** (`layout*` + `buildFaces`/рендер геометрии). Выбор эталона по тому, как объекты
стоят в глубине (см. ниже — это определяет стратегию сортировки).

## Что читать под задачу
- **Как рисовать объём правильно и быстро** (главное) → `references/render-3d-architecture.md`.
  Здесь решение бага «пропадают стенки высоких», правило per-object vs interleave, back-face cull, seal.
- **Панель, состояние, пресеты, конфиг** → `references/builder-kit-grammar.md`.
- **Камера, гизмо, reveal, Motion pad, подписи-пилюли (+ depth-occlusion «пук»)** → `references/interaction-labels-motion.md`.
- **Данные вход/выход, экспорт** → `references/data-io-and-exports.md`.
- **Проверка перед сдачей** → `references/verification.md`.

## Канон в двух экранах (то, что нельзя ломать)

**1. Один `state` + пути.** `getPath('a.b.c')`/`setPath('a.b.c',v)`. Панель генерится из деклараций
`[путь, имя, min, max, step]`: сигнатура `(0,1,1)` → **тумблер**, иначе слайдер + числовой инпут
(можно за пределы шкалы). Селекты — отдельной строкой. Группы сворачиваемые. Дефолт — **Clean**.

**2. Вкладки Scene / Data / Export.** Порядок Scene у дата-билдеров: `Presets → <осн. группа> →
Motion pad → Camera`. Сверху **пресеты** (≥3 комбинации масштаб×вариант×ракурс) и **Look** (Clean/Detailed).

**3. Дом-камера = вид сверху ¾.** В этой проекции (`rotY(yaw)→rotX(tilt)`, перспектива `fov/(dist+z)`)
крышки видны при **отрицательном** tilt. Дом ≈ `tilt −28…−32`. **Tilt без клэмпов** (полный диапазон,
можно смотреть сверху/снизу). drag — вращение, wheel — zoom.

**4. Объём — векторная имитация.** Painter (сорт по глубине) + серые градации + ламберт-затенение по
нормали. **XYZ-гизмо** справа-снизу `{W−72,H−72}` r≈46 (X=accent/Y=ink/Z=muted, ближняя ось ярче,
отрицательная пунктиром), драг ×2 вертит модель, прячется по H.

**5. Движение.** `@motion-core` **Motion pad** (углы slow/fast/soft/raw → {speed, ease}) — один регулятор,
Speed-слайдер двусторонне синхронен. **Reveal** появления (стадии + стаггер + интро-полуоборот),
транспорт снизу **⟲ Replay · Loop · Hold**. Мягкий S-изинг по умолчанию.

**6. Подписи-пилюли.** Персистентные по ключу, lerp-трекинг к якорю, релаксация коллизий, клик = выбор.
**Depth-occlusion:** если >70% пилюли перекрыто геометрией БЛИЖЕ её якоря — плавно гаснет+сжимается и
возвращается «пуком» (ease-out-back). Кликабельны только видимые.

**7. Данные и экспорт.** Data-таб: сид-генератор + **реальный вход** (JSON под тип: облако / дерево /
серии / values). Config Save/Load = полное состояние, загрузка **merge (deepMerge), не замена**.
Export **SVG** (вектор, из тех же граней) + **PNG** (`toDataURL`). **H** прячет UI и гизмо (чистый кадр).

**8. Палитра.** Серые градации по умолчанию (`gLight↔gDark`, стенки ×`side`); акцент точечно
(выбор). Опционально accent/ink/category. Бумага `#f4f3f0`, чернила `#1a1a1a`, accent `#f0435c`.

## Порядок работы над новым билдером
1. Скопируй эталон, чей **способ стоять в глубине** совпадает (разделённые объекты → Hexbin;
   вложенные/пересекающиеся → Sunburst; частицы → Particle Dance).
2. Замени только `layout*`/геометрию ядра между `@core-begin/@core-end` + `buildFaces`.
3. Пропусти через `references/verification.md` (node --check + @core-ассерты + SVG→PNG превью с 3–4 ракурсов).
4. Сдавай готовый файл; правки — по глазу человека.

## Псевдо-3D слоями (дополнение 2026-08-10)

Тела, собранные из плоских срезов — слоёный шар, топография, изо-стопки — живут по своим законам.
Читать `references/pseudo-3d-layers.md` ПЕРЕД постройкой любой стопки. Коротко, чтобы не наступить:
идти 2D-матрицей, а не `preserve-3d` · гасить неактивное ЦВЕТОМ, а не альфой (иначе стопка
становится стеклянной кашей) · разворот применять одним углом сразу по пяти местам · перспектива
по стопке — это СВОЙ разворот у каждого слоя, а не второй «наклон» · материя внутри грани несёт
ту же матрицу · примыкание линии к узлу — параметр, а не правка на глаз.
