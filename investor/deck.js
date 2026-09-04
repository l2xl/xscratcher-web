/* =========================================================
   Investor deck engine — page swiping with a starship divider.

   The deck is ONE continuous document: every page is a block of the
   normal flow at its own content height, and between any two pages sits
   a starship divider — a flow block too, taking its own vertical space.
   Nothing is positioned by hand; the layout is the browser's.

   Scrolling is native. What the engine adds, scrubbed by the real
   scroll position (GSAP ScrollTrigger), is:

     - a page slides up until it has been fully shown — its top under the
       header, or, for a page taller than the window, its bottom at the
       window bottom — then it stops in place and FADES OUT over a fixed
       scroll distance instead of moving (the divider below it keeps
       sliding up and out through the top window edge);
     - the next page and its divider are invisible until the page is
       about to land under the header, and fade in over that same
       distance;
     - the distance is one number for the whole deck: the height of the
       smallest page block, computed here (never assumed), capped at the
       view zone so it always fits on screen.

   Every state is a pure function of the scroll offset, so scrolling
   back plays every transition in reverse. The scrollbar is hidden
   while the engine runs.

   Also generates the slide nav (desktop sidebar) from each section's
   data-nav attribute. Without GSAP, or under prefers-reduced-motion,
   the deck is the plain stacked document with no dividers.
   ========================================================= */
