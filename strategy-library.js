/**
 * Strategy Library — persistent store of LP strategies.
 *
 * Users paste a tweet or description via Telegram.
 * The agent extracts structured criteria and saves it here.
 * During screening, the active strategy's criteria guide token selection and position config.
 */

import fs from "fs";
import { log } from "./logger.js";

const STRATEGY_FILE = "./strategy-library.json";

function load() {
  if (!fs.existsSync(STRATEGY_FILE)) return { active: null, strategies: {} };
  try {
    return JSON.parse(fs.readFileSync(STRATEGY_FILE, "utf8"));
  } catch {
    return { active: null, strategies: {} };
  }
}

function save(data) {
  fs.writeFileSync(STRATEGY_FILE, JSON.stringify(data, null, 2));
}

// ─── Default Strategies ─────────────────────────────────────────
const DEFAULT_STRATEGIES = {
  custom_ratio_spot: {
    id: "custom_ratio_spot",
    name: "Custom Ratio Spot",
    author: "meridian",
    lp_strategy: "spot",
    token_criteria: { notes: "Any token. Ratio expresses directional bias." },
    entry: { condition: "Directional view on token", single_side: null, notes: "75% token = bullish (sell on pump out of range). 75% SOL = bearish/DCA-in (buy on dip). Set bins_below:bins_above proportional to ratio." },
    range: { type: "custom", notes: "bins_below:bins_above ratio matches token:SOL ratio. E.g., 75% token → ~52 bins below, ~17 bins above." },
    exit: { take_profit_pct: 10, notes: "Close when OOR or TP hit. Re-deploy with updated ratio based on new momentum signals." },
    best_for: "Expressing directional bias while earning fees both ways",
  },
  single_sided_reseed: {
    id: "single_sided_reseed",
    name: "Single-Sided Bid-Ask + Re-seed",
    author: "meridian",
    lp_strategy: "bid_ask",
    token_criteria: { notes: "Volatile tokens with strong narrative. Must have active volume." },
    entry: { condition: "Deploy token-only (amount_x only, amount_y=0) bid-ask, bins below active bin only", single_side: "token", notes: "As price drops through bins, token sold for SOL. Bid-ask concentrates at bottom edge." },
    range: { type: "default", bins_below_pct: 100, notes: "All bins below active bin. bins_above=0." },
    exit: { notes: "When OOR downside: close_position(skip_swap=true) → redeploy token-only bid-ask at new lower price. Do NOT swap to SOL. Full close only when token dead or after N re-seeds with declining performance." },
    best_for: "Riding volatile tokens down without cutting losses. DCA out via LP.",
  },
  fee_compounding: {
    id: "fee_compounding",
    name: "Fee Compounding",
    author: "meridian",
    lp_strategy: "any",
    token_criteria: { notes: "Stable volume pools with consistent fee generation." },
    entry: { condition: "Deploy normally with any shape", notes: "Strategy is about management, not entry shape." },
    range: { type: "default", notes: "Standard range for the pair." },
    exit: { notes: "When unclaimed fees > $5 AND in range: claim_fees → add_liquidity back into same position. Normal close rules otherwise." },
    best_for: "Maximizing yield on stable, range-bound pools via compounding",
  },
  multi_layer: {
    id: "multi_layer",
    name: "Multi-Layer",
    author: "meridian",
    lp_strategy: "mixed",
    token_criteria: { notes: "High volume pools. Layer multiple shapes into ONE position via addLiquidityByStrategy to sculpt a composite distribution." },
    entry: {
      condition: "Create ONE position, then layer additional shapes onto it with add-liquidity. Each layer adds a different strategy/shape to the same position, compositing them.",
      notes: "Step 1: deploy (creates position with first shape). Step 2+: add-liquidity to same position with different shapes. All layers share the same bin range but different distribution curves stack on top of each other.",
      example_patterns: {
        smooth_edge: "Deploy Bid-Ask (edges) → add-liquidity Spot (fills the middle gap). 2 layers, 1 position.",
        full_composite: "Deploy Bid-Ask (edges) → add-liquidity Spot (middle) → add-liquidity Curve (center boost). 3 layers, 1 position.",
        edge_heavy: "Deploy Bid-Ask → add-liquidity Bid-Ask again (double edge weight). 2 layers, 1 position.",
      },
    },
    range: { type: "custom", notes: "All layers share the position's bin range (set at deploy). Choose range wide enough for the widest layer needed." },
    exit: { notes: "Single position — one close, one claim. The composite shape means fees earned reflect ALL layers combined." },
    best_for: "Creating custom liquidity distributions by stacking shapes in one position. Single position to manage.",
  },
  partial_harvest: {
    id: "partial_harvest",
    name: "Partial Harvest",
    author: "meridian",
    lp_strategy: "any",
    token_criteria: { notes: "High fee pools where taking profit incrementally is preferred." },
    entry: { condition: "Deploy normally", notes: "Strategy is about progressive profit-taking, not entry." },
    range: { type: "default", notes: "Standard range." },
    exit: { take_profit_pct: 10, notes: "When total return >= 10% of deployed capital: withdraw_liquidity(bps=5000) to take 50% off. Remaining 50% keeps running. Repeat at next threshold." },
    best_for: "Locking in profits without fully exiting winning positions",
  },
  // ─── Dual-Strategy Defaults ────────────────────────────────────
  // Designed to run simultaneously — uncorrelated equity curves.
  // Wide = stability/safety, Tight = alpha/aggression.
  wide_safeguard: {
    id: "wide_safeguard",
    name: "Wide + Safeguard",
    author: "meridian",
    lp_strategy: "bid_ask",
    dual_strategy_role: "safeguard",
    token_criteria: { notes: "Any token with decent volume. Prioritize stability — this position is the safety net." },
    entry: {
      condition: "Deploy with wider range for maximum coverage",
      single_side: "sol",
      notes: "Wider bin range = stays in range longer, earns steady fees. Lower peak yield but much lower OOR risk. Acts as portfolio stabilizer.",
    },
    range: {
      type: "custom",
      bins_below_override: 55,
      notes: "Wide range: 55 bins below active bin. Covers ~20-30% downside depending on bin step. Maximum staying power.",
    },
    exit: {
      take_profit_pct: 8,
      notes: "Only close when: (1) OOR for >60min, (2) TP hit, or (3) pool volume dies. This is the 'set and forget' position — less management needed.",
    },
    best_for: "Portfolio stability — steady fees, low maintenance, survives volatility",
    management_notes: "Less aggressive OOR management. Allow wider OOR wait (60min vs 30min). Re-deploy wider if price keeps trending.",
  },
  tight_aggressive: {
    id: "tight_aggressive",
    name: "Tight + Aggressive",
    author: "meridian",
    lp_strategy: "spot",
    dual_strategy_role: "aggressive",
    token_criteria: { notes: "High volume, trending tokens with strong momentum. This is the alpha generator — pick winners." },
    entry: {
      condition: "Deploy with tight concentrated range for maximum fee capture",
      single_side: "sol",
      notes: "Narrow bin range = concentrated liquidity = higher fee per dollar when in range. Higher OOR risk but premium yield. Alpha generator.",
    },
    range: {
      type: "custom",
      bins_below_override: 35,
      notes: "Tight range: 35 bins below active bin. Concentrated liquidity for maximum fee capture. ~10-15% downside coverage.",
    },
    exit: {
      take_profit_pct: 5,
      notes: "Close quickly on: (1) OOR >15min (don't wait — redeploy at better price), (2) TP hit, (3) volume drops >50%. Fast rotation = more alpha.",
    },
    best_for: "Alpha generation — high fees when in range, fast rotation when OOR",
    management_notes: "Aggressive OOR management. Quick close and redeploy. Tighter stop-loss. More active rebalancing.",
  },
};

