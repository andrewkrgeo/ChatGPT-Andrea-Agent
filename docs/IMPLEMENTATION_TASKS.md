# Implementation tasks: dynamic model catalog and Smart Agent

Baseline: 0.6.8. Work is split into reviewable tasks; automated tests must never call OpenAI.

## Phase 1 — Dynamic model catalog
- [x] T1. Review the roadmap and identify the existing model configuration, request, and chat integration points (`docs/IMPLEMENTATION_STATUS.md`).
- [x] T2. Define acceptance boundaries: user-initiated catalog retrieval only; credentials are passed transiently and never logged or stored with model IDs; catalog IDs are not proof of Responses API/tool compatibility.
- [x] T3. Implement an injectable catalog service that lists model IDs, validates/deduplicates IDs, and reports sanitized errors.
- [x] T4. Add deterministic offline tests with a mocked client for successful, empty, malformed, and failed responses.
- [x] T5. Add an explicit chat action to retrieve and select account model IDs; distinguish custom IDs from verified built-ins, explain compatibility limitations, and persist only the selected non-secret ID using VS Code configuration.
- [x] T6. Handle missing credentials, retrieval errors, no results, and stale selections without silently changing the active model.
- [x] T7. Update README and implementation status; increment version metadata for each implementation release.
- [ ] T8. Run `npm test` and `npm run check`; manually verify the Extension Development Host if available.

## Phase 2 — Smart Agent
- [ ] T9. Define deterministic, observable model routing inputs and eligibility rules; do not infer unverified capabilities or pricing.
- [ ] T10. Add explicit/inspectable model selection, manual override, and predictable fallback; never silently retry a failed custom model with another model.
- [ ] T11. Check Responses API/tool compatibility where verifiable; otherwise disclose uncertainty and ask for user choice.
- [ ] T12. Add offline mock tests for routing, overrides, unavailable models, fallback, and compatibility uncertainty.
- [ ] T13. Update user documentation and version metadata.
- [ ] T14. Run tests/checks and manually verify the Extension Development Host if available.

## Completion criteria
- Existing verified model choices remain usable when catalog retrieval is unavailable.
- Retrieval is explicitly initiated and does not expose or persist credentials.
- Account-listed custom IDs remain visibly distinct; listing alone never implies compatibility or pricing.
- Smart Agent decisions are understandable, overridable, and covered by offline tests.
