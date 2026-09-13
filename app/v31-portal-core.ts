export const portalKinds = [
  "open-file", "save-file", "open-folder", "open-with", "authorize",
  "notification", "microphone", "camera", "screen-share", "print", "share",
] as const;

export type PortalIntentKind = typeof portalKinds[number];
export type PortalDecision = "waiting" | "approved" | "denied" | "cancelled" | "expired";
export type PortalPolicy = "ask" | "allow" | "deny";
export type PortalRequest = {
  id: string;
  kind: PortalIntentKind;
  client: string;
  title: string;
  detail: string;
  payload: Record<string, unknown>;
  decision: PortalDecision;
  createdAt: number;
  expiresAt: number;
  resolvedAt?: number | null;
  operator?: string;
  reason?: string;
  result?: { path?: string; applicationId?: string; remember?: boolean };
};
export type PortalAdapter = { id: string; name: string; available: boolean; active: boolean; detail: string };
export type PortalStatus = {
  ok: boolean;
  version: string;
  platform: string;
  pending: number;
  standardPortalEnabled: boolean;
  policies: Record<PortalIntentKind, PortalPolicy>;
  requests: PortalRequest[];
  adapters: PortalAdapter[];
  limits: { history: number; requestSeconds: number; payloadBytes: number };
};

export const protectedPortalKinds = new Set<PortalIntentKind>(["authorize", "microphone", "camera", "screen-share", "print", "share"]);

export const portalKindMeta: Record<PortalIntentKind, { label: string; detail: string; risk: "standard" | "sensitive" }> = {
  "open-file": { label: "OPEN FILE", detail: "Choose a readable item without exposing the rest of the home directory", risk: "standard" },
  "save-file": { label: "SAVE FILE", detail: "Choose an operator-approved destination and filename", risk: "standard" },
  "open-folder": { label: "OPEN FOLDER", detail: "Grant access to one selected directory", risk: "standard" },
  "open-with": { label: "OPEN WITH", detail: "Choose an installed application for a document", risk: "standard" },
  authorize: { label: "AUTHORIZATION", detail: "Review a protected action before it reaches the host", risk: "sensitive" },
  notification: { label: "NOTIFICATION", detail: "Route application notices into LCARS Communications", risk: "standard" },
  microphone: { label: "MICROPHONE", detail: "Allow temporary voice or audio capture", risk: "sensitive" },
  camera: { label: "CAMERA", detail: "Allow temporary camera capture", risk: "sensitive" },
  "screen-share": { label: "SCREEN SHARE", detail: "Allow temporary display capture", risk: "sensitive" },
  print: { label: "PRINT", detail: "Review a document before it is sent to a printer", risk: "sensitive" },
  share: { label: "SHARE", detail: "Review data before it is sent to another application or station", risk: "sensitive" },
};

export function normalizePortalStatus(value: unknown): PortalStatus | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<PortalStatus>;
  if (!raw.ok || !Array.isArray(raw.requests) || !Array.isArray(raw.adapters)) return null;
  const policies = Object.fromEntries(portalKinds.map((kind) => [kind, ["ask", "allow", "deny"].includes(raw.policies?.[kind] || "") ? raw.policies?.[kind] : "ask"])) as Record<PortalIntentKind, PortalPolicy>;
  return {
    ok: true,
    version: String(raw.version || "31.2"),
    platform: String(raw.platform || "unknown"),
    pending: Math.max(0, Number(raw.pending) || 0),
    standardPortalEnabled: Boolean(raw.standardPortalEnabled),
    policies,
    requests: raw.requests.slice(0, 100),
    adapters: raw.adapters,
    limits: raw.limits || { history: 150, requestSeconds: 120, payloadBytes: 8192 },
  };
}

export function portalRequestNeedsChoice(request: PortalRequest) {
  return request.decision === "waiting" && ["open-file", "save-file", "open-folder", "open-with"].includes(request.kind);
}
