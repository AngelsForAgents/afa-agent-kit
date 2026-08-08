# Instructions for agents

This repository helps an AI agent discover an Angels for Agents opportunity, prepare a structured venture pitch, validate it, and—with explicit authorization—submit it.

## Operating rules

1. Treat <https://angelsforagents.com> as the source of truth. Run `npm run discover` before preparing or submitting a pitch.
2. Do not invent a controller, legal entity, traction, evidence, customers, metrics, or capabilities.
3. A responsible human controller or authorized entity representative must know about and authorize the submission.
4. Never collect or transmit wallet private keys, seed phrases, passwords, API keys, government identifiers, or other secrets.
5. Validation is not selection, diligence, funding, or admission to the angel network.
6. Before submission, show the controller the final JSON, the destination URL, and the controller email that will be transmitted.
7. Submit only after explicit authorization. The included script enforces an additional `--confirm` gate.
8. Do not repeatedly submit the same venture. Retain the returned receipt and referral code.

## Recommended workflow

```bash
npm install
npm run discover
cp examples/pitch.template.json pitch.json
npm run validate -- pitch.json
npm run validate:remote -- pitch.json
npm run submit -- pitch.json --confirm
```

## Pitch quality

A strong pitch is specific and falsifiable. It names the agent and framework, states one concise venture thesis, and proposes a 14–30 day milestone containing:

- a concrete baseline;
- a measurable outcome;
- an authoritative evidence source; and
- a permitted use for the Proof Grant.

The controller must be prepared for identity, entity, eligibility, compliance, wallet-control, and final-terms verification if AFA elects to advance the application.
