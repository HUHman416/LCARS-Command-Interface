"use client";
import { Component, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  createV25Id,
  defaultControlMappings,
  defaultTrayShortcuts,
  eventShortcut,
  normalizeActivity,
  normalizeControlMappings,
  normalizeRoutines,
  normalizeTrayShortcuts,
  routineNeedsConfirmation,
} from "./v25-core";
import type {
  ActivityEntry,
  ControlMapping,
  EngineeringData,
  ExtensionCatalogEntry,
  Routine,
  RoutineStep,
  RoutineStepKind,
  TrayShortcut,
} from "./v25-core";

declare global { interface Window { __lcarsPlayStartupSound?: (force?:boolean)=>Promise<{ok:boolean;status:string;asset?:string;output?:string;error?:string}> } }

type App = { id: string; name: string; comment: string; icon?: string };
type Player = {
  id: string;
  name: string;
  status: string;
  artist: string;
  title: string;
  album: string;
  volume: number;
  artUrl?: string;
  position?: number;
  length?: number;
  icon?: string;
};
type Stream = {
  id: string;
  name: string;
  volume: number;
  group?: string;
  advanced?: boolean;
  muted?: boolean;
  icon?: string;
  routeAvailable?: boolean;
};
type AudioDevice = {
  id: string;
  name: string;
  default: boolean;
  kind: "output" | "input";
};
type FileEntry = {
  name: string;
  path: string;
  directory: boolean;
  size: number;
  modified: number;
  hidden: boolean;
};
type Notice = {
  id: number;
  text: string;
  kind: "info" | "error";
  time: string;
  source?: string;
  priority?: "routine" | "priority" | "critical";
};
type WindowTask = {
  id: string;
  name: string;
  app: string;
  monitor: string;
  active: boolean;
  minimized: boolean;
  attention?: boolean;
  icon?: string;
};
type Display = {
  id: string;
  name: string;
  enabled: boolean;
  primary: boolean;
  geometry: string;
  source?: string;
};
type Health = Record<string, { available: boolean; detail: string; remedy?: string }>;
type DiagnosticsReport = {
  generatedUtc?: string;
  lcarsVersion?: string;
  platform?: Record<string, string>;
  inventory?: Record<string, number>;
  configuration?: Record<string, boolean>;
  health?: Health;
  privacy?: string;
};
type Drive = { id: string; name: string; size: number; type: string; filesystem: string; mountpoints: string[]; mounted: boolean; removable: boolean; parent?: string };
type TrayItem = { id: string; name: string; status: string; icon?: string };
type NetworkInterface = { id: string; name: string; kind: string; state: string; address: string; gateway: string; dns: string[]; speed: string; signal?: number; received: number; sent: number };
type NetworkInfo = { interfaces: NetworkInterface[]; diagnostics: { gateway: boolean; dns: boolean; internet: boolean; latency: number | null }; bluetooth: boolean };
type PageDensity = "compact" | "standard" | "wide";
type SpeedDialItem = `page:${string}` | `module:${string}` | `action:${string}` | `routine:${string}`;
type CustomPage = { id: string; name: string; kind: "app" | "module" | "extension"; target: string };
type ApplicationDestination = "embedded" | "native";
type SystemDetails = {
  cpu?: { logical: number; load: number[]; cores: { name: string; usage: number }[] };
  memory?: { total: number; used: number; available: number; percent: number; swapTotal: number; swapUsed: number; modules?: { bank: string; capacity: number; speed?: number; manufacturer?: string; part?: string }[] };
  graphics?: { name: string; vendor?: string; driver?: string; usage?: number; temperature?: number|null; memoryTotal?: number; memoryUsed?: number; resolution?: string }[];
  storage?: Drive[];
  kernel?: string;
};
type Compatibility = {
  distro: string;
  desktop: string;
  session: string;
  capabilities: Record<string, boolean>;
  restrictions: { feature: string; reason: string; remedy: string }[];
};
type ShellPrefs = {
  taskHover: boolean;
  hoverDelay: number;
  taskAutoHide: boolean;
  taskPinned: boolean;
  groupByMonitor: boolean;
  terminalShell: string;
  terminalDirectory: string;
  terminalFontSize: number;
  terminalCursor: string;
  terminalScrollback: number;
  confirmTerminalClose: boolean;
  terminalHistory: boolean;
  terminalTarget: string;
  notificationSeconds: number;
  voiceEnabled: boolean;
  voiceWakePhrase: boolean;
  voiceEngine: string;
  voiceModel: string;
  voiceDevice: string;
  voiceSecurity: "navigation" | "applications" | "system";
  interfaceDensity: "comfortable" | "compact" | "console";
  pageDensityScope: "global" | "per-page";
  pageDensity: PageDensity;
  pageDensities: Record<string, PageDensity>;
  startupSound: boolean;
  startupSequence: boolean;
  lockOnLaunch: boolean;
  quickBootWithoutPassword: boolean;
  trayPresentation: "rail" | "header";
  speedDial: SpeedDialItem[];
  updateChannel: "stable" | "development";
};
type WorkspaceAppState = { appId: string; display: string; name: string };
type WorkspaceProfile = {
  id: string;
  name: string;
  theme: string;
  widgets: WidgetId[];
  widgetSizes: Record<string, string>;
  favoriteIds: string[];
  section?: string;
  applications?: WorkspaceAppState[];
  volume?: number;
  outputDevice?: string;
  inputDevice?: string;
  doNotDisturb?: boolean;
  trayShortcuts?: TrayShortcut[];
  restoreApplications?: boolean;
};
type LockCredential = { salt: string; hash: string; iterations: number };
type UpdateInfo = {
  ok: boolean;
  available?: boolean;
  current?: string;
  version?: string;
  releaseUrl?: string;
  notes?: string;
  asset?: { name: string; url: string } | null;
  downloaded?: boolean;
  path?: string;
  sha256?: string;
  message?: string;
  error?: string;
  closeApp?: boolean;
  rollback?: { available: boolean; path?: string; sha256?: string; message?: string };
};
type AccessibilityPrefs = {
  fontScale: number;
  highContrast: boolean;
  reducedMotion: boolean;
  colorSafe: boolean;
  soundVolume: number;
};
type BuiltinWidgetId =
  | "system"
  | "favorites"
  | "operations"
  | "media"
  | "terminal"
  | "network"
  | "updates"
  | "routines"
  | "engineering"
  | "communications"
  | "activity";
type WidgetId = BuiltinWidgetId | `ext:${string}`;
type ExtensionManifest = {
  apiVersion: number;
  schema?: number;
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  voiceCommands?: { phrase: string; page: string; response?: string }[];
  capabilities: string[];
  settings: { key: string; type: "text"|"number"|"toggle"|"select"; label: string; description?: string; default?: unknown; options?: string[] }[];
  placements: ExtensionPlacement[];
  tickSeconds?: number;
};
type ExtensionPrimitive = { type:string;id?:string;text?:string;label?:string;action?:string;source?:string;format?:string;placeholder?:string;value?:string|number|boolean;min?:number;max?:number;items?:string[];children?:ExtensionPrimitive[] };
type ExtensionPlacement = { id:string;type:"overview"|"header"|"page"|"tray"|"panel";title:string;defaultSize?:"compact"|"standard"|"wide";ui:ExtensionPrimitive[] };
const widgetInfo: Record<BuiltinWidgetId, { name: string; description: string }> = {
  system: {
    name: "System Information",
    description: "CPU, GPU, memory and storage",
  },
  favorites: {
    name: "Favorite Applications",
    description: "Your selected application launchers",
  },
  operations: {
    name: "Operations",
    description: "Quick system status and settings",
  },
  media: {
    name: "Now Playing",
    description: "Active media sources and playback",
  },
  terminal: { name: "Terminal", description: "Quick LCARS Terminal access" },
  network: { name: "Network", description: "Connection status and controls" },
  updates: { name: "Updates", description: "Software update status" },
  routines: { name: "Operations Routines", description: "Launch safe multi-step command sequences" },
  engineering: { name: "Engineering Watch", description: "Hardware health and high-load processes" },
  communications: { name: "Communications", description: "Priority notices and local event traffic" },
  activity: { name: "Command Activity", description: "Recent LCARS operations and results" },
};
const defaultWidgets: WidgetId[] = ["system", "favorites", "operations"];
const themes = [
  ["classic", "Classic", "1701-D"],
  ["voyager", "Voyager", "74656"],
  ["nemesis", "Nemesis Blue", "2379"],
  ["picard", "Picard", "2401"],
  ["lower-decks", "Lower Decks", "75567"],
  ["padd", "PADD", "MOBILE"],
];
const fallback: App[] = [
  { id: "steam.desktop", name: "Steam", comment: "Gaming Library" },
  { id: "net.lutris.Lutris.desktop", name: "Lutris", comment: "Game Launcher" },
  {
    id: "com.heroicgameslauncher.hgl.desktop",
    name: "Heroic",
    comment: "Epic · GOG",
  },
  { id: "org.kde.dolphin.desktop", name: "Files", comment: "Home Directory" },
  { id: "org.kde.konsole.desktop", name: "Terminal", comment: "Konsole" },
  { id: "org.kde.discover.desktop", name: "Discover", comment: "Applications" },
];
const baseMeters = [
  ["CPU", 18, "SYSTEM PROCESSOR"],
  ["GPU", 31, "NVIDIA RTX 3060"],
  ["MEM", 42, "6.7 / 16.0 GB"],
  ["DISK", 68, "327 GB AVAILABLE"],
];
const nav = [
  ["overview", "01", "STATUS"],
  ["terminal", "02", "TERMINAL"],
  ["files", "03", "FILES"],
  ["system", "04", "SYSTEMS"],
  ["media", "05", "MEDIA"],
  ["network", "06", "NETWORK"],
  ["updates", "07", "UPDATES"],
  ["settings", "08", "SETTINGS"],
];
const speedDialChoices: { id: SpeedDialItem; label: string; description: string }[] = [
  { id:"page:network", label:"NETWORK", description:"Open a compact Network Page Peek" },
  { id:"page:media", label:"MEDIA", description:"Open a compact Media Page Peek" },
  { id:"page:files", label:"FILES", description:"Open a compact Files Page Peek" },
  { id:"page:terminal", label:"TERMINAL", description:"Open a compact Terminal Page Peek" },
  { id:"page:system", label:"SYSTEMS", description:"Open a compact Engineering Page Peek" },
  { id:"page:updates", label:"UPDATES", description:"Open a compact Updates Page Peek" },
  { id:"page:settings", label:"SETTINGS", description:"Open a compact Settings Page Peek" },
  { id:"module:system", label:"SYS MODULE", description:"Open System Information as a focused module" },
  { id:"module:favorites", label:"FAVORITES", description:"Open Favorite Applications as a focused module" },
  { id:"module:operations", label:"OPERATIONS", description:"Open Operations as a focused module" },
  { id:"module:media", label:"NOW PLAYING", description:"Open Now Playing as a focused module" },
  { id:"module:terminal", label:"TERM MODULE", description:"Open Terminal launcher as a focused module" },
  { id:"module:network", label:"NET MODULE", description:"Open Network as a focused module" },
  { id:"module:updates", label:"UPD MODULE", description:"Open Updates as a focused module" },
  { id:"action:dnd", label:"DND", description:"Toggle Do Not Disturb" },
  { id:"action:notices", label:"NOTICES", description:"Open notification history" },
  { id:"action:displays", label:"DISPLAYS", description:"Open monitor routing" },
  { id:"action:tasks", label:"TASKS", description:"Pin or release the Task Rail" },
  { id:"action:tray", label:"TRAY", description:"Open the desktop system tray" },
  { id:"action:routines", label:"ROUTINES", description:"Open Operations Automation" },
  { id:"action:communications", label:"COMMS", description:"Open Communications Center" },
];
const defaultPrefs: ShellPrefs = {
  taskHover: true,
  hoverDelay: 300,
  taskAutoHide: true,
  taskPinned: false,
  groupByMonitor: true,
  terminalShell: "/bin/bash",
  terminalDirectory: "~",
  terminalFontSize: 14,
  terminalCursor: "block",
  terminalScrollback: 10000,
  confirmTerminalClose: true,
  terminalHistory: false,
  terminalTarget: "current",
  notificationSeconds: 4,
  voiceEnabled: false,
  voiceWakePhrase: false,
  voiceEngine: "",
  voiceModel: "",
  voiceDevice: "",
  voiceSecurity: "navigation",
  interfaceDensity: "comfortable",
  pageDensityScope: "global",
  pageDensity: "standard",
  pageDensities: {},
  startupSound: true,
  startupSequence: true,
  lockOnLaunch: true,
  quickBootWithoutPassword: false,
  trayPresentation: "rail",
  speedDial: ["page:network","page:media","action:dnd","action:notices","action:displays"],
  updateChannel: "stable",
};
const normalizePrefs = (value: unknown): ShellPrefs => {
  const source=value&&typeof value==="object"?value as Partial<ShellPrefs>:{};
  const pageDensity:PageDensity=source.pageDensity==="compact"||source.pageDensity==="wide"?source.pageDensity:"standard";
  const pageDensities=source.pageDensities&&typeof source.pageDensities==="object"?Object.fromEntries(Object.entries(source.pageDensities).filter(([,density])=>density==="compact"||density==="standard"||density==="wide")) as Record<string,PageDensity>:{};
  const allowedSpeedDial=new Set(speedDialChoices.map((choice)=>choice.id));
  const speedDial=Array.isArray(source.speedDial)?source.speedDial.filter((item):item is SpeedDialItem=>typeof item==="string"&&(allowedSpeedDial.has(item as SpeedDialItem)||/^module:ext:[a-z0-9-]+$/i.test(item)||/^page:custom:[a-z0-9-]+$/i.test(item)||/^routine:[a-z0-9-]+$/i.test(item))).slice(0,8):defaultPrefs.speedDial;
  return {...defaultPrefs,...source,pageDensity,pageDensities,pageDensityScope:source.pageDensityScope==="per-page"?"per-page":"global",updateChannel:source.updateChannel==="development"?"development":"stable",speedDial:speedDial.length>=2?speedDial:defaultPrefs.speedDial};
};
const normalizeCustomPages = (value: unknown): CustomPage[] => Array.isArray(value) ? value.filter((item):item is CustomPage=>Boolean(item)&&typeof item==="object"&&typeof item.id==="string"&&typeof item.name==="string"&&typeof item.target==="string"&&["app","module","extension"].includes(String(item.kind))).slice(0,6).map((item)=>({...item,id:item.id.replace(/[^a-z0-9-]/gi,"-").slice(0,48),name:item.name.trim().slice(0,24)||"CUSTOM PAGE",target:item.target.slice(0,180)})) : [];
const normalizeAppDestinations = (value: unknown): Record<string,ApplicationDestination> => value&&typeof value==="object"?Object.fromEntries(Object.entries(value).filter((entry):entry is [string,ApplicationDestination]=>entry[1]==="embedded"||entry[1]==="native").slice(0,512)):{};
const embeddedPageForApp = (app: App): string | null => {
  const value=`${app.id} ${app.name} ${app.comment}`.toLowerCase();
  if(/terminal|konsole|powershell|command prompt|cmd\.exe/.test(value))return "terminal";
  if(/dolphin|nautilus|nemo|thunar|file manager|explorer/.test(value))return "files";
  if(/discover|software center|gnome-software|microsoft store|windows store/.test(value))return "updates";
  if(/system monitor|task manager|plasma-systemmonitor|resources/.test(value))return "system";
  if(/pavucontrol|volume control|audio control/.test(value))return "media";
  if(/network manager|network settings|connection editor/.test(value))return "network";
  if(/system settings|control panel/.test(value))return "settings";
  return null;
};
const defaultAccess: AccessibilityPrefs = {
  fontScale: 100,
  highContrast: false,
  reducedMotion: false,
  colorSafe: false,
  soundVolume: 40,
};
const lcarsEmblem = new URL("../desktop/icons/512x512.png", import.meta.url).href;
const encodeBytes = (value: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(value)));
const deriveLockHash = async (password: string, salt: Uint8Array, iterations = 210000) => {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return encodeBytes(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, material, 256));
};
const createLockCredential = async (password: string): Promise<LockCredential> => {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iterations = 210000;
  return { salt: encodeBytes(salt.buffer), hash: await deriveLockHash(password, salt, iterations), iterations };
};
const verifyLockCredential = async (password: string, credential: LockCredential) => {
  const salt = Uint8Array.from(atob(credential.salt), (value) => value.charCodeAt(0));
  return (await deriveLockHash(password, salt, credential.iterations)) === credential.hash;
};

type RecoverySnapshot = { id:string; created:string; reason:string; values:Record<string,string> };
const recoveryConfigKeys = [
  "lcars-theme","lcars-favorites","lcars-overview-widgets","lcars-widget-sizes","lcars-pinned-players",
  "lcars-shell-prefs","lcars-accessibility","lcars-workspaces","lcars-user-name","lcars-session-restore",
  "lcars-custom-pages","lcars-app-destinations","lcars-default-workstation","lcars-selected-player",
  "lcars-routines","lcars-activity-log","lcars-tray-shortcuts","lcars-control-mappings","lcars-disabled-extensions",
];
const readRecoveryConfig = () => Object.fromEntries(recoveryConfigKeys.flatMap((key)=>{const value=localStorage.getItem(key);return value===null?[]:[[key,value]];}));
const readRecoverySnapshots = ():RecoverySnapshot[] => {try{const value=JSON.parse(localStorage.getItem("lcars-config-snapshots")||"[]");return Array.isArray(value)?value.slice(0,5):[];}catch{return[];}};
const createRecoverySnapshot = (reason:string) => {
  const values=readRecoveryConfig(),existing=readRecoverySnapshots();
  if(existing[0]&&JSON.stringify(existing[0].values)===JSON.stringify(values))return existing;
  const snapshot:RecoverySnapshot={id:`snapshot-${Date.now()}`,created:new Date().toISOString(),reason,values};
  const snapshots=[snapshot,...existing].slice(0,5);localStorage.setItem("lcars-config-snapshots",JSON.stringify(snapshots));return snapshots;
};
const restoreRecoveryValues = (values:Record<string,string>) => {
  recoveryConfigKeys.forEach((key)=>localStorage.removeItem(key));Object.entries(values).forEach(([key,value])=>{if(recoveryConfigKeys.includes(key)&&typeof value==="string")localStorage.setItem(key,value);});
};

