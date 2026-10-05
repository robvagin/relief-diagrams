# vendor · откуда что и под какой лицензией

Снимки 2026-10-05. Своё взято из рабочей папки владельца (арсенал на коммите `55aa30c`), чужое с указанной лицензией. Комментарии с именами проектов-источников при копировании обезличены (закон чистоты публичного репо), код не менялся

| путь | источник | md5 источника | лицензия | дельта |
|---|---|---|---|---|
| `panel-v2/panel.js` | `_arsenal/podacha/kit/panel.js` | 42f106f2b77538c42c0e15dce3979671 | своё | шапка-комментарий обезличена |
| `panel-v2/panel.css` | `_arsenal/podacha/kit/podacha.css`, строки 31–40, 131–182, 216–222 | 51a453e1fd121b5d5e54306a450fbb67 | своё | выдержка verbatim |
| `panel-v2/house.tokens.css` | `_arsenal/house/house.tokens.css` | 3ed88e95a0b600ab6662986a344f2231 | своё | нет |
| `panel-v2/PANEL_V2.md` | `_arsenal/house/HOUSE_STYLE.md` §2, §4–§6 + шапка `panel.js` | fbe48488894f0a8a8e770938a9363ada | своё | сведено в один канон |
| `kit/kit-scene.js` | `_arsenal/kit/kit-scene.js` | 5a5a5b10d0808d024f27479446285a90 | своё | нет |
| `kit/kit-panel.js` | `_arsenal/kit/kit-panel.js` | 79651ac8721ce0cc4a0827debcbd02b4 | своё | нет; только для гейта и доноров |
| `kit/inline.py`, `stamp_kit.py`, `verify.py`, `CONTRACT.md`, `README.md` | `_arsenal/kit/` | см. `_arsenal` `55aa30c` | своё | комментарии обезличены |
| `gate/gate.py`, `gate/README.md`, `gate/sample/` | `_arsenal/gate/` | gate.py eb577dca41cdb8302645cd8562af126d | своё | комментарии обезличены; `паспорт.json` → `passport.json` (гейт читает оба; `--stamp` пишет кириллическое имя, Ф0.4 переводит на латиницу) |
| `passport.schema.json` | `_arsenal/passport.schema.json` | 7c13cf1eb49339cc373086290e6afdee | своё | нет |
| `fonts/Geist-Variable.woff2`, `GeistMono-Variable.woff2` | npm `geist` 1.7.2 (vercel/geist-font) | | SIL OFL 1.1, `fonts/OFL.txt` | нет; wght 100–900, латиница и кириллица |
| `noise/bluenoise-64.png`, `bluenoise-128.png` | Christoph Peters через `Calinou/free-blue-noise-textures` | | CC0 1.0, `noise/LICENSE.txt` | нет |
| `libs/simplex-noise.esm.js` | npm `simplex-noise` 4.0.3 | | MIT | ESM: при инлайне обернуть в IIFE |
| `libs/perfect-freehand.esm.js` | npm `perfect-freehand` 1.2.3 | | MIT | ESM: при инлайне обернуть в IIFE |
| `libs/d3-hierarchy.min.js` | npm `d3-hierarchy` 3.1.2 | | ISC | нет (UMD) |

Доноры для чтения лежат в `../donors/` (фрагменты арсенала с паспортами и движки публичной галереи, прошедшие пробу «без имён»). Навыки в `../skills/`: снимки хаба владельца, имена проектов в примерах обезличены
