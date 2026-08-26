import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const workflow = read(".github/workflows/v27-1-development.yml");
const manifest = read("mobile/android/app/src/main/AndroidManifest.xml");
const activity = read("mobile/android/app/src/main/java/com/lcars/padd/MainActivity.java");
const guard = read("mobile/android/app/src/main/java/com/lcars/padd/StationAddress.java");
const security = read("mobile/android/app/src/main/res/xml/network_security_config.xml");

test("Version 27.1.1 publishes a directly installable Android companion", () => {
  assert.match(workflow, /android:[\s\S]*gradle-version: 8\.9/);
  assert.match(workflow, /:app:assembleDebug/);
  assert.match(workflow, /LCARS-PADD-Companion-v27\.1\.1-Android\.apk/);
  assert.match(workflow, /needs: \[linux, windows, android\]/);
  assert.match(workflow, /sha256sum[^\n]*LCARS-PADD-Companion-v27\.1\.1-Android\.apk/);
});

test("Android companion declares only networking and a non-exported surface beyond its launcher", () => {
  assert.match(manifest, /android\.permission\.INTERNET/);
  assert.match(manifest, /android\.permission\.ACCESS_NETWORK_STATE/);
  assert.match(manifest, /android\.permission\.ACCESS_LOCAL_NETWORK/);
  assert.match(manifest, /android:networkSecurityConfig="@xml\/network_security_config"/);
  assert.match(manifest, /android:exported="true"[\s\S]*android\.intent\.category\.LAUNCHER/);
  assert.doesNotMatch(manifest, /service|receiver|provider/);
  assert.match(security, /cleartextTrafficPermitted="true"/);
});

test("Android WebView is pinned to the paired private station", () => {
  for (const source of ["10", "172", "192", "PADD_PORT = 8766"]) assert.match(guard, new RegExp(source));
  assert.match(guard, /isAllowedUrl/);
  assert.match(activity, /setAllowFileAccess\(false\)/);
  assert.match(activity, /setAllowContentAccess\(false\)/);
  assert.match(activity, /MIXED_CONTENT_NEVER_ALLOW/);
  assert.match(activity, /External navigation blocked by LCARS/);
  assert.doesNotMatch(activity, /addJavascriptInterface/);
  assert.match(activity, /LAST_STATION/);
});
