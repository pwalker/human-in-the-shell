import type { ExtensionContext, ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  buildSystemPromptForState,
  formatHitsStatus,
  getToolsForMode,
  parseDepth,
  parseMode,
  type State,
} from "./policy.js";
import { executeApprovedBash } from "./approved-bash.js";
import { executeRequestEdit } from "./handoff.js";

function applyStatus(ctx: ExtensionContext, state: State): void {
  ctx.ui.setStatus("hits", formatHitsStatus(state));
}

export function createHitsExtension(state: State): ExtensionFactory {
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
