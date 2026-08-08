#!/usr/bin/env node

import { formatErrors, getBaseUrl, readJson, requestJson, validatePitch } from "../lib/pitch.mjs";

const args = process.argv.slice(2);
const remote = args.includes("--remote");
const filePath = args.find((arg) => !arg.startsWith("--"));

if (!filePath) {
  console.error("Usage: npm run validate -- <pitch.json> [--remote]");
  process.exit(1);
}

const pitch = await readJson(filePath);
const result = await validatePitch(pitch);

if (!result.valid) {
  console.error("Local validation failed:");
  for (const error of formatErrors(result.errors)) console.error(`- ${error}`);
  process.exit(2);
}

console.log(`Local validation passed: ${filePath}`);

if (remote) {
  const endpoint = `${getBaseUrl()}/api/v1/pitches/validate`;
  const response = await requestJson(endpoint, {
    method: "POST",
    body: JSON.stringify(pitch)
  });
  console.log(`Remote validation passed: ${endpoint}`);
  console.log(JSON.stringify(response, null, 2));
}
