import type { AgentToolResult, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { State } from "./policy.js";

export interface WorkspaceEvidence {
  status: string;
}

export interface RequestEditResultDetails {
  handoffResponse: "done" | "blocked" | "cancel";
  baseline: WorkspaceEvidence;
  after?: WorkspaceEvidence;
  workspaceChanged: boolean;
}

function changedWorkspace(baseline: WorkspaceEvidence, after: WorkspaceEvidence): boolean {
  return baseline.status !== after.status;
}

export async function captureWorkspaceEvidence(
  runExec: (
    command: string,
    args: string[],
    options?: { timeout?: number },
  ) => Promise<{ stdout: string; stderr: string; code: number }>,
): Promise<WorkspaceEvidence> {
  const result = await runExec("git", ["status", "--porcelain"]);
  return { status: result.stdout };
}

export async function executeRequestEdit(
  params: { title: string; instruction: string },
  state: State,
  runExec: (
    command: string,
    args: string[],
    options?: { timeout?: number },
  ) => Promise<{ stdout: string; stderr: string; code: number }>,
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

  const response = await ctx.ui.select(`Human Handoff: ${params.title}`, [
    `Depth: ${state.depth}`,
    "Done",
    "Blocked",
    "Cancel",
    "Instruction:",
    params.instruction,
  ]);

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
