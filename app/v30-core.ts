export type ComputerCommandSource = "operator" | "voice" | "procedure" | "trigger" | "padd";
export type ComputerRisk = "safe" | "attention" | "protected";
export type ComputerPlanStatus = "ready" | "invalid" | "running" | "completed" | "failed" | "dry-run" | "undone";
export type ComputerCommandId =
  | "navigate"
  | "launch-app"
  | "run-procedure"
  | "restore-workstation"
  | "set-theme"
  | "set-dnd"
  | "set-volume"
  | "media-control"
  | "open-center"
  | "core-action"
  | "local-command"
  | "system-action";

export type ComputerEntity = { id: string; name: string; aliases?: string[] };
export type ComputerContext = {
  pages: ComputerEntity[];
  apps: ComputerEntity[];
  procedures: ComputerEntity[];
  workstations: ComputerEntity[];
  themes: ComputerEntity[];
};

export type ComputerPlanStep = {
  id: string;
  command: ComputerCommandId;
  label: string;
  detail: string;
  target: string;
  value?: string | number | boolean;
  risk: ComputerRisk;
  reversible: boolean;
  requiresBridge?: boolean;
};

export type ComputerPlan = {
  id: string;
  input: string;
  normalized: string;
  source: ComputerCommandSource;
  createdAt: string;
  status: ComputerPlanStatus;
  valid: boolean;
  title: string;
  summary: string;
  confidence: number;
  risk: ComputerRisk;
  reversible: boolean;
  requiresConfirmation: boolean;
  steps: ComputerPlanStep[];
  errors: string[];
  suggestions: string[];
};

export type ComputerAuditEntry = {
  id: string;
  planId: string;
  time: string;
  source: ComputerCommandSource;
  input: string;
  title: string;
  detail: string;
  status: ComputerPlanStatus;
  risk: ComputerRisk;
  stepCount: number;
  reversible: boolean;
};

export type ComputerUndoSnapshot = {
  id: string;
  planId: string;
  createdAt: string;
  label: string;
  section: string;
  theme: string;
  doNotDisturb: boolean;
  volume: number;
};

export type ComputerProcedureShape = {
  steps: { kind: string }[];
};

const createId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const normalizedText = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ");

const entityText = (entity: ComputerEntity) =>
  [entity.name, entity.id, ...(entity.aliases || [])].map(normalizedText);

const entityMatch = (entities: ComputerEntity[], requested: string) => {
  const query = normalizedText(requested).replace(/^(?:the|my)\s+/, "");
  if (!query) return null;
  const exact = entities.find((entity) => entityText(entity).includes(query));
  if (exact) return { entity: exact, confidence: 1 };
  const contained = entities.find((entity) =>
    entityText(entity).some((value) => value.includes(query) || query.includes(value)),
  );
  return contained ? { entity: contained, confidence: 0.86 } : null;
};

const step = (
  command: ComputerCommandId,
  label: string,
  detail: string,
  target: string,
  risk: ComputerRisk,
  reversible: boolean,
  value?: ComputerPlanStep["value"],
  requiresBridge = false,
): ComputerPlanStep => ({
  id: createId("computer-step"), command, label, detail, target, risk,
  reversible, value, requiresBridge,
});

const centers: Record<string, { target: string; label: string }> = {
  "computer core": { target: "computer", label: "Computer Core" },
  "procedure builder": { target: "procedures", label: "Procedure Builder" },
  procedures: { target: "procedures", label: "Procedure Builder" },
  routines: { target: "procedures", label: "Procedure Builder" },
  communications: { target: "communications", label: "Communications Center" },
  notifications: { target: "communications", label: "Communications Center" },
  notices: { target: "communications", label: "Communications Center" },
  calendar: { target: "calendar", label: "LCARS Calendar" },
  displays: { target: "displays", label: "Display Routing" },
  "display routing": { target: "displays", label: "Display Routing" },
  tray: { target: "tray", label: "Tray Command Deck" },
  applications: { target: "applications", label: "Application Library" },
  apps: { target: "applications", label: "Application Library" },
};

const mediaAliases: Record<string, string> = {
  play: "play-pause", resume: "play-pause", pause: "play-pause",
  "play pause": "play-pause", toggle: "play-pause", next: "next",
  skip: "next", previous: "previous", back: "previous", stop: "stop",
};

const riskRank: Record<ComputerRisk, number> = { safe: 0, attention: 1, protected: 2 };
export const highestComputerRisk = (risks: ComputerRisk[]): ComputerRisk =>
  risks.reduce((current, candidate) => riskRank[candidate] > riskRank[current] ? candidate : current, "safe");

