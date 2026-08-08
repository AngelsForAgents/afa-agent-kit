import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

export const DEFAULT_BASE_URL = "https://angelsforagents.com";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function getBaseUrl() {
  return (process.env.AFA_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
}

export async function readJson(filePath) {
  const raw = await fs.readFile(path.resolve(filePath), "utf8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Could not parse ${filePath} as JSON: ${error.message}`);
  }
}

export async function validatePitch(pitch) {
  const schema = await readJson(path.join(root, "schemas", "pitch.schema.json"));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const valid = validate(pitch);
  return { valid, errors: validate.errors || [] };
}

export function formatErrors(errors) {
  return errors.map((error) => {
    const location = error.instancePath || "/";
    return `${location} ${error.message}`;
  });
}

export async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      accept: "application/json",
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    const detail = typeof body === "string" ? body : JSON.stringify(body);
    throw new Error(`${response.status} ${response.statusText}: ${detail}`);
  }

  return body;
}
