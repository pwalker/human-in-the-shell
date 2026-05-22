import type { AgentToolResult, ExtensionContext, ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export type HitsMode = "plan" | "build";
export type HitsDepth = "sentence" | "paragraph" | "outline" | "skeleton" | "full";

export interface HitsState {
  mode: HitsMode;
  depth: HitsDepth;
}

export interface WorkspaceEvidence {
  status: string;
}

export interface RequestEditResultDetails {
  handoffResponse: "done" | "blocked" | "cancel";
  baseline: WorkspaceEvidence;
  after?: WorkspaceEvidence;
  workspaceChanged: boolean;
}

export const PLAN_MODE_TOOLS = ["read", "grep", "find", "ls", "bash"] as const;
export const BUILD_MODE_TOOLS = ["read", "grep", "find", "ls", "bash", "request_edit"] as const;

export function createHitsState(): HitsState {
  return {
    mode: "plan",
    depth: "outline",
  };
}

export function formatHitsStatus(state: HitsState): string {
  return `HITS ${state.mode} / ${state.depth}`;
}

function applyStatus(ctx: ExtensionContext, state: HitsState): void {
  ctx.ui.setStatus("hits", formatHitsStatus(state));
}

function buildModePrompt(depth: HitsDepth): string {
  return [
    "HITS BUILD MODE:",
    "- Semantic code/file changes must go through request_edit.",
    "- Never use direct edit/write behavior.",
    "- Use read/grep/find/ls/bash for investigation and execution support.",
    `- Current handoff depth: ${depth}. Match request_edit.instruction detail level to this depth.`,
  ].join("\n");
}

function buildPlanPrompt(depth: HitsDepth): string {
  return [
    "HITS PLAN MODE:",
    "- Do not request semantic file edits.",
    "- Focus on analysis, planning, and verification strategy.",
    "- Tell the user to run /mode build when they want implementation.",
    `- Current handoff depth: ${depth}.`,
  ].join("\n");
}

export function buildSystemPromptForState(state: HitsState, basePrompt: string): string {
  const modePrompt = state.mode === "build" ? buildModePrompt(state.depth) : buildPlanPrompt(state.depth);
  return `${basePrompt}\n\n${modePrompt}`;
}

export function parseMode(input: string): HitsMode | undefined {
  const value = input.trim();
  if (value === "plan" || value === "build") {
    return value;
  }
  return undefined;
}

export function parseDepth(input: string): HitsDepth | undefined {
  const value = input.trim();
  if (value === "sentence" || value === "paragraph" || value === "outline" || value === "skeleton" || value === "full") {
    return value;
  }
  return undefined;
}

export function getToolsForMode(mode: HitsMode, availableTools: string[]): string[] {
  const available = new Set(availableTools);
  const candidates = mode === "build" ? BUILD_MODE_TOOLS : PLAN_MODE_TOOLS;
  return candidates.filter((tool) => available.has(tool));
}

export async function captureWorkspaceEvidence(
  runExec: (command: string, args: string[], options?: { timeout?: number }) => Promise<{ stdout: string; stderr: string; code: number }>,
): Promise<WorkspaceEvidence> {
  const result = await runExec("git", ["status", "--porcelain"]);
  return { status: result.stdout };
}

function changedWorkspace(baseline: WorkspaceEvidence, after: WorkspaceEvidence): boolean {
  return baseline.status !== after.status;
}

async function executeApprovedBash(
  command: string,
  timeout: number | undefined,
  runExec: (command: string, args: string[], options?: { timeout?: number }) => Promise<{ stdout: string; stderr: string; code: number }>,
  ctx: ExtensionContext,
): Promise<AgentToolResult<{ command: string; approved: boolean; timeout?: number; exitCode?: number }>> {
  if (!ctx.hasUI) {
    return {
      content: [{ type: "text", text: "Denied command: interactive approval requires UI." }],
      details: timeout === undefined ? { command, approved: false } : { command, approved: false, timeout },
    };
  }
  const approved = await ctx.ui.confirm("Approve bash command", command);
  if (!approved) {
    return {
      content: [{ type: "text", text: `Denied command: ${command}` }],
      details: timeout === undefined ? { command, approved: false } : { command, approved: false, timeout },
    };
  }

  const result = await runExec("bash", ["-lc", command], timeout === undefined ? undefined : { timeout });
  const output = [result.stdout, result.stderr].filter((part) => part.trim().length > 0).join("\n");
  const details = timeout === undefined
    ? { command, approved: true, exitCode: result.code }
    : { command, approved: true, timeout, exitCode: result.code };
  return {
    content: [{ type: "text", text: output.length > 0 ? output : "(no output)" }],
    details,
  };
}

async function executeRequestEdit(
  params: { title: string; instruction: string },
  state: HitsState,
  runExec: (command: string, args: string[], options?: { timeout?: number }) => Promise<{ stdout: string; stderr: string; code: number }>,
  ctx: ExtensionContext,
): Promise<AgentToolResult<RequestEditResultDetails>> {
  const baseline = await captureWorkspaceEvidence(runExec);

  if (!ctx.hasUI) {
    return {
      content: [{ type: "text", text: "request_edit denied: UI is not available in this mode." }],
      details: {
        handoffResponse: "cancel",
        baseline,
        workspaceChanged: false,
      },
    };
  }

  if (state.mode !== "build") {
    return {
      content: [{ type: "text", text: "request_edit denied: switch to /mode build first." }],
      details: {
        handoffResponse: "cancel",
        baseline,
        workspaceChanged: false,
      },
    };
  }

  const response = await ctx.ui.select(
    `Human Handoff: ${params.title}`,
    [
      `Depth: ${state.depth}`,
      "Done",
      "Blocked",
      "Cancel",
      "Instruction:",
      params.instruction,
    ],
  );

  if (response === "Cancel" || response === undefined) {
    return {
      content: [{ type: "text", text: "Human handoff cancelled." }],
      details: {
        handoffResponse: "cancel",
        baseline,
        workspaceChanged: false,
      },
    };
  }

  const after = await captureWorkspaceEvidence(runExec);
  const workspaceChanged = changedWorkspace(baseline, after);
  const handoffResponse = response === "Done" ? "done" : "blocked";
  const statusLabel = workspaceChanged ? "Workspace changed." : "No workspace change detected.";

  return {
    content: [{ type: "text", text: `Human handoff ${handoffResponse}. ${statusLabel}` }],
    details: {
      handoffResponse,
      baseline,
      after,
      workspaceChanged,
    },
  };
}

export function createHitsExtension(state: HitsState): ExtensionFactory {
  return (pi) => {
    const applyModeTools = (ctx: ExtensionContext): void => {
      const availableTools = pi.getAllTools().map((tool) => tool.name);
      pi.setActiveTools(getToolsForMode(state.mode, availableTools));
      applyStatus(ctx, state);
    };

    pi.on("session_start", (_event, ctx) => {
      applyModeTools(ctx);
    });
    pi.on("agent_start", (_event, ctx) => {
      applyStatus(ctx, state);
    });

    pi.on("before_agent_start", (event) => {
      return {
        systemPrompt: buildSystemPromptForState(state, event.systemPrompt),
      };
    });

    pi.registerTool({
      name: "bash",
      label: "Approved Bash",
      description: "Run a shell command only after explicit human approval.",
      parameters: Type.Object({
        command: Type.String(),
        timeout: Type.Optional(Type.Number({ minimum: 1 })),
      }),
      execute: async (_toolCallId, params, _signal, _onUpdate, ctx) => {
        return executeApprovedBash(params.command, params.timeout, pi.exec, ctx);
      },
    });

    pi.registerTool({
      name: "request_edit",
      label: "Request Human Edit",
      description: "Ask the human to apply semantic file changes.",
      parameters: Type.Object({
        title: Type.String(),
        instruction: Type.String(),
      }),
      execute: async (_toolCallId, params, _signal, _onUpdate, ctx) => {
        return executeRequestEdit(params, state, pi.exec, ctx);
      },
    });

    pi.registerCommand("mode", {
      description: "Set HITS mode: plan or build",
      getArgumentCompletions: (prefix) => {
        const options = ["plan", "build"];
        const filtered = options.filter((option) => option.startsWith(prefix));
        return filtered.length > 0 ? filtered.map((value) => ({ value, label: value })) : null;
      },
      handler: async (args, ctx) => {
        const mode = parseMode(args);
        if (!mode) {
          ctx.ui.notify("Usage: /mode plan|build", "warning");
          return;
        }
        state.mode = mode;
        applyModeTools(ctx);
      },
    });

    pi.registerCommand("depth", {
      description: "Set handoff depth",
      getArgumentCompletions: (prefix) => {
        const options = ["sentence", "paragraph", "outline", "skeleton", "full"];
        const filtered = options.filter((option) => option.startsWith(prefix));
        return filtered.length > 0 ? filtered.map((value) => ({ value, label: value })) : null;
      },
      handler: async (args, ctx) => {
        const depth = parseDepth(args);
        if (!depth) {
          ctx.ui.notify("Usage: /depth sentence|paragraph|outline|skeleton|full", "warning");
          return;
        }
        state.depth = depth;
        applyStatus(ctx, state);
      },
    });
  };
}
