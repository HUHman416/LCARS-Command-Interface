export type RoutineStepKind =
  | "page"
  | "app"
  | "workstation"
  | "theme"
  | "dnd"
  | "volume"
  | "audio-device"
  | "media"
  | "system"
  | "command"
  | "prompt"
  | "wait";

export type RoutineCondition = {
  source: "bridge" | "media" | "application" | "device" | "dnd";
  operator: "available" | "unavailable" | "equals" | "not-equals";
  value?: string;
};

export type RoutineStep = {
  id: string;
  kind: RoutineStepKind;
  target: string;
  value?: string | number | boolean;
  condition?: RoutineCondition;
  delayMs?: number;
  retries?: number;
  onFailure?: "stop" | "continue";
  prompt?: string;
};

export type RoutineTrigger = {
  type: "manual" | "startup" | "time" | "app" | "device" | "battery-below" | "network" | "notice" | "media" | "station" | "interval";
  value?: string;
};

export type Routine = {
  id: string;
  name: string;
  description: string;
  folder?: string;
  color: "orange" | "gold" | "violet" | "blue" | "pink";
  enabled: boolean;
  trigger: RoutineTrigger;
  steps: RoutineStep[];
  cooldownSeconds?: number;
  maxRuntimeSeconds?: number;
  dryRunByDefault?: boolean;
};

export type ActivityEntry = {
  id: string;
  time: string;
  source: "OPERATOR" | "ROUTINE" | "SYSTEM" | "EXTENSION" | "UPDATE";
  title: string;
  detail: string;
  status: "success" | "attention" | "running" | "cancelled";
  reversible?: boolean;
};

export type TrayShortcut = {
  id: string;
  kind: "app" | "routine" | "page";
  target: string;
  label: string;
};

export type ControlMapping = {
  id: string;
  shortcut: string;
  target: string;
  label: string;
  enabled: boolean;
};

export type EngineeringProcess = {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  user?: string;
  state?: string;
  protected?: boolean;
};

export type EngineeringSensor = {
  id: string;
  name: string;
  kind: "temperature" | "fan" | "battery" | "ups" | "drive";
  value: string;
  status: "ready" | "attention" | "unavailable";
  detail?: string;
};

export type EngineeringData = {
  generated?: number;
  processes: EngineeringProcess[];
  sensors: EngineeringSensor[];
  processControl: boolean;
  serviceControl?: boolean;
  notes?: string[];
};

export type ExtensionCatalogEntry = {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  capabilities: string[];
  installed: boolean;
  bundled?: boolean;
  manifestUrl?: string;
  repository?: boolean;
  updateAvailable?: boolean;
  installedVersion?: string;
  minimumLcarsVersion?: string;
  category?: string;
  sha256?: string;
  featured?: boolean;
  lastUpdated?: string;
  sourceId?: string;
  sourceName?: string;
  official?: boolean;
  channel?: "stable" | "development";
  signatureStatus?: "signed" | "verified" | "legacy" | "local" | "bundled" | "invalid";
  signerKeyId?: string;
  rollbackAvailable?: boolean;
  grantedCapabilities?: string[];
  moduleHealth?: ModuleHealthRecord;
};

export type ModuleHealthRecord = {
  id: string;
  apiVersion: number;
  apiStatus: "stable" | "compatible" | "legacy";
  requestedCapabilities: string[];
  grantedCapabilities: string[];
  permissionLabels: Record<string,string>;
  health: "ready" | "isolated" | "attention";
  failureCount: number;
  lastFailure?: string;
  rollbackAvailable: boolean;
  signed: string;
  signerKeyId?: string;
  sourceId: string;
  bundled: boolean;
};

export type ModuleRepositorySource = {
  id: string;
  name: string;
  repositoryUrl?: string;
  catalogUrl: string;
  enabled: boolean;
  official: boolean;
  count?: number;
  error?: string;
  status?: "ready" | "attention" | "disabled";
  channel?: "stable" | "development";
};

