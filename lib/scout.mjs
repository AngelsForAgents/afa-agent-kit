import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";

export const MCP_NAME = "afa-funding";
export const MCP_URL = "https://angelsforagents.com/api/v1/mcp";

const CLIENT_ALIASES = new Map([
  ["claude", "claude"],
  ["claude-code", "claude"],
  ["codex", "codex"],
  ["cursor", "cursor"],
  ["openclaw", "openclaw"]
]);

const REQUIRED_TOOLS = [
  "search_venture_resources",
  "get_venture_resource",
  "get_open_capital_opportunities",
  "check_pitch_eligibility",
  "validate_agent_pitch",
  "submit_agent_pitch",
  "report_grant_milestone"
];

const HELP = `AFA Scout — connect an agent client to Angels for Agents

Usage:
  afa-scout install <claude|codex|cursor|openclaw|all> [--scope user|project] [--dry-run]
  afa-scout doctor [--json]
  afa-scout commands

Examples:
  afa-scout install codex
  afa-scout install cursor --scope project
  afa-scout install all --dry-run
  afa-scout doctor

Installation only registers the hosted MCP endpoint. It does not submit a pitch,
report a milestone, or send venture data.`;

function parseArgs(argv) {
  const options = { scope: "user", dryRun: false, json: false };
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--dry-run") {
      options.dryRun = true;
    } else if (value === "--json") {
      options.json = true;
    } else if (value === "--scope") {
      options.scope = argv[index + 1];
      index += 1;
    } else if (value === "--help" || value === "-h") {
      options.help = true;
    } else if (value.startsWith("-")) {
      throw new Error(`unknown option: ${value}`);
    } else {
      positional.push(value);
    }
  }

  if (!new Set(["user", "project"]).has(options.scope)) {
    throw new Error("--scope must be either user or project");
  }

  return { positional, options };
}

export function installPlan(client, scope = "user") {
  const normalized = CLIENT_ALIASES.get(client);
  if (!normalized) {
    throw new Error(`unsupported client: ${client}`);
  }

  if (normalized === "claude") {
    return {
      kind: "command",
      command: "claude",
      args: [
        "mcp", "add", "--transport", "http", "--scope", scope,
        MCP_NAME, MCP_URL
      ]
    };
  }

  if (normalized === "codex") {
    if (scope === "project") {
      throw new Error("Codex project scope is not automated; use user scope or add AFA to .codex/config.toml explicitly");
    }
    return {
      kind: "command",
      command: "codex",
      args: ["mcp", "add", MCP_NAME, "--url", MCP_URL]
    };
  }

  if (normalized === "openclaw") {
    if (scope === "project") {
      throw new Error("OpenClaw stores managed MCP servers centrally; use --scope user");
    }
    return {
      kind: "command",
      command: "openclaw",
      args: [
        "mcp", "add", MCP_NAME, "--url", MCP_URL,
        "--transport", "streamable-http"
      ]
    };
  }

  return {
    kind: "cursor-config",
    scope,
    entry: {
      type: "http",
      url: MCP_URL
    }
  };
}

export function mergeCursorConfig(current = {}) {
  if (!current || Array.isArray(current) || typeof current !== "object") {
    throw new Error("Cursor MCP config must be a JSON object");
  }
  if (current.mcpServers && (
    Array.isArray(current.mcpServers) || typeof current.mcpServers !== "object"
  )) {
    throw new Error("Cursor mcpServers must be a JSON object");
  }

  return {
    ...current,
    mcpServers: {
      ...(current.mcpServers || {}),
      [MCP_NAME]: {
        type: "http",
        url: MCP_URL
      }
    }
  };
}

export function parseMcpResponse(contentType, body) {
  if (contentType.includes("application/json")) {
    return JSON.parse(body);
  }

  const events = body
    .split(/\r?\n\r?\n/)
    .flatMap((event) => event.split(/\r?\n/))
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter(Boolean)
    .map((data) => JSON.parse(data));

  if (events.length === 0) {
    throw new Error("MCP server returned neither JSON nor SSE data");
  }
  return events.at(-1);
}

async function commandExists(command) {
  const pathEntries = (process.env.PATH || "").split(process.platform === "win32" ? ";" : ":");
  const extensions = process.platform === "win32"
    ? (process.env.PATHEXT || ".EXE;.CMD;.BAT").split(";")
    : [""];

  for (const pathEntry of pathEntries) {
    for (const extension of extensions) {
      try {
        await access(join(pathEntry, `${command}${extension}`), fsConstants.X_OK);
        return true;
      } catch {
        // Try the next PATH candidate.
      }
    }
  }
  return false;
}

