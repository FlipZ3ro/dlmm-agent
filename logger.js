import fs from "fs";
import path from "path";

const LOG_DIR = "./logs";
const LOG_LEVEL = process.env.LOG_LEVEL || "info";

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LEVELS[LOG_LEVEL] || 1;

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Detect color support — disable for non-TTY (e.g. when piped to a file)
const COLOR_ENABLED = process.stdout.isTTY && process.env.NO_COLOR !== "1";

const C = {
  reset:  COLOR_ENABLED ? "\x1b[0m"  : "",
  dim:    COLOR_ENABLED ? "\x1b[2m"  : "",
  bold:   COLOR_ENABLED ? "\x1b[1m"  : "",
  red:    COLOR_ENABLED ? "\x1b[31m" : "",
  green:  COLOR_ENABLED ? "\x1b[32m" : "",
  yellow: COLOR_ENABLED ? "\x1b[33m" : "",
  blue:   COLOR_ENABLED ? "\x1b[34m" : "",
  magenta:COLOR_ENABLED ? "\x1b[35m" : "",
  cyan:   COLOR_ENABLED ? "\x1b[36m" : "",
  gray:   COLOR_ENABLED ? "\x1b[90m" : "",
  brRed:  COLOR_ENABLED ? "\x1b[91m" : "",
  brGreen:COLOR_ENABLED ? "\x1b[92m" : "",
  brYel:  COLOR_ENABLED ? "\x1b[93m" : "",
  brCyan: COLOR_ENABLED ? "\x1b[96m" : "",
};

// Per-category style. icon, color, label. `dim`=draw dim, `hide`=skip console.
const STYLES = {
  // Deploy / close highlights
  deploy:         { icon: "🚀", color: C.brGreen,  label: "DEPLOY" },
  deploy_error:   { icon: "💥", color: C.brRed,    label: "DEPLOY!" },
  close:          { icon: "💰", color: C.brYel,    label: "CLOSE " },
  close_warn:     { icon: "⚠️ ", color: C.yellow,  label: "CLOSE " },
  safety_block:   { icon: "🛡️ ", color: C.brRed,   label: "BLOCK " },
  // Agent / state
  agent:          { icon: "🤖", color: C.cyan,     label: "AGENT " },
  state:          { icon: "📍", color: C.blue,     label: "STATE " },
  state_warn:     { icon: "📍", color: C.yellow,   label: "STATE " },
  // Cron + screening
  cron:           { icon: "⏰", color: C.gray,     label: "CRON  " },
  cron_error:     { icon: "❌", color: C.red,      label: "CRON  " },
  cron_warn:      { icon: "⚠️ ", color: C.yellow,  label: "CRON  " },
  screening:      { icon: "🔍", color: C.magenta,  label: "SCREEN" },
  dev_blocklist:  { icon: "🚫", color: C.gray,     label: "FILTER" },
  // Journey + analytics
  journey:        { icon: "📊", color: C.brCyan,   label: "JOURNEY" },
  // Startup/shutdown
  startup:        { icon: "⚡", color: C.brCyan,   label: "BOOT  " },
  init:           { icon: "⚡", color: C.brCyan,   label: "BOOT  " },
  shutdown:       { icon: "🛑", color: C.brRed,    label: "STOP  " },
  // Wallet / positions
  wallet:         { icon: "💼", color: C.green,    label: "WALLET" },
  wallet_error:   { icon: "💼", color: C.red,      label: "WALLET" },
  positions:      { icon: "📂", color: C.gray,     label: "POSIT " },
  // HiveMind — show success (cyan), warn-level shown dim
  hivemind:       { icon: "🐝", color: C.cyan,     label: "HIVE  " },
  hivemind_warn:  { icon: "🐝", color: C.gray,     label: "HIVE  " },
  // OKX + LPAgent — still hidden as noise unless error
  okx:            { icon: "·",  color: C.gray,     label: "OKX   ", hide: true },
  lpagent_api:    { icon: "·",  color: C.gray,     label: "LPAGNT", hide: true },
  swap_warn:      { icon: "🔄", color: C.yellow,   label: "SWAP  " },
  default:        { icon: "•",  color: C.reset,    label: "INFO  " },
};

// Truncate base58-looking strings (addresses 32-44 chars, tx signatures up to 88)
function truncateAddresses(message) {
  return message.replace(/\b([A-HJ-NP-Z1-9a-km-z]{32,90})\b/g, (m) => `${m.slice(0, 8)}..${m.slice(-4)}`);
}

function shortTime() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

