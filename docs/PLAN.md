# Pi-Based Human-in-the-Shell Plan

Goal: test whether `hits` can be a thin, product-specific wrapper around Pi's coding-agent SDK, with Human-in-the-Shell behavior implemented as a Pi extension/profile instead of a bespoke TUI/runtime.

## Goals And Objectives

Human-in-the-Shell exists to make coding-agent workflows safer and more legible without making them inert.

Primary goals:

- Preserve Human Authorship: the human chooses and applies semantic code changes.
- Let the agent manage context, sequencing, research, and verification.
- Keep the agent useful by allowing approved shell commands.
- Make handoffs explicit, durable, and verifiable through Workspace Evidence.
- Provide a practical TUI-first workflow for planning and building in real projects.
- Reuse mature Pi infrastructure instead of rebuilding auth, sessions, tools, slash commands, and terminal UI.

Product objectives:

- `hits` opens a TUI-first workflow that starts in planning mode.
- Planning mode helps converge on a design without requesting semantic edits.
- Build mode drives implementation through Human Handoffs and approved commands.
- The model never receives direct `edit` or `write` tools.
- Mode and handoff depth are visible and changeable during the TUI session.
- The official `hits` wrapper enforces the workflow.

Non-goals for the spike:

- Build a bespoke TUI from scratch.
- Reimplement Pi auth, model selection, session storage, or slash commands.
- Prove a perfect shell sandbox or static command-safety classifier.
- Support every future workflow variant before validating the Pi SDK approach.

## Recommendation

Use a hybrid approach:

- Core Human-in-the-Shell behavior lives in an extension-shaped module.
- `hits` uses Pi programmatically through `@earendil-works/pi-coding-agent` SDK.
- `hits` launches Pi `InteractiveMode` with strict defaults that preserve Human Authorship.

This gives us Pi reuse without losing product-level guarantees.

## Why Use Pi SDK

Pi already provides most of what `hits` needs:

- `InteractiveMode` TUI.
- Session runtime and JSONL persistence.
- Auth, model registry, `/login`, `/model`.
- Slash commands and autocomplete.
- Built-in read-only tools: `read`, `grep`, `find`, `ls`.
- Built-in `bash` implementation that can be wrapped or replaced.
- Custom tools via `pi.registerTool()` or SDK `customTools`.
- Custom commands via `pi.registerCommand()`.
- Extension hooks, including `before_agent_start` for prompt shaping.
- UI APIs for confirmation, select, input, custom focused components, widgets, status, footer/header.
- Session runtime operations for new/resume/fork/import.
- Tool rendering infrastructure.

This should let us delete or avoid most custom TUI/session/auth/tool plumbing.

## Product Boundary

`hits` is not a general Pi clone. It is a constrained Pi-powered workflow where:

- The agent manages context, sequencing, and verification.
- The human remains responsible for semantic code changes.
- The agent never receives direct `edit` or `write` tools.
- Human-applied semantic changes happen through `request_edit`.
- Every `bash` command requires explicit approval.

## Core Domain Rules

### Mode

`Mode` is workflow intent.

- `plan`: inspect, research, ask questions, converge on a plan.
- `build`: drive implementation through Human Handoffs, approved commands, and verification.

Rules:

- New TUI session starts in `plan` mode.
- Mode switches preserve the same transcript/session.
- Building is reached through TUI mode transitions, not a separate `build` CLI workflow.
- Non-TUI one-shot prompts may exist for tests/debugging, but are not the main product workflow.
- Resume opens the TUI regardless of how session was created.

### Depth

`Depth` controls Human Handoff detail only.

Canonical depth values:

- `sentence`
- `paragraph`
- `outline`
- `skeleton`
- `full`

Rules:

- Default depth is `outline`.
- Depth does not control plan response verbosity.
- Footer/status should call this `Handoff depth`, not generic `Depth`.
- `/depth <value>` should change future Human Handoff detail.
- No separate planning-detail setting in MVP.

### Human Handoff

A Human Handoff is a `request_edit` tool call asking the human to apply semantic code changes while the agent waits, preserves context, and later verifies evidence.

Rules:

- Build mode uses `request_edit` for human-applied semantic code changes.
- Plan mode never exposes `request_edit`.
- Plain assistant text must not substitute for `request_edit` when a code/documentation/config/test change is needed.
- A handoff may cover multiple files if they form one coherent edit.
- A handoff should not bundle unrelated changes.
- A handoff may explain what completion means, but the agent still verifies after the human response.

