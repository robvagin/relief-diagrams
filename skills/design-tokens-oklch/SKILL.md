---
name: design-tokens-oklch
description: "Generate and maintain a complete design-token system (colors, radius, spacing, shadows, type scale hooks) from a few input decisions — OKLCH one-hue color math, semantic tokens, honest dark mode, Tailwind v4 @theme AND zero-dependency plain CSS variables. Use this skill whenever starting any new UI/site/app/prototype, when the user says 'сделай токены', 'собери палитру', 'настрой тему', 'подключи дарк-мод', 'перекрась под бренд', 'design system setup', 'CSS variables', 'Tailwind theme', when converting a brand.json or an anydesign design-tokens.json (DTCG) into working CSS, or when reviewing a codebase for hardcoded hex values. Key law: components never hardcode colors — everything flows from tokens, and the whole palette derives from one --brand-hue so a single number re-themes the product."
---

# Design Tokens — OKLCH one-hue system

Build the token layer FIRST, before any component work. Components consume semantic tokens only; raw values live in exactly one place.

## Why OKLCH

OKLCH is perceptually uniform: same L = same perceived lightness across hues, so a whole palette derived by formula stays coherent, and dark mode can be *retuned* (not naively inverted) by shifting L/C while keeping H. Wide-gamut (P3) capable, supported in all modern browsers. Fallback for legacy: emit hex alongside via the generator script.

## The one-hue core

The entire product palette derives from a single `--brand-hue`. Change one number → everything re-themes and stays harmonious.

```css
:root {
  --brand-hue: 250;            /* THE dial */
  --brand-chroma: 0.20;        /* accent saturation cap */

  /* accents */
  --color-primary:        oklch(0.55 var(--brand-chroma) var(--brand-hue));
  --color-primary-hover:  oklch(0.50 var(--brand-chroma) var(--brand-hue));
  --color-primary-fg:     oklch(0.99 0.005 var(--brand-hue));

  /* brand-tinted neutrals — NEVER pure gray/white/black */
  --color-background:     oklch(0.99  0.005 var(--brand-hue));
  --color-surface:        oklch(0.97  0.007 var(--brand-hue));
  --color-foreground:     oklch(0.16  0.015 var(--brand-hue));
  --color-muted:          oklch(0.94  0.010 var(--brand-hue));
  --color-muted-fg:       oklch(0.45  0.020 var(--brand-hue));
  --color-border:         oklch(0.88  0.012 var(--brand-hue));
  --color-ring:           oklch(0.55 var(--brand-chroma) var(--brand-hue));

  /* status hues are absolute, chroma matched to brand */
  --color-destructive:    oklch(0.55 0.19 27);
  --color-success:        oklch(0.58 0.14 150);
  --color-warning:        oklch(0.70 0.15 85);
}
```

Rules:
- **Neutrals carry a whisper of the brand hue** (C 0.005–0.02). Pure `#fff`/`#000`/gray reads cheap and clashes with tinted accents.
- **Second accent** (if the brand needs one): `calc(var(--brand-hue) + 120)` or `+ 180` — complementary math, not a hand-picked stray hex.
- **Never hardcode hex in components.** Grep for `#[0-9a-fA-F]{3,8}` before shipping; every hit outside the token file is a bug.

## Dark mode — retune, don't invert

```css
[data-theme="dark"] {
  --color-background: oklch(0.14 0.012 var(--brand-hue));
  --color-surface:    oklch(0.18 0.014 var(--brand-hue));
  --color-foreground: oklch(0.93 0.008 var(--brand-hue));
  --color-muted:      oklch(0.24 0.012 var(--brand-hue));
  --color-muted-fg:   oklch(0.65 0.015 var(--brand-hue));
  --color-border:     oklch(0.28 0.014 var(--brand-hue));
  --color-primary:    oklch(0.68 calc(var(--brand-chroma) * 0.9) var(--brand-hue));
}
```

