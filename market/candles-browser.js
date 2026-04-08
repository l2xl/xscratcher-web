/* candles-browser.js
 * Fetches Bybit candles in the browser and renders them into an SVG element.
 * Browser-side replacement for the server-side fetch_candles.py + crontab.
 *
 * Exposes a single global: CandleChart
 *
 * Quick start:
 *   CandleChart.load(svgEl, { symbol:'BTCUSDC', interval:'15', limit:100 }, onStatus);
 *
 * The target SVG element must contain three child groups:
 *   <g id="grid"></g>
 *   <g id="candles"></g>
 *   <g id="overlay"></g>
 *
 * API:
 *   CandleChart.load(svgEl, opts, onStatus)  — fetch + render; falls back to built-in data on error
 *   CandleChart.render(svgEl, candles)        — render a candles array directly (no network call)
 *   CandleChart.fetchCandles(opts, callback)  — fetch only; callback(err, candles)
 *
 * opts fields (all optional):
 *   symbol   {string}  trading pair,        default 'BTCUSDC'
 *   interval {string}  kline interval,      default '15' (minutes; Bybit also accepts 'D','W','M')
 *   limit    {number}  number of candles,   default 100
 *
 * Candle object shape (same as candles.json produced by fetch_candles.py):
 *   { t: <unix ms>, o: <float>, h: <float>, l: <float>, c: <float> }
 */

