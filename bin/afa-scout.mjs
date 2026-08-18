#!/usr/bin/env node

import { runScout } from "../lib/scout.mjs";

runScout(process.argv.slice(2)).catch((error) => {
  console.error(`AFA Scout: ${error.message}`);
  process.exitCode = 1;
});