(function () {
  'use strict';

  var stage = document.querySelector('.deck-stage');
  var slides = stage ? Array.prototype.slice.call(stage.querySelectorAll('.slide')) : [];
  if (!slides.length) { return; }

  var header = document.querySelector('.inv-header');
  var sidebarNav = document.getElementById('deck-nav');

  var total = slides.length;
  var current = 1;

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function headerH() { return header ? header.offsetHeight : 0; }
  function navTitle(i) { return slides[i].getAttribute('data-nav') || String(i + 1); }

  /* ---- slide nav, generated from the sections themselves ---- */
  if (sidebarNav) {
    slides.forEach(function (s, i) {
      if (!s.id) { s.id = 'slide-' + (i + 1); }
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#' + s.id;
      a.setAttribute('data-slide', String(i + 1));
      if (i === 0) { a.className = 'active'; }
      var num = document.createElement('span');
      num.className = 'deck-nav-num';
      num.textContent = pad(i + 1);
      var title = document.createElement('span');
      title.className = 'deck-nav-title';
      title.textContent = navTitle(i);
      a.appendChild(num);
      a.appendChild(title);
      li.appendChild(a);
      sidebarNav.appendChild(li);
    });
  }

  /* A page that has stopped to fade may be overlapped by the one sliding
     up under it; the later page paints on top. */
  slides.forEach(function (s, i) { s.style.zIndex = String(i + 1); });

  Array.prototype.forEach.call(document.querySelectorAll('.year-ref'), function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  /* ---- transition engine ---- */
  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var engineOn = !reduceMotion &&
    typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

  /* The fade distance: 0 until the engine measures it. */
  var fadeLen = 0;

  /* Stable viewport heights from the CSS small/large viewport units via
     hidden probes: on phones window.innerHeight swings with the browser
     chrome mid-scroll. svh sizes the view zone (nothing hides behind the
     URL bar), lvh the end spacer (the document stays reachable at maximum
     scroll). innerHeight where the units are unsupported. */
  var vhProbes = null;
  if (window.CSS && CSS.supports && CSS.supports('height', '100svh')) {
    vhProbes = {};
    ['svh', 'lvh'].forEach(function (unit) {
      var el = document.createElement('div');
      el.setAttribute('aria-hidden', 'true');
      el.style.cssText = 'position:fixed;top:0;left:0;width:0;' +
        'height:100' + unit + ';pointer-events:none;visibility:hidden;';
      document.body.appendChild(el);
      vhProbes[unit] = el;
    });
  }
  function svH() { return vhProbes ? vhProbes.svh.offsetHeight : window.innerHeight; }
  function lvH() { return vhProbes ? vhProbes.lvh.offsetHeight : window.innerHeight; }
  function zoneH() { return Math.max(1, svH() - headerH()); }

  /* Flow geometry. A pinned page is position:fixed, so its own rect no
     longer says where it sits in the document; ScrollTrigger leaves a
     .pin-spacer of the same height in flow in its place — read that. */
  function flowBox(el) {
    var p = el.parentNode;
    return (p && p.classList && p.classList.contains('pin-spacer')) ? p : el;
  }
  function docTop(el) {
    return flowBox(el).getBoundingClientRect().top +
      (window.pageYOffset || document.documentElement.scrollTop || 0);
  }
  /* Scroll offset with the page's top aligned under the header. */
  function alignYOf(el) { return docTop(el) - headerH(); }
  /* Scroll offset at which the page has been fully shown and stops to
     fade: aligned, or — taller than the zone — with its bottom edge at
     the window bottom. */
  function stopYOf(el) {
    return alignYOf(el) + Math.max(0, el.offsetHeight - zoneH());
  }

  if (engineOn) {
    gsap.registerPlugin(ScrollTrigger);
    /* Mobile URL-bar show/hide fires resize events mid-scroll; nothing
       here depends on innerHeight, so they are safe to ignore. */
    ScrollTrigger.config({ ignoreMobileResize: true });
    /* CSS smooth scrolling would animate ScrollTrigger's own measurement
       scrolls during refresh; navigation smooth-scrolls per call instead. */
    document.documentElement.style.scrollBehavior = 'auto';
    document.documentElement.classList.add('deck-engine');

    /* Starship dividers: one flow block between each pair of pages, plus
       one more INSIDE the last page's own content (appended as its last
       child, not between pages) so the deck still closes on a ship. That
       one is not a divider — it never gets its own fade — it is simply
       part of the last page, so it slides and fades exactly as the rest
       of that page's content does, for free, via the parent's opacity. */
    var flyerSrc = stage.getAttribute('data-flyer');
    var flyers = [];
    function makeFlyer(className) {
      var wrap = document.createElement('div');
      wrap.className = className;
      wrap.setAttribute('aria-hidden', 'true');
      var img = document.createElement('img');
      img.src = flyerSrc;
      img.alt = '';
      wrap.appendChild(img);
      return wrap;
    }
    if (flyerSrc) {
      slides.forEach(function (slide, i) {
        if (i === total - 1) {
          slide.appendChild(makeFlyer('deck-flyer deck-flyer--closing print-hide'));
          return;
        }
        var wrap = makeFlyer('deck-flyer print-hide');
        slide.parentNode.insertBefore(wrap, slide.nextSibling);
        flyers.push(wrap);
      });
      /* Every ship's box is 0 high until its image loads, which moves
         everything laid out after it — re-measure once they do. A cached
         image may never fire `load` after this listener attaches, hence
         the `complete` check. One listener is enough: all ships share the
         same image, so they load together. */
      var img0 = stage.querySelector('.deck-flyer img');
      if (img0 && !img0.complete) {
        img0.addEventListener('load', function () { ScrollTrigger.refresh(); });
      }
    }

    /* The document must reach the last page's aligned position even on a
       tall window: extend it by exactly what is missing. */
    var endSpacer = document.createElement('div');
    endSpacer.className = 'deck-end-spacer print-hide';
    endSpacer.setAttribute('aria-hidden', 'true');
    stage.appendChild(endSpacer);
    function sizeEndSpacer() {
      endSpacer.style.height = '0px';
      var lack = alignYOf(slides[total - 1]) + lvH() -
        document.documentElement.scrollHeight;
      endSpacer.style.height = Math.max(0, Math.ceil(lack)) + 'px';
    }

    /* The divider's clearance above and below the ship: the header
       height, so a divider is fully out of view once the page after it
       is aligned under the header, plus a little air that scales with
       the view zone. Published for the divider's CSS margins. */
    function sizeDividers() {
      var lead = headerH() + zoneH() * 0.03;
      stage.style.setProperty('--deck-flyer-lead', Math.round(lead) + 'px');
    }

    /* The fade distance, one number for every page. */
    function sizeFade() {
      var min = Infinity;
      slides.forEach(function (s) { min = Math.min(min, s.offsetHeight); });
      fadeLen = Math.max(1, Math.min(min, zoneH()));
    }

    /* Measured in the clean flow: ScrollTrigger's "revert" fires after it
       has unpinned everything and before it re-measures. refreshInit is
       dispatched with the pins still applied — a pinned page's spacer
       then still has the old height — so it is only kept as the belt for
       a refresh path that skips the revert; the later run wins. */
    function measureGeometry() {
      sizeDividers();
      sizeFade();
      sizeEndSpacer();
    }
    ScrollTrigger.addEventListener('refreshInit', measureGeometry);
    ScrollTrigger.addEventListener('revert', measureGeometry);
    measureGeometry();

    function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

    /* Every opacity in the deck, from the scroll offset alone. A page
       fades in over the fade distance before it is aligned and fades out
       over the fade distance after it has stopped; the first page is
       simply there and the last never leaves. A divider shares the fade
       in of the page above it and then just scrolls away. */
    function applyFades() {
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      slides.forEach(function (slide, i) {
        var aIn = i === 0 ? 1 :
          clamp01((y - alignYOf(slide) + fadeLen) / fadeLen);
        var aOut = i === total - 1 ? 1 :
          1 - clamp01((y - stopYOf(slide)) / fadeLen);
        gsap.set(slide, { autoAlpha: Math.min(aIn, aOut) });
        if (flyers[i]) { gsap.set(flyers[i], { autoAlpha: aIn }); }
      });
    }

    /* A page stops in place for the fade distance; with pinSpacing:false
       the document keeps its geometry, the page just does not move. */
    slides.forEach(function (slide, i) {
      if (i === total - 1) { return; }
      ScrollTrigger.create({
        trigger: slide,
        start: function () { return stopYOf(slide); },
        end: function () { return stopYOf(slide) + fadeLen; },
        pin: true,
        pinSpacing: false,
        anticipatePin: 1,
        invalidateOnRefresh: true
      });
    });
    /* Runs in the same update pass as the pins, for every scroll. */
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: applyFades });

    /* Stop positions depend on the view-zone height, so a vertical resize
       moves all of them while the scroll offset stays put. Re-anchor after
       each refresh: keep the current page aligned, preserving any in-page
       scroll it had. */
    var keepN = current, keepDy = 0;
    ScrollTrigger.addEventListener('refreshInit', function () {
      keepN = current;
      keepDy = (window.pageYOffset || 0) - targetY(keepN - 1);
    });
    ScrollTrigger.addEventListener('refresh', function () {
      var inPage = Math.max(0, slides[keepN - 1].offsetHeight - zoneH());
      window.scrollTo(0, targetY(keepN - 1) +
        Math.max(0, Math.min(keepDy, inPage)));
      applyFades();
    });
    applyFades();

    window.addEventListener('load', function () { ScrollTrigger.refresh(); });
    /* Web fonts swap in after the load event and re-flow every page. */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
    }

    /* Print must see every page: undo pins and scrubbed opacities. */
    window.addEventListener('beforeprint', function () {
      ScrollTrigger.getAll().forEach(function (t) { t.disable(); });
      gsap.set(slides, { clearProps: 'opacity,visibility' });
    });
    window.addEventListener('afterprint', function () {
      ScrollTrigger.getAll().forEach(function (t) { t.enable(); });
      ScrollTrigger.refresh();
    });
  }

  /* ---- navigation ---- */

  function targetY(i) { return i <= 0 ? 0 : alignYOf(slides[i]); }

  /* Older Safari (< 15.4) ignores the options form of scrollTo entirely —
     fall back to an instant jump so navigation always works. */
  var smoothOk = 'scrollBehavior' in document.documentElement.style;

  function goTo(n, instant) {
    n = Math.max(1, Math.min(total, n));
    /* Land 2px short of the alignment point: for a page shorter than the
       zone that exact pixel is also where its own stop begins, and
       settling on the shared boundary lets sub-pixel scroll flutter
       toggle the pin on/off — a visible shake instead of a clean stop. */
    var y = Math.max(0, targetY(n - 1) - 2);
    if (smoothOk) {
      window.scrollTo({ top: y, behavior: instant ? 'auto' : 'smooth' });
    } else {
      window.scrollTo(0, y);
    }
  }

  function setCurrent(n) {
    if (n === current) { return; }
    current = n;
    var links = document.querySelectorAll('a[data-slide]');
    Array.prototype.forEach.call(links, function (a) {
      a.classList.toggle('active', Number(a.getAttribute('data-slide')) === n);
    });
    slides.forEach(function (s, i) { s.classList.toggle('active', (i + 1) === n); });
  }

  /* The page more than half faded in is the current one. */
  function currentFromScroll() {
    var y = window.pageYOffset;
    var half = (fadeLen || zoneH()) / 2;
    var n = 1;
    for (var i = 1; i < total; i++) {
      if (y + half >= targetY(i)) { n = i + 1; }
    }
    return n;
  }

  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) { return; }
    ticking = true;
    window.requestAnimationFrame(function () {
      ticking = false;
      setCurrent(currentFromScroll());
    });
  }, { passive: true });

  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[data-slide]') : null;
    if (!a) { return; }
    e.preventDefault();
    var n = Number(a.getAttribute('data-slide'));
    if (window.history && history.replaceState) {
      history.replaceState(null, '', a.getAttribute('href'));
    }
    goTo(n);
  });

  document.addEventListener('keydown', function (e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) { return; }
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) { return; }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); goTo(current - 1); }
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); goTo(current + 1); }
    if (e.key === 'Home') { e.preventDefault(); goTo(1); }
    if (e.key === 'End') { e.preventDefault(); goTo(total); }
  });

  /* Deep links: land on #slide-N after layout settles. */
  function jumpToHash() {
    if (!location.hash) { return; }
    for (var i = 0; i < total; i++) {
      if ('#' + slides[i].id === location.hash) { goTo(i + 1, true); return; }
    }
  }
  window.addEventListener('load', function () { jumpToHash(); });

  setCurrent(currentFromScroll() || 1);
})();
