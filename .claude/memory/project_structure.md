# Project Structure

## Site sections
| Page | File | Description |
|---|---|---|
| Landing | `index.html` | Hero, "Why we are building this" (4 problem cards), Roadmap, Philosophy strip |
| The Exchange Scratchpad | `exchange-scratcher.html` | The Exchange Scratchpad - standalone exchange trading application details |
| The Scratcher Assistant | `scratcher-assistant.html` | The Scratcher Assistant - AI assistant details |
| IPRL | `iprl.html` | Intellectual Property Reserve License page |
| DataHub | `datahub.html` | DataHub library description |
| Mission | `mission.html` | The Exchange Scratcher Mission |

## Shared assets
- `css/style.css` — single shared stylesheet for all pages
- `js/i18n.js` — language detection & automatic redirect script
- `assets/logo.svg` — site logo
- `assets/datahub-diagram.svg` — DataHub architecture diagram
- `market/candlestick.svg` — market diagram used on product pages

## CI/CD
- `.github/workflows/deploy.yml` — rsync deploy to Ubuntu/Nginx server on push to `main`

