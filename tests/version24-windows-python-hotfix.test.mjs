import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const main=readFileSync(new URL("../desktop/main.cjs",import.meta.url),"utf8");
const windows=readFileSync(new URL("../windows/lcars_bridge_windows.py",import.meta.url),"utf8");

test("Windows bridge startup probes multiple Python runtimes and handles spawn errors",()=>{
  assert.match(main,/function windowsPython\(/);
  assert.match(main,/\["py",\["-3"\]\]/);
  assert.match(main,/\["python",\[\]\]/);
  assert.match(main,/\["python3",\[\]\]/);
  assert.match(main,/Programs","Python"/);
  assert.match(main,/spawnSync\(/);
  assert.match(main,/bridgeProcess\.on\("error"/);
  assert.doesNotMatch(main,/function startBridge\(\)\{let python="python3",args=\[\];if\(process\.platform==="win32"\)\{python="py";args=\["-3"\]\}/);
});

test("v24 Windows bridge retains native telemetry fallbacks",()=>{
  assert.match(windows,/def windows_system_fallback\(\):/);
  assert.match(windows,/Get-CimInstance Win32_Processor/);
  assert.match(windows,/Get-CimInstance Win32_OperatingSystem/);
  assert.match(windows,/GPU Engine/);
  assert.match(windows,/gpuUsage/);
});
