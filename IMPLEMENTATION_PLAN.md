# Implementation Plan

This plan breaks the Pi-based HITS MVP into small phases a lower-powered coding agent can complete one at a time.

Reference docs:

- `PI_PLAN.md`: MVP scope and product rules.
- `PI_PLAN_BACKLOG.md`: deferred ideas not needed for MVP.
- `outside-examples/pi/packages/coding-agent/examples/sdk/05-tools.ts`: Pi tool selection example.
- `outside-examples/pi/packages/coding-agent/examples/sdk/06-extensions.ts`: Pi extension/tool/command example.
- `outside-examples/pi/packages/coding-agent/examples/sdk/13-session-runtime.ts`: Pi session runtime example.

## - [ ] Phase 1: Add Pi Dependencies And Fix Project Skeleton

- Update `package.json` so `pnpm dev` runs `src/main.ts` instead of the old missing `src/server.ts`.
- Add runtime dependencies for `@earendil-works/pi-coding-agent`, `@earendil-works/pi-ai`, `@earendil-works/pi-tui`, and `typebox`.
- Add `@types/node` as a dev dependency and update `tsconfig.json` so Node imports typecheck cleanly.
- Run `pnpm install` and confirm `pnpm run check-types` can execute, even if later phases still need implementation fixes.

## - [ ] Phase 2: Launch Pi Interactive Mode From `hits`

- Replace `src/main.ts` with a minimal Pi SDK entrypoint that creates a Pi session runtime and launches `InteractiveMode`.
- Follow the pattern in Pi's `examples/sdk/13-session-runtime.ts` for `createAgentSessionRuntime` and session binding.
- Keep this phase focused on booting the TUI through this repo; do not add HITS tools yet.
- Verify `pnpm dev` opens the Pi TUI or fails with only expected auth/model setup errors.

## - [ ] Phase 3: Add HITS Extension Module

- Create `src/hits-extension.ts` to hold the Human-in-the-Shell extension-shaped behavior.
- Wire the extension into the Pi resource loader or session creation path used by `src/main.ts`.
- Add in-memory HITS state with `mode = "plan"` and `depth = "outline"`.
- Use Pi extension UI/status APIs to show current mode and handoff depth if straightforward.

## - [ ] Phase 4: Disable Direct Edit And Write Tools

- Configure Pi session creation so built-in `edit` and `write` tools are never active.
- Keep read-only project tools available: `read`, `grep`, `find`, and `ls`.
- Use Pi SDK tool configuration from `createAgentSession` and the `tools`/`noTools` options shown in `05-tools.ts`.
- Verify from logs, tool list, or TUI behavior that the model cannot call `edit` or `write`.

## - [ ] Phase 5: Add `/mode` Command

- Register a Pi slash command named `/mode` from `src/hits-extension.ts`.
- Support `/mode plan` and `/mode build`, with argument completions if easy through Pi command registration.
- Update in-memory HITS mode and status/footer text when the command runs.
- Switch active tools when mode changes: plan mode excludes `request_edit`; build mode includes `request_edit` after that tool exists.

## - [ ] Phase 6: Add `/depth` Command

- Register a Pi slash command named `/depth` from `src/hits-extension.ts`.
- Support canonical depth values: `sentence`, `paragraph`, `outline`, `skeleton`, and `full`.
- Update in-memory HITS depth and status/footer text when the command runs.
- Keep depth app-owned; do not ask the model to provide depth in `request_edit`.

## - [ ] Phase 7: Add Mode-Aware Prompt Hook

- Use Pi's `before_agent_start` extension hook to append or replace the system prompt based on current HITS mode and depth.
- Plan prompt should forbid semantic edit requests and tell the human to use `/mode build` when ready.
- Build prompt should require `request_edit` for human-applied semantic file changes and forbid direct edit/write behavior.
- Include current handoff depth in the prompt so the model writes `request_edit.instruction` at the selected detail level.

## - [ ] Phase 8: Add Approved `bash` Tool

- Add a custom tool named `bash` that asks for exact-command approval before execution.
- Use a minimal schema with `command` and optional `timeout`.
- On denial, return a normal structured tool result instead of throwing.
- On approval, use the simplest available Pi execution path first, likely `ctx.exec(...)`; defer richer Pi bash rendering unless it is equally simple.

## - [ ] Phase 9: Add `request_edit` Tool

- Add a custom tool named `request_edit` with only `title` and `instruction` fields.
- Reject or deny the tool if current mode is not `build`.
- Render the Human Handoff in the TUI and wait for `Done`, `Blocked`, or `Cancel` through Pi UI APIs.
- Display current app-owned handoff depth when rendering, but do not include depth in the tool schema.

## - [ ] Phase 10: Capture Workspace Evidence For `request_edit`

- Capture baseline Workspace Evidence with `git status --porcelain` before waiting for the human.
- Capture after Workspace Evidence after `Done` or `Blocked`; skip or mark unchanged for `Cancel`.
- Return structured tool result data containing `handoffResponse`, `baseline`, optional `after`, and `workspaceChanged`.
- Ensure `Done` with no observed workspace change is represented clearly for the model.

## - [ ] Phase 11: Wire Tool Availability To Mode

- Ensure plan mode active tools are `read`, `grep`, `find`, `ls`, and approved `bash`.
- Ensure build mode active tools are `read`, `grep`, `find`, `ls`, approved `bash`, and `request_edit`.
- Re-run active tool updates when `/mode` changes.
- Confirm the mode switch changes prompt behavior and available tools in the same TUI session.

## - [ ] Phase 12: Manual MVP Smoke Test

- Run `pnpm run check-types` and fix type errors introduced by the spike.
- Run `pnpm dev` and verify the TUI launches.
- In plan mode, verify the agent can discuss a plan without `request_edit`.
- Switch to build mode with `/mode build`, ask for a small change, and verify the agent uses `request_edit` instead of direct edit/write tools.
- Approve or deny a `bash` command and verify the structured result returns to the model.

## - [ ] Phase 13: Trim Or Document Follow-Up Work

- Move any partially attempted non-MVP ideas into `PI_PLAN_BACKLOG.md` rather than leaving them half-implemented.
- Update `PI_PLAN.md` if implementation discovers a simpler or more accurate MVP boundary.
- Keep the codebase focused on the SDK wrapper, HITS extension, approved `bash`, and `request_edit`.
- Do not add persistence, structured questions, `plan_exit`, rich bash rendering, or Pi package distribution in the MVP unless explicitly re-scoped.