export const v25Pages = [
  "overview",
  "terminal",
  "files",
  "system",
  "media",
  "network",
  "updates",
  "settings",
] as const;

export const defaultTrayShortcuts: TrayShortcut[] = [
  { id: "tray-network", kind: "page", target: "network", label: "NETWORK" },
  { id: "tray-media", kind: "page", target: "media", label: "MEDIA & AUDIO" },
];

export const defaultControlMappings: ControlMapping[] = [
  { id: "mapping-routines", shortcut: "CTRL+ALT+R", target: "action:routines", label: "OPERATIONS ROUTINES", enabled: true },
  { id: "mapping-comms", shortcut: "CTRL+ALT+C", target: "action:communications", label: "COMMUNICATIONS CENTER", enabled: true },
  { id: "mapping-engineering", shortcut: "CTRL+ALT+E", target: "page:system", label: "ENGINEERING CONSOLE", enabled: true },
];

const cleanText = (value: unknown, limit: number) =>
  typeof value === "string" ? value.trim().slice(0, limit) : "";

export const createV25Id = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const normalizeRoutines = (value: unknown): Routine[] => {
  if (!Array.isArray(value)) return [];
  const kinds = new Set<RoutineStepKind>([
    "page", "app", "workstation", "theme", "dnd", "volume", "audio-device",
    "media", "system", "command", "prompt", "wait",
  ]);
  const triggers = new Set(["manual", "startup", "time", "app", "device", "battery-below", "network", "notice", "media", "station", "interval"]);
  const colors = new Set(["orange", "gold", "violet", "blue", "pink"]);
  return value.slice(0, 64).flatMap((candidate): Routine[] => {
    if (!candidate || typeof candidate !== "object") return [];
    const item = candidate as Partial<Routine>;
    const id = cleanText(item.id, 64).replace(/[^a-z0-9-]/gi, "-");
    const name = cleanText(item.name, 40);
    if (!id || !name) return [];
    const trigger = item.trigger && typeof item.trigger === "object" && triggers.has(String(item.trigger.type))
      ? { type: item.trigger.type as RoutineTrigger["type"], value: cleanText(item.trigger.value, 120) || undefined }
      : { type: "manual" as const };
    const steps = Array.isArray(item.steps) ? item.steps.slice(0, 48).flatMap((candidateStep): RoutineStep[] => {
      if (!candidateStep || typeof candidateStep !== "object") return [];
      const step = candidateStep as Partial<RoutineStep>;
      if (!kinds.has(step.kind as RoutineStepKind)) return [];
      return [{
        id: cleanText(step.id, 64).replace(/[^a-z0-9-]/gi, "-") || createV25Id("step"),
        kind: step.kind as RoutineStepKind,
        target: cleanText(step.target, 512),
        value: typeof step.value === "string" || typeof step.value === "number" || typeof step.value === "boolean" ? step.value : undefined,
        condition: step.condition && typeof step.condition === "object" && ["bridge","media","application","device","dnd"].includes(String(step.condition.source)) && ["available","unavailable","equals","not-equals"].includes(String(step.condition.operator)) ? {
          source: step.condition.source as RoutineCondition["source"],
          operator: step.condition.operator as RoutineCondition["operator"],
          value: cleanText(step.condition.value,120)||undefined,
        } : undefined,
        delayMs: Math.max(0,Math.min(30000,Number(step.delayMs)||0)),
        retries: Math.max(0,Math.min(5,Number(step.retries)||0)),
        onFailure: step.onFailure==="continue"?"continue":"stop",
        prompt: cleanText(step.prompt,180)||undefined,
      }];
    }) : [];
    return [{
      id,
      name,
      description: cleanText(item.description, 160),
      folder: cleanText(item.folder,40)||"GENERAL",
      color: colors.has(String(item.color)) ? item.color as Routine["color"] : "orange",
      enabled: item.enabled !== false,
      trigger,
      steps,
      cooldownSeconds: Math.max(0,Math.min(86400,Number(item.cooldownSeconds)||0)),
      maxRuntimeSeconds: Math.max(5,Math.min(3600,Number(item.maxRuntimeSeconds)||120)),
      dryRunByDefault: Boolean(item.dryRunByDefault),
    }];
  });
};

