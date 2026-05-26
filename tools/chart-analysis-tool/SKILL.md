---
name: superagent-m15
description: Chart analysis — Fibonacci, RSI, MACD, Bollinger Bands, price data fetch, auto-analisa
category: superagent
---

# m15 — Chart Analysis & Technical Indicators

---

## Kapan pakai skill ini
- Analisa chart crypto (Solana, EVM)
- Hitung Fibonacci retracement
- Hitung indikator teknikal (RSI, MACD, Bollinger)
- Fetch live price data
- Generate chart image
- Auto-recommendation entry/exit

---

## Dependencies

```bash
pip install requests matplotlib numpy pandas ta python-dotenv
```

## Pitfalls

1. **Birdeye API key tiers matter** — Free/basic keys only work with v2 endpoints (`/defi/token_overview`), NOT v3 (`/defi/v3/token/single` returns 404 or 401). Always try v2 first.
2. **Birdeye rate limits** — v2 endpoints return 429 fast if called in quick succession. Add `time.sleep(2)` between calls.
3. **DexScreener no OHLCV** — DexScreener doesn't provide full OHLCV candle data, only price snapshots. For real candle charts, use Birdeye or TradingView embed.
4. **pandas freq format** — Newer pandas (2.x+) requires lowercase freq: `'h'` not `'1H'`. Older versions use `'1H'`.
5. **Birdeye API host** — Always `https://public-api.birdeye.so`, NOT `api.birdeye.so` (521 error) or `public-api.birdeye.com` (DNS fail).

---

## 1. Fetch Price Data

### Birdeye API (Solana)

```python
import requests

BIRDEYE_API = "https://public-api.birdeye.so"

def get_price_birdeye(token_address, chain="solana"):
    """Get current price from Birdeye"""
    headers = {"X-API-KEY": "YOUR_BIRDEYE_KEY"}
    r = requests.get(
        f"{BIRDEYE_API}/defi/v3/token/single",
        params={"address": token_address, "chain": chain},
        headers=headers,
        timeout=10
    )
    data = r.json().get("data", {})
    return {
        "price": data.get("price"),
        "symbol": data.get("symbol"),
        "name": data.get("name"),
        "mc": data.get("mc"),
        "liquidity": data.get("liquidity"),
        "v24h": data.get("v24hUSD")
    }

def get_ohlcv_birdeye(token_address, timeframe="1H", limit=100):
    """Get OHLCV data from Birdeye"""
    headers = {"X-API-KEY": "YOUR_BIRDEYE_KEY"}
    r = requests.get(
        f"{BIRDEYE_API}/defi/v3/chart/kline",
        params={
            "address": token_address,
            "type": timeframe,  # 1m, 5m, 15m, 1H, 4H, 1D
            "limit": limit
        },
        headers=headers,
        timeout=10
    )
    return r.json().get("data", {}).get("items", [])
```

### DexScreener (Free, no API key)

```python
def get_price_dexscreener(token_address):
    """Get price from DexScreener (free)"""
    r = requests.get(
        f"https://api.dexscreener.com/latest/dex/tokens/{token_address}",
        timeout=10
    )
    pairs = r.json().get("pairs", [])
    if not pairs:
        return None
    
    pair = pairs[0]
    return {
        "price": float(pair.get("priceUsd", 0)),
        "symbol": pair.get("baseToken", {}).get("symbol"),
        "name": pair.get("baseToken", {}).get("name"),
        "mc": pair.get("marketCap"),
        "liquidity": pair.get("liquidity", {}).get("usd"),
        "v24h": pair.get("volume", {}).get("h24"),
        "change24h": pair.get("priceChange", {}).get("h24"),
        "pair_address": pair.get("pairAddress"),
        "dex": pair.get("dexId")
    }

def get_ohlcv_dexscreener(pair_address, timeframe="1h"):
    """Get OHLCV from DexScreener"""
    r = requests.get(
        f"https://api.dexscreener.com/latest/dex/pairs/solana/{pair_address}",
        timeout=10
    )
    data = r.json().get("pairs", [{}])[0]
    # DexScreener doesn't provide full OHLCV, use price history
    return data
```

---

## 2. Fibonacci Retracement

