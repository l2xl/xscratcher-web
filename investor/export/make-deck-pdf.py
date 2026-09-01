#!/usr/bin/env python3
"""Export the investor deck (investor/index.html or investor/ru/index.html)
to a print-ready PDF: one slide per A4 page, each slide blown up to fill its
whole page edge to edge — the way a slide deck reads, not the way a web page
paginates.

The deck itself is a scrolling document, so Chromium's own pagination leaves
a slide sitting in the top half of an A4 page at web type size. This script
instead lays out every slide by hand: it serves the repo over HTTP, loads the
deck in headless Chromium with reduced motion (so deck.js never starts the
transition engine), then wraps each slide in a page-sized box and scales it
until its content fills the page. The scale is CSS `zoom` (a real layout
scale — a `transform` is re-laid out differently by Chromium's print
pipeline and comes out clipped) applied to a slide laid out at
`page width / zoom`, so scaling up narrows the layout and the type grows
against the sheet, exactly like the one-pager's `--op-type`.

The starship, dropped by the deck's print rules, is put back at the very
bottom of the page — but only where reserving its band still leaves the slide
a comfortable scale, so a dense slide keeps the full page for its content.

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

CM = 96 / 2.54  # CSS px per cm
A4_W, A4_H = 21.0, 29.7  # cm
PAGE_W, PAGE_H = round(A4_W * CM), round(A4_H * CM)

# The sheet bleeds: the @page margin is zero and this is the only breathing
# room the slide keeps against the paper edge.
PAD = round(0.75 * CM)

# Scale bounds for the fit. The floor keeps a very dense slide readable
# rather than shrinking it to nothing; the ceiling stops a sparse slide from
# turning into a poster.
MIN_SCALE, MAX_SCALE = 0.5, 2.8

# Bottom starship: share of the page width, the clear band kept above it,
# and the scale below which the slide needs the page more than the ship.
FLYER_W_RATIO = 0.26
FLYER_GAP = round(0.5 * CM)
FLYER_MIN_SCALE = 0.85


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


# Strips the document chrome (header, sidebar, doc paddings) so a page box is
# free to be exactly one sheet wide, and hands pagination to those boxes.
PAGE_CSS = """
@page { size: A4 portrait; margin: 0; }
html, body {
  margin: 0 !important;
  padding: 0 !important;
  /* Keep the deck's own paper colour: the site's print rules force white. */
  background: var(--inv-bg, #fffaf5) !important;
}
.inv-header, .inv-sidebar, .inv-right-space, .deck-end-spacer,
.deck-flyer, .brief-planet,
/* a swipe hint means nothing on paper */
.deck-scroll-hint { display: none !important; }
.inv-wrapper, .inv-doc, .inv-doc-body, .deck-stage {
  display: block !important;
  margin: 0 !important;
  padding: 0 !important;
  max-width: none !important;
  width: auto !important;
  gap: 0 !important;
}
.print-page {
  position: relative;
  box-sizing: border-box;
  width: %(pw)dpx;
  height: %(ph)dpx;
  padding: %(pad)dpx;
  overflow: hidden;
  break-after: page;
  page-break-after: always;
  background: var(--inv-bg, #fffaf5);
}
.print-page:last-of-type { break-after: auto; page-break-after: auto; }
.print-fit { position: static; }
/* Inside a page box the slide is plain content: no viewport-sized breathing
   gap, no page break of its own — the box owns the geometry now. */
.print-fit .slide {
  display: flex !important;
  flex-direction: column;
  position: static !important;
  opacity: 1 !important;
  visibility: visible !important;
  transform: none !important;
  min-height: 0 !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  break-after: auto !important;
  page-break-after: auto !important;
}
/* On screen a wide table scrolls sideways inside its wrapper; on paper
   there is nowhere to scroll, so it has to shrink to its content instead —
   the screen min-width goes, and the row labels may wrap. The fit then
   stops zooming as soon as the table would be cut (see clipsX). */
.print-fit .deck-compare-wrap > table,
.print-fit .deck-table-wrap > table { min-width: 0 !important; }
.print-fit .deck-compare tbody th { white-space: normal !important; }
.print-flyer {
  position: absolute;
  left: 50%%;
  bottom: %(pad)dpx;
  transform: translateX(-50%%);
}
.print-flyer img { display: block; width: 100%%; height: auto; }
"""


# Builds the pages in the document and reports the per-slide scale/ship.
BUILD_PAGES = """
(cfg) => {
  const stage = document.querySelector('.deck-stage');
  const slides = Array.prototype.slice.call(stage.querySelectorAll('.slide'));
  const docHeader = document.querySelector('.inv-doc-header');
  const src = cfg.flyer ? stage.getAttribute('data-flyer') : null;

  const shipRatio = src ? cfg.shipRatio : 0;
  const shipW = Math.round(cfg.pageW * cfg.flyerW);

  const measure = () => new Promise(resolve => {
    if (!src) { return resolve(0); }
    const probe = new Image();
    probe.onload = probe.onerror = () => {
      const r = probe.naturalWidth ? probe.naturalHeight / probe.naturalWidth : 0.5;
      resolve(Math.round(shipW * r));
    };
    probe.src = src;
  });

  return measure().then(shipH => {
    const availW = cfg.pageW - cfg.pad * 2;
    const report = [];

    /* Largest zoom at which the slide still fits `room` px of page height.
       The slide is laid out at availW / zoom, so a bigger zoom means a
       narrower layout: the copy rewraps and the height does not follow the
       zoom smoothly. A fixed-point iteration oscillates on that, so the fit
       is a bisection — height(zoom) is monotonic enough for it, and 14
       passes land within a thousandth. */
    const apply = (el, z) => {
      el.style.zoom = z;
      el.style.width = (availW / z) + 'px';
    };
    /* A wide table lives in a horizontally scrollable wrapper on screen;
       on paper there is nothing to scroll, so a zoom that would cut its
       columns off does not count as a fit. */
    const clipsX = el => Array.prototype.some.call(
      el.querySelectorAll('*'),
      n => {
        const ox = getComputedStyle(n).overflowX;
        return (ox === 'auto' || ox === 'scroll') &&
          n.scrollWidth > n.clientWidth + 1;
      });
    const fits = (el, z, room) => {
      apply(el, z);
      return el.getBoundingClientRect().height <= room && !clipsX(el);
    };
    const fit = (el, room) => {
      let lo = cfg.minScale, hi = cfg.maxScale;
      if (fits(el, hi, room)) { return hi; }
      if (!fits(el, lo, room)) { apply(el, lo); return lo; }
      for (let i = 0; i < 14; i++) {
        const mid = (lo + hi) / 2;
        if (fits(el, mid, room)) { lo = mid; } else { hi = mid; }
      }
      apply(el, lo);
      return lo;
    };

    slides.forEach((slide, i) => {
      const page = document.createElement('div');
      page.className = 'print-page';
      const fitBox = document.createElement('div');
      fitBox.className = 'print-fit';
      slide.parentNode.insertBefore(page, slide);
      page.appendChild(fitBox);
      /* The document header (project name + status pills) belongs to the
         opening page, the way it did in the printed deck. */
      if (i === 0 && docHeader) { fitBox.appendChild(docHeader); }
      fitBox.appendChild(slide);

      const full = cfg.pageH - cfg.pad * 2;
      const withShip = shipH ? full - shipH - cfg.gap : full;
      /* Reserve the ship's band first; if paying for it would squeeze the
         slide too hard, the content takes the whole page instead. */
      let scale = shipH ? fit(fitBox, withShip) : fit(fitBox, full);
      const ship = shipH > 0 && scale >= cfg.flyerMinScale;
      if (shipH && !ship) { scale = fit(fitBox, full); }

      if (ship) {
        const wrap = document.createElement('div');
        wrap.className = 'print-flyer';
        wrap.style.width = shipW + 'px';
        const img = document.createElement('img');
        img.src = src;
        img.alt = '';
        wrap.appendChild(img);
        page.appendChild(wrap);
      }
      report.push({ id: slide.id, scale: Math.round(scale * 100) / 100, ship: ship });
    });
    return report;
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
                viewport={"width": PAGE_W, "height": PAGE_H},
                reduced_motion="reduce",  # keeps deck.js out of the engine path
                device_scale_factor=2,
            ).new_page()
            page.goto(url, wait_until="networkidle")
            page.emulate_media(media="print")
            page.add_style_tag(content=PAGE_CSS % {
                "pw": PAGE_W, "ph": PAGE_H, "pad": PAD,
            })
            report = page.evaluate(BUILD_PAGES, {
                "pageW": PAGE_W, "pageH": PAGE_H, "pad": PAD, "gap": FLYER_GAP,
                "minScale": MIN_SCALE, "maxScale": MAX_SCALE,
                "flyer": with_flyer, "flyerW": FLYER_W_RATIO,
                "flyerMinScale": FLYER_MIN_SCALE, "shipRatio": 1,
            })
            page.pdf(
                path=out,
                width="%gcm" % A4_W,
                height="%gcm" % A4_H,
                print_background=True,
                margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
            )
            browser.close()
    finally:
        httpd.shutdown()
    return report


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
    report = export(args.lang, out, with_flyer=not args.no_flyer)
    for row in report:
        print("  %-9s scale %.2f%s" % (
            row["id"], row["scale"], "  + starship" if row["ship"] else ""))
    print("%s (%d pages)" % (out, len(report)))


if __name__ == "__main__":
    main()