export default function Home() {
  const [theme, setTheme] = useState("classic"),
    [section, setSection] = useState("overview"),
    [sound, setSound] = useState(true);
  const [volume, setVolume] = useState(64),
    [audioMuted, setAudioMuted] = useState(false),
    [allOpen, setAllOpen] = useState(false),
    [editOpen, setEditOpen] = useState(false);
  const [bayApp, setBayApp] = useState<App | null>(null),
    [bayFullscreen, setBayFullscreen] = useState(false);
  const [overviewEdit, setOverviewEdit] = useState(false),
    [widgets, setWidgets] = useState<WidgetId[]>(defaultWidgets);
  const [widgetSizes, setWidgetSizes] = useState<Record<string, string>>({
      system: "wide",
      favorites: "wide",
      media: "wide",
    }),
    [dragged, setDragged] = useState<WidgetId | null>(null);
  const [players, setPlayers] = useState<Player[]>([]),
    [streams, setStreams] = useState<Stream[]>([]),
    [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [pinnedPlayers, setPinnedPlayers] = useState<string[]>([]),
    [notices, setNotices] = useState<Notice[]>([]),
    [historyOpen, setHistoryOpen] = useState(false);
  const [prefs, setPrefs] = useState<ShellPrefs>(defaultPrefs),
    [configSaved, setConfigSaved] = useState(false),
    [taskRail, setTaskRail] = useState(false),
    [taskLocked, setTaskLocked] = useState(false),
    [displayMenu, setDisplayMenu] = useState(false);
  const [tasks, setTasks] = useState<WindowTask[]>([]),
    [displays, setDisplays] = useState<Display[]>([
      {
        id: "1",
        name: "DISPLAY 1",
        enabled: true,
        primary: true,
        geometry: "1920×1080",
      },
    ]);
  const [health, setHealth] = useState<Health>({});
  const [trayItems, setTrayItems] = useState<TrayItem[]>([]),
    [trayOpen, setTrayOpen] = useState(false),
    [drives, setDrives] = useState<Drive[]>([]),
    [systemDetails, setSystemDetails] = useState<SystemDetails>({}),
    [detailOpen, setDetailOpen] = useState<string | null>(null),
    [speedDialModule,setSpeedDialModule]=useState<WidgetId|null>(null),
    [speedDialPage,setSpeedDialPage]=useState<string|null>(null),
    [speedDialPagePinned,setSpeedDialPagePinned]=useState(false);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo>({ interfaces: [], diagnostics: { gateway: false, dns: false, internet: false, latency: null }, bluetooth: false }),
    [startupVisible, setStartupVisible] = useState(true);
  const [extensions, setExtensions] = useState<ExtensionManifest[]>([]);
  const [quarantinedExtensions,setQuarantinedExtensions]=useState<string[]>([]);
  const [customPages,setCustomPages]=useState<CustomPage[]>([]),
    [appDestinations,setAppDestinations]=useState<Record<string,ApplicationDestination>>({});
  const [firstRun, setFirstRun] = useState(false),
    [setupStep, setSetupStep] = useState(0),
    hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [apps, setApps] = useState<App[]>(fallback),
    [favoriteIds, setFavoriteIds] = useState<string[]>(
      fallback.map((a) => a.id),
    ),
    [query, setQuery] = useState("");
  const [meters, setMeters] = useState(baseMeters),
    [clock, setClock] = useState<Date | null>(null),
    [bridge, setBridge] = useState(false);
  const [platform, setPlatform] = useState("NOBARA LINUX");
  const [compat, setCompat] = useState<Compatibility | null>(null),
    [compatOpen, setCompatOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false),
    [paletteQuery, setPaletteQuery] = useState(""),
    [findMode, setFindMode] = useState(false);
  const [profiles, setProfiles] = useState<WorkspaceProfile[]>([]),
    [activeProfile, setActiveProfile] = useState("");
  const [access, setAccess] = useState<AccessibilityPrefs>(defaultAccess),
    [doNotDisturb, setDoNotDisturb] = useState(false);
  const [locked, setLocked] = useState(false),
    [userName, setUserName] = useState("LCARS OPERATOR"),
    [sessionRestore, setSessionRestore] = useState(true),
    [powerOpen, setPowerOpen] = useState(false);
  const [lockCredential, setLockCredential] = useState<LockCredential | null>(null),
    [defaultWorkstation, setDefaultWorkstation] = useState("");
  const [lcarsUpdate, setLcarsUpdate] = useState<UpdateInfo | null>(null);
  const [startupAudioStatus,setStartupAudioStatus]=useState("NOT TESTED · SYSTEM DEFAULT OUTPUT");
  const [safeMode,setSafeMode]=useState(false);
  const [routines,setRoutines]=useState<Routine[]>([]),
    [routineCenterOpen,setRoutineCenterOpen]=useState(false),
    [pendingRoutine,setPendingRoutine]=useState<Routine|null>(null),
    [runningRoutine,setRunningRoutine]=useState("");
  const [activityLog,setActivityLog]=useState<ActivityEntry[]>([]),
    [trayShortcuts,setTrayShortcuts]=useState<TrayShortcut[]>(defaultTrayShortcuts),
    [controlMappings,setControlMappings]=useState<ControlMapping[]>(defaultControlMappings);
  const [engineering,setEngineering]=useState<EngineeringData>({processes:[],sensors:[],processControl:false}),
    [extensionCatalog,setExtensionCatalog]=useState<ExtensionCatalogEntry[]>([]),
    [disabledExtensions,setDisabledExtensions]=useState<string[]>([]);
  const routineTriggerGuard=useRef<Set<string>>(new Set()),workstationRestoreGuard=useRef(false);
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get(
      "section",
    );
    const safeBoot=sessionStorage.getItem("lcars-safe-mode")==="1";
    let restoredQuarantine:string[]=[];
    if(!safeBoot)try{const quarantine=JSON.parse(localStorage.getItem("lcars-extension-quarantine")||"[]");if(Array.isArray(quarantine))restoredQuarantine=quarantine.filter((item):item is string=>typeof item==="string");}catch{}
    const restore = !safeBoot && localStorage.getItem("lcars-session-restore") !== "false";
    queueMicrotask(()=>{setSafeMode(safeBoot);setQuarantinedExtensions(restoredQuarantine);setSessionRestore(restore);});
    if (requested && (nav.some((n) => n[0] === requested)||requested.startsWith("custom:"))) setSection(requested);
    else if (restore && localStorage.getItem("lcars-last-section"))
      setSection(localStorage.getItem("lcars-last-section") || "overview");
    const t = safeBoot?null:localStorage.getItem("lcars-theme"),
      f = safeBoot?null:localStorage.getItem("lcars-favorites"),
      w = safeBoot?null:localStorage.getItem("lcars-overview-widgets"),
      z = safeBoot?null:localStorage.getItem("lcars-widget-sizes"),
      p = safeBoot?null:localStorage.getItem("lcars-pinned-players"),
      s = safeBoot?null:localStorage.getItem("lcars-shell-prefs"),
      a = safeBoot?null:localStorage.getItem("lcars-accessibility"),
      pr = safeBoot?null:localStorage.getItem("lcars-workspaces"),
      u = localStorage.getItem("lcars-user-name"),
      lockData = safeBoot?null:localStorage.getItem("lcars-lock-credential"),
      customData = safeBoot?null:localStorage.getItem("lcars-custom-pages"),
      destinationData = safeBoot?null:localStorage.getItem("lcars-app-destinations"),
      routineData = safeBoot?null:localStorage.getItem("lcars-routines"),
      activityData = localStorage.getItem("lcars-activity-log"),
      noticeData = localStorage.getItem("lcars-notification-history"),
      trayShortcutData = safeBoot?null:localStorage.getItem("lcars-tray-shortcuts"),
      mappingData = safeBoot?null:localStorage.getItem("lcars-control-mappings"),
      disabledExtensionData = safeBoot?null:localStorage.getItem("lcars-disabled-extensions"),
      defaultStation = safeBoot?"":localStorage.getItem("lcars-default-workstation") || "";
    if (t) setTheme(t);
    if (f)
      try {
        setFavoriteIds(JSON.parse(f));
      } catch {}
    if (w)
      try {
        setWidgets(JSON.parse(w));
      } catch {}
    if (z)
      try {
        setWidgetSizes(JSON.parse(z));
      } catch {}
    if (p)
      try {
        setPinnedPlayers(JSON.parse(p));
      } catch {}
    let restoredPrefs = defaultPrefs;
    if (s) try { restoredPrefs = normalizePrefs(JSON.parse(s)); setPrefs(restoredPrefs); } catch {}
    if (a)
      try {
        setAccess({ ...defaultAccess, ...JSON.parse(a) });
      } catch {}
    if (pr)
      try {
        const storedProfiles: WorkspaceProfile[] = JSON.parse(pr);
        setProfiles(storedProfiles);
        const preferred = storedProfiles.find((profile) => profile.id === defaultStation);
        if (preferred) {
          setTheme(preferred.theme);setWidgets(preferred.widgets);setWidgetSizes(preferred.widgetSizes);setFavoriteIds(preferred.favoriteIds);setActiveProfile(preferred.id);
        }
      } catch {}
    if (u) setUserName(u);
    if (lockData) try { setLockCredential(JSON.parse(lockData)); } catch {}
    if (customData) try { setCustomPages(normalizeCustomPages(JSON.parse(customData))); } catch {}
    if (destinationData) try { setAppDestinations(normalizeAppDestinations(JSON.parse(destinationData))); } catch {}
    if (routineData) try { setRoutines(normalizeRoutines(JSON.parse(routineData))); } catch {}
    if (activityData) try { setActivityLog(normalizeActivity(JSON.parse(activityData))); } catch {}
    if (noticeData) try { const parsed=JSON.parse(noticeData);if(Array.isArray(parsed))setNotices(parsed.slice(0,100)); } catch {}
    if (trayShortcutData) try { setTrayShortcuts(normalizeTrayShortcuts(JSON.parse(trayShortcutData))); } catch {}
    if (mappingData) try { setControlMappings(normalizeControlMappings(JSON.parse(mappingData))); } catch {}
    if (disabledExtensionData) try { const parsed=JSON.parse(disabledExtensionData);if(Array.isArray(parsed))setDisabledExtensions(parsed.filter((item):item is string=>typeof item==="string").slice(0,128)); } catch {}
    setDefaultWorkstation(defaultStation);
    const remoteTerminal = requested === "terminal";
    if (!safeBoot && !remoteTerminal && localStorage.getItem("lcars-setup-complete") && restoredPrefs.lockOnLaunch && !(restoredPrefs.quickBootWithoutPassword && !lockData)) setLocked(true);
    if (
      !localStorage.getItem("lcars-setup-complete") &&
      !sessionStorage.getItem("lcars-setup-dismissed")
    )
      setFirstRun(true);
    setClock(new Date());
    fetch("http://127.0.0.1:8765/api/apps")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.apps)) {
          setApps(d.apps);
          setBridge(true);
        }
      })
      .catch(() => {});
    const getSystem = () =>
      fetch("http://127.0.0.1:8765/api/system")
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d.meters) && d.meters.length) setMeters(d.meters);
          if (d.platform) {
            setPlatform(d.platform);
            if (String(d.platform).includes("WINDOWS"))
              setPrefs((old) =>
                old.terminalShell === "/bin/bash"
                  ? {
                      ...old,
                      terminalShell: "powershell.exe",
                      terminalDirectory: "~",
                    }
                  : old,
              );
          }
          setBridge(true);
        })
        .catch(() => {});
    getSystem();
    fetch("http://127.0.0.1:8765/api/compat")
      .then((r) => r.json())
      .then((d) => setCompat(d))
      .catch(() => {});
    fetch("http://127.0.0.1:8765/api/audio")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.volume === "number") setVolume(d.volume);
        setAudioMuted(Boolean(d.muted));
      })
      .catch(() => {});
    fetch("http://127.0.0.1:8765/api/config")
      .then((r) => r.json())
      .then((d) => {
        if (!safeBoot&&d.shell_prefs) setPrefs(normalizePrefs(d.shell_prefs));
      })
      .catch(() => {});
    const getExtensions = () => safeBoot?Promise.resolve():
      Promise.all([
        fetch("http://127.0.0.1:8765/api/extensions").then((r) => r.json()),
        fetch("http://127.0.0.1:8765/api/extension-catalog").then((r) => r.json()).catch(()=>({catalog:[]})),
      ]).then(([installed,catalog])=>{
        setExtensions(Array.isArray(installed.extensions) ? installed.extensions : []);
        setExtensionCatalog(Array.isArray(catalog.catalog) ? catalog.catalog : []);
      }).catch(() => {});
    getExtensions();
    const getMedia = () => {
      fetch("http://127.0.0.1:8765/api/media")
        .then((r) => r.json())
        .then((d) => {
          setPlayers(d.players || []);
          setStreams(d.streams || []);
        })
        .catch(() => {});
      fetch("http://127.0.0.1:8765/api/audio-devices")
        .then((r) => r.json())
        .then((d) => setAudioDevices(d.devices || []))
        .catch(() => {});
    };
    getMedia();
    const getDesktop = () => {
      fetch("http://127.0.0.1:8765/api/windows")
        .then((r) => r.json())
        .then((d) => setTasks(d.windows || []))
        .catch(() =>
          setTasks([
            {
              id: "lcars",
              name: "LCARS Command Interface",
              app: "LCARS",
              monitor: "DISPLAY 1",
              active: true,
              minimized: false,
            },
            {
              id: "dolphin",
              name: "Home — Dolphin",
              app: "Dolphin",
              monitor: "DISPLAY 1",
              active: false,
              minimized: false,
            },
            {
              id: "steam",
              name: "Steam",
              app: "Steam",
              monitor: "DISPLAY 2",
              active: false,
              minimized: true,
              attention: true,
            },
          ]),
        );
      fetch("http://127.0.0.1:8765/api/displays")
        .then((r) => r.json())
        .then((d) => {
          if (d.displays?.length) setDisplays(d.displays);
        })
        .catch(() => {});
      fetch("http://127.0.0.1:8765/api/health-check")
        .then((r) => r.json())
        .then((d) => setHealth(d.health || {}))
        .catch(() => {});
      fetch("http://127.0.0.1:8765/api/tray").then((r) => r.json()).then((d) => setTrayItems(d.items || [])).catch(() => {});
      fetch("http://127.0.0.1:8765/api/storage").then((r) => r.json()).then((d) => setDrives(d.drives || [])).catch(() => {});
      fetch("http://127.0.0.1:8765/api/system-details").then((r) => r.json()).then(setSystemDetails).catch(() => {});
      fetch("http://127.0.0.1:8765/api/network-details").then((r) => r.json()).then(setNetworkInfo).catch(() => {});
    };
    getDesktop();
    const getEngineering=()=>fetch("http://127.0.0.1:8765/api/engineering").then((r) => r.json()).then((d)=>setEngineering({processes:Array.isArray(d.processes)?d.processes:[],sensors:Array.isArray(d.sensors)?d.sensors:[],processControl:Boolean(d.processControl),serviceControl:Boolean(d.serviceControl),notes:Array.isArray(d.notes)?d.notes:[]})).catch(() => {});
    getEngineering();
    let sound = true;
    try {
      sound = JSON.parse(localStorage.getItem("lcars-shell-prefs") || "{}").startupSound !== false;
    } catch {}
    let powered = false;
    const reportAudio=(event:Event)=>{const result=(event as CustomEvent).detail;if(result)setStartupAudioStatus(`${result.status} · ${result.output||"SYSTEM DEFAULT"}${result.error?` · ${result.error}`:""}`);};
    const power = async () => {
      if (sound && !powered) {
        const result=window.__lcarsPlayStartupSound?await window.__lcarsPlayStartupSound():await (async()=>{const asset=new URL("assets/sounds/power-up.mp3",window.location.href).href;try{const response=await fetch(asset,{cache:"no-store"});if(!response.ok)throw new Error(`Audio asset returned HTTP ${response.status}`);const blob=await response.blob();if(!blob.type.startsWith("audio/"))throw new Error(`Audio asset returned ${blob.type||"an unknown content type"}`);const objectUrl=URL.createObjectURL(blob);const a=new Audio(objectUrl);a.volume=.42;a.addEventListener("ended",()=>URL.revokeObjectURL(objectUrl),{once:true});await a.play();return{ok:true,status:"PLAYING",asset,output:"SYSTEM DEFAULT"};}catch(error){return{ok:false,status:"FAILED",error:String(error),asset,output:"SYSTEM DEFAULT"};}})();
        powered=result.ok;setStartupAudioStatus(`${result.status} · ${result.output||"SYSTEM DEFAULT"}${result.error?` · ${result.error}`:""}`);
      }
    };
    power();
    window.addEventListener("lcars-startup-audio", power);
    window.addEventListener("lcars-startup-audio-result",reportAudio);
    window.addEventListener("pointerdown", power, { once: true });
    const timer = setInterval(() => setClock(new Date()), 1000),
      systemTimer = setInterval(getSystem, 2000),
      mediaTimer = setInterval(getMedia, 3000),
      desktopTimer = setInterval(getDesktop, 1800),
      engineeringTimer = setInterval(getEngineering, 6000),
      extensionTimer = setInterval(getExtensions, 5000);
    const startupTimer=setTimeout(()=>setStartupVisible(false),4200);
    const stableTimer=setTimeout(()=>{if(!safeBoot)window.dispatchEvent(new CustomEvent("lcars-runtime-stable",{detail:readRecoveryConfig()}));},6500);
    return () => {
      clearInterval(timer);
      clearInterval(systemTimer);
      clearInterval(mediaTimer);
      clearInterval(desktopTimer);
      clearInterval(engineeringTimer);
      clearInterval(extensionTimer);
      clearTimeout(startupTimer);
      clearTimeout(stableTimer);
      window.removeEventListener("lcars-startup-audio", power);
      window.removeEventListener("lcars-startup-audio-result",reportAudio);
      window.removeEventListener("pointerdown", power);
    };
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetch(`http://127.0.0.1:8765/api/lcars-update?channel=${encodeURIComponent(prefs.updateChannel)}`)
        .then((response) => response.json())
        .then((result: UpdateInfo) => {
          if (result.ok && (result.available || result.rollback?.available)) setLcarsUpdate(result);
        })
        .catch(() => {});
    }, 9000);
    return () => window.clearTimeout(timer);
  }, [prefs.updateChannel]);
  const favorites = useMemo(
    () =>
      favoriteIds
        .map((id) => apps.find((a) => a.id === id))
        .filter(Boolean) as App[],
    [favoriteIds, apps],
  );
  useEffect(() => {
    if (sessionRestore) localStorage.setItem("lcars-last-section", section);
  }, [section, sessionRestore]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const digit=e.code.match(/^(?:Digit|Numpad)([1-8])$/)?.[1];
      if (digit && e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();setSection(nav[Number(digit)-1][0]);setPaletteOpen(false);return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setFindMode(false);
        setPaletteOpen((v) => !v);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();setFindMode(true);setPaletteQuery("");setPaletteOpen(true);
      }
      if (e.key === "Escape") setPaletteOpen(false);
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "l"
      ) {
        e.preventDefault();
        setLocked(true);
      }
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, []);
  useEffect(()=>{
    const closePeek=(event:KeyboardEvent)=>{if(event.key==="Escape"&&speedDialPage&&!speedDialPagePinned)setSpeedDialPage(null);};
    window.addEventListener("keydown",closePeek,true);return()=>window.removeEventListener("keydown",closePeek,true);
  },[speedDialPage,speedDialPagePinned]);
  const filtered = useMemo(
    () =>
      apps
        .filter((a) =>
          (a.name + " " + a.comment)
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [apps, query],
  );
  const beep = (ok = false) => {
    if (!sound) return;
    const a = new Audio(ok ? "/assets/beep2.mp3" : "/assets/beep1.mp3");
    a.volume = access.soundVolume / 100;
    a.play().catch(() => {});
  };
  const cue = (
    name: "error" | "processing" | "transfer-complete" | "transfer-failed",
  ) => {
    if (!sound) return;
    const a = new Audio(`/assets/sounds/${name}.mp3`);
    a.volume = access.soundVolume / 100;
    a.play().catch(() => {});
  };
  const recordActivity = (
    title: string,
    detail: string,
    status: ActivityEntry["status"] = "success",
    source: ActivityEntry["source"] = "OPERATOR",
    reversible = false,
  ) => {
    const entry: ActivityEntry = { id:createV25Id("activity"),time:new Date().toISOString(),source,title,detail,status,reversible };
    setActivityLog((old)=>{const next=[entry,...old].slice(0,200);localStorage.setItem("lcars-activity-log",JSON.stringify(next));return next;});
    return entry;
  };
  const saveRoutines=(next:Routine[])=>{createRecoverySnapshot("Before routine configuration change");const normalized=normalizeRoutines(next.map((routine)=>({...routine,name:routine.name.trim()||"UNTITLED ROUTINE"})));setRoutines(normalized);localStorage.setItem("lcars-routines",JSON.stringify(normalized));};
  const saveTrayShortcuts=(next:TrayShortcut[])=>{createRecoverySnapshot("Before Tray Command Deck change");const normalized=normalizeTrayShortcuts(next.map((shortcut)=>({...shortcut,label:shortcut.label.trim()||"COMMAND"})));setTrayShortcuts(normalized);localStorage.setItem("lcars-tray-shortcuts",JSON.stringify(normalized));};
  const saveControlMappings=(next:ControlMapping[])=>{createRecoverySnapshot("Before control mapping change");const normalized=normalizeControlMappings(next);setControlMappings(normalized);localStorage.setItem("lcars-control-mappings",JSON.stringify(normalized));};
  const saveDisabledExtensions=(next:string[])=>{createRecoverySnapshot("Before Extension Hub change");const normalized=Array.from(new Set(next)).slice(0,128);setDisabledExtensions(normalized);localStorage.setItem("lcars-disabled-extensions",JSON.stringify(normalized));recordActivity("Extension availability changed",normalized.length?`${normalized.length} extension(s) disabled by the operator`:"All installed extensions enabled","success","EXTENSION",true);};
  const choose = (id: string) => {
    createRecoverySnapshot("Before theme change");
    beep(true);
    setTheme(id);
    localStorage.setItem("lcars-theme", id);
    recordActivity("Display matrix changed",`Theme ${id.toUpperCase()} activated`,"success","OPERATOR",true);
  };
  const launch = (app: App, requested?: ApplicationDestination) => {
    beep(true);
    setAllOpen(false);
    const embedded=embeddedPageForApp(app),destination=requested||appDestinations[app.id]||(embedded?"embedded":"native");
    if(destination==="embedded"&&embedded){setSection(embedded);notify(`${app.name} opened in the LCARS ${embedded.toUpperCase()} workspace`);recordActivity("Application opened in LCARS",`${app.name} → ${embedded.toUpperCase()}`);return;}
    if (bridge)
      fetch("http://127.0.0.1:8765/api/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: app.id, mode: "window" }),
      })
        .then(() => {notify(app.name + " opened in a native window");recordActivity("Application launched",app.name);})
        .catch(() => notify("Unable to launch " + app.name, "error"));
    else notify("Local application launching requires the installed desktop edition", "error");
  };
  const chooseAppDestination=(app:App,destination:ApplicationDestination)=>saveAppDestinations({...appDestinations,[app.id]:destination});
  const toggleFavorite = (id: string) => {
    createRecoverySnapshot("Before favorites change");
    setFavoriteIds((old) => {
      const next = old.includes(id)
        ? old.filter((x) => x !== id)
        : old.length < 20
          ? [...old, id]
          : old;
      localStorage.setItem("lcars-favorites", JSON.stringify(next));
      return next;
    });
  };
  const setSystemVolume = () => {
    if (bridge)
      fetch("http://127.0.0.1:8765/api/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ volume }),
      }).catch(() => {});
  };
  const toggleMasterMute = () => {
    const muted = !audioMuted;
    setAudioMuted(muted);
    fetch("http://127.0.0.1:8765/api/audio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ muted }),
    })
      .then((response) => response.json())
      .then((result) => {
        if (result.ok === false) throw new Error(result.error || "Mute unavailable");
        notify(muted ? "Master audio muted" : "Master audio restored");
      })
      .catch(() => {
        setAudioMuted(!muted);
        notify("Master mute control is unavailable", "error");
      });
  };
  const notify = (
    text: string,
    kind: "info" | "error" = "info",
    playError = true,
    source = "LCARS CORE",
    priority: Notice["priority"] = kind === "error" ? "critical" : "routine",
  ) => {
    if (kind === "error" && playError) cue("error");
    const notice = {
      id: doNotDisturb ? -Date.now() : Date.now() + Math.random(),
      text,
      kind,
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      source,
      priority,
    };
    setNotices((old) => {const next=[notice, ...old].slice(0,100);localStorage.setItem("lcars-notification-history",JSON.stringify(next));return next;});
    if (!doNotDisturb)
      setTimeout(
        () =>
          setNotices((old) => {
            const next=old.map((x) =>
              x.id === notice.id ? { ...x, id: -Math.abs(x.id) } : x,
            );localStorage.setItem("lcars-notification-history",JSON.stringify(next));return next;
          }),
        Math.max(1, prefs.notificationSeconds) * 1000,
      );
  };
  const dismissNotice = (id: number) =>
    setNotices((old) => {
      const next=old.map((x) =>
        Math.abs(x.id) === Math.abs(id) ? { ...x, id: -Math.abs(x.id) } : x,
      );localStorage.setItem("lcars-notification-history",JSON.stringify(next));return next;
    });
  const clearNotices=()=>{setNotices([]);localStorage.removeItem("lcars-notification-history");recordActivity("Communications history cleared","Operator removed stored LCARS notices","success","OPERATOR");};
  const clearActivity=()=>{setActivityLog([]);localStorage.removeItem("lcars-activity-log");};
  const coreAction = (action: string) => {
    beep(true);
    if (bridge)
      fetch("http://127.0.0.1:8765/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
        .then((r) => r.json())
        .then((d) => {
          notify(
            d.message || action.toUpperCase(),
            String(d.message || "").includes("not installed")
              ? "error"
              : "info",
          );
          recordActivity("System command",`${action.toUpperCase()} · ${d.message||"COMMAND ACCEPTED"}`,String(d.message||"").includes("not installed")?"attention":"success","SYSTEM");
          if (action === "extension-scan")
            fetch("http://127.0.0.1:8765/api/extensions")
              .then((r) => r.json())
              .then((result) => setExtensions(result.extensions || []))
              .catch(() => {});
        })
        .catch(() => {notify("LOCAL CORE UNAVAILABLE", "error");recordActivity("System command failed",action.toUpperCase(),"attention","SYSTEM");});
    else {notify(action.toUpperCase());recordActivity("Demonstration command",action.toUpperCase(),"attention","SYSTEM");}
  };
  const powerAction = (action: "exit" | "sleep" | "poweroff" | "reboot") => {
    if (action === "exit") {
      setPowerOpen(false);
      window.close();
      return;
    }
    setPowerOpen(false);
    coreAction(action);
  };
  const runSpeedDial = (item: SpeedDialItem) => {
    beep(true);
    if (item.startsWith("page:")) {
      setSpeedDialPage(item.slice(5));
      return;
    }
    if(item.startsWith("module:")){setSpeedDialModule(item.slice(7) as WidgetId);return;}
    if(item.startsWith("routine:")){const routine=routines.find((candidate)=>candidate.id===item.slice(8));if(routine)setPendingRoutine(routine);else notify("The selected routine is no longer available","error");return;}
    const action=item.slice(7);
    if (action==="dnd") setDoNotDisturb((value)=>!value);
    else if (action==="notices") setHistoryOpen(true);
    else if (action==="displays") setDisplayMenu(true);
    else if (action==="tasks") { setTaskRail(true);setTaskLocked((value)=>!value); }
    else if (action==="tray") setTrayOpen(true);
    else if (action==="routines") setRoutineCenterOpen(true);
    else if (action==="communications") setHistoryOpen(true);
  };
  const runTrayShortcut=(shortcut:TrayShortcut)=>{
    if(shortcut.kind==="page")setSection(shortcut.target);
    else if(shortcut.kind==="app"){
      const app=apps.find((candidate)=>candidate.id===shortcut.target);if(app)launch(app);else notify(`${shortcut.label} is not installed`,"error");
    }else{
      const routine=routines.find((candidate)=>candidate.id===shortcut.target);if(routine)requestRoutine(routine);else notify(`${shortcut.label} routine is unavailable`,"error");
    }
    setTrayOpen(false);
  };
  const refreshApps=()=>fetch("http://127.0.0.1:8765/api/apps").then((response)=>response.json()).then((result)=>{if(Array.isArray(result.apps)){setApps(result.apps);notify(`Application inventory refreshed · ${result.apps.length} entries`);}}).catch(()=>notify("Application inventory could not be refreshed","error"));
  const saveWidgets = (next: WidgetId[]) => {
    createRecoverySnapshot("Before Overview layout change");
    setWidgets(next);
    localStorage.setItem("lcars-overview-widgets", JSON.stringify(next));
  };
  const saveCustomPages=(next:CustomPage[])=>{createRecoverySnapshot("Before sidebar page change");const normalized=normalizeCustomPages(next);setCustomPages(normalized);localStorage.setItem("lcars-custom-pages",JSON.stringify(normalized));};
  const saveAppDestinations=(next:Record<string,ApplicationDestination>)=>{createRecoverySnapshot("Before application destination change");const normalized=normalizeAppDestinations(next);setAppDestinations(normalized);localStorage.setItem("lcars-app-destinations",JSON.stringify(normalized));};
  const moveWidget = (id: WidgetId, direction: number) => {
    const index = widgets.indexOf(id);
    if (index < 0) return;
    const target = index + direction;
    if (target < 0 || target >= widgets.length) return;
    const next = [...widgets];
    [next[index], next[target]] = [next[target], next[index]];
    saveWidgets(next);
  };
  const dropWidget = (target: WidgetId) => {
    if (!dragged || dragged === target) return;
    const next = widgets.filter((x) => x !== dragged);
    next.splice(next.indexOf(target), 0, dragged);
    saveWidgets(next);
    setDragged(null);
  };
  const cycleSize = (id: WidgetId) => {
    createRecoverySnapshot("Before module size change");
    const values = ["compact", "standard", "wide"],
      current = widgetSizes[id] || "standard",
      next = values[(values.indexOf(current) + 1) % values.length];
    const sizes = { ...widgetSizes, [id]: next };
    setWidgetSizes(sizes);
    localStorage.setItem("lcars-widget-sizes", JSON.stringify(sizes));
  };
  const mediaControl = (player: string, command: string) =>
    fetch("http://127.0.0.1:8765/api/media-control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player, command }),
    }).catch(() => {});
  const streamVolume = (id: string, value: number) => {
    setStreams((old) =>
      old.map((s) => (s.id === id ? { ...s, volume: value } : s)),
    );
    fetch("http://127.0.0.1:8765/api/stream-volume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, volume: value }),
    }).catch(() => {});
  };
  const streamMute = (id: string, muted: boolean) => {
    setStreams((old) =>
      old.map((stream) => (stream.id === id ? { ...stream, muted } : stream)),
    );
    fetch("http://127.0.0.1:8765/api/stream-mute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, muted }),
    })
      .then((response) => response.json())
      .then((result) => {
        if (result.ok === false) throw new Error(result.message || "Mute unavailable");
      })
      .catch(() => {
        setStreams((old) =>
          old.map((stream) =>
            stream.id === id ? { ...stream, muted: !muted } : stream,
          ),
        );
        notify("Application mute control is unavailable", "error");
      });
  };
  const refreshMedia = () => {
    Promise.all([
      fetch("http://127.0.0.1:8765/api/media").then((response) =>
        response.json(),
      ),
      fetch("http://127.0.0.1:8765/api/audio-devices").then((response) =>
        response.json(),
      ),
      fetch("http://127.0.0.1:8765/api/audio").then((response) =>
        response.json(),
      ),
    ])
      .then(([media, devices, master]) => {
        setPlayers(media.players || []);
        setStreams(media.streams || []);
        setAudioDevices(devices.devices || []);
        if (typeof master.volume === "number") setVolume(master.volume);
        setAudioMuted(Boolean(master.muted));
        notify("Media and audio buses rescanned");
      })
      .catch(() => notify("Media rescan could not reach the local core", "error"));
  };
  const chooseAudioDevice = (id: string) =>
    fetch("http://127.0.0.1:8765/api/audio-device", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
      .then((r) => r.json())
      .then((d) => {
        setAudioDevices((old) => {
          const selected = old.find((device) => device.id === id);
          return old.map((device) =>
            selected && device.kind === selected.kind
              ? { ...device, default: device.id === id }
              : device,
          );
        });
        notify(d.message || "Audio output changed");
      })
      .catch(() => notify("Unable to change audio output", "error"));
  const savePrefs = (next = prefs) => {
    createRecoverySnapshot("Before interface settings save");
    setPrefs(next);
    localStorage.setItem("lcars-shell-prefs", JSON.stringify(next));
    fetch("http://127.0.0.1:8765/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shell_prefs: next }),
    }).catch(() => {});
    setConfigSaved(true);
    notify("Interface settings saved");
    setTimeout(() => setConfigSaved(false), 1800);
  };
  const windowAction = (id: string, action: string, display = "") =>
    fetch("http://127.0.0.1:8765/api/window-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, display }),
    })
      .then((r) => r.json())
      .then((d) => notify(d.message || "Window command sent"))
      .catch(() =>
        notify("Window control requires the local KWin link", "error"),
      );
  const displayAction = (action: string, display: Display) =>
    fetch("http://127.0.0.1:8765/api/display-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, display: display.name }),
    })
      .then((r) => r.json())
      .then((d) => {
        notify(d.message || "Display command sent");
        setDisplayMenu(false);
      })
      .catch(() => notify("Display control requires the local core", "error"));
  const refreshDisplays = () =>
    fetch("http://127.0.0.1:8765/api/displays")
      .then((r) => r.json())
      .then((d) => {
        if (d.displays?.length) setDisplays(d.displays);
        notify(`${d.displays?.length || 0} display outputs detected`);
      })
      .catch(() => notify("Unable to refresh display outputs", "error"));
  const refreshEngineering=()=>fetch("http://127.0.0.1:8765/api/engineering").then((response)=>response.json()).then((data)=>{setEngineering({processes:Array.isArray(data.processes)?data.processes:[],sensors:Array.isArray(data.sensors)?data.sensors:[],processControl:Boolean(data.processControl),serviceControl:Boolean(data.serviceControl),notes:Array.isArray(data.notes)?data.notes:[]});}).catch(()=>notify("Engineering telemetry is unavailable","error"));
  const processAction=async(pid:number,action:"terminate"|"suspend"|"resume")=>{
    try{const response=await fetch("http://127.0.0.1:8765/api/process-action",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pid,action})}),result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error||"Process control failed");notify(result.message||`Process ${action} command accepted`);recordActivity("Engineering process control",`PID ${pid} · ${action.toUpperCase()}`,"success","SYSTEM",true);window.setTimeout(refreshEngineering,500);}catch(error){const detail=error instanceof Error?error.message:"Process control failed";notify(detail,"error");recordActivity("Engineering process control",`PID ${pid} · ${detail}`,"attention","SYSTEM");}
  };
  const saveLockPassword = async (password: string) => {
    const credential = await createLockCredential(password);
    setLockCredential(credential);
    localStorage.setItem("lcars-lock-credential", JSON.stringify(credential));
  };
  const removeLockPassword = () => {
    setLockCredential(null);
    localStorage.removeItem("lcars-lock-credential");
  };
  const finishSetup = async (password = "") => {
    if (password) await saveLockPassword(password);
    localStorage.setItem("lcars-setup-complete", "1");
    setFirstRun(false);
    savePrefs(prefs);
  };
  const taskEnter = () => {
    if (!prefs.taskHover || prefs.taskPinned || taskLocked) return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setTaskRail(true), prefs.hoverDelay);
  };
  const taskLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (prefs.taskAutoHide && !prefs.taskPinned && !taskLocked)
      setTaskRail(false);
  };
  const toggleTaskLock = () => {
    setTaskLocked((old) => {
      const next = !old;
      if (next) setTaskRail(true);
      else setTaskRail(false);
      return next;
    });
  };
  const togglePinned = (id: string) => {
    createRecoverySnapshot("Before media source preference change");
    const next = pinnedPlayers.includes(id)
      ? pinnedPlayers.filter((x) => x !== id)
      : [...pinnedPlayers, id];
    setPinnedPlayers(next);
    localStorage.setItem("lcars-pinned-players", JSON.stringify(next));
  };
  const sortedPlayers = [...players].sort(
    (a, b) =>
      Number(pinnedPlayers.includes(b.id)) -
      Number(pinnedPlayers.includes(a.id)),
  );
  const saveProfiles = (next: WorkspaceProfile[]) => {
    createRecoverySnapshot("Before workstation list change");
    setProfiles(next);
    localStorage.setItem("lcars-workspaces", JSON.stringify(next));
  };
  const chooseDefaultWorkstation = (id: string) => {
    createRecoverySnapshot("Before default workstation change");
    setDefaultWorkstation(id);
    if (id) localStorage.setItem("lcars-default-workstation", id);
    else localStorage.removeItem("lcars-default-workstation");
    notify(id ? "Default workstation assigned" : "Default workstation cleared");
  };
  const createProfile = () => {
    const name = prompt("Workspace profile name")?.trim();
    if (!name) return;
    const applications:WorkspaceAppState[]=tasks.filter((task)=>!task.app.toLowerCase().includes("lcars")).flatMap((task)=>{
      const app=apps.find((candidate)=>{const haystack=`${candidate.id} ${candidate.name}`.toLowerCase(),needle=task.app.toLowerCase();return haystack.includes(needle)||needle.includes(candidate.name.toLowerCase());});
      return app?[{appId:app.id,display:task.monitor,name:app.name}]:[];
    }).filter((item,index,list)=>list.findIndex((candidate)=>candidate.appId===item.appId)===index);
    const profile = {
      id: Date.now().toString(),
      name,
      theme,
      widgets: [...widgets],
      widgetSizes: { ...widgetSizes },
      favoriteIds: [...favoriteIds],
      section,
      applications,
      volume,
      outputDevice:audioDevices.find((device)=>device.kind==="output"&&device.default)?.id,
      inputDevice:audioDevices.find((device)=>device.kind==="input"&&device.default)?.id,
      doNotDisturb,
      trayShortcuts:[...trayShortcuts],
      restoreApplications:true,
    };
    saveProfiles([...profiles, profile]);
    setActiveProfile(profile.id);
    notify(name + " workstation saved");
    recordActivity("Workstation captured",`${name} · ${applications.length} application(s) · ${widgets.length} modules`,"success","OPERATOR",true);
  };
  const applyProfile = (profile: WorkspaceProfile) => {
    createRecoverySnapshot("Before workstation profile change");
    setTheme(profile.theme);
    setWidgets(profile.widgets);
    setWidgetSizes(profile.widgetSizes);
    setFavoriteIds(profile.favoriteIds);
    if(profile.section)setSection(profile.section);
    if(typeof profile.doNotDisturb==="boolean")setDoNotDisturb(profile.doNotDisturb);
    if(profile.trayShortcuts?.length)saveTrayShortcuts(profile.trayShortcuts);
    if(typeof profile.volume==="number"){
      setVolume(profile.volume);
      fetch("http://127.0.0.1:8765/api/audio",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({volume:profile.volume})}).catch(()=>{});
    }
    [profile.outputDevice,profile.inputDevice].filter(Boolean).forEach((id)=>chooseAudioDevice(String(id)));
    setActiveProfile(profile.id);
    localStorage.setItem("lcars-theme", profile.theme);
    localStorage.setItem(
      "lcars-overview-widgets",
      JSON.stringify(profile.widgets),
    );
    localStorage.setItem(
      "lcars-widget-sizes",
      JSON.stringify(profile.widgetSizes),
    );
    localStorage.setItem(
      "lcars-favorites",
      JSON.stringify(profile.favoriteIds),
    );
    const appStates=profile.restoreApplications===false?[]:profile.applications||[];
    if(bridge&&appStates.length){
      appStates.forEach((item,index)=>window.setTimeout(()=>fetch("http://127.0.0.1:8765/api/launch",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:item.appId,mode:"window"})}).catch(()=>{}),index*180));
      window.setTimeout(()=>fetch("http://127.0.0.1:8765/api/windows").then((response)=>response.json()).then((result)=>{const live:WindowTask[]=result.windows||[];appStates.forEach((saved)=>{const app=apps.find((candidate)=>candidate.id===saved.appId),task=live.find((candidate)=>`${candidate.app} ${candidate.name}`.toLowerCase().includes((app?.name||saved.name).toLowerCase()));if(task&&saved.display)windowAction(task.id,"move",saved.display);});}).catch(()=>{}),Math.max(1800,appStates.length*220));
    }
    notify(profile.name + " workstation restored");
    recordActivity(
      "Workstation restored",
      `${profile.name} · ${appStates.length} application request(s)`,
      "success",
      "ROUTINE",
      true,
    );
  };
  const deleteProfile = (id: string) => {
    saveProfiles(profiles.filter((p) => p.id !== id));
    if (activeProfile === id) setActiveProfile("");
    if (defaultWorkstation === id) chooseDefaultWorkstation("");
  };
  const describeRoutineStep=(step:RoutineStep)=>{
    if(step.kind==="page")return `Open ${step.target.toUpperCase()}`;
    if(step.kind==="app")return `Launch ${apps.find((app)=>app.id===step.target)?.name||step.target}`;
    if(step.kind==="workstation")return `Restore ${profiles.find((profile)=>profile.id===step.target)?.name||"workstation"}`;
    if(step.kind==="theme")return `Activate ${step.target.toUpperCase()} theme`;
    if(step.kind==="dnd")return `${String(step.value??step.target)==="true"?"Enable":"Disable"} Do Not Disturb`;
    if(step.kind==="volume")return `Set master audio to ${Number(step.value??step.target)||0}%`;
    if(step.kind==="audio-device")return `Select ${audioDevices.find((device)=>device.id===step.target)?.name||step.target}`;
    if(step.kind==="media")return `Media command ${step.target}`;
    if(step.kind==="system")return `Protected system action ${step.target}`;
    if(step.kind==="command")return `Approved local command: ${step.target}`;
    return `Wait ${Math.max(0,Number(step.value??step.target)||0)} ms`;
  };
  const executeRoutine=async(routine:Routine)=>{
    if(runningRoutine)return;
    setPendingRoutine(null);setRunningRoutine(routine.id);
    recordActivity(`Routine ${routine.name}`,`${routine.steps.length} step sequence started`,"running","ROUTINE");
    try{
      for(const step of routine.steps){
        if(step.kind==="page")setSection(step.target);
        else if(step.kind==="app"){
          const app=apps.find((candidate)=>candidate.id===step.target);if(!app)throw new Error(`Application ${step.target} is not installed`);
          await fetch("http://127.0.0.1:8765/api/launch",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:app.id,mode:"window"})}).then(async(response)=>{if(!response.ok)throw new Error((await response.json()).error||`Could not launch ${app.name}`);});
        } else if(step.kind==="workstation"){
          const profile=profiles.find((candidate)=>candidate.id===step.target);if(!profile)throw new Error("Saved workstation is unavailable");applyProfile(profile);
        } else if(step.kind==="theme")choose(step.target);
        else if(step.kind==="dnd")setDoNotDisturb(String(step.value??step.target)==="true");
        else if(step.kind==="volume"){
          const next=Math.max(0,Math.min(100,Number(step.value??step.target)||0));setVolume(next);await fetch("http://127.0.0.1:8765/api/audio",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({volume:next})});
        } else if(step.kind==="audio-device")await fetch("http://127.0.0.1:8765/api/audio-device",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:step.target})});
        else if(step.kind==="media"){
          const [playerId,command]=step.target.includes("|")?step.target.split("|",2):[players[0]?.id||"",step.target];if(!playerId)throw new Error("No media player is active");await fetch("http://127.0.0.1:8765/api/media-control",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({player:playerId,command})});
        } else if(step.kind==="system"){
          const result=await fetch("http://127.0.0.1:8765/api/action",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:step.target})}).then((response)=>response.json());if(result.error)throw new Error(result.error);
        } else if(step.kind==="command"){
          const response=await fetch("http://127.0.0.1:8765/api/routine-command",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({command:step.target,approved:true})});const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error||"Approved command was rejected");
        } else await new Promise((resolve)=>window.setTimeout(resolve,Math.max(0,Math.min(30000,Number(step.value??step.target)||0))));
        await new Promise((resolve)=>window.setTimeout(resolve,90));
      }
      recordActivity(`Routine ${routine.name}`,"All steps completed successfully","success","ROUTINE",true);notify(`${routine.name} routine complete`,"info",true,"OPERATIONS AUTOMATION","priority");
    }catch(error){const detail=error instanceof Error?error.message:"Routine failed";recordActivity(`Routine ${routine.name}`,detail,"attention","ROUTINE");notify(`${routine.name}: ${detail}`,"error",true,"OPERATIONS AUTOMATION","critical");}
    finally{setRunningRoutine("");}
  };
  const requestRoutine=(routine:Routine)=>{if(!routine.enabled)return notify(`${routine.name} is disabled`,"error");setPendingRoutine(routine);};
  useEffect(()=>{
    if(!bridge||locked)return;
    const now=clock||new Date();
    routines.filter((routine)=>routine.enabled&&routine.trigger.type!=="manual").forEach((routine)=>{
      let active=false,key=`${routine.id}:${routine.trigger.type}`;
      if(routine.trigger.type==="startup"){active=true;key+=":session";}
      else if(routine.trigger.type==="time"){const minute=`${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}:${now.getMinutes()}`;active=(routine.trigger.value||"")===`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;key+=`:${minute}`;}
      else if(routine.trigger.type==="app")active=tasks.some((task)=>`${task.app} ${task.name}`.toLowerCase().includes((routine.trigger.value||"").toLowerCase()));
      else if(routine.trigger.type==="device")active=audioDevices.some((device)=>`${device.id} ${device.name}`.toLowerCase().includes((routine.trigger.value||"").toLowerCase()));
      if(!active){if(routine.trigger.type==="app"||routine.trigger.type==="device")routineTriggerGuard.current.delete(key);return;}
      if(routineTriggerGuard.current.has(key))return;routineTriggerGuard.current.add(key);
      if(routineNeedsConfirmation(routine)){notify(`${routine.name} requires operator confirmation and was not run automatically`,"info",true,"OPERATIONS AUTOMATION","priority");recordActivity(`Routine ${routine.name}`,"Automatic trigger paused because the sequence contains protected steps","attention","ROUTINE");}
      else void executeRoutine(routine);
    });
  },[bridge,locked,clock,tasks,audioDevices,routines]);
  useEffect(()=>{
    if(!bridge||locked||!sessionRestore||workstationRestoreGuard.current||!defaultWorkstation)return;
    const profile=profiles.find((candidate)=>candidate.id===defaultWorkstation);if(!profile)return;
    workstationRestoreGuard.current=true;applyProfile(profile);
  },[bridge,locked,sessionRestore,defaultWorkstation,profiles]);
  useEffect(()=>{
    const mapped=(event:KeyboardEvent)=>{
      const target=event.target as HTMLElement|null;if(target&&(target.matches("input,textarea,select")||target.isContentEditable))return;
      const shortcut=eventShortcut(event),mapping=controlMappings.find((candidate)=>candidate.enabled&&candidate.shortcut===shortcut);if(!mapping)return;
      event.preventDefault();event.stopPropagation();
      if(mapping.target.startsWith("routine:")){const routine=routines.find((candidate)=>candidate.id===mapping.target.slice(8));if(routine)requestRoutine(routine);}
      else if(mapping.target.startsWith("page:"))setSection(mapping.target.slice(5));
      else if(mapping.target==="action:routines")setRoutineCenterOpen(true);
      else if(mapping.target==="action:communications")setHistoryOpen(true);
      else if(mapping.target==="action:tray")setTrayOpen(true);
      else if(mapping.target==="action:dnd")setDoNotDisturb((value)=>!value);
    };
    window.addEventListener("keydown",mapped,true);return()=>window.removeEventListener("keydown",mapped,true);
  },[controlMappings,routines]);
  const saveAccess = (next: AccessibilityPrefs) => {
    createRecoverySnapshot("Before accessibility setting change");
    setAccess(next);
    localStorage.setItem("lcars-accessibility", JSON.stringify(next));
  };
  const exportConfig = () => {
    const data = {
      version: 25,
      theme,
      favoriteIds,
      widgets,
      widgetSizes,
      pinnedPlayers,
      prefs,
      access,
      profiles,
      userName,
      sessionRestore,
      customPages,
      appDestinations,
      routines,
      activityLog,
      trayShortcuts,
      controlMappings,
      disabledExtensions,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "lcars-interface-backup.json";
    a.click();
    URL.revokeObjectURL(url);
    notify("Configuration backup created");
  };
  const importConfig = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const d = JSON.parse(String(reader.result));
        createRecoverySnapshot("Before configuration import");
        if (d.theme) {setTheme(d.theme);localStorage.setItem("lcars-theme",d.theme);}
        if (Array.isArray(d.favoriteIds)) {
          setFavoriteIds(d.favoriteIds);
          localStorage.setItem(
            "lcars-favorites",
            JSON.stringify(d.favoriteIds),
          );
        }
        if (Array.isArray(d.widgets)) {setWidgets(d.widgets);localStorage.setItem("lcars-overview-widgets",JSON.stringify(d.widgets));}
        if (d.widgetSizes) {
          setWidgetSizes(d.widgetSizes);
          localStorage.setItem(
            "lcars-widget-sizes",
            JSON.stringify(d.widgetSizes),
          );
        }
        if (d.prefs) {
          const imported=normalizePrefs(d.prefs);setPrefs(imported);
          localStorage.setItem("lcars-shell-prefs", JSON.stringify(imported));
        }
        if (d.access) {const importedAccess={...defaultAccess,...d.access};setAccess(importedAccess);localStorage.setItem("lcars-accessibility",JSON.stringify(importedAccess));}
        if (Array.isArray(d.profiles)) {setProfiles(d.profiles);localStorage.setItem("lcars-workspaces",JSON.stringify(d.profiles));}
        if (d.userName) {
          setUserName(d.userName);
          localStorage.setItem("lcars-user-name", d.userName);
        }
        if (Array.isArray(d.customPages)) {const importedPages=normalizeCustomPages(d.customPages);setCustomPages(importedPages);localStorage.setItem("lcars-custom-pages",JSON.stringify(importedPages));}
        if (d.appDestinations&&typeof d.appDestinations==="object") {const importedDestinations=normalizeAppDestinations(d.appDestinations);setAppDestinations(importedDestinations);localStorage.setItem("lcars-app-destinations",JSON.stringify(importedDestinations));}
        if (Array.isArray(d.routines)) {const importedRoutines=normalizeRoutines(d.routines);setRoutines(importedRoutines);localStorage.setItem("lcars-routines",JSON.stringify(importedRoutines));}
        if (Array.isArray(d.activityLog)) {const importedActivity=normalizeActivity(d.activityLog);setActivityLog(importedActivity);localStorage.setItem("lcars-activity-log",JSON.stringify(importedActivity));}
        if (Array.isArray(d.trayShortcuts)) {const importedShortcuts=normalizeTrayShortcuts(d.trayShortcuts);setTrayShortcuts(importedShortcuts);localStorage.setItem("lcars-tray-shortcuts",JSON.stringify(importedShortcuts));}
        if (Array.isArray(d.controlMappings)) {const importedMappings=normalizeControlMappings(d.controlMappings);setControlMappings(importedMappings);localStorage.setItem("lcars-control-mappings",JSON.stringify(importedMappings));}
        if (Array.isArray(d.disabledExtensions)) {const importedDisabled=d.disabledExtensions.filter((item:unknown):item is string=>typeof item==="string").slice(0,128);setDisabledExtensions(importedDisabled);localStorage.setItem("lcars-disabled-extensions",JSON.stringify(importedDisabled));}
        notify("Configuration restored");
      } catch {
        notify("Configuration file could not be read", "error");
      }
    };
    reader.readAsText(file);
  };
  const paletteCommands = useMemo(
    () => [
      ...nav.map((n) => ({
        id: "page-" + n[0],
        label: "Open " + n[2],
        detail: "LCARS PAGE",
        run: () => {
          setSection(n[0]);
          setPaletteOpen(false);
        },
      })),
      ...customPages.map((custom)=>({id:"custom-"+custom.id,label:"Open "+custom.name,detail:`CUSTOM ${custom.kind.toUpperCase()} PAGE`,run:()=>{setSection("custom:"+custom.id);setPaletteOpen(false);}})),
      ...apps.map((a) => ({
        id: "app-" + a.id,
        label: "Launch " + a.name,
        detail: a.comment || "APPLICATION",
        run: () => {
          launch(a);
          setPaletteOpen(false);
        },
      })),
      ...routines.map((routine)=>({id:"routine-"+routine.id,label:"Run "+routine.name,detail:`ROUTINE · ${routine.steps.length} STEPS`,run:()=>{requestRoutine(routine);setPaletteOpen(false);}})),
      ...[
        ["Task Rail settings","hover pinned windows monitor grouping search","settings"],
        ["Voice Control settings","microphone whisper wake phrase command authority","settings"],
        ["Terminal settings","shell directory font cursor history tabs","settings"],
        ["Display Matrix settings","monitor screen display routing","settings"],
        ["Media and audio settings","player volume input microphone output device","media"],
        ["Overview modules","widgets modular resize reorder compact wide","overview"],
        ["Workspace profiles","layout profile favorites theme","settings"],
        ["Accessibility settings","contrast motion color scale sound","settings"],
        ["Storage and drives","disk usb mount unmount removable","system"],
        ["Extensions","module api plugins manifests","updates"],
        ["Operations Automation","routines workflows triggers command sequences","settings"],
        ["Engineering Console","processes sensors temperature battery hardware","system"],
        ["Communications Center","notices activity priorities event history","settings"],
        ["Tray Command Deck","system tray shortcuts applications routines pages","settings"],
        ["Speed Dial Page Peeks","pin preview overlay page shortcut","settings"],
      ].map(([label,keywords,page]) => ({ id:"find-"+label, label, detail:"FIND · "+keywords, run:()=>{setSection(page);setPaletteOpen(false);} })),
      {
        id: "lock",
        label: "Lock LCARS",
        detail: "SECURITY",
        run: () => {
          setLocked(true);
          setPaletteOpen(false);
        },
      },
      {
        id: "tasks",
        label: "Open Task Rail",
        detail: "WINDOWS",
        run: () => {
          setTaskRail(true);
          setTaskLocked(true);
          setPaletteOpen(false);
        },
      },
      {
        id: "updates",
        label: "Check for updates",
        detail: "SYSTEM",
        run: () => {
          coreAction("check-updates");
          setPaletteOpen(false);
        },
      },
      {
        id: "display",
        label: "Identify displays",
        detail: "DISPLAY MATRIX",
        run: () => {
          coreAction("identify-displays");
          setPaletteOpen(false);
        },
      },
    ],
    [apps,customPages,routines],
  );
  const filteredCommands = paletteCommands
    .filter((c) =>
      (c.label + " " + c.detail)
        .toLowerCase()
        .includes(paletteQuery.toLowerCase()),
    )
    .slice(0, 14);
  const restrictionForSection = compat?.restrictions.filter(
    (r) =>
      (section === "media" &&
        ["Audio routing", "Media controls"].includes(r.feature)) ||
      (section === "settings" && r.feature === "LCARS Shell Mode") ||
      (["overview", "system"].includes(section) && false) ||
      (section === "terminal" && false),
  );
  const extensionFor = (id: WidgetId) =>
    id.startsWith("ext:")
      ? extensions.find((extension) => `ext:${extension.id}` === id&&!quarantinedExtensions.includes(extension.id)&&!disabledExtensions.includes(extension.id))
      : undefined;
  const recordExtensionFailure=(id:string)=>{const key=`lcars-extension-failures:${id}`,failures=Number(localStorage.getItem(key)||"0")+1;localStorage.setItem(key,String(failures));if(failures>=2){setQuarantinedExtensions((old)=>{const next=old.includes(id)?old:[...old,id];localStorage.setItem("lcars-extension-quarantine",JSON.stringify(next));return next;});notify(`Extension ${id} was quarantined after repeated render failures`,"error");}};
  const clearExtensionQuarantine=()=>{quarantinedExtensions.forEach((id)=>localStorage.removeItem(`lcars-extension-failures:${id}`));localStorage.removeItem("lcars-extension-quarantine");setQuarantinedExtensions([]);notify("Extension quarantine cleared; modules will be retried");};
  const activePageDensity:PageDensity=prefs.pageDensityScope==="per-page"?(prefs.pageDensities[section]||prefs.pageDensity):prefs.pageDensity;
  const widgetMeta = (id: WidgetId) => {
    const extension = extensionFor(id);
    if (extension)
      return { name: extension.name, description: extension.description };
    if (id.startsWith("ext:"))
      return { name: "Extension unavailable", description: "Rescan extensions or reinstall this module" };
    return widgetInfo[id as BuiltinWidgetId];
  };
  const renderWidget = (id: WidgetId) => {
    if (id.startsWith("ext:")) {
      const extension = extensionFor(id);
      return extension ? (
        <ExtensionBoundary id={extension.id} name={extension.name} onFailure={recordExtensionFailure}>{extension.apiVersion===1?<ChecklistExtension extension={extension} />:<DeclarativeExtension extension={extension} placement={extension.placements.find((placement)=>placement.type==="overview")||extension.placements[0]} />}</ExtensionBoundary>
      ) : (
        <section className="overview-widget extension-widget">
          <h3>EXTENSION OFFLINE <small>MODULE API</small></h3>
          <p className="extension-empty">The module manifest is missing. Rescan Extensions from Updates or remove this module while editing.</p>
        </section>
      );
    }
    if (id === "system")
      return (
        <section className="overview-widget wide-widget">
          <h3>
            SYSTEM INFORMATION <small>SYS-01</small>
          </h3>
          <div className="meters">
            {meters.map((m, i) => (
              <article key={String(m[0])} role="button" tabIndex={0} onClick={() => setDetailOpen(String(m[0]))} onKeyDown={(e) => e.key === "Enter" && setDetailOpen(String(m[0]))}>
                <header>
                  <span>
                    0{i + 1} / {m[0]}
                  </span>
                  <strong>{m[1]}%</strong>
                </header>
                <div>
                  <i style={{ width: m[1] + "%" }} />
                </div>
                <small>{m[2]}</small>
              </article>
            ))}
          </div>
          <div className="hardware-glance">
            <span><small>MEMORY AVAILABLE</small><b>{formatBytes(systemDetails.memory?.available||0)}</b></span>
            <span><small>GRAPHICS ADAPTERS</small><b>{systemDetails.graphics?.length||0}</b></span>
            <span><small>GPU MEMORY</small><b>{formatBytes(systemDetails.graphics?.reduce((total,item)=>total+(item.memoryTotal||0),0)||0)}</b></span>
          </div>
        </section>
      );
    if (id === "favorites")
      return (
        <section className="overview-widget wide-widget">
          <h3>
            FAVORITE APPLICATIONS <small>APP-02</small>
          </h3>
          <div className="apps">
            {favorites.slice(0, 20).map((a, i) => {const embedded=embeddedPageForApp(a),destination=appDestinations[a.id]||(embedded?"embedded":"native");return (
              <article className="favorite-app" key={a.id}><button className="app-launch-button" title={embedded?"Click for the selected destination · Shift+Click for a native window":"Open native application window"} onClick={(event) => launch(a,event.shiftKey?"native":undefined)}>
                <i className={"c" + i}>{a.icon ? <img src={a.icon} alt="" /> : a.name.slice(0, 2).toUpperCase()}</i>
                <span><b>{a.name}</b><small>{a.comment || "APPLICATION"}</small></span>
              </button>{embedded?<button className="app-destination-toggle" onClick={()=>chooseAppDestination(a,destination==="embedded"?"native":"embedded")} title="Choose the normal-click destination">{destination==="embedded"?"LCARS":"WINDOW"}</button>:<small className="native-only">NATIVE</small>}</article>
            );})}
            <button className="all-apps" onClick={() => setAllOpen(true)}>
              <i>•••</i>
              <span>
                <b>All Applications</b>
                <small>SEARCH INSTALLED SOFTWARE</small>
              </span>
            </button>
          </div>
        </section>
      );
    if (id === "operations")
      return (
        <section className="overview-widget">
          <h3>
            OPERATIONS <small>OPS-03</small>
          </h3>
          <div className="mini-status">
            <p>
              <span>● Network</span>
              <b>CONNECTED</b>
            </p>
            <p>
              <span>● Audio</span>
              <b>{volume}%</b>
            </p>
            <p>
              <span>● Updates</span>
              <b>READY</b>
            </p>
          </div>
        </section>
      );
    if(id==="routines")return <section className="overview-widget v25-widget routine-widget"><h3>OPERATIONS ROUTINES <small>AUTO-25</small></h3><div className="v25-widget-list">{routines.filter((routine)=>routine.enabled).slice(0,4).map((routine)=><button key={routine.id} onClick={()=>requestRoutine(routine)}><i>▶</i><span><b>{routine.name}</b><small>{routine.steps.length} STEPS · {routine.trigger.type.toUpperCase()}</small></span></button>)}{!routines.length&&<p>NO ROUTINES CONFIGURED</p>}</div><button className="widget-launch" onClick={()=>setRoutineCenterOpen(true)}>OPEN AUTOMATION CENTER</button></section>;
    if(id==="engineering")return <section className="overview-widget v25-widget engineering-widget"><h3>ENGINEERING WATCH <small>ENG-25</small></h3><div className="engineering-glance">{engineering.sensors.filter((sensor)=>sensor.status!=="unavailable").slice(0,4).map((sensor)=><span key={sensor.id}><small>{sensor.name}</small><b>{sensor.value}</b></span>)}</div><div className="v25-widget-list">{engineering.processes.slice(0,3).map((process)=><span key={process.pid}><b>{process.name}</b><small>CPU {process.cpu.toFixed(1)}% · MEM {process.memory.toFixed(1)}%</small></span>)}</div><button className="widget-launch" onClick={()=>setSection("system")}>OPEN ENGINEERING CONSOLE</button></section>;
    if(id==="communications")return <section className="overview-widget v25-widget communications-widget"><h3>COMMUNICATIONS <small>COM-25</small></h3><div className="v25-widget-list">{notices.slice(0,4).map((notice)=><span key={Math.abs(notice.id)}><b>{notice.source||"LCARS CORE"}</b><small>{notice.text}</small></span>)}{!notices.length&&<p>NO COMMUNICATION TRAFFIC</p>}</div><button className="widget-launch" onClick={()=>setHistoryOpen(true)}>OPEN COMMUNICATIONS CENTER</button></section>;
    if(id==="activity")return <section className="overview-widget v25-widget activity-widget"><h3>COMMAND ACTIVITY <small>LOG-25</small></h3><div className="v25-widget-list">{activityLog.slice(0,4).map((entry)=><span key={entry.id}><b>{entry.title}</b><small>{entry.source} · {entry.status.toUpperCase()}</small></span>)}{!activityLog.length&&<p>NO COMMANDS RECORDED</p>}</div><button className="widget-launch" onClick={()=>setHistoryOpen(true)}>OPEN ACTIVITY LOG</button></section>;
    if (id === "media")
      return (
        <section className="overview-widget wide-widget">
          <h3>
            NOW PLAYING <small>MPRIS</small>
          </h3>
          {compat?.capabilities?.media === false ? (
            <div className="module-restriction">
              <b>MEDIA LINK RESTRICTED</b>
              <small>
                playerctl is missing. Install it with your distribution package
                manager to enable playback sources.
              </small>
            </div>
          ) : (
            <MediaSources
              players={sortedPlayers}
              pinned={pinnedPlayers}
              togglePinned={togglePinned}
              compact
              control={mediaControl}
            />
          )}
        </section>
      );
    if (id === "terminal")
      return (
        <section className="overview-widget">
          <h3>
            TERMINAL <small>PTY-04</small>
          </h3>
          <button
            className="widget-launch"
            onClick={() => setSection("terminal")}
          >
            OPEN EMBEDDED TERMINAL <b>›</b>
          </button>
        </section>
      );
    if (id === "network")
      return (
        <section className="overview-widget">
          <h3>
            NETWORK <small>NET-05</small>
          </h3>
          <div className="mini-status">
            <p>
              <span>● Ethernet</span>
              <b>CONNECTED</b>
            </p>
            <p>
              <span>● Bluetooth</span>
              <b>ACTIVE</b>
            </p>
          </div>
          <button
            className="widget-launch"
            onClick={() => setSection("network")}
          >
            OPEN CONTROLS
          </button>
        </section>
      );
    return (
      <section className="overview-widget">
        <h3>
          UPDATES <small>DNF-06</small>
        </h3>
        <div className="mini-status">
          <p>
            <span>● Package system</span>
            <b>SCAN READY</b>
          </p>
        </div>
        <button className="widget-launch" onClick={() => setSection("updates")}>
          CHECK SOFTWARE
        </button>
      </section>
    );
  };
  const activeCustomPage=section.startsWith("custom:")?customPages.find((page)=>page.id===section.slice(7)):undefined;
  const renderCustomPage=()=>{
    if(!activeCustomPage)return <section className="detail-view custom-page-missing"><h3>CUSTOM PAGE UNAVAILABLE</h3><p>This sidebar destination was removed or its source is no longer installed.</p><button onClick={()=>setSection("settings")}>OPEN PAGE CONFIGURATION</button></section>;
    if(activeCustomPage.kind==="module")return <section className="detail-view custom-page-view"><header className="custom-page-cap"><small>USER-ASSIGNED MODULE</small><h3>{activeCustomPage.name}</h3></header><div className="custom-module-host">{renderWidget(activeCustomPage.target as WidgetId)}</div></section>;
    if(activeCustomPage.kind==="extension"){
      const [extensionId,placementId]=activeCustomPage.target.split("::"),extension=extensions.find((item)=>item.id===extensionId),placement=extension?.placements.find((item)=>item.id===placementId);
      return <section className="detail-view custom-page-view"><header className="custom-page-cap"><small>LCARS EXTENSION PAGE</small><h3>{activeCustomPage.name}</h3></header>{extension&&!quarantinedExtensions.includes(extension.id)&&!disabledExtensions.includes(extension.id)?<ExtensionBoundary id={extension.id} name={extension.name} onFailure={recordExtensionFailure}>{extension.apiVersion===1?<ChecklistExtension extension={extension}/>:placement?<DeclarativeExtension extension={extension} placement={placement}/>:<p>THE SELECTED EXTENSION PLACEMENT IS NO LONGER AVAILABLE</p>}</ExtensionBoundary>:<p>EXTENSION OFFLINE, DISABLED, OR QUARANTINED · REVIEW THE EXTENSION HUB</p>}</section>;
    }
    const app=apps.find((item)=>item.id===activeCustomPage.target);
    return <CustomApplicationPage page={activeCustomPage} app={app} embedded={app?embeddedPageForApp(app):null} launch={()=>app&&launch(app)} navigate={setSection}/>;
  };
  const detachedParams=typeof window!=="undefined"?new URLSearchParams(window.location.search):null;
  if(detachedParams?.get("tool")==="document"&&detachedParams.get("path"))return <DocumentWorkspace path={detachedParams.get("path")||""} detached close={()=>window.close()} notify={notify}/>;
  return (
    <main
      style={{ fontSize: access.fontScale + "%" }}
      className={
        "lcars theme-" +
        theme +
        (overviewEdit && section === "overview" ? " overview-editing" : "") +
        (access.highContrast ? " accessibility-contrast" : "") +
        (access.reducedMotion ? " reduced-motion" : "") +
        (access.colorSafe ? " color-safe" : "") + (safeMode ? " safe-mode" : "") + " density-" + prefs.interfaceDensity + " page-density-" + activePageDensity
      }
    >
      <header className="top">
        <button className="brand" onClick={() => setSection("overview")}>
          <span>LCARS</span>
          <small>26</small>
        </button>
        <div className="title">
          <small>FEDERATION OPERATING ENVIRONMENT</small>
          <h1>
            {platform.includes("WINDOWS") ? "WINDOWS" : "LINUX"} COMMAND
            INTERFACE
          </h1>
        </div>
        {extensions.filter((extension)=>!quarantinedExtensions.includes(extension.id)&&!disabledExtensions.includes(extension.id)).flatMap((extension)=>extension.placements.filter((placement)=>placement.type==="header").map((placement)=><ExtensionBoundary key={`${extension.id}:${placement.id}`} id={extension.id} name={extension.name} onFailure={recordExtensionFailure}><ExtensionHeader extension={extension} placement={placement} now={clock||new Date()}/></ExtensionBoundary>))}
        <div className="clock">
          <b>
            {clock
              ? clock.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "--:--"}
          </b>
          <small>{bridge ? "LOCAL CORE ONLINE" : "DEMO CORE"}</small>
        </div>
        <button className="command-button" onClick={() => setPaletteOpen(true)}>
          COMMAND ⌘K
        </button>
        <button
          className="audio notice-button"
          onClick={() => setHistoryOpen(!historyOpen)}
        >
          {notices.length
            ? "NOTICES " + notices.length
            : sound
              ? "AUDIO 04"
              : "MUTED"}
        </button>
      </header>
      {safeMode&&<button className="safe-mode-banner" onClick={()=>setSection("settings")}><b>SAFE STARTUP ACTIVE</b><span>SAVED VISUAL SETTINGS AND EXTENSIONS ARE TEMPORARILY BYPASSED · OPEN RECOVERY</span></button>}
      <div className="shell">
        <aside>
          {prefs.trayPresentation==="header"?<button className="elbow header-tray-trigger" aria-expanded={trayOpen} onClick={()=>setTrayOpen((value)=>!value)}><span>TRAY</span><small>{(trayItems.length+trayShortcuts.length).toString().padStart(2,"0")}</small></button>:<div className="elbow"><span>SYS</span><small>47</small></div>}
          <div className="nav-gap" />
          {nav.map((n, i) => (
            <button
              key={n[0]}
              className={"nav n" + i + (section === n[0] ? " active" : "")}
              onClick={() => {
                beep();
                setSection(n[0]);
              }}
            >
              <i>{n[1]}</i>
              <span>{n[2]}</span>
            </button>
          ))}
          {customPages.map((page,index)=><button title={`${page.kind.toUpperCase()} · ${page.name}`} key={page.id} className={`nav custom-nav n${(index+2)%6}${section===`custom:${page.id}`?" active":""}`} onClick={()=>{beep();setSection(`custom:${page.id}`);}}><i>C{index+1}</i><span>{page.name}</span></button>)}
          <div
            className={
              "task-zone " +
              (taskRail || taskLocked || prefs.taskPinned ? "rail-open " : "") +
              (taskLocked || prefs.taskPinned ? "rail-locked" : "")
            }
            onMouseEnter={taskEnter}
            onMouseLeave={taskLeave}
          >
            {prefs.trayPresentation==="rail"&&<button className="tray-strip-trigger" aria-label="Open system tray" title="Tray Command Deck" aria-expanded={trayOpen} onClick={(event) => { event.stopPropagation(); setTrayOpen((value) => !value); }}><span aria-hidden="true"><i/><i/><i/></span><small>{(trayItems.length+trayShortcuts.length).toString().padStart(2,"0")}</small><b aria-hidden="true">›</b></button>}
            <button className="task-trigger" onClick={toggleTaskLock}>
              <i>
                {compat?.capabilities?.windowControl === false
                  ? "!"
                  : taskLocked || prefs.taskPinned
                    ? "◆"
                    : "09"}
              </i>
              <span>
                {compat?.capabilities?.windowControl === false
                  ? "TASKS LIMITED"
                  : taskLocked || prefs.taskPinned
                    ? "TASKS LOCKED"
                    : taskRail
                      ? "LOCK TASKS"
                      : "OPEN TASKS"}
              </span>
            </button>
            {(taskRail || taskLocked || prefs.taskPinned) && (
              <TaskRail
                tasks={tasks}
                apps={apps}
                displays={displays}
                group={prefs.groupByMonitor}
                restricted={compat?.capabilities?.windowControl === false}
                action={windowAction}
                choose={() => {
                  if (prefs.taskAutoHide && !prefs.taskPinned && !taskLocked)
                    setTaskRail(false);
                }}
              />
            )}
            <div className="filler-codes">
              <i>47-219</i>
              <i>85-302</i>
              <i>19-775</i>
            </div>
          </div>
          <button
            className="nav power"
            onClick={() => {
              beep();
              setPowerOpen(true);
            }}
          >
            <i>10</i>
            <span>POWER</span>
          </button>
          <div className="foot-elbow" />
        </aside>
        <section className={"content page-" + section}>
          <div className="heading">
            <div>
              <small>LCARS / {themes.find((t) => t[0] === theme)?.[2]}</small>
              <h2>
                {section === "overview"
                  ? "SYSTEM OVERVIEW"
                  : section === "bay"
                    ? "APPLICATION BAY"
                    : activeCustomPage?.name.toUpperCase() || section.toUpperCase()}
              </h2>
            </div>
            <div className="heading-actions">
              <span>
                ●{" "}
                {bridge ? "LOCAL SYSTEM CONNECTED" : "INTERFACE DEMONSTRATION"}
              </span>
              {compat && (
                <button
                  className={compat.restrictions.length ? "compat-warning" : ""}
                  onClick={() => setCompatOpen(true)}
                >
                  COMPATIBILITY <b>{compat.restrictions.length}</b>
                </button>
              )}
              <button
                disabled={compat?.capabilities?.displayControl === false}
                title={
                  compat?.capabilities?.displayControl === false
                    ? "Display routing is restricted on this desktop session"
                    : "Open display routing"
                }
                onClick={() => setDisplayMenu(!displayMenu)}
              >
                DISPLAYS <b>{displays.length}</b>
              </button>
              <button
                onClick={() =>
                  displayAction(
                    "terminal",
                    displays.find((d) => !d.primary) || displays[0],
                  )
                }
              >
                REMOTE TERMINAL
              </button>
            </div>
            {displayMenu && (
              <DisplayMenu
                displays={displays}
                move={(d) => displayAction("move-lcars", d)}
                terminal={(d) => displayAction("terminal", d)}
                identify={() => coreAction("identify-displays")}
                configure={() => coreAction("display-settings")}
                refresh={refreshDisplays}
              />
            )}
          </div>
          {!!restrictionForSection?.length && (
            <CompatibilityBanner
              items={restrictionForSection}
              open={() => setCompatOpen(true)}
            />
          )}
          {section === "overview" && (
            <>
              <div className="ticker">
                <b>● {platform}</b>
                <b>LOCAL-FIRST INTERFACE</b>
                <b>SESSION SECURE</b>
                <b>{bridge ? "CORE LINK ACTIVE" : "CORE LINK STANDBY"}</b>
              </div>
              <div className="overview-toolbar">
                <span>{widgets.length} MODULES ACTIVE</span>
                <nav><button onClick={()=>setRoutineCenterOpen(true)}>OPERATIONS AUTOMATION</button><button
                  className={overviewEdit ? "editing" : ""}
                  onClick={() => setOverviewEdit(!overviewEdit)}
                >
                  {overviewEdit ? "FINISH EDITING" : "CONFIGURE OVERVIEW"}
                </button></nav>
              </div>
              {overviewEdit && (
                <OverviewEditor
                  active={widgets}
                  save={saveWidgets}
                  move={moveWidget}
                  extensions={extensions}
                />
              )}
              <div className="overview-modules">
                {widgets.map((id) => (
                  <div
                    draggable={overviewEdit}
                    onDragStart={() => setDragged(id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => dropWidget(id)}
                    className={
                      "widget-wrap size-" + (widgetSizes[id] || "standard")
                    }
                    key={id}
                  >
                    {overviewEdit && (
                      <div className="widget-controls">
                        <span>⠿ {widgetMeta(id).name}</span>
                        <button onClick={() => moveWidget(id, -1)}>▲</button>
                        <button onClick={() => moveWidget(id, 1)}>▼</button>
                        <button onClick={() => cycleSize(id)}>
                          {(widgetSizes[id] || "standard").toUpperCase()}
                        </button>
                        <button
                          onClick={() =>
                            saveWidgets(widgets.filter((x) => x !== id))
                          }
                        >
                          REMOVE
                        </button>
                      </div>
                    )}
                    {renderWidget(id)}
                  </div>
                ))}
              </div>
            </>
          )}
          {section === "terminal" && (
            <Terminal bridge={bridge} notify={notify} prefs={prefs} />
          )}
          {section === "files" && (
            <FileExplorer bridge={bridge} notify={notify} cue={cue} />
          )}
          {section === "bay" && bayApp && (
            <ApplicationBay
              app={bayApp}
              platform={platform}
              fullscreen={bayFullscreen}
              setFullscreen={setBayFullscreen}
              close={() => {
                coreAction("close-bay-app");
                setBayApp(null);
                setSection("overview");
              }}
              minimize={() => {
                coreAction("minimize-bay-app");
                setSection("overview");
              }}
              switchApp={() => setAllOpen(true)}
            />
          )}
          {section === "system" && (
            <section className="detail-view">
              <h3>SYSTEMS DIAGNOSTIC</h3>
              <div className="meters">
                {meters.map((m, i) => (
                  <article key={String(m[0])} role="button" tabIndex={0} onClick={() => setDetailOpen(String(m[0]))} onKeyDown={(e) => e.key === "Enter" && setDetailOpen(String(m[0]))}>
                    <header>
                      <span>
                        0{i + 1} / {m[0]}
                      </span>
                      <strong>{m[1]}%</strong>
                    </header>
                    <div>
                      <i style={{ width: m[1] + "%" }} />
                    </div>
                    <small>{m[2]}</small>
                  </article>
                ))}
              </div>
              <div className="action-grid">
                <button onClick={() => coreAction("system-monitor")}>
                  OPEN SYSTEM MONITOR
                </button>
                <button onClick={() => coreAction("storage")}>
                  STORAGE ANALYSIS
                </button>
                <button onClick={() => coreAction("processes")}>
                  PROCESS CONTROL
                </button>
                <button onClick={() => coreAction("refresh-system")}>
                  REFRESH TELEMETRY
                </button>
              </div>
              <HardwareTelemetry details={systemDetails} open={setDetailOpen}/>
              <StorageMatrix drives={drives} notify={notify} refresh={() => fetch("http://127.0.0.1:8765/api/storage").then((r) => r.json()).then((d) => setDrives(d.drives || []))} />
              <EngineeringConsole data={engineering} refresh={refreshEngineering} processAction={processAction}/>
            </section>
          )}
          {section === "media" && (
            <section className="detail-view media-view media-console-view">
              <h3>MEDIA & AUDIO CONTROL</h3>
              <MediaConsole
                players={sortedPlayers}
                pinned={pinnedPlayers}
                togglePinned={togglePinned}
                control={mediaControl}
                volume={volume}
                muted={audioMuted}
                setVolume={setVolume}
                commitVolume={setSystemVolume}
                toggleMute={toggleMasterMute}
                devices={audioDevices}
                chooseDevice={chooseAudioDevice}
                streams={streams}
                setStreamVolume={streamVolume}
                setStreamMute={streamMute}
                platform={platform}
                openMedia={() => coreAction("media-player")}
                openDevices={() => coreAction("audio-settings")}
                refresh={refreshMedia}
              />
            </section>
          )}
          {section === "network" && (
            <NetworkConsole info={networkInfo} action={coreAction} refresh={() => fetch("http://127.0.0.1:8765/api/network-details").then((r) => r.json()).then(setNetworkInfo).catch(() => notify("Network telemetry unavailable","error"))} />
          )}
          {section === "updates" && (
            <UpdateCenter platform={platform} action={coreAction} health={health} prefs={prefs} configureVoice={() => setSection("settings")} update={lcarsUpdate} setUpdate={setLcarsUpdate} notify={notify} extensions={extensions} catalog={extensionCatalog} disabled={disabledExtensions} setDisabled={saveDisabledExtensions} refreshExtensions={()=>fetch("http://127.0.0.1:8765/api/extensions").then((response)=>response.json()).then((result)=>setExtensions(result.extensions||[])).catch(()=>notify("Extension inventory could not be refreshed","error"))} />
          )}
          {section.startsWith("custom:") && renderCustomPage()}
          {section === "settings" && (
            <section className="detail-view settings-view">
              <h3>INTERFACE CONFIGURATION</h3>
              <div className="setting-block">
                <header>
                  <span>DISPLAY MATRIX</span>
                  <small>SELECT VISUAL THEME</small>
                </header>
                <div className="settings-themes">
                  {themes.map((t, i) => (
                    <button
                      className={theme === t[0] ? "selected" : ""}
                      key={t[0]}
                      onClick={() => choose(t[0])}
                    >
                      <i>0{i + 1}</i>
                      <b>{t[1]}</b>
                      <small>{t[2]}</small>
                    </button>
                  ))}
                </div>
              </div>
              <DesktopExperience
                profiles={profiles}
                activeProfile={activeProfile}
                createProfile={createProfile}
                applyProfile={applyProfile}
                deleteProfile={deleteProfile}
                defaultWorkstation={defaultWorkstation}
                setDefaultWorkstation={chooseDefaultWorkstation}
                access={access}
                saveAccess={saveAccess}
                doNotDisturb={doNotDisturb}
                setDoNotDisturb={setDoNotDisturb}
                sessionRestore={sessionRestore}
                setSessionRestore={(v) => {
                  createRecoverySnapshot("Before session restore change");
                  setSessionRestore(v);
                  localStorage.setItem("lcars-session-restore", String(v));
                }}
                userName={userName}
                setUserName={(v) => {
                  createRecoverySnapshot("Before operator name change");
                  setUserName(v);
                  localStorage.setItem("lcars-user-name", v);
                }}
                exportConfig={exportConfig}
                importConfig={importConfig}
                lock={() => setLocked(true)}
                lockCredential={lockCredential}
                saveLockPassword={saveLockPassword}
                removeLockPassword={removeLockPassword}
                command={() => setPaletteOpen(true)}
                action={coreAction}
              />
              <ShellSettings
                platform={platform}
                prefs={prefs}
                extensions={extensions}
                customPages={customPages}
                routines={routines}
                setPrefs={setPrefs}
                save={() => savePrefs()}
                saved={configSaved}
                health={health}
                recheck={() => coreAction("integration-recheck")}
                startupAudioStatus={startupAudioStatus}
                testStartupAudio={async()=>{const result=await window.__lcarsPlayStartupSound?.(true);if(result)setStartupAudioStatus(`${result.status} · ${result.output||"SYSTEM DEFAULT"}${result.error?` · ${result.error}`:""}`);}}
                safeMode={safeMode}
                quarantinedExtensions={quarantinedExtensions}
                clearExtensionQuarantine={clearExtensionQuarantine}
              />
              <TrayCommandDeckEditor shortcuts={trayShortcuts} apps={apps} routines={routines} customPages={customPages} change={saveTrayShortcuts}/>
              <ControlMappingEditor mappings={controlMappings} routines={routines} change={saveControlMappings}/>
              <CustomPageManager pages={customPages} apps={apps} extensions={extensions} change={saveCustomPages}/>
              <ExtensionSettings extensions={extensions}/>
              <div className="settings-grid">
                <button onClick={()=>setRoutineCenterOpen(true)}><b>OPERATIONS AUTOMATION</b><small>BUILD, PREVIEW, AND RUN MULTI-STEP ROUTINES</small></button>
                <button onClick={()=>setHistoryOpen(true)}><b>COMMUNICATIONS CENTER</b><small>NOTICES, PRIORITIES, AND COMMAND ACTIVITY</small></button>
                <button onClick={() => setEditOpen(true)}>
                  <b>FAVORITE APPLICATIONS</b>
                  <small>CHOOSE UP TO 20 RESPONSIVE LAUNCHERS</small>
                </button>
                <button onClick={() => setAllOpen(true)}>
                  <b>APPLICATION LIBRARY</b>
                  <small>SEARCH INSTALLED SOFTWARE</small>
                </button>
                <button
                  onClick={() => {
                    setOverviewEdit(true);
                    setSection("overview");
                  }}
                >
                  <b>OVERVIEW MODULES</b>
                  <small>ADD, REMOVE AND POSITION WIDGETS</small>
                </button>
                <button onClick={() => setSound(!sound)}>
                  <b>LCARS AUDIO</b>
                  <small>{sound ? "ENABLED" : "DISABLED"}</small>
                </button>
                <button onClick={() => setFirstRun(true)}>
                  <b>RUN GUIDED TOUR</b>
                  <small>LEARN THE LCARS DESKTOP CONTROLS</small>
                </button>
                <button onClick={() => coreAction("shell-mode-off")}>
                  <b>RECOVERY CONTROL</b>
                  <small>
                    {platform.includes("WINDOWS")
                      ? "RESTORE WINDOWS EXPLORER"
                      : "RESTORE PLASMA PANELS"}
                  </small>
                </button>
              </div>
            </section>
          )}
        </section>
      </div>
      {allOpen && (
        <AppDrawer
          title="ALL APPLICATIONS"
          apps={filtered}
          query={query}
          setQuery={setQuery}
          close={() => setAllOpen(false)}
          action={launch}
          destinations={appDestinations}
          setDestination={chooseAppDestination}
          refresh={refreshApps}
        />
      )}
      {editOpen && (
        <AppDrawer
          title={"FAVORITES " + favoriteIds.length + "/20"}
          apps={filtered}
          query={query}
          setQuery={setQuery}
          close={() => setEditOpen(false)}
          action={(a) => toggleFavorite(a.id)}
          selected={favoriteIds}
          selectionMode
          refresh={refreshApps}
        />
      )}
      <SpeedDial
        items={prefs.speedDial}
        extensions={extensions}
        customPages={customPages}
        routines={routines}
        players={players.length}
        notices={notices.length}
        displays={displays.length}
        trayItems={trayItems.length+trayShortcuts.length}
        bridge={bridge}
        doNotDisturb={doNotDisturb}
        taskPinned={taskLocked || prefs.taskPinned}
        execute={runSpeedDial}
      />
      <TrayDrawer open={trayOpen} items={trayItems} shortcuts={trayShortcuts} close={() => setTrayOpen(false)} execute={runTrayShortcut} />
      {speedDialModule&&<div className="backdrop module-spotlight" onMouseDown={(event)=>event.target===event.currentTarget&&setSpeedDialModule(null)}><section role="dialog" aria-modal="true"><header><div><small>SPEED DIAL MODULE</small><h3>{widgetMeta(speedDialModule).name}</h3></div><button onClick={()=>setSpeedDialModule(null)}>CLOSE ×</button></header>{renderWidget(speedDialModule)}</section></div>}
      {speedDialPage&&<SpeedDialPagePeek page={speedDialPage} pinned={speedDialPagePinned} customPages={customPages} apps={apps} players={sortedPlayers} network={networkInfo} meters={meters} update={lcarsUpdate} notices={notices} bridge={bridge} volume={volume} doNotDisturb={doNotDisturb} mediaControl={mediaControl} launch={launch} togglePinned={()=>setSpeedDialPagePinned((value)=>!value)} close={()=>{setSpeedDialPage(null);setSpeedDialPagePinned(false);}} openFull={(page)=>{setSpeedDialPage(null);setSpeedDialPagePinned(false);setSection(page);}} />}
      {routineCenterOpen&&<RoutineCenter routines={routines} apps={apps} profiles={profiles} devices={audioDevices} players={players} running={runningRoutine} save={saveRoutines} request={requestRoutine} close={()=>setRoutineCenterOpen(false)}/>}
      {pendingRoutine&&<RoutinePreview routine={pendingRoutine} describe={describeRoutineStep} running={runningRoutine===pendingRoutine.id} cancel={()=>setPendingRoutine(null)} run={()=>void executeRoutine(pendingRoutine)}/>}
      {startupVisible && prefs.startupSequence && <StartupTelemetry bridge={bridge} reduced={access.reducedMotion} />}
      <VoiceControl prefs={prefs} apps={apps} extensions={extensions} routines={routines} navigate={setSection} launch={launch} requestRoutine={requestRoutine} action={coreAction} notify={notify} />
      {detailOpen && <SystemDetail kind={detailOpen} details={systemDetails} close={() => setDetailOpen(null)} />}
      {firstRun && (
        <FirstRun
          step={setupStep}
          setStep={setSetupStep}
          displays={displays}
          bridge={bridge}
          finish={finishSetup}
          close={() => {
            sessionStorage.setItem("lcars-setup-dismissed", "1");
            setFirstRun(false);
          }}
        />
      )}
      {paletteOpen && (
        <CommandPalette
          query={paletteQuery}
          setQuery={setPaletteQuery}
          commands={filteredCommands}
          findMode={findMode}
          close={() => setPaletteOpen(false)}
        />
      )}
      {locked && (
        <LockScreen userName={userName} credential={lockCredential} profiles={profiles} activeProfile={activeProfile} defaultWorkstation={defaultWorkstation} chooseProfile={applyProfile} setDefaultWorkstation={chooseDefaultWorkstation} power={() => setPowerOpen(true)} unlock={() => setLocked(false)} />
      )}
      {compatOpen && compat && (
        <CompatibilityCenter
          compat={compat}
          close={() => setCompatOpen(false)}
        />
      )}
      {powerOpen && (
        <PowerDialog close={() => setPowerOpen(false)} action={powerAction} />
      )}
      <NotificationCenter
        notices={notices}
        activity={activityLog}
        historyOpen={historyOpen}
        close={() => setHistoryOpen(false)}
        dismiss={dismissNotice}
        clear={clearNotices}
        clearActivity={clearActivity}
        doNotDisturb={doNotDisturb}
        toggleDnd={() => setDoNotDisturb((v) => !v)}
      />
    </main>
  );
}

type FileKind="folder"|"application"|"pdf"|"document"|"image"|"audio"|"video"|"archive"|"file";
const fileKind=(file:FileEntry):FileKind=>{if(file.directory)return"folder";const ext=file.name.split(".").pop()?.toLowerCase()||"";if(["exe","appimage","desktop","msi","app","bat","cmd","sh"].includes(ext))return"application";if(ext==="pdf")return"pdf";if(["doc","docx","odt","txt","rtf","md"].includes(ext))return"document";if(["png","jpg","jpeg","gif","webp","svg","bmp"].includes(ext))return"image";if(["mp3","wav","flac","ogg","m4a","aac"].includes(ext))return"audio";if(["mp4","mkv","webm","avi","mov"].includes(ext))return"video";if(["zip","7z","rar","tar","gz","bz2","xz"].includes(ext))return"archive";return"file";};
function FileGlyph({kind}:{kind:FileKind}){const paths:Record<FileKind,ReactNode>={folder:<path d="M2 6h7l2 2h11v12H2zM3 5V3h7l2 2"/>,application:<><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 8l7 4-7 4z"/></>,pdf:<><path d="M5 2h10l4 4v16H5z"/><path d="M15 2v5h5M8 16c4-8 4-2 8-5M9 13c2 2 4 3 7 4"/></>,document:<><path d="M5 2h10l4 4v16H5z"/><path d="M15 2v5h5M8 11h8M8 15h8M8 19h5"/></>,image:<><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M5 18l5-5 3 3 2-2 4 4"/></>,audio:<><path d="M10 17V6l9-2v11"/><circle cx="7" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></>,video:<><rect x="2" y="5" width="15" height="14" rx="2"/><path d="M17 10l5-3v10l-5-3z"/></>,archive:<><path d="M5 3h14v18H5z"/><path d="M10 3h4v3h-4zm0 6h4v3h-4zm0 6h4v3h-4z"/></>,file:<><path d="M5 2h10l4 4v16H5z"/><path d="M15 2v5h5"/></>};return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[kind]}</svg>;}

function FileExplorer({
  bridge,
  notify,
  cue,
}: {
  bridge: boolean;
  notify: (text: string, kind?: "info" | "error", playError?: boolean) => void;
  cue: (
    name: "error" | "processing" | "transfer-complete" | "transfer-failed",
  ) => void;
}) {
  const [path, setPath] = useState("~"),
    [parent, setParent] = useState(""),
    [files, setFiles] = useState<FileEntry[]>([]),
    [selected, setSelected] = useState<FileEntry | null>(null),
    [pending, setPending] = useState<{ file: FileEntry; move: boolean } | null>(
      null,
    ),
    [showHidden, setShowHidden] = useState(false),
    [query, setQuery] = useState(""),
    [loading, setLoading] = useState(false),
    [preview, setPreview] = useState<{kind:string;content:string}>({kind:"",content:""}),
    [documentPath,setDocumentPath]=useState("");
  const load = (next = path) => {
    setLoading(true);
    cue("processing");
    fetch("http://127.0.0.1:8765/api/files?path=" + encodeURIComponent(next))
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw Error(d.error);
        setPath(d.path);
        setParent(d.parent || "");
        setFiles(d.items || []);
        setSelected(null);
      })
      .catch((e) => notify(e.message || "Unable to read this folder", "error"))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    if (bridge) load("~");
  }, [bridge]);
  useEffect(() => {
    if (!selected || selected.directory) return setPreview({kind:"",content:""});
    fetch("http://127.0.0.1:8765/api/file-preview?path=" + encodeURIComponent(selected.path)).then((r)=>r.json()).then((data)=>setPreview(data.error?{kind:"",content:""}:data)).catch(()=>setPreview({kind:"",content:""}));
  }, [selected]);
  const visible = files.filter(
    (f) =>
      (showHidden || !f.hidden) &&
      f.name.toLowerCase().includes(query.toLowerCase()),
  );
  const act = (
    route: string,
    data: Record<string, unknown>,
    success: string,
    transfer = false,
  ) => {
    cue("processing");
    fetch("http://127.0.0.1:8765" + route, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok || d.error) throw Error(d.error || d.message);
        if (transfer) cue("transfer-complete");
        notify(success);
        setPending(null);
        load(path);
      })
      .catch((e) => {
        if (transfer) cue("transfer-failed");
        notify(e.message || "File operation failed", "error", !transfer);
      });
  };
  const newFolder = () => {
    const name = prompt("New folder name")?.trim();
    if (name) act("/api/file-folder", { path, name }, "Folder created");
  };
  const size = (n: number) =>
    n < 1024
      ? n + " B"
      : n < 1048576
        ? (n / 1024).toFixed(1) + " KB"
        : n < 1073741824
          ? (n / 1048576).toFixed(1) + " MB"
          : (n / 1073741824).toFixed(1) + " GB";
  const openFile=(file:FileEntry)=>["pdf","document"].includes(fileKind(file))?setDocumentPath(file.path):act("/api/file-open",{path:file.path},"File opened");
  if(documentPath)return <DocumentWorkspace path={documentPath} close={()=>setDocumentPath("")} notify={notify}/>;
  return (
    <section className="file-explorer">
      <header>
        <div>
          <small>LOCAL HOME DIRECTORY</small>
          <b>{path}</b>
        </div>
        <span>{loading ? "PROCESSING…" : visible.length + " ITEMS"}</span>
      </header>
      <nav>
        <button onClick={() => load("~")}>HOME</button>
        <button onClick={() => load("~/Documents")}>DOCUMENTS</button>
        <button onClick={() => load("~/Downloads")}>DOWNLOADS</button>
        <button disabled={!parent} onClick={() => parent && load(parent)}>
          ‹ UP
        </button>
        <button onClick={() => load(path)}>REFRESH</button>
        <button onClick={newFolder}>NEW FOLDER</button>
        <label>
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => setShowHidden(e.target.checked)}
          />{" "}
          HIDDEN
        </label>
        <input
          aria-label="Search files"
          placeholder="SEARCH FILES…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </nav>
      {pending && (
        <div className="transfer-strip">
          <span>
            {pending.move ? "MOVE" : "COPY"} <b>{pending.file.name}</b>
          </span>
          <small>Navigate to the destination folder.</small>
          <button
            onClick={() =>
              act(
                "/api/file-transfer",
                {
                  source: pending.file.path,
                  destination: path,
                  move: pending.move,
                },
                "Transfer complete",
                true,
              )
            }
          >
            TRANSFER HERE
          </button>
          <button onClick={() => setPending(null)}>CANCEL</button>
        </div>
      )}
      <div className="file-browser-body">
        <div className="file-grid">
          {visible.map((file) => (
            <button
              className={selected?.path === file.path ? "selected" : ""}
              key={file.path}
              onClick={() => setSelected(file)}
              onDoubleClick={() =>
                file.directory
                  ? load(file.path)
                  : openFile(file)
              }
            >
              <i className={`file-kind-${fileKind(file)}`}><FileGlyph kind={fileKind(file)}/></i>
              <span>
                <b>{file.name}</b>
                <small>
                  {file.directory ? "DIRECTORY" : size(file.size)} ·{" "}
                  {new Date(file.modified * 1000).toLocaleDateString()}
                </small>
              </span>
            </button>
          ))}
        </div>
        <aside className="file-inspector">
          {selected ? (
            <>
              <i className={`file-kind-${fileKind(selected)}`}><FileGlyph kind={fileKind(selected)}/></i>
              <h3>{selected.name}</h3>
              <small>
                {selected.directory ? "DIRECTORY" : size(selected.size)}
              </small>
              {preview.kind === "image" && <img className="file-preview-image" src={preview.content} alt="Selected file preview" />}
              {preview.kind === "text" && <pre className="file-preview-text">{preview.content}</pre>}
              <button
                onClick={() =>
                  selected.directory
                    ? load(selected.path)
                    : openFile(selected)
                }
              >
                {selected.directory ? "OPEN FOLDER" : "OPEN FILE"}
              </button>
              <button
                onClick={() => setPending({ file: selected, move: false })}
              >
                COPY TO…
              </button>
              <button
                onClick={() => setPending({ file: selected, move: true })}
              >
                MOVE TO…
              </button>
            </>
          ) : (
            <p>SELECT A FILE OR FOLDER FOR DETAILS</p>
          )}
        </aside>
      </div>
    </section>
  );
}

type DocumentData={kind:"text"|"office"|"pdf";name:string;path:string;editable:boolean;content:string};
function DocumentWorkspace({path,close,detached=false,notify}:{path:string;close:()=>void;detached?:boolean;notify:(text:string,kind?:"info"|"error")=>void}){
  const [documentData,setDocumentData]=useState<DocumentData|null>(null),[content,setContent]=useState(""),[dirty,setDirty]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const load=()=>{setLoading(true);setError("");fetch("http://127.0.0.1:8765/api/document?path="+encodeURIComponent(path)).then(async(response)=>{const result=await response.json();if(!response.ok||result.error)throw Error(result.error||"Document unavailable");setDocumentData(result);setContent(result.content);setDirty(false);}).catch((failure)=>{setError(failure.message);notify(failure.message,"error");}).finally(()=>setLoading(false));};
  useEffect(load,[path]);
  const save=async()=>{const response=await fetch("http://127.0.0.1:8765/api/document",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({path,content})});const result=await response.json();if(!response.ok||result.error)return notify(result.error||"Document could not be saved","error");setDirty(false);notify("Document saved");};
  const detach=()=>window.open(`lcars://app/index.html?tool=document&path=${encodeURIComponent(path)}`,"_blank","popup=yes");
  const openDefault=()=>fetch("http://127.0.0.1:8765/api/file-open",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({path})}).then(()=>notify("Opened with the operating-system default application")).catch(()=>notify("Default application could not be opened","error"));
  return <section className="document-workspace"><header draggable={!detached} onDragEnd={(event)=>{if(!detached&&(event.screenX<=1||event.screenY<=1||event.screenX>=window.screen.availWidth-1||event.screenY>=window.screen.availHeight-1))detach();}}><div><small>LCARS DOCUMENT WORKSPACE</small><h3>{documentData?.name||"DOCUMENT LINK"}</h3></div><nav>{documentData?.editable&&<button disabled={!dirty} onClick={save}>SAVE</button>}<button onClick={detached?()=>window.close():detach}>{detached?"REATTACH / CLOSE":"DETACH ↗"}</button><button onClick={close}>{detached?"CLOSE":"BACK TO FILES"}</button></nav></header>{loading?<div className="document-loading">PROCESSING DOCUMENT…</div>:error?<div className="document-error"><b>EMBEDDED READER UNAVAILABLE</b><p>{error}</p><button onClick={openDefault}>OPEN WITH SYSTEM DEFAULT</button></div>:documentData?.kind==="pdf"?<iframe title={documentData.name} src={documentData.content}/>:documentData?.editable?<textarea value={content} onChange={(event)=>{setContent(event.target.value);setDirty(true);}} spellCheck/>:<article className="document-reader"><pre>{content}</pre></article>}<footer><span>{documentData?.kind?.toUpperCase()||"UNKNOWN FORMAT"}</span><small>{documentData?.editable?dirty?"UNSAVED CHANGES":"EDITABLE / SAVED":"READ-ONLY VIEW · OS DEFAULT REMAINS AVAILABLE"}</small></footer></section>;
}

function CustomApplicationPage({page,app,embedded,launch,navigate}:{page:CustomPage;app:App|undefined;embedded:string|null;launch:()=>void;navigate:(page:string)=>void}) {
  return <section className="detail-view custom-page-view application-destination"><header className="custom-page-cap"><small>ASSIGNED APPLICATION DESTINATION</small><h3>{page.name}</h3></header>{app?<div className="application-destination-card"><i>{app.icon?<img src={app.icon} alt=""/>:app.name.slice(0,2).toUpperCase()}</i><span><small>INSTALLED APPLICATION</small><h4>{app.name}</h4><p>{app.comment||"Local desktop application"}</p></span><nav>{embedded&&<button onClick={()=>navigate(embedded)}>OPEN LCARS {embedded.toUpperCase()} VIEW</button>}<button onClick={launch}>OPEN NATIVE WINDOW ↗</button></nav></div>:<div className="adaptive-empty"><b>APPLICATION NOT FOUND</b><small>The application may have been removed or its launcher identifier changed. Edit this custom page in Settings.</small></div>}<footer>{embedded?"LCARS-COMPATIBLE DESTINATION AVAILABLE":"THE OPERATING SYSTEM DOES NOT ALLOW THIS APPLICATION TO BE RE-PARENTED INSIDE LCARS"}</footer></section>;
}

function NetworkConsole({info,action,refresh}:{info:NetworkInfo;action:(value:string)=>void;refresh:()=>void}) {
  const amount=(value:number)=>value>1073741824?(value/1073741824).toFixed(1)+" GB":value>1048576?(value/1048576).toFixed(1)+" MB":(value/1024).toFixed(0)+" KB";
  const diagnostics=[['GATEWAY',info.diagnostics.gateway],['DNS',info.diagnostics.dns],['EXTERNAL LINK',info.diagnostics.internet]] as const;
  return <section className="detail-view lcars-console network-console"><header className="console-cap"><div><small>NET / SUBSPACE OPERATIONS</small><h3>NETWORK OPERATIONS</h3></div><strong>{info.interfaces.length.toString().padStart(2,'0')}</strong></header><div className="network-grid">{info.interfaces.length?info.interfaces.map((link,index)=><article className="network-tile" key={link.id}><i>{String(index+1).padStart(2,'0')}</i><header><small>{link.kind.toUpperCase()} INTERFACE</small><b>{link.name}</b><em className={link.state==='connected'?'online':''}>{link.state.toUpperCase()}</em></header><div className="network-address"><span><small>ADDRESS</small><b>{link.address||'UNASSIGNED'}</b></span><span><small>GATEWAY</small><b>{link.gateway||'LOCAL ONLY'}</b></span></div><div className="network-flow"><span>RX {amount(link.received)}</span><i><em style={{width:Math.min(100,(link.received%100000000)/1000000)+'%'}} /></i><span>TX {amount(link.sent)}</span></div><footer><span>{link.speed||'LINK SPEED UNKNOWN'}</span>{typeof link.signal==='number'&&<b>SIGNAL {link.signal}%</b>}</footer></article>):<div className="adaptive-empty"><b>NO NETWORK INTERFACES REPORTED</b><small>The platform adapter did not return an active data link.</small></div>}</div><section className="network-diagnostics"><header><small>CONNECTION DIAGNOSTICS</small><b>{info.diagnostics.latency===null?'NO LATENCY':info.diagnostics.latency+' MS'}</b></header>{diagnostics.map(([name,ok],index)=><article key={name}><i>{String(index+1).padStart(2,'0')}</i><span>{name}</span><b className={ok?'ok':'bad'}>{ok?'ONLINE':'OFFLINE'}</b></article>)}<article><i>04</i><span>BLUETOOTH</span><b className={info.bluetooth?'ok':'bad'}>{info.bluetooth?'ACTIVE':'INACTIVE'}</b></article></section><nav className="network-actions"><button onClick={()=>action('network-settings')}>NETWORK SETTINGS</button><button onClick={()=>action('wifi')}>WI-FI CONTROL</button><button onClick={()=>action('bluetooth')}>BLUETOOTH CONTROL</button><button onClick={refresh}>REFRESH & TEST</button></nav></section>;
}

function TrayDrawer({open,items,shortcuts,close,execute}:{open:boolean;items:TrayItem[];shortcuts:TrayShortcut[];close:()=>void;execute:(shortcut:TrayShortcut)=>void}) {
  if(!open)return null;
  const activate=(id:string)=>fetch("http://127.0.0.1:8765/api/tray-action",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})}).catch(()=>{});
  return <aside className="tray-drawer tray-command-deck"><header><div><small>LOCAL STATUSNOTIFIER & COMMAND MATRIX</small><h3>TRAY COMMAND DECK</h3></div><button onClick={close}>CLOSE ×</button></header><div className="tray-scroll-region" tabIndex={0}><section className="tray-shortcut-grid" aria-label="Configured tray shortcuts">{shortcuts.map((shortcut,index)=><button className={`tray-shortcut tray-kind-${shortcut.kind}`} key={shortcut.id} onClick={()=>execute(shortcut)} title={`${shortcut.kind}: ${shortcut.label}`}><i>{String(index+1).padStart(2,"0")}</i><span><b>{shortcut.label}</b><small>{shortcut.kind.toUpperCase()}</small></span><em>›</em></button>)}{!shortcuts.length&&<p>NO COMMAND BUTTONS ASSIGNED · ADD THEM IN SETTINGS</p>}</section><section className="tray-service-list" aria-label="Desktop tray services"><header><b>DESKTOP SERVICES</b><small>{items.length} ACTIVE</small></header>{items.length?items.map((item)=><button key={item.id} onClick={()=>activate(item.id)} title={item.name}><i>{item.icon?<img src={item.icon} alt=""/>:<b>{item.name.replace(/[^A-Za-z0-9]/g,"").slice(0,2).toUpperCase()||"TR"}</b>}</i><span><b>{item.name}</b><small>{item.status||"ACTIVE"}</small></span><em>›</em></button>):<p>NO EXTERNAL TRAY SERVICES REPORTED</p>}</section></div><footer><span>SCROLL MATRIX</span><small>{shortcuts.length} COMMANDS · {items.length} SERVICES</small></footer></aside>;
}

