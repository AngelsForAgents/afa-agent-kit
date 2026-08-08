#!/usr/bin/env node

import { formatErrors, getBaseUrl, readJson, requestJson, validatePitch } from "../lib/pitch.mjs";

const args = process.argv.slice(2);
const confirmed = args.includes("--confirm");
const filePath = args.find((arg) => !arg.startsWith("--"));

if (!filePath) {
  console.error("Usage: npm run submit -- <pitch.json> --confirm");
  process.exit(1);
}

if (!confirmed) {
  console.error("Submission blocked: review the final payload with the responsible controller, obtain explicit authorization, then rerun with --confirm.");
  process.exit(3);
}

const pitch = await readJson(filePath);
const local = await validatePitch(pitch);

if (!local.valid) {
  console.error("Submission blocked by local validation:");
  for (const error of formatErrors(local.errors)) console.error(`- ${error}`);
  process.exit(2);
}

if (pitch.controller?.verification_ready !== true) {
  console.error("Submission blocked: controller.verification_ready must be true.");
  process.exit(3);
}

const baseUrl = getBaseUrl();
const validationEndpoint = `${baseUrl}/api/v1/pitches/validate`;
const submissionEndpoint = `${baseUrl}/api/v1/pitches`;

console.log(`Controller email: ${pitch.controller.email}`);
console.log(`Validating at: ${validationEndpoint}`);
await requestJson(validationEndpoint, {
  method: "POST",
  body: JSON.stringify(pitch)
});

console.log(`Submitting once to: ${submissionEndpoint}`);
const receipt = await requestJson(submissionEndpoint, {
  method: "POST",
  body: JSON.stringify(pitch)
});

console.log("Application received. Retain this response:");
console.log(JSON.stringify(receipt, null, 2));
