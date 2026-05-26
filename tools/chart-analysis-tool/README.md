# 📊 Chart Analysis Tool

Analisa chart crypto Solana — Fibonacci, RSI, MACD, Bollinger Bands.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
pip install requests matplotlib numpy pandas python-dotenv
```

### 2. Setup API Key

Buat file `.env`:

```
BIRDEYE_API_KEY=your_key_here
```

Atau get free key di: https://birdeye.so

### 3. Run Analysis

```bash
python3 chart_analysis.py TOKEN_ADDRESS [SYMBOL]

# Example
python3 chart_analysis.py 2RWndXkxWkaKhGjE7dZivVbK5qXtpwnCZJ1jpnxapump HOPPY
```

## 📊 Output

```
📊 ANALYSIS: HOPPY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 Price: $0.00133532
📈 24h High: $0.00146886
📉 24h Low: $0.00120179
📊 24h Change: -6.39%
💧 Liquidity: $129,133
📦 Volume 24h: $2,611,763
👥 Holders: 5,553
🔄 24h Trades: 52,013

📐 FIBONACCI LEVELS:
  0.0%: $0.00146886
  38.2%: $0.00136684
  50.0%: $0.00133532
  61.8%: $0.00130381
  100%: $0.00120179

📉 INDICATORS:
  RSI (14): 42.09
  MACD: Bearish
  Bollinger Upper: $0.00148999
  Bollinger Lower: $0.00132668

🎯 SIGNALS:
  🟢 Bullish (61% buys)
```

## 📁 Files

| File | Description |
|------|-------------|
| `chart_analysis.py` | Main script |
| `SKILL.md` | Skill reference (Hermes) |
| `README.md` | This file |

## 🔧 Features

- ✅ **Birdeye API** — Real-time Solana data
- ✅ **DexScreener** — Free fallback
- ✅ **Fibonacci** — Auto calculate levels
- ✅ **RSI** — Relative Strength Index
- ✅ **MACD** — Moving Average Convergence Divergence
- ✅ **Bollinger Bands** — Volatility indicator
- ✅ **Chart Image** — Auto generate PNG
- ✅ **Auto Signals** — Buy/Sell recommendations

## 🎯 Indicators Explained

### RSI (Relative Strength Index)
- **< 30** = Oversold → Potential Buy
- **> 70** = Overbought → Potential Sell
- **30-70** = Neutral

### MACD
- **Bullish Crossover** = MACD crosses above Signal → Buy
- **Bearish Crossover** = MACD crosses below Signal → Sell

### Bollinger Bands
- **Price < Lower Band** = Oversold → Potential Buy
- **Price > Upper Band** = Overbought → Potential Sell

### Fibonacci Levels
- **61.8%** = Golden Ratio (most important)
- **38.2%** = Strong support/resistance
- **50.0%** = Mid-point

## 📝 Notes

- DexScreener = Free, no API key needed
- Birdeye = More data, needs API key
- Data updates in real-time
- Chart generated as PNG

## 🤖 Hermes Skill

This tool is also available as a Hermes skill: `superagent-m15`

```python
# In Hermes Agent
from chart_analysis import analyze
result = analyze("TOKEN_ADDRESS")
```

---

Made with ❤️ for crypto traders