function StartupTelemetry({bridge,reduced}:{bridge:boolean;reduced:boolean}) { return <aside className={'startup-telemetry '+(reduced?'instant':'')} aria-live="polite"><i /><span><small>LCARS INITIALIZATION</small><b>{bridge?'LOCAL CORE SYNCHRONIZED':'LOCAL CORE LINK PENDING'}</b></span><em>SYS 47 · DISPLAY MATRIX · AUDIO BUS</em></aside>; }

function StorageMatrix({ drives, notify, refresh }: { drives: Drive[]; notify: (text: string, kind?: "info" | "error") => void; refresh: () => void }) {
  const operate = async (drive: Drive) => {
    try {
      const response = await fetch("http://127.0.0.1:8765/api/storage-action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: drive.id, action: drive.mounted ? "unmount" : "mount" }) });
      const result = await response.json();notify(result.message, result.ok ? "info" : "error");refresh();
    } catch { notify("Storage controller did not respond", "error"); }
  };
  return <section className="storage-matrix"><header><div><small>PHYSICAL STORAGE MATRIX</small><h4>DRIVES & REMOVABLE MEDIA</h4></div><button onClick={refresh}>RESCAN</button></header><div>{drives.map((drive) => <article key={drive.id}><i>{drive.removable ? "REM" : "DRV"}</i><span><b>{drive.name}</b><small>{(drive.size / 1073741824).toFixed(1)} GB · {drive.filesystem || drive.type.toUpperCase()} · {drive.mounted ? drive.mountpoints.join(", ") : "NOT MOUNTED"}</small></span>{drive.removable && drive.type !== "disk" && <button onClick={() => operate(drive)}>{drive.mounted ? "UNMOUNT" : "MOUNT"}</button>}</article>)}</div></section>;
}

const formatBytes=(value:number)=>value>=1099511627776?(value/1099511627776).toFixed(1)+" TB":value>=1073741824?(value/1073741824).toFixed(1)+" GB":value>=1048576?(value/1048576).toFixed(0)+" MB":value?Math.round(value/1024)+" KB":"NOT REPORTED";
function HardwareTelemetry({details,open}:{details:SystemDetails;open:(kind:string)=>void}){
  const memory=details.memory,graphics=details.graphics||[];
  return <section className="hardware-telemetry"><header><div><small>EXPANDED HARDWARE MATRIX</small><h4>GRAPHICS & MEMORY</h4></div><b>{graphics.length.toString().padStart(2,"0")} GPU</b></header><div className="memory-telemetry" role="button" tabIndex={0} onClick={()=>open("MEM")} onKeyDown={(event)=>event.key==="Enter"&&open("MEM")}><i>MEM</i><span><small>PHYSICAL MEMORY</small><b>{formatBytes(memory?.used||0)} / {formatBytes(memory?.total||0)}</b><em>{formatBytes(memory?.available||0)} AVAILABLE · SWAP {formatBytes(memory?.swapUsed||0)} / {formatBytes(memory?.swapTotal||0)}</em></span><strong>{memory?.percent||0}%</strong></div><div className="graphics-telemetry">{graphics.length?graphics.map((adapter,index)=><article role="button" tabIndex={0} onClick={()=>open("GPU")} onKeyDown={(event)=>event.key==="Enter"&&open("GPU")} key={`${adapter.name}:${index}`}><i>{String(index+1).padStart(2,"0")}</i><span><small>{adapter.vendor||"GRAPHICS ADAPTER"}</small><b>{adapter.name}</b><em>{adapter.driver?`DRIVER ${adapter.driver}`:"DRIVER NOT REPORTED"}{adapter.resolution?` · ${adapter.resolution}`:""}</em></span><strong>{adapter.usage??0}%</strong></article>):<p>NO DETAILED GRAPHICS TELEMETRY REPORTED BY THIS PLATFORM</p>}</div></section>;
}

function SystemDetail({ kind, details, close }: { kind: string; details: SystemDetails; close: () => void }) {
  const memory=details.memory,graphics=details.graphics||[];
  return <div className="backdrop"><section className="system-detail" role="dialog" aria-modal="true"><header><div><small>EXPANDED TELEMETRY</small><h2>{kind} DIAGNOSTIC</h2></div><button onClick={close}>CLOSE ×</button></header>{kind === "CPU" && <><p>{details.cpu?.logical || 0} LOGICAL PROCESSORS · LOAD {details.cpu?.load?.join(" / ") || "UNKNOWN"}</p><div className="core-grid">{details.cpu?.cores?.map((core) => <article key={core.name}><span><b>{core.name}</b><strong>{core.usage}%</strong></span><i><em style={{ width: core.usage + "%" }} /></i></article>)}</div></>}{kind === "MEM"&&<div className="memory-detail"><div><span><small>TOTAL</small><b>{formatBytes(memory?.total||0)}</b></span><span><small>IN USE</small><b>{formatBytes(memory?.used||0)}</b></span><span><small>AVAILABLE</small><b>{formatBytes(memory?.available||0)}</b></span><span><small>SWAP IN USE</small><b>{formatBytes(memory?.swapUsed||0)}</b></span></div>{memory?.modules?.length?<section>{memory.modules.map((module,index)=><article key={`${module.bank}:${index}`}><i>{String(index+1).padStart(2,"0")}</i><span><b>{module.bank||`MEMORY MODULE ${index+1}`}</b><small>{formatBytes(module.capacity)} · {module.speed?module.speed+" MT/S · ":""}{module.manufacturer||"MANUFACTURER UNKNOWN"} {module.part||""}</small></span></article>)}</section>:<p>Individual memory-module information is not exposed by this platform without elevated hardware access.</p>}</div>}{kind === "GPU"&&<div className="graphics-detail">{graphics.length?graphics.map((adapter,index)=><article key={`${adapter.name}:${index}`}><i>{String(index+1).padStart(2,"0")}</i><header><small>{adapter.vendor||"GRAPHICS"}</small><b>{adapter.name}</b></header><p><span>UTILIZATION <b>{adapter.usage??0}%</b></span><span>VIDEO MEMORY <b>{formatBytes(adapter.memoryUsed||0)} / {formatBytes(adapter.memoryTotal||0)}</b></span><span>TEMPERATURE <b>{adapter.temperature==null?"NOT REPORTED":adapter.temperature+"°C"}</b></span><span>DRIVER <b>{adapter.driver||"NOT REPORTED"}</b></span><span>DISPLAY MODE <b>{adapter.resolution||"DESKTOP MANAGED"}</b></span></p></article>):<p>Detailed graphics telemetry is unavailable from the current platform adapter.</p>}</div>}{kind === "DISK" && <div className="detail-drives">{details.storage?.map((drive) => <p key={drive.id}><b>{drive.name}</b><small>{(drive.size / 1073741824).toFixed(1)} GB · {drive.mounted ? drive.mountpoints.join(", ") : "NOT MOUNTED"}</small></p>)}</div>}<footer>KERNEL {details.kernel || "PLATFORM MANAGED"}</footer></section></div>;
}

function EngineeringConsole({data,refresh,processAction}:{data:EngineeringData;refresh:()=>void;processAction:(pid:number,action:"terminate"|"suspend"|"resume")=>void}){
  const [query,setQuery]=useState(""),[expanded,setExpanded]=useState(true);
  const processes=data.processes.filter((process)=>`${process.name} ${process.pid} ${process.user||""}`.toLowerCase().includes(query.toLowerCase())).slice(0,40);
  const command=(process:EngineeringData["processes"][number],action:"terminate"|"suspend"|"resume")=>{if(action==="terminate"&&!window.confirm(`Terminate ${process.name} (PID ${process.pid})? Unsaved work in that application may be lost.`))return;processAction(process.pid,action);};
  return <section className="engineering-console"><header><div><small>VERSION 25 ENGINEERING OPERATIONS</small><h4>ENGINEERING CONSOLE</h4><p>Hardware health, power sources, storage status, and guarded process control remain local to this computer.</p></div><strong>{String(data.sensors.filter((sensor)=>sensor.status==="ready").length).padStart(2,"0")}<small> SYSTEMS READY</small></strong></header><div className="engineering-sensors">{data.sensors.length?data.sensors.map((sensor)=><article className={sensor.status} key={sensor.id}><i>{sensor.kind.slice(0,3).toUpperCase()}</i><span><b>{sensor.name}</b><small>{sensor.detail||sensor.kind.toUpperCase()}</small></span><strong>{sensor.value}</strong></article>):<p>NO OPTIONAL SENSOR ADAPTERS REPORTED · CORE TELEMETRY REMAINS AVAILABLE ABOVE</p>}</div><nav><button onClick={refresh}>REFRESH ENGINEERING</button><button onClick={()=>setExpanded(!expanded)}>{expanded?"HIDE PROCESS MATRIX":"SHOW PROCESS MATRIX"}</button><input aria-label="Search engineering processes" placeholder="SEARCH PROCESSES…" value={query} onChange={(event)=>setQuery(event.target.value)}/></nav>{expanded&&<div className="engineering-processes"><header><span>PROCESS</span><span>CPU</span><span>MEMORY</span><span>CONTROL</span></header>{processes.map((process)=><article key={process.pid}><span><b>{process.name}</b><small>PID {process.pid}{process.user?` · ${process.user}`:""}</small></span><strong>{process.cpu.toFixed(1)}%</strong><strong>{process.memory.toFixed(1)}%</strong><nav>{process.protected||!data.processControl?<small>PROTECTED</small>:<><button onClick={()=>command(process,process.state==="stopped"?"resume":"suspend")}>{process.state==="stopped"?"RESUME":"PAUSE"}</button><button className="danger" onClick={()=>command(process,"terminate")}>END</button></>}</nav></article>)}{!processes.length&&<p>NO MATCHING USER PROCESSES</p>}</div>}{data.notes?.length?<footer>{data.notes.join(" · ")}</footer>:null}</section>;
}

function TaskRail({
  tasks,
  apps,
  displays,
  group,
  restricted,
  action,
  choose,
}: {
  tasks: WindowTask[];
  apps: App[];
  displays: Display[];
  group: boolean;
  restricted: boolean;
  action: (id: string, action: string, display?: string) => void;
  choose: () => void;
}) {
  const [query, setQuery] = useState(""),
    [menu, setMenu] = useState<string | null>(null);
  const filtered = tasks.filter((t) =>
    (t.app + " " + t.name).toLowerCase().includes(query.toLowerCase()),
  );
  const monitorNames = Array.from(
    new Set([
      ...displays.map((d) => d.name),
      ...filtered.map((t) => t.monitor),
    ]),
  );
  const groups = group
    ? monitorNames.map(
        (name) => [name, filtered.filter((t) => t.monitor === name)] as const,
      )
    : [["OPEN APPLICATIONS", filtered] as const];
  const iconFor = (task: WindowTask) => task.icon || apps.find((app) => (app.name + " " + app.id).toLowerCase().includes(task.app.toLowerCase()) || task.app.toLowerCase().includes(app.name.toLowerCase()))?.icon;
  return (
    <section className="task-rail">
      <header>
        <b>ACTIVE TASKS</b>
        <small>{tasks.length} WINDOWS</small>
      </header>
      {restricted && (
        <div className="rail-restriction">
          <b>WINDOW CONTROL RESTRICTED</b>
          <small>
            This desktop session prevents LCARS from controlling other
            application windows. Launching still works.
          </small>
        </div>
      )}
      {tasks.length >= 5 && (
        <input
          aria-label="Search open tasks"
          placeholder="SEARCH TASKS…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}{" "}
      {groups.map(([name, items]) => (
        <div className="task-group" key={name}>
          <small>{name}</small>
          {items.length ? (
            items.map((t) => (
              <article
                className={
                  (t.active ? "active " : "") + (t.attention ? "attention" : "")
                }
                key={t.id}
                onContextMenu={(e) => {
                  if (!restricted) {
                    e.preventDefault();
                    setMenu(menu === t.id ? null : t.id);
                  }
                }}
              >
                <button
                  disabled={restricted}
                  onClick={() => {
                    action(t.id, "activate");
                    choose();
                  }}
                >
                  <i>{iconFor(t) ? <img src={iconFor(t)} alt="" /> : t.app.slice(0, 2).toUpperCase()}</i>
                  <span>
                    <b>{t.app}</b>
                    <small>{t.minimized ? "MINIMIZED" : t.name}</small>
                  </span>
                </button>
                <nav>
                  <button
                    disabled={restricted}
                    aria-label={"Minimize " + t.app}
                    onClick={() => action(t.id, "minimize")}
                  >
                    —
                  </button>
                  <button
                    disabled={restricted}
                    aria-label={"Close " + t.app}
                    onClick={() => action(t.id, "close")}
                  >
                    ×
                  </button>
                </nav>
                {menu === t.id && !restricted && (
                  <div className="task-context">
                    <button onClick={() => action(t.id, "activate")}>
                      FOCUS
                    </button>
                    <button onClick={() => action(t.id, "minimize")}>
                      MINIMIZE
                    </button>
                    {displays.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => action(t.id, "move", d.name)}
                      >
                        MOVE TO {d.name}
                      </button>
                    ))}
                    <button onClick={() => action(t.id, "close")}>CLOSE</button>
                  </div>
                )}
              </article>
            ))
          ) : (
            <em>NO WINDOWS</em>
          )}
        </div>
      ))}
    </section>
  );
}

