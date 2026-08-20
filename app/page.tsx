"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

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
};
type Stream = {
  id: string;
  name: string;
  volume: number;
  group?: string;
  advanced?: boolean;
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
type Health = Record<string, { available: boolean; detail: string }>;
type Drive = { id: string; name: string; size: number; type: string; filesystem: string; mountpoints: string[]; mounted: boolean; removable: boolean; parent?: string };
type TrayItem = { id: string; name: string; status: string; icon?: string };
type NetworkInterface = { id: string; name: string; kind: string; state: string; address: string; gateway: string; dns: string[]; speed: string; signal?: number; received: number; sent: number };
type NetworkInfo = { interfaces: NetworkInterface[]; diagnostics: { gateway: boolean; dns: boolean; internet: boolean; latency: number | null }; bluetooth: boolean };
type SystemDetails = { cpu?: { logical: number; load: number[]; cores: { name: string; usage: number }[] }; storage?: Drive[]; kernel?: string };
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
  startupSound: boolean;
  startupSequence: boolean;
  lockOnLaunch: boolean;
  quickBootWithoutPassword: boolean;
  trayPresentation: "rail" | "header";
};
type WorkspaceProfile = {
  id: string;
  name: string;
  theme: string;
  widgets: WidgetId[];
  widgetSizes: Record<string, string>;
  favoriteIds: string[];
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
  | "updates";
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
  startupSound: true,
  startupSequence: true,
  lockOnLaunch: true,
  quickBootWithoutPassword: false,
  trayPresentation: "rail",
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

export default function Home() {
  const [theme, setTheme] = useState("classic"),
    [section, setSection] = useState("overview"),
    [sound, setSound] = useState(true);
  const [volume, setVolume] = useState(64),
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
    [detailOpen, setDetailOpen] = useState<string | null>(null);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo>({ interfaces: [], diagnostics: { gateway: false, dns: false, internet: false, latency: null }, bluetooth: false }),
    [startupVisible, setStartupVisible] = useState(true);
  const [extensions, setExtensions] = useState<ExtensionManifest[]>([]);
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
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get(
      "section",
    );
    const restore = localStorage.getItem("lcars-session-restore") !== "false";
    setSessionRestore(restore);
    if (requested && nav.some((n) => n[0] === requested)) setSection(requested);
    else if (restore && localStorage.getItem("lcars-last-section"))
      setSection(localStorage.getItem("lcars-last-section") || "overview");
    const t = localStorage.getItem("lcars-theme"),
      f = localStorage.getItem("lcars-favorites"),
      w = localStorage.getItem("lcars-overview-widgets"),
      z = localStorage.getItem("lcars-widget-sizes"),
      p = localStorage.getItem("lcars-pinned-players"),
      s = localStorage.getItem("lcars-shell-prefs"),
      a = localStorage.getItem("lcars-accessibility"),
      pr = localStorage.getItem("lcars-workspaces"),
      u = localStorage.getItem("lcars-user-name"),
      lockData = localStorage.getItem("lcars-lock-credential"),
      defaultStation = localStorage.getItem("lcars-default-workstation") || "";
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
    if (s) try { restoredPrefs = { ...defaultPrefs, ...JSON.parse(s) }; setPrefs(restoredPrefs); } catch {}
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
    setDefaultWorkstation(defaultStation);
    const remoteTerminal = requested === "terminal";
    if (!remoteTerminal && localStorage.getItem("lcars-setup-complete") && restoredPrefs.lockOnLaunch && !(restoredPrefs.quickBootWithoutPassword && !lockData)) setLocked(true);
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
      })
      .catch(() => {});
    fetch("http://127.0.0.1:8765/api/config")
      .then((r) => r.json())
      .then((d) => {
        if (d.shell_prefs) setPrefs({ ...defaultPrefs, ...d.shell_prefs });
      })
      .catch(() => {});
    const getExtensions = () =>
      fetch("http://127.0.0.1:8765/api/extensions")
        .then((r) => r.json())
        .then((d) => setExtensions(Array.isArray(d.extensions) ? d.extensions : []))
        .catch(() => {});
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
    let sound = true;
    try {
      sound = JSON.parse(localStorage.getItem("lcars-shell-prefs") || "{}").startupSound !== false;
    } catch {}
    let powered = false;
    const reportAudio=(event:Event)=>{const result=(event as CustomEvent).detail;if(result)setStartupAudioStatus(`${result.status} · ${result.output||"SYSTEM DEFAULT"}${result.error?` · ${result.error}`:""}`);};
    const power = async () => {
      if (sound && !powered) {
        const result=window.__lcarsPlayStartupSound?await window.__lcarsPlayStartupSound():await (async()=>{try{const a=new Audio(new URL("assets/sounds/power-up.mp3",window.location.href).href);a.volume=.42;await a.play();return{ok:true,status:"PLAYING",asset:a.currentSrc,output:"SYSTEM DEFAULT"};}catch(error){return{ok:false,status:"FAILED",error:String(error),output:"SYSTEM DEFAULT"};}})();
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
      extensionTimer = setInterval(getExtensions, 5000);
    const startupTimer=setTimeout(()=>setStartupVisible(false),4200);
    return () => {
      clearInterval(timer);
      clearInterval(systemTimer);
      clearInterval(mediaTimer);
      clearInterval(desktopTimer);
      clearInterval(extensionTimer);
      clearTimeout(startupTimer);
      window.removeEventListener("lcars-startup-audio", power);
      window.removeEventListener("lcars-startup-audio-result",reportAudio);
      window.removeEventListener("pointerdown", power);
    };
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetch("http://127.0.0.1:8765/api/lcars-update")
        .then((response) => response.json())
        .then((result: UpdateInfo) => {
          if (result.ok && result.available) setLcarsUpdate(result);
        })
        .catch(() => {});
    }, 9000);
    return () => window.clearTimeout(timer);
  }, []);
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
  const choose = (id: string) => {
    beep(true);
    setTheme(id);
    localStorage.setItem("lcars-theme", id);
  };
  const launch = (app: App) => {
    beep(true);
    setBayApp(app);
    setSection("bay");
    setAllOpen(false);
    if (bridge)
      fetch("http://127.0.0.1:8765/api/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: app.id, mode: "bay" }),
      })
        .then(() => notify(app.name + " opened"))
        .catch(() => notify("Unable to launch " + app.name, "error"));
  };
  const toggleFavorite = (id: string) =>
    setFavoriteIds((old) => {
      const next = old.includes(id)
        ? old.filter((x) => x !== id)
        : old.length < 20
          ? [...old, id]
          : old;
      localStorage.setItem("lcars-favorites", JSON.stringify(next));
      return next;
    });
  const setSystemVolume = () => {
    if (bridge)
      fetch("http://127.0.0.1:8765/api/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ volume }),
      }).catch(() => {});
  };
  const notify = (
    text: string,
    kind: "info" | "error" = "info",
    playError = true,
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
    };
    setNotices((old) => [notice, ...old].slice(0, 50));
    if (!doNotDisturb)
      setTimeout(
        () =>
          setNotices((old) =>
            old.map((x) =>
              x.id === notice.id ? { ...x, id: -Math.abs(x.id) } : x,
            ),
          ),
        Math.max(1, prefs.notificationSeconds) * 1000,
      );
  };
  const dismissNotice = (id: number) =>
    setNotices((old) =>
      old.map((x) =>
        Math.abs(x.id) === Math.abs(id) ? { ...x, id: -Math.abs(x.id) } : x,
      ),
    );
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
          if (action === "extension-scan")
            fetch("http://127.0.0.1:8765/api/extensions")
              .then((r) => r.json())
              .then((result) => setExtensions(result.extensions || []))
              .catch(() => {});
        })
        .catch(() => notify("LOCAL CORE UNAVAILABLE", "error"));
    else notify(action.toUpperCase());
  };
  const powerAction = (action: "exit" | "poweroff" | "reboot") => {
    if (action === "exit") {
      setPowerOpen(false);
      window.close();
      return;
    }
    setPowerOpen(false);
    coreAction(action);
  };
  const refreshApps=()=>fetch("http://127.0.0.1:8765/api/apps").then((response)=>response.json()).then((result)=>{if(Array.isArray(result.apps)){setApps(result.apps);notify(`Application inventory refreshed · ${result.apps.length} entries`);}}).catch(()=>notify("Application inventory could not be refreshed","error"));
  const saveWidgets = (next: WidgetId[]) => {
    setWidgets(next);
    localStorage.setItem("lcars-overview-widgets", JSON.stringify(next));
  };
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
  const chooseAudioDevice = (id: string) =>
    fetch("http://127.0.0.1:8765/api/audio-device", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
      .then((r) => r.json())
      .then((d) => {
        setAudioDevices((old) =>
          old.map((x) => ({ ...x, default: x.id === id })),
        );
        notify(d.message || "Audio output changed");
      })
      .catch(() => notify("Unable to change audio output", "error"));
  const savePrefs = (next = prefs) => {
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
    setProfiles(next);
    localStorage.setItem("lcars-workspaces", JSON.stringify(next));
  };
  const chooseDefaultWorkstation = (id: string) => {
    setDefaultWorkstation(id);
    if (id) localStorage.setItem("lcars-default-workstation", id);
    else localStorage.removeItem("lcars-default-workstation");
    notify(id ? "Default workstation assigned" : "Default workstation cleared");
  };
  const createProfile = () => {
    const name = prompt("Workspace profile name")?.trim();
    if (!name) return;
    const profile = {
      id: Date.now().toString(),
      name,
      theme,
      widgets: [...widgets],
      widgetSizes: { ...widgetSizes },
      favoriteIds: [...favoriteIds],
    };
    saveProfiles([...profiles, profile]);
    setActiveProfile(profile.id);
    notify(name + " workspace saved");
  };
  const applyProfile = (profile: WorkspaceProfile) => {
    setTheme(profile.theme);
    setWidgets(profile.widgets);
    setWidgetSizes(profile.widgetSizes);
    setFavoriteIds(profile.favoriteIds);
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
    notify(profile.name + " workspace activated");
  };
  const deleteProfile = (id: string) => {
    saveProfiles(profiles.filter((p) => p.id !== id));
    if (activeProfile === id) setActiveProfile("");
    if (defaultWorkstation === id) chooseDefaultWorkstation("");
  };
  const saveAccess = (next: AccessibilityPrefs) => {
    setAccess(next);
    localStorage.setItem("lcars-accessibility", JSON.stringify(next));
  };
  const exportConfig = () => {
    const data = {
      version: 12,
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
        if (d.theme) choose(d.theme);
        if (Array.isArray(d.favoriteIds)) {
          setFavoriteIds(d.favoriteIds);
          localStorage.setItem(
            "lcars-favorites",
            JSON.stringify(d.favoriteIds),
          );
        }
        if (Array.isArray(d.widgets)) saveWidgets(d.widgets);
        if (d.widgetSizes) {
          setWidgetSizes(d.widgetSizes);
          localStorage.setItem(
            "lcars-widget-sizes",
            JSON.stringify(d.widgetSizes),
          );
        }
        if (d.prefs) {
          setPrefs({ ...defaultPrefs, ...d.prefs });
          localStorage.setItem("lcars-shell-prefs", JSON.stringify(d.prefs));
        }
        if (d.access) saveAccess({ ...defaultAccess, ...d.access });
        if (Array.isArray(d.profiles)) saveProfiles(d.profiles);
        if (d.userName) {
          setUserName(d.userName);
          localStorage.setItem("lcars-user-name", d.userName);
        }
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
      ...apps.map((a) => ({
        id: "app-" + a.id,
        label: "Launch " + a.name,
        detail: a.comment || "APPLICATION",
        run: () => {
          launch(a);
          setPaletteOpen(false);
        },
      })),
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
    [apps],
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
      ? extensions.find((extension) => `ext:${extension.id}` === id)
      : undefined;
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
        extension.apiVersion===1?<ChecklistExtension extension={extension} />:<DeclarativeExtension extension={extension} placement={extension.placements.find((placement)=>placement.type==="overview")||extension.placements[0]} />
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
        </section>
      );
    if (id === "favorites")
      return (
        <section className="overview-widget wide-widget">
          <h3>
            FAVORITE APPLICATIONS <small>APP-02</small>
          </h3>
          <div className="apps">
            {favorites.slice(0, 20).map((a, i) => (
              <button key={a.id} onClick={() => launch(a)}>
                <i className={"c" + i}>{a.icon ? <img src={a.icon} alt="" /> : a.name.slice(0, 2).toUpperCase()}</i>
                <span>
                  <b>{a.name}</b>
                  <small>{a.comment || "APPLICATION"}</small>
                </span>
              </button>
            ))}
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
        (access.colorSafe ? " color-safe" : "") + " density-" + prefs.interfaceDensity
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
        {extensions.flatMap((extension)=>extension.placements.filter((placement)=>placement.type==="header").map((placement)=><ExtensionHeader key={`${extension.id}:${placement.id}`} extension={extension} placement={placement} now={clock||new Date()}/>))}
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
      <div className="shell">
        <aside>
          {prefs.trayPresentation==="header"?<button className="elbow header-tray-trigger" aria-expanded={trayOpen} onClick={()=>setTrayOpen((value)=>!value)}><span>TRAY</span><small>{trayItems.length.toString().padStart(2,"0")}</small></button>:<div className="elbow"><span>SYS</span><small>47</small></div>}
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
          <div
            className={
              "task-zone " +
              (taskRail || taskLocked || prefs.taskPinned ? "rail-open " : "") +
              (taskLocked || prefs.taskPinned ? "rail-locked" : "")
            }
            onMouseEnter={taskEnter}
            onMouseLeave={taskLeave}
          >
            {prefs.trayPresentation==="rail"&&<button className="tray-strip-trigger" aria-label="Open system tray" aria-expanded={trayOpen} onClick={(event) => { event.stopPropagation(); setTrayOpen((value) => !value); }}><span>TRAY</span><b>‹</b></button>}
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
                    : section.toUpperCase()}
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
                <button
                  className={overviewEdit ? "editing" : ""}
                  onClick={() => setOverviewEdit(!overviewEdit)}
                >
                  {overviewEdit ? "FINISH EDITING" : "CONFIGURE OVERVIEW"}
                </button>
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
              <StorageMatrix drives={drives} notify={notify} refresh={() => fetch("http://127.0.0.1:8765/api/storage").then((r) => r.json()).then((d) => setDrives(d.drives || []))} />
            </section>
          )}
          {section === "media" && (
            <section className="detail-view media-view scroll-page">
              <h3>MEDIA & AUDIO CONTROL</h3>
              <MediaSources
                players={sortedPlayers}
                pinned={pinnedPlayers}
                togglePinned={togglePinned}
                control={mediaControl}
              />
              <div className="volume-console">
                <span>MASTER AUDIO OUTPUT</span>
                <strong>{volume}%</strong>
                <input
                  aria-label="Master audio"
                  type="range"
                  value={volume}
                  onChange={(e) => setVolume(+e.target.value)}
                  onPointerUp={setSystemVolume}
                />
                <div className="audio-routing">
                  {(["output", "input"] as const).map((kind) => {
                    const devices = audioDevices.filter((d) => d.kind === kind);
                    return (
                      <label className="audio-device-select" key={kind}>
                        <span>
                          {kind === "output"
                            ? "OUTPUT DEVICE"
                            : "INPUT / MICROPHONE"}
                        </span>
                        <select
                          aria-label={
                            kind === "output"
                              ? "Audio output device"
                              : "Audio input device"
                          }
                          value={devices.find((d) => d.default)?.id || ""}
                          onChange={(e) => chooseAudioDevice(e.target.value)}
                        >
                          <option value="" disabled>
                            {devices.length
                              ? "SELECT DEVICE"
                              : "NO PIPEWIRE DEVICES DETECTED"}
                          </option>
                          {devices.map((d) => (
                            <option value={d.id} key={d.id}>
                              {d.default ? "● " : ""}
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    );
                  })}
                </div>
                <div>
                  <button
                    onClick={() => {
                      setVolume(0);
                      if (bridge)
                        fetch("http://127.0.0.1:8765/api/audio", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ volume: 0 }),
                        });
                    }}
                  >
                    MUTE
                  </button>
                  <button onClick={() => coreAction("media-player")}>
                    OPEN MEDIA PLAYER
                  </button>
                  <button onClick={() => coreAction("audio-settings")}>
                    AUDIO DEVICES
                  </button>
                </div>
              </div>
              <StreamVolumes streams={streams} setVolume={streamVolume} />
            </section>
          )}
          {section === "network" && (
            <NetworkConsole info={networkInfo} action={coreAction} refresh={() => fetch("http://127.0.0.1:8765/api/network-details").then((r) => r.json()).then(setNetworkInfo).catch(() => notify("Network telemetry unavailable","error"))} />
          )}
          {section === "updates" && (
            <UpdateCenter platform={platform} action={coreAction} health={health} prefs={prefs} configureVoice={() => setSection("settings")} update={lcarsUpdate} setUpdate={setLcarsUpdate} notify={notify} />
          )}
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
                  setSessionRestore(v);
                  localStorage.setItem("lcars-session-restore", String(v));
                }}
                userName={userName}
                setUserName={(v) => {
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
                setPrefs={setPrefs}
                save={() => savePrefs()}
                saved={configSaved}
                health={health}
                recheck={() => coreAction("integration-recheck")}
                startupAudioStatus={startupAudioStatus}
                testStartupAudio={async()=>{const result=await window.__lcarsPlayStartupSound?.(true);if(result)setStartupAudioStatus(`${result.status} · ${result.output||"SYSTEM DEFAULT"}${result.error?` · ${result.error}`:""}`);}}
              />
              <ExtensionSettings extensions={extensions}/>
              <div className="settings-grid">
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
          refresh={refreshApps}
        />
      )}
      <SystemTray
        players={players.length}
        notices={notices.length}
        displays={displays.length}
        bridge={bridge}
        openNotices={() => setHistoryOpen(true)}
        openMedia={() => setSection("media")}
        openNetwork={() => setSection("network")}
      />
      <TrayDrawer open={trayOpen} items={trayItems} close={() => setTrayOpen(false)} openNetwork={() => { setSection("network");setTrayOpen(false); }} openMedia={() => { setSection("media");setTrayOpen(false); }} />
      {startupVisible && prefs.startupSequence && <StartupTelemetry bridge={bridge} reduced={access.reducedMotion} />}
      <VoiceControl prefs={prefs} apps={apps} extensions={extensions} navigate={setSection} launch={launch} action={coreAction} notify={notify} />
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
        historyOpen={historyOpen}
        close={() => setHistoryOpen(false)}
        dismiss={dismissNotice}
        clear={() => setNotices([])}
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

