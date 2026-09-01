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

The opening page is the one-pager sheet (`investor/[<lang>/]one-pager.html`),
not the deck's brief slide: it is the same copy, but laid out to own a whole
sheet, which is how the printed deck opened. It is embedded as a same-origin
iframe sized to the wide (non-phone) sheet and zoomed to the page — the sheet
sizes itself from its own viewport width, so the iframe width IS its design
width. `--brief slide` prints the deck's brief slide instead.

The starship, dropped by the deck's print rules, is put back at the very
bottom of the page — but only where reserving its band still leaves the slide
a comfortable scale, so a dense slide keeps the full page for its content.

Usage:
    python3 investor/export/make-deck-pdf.py ru
    python3 investor/export/make-deck-pdf.py en -o /tmp/deck-en.pdf
    python3 investor/export/make-deck-pdf.py ru --no-flyer
    python3 investor/export/make-deck-pdf.py ru --brief slide

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

# The pages are laid out on a wide "design sheet" and the whole print is
# scaled down to A4 at the end. Laying out at paper width (794 px) would put
# every responsive layout on the site — the deck's grids and, above all, the
# one-pager sheet, whose phone layout starts at 820 px — into its phone form.
PAGE_W = 1600
PAGE_H = round(PAGE_W * A4_H / A4_W)
PDF_SCALE = A4_W * CM / PAGE_W

# The sheet bleeds: the @page margin is zero and this is the only breathing
# room the slide keeps against the paper edge.
PAD = round(0.75 * CM / PDF_SCALE)

# Scale bounds for the fit, stated against the finished A4 sheet (the design
# sheet is bigger, so the zooms the script actually applies are these divided
# by PDF_SCALE). The floor keeps a very dense slide readable rather than
# shrinking it to nothing; the ceiling stops a sparse slide from turning into
# a poster — a sparse slide stops growing its type and keeps the air instead
# (its charts are page-width already, so they only gain from the contrast).
MIN_SCALE, MAX_SCALE = 0.5 / PDF_SCALE, 2.0 / PDF_SCALE

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
  /* A slide that stops at the zoom ceiling leaves air: centre it in the
     page (above the ship's band) instead of hanging it from the top. */
  display: flex;
  flex-direction: column;
  justify-content: center;
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
/* The round-terms table is one row of short values: let it size to its
   content and never break a value across lines — the fit backs the zoom off
   until it fits its column (see clipsX). */
.print-fit .brief-terms-table { table-layout: auto !important; }
.print-fit .brief-terms-table th,
.print-fit .brief-terms-table td { white-space: nowrap !important; }
/* The opening page's one-pager sheet: a same-origin frame, laid out at its
   wide design width and zoomed onto the sheet. */
