# Pre-deploy Checklist

## 1) Mandatory configuration

- [ ] `ORS_API_KEY` is set in production environment
- [ ] `APP_CONTACT_EMAIL` is set to a real monitored email
- [ ] `APP_PUBLIC_URL` matches the real public domain
- [ ] `LEGAL_FULL_NAME` is set
- [ ] `LEGAL_STREET_ADDRESS` is set
- [ ] `LEGAL_EMAIL` is set
- [ ] `LEGAL_PHONE` is set
- [ ] `LEGAL_VAT_ID` is set (or `N/A` if applicable)

## 2) Legal and trust checks

- [ ] `/impressum` shows real data and no placeholder warning
- [ ] `/datenschutz` reviewed for your exact data flows
- [ ] `/haftungsausschluss` reviewed for your final wording
- [ ] Header clearly marks portal as unofficial information service

## 3) Product accuracy checks

- [ ] URLs in `lib/config/officialLinks.ts` verified as official
- [ ] Prices in `lib/config/pricing2026.ts` rechecked
- [ ] `PRICE_LAST_VERIFIED_AT` updated after recheck

## 4) Technical checks

- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run test` passes
- [ ] Manual smoke test for at least 3 routes passes

## 5) Consent and monetization checks

- [ ] Consent banner appears for new users
- [ ] Affiliate modules stay disabled without consent
- [ ] Sponsored labels are present where needed
