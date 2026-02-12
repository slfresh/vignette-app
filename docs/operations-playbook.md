# Operations Playbook

## Monthly tariff verification

1. Check each official toll portal for current prices.
2. Update `lib/config/pricing2026.ts` entries.
3. Update `PRICE_LAST_VERIFIED_AT`.
4. Run `npm run lint && npm run typecheck && npm run test`.
5. Publish changes with release notes.

## Official link verification

1. Confirm each URL in `lib/config/officialLinks.ts` still resolves.
2. Replace outdated links only with official operator domains.
3. Do not add reseller links.

## Incident response

1. If ORS fails or rate-limits, show user-friendly error only.
2. Check server logs and ORS status.
3. Keep compliance pages reachable during incident.

## Compliance hygiene

1. Keep legal pages updated.
2. Keep affiliate modules disabled by default.
3. Enable affiliates only with user consent and clear sponsored labels.
