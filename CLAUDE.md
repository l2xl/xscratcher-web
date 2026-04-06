# xscratcher-web — The Scratcher Project Website

Static marketing site for The Scratcher Project. Built with vanilla HTML5, CSS3, and minimal JavaScript. No build tools, no package managers, no frameworks.

## Dev stack
- Plain HTML5 + CSS3 + vanilla JS (ES5 compatible)
- No preprocessors, no bundlers, no npm
- Assets: SVG only (no raster images except favicons)
- Deployment: GitHub Actions → rsync → Ubuntu + Nginx

## Local development
```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

## Conventions
- Keep HTML semantic: use `<header>`, `<main>`, `<section>`, `<footer>`, `<nav>` correctly
- CSS custom properties are defined at the top of `css/style.css` — use them, don't hardcode values
- Inline `<style>` and `<script>` tags are acceptable only for page-specific one-liners
- Shared JS goes in `js/`; shared CSS goes in `css/`
- No `alert()`, `console.log()` left in production code
- All external links: `target="_blank" rel="noopener"`
- Keep English and Russian pages in content sync — when you change copy on an English page, update the Russian counterpart in `ru/`

## Memory files (indexed context)
@.claude/memory/project_structure.md
@.claude/memory/locales.md
