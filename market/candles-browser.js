/* candles-browser.js
 * Fetches candlestick data from Bybit spot market API directly in the browser.
 * Browser-side alternative to server-side fetch_candles.py + crontab.
 *
 * Candle object shape: { t: <unix ms>, o, h, l, c: <float> }
 * Same format as candles.json produced by fetch_candles.py.
 *
 * Usage:
 *   fetchCandles({ symbol: 'BTCUSDC', interval: '15', limit: 100 }, function(err, candles) {
 *     if (err) { ... }
 *     else { render(candles); }
 *   });
 */

var BYBIT_KLINE_URL = 'https://api.bybit.com/v5/market/kline';

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

  xhr.onload = function() {
    if (xhr.status !== 200) {
      callback('HTTP ' + xhr.status);
      return;
    }
    var data;
    try {
      data = JSON.parse(xhr.responseText);
    } catch (e) {
      callback('JSON parse error: ' + e.message);
      return;
    }
    if (data.retCode !== 0) {
      callback('Bybit API error: ' + data.retMsg);
      return;
    }
    var rows = data.result && data.result.list;
    if (!rows || rows.length === 0) {
      callback('empty kline list returned by API');
      return;
    }

    /* Bybit returns newest-first; reverse to chronological order */
    rows = rows.slice().reverse();

    var candles = [];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      candles.push({
        t: parseInt(row[0], 10),          /* unix ms timestamp */
        o: parseFloat(row[1]),
        h: parseFloat(row[2]),
        l: parseFloat(row[3]),
        c: parseFloat(row[4])
      });
    }

    callback(null, candles);
  };

  xhr.onerror = function() { callback('network error'); };
  xhr.send();
}