const interpretClause = (rawClause: string, context: ComputerContext) => {
  const clause = normalizedText(rawClause).replace(/^computer[,:]?\s*/, "");
  let match: RegExpMatchArray | null;

  match = clause.match(/^(?:run|start|execute)\s+(?:(?:the\s+)?(?:procedure|routine)\s+)?(.+)$/);
  if (match) {
    const found = entityMatch(context.procedures, match[1]);
    if (found) return { value: step("run-procedure", `Run ${found.entity.name}`, "Execute the saved multi-step procedure", found.entity.id, "attention", false), confidence: found.confidence };
  }

  match = clause.match(/^(?:restore|activate|load|switch to)\s+(?:(?:the\s+)?(?:workstation|workspace)\s+)?(.+)$/);
  if (match) {
    const found = entityMatch(context.workstations, match[1]);
    if (found) return { value: step("restore-workstation", `Restore ${found.entity.name}`, "Apply the saved workstation layout and applications", found.entity.id, "attention", false), confidence: found.confidence };
  }

  match = clause.match(/^(?:set|change|switch)(?:\s+(?:the\s+)?(?:display|interface))?\s+(?:theme\s+)?(?:to\s+)?(.+)$/);
  if (match) {
    const found = entityMatch(context.themes, match[1].replace(/\s+theme$/, ""));
    if (found) return { value: step("set-theme", `Activate ${found.entity.name}`, "Change the active Display Matrix family", found.entity.id, "safe", true), confidence: found.confidence };
  }

  match = clause.match(/^(?:set\s+)?(?:master\s+)?(?:audio|volume)(?:\s+to)?\s+(\d{1,3})(?:\s*%)?$/);
  if (match) {
    const volume = Math.max(0, Math.min(100, Number(match[1])));
    return { value: step("set-volume", `Set master audio to ${volume}%`, "Adjust the default system output volume", "master", "safe", true, volume, true), confidence: 1 };
  }

  match = clause.match(/^(enable|disable|turn on|turn off|toggle)\s+(?:do not disturb|dnd)$/);
  if (match) {
    const requested = match[1];
    const value = requested === "toggle" ? "toggle" : requested === "enable" || requested === "turn on";
    return { value: step("set-dnd", `${value === "toggle" ? "Toggle" : value ? "Enable" : "Disable"} Do Not Disturb`, "Change notification interruption policy", "dnd", "safe", true, value), confidence: 1 };
  }

  match = clause.match(/^(?:media\s+)?(play pause|play|resume|pause|next|skip|previous|back|stop)(?:\s+(?:media|playback))?$/);
  if (match) return { value: step("media-control", `Media ${mediaAliases[match[1]].toUpperCase()}`, "Control the active media session", mediaAliases[match[1]], "safe", false, undefined, true), confidence: 1 };

  match = clause.match(/^(?:open|show|go to|navigate to)\s+(.+)$/);
  if (match) {
    const requested = match[1].replace(/^the\s+/, "");
    const center = centers[requested];
    if (center) return { value: step("open-center", `Open ${center.label}`, "Present the requested LCARS command surface", center.target, "safe", true), confidence: 1 };
    const page = entityMatch(context.pages, requested.replace(/\s+(?:page|console)$/, ""));
    if (page) return { value: step("navigate", `Open ${page.entity.name}`, "Navigate the active LCARS workspace", page.entity.id, "safe", true), confidence: page.confidence };
    const app = entityMatch(context.apps, requested);
    if (app) return { value: step("launch-app", `Launch ${app.entity.name}`, "Request a native or embedded application launch", app.entity.id, "attention", false, undefined, true), confidence: app.confidence };
  }

  match = clause.match(/^(?:launch|start app|open app)\s+(.+)$/);
  if (match) {
    const app = entityMatch(context.apps, match[1]);
    if (app) return { value: step("launch-app", `Launch ${app.entity.name}`, "Request a native or embedded application launch", app.entity.id, "attention", false, undefined, true), confidence: app.confidence };
  }

  match = clause.match(/^(?:check for|check|scan for)\s+(?:software\s+)?updates?$/);
  if (match) return { value: step("core-action", "Check for updates", "Query the selected verified release channel", "check-updates", "safe", false, undefined, true), confidence: 1 };
  if (/^(?:identify|show)\s+(?:the\s+)?displays?$/.test(clause)) return { value: step("core-action", "Identify displays", "Show the operating-system display identifiers", "identify-displays", "safe", false, undefined, true), confidence: 1 };
  if (/^(?:recheck|check)\s+(?:local\s+)?integrations?$/.test(clause)) return { value: step("core-action", "Recheck integrations", "Refresh local operating-system capability probes", "integration-recheck", "safe", false, undefined, true), confidence: 1 };

  match = clause.match(/^(?:sudo\s+)?(?:sleep|suspend|restart|reboot|shut down|shutdown|power off)(?:\s+(?:the\s+)?computer)?$/);
  if (match) {
    const request = match[0];
    const action = /restart|reboot/.test(request) ? "reboot" : /sleep|suspend/.test(request) ? "sleep" : "poweroff";
    return { value: step("system-action", `${action === "reboot" ? "Restart" : action === "sleep" ? "Sleep" : "Shut down"} computer`, "Protected whole-system power operation", action, "protected", false, undefined, true), confidence: 1 };
  }

  match = clause.match(/^(?:approved\s+)?(?:local\s+)?command\s+(.+)$/);
  if (match && match[1].trim()) return { value: step("local-command", "Run approved local command", match[1].trim(), match[1].trim(), "protected", false, undefined, true), confidence: 1 };

  return null;
};

