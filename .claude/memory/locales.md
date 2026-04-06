# Locale Architecture

## Structure
The site is multi-language. English is the default language, served from the root (`/`).

Additional languages are served from subdirectories named by language code:
- `/ru/` — Russian (currently implemented)
- Any future language follows the same pattern: `/<lang-code>/`

A language version is considered active when its subdirectory exists and contains the corresponding HTML pages.

## Asset sharing
Language subdirectories share assets from the root via relative `../` paths:
- `../css/style.css`
- `../assets/logo.svg`
- etc.

## Automatic language detection
`js/i18n.js` is included in `<head>` of every English (root) page. It detects the browser language and redirects to the matching `/<lang-code>/` subdirectory if that language version exists.

Language preference is stored in `localStorage` under key `tsp_lang` so that a user who explicitly switches back to English is not redirected again.

**`js/i18n.js` must only appear on root (English) pages — never inside language subdirectories** (would cause redirect loops).

## Language switcher
Each non-English page should include a link back to the English equivalent at the root, and set `localStorage.setItem('tsp_lang', 'en')` on click to suppress auto-redirect.

## Rules for adding a new language
1. Create a `/<lang-code>/` subdirectory
2. Translate all relevant pages into that subdirectory
3. Use `../` relative paths for shared assets
4. Add a language switcher link back to the English root page
5. Do NOT copy `js/i18n.js` into the subdirectory
6. Update `js/i18n.js` to handle the new language code if auto-redirect is desired

## Content parity
All language versions should stay in sync with the English source. When English content changes, update all existing language versions accordingly.
