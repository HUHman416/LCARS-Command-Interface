import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Version 30.3 package and release channel are aligned", async () => {
  const [pkg, workflow, page, android] = await Promise.all([
    source("../package.json"),
    source("../.github/workflows/v30-development.yml"),
    source("../app/page.tsx"),
    source("../mobile/android/app/build.gradle"),
  ]);
  assert.equal(JSON.parse(pkg).version, "30.3.0-dev.1");
  assert.match(workflow, /Version 30\.3 Module Platform Development/);
  assert.match(workflow, /gh release (?:view|create) v30\.3/);
  assert.match(page, /const LCARS_VERSION="30\.3"/);
  assert.match(android, /versionCode 303001/);
  assert.match(android, /versionName "30\.3\.0"/);
});

test("Federation server exposes discovery, durable identity, policy, and encrypted queues", async () => {
  const [server, crypto, builder] = await Promise.all([
    source("../shared/lcars_padd.py"),
    source("../shared/lcars_federation_crypto.py"),
    source("../electron-builder.yml"),
  ]);
  assert.match(server, /DISCOVERY_PORT = 8767/);
  assert.match(server, /LCARS_FEDERATION_DISCOVER_V1/);
  assert.match(server, /"station": \{"id": station_id/);
  assert.match(server, /"sync-policy"/);
  assert.match(server, /"queuedDeliveries"/);
  assert.match(server, /api\/padd\/signal-ack/);
  assert.match(server, /524_288/);
  assert.match(server, /secureTransport/);
  assert.match(crypto, /def encrypt\(/);
  assert.match(crypto, /def request_signature\(/);
  assert.match(builder, /shared\/lcars_federation_crypto\.py/);
});

test("native Android Federation link discovers, authenticates, and handles handoff", async () => {
  const [dock, crypto, discovery, store] = await Promise.all([
    source("../mobile/android/app/src/main/java/com/lcars/padd/CompanionDock.java"),
    source("../mobile/android/app/src/main/java/com/lcars/padd/FederationCrypto.java"),
    source("../mobile/android/app/src/main/java/com/lcars/padd/StationDiscovery.java"),
    source("../mobile/android/app/src/main/java/com/lcars/padd/SecureStationStore.java"),
  ]);
  assert.match(discovery, /LCARS_FEDERATION_DISCOVER_V1/);
  assert.match(dock, /AUTOMATIC FEDERATION DISCOVERY/);
  assert.match(dock, /FederationCrypto\.signature/);
  assert.match(dock, /signal-ack/);
  assert.match(dock, /MediaStore\.Downloads/);
  assert.match(crypto, /AES\/GCM\/NoPadding/);
  assert.match(crypto, /HmacSHA256/);
  assert.match(store, /deviceId/);
  assert.match(store, /fingerprint/);
});

test("hands-free voice retains PTT and makes the Computer wake word optional", async () => {
  const page = await source("../app/page.tsx");
  assert.match(page, /voicePushToTalk: true/);
  assert.match(page, /voiceWakePhrase:v\?old\.voiceWakePhrase:true/);
  assert.match(page, /Require 'Computer' wake word/);
  assert.match(page, /const handsFree=!prefs\.voicePushToTalk/);
  assert.match(page, /window\.setInterval\(\(\)=>\{if\(processing\.current/);
  assert.match(page, /\},4500\)/);
  assert.match(page, /COMPUTER ARMED/);
});

test("Version 30.3 voice execution is opt-in, authority-aware, and header-contained", async () => {
  const [page, styles] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/v30.css"),
  ]);
  assert.match(page, /voiceImmediateExecution: false/);
  assert.match(page, /Execute recognized voice commands immediately/);
  assert.match(page, /if\(!prefs\.voiceImmediateExecution\)\{previewVoiceComputer/);
  assert.match(page, /plan\.requiresConfirmation&&!\(prefs\.voiceAuthorizationEnabled&&authorized\)/);
  assert.match(page, /resolveComputerCommandFor\(command,"voice"\)/);
  assert.match(page, /commanding\?"COMPUTER PROCESSING"/);
  assert.doesNotMatch(page, /armed\?\(busy\?"COMPUTER PROCESSING"/);
  assert.match(page, /title-kicker/);
  assert.match(page, /<div className=\{\(listening[\s\S]+voice-control voice-control-header/);
  assert.doesNotMatch(page, /<aside className=\{\(listening[\s\S]+voice-control voice-control-header/);
  assert.match(styles, /\.voice-control\.voice-control-header\{position:static/);
  assert.match(styles, /\.voice-control\.voice-control-header\{[^}]*min-height:0/);
  assert.match(styles, /text-overflow:ellipsis;white-space:nowrap/);
});