Handoff controls:

- `Done`: human says the handoff is ready for verification.
- `Blocked`: human cannot complete the requested edit as given.
- `Cancel`: stop that handoff without asking the agent to adapt it.

`Done` is human intent, not proof that changes landed.

### Workspace Evidence

Workspace Evidence is observed workspace state before and after a Human Handoff.

MVP evidence:

- `git status --porcelain` before.
- `git status --porcelain` after.
- `workspaceChanged = before.output !== after.output`.

Rules:

- Workspace Evidence is source of truth for workspace state.
- It proves that state changed, not semantic correctness.
- If `Done` and `workspaceChanged=false`, agent must not assume completion.
- If `Blocked`, agent should use evidence plus blocked signal to adjust, ask a clarification question, or issue a revised handoff.
- If `Cancel`, agent should not continue the edit loop unless the user gives a new instruction.

### Command Approval

Command Approval is human permission for one exact shell command string.

Rules:

- Approval does not prove the command is safe.
- Approval does not make a command compatible with Human Authorship.
- Denial is a normal structured tool result, not a thrown exception.
- Prompt should show command and cwd.
- Pending command approval does not need to survive process exit in MVP.

## Pi Integration Shape

### Files

Recommended spike files:

- `src/main.ts`: launches the `hits` Pi-powered app.
- `src/hits-extension.ts`: extension-shaped HITS behavior.
- Optional later: `src/hits-tools.ts`, `src/hits-state.ts`, `src/hits-prompts.ts` if `hits-extension.ts` gets too large.

Keep the spike simple first. Split only when the file is hard to reason about.

### Dependencies

Add:

- `@earendil-works/pi-coding-agent`
- `@earendil-works/pi-ai`
- `@earendil-works/pi-tui`
- `typebox`
- `@types/node`

Pi examples show `@earendil-works/pi-coding-agent` already exports the needed SDK pieces and many TUI components/types.

### Entry Point

Use Pi programmatically:

- `createAgentSessionRuntime`
- `createAgentSessionServices` or `createAgentSession`
- `DefaultResourceLoader` with inline extension factory
- `InteractiveMode`

The `hits` command should create a Pi runtime with HITS defaults and run `InteractiveMode`.

### Tool Configuration

Do not enable Pi's default built-in coding tool set.

Use one of these patterns:

- `noTools: "builtin"` plus explicit custom/active tools.
- Or `tools: [...]` allowlist that never includes `edit` or `write`.

Desired tool availability:

Plan mode:

- `read`
- `grep`
- `find`
- `ls`
- approved `bash`

Build mode:

- `read`
- `grep`
- `find`
- `ls`
- approved `bash`
- `request_edit`

Never enable:

- `edit`
- `write`

### Custom Bash

Pi's built-in `bash` is useful, but HITS requires approval.

Implement custom tool named `bash` so it overrides or replaces built-in `bash`.

Schema should include:

- `command: string`
- `timeout?: number`

Execution:

- Ask approval through `ctx.ui.confirm` or custom UI.
- Show cwd and command.
- If denied, return structured tool result with `{ approved: false }`.
- If approved, delegate to Pi's bash implementation or equivalent execution.

Implementation option:

- Use `ctx.exec(...)` first.
- Only delegate to Pi's full bash definition if it is equally simple.

### request_edit Tool

Custom tool name: `request_edit`.

Schema:

- `title: string`
- `instruction: string`

Use current app `depth` state when rendering the handoff. Do not ask the model to provide depth in the MVP.

Execution:

- If mode is not `build`, return structured denial.
- Capture baseline Workspace Evidence.
- Render Human Handoff instructions in TUI.
- Wait for human response: `Done`, `Blocked`, `Cancel`.
- If response is not `Cancel`, capture after Workspace Evidence.
- Return structured result with `handoffResponse`, `baseline`, `after`, `workspaceChanged`, and optional evidence note.

Rendering:

- Use custom tool renderers if quick.
- Otherwise use default tool rendering plus `ctx.ui.select`/`ctx.ui.custom` for the blocking response.

## Slash Commands

Use Pi extension commands via `pi.registerCommand()`.

Commands:

- `/mode plan`
- `/mode build`
- `/depth sentence`
- `/depth paragraph`
- `/depth outline`
- `/depth skeleton`
- `/depth full`

