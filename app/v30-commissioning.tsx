"use client";

import { useMemo, useState } from "react";

export type CommissioningState = "ready" | "optional" | "attention";
export type CommissioningTarget = "system" | "media" | "connected" | "modules" | "accessibility" | "recovery" | "updates" | "operators";
export type CommissioningCheck = {
  id: string;
  title: string;
  detail: string;
  state: CommissioningState;
  target: CommissioningTarget;
  remedy: string;
};

export type CommissioningContext = {
  bridge: boolean;
  health: Record<string, { available: boolean; detail: string; remedy?: string }>;
  voiceEnabled: boolean;
  voiceHealthy: boolean;
  operatorName: string;
  operatorRole: string;
  operatorProtected: boolean;
  pairedStations: number;
  onlineStations: number;
  encryptedStations: number;
  fabricReady: boolean;
  enabledFabricRoutes: number;
  installedModules: number;
  isolatedModules: number;
  updateChannel: "stable" | "development";
  updateAvailable: boolean;
  sessionRestore: boolean;
};

export const retentionPolicies = [
  { name: "OPERATIONS LOG", limit: "600 EVENTS", detail: "Oldest timeline records rotate out first." },
  { name: "COMMAND ACTIVITY", limit: "200 EVENTS", detail: "Keeps useful history without unbounded growth." },
  { name: "NOTIFICATION HISTORY", limit: "100 NOTICES", detail: "Expired notices remain bounded and searchable." },
  { name: "COMPUTER AUDIT", limit: "300 PLANS", detail: "Authorization codes and credentials are excluded." },
  { name: "RECOVERY SNAPSHOTS", limit: "5 SNAPSHOTS", detail: "Last-known-good configuration remains recoverable." },
  { name: "PRIVATE RECORDS", limit: "20 VERSIONS", detail: "Encrypted version history is capped per record." },
] as const;

export const commandReference = [
  { category: "NAVIGATION", phrase: "Computer, open Settings", alternatives: "Open Status · Files · Systems · Media · Network · Updates · Commissioning", result: "Opens the requested LCARS page." },
  { category: "NAVIGATION", phrase: "Computer, status report", alternatives: "Report · Run diagnostics", result: "Opens Systems and local diagnostics." },
  { category: "HELP", phrase: "Computer, what can I say?", alternatives: "Command help · Computer help", result: "Opens this offline command reference." },
  { category: "MEDIA", phrase: "Computer, pause the music", alternatives: "Hold media · Pause playback", result: "Pauses the live-selected media session." },
  { category: "MEDIA", phrase: "Computer, resume Spotify", alternatives: "Play Chromium · Continue music", result: "Resumes the named source or live-selected session." },
  { category: "MEDIA", phrase: "Computer, next track", alternatives: "Skip · Previous track · Stop playback", result: "Controls the active media session." },
  { category: "AUDIO", phrase: "Computer, set volume to 40", alternatives: "Mute audio · Unmute sound", result: "Changes the default system audio output." },
  { category: "ALERTS", phrase: "Computer, red alert", alternatives: "Yellow alert · Green alert · No alert", result: "Changes or clears the temporary alert condition." },
  { category: "COMMUNICATIONS", phrase: "Computer, open hailing frequencies", alternatives: "Open notices · Show communications", result: "Opens the Communications Action Center." },
  { category: "APPLICATIONS", phrase: "Computer, open an application", alternatives: "Launch [application name] · Open app [name]", result: "Prepares an installed-application launch." },
  { category: "PROCEDURES", phrase: "Computer, run [procedure name]", alternatives: "Start routine [name] · Execute procedure [name]", result: "Prepares the saved multi-step procedure." },
  { category: "WORKSPACE", phrase: "Computer, restore [workstation]", alternatives: "Load workspace [name] · Switch to workstation [name]", result: "Restores a saved workstation arrangement." },
  { category: "SYSTEM", phrase: "Computer, check for updates", alternatives: "Recheck integrations · Identify displays", result: "Runs the selected local system operation." },
  { category: "PROTECTED", phrase: "Computer, lock the workstation", alternatives: "Sleep · Restart · Shut down · Log out", result: "Uses the configured confirmation or vocal authorization gate." },
  { category: "PROTECTED", phrase: "Computer, self destruct", alternatives: "Self-destruct sequence", result: "Closes LCARS only after protected authorization." },
] as const;

export const filterCommandReference = (query: string, category = "ALL") => {
  const needle = query.trim().toLowerCase();
  return commandReference.filter((item) =>
    (category === "ALL" || item.category === category) &&
    (!needle || `${item.phrase} ${item.alternatives} ${item.result} ${item.category}`.toLowerCase().includes(needle)),
  );
};

