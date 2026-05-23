# Pi Plan Backlog

This file preserves deferred command-safety and command-intent ideas cut from the MVP plan.

MVP rule is simpler: every `bash` command asks for exact-command approval. No command taxonomy, no bash intent field, no Workspace Evidence around bash.

## Why Deferred

The main MVP goal is to prove that `hits` can preserve Human Authorship by removing direct `edit` and `write` tools and routing semantic edits through `request_edit`.

Command categories add conceptual and implementation weight before we know whether the Pi SDK wrapper works. Revive these ideas only if real usage shows pain:

- Approved bash commands become tedious.
- The model abuses bash as an edit/write substitute.
- Users want different approval UX for tests vs fixers.
- Incidental file changes from approved commands confuse the workflow.
- Workspace Evidence around commands becomes necessary for trust.

## Structured Question Tool

MVP uses plain assistant questions when ambiguity blocks progress.

Possible future `question` tool:

- `question: string`
- `header: string`
- `options: { label: string; description?: string }[]`
- `multiple?: boolean`

Future rules:

- Allowed in plan and build.
- Plain assistant text may temporarily substitute for Clarification Questions only.
- Plain text must not substitute for Human Handoff, Plan Exit, or Command Approval.

## Plan Exit Tool

MVP uses explicit `/mode build` to switch from planning to building.

Possible future `plan_exit` tool:

- Exposed only in plan mode.
- Asks whether to switch to build mode.
- Yes changes mode to `build`.
- Yes records durable semantic content: `Switch to build mode from the current plan.`
- No keeps mode `plan` and returns refinement result.
- Pending Plan Exit does not need to survive process exit in MVP.

## Mode And Depth Persistence

MVP keeps HITS state in memory:

- `mode = "plan"`
- `depth = "outline"`

Future persistence options:

- Pi custom session entries via extension context `appendEntry`.
- HITS-specific metadata file if Pi session entries are awkward.

Future rules:

- Resume should restore mode/depth.
- Workflow transitions should be durable enough for LLM context, not hidden metadata only.
- Accepting Plan Exit should create durable semantic content: `Switch to build mode from the current plan.`

## Larger request_edit Schema

MVP `request_edit` schema only needs:

- `title: string`
- `instruction: string`

Possible future fields:

- `depth?: CanonicalDepth`
- `targetFiles?: string[]`
- `verification?: string`

Future decision: whether model supplies depth or app state always owns depth.

## Pending Handoff Resume

MVP only needs blocking Human Handoff during one running TUI process.

Future rule:

- Pending Human Handoffs should survive process exit/resume if feasible.

Reason:

- Human edits can happen out-of-process while the tool is waiting.
- Losing pending handoff state on process exit could confuse the build loop.

## Pi Package Distribution

MVP is the `hits` SDK wrapper, not a standalone Pi package.

Future packaging question:

- Should the HITS behavior be packaged as a Pi package for stock Pi users?
- If yes, should it be advisory-only?
- Or should it try to enforce tool removal when installed into stock Pi?

Risk of package-only distribution:

- Users may still have `edit` and `write` enabled.
- Users may have conflicting extensions.
- Users may keep normal Pi prompts and settings.
- Tool configuration may violate HITS assumptions.

The official `hits` wrapper can enforce session creation, active tools, custom tools, prompts, and mode defaults more reliably.

## Rich Bash Rendering

MVP approved `bash` can use `ctx.exec(...)` and return a simple structured result.

Possible future improvement:

- Delegate to `createBashToolDefinition(cwd).execute(...)` inside the approval wrapper.
- Preserve Pi's streaming output, truncation, temp full-output files, and built-in tool rendering.

## Observation Command

An Observation Command is a shell command used with the intent to inspect, research, or verify workspace state, even if incidental file writes occur.

Possible future rules:

- Plan mode allows Observation Commands only.
- Build mode allows Observation Commands and Mechanical Commands.
- Incidental side effects are not human-authored semantic changes.
- If incidental side effects matter, surface them and ask how to proceed.
- Do not capture before/after Workspace Evidence around every Observation Command unless usage proves it valuable.

## Mechanical Command

A Mechanical Command is a shell command used with the intent to produce a Mechanical Code Change.

Mechanical Code Change means deterministic tool-generated workspace change produced by an approved command.

Examples:

- Formatter.
- Lint fixer.
- Code generator.
- Package manager lockfile update.
- Migration generator.

Non-examples:

- Arbitrary shell edits like `perl -pi`.
- Manual `cp`/`mv`-style implementation changes.
- `git commit`.

Possible future rules:

- Build mode may allow Mechanical Commands through exact-command approval.
- Plan mode does not allow Mechanical Commands.
- Mechanical Code Changes are human-approved deterministic tool output, not Human Authorship.
- Mechanical Commands should capture before/after Workspace Evidence because they intentionally mutate files.

## Bash Tool Intent Field

Future `bash` schema could include command intent:

- `command: string`
- `reason?: string`
- `intent: "observation" | "mechanical"`
- `timeout?: number`

Execution could become:

- If mode is `plan` and intent is `mechanical`, return structured denial.
- Ask approval through `ctx.ui.confirm` or custom UI.
- Show cwd, command, intent, and reason.
- If denied, return structured tool result with `{ approved: false }`.
- If approved and intent is `observation`, delegate to Pi's bash implementation or equivalent execution.
- If approved and intent is `mechanical`, capture before/after Workspace Evidence around execution.

## Command Approval Semantics

Future command approval copy may need to clarify:

- Approval does not prove the command is safe.
- Approval does not prove the command is observational.
- Approval does not make a command compatible with Human Authorship.
- Approval grants permission for one exact command string only.
- Denial is a normal structured tool result, not a thrown exception.

## Prompt Additions If Revived

Plan prompt could say:

- Use approved `bash` only for Observation Commands.

Build prompt could say:

- Use approved `bash` for Observation Commands or Mechanical Commands only.
- Build mode may request exact-command approval for deterministic project tools like formatters/lint fixers/generators.
- Mechanical Commands are not Human Authorship.
- Arbitrary shell editing is not mechanical.
