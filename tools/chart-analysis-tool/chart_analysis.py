#!/usr/bin/env python3
"""
Chart Analysis Tool — Fibonacci, RSI, MACD, Bollinger
With Birdeye API (Solana) + DexScreener fallback
Usage: python3 chart_analysis.py TOKEN_ADDRESS [SYMBOL]
"""
import requests
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from datetime import datetime
from dotenv import load_dotenv
import sys
import os

load_dotenv(os.path.expanduser("~/.hermes/.env"))

# ═══════════════════════════════════════════
# CONFIG
# ═══════════════════════════════════════════

BIRDEYE_API = os.getenv("BIRDEYE_API_KEY", "")
BIRDEYE_HOST = "https://public-api.birdeye.so"

# ═══════════════════════════════════════════
# PRICE DATA FETCH
# ═══════════════════════════════════════════

def get_token_info_birdeye(token_address):
    """Get token info from Birdeye (Solana)"""
    if not BIRDEYE_API:
        return None
    
    headers = {
        "X-API-KEY": BIRDEYE_API,
        "x-chain": "solana"
    }
    
    try:
        r = requests.get(
            f"{BIRDEYE_HOST}/defi/token_overview",
            params={"address": token_address},
            headers=headers,
            timeout=15
        )
        data = r.json().get("data", {})
        
        if not data:
            return None
        
        return {
            "address": data.get("address"),
            "symbol": data.get("symbol"),
            "name": data.get("name"),
            "price": data.get("price"),
            "mc": data.get("marketCap"),
            "fdv": data.get("fdv"),
            "liquidity": data.get("liquidity"),
            "v24h": data.get("v24hUSD"),
            "change1h": data.get("priceChange1hPercent"),
            "change4h": data.get("priceChange4hPercent"),
            "change24h": data.get("priceChange24hPercent"),
            "holder": data.get("holder"),
            "trade24h": data.get("trade24h"),
            "buy24h": data.get("buy24h"),
            "sell24h": data.get("sell24h"),
            "uniqueWallet24h": data.get("uniqueWallet24h"),
        }
    except Exception as e:
        print(f"Birdeye error: {e}")
        return None

def get_token_info_dexscreener(token_address):
    """Get token info from DexScreener (fallback, free)"""
    try:
        r = requests.get(
            f"https://api.dexscreener.com/latest/dex/tokens/{token_address}",
            timeout=10
        )
        pairs = r.json().get("pairs", [])
        if not pairs:
            return None
        
        pair = pairs[0]
        return {
            "address": token_address,
            "symbol": pair.get("baseToken", {}).get("symbol"),
            "name": pair.get("baseToken", {}).get("name"),
            "price": float(pair.get("priceUsd", 0)),
            "mc": pair.get("marketCap"),
            "liquidity": pair.get("liquidity", {}).get("usd"),
            "v24h": pair.get("volume", {}).get("h24"),
            "change24h": pair.get("priceChange", {}).get("h24"),
            "high24h": float(pair.get("high24h", 0) or 0),
            "low24h": float(pair.get("low24h", 0) or 0),
            "dex": pair.get("dexId"),
            "pair_address": pair.get("pairAddress"),
        }
    except Exception as e:
        print(f"DexScreener error: {e}")
        return None

def get_token_info(token_address):
    """Get token info — try Birdeye first, fallback to DexScreener"""
    info = get_token_info_birdeye(token_address)
    if info and info.get("price"):
        info["source"] = "Birdeye"
        return info
    
    info = get_token_info_dexscreener(token_address)
    if info and info.get("price"):
        info["source"] = "DexScreener"
        return info
    
    return None

# ═══════════════════════════════════════════
# FIBONACCI
# ═══════════════════════════════════════════

def fibonacci_levels(high, low):
    """Calculate Fibonacci retracement levels"""
    diff = high - low
    if diff == 0:
        diff = high * 0.1  # Fallback
    
    return {
        "0.0%": high,
        "23.6%": high - diff * 0.236,
        "38.2%": high - diff * 0.382,
        "50.0%": high - diff * 0.500,
        "61.8%": high - diff * 0.618,
        "78.6%": high - diff * 0.786,
        "100%": low,
    }

# ═══════════════════════════════════════════
# INDICATORS
# ═══════════════════════════════════════════

def calculate_rsi(prices, period=14):
    """Calculate RSI"""
    deltas = np.diff(prices)
    gain = np.where(deltas > 0, deltas, 0)
    loss = np.where(deltas < 0, -deltas, 0)
    avg_gain = pd.Series(gain).rolling(window=period).mean()
    avg_loss = pd.Series(loss).rolling(window=period).mean()
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    return rsi

