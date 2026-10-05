# Builder-kit grammar — панель, состояние, пресеты, конфиг

Единый «хром» всех билдеров. Скопирован 1:1 в Hexbin / Sunburst / Particle Dance — не изобретай заново.

## Состояние
Один объект `state` с вложенными группами. Пример (Sunburst):
```js
const state = {
  sun:   { inner:.22, ringW:.2, gap:.008, height:.55, hmap:'linear', palette:'gray',
           depthFade:.35, gLight:.86, gDark:.28, side:.72, labels:1, labelMin:.22, edges:1, base:1 },
  cam:   { tilt:-30, yaw:16, dist:3.6 },              // дом = вид сверху ¾
  data:  { title:'Структура', depth:3, branch:4, seed:7, tree:null },  // tree=null → генератор
  motion:{ x:.14, y:.55, speed:1 },                   // дефолт пэда = мягкий S
  anim:  { t:0, loop:0, hold:1.6 }, sel:null };
```
Доступ строками: `getPath('cam.tilt')`, `setPath('data.seed', 9)`. `setPath` ставит `dirty=true`, если
менялись данные (пересборка `layout*`).

## Автопанель из деклараций
`defs.<group> = [[путь, имя, min, max, step], …]`. `buildSliders(elId, defs)` строит строки:
- **Сигнатура `(min=0,max=1,step=1)` → тумблер** (`.sw`), пишет 0/1.
- Иначе слайдер (`accent-color:ink`) + числовой инпут рядом; число можно вводить за пределы шкалы
  (важно для «полного» tilt — набрать 300 руками).
Селекты (Style/Palette/Height map) — отдельная строка `.selrow` с `<select class="tin">`, свой `wireSel`.

## Вкладки и порядок
`#tabs` = Scene / Data / Export (`aria-selected`, `.tab.on`). Порядок Scene у дата-билдеров:
```
Presets  →  <главная группа: Hex towers / Sunburst 3D / …>  →  Motion pad  →  Camera(closed)
```
Мотив: сначала пресеты и суть, движение — после главной группы (не первым). Группы `fieldset`
сворачиваемые кликом по `legend`.

## Пресеты (≥3) + Look
- **Presets** — комбинации масштаб×вариант×ракурс, каждая ставит `state.<group>` + `state.cam` и
  сбрасывает `anim.t=0`. Пример Hexbin: Towers / Blocks(overhead) / City(floors) / Peaks / Round(cylinders).
  Sunburst: Cake / Flat / Tall / Wide. Дом-пресет — первый, `aria-pressed`.
- **Look** = Clean / Detailed сегмент: `LOOKS.clean={'*.edges':0,'*.base':0}`, `detailed={…:1}`. Дефолт Clean.

## Конфиг (полное состояние)
- Save: `JSON.stringify({version, <groups…>, data, motion})`.
- Load: **merge, не замена** — `state.g = {...state.g, ...c.g}` (deepMerge), чтобы старый конфиг не стирал
  новые поля. После load — `syncPanel()` + `rebuild()` (+ обновить data-инпуты).
- `syncPanel()` перечитывает `state` в слайдеры/тумблеры/селекты (вызывать после drag, пресетов, load).

## CSS-костяк (копируется)
`--paper #f4f3f0 · --ink #1a1a1a · --muted #8b8880 · --line #dcdad4 · --accent #f0435c · --panel #fdfdfc`.
Панель 272px слева; `.row` grid `1fr 64px 48px`; `.selrow` grid `1fr 1.35fr`; `.seg`/`.look` кнопки;
`.mpad`/`.mprev`/`#mtrans` для Motion pad+транспорта; `body.noui #panel,#hint,#mtrans{display:none}` (H).
