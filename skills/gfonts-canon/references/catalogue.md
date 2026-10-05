# Каталог проверенных семейств

Снимок на **6 августа 2026**, ревизия после самоаудита **9 августа 2026** (две ошибки исправлены, см. «Узкие серифы» и «Поправки к прежним записям»). Всё сверено на `google/fonts` (`METADATA.pb`, `DESCRIPTION.en_us.html`), оси — блоком `axes {}` и ответами CSS2, фичи цифр — по GSUB двоичных сборок, ранги — по архиву Google Fonts Analytics. Формулировки в кавычках — дословно от авторов; без кавычек — оценка.

Каталог **ускоряет**, но не заменяет проверку: библиотека пополняется, ранги двигаются. Перед серьёзной выдачей ранги переснять.

---

## Серифы по контрасту штриха

Контраст — первый признак отбора: высокий контраст = волосяные штрихи = ломается на мелком кегле и на экране.

### Низкий контраст, заявлено автором

| Гарнитура | Веса | Оси | Цитата | Рост | Парный |
| --- | --- | --- | --- | --- | --- |
| Petrona | var 100–900 + ital | wght | «soft curves of low stroke contrast», «from headlines to body text» | большой | — |
| Alegreya | var 400–900 + ital | wght | «low stroke contrast throughout» (Typographica) | средний | Alegreya Sans |
| Vollkorn | var 400–900 + ital | wght | «dark and meaty serifs» | средне-большой | — |
| Domine | var 400–700 | wght | «Clarendon, Century, Cheltenham and Clearface»; «shines at px sizes 14 and 16» | средний | — |
| Charis SIL | статик 400/700 + ital | — | на базе Bitstream Charter | большой | — |
| Gentium Book Plus | статик 400/700 + ital | — | низкий контраст ради мелкого кегля | средний | — |

### Низко-умеренный

| Гарнитура | Веса | Оси | Помётка | Парный |
| --- | --- | --- | --- | --- |
| Roboto Serif | var 100–900 + ital | opsz 8–144, **wdth 50–150**, GRAD −50–100 | «useful anywhere (even for app interfaces)»; самый богатый набор осей в библиотеке | Roboto |
| Literata | var 200–900 + ital | opsz 7–72 | «headline, paragraph, and caption text»; на GF печатная версия, не e-book | — |
| Merriweather | var 300–900 + ital | opsz 18–144, **wdth 87–112** | «slightly condensed letterforms»; ранг #19 | Merriweather Sans |
| Newsreader | var 200–800 + ital | opsz 6–72 | «primarily intended for continuous on-screen reading» | — |
| IBM Plex Serif | статик 100–700 + ital | — | — | IBM Plex Sans (⚠️ вариативный, см. поправки) |
| **Montagu Slab** | var 100–700 | **opsz 16–144** | 🔴 ось меняет сам жанр: «from low contrast and higher x-height version suitable for long texts, to a tight and high contrast display variant with prominent upturned tails» | — |
| Gelasio | var 400–700 + ital | wght | метрически совместим с Georgia | — |
| Libre Baskerville | var 400–700 + ital | wght | «a little less contrast» чем оригинал; «optimized for body text (typically 16px)» | — |
| Libre Caslon Text | var 400–700 + ital | wght | «hand lettering artist Caslon interpretations typical of 1950s advertising» | — |
| Piazzolla | var 100–900 + ital | opsz 8–30 | метаданные GF помечают DISPLAY, автор пишет про мелкий кегль | — |

### Умеренный

