# v0.6.0 implementation checkpoint

## Environment constraint
The development agent's file tools deny access to `.andrea/`. SEED.md and MEMORY.md were supplied as context; TASK.md and historical summaries could not be inspected. Do not bypass this restriction or overwrite existing history. Runtime code will maintain TASK.md in the host workspace; development checkpoints are recorded here instead.

## Plan
1. Security: path/cwd validation, bounded output, cancellation-safe approval, process trees, distribution exclusions.
2. Lifecycle: explicit transitions, atomic structured task checkpoint, recovery without replay, safe maxSteps handling.
3. Memory: evidence-based consolidation, compatible structured index, ranked bounded retrieval, obsolete/duplicate audit, resilient storage.
4. Usage: sourced central pricing (unknown unless verified), all API call types, durable rollups, local budgets.
5. UI/docs/release: state/memory/budget/recovery controls, automated tests, compile/typecheck, VSIX inventory verification.

## Initial findings (source inspection)
- v0.5.6 uses unverified model IDs and rates.
- Consolidation alone marks tasks complete and does not contribute to usage totals.
- maxSteps retains a response chain with unresolved tool outputs.
- Memory reads load whole JSONL files before truncation; writes are not atomic.
- Shell execution has no cwd parameter or cancellation-safe approval revalidation.
- Distribution exclusions do not explicitly exclude nested archives, .git and secrets.

## Verification
Pending implementation. No real OpenAI requests will be used in tests.