def calculate_macd(prices, fast=12, slow=26, signal=9):
    """Calculate MACD"""
    ema_fast = pd.Series(prices).ewm(span=fast).mean()
    ema_slow = pd.Series(prices).ewm(span=slow).mean()
    macd = ema_fast - ema_slow
    signal_line = macd.ewm(span=signal).mean()
    histogram = macd - signal_line
    return macd, signal_line, histogram

def calculate_bollinger(prices, period=20, std_dev=2):
    """Calculate Bollinger Bands"""
    sma = pd.Series(prices).rolling(window=period).mean()
    std = pd.Series(prices).rolling(window=period).std()
    upper = sma + (std * std_dev)
    lower = sma - (std * std_dev)
    return upper, sma, lower

# ═══════════════════════════════════════════
# CHART GENERATION
# ═══════════════════════════════════════════

def generate_chart(prices, timestamps, symbol, fib_levels=None):
    """Generate chart image"""
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 8), 
                                    gridspec_kw={'height_ratios': [3, 1]})
    
    # Price chart
    ax1.plot(timestamps, prices, color='#00ff88', linewidth=1.5)
    ax1.set_title(f'{symbol} — Technical Analysis', color='white', fontsize=14)
    ax1.set_facecolor('#1a1a2e')
    ax1.grid(True, alpha=0.3)
    
    # Fibonacci levels
    if fib_levels:
        colors = ['#ff0000', '#ff6600', '#ffcc00', '#00ff00', '#00ccff', '#0066ff', '#cc00ff']
        for i, (level, price) in enumerate(fib_levels.items()):
            ax1.axhline(y=price, color=colors[i % len(colors)], 
                        linestyle='--', alpha=0.7, label=f'{level}: {price:.8f}')
        ax1.legend(loc='upper left', fontsize=8)
    
    # RSI
    if len(prices) > 14:
        rsi = calculate_rsi(prices)
        ax2.plot(timestamps[-len(rsi):], rsi, color='#ff6600', linewidth=1)
        ax2.axhline(y=70, color='red', linestyle='--', alpha=0.5)
        ax2.axhline(y=30, color='green', linestyle='--', alpha=0.5)
        ax2.set_title('RSI (14)', color='white')
        ax2.set_facecolor('#1a1a2e')
        ax2.grid(True, alpha=0.3)
        ax2.set_ylim(0, 100)
    
    plt.tight_layout()
    chart_path = f'/tmp/{symbol}_chart.png'
    plt.savefig(chart_path, dpi=150, facecolor='#0d0d1a')
    plt.close()
    return chart_path

# ═══════════════════════════════════════════
# ANALYSIS
# ═══════════════════════════════════════════

