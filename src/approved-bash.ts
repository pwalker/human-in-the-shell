import type { AgentToolResult, ExtensionContext } from "@earendil-works/pi-coding-agent";

export async function executeApprovedBash(
  command: string,
  timeout: number | undefined,
  runExec: (
    command: string,
    args: string[],
    options?: { timeout?: number },
  ) => Promise<{ stdout: string; stderr: string; code: number }>,
  ctx: ExtensionContext,
): Promise<
  AgentToolResult<{ command: string; approved: boolean; timeout?: number; exitCode?: number }>
> {
  if (!ctx.hasUI) {
    return {
      content: [{ type: "text", text: "Denied command: interactive approval requires UI." }],
      details:
        timeout === undefined
          ? { command, approved: false }
          : { command, approved: false, timeout },
    };
  }
  const approved = await ctx.ui.confirm("Approve bash command", command);
  if (!approved) {
    return {
      content: [{ type: "text", text: `Denied command: ${command}` }],
      details:
        timeout === undefined
          ? { command, approved: false }
          : { command, approved: false, timeout },
    };
  }

  const result = await runExec(
    "bash",
    ["-lc", command],
    timeout === undefined ? undefined : { timeout },
  );
  const output = [result.stdout, result.stderr].filter((part) => part.trim().length > 0).join("\n");
  const details =
    timeout === undefined
      ? { command, approved: true, exitCode: result.code }
      : { command, approved: true, timeout, exitCode: result.code };
  return {
    content: [{ type: "text", text: output.length > 0 ? output : "(no output)" }],
    details,
  };
}
