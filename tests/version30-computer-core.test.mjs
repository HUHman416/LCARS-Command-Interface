import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  computerProcedureReversible,
  computerProcedureRisk,
  interpretComputerCommand,
  normalizeComputerAudit,
  normalizeComputerUndo,
} from "../app/v30-core.ts";
import { normalizeRoutines } from "../app/v25-core.ts";

const context = {
  pages: [{ id: "overview", name: "Status", aliases: ["overview"] }, { id: "media", name: "Media" }],
  apps: [{ id: "spotify.desktop", name: "Spotify" }],
  procedures: [{ id: "evening", name: "Evening Operations" }],
  workstations: [{ id: "command", name: "Command Deck" }],
  themes: [{ id: "voyager", name: "Voyager" }],
};

test("Computer Core creates ordered, reversible plans locally", () => {
  const plan = interpretComputerCommand("Computer, open Media then set volume to 40", context);
  assert.equal(plan.valid, true);
  assert.deepEqual(plan.steps.map((step) => step.command), ["navigate", "set-volume"]);
  assert.equal(plan.steps[1].value, 40);
  assert.equal(plan.reversible, true);
  assert.equal(plan.risk, "safe");
});

test("protected and unresolved commands cannot bypass the preview model", () => {
  const protectedPlan = interpretComputerCommand("sudo reboot computer", context, "voice");
  assert.equal(protectedPlan.valid, true);
  assert.equal(protectedPlan.source, "voice");
  assert.equal(protectedPlan.risk, "protected");
  assert.equal(protectedPlan.requiresConfirmation, true);
  assert.equal(protectedPlan.steps[0].target, "reboot");
  assert.equal(interpretComputerCommand("replicate coffee", context).valid, false);
});

test("dynamic procedures, workstations, applications, and themes resolve by visible name", () => {
  assert.equal(interpretComputerCommand("run Evening Operations", context).steps[0].target, "evening");
  assert.equal(interpretComputerCommand("restore Command Deck", context).steps[0].target, "command");
  assert.equal(interpretComputerCommand("launch Spotify", context).steps[0].target, "spotify.desktop");
  assert.equal(interpretComputerCommand("set theme to Voyager", context).steps[0].target, "voyager");
});

test("procedure policy identifies protected and fully reversible sequences", () => {
  assert.equal(computerProcedureRisk({ steps: [{ kind: "page" }, { kind: "system" }] }), "protected");
  assert.equal(computerProcedureReversible({ steps: [{ kind: "page" }, { kind: "volume" }, { kind: "theme" }] }), true);
  assert.equal(computerProcedureReversible({ steps: [{ kind: "app" }] }), false);
});

test("Version 30 procedure normalization accepts expanded triggers and safety limits", () => {
  const [procedure] = normalizeRoutines([{
    id: "battery-watch", name: "Battery Watch", description: "", color: "blue", enabled: true,
    trigger: { type: "battery-below", value: "20" }, cooldownSeconds: 900, maxRuntimeSeconds: 45,
    dryRunByDefault: true, steps: [{ id: "step-1", kind: "dnd", target: "true" }],
  }]);
  assert.equal(procedure.trigger.type, "battery-below");
  assert.equal(procedure.cooldownSeconds, 900);
  assert.equal(procedure.maxRuntimeSeconds, 45);
  assert.equal(procedure.dryRunByDefault, true);
});

test("audit and undo storage reject malformed records", () => {
  assert.equal(normalizeComputerAudit([{}, { title: "Valid", status: "dry-run", risk: "safe" }]).length, 1);
  assert.equal(normalizeComputerUndo({}), null);
  assert.equal(normalizeComputerUndo({ id: "undo", planId: "plan", volume: 500 })?.volume, 100);
});

test("desktop voice package remains pinned and verified for 30.3 hands-free capture", async () => {
  const [script, linuxBridge, windowsBridge, page, builder, workflow] = await Promise.all([
    readFile(new URL("../scripts/prepare-voice-runtime.sh", import.meta.url), "utf8"),
    readFile(new URL("../local/lcars_bridge.py", import.meta.url), "utf8"),
    readFile(new URL("../windows/lcars_bridge_windows.py", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../electron-builder.yml", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/v30-development.yml", import.meta.url), "utf8"),
  ]);
  assert.match(script, /release="b4938"/);
  assert.match(script, /sha256sum --check/);
  assert.match(script, /model_sha1="3fb92ec865cbbc769f08137f22470d6b66e071b6"/);
  assert.match(linuxBridge, /raw\[:4\]==b"RIFF"/);
  assert.match(windowsBridge, /raw\[:4\]==b"RIFF"/);
  assert.match(page, /pcmWavBlob/);
  assert.match(page, /resampleVoicePcm/);
  assert.match(page, /targetRate=16000/);
  assert.match(page, /api\/voice-status/);
  assert.match(page, /voiceAuthorizationCredential/);
  assert.match(builder, /voice-runtime\/linux/);
  assert.match(builder, /voice-runtime\/windows/);
  assert.match(workflow, /gh release (?:view|create) v30\.5/);
});
