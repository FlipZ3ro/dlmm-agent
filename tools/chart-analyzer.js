import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { log } from "../logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOOL_DIR = path.join(__dirname, "chart-analysis-tool");
const PYTHON_BIN = path.join(TOOL_DIR, ".venv", "bin", "python");
const SCRIPT = path.join(TOOL_DIR, "chart_analysis.py");

const DEFAULT_TIMEOUT_MS = 25_000;

/**
 * Run the Python chart-analysis tool against a token and return parsed JSON.
 * Resolves to { ok: false, error } on failure rather than throwing — callers
 * pass this straight back to the LLM, which should handle missing data
 * gracefully.
 */
export async function analyzeTokenChart({ token_address, symbol } = {}) {
  if (!token_address || typeof token_address !== "string") {
    return { ok: false, error: "token_address is required" };
  }
  return new Promise((resolve) => {
    const args = ["--json", token_address];
    if (symbol) args.push(String(symbol));

    const child = spawn(PYTHON_BIN, [SCRIPT, ...args], {
      cwd: TOOL_DIR,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ ok: false, error: `chart-analyzer timed out after ${DEFAULT_TIMEOUT_MS}ms` });
    }, DEFAULT_TIMEOUT_MS);

    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });

    child.on("error", (err) => {
      clearTimeout(timer);
      log("chart_analyzer_warn", `spawn failed: ${err.message}`);
      resolve({ ok: false, error: `spawn failed: ${err.message}` });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const detail = (stderr || stdout || "").trim().slice(0, 240);
        resolve({ ok: false, error: `python exited ${code}: ${detail}` });
        return;
      }
      // JSON line should be on the last non-empty stdout line
      const lines = stdout.trim().split("\n").filter(Boolean);
      const jsonLine = lines.reverse().find((l) => l.trim().startsWith("{"));
      if (!jsonLine) {
        resolve({ ok: false, error: `no JSON output: ${stdout.slice(0, 240)}` });
        return;
      }
      try {
        const data = JSON.parse(jsonLine);
        resolve({ ok: true, ...data });
      } catch (e) {
        resolve({ ok: false, error: `JSON parse failed: ${e.message}` });
      }
    });
  });
}
