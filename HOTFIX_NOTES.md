# Hotfix 0.5.7 — API chain and task continuation

Changes:
- Align `chatgptAgent.maxSteps` UI metadata with the runtime: default 50, range 5–200.
- Add Resume Task control in the webview with current step/status.
- Do not reuse old response IDs for new tasks. Explicit resume uses persisted pending call outputs or memory-only recovery.
- Disambiguate repeated function calls by call ID; the same tool arguments on different calls are not assumed already executed.
- Release awaiting approval when cancelled, so Stop does not hang waiting for an answer.
- Expose missing `ProjectMemory.checkpointFile` and `completeTask` methods used by the agent controller.
- Fix malformed literal `\\n` sequences found in the uploaded `workspaceTools.ts`.

## Validation
- `npm pack --dry-run --json`: successful.
- TypeScript parser: no reported syntax errors after repair; full typecheck could not complete because dependencies were not installed.
- `npm install --offline`: failed (`yazl` package missing from cache). Online installation did not finish in this environment.
- No live API tests; test in VS Code Extension Development Host after running `npm install` and `npm run compile` locally.

## Cautions
- Test resume with mocked function-call results before relying on long-running autonomous tasks.
- Existing `.andrea/agent-state.json` might originate from a previous buggy version. Back up `.andrea` before upgrading. If it cannot resume, use a new task and reconcile real changes on disk.
- No `.andrea` project data is included in this ZIP.