function UpdateCenter({
  platform,
  action,
  health,
  prefs,
  configureVoice,
  update,
  setUpdate,
  notify,
  extensions,
  catalog,
  disabled,
  setDisabled,
  refreshExtensions,
}: {
  platform: string;
  action: (value: string) => void;
  health: Health;
  prefs: ShellPrefs;
  configureVoice: () => void;
  update: UpdateInfo | null;
  setUpdate: (update: UpdateInfo | null) => void;
  notify: (text: string, kind?: "info" | "error") => void;
  extensions: ExtensionManifest[];
  catalog: ExtensionCatalogEntry[];
  disabled: string[];
  setDisabled: (ids: string[]) => void;
  refreshExtensions: () => void;
}) {
  const windows = platform.includes("WINDOWS");
  const [updateBusy,setUpdateBusy]=useState<""|"check"|"download"|"install"|"rollback">("");
  const updateOperation=async(operation:"check"|"download"|"install"|"rollback")=>{
    setUpdateBusy(operation);
    try{
      const response=await fetch("http://127.0.0.1:8765/api/lcars-update",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({operation,path:update?.path||"",channel:prefs.updateChannel})});
      const result:UpdateInfo=await response.json();
      setUpdate(result);
      if(!response.ok||!result.ok)notify(result.error||"GitHub update service could not be reached","error");
      else notify(result.message||(result.available?`LCARS ${result.version} is available`:"LCARS is up to date"));
      if(result.closeApp)window.setTimeout(()=>window.close(),700);
    }catch{notify("GitHub update service could not be reached","error");}
    finally{setUpdateBusy("");}
  };
  return (
    <section className="detail-view update-center">
      <h3>SOFTWARE UPDATE CONTROL</h3>
      <header className="update-summary">
        <div>
          <small>UPDATE MATRIX</small>
          <strong>ALL UPDATE CHANNELS</strong>
          <p>
            System, LCARS, extensions, and local integrations are managed from
            this console.
          </p>
        </div>
        <i>04</i>
      </header>
      <div className="update-grid">
        <UpdatePanel
          number="01"
          eyebrow={
            windows ? "WINDOWS UPDATE / WINGET" : "DISTRIBUTION PACKAGE CONTROL"
          }
          title="OPERATING SYSTEM"
          status="SCAN READY"
          description={
            windows
              ? "Check Windows Update and installed application packages without leaving LCARS."
              : "Open your distribution updater and check packages through the detected Linux package manager."
          }
          primary="SCAN FOR SYSTEM UPDATES"
          secondary="OPEN SOFTWARE CENTER"
          primaryAction={() => action("check-updates")}
          secondaryAction={() => action("software-center")}
        />
        <UpdatePanel
          number="02"
          eyebrow="LCARS RELEASE CHANNEL"
          title="LCARS INTERFACE"
          status={updateBusy?updateBusy.toUpperCase()+"…":update?.downloaded?"VERIFIED / READY":update?.available?`V${update.version} AVAILABLE`:`V25 ${prefs.updateChannel.toUpperCase()} CHANNEL`}
          description={update?.available?`A newer signed release is available from GitHub${update.asset?.name?`: ${update.asset.name}`:""}.`:"Background checks stay silent when offline. Manual checks report useful connection and verification details here."}
          primary={update?.downloaded?"INSTALL VERIFIED UPDATE":update?.available?"DOWNLOAD & VERIFY":"CHECK FOR LCARS UPDATE"}
          secondary={update?.rollback?.available?"RESTORE PREVIOUS RELEASE":"ROLLBACK STATUS"}
          primaryAction={() => updateOperation(update?.downloaded?"install":update?.available?"download":"check")}
          secondaryAction={() => updateOperation("rollback")}
          stamp={update?.sha256?`SHA-256 ${update.sha256.slice(0,16).toUpperCase()}…`:update?.rollback?.available?`ROLLBACK ${update.rollback.sha256?.slice(0,12).toUpperCase()||"ARCHIVED"}… · PREVIOUS LINUX RELEASE READY`:"AUTOMATIC GITHUB RELEASE CHANNEL · BACKGROUND ERRORS SILENT"}
        />
        <UpdatePanel
          number="03"
          eyebrow="DECLARATIVE MODULE API"
          title="EXTENSIONS"
          status="V2"
          description="Rescan isolated declarative modules with placements, settings, permissions, and persistent state. Version 1 checklist modules remain compatible."
          primary="SCAN EXTENSIONS"
          secondary="OPEN MODULE FOLDER"
          primaryAction={() => action("extension-scan")}
          secondaryAction={() => action("extension-folder")}
        />
        <UpdatePanel
          number="04"
          eyebrow="DESKTOP ADAPTERS"
          title="INTEGRATION COMPONENTS"
          status="LOCAL"
          description="Recheck display, audio, media, terminal, and window-control dependencies after system changes."
          primary="RECHECK INTEGRATIONS"
          secondary="DISPLAY COMPONENTS"
          primaryAction={() => action("integration-recheck")}
          secondaryAction={() => action("display-settings")}
        />
      </div>
      <aside className="optional-components">
        <header><div><small>NONESSENTIAL SOFTWARE BAY</small><h4>OPTIONAL COMPONENTS</h4></div><em>SKIPPED ITEMS DO NOT AFFECT LCARS STATUS</em></header>
        <div>
          <article><i className={health.voice?.available ? "ready" : ""}>V</i><span><b>OFFLINE VOICE ENGINE</b><small>{health.voice?.available ? "WHISPER.CPP AND AUDIO CONVERTER READY" : "NOT INSTALLED · LCARS REMAINS FULLY USABLE"}</small></span><button onClick={configureVoice}>{health.voice?.available ? "CONFIGURE" : "SET UP"}</button></article>
          <article><i className={prefs.voiceModel ? "ready" : ""}>M</i><span><b>LOCAL SPEECH MODEL</b><small>{prefs.voiceModel ? "MODEL PATH CONFIGURED" : "OPTIONAL GGML MODEL NOT SELECTED"}</small></span><button onClick={configureVoice}>{prefs.voiceModel ? "CHANGE" : "SELECT"}</button></article>
          <article><i className="ready">E</i><span><b>LCARS EXTENSIONS</b><small>DECLARATIVE MODULE BAY · MANUALLY INSTALLED</small></span><button onClick={() => action("extension-folder")}>OPEN BAY</button></article>
        </div>
      </aside>
      <ExtensionHub installed={extensions} catalog={catalog} disabled={disabled} setDisabled={setDisabled} refresh={refreshExtensions} notify={notify} openFolder={()=>action("extension-folder")}/>
      {update?.notes && <details className="release-notes"><summary>RELEASE NOTES · VERSION {update.version}</summary><pre>{update.notes}</pre></details>}
      <DiagnosticsCenter health={health} notify={notify} action={action} />
    </section>
  );
}

