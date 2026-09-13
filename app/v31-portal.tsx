"use client";
/* Portal effects intentionally mirror broker selection into local form state. */
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { normalizePortalStatus, portalKindMeta, portalKinds, portalRequestNeedsChoice, protectedPortalKinds } from "./v31-portal-core";
import type { PortalIntentKind, PortalPolicy, PortalRequest, PortalStatus } from "./v31-portal-core";

type FileEntry = { name: string; path: string; directory: boolean; hidden?: boolean };
type AppEntry = { id: string; name: string; comment?: string };
type Props = { bridge: boolean; operatorName: string; authority?: string; notify: (message: string, kind?: "info" | "error") => void; onPendingChange?: (count: number) => void };
const endpoint = "http://127.0.0.1:8765";

async function operation(body: Record<string, unknown>, authority = "") {
  if (authority) body = { ...body, authority };
  const response = await fetch(`${endpoint}/api/portal-operation`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok || result.ok === false) throw new Error(result.error || "Portal operation failed");
  return result;
}

export function PortalCenter({ bridge, operatorName, authority = "", notify, onPendingChange }: Props) {
  const [status, setStatus] = useState<PortalStatus | null>(null);
  const [tab, setTab] = useState<"requests" | "routes" | "validate">("requests");
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState("");
  const [directory, setDirectory] = useState("~");
  const [parent, setParent] = useState("");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [apps, setApps] = useState<AppEntry[]>([]);
  const [choice, setChoice] = useState("");

  const refresh = async (quiet = false) => {
    if (!bridge) { setStatus(null); onPendingChange?.(0); return; }
    try {
      const response = await fetch(`${endpoint}/api/portal-status`, { cache: "no-store" });
      const next = normalizePortalStatus(await response.json());
      setStatus(next); onPendingChange?.(next?.pending || 0);
    } catch { if (!quiet) notify("Portal broker could not be reached", "error"); }
  };
  useEffect(() => { void refresh(true); const timer = window.setInterval(() => void refresh(true), 1800); return () => window.clearInterval(timer); }, [bridge]);

  const selected = useMemo(() => status?.requests.find((request) => request.id === selectedId) || status?.requests.find((request) => request.decision === "waiting") || status?.requests[0] || null, [status, selectedId]);
  useEffect(() => {
    if (!selected || !portalRequestNeedsChoice(selected)) return;
    if (selected.kind === "open-with") {
      fetch(`${endpoint}/api/apps`).then((response) => response.json()).then((value) => setApps((value.apps || []).slice(0, 80))).catch(() => setApps([]));
      return;
    }
    const suggested = typeof selected.payload?.directory === "string" ? selected.payload.directory : "~";
    setDirectory(suggested); setChoice("");
  }, [selected?.id]);
  useEffect(() => {
    if (!selected || selected.kind === "open-with" || !portalRequestNeedsChoice(selected)) return;
    fetch(`${endpoint}/api/files?path=${encodeURIComponent(directory)}`).then((response) => response.json()).then((value) => { setDirectory(value.path || directory); setParent(value.parent || ""); setFiles((value.items || []).filter((item: FileEntry) => !item.hidden)); }).catch(() => setFiles([]));
  }, [directory, selected?.id]);

  const run = async (label: string, body: Record<string, unknown>, success: string) => {
    setBusy(label);
    try { await operation(body, authority); notify(success); await refresh(true); }
    catch (error) { notify(error instanceof Error ? error.message : "Portal operation failed", "error"); }
    finally { setBusy(""); }
  };
  const resolve = (request: PortalRequest, decision: "approved" | "denied") => {
    const result: Record<string, unknown> = {};
    if (decision === "approved" && ["open-file", "save-file", "open-folder"].includes(request.kind)) result.path = choice || directory;
    if (decision === "approved" && request.kind === "open-with") result.applicationId = choice;
    if (decision === "approved" && portalRequestNeedsChoice(request) && !choice && request.kind !== "open-folder") { notify("Choose a destination before approval", "error"); return; }
    void run(request.id, { operation: "resolve", id: request.id, decision, operator: operatorName, result }, decision === "approved" ? "Portal request approved" : "Portal request denied");
  };
  const submitDemo = (kind: PortalIntentKind) => void run(`demo-${kind}`, { operation: "submit", kind, client: "LCARS ROUTE VALIDATOR", title: `${portalKindMeta[kind].label} route test`, detail: "Development validation request; no external action is performed.", payload: kind.includes("file") || kind.includes("folder") ? { directory: "~" } : {} }, "Validation request entered into the Portal queue");

  if (!bridge) return <section className="portal-center portal-offline"><header><span><small>VERSION 31.2 · INTENT BROKER</small><h3>LCARS PORTAL CENTER</h3></span><strong>OFFLINE</strong></header><div><b>LOCAL CORE REQUIRED</b><p>The Portal Center is available in the installed LCARS desktop application. Hosted preview mode never receives host files, devices, or permissions.</p></div></section>;
  return <section className="portal-center">
    <header><span><small>VERSION 31.2 DEVELOPMENT · TRUSTED INTENT ROUTING</small><h3>LCARS PORTAL CENTER</h3><p>One operator-controlled route for file choices, device access, protected actions, notifications, printing, and sharing.</p></span><strong className={status?.pending ? "attention" : ""}>{String(status?.pending || 0).padStart(2, "0")}<small>PENDING</small></strong></header>
    <nav>{(["requests", "routes", "validate"] as const).map((item, index) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}><i>{String(index + 1).padStart(2, "0")}</i><span>{item.toUpperCase()}</span></button>)}</nav>
    {tab === "requests" && <div className="portal-request-layout">
      <section className="portal-queue"><header><b>INTENT QUEUE</b><span>{status?.requests.length || 0} RETAINED</span></header>{status?.requests.length ? status.requests.map((request) => <button key={request.id} className={`${request.decision} ${selected?.id === request.id ? "selected" : ""}`} onClick={() => { setSelectedId(request.id); setChoice(""); }}><i>{portalKindMeta[request.kind]?.risk === "sensitive" ? "!" : "•"}</i><span><b>{request.title}</b><small>{request.client} · {portalKindMeta[request.kind]?.label || request.kind}</small></span><em>{request.decision.toUpperCase()}</em></button>) : <div className="portal-empty"><b>NO REQUESTS</b><small>APPLICATION INTENTS WILL APPEAR HERE</small></div>}</section>
      <section className="portal-inspector">{selected ? <><header><span><small>{selected.client}</small><h4>{selected.title}</h4></span><b className={portalKindMeta[selected.kind].risk}>{portalKindMeta[selected.kind].risk.toUpperCase()}</b></header><p>{selected.detail || portalKindMeta[selected.kind].detail}</p><dl><div><dt>ROUTE</dt><dd>{portalKindMeta[selected.kind].label}</dd></div><div><dt>STATE</dt><dd>{selected.decision.toUpperCase()}</dd></div><div><dt>REQUESTED</dt><dd>{new Date(selected.createdAt).toLocaleTimeString()}</dd></div></dl>
        {selected.decision === "waiting" && ["open-file", "save-file", "open-folder"].includes(selected.kind) && <div className="portal-picker"><div className="portal-path"><button onClick={() => setDirectory("~")}>HOME</button><button disabled={!parent} onClick={() => parent && setDirectory(parent)}>UP</button><span>{directory}</span></div><div className="portal-files">{files.map((file) => <button key={file.path} className={choice === file.path ? "chosen" : ""} onClick={() => file.directory ? setDirectory(file.path) : setChoice(file.path)}><i>{file.directory ? "DIR" : "FILE"}</i><span>{file.name}</span></button>)}</div>{selected.kind === "save-file" && <input aria-label="Save destination" placeholder="CHOOSE OR ENTER A PATH" value={choice} onChange={(event) => setChoice(event.target.value)} />}{selected.kind === "open-folder" && <button className="choose-directory" onClick={() => setChoice(directory)}>CHOOSE CURRENT FOLDER</button>}</div>}
        {selected.decision === "waiting" && selected.kind === "open-with" && <div className="portal-app-picker">{apps.map((application) => <button key={application.id} className={choice === application.id ? "chosen" : ""} onClick={() => setChoice(application.id)}><b>{application.name}</b><small>{application.comment || application.id}</small></button>)}</div>}
        {selected.decision === "waiting" ? <footer><button disabled={busy === selected.id} onClick={() => resolve(selected, "denied")}>DENY</button><button className="approve" disabled={busy === selected.id} onClick={() => resolve(selected, "approved")}>APPROVE</button></footer> : <footer><span>{selected.operator || "SYSTEM"} · {selected.reason || selected.decision.toUpperCase()}</span></footer>}</> : <div className="portal-empty"><b>SELECT AN INTENT</b><small>REVIEW DETAILS BEFORE APPROVAL</small></div>}</section>
    </div>}
    {tab === "routes" && <div className="portal-routes"><section className="portal-adapters"><header><b>PLATFORM ADAPTERS</b><span>{status?.adapters.filter((item) => item.active).length || 0} ACTIVE</span></header>{status?.adapters.map((adapter) => <article key={adapter.id} className={adapter.active ? "active" : adapter.available ? "available" : "offline"}><i>{adapter.active ? "●" : "○"}</i><span><b>{adapter.name}</b><small>{adapter.detail}</small></span><em>{adapter.active ? "ACTIVE" : adapter.available ? "READY" : "UNAVAILABLE"}</em></article>)}<button className={status?.standardPortalEnabled ? "enabled" : ""} disabled={!status?.adapters.some((item) => item.id === "xdg-desktop-portal" && item.available)} onClick={() => void run("registration", { operation: "registration", enabled: !status?.standardPortalEnabled }, status?.standardPortalEnabled ? "Standard portal adapter disabled" : "Standard portal adapter enabled")}>{status?.standardPortalEnabled ? "DISABLE XDG ADAPTER" : "ENABLE XDG ADAPTER"}</button></section>
      <section className="portal-policy"><header><b>ROUTING POLICY</b><span>SENSITIVE ROUTES ALWAYS REQUIRE REVIEW</span></header>{portalKinds.map((kind, index) => <article key={kind}><i>{String(index + 1).padStart(2, "0")}</i><span><b>{portalKindMeta[kind].label}</b><small>{portalKindMeta[kind].detail}</small></span><select aria-label={`${portalKindMeta[kind].label} policy`} value={status?.policies[kind] || "ask"} onChange={(event) => void run(kind, { operation: "policy", kind, policy: event.target.value as PortalPolicy }, `${portalKindMeta[kind].label} policy changed`)}><option value="ask">ASK</option>{!protectedPortalKinds.has(kind) && <option value="allow">ALLOW</option>}<option value="deny">DENY</option></select></article>)}</section>
    </div>}
    {tab === "validate" && <div className="portal-validate"><header><b>ROUTE VALIDATOR</b><span>NO EXTERNAL ACTIONS ARE PERFORMED</span></header><p>Submit a harmless development request to confirm that an application intent reaches the queue, receives the correct policy, and expires safely when left unanswered.</p><div>{portalKinds.map((kind, index) => <button key={kind} disabled={Boolean(busy)} onClick={() => submitDemo(kind)}><i>{String(index + 1).padStart(2, "0")}</i><span><b>{portalKindMeta[kind].label}</b><small>{portalKindMeta[kind].risk === "sensitive" ? "REVIEW REQUIRED" : "POLICY AWARE"}</small></span></button>)}</div><footer><button disabled={!status?.requests.some((request) => request.decision !== "waiting")} onClick={() => void run("clear", { operation: "clear-resolved" }, "Resolved portal history cleared")}>CLEAR RESOLVED HISTORY</button></footer></div>}
  </section>;
}