function NetworkConsole({info,action,refresh}:{info:NetworkInfo;action:(value:string)=>void;refresh:()=>void}) {
  const amount=(value:number)=>value>1073741824?(value/1073741824).toFixed(1)+" GB":value>1048576?(value/1048576).toFixed(1)+" MB":(value/1024).toFixed(0)+" KB";
  const diagnostics=[['GATEWAY',info.diagnostics.gateway],['DNS',info.diagnostics.dns],['EXTERNAL LINK',info.diagnostics.internet]] as const;
  return <section className="detail-view lcars-console network-console"><header className="console-cap"><div><small>NET / SUBSPACE OPERATIONS</small><h3>NETWORK OPERATIONS</h3></div><strong>{info.interfaces.length.toString().padStart(2,'0')}</strong></header><div className="network-grid">{info.interfaces.length?info.interfaces.map((link,index)=><article className="network-tile" key={link.id}><i>{String(index+1).padStart(2,'0')}</i><header><small>{link.kind.toUpperCase()} INTERFACE</small><b>{link.name}</b><em className={link.state==='connected'?'online':''}>{link.state.toUpperCase()}</em></header><div className="network-address"><span><small>ADDRESS</small><b>{link.address||'UNASSIGNED'}</b></span><span><small>GATEWAY</small><b>{link.gateway||'LOCAL ONLY'}</b></span></div><div className="network-flow"><span>RX {amount(link.received)}</span><i><em style={{width:Math.min(100,(link.received%100000000)/1000000)+'%'}} /></i><span>TX {amount(link.sent)}</span></div><footer><span>{link.speed||'LINK SPEED UNKNOWN'}</span>{typeof link.signal==='number'&&<b>SIGNAL {link.signal}%</b>}</footer></article>):<div className="adaptive-empty"><b>NO NETWORK INTERFACES REPORTED</b><small>The platform adapter did not return an active data link.</small></div>}</div><section className="network-diagnostics"><header><small>CONNECTION DIAGNOSTICS</small><b>{info.diagnostics.latency===null?'NO LATENCY':info.diagnostics.latency+' MS'}</b></header>{diagnostics.map(([name,ok],index)=><article key={name}><i>{String(index+1).padStart(2,'0')}</i><span>{name}</span><b className={ok?'ok':'bad'}>{ok?'ONLINE':'OFFLINE'}</b></article>)}<article><i>04</i><span>BLUETOOTH</span><b className={info.bluetooth?'ok':'bad'}>{info.bluetooth?'ACTIVE':'INACTIVE'}</b></article></section><nav className="network-actions"><button onClick={()=>action('network-settings')}>NETWORK SETTINGS</button><button onClick={()=>action('wifi')}>WI-FI CONTROL</button><button onClick={()=>action('bluetooth')}>BLUETOOTH CONTROL</button><button onClick={refresh}>REFRESH & TEST</button></nav></section>;
}