function ExtensionHub({installed,catalog,disabled,setDisabled,refresh,notify,openFolder}:{installed:ExtensionManifest[];catalog:ExtensionCatalogEntry[];disabled:string[];setDisabled:(ids:string[])=>void;refresh:()=>void;notify:(text:string,kind?:"info"|"error")=>void;openFolder:()=>void}){
  const [query,setQuery]=useState(""),[busy,setBusy]=useState(""),[expanded,setExpanded]=useState(true);
  const inventory=useMemo(()=>{const known=new Map<string,ExtensionCatalogEntry>();catalog.forEach((entry)=>known.set(entry.id,entry));installed.forEach((extension)=>{if(!known.has(extension.id))known.set(extension.id,{id:extension.id,name:extension.name,version:extension.version,description:extension.description,author:extension.author,capabilities:extension.capabilities,installed:true});});return Array.from(known.values()).filter((entry)=>`${entry.name} ${entry.description} ${entry.author} ${entry.capabilities.join(" ")}`.toLowerCase().includes(query.toLowerCase()));},[catalog,installed,query]);
  const operate=async(entry:ExtensionCatalogEntry,operation:"install"|"remove")=>{setBusy(entry.id);try{const response=await fetch("http://127.0.0.1:8765/api/extension-install",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:entry.id,operation,manifestUrl:entry.manifestUrl||""})}),result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error||"Extension operation failed");notify(result.message||`${entry.name} ${operation} complete`);window.setTimeout(refresh,250);}catch(error){notify(error instanceof Error?error.message:"Extension operation failed","error");}finally{setBusy("");}};
  const isInstalled=(id:string)=>installed.some((extension)=>extension.id===id);
  return <section className="extension-hub"><header><div><small>DECLARATIVE MODULE CONTROL · API V2</small><h4>EXTENSION HUB</h4><p>Browse bundled and locally installed modules, inspect requested capabilities, and disable or remove them without deleting the rest of your configuration.</p></div><strong>{String(installed.length).padStart(2,"0")}<small> INSTALLED</small></strong></header><nav><input aria-label="Search Extension Hub" placeholder="SEARCH EXTENSIONS…" value={query} onChange={(event)=>setQuery(event.target.value)}/><button onClick={refresh}>RESCAN</button><button onClick={openFolder}>OPEN MODULE FOLDER</button><button onClick={()=>setExpanded(!expanded)}>{expanded?"COLLAPSE HUB":"OPEN HUB"}</button></nav>{expanded&&<div className="extension-catalog">{inventory.map((entry,index)=>{const installedNow=isInstalled(entry.id),disabledNow=disabled.includes(entry.id),manifest=installed.find((item)=>item.id===entry.id);return <article className={disabledNow?"disabled":""} key={entry.id}><i>{String(index+1).padStart(2,"0")}</i><span><small>{entry.bundled?"BUNDLED CATALOG":"LOCAL / CATALOG MODULE"}</small><b>{entry.name}</b><p>{entry.description}</p><em>{entry.author} · V{manifest?.version||entry.version} · {(manifest?.capabilities||entry.capabilities).join(" · ")||"NO PRIVILEGED CAPABILITIES"}</em></span><nav>{installedNow?<><button onClick={()=>setDisabled(disabledNow?disabled.filter((id)=>id!==entry.id):[...disabled,entry.id])}>{disabledNow?"ENABLE":"DISABLE"}</button>{!entry.bundled&&<button className="danger" disabled={busy===entry.id} onClick={()=>operate(entry,"remove")}>{busy===entry.id?"WORKING…":"REMOVE"}</button>}</>:<button disabled={busy===entry.id} onClick={()=>operate(entry,"install")}>{busy===entry.id?"INSTALLING…":"INSTALL"}</button>}</nav></article>;})}{!inventory.length&&<p>NO MATCHING EXTENSIONS</p>}</div>}<footer>Extensions are host-rendered from validated manifests. Executable plug-in code is not loaded into the LCARS renderer.</footer></section>;
}

function DiagnosticsCenter({health,notify,action}:{health:Health;notify:(text:string,kind?:"info"|"error")=>void;action:(value:string)=>void}) {
  const [report,setReport]=useState<DiagnosticsReport|null>(null),[busy,setBusy]=useState(false),[expanded,setExpanded]=useState(true);
  const scan=async()=>{setBusy(true);try{const response=await fetch("http://127.0.0.1:8765/api/diagnostics");const data=await response.json();if(!response.ok)throw new Error(data.error||"Diagnostic scan failed");setReport(data);notify("Full local diagnostic scan complete");}catch(error){notify(error instanceof Error?error.message:"Diagnostic scan failed","error");}finally{setBusy(false);}};
  const exportReport=async()=>{setBusy(true);try{const response=await fetch("http://127.0.0.1:8765/api/diagnostics-export",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});const data=await response.json();if(!response.ok)throw new Error(data.error||"Support export failed");notify(data.message||"Privacy-safe support report exported");}catch(error){notify(error instanceof Error?error.message:"Support export failed","error");}finally{setBusy(false);}};
  const matrix=report?.health||health, ready=Object.values(matrix).filter((item)=>item.available).length,total=Object.keys(matrix).length;
  return <aside className="diagnostics-center">
    <header><div><small>OPERATIONS & RECOVERY</small><h4>DIAGNOSTICS CENTER</h4><p>Checks local adapters and creates a privacy-scrubbed support file without collecting personal content.</p></div><strong>{String(ready).padStart(2,"0")}<small>/ {String(total).padStart(2,"0")} READY</small></strong></header>
    <nav><button disabled={busy} onClick={scan}>{busy?"SCANNING…":"RUN FULL CHECK"}</button><button disabled={busy} onClick={exportReport}>EXPORT SAFE SUPPORT REPORT</button><button onClick={()=>action("repair-installation")}>REPAIR INSTALLATION</button><button onClick={()=>setExpanded(!expanded)}>{expanded?"COLLAPSE MATRIX":"SHOW MATRIX"}</button></nav>
    {expanded&&<div className="diagnostic-matrix">{Object.entries(matrix).map(([name,item],index)=><article className={item.available?"ready":"attention"} key={name}><i>{String(index+1).padStart(2,"0")}</i><span><b>{name.replaceAll("_"," ").toUpperCase()}</b><small>{item.detail}</small>{!item.available&&item.remedy&&<em>{item.remedy}</em>}</span><strong>{item.available?"READY":"ACTION"}</strong></article>)}</div>}
    <footer><b>PRIVACY FILTER ACTIVE</b><span>{report?.privacy||"The export excludes usernames, home paths, file names, credentials, terminal history, window titles, and media titles."}</span>{report?.generatedUtc&&<small>LAST FULL CHECK · {new Date(report.generatedUtc).toLocaleString()}</small>}</footer>
  </aside>;
}

function UpdatePanel({
  number,
  eyebrow,
  title,
  status,
  description,
  primary,
  secondary,
  primaryAction,
  secondaryAction,
  stamp,
}: {
  number: string;
  eyebrow: string;
  title: string;
  status: string;
  description: string;
  primary: string;
  secondary: string;
  primaryAction: () => void;
  secondaryAction: () => void;
  stamp?: string;
}) {
  return (
    <article className="update-panel">
      <header>
        <i>{number}</i>
        <span>
          <small>{eyebrow}</small>
          <h4>{title}</h4>
        </span>
        <b>{status}</b>
      </header>
      <p>{description}</p>
      {stamp && (
        <div className="version-stamp">
          <small>{stamp.split(" · ")[0]}</small>
          <b>{stamp.split(" · ")[1]}</b>
        </div>
      )}
      <div className="update-actions">
        <button onClick={primaryAction}>{primary}</button>
        <button onClick={secondaryAction}>{secondary}</button>
      </div>
    </article>
  );
}

function PowerDialog({
  close,
  action,
}: {
  close: () => void;
  action: (value: "exit" | "sleep" | "poweroff" | "reboot") => void;
}) {
  const [confirmPower, setConfirmPower] = useState<
    "sleep" | "poweroff" | "reboot" | null
  >(null);
  if (confirmPower)
    return (
      <div
        className="backdrop power-backdrop"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) setConfirmPower(null);
        }}
      >
        <section
          className="power-dialog confirm"
          role="alertdialog"
          aria-modal="true"
        >
          <header>
            <small>SYSTEM POWER CONFIRMATION</small>
            <h2>
              CONFIRM {confirmPower === "poweroff" ? "SHUTDOWN" : confirmPower === "reboot" ? "RESTART" : "SLEEP"}
            </h2>
          </header>
          <p>
            {confirmPower === "poweroff"
              ? "The computer will turn off and all running applications will close."
              : confirmPower === "reboot"
                ? "The computer will restart and all running applications will close."
                : "The entire computer will enter sleep mode. LCARS and your applications will remain open for resume."}
          </p>
          <div className="power-confirm-actions">
            <button autoFocus onClick={() => action(confirmPower)}>
              {confirmPower === "poweroff"
                ? "SHUT DOWN COMPUTER"
                : confirmPower === "reboot"
                  ? "RESTART COMPUTER"
                  : "SLEEP COMPUTER"}
            </button>
            <button onClick={() => setConfirmPower(null)}>GO BACK</button>
          </div>
        </section>
      </div>
    );
  return (
    <div
      className="backdrop power-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section className="power-dialog" role="dialog" aria-modal="true">
        <header>
          <small>LCARS POWER CONTROL</small>
          <h2>SELECT SHUTDOWN MODE</h2>
          <p>
            Choose whether to close only LCARS or control the entire computer.
          </p>
        </header>
        <div className="power-options">
          <button autoFocus onClick={() => action("exit")}>
            <i>01</i>
            <span>
              <b>EXIT LCARS</b>
              <small>Close the interface; leave the computer running</small>
            </span>
          </button>
          <button onClick={() => setConfirmPower("poweroff")}>
            <i>02</i>
            <span>
              <b>SHUT DOWN COMPUTER</b>
              <small>Close applications and turn off the PC</small>
            </span>
          </button>
          <button onClick={() => setConfirmPower("reboot")}>
            <i>03</i>
            <span>
              <b>RESTART COMPUTER</b>
              <small>Close applications and reboot the PC</small>
            </span>
          </button>
          <button onClick={() => setConfirmPower("sleep")}>
            <i>04</i>
            <span>
              <b>SLEEP COMPUTER</b>
              <small>Suspend the whole PC and resume this session later</small>
            </span>
          </button>
          <button className="power-cancel" onClick={close}>
            <i>05</i>
            <span>
              <b>CANCEL</b>
              <small>Return to the LCARS interface</small>
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}

function DisplayMenu({
  displays,
  move,
  terminal,
  identify,
  configure,
  refresh,
}: {
  displays: Display[];
  move: (d: Display) => void;
  terminal: (d: Display) => void;
  identify: () => void;
  configure: () => void;
  refresh: () => void;
}) {
  const [diagnostics, setDiagnostics] = useState(false);
  const report = displays
    .map(
      (d, i) =>
        `${i + 1}. ${d.name} | ${d.enabled ? "enabled" : "disabled"} | ${d.primary ? "primary" : "secondary"} | ${d.geometry} | ${d.source || "KScreen"}`,
    )
    .join("\n");
  const copy = () =>
    navigator.clipboard
      ?.writeText("LCARS DISPLAY DIAGNOSTICS\n" + report)
      .catch(() => {});
  return (
    <section className="display-menu">
      <header>
        <b>DISPLAY ROUTING</b>
        <small>KSCREEN / KDE OUTPUTS</small>
      </header>
      <div className="monitor-map">
        {displays.map((d, i) => (
          <button
            className={d.primary ? "current" : ""}
            key={d.id}
            onClick={() => move(d)}
          >
            <i>{i + 1}</i>
            <b>{d.name}</b>
            <small>{d.enabled ? "CONNECTED" : "DISABLED"}</small>
          </button>
        ))}
      </div>
      {displays.map((d, i) => (
        <article key={d.id}>
          <i>{i + 1}</i>
          <span>
            <b>{d.name}</b>
            <small>
              {d.geometry}
              {d.primary ? " · PRIMARY" : ""}
            </small>
          </span>
          <nav>
            <button disabled={!d.enabled} onClick={() => move(d)}>
              MOVE LCARS HERE
            </button>
            <button disabled={!d.enabled} onClick={() => terminal(d)}>
              OPEN TERMINAL
            </button>
          </nav>
        </article>
      ))}
      <button
        className="diagnostic-toggle"
        onClick={() => setDiagnostics(!diagnostics)}
      >
        {diagnostics ? "HIDE" : "SHOW"} DISPLAY DIAGNOSTICS
      </button>
      {diagnostics && (
        <div className="display-diagnostics">
          {displays.map((d) => (
            <p key={d.id}>
              <b>{d.name}</b>
              <span>
                {d.enabled ? "ENABLED" : "CONNECTED / DISABLED"} ·{" "}
                {d.primary ? "PRIMARY" : "SECONDARY"}
              </span>
              <small>
                {d.geometry} · SOURCE: {d.source || "KSCREEN"}
              </small>
            </p>
          ))}
          <button onClick={copy}>COPY DIAGNOSTIC REPORT</button>
        </div>
      )}
      <footer>
        <button onClick={refresh}>REFRESH DISPLAYS</button>
        <button onClick={identify}>IDENTIFY</button>
        <button onClick={configure}>CONFIGURE</button>
      </footer>
    </section>
  );
}

function CompatibilityBanner({
  items,
  open,
}: {
  items: { feature: string; reason: string; remedy: string }[];
  open: () => void;
}) {
  return (
    <section className="compat-banner">
      <i>!</i>
      <span>
        <b>{items.map((x) => x.feature).join(" + ")} RESTRICTED</b>
        <small>{items[0].reason}</small>
      </span>
      <button onClick={open}>DETAILS</button>
    </section>
  );
}

function CompatibilityCenter({
  compat,
  close,
}: {
  compat: Compatibility;
  close: () => void;
}) {
  return (
    <div className="backdrop">
      <section className="compat-center">
        <header>
          <div>
            <small>UNIVERSAL LINUX ADAPTER</small>
            <h2>COMPATIBILITY REPORT</h2>
          </div>
          <button onClick={close}>CLOSE ×</button>
        </header>
        <div className="compat-environment">
          <p>
            <small>DISTRIBUTION</small>
            <b>{compat.distro}</b>
          </p>
          <p>
            <small>DESKTOP</small>
            <b>{compat.desktop}</b>
          </p>
          <p>
            <small>SESSION</small>
            <b>{compat.session.toUpperCase()}</b>
          </p>
        </div>
        <div className="capability-grid">
          {Object.entries(compat.capabilities).map(([name, ready]) => (
            <p className={ready ? "ready" : "limited"} key={name}>
              <i>{ready ? "✓" : "!"}</i>
              <span>
                <b>{name.replace(/([A-Z])/g, " $1").toUpperCase()}</b>
                <small>{ready ? "SUPPORTED" : "RESTRICTED"}</small>
              </span>
            </p>
          ))}
        </div>
        {compat.restrictions.length ? (
          <div className="restriction-list">
            {compat.restrictions.map((item) => (
              <article key={item.feature}>
                <i>!</i>
                <span>
                  <b>{item.feature}</b>
                  <p>{item.reason}</p>
                  <small>{item.remedy}</small>
                </span>
              </article>
            ))}
          </div>
        ) : (
          <div className="compat-complete">
            <b>ALL CORE INTEGRATIONS AVAILABLE</b>
            <small>No desktop-specific restrictions were detected.</small>
          </div>
        )}
        <footer>
          <span>
            Restrictions disable only affected controls. LCARS themes,
            applications, terminal, files, profiles, backups, and modules remain
            available.
          </span>
        </footer>
      </section>
    </div>
  );
}

