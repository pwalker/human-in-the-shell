import { describe, expect, it } from "vitest";
import { createHitsExtension } from "./extension.js";
import { type State } from "./policy.js";

type Ctx = {
  hasUI: boolean;
  ui: {
    setStatus: (key: string, text: string | undefined) => void;
    notify: (message: string, type?: string) => void;
    confirm: (title: string, message: string) => Promise<boolean>;
    select: (title: string, options: string[]) => Promise<string | undefined>;
  };
  exec: (
    command: string,
    args: string[],
    options?: { timeout?: number },
  ) => Promise<{ stdout: string; stderr: string; code: number }>;
};

describe("createHitsExtension", () => {
  it("registers handlers, commands, and tools with expected behavior", async () => {
    const state: State = { mode: "plan", depth: "outline" };
    const extension = createHitsExtension(state);

    const handlers = new Map<string, (event: unknown, ctx: Ctx) => unknown>();
    const commands = new Map<string, (args: string, ctx: Ctx) => Promise<void>>();
    const tools = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    const activeTools: string[][] = [];
    let ctx: Ctx;

    const fakeApi = {
      on: (event: string, handler: (event: unknown, ctx: Ctx) => unknown) =>
        handlers.set(event, handler),
      registerCommand: (
        name: string,
        options: { handler: (args: string, ctx: Ctx) => Promise<void> },
      ) => {
        commands.set(name, options.handler);
      },
      registerTool: (tool: { name: string; execute: (...args: unknown[]) => Promise<unknown> }) => {
        tools.set(tool.name, tool.execute);
      },
      getAllTools: () =>
        ["read", "grep", "find", "ls", "bash", "request_edit"].map((name) => ({ name })),
      setActiveTools: (names: string[]) => activeTools.push(names),
      exec: (command: string, args: string[], options?: { timeout?: number }) =>
        ctx.exec(command, args, options),
    };

    extension(fakeApi as never);

    const statuses: Array<{ key: string; text: string | undefined }> = [];
    const notices: string[] = [];
    const confirmCalls: string[] = [];
    const selectCalls: string[] = [];
    const execCalls: string[] = [];

    let statusText = " M file.ts\n";
    ctx = {
      hasUI: true,
      ui: {
        setStatus: (key, text) => statuses.push({ key, text }),
        notify: (message) => notices.push(message),
        confirm: async (_title, message) => {
          confirmCalls.push(message);
          return true;
        },
        select: async (_title, options) => {
          selectCalls.push(options.join("|"));
          return "Done";
        },
      },
      exec: async (command, args, options) => {
        execCalls.push(`${command} ${args.join(" ")} ${options?.timeout ?? ""}`.trim());
        if (command === "git") {
          const current = statusText;
          statusText = " M file.ts\n M other.ts\n";
          return { stdout: current, stderr: "", code: 0 };
        }
        return { stdout: "ok", stderr: "", code: 0 };
      },
    };

    await handlers.get("session_start")?.({}, ctx);
    await commands.get("mode")?.("build", ctx);
    await commands.get("depth")?.("paragraph", ctx);
    const promptResult = handlers.get("before_agent_start")?.({ systemPrompt: "base" }, ctx) as {
      systemPrompt: string;
    };

    const bashResult = (await tools.get("bash")?.(
      "id",
      { command: "pwd", timeout: 2000 },
      undefined,
      undefined,
      ctx,
    )) as {
      details: { approved: boolean };
    };
    const requestEditResult = (await tools.get("request_edit")?.(
      "id",
      { title: "Patch", instruction: "Update src" },
      undefined,
      undefined,
      ctx,
    )) as {
      details: { handoffResponse: string; workspaceChanged: boolean; after?: { status: string } };
    };

    expect(activeTools).toEqual([
      ["read", "grep", "find", "ls", "bash"],
      ["read", "grep", "find", "ls", "bash", "request_edit"],
    ]);
    expect(statuses.at(-1)).toEqual({ key: "hits", text: "HITS build / paragraph" });
    expect(promptResult.systemPrompt).toContain("HITS BUILD MODE");
    expect(confirmCalls).toEqual(["pwd"]);
    expect(bashResult.details.approved).toBe(true);
    expect(selectCalls.length).toBe(1);
    expect(requestEditResult.details.handoffResponse).toBe("done");
    expect(requestEditResult.details.workspaceChanged).toBe(true);
    expect(requestEditResult.details.after?.status).toContain("other.ts");
    expect(execCalls.some((call) => call.startsWith("git status --porcelain"))).toBe(true);
    expect(notices).toEqual([]);
  });

  it("denies request_edit when not in build mode", async () => {
    const state: State = { mode: "plan", depth: "outline" };
    const extension = createHitsExtension(state);
    const tools = new Map<string, (...args: unknown[]) => Promise<unknown>>();

    const fakeApi = {
      on: () => undefined,
      registerCommand: () => undefined,
      registerTool: (tool: { name: string; execute: (...args: unknown[]) => Promise<unknown> }) => {
        tools.set(tool.name, tool.execute);
      },
      getAllTools: () => [],
      setActiveTools: () => undefined,
      exec: async () => ({ stdout: "", stderr: "", code: 0 }),
    };
    extension(fakeApi as never);

    const result = (await tools.get("request_edit")?.(
      "id",
      { title: "Patch", instruction: "Update src" },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: {
          setStatus: () => undefined,
          notify: () => undefined,
          confirm: async () => true,
          select: async () => "Done",
        },
        exec: async () => ({ stdout: "", stderr: "", code: 0 }),
      } as Ctx,
    )) as { details: { handoffResponse: string; workspaceChanged: boolean } };

    expect(result.details.handoffResponse).toBe("cancel");
    expect(result.details.workspaceChanged).toBe(false);
  });
});
