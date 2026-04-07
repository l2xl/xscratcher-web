#!/usr/bin/env python3
"""
Fetch BTCUSDC 15-min candles from Bybit spot market and write market/candles.json.

The JSON file is consumed at runtime by market/candlestick.svg via XHR.
It is NOT tracked by git — update it only on the live server via cron.

Usage:
    python3 market/fetch_candles.py [--symbol BTCUSDC] [--interval 15] [--limit 80]

Cron example (every 15 minutes):
    */15 * * * * cd /var/www/scratcher && python3 market/fetch_candles.py >> /var/log/candles.log 2>&1

Bybit kline row format (newest-first):
    [startTimeMs, open, high, low, close, volume, turnover]
"""

import json
import sys
import argparse
from pathlib import Path
from urllib.request import urlopen
from urllib.error import URLError, HTTPError

BYBIT_KLINE_URL = "https://api.bybit.com/v5/market/kline"
OUT_PATH = Path(__file__).parent / "candles.json"


def fetch_candles(symbol, interval, limit):
    url = "{}?category=spot&symbol={}&interval={}&limit={}".format(
        BYBIT_KLINE_URL, symbol, interval, limit
    )
    try:
        with urlopen(url, timeout=20) as resp:
            data = json.loads(resp.read().decode())
    except HTTPError as e:
        print("ERROR: HTTP {} from Bybit API: {}".format(e.code, e.reason), file=sys.stderr)
        sys.exit(1)
    except URLError as e:
        print("ERROR: network error: {}".format(e.reason), file=sys.stderr)
        sys.exit(1)

    if data.get("retCode") != 0:
        print("ERROR: Bybit API: {}".format(data.get("retMsg")), file=sys.stderr)
        sys.exit(1)

    rows = data["result"]["list"]
    if not rows:
        print("ERROR: empty kline list returned", file=sys.stderr)
        sys.exit(1)

    # Bybit returns newest-first; reverse to chronological order
    rows = rows[::-1]

    candles = []
    for row in rows:
        # row: [startTimeMs, open, high, low, close, volume, turnover]
        candles.append({
            "t": int(row[0]),          # Unix ms timestamp — useful for future tooltips
            "o": round(float(row[1]), 2),
            "h": round(float(row[2]), 2),
            "l": round(float(row[3]), 2),
            "c": round(float(row[4]), 2),
        })

    return candles


def main():
    parser = argparse.ArgumentParser(description="Fetch Bybit candles → market/candles.json")
    parser.add_argument("--symbol",   default="BTCUSDC", help="Trading pair (default: BTCUSDC)")
    parser.add_argument("--interval", default="15",      help="Kline interval in minutes (default: 15)")
    parser.add_argument("--limit",    default=100, type=int, help="Number of candles (default: 100)")
    args = parser.parse_args()

    candles = fetch_candles(args.symbol, args.interval, args.limit)
    OUT_PATH.write_text(json.dumps(candles, separators=(",", ":")), encoding="utf-8")
    print("Wrote {} candles to {}".format(len(candles), OUT_PATH))


if __name__ == "__main__":
    main()