export const interpretComputerCommand = (
  input: string,
  context: ComputerContext,
  source: ComputerCommandSource = "operator",
): ComputerPlan => {
  const normalized = normalizedText(input).replace(/^computer[,:]?\s*/, "");
  const clauses = normalized.split(/\s+(?:and\s+)?then\s+|\s*;\s*|\s*&&\s*/i).filter(Boolean).slice(0, 12);
  const interpreted = clauses.map((clause) => ({ clause, result: interpretClause(clause, context) }));
  const errors = interpreted.filter((item) => !item.result).map((item) => `I could not resolve “${item.clause}”.`);
  const steps = interpreted.flatMap((item) => item.result ? [item.result.value] : []);
  const valid = Boolean(clauses.length && steps.length && !errors.length);
  const risk = highestComputerRisk(steps.map((item) => item.risk));
  const suggestions = [
    "Open Media then set volume to 40",
    "Run Evening Operations",
    "Enable Do Not Disturb",
    "Check for updates",
    "Computer, identify displays",
  ];
  return {
    id: createId("computer-plan"), input, normalized, source,
    createdAt: new Date().toISOString(), status: valid ? "ready" : "invalid", valid,
    title: valid ? (steps.length > 1 ? `MULTI-STEP PLAN · ${steps.length} ACTIONS` : steps[0].label) : "COMMAND NEEDS CLARIFICATION",
    summary: valid ? steps.map((item) => item.label).join(" → ") : errors.join(" ") || "Enter an LCARS command.",
    confidence: steps.length ? Math.min(...interpreted.flatMap((item) => item.result ? [item.result.confidence] : [0])) : 0,
    risk, reversible: valid && steps.every((item) => item.reversible),
    requiresConfirmation: steps.some((item) => item.risk === "protected"), steps, errors, suggestions,
  };
};

export const normalizeComputerAudit = (value: unknown): ComputerAuditEntry[] => {
  if (!Array.isArray(value)) return [];
  const statuses = new Set<ComputerPlanStatus>(["ready", "invalid", "running", "completed", "failed", "dry-run", "undone"]);
  const sources = new Set<ComputerCommandSource>(["operator", "voice", "procedure", "trigger", "padd"]);
  const risks = new Set<ComputerRisk>(["safe", "attention", "protected"]);
  return value.slice(0, 300).flatMap((candidate): ComputerAuditEntry[] => {
    if (!candidate || typeof candidate !== "object") return [];
    const item = candidate as Partial<ComputerAuditEntry>;
    if (!String(item.title || "").trim()) return [];
    return [{
      id: String(item.id || createId("computer-audit")).slice(0, 96),
      planId: String(item.planId || "legacy").slice(0, 96),
      time: String(item.time || new Date().toISOString()).slice(0, 48),
      source: sources.has(item.source as ComputerCommandSource) ? item.source as ComputerCommandSource : "operator",
      input: String(item.input || "").slice(0, 500), title: String(item.title).slice(0, 100),
      detail: String(item.detail || "").slice(0, 300),
      status: statuses.has(item.status as ComputerPlanStatus) ? item.status as ComputerPlanStatus : "completed",
      risk: risks.has(item.risk as ComputerRisk) ? item.risk as ComputerRisk : "safe",
      stepCount: Math.max(0, Math.min(48, Number(item.stepCount) || 0)), reversible: Boolean(item.reversible),
    }];
  });
};

export const normalizeComputerUndo = (value: unknown): ComputerUndoSnapshot | null => {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<ComputerUndoSnapshot>;
  if (!String(item.id || "").trim() || !String(item.planId || "").trim()) return null;
  return {
    id: String(item.id).slice(0, 96), planId: String(item.planId).slice(0, 96),
    createdAt: String(item.createdAt || new Date().toISOString()).slice(0, 48),
    label: String(item.label || "Computer Core plan").slice(0, 100),
    section: String(item.section || "overview").slice(0, 80),
    theme: String(item.theme || "classic").slice(0, 80),
    doNotDisturb: Boolean(item.doNotDisturb),
    volume: Math.max(0, Math.min(100, Number(item.volume) || 0)),
  };
};

export const computerProcedureRisk = (procedure: ComputerProcedureShape): ComputerRisk =>
  highestComputerRisk(procedure.steps.map((item) => item.kind === "system" || item.kind === "command" ? "protected" : item.kind === "app" || item.kind === "workstation" || item.kind === "media" || item.kind === "audio-device" ? "attention" : "safe"));

export const computerProcedureReversible = (procedure: ComputerProcedureShape) =>
  procedure.steps.length > 0 && procedure.steps.every((item) => ["page", "theme", "dnd", "volume"].includes(item.kind));
