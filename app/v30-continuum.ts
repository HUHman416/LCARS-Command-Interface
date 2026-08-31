export type ApplicationDescriptor = {
  id: string;
  name: string;
  comment?: string;
};

const browserIdentity = /(?:^|[\s._-])(firefox|librewolf|floorp|zen|chromium|chrome|google chrome|opera(?: gx)?|vivaldi|brave|edge|microsoft edge|falkon)(?:$|[\s._-])/i;

export const isBrowserApplication = (application: ApplicationDescriptor) =>
  browserIdentity.test(`${application.id} ${application.name} ${application.comment || ""}`);

export const detectBrowserApplications = <T extends ApplicationDescriptor>(applications: T[]) =>
  applications.filter(isBrowserApplication).sort((left, right) => left.name.localeCompare(right.name));

const audioExtensions = new Set([
  "3ga", "8svx", "aa", "aac", "aax", "act", "aiff", "alac", "amr", "ape", "au", "awb", "caf", "dss", "dvf", "flac", "gsm", "iklax", "ivs", "m4a", "m4b", "m4p", "mmf", "movpkg", "mp3", "mpc", "msv", "nmf", "ogg", "oga", "mogg", "opus", "ra", "rm", "raw", "rf64", "sln", "tta", "voc", "vox", "wav", "wma", "wv", "webm",
]);
const videoExtensions = new Set([
  "3g2", "3gp", "amv", "asf", "avi", "drc", "f4a", "f4b", "f4p", "f4v", "flv", "gifv", "m2ts", "m2v", "m4p", "m4v", "mkv", "mng", "mov", "mp2", "mp4", "mpe", "mpeg", "mpg", "mpv", "mts", "mxf", "nsv", "ogv", "qt", "rm", "rmvb", "roq", "svi", "ts", "vob", "webm", "wmv", "yuv",
]);

export type LocalMediaKind = "audio" | "video";

export const classifyLocalMedia = (name: string, mime = ""): LocalMediaKind | null => {
  if (mime.toLowerCase().startsWith("video/")) return "video";
  if (mime.toLowerCase().startsWith("audio/")) return "audio";
  const extension = name.split(".").pop()?.toLowerCase() || "";
  if (videoExtensions.has(extension)) return "video";
  if (audioExtensions.has(extension)) return "audio";
  return null;
};

export type ContinuumRole =
  | "handheld-home"
  | "desktop-companion"
  | "media-controller"
  | "communications-panel"
  | "notification-console"
  | "system-monitor"
  | "presentation-controller"
  | "docked-command-station";

export type ContinuumEnvironment = {
  externalDisplay?: boolean;
  docked?: boolean;
  landscape?: boolean;
  largeScreen?: boolean;
  stationConnected?: boolean;
  presenting?: boolean;
};

export const continuumRoles: { id: ContinuumRole; name: string; description: string }[] = [
  { id: "handheld-home", name: "HANDHELD HOME", description: "Local applications, favorites, decks, widgets, and device status." },
  { id: "desktop-companion", name: "DESKTOP COMPANION", description: "General-purpose control surface for a connected LCARS station." },
  { id: "media-controller", name: "MEDIA CONTROLLER", description: "Now Playing, source selection, volume, and playback controls." },
  { id: "communications-panel", name: "COMMUNICATIONS PANEL", description: "Station messages, clipboard handoff, and communications controls." },
  { id: "notification-console", name: "NOTIFICATION CONSOLE", description: "Focused notice review, acknowledgement, and priority alerts." },
  { id: "system-monitor", name: "SECOND-SCREEN MONITOR", description: "Live station health and telemetry for a dedicated second screen." },
  { id: "presentation-controller", name: "PRESENTATION PADD", description: "Large, direct controls for presentation and command sequences." },
  { id: "docked-command-station", name: "DOCKED COMMAND STATION", description: "Expanded multi-column station controls for a docked tablet." },
];

export const recommendContinuumRole = (environment: ContinuumEnvironment): ContinuumRole => {
  if (environment.presenting && environment.stationConnected) return "presentation-controller";
  if ((environment.docked || environment.externalDisplay) && environment.largeScreen) return "docked-command-station";
  if (environment.externalDisplay && environment.stationConnected) return "system-monitor";
  if (environment.landscape && environment.stationConnected) return "desktop-companion";
  return "handheld-home";
};
