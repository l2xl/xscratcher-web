/* =========================================================
   Investor deck engine — pinned cross-fade page transitions.

   Content-agnostic: it discovers `.deck-stage .slide` sections at
   runtime — any number, any content, any language. Per page:

     1. the page sits aligned under the sticky header and scrolls
        natively until its own bottom edge is on screen;
     2. then the page pins in place and, as scrolling continues,
        dissolves (fade-out) while
     3. the next page rises from below the viewport, fading in,
        until it lands aligned under the header.

   The motion is scrubbed by the real scroll position (GSAP
   ScrollTrigger), so wheel, trackpad and touch all keep native
   physics and every transition is reversible mid-gesture.

   Also generates the slide nav (sidebar + mobile header dropdown)
   from each section's data-nav attribute, and drives the footer
   counter / progress bar / Prev-Next buttons.

   Fallbacks: without GSAP, or under prefers-reduced-motion, the
   deck is a plain vertically stacked document — everything stays
   readable and the nav still works.
   ========================================================= */
(function () {
  'use strict';

  var stage = document.querySelector('.deck-stage');
  var slides = stage ? Array.prototype.slice.call(stage.querySelectorAll('.slide')) : [];
  if (!slides.length) { return; }

  var header = document.querySelector('.inv-header');
  var sidebarNav = document.getElementById('deck-nav');
  var headerList = document.getElementById('inv-nav-list');
  var counter = document.getElementById('deck-counter');
  var progress = document.getElementById('deck-progress');
  var prevBtn = document.getElementById('deck-prev');
  var nextBtn = document.getElementById('deck-next');
  var navToggle = document.querySelector('.inv-nav-toggle');
  var toggleLabel = document.querySelector('.inv-nav-toggle-label');
  var slideWord = (document.documentElement.lang || 'en').indexOf('ru') === 0 ? 'Слайд' : 'Slide';

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
    if (headerList) { headerList.innerHTML = sidebarNav.innerHTML; }
  }

  /* Later slides overlap earlier ones while they rise in. */
  slides.forEach(function (s, i) { s.style.zIndex = String(i + 1); });

  Array.prototype.forEach.call(document.querySelectorAll('.year-ref'), function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  /* ---- mobile header dropdown ---- */
  if (navToggle) {
    navToggle.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', String(!open));
    });
    document.addEventListener('click', function () {
      if (navToggle.getAttribute('aria-expanded') === 'true') {
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---- transition engine ---- */
  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var engineOn = !reduceMotion &&
    typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  var pins = [];

  function zoneH() { return Math.max(1, window.innerHeight - headerH()); }

  /* Flow geometry (pinSpacing:false keeps it constant; during a refresh
     ScrollTrigger reverts pins before these are re-evaluated).
     Pages are as tall as their content, so the next page sits in flow
     right after this page's content end (plus the slide's own bottom
     padding) — that is exactly where it appears from. A page taller than
     the view zone scrolls internally first and pins when its bottom edge
     reaches the window bottom; a shorter one pins as soon as it is the
     current page, so any further scroll starts its transition. */
  function docTop(el) {
    return el.getBoundingClientRect().top +
      (window.pageYOffset || document.documentElement.scrollTop || 0);
  }
  function alignYOf(el) { return docTop(el) - headerH(); }
  function pinStartOf(el) {
    return alignYOf(el) + Math.max(0, el.offsetHeight - zoneH());
  }
  function transLenOf(el) { return Math.min(zoneH(), el.offsetHeight); }

  if (engineOn) {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
    /* CSS smooth scrolling would animate ScrollTrigger's own measurement
       scrolls during refresh; navigation smooth-scrolls per call instead. */
    document.documentElement.style.scrollBehavior = 'auto';

    /* On a tall window the document can end before the last page's
       transition zone does — there is nothing left to scroll, so the last
       page would hang at the window bottom stuck mid-fade. This spacer
       extends the document exactly enough for the maximum scroll offset
       to reach the last page's aligned position. Sized on refreshInit so
       every refresh measures against the corrected geometry. */
    var endSpacer = document.createElement('div');
    endSpacer.className = 'deck-end-spacer print-hide';
    endSpacer.setAttribute('aria-hidden', 'true');
    stage.appendChild(endSpacer);
    function sizeEndSpacer() {
      endSpacer.style.height = '0px';
      var need = alignYOf(slides[total - 1]) + window.innerHeight;
      var lack = need - document.documentElement.scrollHeight;
      endSpacer.style.height = Math.max(0, Math.ceil(lack)) + 'px';
      /* Absolutely-positioned ships can stick out past the flow bottom;
         where the spacer and that overhang overlap, the first pass
         under-counts — top up against a fresh measurement. */
      lack = need - document.documentElement.scrollHeight;
      if (lack > 0) {
        endSpacer.style.height =
          (parseFloat(endSpacer.style.height) + Math.ceil(lack)) + 'px';
      }
    }
    /* Page starship (the stage's data-flyer attribute): every page IS
       "starship, then content" — the ship rides a fixed distance above
       its own page's top border and moves only by native scroll, always
       synchronous with its page. The distance includes the header height,
       so with the page aligned under the header the ship has fully left
       through the top window border. Hidden by default, it fades in with
       its rising page during the transition (sharing the page's opacity,
       see applyFades), leading it over the pinned, fading one. */
    var flyerSrc = stage.getAttribute('data-flyer');
    var flyers = [];
    if (flyerSrc) {
      slides.forEach(function () {
        /* Wrapper carries flow position + fade (GSAP); the inner image
           carries the CSS waggle loop — transforms stay un-conflicted. */
        var wrap = document.createElement('div');
        wrap.className = 'deck-flyer print-hide';
        wrap.setAttribute('aria-hidden', 'true');
        var img = document.createElement('img');
        img.src = flyerSrc;
        img.alt = '';
        wrap.appendChild(img);
        stage.appendChild(wrap);
        gsap.set(wrap, { autoAlpha: 0 });
        flyers.push(wrap);
      });
      /* One extra ship after the last page — the "fake empty next page"
         with nothing but its starship, so the last real page also gets a
         ship idling below. The active-page rule shows it (flyers[total])
         exactly while the last page is active. */
      var tail = flyers[0].cloneNode(true);
      stage.appendChild(tail);
      gsap.set(tail, { autoAlpha: 0 });
      flyers.push(tail);
      flyers[0].firstChild.addEventListener('load', function () { ScrollTrigger.refresh(); });
    }
    /* Stage-relative via document rects: ScrollTrigger wraps pinned
       slides in pin-spacer divs, so slide offsetTop is useless here. */
    function placeFlyers() {
      var lead = 20;
      var stageTop = docTop(stage);
      flyers.forEach(function (el, i) {
        var y;
        if (i < total) {
          y = docTop(slides[i]) - stageTop -
            el.offsetHeight - headerH() - lead;
        } else {
          /* Trailing ship: below the last page's content, at the same
             content-to-ship distance every other gap uses. */
          var last = slides[total - 1];
          var pad = parseFloat(getComputedStyle(last).paddingBottom) || 0;
          y = docTop(last) - stageTop + last.offsetHeight - pad +
            headerH() + lead;
        }
        el.style.top = Math.round(y) + 'px';
      });
    }

    ScrollTrigger.addEventListener('refreshInit', function () {
      placeFlyers();
      sizeEndSpacer();
    });
    placeFlyers();
    sizeEndSpacer();

    /* Every page's opacity is written by this one function, combining the
       progress of the transition INTO the page and the one OUT of it:
       fade-in over the middle 90% of the incoming zone, fade-out over the
       first 70% of the outgoing zone, invisible before it arrives. Being
       the single writer (driven by pin onUpdate + refresh) makes the state
       correct for any scroll position — deep links, reverse swipes,
       resizes — with no tween-ownership conflicts. */
    /* One rule: the active page is the one whose arrival transition is
       complete and whose departure is not, and only the NEXT page's ship
       is shown. It fades in (then idles with the CSS waggle loop) the
       moment the active page reaches its default position, stays shown
       through its whole flight — it is still the not-yet-arrived next
       page — and once it lands it is above the top window border and
       the rule moves on to the following ship. Every other ship is
       hidden, so no two ships are ever on screen. */
    var shipShown = [];
    function updateShips() {
      /* "Arrived" tolerates the 2px goTo undershoot (see goTo): anything
         past 99% of a transition counts as landed. */
      var active = total - 1;
      for (var p = 0; p < pins.length; p++) {
        if (pins[p] && pins[p].progress < 0.99) { active = p; break; }
      }
      flyers.forEach(function (el, i) {
        var show = (i === active + 1);
        if (show === !!shipShown[i]) { return; }
        shipShown[i] = show;
        gsap.killTweensOf(el);
        gsap.to(el, show ?
          { autoAlpha: 1, duration: 1.2, ease: 'power2.out' } :
          { autoAlpha: 0, duration: 0.35, ease: 'power1.out' });
      });
    }

    function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
    function applyFades() {
      var alphas = slides.map(function (slide, i) {
        var aIn = (i > 0 && pins[i - 1]) ?
          clamp01((pins[i - 1].progress - 0.05) / 0.90) : 1;
        var aOut = (i < total - 1 && pins[i]) ?
          1 - clamp01(pins[i].progress / 0.70) : 1;
        return Math.min(aIn, aOut);
      });
      slides.forEach(function (slide, i) {
        gsap.set(slide, { autoAlpha: alphas[i] });
      });
      updateShips();
    }

    slides.forEach(function (slide, i) {
      if (i === total - 1) { return; }
      pins[i] = ScrollTrigger.create({
        trigger: slide,
        start: function () { return pinStartOf(slide); },
        end: function () { return pinStartOf(slide) + transLenOf(slide); },
        pin: true,
        pinSpacing: false,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: applyFades
      });
    });

    /* Every pin's start/end depends on the view-zone height, so a vertical
       resize moves all of them while the scroll offset stays put — the same
       offset suddenly lands mid-transition elsewhere and pages appear to
       flip on their own. Re-anchor after each refresh: keep the current
       page aligned, preserving any in-page scroll it had (clamped to the
       page's own scrollable extent under the new geometry). Both snapshot
       and restore use targetY(), so each side is consistent with its own
       generation of pin positions. */
    var keepN = current, keepDy = 0;
    ScrollTrigger.addEventListener('refreshInit', function () {
      keepN = current;
      keepDy = (window.pageYOffset || 0) - targetY(keepN - 1);
    });
    ScrollTrigger.addEventListener('refresh', function () {
      applyFades();
      var inPage = Math.max(0, slides[keepN - 1].offsetHeight - zoneH());
      window.scrollTo(0, targetY(keepN - 1) +
        Math.max(0, Math.min(keepDy, inPage)));
    });
    applyFades();

    window.addEventListener('load', function () { ScrollTrigger.refresh(); });

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

  /* Scroll offset at which slide i sits aligned under the header. With
     pinSpacing:false the pins never change document geometry, so the pin-end
     of the transition INTO a slide is exactly that alignment point. */
  function targetY(i) {
    if (i <= 0) { return 0; }
    if (pins[i - 1]) { return pins[i - 1].end; }
    var el = slides[i];
    return el.getBoundingClientRect().top + window.pageYOffset - headerH();
  }

  /* Older Safari (< 15.4) ignores the options form of scrollTo entirely —
     fall back to an instant jump so navigation always works. */
  var smoothOk = 'scrollBehavior' in document.documentElement.style;

  function goTo(n, instant) {
    n = Math.max(1, Math.min(total, n));
    /* Land 2px short of the alignment point: for short pages that exact
       pixel is also where their own departure pin starts, and settling
       on the shared boundary lets sub-pixel scroll flutter (fractional
       DPI scaling) toggle the pin on/off — a visible shake instead of a
       clean stop. */
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
    if (counter) { counter.textContent = pad(n) + ' / ' + pad(total); }
    if (progress) { progress.style.width = (n / total * 100) + '%'; }
    if (toggleLabel) { toggleLabel.textContent = slideWord + ' ' + n + ' · ' + navTitle(n - 1); }
    if (prevBtn) { prevBtn.disabled = (n === 1); }
    if (nextBtn) { nextBtn.disabled = (n === total); }
  }

  function currentFromScroll() {
    var y = window.pageYOffset;
    var n = 1;
    for (var i = 1; i < total; i++) {
      var half = pins[i - 1] ?
        (pins[i - 1].end - pins[i - 1].start) / 2 : zoneH() / 2;
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

  if (prevBtn) { prevBtn.addEventListener('click', function () { goTo(current - 1); }); }
  if (nextBtn) { nextBtn.addEventListener('click', function () { goTo(current + 1); }); }

  document.addEventListener('keydown', function (e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) { return; }
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) { return; }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); goTo(current - 1); }
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); goTo(current + 1); }
    if (e.key === 'Home') { e.preventDefault(); goTo(1); }
    if (e.key === 'End') { e.preventDefault(); goTo(total); }
  });

  /* Deep links: land on #slide-N after layout (and pin geometry) settles. */
  function jumpToHash() {
    if (!location.hash) { return; }
    for (var i = 0; i < total; i++) {
      if ('#' + slides[i].id === location.hash) { goTo(i + 1, true); return; }
    }
  }
  window.addEventListener('load', function () { jumpToHash(); });

  setCurrent(currentFromScroll() || 1);
  prevBtn && (prevBtn.disabled = (current === 1));
  nextBtn && (nextBtn.disabled = (current === total));
})();