Pi supports slash commands and argument completions through `CombinedAutocompleteProvider` and extension command registration.

`/depth` details:

- Validate canonical depth.
- Update future Human Handoff depth for the current process.
- Update status/footer.
- Does not trigger an LLM turn.

`/mode` details:

- Validate `plan | build`.
- Update active tools.
- Update status/footer.
- Does not itself begin a Human Handoff.

## Prompt Strategy

Use Pi `before_agent_start` hook to replace or append system prompt based on current mode/depth.

Plan prompt should say:

- You are in planning mode.
- Do not create, edit, delete, move, format, commit, or request semantic file changes.
- Every `bash` call requires approval.
- Ask plain assistant questions when ambiguity blocks progress.
- Produce concise design plans when ready.
- Tell the human to use `/mode build` when they are ready to build.

Build prompt should say:

- You are in building mode.
- Human Authorship is required for human-applied semantic edits.
- You cannot edit files directly.
- If human-applied semantic file changes are needed, call `request_edit`.
- Do not write Human Handoff instructions as plain assistant text when a code/doc/config/test change is needed.
- Every `bash` call requires approval.
- Do not use `bash` as a substitute for `request_edit` when asking the human to make semantic code changes.
- After `request_edit`, treat Handoff Response as human intent and Workspace Evidence as source of truth.
- If verification fails and fix requires human-applied code changes, call `request_edit` again.

## Session State

The MVP uses in-memory HITS state:

- `mode = "plan"`
- `depth = "outline"`

Mode/depth persistence is deferred. The spike only needs to prove that mode/depth work during one running TUI session.

## Footer And Status

MVP can use Pi extension status/widget APIs:

- Show `Mode: plan` or `Mode: build`.
- Show `Handoff depth: outline`.
- Show cwd through Pi's existing footer.

If custom footer is easy, use it. Otherwise use `ctx.ui.setStatus()` or a widget first.

## CLI Shape

Product path:

- `hits` opens TUI in plan mode for a new session.
- Resume opens TUI through Pi session support; HITS mode/depth persistence is deferred.

Keep outside the main product path:

- Non-TUI one-shot prompts for tests/debug only.
- Plain CLI `sessions` list if needed.
- Auth commands can remain CLI/TUI as Pi provides.

Remove or avoid:

- Separate `build` CLI command as product workflow.

## Spike Implementation Order

1. Add Pi dependencies.
2. Launch Pi `InteractiveMode` from `src/main.ts`.
3. Add inline HITS extension with status showing mode/depth.
4. Disable `edit` and `write`; enable read-only tools.
5. Add `/mode` and `/depth` commands with argument completions.
6. Add mode-aware prompt hook.
7. Add custom approved `bash` tool.
8. Add custom `request_edit` tool.
9. Switch active tools on mode changes.
10. Run typecheck.
11. Manually test TUI behavior.

## Spike Success Criteria

- `pnpm dev` launches Pi TUI through this repo.
- Model has no `edit` or `write` tools.
- Model can inspect files with `read`, `grep`, `find`, `ls`.
- `/mode plan|build` updates tool availability and prompt behavior.
- `/depth <canonical-depth>` updates future Human Handoff detail.
- `bash` asks approval before execution.
- Denied `bash` returns structured result.
- `request_edit` blocks for human response and returns structured result.
- `request_edit` captures before/after Workspace Evidence.

## Spike Kill Criteria

- Pi `InteractiveMode` cannot be customized enough without forking Pi internals.
- Custom tool UI cannot block cleanly for Human Handoff response.
- Built-in `edit`/`write` cannot be reliably removed.
- Custom `bash` cannot reliably replace or wrap built-in `bash`.
- Active tools cannot change per mode reliably.
- Prompt control through extension hooks is insufficient.

If kill criteria trigger, fall back to custom TUI built directly on `@earendil-works/pi-tui`.

## Things To Delete Or Avoid If Spike Works

- Bespoke TUI shell.
- Custom auth/provider/model selection code.
- Custom session JSONL runtime.
- Custom transcript rendering.
- Custom slash command/autocomplete implementation.
- Custom read/grep/find/ls implementations.
- Most custom bash execution code, except HITS approval wrapper.

## Open Questions

- Should `hits` use Pi's default session directory or a separate HITS agent directory?
- Should stock Pi extensions be allowed in `hits`, or should `hits` start from only the HITS extension?
