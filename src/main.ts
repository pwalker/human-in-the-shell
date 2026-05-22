import {
  type AgentSessionRuntime,
  type CreateAgentSessionRuntimeFactory,
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
  InteractiveMode,
  SessionManager,
} from "@earendil-works/pi-coding-agent";
import { createHitsExtension, createHitsState, PLAN_MODE_TOOLS } from "./hits-extension.js";

const hitsState = createHitsState();

const createRuntime: CreateAgentSessionRuntimeFactory = async ({ cwd, sessionManager, sessionStartEvent }) => {
  const services = await createAgentSessionServices({
    cwd,
    resourceLoaderOptions: {
      extensionFactories: [createHitsExtension(hitsState)],
    },
  });
  const sessionOptions = sessionStartEvent === undefined ? {} : { sessionStartEvent };
  return {
    ...(await createAgentSessionFromServices({
      services,
      sessionManager,
      tools: [...PLAN_MODE_TOOLS],
      ...sessionOptions,
    })),
    services,
    diagnostics: services.diagnostics,
  };
};

async function bindSession(runtime: AgentSessionRuntime): Promise<void> {
  await runtime.session.bindExtensions({});
}

export async function run(): Promise<void> {
  const cwd = process.cwd();
  const runtime = await createAgentSessionRuntime(createRuntime, {
    cwd,
    agentDir: getAgentDir(),
    sessionManager: SessionManager.create(cwd),
  });

  try {
    await bindSession(runtime);
    const interactiveMode = new InteractiveMode(runtime, {});
    await interactiveMode.run();
  } finally {
    await runtime.dispose();
  }
}

await run();
