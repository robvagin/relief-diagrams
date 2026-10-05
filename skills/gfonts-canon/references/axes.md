# Индекс вариативных осей

Полный обход `google/fonts`: 1934 из 1951 файла `METADATA.pb` (99.1%), блок `axes{}` генерируется из `fvar` реальной сборки. Перекрёстно сверено со скрейпом живого CSS API (`fontsource/google-font-metadata`, 553 вариативных семейства) — расхождение 4 записи.

**Не исчерпывающе на 100%:** база имён отстаёт на 40–60 дней, семейства добавленные примерно после середины июня 2026 не охвачены. Снимок на **9 августа 2026**.

Зачем это нужно: ось — это то, чего у конкурента почти наверняка нет, потому что её надо осознанно крутить. Настроенная ширина или оптический размер даёт узнаваемость там, где выбор самой гарнитуры уже ничего не решает.

---

## `wdth` — ширина

95 семейств. Отсортировано по глубине сужения.

| Гарнитура | wdth | Заметка |
| --- | --- | --- |
| **Linefont** | **25–200** | самый широкий диапазон на сервисе, шире Roboto Flex; wght 4–1000 |
| Roboto Flex | 25–151 | 13 осей всего |
| Inconsolata · Science Gothic | 50–200 | моноширинный / Bank Gothic-ремейк |
| Roboto Serif · Anybody | 50–150 | 🔴 Roboto Serif — самый узкий сериф на сервисе |
| Saira · Saira Stencil | 50–125 | |
| Datatype | 50–150 | вычислительный шрифт |
| Georama | 62.5–150 | |
| Archivo | 62–125 | ровно 62.0, не 62.5 |
| Noto Sans + 23 скриптовых варианта | 62.5–100 | Arabic, Armenian, Bengali, Devanagari, Display, Ethiopic, Georgian, Gujarati, Gurmukhi, Hebrew, Kannada, Khmer, Lao, Lao Looped, Malayalam, Mono, Myanmar, Oriya, Sinhala, Tamil, Telugu, Thai, Thai Looped |
| Noto Serif + 11 скриптовых · Noto Serif Display | 62.5–100 | Armenian, Bengali, Devanagari, Ethiopic, Georgian, Hebrew, Khmer, Lao, Sinhala, Tamil, Thai |
| Anek Latin + 9 индийских скриптов | 75–125 | Bangla, Devanagari, Gujarati, Gurmukhi, Kannada, Malayalam, Odia, Tamil, Telugu |
| Encode Sans · Encode Sans SC · Asap · Nunito Sans · Fredoka | 75–125 | |
| **Mona Sans · Hubot Sans** | 75–125 | GitHub; wght 200–900 |
| **Zalando Sans · Special Gothic · Trispace · Truculenta · Tourney** | 75–125 | |
| **Mozilla Headline** | 75–125 | |
| **TikTok Sans** | **75–150** | + opsz 12–36, slnt −6–0 |
| Martian Mono | 75–112.5 | |
| **Roboto** (обычный!) | **75–100** | 🔴 не Flex и не Serif — сам Roboto несёт ось ширины |
| **IBM Plex Sans** | **75–100** | 🔴 вариативный, а не статика — см. поправку в каталоге |
| Cabin · Open Sans · Pathway Extreme · Bricolage Grotesque · League Gothic · Instrument Sans | 75–100 | |
| **Radio Canada · Tektur · Ubuntu Sans · DynaPuff** | 75–100 | |
| Merriweather | 87–112 | + opsz 18–144 |
| Playfair | 87.5–112.5 | + opsz 5–1200 |
| **Advent Pro** | **100–200** | только расширение |
| Strichpunkt Sans | 100–200 | только расширение |
| Pliant · BioRhyme · Kalnia · Kalnia Glaze · M PLUS Code Latin · Sour Gummy | 100–125 | только расширение |

**Оси wdth НЕТ** (проверено): Recursive, Exo 2, Familjen Grotesk, Inter Tight, Sofia Sans, Kanit, Tomorrow.

---

## `opsz` — оптический размер

27 семейств. Ось меняет рисунок, а не только размер: обычно контраст, рост строчных, апроши и апертуры.

| Гарнитура | opsz | Заметка |
| --- | --- | --- |
| **Playfair** | **5–1200** | предельный диапазон на сервисе |
| Roboto Flex · Roboto Serif · Pathway Extreme | 8–144 | |
| Fraunces | 9–144 | |
| **Merriweather** | **18–144** | |
| **Montagu Slab** | **16–144** | 🔴 слэб, где ось «controls x-height, spacing, contrast and aperture — from low contrast and higher x-height version suitable for long texts, to a tight and high contrast display variant» |
| Imbue | 10–100 | |
| Bodoni Moda · Bodoni Moda SC | 6–96 | |
| Bricolage Grotesque | 12–96 | |
| Jaro | 6–72 | санс, не сериф |
| Literata · Newsreader | 6–72 | |
| Ballet | 16–72 | |
| Texturina · Truculenta | 12–72 | |
| Big Shoulders · Big Shoulders Inline · Big Shoulders Stencil | 10–72 | |
| Source Serif 4 | 8–60 | |
| DM Sans | 9–40 | |
| TikTok Sans | 12–36 | |
| Inter | 14–32 | |
| Piazzolla | 8–30 | |
| Hedvig Letters Serif | 12–24 | |
| Nunito Sans | 6–12 | узкий диапазон |

---

## `slnt` — наклон

22 семейства. Настоящий наклон, не курсив: рисунок тот же, просто скошен.

Afacad Flux −14…14 · Gluten −13…13 · Cairo и Cairo Play −11…11 — **двусторонние**, наклон в обе стороны.
Recursive −15…0 · Commissioner −12…0 · Geologica −12…0 · Roboto Flex −10…0 · Science Gothic −10…0 · TikTok Sans −6…0.
Bitcount и 11 его вариантов — все −8…0.

