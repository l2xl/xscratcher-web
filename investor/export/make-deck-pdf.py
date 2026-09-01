#!/usr/bin/env python3
"""Export the investor deck (investor/index.html or investor/ru/index.html)
to a print-ready PDF, one slide per A4 page.

The deck's print CSS already neutralises the scroll engine; this script
serves the repo over HTTP, loads the page with reduced motion (so deck.js
stays a plain stacked document), emulates print media and lets Chromium
paginate. The starship, hidden by the deck's own print rules, is put back
once per slide, pushed down to the very bottom of the slide's last page —
and only where that page has room left for it, so it never pushes content
onto a page of its own.

Usage:
    python3 investor/export/make-deck-pdf.py ru
    python3 investor/export/make-deck-pdf.py en -o /tmp/deck-en.pdf
    python3 investor/export/make-deck-pdf.py ru --no-flyer

Requires: pip install playwright  (Chromium from PLAYWRIGHT_BROWSERS_PATH).
"""

import argparse
import functools
import http.server
import os
import socketserver
import threading

from playwright.sync_api import sync_playwright

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Must mirror the @page rule in investor/investor.css.
PAGE = {"size": "A4", "top": 1.4, "right": 1.6, "bottom": 1.2, "left": 1.6}  # cm
CM = 96 / 2.54  # CSS px per cm
A4_W, A4_H = 21.0, 29.7

CONTENT_W = round((A4_W - PAGE["left"] - PAGE["right"]) * CM)
CONTENT_H = round((A4_H - PAGE["top"] - PAGE["bottom"]) * CM)

# Bottom starship: share of the content width, and the clear space kept
# between the slide's content end and the ship.
FLYER_W_RATIO = 0.32
FLYER_GAP = 26  # px


def chromium_path():
    """A pinned Chromium (e.g. PLAYWRIGHT_BROWSERS_PATH on CI images) may not
    match the Playwright build; fall back to whatever binary is on disk."""
    root = os.environ.get("PLAYWRIGHT_BROWSERS_PATH", "")
    for base in sorted(os.listdir(root)) if os.path.isdir(root) else []:
        exe = os.path.join(root, base, "chrome-linux", "chrome")
        if base.startswith("chromium") and os.path.exists(exe):
            return exe
    return None


def serve(root):
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=root)
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, httpd.server_address[1]


PLACE_FLYER = """
([pageH, gap, widthRatio]) => {
  const stage = document.querySelector('.deck-stage');
  const src = stage && stage.getAttribute('data-flyer');
  if (!src) { return 0; }
  const slides = Array.prototype.slice.call(stage.querySelectorAll('.slide'));
  const w = Math.round(document.querySelector('.slide').clientWidth * widthRatio);
  return new Promise(resolve => {
    const probe = new Image();
    probe.onload = probe.onerror = () => {
      const ratio = probe.naturalHeight && probe.naturalWidth
        ? probe.naturalHeight / probe.naturalWidth : 0.5;
      const shipH = Math.round(w * ratio);
      let placed = 0;
      slides.forEach(slide => {
        /* Only a slide that still fits on one page with the ship under it
           gets one: a slide already spilling onto a second page has no room
           to spare, and a ship pushed to the bottom there would just take a
           page of its own. */
        if (slide.getBoundingClientRect().height > pageH - shipH - gap * 2) {
          return;
        }
        /* The slide is a column flexbox: stretching it to exactly one
           printable page and letting the ship take the leftover as an auto
           margin drops it to the very bottom — no guessing where the
           printer breaks. */
        // The deck's print CSS flattens slides to display:block; the ship
        // needs the original column flexbox back to claim the leftover.
        slide.style.setProperty('display', 'flex', 'important');
        slide.style.setProperty('flex-direction', 'column', 'important');
        slide.style.minHeight = pageH + 'px';
        slide.style.paddingBottom = '0';
        const wrap = document.createElement('div');
        wrap.className = 'deck-print-flyer';
        wrap.style.cssText = 'margin:auto auto 0;width:' + w +
          'px;break-inside:avoid;';
        const img = document.createElement('img');
        img.src = src;
        img.alt = '';
        img.style.cssText = 'width:100%;height:auto;display:block;';
        wrap.appendChild(img);
        slide.appendChild(wrap);
        placed += 1;
      });
      resolve(placed);
    };
    probe.src = src;
  });
}
"""

def export(lang, out, with_flyer=True):
    httpd, port = serve(REPO)
    path = "investor/index.html" if lang == "en" else "investor/%s/index.html" % lang
    url = "http://127.0.0.1:%d/%s" % (port, path)
    try:
        with sync_playwright() as p:
            exe = chromium_path()
            browser = p.chromium.launch(executable_path=exe) if exe \
                else p.chromium.launch()
            page = browser.new_context(
                viewport={"width": CONTENT_W, "height": CONTENT_H},
                reduced_motion="reduce",  # keeps deck.js out of the engine path
                device_scale_factor=2,
            ).new_page()
            page.goto(url, wait_until="networkidle")
            page.emulate_media(media="print")
            # The deck's own print CSS drops the in-flight ships; ours is a
            # separate element, so opt it back in explicitly.
            page.add_style_tag(content=(
                "@media print{.deck-print-flyer{display:block !important;}"
                ".deck-stage .slide:last-of-type{padding-bottom:0;}}"
            ))
            placed = 0
            if with_flyer:
                placed = page.evaluate(
                    PLACE_FLYER, [CONTENT_H, FLYER_GAP, FLYER_W_RATIO]
                )
            page.pdf(
                path=out,
                format=PAGE["size"],
                print_background=True,
                prefer_css_page_size=True,
                margin={
                    "top": "%gcm" % PAGE["top"],
                    "right": "%gcm" % PAGE["right"],
                    "bottom": "%gcm" % PAGE["bottom"],
                    "left": "%gcm" % PAGE["left"],
                },
            )
            browser.close()
    finally:
        httpd.shutdown()
    return placed


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("lang", nargs="?", default="ru", help="deck language (en, ru, ...)")
    ap.add_argument("-o", "--output", help="output PDF path")
    ap.add_argument("--no-flyer", action="store_true",
                    help="print without the bottom starship")
    args = ap.parse_args()

    out = args.output or os.path.join(
        REPO, "investor", "export", "open-trader-deck-%s.pdf" % args.lang
    )
    placed = export(args.lang, out, with_flyer=not args.no_flyer)
    print("%s (starship on %d slide(s))" % (out, placed))


if __name__ == "__main__":
    main()
