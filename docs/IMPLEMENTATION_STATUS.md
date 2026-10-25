# Implementation roadmap

Last updated: 2026-10-25
Current baseline: v0.6.12

## Goal
Add support for choosing from models enabled on the user's OpenAI API account, then add a Smart Agent mode that can select an appropriate model without confusing verified built-in models with user-supplied model IDs. Do not assume that an arbitrary model supports the Responses API or the agent's tools.

## Phase 1 — Dynamic model catalog and configuration
1. Inspect the current model-setting, request construction, and chat UI flows; preserve existing verified model choices as a safe fallback.
2. Add an explicit user action to fetch the available model IDs using the configured API credential. Do not fetch automatically at activation or expose the credential in logs, UI messages, or persisted catalog data.
3. Present fetched IDs distinctly from verified built-in models. Allow selection/configuration of a custom ID, but explain that account availability does not guarantee Responses API or tool compatibility.
4. Validate and persist only non-secret model configuration using the existing VS Code settings/storage conventions. Handle missing credentials, API errors, empty results, and stale/unavailable selections without silently switching models.
5. Add unit tests with a mocked API client; tests must make no real OpenAI API calls. Update user documentation and bump the project version.
6. Verify with `npm test` and `npm run check`.

## Phase 2 — Smart Agent
1. Define observable selection criteria (task intent/complexity, user preference, configured model availability, and cost where sourced); never claim a model's capabilities or pricing without verified evidence.
2. Make model selection explicit and inspectable to the user, with a predictable manual override and fallback. Do not silently retry a failed custom model with a different model.
3. Confirm the selected model's support for the Responses API and required tools before execution where the API can establish this; otherwise communicate the limitation and require user choice.
4. Keep the selector independent of API credentials and ensure no secrets enter task checkpoints, memory, or logs.
5. Add deterministic tests for routing, fallback, unavailable models, and compatibility uncertainty using mocks only; update docs and bump the project version.
6. Run `npm test` and `npm run check`; manually verify the Extension Development Host if available.

## Current progress (v0.6.12)
- Added `docs/IMPLEMENTATION_TASKS.md` to track the deliverable-sized tasks.
- Implemented the injectable, sanitized model-ID catalog service in `src/modelCatalog.ts`.
- Added mocked offline tests covering valid/duplicate entries, empty results, malformed responses, and sanitized failures.
- T5–T6 implemented: the chat Account models action explicitly retrieves IDs using SecretStorage; built-ins and unverified custom IDs are labeled separately. Custom selection requires confirmation and persists only the selected ID in VS Code configuration.
- Missing credentials, retrieval failures, empty catalogs and stale selections leave the configured model unchanged. Credential changes invalidate the ephemeral catalog, including in-flight results. No automatic retrieval or fallback is performed.
- `npm test` and `npm run check` passed (15 tests total). No real API calls were made.

## Acceptance criteria
- Existing verified model workflow remains usable if catalog retrieval fails or is not configured.
- Catalog retrieval is user-initiated, mockable, and never exposes/persists API credentials.
- Custom model IDs are visibly distinguished from verified models; compatibility and pricing are not inferred from listing alone.
- Smart Agent choices are understandable, overridable, and covered by offline tests.

## Deferred / not in scope
- Claiming universal compatibility for models returned by the account catalog.
- Real API calls in automated tests.
- Automatic model switching after errors without user visibility.

## Manual verification pending
Extension Development Host verification has not been performed. Check missing credentials, failed/empty retrieval, custom confirmation/cancellation, stale selections, credential changes and persistence after reload. T8 remains open for this manual check.
