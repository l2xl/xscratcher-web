# Project Structure

## Site sections
| Page | File | Description |
|---|---|---|
| Landing | `index.html` | Hero, "Why we are building this" (4 problem cards), Roadmap, Philosophy strip |
| X·Cockpit | `x-cockpit.html` | X·Cockpit - standalone exchange trading application details |
| The Scratcher Assistant | `scratcher-assistant.html` | The Scratcher Assistant - AI assistant details |
| IPRL | `iprl.html` | Intellectual Property Reserve License page |
| DataHub | `datahub.html` | DataHub library description |
| Mission | `mission.html` | X·Cockpit Mission |

## Investor section (`investor/`)
Self-contained subdirectory for investor relations. Uses its own stylesheet (`investor/investor.css`) and local assets — does NOT share the root `css/style.css`.

| Page | File | Description |
|---|---|---|
| Investor Brief | `investor/index.html` | X-Cockpit investor brief landing page |
| Pitch Deck | `investor/pitch-deck.html` | Investor relations pitch deck |

### Investor-local assets (`investor/assets/`)
- `sci-fi-planet.png` — decorative hero illustration
- `triple-arrow.png` — icon/graphic used in the deck
- `x-logo.png` — X-Cockpit logo

## Shared assets
- `css/style.css` — single shared stylesheet for all pages
- `js/i18n.js` — language detection & automatic redirect script
- `assets/logo.svg` — site logo
- `assets/datahub-diagram.svg` — DataHub architecture diagram
- `market/candlestick.svg` — market diagram used on product pages

## CI/CD
- `.github/workflows/deploy.yml` — rsync deploy to Ubuntu/Nginx server on push to `main`