// Dedupe spammy repeated lines within a short window. Keeps the file log
// untouched; only suppresses the *console* echo for repeats.
const _recent = new Map();
const DEDUP_WINDOW_MS = 25_000;
const DEDUP_CATEGORIES = new Set(["positions", "cron"]);

function isConsoleDuplicate(category, message) {
  if (!DEDUP_CATEGORIES.has(category)) return false;
  const key = `${category}::${message}`;
  const now = Date.now();
  const last = _recent.get(key);
  if (last && now - last < DEDUP_WINDOW_MS) return true;
  _recent.set(key, now);
  if (_recent.size > 250) {
    for (const [k, t] of _recent) {
      if (now - t > DEDUP_WINDOW_MS * 2) _recent.delete(k);
    }
  }
  return false;
}

/**
 * General log function.
 * - File: full ISO timestamp + uppercased category (audit-stable)
 * - Console: short HH:MM:SS, icon, colored label, address-truncated text
 */
export function log(category, message) {
  const lc = String(category || "").toLowerCase();
  const level = lc.includes("error") ? "error"
    : lc.includes("warn") ? "warn"
    : "info";
  if (LEVELS[level] < currentLevel) return;

  const isoTs = new Date().toISOString();
  const fileLine = `[${isoTs}] [${lc.toUpperCase()}] ${message}`;

  // ── File output (daily rotation, full detail) ──
  const dateStr = isoTs.split("T")[0];
  try {
    fs.appendFileSync(path.join(LOG_DIR, `agent-${dateStr}.log`), fileLine + "\n");
  } catch { /* ignore */ }

  // ── Console output (pretty) ──
  const style = STYLES[lc] || STYLES.default;
  if (style.hide && level !== "error") return;
  if (isConsoleDuplicate(lc, message)) return;

  const truncated = truncateAddresses(String(message));
  const consoleLine =
    `${C.gray}${shortTime()}${C.reset}  ` +
    `${style.icon} ` +
    `${style.color}${style.label}${C.reset}  ` +
    `${truncated}`;
  console.log(consoleLine);
}

// ───────────────────────────────────────────────────────────────────────────
// Tool action audit trail
// ───────────────────────────────────────────────────────────────────────────

function actionHint(action) {
  const a = action.args || {};
  const r = action.result || {};
  switch (action.tool) {
    case "deploy_position":   return ` ${a.pool_name || a.pool_address?.slice(0,8)} ${a.amount_sol} SOL`;
    case "close_position":    return ` ${a.position_address?.slice(0,8)}${r.pnl_usd != null ? ` | PnL $${r.pnl_usd >= 0 ? "+" : ""}${r.pnl_usd} (${r.pnl_pct}%)` : ""}`;
    case "claim_fees":        return ` ${a.position_address?.slice(0,8)}`;
    case "get_active_bin":    return ` bin ${r.binId ?? ""}`;
    case "get_pool_detail":   return ` ${r.name || a.pool_address?.slice(0,8) || ""}`;
    case "get_my_positions":  return ` ${r.total_positions ?? ""} positions`;
    case "get_wallet_balance":return ` ${r.sol ?? ""} SOL`;
    case "get_top_candidates":return ` ${r?.candidates?.length ?? ""} pools`;
    case "swap_token":        return ` ${a.amount} ${a.input_mint?.slice(0,6)}→SOL`;
    case "update_config":     return ` ${Object.keys(r.applied || {}).join(", ")}`;
    case "add_lesson":        return ` saved`;
    case "clear_lessons":     return ` cleared ${r.cleared ?? ""}`;
    default:                  return "";
  }
}

export function logAction(action) {
  const isoTs = new Date().toISOString();
  const entry = { timestamp: isoTs, ...action };

  // File audit trail — full JSON
  const dateStr = isoTs.split("T")[0];
  try {
    fs.appendFileSync(
      path.join(LOG_DIR, `actions-${dateStr}.jsonl`),
      JSON.stringify(entry) + "\n",
    );
  } catch { /* ignore */ }

  // Console: colored single-line tool summary
  const ok = action.success !== false && !action.error;
  const statusColor = ok ? C.green : C.red;
  const status = ok ? "✓" : "✗";
  const dur = action.duration_ms != null ? `${C.gray}(${action.duration_ms}ms)${C.reset}` : "";
  const hint = truncateAddresses(actionHint(action));
  console.log(
    `${C.gray}${shortTime()}${C.reset}  ` +
    `${statusColor}${status}${C.reset} ` +
    `${C.cyan}${action.tool}${C.reset}${hint} ${dur}`,
  );
}