function formatCommand(command, args) {
  return [command, ...args]
    .map((part) => (/^[A-Za-z0-9_./:@-]+$/.test(part) ? part : JSON.stringify(part)))
    .join(" ");
}

async function runCommand(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with status ${code}`));
    });
  });
}

function cursorConfigPath(scope) {
  return scope === "project"
    ? join(process.cwd(), ".cursor", "mcp.json")
    : join(homedir(), ".cursor", "mcp.json");
}

async function installCursor(scope, dryRun) {
  const path = cursorConfigPath(scope);
  if (dryRun) {
    console.log(`Would merge ${MCP_NAME} into ${path}`);
    console.log(JSON.stringify(mergeCursorConfig({}), null, 2));
    return;
  }

  let current = {};
  try {
    current = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw new Error(`cannot read ${path}: ${error.message}`);
    }
  }

  const updated = `${JSON.stringify(mergeCursorConfig(current), null, 2)}\n`;
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.afa-scout-${process.pid}`;
  await writeFile(temporaryPath, updated, { encoding: "utf8", mode: 0o600 });
  await rename(temporaryPath, path);
  console.log(`Installed ${MCP_NAME} in ${path}`);
}

async function installClient(client, options) {
  const plan = installPlan(client, options.scope);
  if (plan.kind === "cursor-config") {
    await installCursor(plan.scope, options.dryRun);
    return;
  }

  const rendered = formatCommand(plan.command, plan.args);
  if (options.dryRun) {
    console.log(rendered);
    return;
  }
  if (!(await commandExists(plan.command))) {
    throw new Error(`${plan.command} is not installed. After installing it, run: ${rendered}`);
  }

  await runCommand(plan.command, plan.args);
  console.log(`Installed ${MCP_NAME} for ${client}.`);
}

async function postMcp(method, params = {}, sessionId) {
  const headers = {
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json"
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;

  const response = await fetch(MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: method, method, params })
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${method} returned HTTP ${response.status}: ${body.slice(0, 240)}`);
  }

  return {
    message: parseMcpResponse(response.headers.get("content-type") || "", body),
    sessionId: response.headers.get("mcp-session-id") || sessionId
  };
}

export async function doctor() {
  const initialized = await postMcp("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "afa-scout", version: "1.1.0" }
  });
  const tools = await postMcp("tools/list", {}, initialized.sessionId);
  const names = (tools.message.result?.tools || []).map((tool) => tool.name);
  const missing = REQUIRED_TOOLS.filter((name) => !names.includes(name));

  return {
    ok: missing.length === 0,
    endpoint: MCP_URL,
    server: initialized.message.result?.serverInfo || null,
    protocolVersion: initialized.message.result?.protocolVersion || null,
    tools: names,
    missing
  };
}

function printCommands() {
  for (const client of ["claude", "codex", "openclaw"]) {
    const plan = installPlan(client);
    console.log(`${client}: ${formatCommand(plan.command, plan.args)}`);
  }
  console.log("cursor: merge the remote server entry into ~/.cursor/mcp.json");
}

export async function runScout(argv) {
  const { positional, options } = parseArgs(argv);
  const [command, target] = positional;

  if (options.help || !command) {
    console.log(HELP);
    return;
  }

  if (command === "commands") {
    printCommands();
    return;
  }

  if (command === "doctor") {
    const result = await doctor();
    if (options.json) console.log(JSON.stringify(result, null, 2));
    else {
      console.log(`${result.ok ? "OK" : "FAIL"}: ${result.endpoint}`);
      console.log(`Server: ${result.server?.name || "unknown"} ${result.server?.version || ""}`.trim());
      console.log(`Tools: ${result.tools.join(", ")}`);
      if (result.missing.length) console.log(`Missing: ${result.missing.join(", ")}`);
    }
    if (!result.ok) process.exitCode = 2;
    return;
  }

  if (command !== "install" || !target) {
    throw new Error("expected install <client>, doctor, or commands");
  }

  const clients = target === "all"
    ? ["claude", "codex", "cursor", "openclaw"]
    : [target];

  for (const client of clients) {
    try {
      await installClient(client, options);
    } catch (error) {
      if (target !== "all") throw error;
      console.error(`Skipped ${client}: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
