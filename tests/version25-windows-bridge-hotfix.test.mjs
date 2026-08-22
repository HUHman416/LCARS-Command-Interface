import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const main=readFileSync(new URL("../desktop/main.cjs",import.meta.url),"utf8");

test("Windows bridge launcher tolerates missing py launcher and probes Python alternatives",()=>{
  assert.match(main,/spawnSync/);
  assert.match(main,/windowsPythonCandidates/);
  assert.match(main,/\["py",\["-3"\]\]/);
  assert.match(main,/\["python",\[\]\]/);
  assert.match(main,/\["python3",\[\]\]/);
  assert.match(main,/LOCALAPPDATA/);
  assert.match(main,/python\.exe/);
  assert.match(main,/bridgeProcess\.on\("error"/);
  assert.match(main,/no usable Python runtime was found/);
  assert.doesNotMatch(main,/if\(process\.platform==="win32"\)\{python="py";args=\["-3"\]\}/);
});
