# Project Structure

## Site sections
| Page | File | Description |
|---|---|---|
| Landing | `index.html` | Hero, "Why we are building this" (4 problem cards), Roadmap, Philosophy strip |
| Open Trader | `open-trader.html` | Open Trader - standalone exchange trading application details |
| The Scratcher Assistant | `scratcher-assistant.html` | The Scratcher Assistant - AI assistant details |
| IPRL | `iprl.html` | Intellectual Property Reserve License page |
| DataHub | `datahub.html` | DataHub library description |
| Mission | `mission.html` | Open Trader Mission |

Legacy redirects: `x-cockpit.html` and `ru/x-cockpit.html` are meta-refresh stubs pointing to the renamed `open-trader.html` pages (the product was renamed from X·Cockpit to Open Trader).

## Investor section (`investor/`)
Self-contained subdirectory for investor relations. Uses its own stylesheet (`investor/investor.css`) and local assets — does NOT share the root `css/style.css`.

| Page | File | Description |
|---|---|---|
| Investor Deck | `investor/index.html` | Single-page deck: investor brief (slide 1) + pitch-deck slides 2–12. Russian mirror: `investor/ru/index.html`. |
| Investor One-Pager | `investor/one-pager.html` | Export-only single sheet of the brief (noindex, not linked from the site). Same copy as deck slide 1, laid out for a one-page PDF/PNG. |

There is deliberately NO separate brief *deck* page and NO `pitch-deck.html` — the brief exists once as slide 1 of the deck (it used to be duplicated across two files and drifted). `one-pager.html` is the one exception: it is not a site page but the print/export sheet, and its copy must be re-synced from slide 1 whenever the brief changes.

### One-pager export (`investor/one-pager.html` + `investor/one-pager.css`)
Reuses the deck's components from `investor.css` (status pills, metric cards, `.brief-section` frames, market diagram, roadmap, terms table); `one-pager.css` adds only the sheet: a fixed 21 cm-wide `.op-sheet` whose `--op-cm` custom property is the pixel value of one sheet centimetre, so every offset is expressed in real page units. Layout: starship + oversized project name in the header with the status pills opposite, a two-column body (market diagram left, metrics + team frames right, starting ~1 cm under the pills), then the roadmap and terms strips across the full sheet width. Export by screenshotting the `.op-sheet` element at a viewport ≥ 1400 px wide (narrower viewports trip `investor.css`'s responsive breakpoints).

### Deck engine (`investor/deck.js` + `investor/vendor/`)
`deck.js` is a content-agnostic pinned cross-fade transition engine shared by all deck language versions. It discovers `.deck-stage .slide` sections at runtime (any count/content) and builds the desktop sidebar nav from each section's `data-nav` attribute (keyboard Prev/Next and deep links still work; there is deliberately NO footer control panel and NO mobile nav dropdown — they were removed as excessive chrome). Per page: scroll natively until the page bottom is on screen → the page pins and fades out while the next page rises from just below its content end (pages are content-height + a breathing gap), fading in (scrubbed by real scroll position; wheel/touch keep native physics). Every page carries a "starship" (the image named by the stage's `data-flyer` attribute — `x-fighter.png`) above its own top border: once the current page fully lands, the next page's starship fades in below it on a timed animation and idles with a CSS "waggle in space" loop; it stays fully visible through its flight (moving only by native scroll, leading its page over the outgoing one) and is fully above the window once its page aligns; a trailing ship after the last page acts as a fake empty next page so the last real page also has one below. ALL flyer/transition geometry is measured at runtime, never hardcoded: the ship's height comes from its CSS-resolved width × the image's natural aspect ratio, the clearance scales with the view zone, and the per-slide breathing gap is published by deck.js as the `--deck-flyer-gap` custom property that the CSS slide padding consumes (CSS keeps only a 10svh JS-free fallback). Viewport heights come from hidden 100svh/100lvh probe elements — never `window.innerHeight`, which swings with the phone URL bar mid-scroll (svh drives pin zones, lvh the end spacer), so `ignoreMobileResize` is safe. An engine-sized end spacer guarantees the last page's transition can complete on tall windows, and after every ScrollTrigger refresh the scroll re-anchors to the current page so vertical resizes don't flip pages. Powered by vendored GSAP + ScrollTrigger (`investor/vendor/gsap.min.js`, `investor/vendor/ScrollTrigger.min.js` — free license, self-hosted, no CDN). Falls back to a plain stacked scrolling document without JS or under `prefers-reduced-motion`; print CSS + beforeprint handler neutralize the engine so PDF export prints one slide per page.

To add/remove/reorder slides: edit only the `<section class="slide" id="slide-N" data-nav="Title">` markup — nav, transitions and counters adapt automatically. Keep EN (`investor/index.html`) and RU (`investor/ru/index.html`) in sync.

### Investor-local assets (`investor/assets/`)
- `sci-fi-planet.png` — global fixed viewport backdrop behind all deck pages
- `spiral-galaxy.png` — market-opportunity artwork (slide 1)
- `x-fighter.png` — illustration used in the deck
- `triple-arrow.png` — icon/graphic used in the deck
- `x-logo.png` — Open Trader logo

## Shared assets
- `css/style.css` — single shared stylesheet for all pages
- `js/i18n.js` — language detection & automatic redirect script
- `assets/logo.svg` — site logo
- `assets/datahub-diagram.svg` — DataHub architecture diagram
- `market/candlestick.svg` — market diagram used on product pages

## CI/CD
- `.github/workflows/deploy.yml` — rsync deploy to Ubuntu/Nginx server on push to `main`