export const buildCommissioningChecks = (context: CommissioningContext): CommissioningCheck[] => {
  const integrations = Object.values(context.health);
  const unavailable = integrations.filter((item) => !item.available);
  return [
    { id: "core", title: "LOCAL COMPUTER CORE", detail: context.bridge ? "Private loopback service is connected." : "The installed local service is not responding.", state: context.bridge ? "ready" : "attention", target: "system", remedy: "Open Diagnostics and repair the local installation." },
    { id: "integrations", title: "SYSTEM INTEGRATIONS", detail: integrations.length ? `${integrations.length - unavailable.length}/${integrations.length} operating-system adapters ready.` : "Run a full check to inventory local adapters.", state: integrations.length && !unavailable.length ? "ready" : "attention", target: "system", remedy: unavailable[0]?.remedy || "Run the full integration check." },
    { id: "voice", title: "OFFLINE VOICE", detail: context.voiceEnabled ? context.voiceHealthy ? "Bundled local recognition is ready." : "Voice is enabled but its local runtime needs attention." : "Voice commands are disabled by operator choice.", state: context.voiceEnabled ? context.voiceHealthy ? "ready" : "attention" : "optional", target: "system", remedy: "Review Offline Voice Control and test the bundled runtime." },
    { id: "federation", title: "TRUSTED STATIONS", detail: context.pairedStations ? `${context.onlineStations}/${context.pairedStations} online · ${context.encryptedStations} encrypted links.` : "No PADD or companion station is paired.", state: !context.pairedStations ? "optional" : context.encryptedStations === context.pairedStations ? "ready" : "attention", target: "connected", remedy: "Review Federation device trust and pairing." },
    { id: "fabric", title: "DATA FABRIC", detail: context.fabricReady ? `${context.enabledFabricRoutes} synchronization categories enabled.` : "Secure cross-station data services are not active.", state: context.fabricReady ? "ready" : context.pairedStations ? "attention" : "optional", target: "connected", remedy: "Open Search and review Data Fabric routes." },
    { id: "modules", title: "MODULE SAFETY", detail: `${context.installedModules} installed · ${context.isolatedModules} isolated after a fault.`, state: context.isolatedModules ? "attention" : "ready", target: "modules", remedy: "Review isolated modules, permissions, and rollback options." },
    { id: "operator", title: "OPERATOR AUTHORITY", detail: `${context.operatorName} · ${context.operatorRole.toUpperCase()}${context.operatorProtected ? " · PIN PROTECTED" : " · DIRECT LOCAL ACCESS"}.`, state: context.operatorProtected ? "ready" : "optional", target: "operators", remedy: "Add a local PIN if this is a shared station." },
    { id: "updates", title: "RELEASE CHANNEL", detail: `${context.updateChannel.toUpperCase()} channel${context.updateAvailable ? " · VERIFIED UPDATE AVAILABLE" : " · CURRENT"}.`, state: "ready", target: "updates", remedy: "Open Updates to inspect the verified package." },
    { id: "recovery", title: "SESSION RECOVERY", detail: context.sessionRestore ? "Last page and workstation recovery are enabled." : "Session restore is disabled by operator choice.", state: context.sessionRestore ? "ready" : "optional", target: "recovery", remedy: "Review recovery, safe mode, and configuration backup." },
  ];
};

export const commissioningSummary = (checks: CommissioningCheck[]) => ({
  ready: checks.filter((item) => item.state === "ready").length,
  optional: checks.filter((item) => item.state === "optional").length,
  attention: checks.filter((item) => item.state === "attention").length,
  total: checks.length,
});