function DesktopExperience({
  profiles,
  activeProfile,
  createProfile,
  applyProfile,
  deleteProfile,
  defaultWorkstation,
  setDefaultWorkstation,
  access,
  saveAccess,
  doNotDisturb,
  setDoNotDisturb,
  sessionRestore,
  setSessionRestore,
  userName,
  setUserName,
  exportConfig,
  importConfig,
  lock,
  lockCredential,
  saveLockPassword,
  removeLockPassword,
  command,
  action,
}: {
  profiles: WorkspaceProfile[];
  activeProfile: string;
  createProfile: () => void;
  applyProfile: (p: WorkspaceProfile) => void;
  deleteProfile: (id: string) => void;
  defaultWorkstation: string;
  setDefaultWorkstation: (id: string) => void;
  access: AccessibilityPrefs;
  saveAccess: (a: AccessibilityPrefs) => void;
  doNotDisturb: boolean;
  setDoNotDisturb: (v: boolean) => void;
  sessionRestore: boolean;
  setSessionRestore: (v: boolean) => void;
  userName: string;
  setUserName: (v: string) => void;
  exportConfig: () => void;
  importConfig: (f: File) => void;
  lock: () => void;
  lockCredential: LockCredential | null;
  saveLockPassword: (password: string) => Promise<void>;
  removeLockPassword: () => void;
  command: () => void;
  action: (a: string) => void;
}) {
  const set = <K extends keyof AccessibilityPrefs>(
    key: K,
    value: AccessibilityPrefs[K],
  ) => saveAccess({ ...access, [key]: value });
  return (
    <section className="experience-settings">
      <header>
        <b>LCARS DESKTOP EXPERIENCE</b>
        <small>PROFILES · ACCESSIBILITY · CONTINUITY · SECURITY</small>
      </header>
      <div className="experience-grid">
        <article>
          <h4>WORKSPACE PROFILES</h4>
          <p>
            Save complete layouts for gaming, work, media, or any other
            activity.
          </p>
          <div className="profile-list">
            {profiles.map((p) => (
              <div
                className={activeProfile === p.id ? "active" : ""}
                key={p.id}
              >
                <button onClick={() => applyProfile(p)}>
                  <b>{p.name}</b>
                  <small>
                    {p.widgets.length} MODULES · {p.theme.toUpperCase()}
                  </small>
                </button>
                <button
                  className={defaultWorkstation === p.id ? "workstation-default" : ""}
                  aria-label={defaultWorkstation === p.id ? "Clear default workstation" : "Set default workstation to " + p.name}
                  onClick={() => setDefaultWorkstation(defaultWorkstation === p.id ? "" : p.id)}
                >
                  {defaultWorkstation === p.id ? "★" : "☆"}
                </button>
                <button
                  aria-label={"Delete " + p.name}
                  onClick={() => deleteProfile(p.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button className="lcars-action" onClick={createProfile}>
            SAVE CURRENT WORKSPACE
          </button>
        </article>
        <article>
          <h4>ACCESSIBILITY</h4>
          <label>
            INTERFACE SCALE <b>{access.fontScale}%</b>
            <small>
              Enlarges LCARS text while preserving the console layout.
            </small>
            <input
              type="range"
              min="85"
              max="140"
              step="5"
              value={access.fontScale}
              onChange={(e) => set("fontScale", +e.target.value)}
            />
          </label>
          <label>
            INTERFACE SOUND <b>{access.soundVolume}%</b>
            <small>Controls LCARS cues separately from system audio.</small>
            <input
              type="range"
              min="0"
              max="100"
              value={access.soundVolume}
              onChange={(e) => set("soundVolume", +e.target.value)}
            />
          </label>
          <Toggle
            label="High contrast"
            description="Strengthens borders, labels, and focus indicators."
            checked={access.highContrast}
            change={(v) => set("highContrast", v)}
          />
          <Toggle
            label="Reduced motion"
            description="Disables animated transitions and pulsing alerts."
            checked={access.reducedMotion}
            change={(v) => set("reducedMotion", v)}
          />
          <Toggle
            label="Color-safe indicators"
            description="Adds shapes and stronger contrast so status never relies on color alone."
            checked={access.colorSafe}
            change={(v) => set("colorSafe", v)}
          />
        </article>
        <article>
          <h4>SESSION & NOTIFICATIONS</h4>
          <Toggle
            label="Restore previous session"
            description="Returns to your last LCARS page and preserves saved workspace state."
            checked={sessionRestore}
            change={setSessionRestore}
          />
          <Toggle
            label="Do Not Disturb"
            description="Stores notices in history without showing temporary pop-ups."
            checked={doNotDisturb}
            change={setDoNotDisturb}
          />
          <button className="lcars-action" onClick={command}>
            OPEN COMMAND PALETTE
          </button>
          <small>Keyboard shortcut: Ctrl + K</small>
        </article>
        <article>
          <h4>OPERATOR & SECURITY</h4>
          <label>
            OPERATOR NAME
            <small>Displayed on the local LCARS lock screen.</small>
            <input
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
            />
          </label>
          <button className="lcars-action" onClick={lock}>
            LOCK LCARS
          </button>
          <small>Keyboard shortcut: Ctrl + Shift + L</small>
          <LockPasswordControl credential={lockCredential} save={saveLockPassword} remove={removeLockPassword} />
          <p>
            The optional password protects LCARS locally. Use your operating-system lock screen for full account security.
          </p>
        </article>
        <article>
          <h4>BACKUP & TRANSFER</h4>
          <p>
            Move themes, layouts, favorites, profiles, and interface settings
            between installations.
          </p>
          <button className="lcars-action" onClick={exportConfig}>
            EXPORT CONFIGURATION
          </button>
          <label className="import-config">
            IMPORT CONFIGURATION
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) =>
                e.target.files?.[0] && importConfig(e.target.files[0])
              }
            />
          </label>
        </article>
      </div>
    </section>
  );
}

function CommandPalette({
  query,
  setQuery,
  commands,
  close,
  findMode,
}: {
  query: string;
  setQuery: (v: string) => void;
  commands: { id: string; label: string; detail: string; run: () => void }[];
  close: () => void;
  findMode: boolean;
}) {
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [query]);
  return (
    <div
      className="backdrop command-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        className="command-palette"
        role="dialog"
        aria-label="LCARS command palette"
      >
        <header>
          <small>UNIVERSAL COMPUTER ACCESS</small>
          <b>{findMode ? "FIND IN LCARS" : "COMMAND PALETTE"}</b>
          <button onClick={close}>ESC</button>
        </header>
        <input
          autoFocus
          placeholder={findMode ? "FIND A SETTING, MODULE, APPLICATION OR PAGE…" : "TYPE A PAGE, APPLICATION, FILE OR COMMAND…"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndex((i) => Math.min(commands.length - 1, i + 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((i) => Math.max(0, i - 1));
            }
            if (e.key === "Enter") commands[index]?.run();
          }}
        />
        <div>
          {commands.map((c, i) => (
            <button
              className={i === index ? "selected" : ""}
              key={c.id}
              onMouseEnter={() => setIndex(i)}
              onClick={c.run}
            >
              <span>
                <b>{c.label}</b>
                <small>{c.detail}</small>
              </span>
              <i>›</i>
            </button>
          ))}
          {!commands.length && <p>NO MATCHING COMMANDS</p>}
        </div>
        <footer>
          <span>↑↓ SELECT</span>
          <span>ENTER EXECUTE</span>
          <span>ESC CLOSE</span>
        </footer>
      </section>
    </div>
  );
}

function LockPasswordControl({credential,save,remove}:{credential:LockCredential|null;save:(password:string)=>Promise<void>;remove:()=>void}) {
  const [password,setPassword]=useState(""),[confirm,setConfirm]=useState(""),[status,setStatus]=useState("");
  const submit=async()=>{if(password.length<4)return setStatus("USE AT LEAST 4 CHARACTERS");if(password!==confirm)return setStatus("PASSWORDS DO NOT MATCH");await save(password);setPassword("");setConfirm("");setStatus("LOCAL PASSWORD SAVED");};
  return <div className="lock-password-control"><small>{credential?"PASSWORD PROTECTION ACTIVE":"PASSWORD PROTECTION OPTIONAL"}</small><input type="password" autoComplete="new-password" placeholder={credential?"NEW PASSWORD":"CREATE PASSWORD"} value={password} onChange={(e)=>setPassword(e.target.value)}/><input type="password" autoComplete="new-password" placeholder="CONFIRM PASSWORD" value={confirm} onChange={(e)=>setConfirm(e.target.value)}/><nav><button onClick={submit}>{credential?"CHANGE PASSWORD":"ENABLE PASSWORD"}</button>{credential&&<button onClick={()=>{remove();setStatus("PASSWORD REMOVED");}}>REMOVE</button>}</nav>{status&&<em>{status}</em>}</div>;
}

function LockScreen({userName,credential,profiles,activeProfile,defaultWorkstation,chooseProfile,setDefaultWorkstation,power,unlock}:{userName:string;credential:LockCredential|null;profiles:WorkspaceProfile[];activeProfile:string;defaultWorkstation:string;chooseProfile:(profile:WorkspaceProfile)=>void;setDefaultWorkstation:(id:string)=>void;power:()=>void;unlock:()=>void}) {
  const [password,setPassword]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const authorize=async()=>{if(!credential)return unlock();setBusy(true);const valid=await verifyLockCredential(password,credential).catch(()=>false);setBusy(false);if(valid)unlock();else{setError("AUTHORIZATION DENIED");setPassword("");}};
  return <div className="lock-screen">
    <header><i/><div/><span>{userName||"LCARS OPERATOR"}</span><b/></header>
    <main>
      <img src={lcarsEmblem} alt="Federation emblem"/>
      <h1>LCARS COMPUTER NETWORK</h1><h2>AUTHORIZED ACCESS ONLY</h2>
      <form onSubmit={(event)=>{event.preventDefault();authorize();}}>
        <div className="lock-operator-code">47</div><label><b>{userName||"LCARS OPERATOR"}</b><small>{credential?"ENTER LOCAL AUTHORIZATION CODE":"PASSWORD PROTECTION IS NOT ENABLED"}</small><input autoFocus type="password" disabled={!credential||busy} autoComplete="current-password" value={password} onChange={(event)=>setPassword(event.target.value)} placeholder={credential?"PASSWORD":"DIRECT ACCESS"}/></label><button type="submit">{busy?"VERIFYING":"ENTER"}</button>
      </form>{error&&<p className="lock-error">{error}</p>}
    </main>
    <section className="lock-workstations"><header><span>AVAILABLE WORKSTATIONS</span><small>SELECT PROFILE · ★ DEFAULT</small></header><div>{profiles.length?profiles.map((profile,index)=><article className={activeProfile===profile.id?"active":""} key={profile.id}><button onClick={()=>chooseProfile(profile)}><i>{String(index+1).padStart(2,"0")}</i><span><b>{profile.name}</b><small>{profile.theme.toUpperCase()} · {profile.widgets.length} MODULES</small></span></button><button className={defaultWorkstation===profile.id?"default":""} aria-label={"Set "+profile.name+" as default"} onClick={()=>setDefaultWorkstation(profile.id)}>{defaultWorkstation===profile.id?"★":"☆"}</button></article>):<p>NO SAVED WORKSTATIONS · CREATE ONE IN SETTINGS</p>}</div></section>
    <footer><i/><button onClick={power}>POWER / EXIT OPTIONS</button><div/><span>{credential?"AUTHORIZATION REQUIRED":"DIRECT LOCAL ACCESS"}</span><b/></footer>
  </div>;
}

function ShellSettings({
  platform,
  prefs,
  extensions,
  customPages,
  routines,
  setPrefs,
  save,
  saved,
  health,
  recheck,
  startupAudioStatus,
  testStartupAudio,
  safeMode,
  quarantinedExtensions,
  clearExtensionQuarantine,
}: {
  platform: string;
  prefs: ShellPrefs;
  extensions: ExtensionManifest[];
  customPages: CustomPage[];
  routines: Routine[];
  setPrefs: (p: ShellPrefs) => void;
  save: () => void;
  saved: boolean;
  health: Health;
  recheck: () => void;
  startupAudioStatus: string;
  testStartupAudio: () => void | Promise<void>;
  safeMode: boolean;
  quarantinedExtensions: string[];
  clearExtensionQuarantine: () => void;
}) {
  const set = <K extends keyof ShellPrefs>(key: K, value: ShellPrefs[K]) =>
    setPrefs({ ...prefs, [key]: value });
  return (
    <div className="shell-settings">
      <header>
        <b>DESKTOP SHELL CONTROL</b>
        <small>TASK RAIL · TERMINAL · RECOVERY</small>
      </header>
      <div className="settings-columns">
        <section>
          <h4>TASK RAIL & NOTICES</h4>
          <div className="page-density-settings">
            <label>PAGE SIZE CONTROL<small>Uses one layout size everywhere or remembers a separate Compact, Standard, or Wide layout for each major page.</small><select value={prefs.pageDensityScope} onChange={(event)=>set("pageDensityScope",event.target.value as ShellPrefs["pageDensityScope"])}><option value="global">ONE SIZE FOR ALL PAGES</option><option value="per-page">CHOOSE EACH PAGE</option></select></label>
            <label>DEFAULT PAGE SIZE<small>Compact shows more controls, Standard balances space, and Wide gives panels more breathing room.</small><select value={prefs.pageDensity} onChange={(event)=>set("pageDensity",event.target.value as PageDensity)}><option value="compact">COMPACT</option><option value="standard">STANDARD</option><option value="wide">WIDE</option></select></label>
            {prefs.pageDensityScope==="per-page"&&<div className="page-density-matrix">{nav.map((item)=><label key={item[0]}><span>{item[1]} {item[2]}</span><select value={prefs.pageDensities[item[0]]||prefs.pageDensity} onChange={(event)=>set("pageDensities",{...prefs.pageDensities,[item[0]]:event.target.value as PageDensity})}><option value="compact">COMPACT</option><option value="standard">STANDARD</option><option value="wide">WIDE</option></select></label>)}</div>}
          </div>
          <Toggle label="Play startup power sequence" description="Plays the bundled LCARS power-up sound when the desktop app opens. It never delays the interface." checked={prefs.startupSound} change={(v) => set("startupSound", v)} />
          <div className="startup-audio-diagnostic"><button onClick={testStartupAudio}>TEST POWER-UP AUDIO</button><small>{startupAudioStatus}</small><em>ASSET: LCARS BUNDLED MP3 · OUTPUT: OPERATING-SYSTEM DEFAULT</em></div>
          <Toggle label="Show background startup telemetry" description="Shows a small nonblocking system-check strip while LCARS connects to local services." checked={prefs.startupSequence} change={(v) => set("startupSequence", v)} />
          <label>SYSTEM TRAY PRESENTATION<small>Places the same tray drawer trigger in the side rail or the compact SYS 47 header position.</small><select value={prefs.trayPresentation} onChange={(event)=>set("trayPresentation",event.target.value as ShellPrefs["trayPresentation"])}><option value="rail">SIDE RAIL</option><option value="header">HEADER / SYS 47</option></select></label>
          <SpeedDialEditor items={prefs.speedDial} extensions={extensions} customPages={customPages} routines={routines} change={(items)=>set("speedDial",items)} />
          <label>LCARS UPDATE CHANNEL<small>Stable receives whole-number public releases. Development opts into dot-number test builds for the next major release.</small><select value={prefs.updateChannel} onChange={(event)=>set("updateChannel",event.target.value as ShellPrefs["updateChannel"])}><option value="stable">STABLE · WHOLE-NUMBER RELEASES</option><option value="development">DEVELOPMENT · TEST BUILDS</option></select></label>
          <Toggle label="Show lock screen on startup" description="Opens normal LCARS windows at the themed authorization screen. Remote Terminal windows always bypass it." checked={prefs.lockOnLaunch} change={(v) => set("lockOnLaunch", v)} />
          {prefs.lockOnLaunch && <div className="subordinate-setting"><Toggle label="Quick boot when no password is set" description="Enters LCARS directly only when no local lock password exists." checked={prefs.quickBootWithoutPassword} change={(v) => set("quickBootWithoutPassword", v)} /></div>}
          <Toggle
            label="Reveal task rail on hover"
            description="Temporarily opens the task list when your pointer enters its area."
            checked={prefs.taskHover}
            change={(v) => set("taskHover", v)}
          />
          <Toggle
            label="Hide after selecting a window"
            description="Closes an unlocked task list after switching applications."
            checked={prefs.taskAutoHide}
            change={(v) => set("taskAutoHide", v)}
          />
          <Toggle
            label="Keep task rail pinned open"
            description="Keeps tasks visible at all times, overriding hover behavior."
            checked={prefs.taskPinned}
            change={(v) => set("taskPinned", v)}
          />
          <Toggle
            label="Group windows by monitor"
            description="Organizes open applications beneath the display they occupy."
            checked={prefs.groupByMonitor}
            change={(v) => set("groupByMonitor", v)}
          />
          <label>
            HOVER DELAY <b>{prefs.hoverDelay} MS</b>
            <small>
              How long the pointer must rest over the rail before it opens.
            </small>
            <input
              type="range"
              min="100"
              max="1000"
              step="50"
              value={prefs.hoverDelay}
              onChange={(e) => set("hoverDelay", +e.target.value)}
            />
          </label>
          <label>
            NOTIFICATION DURATION <b>{prefs.notificationSeconds} SEC</b>
            <small>How long notices stay visible unless closed early.</small>
            <input
              type="range"
              min="1"
              max="30"
              value={prefs.notificationSeconds}
              onChange={(e) => set("notificationSeconds", +e.target.value)}
            />
          </label>
        </section>
        <section>
          <h4>OFFLINE VOICE CONTROL</h4>
          <Toggle label="Enable push-to-talk" description="Shows a local microphone control. Audio is sent only to the loopback bridge and processed by whisper.cpp on this PC." checked={prefs.voiceEnabled} change={(v) => set("voiceEnabled", v)} />
          <Toggle label="Require 'Computer' wake phrase" description="Ignores recognized commands that do not begin with Computer." checked={prefs.voiceWakePhrase} change={(v) => set("voiceWakePhrase", v)} />
          <label>WHISPER.CPP EXECUTABLE<small>Full local path to whisper-cli (or compatible whisper.cpp CLI).</small><input value={prefs.voiceEngine} placeholder="/usr/bin/whisper-cli" onChange={(e) => set("voiceEngine", e.target.value)} /></label>
          <label>LOCAL MODEL FILE<small>Full path to a downloaded whisper.cpp GGML model. Models are not uploaded.</small><input value={prefs.voiceModel} placeholder="~/Models/ggml-base.en.bin" onChange={(e) => set("voiceModel", e.target.value)} /></label>
          <VoiceDeviceSelect value={prefs.voiceDevice} change={(value) => set("voiceDevice", value)} />
          <label>VOICE AUTHORITY<small>Higher levels permit more command categories; power and unmount commands always require confirmation.</small><select value={prefs.voiceSecurity} onChange={(e) => set("voiceSecurity", e.target.value as ShellPrefs["voiceSecurity"])}><option value="navigation">NAVIGATION ONLY</option><option value="applications">NAVIGATION + APPLICATIONS</option><option value="system">SYSTEM CONTROL</option></select></label>
          <div className="voice-training"><small>COMMAND TRAINING</small><p>“Computer, open Media” · “Show Systems” · “Launch Spotify” · “Check updates”</p><p>Use the exact visible application name for launching. Protected power and removable-storage commands always continue in a confirmation panel.</p></div>
        </section>
        <section>
          <h4>EMBEDDED TERMINAL</h4>
          <label>
            DEFAULT SHELL
            <small>
              The command interpreter used for every new terminal tab.
            </small>
            <input
              value={prefs.terminalShell}
              onChange={(e) => set("terminalShell", e.target.value)}
            />
          </label>
          <label>
            STARTING DIRECTORY
            <small>
              The folder new terminal sessions open inside; ~ means your home
              folder.
            </small>
            <input
              value={prefs.terminalDirectory}
              onChange={(e) => set("terminalDirectory", e.target.value)}
            />
          </label>
          <label>
            FONT SIZE <b>{prefs.terminalFontSize} PX</b>
            <small>
              Changes the terminal text size without affecting the rest of
              LCARS.
            </small>
            <input
              type="range"
              min="10"
              max="24"
              value={prefs.terminalFontSize}
              onChange={(e) => set("terminalFontSize", +e.target.value)}
            />
          </label>
          <label>
            CURSOR STYLE
            <small>
              Selects the shape of the blinking terminal input cursor.
            </small>
            <select
              value={prefs.terminalCursor}
              onChange={(e) => set("terminalCursor", e.target.value)}
            >
              <option value="block">BLOCK</option>
              <option value="bar">BAR</option>
              <option value="underline">UNDERLINE</option>
            </select>
          </label>
          <label>
            NEW TERMINAL TARGET
            <small>
              Chooses whether New Session stays here or opens on the other
              monitor.
            </small>
            <select
              value={prefs.terminalTarget}
              onChange={(e) => set("terminalTarget", e.target.value)}
            >
              <option value="current">CURRENT DISPLAY</option>
              <option value="other">OTHER DISPLAY</option>
            </select>
          </label>
          <Toggle
            label="Confirm before ending a session"
            description="Asks before closing a tab so running commands are not stopped accidentally."
            checked={prefs.confirmTerminalClose}
            change={(v) => set("confirmTerminalClose", v)}
          />
          <Toggle
            label="Persist command history"
            description="Allows shell command history to remain available between sessions."
            checked={prefs.terminalHistory}
            change={(v) => set("terminalHistory", v)}
          />
        </section>
        <section>
          <h4>SHELL & RECOVERY</h4>
          <p>
            LCARS uses safe full-screen application mode. Separate Shell Mode
            and startup diagnostic-console toggles were removed because the
            standalone desktop application no longer requires them.
          </p>
          <p>
            {platform.includes("WINDOWS") ? (
              <>
                Use <b>Recovery Control</b> to restore Windows Explorer at any
                time.
              </>
            ) : (
              <>
                Press <b>Meta + Shift + Escape</b> to restore Plasma at any
                time.
              </>
            )}
          </p>
          <div className="recovery-code">
            <small>RECOVERY LINK</small>
            <b>ARMED</b>
          </div>
          <RecoveryControls safeMode={safeMode} quarantinedExtensions={quarantinedExtensions} clearExtensionQuarantine={clearExtensionQuarantine} />
          <h4>INTEGRATION HEALTH</h4>
          <p>Shows whether each local service needed by LCARS is available.</p>
          <div className="health-grid">
            {Object.entries(health).map(([name, item]) => (
              <p key={name}>
                <i className={item.available ? "ok" : "bad"} />
                <span>
                  <b>{name.replaceAll("_", " ").toUpperCase()}</b>
                  <small>{item.detail}</small>
                </span>
              </p>
            ))}
          </div>
          <button className="recheck" onClick={recheck}>
            RECHECK / REPAIR
          </button>
        </section>
      </div>
      <button className="settings-save" onClick={save}>
        {saved ? "SETTINGS SAVED ✓" : "SAVE INTERFACE SETTINGS"}
      </button>
    </div>
  );
}

function RecoveryControls({safeMode,quarantinedExtensions,clearExtensionQuarantine}:{safeMode:boolean;quarantinedExtensions:string[];clearExtensionQuarantine:()=>void}) {
  const [snapshots,setSnapshots]=useState<RecoverySnapshot[]>(()=>typeof window==="undefined"?[]:readRecoverySnapshots()),[status,setStatus]=useState(safeMode?"SAFE MODE ACTIVE · EXTENSIONS AND SAVED VISUAL SETTINGS ARE BYPASSED":"NORMAL STARTUP MODE");
  const snapshot=()=>{setSnapshots(createRecoverySnapshot("Manual recovery point"));setStatus("RECOVERY POINT CREATED");};
  const restoreAndReload=async(values:Record<string,string>)=>{restoreRecoveryValues(values);sessionStorage.removeItem("lcars-safe-mode");try{const shellPrefs=JSON.parse(values["lcars-shell-prefs"]||"{}");await fetch("http://127.0.0.1:8765/api/config",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({shell_prefs:shellPrefs})});}catch{}location.reload();};
  const restore=(item:RecoverySnapshot)=>{createRecoverySnapshot("Before recovery restore");void restoreAndReload(item.values);};
  const startSafe=()=>{sessionStorage.setItem("lcars-safe-mode","1");location.reload();};
  const leaveSafe=()=>{sessionStorage.removeItem("lcars-safe-mode");location.reload();};
  const restoreLastGood=()=>{try{const value=JSON.parse(localStorage.getItem("lcars-last-known-good")||"null");if(!value?.values)throw new Error();createRecoverySnapshot("Before last-known-good restore");void restoreAndReload(value.values);}catch{setStatus("NO LAST-KNOWN-GOOD CONFIGURATION IS AVAILABLE");}};
  return <section className="recovery-controls">
    <header><span><b>SAFE STARTUP</b><small>{status}</small></span><i className={safeMode?"attention":"ready"}>{safeMode?"SAFE":"READY"}</i></header>
    <p>Safe Mode starts with the built-in theme, default layout, and no extensions. Your saved configuration remains untouched.</p>
    <nav>{safeMode?<button onClick={leaveSafe}>RETURN TO NORMAL MODE</button>:<button onClick={startSafe}>RESTART IN SAFE MODE</button>}<button onClick={restoreLastGood}>RESTORE LAST KNOWN GOOD</button><button onClick={snapshot}>CREATE RECOVERY POINT</button></nav>
    <div className="recovery-snapshots"><small>AUTOMATIC CONFIGURATION SNAPSHOTS · MAXIMUM 5</small>{snapshots.length?snapshots.map((item)=><article key={item.id}><span><b>{item.reason}</b><small>{new Date(item.created).toLocaleString()}</small></span><button onClick={()=>restore(item)}>RESTORE</button></article>):<p>NO SNAPSHOTS YET · ONE IS CREATED BEFORE SAVES, IMPORTS, AND WORKSTATION CHANGES</p>}</div>
    <div className="extension-quarantine"><span><b>EXTENSION QUARANTINE</b><small>{quarantinedExtensions.length?`${quarantinedExtensions.length} MODULE(S) ISOLATED · ${quarantinedExtensions.join(", ")}`:"NO EXTENSION FAILURES ISOLATED"}</small></span><button disabled={!quarantinedExtensions.length} onClick={clearExtensionQuarantine}>RETRY MODULES</button></div>
  </section>;
}

function SpeedDialEditor({items,extensions,customPages,routines,change}:{items:SpeedDialItem[];extensions:ExtensionManifest[];customPages:CustomPage[];routines:Routine[];change:(items:SpeedDialItem[])=>void}) {
  const choices=[...speedDialChoices,...extensions.map((extension)=>({id:`module:ext:${extension.id}` as SpeedDialItem,label:`${extension.name.toUpperCase()} MODULE`,description:"Open extension in a focused module"})),...customPages.map((page)=>({id:`page:custom:${page.id}` as SpeedDialItem,label:page.name.toUpperCase(),description:"Open custom sidebar Page Peek"})),...routines.map((routine)=>({id:`routine:${routine.id}` as SpeedDialItem,label:routine.name.toUpperCase(),description:`Preview and run ${routine.steps.length}-step routine`}))];
  const replace=(index:number,value:SpeedDialItem)=>change(items.map((item,itemIndex)=>itemIndex===index?value:item));
  const move=(index:number,direction:number)=>{const target=index+direction;if(target<0||target>=items.length)return;const next=[...items];[next[index],next[target]]=[next[target],next[index]];change(next);};
  const add=()=>{const unused=choices.find((choice)=>!items.includes(choice.id))?.id||"page:settings";change([...items,unused].slice(0,8));};
  return <section className="speed-dial-editor"><header><span><b>SPEED DIAL MODULES</b><small>Choose two to eight Page Peeks, focused modules, routines, or actions for the bottom-right control strip and arrange their order.</small></span><em>{items.length}/8</em></header><div>{items.map((item,index)=><article key={`${index}:${item}`}><i>{String(index+1).padStart(2,"0")}</i><label><span>SLOT {index+1}</span><select aria-label={`Speed Dial slot ${index+1}`} value={item} onChange={(event)=>replace(index,event.target.value as SpeedDialItem)}>{choices.map((choice)=><option value={choice.id} key={choice.id}>{choice.label} — {choice.description}</option>)}</select></label><nav><button aria-label="Move shortcut left" disabled={index===0} onClick={()=>move(index,-1)}>‹</button><button aria-label="Move shortcut right" disabled={index===items.length-1} onClick={()=>move(index,1)}>›</button><button aria-label="Remove shortcut" disabled={items.length<=2} onClick={()=>change(items.filter((_,itemIndex)=>itemIndex!==index))}>×</button></nav></article>)}</div><button disabled={items.length>=8} onClick={add}>+ ADD SPEED DIAL SLOT</button></section>;
}

function TrayCommandDeckEditor({shortcuts,apps,routines,customPages,change}:{shortcuts:TrayShortcut[];apps:App[];routines:Routine[];customPages:CustomPage[];change:(items:TrayShortcut[])=>void}){
  const [kind,setKind]=useState<TrayShortcut["kind"]>("page"),[target,setTarget]=useState("overview"),[label,setLabel]=useState("STATUS");
  const choices=(selected:TrayShortcut["kind"])=>selected==="app"?apps.map((app)=>({value:app.id,label:app.name})):selected==="routine"?routines.map((routine)=>({value:routine.id,label:routine.name})):[...nav.map((page)=>({value:page[0],label:page[2]})),...customPages.map((page)=>({value:`custom:${page.id}`,label:page.name}))];
  const setSource=(nextKind:TrayShortcut["kind"])=>{const first=choices(nextKind)[0];setKind(nextKind);setTarget(first?.value||"");setLabel((first?.label||nextKind).slice(0,24).toUpperCase());};
  const add=()=>{if(shortcuts.length>=24||!target)return;change([...shortcuts,{id:createV25Id("tray"),kind,target,label:(label.trim()||choices(kind).find((item)=>item.value===target)?.label||"COMMAND").slice(0,24)}]);};
  const update=(id:string,patch:Partial<TrayShortcut>)=>change(shortcuts.map((item)=>item.id===id?{...item,...patch}:item));
  const move=(index:number,direction:number)=>{const destination=index+direction;if(destination<0||destination>=shortcuts.length)return;const next=[...shortcuts];[next[index],next[destination]]=[next[destination],next[index]];change(next);};
  return <section className="tray-command-editor v25-settings-panel"><header><div><small>STATUSNOTIFIER + OPERATOR COMMANDS</small><h4>TRAY COMMAND DECK</h4><p>Mix desktop tray services with up to 24 application, routine, and LCARS page buttons. The live deck scrolls whenever the combined list exceeds its bay.</p></div><b>{shortcuts.length}/24</b></header><div className="tray-command-create"><label>COMMAND TYPE<select value={kind} onChange={(event)=>setSource(event.target.value as TrayShortcut["kind"])}><option value="page">LCARS PAGE</option><option value="app">APPLICATION</option><option value="routine">ROUTINE</option></select></label><label>DESTINATION<select value={target} onChange={(event)=>{setTarget(event.target.value);const match=choices(kind).find((item)=>item.value===event.target.value);if(match)setLabel(match.label.toUpperCase().slice(0,24));}}>{choices(kind).map((item)=><option value={item.value} key={item.value}>{item.label}</option>)}</select></label><label>BUTTON LABEL<input maxLength={24} value={label} onChange={(event)=>setLabel(event.target.value)}/></label><button disabled={!target||shortcuts.length>=24} onClick={add}>ADD COMMAND</button></div><div className="tray-command-list">{shortcuts.map((shortcut,index)=>{const options=choices(shortcut.kind),targetPresent=options.some((item)=>item.value===shortcut.target);return <article key={shortcut.id}><i>{String(index+1).padStart(2,"0")}</i><input aria-label={`Label for tray command ${index+1}`} maxLength={24} value={shortcut.label} onChange={(event)=>update(shortcut.id,{label:event.target.value})}/><select aria-label={`Type for tray command ${index+1}`} value={shortcut.kind} onChange={(event)=>{const nextKind=event.target.value as TrayShortcut["kind"],first=choices(nextKind)[0];update(shortcut.id,{kind:nextKind,target:first?.value||"",label:(first?.label||nextKind).toUpperCase().slice(0,24)});}}><option value="page">PAGE</option><option value="app">APP</option><option value="routine">ROUTINE</option></select><select aria-label={`Destination for tray command ${index+1}`} value={shortcut.target} onChange={(event)=>update(shortcut.id,{target:event.target.value})}>{!targetPresent&&<option value={shortcut.target}>UNAVAILABLE · {shortcut.target}</option>}{options.map((item)=><option value={item.value} key={item.value}>{item.label}</option>)}</select><nav><button disabled={index===0} onClick={()=>move(index,-1)}>↑</button><button disabled={index===shortcuts.length-1} onClick={()=>move(index,1)}>↓</button><button onClick={()=>change(shortcuts.filter((item)=>item.id!==shortcut.id))}>REMOVE</button></nav></article>;})}{!shortcuts.length&&<p>NO OPERATOR COMMANDS ASSIGNED · DESKTOP SERVICES WILL STILL APPEAR</p>}</div></section>;
}

function ControlMappingEditor({mappings,routines,change}:{mappings:ControlMapping[];routines:Routine[];change:(items:ControlMapping[])=>void}){
  const targets=[...nav.map((page)=>({value:`page:${page[0]}`,label:`OPEN ${page[2]}`})),{value:"action:routines",label:"OPERATIONS AUTOMATION"},{value:"action:communications",label:"COMMUNICATIONS CENTER"},{value:"action:tray",label:"TRAY COMMAND DECK"},{value:"action:dnd",label:"TOGGLE DO NOT DISTURB"},...routines.map((routine)=>({value:`routine:${routine.id}`,label:`RUN ${routine.name}`}))];
  const update=(id:string,patch:Partial<ControlMapping>)=>change(mappings.map((item)=>item.id===id?{...item,...patch}:item));
  const add=()=>{if(mappings.length>=24)return;change([...mappings,{id:createV25Id("mapping"),shortcut:`CTRL+ALT+${Math.min(9,mappings.length+1)}`,target:"action:routines",label:"OPERATIONS AUTOMATION",enabled:true}]);};
  return <section className="control-mapping-editor v25-settings-panel"><header><div><small>KEYBOARD / CONTROL SURFACE ADAPTER</small><h4>CONTROL MAPPINGS</h4><p>Assign keyboard combinations to pages, routines, and command centers. Select a key field, then press the complete combination you want to use.</p></div><b>{mappings.length}/24</b></header><div>{mappings.map((mapping,index)=><article key={mapping.id}><label className="mapping-enabled"><input type="checkbox" checked={mapping.enabled} onChange={(event)=>update(mapping.id,{enabled:event.target.checked})}/><span>{String(index+1).padStart(2,"0")}</span></label><input className="mapping-shortcut" readOnly value={mapping.shortcut} aria-label={`Keyboard mapping ${index+1}`} onKeyDown={(event)=>{event.preventDefault();event.stopPropagation();const shortcut=eventShortcut(event.nativeEvent);if(shortcut&&!shortcut.endsWith("CTRL")&&!shortcut.endsWith("ALT")&&!shortcut.endsWith("SHIFT")&&!shortcut.endsWith("META"))update(mapping.id,{shortcut});}}/><select value={mapping.target} onChange={(event)=>{const selected=targets.find((item)=>item.value===event.target.value);update(mapping.id,{target:event.target.value,label:selected?.label||mapping.label});}}>{!targets.some((item)=>item.value===mapping.target)&&<option value={mapping.target}>UNAVAILABLE · {mapping.label}</option>}{targets.map((target)=><option value={target.value} key={target.value}>{target.label}</option>)}</select><button onClick={()=>change(mappings.filter((item)=>item.id!==mapping.id))}>REMOVE</button></article>)}</div><button disabled={mappings.length>=24} onClick={add}>+ ADD CONTROL MAPPING</button></section>;
}

function RoutineCenter({routines,apps,profiles,devices,players,running,save,request,close}:{routines:Routine[];apps:App[];profiles:WorkspaceProfile[];devices:AudioDevice[];players:Player[];running:string;save:(items:Routine[])=>void;request:(routine:Routine)=>void;close:()=>void}){
  const [selected,setSelected]=useState(routines[0]?.id||"");
  const routine=routines.find((item)=>item.id===selected)||null;
  useEffect(()=>{if(selected&&!routines.some((item)=>item.id===selected))setSelected(routines[0]?.id||"");},[routines,selected]);
  const update=(patch:Partial<Routine>)=>{if(!routine)return;save(routines.map((item)=>item.id===routine.id?{...item,...patch}:item));};
  const add=()=>{const item:Routine={id:createV25Id("routine"),name:`ROUTINE ${routines.length+1}`,description:"Operator-defined LCARS command sequence",color:"orange",enabled:true,trigger:{type:"manual"},steps:[{id:createV25Id("step"),kind:"page",target:"overview"}]};save([...routines,item]);setSelected(item.id);};
  const stepChoices=(kind:RoutineStepKind)=>kind==="page"?nav.map((page)=>({value:page[0],label:page[2]})):kind==="app"?apps.map((app)=>({value:app.id,label:app.name})):kind==="workstation"?profiles.map((profile)=>({value:profile.id,label:profile.name})):kind==="theme"?themes.map((theme)=>({value:theme[0],label:theme[1]})):kind==="dnd"?[{value:"true",label:"ENABLE"},{value:"false",label:"DISABLE"}]:kind==="audio-device"?devices.map((device)=>({value:device.id,label:`${device.kind.toUpperCase()} · ${device.name}`})):kind==="media"?[...players.flatMap((player)=>["play-pause","previous","next","stop"].map((command)=>({value:`${player.id}|${command}`,label:`${player.name} · ${command.toUpperCase()}`}))),{value:"play-pause",label:"ACTIVE PLAYER · PLAY/PAUSE"}]:kind==="system"?[{value:"sleep",label:"SLEEP COMPUTER"},{value:"reboot",label:"RESTART COMPUTER"},{value:"poweroff",label:"SHUT DOWN COMPUTER"}]:kind==="command"?[{value:"refresh-applications",label:"REFRESH APPLICATION INVENTORY"},{value:"integration-recheck",label:"RECHECK LOCAL INTEGRATIONS"},{value:"open-system-monitor",label:"OPEN SYSTEM MONITOR"},{value:"open-software-center",label:"OPEN SOFTWARE CENTER"}]:[];
  const addStep=()=>{if(!routine||routine.steps.length>=24)return;update({steps:[...routine.steps,{id:createV25Id("step"),kind:"page",target:"overview"}]});};
  const updateStep=(id:string,patch:Partial<RoutineStep>)=>routine&&update({steps:routine.steps.map((step)=>step.id===id?{...step,...patch}:step)});
  const moveStep=(index:number,direction:number)=>{if(!routine)return;const target=index+direction;if(target<0||target>=routine.steps.length)return;const steps=[...routine.steps];[steps[index],steps[target]]=[steps[target],steps[index]];update({steps});};
  const triggerNeedsValue=routine?.trigger.type!=="manual"&&routine?.trigger.type!=="startup";
  return <div className="backdrop routine-center-backdrop" onMouseDown={(event)=>event.target===event.currentTarget&&close()}><section className="routine-center" role="dialog" aria-modal="true"><header><div><small>VERSION 25 OPERATIONS AUTOMATION</small><h2>ROUTINE COMMAND CENTER</h2><p>Compose multi-step local workflows. Every run opens a readable preview, and power or approved-command steps require explicit operator confirmation.</p></div><button onClick={close}>CLOSE ×</button></header><div className="routine-center-layout"><aside><button onClick={add}>+ NEW ROUTINE</button>{routines.map((item,index)=><button className={item.id===selected?"active":""} key={item.id} onClick={()=>setSelected(item.id)}><i>{String(index+1).padStart(2,"0")}</i><span><b>{item.name}</b><small>{item.steps.length} STEPS · {item.trigger.type.toUpperCase()}</small></span><em className={`routine-color-${item.color}`}/></button>)}{!routines.length&&<p>NO ROUTINES CONFIGURED</p>}</aside>{routine?<main><div className="routine-fields"><label>ROUTINE NAME<input maxLength={40} value={routine.name} onChange={(event)=>update({name:event.target.value})}/></label><label>DESCRIPTION<input maxLength={160} value={routine.description} onChange={(event)=>update({description:event.target.value})}/></label><label>COLOR<select value={routine.color} onChange={(event)=>update({color:event.target.value as Routine["color"]})}><option value="orange">ORANGE</option><option value="gold">GOLD</option><option value="violet">VIOLET</option><option value="blue">BLUE</option><option value="pink">PINK</option></select></label><label>TRIGGER<select value={routine.trigger.type} onChange={(event)=>update({trigger:{type:event.target.value as Routine["trigger"]["type"]}})}><option value="manual">MANUAL ONLY</option><option value="startup">LCARS STARTUP</option><option value="time">DAILY TIME</option><option value="app">APPLICATION DETECTED</option><option value="device">AUDIO DEVICE DETECTED</option></select></label>{triggerNeedsValue&&<label>TRIGGER VALUE<input type={routine.trigger.type==="time"?"time":"text"} value={routine.trigger.value||""} placeholder={routine.trigger.type==="app"?"APPLICATION NAME":"DEVICE NAME"} onChange={(event)=>update({trigger:{...routine.trigger,value:event.target.value}})}/></label>}<Toggle label="Routine enabled" checked={routine.enabled} change={(enabled)=>update({enabled})}/></div><section className="routine-steps"><header><div><small>EXECUTION ORDER</small><h3>ROUTINE STEPS</h3></div><b>{routine.steps.length}/24</b></header>{routine.steps.map((step,index)=>{const choices=stepChoices(step.kind),selectable=choices.length>0;return <article key={step.id}><i>{String(index+1).padStart(2,"0")}</i><select value={step.kind} onChange={(event)=>{const kind=event.target.value as RoutineStepKind,first=stepChoices(kind)[0];updateStep(step.id,{kind,target:first?.value||"",value:undefined});}}><option value="page">OPEN PAGE</option><option value="app">LAUNCH APP</option><option value="workstation">RESTORE WORKSTATION</option><option value="theme">CHANGE THEME</option><option value="dnd">DO NOT DISTURB</option><option value="volume">SET VOLUME</option><option value="audio-device">AUDIO DEVICE</option><option value="media">MEDIA CONTROL</option><option value="wait">WAIT</option><option value="command">APPROVED COMMAND</option><option value="system">SYSTEM POWER</option></select>{selectable?<select value={step.target} onChange={(event)=>updateStep(step.id,{target:event.target.value,value:event.target.value})}>{!choices.some((choice)=>choice.value===step.target)&&<option value={step.target}>UNAVAILABLE · {step.target}</option>}{choices.map((choice)=><option value={choice.value} key={choice.value}>{choice.label}</option>)}</select>:<label className="step-value"><span>{step.kind==="volume"?"PERCENT":"MILLISECONDS"}</span><input type="number" min="0" max={step.kind==="volume"?100:30000} value={Number(step.value??step.target)||0} onChange={(event)=>updateStep(step.id,{target:event.target.value,value:Number(event.target.value)})}/></label>}<nav><button disabled={index===0} onClick={()=>moveStep(index,-1)}>↑</button><button disabled={index===routine.steps.length-1} onClick={()=>moveStep(index,1)}>↓</button><button disabled={routine.steps.length<=1} onClick={()=>update({steps:routine.steps.filter((item)=>item.id!==step.id)})}>×</button></nav></article>;})}<button disabled={routine.steps.length>=24} onClick={addStep}>+ ADD STEP</button></section><footer><button className="danger" onClick={()=>{save(routines.filter((item)=>item.id!==routine.id));setSelected("");}}>DELETE ROUTINE</button><button disabled={!routine.steps.length||running===routine.id} onClick={()=>request(routine)}>{running===routine.id?"ROUTINE RUNNING…":"PREVIEW ROUTINE"}</button></footer></main>:<div className="adaptive-empty"><b>CREATE AN OPERATIONS ROUTINE</b><small>Start with a page change, then add applications, audio controls, workstation restore, or guarded system actions.</small></div>}</div></section></div>;
}

function RoutinePreview({routine,describe,running,cancel,run}:{routine:Routine;describe:(step:RoutineStep)=>string;running:boolean;cancel:()=>void;run:()=>void}){
  const protectedSteps=routineNeedsConfirmation(routine);
  return <div className="backdrop routine-preview-backdrop" onMouseDown={(event)=>event.target===event.currentTarget&&!running&&cancel()}><section className="routine-preview" role="alertdialog" aria-modal="true"><header><div><small>{protectedSteps?"PROTECTED OPERATOR CONFIRMATION":"ROUTINE EXECUTION PREVIEW"}</small><h2>{routine.name}</h2><p>{routine.description||"Operator-defined LCARS routine"}</p></div><i className={protectedSteps?"protected":"ready"}>{protectedSteps?"CONFIRM":"READY"}</i></header><ol>{routine.steps.map((step,index)=><li key={step.id}><i>{String(index+1).padStart(2,"0")}</i><span><b>{describe(step)}</b><small>{step.kind.toUpperCase()}{step.kind==="system"||step.kind==="command"?" · PROTECTED":""}</small></span></li>)}</ol><footer><button disabled={running} onClick={cancel}>CANCEL</button><button className={protectedSteps?"protected":""} disabled={running} onClick={run}>{running?"EXECUTING…":protectedSteps?"CONFIRM & RUN":"RUN ROUTINE"}</button></footer></section></div>;
}

function SpeedDialPagePeek({page,pinned,customPages,apps,players,network,meters,update,notices,bridge,volume,doNotDisturb,mediaControl,launch,togglePinned,close,openFull}:{page:string;pinned:boolean;customPages:CustomPage[];apps:App[];players:Player[];network:NetworkInfo;meters:(string|number)[][];update:UpdateInfo|null;notices:Notice[];bridge:boolean;volume:number;doNotDisturb:boolean;mediaControl:(player:string,command:string)=>void;launch:(app:App)=>void;togglePinned:()=>void;close:()=>void;openFull:(page:string)=>void}){
  const custom=page.startsWith("custom:")?customPages.find((item)=>item.id===page.slice(7)):undefined;
  const title=custom?.name||nav.find((item)=>item[0]===page)?.[2]||page.replace(/^custom:/,"").toUpperCase();
  const content=page==="overview"?<div className="peek-meter-list">{meters.map((meter)=><span key={String(meter[0])}><b>{meter[0]}</b><i><em style={{width:`${Number(meter[1])||0}%`}}/></i><strong>{meter[1]}%</strong></span>)}</div>:page==="system"?<div className="peek-meter-list">{meters.map((meter)=><span key={String(meter[0])}><b>{meter[0]}</b><i><em style={{width:`${Number(meter[1])||0}%`}}/></i><strong>{meter[1]}%</strong></span>)}</div>:page==="media"?<div className="peek-media">{players.slice(0,3).map((player)=><article key={player.id}><span><b>{player.title||player.name}</b><small>{player.artist||player.status}</small></span><nav><button onClick={()=>mediaControl(player.id,"previous")}>◀</button><button onClick={()=>mediaControl(player.id,"play-pause")}>{player.status==="Playing"?"Ⅱ":"▶"}</button><button onClick={()=>mediaControl(player.id,"next")}>▶</button></nav></article>)}{!players.length&&<p>NO ACTIVE MEDIA SOURCES</p>}<footer>MASTER AUDIO <b>{volume}%</b></footer></div>:page==="network"?<div className="peek-network">{network.interfaces.slice(0,4).map((item)=><article key={item.id}><i className={item.state==="connected"?"ready":""}>●</i><span><b>{item.name}</b><small>{item.address||item.state.toUpperCase()}</small></span><em>{item.speed||"LOCAL"}</em></article>)}{!network.interfaces.length&&<p>{bridge?"NO ACTIVE NETWORK INTERFACES":"LOCAL CORE LINK PENDING"}</p>}</div>:page==="updates"?<div className="peek-update"><strong>{update?.available?`V${update.version} AVAILABLE`:"RELEASE CHANNEL READY"}</strong><p>{update?.available?"A verified release can be downloaded from the full Updates page.":"Background checks remain silent when offline."}</p><small>{update?.sha256?`SHA-256 ${update.sha256.slice(0,16).toUpperCase()}…`:"STABLE / DEVELOPMENT CHANNEL AWARE"}</small></div>:page==="terminal"?<div className="peek-terminal"><pre>LCARS LOCAL COMMAND LINK{`\n`}{bridge?"PTY CORE READY":"LOCAL CORE STANDBY"}{`\n\n`}terminal@lcars:~$ <i>█</i></pre><small>OPEN THE FULL TERMINAL TO TYPE COMMANDS</small></div>:page==="files"?<div className="peek-files"><i><FileGlyph kind="folder"/></i><span><b>LOCAL FILE SYSTEM</b><small>HOME · DOCUMENTS · DOWNLOADS</small><p>Use the full File Browser for previews, transfers, and document editing.</p></span></div>:page==="settings"?<div className="peek-settings"><article><b>LOCAL CORE</b><span>{bridge?"CONNECTED":"STANDBY"}</span></article><article><b>DO NOT DISTURB</b><span>{doNotDisturb?"ACTIVE":"OFF"}</span></article><article><b>NOTICES</b><span>{notices.length}</span></article><p>Open the full page to change themes, workstations, routines, accessibility, and shell behavior.</p></div>:custom?<div className="peek-custom"><i>{custom.kind.toUpperCase()}</i><span><b>{custom.name}</b><small>{custom.target}</small>{custom.kind==="app"&&apps.find((app)=>app.id===custom.target)&&<button onClick={()=>launch(apps.find((app)=>app.id===custom.target)!)}>OPEN APPLICATION ↗</button>}</span></div>:<p>PAGE PREVIEW IS UNAVAILABLE</p>;
  return <aside className={`speed-dial-page-peek ${pinned?"pinned":"floating"}`} role="dialog" aria-modal="false" aria-label={`${title} Page Peek`}><header><div><small>{pinned?"PINNED PAGE PEEK · ALWAYS ABOVE LCARS":"SPEED DIAL PAGE PEEK"}</small><h3>{title}</h3></div><nav><button className={pinned?"active":""} onClick={togglePinned}>{pinned?"RELEASE":"PIN"}</button><button onClick={close}>×</button></nav></header><main>{content}</main><footer><span>{pinned?"PIN LOCK ACTIVE":"FLOATING PREVIEW"}</span><button onClick={()=>openFull(page)}>OPEN FULL PAGE ›</button></footer></aside>;
}

function CustomPageManager({pages,apps,extensions,change}:{pages:CustomPage[];apps:App[];extensions:ExtensionManifest[];change:(pages:CustomPage[])=>void}) {
  const moduleSources=Object.entries(widgetInfo).map(([id,info])=>({value:`module|${id}`,label:info.name}));
  const extensionSources=extensions.flatMap((extension)=>extension.apiVersion===1?[{value:`extension|${extension.id}::__legacy`,label:`${extension.name} — full checklist`}]:extension.placements.map((placement)=>({value:`extension|${extension.id}::${placement.id}`,label:`${extension.name} — ${placement.title}`})));
  const appSources=apps.map((app)=>({value:`app|${app.id}`,label:app.name}));
  const sources=[...moduleSources,...extensionSources,...appSources];
  const [source,setSource]=useState(sources[0]?.value||"module|system"),[name,setName]=useState("");
  useEffect(()=>{if(!sources.some((item)=>item.value===source)&&sources[0])setSource(sources[0].value);},[apps.length,extensions.length]);
  const add=()=>{if(pages.length>=6)return;const selected=sources.find((item)=>item.value===source);if(!selected)return;const separator=source.indexOf("|"),kind=source.slice(0,separator) as CustomPage["kind"],target=source.slice(separator+1);const page:CustomPage={id:`page-${Date.now().toString(36)}`,name:(name.trim()||selected.label).slice(0,24),kind,target};change([...pages,page]);setName("");};
  const move=(index:number,direction:number)=>{const target=index+direction;if(target<0||target>=pages.length)return;const next=[...pages];[next[index],next[target]]=[next[target],next[index]];change(next);};
  return <section className="custom-page-manager"><header><div><small>SIDEBAR ARCHITECTURE</small><h4>CUSTOM PAGES</h4></div><b>{pages.length}/6</b></header><p>Add a persistent sidebar destination for an application, an Overview module, or a full extension placement. Arbitrary desktop apps open natively when the OS cannot safely embed them.</p><div className="custom-page-create"><label>PAGE SOURCE<select value={source} onChange={(event)=>{setSource(event.target.value);const selected=sources.find((item)=>item.value===event.target.value);if(selected)setName(selected.label);}}><optgroup label="OVERVIEW MODULES">{moduleSources.map((item)=><option value={item.value} key={item.value}>{item.label}</option>)}</optgroup>{extensionSources.length>0&&<optgroup label="EXTENSION PAGES">{extensionSources.map((item)=><option value={item.value} key={item.value}>{item.label}</option>)}</optgroup>}<optgroup label="INSTALLED APPLICATIONS">{appSources.map((item)=><option value={item.value} key={item.value}>{item.label}</option>)}</optgroup></select></label><label>SIDEBAR LABEL<input maxLength={24} placeholder={sources.find((item)=>item.value===source)?.label||"CUSTOM PAGE"} value={name} onChange={(event)=>setName(event.target.value)}/></label><button disabled={pages.length>=6} onClick={add}>ADD PAGE</button></div><div className="custom-page-list">{pages.map((page,index)=><article key={page.id}><i>C{index+1}</i><span><b>{page.name}</b><small>{page.kind.toUpperCase()} · {page.target}</small></span><nav><button disabled={index===0} onClick={()=>move(index,-1)}>↑</button><button disabled={index===pages.length-1} onClick={()=>move(index,1)}>↓</button><button onClick={()=>change(pages.filter((item)=>item.id!==page.id))}>REMOVE</button></nav></article>)}{!pages.length&&<p>NO CUSTOM SIDEBAR PAGES ASSIGNED</p>}</div></section>;
}

function Toggle({
  label,
  description,
  checked,
  change,
}: {
  label: string;
  description?: string;
  checked: boolean;
  change: (v: boolean) => void;
}) {
  return (
    <label className="lcars-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => change(e.target.checked)}
      />
      <i />
      <span>
        <b>{label}</b>
        {description && <small>{description}</small>}
      </span>
    </label>
  );
}

function ExtensionSettings({extensions}:{extensions:ExtensionManifest[]}){const configurable=extensions.filter((extension)=>extension.settings.length);if(!configurable.length)return null;return <section className="extension-settings"><header><b>EXTENSION CONFIGURATION</b><small>HOST-RENDERED · NAMESPACED LOCAL STATE</small></header>{configurable.map((extension)=><ExtensionSettingGroup key={extension.id} extension={extension}/>)}</section>;}
function ExtensionSettingGroup({extension}:{extension:ExtensionManifest}){const key=`lcars-extension-state:${extension.id}`,[values,setValues]=useState<Record<string,unknown>>(()=>{try{return JSON.parse(localStorage.getItem(key)||"{}");}catch{return{};}});const save=(name:string,value:unknown)=>{const next={...values,[name]:value};setValues(next);localStorage.setItem(key,JSON.stringify(next));fetch("http://127.0.0.1:8765/api/extension-state",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:extension.id,state:next})}).catch(()=>{});};return <article><h4>{extension.name.toUpperCase()} <small>API {extension.apiVersion}</small></h4>{extension.settings.map((setting)=>{const value=values[setting.key]??setting.default??"";return <label key={setting.key}>{setting.label}<small>{setting.description}</small>{setting.type==="toggle"?<input type="checkbox" checked={Boolean(value)} onChange={(event)=>save(setting.key,event.target.checked)}/>:setting.type==="select"?<select value={String(value)} onChange={(event)=>save(setting.key,event.target.value)}>{setting.options?.map((option)=><option key={option}>{option}</option>)}</select>:<input type={setting.type==="number"?"number":"text"} value={String(value)} onChange={(event)=>save(setting.key,setting.type==="number"?Number(event.target.value):event.target.value)}/>}</label>;})}</article>;}
function VoiceDeviceSelect({value,change}:{value:string;change:(value:string)=>void}) { const [devices,setDevices]=useState<MediaDeviceInfo[]>([]);useEffect(()=>{navigator.mediaDevices?.enumerateDevices().then((items)=>setDevices(items.filter((item)=>item.kind==="audioinput"))).catch(()=>{});},[]);return <label>VOICE MICROPHONE<small>Select the input used by push-to-talk. Grant microphone permission once to reveal device names.</small><select value={value} onChange={(event)=>change(event.target.value)}><option value="">SYSTEM DEFAULT</option>{devices.map((device,index)=><option key={device.deviceId} value={device.deviceId}>{device.label||`MICROPHONE ${index+1}`}</option>)}</select></label>; }