export const normalizeTrayShortcuts = (value: unknown): TrayShortcut[] => {
  if (!Array.isArray(value)) return defaultTrayShortcuts;
  const kinds = new Set(["app", "routine", "page"]);
  const result = value.slice(0, 24).flatMap((candidate): TrayShortcut[] => {
    if (!candidate || typeof candidate !== "object") return [];
    const item = candidate as Partial<TrayShortcut>;
    if (!kinds.has(String(item.kind))) return [];
    const target = cleanText(item.target, 180), label = cleanText(item.label, 24);
    if (!target || !label) return [];
    return [{
      id: cleanText(item.id, 64).replace(/[^a-z0-9-]/gi, "-") || createV25Id("tray"),
      kind: item.kind as TrayShortcut["kind"], target, label,
    }];
  });
  return result.length ? result : defaultTrayShortcuts;
};

export const normalizeControlMappings = (value: unknown): ControlMapping[] => {
  if (!Array.isArray(value)) return defaultControlMappings;
  const result = value.slice(0, 24).flatMap((candidate): ControlMapping[] => {
    if (!candidate || typeof candidate !== "object") return [];
    const item = candidate as Partial<ControlMapping>;
    const shortcut = cleanText(item.shortcut, 48).toUpperCase().replace(/\s+/g, "");
    const target = cleanText(item.target, 180), label = cleanText(item.label, 40);
    if (!shortcut || !target || !label) return [];
    return [{ id: cleanText(item.id, 64).replace(/[^a-z0-9-]/gi, "-") || createV25Id("mapping"), shortcut, target, label, enabled: item.enabled !== false }];
  });
  return result.length ? result : defaultControlMappings;
};

export const normalizeActivity = (value: unknown): ActivityEntry[] => {
  if (!Array.isArray(value)) return [];
  const sources = new Set(["OPERATOR", "ROUTINE", "SYSTEM", "EXTENSION", "UPDATE"]);
  const statuses = new Set(["success", "attention", "running", "cancelled"]);
  return value.slice(0, 200).flatMap((candidate): ActivityEntry[] => {
    if (!candidate || typeof candidate !== "object") return [];
    const item = candidate as Partial<ActivityEntry>;
    const title = cleanText(item.title, 80), detail = cleanText(item.detail, 240);
    if (!title) return [];
    return [{
      id: cleanText(item.id, 80) || createV25Id("activity"),
      time: cleanText(item.time, 48) || new Date().toISOString(),
      source: sources.has(String(item.source)) ? item.source as ActivityEntry["source"] : "SYSTEM",
      title, detail,
      status: statuses.has(String(item.status)) ? item.status as ActivityEntry["status"] : "success",
      reversible: Boolean(item.reversible),
    }];
  });
};

export const routineNeedsConfirmation = (routine: Routine) =>
  routine.steps.some((step) => step.kind === "command" || step.kind === "system");

export const eventShortcut = (event: KeyboardEvent) => {
  const parts: string[] = [];
  if (event.ctrlKey) parts.push("CTRL");
  if (event.altKey) parts.push("ALT");
  if (event.shiftKey) parts.push("SHIFT");
  if (event.metaKey) parts.push("META");
  const key = event.code.startsWith("Key") ? event.code.slice(3) : event.code.startsWith("Digit") ? event.code.slice(5) : event.code.startsWith("Numpad") ? `NUM${event.code.slice(6)}` : event.key.toUpperCase();
  if (!["CONTROL", "ALT", "SHIFT", "META"].includes(key)) parts.push(key);
  return parts.join("+");
};