.print-sheet {
  display: block;
  border: 0;
  margin: 0 auto;
  zoom: 1;
}
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
       columns off does not count as a fit — nor does one that pushes a
       table past the column it sits in. */
    const clipsX = el => Array.prototype.some.call(
      el.querySelectorAll('*'),
      n => {
        const ox = getComputedStyle(n).overflowX;
        return (ox === 'auto' || ox === 'scroll') &&
          n.scrollWidth > n.clientWidth + 1;
      }) || Array.prototype.some.call(
      el.querySelectorAll('table'),
      t => t.parentElement &&
        t.getBoundingClientRect().width >
          t.parentElement.getBoundingClientRect().width + 1);
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

    const addShip = page => {
      const wrap = document.createElement('div');
      wrap.className = 'print-flyer';
      wrap.style.width = shipW + 'px';
      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      wrap.appendChild(img);
      page.appendChild(wrap);
    };

    const full = cfg.pageH - cfg.pad * 2;
    const withShip = shipH ? full - shipH - cfg.gap : full;

    /* The opening page is the one-pager sheet, embedded from its own file:
       the sheet derives its every dimension from its viewport width, so the
       frame is laid out at the wide design width and the whole frame is
       then zoomed onto the page. Its own brief slide in the deck would be
       the same copy in a scrolling-page layout, so it is dropped. */
    const deckSlides = cfg.sheetUrl ? slides.slice(1) : slides;
    if (cfg.sheetUrl) { slides[0].remove(); }
    const sheetPage = () => new Promise(resolve => {
      const page = document.createElement('div');
      page.className = 'print-page';
      const frame = document.createElement('iframe');
      frame.className = 'print-sheet';
      frame.src = cfg.sheetUrl;
      frame.style.width = cfg.sheetW + 'px';
      frame.style.height = Math.round(cfg.sheetW * 1.6) + 'px';
      frame.setAttribute('scrolling', 'no');
      page.appendChild(frame);
      stage.parentNode.insertBefore(page, stage);
      frame.addEventListener('load', () => {
        /* The sheet is built to fill its viewport (its `--op-cm` comes from
           100vw and it carries `min-height: 100svh`), so the frame is given
           the page's shape at the design width and the sheet lays itself out
           into it — no fitting, no reflow guessing. */
        const z = availW / cfg.sheetW;
        /* No bottom ship here: the sheet flies its own in the header, and
           it is built to own the whole page. */
        frame.style.height = Math.round(full / z) + 'px';
        frame.style.zoom = z;
        resolve({ id: 'one-pager', scale: z, ship: false });
      });
    });

    deckSlides.forEach((slide, i) => {
      const page = document.createElement('div');
      page.className = 'print-page';
      const fitBox = document.createElement('div');
      fitBox.className = 'print-fit';
      slide.parentNode.insertBefore(page, slide);
      page.appendChild(fitBox);
      /* Without the sheet the deck's own document header (project name +
         status pills) opens the first page, the way it does on the site. */
      if (i === 0 && docHeader) {
        if (cfg.sheetUrl) { docHeader.style.display = 'none'; }
        else { fitBox.appendChild(docHeader); }
      }
      fitBox.appendChild(slide);

      /* Reserve the ship's band first; if paying for it would squeeze the
         slide too hard, the content takes the whole page instead. */
      let scale = shipH ? fit(fitBox, withShip) : fit(fitBox, full);
      const ship = shipH > 0 && scale >= cfg.flyerMinScale;
      if (shipH && !ship) { scale = fit(fitBox, full); }
      if (ship) {
        addShip(page);
        page.style.paddingBottom = (cfg.pad + shipH + cfg.gap) + 'px';
      }
      report.push({ id: slide.id, scale: Math.round(scale * 100) / 100, ship: ship });
    });

    if (!cfg.sheetUrl) { return report; }
    return sheetPage().then(row => [row].concat(report));
  });
}
"""


def export(lang, out, with_flyer=True, brief="sheet"):
    httpd, port = serve(REPO)
    sub = "" if lang == "en" else "%s/" % lang
    url = "http://127.0.0.1:%d/investor/%sindex.html" % (port, sub)
    sheet_url = "/investor/%sone-pager.html" % sub if brief == "sheet" else None
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
                "sheetUrl": sheet_url, "sheetW": PAGE_W,
            })
            page.pdf(
                path=out,
                width="%gcm" % A4_W,
                height="%gcm" % A4_H,
                scale=PDF_SCALE,  # design sheet -> A4
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
    ap.add_argument("--brief", choices=("sheet", "slide"), default="sheet",
                    help="opening page: the one-pager sheet (default) or the "
                         "deck's own brief slide")
    args = ap.parse_args()

    out = args.output or os.path.join(
        REPO, "investor", "export", "open-trader-deck-%s.pdf" % args.lang
    )
    report = export(args.lang, out, with_flyer=not args.no_flyer,
                    brief=args.brief)
    for row in report:
        print("  %-10s scale %.2f%s" % (
            row["id"], row["scale"] * PDF_SCALE,
            "  + starship" if row["ship"] else ""))
    print("%s (%d pages)" % (out, len(report)))


if __name__ == "__main__":
    main()