| Гарнитура | Веса | Оси | Цифры | Парный |
| --- | --- | --- | --- | --- |
| Source Serif 4 | var 200–900 + ital | opsz 8–60 | **табулярные lining по умолчанию** | Source Sans 3 |
| Noto Serif | var 100–900 + ital | **wdth 62.5–100** | — | Noto Sans |
| PT Serif | статик 400/700 + ital | — | — | PT Sans |
| Spectral | статик 200–800 + ital | — | **четыре стиля фигур**: tabular lining, tabular oldstyle, proportional lining, proportional oldstyle | — |
| Andada Pro | var 400–840 + ital | wght | «medium contrast type for text» | — |
| Faustina | var 300–800 + ital | wght | — | — |
| Manuale | var 300–800 + ital | wght | — | — |
| Frank Ruhl Libre | var 300–900 | wght | ивритское возрождение, латиница вторична | — |
| EB Garamond | var 400–800 + ital | wght | ⚠️ переключение стилей фигур не работает **в Microsoft Word** (открытый баг georgd/EB-Garamond#210); в самом файле подстановки исправны; малый рост строчных | — |

### Высокий контраст — только дисплей

| Гарнитура | Факт |
| --- | --- |
| Playfair Display | «high contrast and delicate hairlines»; автор прямо отдаёт основной текст Georgia или Gelasio |
| Fraunces | «extremely high contrast»; «is a display typeface»; дефолты в файле WONK **1** · SOFT **0** · wght **900** · opsz **9** |
| Bodoni Moda | дидон; opsz 6–96 компенсирует, но волосяные остаются |
| Cormorant Garamond | «a free display type family»; малый рост строчных |
| Instrument Serif | дисплейная, один вес, узкая |
| Crimson Pro · Tinos | умеренно-высокий; Tinos — метрический клон Times |
| Noto Serif Display | «for texts in larger font sizes» |
| Cardo · Sorts Mill Goudy | старостильные, малый рост; у Sorts Mill нет жирного вообще |

---

## Слэбы

Низкий контраст заложен конструкцией.

| Гарнитура | Веса | Контраст | Помётка |
| --- | --- | --- | --- |
| Bitter | var 100–900 + ital | «little variation in stroke weight» | «large x-heights»; Regular плотнее обычного |
| Solway | статик 300–800 | «monoline structure and minimal stroke contrast» | курсива нет |
| Crete Round | статик 400 + ital | «tall x-height, low contrast and sturdy slabs» | один вес |
| Podkova | var 400–800 | «monoline slab serif with diagonal terminals» | курсива нет; кириллица родная |
| Arvo | статик 400/700 + ital | «monolinear-ish, but has a tiny bit of contrast» | два веса |
| Zilla Slab | статик 300–700 + ital | низкий | фирменный шрифт Mozilla |
| Roboto Slab | var 100–900 | низкий | курсива нет |
| Rokkitt | var 100–900 + ital | низкий | «intended for use as a display font» |
| Epunda Slab | var 300–900 + ital | низкий | на GF с марта 2025 |
| Besley | var 400–900 + ital | «retaining a traditional stroke width variance» | Clarendon; «a larger x-height was chosen» |
| Aleo | var 100–900 + ital | низко-умеренный | «the slab serif companion to Lato» |
| Martel | статик 200–900 (без 500) | латиница на базе Merriweather | курсива нет; Martel Sans |
| Eczar | var 400–800 | низко-умеренный | курсива нет; латиница + деванагари |

---

## Гротески по рангу распространённости

Ранг из 1951 · тренд за 12 месяцев.

### Длинный хвост

| Гарнитура | Ранг | Веса | Оси | Отличие | Цифры |
| --- | --- | --- | --- | --- | --- |
| Funnel Sans | #1077 · #512 | var 300–800 | wght | квадратные и круглые формы вперемешку | tnum, pnum |
| Host Grotesk | #1030 · #509 | var 300–800 | wght | uniwidth — ширина знака держится через все веса | нет в сборке GF |
| Familjen Grotesk | #930 · #555 | var 400–700 | wght | «large notches (ink traps), large x-height, closed apertures» | tnum, pnum, zero |
| Anek Latin | #919 · #498 | var 100–800 | **wdth 75–125** | две оси; часть 10-скриптовой системы | tnum, zero |
| Pathway Extreme | #868 · #666 | var 100–900 | **wdth 75–100**, opsz 8–144 | «narrow grotesque sans» | полный набор |
| Wix Madefor Display / Text | #863 / #777 | var 400–800 | wght | геометрический; у Display курсива нет | нет |
| Gabarito | #737 · #360 | var 400–900 | wght | «light-hearted geometric» | tnum, pnum |
| Darker Grotesque | #629 · #513 | var 300–900 | wght | «post-modern and brutalism» | нет |
| Golos Text | #612 · #297 | var 400–900 | wght | под госсайты и соцсервисы; кириллица первична | tnum, onum, lnum, pnum |
| Geist | #498 · #156 ↑ | var 100–900 | wght | Vercel; «Inter, Univers, SF Mono, SF Pro, Suisse International» | tnum, pnum, sinf |
| Onest | #488 · #187 ↑ | var 100–900 | wght | «симбиоз геометрического и гуманистического гротеска» | tnum, pnum, afrc |
| Hanken Grotesk | #490 · #189 ↑ | var 100–900 | wght | «inspired by the classic grotesques» | нет |
| Instrument Sans | #443 · #153 | var 400–700 | **wdth 75–100** | 12 стилистических сетов | tnum, pnum |
| Sofia Sans | #414 · #177 | var **1–1000** | wght | «technical sans serifs… humanistic details» | tnum, pnum |
| Commissioner | #388 · #268 | var 100–900 | slnt −12–0, **FLAR / VOLM 0–100** | кастомные оси отращивают засечки на терминалах | нет |
| Be Vietnam Pro | #268 · #149 | статик 100–900 | — | «is a Neo Grotesk»; вьетнамская диакритика | нет |
| **Inter Tight** | #226 · #97 ↑ | var 100–900 + ital | wght | те же рисунки Inter, апроши поджаты (−48 UPM в Regular); оси opsz **нет**; «does not receive updates… from standard Inter» | tnum, zero |
| Bricolage Grotesque | #201 · #60 ↑ | var 200–800 | **wdth 75–100**, opsz 12–96 | opsz реально меняет рисунок; курсива нет | tnum, onum, lnum, pnum |
| Chivo | #188 · #226 ↓ | var 100–900 + ital | wght | первый гротеск Omnibus-Type | полный набор |
| Schibsted Grotesk | #157 · #74 | var 400–900 + ital | wght | домашний шрифт норвежского медиахолдинга | tnum, pnum, zero |

### Середина

Public Sans #119 · Space Grotesk #111 · Figtree #104 ↑ · **Archivo #85 ↑** · Manrope #60 (#30 по тренду) · Libre Franklin #55 · DM Sans #42.

**Archivo** — единственная на Google Fonts ось ширины, уходящая в expanded (62–125), и самый полный набор фич цифр из всего проверенного. На дефолте wdth 100 неотличим от вездесущего Archivo Black.
**Public Sans** — форк Libre Franklin от дизайн-системы правительства США, табулярные заявлены явно.

### Топ-30 — избегать осознанно

Roboto #1 · Open Sans #2 · Google Sans #3 · Lato #4 · Noto Sans JP #5 · Montserrat #6 · Roboto Condensed #7 · Poppins #8 · Oswald #9 · Inter #10 · Raleway #12 · Noto Sans #14 · PT Sans #16 · Roboto Slab #17 · Merriweather #19 · Playfair Display #20 · Lora #21 · Nunito #22 · Rubik #23 · Work Sans #28.

Roboto, Open Sans, Montserrat, Lato, Poppins, Oswald, Raleway подтверждены как перенасыщенные и независимым краулингом Web Almanac — они в топ-15 всего веба, не только внутри Google Fonts.

### Дисплейные

Archivo Black (900, единственный) · Encode Sans Expanded (статик 100–900, курсива нет) · Red Hat Display (300–900, есть парный Red Hat Text) · League Spartan (100–900) · Unbounded (200–900, финансировался казначейством Polkadot) · Syne (var 400–800, вес и ширина связаны рисунком; автор называет геометрическим, не гротеском).

### Нет на Google Fonts

General Sans · Switzer · Aspekta · Neue Haas Grotesk и любые Helvetica-производные. Проверено: ни `METADATA.pb`, ни присутствия в архиве из 1951 семейства.

---

## Ось ширины — все подтверждённые

Ось полезнее фиксированного узкого начертания. От самой узкой.

| Гарнитура | wdth | Веса | Прочие оси |
| --- | --- | --- | --- |
| Roboto Flex | **25–151** | var 100–1000 | GRAD, XOPQ, XTRA, YOPQ, YTAS, YTDE, YTFI, YTLC, YTUC, slnt −10–0, opsz 8–144 |
| Roboto Serif | **50–150** | var 100–900 + ital | GRAD −50–100, opsz 8–144 |
| Saira | **50–125** | var 100–900 + ital | — |
| Anybody | **50–150** | var 100–900 + ital | — |
| Archivo | **62–125** | var 100–900 + ital | — |
| Noto Sans / Noto Serif / Noto Serif Display | 62.5–100 | var 100–900 + ital | только в узкую сторону |
| Anek Latin | 75–125 | var 100–800 | — |
| Encode Sans | 75–125 | var 100–900 | курсива нет |
| Asap | 75–125 | var 100–900 + ital | — |
| Martian Mono | 75–112.5 | var 100–800 | моноширинный |
| Cabin | 75–100 | var 400–700 + ital | — |
| Pathway Extreme | 75–100 | var 100–900 + ital | opsz 8–144 |
| Bricolage Grotesque | 75–100 | var 200–800 | opsz 12–96 |
| League Gothic | 75–100 | 400 единственный | ширина — единственная переменная |
| Open Sans | 75–100 | var 300–800 + ital | ранг #2 |
| Merriweather | 87–112 | var 300–900 + ital | opsz 18–144 |

**Оси wdth нет** (CSS2 отдаёт 400): Recursive, Exo 2, Familjen Grotesk, **Inter Tight**, Sofia Sans. Kanit и Tomorrow вообще не вариативные.

---

## Отдельные узкие семейства

Sofia Sans Extra Condensed / Condensed / Semi Condensed — var **1–1000** + ital, три отдельных семейства, оси между ними нет.
Archivo Narrow — var 400–700 + ital (родитель идёт 100–900).
Fira Sans Extra Condensed / Condensed — статик 100–900 + ital, под мелкие экраны FirefoxOS.
Barlow Condensed / Semi Condensed — статик 100–900 + ital.
IBM Plex Sans Condensed — статик 100–700 + ital, потолок 700.
Saira Extra Condensed · Encode Sans Condensed — статик 100–900, курсива нет.
Big Shoulders Text / Display — var 100–900, дизайн-система Чикаго, курсива нет.
Antonio — var 100–700, «refined version of Anton… extends the design to smaller headings, menus and buttons».
Abel — 400 единственный, «mono-weight still works well at smaller text sizes».
News Cycle — статик 400/700, ревайвл News Gothic 1908, заявлен и в текст, и в заголовок.
Economica — статик 400/700 + ital, «very condensed… retaining high legibility».
PT Sans Narrow — статик 400/700, «narrow styles for economic type setting», кириллица родная.
Pragati Narrow — статик 400/700, производный от Chivo, деванагари + латиница.
Yanone Kaffeesatz — var 200–700 · Teko — var 300–700 · Khand — статик 300–700 · Six Caps — 400 единственный.
Roboto Condensed — var 100–900 + ital, ⚠️ ранг #7.

## Узкие серифы — исправлено 2026-08-09

⚠️ **Прежняя формулировка «узких серифов и слэбов на Google Fonts нет вообще» была НЕВЕРНА.** Она построена на десяти ответах 404 (Roboto Slab Condensed, Bitter Condensed, Rokkitt Condensed, Zilla Slab Condensed, Arvo Condensed, Noto Serif Condensed, PT Serif Narrow, Archivo Expanded, Chivo Condensed, Rubik Condensed — эти имена действительно не существуют), но из отсутствия десяти имён не следует отсутствие класса. Контрпримеры нашлись:

| Гарнитура | Что это | Проверено |
| --- | --- | --- |
| **Stint Ultra Condensed** | `category: SERIF`, `stroke: SLAB_SERIF`, `classifications: DISPLAY`. Один вес 400, статика. В описании прямо «ultra condensed… serif typestyle» | METADATA.pb, 200 |
| **Playfair** (не Playfair Display!) | Отдельное семейство: **opsz 5–1200**, **wdth 87.5–112.5**, wght 300–900 + курсив. Самый широкий оптический диапазон на Google Fonts. Преемник Playfair Display, доходит до текстовых кеглей | METADATA.pb, 200 |
| Roboto Serif | wdth 50–150 | подтверждено |
| Noto Serif · Noto Serif Display | wdth 62.5–100 | подтверждено |
| Merriweather | wdth 87–112 | подтверждено |

Урок записан в SKILL.md как закон 1-бис: универсальные отрицания проверяются полным каталогом, а не выборкой имён. Серифы на Google Fonts сужаются **осью внутри семейства**, а не отдельным именем — поэтому поиск по имени их и не находил.

**Запопсовано в узких:** Roboto Condensed #7, Oswald #9, Anton (Google сама набирала им PR Chromebook), Bebas Neue (дефолтная замена Impact).

---

## Текст и интерфейс

| Гарнитура | Веса | Оси | Цифры |
| --- | --- | --- | --- |
| Public Sans | var 100–900 + ital | wght | tnum, onum, lnum, pnum — **заявлены явно** |
| Inter | var 100–900 | opsz 14–32 | полный набор + `zero` |
| IBM Plex Sans | статик 100–700 + ital | — | lining, tabular через tnum |
| Source Sans 3 | var 200–900 + ital | wght | lining по умолчанию |
| Work Sans | var 100–900 + ital | wght | проверять |
| Karla | var 200–800 + ital | wght | проверять |
| Hanken Grotesk | var 100–900 + ital | wght | нет |
| Manrope | var 200–800 | wght | потолок 800 |
| Outfit | var 100–900 | wght | шрифт TickPick |
| IBM Plex Sans Condensed | статик 100–700 + ital | — | под плотные таблицы |

## Подтверждённые носители табулярных цифр

**Public Sans** — заявлены явно в README USWDS. **Source Serif 4** — табулярные lining по умолчанию, политика Adobe Originals. **Spectral** — четыре стиля фигур. **Inter** и **Inter Tight** — полный набор + перечёркнутый ноль. **Archivo** и **Chivo** — полный набор tnum/onum/lnum/pnum/zero. **Space Grotesk** — полный набор, перечислен автором. **Golos Text**, **Bricolage Grotesque**, **Pathway Extreme** — tnum, onum, lnum, pnum.

🔴 **EB Garamond** — переключение фигур сломано, рядом с числами не ставить.
🔴 **Host Grotesk** — changelog обещает tnum, в сборке на Google Fonts его нет.

---

# Дополнение 2026-08-09

## Кириллица — проверять всегда

Поле `subsets` в `METADATA.pb`. По имени не угадывается.

**Без кириллицы:** Archivo · Public Sans · Petrona · Newsreader · Outfit · Urbanist · Red Hat Display · League Spartan · Josefin Sans · Cabin · Lexend · Assistant · Signika · Mukta · Syne · Kumbh Sans · Questrial · DM Mono · Inconsolata · Space Mono.

**Есть кириллица (+ext):** Literata · Source Serif 4 · Noto Serif · Golos Text · Sofia Sans · Inter Tight · Geist · Onest · Bitter · Roboto Serif · Alegreya Sans · Source Sans 3 · Fira Sans · PT Sans · Mulish · Nunito Sans · Jost (базовая, без ext) · JetBrains Mono · Fira Code · IBM Plex Mono · Source Code Pro · Martian Mono · Geist Mono · Victor Mono · Cousine · Overpass Mono · Noto Sans Mono · Lilex · Science Gothic · Iosevka Charon.

🔴 **Ловушка:** у **Merriweather Sans** и **Plus Jakarta Sans** объявлен только `cyrillic-ext` **без базового `cyrillic`** — для русского текста ненадёжно, проверять глифы.

## Гуманистические сансы

| Гарнитура | Веса | Оси | Ital | Cyr | Особенность |
| --- | --- | --- | --- | --- | --- |
| Alegreya Sans | статик 100–900 | — | да | да | «humanist sans serif family with a calligraphic feeling»; пара к Alegreya |
| Source Sans 3 | var 200–900 | wght | да | да | «intended to work well in user interfaces»; cv01–cv19 |
| Fira Sans | статик 100–900 | — | да | да | проект Mozilla; вариативной версии нет |
| PT Sans | статик 400/700 | — | да | да, родная | госпроект ParaType 2010; всего два веса |
| Mulish | var 200–1000 | wght | да | да | верх оси 1000 |
| Nunito Sans | var 200–1000 | **YTLC 440–540, opsz 6–12, wdth 75–125**, wght | да | да | четыре оси; не путать с Nunito (#22 по рангу) |
| Merriweather Sans | var 300–800 | wght | да | ⚠️ только -ext | «mild diagonal stress and open forms» |
| Cabin | var 400–700 | **wdth 75–100**, wght | да, настоящий | нет | «humanist sans inspired by Edward Johnston's and Eric Gill's» |
| Signika | var 300–700 | **GRAD −30–0**, wght | нет | нет | signage-гротеск; фигуры изначально табулярные |
| Lexend | var 100–900 | wght | нет | нет | заявлен как снижающий visual stress, «designed with dyslexia in mind» |
| Assistant | var 200–800 | wght | нет | нет | иврит+латиница, латиница вторична |
| Mukta | статик 200–800 | — | нет | нет | «contemporary, humanist, mono-linear»; деванагари первичен |

Исключены как не-гуманисты по формулировке автора: Karla (сама себя зовёт grotesque), Red Hat Text (geometric), Rubik (rounded), Noto Sans («unmodulated»).

## Геометрические сансы вне топа

| Гарнитура | Веса | Оси | Ital | Cyr | Особенность |
| --- | --- | --- | --- | --- | --- |
| Jost | var 100–900 | wght | да | да (без ext) | «inspired by 1920s German sans-serifs» — линия Kabel/Erbar; ⚠️ почти пустой набор OT-фич |
| Outfit | var 100–900 | wght | **нет** | нет | «a beautiful geometric sans»; шрифт TickPick |
| Red Hat Display | var 300–900 | wght | да | нет | «a fresh take on the geometric sans genre… Tempo and Highway Gothic»; пара Red Hat Text |
| League Spartan | var 100–900 | wght | нет | нет | «based on early 20th century American geometric sans serifs» |
| Syne | var 400–800 | wght | нет | нет | «archetypal geometric sans-serif»; с весом расширяется |
| Josefin Sans | var 100–700 | wght | да | нет | «geometric, elegant, with a vintage feeling… 1920s»; ар-деко, потолок 700 |
| Urbanist | var 100–900 | wght | да | нет | «low-contrast, geometric sans-serif inspired by Modernist typography»; ⚠️ минимум цифровых фич |
| Plus Jakarta Sans | var 200–800 | wght | да | ⚠️ только -ext | «Neuzeit Grotesk, Futura, 1930s grotesque» |
| Questrial | 400 — единственный | — | нет | нет | табулярные фигуры заявлены текстом; жанр пограничный |
| Kumbh Sans | var 100–900 | **YOPQ 40–300**, wght | нет | нет | «cap-height:x-height = 3:2» |

## Моноширинные и производные от моно

| Гарнитура | Веса | Оси | Ital | Cyr | Лигатуры | Ноль |
| --- | --- | --- | --- | --- | --- | --- |
| JetBrains Mono | var 100–800 | wght | да | да | **calt** (не liga) | перечёркнутый |
| Fira Code | var 300–700 | wght | **нет** | да | **calt** | перечёркнутый |
| IBM Plex Mono | статик 100–700 | — | да | да | **нет** | перечёркнутый |
| Source Code Pro | var 200–900 | wght | да | да | **нет** | перечёркнутый |
| Space Mono | статик 400/700 | — | да | нет | нет | нет |
| Martian Mono | var 100–800 | **wdth 75–112.5**, wght | нет | да | calt | нет |
| Geist Mono | var 100–900 | wght | да | да | **нет** | **нет** |
| Victor Mono | var 100–700 | wght | да, **рукописно-связанный** | да | calt | нет |
| Inconsolata | var 200–900 | **wdth 50–200**, wght | **нет** | нет | нет | перечёркнутый |
| Cousine | статик 400/700 | — | да | да | нет | нет |
| Overpass Mono | var 300–700 | wght | **нет** | да | **calt + liga** | перечёркнутый |
| DM Mono | статик 300/400/500 | — | да | нет | нет | нет |

Сверены дополнительно: Red Hat Mono · Azeret Mono (ss01–ss16, самый богатый набор) · Spline Sans Mono · Chivo Mono · Noto Sans Mono (**wdth+wght**, кириллица) · Sometype Mono · Reddit Mono (официально «a humanist sans-serif» при категории MONOSPACE) · Anonymous Pro (GSUB пуст полностью) · Syne Mono · Courier Prime.

🔴 Два разоблачения: **Space Mono** задуман Colophon как **редакционный заголовочный**, а не кодерский — «geometric foundation and grotesque details… 1960s (Microgramma, Eurostile)». **Geist Mono** при заявке «prioritizes readability… coding environments» не содержит ни лигатур, ни альтернативного нуля.

## Новейшее — 2025–2026

Найдено частичным клоном `google/fonts` с `--shallow-since=2025-01-01` и фильтром `--diff-filter=A` по `*/METADATA.pb`, каждое перепроверено по полю `date_added` внутри самого файла. **Граница доказательств — коммит `2d85e204` от 2026-08-07**, позже смерженное сюда физически не попало.

| Гарнитура | Добавлен | Оси | Cyr | Что это |
| --- | --- | --- | --- | --- |
| **Science Gothic** | 2025-08-07 | **CTRS 0–85**, slnt −10–0, **wdth 50–200**, wght 100–900 | да | ремейк Bank Gothic (ATF 1930–34); настоящая капитель (smcp/c2sc); ось контраста CTRS нигде не описана текстом |
| **Playfair** | — | **opsz 5–1200**, wdth 87.5–112.5, wght 300–900 | нет | преемник Playfair Display, доходит до текстовых кеглей |
| Lilex | 2025-11-06 | wght 100–700 | да | надстройка над IBM Plex Mono: лигатуры + PowerLine |
| SN Pro | 2025-12-03 | wght 200–900 | да | переработка Nunito «within a Markdown context» |
| **Datatype** | 2026-02-25 | **wdth 50–150**, wght | нет | вычислительный шрифт: `{b:30,70,50,90}` рендерится столбчатой диаграммой через calt+liga |
| Iosevka Charon | 2026-02-19 | статик 300–700 | да | «quasi-proportional… for technical writing and dense UI»; кастомные оси APLF/MOSC/NWID/THND/WWID |
| Iosevka Charon Mono | 2026-02-19 | статик 300–700 | да | «true monospace… for coding and terminal»; 11 828 глифов, лигатур нет |
| Strichpunkt Sans | 2026-04-01 | **wdth 100–200**, wght 400–900 | нет | корпоративный шрифт немецкого branding-агентства; «rounded forms meet sharp, angular features» |
| Finlandica Text | 2026-04-17 | wght 100–900 | да | официальный шрифт Финляндии, заказ аппарата премьер-министра |
| Finlandica Headline | 2026-04-22 | wght 100–900 | да | сжатый заголовочный крой того же релиза |
| Akt | 2026-04-24 | wght 100–900 | да | «interface-first… rational geometry with refined optical details» |
| Pliant | 2026-05-21 | **wdth 100–125**, wght 100–900 | да | «Built on the Swiss typographic tradition»; фирменная черта — намеренно узкий трекинг по умолчанию |
| Geist Pixel | 2026-06-10 | **ELSH 0–100** | нет | пять пиксельных стилей одной осью (Square/Circle/Grid/Triangle/Line) |
| Scoutie Sans | 2026-07-02 | wght 200–800 | нет | шрифт Help Scout; «utility grotesque and a display sans»; перечёркнутый ноль заявлен явно |
| Nevermind | 2026-07-24 | wght 100–900 | да | фирменный шрифт Xmind; «combines geometric and humanist styles» |
| Valley Sans | 2026-07-29 | wght 100–900 | нет | Helsinki Type Studio; рисунок восходит к леттерингу **Туве Янссон** |

Проверено и не включено как слишком нишевое: Hibur Mono · Geomini · Estedad · M PLUS U · Amarna · Geom · Saira Stencil.

## Поправки к прежним записям

- **Fraunces** — дефолты в самом файле: WONK **1**, SOFT **0** (не 100), wght **900**, opsz **9**. Прежняя запись «SOFT 100» была неверна.
- **EB Garamond** — баг реальный и открытый: `georgd/EB-Garamond` issue #210 от 10.11.2024, переключатель oldstyle/lining «unusable» **в Microsoft Word**, и в TTF, и в OTF. На уровне самого файла подстановки технически работают. Формулировку «сломано вообще» сузить до этого.
- **Archivo** — wdth ровно **62.0**, не 62.5.
- **Ранги распространённости** — архив `radames/google-fonts-analytics-archive` на 2026-08-09 отстаёт минимум на 40, вероятно до 60 дней: в нём нет как минимум четырёх реально добавленных в июле 2026 семейств (Caacupe One, Scoutie Sans, Nevermind, Valley Sans). Ежедневный cron, похоже, отключён GitHub'ом за неактивность репозитория. **Все ранги отсюда помечать как снимок, а не как текущее состояние**, и при важной выдаче искать свежий источник.

## Поправки — вторая волна, 2026-08-09

- 🔴 **IBM Plex Sans записан статикой — НЕВЕРНО.** Он вариативный: `wdth 75–100` + `wght 100–700`. Урок общий: **«статика» — тоже утверждение, и оно протухает**. Семейства переезжают в вариативные, и старая запись переживает переезд. Проверять `axes{}`, а не помнить.
- **Roboto** — сам, не Flex и не Serif, несёт `wdth 75–100`.
- **Linefont** — `wdth 25–200`, самый широкий диапазон ширины на сервисе, шире Roboto Flex. `wght 4–1000`.
- **Montagu Slab** — слэб-сериф с `opsz 16–144`, где ось управляет ростом строчных, апрошами, контрастом и апертурой разом. Одно семейство закрывает и длинный текст, и дисплей. Курсива нет, кириллицы нет.
- **Advent Pro** `wdth 100–200` и **Strichpunkt Sans** `100–200` — расширяются, но не сужаются.
- Полный индекс всех осей каталога — `references/axes.md`.

## Свежесть данных о распространённости

Проверено 2026-08-09, три источника меряют три разные вещи:

| Источник | Что меряет | Свежесть |
| --- | --- | --- |
| `fonts.google.com/metadata/fonts` | поля `popularity`, `trending`, `defaultSort` — внутренний рейтинг Google, методика не раскрыта | 🟢 живой; но WebFetch обрезает выдачу на ~50 записях по алфавиту, топ оттуда не достать |
| `radames/…/stats.json` | запросы к файлам на CDN gstatic ≈ трафик сайтов-пользователей; смещён к высоконагруженным | 🟡 отстаёт на 40–60 дней |
| HTTP Archive Web Almanac | доля сайтов, объявивших семейство в CSS — «сколько сайтов», не трафик | 🔴 выпуск 2025 опирается на краулинг **июля 2025**, то есть старше архива |

Совпадение верхушки между источниками — максимум доверия, который тут вообще достижим.

**Что сдвинулось за год** (Almanac 2024 → 2025, доля страниц): Roboto **15.2% → 10–10.7%** (падение на треть) · Poppins **4.7% → 5.8–6.0%** · Inter **1.0% → 1.4–1.5%** · Open Sans и Montserrat плоско. Самый распространённый «шрифт» на вебе вообще — **Font Awesome, 8.5–9.3%** страниц.

🔴 **Google Sans — #3 по просмотрам за год**, обгоняет Lato, Montserrat и Poppins. Гарнитура роздана недавно, накопленным легаси-трафиком такой ранг не объясняется. В открытом репозитории её нет, `METADATA.pb` отсутствует.

Топ-20 по просмотрам за последние 365 дней: Roboto · Open Sans · **Google Sans** · Noto Sans JP · Inter · Montserrat · Poppins · Lato · Material Icons · Roboto Condensed · Arimo · Roboto Mono · Oswald · Noto Sans · Raleway · Nunito · Nunito Sans · Playfair Display · Rubik · DM Sans.