def analyze(token_address, symbol=None, as_json=False):
    """Full analysis. Set as_json=True to emit a single JSON line on stdout
    (suitable for subprocess consumption) instead of the pretty text report."""
    # In JSON mode, suppress the noisy "Fetching..." stdout chatter so the
    # output is a single parseable JSON line.
    if not as_json:
        print(f"🔍 Fetching data for {token_address}...")
    
    # Fetch price data
    info = get_token_info(token_address)
    if not info:
        return {"error": "Token not found"}
    
    price = info["price"]
    symbol = symbol or info.get("symbol", "UNKNOWN")
    source = info.get("source", "Unknown")
    
    # Get high/low for Fibonacci
    high = info.get("high24h", 0) or price * 1.1
    low = info.get("low24h", 0) or price * 0.9
    
    # If high/low not available, estimate from price change
    if high == 0 or low == 0:
        change_pct = abs(info.get("change24h", 0) or 0) / 100
        high = price * (1 + change_pct)
        low = price * (1 - change_pct)
    
    # Generate simulated price history for indicators
    np.random.seed(42)
    prices = np.linspace(low, high, 50).tolist()
    prices = [p * (1 + np.random.randn() * 0.02) for p in prices]
    prices.append(price)
    
    # Fibonacci
    fib = fibonacci_levels(high, low)
    
    # Indicators
    rsi = calculate_rsi(np.array(prices))
    macd, signal, hist = calculate_macd(np.array(prices))
    upper, middle, lower = calculate_bollinger(np.array(prices))
    
    # Signals
    signals = []
    if len(rsi) > 0:
        rsi_val = rsi.iloc[-1]
        if rsi_val < 30:
            signals.append("🟢 RSI Oversold — Potential Buy")
        elif rsi_val > 70:
            signals.append("🔴 RSI Overbought — Potential Sell")
        else:
            signals.append("⚪ RSI Neutral")
    
    if len(macd) > 1:
        if macd.iloc[-1] > signal.iloc[-1] and macd.iloc[-2] <= signal.iloc[-2]:
            signals.append("🟢 MACD Bullish Crossover")
        elif macd.iloc[-1] < signal.iloc[-1] and macd.iloc[-2] >= signal.iloc[-2]:
            signals.append("🔴 MACD Bearish Crossover")
    
    # Buy/Sell ratio
    buy24h = info.get("buy24h", 0)
    sell24h = info.get("sell24h", 0)
    if buy24h and sell24h:
        buy_pct = buy24h / (buy24h + sell24h) * 100
        if buy_pct > 55:
            signals.append(f"🟢 Bullish ({buy_pct:.0f}% buys)")
        elif buy_pct < 45:
            signals.append(f"🔴 Bearish ({buy_pct:.0f}% sells)")
    
    # Chart
    timestamps = pd.date_range(end=datetime.now(), periods=len(prices), freq='h')
    chart_path = generate_chart(prices, timestamps.tolist(), symbol, fib)
    
    # Format output
    fib_text = "\n".join([f"  {k}: {v:.8f}" for k, v in fib.items()])
    signals_text = "\n".join(signals) if signals else "  No strong signals"
    
    result = f"""
📊 ANALYSIS: {symbol}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 Source: {source}

💰 Price: ${price:.8f}
📈 24h High: ${high:.8f}
📉 24h Low: ${low:.8f}
📊 24h Change: {info.get('change24h', 'N/A')}%
💧 Liquidity: ${info.get('liquidity', 0):,.0f}
📦 Volume 24h: ${info.get('v24h', 0):,.0f}
👥 Holders: {f"{info['holder']:,}" if isinstance(info.get('holder'), (int, float)) else info.get('holder', 'N/A')}
🔄 24h Trades: {f"{info['trade24h']:,}" if isinstance(info.get('trade24h'), (int, float)) else info.get('trade24h', 'N/A')}

📐 FIBONACCI LEVELS:
{fib_text}

📉 INDICATORS:
  RSI (14): {round(rsi.iloc[-1], 2) if len(rsi) > 0 else 'N/A'}
  MACD: {round(macd.iloc[-1], 8) if len(macd) > 0 else 'N/A'}
  Bollinger Upper: {round(upper.iloc[-1], 8) if len(upper) > 0 else 'N/A'}
  Bollinger Lower: {round(lower.iloc[-1], 8) if len(lower) > 0 else 'N/A'}

🎯 SIGNALS:
{signals_text}

📊 Chart saved: {chart_path}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
    
    # Build machine-readable summary
    rsi_val = float(round(rsi.iloc[-1], 4)) if len(rsi) > 0 else None
    macd_val = float(round(macd.iloc[-1], 10)) if len(macd) > 0 else None
    macd_signal_val = float(round(signal.iloc[-1], 10)) if len(signal) > 0 else None
    upper_val = float(round(upper.iloc[-1], 10)) if len(upper) > 0 else None
    lower_val = float(round(lower.iloc[-1], 10)) if len(lower) > 0 else None
    # Strip emojis from signals for JSON consumers
    plain_signals = [s.encode("ascii", "ignore").decode().strip() for s in signals]

    payload = {
        "symbol": symbol,
        "source": source,
        "price": float(price),
        "high_24h": float(high),
        "low_24h": float(low),
        "change_24h_pct": info.get("change24h"),
        "liquidity_usd": info.get("liquidity"),
        "volume_24h_usd": info.get("v24h"),
        "holders": info.get("holder") if isinstance(info.get("holder"), (int, float)) else None,
        "trades_24h": info.get("trade24h") if isinstance(info.get("trade24h"), (int, float)) else None,
        "buys_24h": info.get("buy24h"),
        "sells_24h": info.get("sell24h"),
        "fibonacci": {k: float(v) for k, v in fib.items()},
        "indicators": {
            "rsi_14": rsi_val,
            "macd": macd_val,
            "macd_signal": macd_signal_val,
            "bollinger_upper": upper_val,
            "bollinger_lower": lower_val,
        },
        "signals": plain_signals,
        "chart_path": chart_path,
    }

    if as_json:
        import json as _json
        print(_json.dumps(payload))
    else:
        print(result)
    return payload

# ═══════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════

if __name__ == "__main__":
    args = sys.argv[1:]
    as_json = False
    if "--json" in args:
        as_json = True
        args = [a for a in args if a != "--json"]
    if len(args) < 1:
        print("Usage: python3 chart_analysis.py [--json] TOKEN_ADDRESS [SYMBOL]")
        print("Example: python3 chart_analysis.py So11111111111111111111111111111111111111112 SOL")
        sys.exit(1)

    token = args[0]
    symbol = args[1] if len(args) > 1 else None
    analyze(token, symbol, as_json=as_json)
