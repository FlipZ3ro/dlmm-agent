import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { log } from "./logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JOURNEY_FILE = path.join(__dirname, "journey.json");
const LESSONS_FILE = path.join(__dirname, "lessons.json");

function load() {
  if (!fs.existsSync(JOURNEY_FILE)) return { days: {} };
  try { return JSON.parse(fs.readFileSync(JOURNEY_FILE, "utf8")); }
  catch { return { days: {} }; }
}

function save(data) {
  try { fs.writeFileSync(JOURNEY_FILE, JSON.stringify(data, null, 2)); }
  catch (e) { log("journey_error", `Failed to save: ${e.message}`); }
}

function todayUtc() { return new Date().toISOString().slice(0, 10); }

/**
 * Capture the starting wallet for today if not already captured.
 * Call once per management/screening cycle — it's idempotent.
 */
export function captureDailyBaseline({ wallet_sol, sol_price, total_usd }) {
  const data = load();
  const today = todayUtc();
  if (!data.days[today]) {
    data.days[today] = {
      date: today,
      start_sol: wallet_sol,
      start_sol_price: sol_price,
      start_usd: total_usd != null ? total_usd : wallet_sol * sol_price,
      end_sol: wallet_sol,
      end_sol_price: sol_price,
      end_usd: total_usd != null ? total_usd : wallet_sol * sol_price,
      first_seen_at: new Date().toISOString(),
      last_updated_at: new Date().toISOString(),
    };
    save(data);
    log("journey", `New day ${today} baseline: ${wallet_sol} SOL @ $${sol_price}`);
    return;
  }
  // Update current end-of-day snapshot
  data.days[today].end_sol = wallet_sol;
  data.days[today].end_sol_price = sol_price;
  data.days[today].end_usd = total_usd != null ? total_usd : wallet_sol * sol_price;
  data.days[today].last_updated_at = new Date().toISOString();
  save(data);
}

/**
 * Returns the last N days of journey, computed by merging journey.json
 * baselines with lessons.json performance records grouped by date.
 *
 * Each entry: {
 *   date, start_sol, start_usd, end_sol, end_usd,
 *   closes, wins, losses,
 *   realized_pnl_usd, realized_fees_usd,
 *   pnl_pct,           // realized PnL as % of start_usd
 *   wallet_change_pct, // (end_usd - start_usd) / start_usd × 100
 * }
 */
export function getJourney(days = 7) {
  const data = load();
  const performance = loadPerformance();
  const dates = new Set([...Object.keys(data.days || {})]);
  for (const p of performance) {
    const d = (p.recorded_at || "").slice(0, 10);
    if (d) dates.add(d);
  }
  const sorted = [...dates].sort().slice(-days);
  return sorted.map((date) => {
    const baseline = data.days[date] || {};
    const dayPerf = performance.filter((p) => (p.recorded_at || "").startsWith(date));
    // Reconstruct pnl_usd from initial/final if the stored value got rounded to 0
    const effectivePnlUsd = (p) => {
      const stored = Number(p.pnl_usd);
      if (Number.isFinite(stored) && Math.abs(stored) > 1e-9) return stored;
      const initial = Number(p.initial_value_usd) || 0;
      const final = Number(p.final_value_usd) || 0;
      const fees = Number(p.fees_earned_usd) || 0;
      if (initial > 0 && (final > 0 || fees > 0)) return (final + fees) - initial;
      return stored || 0;
    };
    const realized_pnl_usd = dayPerf.reduce((s, p) => s + effectivePnlUsd(p), 0);
    const realized_fees_usd = dayPerf.reduce((s, p) => s + (Number(p.fees_earned_usd) || 0), 0);
    // Use pnl_pct for win/loss bucketing — more reliable than rounded pnl_usd
    const wins = dayPerf.filter((p) => (Number(p.pnl_pct) || 0) > 0).length;
    const losses = dayPerf.filter((p) => (Number(p.pnl_pct) || 0) < 0).length;
    const start_usd = baseline.start_usd ?? null;
    const end_usd = baseline.end_usd ?? null;
    const pnl_pct = start_usd > 0 ? (realized_pnl_usd / start_usd) * 100 : null;
    const wallet_change_pct = start_usd > 0 && end_usd != null
      ? ((end_usd - start_usd) / start_usd) * 100
      : null;
    return {
      date,
      start_sol: baseline.start_sol ?? null,
      start_usd,
      end_sol: baseline.end_sol ?? null,
      end_usd,
      closes: dayPerf.length,
      wins,
      losses,
      realized_pnl_usd,
      realized_fees_usd,
      pnl_pct,
      wallet_change_pct,
    };
  });
}

function loadPerformance() {
  if (!fs.existsSync(LESSONS_FILE)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(LESSONS_FILE, "utf8"));
    return Array.isArray(data.performance) ? data.performance : [];
  } catch { return []; }
}

function fmtUsd(v) {
  if (v == null) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}$${v.toFixed(4)}`;
}

function fmtPct(v) {
  if (v == null) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

/**
 * Plain-text formatter for REPL/CLI output.
 */
export function formatJourneyText(days = 7) {
  const entries = getJourney(days);
  if (entries.length === 0) return "No journey data yet.";
  const lines = [
    "Daily Journey (realized — does not include currently-open positions)",
    "",
    "Date        Closes  W/L     Start USD     PnL (capital)    Fees      Net       Day %",
    "─".repeat(95),
  ];
  let cumNetUsd = 0;
  for (const e of entries) {
    const net = e.realized_pnl_usd + e.realized_fees_usd;
    const netPct = e.start_usd > 0 ? (net / e.start_usd) * 100 : null;
    cumNetUsd += net;
    lines.push(
      [
        e.date,
        String(e.closes).padStart(6),
        `${String(e.wins).padStart(3)}/${String(e.losses).padEnd(3)}`,
        e.start_usd != null ? `$${e.start_usd.toFixed(4)}`.padStart(12) : "—".padStart(12),
        fmtUsd(e.realized_pnl_usd).padStart(14),
        `$${e.realized_fees_usd.toFixed(4)}`.padStart(9),
        fmtUsd(net).padStart(9),
        fmtPct(netPct).padStart(8),
      ].join("  "),
    );
  }
  lines.push("─".repeat(95));
  lines.push(`Cumulative net (capital + fees) across shown days: ${fmtUsd(cumNetUsd)}`);
  return lines.join("\n");
}

/**
 * HTML formatter for Telegram.
 */
export function formatJourneyHtml(days = 7) {
  const entries = getJourney(days);
  if (entries.length === 0) return "📊 <b>Journey</b>\n\nNo journey data yet.";
  const lines = ["📊 <b>Daily Journey</b> (realized — closed positions only)\n"];
  let cumNetUsd = 0;
  for (const e of entries) {
    const net = e.realized_pnl_usd + e.realized_fees_usd;
    const netPct = e.start_usd > 0 ? (net / e.start_usd) * 100 : null;
    cumNetUsd += net;
    const emoji = net > 0 ? "🟢" : net < 0 ? "🔴" : "⚪";
    const detail = `PnL ${fmtUsd(e.realized_pnl_usd)} + fees $${e.realized_fees_usd.toFixed(4)}`;
    lines.push(
      `${emoji} <b>${e.date}</b>: ${fmtPct(netPct)} net (${fmtUsd(net)}) — ${e.closes} closed (W:${e.wins} L:${e.losses})\n   <i>${detail}</i>`,
    );
  }
  lines.push(`\nΣ Cumulative net: ${fmtUsd(cumNetUsd)}`);
  return lines.join("\n");
}
