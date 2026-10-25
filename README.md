# ChatGPT Code Agent for VS Code (MVP v0.5.6)

A TypeScript extension that brings an OpenAI Responses API coding agent into a VS Code sidebar. The agent can inspect workspace files, propose edits, run approved shell commands, report editor diagnostics, and maintain optional project memory.

## License
This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## Requirements
- VS Code 1.96+; Node.js 20+; npm
- OpenAI API key and API billing enabled. ChatGPT subscriptions do **not** include API usage.
- One local workspace folder. Multi-root and remote workspaces are not supported.

## Development and first use
```bash
npm install
npm run compile
npm run check
```
Open the project in VS Code and press **F5** to launch the Extension Development Host. Open a sample project folder in that window, then open **ChatGPT Agent** from the Activity Bar. Use **API Key** to store your OpenAI API key in VS Code SecretStorage, then send a task.

Select the model and reasoning effort in the controls above the chat. Defaults are `gpt-6.1-sol` and `medium`; available model IDs are `gpt-6-luna`, `gpt-6.1-sol`, and `gpt-6-astra`. Your API account must have access to the selected model. Reasoning effort options are `low`, `medium`, `high`, `xhigh`, and `max`. Changing model or reasoning settings resets the active response chain; changing preferences during a request cancels it. `max` can increase latency and API usage.

## Agent tools and approvals
- `list_files`, `read_file`, `write_file`, `run_command`, and `get_diagnostics` provide workspace operations and diagnostics. File changes and shell commands require approval; commands run in the background and return an ID for monitoring.
- `remember_project_fact`: append one concise durable fact to `.andrea/MEMORY.md`.

File tools enforce workspace-relative paths, reject symlinks and block common generated/sensitive paths. These restrictions do not sandbox commands. See Security and privacy below.

## Three-level project memory
Memory lives locally in `.andrea/` (excluded from Git in this repository):
- `MEMORY.md`: permanent project facts and decisions. Auto-consolidation appends candidate facts; model-produced content can be wrong and requires periodic human review and cleanup.
- `TASK.md`: operational note for the current task, replaced at task start and completed after successful consolidation. It is not a transcript.
- `summaries.jsonl`: bounded, concise task summaries and facts. The agent performs local keyword matching against recent summary records and injects only a few relevant matches into context; no embedding service or full session-history loading is used.
- `sessions.jsonl`: session/event metadata only. Message text, assistant responses and tool arguments/results are not written by current code. Existing older log records may still contain such content; review them before sharing or remove them if necessary.
- `SEED.md`: startup context, created only if absent.

The summary search is lexical, so it may miss semantically related sessions. Summaries and facts are model-generated and may be inaccurate; verify important details. A basic secret-pattern filter is not guaranteed to detect every sensitive value. Avoid storing sensitive material in project memory and inspect `.andrea/` periodically.

## Usage and costs
The sidebar reports API-reported input, output, cached-input, and reasoning tokens for each Responses API call, including tool-call rounds. Automatic memory consolidation makes an additional API request not included in the usage meter; disable it with `chatgptAgent.autoConsolidate: false` to avoid that request.

## Security and privacy
Approved shell commands run with your operating-system user permissions and are not sandboxed. API request content is sent to OpenAI and handled under its API terms. The extension includes no external telemetry. The API key is stored in VS Code SecretStorage.

## Build VSIX
```bash
npm run package
```
