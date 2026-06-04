# Vantage — Marketing Site UI Kit

A high-fidelity, interactive recreation of the **Vantage marketing website** — the brand's primary public surface. Built as click-through React (Babel-in-browser) components against the `colors_and_type.css` tokens.

> The marketing site is the **only** surface this design system covers. In-product trading screens (order book, charts, order forms) live behind a login wall and are out of scope per the source spec. The sign-up flow here is a faithful front-of-funnel mock, not a real auth implementation.

## Run it
Open `index.html`. It loads React 18 + Babel from CDN, then the component files, then mounts an interactive page.

## Interactions wired
- **Top nav** — desktop menu + hamburger sheet below 880px; "Sign up" routes to the sign-up screen.
- **Hero** — signature dark band with two layered floating product-UI cards (one rotated ~4°).
- **Asset table** — segmented tabs (Trending / Top gainers / Watchlist) filter the rows live.
- **Sign-up flow** — email field with focus state + validation gating the (disabled→active) button → confirmation screen.

## Components (each exports to `window`)
| File | Exports | Notes |
|---|---|---|
| `Primitives.jsx` | `Icon`, `Wordmark`, `Button`, `Badge` | Line icons (Lucide-matched), pill buttons w/ states, uppercase badges |
| `TopNav.jsx` | `TopNav` | Light + `dark` variants, responsive hamburger |
| `Hero.jsx` | `HeroDark`, `ProductCardDark`, `Sparkline` | The signature dark hero + layered mockups |
| `Sections.jsx` | `Container`, `FeatureGrid`, `AssetTable`, `PricingTiers`, `CTABand` | Editorial bands; pricing uses the dark-inversion featured tier |
| `Footer.jsx` | `Footer` | 6-column links + legal band |
| `Signup.jsx` | `SignupScreen`, `ConfirmScreen` | Form components + success state |

## Conventions
- Every interactive shape is a 100px pill; cards are 24px; asset glyphs are full circles.
- Display headlines at weight 400; numbers in JetBrains Mono.
- One accent (Vantage Blue); trading green/red are text-only.
- These are cosmetic recreations — simplified, not production logic.

## Substitutions
Fonts (Inter / JetBrains Mono) and icons (Lucide-matched inline SVG) are open-source stand-ins for the unprovided licensed assets. See the root `README.md`.
