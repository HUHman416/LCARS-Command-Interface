import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [page,css,extensions,linuxBridge,windowsBridge,docs,workflow]=await Promise.all([
  readFile(new URL("../app/page.tsx",import.meta.url),"utf8"),
  readFile(new URL("../app/v30.css",import.meta.url),"utf8"),
  readFile(new URL("../shared/lcars_extensions.py",import.meta.url),"utf8"),
  readFile(new URL("../local/lcars_bridge.py",import.meta.url),"utf8"),
  readFile(new URL("../windows/lcars_bridge_windows.py",import.meta.url),"utf8"),
  readFile(new URL("../docs/MODULE-API-v3.md",import.meta.url),"utf8"),
  readFile(new URL("../.github/workflows/v30-development.yml",import.meta.url),"utf8"),
]);

test("30.3 exposes the stable host-rendered Extension API v3 contract",()=>{
  assert.match(extensions,/API_VERSION=3/);
  assert.match(extensions,/SUPPORTED_API_VERSIONS=\{2,3\}/);
  assert.match(extensions,/moduleApiStatus/);
  assert.match(docs,/API v3 is Stable/);
  assert.match(docs,/Repository packages cannot provide executable/);
});

test("signed packages, channels, import, export, and rollback are implemented on both desktop bridges",()=>{
  for(const token of ["_rsa_sign","_rsa_verify","catalog-development.json","module_package_operation","rollbackAvailable",".previous-lcars-module.json","module publisher identity changed"])assert.ok(extensions.includes(token),token);
  for(const bridge of [linuxBridge,windowsBridge])for(const route of ["/api/module-platform","/api/module-package","/api/module-forge"])assert.ok(bridge.includes(route),route);
});

test("Module Platform UI provides Forge, permission, health, signing, and lifecycle controls",()=>{
  for(const token of ["MODULE PLATFORM","MODULE FORGE","CAPABILITY PERMISSIONS","SIGNED MODULE PUBLISHER","VERIFY + IMPORT","ROLL BACK","STABLE CHANNEL","DEVELOPMENT CHANNEL"])assert.ok(page.includes(token),token);
  for(const token of ["module-forge","module-permission-matrix","module-health-isolated","module-package-bay"])assert.ok(css.includes(token),token);
});

test("30.6 release workflow retains the complete Module Platform milestone",()=>{
  assert.match(workflow,/Version 30\.6 Operations Center and Timeline Development/);
  assert.match(workflow,/Version 30\.3 Module Platform/);
});
