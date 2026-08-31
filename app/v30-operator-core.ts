export type OperatorRole = "guest" | "operator" | "administrator";
export type OperatorCredential = { salt: string; hash: string; iterations: number };
export type OperatorWorkspace = {
  theme: string;
  section: string;
  doNotDisturb: boolean;
  favoriteIds: string[];
  pinnedPlayers: string[];
  widgets: string[];
  widgetSizes: Record<string, string>;
  prefs: Record<string, unknown>;
  accessibility: Record<string, unknown>;
  workstations: unknown[];
  activeWorkstation: string;
  defaultWorkstation: string;
  routines: unknown[];
  trayShortcuts: unknown[];
  controlMappings: unknown[];
  customPages: unknown[];
  appDestinations: Record<string, unknown>;
  pagePeeks: unknown[];
  popupLayout: Record<string, unknown>;
};
export type OperatorStationPreference = { theme?: string; workstation?: string; updatedAt: string };
export type OperatorIdentity = {
  id: string;
  name: string;
  role: OperatorRole;
  shared: boolean;
  awayTeam: boolean;
  credential: OperatorCredential | null;
  createdAt: string;
  updatedAt: string;
  homeStationId?: string;
  stationPreferences: Record<string, OperatorStationPreference>;
  workspace: OperatorWorkspace;
};
export type EncryptedOperatorBackup = {
  schema: 1;
  kind: "lcars-encrypted-operator";
  version: "30.7";
  algorithm: "AES-256-GCM";
  iterations: number;
  salt: string;
  iv: string;
  payload: string;
};

const clean = (value: unknown, limit: number) => String(value || "").trim().slice(0, limit);
const bytesToBase64 = (value: Uint8Array) => {
  let binary = "";
  value.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
};
const base64ToBytes = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
const asObject = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const asList = (value: unknown, maximum = 256) => Array.isArray(value) ? value.slice(0, maximum) : [];
const secretProfileKey = (key: string) => {
  const compact = key.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return ["pin", "credential", "password", "secret", "token", "authorization", "authorizationcode", "voiceauthorizationcode"].includes(compact) || ["credential", "password", "secret", "token", "authorizationcode", "pin"].some((ending) => compact.endsWith(ending));
};

export const normalizeOperatorWorkspace = (value: unknown): OperatorWorkspace => {
  const source = asObject(value);
  return {
    theme: clean(source.theme || "classic", 40),
    section: clean(source.section || "overview", 80),
    doNotDisturb: Boolean(source.doNotDisturb),
    favoriteIds: asList(source.favoriteIds, 20).map((item) => clean(item, 180)).filter(Boolean),
    pinnedPlayers: asList(source.pinnedPlayers, 32).map((item) => clean(item, 180)).filter(Boolean),
    widgets: asList(source.widgets, 32).map((item) => clean(item, 96)).filter(Boolean),
    widgetSizes: asObject(source.widgetSizes) as Record<string, string>,
    prefs: asObject(source.prefs),
    accessibility: asObject(source.accessibility),
    workstations: asList(source.workstations, 64),
    activeWorkstation: clean(source.activeWorkstation, 96),
    defaultWorkstation: clean(source.defaultWorkstation, 96),
    routines: asList(source.routines, 128),
    trayShortcuts: asList(source.trayShortcuts, 64),
    controlMappings: asList(source.controlMappings, 64),
    customPages: asList(source.customPages, 12),
    appDestinations: asObject(source.appDestinations),
    pagePeeks: asList(source.pagePeeks, 16),
    popupLayout: asObject(source.popupLayout),
  };
};

