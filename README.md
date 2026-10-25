# ChatGPT Code Agent for VS Code (MVP v0.5.5)

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

Example:
> Inspect the current project, find the entry point, implement a safe input validation helper, and run the relevant tests.

## Agent tools and approvals
- `list_files`: shallow listing of a workspace-relative directory.
- `read_file`: read UTF-8 text files up to 200 KB.
- `write_file`: propose a complete text-file replacement (maximum 1 MB). The approval card shows the before-and-after contents; use **Open diff editor** to inspect the VS Code diff. The edit is applied only after approval.
- `run_command`: after approval, starts a shell command in the background and returns an ID rather than waiting for it to exit. The agent can monitor output and completion with `get_command_status` (waits up to 20 seconds per poll) and stop it with `stop_command`. The configured timeout defaults to 60 seconds; set `timeoutSeconds: 0` for a command intended to keep running, such as a development server, and stop it with `stop_command` when finished.
- `get_diagnostics`: read current VS Code workspace errors and warnings.
- `remember_project_fact`: append one concise durable fact to `.andrea/MEMORY.md`.

File tools enforce workspace-relative paths, reject symlinks and block common generated/sensitive paths. These restrictions do not sandbox commands. See Security and privacy below.

## Settings
Open **Settings** and search for `ChatGPT Code Agent`:

| Setting | Default | Purpose |
|---|---:|---|
| `chatgptAgent.model` | `gpt-6.1-sol` | Responses API model |
| `chatgptAgent.reasoningEffort` | `medium` | Reasoning effort (`low`, `medium`, `high`, `xhigh`, `max`) |
| `chatgptAgent.maxSteps` | `20` | Maximum agent tool rounds per user message (1–60) |
| `chatgptAgent.commandTimeoutSeconds` | `60` | Shell-command timeout (1–300 seconds) |
| `chatgptAgent.maxOutputChars` | `12000` | Maximum tool output characters (1,000–40,000) |
| `chatgptAgent.autoConsolidate` | `true` | Make an extra API call after a successful task to consolidate project memory |

## Usage and costs
The sidebar reports API-reported input, output, cached-input, and reasoning tokens for each Responses API call, including tool-call rounds. It shows conversation totals and extension-session totals. **New chat** resets the conversation totals and response chain; session totals reset when the extension host restarts. Reasoning tokens are included in output tokens and are not double-counted.

Displayed cost is an estimate based on model rates encoded by the extension, not a bill. Pricing, account-specific charges, processing tiers, and context length may change the actual cost. Consult the [official pricing page](https://developers.openai.com/api/docs/pricing) and API dashboard. Automatic memory consolidation makes an additional API request that is **not included in the usage meter**; disable it with `chatgptAgent.autoConsolidate: false` to avoid that request.

## Security and privacy
**Review every command carefully.** Approved shell commands run with your operating-system user permissions. They are not sandboxed and can access files outside the workspace, perform network requests, or modify data. Approval is a human confirmation step, not OS isolation. Do not open untrusted projects or approve commands you do not understand.

The API key is stored in VS Code SecretStorage and removed from the child shell-command environment. Other inherited user environment variables may still be available to commands. File tools restrict paths, block symlinks, and exclude common sensitive/generated directories, but do not provide a complete security boundary. API request content is sent to OpenAI and handled under its API terms; the extension includes no external telemetry.

The current chat is not persisted as a complete transcript by the extension, and there is no undo history beyond VS Code's normal editing facilities. Local project memory and event logs are stored under `.andrea/`:
- `SEED.md`: startup context; created only if absent and not overwritten by consolidation.
- `MEMORY.md`: durable project facts; facts can be appended and user notes are not replaced.
- `sessions.jsonl`: session IDs, timestamps, user messages, agent replies, and tool names/statuses (not full tool arguments or outputs).
- `summaries.jsonl`: concise per-task summaries generated by consolidation.

The session log may contain private prompts, replies, or project information. `.andrea/` is excluded from Git in this repository; inspect it before sharing or distributing workspace data. Consolidated summaries and facts are model-generated and may be inaccurate, so verify important information. A simple secret-pattern filter is not guaranteed to detect every sensitive value. Failed or cancelled requests are not consolidated.

## Move the chat to the right
VS Code's stable extension API cannot require a custom view to default to the Secondary Side Bar. To move it, open **Agent Chat**, right-click its view header and select **Move View > Secondary Side Bar**, or drag it to the right-hand sidebar. If hidden, use **View > Appearance > Secondary Side Bar**. VS Code remembers the layout.

## Build VSIX
```bash
npm run package
```

For architecture and project-specific development notes, see `docs/PROJECT_OVERVIEW.md`.
