#!/usr/bin/env python3
"""
Fetch BTCUSDC 15-min candles from Bybit spot market and update market/candlestick.svg.

Usage:
    python3 market/fetch_candles.py [--symbol BTCUSDC] [--interval 15] [--limit 80]

Bybit kline API returns rows as:
    [startTime, openPrice, highPrice, lowPrice, closePrice, volume, turnover]
    newest-first; this script reverses to chronological order.
"""

import json
import re
import sys
import argparse
from pathlib import Path
from urllib.request import urlopen
from urllib.error import URLError, HTTPError

BYBIT_KLINE_URL = "https://api.bybit.com/v5/market/kline"
SVG_PATH = Path(__file__).parent / "candlestick.svg"


def fetch_candles(symbol: str, interval: str, limit: int) -> list:
    url = f"{BYBIT_KLINE_URL}?category=spot&symbol={symbol}&interval={interval}&limit={limit}"
    try:
        with urlopen(url, timeout=20) as resp:
            data = json.loads(resp.read().decode())
    except HTTPError as e:
        print(f"ERROR: HTTP {e.code} from Bybit API: {e.reason}", file=sys.stderr)
        sys.exit(1)
    except URLError as e:
        print(f"ERROR: network error fetching Bybit data: {e.reason}", file=sys.stderr)
        sys.exit(1)

    if data.get("retCode") != 0:
        print(f"ERROR: Bybit API returned error: {data.get('retMsg')}", file=sys.stderr)
        sys.exit(1)

    rows = data["result"]["list"]
    if not rows:
        print("ERROR: Bybit API returned empty kline list", file=sys.stderr)
        sys.exit(1)

    # Bybit returns newest-first; reverse to chronological order
    rows = rows[::-1]

    candles = []
    for row in rows:
        # row: [startTime, open, high, low, close, volume, turnover]
        o, h, l, c = float(row[1]), float(row[2]), float(row[3]), float(row[4])
        candles.append({"o": round(o, 2), "h": round(h, 2), "l": round(l, 2), "c": round(c, 2)})

    return candles


def format_data_js(candles: list) -> str:
    """Format candle list as compact JS array literal, 3 entries per line."""
    lines = []
    chunk_size = 3
    for i in range(0, len(candles), chunk_size):
        chunk = candles[i : i + chunk_size]
        parts = ["{o:" + str(d["o"]) + ",h:" + str(d["h"]) + ",l:" + str(d["l"]) + ",c:" + str(d["c"]) + "}" for d in chunk]
        lines.append("  " + ",".join(parts))
    return "[\n" + ",\n".join(lines) + "\n]"


def update_svg(candles: list) -> bool:
    """Replace DATA array in candlestick.svg. Returns True if file was changed."""
    svg = SVG_PATH.read_text(encoding="utf-8")

    new_data = "const DATA = " + format_data_js(candles) + ";"
    pattern = r"const DATA = \[[\s\S]*?\];"
    new_svg, count = re.subn(pattern, new_data, svg)

    if count == 0:
        print("ERROR: could not find 'const DATA = [...]' pattern in SVG", file=sys.stderr)
        sys.exit(1)

    if new_svg == svg:
        print("No change — SVG already up to date.")
        return False

    SVG_PATH.write_text(new_svg, encoding="utf-8")
    print(f"Updated {SVG_PATH} with {len(candles)} candles.")
    return True


def main():
    parser = argparse.ArgumentParser(description="Fetch Bybit candles and update candlestick.svg")
    parser.add_argument("--symbol",   default="BTCUSDC", help="Trading pair symbol (default: BTCUSDC)")
    parser.add_argument("--interval", default="15",      help="Kline interval in minutes (default: 15)")
    parser.add_argument("--limit",    default=80, type=int, help="Number of candles (default: 80, max: 200)")
    args = parser.parse_args()

    candles = fetch_candles(args.symbol, args.interval, args.limit)
    update_svg(candles)


if __name__ == "__main__":
    main()
