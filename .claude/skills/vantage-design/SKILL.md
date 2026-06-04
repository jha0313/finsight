---
name: vantage-design
description: Use this skill to generate well-branded interfaces and assets for Vantage (an editorial-institutional fintech / AI-financial-intelligence brand), either for production or throwaway prototypes/mocks. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick start
- Import `colors_and_type.css` for all tokens (color, type families, spacing, radius, elevation) and semantic type classes.
- Brand marks live in `assets/` (`wordmark.svg`, `wordmark-on-dark.svg`, `mark.svg`).
- Ready-made, on-brand components live in `ui_kits/marketing-site/` (React/Babel) — copy and adapt.
- Preview specimens for every token/component live in `preview/`.

## The five rules that make it look like Vantage
1. **One accent.** `--primary` #0052ff on CTAs, wordmark, and links only. Nothing else is blue.
2. **Display stays at weight 400** with tight negative tracking. Never bold a headline.
3. **Pill + 24px card + full circle.** No sharp corners on interactive elements.
4. **Rotate bands:** white editorial → soft-gray → full-bleed dark hero with layered product-UI cards.
5. **Every number is mono** (JetBrains Mono, tabular); trading green/red are text-only, never fills.

## Known substitutions (flag to the user)
- Fonts: Inter + JetBrains Mono stand in for the licensed brand faces.
- Icons: Lucide-matched line icons stand in for the unprovided brand set.
- Built from a written spec — no source codebase/Figma. Reconcile against real assets when available.
