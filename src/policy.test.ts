import { describe, expect, it } from "vitest";
import {
  BUILD_MODE_TOOLS,
  buildSystemPromptForState,
  createHitsState,
  formatHitsStatus,
  getToolsForMode,
  parseDepth,
  parseMode,
  PLAN_MODE_TOOLS,
  type State,
} from "./policy.js";

describe("createHitsState", () => {
  it("defaults to plan mode and outline depth", () => {
    expect(createHitsState()).toEqual({ mode: "plan", depth: "outline" });
  });
});

describe("formatHitsStatus", () => {
  it("formats footer status text", () => {
    const state: State = { mode: "build", depth: "skeleton" };
    expect(formatHitsStatus(state)).toBe("hits - mode:build / depth:skeleton");
  });
});

describe("parseDepth", () => {
  it("parses depth values", () => {
    expect(parseDepth("sentence")).toBe("sentence");
    expect(parseDepth("full")).toBe("full");
    expect(parseDepth("tiny")).toBeUndefined();
  });
});

describe("parseMode", () => {
  it("parses mode values", () => {
    expect(parseMode("plan")).toBe("plan");
    expect(parseMode("build")).toBe("build");
    expect(parseMode("other")).toBeUndefined();
  });
});

describe("buildSystemPromptForState", () => {
  it("appends correct details for build mode", () => {
    const buildPrompt = buildSystemPromptForState({ mode: "build", depth: "paragraph" }, "base");
    expect(buildPrompt).toContain("HITS BUILD MODE");
    expect(buildPrompt).toContain("request_edit");
    expect(buildPrompt).toContain("paragraph");
  });

  it("appends correct details for plan mode", () => {
    const planPrompt = buildSystemPromptForState({ mode: "plan", depth: "outline" }, "base");
    expect(planPrompt).toContain("HITS PLAN MODE");
    expect(planPrompt).toContain("/mode build");
  });
});

describe("getToolsForMode", () => {
  it("selects tools by mode and installed tools", () => {
    expect(getToolsForMode("plan", ["read", "grep", "find", "ls", "bash"])).toEqual([
      ...PLAN_MODE_TOOLS,
    ]);
    expect(getToolsForMode("build", ["read", "grep", "find", "ls", "bash"])).toEqual([
      "read",
      "grep",
      "find",
      "ls",
      "bash",
    ]);
    expect(
      getToolsForMode("build", ["read", "grep", "find", "ls", "bash", "request_edit"]),
    ).toEqual([...BUILD_MODE_TOOLS]);
  });
});
