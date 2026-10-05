---
name: adaptive-typography
description: "Adaptive typography canon — tracking (letter-spacing), leading (line-height), kerning and spacing-resilience rules by role, size, language and container. Use this skill whenever setting or reviewing ANY web/UI typography: choosing letter-spacing or line-height values, styling headings/hero/display type, captions, all-caps labels, buttons/chips/inputs/nav, integrating custom fonts, reviewing a layout's type, or checking a design against WCAG Text Spacing. Trigger on: 'letter-spacing', 'tracking', 'кернинг', 'трекинг', 'интерлиньяж', 'межбуквный', 'line-height', 'типографика', 'подключи шрифт', 'поправь заголовки', 'set the type', 'typography audit' — and also implicitly whenever building or restyling any interface that contains text, even if typography is not mentioned. Key law: letter-spacing 0 is NOT a dogma and 'negative everywhere' is NOT a dogma — values adapt to role, size, language (cyrillic!), weight and container, and layouts must survive the WCAG 1.4.12 user override."
---

# Adaptive Typography

Rules for tracking, leading, kerning and spacing-resilience in web/UI work.
Master doc: `Projects/TYPOGRAPHY_CANON.md` (Rob's canon, 2026-07-12). This skill mirrors it; if both are available and disagree, the canon doc wins.

## Core principle

`letter-spacing: 0` is not a dogma. "Negative tracking everywhere" is not a dogma.
Tracking adapts to **role, size, language, weight, and container**. The direction is confirmed by Apple SF (dynamic tracking: positive at small sizes → negative at large, Text/Display threshold ≈ 20pt) and Material 3 (body/label in the plus, headline/display at zero). Small type needs air to stay legible; large type needs tightening because counters and sidebearings look inflated at scale. Apply that reasoning, not a single magic number.

## 1. Tracking by role and size (neutral grotesks, web px)

| Role | Size | Tracking | Notes |
|---|---|---|---|
| Micro / legal / footnotes | 10–12px | **+0.015…+0.025em** | smaller → more plus |
| Captions / dense labels / table meta | 12–14px | **+0.01…+0.02em** | M3 label ≈ +0.03em is the upper bound |
| ALL-CAPS / small-caps / eyebrow | any | **+0.04…+0.10em**, up to +0.12em | stop before the word falls apart |
| Body / UI text | 16–18px | **0** | narrow-set grotesks may take +0.005em |
| Subheads | 20–28px | **0** | transition zone |
| Headings | 32–48px | **0…−0.01em** | |
| Hero / display | 56px+ | **−0.01…−0.03em**, start at **−0.02em** | larger & lighter → bolder minus |
| Numbers in columns | any | 0 + `tabular-nums` | never fix alignment with tracking |

**Fluid type formula** (Inter Dynamic Metrics, rsms — use when size flows via `clamp()` instead of fixed steps):

```
tracking(em) = a + b · e^(c · z)        z = font size in px
Inter constants: a = −0.016, b = 0.21, c = −0.18
```

Same arc as the table (plus at small → minus at large, asymptote at `a`). Constants are Inter-specific — refit for another grotesk: `a` = your display tracking target (−0.02em default), tune `b` so 11–12px lands at +0.015…0.025em, `c ≈ −0.18` usually transfers. Implement as a few `@media` control points computed from the formula. The `leading = 1.4z` companion rule is coarser than the role table below — fallback only.

Modifiers:
- **Weight**: bold at small sizes → slightly more plus; light/thin at display → slightly more minus is fine.
- **Dark theme**: light-on-dark reads optically bolder and blooms → add +0.005…+0.01em at small sizes, or step the weight down.
- **Fluid type (`clamp()`)**: if the size flows, tracking must flow with it — per breakpoint steps or `calc()` tied to size. A hero locked at −0.02em is wrong once it shrinks to 34px on mobile.
- **Cyrillic**: denser texture, longer words, fewer extenders — tight setting collapses sooner than latin. For RU display take the upper (less negative) end of the range and verify by eye. All-caps cyrillic needs the tracking check even more than latin.

## 2. Kerning ≠ tracking

- Keep `font-kerning: normal` (OpenType `kern` pairs on; browser default with proper fonts).
- `letter-spacing` is applied AFTER kerning; a large plus destroys kerning pairs and ligatures. Fine on all-caps labels (no ligatures needed there), unacceptable in body text.
- Manual kerning (spans with offsets) only in logos/lettering, never in flowing text.

## 3. Leading (line-height) by role

| Role | Line-height |
|---|---|
| Hero / display 56px+ | **0.95–1.1** |
| Headings 32–48px | **1.1–1.2** |
| Subheads 20–28px | **1.2–1.35** |
| Body 16–18px | **1.4–1.6** (default 1.5) |
| Small / captions 12–14px | **1.35–1.5** |
| Single-line controls (button/chip/input/nav) | 1–1.2, center with padding; do NOT fix container height (see §5) |

Couplings:
- **Measure ↔ leading**: longer lines need more leading. Body measure **45–75ch, target ~65ch** (`max-width: 65ch`). Past 65ch add ~+0.05 line-height.
- Multi-line display below 1.0 line-height: verify extenders (р, у, д, ц, щ / p, y, g, j) don't clip or collide between lines.
- Paragraph rhythm: ~1em between paragraphs OR first-line indent — never both.

## 4. Language and container

- **Cyrillic words run longer** — size buttons/chips/nav to RU strings, not EN. Use `hyphens: auto` + `lang="ru"` in narrow columns; `overflow-wrap: break-word` as a long-word safety net.
- Check hyphenation and ragged-right at all three widths: mobile / tablet / desktop.
- Tight containers (chips, badges, table cells): never track into the minus to make text fit — shorten the string or widen the container. Truncation uses the `…` character, not `...`.
- Orphans: short function words (с, в, и, на, of, the, with…) never hang at line-end — bind with `&nbsp;`. Use `text-wrap: balance` on headings, `text-wrap: pretty` on body where supported.

## 5. WCAG 1.4.12 spacing-resilience (mandatory stress test)

Users may override text spacing (Level AA) and the layout must survive with no loss of content or function:

```
line-height: 1.5 × font-size
letter-spacing: 0.12em
word-spacing: 0.16em
paragraph spacing: 2 × font-size
```

Consequences for markup:
- **No fixed heights** on text containers — `min-height`, not `height`. Buttons, chips, cards, nav items must be able to grow.
- **No clipping `overflow: hidden`** on text blocks (allowed only as part of an honest truncation pattern).
- Absolutely-positioned labels over/next to text — check they don't collide when text grows.
- Run the stress CSS on every key screen: nothing cut off, nothing overlapped, everything clickable.

```css
/* WCAG 1.4.12 stress test — paste in DevTools */
* { line-height: 1.5 !important; letter-spacing: .12em !important;
    word-spacing: .16em !important; }
p { margin-bottom: 2em !important; }
```

## 6. Acceptance checklist (before shipping any screen)

1. Three widths (mobile / tablet / desktop) — display size and its tracking recomputed for each.
2. Cyrillic: long words, hyphenation, RU strings in buttons/nav/chips/inputs.
3. All-caps elements: tracking in the plus, words hold together.
4. Numbers/prices: `tabular-nums`.
5. Orphans bound with `&nbsp;`.
6. WCAG 1.4.12 stress test passes — nothing breaks.
7. Kerning on; ligatures not killed by tracking in body text.
8. Body measure within 45–75ch.

## Example

Input: hero 64px SF-like grotesk, RU headline, fluid down to 36px on mobile.
Output: desktop `letter-spacing: -0.015em` (upper end of −0.01…−0.03 because cyrillic), `line-height: 1.05`; mobile step: `-0.005em`, `line-height: 1.1`; headline words orphan-checked, container `min-height`, stress test run.
