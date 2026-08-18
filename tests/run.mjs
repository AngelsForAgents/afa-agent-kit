import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readJson, validatePitch } from "../lib/pitch.mjs";
import "./scout.mjs";

const example = await readJson("examples/pitch.example.json");
const valid = await validatePitch(example);
assert.equal(valid.valid, true, JSON.stringify(valid.errors));

const wrongAmount = structuredClone(example);
wrongAmount.funding.proof_grant_usd = 100;
const invalidAmount = await validatePitch(wrongAmount);
assert.equal(invalidAmount.valid, false);
assert.ok(invalidAmount.errors.some((error) => error.instancePath === "/funding/proof_grant_usd"));

const missingController = structuredClone(example);
delete missingController.controller;
const invalidController = await validatePitch(missingController);
assert.equal(invalidController.valid, false);

const serverManifest = JSON.parse(await readFile("mcp/server.json", "utf8"));
assert.equal(serverManifest.name, "com.angelsforagents/funding");
assert.equal(serverManifest.remotes[0].type, "streamable-http");
assert.equal(serverManifest.remotes[0].url, "https://angelsforagents.com/api/v1/mcp");

const skill = await readFile("skills/afa-funding/SKILL.md", "utf8");
assert.match(skill, /^---\nname: afa-funding\n/);
assert.match(skill, /explicit authorization/i);
assert.match(skill, /idempotency key/i);

console.log("All local schema tests passed.");