function TrayDrawer({open,items,close,openNetwork,openMedia}:{open:boolean;items:TrayItem[];close:()=>void;openNetwork:()=>void;openMedia:()=>void}) { if(!open)return null;const activate=(id:string)=>fetch("http://127.0.0.1:8765/api/tray-action",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})}).catch(()=>{});return <aside className="tray-drawer"><header><div><small>LOCAL STATUSNOTIFIER MATRIX</small><h3>SYSTEM TRAY</h3></div><button onClick={close}>CLOSE ×</button></header><nav><button onClick={openNetwork}>NETWORK</button><button onClick={openMedia}>MEDIA & AUDIO</button></nav><div>{items.length?items.map((item)=><button key={item.id} onClick={()=>activate(item.id)} title={item.name}><i>{item.icon?<img src={item.icon} alt=""/>:"◆"}</i><span><b>{item.name}</b><small>{item.status}</small></span><em>›</em></button>):<p>NO EXTERNAL TRAY SERVICES REPORTED</p>}</div></aside>; }

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

function SystemDetail({ kind, details, close }: { kind: string; details: SystemDetails; close: () => void }) {
  return <div className="backdrop"><section className="system-detail" role="dialog" aria-modal="true"><header><div><small>EXPANDED TELEMETRY</small><h2>{kind} DIAGNOSTIC</h2></div><button onClick={close}>CLOSE ×</button></header>{kind === "CPU" && <><p>{details.cpu?.logical || 0} LOGICAL PROCESSORS · LOAD {details.cpu?.load?.join(" / ") || "UNKNOWN"}</p><div className="core-grid">{details.cpu?.cores?.map((core) => <article key={core.name}><span><b>{core.name}</b><strong>{core.usage}%</strong></span><i><em style={{ width: core.usage + "%" }} /></i></article>)}</div></>}{kind === "DISK" && <div className="detail-drives">{details.storage?.map((drive) => <p key={drive.id}><b>{drive.name}</b><small>{(drive.size / 1073741824).toFixed(1)} GB · {drive.mounted ? drive.mountpoints.join(", ") : "NOT MOUNTED"}</small></p>)}</div>}{kind !== "CPU" && kind !== "DISK" && <p>LIVE {kind} telemetry is displayed on the primary meter. Additional hardware sensors will appear here when the platform adapter reports them.</p>}<footer>KERNEL {details.kernel || "PLATFORM MANAGED"}</footer></section></div>;
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
}: {
  platform: string;
  action: (value: string) => void;
  health: Health;
  prefs: ShellPrefs;
  configureVoice: () => void;
  update: UpdateInfo | null;
  setUpdate: (update: UpdateInfo | null) => void;
  notify: (text: string, kind?: "info" | "error") => void;
}) {
  const windows = platform.includes("WINDOWS");
  const [updateBusy,setUpdateBusy]=useState<""|"check"|"download"|"install">("");
  const updateOperation=async(operation:"check"|"download"|"install")=>{
    setUpdateBusy(operation);
    try{
      const response=await fetch("http://127.0.0.1:8765/api/lcars-update",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({operation,path:update?.path||""})});
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
          status={updateBusy?updateBusy.toUpperCase()+"…":update?.downloaded?"VERIFIED / READY":update?.available?`V${update.version} AVAILABLE`:"V23.2 CHANNEL"}
          description={update?.available?`A newer signed release is available from GitHub${update.asset?.name?`: ${update.asset.name}`:""}.`:"Background checks stay silent when offline. Manual checks report useful connection and verification details here."}
          primary={update?.downloaded?"INSTALL VERIFIED UPDATE":update?.available?"DOWNLOAD & VERIFY":"CHECK FOR LCARS UPDATE"}
          secondary="ROLL BACK RELEASE"
          primaryAction={() => updateOperation(update?.downloaded?"install":update?.available?"download":"check")}
          secondaryAction={() => action("lcars-rollback")}
          stamp={update?.sha256?`SHA-256 ${update.sha256.slice(0,16).toUpperCase()}…`:"AUTOMATIC GITHUB RELEASE CHANNEL · BACKGROUND ERRORS SILENT"}
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
    </section>
  );
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
  action: (value: "exit" | "poweroff" | "reboot") => void;
}) {
  const [confirmPower, setConfirmPower] = useState<
    "poweroff" | "reboot" | null
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
              CONFIRM {confirmPower === "poweroff" ? "SHUTDOWN" : "RESTART"}
            </h2>
          </header>
          <p>
            {confirmPower === "poweroff"
              ? "The computer will turn off and all running applications will close."
              : "The computer will restart and all running applications will close."}
          </p>
          <div className="power-confirm-actions">
            <button autoFocus onClick={() => action(confirmPower)}>
              {confirmPower === "poweroff"
                ? "SHUT DOWN COMPUTER"
                : "RESTART COMPUTER"}
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
          <button className="power-cancel" onClick={close}>
            <i>04</i>
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
  setPrefs,
  save,
  saved,
  health,
  recheck,
  startupAudioStatus,
  testStartupAudio,
}: {
  platform: string;
  prefs: ShellPrefs;
  setPrefs: (p: ShellPrefs) => void;
  save: () => void;
  saved: boolean;
  health: Health;
  recheck: () => void;
  startupAudioStatus: string;
  testStartupAudio: () => void | Promise<void>;
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
          <label>
            INTERFACE DENSITY
            <small>Changes panel spacing and information density without changing the operating-system display scale.</small>
            <select value={prefs.interfaceDensity} onChange={(e) => set("interfaceDensity", e.target.value as ShellPrefs["interfaceDensity"])}>
              <option value="comfortable">COMFORTABLE</option>
              <option value="compact">COMPACT</option>
              <option value="console">CONSOLE DENSE</option>
            </select>
          </label>
          <Toggle label="Play startup power sequence" description="Plays the bundled LCARS power-up sound when the desktop app opens. It never delays the interface." checked={prefs.startupSound} change={(v) => set("startupSound", v)} />
          <div className="startup-audio-diagnostic"><button onClick={testStartupAudio}>TEST POWER-UP AUDIO</button><small>{startupAudioStatus}</small><em>ASSET: LCARS BUNDLED MP3 · OUTPUT: OPERATING-SYSTEM DEFAULT</em></div>
          <Toggle label="Show background startup telemetry" description="Shows a small nonblocking system-check strip while LCARS connects to local services." checked={prefs.startupSequence} change={(v) => set("startupSequence", v)} />
          <label>SYSTEM TRAY PRESENTATION<small>Places the same tray drawer trigger in the side rail or the compact SYS 47 header position.</small><select value={prefs.trayPresentation} onChange={(event)=>set("trayPresentation",event.target.value as ShellPrefs["trayPresentation"])}><option value="rail">SIDE RAIL</option><option value="header">HEADER / SYS 47</option></select></label>
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
          <h4>INTEGRATION HEALTH</h4>
          <p>Shows whether each local service needed by LCARS is available.</p>
          <div className="health-grid">
            {Object.entries(health).map(([name, item]) => (
              <p key={name}>
                <i className={item.available ? "ok" : "bad"} />
                <span>
                  <b>{name.toUpperCase()}</b>
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

function VoiceControl({ prefs, apps, extensions, navigate, launch, action, notify }: { prefs: ShellPrefs; apps: App[]; extensions: ExtensionManifest[]; navigate: (page: string) => void; launch: (app: App) => void; action: (value: string) => void; notify: (text: string, kind?: "info" | "error") => void }) {
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
    if (prefs.voiceSecurity !== "navigation") {
      const app=apps.find((candidate) => text.includes("open "+candidate.name.toLowerCase()) || text.includes("launch "+candidate.name.toLowerCase()));
      if (app) { affirmative();launch(app);return; }
    }
    if (prefs.voiceSecurity === "system") {
      if (text.includes("open tasks") || text.includes("task rail")) { affirmative();action("refresh-system");return notify("Task Rail ready — use the rail control to pin it"); }
      if (text.includes("check updates")) { affirmative();navigate("updates");action("check-updates");return; }
      if (/shut ?down|restart|reboot|unmount/.test(text)) return notify("Protected voice command requires manual confirmation in its LCARS panel", "error");
    }
    notify("Voice command not recognized: "+raw, "error");
  };
  const start = async () => {
    try { const stream=await navigator.mediaDevices.getUserMedia({audio:prefs.voiceDevice?{deviceId:{exact:prefs.voiceDevice}}:true});const media=new MediaRecorder(stream);chunks.current=[];media.ondataavailable=(event) => event.data.size && chunks.current.push(event.data);media.onstop=async()=>{setListening(false);setBusy(true);stream.getTracks().forEach((track)=>track.stop());try{const blob=new Blob(chunks.current,{type:media.mimeType});const reader=new FileReader();reader.onload=async()=>{try{const response=await fetch("http://127.0.0.1:8765/api/voice-transcribe",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({audio:String(reader.result)})});const result=await response.json();result.ok&&result.text?execute(result.text):notify(result.message||"Voice recognition failed","error");}catch{notify("Local voice core did not respond","error");}finally{setBusy(false);}};reader.readAsDataURL(blob);}catch{setBusy(false);notify("Microphone sample could not be processed","error");}};recorder.current=media;media.start();setListening(true);setTimeout(()=>media.state==="recording"&&media.stop(),15000);} catch { notify("Microphone access was denied", "error"); }
  };
  return <aside className={(listening ? "listening " : "")+"voice-control"}><button aria-label={listening?"Stop listening":"Push to talk"} onClick={() => listening ? recorder.current?.stop() : start()} disabled={busy}><i>●</i>{busy?"PROCESSING":listening?"LISTENING — STOP":"VOICE"}</button>{history.length>0&&<small title={history.join("\n")}>LAST: {history[0]}</small>}</aside>;
}

function SystemTray({
  players,
  notices,
  displays,
  bridge,
  openNotices,
  openMedia,
  openNetwork,
}: {
  players: number;
  notices: number;
  displays: number;
  bridge: boolean;
  openNotices: () => void;
  openMedia: () => void;
  openNetwork: () => void;
}) {
  return (
    <nav className="system-tray" aria-label="LCARS system tray">
      <button onClick={openNetwork}>
        <i className={bridge ? "online" : ""} />
        NET
      </button>
      <button onClick={openMedia}>♫ {players}</button>
      <button onClick={openNotices}>◈ {notices}</button>
      <span>{displays} DISP</span>
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
function StreamVolumes({
  streams,
  setVolume,
}: {
  streams: Stream[];
  setVolume: (id: string, value: number) => void;
}) {
  const [advanced, setAdvanced] = useState(false),
    [expanded, setExpanded] = useState<string[]>([]);
  const groups = Array.from(new Set(streams.map((s) => s.group || s.name))).map(
    (name) => ({
      name,
      items: streams.filter((s) => (s.group || s.name) === name),
    }),
  );
  const visible = advanced
    ? groups
    : groups.filter((g) => g.items.some((s) => !s.advanced));
  const toggle = (name: string) =>
    setExpanded((old) =>
      old.includes(name) ? old.filter((x) => x !== name) : [...old, name],
    );
  return (
    <section className="stream-volumes">
      <h4>
        <span>
          APPLICATION AUDIO STREAMS <small>PIPEWIRE</small>
        </span>
        <button onClick={() => setAdvanced(!advanced)}>
          {advanced ? "APPLICATIONS ONLY" : "SHOW ALL PIPEWIRE STREAMS"}
        </button>
      </h4>
      {visible.length ? (
        visible.map((group) => {
          const main = group.items.find((s) => !s.advanced) || group.items[0],
            open = expanded.includes(group.name);
          return (
            <article className="audio-group" key={group.name}>
              <label>
                <span>
                  <b>{group.name}</b>
                  <small>
                    {main.volume}% · {group.items.length}{" "}
                    {group.items.length === 1 ? "STREAM" : "STREAMS"}
                  </small>
                </span>
                <input
                  aria-label={group.name + " volume"}
                  type="range"
                  value={main.volume}
                  onChange={(e) => setVolume(main.id, +e.target.value)}
                />
                <button
                  aria-label={
                    open ? "Collapse " + group.name : "Expand " + group.name
                  }
                  onClick={() => toggle(group.name)}
                >
                  {open ? "−" : "+"}
                </button>
              </label>
              {open && (
                <div>
                  {group.items.map((stream) => (
                    <label key={stream.id}>
                      <span>
                        <b>{stream.name}</b>
                        <small>{stream.volume}%</small>
                      </span>
                      <input
                        aria-label={stream.name + " volume"}
                        type="range"
                        value={stream.volume}
                        onChange={(e) => setVolume(stream.id, +e.target.value)}
                      />
                    </label>
                  ))}
                </div>
              )}
            </article>
          );
        })
      ) : (
        <p>NO APPLICATION AUDIO STREAMS ARE CURRENTLY ACTIVE</p>
      )}
    </section>
  );
}
function NotificationCenter({
  notices,
  historyOpen,
  close,
  dismiss,
  clear,
  doNotDisturb,
  toggleDnd,
}: {
  notices: Notice[];
  historyOpen: boolean;
  close: () => void;
  dismiss: (id: number) => void;
  clear: () => void;
  doNotDisturb: boolean;
  toggleDnd: () => void;
}) {
  const [query, setQuery] = useState(""),
    live = notices.filter((n) => n.id > 0).slice(0, 3),
    visible = notices.filter((n) =>
      n.text.toLowerCase().includes(query.toLowerCase()),
    );
  return (
    <>
      <div className="toast-stack">
        {live.map((n) => (
          <div className={"toast " + n.kind} key={n.id}>
            <i>●</i>
            <span>
              <b>{n.text}</b>
              <small>{n.time}</small>
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
              <small>LCARS EVENT LOG</small>
              <h3>NOTIFICATIONS</h3>
            </div>
            <button onClick={close}>CLOSE ×</button>
          </header>
          <nav>
            <button
              className={doNotDisturb ? "active" : ""}
              onClick={toggleDnd}
            >
              {doNotDisturb ? "DO NOT DISTURB ON" : "DO NOT DISTURB OFF"}
            </button>
            <button onClick={clear}>CLEAR HISTORY</button>
          </nav>
          <input
            aria-label="Search notification history"
            placeholder="SEARCH EVENT LOG…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {visible.length ? (
            visible.map((n) => (
              <article key={Math.abs(n.id)}>
                <i>●</i>
                <span>
                  <b>{n.text}</b>
                  <small>{n.time}</small>
                </span>
              </article>
            ))
          ) : (
            <p>NO MATCHING NOTIFICATIONS</p>
          )}
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
  refresh,
}: {
  title: string;
  apps: App[];
  query: string;
  setQuery: (x: string) => void;
  close: () => void;
  action: (a: App) => void;
  selected?: string[];
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
        <div className="app-list">
          {apps.map((a) => (
            <button
              key={a.id}
              className={selected.includes(a.id) ? "chosen" : ""}
              onClick={() => action(a)}
            >
              <i>{a.icon ? <img src={a.icon} alt="" /> : a.name.slice(0, 2).toUpperCase()}</i>
              <span>
                <b>{a.name}</b>
                <small>{a.comment || a.id}</small>
              </span>
              <strong>
                {selected.length
                  ? selected.includes(a.id)
                    ? "REMOVE"
                    : "ADD"
                  : "LAUNCH"}
              </strong>
            </button>
          ))}
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
