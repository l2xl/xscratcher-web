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
| Investor Deck | `investor/index.html` | Single-page deck: investor brief (slide 1) + pitch-deck slides 2–11. Russian mirror: `investor/ru/index.html`. |
| Investor One-Pager | `investor/one-pager.html` | Export-only single sheet of the brief (noindex, not linked from the site). Same copy as deck slide 1, laid out for a one-page PDF/PNG. Russian mirror: `investor/ru/one-pager.html`, sharing `../one-pager.css`. |

There is deliberately NO separate brief *deck* page and NO `pitch-deck.html` — the brief exists once as slide 1 of the deck (it used to be duplicated across two files and drifted). `one-pager.html` is the one exception: it is not a site page but the print/export sheet, and its copy must be re-synced from slide 1 whenever the brief changes.

### One-pager export (`investor/one-pager.html` + `investor/one-pager.css`)
Reuses the deck's components from `investor.css` (status pills, metric cards, `.brief-section` frames, market diagram, roadmap, terms table); `one-pager.css` adds only the sheet. Two custom properties carry the whole design: `--op-cm` is one sheet centimetre, derived from `100vw`, so the sheet always fills the screen; `--op-type` is the type scale *relative* to the sheet — growing `--op-cm` alone is a visual no-op (the whole drawing scales), `--op-type` is what makes the copy read larger against the same sheet width.

- **Wide sheet** (> 820 px): a 21 cm sheet — starship + project name in the header with the status pills opposite, two-column body (market diagram left; metrics and team frames right, starting ~1 cm under the pills), roadmap and terms strips across the full width.
- **Phone sheet** (≤ 820 px): the sheet is re-declared as ~7.9 cm wide (capped at 68 px/cm so a small tablet gets a centred sheet), single column re-ordered to intro → figures → diagram → team, diagram bled to the sheet edges.

The market diagram's labels are stated in viewBox units, not `rem` — inside a fixed coordinate system the type scale would grow them until the three groups collide. iOS notes: `viewport-fit=cover` + `env(safe-area-inset-*)` padding, `100svh` with a `100vh` fallback, and `text-size-adjust: 100%` so Safari does not inflate the copy.

Export by screenshotting the `.op-sheet` element: ~1600 px viewport at DPR 2 for the wide sheet, 430×932 at DPR 3 for the phone sheet. Both languages export from the same CSS — the RU sheet is taller because the copy is longer.

### Deck PDF export (`investor/export/make-deck-pdf.py`)
`python3 investor/export/make-deck-pdf.py ru` (or `en`) writes `investor/export/open-trader-deck-<lang>.pdf` — one slide per A4 page, each slide blown up to fill its page edge to edge, the way the earlier hand-made deck PDF read. Chromium's own pagination cannot do this (it leaves a slide sitting in the top half of the sheet at web type size), so the script lays the pages out itself: it serves the repo over a throwaway HTTP server, loads the deck in headless Chromium with `reduced_motion` (so deck.js never starts the transition engine), switches to print media, then wraps every slide in a page-sized box and searches for the largest scale at which the slide still fits.

Four things that look like details but are the whole export:
- The pages are laid out on a **1600 px-wide design sheet** of A4 proportions and the finished print is scaled down (`page.pdf(scale=…)`). Laying out at paper width (794 px) would put every responsive layout into its phone form — the deck's two-column rows collapse and, worst of all, the one-pager sheet below drops to its ≤820 px phone layout.
- The scale is CSS **`zoom`**, not `transform` — Chromium's print pipeline re-lays out a transformed subtree and clips it, while the browser screenshot of the same page looks perfect. Zoom is a real layout scale and prints identically to the screen.
- The slide is laid out at `page width / zoom`, so zooming up narrows the layout and the type grows against the sheet — the same lever as the one-pager's `--op-type`. `MIN_SCALE`/`MAX_SCALE` are stated against the finished A4 sheet and divided by `PDF_SCALE` before use; the 2.0 ceiling is what keeps a sparse slide's copy from turning into a poster — the charts are page-width whatever the zoom, so a capped slide reads as a bigger chart against smaller type, and the leftover air is centred rather than left hanging under the content.
- The fit is a **bisection**, not a fixed-point iteration: rewrapping copy makes height(zoom) jumpy and the naive iteration oscillates, leaving half-empty pages. A zoom counts as fitting only when the content also stops short of any horizontal clipping, so the wide comparison/data tables (which scroll sideways on screen) are never cut and no table outgrows the column it sits in — in print they drop their screen `min-width` and shrink to content, the round-terms table sizes to its content with no value broken across lines, and the swipe hint is hidden. For the same reason the deck's slide columns state their width in per cent, never in px: a `flex: 0 0 250px` column keeps its 250 px while the layout around it narrows with the zoom, which is what squeezed the terms table into vertical letter stacks.

