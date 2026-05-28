# Meridian

**A smart assistant that manages liquidity pools on Solana for you.**

[Website](https://agentmeridian.xyz) · [Telegram](https://t.me/agentmeridian) · [X](https://x.com/meridian_agent)

---

## What is this? (in plain words)

On Solana, a platform called **Meteora** lets you put money into "liquidity pools" and earn fees from people trading. Picking good pools and watching them all day is hard work.

**Meridian does that work for you.** It's a program you run on your own computer (or a server). It looks at many pools, picks promising ones, puts your money in, watches them, and pulls out when things go bad — and it gets smarter over time by learning from its past trades.

You stay in control: it asks for your settings up front, you can run it in a **safe practice mode** first, and you can pause or steer it any time through a chat app (Telegram) or your terminal.

> ⚠️ **Real money, real risk.** This handles actual crypto and can lose money. Always start in practice mode (`DRY_RUN=true`). Never use more than you can afford to lose. This is not financial advice.

---

## What you need first

| Thing | Why | Where to get it |
|---|---|---|
| **Node.js 18 or newer** | Runs the program | [nodejs.org](https://nodejs.org) |
| **A Solana wallet key** | So it can trade for you | Export from your wallet (keep it secret!) |
| **A Solana RPC link** | Its connection to Solana | [Helius](https://helius.xyz) (free tier works) |
| **An OpenRouter API key** | Powers the AI brain | [openrouter.ai](https://openrouter.ai) |
| **A Telegram bot** *(optional)* | Control it from your phone | [@BotFather](https://t.me/BotFather) |

---

## Getting started (step by step)

### 1. Download and install

```bash
git clone https://github.com/yunus-0x/meridian
cd meridian
npm install
```

### 2. Run the setup helper

```bash
npm run setup
```

This asks you a few questions and creates your settings files for you. Takes about 2 minutes. It will ask for the keys from the table above and your trading preferences (how much to risk, how big each position should be, etc.).

> 🔒 Your wallet key and API keys are stored in a private `.env` file that never leaves your computer.

### 3. Try it in practice mode first

```bash
npm run dev
```

This runs everything **without spending real money** — perfect for watching how it behaves. When you're comfortable:

```bash
npm start
```

This is **live mode** (real trades). Make sure your settings are right before doing this.

---

## Turning the auto-trading on and off

When Meridian starts, **it does NOT trade automatically.** It waits for you. This keeps you safe — nothing happens until you say go.

| To do this... | In the terminal type | On Telegram send |
|---|---|---|
| **Start** auto screening + management | `go` | `/resume` |
| **Pause** auto trading | *(close the app)* | `/pause` |

While auto-trading is off, the program still listens and answers you — it just won't open or close positions on its own. You can still tell it to do specific things by hand (see below).

> ℹ️ While paused, your open positions are **not** watched automatically. If you want it to protect them (take profits, cut losses), turn auto-trading on with `go` / `/resume`.

---

## Controlling it by hand

You can talk to Meridian any time, even with auto-trading off.

### From the terminal

Just type plain requests, or use these shortcuts:

| Type this | What happens |
|---|---|
| `/status` | Show your wallet and open positions |
| `/candidates` | Show the best pools it found right now |
| `auto` | Have it pick and open one good position now |
| `1`, `2`, `3`… | Open a position in the pool with that number |
| `go` | Turn on automatic trading |
| `/stop` | Shut down safely |
| *anything else* | Chat — ask it questions or give instructions |

Example: type `what do you think of the SOL/BONK pool?` and it answers.

### From Telegram (your phone)

Send your bot any message to start, then:

| Send this | What happens |
|---|---|
| `/positions` | List your open positions |
| `/close 1` | Close position number 1 |
| `/resume` | Turn on automatic trading |
| `/pause` | Turn off automatic trading |
| *anything else* | Chat — e.g. "close all positions", "check my wallet" |

---

## What it tells you

When connected to Telegram, Meridian sends you a message whenever it:

- Opens a position (which pool, how much, the transaction)
- Closes a position (and the profit/loss)
- Finishes a screening or management round (what it decided and why)
- Notices a position has drifted out of its price range

---

## How it gets smarter

Every time Meridian closes a position, it records what happened and studies the best players in similar pools. Over time it builds up "lessons" and automatically tightens its own rules to favor what's been working. You don't have to do anything — but you *can* add your own rules, for example:

```bash
node cli.js lessons add "Never deploy into tokens less than 2 hours old"
```

---

## Keeping it running 24/7 (optional)

If you want it on a server all the time, use PM2:

```bash
npm install
npm run pm2:start
pm2 save
```

After an update: `git pull`, then `npm install`, then `npm run pm2:restart`. If something breaks, check the logs with `npm run pm2:logs`.

---

## A few key settings

Settings live in `user-config.json` (the setup helper fills these in). The ones most people care about:

| Setting | Means |
|---|---|
| `autoStartCron` | Whether auto-trading turns on by itself at startup (default `false` = waits for you) |
| `deployAmountSol` | How much SOL to put into each new position |
| `maxPositions` | Most positions open at once |
| `stopLossPct` | Auto-close if a position drops this much (e.g. `-15` = 15%) |
| `screeningIntervalMin` | How often it looks for new pools (minutes) |
| `managementIntervalMin` | How often it checks open positions (minutes) |

You can change a setting any time:

```bash
node cli.js config set deployAmountSol 1.0
```

---

## For advanced users

Meridian also has a full command-line tool (`meridian` / `node cli.js`) that exposes every action as a command with JSON output — useful for scripting and debugging. It also integrates with [Claude Code](https://claude.ai/code) for AI-driven screening and management from your terminal, and an optional Discord listener that turns token "calls" into screening signals.

For the full command list, config reference, architecture overview, and HiveMind (shared-learning) details, see [CLAUDE.md](CLAUDE.md) and the files under `tools/` and `.claude/`.

---

## Disclaimer

This software is provided as-is, with no warranty. Running an autonomous trading agent carries real financial risk — **you can lose money.** Always start with `DRY_RUN=true` to verify behavior before going live, and never deploy more capital than you can afford to lose. This is not financial advice. The authors are not responsible for any losses incurred through use of this software.
