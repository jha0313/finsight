# Vantage Design System

**Vantage** is an editorial-institutional fintech brand for an **AI-driven financial intelligence** SaaS — a platform that surfaces explainable AI insight over portfolios and markets for desks that answer to regulators. The brand reads like an institutional financial publication that happens to use AI: quiet white-canvas surfaces, editorial spacing, near-monochrome palette, and a single point of brand voltage — **Vantage Blue**.

> **Provenance & scope.** This system was built from a written brand specification (a teardown of the documented visual language: single-blue voltage, pill geometry, dark editorial heroes with floating product-UI cards, trading semantics, 96px section rhythm). **No source codebase, Figma file, or asset library was attached** — every token, asset, and component here is an *original recreation* of that documented language under the original brand name "Vantage." If you have the real source files (design tokens, logo lockups, licensed fonts, product screens), attach them and I'll reconcile this system against them.

---

## At a glance

- **One accent color.** `--primary` (#0052ff, Vantage Blue) carries every primary CTA pill, the wordmark, and inline brand links — and nothing else. Used scarcely: one or two blue moments per band.
- **Calm display weight.** Display headlines sit at **weight 400**, never 700+. This is the single most distinctive choice — it signals editorial trust over trading-platform urgency.
- **Pill + card + circle geometry.** Every CTA is a 100px pill; every card is 24px; every asset glyph is a full circle. Sharp 0px corners are absent.
- **Band rotation as rhythm.** Pages alternate bright white editorial sections, soft-gray elevation bands, and **full-bleed dark editorial heroes** carrying layered product-UI mockup cards — the brand's strongest signature pattern.
- **Trading semantics are text-only.** Up-green (#05b169) and down-red (#cf202f) color numbers, never fill backgrounds.
- **Numbers are mono.** Every price, percentage, and volume renders in a monospace tabular face.
- **96px section rhythm.** Generous editorial pacing — closer to a financial broadsheet than a dashboard.

---

## CONTENT FUNDAMENTALS

How Vantage writes.

- **Voice: calm, plain-spoken authority.** Sentences are short and declarative. The brand never shouts, never hypes. It explains. Think *"Signals, explained"* and *"Intelligence, quietly"* — value stated, not sold.
- **Person: "you" for the reader, "we" sparingly.** Address the reader directly ("Take control of your money," "Your portfolio, watched continuously"). Use "we" only for institutional commitments (custody, compliance). Never first-person-singular.
- **Casing: sentence case everywhere** except the small uppercase **badge pills** (`INSTITUTIONAL`, `REGULATED`, `AI INSIGHT`), which use tracked-out uppercase at 12px. Headlines and buttons are sentence case ("Get started", not "Get Started").
- **Numbers carry weight.** Prices, percentages, and figures are stated precisely and rendered in mono. The brand lets data speak — a single `+2.34%` does more work than an adjective.
- **No emoji. No exclamation marks.** The register is institutional. Enthusiasm is conveyed through clarity and precision, not punctuation.
- **AI framing: explainable, never magical.** Insight is always paired with reasoning ("never a black-box score"). The brand sells *transparency of intelligence*, not novelty.
- **CTA verbs are quiet and direct:** "Get started", "Talk to sales", "View demo", "Learn more →". The inline text link with a trailing arrow is the soft secondary action.

**Tone examples**
- Hero: *"Intelligence, quietly. AI insight for the desks that answer to regulators."*
- Feature: *"Every AI insight comes with the reasoning behind it — never a black-box score."*
- CTA band: *"Take control of your money."*

---

## VISUAL FOUNDATIONS

- **Color vibe.** Near-monochrome: white canvas, near-black ink (#0a0b0d), cool-gray running text (#5b616e), soft-gray elevation bands. The *only* chromatic event is Vantage Blue, deployed scarcely. A muted yellow exists strictly for asset-glyph illustration — never as an action color. Trading green/red appear only as number colors.
- **Type.** Inter for both display and body (display @ 400 with −2.5% tracking; body @ 400/600/700 at 0 tracking); JetBrains Mono for all numerals. Display and body never mix inside one headline. See "Known Gaps" for the licensed-font substitution.
- **Spacing.** 4px base unit. **96px between major bands**, 32px card interior padding, 24px between cards within a band. The whitespace is the design — generous, editorial, unhurried.
- **Backgrounds.** Three modes rotate: (1) bright white editorial, (2) soft-gray (#f7f7f7) elevation bands, (3) **full-bleed dark (#0a0b0d) heroes**. No gradients on surfaces, no textures, no repeating patterns. The only "gradient" permitted is inside product-UI mockup sparkline bars. Photography/illustration is full-bleed when used; otherwise surfaces are flat color.
- **The signature pattern.** Dark hero band + **layered product-UI cards** (`product-ui-card-dark`): a `#16181c` elevated card floats over the dark canvas, often with a second smaller card overlapping at a slight rotation (~4°), mimicking a layered dashboard. This is the brand's strongest decorative device — depth comes from layered UI, not shadow.
- **Elevation.** Exactly **one shadow tier**: `0 4px 12px rgba(0,0,0,0.04)`, used only on hovered cards. 80% of surfaces are flat; the rest carry a 1px hairline (#dee1e6). Never stack shadow tiers.
- **Borders & hairlines.** 1px hairlines divide and outline on white. Dark surfaces use a barely-there `rgba(255,255,255,0.06)` edge.
- **Corner radii.** Pills (100px) for anything interactive; 24px for cards, mockups, and pricing tiers; 12px for form inputs; full circles for asset glyphs and avatars. 0px is effectively unused.
- **Cards.** White fill, 1px hairline border, 24px radius, 32px interior padding, flat (shadow only on hover). On dark, cards become `#16181c` with a faint white edge.
- **Hover / press.** Hover states are intentionally **undocumented and minimal** in the source spec — treat hover as a slight surface lift (the soft shadow) and press as the documented active darken (`--primary-active` #003ecc on the blue pill). No scale-bounce, no glow.
- **Transparency & blur.** Used sparingly: a ~10% blue tint behind the "AI Insight" badge, faint white edges on dark cards. No glassmorphism, no heavy blur.
- **Animation.** Out of scope in the source; keep motion restrained — short opacity/translate fades, no bounce, no infinite loops. Respect `prefers-reduced-motion`.
- **Layout rules.** Content caps at ~1200px centered; hero photography/heroes go full-bleed. 12-column editorial grid; feature grids 2-up (hero splits) or 3-up (benefits); footer 6-column.

---

## ICONOGRAPHY

- **Style: thin-stroke line icons, ~2px, rounded caps/joins, no fill.** Icons are quiet and geometric, matching the editorial register. They appear inside 44px circular `--surface-strong` plates within feature cards, and inline in nav/search at ~16px.
- **No emoji, ever.** The brand's institutional register excludes emoji entirely.
- **Currency/asset glyphs** use Unicode currency symbols (₿, Ξ) or single-letter mono initials inside full-circle plates — not custom illustration. The only color permitted on a glyph is the illustrative yellow for Bitcoin.
- **Source set:** No proprietary icon font or SVG sprite was provided. This system uses **[Lucide](https://lucide.dev)** (MIT, 2px stroke, rounded) as the documented substitute — it matches the required thin-line/rounded style. Load from CDN: `https://unpkg.com/lucide@latest`. Inline SVGs in the preview cards and UI kit are hand-matched to Lucide's geometry. **Flag:** if the real brand ships a custom icon font, swap Lucide for it.
- **The brand mark** (`assets/mark.svg`) is an upward angle/chevron in a blue circle — a "vantage point" reading up-and-to-the-right. Original geometric logotype, not a recreated trademark.

---

## VISUAL FOUNDATIONS — quick token reference

See `colors_and_type.css` for the authoritative token list. Highlights:

| | Token | Value |
|---|---|---|
| Accent | `--primary` | #0052ff |
| Ink | `--ink` | #0a0b0d |
| Body | `--body` | #5b616e |
| Dark floor | `--surface-dark` | #0a0b0d |
| Dark card | `--surface-dark-elevated` | #16181c |
| Up / Down | `--semantic-up` / `--semantic-down` | #05b169 / #cf202f |
| Card radius | `--radius-xl` | 24px |
| Pill | `--radius-pill` | 100px |
| Section | `--space-section` | 96px |
| Shadow | `--shadow-soft` | 0 4px 12px rgba(0,0,0,.04) |

---

## INDEX — what's in this system

**Root**
- `README.md` — this file: context, content + visual foundations, iconography, index.
- `colors_and_type.css` — authoritative CSS variables (color, type families, spacing, radius, elevation) + semantic type classes. Import this into any artifact.
- `SKILL.md` — Agent-Skill front-matter so this folder works as a downloadable Claude skill.

**`assets/`** — brand marks
- `wordmark.svg` · `wordmark-on-dark.svg` · `mark.svg`

**`preview/`** — Design System tab cards (registered). Colors, type, spacing/radius/elevation, and component specimens. Open any in a browser to inspect.

**`ui_kits/marketing-site/`** — high-fidelity recreation of the Vantage marketing site (the only surface the spec covers; in-product trading screens live behind a login wall and are out of scope).
- `README.md` · `index.html` (interactive page) · JSX components.

---

## Known Gaps & Substitutions

- **Fonts are substitutes.** The spec names licensed display/sans/mono families. This system uses **Inter** (display + sans) and **JetBrains Mono** (numerals) — the documented open-source stand-ins — loaded via Google Fonts in `colors_and_type.css`. Swap in the licensed faces for production. *No font files are bundled in `fonts/`; the substitutes are CDN-loaded.*
- **Icons are substitutes.** Lucide stands in for the (unprovided) brand icon set — see ICONOGRAPHY.
- **No source files.** Built from a written spec, not a codebase/Figma. Treat as a faithful interpretation pending reconciliation with real assets.
- **In-product surfaces** (order book, charts, order forms) are out of scope — marketing only.
- **Hover & animation** are underspecified in the source and kept deliberately minimal here.
- **Accent yellow** is illustrative-only (asset glyphs), never an action color.

## Do / Don't

**Do** — reserve blue for CTAs/wordmark/links · keep display at weight 400 · rotate dark/light bands · render every number in mono · pair every dark hero with a layered product-UI card stack · use sentence case.

**Don't** — introduce a second brand color · bold display copy · stack shadow tiers · use sharp 0px corners on CTAs · mix display + body in one headline · use green/red as button fills · use emoji.