```python
def fibonacci_levels(high, low):
    """Calculate Fibonacci retracement levels"""
    diff = high - low
    return {
        "0.0%": high,
        "23.6%": high - diff * 0.236,
        "38.2%": high - diff * 0.382,
        "50.0%": high - diff * 0.500,
        "61.8%": high - diff * 0.618,  # Golden ratio ⭐
        "78.6%": high - diff * 0.786,
        "100%": low,
        # Extension levels
        "127.2%": low - diff * 0.272,
        "161.8%": low - diff * 0.618,
    }

def fibonacci_extension(high, low, target_high):
    """Fibonacci extension after breakout"""
    diff = high - low
    return {
        "127.2%": target_high + diff * 0.272,
        "161.8%": target_high + diff * 0.618,
        "200.0%": target_high + diff * 1.000,
        "261.8%": target_high + diff * 1.618,
    }
```

---

## 3. Technical Indicators

```python
import numpy as np
import pandas as pd

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

def calculate_ema(prices, period):
    """Calculate EMA"""
    return pd.Series(prices).ewm(span=period).mean()

def calculate_sma(prices, period):
    """Calculate SMA"""
    return pd.Series(prices).rolling(window=period).mean()
```

---

## 4. Chart Generation

```python
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime

def generate_chart(prices, timestamps, symbol, fib_levels=None, indicators=True):
    """Generate chart image with indicators"""
    fig, axes = plt.subplots(3 if indicators else 1, 1, figsize=(12, 8), 
                              gridspec_kw={'height_ratios': [3, 1, 1]} if indicators else None)
    
    if not indicators:
        axes = [axes]
    
    # Main price chart
    ax1 = axes[0]
    ax1.plot(timestamps, prices, color='#00ff88', linewidth=1.5, label='Price')
    ax1.set_title(f'{symbol} Chart', color='white', fontsize=14)
    ax1.set_facecolor('#1a1a2e')
    ax1.grid(True, alpha=0.3)
    ax1.legend()
    
    # Fibonacci levels
    if fib_levels:
        colors = ['#ff0000', '#ff6600', '#ffcc00', '#00ff00', '#00ccff', '#0066ff', '#cc00ff']
        for i, (level, price) in enumerate(fib_levels.items()):
            ax1.axhline(y=price, color=colors[i % len(colors)], 
                        linestyle='--', alpha=0.7, label=f'{level}: {price:.6f}')
    
    if indicators and len(prices) > 26:
        # RSI
        rsi = calculate_rsi(prices)
        ax2 = axes[1]
        ax2.plot(timestamps[-len(rsi):], rsi, color='#ff6600', linewidth=1)
        ax2.axhline(y=70, color='red', linestyle='--', alpha=0.5)
        ax2.axhline(y=30, color='green', linestyle='--', alpha=0.5)
        ax2.set_title('RSI', color='white')
        ax2.set_facecolor('#1a1a2e')
        ax2.grid(True, alpha=0.3)
        
        # MACD
        macd, signal, hist = calculate_macd(prices)
        ax3 = axes[2]
        ax3.plot(timestamps[-len(macd):], macd, color='#00ccff', linewidth=1, label='MACD')
        ax3.plot(timestamps[-len(signal):], signal, color='#ff6600', linewidth=1, label='Signal')
        ax3.bar(timestamps[-len(hist):], hist, 
                color=['#00ff88' if h > 0 else '#ff0000' for h in hist], alpha=0.5)
        ax3.set_title('MACD', color='white')
        ax3.set_facecolor('#1a1a2e')
        ax3.grid(True, alpha=0.3)
        ax3.legend()
    
    plt.tight_layout()
    
    # Save
    chart_path = f'/tmp/{symbol}_chart.png'
    plt.savefig(chart_path, dpi=150, facecolor='#0d0d1a')
    plt.close()
    return chart_path
```

---

## 5. Auto-Analysis

