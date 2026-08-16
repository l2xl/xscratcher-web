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

There is deliberately NO separate brief page and NO `pitch-deck.html` — the brief exists only once, as slide 1 of the deck (it used to be duplicated across two files and drifted).

### Deck engine (`investor/deck.js` + `investor/vendor/`)
`deck.js` is a content-agnostic pinned cross-fade transition engine shared by all deck language versions. It discovers `.deck-stage .slide` sections at runtime (any count/content), builds the sidebar + mobile nav from each section's `data-nav` attribute, and drives the footer counter/progress/Prev-Next. Per page: scroll natively until the page bottom is on screen → the page pins and fades out while the next page rises from below, fading in (scrubbed by real scroll position; wheel/touch keep native physics). Powered by vendored GSAP + ScrollTrigger (`investor/vendor/gsap.min.js`, `investor/vendor/ScrollTrigger.min.js` — free license, self-hosted, no CDN). Falls back to a plain stacked scrolling document without JS or under `prefers-reduced-motion`; print CSS + beforeprint handler neutralize the engine so PDF export prints one slide per page.

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

