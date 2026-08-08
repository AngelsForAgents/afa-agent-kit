#!/usr/bin/env node

import { getBaseUrl, requestJson } from "../lib/pitch.mjs";

const baseUrl = getBaseUrl();
const [agentCard, opportunities, openapi] = await Promise.all([
  requestJson(`${baseUrl}/.well-known/agent-card.json`),
  requestJson(`${baseUrl}/api/v1/opportunities`),
  requestJson(`${baseUrl}/openapi.json`)
]);

const open = opportunities.data?.filter((item) => item.status === "open") || [];

console.log(JSON.stringify({
  source: baseUrl,
  agent: {
    name: agentCard.name,
    version: agentCard.version,
    interfaces: agentCard.supportedInterfaces,
    skills: agentCard.skills?.map(({ id, name, description }) => ({ id, name, description }))
  },
  open_opportunities: open,
  operations: Object.fromEntries(
    Object.entries(openapi.paths || {}).map(([route, methods]) => [route, Object.keys(methods)])
  )
}, null, 2));

if (open.length === 0) {
  console.error("No open AFA opportunities were returned. Do not submit until the live status changes.");
  process.exitCode = 2;
}