The **opening page is the one-pager sheet**, not the deck's brief slide: same copy, but laid out to own a whole sheet, which is how the printed deck opened. It is embedded as a same-origin iframe at the design width and stretched to the page — the sheet derives `--op-cm` from its own viewport width and carries `min-height: 100svh`, so it lays itself into whatever frame it is given, no fitting needed; the deck's brief slide and doc header are dropped so the page count stays one-per-slide. `--brief slide` prints the deck's own brief slide instead.

The starship, dropped by the deck's print rules, is put back once per slide page, at the very bottom: its band is reserved before the fit, and a slide too dense to pay for it keeps the whole page instead. The opening sheet never gets one — it flies its own in the header. `--no-flyer` prints without ships. Needs `pip install playwright`; it uses the Chromium already under `PLAYWRIGHT_BROWSERS_PATH` when the Playwright-pinned build is absent.

The current exports are committed under `investor/export/` (`open-trader-one-pager-{en,ru}[-phone].pdf`) so the sheet that was actually sent to an investor is recoverable. They are build output, not a source: re-export and overwrite them whenever the brief copy or the sheet layout changes. Note the deploy rsyncs the whole repo, so these files are reachable by URL on the live site (unlinked, like the deck itself) — add an `--exclude` in `.github/workflows/deploy.yml` if that is not wanted.

### Deck engine (`investor/deck.js` + `investor/vendor/`)
`deck.js` is a content-agnostic page-swiping engine shared by all deck language versions. It discovers `.deck-stage .slide` sections at runtime (any count/content) and builds the desktop sidebar nav from each section's `data-nav` attribute (keyboard Prev/Next and deep links work; there is deliberately NO footer control panel and NO mobile nav dropdown). The deck is ONE continuous document: every page is a block of the normal flow at its own content height, and between each pair of pages the engine inserts a **starship divider** (the image named by the stage's `data-flyer` attribute — `x-fighter.png`) as a flow block that takes its own vertical space. Nothing is absolutely positioned and nothing overlaps in the layout; the only measured numbers are the divider's clearance (header height + 3% of the view zone, published as `--deck-flyer-lead` for its CSS margins) and the **fade distance** — the height of the smallest page block, capped at the view zone, one number for the whole deck.

Mechanics, all scrubbed by the real scroll position (vendored GSAP + ScrollTrigger, `investor/vendor/gsap.min.js` + `ScrollTrigger.min.js`, free license, self-hosted): scrolling is native; a page slides up until it has been fully shown (its top under the header, or for a page taller than the view zone its bottom at the window bottom), then it is pinned in place (`pinSpacing:false`, so the document geometry never changes) and fades out over the fade distance instead of moving, while the divider below it keeps sliding up and out through the top edge. The next page and its divider are invisible until the page is within the fade distance of landing under the header, then fade in over that distance. Every opacity is a pure function of the scroll offset (`applyFades`, driven by one whole-document ScrollTrigger `onUpdate`), so scrolling back replays every transition in reverse. On load only the first page and its divider are visible; the scrollbar is hidden (`html.deck-engine`) while the engine runs. Geometry is re-measured on ScrollTrigger's `revert` event (after pins are undone, before it re-measures — `refreshInit` still has the pins applied) and slide positions are read through the `.pin-spacer` a pinned slide leaves in flow; viewport heights come from hidden 100svh/100lvh probes, never `window.innerHeight`; an engine-sized end spacer keeps the last page reachable on tall windows; after every refresh the scroll re-anchors to the current page; `load`, the divider image's `load` and `document.fonts.ready` each trigger a refresh. Falls back to the plain stacked document with no dividers without JS or under `prefers-reduced-motion`; print CSS + the beforeprint handler neutralize the engine so PDF export prints one slide per page. The deck closes on a ship too: the last page gets no divider after it (there is no next page to lead), so its own closing ship is appended as an ordinary child of the last `.slide` instead — it slides and fades with that page's content for free, via the parent's opacity, with no separate JS handling.

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

