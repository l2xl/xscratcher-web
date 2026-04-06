# Project Structure

## Site sections
| Page | File | Description |
|---|---|---|
| Landing | `index.html` | Hero, "Why we are building this" (4 problem cards), Roadmap, Philosophy strip |
| Exchange Scratcher | `exchange-scratcher.html` | Exchange Scratcher product details |
| Scratcher Assistant | `scratcher-assistant.html` | Scratcher Assistant product details |
| IPRL | `iprl.html` | IPRL product page |
| DataHub | `datahub.html` | DataHub product page |
| Mission | `mission.html` | Mission & values |

## Shared assets
- `css/style.css` — single shared stylesheet for all pages
- `js/i18n.js` — language detection & automatic redirect script
- `assets/logo.svg` — site logo
- `assets/datahub-diagram.svg` — DataHub architecture diagram
- `market/candlestick.svg` — market diagram used on product pages

## CI/CD
- `.github/workflows/deploy.yml` — rsync deploy to Ubuntu/Nginx server on push to `main`

## Local development
```bash
python3 -m http.server 8080
# open http://localhost:8080
```
