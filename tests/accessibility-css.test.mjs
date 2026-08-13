import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("accessibility modes do not apply global descendant layout overrides", () => {
  assert.doesNotMatch(css, /\.reduced-motion\s+\*/);
  assert.doesNotMatch(css, /\.color-safe[^{}]*\{[^}]*content\s*:/s);
  assert.doesNotMatch(css, /\.accessibility-contrast\s*\{[^}]*filter\s*:/s);
  assert.doesNotMatch(css, /\.lcars\s*\{[^}]*transition:\s*0\.25s\s*;/s);
  assert.match(css, /\.lcars\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*0;/s);
});

test("shared settings toggle keeps its native checkbox in a stable one-pixel box", () => {
  assert.match(css, /\.lcars-toggle\s*\{[^}]*position:\s*relative;/s);
  assert.match(css, /\.lcars-toggle input\s*\{[^}]*position:\s*absolute;[^}]*width:\s*1px;[^}]*height:\s*1px;/s);
});

test("pinned task rail is an isolated scrolling overlay", () => {
  assert.match(css, /\.task-zone \.task-rail\s*\{[^}]*position:\s*absolute;[^}]*overflow-y:\s*auto;/s);
  assert.match(css, /\.task-zone\.rail-open\s*\{[^}]*overflow:\s*hidden\s*!important;/s);
});
