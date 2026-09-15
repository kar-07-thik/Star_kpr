# Design — STARS-BCA

A locked design system for this app. Every page redesign reads this file before
emitting code. Do not regenerate per page — extend or amend this file when the
system needs to grow.

## Genre
editorial

## Macrostructure family
One base macrostructure for the app, varied by role through component archetypes.

- App pages: **Workbench** (edge-aligned working surface; hairline rules over
  stacked rounded cards; mono "ledger" numerals for metrics; asymmetric column
  grids; flat definition-rows inside modals instead of nested cards).
  - Student: progress-led — big type meter + ledger stats.
  - Faculty/HOD: review queue — table-led with a detail modal.
  - Principal: ledger/table-led — heavy tables + forms.
- Auth (Login): broadsheet split — masthead wordmark left, form right, one
  vertical hairline rule between.

## Theme
Tuned editorial on the **KPR CAS brand palette** extracted from `src/assets/kprcas.jpg`
(KPR navy `#2C4D90`, KPR green `#208D49`, on white). Cool-tinted, crisp, light.

- `--color-paper`   #F4F6FB  /* page ground — cool near-white */
- `--color-card`    #FFFFFF  /* card / raised surface */
- `--color-ink`     #17263F  /* deep navy-charcoal for text / ink */
- `--color-rule`    #E2E8F2  /* hairline — cool blue-gray */
- `--color-brand`   #2C4D90  /* KPR navy (logo) — primary accent */
- `--color-brand-600` #26407A /* CTA fill / hover base */
- `--color-leaf`    #208D49  /* KPR green (logo) — success */
- `--color-slate`   cool gray-blue scale (text-muted / table headers)

## Typography
- Display: **Fraunces**, weights 500–700, style normal. Never italic.
- Body:    **Public Sans**, weights 400–600.
- Mono:    **IBM Plex Mono**, weights 400–500 — ledger numerals, register
  numbers, stat values, table headers, kickers.
- Display tracking: tight (-0.02em) on headings; wide (0.14–0.2em) only on
  small-caps kickers and table headers.
- Numerals in any column of numbers use tabular figures (`font-variant-numeric:
  tabular-nums`) — mono covers this by default.

## Spacing
Tailwind 4-pt named scale (unchanged from project). Pages use `space-y-6` /
`gap-4` rhythm but section spacing varies deliberately — one section tight,
the next open.

## Motion
- Easings: cubic-bezier(0.16, 1, 0.3, 1) named `--ease-out`.
- Reveal pattern: none on scroll. One fade entrance on load only.
- Reduced-motion: opacity-only, ≤ 150 ms.

## Microinteractions stance
- Silent success. Toasts only for failures and async actions whose effect is
  not visible; toasts render as flat notice bands, never floating pills.
- Hover: colour / border shift only. No translate-lift, no scale, no bounce.
- Hover delay 800 ms · focus delay 0 ms. Focus rings appear instantly (2px
  accent, offset).

## CTA voice
- Primary CTA: KPR-navy-filled rectangle (brand-600), radius 6px, sentence case, no gradient.
- Secondary CTA: hairline outline (transparent fill), radius 6px.
- Destructive / success: rose / leaf filled rectangles, same geometry.

## Per-page allowances
- App pages MUST NOT use enrichment — function carries the page.
- Login MAY use hairline double-rules and typographic devices only.
- No imagery anywhere. No gradients anywhere except brand-constrained hairline
  ticks and status tints at < 5 % of viewport.

## What pages MUST share
- The wordmark / logotype: Fraunces "STARS-BCA" in the masthead.
- The masthead (N6): thin issue row in serif small caps, wordmark row, nav row,
  hairline double-rule below.
- The accent colour (KPR navy) placed as ≤ 5 % of viewport: active nav
  underline, ledger ticks, links, spinners.
- Display + body + mono fonts.
- CTA voice.
- Table language: hairline rows (`border-t border-rule`), mono 11px uppercase
  headers, tabular numerals.

## What pages MAY differ on
- Grid asymmetry per role (Student meter-led, Faculty queue-led, Principal
  form-led).
- Kicker text in the masthead issue row.
- Chart composition (bar charts only; single accent + status tints).

## Exports

Canonical values live in `tailwind.config.js` (hex, for Tailwind) and
`src/index.css` `:root` (CSS custom properties for SVG/recharts fills).

### tokens.css
```css
:root {
  --color-paper:      #F4F6FB;  /* page ground — cool near-white */
  --color-card:       #FFFFFF;  /* card / raised surface */
  --color-ink:        #17263F;  /* deep navy-charcoal */
  --color-ink-2:      #46546B;  /* muted text (slate-700) */
  --color-rule:       #E2E8F2;  /* hairline */
  --color-brand:      #2C4D90;  /* KPR navy — primary accent */
  --color-brand-600:  #26407A;  /* CTA fill */
  --color-brand-100:  #DCE4F5;
  --color-leaf:       #208D49;  /* KPR green — success */
  --color-slate-100:  #EEF2F7;  --color-slate-300: #C6CFDE; --color-slate-400: #9AA8BE;
  --color-amber-500:  #F59E0B;  --color-rose-500: #F43F5E;
  --color-focus:      #2C4D90;

  --font-display: "Fraunces", Georgia, serif;
  --font-body:    "Public Sans", system-ui, sans-serif;
  --font-outlier: "IBM Plex Mono", ui-monospace, monospace;

  --radius-card: 8px; --radius-control: 6px; --radius-pill: 9999px;
}
```

## Stamp
Every page file carries:

```css
/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */
```