```python
def analyze_token(token_address, symbol=None):
    """Full auto-analysis"""
    
    # Fetch data
    price_data = get_price_dexscreener(token_address)
    if not price_data:
        return {"error": "Token not found"}
    
    price = price_data["price"]
    symbol = symbol or price_data.get("symbol", "UNKNOWN")
    
    # Get historical prices (mock for now, use real API)
    prices = [price * 0.8, price * 0.85, price * 0.9, price * 0.95, 
              price * 0.92, price * 1.05, price * 1.1, price * 0.98, price]
    
    # Calculate levels
    high = max(prices)
    low = min(prices)
    fib = fibonacci_levels(high, low)
    
    # Indicators
    rsi = calculate_rsi(prices)
    macd, signal, hist = calculate_macd(prices)
    upper, middle, lower = calculate_bollinger(prices)
    
    # Generate signals
    signals = []
    
    # RSI signals
    if rsi.iloc[-1] < 30:
        signals.append("🟢 RSI Oversold (<30) — Potential Buy")
    elif rsi.iloc[-1] > 70:
        signals.append("🔴 RSI Overbought (>70) — Potential Sell")
    
    # MACD signals
    if macd.iloc[-1] > signal.iloc[-1] and macd.iloc[-2] <= signal.iloc[-2]:
        signals.append("🟢 MACD Bullish Crossover — Buy Signal")
    elif macd.iloc[-1] < signal.iloc[-1] and macd.iloc[-2] >= signal.iloc[-2]:
        signals.append("🔴 MACD Bearish Crossover — Sell Signal")
    
    # Bollinger signals
    if price < lower.iloc[-1]:
        signals.append("🟢 Price Below Lower Band — Oversold")
    elif price > upper.iloc[-1]:
        signals.append("🔴 Price Above Upper Band — Overbought")
    
    # Generate chart
    timestamps = pd.date_range(end=datetime.now(), periods=len(prices), freq='1H')
    chart_path = generate_chart(prices, timestamps.tolist(), symbol, fib)
    
    return {
        "symbol": symbol,
        "price": price,
        "high_24h": high,
        "low_24h": low,
        "change_24h": price_data.get("change24h"),
        "market_cap": price_data.get("mc"),
        "liquidity": price_data.get("liquidity"),
        "volume_24h": price_data.get("v24h"),
        "fibonacci": fib,
        "rsi": round(rsi.iloc[-1], 2) if len(rsi) > 0 else None,
        "macd": round(macd.iloc[-1], 6) if len(macd) > 0 else None,
        "bollinger_upper": round(upper.iloc[-1], 6) if len(upper) > 0 else None,
        "bollinger_lower": round(lower.iloc[-1], 6) if len(lower) > 0 else None,
        "signals": signals,
        "chart_path": chart_path
    }

def format_analysis(result):
    """Format analysis result for display"""
    if "error" in result:
        return f"❌ Error: {result['error']}"
    
    fib_text = "\n".join([f"  {k}: {v:.6f}" for k, v in result["fibonacci"].items()])
    signals_text = "\n".join(result["signals"]) if result["signals"] else "  No strong signals"
    
    return f"""
📊 ANALYSIS: {result['symbol']}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 Price: ${result['price']:.6f}
📈 24h Change: {result.get('change_24h', 'N/A')}%
📊 Market Cap: ${result.get('market_cap', 0):,.0f}
💧 Liquidity: ${result.get('liquidity', 0):,.0f}
📦 Volume 24h: ${result.get('volume_24h', 0):,.0f}

📐 FIBONACCI LEVELS:
{fib_text}

📉 INDICATORS:
  RSI: {result.get('rsi', 'N/A')}
  MACD: {result.get('macd', 'N/A')}
  Bollinger Upper: {result.get('bollinger_upper', 'N/A')}
  Bollinger Lower: {result.get('bollinger_lower', 'N/A')}

🎯 SIGNALS:
{signals_text}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
```

---

## 6. Quick Usage

```python
from chart_analysis import analyze_token, format_analysis

# Analyze token
result = analyze_token("TOKEN_ADDRESS_HERE")
print(format_analysis(result))

# Or just get Fibonacci
from chart_analysis import fibonacci_levels
fib = fibonacci_levels(high=0.004, low=0.0005)
for level, price in fib.items():
    print(f"{level}: {price:.6f}")
```

---

## 7. ENV Setup

```
BIRDEYE_API_KEY=your_key_here  # Optional, DexScreener is free
```

---

## Pitfalls

1. **pandas `freq='1H'` deprecated** — Pandas ≥2.2 pakai lowercase: `freq='h'` (bukan `'1H'`). Error: `ValueError: Invalid frequency: H`. Fix: `pd.date_range(..., freq='h')`

2. **DexScreener free API gak ada full OHLCV** — Hanya kasih price, volume, 24h high/low. Kalau butuh candle data lengkap, pakai Birdeye API atau fetch dari charting platform.

3. **DexScreener `high24h`/`low24h` bisa 0** — Beberapa token (terutama pump.fun) gak punya data ini. Fallback: pakai current price ± 10% sebagai estimasi.

## Tips

1. **DexScreener** = free, no API key needed
2. **Birdeye** = more data, needs API key
3. **Fibonacci 61.8%** = golden ratio, paling penting
4. **RSI < 30** = oversold, potential buy
5. **RSI > 70** = overbought, potential sell
6. **MACD crossover** = signal kuat
7. **Bollinger squeeze** = breakout coming