function VoiceControl({ prefs, apps, extensions, routines, navigate, launch, requestRoutine, action, notify }: { prefs: ShellPrefs; apps: App[]; extensions: ExtensionManifest[]; routines: Routine[]; navigate: (page: string) => void; launch: (app: App) => void; requestRoutine: (routine: Routine) => void; action: (value: string) => void; notify: (text: string, kind?: "info" | "error") => void }) {
  const [listening, setListening] = useState(false), [busy, setBusy] = useState(false), [history, setHistory] = useState<string[]>([]);
  const recorder = useRef<MediaRecorder | null>(null), chunks = useRef<Blob[]>([]);
  if (!prefs.voiceEnabled) return null;
  const affirmative = () => { const audio = new Audio("/assets/sounds/voice-affirmative.mp3"); audio.volume = 0.5; audio.play().catch(() => {}); };
  const execute = (raw: string) => {
    let text = raw.trim().toLowerCase().replace(/[.,!?]/g, "");setHistory((old) => [raw, ...old].slice(0, 8));
    if (prefs.voiceWakePhrase) { if (!text.startsWith("computer")) return notify("Voice phrase ignored — say Computer first", "error"); text=text.replace(/^computer\s*/, ""); }
    const pages: Record<string,string> = { overview:"overview", status:"overview", terminal:"terminal", files:"files", file:"files", systems:"system", system:"system", media:"media", network:"network", updates:"updates", settings:"settings" };
    const page=Object.keys(pages).find((name) => text.includes("open "+name) || text.includes("show "+name) || text===name);
    if (page) { affirmative();navigate(pages[page]);return notify("Voice command: "+page.toUpperCase()); }
    const extensionCommand=extensions.flatMap((extension)=>extension.voiceCommands||[]).find((command)=>text.includes(command.phrase.toLowerCase()));
    if (extensionCommand && nav.some((item)=>item[0]===extensionCommand.page)) { affirmative();navigate(extensionCommand.page);return notify(extensionCommand.response||"Extension voice command accepted"); }
    const routine=routines.find((candidate)=>text.includes(`run ${candidate.name.toLowerCase()}`)||text.includes(`start ${candidate.name.toLowerCase()}`));
    if(routine){affirmative();requestRoutine(routine);return notify(`Routine preview ready: ${routine.name}`);}
    if (prefs.voiceSecurity !== "navigation") {
      const app=apps.find((candidate) => text.includes("open "+candidate.name.toLowerCase()) || text.includes("launch "+candidate.name.toLowerCase()));
      if (app) { affirmative();launch(app);return; }
    }
    if (prefs.voiceSecurity === "system") {
      if (text.includes("open tasks") || text.includes("task rail")) { affirmative();action("refresh-system");return notify("Task Rail ready — use the rail control to pin it"); }
      if (text.includes("check updates")) { affirmative();navigate("updates");action("check-updates");return; }
      if (/shut ?down|restart|reboot|sleep|suspend|unmount/.test(text)) return notify("Protected voice command requires manual confirmation in its LCARS panel", "error");
    }
    notify("Voice command not recognized: "+raw, "error");
  };
  const start = async () => {
    try { const stream=await navigator.mediaDevices.getUserMedia({audio:prefs.voiceDevice?{deviceId:{exact:prefs.voiceDevice}}:true});const media=new MediaRecorder(stream);chunks.current=[];media.ondataavailable=(event) => event.data.size && chunks.current.push(event.data);media.onstop=async()=>{setListening(false);setBusy(true);stream.getTracks().forEach((track)=>track.stop());try{const blob=new Blob(chunks.current,{type:media.mimeType});const reader=new FileReader();reader.onload=async()=>{try{const response=await fetch("http://127.0.0.1:8765/api/voice-transcribe",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({audio:String(reader.result)})});const result=await response.json();result.ok&&result.text?execute(result.text):notify(result.message||"Voice recognition failed","error");}catch{notify("Local voice core did not respond","error");}finally{setBusy(false);}};reader.readAsDataURL(blob);}catch{setBusy(false);notify("Microphone sample could not be processed","error");}};recorder.current=media;media.start();setListening(true);setTimeout(()=>media.state==="recording"&&media.stop(),15000);} catch { notify("Microphone access was denied", "error"); }
  };
  return <aside className={(listening ? "listening " : "")+"voice-control"}><button aria-label={listening?"Stop listening":"Push to talk"} onClick={() => listening ? recorder.current?.stop() : start()} disabled={busy}><i>●</i>{busy?"PROCESSING":listening?"LISTENING — STOP":"VOICE"}</button>{history.length>0&&<small title={history.join("\n")}>LAST: {history[0]}</small>}</aside>;
}

function SpeedDial({
  items,
  extensions,
  customPages,
  routines,
  players,
  notices,
  displays,
  trayItems,
  bridge,
  doNotDisturb,
  taskPinned,
  execute,
}: {
  items: SpeedDialItem[];
  extensions: ExtensionManifest[];
  customPages: CustomPage[];
  routines: Routine[];
  players: number;
  notices: number;
  displays: number;
  trayItems: number;
  bridge: boolean;
  doNotDisturb: boolean;
  taskPinned: boolean;
  execute: (item: SpeedDialItem) => void;
}) {
  const choices=[...speedDialChoices,...extensions.map((extension)=>({id:`module:ext:${extension.id}` as SpeedDialItem,label:extension.name.toUpperCase().slice(0,14),description:`Open ${extension.name} as a focused module`})),...customPages.map((page)=>({id:`page:custom:${page.id}` as SpeedDialItem,label:page.name.toUpperCase().slice(0,14),description:`Open custom Page Peek ${page.name}`})),...routines.map((routine)=>({id:`routine:${routine.id}` as SpeedDialItem,label:routine.name.toUpperCase().slice(0,14),description:`Preview and run ${routine.name}`}))];
  const suffix=(item:SpeedDialItem)=>item==="page:network"?(bridge?"●":"○"):item==="page:media"?String(players):item==="action:dnd"?(doNotDisturb?"ON":"OFF"):item==="action:notices"?String(notices):item==="action:displays"?String(displays):item==="action:tasks"?(taskPinned?"PIN":"OPEN"):item==="action:tray"?String(trayItems):item.startsWith("module:")?"MOD":item.startsWith("routine:")?"RUN":"";
  return (
    <nav className="system-tray speed-dial" aria-label="LCARS Speed Dial">
      {items.map((item,index)=>{const choice=choices.find((candidate)=>candidate.id===item);if(!choice)return null;return <button className={item==="action:dnd"&&doNotDisturb?"active":""} key={`${item}:${index}`} onClick={()=>execute(item)} title={choice.description}><i>{String(index+1).padStart(2,"0")}</i><span>{choice.label}</span><b>{suffix(item)}</b></button>;})}
    </nav>
  );
}

function FirstRun({
  step,
  setStep,
  displays,
  bridge,
  finish,
  close,
}: {
  step: number;
  setStep: (v: number) => void;
  displays: Display[];
  bridge: boolean;
  finish: (password?: string) => void | Promise<void>;
  close: () => void;
}) {
  const [setupPassword,setSetupPassword]=useState(""),[setupConfirm,setSetupConfirm]=useState(""),[setupError,setSetupError]=useState("");
  const cards = [
    {
      code: "01",
      title: "LOCAL CORE",
      text: bridge
        ? "Local system bridge detected and responding."
        : "Start LCARS locally to enable desktop integration.",
      ok: bridge,
    },
    { code:"02", title:"NAVIGATION", text:"Press Ctrl plus the number shown on a sidebar control to open that page—even while Terminal has focus. Ctrl+K opens commands and Ctrl+F finds pages, settings, apps, and modules.", ok:true },
    { code:"03", title:"MODULAR OVERVIEW", text:"Choose Configure Overview to add, remove, resize, and reorder built-in or extension modules.", ok:true },
    { code:"04", title:"TASKS & VOICE", text:"The Task Rail manages desktop windows. Optional push-to-talk voice control stays local when whisper.cpp is configured.", ok:true },
    { code:"05", title:"FILES & DETACHABLE TOOLS", text:"Files and supported documents open inside LCARS. Use the compact detach control when you want a separate native window.", ok:true },
    { code:"06", title:"LOCAL AUTHORIZATION", text:"Optionally protect the themed lock screen with a local password. Only a salted PBKDF2 hash is stored on this PC.", ok:true },
  ];
  const item = cards[step];
  return (
    <div className="backdrop setup-backdrop">
      <section className="first-run">
        <header>
          <div>
            <small>FIRST-RUN SYSTEM ALIGNMENT</small>
            <h2>LCARS SHELL SETUP</h2>
          </div>
          <button onClick={close}>LATER</button>
        </header>
        <div className="setup-progress">
          {cards.map((c, i) => (
            <i className={i <= step ? "active" : ""} key={c.code}>
              {c.code}
            </i>
          ))}
        </div>
        <article>
          <span>{item.code}</span>
          <div>
            <small>SYSTEM CHECK</small>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
            {item.code === "06" && <div className="setup-password"><input type="password" autoComplete="new-password" placeholder="OPTIONAL PASSWORD" value={setupPassword} onChange={(event)=>setSetupPassword(event.target.value)}/><input type="password" autoComplete="new-password" placeholder="CONFIRM PASSWORD" value={setupConfirm} onChange={(event)=>setSetupConfirm(event.target.value)}/><small>Leave both fields blank to use direct local access. You can enable this later in Settings.</small>{setupError&&<em>{setupError}</em>}</div>}
            <b className={item.ok ? "check-ok" : "check-wait"}>
              {item.ok ? "● READY" : "○ LOCAL CHECK PENDING"}
            </b>
          </div>
        </article>
        <footer>
          {step > 0 && <button onClick={() => setStep(step - 1)}>BACK</button>}
          <button
            onClick={() =>
              step < cards.length - 1 ? setStep(step + 1) : setupPassword !== setupConfirm ? setSetupError("PASSWORDS DO NOT MATCH") : setupPassword && setupPassword.length < 4 ? setSetupError("USE AT LEAST 4 CHARACTERS") : finish(setupPassword)
            }
          >
            {step < cards.length - 1 ? "CONTINUE" : "ENTER LCARS"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function OverviewEditor({
  active,
  save,
  move,
  extensions,
}: {
  active: WidgetId[];
  save: (x: WidgetId[]) => void;
  move: (id: WidgetId, direction: number) => void;
  extensions: ExtensionManifest[];
}) {
  const allModules: WidgetId[] = [
    ...(Object.keys(widgetInfo) as BuiltinWidgetId[]),
    ...extensions.map((extension) => `ext:${extension.id}` as WidgetId),
  ];
  const metadata = (id: WidgetId) => {
    if (!id.startsWith("ext:")) return widgetInfo[id as BuiltinWidgetId];
    const extension = extensions.find((item) => `ext:${item.id}` === id);
    return extension
      ? { name: extension.name, description: `${extension.description} · Extension ${extension.version}` }
      : { name: "Extension unavailable", description: "Manifest not found" };
  };
  const inactive = allModules.filter(
      (id) => !active.includes(id),
    ),
    ordered = [...active, ...inactive.filter((id) => !active.includes(id))];
  return (
    <section className="overview-editor">
      <header>
        <div>
          <b>OVERVIEW CONFIGURATION</b>
          <small>
            Active modules follow the exact order shown on your Overview
          </small>
        </div>
        <button onClick={() => save(defaultWidgets)}>RESTORE DEFAULT</button>
      </header>
      <div>
        {ordered.map((id, index) => {
          const enabled = active.includes(id);
          return (
            <article className={enabled ? "enabled" : ""} key={id}>
              <button
                className="module-toggle"
                onClick={() =>
                  save(
                    enabled ? active.filter((x) => x !== id) : [...active, id],
                  )
                }
              >
                {enabled ? "✓" : "+"}
              </button>
              <span>
                <b>
                  {enabled ? String(index + 1).padStart(2, "0") + " · " : ""}
                  {metadata(id).name}
                </b>
                <small>{metadata(id).description}</small>
              </span>
              <nav>
                <button
                  disabled={!enabled || active.indexOf(id) === 0}
                  onClick={() => move(id, -1)}
                >
                  ▲
                </button>
                <button
                  disabled={
                    !enabled || active.indexOf(id) === active.length - 1
                  }
                  onClick={() => move(id, 1)}
                >
                  ▼
                </button>
              </nav>
            </article>
          );
        })}
      </div>
      {inactive.length > 0 && (
        <small className="available-label">
          AVAILABLE MODULES APPEAR AFTER ACTIVE MODULES
        </small>
      )}
    </section>
  );
}

type ChecklistItem = { id: string; text: string; done: boolean };
class ExtensionBoundary extends Component<{id:string;name:string;onFailure:(id:string)=>void;children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return{failed:true};}
  componentDidCatch(error:unknown){console.error(`LCARS extension ${this.props.id} was isolated`,error);this.props.onFailure(this.props.id);}
  render(){return this.state.failed?<section className="overview-widget extension-widget extension-isolated"><h3>EXTENSION ISOLATED <small>SAFE RENDERER</small></h3><b>{this.props.name}</b><p>This module failed inside its protected renderer. LCARS remains operational; retry or inspect it in Settings → Recovery.</p></section>:this.props.children;}
}
function ChecklistExtension({ extension }: { extension: ExtensionManifest }) {
  const storageKey = `lcars-extension-state:${extension.id}`;
  const defaults = (extension.placements[0]?.ui.find((node)=>node.type==="list")?.items || []).map((text, index) => ({
    id: `default-${index}`,
    text,
    done: false,
  }));
  const [items, setItems] = useState<ChecklistItem[]>(() => {
    if (typeof window === "undefined") return defaults;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      return Array.isArray(saved) ? saved : defaults;
    } catch {
      return defaults;
    }
  });
  const [draft, setDraft] = useState("");
  const save = (next: ChecklistItem[]) => {
    setItems(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };
  const add = () => {
    const text = draft.trim();
    if (!text) return;
    save([...items, { id: `${Date.now()}-${items.length}`, text: text.slice(0, 100), done: false }]);
    setDraft("");
  };
  const complete = items.filter((item) => item.done).length;
  const percent = items.length ? Math.round((complete / items.length) * 100) : 0;
  return (
    <section className="overview-widget extension-widget checklist-extension">
      <h3>{extension.name.toUpperCase()} <small>EXT · {extension.version}</small></h3>
      <div className="checklist-progress">
        <span><b>{complete}</b> / {items.length} COMPLETE</span><strong>{percent}%</strong>
        <i><em style={{ width: `${percent}%` }} /></i>
      </div>
      <div className="checklist-items">
        {items.length ? items.map((item) => (
          <label key={item.id} className={item.done ? "done" : ""}>
            <input type="checkbox" checked={item.done} onChange={() => save(items.map((entry) => entry.id === item.id ? { ...entry, done: !entry.done } : entry))} />
            <span>{item.text}</span>
            <button aria-label={`Remove ${item.text}`} onClick={(event) => { event.preventDefault(); save(items.filter((entry) => entry.id !== item.id)); }}>×</button>
          </label>
        )) : <p className="extension-empty">NO CHECKLIST ITEMS · ADD A MISSION STEP BELOW</p>}
      </div>
      <div className="checklist-add">
        <input value={draft} maxLength={100} placeholder="ADD MISSION STEP" onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") add(); }} />
        <button onClick={add}>ADD</button>
        <button disabled={!complete} onClick={() => save(items.filter((item) => !item.done))}>CLEAR DONE</button>
      </div>
    </section>
  );
}

function DeclarativeExtension({extension,placement}:{extension:ExtensionManifest;placement:ExtensionPlacement}) {
  const storageKey=`lcars-extension-state:${extension.id}`;
  const defaults=Object.fromEntries(extension.settings.map((setting)=>[setting.key,setting.default]));
  const [state,setState]=useState<Record<string,unknown>>(()=>{try{return {...defaults,...JSON.parse(localStorage.getItem(storageKey)||"{}")};}catch{return defaults;}}),[now,setNow]=useState(Date.now());
  useEffect(()=>{fetch("http://127.0.0.1:8765/api/extension-state?id="+encodeURIComponent(extension.id)).then((response)=>response.json()).then((result)=>result.state&&setState((old)=>({...old,...result.state}))).catch(()=>{});const timer=window.setInterval(()=>setNow(Date.now()),Math.max(1,extension.tickSeconds||1)*1000);return()=>window.clearInterval(timer);},[extension.id,extension.tickSeconds]);
  const save=(next:Record<string,unknown>)=>{setState(next);localStorage.setItem(storageKey,JSON.stringify(next));fetch("http://127.0.0.1:8765/api/extension-state",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:extension.id,state:next})}).catch(()=>{});};
  const elapsed=()=>Number(state.elapsed||0)+(state.running&&state.startedAt?now-Number(state.startedAt):0);
  const act=(action="")=>{if(action==="timer:start"&&!state.running)save({...state,running:true,startedAt:Date.now()});else if(action==="timer:pause"&&state.running)save({...state,elapsed:elapsed(),running:false,startedAt:0});else if(action==="timer:reset")save({...state,elapsed:0,running:false,startedAt:0});else if(action.startsWith("state:toggle:")){const key=action.slice(13);save({...state,[key]:!state[key]});}};
  const render=(node:ExtensionPrimitive,index:number):ReactNode=>{
    const key=node.id||`${node.type}-${index}`;
    if(node.type==="clock"){const date=new Date(now);const value=node.source==="stardate"?`${date.getUTCFullYear()}.${Math.floor(((date.getTime()-Date.UTC(date.getUTCFullYear(),0,1))/(Date.UTC(date.getUTCFullYear()+1,0,1)-Date.UTC(date.getUTCFullYear(),0,1)))*1000).toString().padStart(3,"0")}`:date.toLocaleTimeString();return <strong className="extension-clock" key={key}>{node.label&&<small>{node.label}</small>}{value}</strong>;}
    if(node.type==="timer"){const total=Math.floor(elapsed()/1000),hours=Math.floor(total/3600),minutes=Math.floor(total%3600/60),seconds=total%60;return <strong className="extension-timer" key={key}>{node.label&&<small>{node.label}</small>}{[hours,minutes,seconds].map((part)=>String(part).padStart(2,"0")).join(":")}</strong>;}
    if(node.type==="text")return <p key={key}>{node.text||String(state[node.source||""]||"")}</p>;
    if(node.type==="button")return <button key={key} onClick={()=>act(node.action)}>{node.label||node.text||"ACTIVATE"}</button>;
    if(node.type==="toggle")return <label className="extension-toggle" key={key}><input type="checkbox" checked={Boolean(state[node.id||""]??node.value)} onChange={()=>save({...state,[node.id||""]:!state[node.id||""]})}/><span>{node.label}</span></label>;
    if(node.type==="input")return <label key={key}>{node.label}<input placeholder={node.placeholder} value={String(state[node.id||""]??node.value??"")} onChange={(event)=>save({...state,[node.id||""]:event.target.value})}/></label>;
    if(node.type==="progress"){const value=Number(state[node.source||""]??node.value??0);return <div className="extension-progress" key={key}><span>{node.label}</span><i><em style={{width:`${Math.max(0,Math.min(100,value))}%`}}/></i></div>;}
    if(node.type==="list")return <ul key={key}>{(node.items||[]).map((item)=><li key={item}>{item}</li>)}</ul>;
    if(node.type==="grid"||node.type==="tabs")return <div className={`extension-${node.type}`} key={key}>{(node.children||[]).map(render)}</div>;
    return null;
  };
  return <section className="overview-widget extension-widget declarative-extension"><h3>{placement.title.toUpperCase()} <small>EXT API {extension.apiVersion} · {extension.version}</small></h3><div className="extension-primitives">{placement.ui.map(render)}</div></section>;
}
function ExtensionHeader({extension,placement,now}:{extension:ExtensionManifest;placement:ExtensionPlacement;now:Date}){const node=placement.ui.find((item)=>item.type==="clock"||item.type==="text");let value=node?.text||extension.name;if(node?.type==="clock")value=node.source==="stardate"?`${now.getUTCFullYear()}.${Math.floor(((now.getTime()-Date.UTC(now.getUTCFullYear(),0,1))/(Date.UTC(now.getUTCFullYear()+1,0,1)-Date.UTC(now.getUTCFullYear(),0,1)))*1000).toString().padStart(3,"0")}`:now.toLocaleTimeString();return <div className="extension-header-item" title={`${extension.name} · Extension API ${extension.apiVersion}`}><small>{node?.label||placement.title}</small><b>{value}</b></div>;}
const formatMediaTime = (seconds = 0) => {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
};