---

## `GRAD` — насыщенность без изменения ширины

Grade добавляет вес, не сдвигая метрики — текст не переливается по строкам. Ключевое для тёмной темы и для тонкой подстройки плотности.

Roboto Flex −200…150 · Roboto Serif −50…100 · Signika −30…0.
Google Sans Flex 0…100 и Google Sans −50…200 — по скрейпу живого CSS, в открытом репозитории их нет, METADATA.pb не подтверждает.

---

## Кастомные оси

Описания — из официального реестра Google `axisregistry` и `DESCRIPTION.en_us.html` авторов.

### Формообразующие

| Тег | Где | Диапазон | Что делает |
| --- | --- | --- | --- |
| **FLAR** | Commissioner | 0–100 | «the stem terminals go from straight (0%) to develop a swelling (100%)» — прямые окончания отращивают наплыв |
| **VOLM** | Commissioner | 0–100 | «expands and exaggerates details» — засечки становятся клиновидными |
| **SOFT** | Fraunces | 0–100 | «wetness/inkiness» — мягкость и чернильность формы |
| **WONK** | Fraunces | 0–1 | переключатель «кривых» альтернатив |
| **CTRS** | Science Gothic | 0–85 | «stroke width difference between thick and thin parts» — контраст штриха осью |
| **SHRP** | Geologica | 0–100 | «angular/blunt → increasingly sharp forms» |
| **ROND** | Doto · Wavefont | 0–100 | «angular → increasingly rounded» |
| **CASL** | Recursive | 0–1 | «from sturdy Linear style to friendly energetic Casual style» |
| **CRSV** | Recursive · Geologica · Bitcount ×12 | 0–1 | переключение на курсивные альтернативы (одноэтажные a и g) |
| **MONO** | Recursive · Sono | 0–1 | «Proportional (natural widths) → Monospace (fixed width)» — плавный переход в моноширинный |

### Параметрические — прямое управление скелетом

| Тег | Где | Диапазон | Что |
| --- | --- | --- | --- |
| XOPQ | Roboto Flex | 27–175 | толщина толстых штрихов |
| YOPQ | Roboto Flex · Kumbh Sans | 25–135 · 40–300 | толщина тонких штрихов и волосных |
| XTRA | Roboto Flex | 323–603 | ширина внутрибуквенных просветов |
| YTLC | Roboto Flex · Nunito Sans | 416–570 · 440–540 | высота строчных |
| YTUC | Roboto Flex | 528–760 | высота прописных |
| YTAS | Roboto Flex | 649–854 | выносные вверх |
| YTDE | Roboto Flex | −305…−98 | выносные вниз |
| YTFI | Roboto Flex | 560–788 | высота цифр |

### Эффектные и экспериментальные

| Тег | Где | Диапазон | Что |
| --- | --- | --- | --- |
| MORF | Kablammo 0–60 · Agu Display 0–60 · Honk 0–45 | | «glyphs dance» — морфинг между состояниями, единицы читаются как секунды |
| BNCE | Shantell Sans | −100…100 | прыгающая базовая линия |
| INFM | Shantell Sans | 0–100 | «formal/traditional → informal/unconventional» |
| SPAC | Shantell Sans | −100…100 | трекинг осью |
| EDPT | Nabla | 0–200 | глубина изометрической экструзии |
| EHLT | Nabla | 0–24 | толщина блика на ребре экструзии |
| SHLN | Honk | 0–100 | длина отбрасываемой тени |
| ELSH | Bitcount ×12 · Danfo · Geist Pixel · Handjet | 0–100 (Handjet 0–16) | форма модульного пиксельного элемента |
| ELXP | Bitcount ×12 | 0–100 | раздвижка элементов пиксельной сетки |
| ELGR | Handjet | 1–2 | сколько элементов на ячейку сетки |
| SZP1 / SZP2 | Bitcount Ink ×6 | 0–100 | размер слоя заливки 1 и 2 |
| XPN1 / XPN2 / YPN1 / YPN2 | Bitcount Ink ×6 | −100…100 | позиция слоя заливки по X и Y |
| BLED | Sixtyfour · Sixtyfour Convergence · Workbench | 0–100 | растекание люминофора CRT |
| SCAN | те же три | −53…100 | толщина строк развёртки |
| XELA / YELA | Sixtyfour Convergence · Wavefont | −100…100 | смещение элементов глифа |
| XROT / YROT | Tilt Neon · Tilt Prism · Tilt Warp | −45…45 | поворот глифа; ограничен ±45° ради читаемости |
| ARRR | AR One Sans | 10–60 | «AR Retinal Resolution» — компенсация под разрешение AR/VR |
| YEAR | Climate Crisis | 1979–2050 | «shows in a metaphoric way the effect of time» — форма привязана к году |

### Оси реестра без живых семейств

`GEOM` · `JITT` · `ENLA` · `GDOP` · `ZROT` · `YEXT` — определены в реестре Google, но ни одно семейство каталога их не несёт. Реестр шире отгруженного каталога, поэтому существование тега не значит, что ось где-то реально работает.

---

## Насколько оси вообще используют

По краулингу HTTP Archive за июль 2025: вариативные шрифты объявлены на **39.4%** десктопных и **41.3%** мобильных сайтов. Из них реально крутят: `wght` 57–61%, `FILL` и `opsz` по 35–39%, `GRAD` ~27%, `wdth` и `slnt` 17–19%.

То есть **ширину использует меньше пятой части** тех, у кого она вообще есть — настроенная ось ширины остаётся дешёвым способом не выглядеть как все.