export const normalizeOperatorIdentities = (value: unknown): OperatorIdentity[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.slice(0, 24).flatMap((candidate): OperatorIdentity[] => {
    const source = asObject(candidate), id = clean(source.id, 96), name = clean(source.name, 48);
    if (!id || !name || seen.has(id)) return [];
    seen.add(id);
    const role: OperatorRole = source.role === "guest" || source.role === "operator" ? source.role : "administrator";
    const credentialSource = asObject(source.credential);
    const credential = credentialSource.hash && credentialSource.salt ? {
      salt: clean(credentialSource.salt, 128), hash: clean(credentialSource.hash, 128),
      iterations: Math.max(100_000, Math.min(1_000_000, Number(credentialSource.iterations) || 210_000)),
    } : null;
    const stations = asObject(source.stationPreferences);
    const stationPreferences = Object.fromEntries(Object.entries(stations).slice(0, 32).flatMap(([stationId, preference]) => {
      const item = asObject(preference), key = clean(stationId, 96);
      if (!key) return [];
      return [[key, { theme: clean(item.theme, 40) || undefined, workstation: clean(item.workstation, 96) || undefined, updatedAt: clean(item.updatedAt, 48) || new Date().toISOString() }]];
    }));
    return [{
      id, name, role, shared: Boolean(source.shared), awayTeam: Boolean(source.awayTeam), credential,
      createdAt: clean(source.createdAt, 48) || new Date().toISOString(),
      updatedAt: clean(source.updatedAt, 48) || new Date().toISOString(),
      homeStationId: clean(source.homeStationId, 96) || undefined,
      stationPreferences,
      workspace: normalizeOperatorWorkspace(source.workspace),
    }];
  });
};

export const operatorCan = (identity: Pick<OperatorIdentity, "role" | "awayTeam"> | null, capability: "daily" | "automation" | "configuration" | "protected" | "identity" | "roaming") => {
  if (!identity) return capability === "daily";
  if (identity.awayTeam) return capability === "daily" || capability === "roaming";
  if (identity.role === "administrator") return true;
  if (identity.role === "operator") return capability === "daily" || capability === "automation" || capability === "roaming";
  return capability === "daily";
};

const backupKey = async (passphrase: string, salt: Uint8Array, iterations: number, usage: KeyUsage[]) => {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, material, { name: "AES-GCM", length: 256 }, false, usage);
};

export const encryptOperatorBackup = async (identity: OperatorIdentity, passphrase: string): Promise<EncryptedOperatorBackup> => {
  if (passphrase.length < 8) throw new Error("Encrypted profile backups require at least eight characters");
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12)), iterations = 310_000;
  const key = await backupKey(passphrase, salt, iterations, ["encrypt"]);
  const sanitized = JSON.parse(JSON.stringify({ ...identity, credential: null }, (key, value) => key && secretProfileKey(key) ? undefined : value));
  const plaintext = new TextEncoder().encode(JSON.stringify(sanitized));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext));
  return { schema: 1, kind: "lcars-encrypted-operator", version: "30.7", algorithm: "AES-256-GCM", iterations, salt: bytesToBase64(salt), iv: bytesToBase64(iv), payload: bytesToBase64(encrypted) };
};

export const decryptOperatorBackup = async (backup: unknown, passphrase: string): Promise<OperatorIdentity> => {
  const source = asObject(backup);
  if (source.kind !== "lcars-encrypted-operator" || source.algorithm !== "AES-256-GCM") throw new Error("This is not an encrypted LCARS operator backup");
  const salt = base64ToBytes(clean(source.salt, 256)), iv = base64ToBytes(clean(source.iv, 256)), payload = base64ToBytes(String(source.payload || ""));
  const key = await backupKey(passphrase, salt, Math.max(100_000, Math.min(1_000_000, Number(source.iterations) || 310_000)), ["decrypt"]);
  let decoded: unknown;
  try { decoded = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, payload))); }
  catch { throw new Error("The backup password is incorrect or the profile file was changed"); }
  const [identity] = normalizeOperatorIdentities([decoded]);
  if (!identity) throw new Error("The encrypted operator profile is invalid");
  return { ...identity, id: `${identity.id}-import-${Date.now().toString(36)}`, credential: null, updatedAt: new Date().toISOString() };
};
