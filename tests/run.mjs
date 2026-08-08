import assert from "node:assert/strict";
import { readJson, validatePitch } from "../lib/pitch.mjs";

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

console.log("All local schema tests passed.");
