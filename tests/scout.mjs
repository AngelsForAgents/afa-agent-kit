import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  MCP_URL,
  installPlan,
  mergeCursorConfig,
  parseMcpResponse
} from "../lib/scout.mjs";

const codex = installPlan("codex");
assert.deepEqual(codex.args, ["mcp", "add", "afa-funding", "--url", MCP_URL]);

const claude = installPlan("claude", "project");
assert.deepEqual(claude.args.slice(0, 6), [
  "mcp", "add", "--transport", "http", "--scope", "project"
]);

const openclaw = installPlan("openclaw");
assert.ok(openclaw.args.includes("streamable-http"));

const cursor = mergeCursorConfig({
  mcpServers: { existing: { command: "existing-server" } },
  untouched: true
});
assert.equal(cursor.untouched, true);
assert.equal(cursor.mcpServers.existing.command, "existing-server");
assert.equal(cursor.mcpServers["afa-funding"].url, MCP_URL);
assert.equal(cursor.mcpServers["afa-funding"].type, "http");

const sse = parseMcpResponse(
  "text/event-stream",
  'event: message\ndata: {"jsonrpc":"2.0","id":"tools/list","result":{"tools":[]}}\n\n'
);
assert.deepEqual(sse.result.tools, []);

const glama = JSON.parse(await readFile("glama.json", "utf8"));
assert.deepEqual(glama.maintainers, ["tomrikert"]);

console.log("All AFA Scout tests passed.");