export function CommissioningCenter({ context, refreshing, refresh, open, exportDiagnostics }: {
  context: CommissioningContext;
  refreshing: boolean;
  refresh: () => void;
  open: (target: CommissioningTarget) => void;
  exportDiagnostics: () => void;
}) {
  const [area, setArea] = useState<"readiness" | "commands" | "trust" | "limits">("readiness");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const checks = useMemo(() => buildCommissioningChecks(context), [context]);
  const summary = useMemo(() => commissioningSummary(checks), [checks]);
  const commands = useMemo(() => filterCommandReference(query, category), [query, category]);
  const categories = ["ALL", ...Array.from(new Set(commandReference.map((item) => item.category)))];
  return <section className="detail-view commissioning-center">
    <h3>COMMISSIONING & TRUST CENTER</h3>
    <header className="commissioning-hero"><span><small>VERSION 30.9 RELEASE CANDIDATE</small><b>{summary.attention ? "STATION REQUIRES REVIEW" : "STATION READY FOR DUTY"}</b><p>One local checklist for integrations, privacy, authority, recovery, accessibility, and release readiness.</p></span><strong>{String(summary.ready).padStart(2,"0")}<small>/{String(summary.total).padStart(2,"0")} READY</small></strong></header>
    <nav className="commissioning-tabs" aria-label="Commissioning Center sections">{([['readiness','READINESS'],['commands','COMMANDS'],['trust','TRUST + PRIVACY'],['limits','RESILIENCE']] as const).map(([id,label])=><button className={area===id?"active":""} onClick={()=>setArea(id)} key={id}>{label}</button>)}</nav>
    {area === "readiness" && <main className="commissioning-readiness"><div className="commissioning-actions"><button disabled={refreshing} onClick={refresh}>{refreshing ? "RUNNING FULL CHECK…" : "RUN FULL CHECK"}</button><button onClick={exportDiagnostics}>EXPORT PRIVATE DIAGNOSTICS</button><span><b>{summary.attention}</b> ACTION · <b>{summary.optional}</b> OPTIONAL</span></div><div className="commissioning-checks">{checks.map((item,index)=><article className={item.state} key={item.id}><i>{String(index+1).padStart(2,"0")}</i><span><small>{item.state.toUpperCase()}</small><b>{item.title}</b><p>{item.detail}</p>{item.state!=="ready"&&<em>{item.remedy}</em>}</span><button onClick={()=>open(item.target)}>{item.state==="ready"?"REVIEW":"OPEN FIX"}</button></article>)}</div></main>}
    {area === "commands" && <main className="commissioning-commands"><header><label>OFFLINE COMMAND SEARCH<input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="SEARCH PHRASES, ALIASES, OR RESULTS…"/></label><nav>{categories.map((item)=><button className={category===item?"active":""} onClick={()=>setCategory(item)} key={item}>{item}</button>)}</nav></header><div>{commands.map((item,index)=><article key={item.phrase}><i>{String(index+1).padStart(2,"0")}</i><span><small>{item.category}</small><b>“{item.phrase}”</b><p>{item.alternatives}</p></span><em>{item.result}</em></article>)}{!commands.length&&<p>NO MATCHING OFFLINE COMMANDS</p>}</div></main>}
    {area === "trust" && <main className="commissioning-trust"><article><small>ACTIVE AUTHORITY</small><b>{context.operatorName}</b><p>{context.operatorRole.toUpperCase()} · {context.operatorProtected?"LOCAL PIN PROTECTED":"DIRECT LOCAL ACCESS"}</p><button onClick={()=>open("operators")}>REVIEW OPERATORS</button></article><article><small>VOICE PRIVACY</small><b>{context.voiceEnabled?"LOCAL RECOGNITION":"DISABLED"}</b><p>{context.voiceEnabled?"Audio is handled by the station-local whisper.cpp runtime.":"No continuous or push-to-talk recognition is active."}</p><button onClick={()=>open("system")}>REVIEW VOICE</button></article><article><small>FEDERATION TRUST</small><b>{context.encryptedStations}/{context.pairedStations} ENCRYPTED</b><p>{context.onlineStations} paired stations currently online.</p><button onClick={()=>open("connected")}>REVIEW STATIONS</button></article><article><small>MODULE AUTHORITY</small><b>{context.installedModules} INSTALLED</b><p>{context.isolatedModules} isolated · explicit capabilities and rollback retained.</p><button onClick={()=>open("modules")}>REVIEW MODULES</button></article><footer><b>LOCAL-FIRST PRIVACY</b><span>Credentials, authorization phrases, clipboard contents, private records, terminal history, file names, window titles, and media titles are excluded from exported diagnostics.</span></footer></main>}
    {area === "limits" && <main className="commissioning-limits"><header><span><small>BOUNDED LOCAL STORAGE</small><b>LONG-RUN STABILITY LIMITS</b><p>Operational records rotate predictably so an always-on station does not grow without limit.</p></span><button onClick={()=>open("recovery")}>OPEN RECOVERY</button></header><div>{retentionPolicies.map((item,index)=><article key={item.name}><i>{String(index+1).padStart(2,"0")}</i><span><b>{item.name}</b><p>{item.detail}</p></span><strong>{item.limit}</strong></article>)}</div><footer><b>SUSPEND / RESUME READY</b><span>Visibility, focus, page restore, and network-return events trigger a fresh local status pass. Hidden windows use reduced polling until they return.</span></footer></main>}
  </section>;
}