var CandleChart = (function () {
  'use strict';

  var BYBIT_KLINE_URL = 'https://api.bybit.com/v5/market/kline';

  /* Built-in fallback — shown when the live API is unreachable */
  var FALLBACK = [
    {o:210,h:217,l:204,c:206},{o:206,h:212,l:201,c:209},{o:209,h:215,l:207,c:213},
    {o:213,h:218,l:208,c:210},{o:210,h:214,l:205,c:207},{o:207,h:213,l:203,c:211},
    {o:211,h:220,l:209,c:218},{o:218,h:225,l:215,c:222},{o:222,h:229,l:219,c:226},
    {o:226,h:232,l:222,c:228},{o:228,h:235,l:225,c:231},{o:231,h:238,l:227,c:235},
    {o:235,h:241,l:230,c:237},{o:237,h:244,l:233,c:240},{o:240,h:247,l:236,c:242},
    {o:242,h:250,l:239,c:247},{o:247,h:253,l:243,c:250},{o:250,h:256,l:246,c:252},
    {o:252,h:259,l:248,c:255},{o:255,h:262,l:251,c:258},{o:258,h:265,l:254,c:261},
    {o:261,h:268,l:257,c:265},{o:265,h:272,l:261,c:268},{o:268,h:276,l:264,c:272},
    {o:272,h:280,l:268,c:276},{o:276,h:284,l:272,c:280},{o:280,h:288,l:276,c:284},
    {o:284,h:289,l:278,c:279},{o:279,h:283,l:270,c:272},{o:272,h:276,l:264,c:268},
    {o:268,h:274,l:262,c:271},{o:271,h:278,l:267,c:275},{o:275,h:281,l:270,c:272},
    {o:272,h:277,l:264,c:268},{o:268,h:273,l:260,c:265},{o:265,h:270,l:257,c:262},
    {o:262,h:268,l:255,c:258},{o:258,h:264,l:252,c:256},{o:256,h:262,l:250,c:253},
    {o:253,h:259,l:247,c:251},{o:251,h:257,l:245,c:254},{o:254,h:260,l:249,c:257},
    {o:257,h:263,l:252,c:260},{o:260,h:266,l:255,c:263},{o:263,h:270,l:259,c:267},
    {o:267,h:274,l:263,c:271},{o:271,h:278,l:267,c:275},{o:275,h:282,l:271,c:278},
    {o:278,h:283,l:269,c:271},{o:271,h:275,l:261,c:264},{o:264,h:268,l:254,c:258},
    {o:258,h:263,l:250,c:255},{o:255,h:260,l:248,c:253},{o:253,h:258,l:246,c:251},
    {o:251,h:256,l:244,c:249},{o:249,h:254,l:243,c:252},{o:252,h:258,l:248,c:255},
    {o:255,h:261,l:251,c:258},{o:258,h:265,l:254,c:262},{o:262,h:269,l:258,c:266},
    {o:266,h:273,l:262,c:270},{o:270,h:278,l:266,c:274},{o:274,h:282,l:270,c:277},
    {o:277,h:283,l:268,c:271},{o:271,h:276,l:262,c:265},{o:265,h:270,l:256,c:260},
    {o:260,h:265,l:252,c:256},{o:256,h:262,l:249,c:254},{o:254,h:260,l:247,c:252},
    {o:252,h:258,l:246,c:255},{o:255,h:261,l:250,c:258},{o:258,h:264,l:253,c:261},
    {o:261,h:267,l:256,c:263},{o:263,h:270,l:258,c:267},{o:267,h:273,l:262,c:264},
    {o:264,h:269,l:255,c:257},{o:257,h:262,l:250,c:253},{o:253,h:258,l:247,c:251},
    {o:251,h:257,l:245,c:249},{o:249,h:256,l:244,c:253},{o:253,h:260,l:249,c:257},
    {o:257,h:264,l:253,c:261},{o:261,h:268,l:257,c:265}
  ];

  var GREEN     = '#3ecf8e';
  var RED       = '#f44336';
  var GRID_COL  = '#272727';
  var AXIS_TEXT = '#888888';
  var LAST_LINE = '#2962ff';
  var NS        = 'http://www.w3.org/2000/svg';

  var W = 1200, H = 700;
  var M = { top: 20, right: 72, bottom: 28, left: 8 };
  var chartW = W - M.left - M.right;
  var chartH = H - M.top - M.bottom;

  /* ── SVG helpers ─────────────────────────────────────────────────────── */

  function mk(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) { e.setAttribute(k, String(attrs[k])); }
    parent.appendChild(e);
    return e;
  }

  function clearGroup(svgEl, id) {
    var g = svgEl.querySelector('#' + id);
    while (g.firstChild) { g.removeChild(g.firstChild); }
    return g;
  }

  /* ── Renderer ─────────────────────────────────────────────────────────── */

  function render(svgEl, DATA) {
    var grid = clearGroup(svgEl, 'grid');
    var cg   = clearGroup(svgEl, 'candles');
    var ov   = clearGroup(svgEl, 'overlay');

    var prices = [];
    for (var i = 0; i < DATA.length; i++) { prices.push(DATA[i].h, DATA[i].l); }
    var minP = Math.min.apply(null, prices);
    var maxP = Math.max.apply(null, prices);
    var pad  = (maxP - minP) * 0.06;
    var lo   = minP - pad;
    var hi   = maxP + pad;

    function py(p) { return M.top + chartH - ((p - lo) / (hi - lo)) * chartH; }
    var spacing = chartW / DATA.length;
    var cw = Math.max(1, Math.floor(spacing * 0.65));
    function cx(idx) { return M.left + idx * spacing + spacing / 2; }

    /* grid lines + price axis */
    var STEPS = 9;
    for (var s = 0; s <= STEPS; s++) {
      var p = lo + (hi - lo) * (s / STEPS);
      var y = py(p);
      mk('line', { x1: M.left, y1: y, x2: W - M.right, y2: y, stroke: GRID_COL, 'stroke-width': 1 }, grid);
      mk('text', { x: W - M.right + 6, y: y + 4, fill: AXIS_TEXT, 'font-size': 11, 'font-family': 'monospace' }, grid)
        .textContent = p.toFixed(2);
    }
    mk('line', { x1: W - M.right, y1: M.top,        x2: W - M.right, y2: H - M.bottom, stroke: '#333333', 'stroke-width': 1 }, grid);
    mk('line', { x1: M.left,      y1: H - M.bottom, x2: W - M.right, y2: H - M.bottom, stroke: '#333333', 'stroke-width': 1 }, grid);

    /* candle bodies + wicks */
    for (var j = 0; j < DATA.length; j++) {
      var d   = DATA[j];
      var x   = cx(j);
      var col = d.c >= d.o ? GREEN : RED;
      var bTop = py(Math.max(d.o, d.c));
      var bBot = py(Math.min(d.o, d.c));
      var bH   = Math.max(1, bBot - bTop);
      mk('line', { x1: x, y1: py(d.h), x2: x, y2: py(d.l), stroke: col, 'stroke-width': 1 }, cg);
      mk('rect', { x: x - cw / 2, y: bTop, width: cw, height: bH, fill: col }, cg);
    }

    /* last-price line + label */
    var last = DATA[DATA.length - 1].c;
    var ly   = py(last);
    mk('line', { x1: M.left, y1: ly, x2: W - M.right, y2: ly, stroke: LAST_LINE, 'stroke-width': 1, 'stroke-dasharray': '3,3', opacity: 0.8 }, ov);
    mk('rect', { x: W - M.right, y: ly - 9, width: M.right - 2, height: 18, fill: LAST_LINE, rx: 2 }, ov);
    mk('text', { x: W - M.right + 4, y: ly + 4, fill: '#ffffff', 'font-size': 11, 'font-family': 'monospace', 'font-weight': 'bold' }, ov)
      .textContent = last.toFixed(2);
  }

  /* ── Fetcher ──────────────────────────────────────────────────────────── */

  function fetchCandles(opts, callback) {
    var symbol   = (opts && opts.symbol)   || 'BTCUSDC';
    var interval = (opts && opts.interval) || '15';
    var limit    = (opts && opts.limit)    || 100;

    var url = BYBIT_KLINE_URL +
      '?category=spot' +
      '&symbol='   + encodeURIComponent(symbol) +
      '&interval=' + encodeURIComponent(interval) +
      '&limit='    + encodeURIComponent(limit);

    var xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.onload = function () {
      if (xhr.status !== 200) { callback('HTTP ' + xhr.status); return; }
      var data;
      try { data = JSON.parse(xhr.responseText); } catch (e) { callback('JSON parse error'); return; }
      if (data.retCode !== 0) { callback('Bybit: ' + data.retMsg); return; }
      var rows = data.result && data.result.list;
      if (!rows || rows.length === 0) { callback('empty kline list'); return; }

      rows = rows.slice().reverse();   /* Bybit returns newest-first */
      var candles = [];
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        candles.push({ t: parseInt(r[0], 10), o: parseFloat(r[1]), h: parseFloat(r[2]), l: parseFloat(r[3]), c: parseFloat(r[4]) });
      }
      callback(null, candles);
    };
    xhr.onerror = function () { callback('network error'); };
    xhr.send();
  }

  /* ── Combined load (fetch + render + fallback) ────────────────────────── */

  function load(svgEl, opts, onStatus) {
    fetchCandles(opts, function (err, candles) {
      if (err) {
        render(svgEl, FALLBACK);
        if (onStatus) { onStatus('Error: ' + err + ' — showing fallback data', true); }
        return;
      }
      render(svgEl, candles);
      if (onStatus) {
        var sym = (opts && opts.symbol) || 'BTCUSDC';
        var ivl = (opts && opts.interval) || '15';
        onStatus(candles.length + ' candles · ' + sym + ' ' + ivl + 'm · ' + new Date().toLocaleTimeString(), false);
      }
    });
  }

  return { load: load, render: render, fetchCandles: fetchCandles };
}());