function ensureDefaultStrategies() {
  const db = load();
  let added = false;
  for (const [id, strategy] of Object.entries(DEFAULT_STRATEGIES)) {
    if (!db.strategies[id]) {
      db.strategies[id] = {
        ...strategy,
        added_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      added = true;
    }
  }
  if (added) {
    if (!db.active) db.active = "custom_ratio_spot";
    save(db);
    log("strategy", "Preloaded default strategies");
  }
}

ensureDefaultStrategies();

// ─── Tool Handlers ─────────────────────────────────────────────

/**
 * Add or update a strategy.
 * The agent parses the raw tweet/text and fills in the structured fields.
 */
export function addStrategy({
  id,
  name,
  author = "unknown",
  lp_strategy = "bid_ask",       // "bid_ask" | "spot" | "curve"
  token_criteria = {},           // { min_mcap, min_age_days, requires_kol, notes }
  entry = {},                    // { condition, price_change_threshold_pct, single_side }
  range = {},                    // { type, bins_below_pct, notes }
  exit = {},                     // { take_profit_pct, notes }
  best_for = "",                 // short description of ideal conditions
  raw = "",                      // original tweet/text
}) {
  if (!id || !name) return { error: "id and name are required" };

  const db = load();

  // Slugify id
  const slug = id.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

  db.strategies[slug] = {
    id: slug,
    name,
    author,
    lp_strategy,
    token_criteria,
    entry,
    range,
    exit,
    best_for,
    raw,
    added_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Auto-set as active if it's the first strategy
  if (!db.active) db.active = slug;

  save(db);
  log("strategy", `Strategy saved: ${name} (${slug})`);
  return { saved: true, id: slug, name, active: db.active === slug };
}

/**
 * List all strategies with a summary.
 */
export function listStrategies() {
  const db = load();
  const strategies = Object.values(db.strategies).map((s) => ({
    id: s.id,
    name: s.name,
    author: s.author,
    lp_strategy: s.lp_strategy,
    best_for: s.best_for,
    active: db.active === s.id,
    added_at: s.added_at?.slice(0, 10),
  }));
  return { active: db.active, count: strategies.length, strategies };
}

/**
 * Get full details of a strategy including raw text and all criteria.
 */
export function getStrategy({ id }) {
  if (!id) return { error: "id required" };
  const db = load();
  const strategy = db.strategies[id];
  if (!strategy) return { error: `Strategy "${id}" not found`, available: Object.keys(db.strategies) };
  return { ...strategy, is_active: db.active === id };
}

/**
 * Set the active strategy used during screening cycles.
 */
export function setActiveStrategy({ id }) {
  if (!id) return { error: "id required" };
  const db = load();
  if (!db.strategies[id]) return { error: `Strategy "${id}" not found`, available: Object.keys(db.strategies) };
  db.active = id;
  save(db);
  log("strategy", `Active strategy set to: ${db.strategies[id].name}`);
  return { active: id, name: db.strategies[id].name };
}

/**
 * Remove a strategy.
 */
export function removeStrategy({ id }) {
  if (!id) return { error: "id required" };
  const db = load();
  if (!db.strategies[id]) return { error: `Strategy "${id}" not found` };
  const name = db.strategies[id].name;
  delete db.strategies[id];
  if (db.active === id) db.active = Object.keys(db.strategies)[0] || null;
  save(db);
  log("strategy", `Strategy removed: ${name}`);
  return { removed: true, id, name, new_active: db.active };
}

/**
 * Get the currently active strategy — used by screening cycle.
 */
export function getActiveStrategy() {
  const db = load();
  if (!db.active || !db.strategies[db.active]) return null;
  return db.strategies[db.active];
}

// ─── Dual-Strategy Support ─────────────────────────────────────

/**
 * Get both dual-strategy profiles for the dual-strategy mode.
 * Returns { safeguard, aggressive } or null if either is missing.
 */
export function getDualStrategies() {
  const db = load();
  const safeguardId = db.dualStrategy?.safeguardId || "wide_safeguard";
  const aggressiveId = db.dualStrategy?.aggressiveId || "tight_aggressive";
  const safeguard = db.strategies[safeguardId];
  const aggressive = db.strategies[aggressiveId];
  if (!safeguard || !aggressive) return null;
  return {
    safeguard: { ...safeguard, _role: "safeguard" },
    aggressive: { ...aggressive, _role: "aggressive" },
  };
}

/**
 * Configure the dual-strategy pairing.
 */
export function setDualStrategyPair({ safeguardId, aggressiveId }) {
  const db = load();
  if (safeguardId && !db.strategies[safeguardId]) {
    return { error: `Safeguard strategy "${safeguardId}" not found`, available: Object.keys(db.strategies) };
  }
  if (aggressiveId && !db.strategies[aggressiveId]) {
    return { error: `Aggressive strategy "${aggressiveId}" not found`, available: Object.keys(db.strategies) };
  }
  if (!db.dualStrategy) db.dualStrategy = {};
  if (safeguardId) db.dualStrategy.safeguardId = safeguardId;
  if (aggressiveId) db.dualStrategy.aggressiveId = aggressiveId;
  save(db);
  log("strategy", `Dual-strategy pair: safeguard=${db.dualStrategy.safeguardId}, aggressive=${db.dualStrategy.aggressiveId}`);
  return {
    safeguard: db.dualStrategy.safeguardId,
    aggressive: db.dualStrategy.aggressiveId,
  };
}

/**
 * Determine which strategy role to use next based on current positions.
 * Logic: alternate between safeguard and aggressive, with bias toward
 * safeguard when positions are few (safety first) and aggressive when
 * positions are stable (seek alpha).
 *
 * @param {Array} positions - current open positions
 * @returns {{ role: "safeguard"|"aggressive", strategy: Object }}
 */
export function pickDualStrategyRole(positions = []) {
  const dual = getDualStrategies();
  if (!dual) return null;

  const posCount = positions.length;

  // Count positions by their strategy role (from state metadata)
  let safeguardCount = 0;
  let aggressiveCount = 0;
  for (const p of positions) {
    if (p._strategyRole === "aggressive") aggressiveCount++;
    else safeguardCount++;
  }

  // Decision matrix:
  // 0 positions → safeguard (safety first)
  // 1 position, safeguard → aggressive (seek alpha)
  // 1 position, aggressive → safeguard (balance)
  // 2+ positions → alternate based on ratio
  let role;
  if (posCount === 0) {
    role = "safeguard";
  } else if (posCount === 1) {
    role = safeguardCount > 0 ? "aggressive" : "safeguard";
  } else {
    // Prefer whichever has fewer positions
    role = safeguardCount <= aggressiveCount ? "safeguard" : "aggressive";
  }

  return {
    role,
    strategy: dual[role],
  };
}