function MediaConsole({
  players,
  pinned,
  togglePinned,
  control,
  volume,
  muted,
  setVolume,
  commitVolume,
  toggleMute,
  devices,
  chooseDevice,
  streams,
  setStreamVolume,
  setStreamMute,
  platform,
  openMedia,
  openDevices,
  refresh,
}: {
  players: Player[];
  pinned: string[];
  togglePinned: (id: string) => void;
  control: (player: string, command: string) => void;
  volume: number;
  muted: boolean;
  setVolume: (value: number) => void;
  commitVolume: () => void;
  toggleMute: () => void;
  devices: AudioDevice[];
  chooseDevice: (id: string) => void;
  streams: Stream[];
  setStreamVolume: (id: string, value: number) => void;
  setStreamMute: (id: string, muted: boolean) => void;
  platform: string;
  openMedia: () => void;
  openDevices: () => void;
  refresh: () => void;
}) {
  const [pane, setPane] = useState<"players" | "master" | "mixer">("players"),
    [selectedId, setSelectedId] = useState(() =>
      typeof window === "undefined"
        ? ""
        : localStorage.getItem("lcars-selected-player") || "",
    );
  useEffect(() => {
    if (players.some((player) => player.id === selectedId)) return;
    const next =
      players.find((player) => player.status.toLowerCase() === "playing") ||
      players.find((player) => pinned.includes(player.id)) ||
      players[0];
    setSelectedId(next?.id || "");
  }, [players, pinned, selectedId]);
  const selectPlayer = (id: string) => {
      setSelectedId(id);
      localStorage.setItem("lcars-selected-player", id);
    },
    selected = players.find((player) => player.id === selectedId) || players[0],
    otherPlayers = players.filter((player) => player.id !== selected?.id),
    outputs = devices.filter((device) => device.kind === "output"),
    inputs = devices.filter((device) => device.kind === "input"),
    output = outputs.find((device) => device.default),
    input = inputs.find((device) => device.default);
  const initials = (name = "MEDIA") =>
    name
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  return (
    <>
      <nav className="media-console-tabs" aria-label="Media console sections">
        {([
          ["players", "NOW PLAYING"],
          ["master", "MASTER AUDIO"],
          ["mixer", "APP MIXER"],
        ] as const).map(([id, label]) => (
          <button
            className={pane === id ? "active" : ""}
            aria-pressed={pane === id}
            onClick={() => setPane(id)}
            key={id}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="media-console">
        <section
          className={`media-zone media-player-zone ${pane === "players" ? "active-pane" : ""}`}
        >
          <header>
            <span>
              <small>MEDIA SOURCE CONTROL</small>
              <b>NOW PLAYING</b>
            </span>
            <i>{String(players.length).padStart(2, "0")}</i>
          </header>
          {selected ? (
            <div className="media-player-stack">
              <article className="selected-media-player">
                <i className="selected-media-art">
                  {selected.artUrl ? (
                    <img src={selected.artUrl} alt={`${selected.title} artwork`} />
                  ) : selected.icon ? (
                    <img src={selected.icon} alt="" />
                  ) : (
                    initials(selected.name)
                  )}
                </i>
                <span className="selected-media-title">
                  <small>
                    {selected.name.toUpperCase()} · {selected.status.toUpperCase()}
                  </small>
                  <strong>{selected.title || "NO MEDIA TITLE"}</strong>
                  <small>
                    {selected.artist || "UNKNOWN ARTIST"}
                    {selected.album ? ` · ${selected.album}` : ""}
                  </small>
                </span>
                <button
                  className={`selected-media-pin ${pinned.includes(selected.id) ? "pinned" : ""}`}
                  onClick={() => togglePinned(selected.id)}
                  aria-label={`${pinned.includes(selected.id) ? "Unpin" : "Pin"} ${selected.name}`}
                  title="Keep this source at the top"
                >
                  {pinned.includes(selected.id) ? "★" : "☆"}
                </button>
                <div className="selected-media-progress">
                  <span>{formatMediaTime(selected.position)}</span>
                  <i>
                    <b
                      style={{
                        width: `${selected.length ? Math.min(100, ((selected.position || 0) / selected.length) * 100) : 0}%`,
                      }}
                    />
                  </i>
                  <span>{selected.length ? formatMediaTime(selected.length) : "--:--"}</span>
                </div>
                <nav className="selected-media-transport" aria-label={`${selected.name} playback controls`}>
                  <button title="Previous" aria-label="Previous" onClick={() => control(selected.id, "previous")}>◀◀</button>
                  <button className="primary" title="Play or pause" aria-label="Play or pause" onClick={() => control(selected.id, "play-pause")}>{selected.status === "Playing" ? "Ⅱ" : "▶"}</button>
                  <button title="Next" aria-label="Next" onClick={() => control(selected.id, "next")}>▶▶</button>
                  <button title="Shuffle" aria-label="Shuffle" onClick={() => control(selected.id, "shuffle")}>SHUF</button>
                  <button title="Stop" aria-label="Stop" onClick={() => control(selected.id, "stop")}>■</button>
                </nav>
              </article>
              <div className="media-source-list">
                {otherPlayers.length ? (
                  otherPlayers.map((player) => (
                    <article className="media-source-row" key={player.id}>
                      <button className="media-source-select" onClick={() => selectPlayer(player.id)} aria-label={`Show ${player.name}`}>
                        <i>{player.icon ? <img src={player.icon} alt="" /> : initials(player.name)}</i>
                        <span><b>{player.name}</b><small>{player.title || "NO MEDIA"}</small></span>
                        <em className={player.status === "Playing" ? "playing" : ""}>{player.status.toUpperCase()}</em>
                      </button>
                      <button className="media-source-quick" title={`Play or pause ${player.name}`} aria-label={`Play or pause ${player.name}`} onClick={() => control(player.id, "play-pause")}>{player.status === "Playing" ? "Ⅱ" : "▶"}</button>
                    </article>
                  ))
                ) : (
                  <div className="media-compact-empty"><b>PRIMARY SOURCE LINKED</b><small>Additional players appear here as compact sources.</small></div>
                )}
              </div>
            </div>
          ) : (
            <div className="media-compact-empty"><b>NO ACTIVE MEDIA SOURCES</b><small>Start playback in a compatible application. LCARS will detect it automatically.</small></div>
          )}
        </section>

        <section className={`media-zone media-master-zone ${pane === "master" ? "active-pane" : ""}`}>
          <header>
            <span><small>SYSTEM DEFAULT BUS</small><b>MASTER AUDIO</b></span>
            <i>{muted ? "M" : "01"}</i>
          </header>
          <div className="media-master-body">
            <div className="media-master-level">
              <strong>{volume}%</strong>
              <small>{muted ? "OUTPUT MUTED" : "OUTPUT ACTIVE"}</small>
            </div>
            <input
              className="media-master-slider"
              aria-label="Master audio volume"
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(event) => setVolume(+event.target.value)}
              onPointerUp={commitVolume}
              onKeyUp={commitVolume}
            />
            <div className="media-device-routing">
              <label htmlFor="media-output-device">
                OUTPUT
                <select id="media-output-device" aria-label="Audio output device" value={output?.id || ""} onChange={(event) => chooseDevice(event.target.value)}>
                  <option value="" disabled>{outputs.length ? "SELECT OUTPUT" : platform.includes("WINDOWS") ? "NO WINDOWS OUTPUTS DETECTED" : "NO PIPEWIRE OUTPUTS DETECTED"}</option>
                  {outputs.map((device) => <option value={device.id} key={device.id}>{device.default ? "● " : ""}{device.name}</option>)}
                </select>
              </label>
              <label htmlFor="media-input-device">
                INPUT
                <select id="media-input-device" aria-label="Audio input or microphone device" value={input?.id || ""} onChange={(event) => chooseDevice(event.target.value)}>
                  <option value="" disabled>{inputs.length ? "SELECT MICROPHONE" : platform.includes("WINDOWS") ? "NO WINDOWS INPUTS DETECTED" : "NO PIPEWIRE INPUTS DETECTED"}</option>
                  {inputs.map((device) => <option value={device.id} key={device.id}>{device.default ? "● " : ""}{device.name}</option>)}
                </select>
              </label>
            </div>
            <nav className="media-master-actions">
              <button className={muted ? "active" : ""} onClick={toggleMute}>{muted ? "RESTORE AUDIO" : "MUTE OUTPUT"}</button>
              <button onClick={openDevices}>DEVICE DETAILS</button>
            </nav>
          </div>
        </section>

        <ApplicationMixer
          streams={streams}
          setVolume={setStreamVolume}
          setMuted={setStreamMute}
          openRouting={openDevices}
          platform={platform}
          active={pane === "mixer"}
        />

        <nav className="media-quick-strip" aria-label="Media quick controls">
          <button onClick={openMedia}>OPEN MEDIA PLAYER</button>
          <button onClick={openDevices}>AUDIO DEVICES</button>
          <button onClick={refresh}>REFRESH / RESCAN</button>
          <button disabled={!output} onClick={() => document.getElementById("media-output-device")?.focus()} title={output?.name || "No default output"}>DEFAULT OUTPUT</button>
          <button disabled={!input} onClick={() => document.getElementById("media-input-device")?.focus()} title={input?.name || "No default input"}>DEFAULT INPUT</button>
        </nav>
      </div>
    </>
  );
}

function ApplicationMixer({
  streams,
  setVolume,
  setMuted,
  openRouting,
  platform,
  active,
}: {
  streams: Stream[];
  setVolume: (id: string, value: number) => void;
  setMuted: (id: string, muted: boolean) => void;
  openRouting: () => void;
  platform: string;
  active: boolean;
}) {
  const [advanced, setAdvanced] = useState(false),
    [expanded, setExpanded] = useState<string[]>([]);
  const groups = Array.from(new Set(streams.map((stream) => stream.group || stream.name))).map((name) => ({
      name,
      items: streams.filter((stream) => (stream.group || stream.name) === name),
    })),
    visible = advanced ? groups : groups.filter((group) => group.items.some((stream) => !stream.advanced)),
    hasAdvanced = groups.some((group) => group.items.some((stream) => stream.advanced));
  const toggleExpanded = (name: string) =>
      setExpanded((old) => old.includes(name) ? old.filter((item) => item !== name) : [...old, name]),
    initials = (name: string) => name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return (
    <section className={`media-zone media-mixer-zone ${active ? "active-pane" : ""}`}>
      <header>
        <span><small>{platform.includes("WINDOWS") ? "WINDOWS CORE AUDIO" : "PIPEWIRE APPLICATION BUS"}</small><b>APPLICATION MIXER</b></span>
        <button className="media-mixer-header-button" disabled={!hasAdvanced} onClick={() => setAdvanced(!advanced)}>{advanced ? "APPLICATIONS ONLY" : "SHOW ALL STREAMS"}</button>
      </header>
      <div className="media-mixer-list">
        {visible.length ? visible.map((group) => {
          const main = group.items.find((stream) => !stream.advanced) || group.items[0],
            isMuted = group.items.every((stream) => Boolean(stream.muted)),
            open = expanded.includes(group.name),
            routeAvailable = group.items.some((stream) => stream.routeAvailable);
          return (
            <article className={`media-mixer-group ${isMuted ? "muted" : ""} ${main.volume > 0 ? "active" : ""}`} key={group.name}>
              <div className="media-mixer-row">
                <i>{main.icon ? <img src={main.icon} alt="" /> : initials(group.name)}</i>
                <span><b>{group.name}</b><small>{group.items.length} {group.items.length === 1 ? "STREAM" : "STREAMS"}</small></span>
                <strong>{main.volume}%</strong>
                <input aria-label={`${group.name} volume`} type="range" min="0" max="100" value={main.volume} onChange={(event) => group.items.forEach((stream) => setVolume(stream.id, +event.target.value))} />
                <nav className="media-mixer-actions">
                  <button className={isMuted ? "active" : ""} aria-label={`${isMuted ? "Unmute" : "Mute"} ${group.name}`} onClick={() => group.items.forEach((stream) => setMuted(stream.id, !isMuted))}>{isMuted ? "U" : "M"}</button>
                  <button disabled={!routeAvailable} aria-label={`Route ${group.name}`} title={routeAvailable?"Open application routing controls":"Per-application routing is unavailable on this platform"} onClick={openRouting}>ROUTE</button>
                  <button disabled={group.items.length < 2} aria-label={`${open ? "Collapse" : "Expand"} ${group.name} streams`} onClick={() => toggleExpanded(group.name)}>{open ? "−" : "+"}</button>
                </nav>
              </div>
              {open && <div className="media-stream-details">{group.items.map((stream) => <label className="media-stream-detail" key={stream.id}><span>{stream.name}</span><strong>{stream.volume}%</strong><input aria-label={`${stream.name} stream volume`} type="range" min="0" max="100" value={stream.volume} onChange={(event) => setVolume(stream.id, +event.target.value)} /><button className={stream.muted ? "active" : ""} onClick={() => setMuted(stream.id, !stream.muted)}>{stream.muted ? "U" : "M"}</button></label>)}</div>}
            </article>
          );
        }) : <div className="media-compact-empty"><b>NO APPLICATION AUDIO STREAMS</b><small>Applications producing audio will appear here automatically.</small></div>}
      </div>
    </section>
  );
}

function MediaSources({
  players,
  control,
  pinned,
  togglePinned,
  compact = false,
}: {
  players: Player[];
  control: (player: string, command: string) => void;
  pinned: string[];
  togglePinned: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={"media-sources " + (compact ? "compact" : "")}>
      {players.length ? (
        players.map((player) => (
          <article key={player.id}>
            <header>
              <span>
                <b>{player.name}</b>
                <small>{player.status}</small>
              </span>
              <button
                className={pinned.includes(player.id) ? "pinned" : ""}
                onClick={() => togglePinned(player.id)}
                aria-label={"Pin " + player.name}
              >
                {pinned.includes(player.id) ? "★" : "☆"}
              </button>
            </header>
            <div className="track-info">
              {player.artUrl && <img src={player.artUrl} alt="" />}
              <span>
                <b>{player.title}</b>
                <small>
                  {player.artist || "Unknown artist"}
                  {player.album ? " · " + player.album : ""}
                </small>
              </span>
            </div>
            {player.length ? (
              <div className="media-progress">
                <i
                  style={{
                    width:
                      Math.min(
                        100,
                        ((player.position || 0) / player.length) * 100,
                      ) + "%",
                  }}
                />
              </div>
            ) : null}
            <nav className="transport-controls">
              <button
                title="Previous"
                aria-label={"Previous in " + player.name}
                onClick={() => control(player.id, "previous")}
              >
                ◀◀
              </button>
              <button
                className="primary"
                title="Play or pause"
                aria-label={"Play or pause " + player.name}
                onClick={() => control(player.id, "play-pause")}
              >
                {player.status === "Playing" ? "Ⅱ" : "▶"}
              </button>
              <button
                title="Next"
                aria-label={"Next in " + player.name}
                onClick={() => control(player.id, "next")}
              >
                ▶▶
              </button>
              <button
                title="Shuffle"
                aria-label={"Shuffle " + player.name}
                onClick={() => control(player.id, "shuffle")}
              >
                ⤨
              </button>
              <button
                title="Stop"
                aria-label={"Stop " + player.name}
                onClick={() => control(player.id, "stop")}
              >
                ■
              </button>
            </nav>
          </article>
        ))
      ) : (
        <div className="adaptive-empty">
          <b>NO ACTIVE MEDIA SOURCES</b>
          <small>
            Start playback in an MPRIS-compatible application and it will appear
            here automatically.
          </small>
        </div>
      )}
    </div>
  );
}
function NotificationCenter({
  notices,
  activity,
  historyOpen,
  close,
  dismiss,
  clear,
  clearActivity,
  doNotDisturb,
  toggleDnd,
}: {
  notices: Notice[];
  activity: ActivityEntry[];
  historyOpen: boolean;
  close: () => void;
  dismiss: (id: number) => void;
  clear: () => void;
  clearActivity: () => void;
  doNotDisturb: boolean;
  toggleDnd: () => void;
}) {
  const [query, setQuery] = useState(""),
    [tab,setTab]=useState<"notices"|"activity">("notices"),
    live = notices.filter((n) => n.id > 0).slice(0, 3),
    visible = notices.filter((n) =>
      `${n.text} ${n.source||""} ${n.priority||""}`.toLowerCase().includes(query.toLowerCase()),
    ),
    visibleActivity=activity.filter((entry)=>`${entry.title} ${entry.detail} ${entry.source} ${entry.status}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <>
      <div className="toast-stack">
        {live.map((n) => (
          <div className={`toast ${n.kind} priority-${n.priority||"routine"}`} key={n.id}>
            <i>●</i>
            <span>
              <b>{n.text}</b>
              <small>{n.source||"LCARS CORE"} · {n.priority?.toUpperCase()||"ROUTINE"} · {n.time}</small>
            </span>
            <button
              title="Close notification"
              aria-label="Dismiss notification"
              onClick={() => dismiss(n.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {historyOpen && (
        <aside className="notice-history">
          <header>
            <div>
              <small>VERSION 25 COMMUNICATIONS MATRIX</small>
              <h3>COMMUNICATIONS CENTER</h3>
            </div>
            <button onClick={close}>CLOSE ×</button>
          </header>
          <nav className="communications-tabs">
            <button className={tab==="notices"?"active":""} onClick={()=>setTab("notices")}>NOTICES <b>{notices.length}</b></button>
            <button className={tab==="activity"?"active":""} onClick={()=>setTab("activity")}>COMMAND ACTIVITY <b>{activity.length}</b></button>
            <button
              className={doNotDisturb ? "active" : ""}
              onClick={toggleDnd}
            >
              {doNotDisturb ? "DO NOT DISTURB ON" : "DO NOT DISTURB OFF"}
            </button>
            <button onClick={tab==="notices"?clear:clearActivity}>CLEAR {tab==="notices"?"NOTICES":"ACTIVITY"}</button>
          </nav>
          <input
            aria-label="Search communications history"
            placeholder={`SEARCH ${tab==="notices"?"NOTICES":"COMMAND ACTIVITY"}…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {tab==="notices"&&(visible.length ? (
            visible.map((n) => (
              <article className={`communication-entry priority-${n.priority||"routine"}`} key={Math.abs(n.id)}>
                <i>●</i>
                <span>
                  <b>{n.text}</b>
                  <small>{n.source||"LCARS CORE"} · {n.priority?.toUpperCase()||"ROUTINE"} · {n.time}</small>
                </span>
              </article>
            ))
          ) : (
            <p>NO MATCHING NOTIFICATIONS</p>
          ))}
          {tab==="activity"&&(visibleActivity.length?visibleActivity.map((entry)=><article className={`communication-entry activity-${entry.status}`} key={entry.id}><i>{entry.status==="success"?"✓":entry.status==="running"?"▶":"!"}</i><span><b>{entry.title}</b><small>{entry.source} · {entry.status.toUpperCase()} · {new Date(entry.time).toLocaleString()}</small><em>{entry.detail}</em></span></article>):<p>NO MATCHING COMMAND ACTIVITY</p>)}
        </aside>
      )}
    </>
  );
}
function AppDrawer({
  title,
  apps,
  query,
  setQuery,
  close,
  action,
  selected = [],
  selectionMode = false,
  destinations,
  setDestination,
  refresh,
}: {
  title: string;
  apps: App[];
  query: string;
  setQuery: (x: string) => void;
  close: () => void;
  action: (a: App, destination?: ApplicationDestination) => void;
  selected?: string[];
  selectionMode?: boolean;
  destinations?: Record<string,ApplicationDestination>;
  setDestination?: (app:App,destination:ApplicationDestination)=>void;
  refresh: () => void;
}) {
  return (
    <div className="backdrop">
      <section className="drawer" role="dialog">
        <header>
          <div>
            <small>COMPUTER LIBRARY ACCESS</small>
            <h2>{title}</h2>
          </div>
          <nav><button onClick={refresh}>REFRESH APPLICATIONS</button><button onClick={close}>CLOSE ×</button></nav>
        </header>
        <input
          autoFocus
          aria-label="Search applications"
          placeholder="SEARCH APPLICATIONS…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {!selectionMode&&<p className="application-destination-help">NORMAL CLICK USES THE SHOWN DESTINATION · SHIFT+CLICK ALWAYS OPENS A NATIVE WINDOW</p>}
        <div className="app-list">
          {apps.map((a) => {const embedded=embeddedPageForApp(a),destination=destinations?.[a.id]||(embedded?"embedded":"native");return (
            <article className={(selected.includes(a.id)?"chosen ":"")+"application-library-entry"} key={a.id}><button
              onClick={(event) => action(a,event.shiftKey?"native":undefined)}
            >
              <i>{a.icon ? <img src={a.icon} alt="" /> : a.name.slice(0, 2).toUpperCase()}</i>
              <span>
                <b>{a.name}</b>
                <small>{a.comment || a.id}</small>
              </span>
              <strong>
                {selectionMode
                  ? selected.includes(a.id)
                    ? "REMOVE"
                    : "ADD"
                  : "LAUNCH"}
              </strong>
            </button>{!selectionMode&&(embedded&&setDestination?<button className="drawer-destination" onClick={()=>setDestination(a,destination==="embedded"?"native":"embedded")}><b>{destination==="embedded"?"LCARS":"WINDOW"}</b><small>{destination==="embedded"?`OPEN ${embedded.toUpperCase()} WORKSPACE`:"OPEN NATIVE APP"}</small></button>:<span className="drawer-native-only">NATIVE WINDOW ONLY</span>)}</article>
          );})}
        </div>
      </section>
    </div>
  );
}
function ApplicationBay({
  app,
  platform,
  fullscreen,
  setFullscreen,
  close,
  minimize,
  switchApp,
}: {
  app: App;
  platform: string;
  fullscreen: boolean;
  setFullscreen: (x: boolean) => void;
  close: () => void;
  minimize: () => void;
  switchApp: () => void;
}) {
  const toggle = async () => {
    if (!fullscreen) {
      await document.documentElement.requestFullscreen?.().catch(() => {});
      setFullscreen(true);
    } else {
      await document.exitFullscreen?.().catch(() => {});
      setFullscreen(false);
    }
  };
  return (
    <section
      className={"application-bay " + (fullscreen ? "bay-fullscreen" : "")}
    >
      <header>
        <div>
          <small>ACTIVE APPLICATION</small>
          <h3>{app.name}</h3>
        </div>
        <span>
          {platform.includes("WINDOWS")
            ? "WIN32 WINDOW LINK"
            : "WAYLAND WINDOW LINK"}
        </span>
      </header>
      <div className="bay-viewport">
        <div className="bay-grid" />
        <div className="bay-status">
          <i>{app.name.slice(0, 2).toUpperCase()}</i>
          <b>{app.name} IS RUNNING</b>
          <small>
            {platform.includes("WINDOWS")
              ? "The Windows local core can focus, minimize, close, and route this application between connected displays through the Task Rail."
              : "The application window is aligned to this bay by the local KDE/KWin bridge. Native LCARS modules can render directly in this viewport."}
          </small>
        </div>
      </div>
      <footer>
        <button onClick={switchApp}>SWITCH APP</button>
        <button onClick={minimize}>MINIMIZE</button>
        <button onClick={toggle}>
          {fullscreen ? "RETURN TO BAY" : "FULL SCREEN"}
        </button>
        <button onClick={close}>CLOSE</button>
      </footer>
    </section>
  );
}
function Terminal({
  bridge,
  notify,
  prefs,
}: {
  bridge: boolean;
  notify: (text: string, kind?: "info" | "error") => void;
  prefs: ShellPrefs;
}) {
  const [tabs, setTabs] = useState<
      { id: string; name: string; status?: string }[]
    >([]),
    [active, setActive] = useState(""),
    [output, setOutput] = useState(""),
    [input, setInput] = useState("");
  const outputRef = useRef<HTMLPreElement>(null);
  const create = async () => {
    try {
      const r = await fetch("http://127.0.0.1:8765/api/terminal-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Terminal " + (tabs.length + 1),
          shell: prefs.terminalShell,
          directory: prefs.terminalDirectory,
          scrollback: prefs.terminalScrollback,
          history: prefs.terminalHistory,
        }),
      });
      const s = await r.json();
      setTabs((old) => [...old, s]);
      setActive(s.id);
      notify(s.name + " opened");
    } catch {
      notify("Unable to create terminal session", "error");
    }
  };
  const newSession = () =>
    prefs.terminalTarget === "other"
      ? fetch("http://127.0.0.1:8765/api/display-action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "terminal", display: "other" }),
        })
          .then(() => notify("Terminal routed to the other display"))
          .catch(() => notify("Unable to route terminal", "error"))
      : create();
  useEffect(() => {
    if (bridge && tabs.length === 0) void create();
  }, [bridge]);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(
      () =>
        fetch("http://127.0.0.1:8765/api/terminal-output/" + active)
          .then((r) => r.json())
          .then((d) => {
            const next = stripAnsi(d.output || "");
            setOutput((old) => {
              if (next !== old)
                setTabs((t) =>
                  t.map((x) =>
                    x.id === active
                      ? { ...x, status: d.closed ? "error" : "output" }
                      : x,
                  ),
                );
              return next;
            });
          })
          .catch(() => {}),
      250,
    );
    return () => clearInterval(timer);
  }, [active]);
  useEffect(() => {
    if (outputRef.current)
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [output]);
  const send = (value: string) =>
    fetch("http://127.0.0.1:8765/api/terminal-input", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: active, input: value }),
    }).catch(() => notify("Terminal input failed", "error"));
  const submit = () => {
    if (!active || !input) return;
    void send(input + "\r");
    setInput("");
  };
  const close = async (id: string) => {
    if (
      prefs.confirmTerminalClose &&
      !confirm(
        "End this terminal session? Running processes in it will be stopped.",
      )
    )
      return;
    await fetch("http://127.0.0.1:8765/api/terminal-close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const next = tabs.filter((t) => t.id !== id);
    setTabs(next);
    setActive(next[0]?.id || "");
    notify("Terminal session ended");
  };
  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        void newSession();
      } else if (e.ctrlKey && e.key.toLowerCase() === "w" && active) {
        e.preventDefault();
        void close(active);
      }
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [active, tabs, prefs]);
  const rename = (id: string, name: string) => {
    const next = prompt("Rename terminal tab", name)?.trim();
    if (next)
      setTabs((old) =>
        old.map((t) => (t.id === id ? { ...t, name: next } : t)),
      );
  };
  return (
    <section className="terminal-panel embedded-terminal">
      <header>
        <span>LCARS TERMINAL ACCESS</span>
        <b>{bridge ? "LOCAL PTY CONNECTED" : "LOCAL CORE STANDBY"}</b>
      </header>
      <nav className="terminal-tabs">
        {tabs.map((tab) => (
          <button
            className={
              (active === tab.id ? "active " : "") +
              "status-" +
              (tab.status || "idle")
            }
            key={tab.id}
            onClick={() => {
              setActive(tab.id);
              setTabs((old) =>
                old.map((t) =>
                  t.id === tab.id ? { ...t, status: "idle" } : t,
                ),
              );
            }}
            onDoubleClick={() => rename(tab.id, tab.name)}
            onAuxClick={(e) => {
              if (e.button === 1) {
                e.preventDefault();
                void close(tab.id);
              }
            }}
          >
            <span>{tab.name}</span>
            <i
              onClick={(e) => {
                e.stopPropagation();
                void close(tab.id);
              }}
            >
              ×
            </i>
          </button>
        ))}
        <button className="new-tab" onClick={newSession}>
          ＋
        </button>
      </nav>
      <pre
        ref={outputRef}
        className={"terminal-output cursor-" + prefs.terminalCursor}
        style={{ fontSize: prefs.terminalFontSize }}
      >
        {output || "LCARS COMMAND ENVIRONMENT\nWaiting for local PTY…"}
        <span className="terminal-cursor">█</span>
      </pre>
      <div className="terminal-input">
        <span>terminal@lcars:~$</span>
        <input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.ctrlKey && e.key.toLowerCase() === "c") void send("\u0003");
          }}
          placeholder="Type a command…"
        />
        <button onClick={submit}>ENTER</button>
      </div>
      <footer>
        <button onClick={newSession}>NEW SESSION</button>
        <button onClick={() => void send("\u0003")}>SEND CTRL+C</button>
        <button onClick={() => active && void close(active)}>
          END SESSION
        </button>
      </footer>
    </section>
  );
}
function stripAnsi(value: string) {
  return value.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "").replace(/\r/g, "");
}
