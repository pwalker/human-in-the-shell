export type Mode = "plan" | "build";
export type Depth = "sentence" | "paragraph" | "outline" | "skeleton" | "full";

export interface State {
  mode: Mode;
  depth: Depth;
}

export const PLAN_MODE_TOOLS = ["read", "grep", "find", "ls", "bash"] as const;
export const BUILD_MODE_TOOLS = ["read", "grep", "find", "ls", "bash", "request_edit"] as const;

export function createHitsState(): State {
  return {
    mode: "plan",
    depth: "outline",
  };
}

export function formatHitsStatus(state: State): string {
  return `hits - mode:${state.mode} / depth:${state.depth}`;
}

export function parseMode(input: string): Mode | undefined {
  const value = input.trim();
  if (value === "plan" || value === "build") {
    return value;
  }
  return undefined;
}

export function parseDepth(input: string): Depth | undefined {
  const value = input.trim();
  if (
    value === "sentence" ||
    value === "paragraph" ||
    value === "outline" ||
    value === "skeleton" ||
    value === "full"
  ) {
    return value;
  }
  return undefined;
}

function buildModePrompt(depth: Depth): string {
  return [
    "HITS BUILD MODE:",
    "- Semantic code/file changes must go through request_edit.",
    "- Never use direct edit/write behavior.",
    "- Use read/grep/find/ls/bash for investigation and execution support.",
    `- Current handoff depth: ${depth}. Match request_edit.instruction detail level to this depth.`,
  ].join("\n");
}

function buildPlanPrompt(depth: Depth): string {
  return [
    "HITS PLAN MODE:",
    "- Do not request semantic file edits.",
    "- Focus on analysis, planning, and verification strategy.",
    "- Tell the user to run /mode build when they want implementation.",
    `- Current handoff depth: ${depth}.`,
  ].join("\n");
}

export function buildSystemPromptForState(state: State, basePrompt: string): string {
  const modePrompt =
    state.mode === "build" ? buildModePrompt(state.depth) : buildPlanPrompt(state.depth);
  return `${basePrompt}\n\n${modePrompt}`;
}

export function getToolsForMode(mode: Mode, availableTools: string[]): string[] {
  const available = new Set(availableTools);
  const candidates = mode === "build" ? BUILD_MODE_TOOLS : PLAN_MODE_TOOLS;
  return candidates.filter((tool) => available.has(tool));
}
