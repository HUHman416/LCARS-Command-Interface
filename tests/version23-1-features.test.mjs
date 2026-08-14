import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const linux = fs.readFileSync(new URL("../local/lcars_bridge.py", import.meta.url), "utf8");
const windows = fs.readFileSync(new URL("../windows/lcars_bridge_windows.py", import.meta.url), "utf8");

test("23.1 includes nonblocking startup, tray drawer, and density controls", () => {
  assert.match(page, /StartupTelemetry/);
  assert.match(css, /pointer-events:none;position:fixed/);
  assert.match(page, /tray-strip-trigger/);
  assert.match(page, /interfaceDensity/);
});

test("23.1 includes network telemetry and safe file preview endpoints", () => {
  for (const bridge of [linux, windows]) {
    assert.match(bridge, /network-details/);
    assert.match(bridge, /file-preview/);
  }
});

test("voice acknowledgement and optional component bay are present", () => {
  assert.match(page, /voice-affirmative\.mp3/);
  assert.match(page, /OPTIONAL COMPONENTS/);
  assert.match(css, /\.apps button > i \{[\s\S]*overflow: hidden !important/);
});