Why these shifts: dark surfaces need slightly MORE chroma in neutrals to avoid muddy gray; accents need HIGHER L and slightly LOWER C or they vibrate on dark. Dark bg is never pure black — 0.13–0.16 L keeps shadows and elevation legible. Remember the adaptive-typography rule: light-on-dark text may need +0.005…+0.01em tracking or a weight step down.

## Non-color scales

```css
:root {
  /* radius — a SCALE with one personality, never one magic value everywhere */
  --radius-xs: 2px; --radius-sm: 4px; --radius-md: 8px;
  --radius-lg: 12px; --radius-xl: 16px; --radius-full: 9999px;

  /* spacing — 4px grid */
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px; --space-8: 32px; --space-10: 40px;
  --space-12: 48px; --space-16: 64px; --space-20: 80px; --space-24: 96px;

  /* shadows — layered + hue-tinted, not black blobs */
  --shadow-sm: 0 1px 2px oklch(0.16 0.02 var(--brand-hue) / 0.06);
  --shadow-md: 0 2px 4px  oklch(0.16 0.02 var(--brand-hue) / 0.05),
               0 4px 12px oklch(0.16 0.02 var(--brand-hue) / 0.06);
  --shadow-lg: 0 4px 8px  oklch(0.16 0.02 var(--brand-hue) / 0.05),
               0 12px 32px oklch(0.16 0.02 var(--brand-hue) / 0.09);
}
```

Radius discipline (anti-slop): pick the product's radius personality ONCE — sharp (xs/sm), balanced (sm/md), soft (md/lg) — and map roles to the scale: inputs/buttons one step, cards one step up, modals one more. Inner element radius = outer radius − padding (concentric rule). Mixing personalities or slapping `--radius-xl` on everything is exactly the "всё округлое без правил" slop this skill exists to prevent.

Typography tokens: font families, weights and the type scale come from the brand; tracking/leading values come from the `adaptive-typography` skill — reference its tables, don't duplicate numbers here.

## Tailwind v4 vs zero-dep

- **Tailwind v4 project**: emit the same system inside `@theme { ... }` in the main CSS file (CSS-first config; no tailwind.config.js). Token names become utilities automatically (`bg-background`, `text-muted-fg`, `rounded-md`).
- **Zero-dependency / vanilla build** (canvas builders, single-file HTML): plain `:root` variables exactly as above. Same names — a component moved between stacks keeps working.

## Inputs this skill accepts

1. **Nothing but a vibe** → ask for / infer the hue (brand color → run it through `scripts/generate_tokens.py --hex`), generate the full system.
2. **brand.json** (my-brand-skill SSOT) → brand colors map to `--brand-hue`/`--brand-chroma`, fonts to type tokens. brand.json stays the source of truth; tokens are its compiled form.
3. **design-tokens.json in DTCG format** (anydesign output) → map `$value`/`$type` entries onto this structure; anything missing (semantic roles, dark mode) is derived by the formulas above.

## Script

`scripts/generate_tokens.py` — deterministic generator. Give it a hue (or hex to convert), get `tokens.css` (light+dark, all scales) and optionally `--format theme` for a Tailwind v4 `@theme` block or `--format dtcg` for machine-readable JSON. Run it instead of hand-typing the boilerplate; hand-edit only the deviations.

```bash
python3 scripts/generate_tokens.py --hue 250 -o tokens.css
python3 scripts/generate_tokens.py --hex "#131313" --format theme
python3 scripts/generate_tokens.py --hue 32 --chroma 0.15 --format dtcg
```

## Acceptance checklist

1. One `--brand-hue` dial actually re-themes everything (test: change it, nothing breaks).
2. No hardcoded hex outside the token file (grep).
3. Neutrals are tinted, not pure gray.
4. Dark mode retuned per rules above, checked by eye or screenshot loop.
5. Contrast: primary-fg on primary, foreground on background, muted-fg on surface — WCAG AA (4.5:1 body, 3:1 large text). The generator prints ratios; fix L until they pass.
6. Radius personality declared and mapped; concentric rule respected.
