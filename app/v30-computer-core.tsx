"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ComputerAuditEntry, ComputerPlan, ComputerRisk, ComputerUndoSnapshot } from "./v30-core";

type ProcedureSummary = {
  id: string;
  name: string;
  description: string;
  trigger: string;
  stepCount: number;
  enabled: boolean;
  risk: ComputerRisk;
  reversible: boolean;
};

export function ComputerCoreConsole({
  bridge,
  procedures,
  audit,
  undoSnapshot,
  running,
  initialCommand = "",
  voiceAuthorizationRequired = false,
  voiceAuthorizationSatisfied = false,
  resolve,
  execute,
  undo,
  openBuilder,
  clearAudit,
  close,
}: {
  bridge: boolean;
  procedures: ProcedureSummary[];
  audit: ComputerAuditEntry[];
  undoSnapshot: ComputerUndoSnapshot | null;
  running: boolean;
  initialCommand?: string;
  voiceAuthorizationRequired?: boolean;
  voiceAuthorizationSatisfied?: boolean;
  resolve: (input: string) => ComputerPlan;
  execute: (plan: ComputerPlan, dryRun: boolean) => Promise<boolean>;
  undo: () => void;
  openBuilder: () => void;
  clearAudit: () => void;
  close: () => void;
}) {
  const [area, setArea] = useState<"command" | "procedures" | "audit">("command");
  const [query, setQuery] = useState("");
  const [plan, setPlan] = useState<ComputerPlan | null>(null);
  const [transmitting, setTransmitting] = useState<"execute" | "dry-run" | "">("");
  const appliedInitial = useRef("");
  const activeTriggers = useMemo(() => procedures.filter((item) => item.enabled && item.trigger !== "manual").length, [procedures]);
  const protectedProcedures = useMemo(() => procedures.filter((item) => item.risk === "protected").length, [procedures]);
  const voiceGate=Boolean(plan?.source==="voice"&&plan.requiresConfirmation&&voiceAuthorizationRequired&&!voiceAuthorizationSatisfied);
  const examples = [
    "Open Media then set volume to 40",
    "Enable Do Not Disturb",
    procedures[0] ? `Run ${procedures[0].name}` : "Check for updates",
    "Computer, pause the music",
    "Computer, red alert",
  ];
  const prepare = (value = query) => {
    const next = resolve(value);
    setQuery(value);
    setPlan(next);
    setArea("command");
  };
  useEffect(() => {
    if (!initialCommand.trim() || appliedInitial.current === initialCommand) return;
    appliedInitial.current = initialCommand;
    const next = resolve(initialCommand);
    setQuery(initialCommand);
    setPlan(next);
    setArea("command");
  }, [initialCommand, resolve]);
  const run = async (dryRun: boolean) => {
    if (!plan?.valid || transmitting || running) return;
    setTransmitting(dryRun ? "dry-run" : "execute");
    try { await execute(plan, dryRun); }
    finally { setTransmitting(""); }
  };
  const riskLabel = (risk: ComputerRisk) => risk === "protected" ? "PROTECTED" : risk === "attention" ? "OPERATING" : "SAFE";
  return <div className="backdrop computer-core-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !running && close()}>
    <section className="computer-core-console" role="dialog" aria-modal="true" aria-label="LCARS Computer Core">
      <header className="computer-core-header">
        <div><small>LCARS 30.6 DEVELOPMENT · LOCAL-FIRST COMMAND PROCESSOR</small><h2>COMPUTER CORE</h2><p>Translate operator language into visible, permission-aware plans before anything changes.</p></div>
        <section><span className={bridge ? "online" : "standby"}><i/>LOCAL CORE {bridge ? "ONLINE" : "STANDBY"}</span><span>{activeTriggers} ACTIVE TRIGGERS</span><span>{protectedProcedures} GUARDED PROCEDURES</span><button onClick={close}>CLOSE ×</button></section>
      </header>
      <nav className="computer-core-tabs" aria-label="Computer Core areas">
        <button className={area === "command" ? "active" : ""} onClick={() => setArea("command")}><i>01</i>COMMAND</button>
        <button className={area === "procedures" ? "active" : ""} onClick={() => setArea("procedures")}><i>02</i>PROCEDURES <small>{procedures.length}</small></button>
        <button className={area === "audit" ? "active" : ""} onClick={() => setArea("audit")}><i>03</i>AUDIT <small>{audit.length}</small></button>
      </nav>
      {area === "command" && <main className="computer-command-area">
        <section className="computer-command-entry">
          <label htmlFor="computer-command-input">OPERATOR COMMAND</label>
          <div><input id="computer-command-input" autoFocus value={query} placeholder="COMPUTER, OPEN MEDIA THEN SET VOLUME TO 40…" onChange={(event) => { setQuery(event.target.value); setPlan(null); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); prepare(); } }}/><button disabled={!query.trim()} onClick={() => prepare()}>BUILD PLAN</button></div>
          <p>Commands are parsed locally. Enter builds a plan; it never skips the preview or confirmation gate.</p>
          <nav>{examples.map((example) => <button key={example} onClick={() => prepare(example)}>{example}</button>)}</nav>
        </section>
        {plan ? <section className={`computer-plan plan-${plan.risk} ${plan.valid ? "valid" : "invalid"}`}>
          <header><span><small>{plan.valid ? `${Math.round(plan.confidence * 100)}% INTERPRETATION CONFIDENCE` : "CLARIFICATION REQUIRED"}</small><h3>{plan.title}</h3><p>{plan.summary}</p></span><i>{plan.valid ? riskLabel(plan.risk) : "HOLD"}</i></header>
          {plan.valid ? <ol>{plan.steps.map((item, index) => <li key={item.id}><i>{String(index + 1).padStart(2, "0")}</i><span><b>{item.label}</b><small>{item.detail}</small></span><em className={`risk-${item.risk}`}>{riskLabel(item.risk)}{item.reversible ? " · UNDO" : ""}{item.requiresBridge ? " · LOCAL CORE" : ""}</em></li>)}</ol> : <div className="computer-plan-errors">{plan.errors.map((error) => <p key={error}>{error}</p>)}<small>Try one of the examples or use the exact visible application, workstation, procedure, theme, or page name.</small></div>}
          <footer>
            <span>{voiceGate ? "Protected voice plan held: repeat the command with “authorization” followed by the configured vocal code. Manual confirmation remains required." : plan.requiresConfirmation ? voiceAuthorizationSatisfied&&plan.source==="voice"?"Vocal authorization verified. The visible protected-action confirmation is still required.":"This plan contains protected operations. EXECUTE is the explicit operator confirmation." : plan.reversible ? "Every step in this plan can be reverted from the Audit panel." : "The plan is visible before execution; irreversible steps are clearly identified."}</span>
            <nav><button disabled={!plan.valid || Boolean(transmitting) || running} onClick={() => void run(true)}>{transmitting === "dry-run" ? "SIMULATING…" : "DRY RUN"}</button><button className={plan.requiresConfirmation ? "protected" : "execute"} disabled={!plan.valid || Boolean(transmitting) || running || voiceGate} onClick={() => void run(false)}>{voiceGate?"VOCAL CODE REQUIRED":transmitting === "execute" || running ? "EXECUTING…" : plan.requiresConfirmation ? "CONFIRM & EXECUTE" : "EXECUTE PLAN"}</button></nav>
          </footer>
        </section> : <section className="computer-core-idle"><i>30</i><span><b>COMMAND PROCESSOR READY</b><p>Use plain operator language or chain actions with “then.” The Computer Core resolves pages, applications, procedures, Workstations, media, Display Matrix themes, system controls, and guarded local commands.</p></span></section>}
      </main>}
      {area === "procedures" && <main className="computer-procedure-matrix">
        <header><span><small>VERSIONED MULTI-STEP OPERATIONS</small><h3>PROCEDURE LIBRARY</h3><p>Procedures retain conditions, timing, retries, failure paths, triggers, and protected-action gates.</p></span><button onClick={openBuilder}>OPEN PROCEDURE BUILDER</button></header>
        <div>{procedures.map((procedure, index) => <article className={!procedure.enabled ? "disabled" : ""} key={procedure.id}><i>{String(index + 1).padStart(2, "0")}</i><span><small>{procedure.trigger.toUpperCase()} TRIGGER · {procedure.stepCount} STEPS</small><b>{procedure.name}</b><p>{procedure.description || "Operator-defined Computer Core procedure"}</p></span><em className={`risk-${procedure.risk}`}>{riskLabel(procedure.risk)}{procedure.reversible ? " · UNDO" : ""}</em><button disabled={!procedure.enabled} onClick={() => prepare(`Run ${procedure.name}`)}>BUILD RUN PLAN</button></article>)}{!procedures.length && <p className="computer-empty">NO PROCEDURES CONFIGURED · OPEN THE BUILDER TO CREATE THE FIRST OPERATIONS SEQUENCE</p>}</div>
      </main>}
      {area === "audit" && <main className="computer-audit-matrix">
        <header><span><small>LOCAL EXECUTION JOURNAL · MAXIMUM 300 RECORDS</small><h3>COMPUTER AUDIT</h3><p>Dry runs, trigger requests, protected commands, failures, successful plans, and undo operations remain attributable.</p></span><nav><button disabled={!undoSnapshot || running} onClick={undo}>{undoSnapshot ? `UNDO · ${undoSnapshot.label}` : "NO UNDO AVAILABLE"}</button><button disabled={!audit.length} onClick={clearAudit}>CLEAR AUDIT</button></nav></header>
        <div>{audit.map((entry, index) => <article className={`audit-${entry.status}`} key={entry.id}><i>{String(index + 1).padStart(3, "0")}</i><span><small>{new Date(entry.time).toLocaleString()} · {entry.source.toUpperCase()}</small><b>{entry.title}</b><p>{entry.detail}</p></span><em className={`risk-${entry.risk}`}>{entry.status.toUpperCase()} · {riskLabel(entry.risk)}{entry.reversible ? " · UNDO" : ""}</em></article>)}{!audit.length && <p className="computer-empty">NO COMPUTER CORE OPERATIONS RECORDED</p>}</div>
      </main>}
      <footer className="computer-core-footer"><span>LOCAL-FIRST · EXPLICIT AUTHORITY · DRY-RUN CAPABLE · AUDITABLE</span><small>30.6 DATA FABRIC</small></footer>
    </section>
  </div>;
}
