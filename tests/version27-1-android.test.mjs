import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const workflow = read(".github/workflows/v27-2-development.yml");
const manifest = read("mobile/android/app/src/main/AndroidManifest.xml");
const activity = read("mobile/android/app/src/main/java/com/lcars/padd/MainActivity.java");
const guard = read("mobile/android/app/src/main/java/com/lcars/padd/StationAddress.java");
const security = read("mobile/android/app/src/main/res/xml/network_security_config.xml");

test("Version 27.2.1 publishes a directly installable Android companion", () => {
  assert.match(workflow, /android:[\s\S]*gradle-version: 8\.9/);
  assert.match(workflow, /:app:assembleDebug/);
  assert.match(workflow, /LCARS-PADD-Companion-v27\.2\.1-Android\.apk/);
  assert.match(workflow, /needs: \[linux, windows, android\]/);
  assert.match(workflow, /sha256sum[^\n]*LCARS-PADD-Companion-v27\.2\.1-Android\.apk/);
});

test("Android companion declares guarded networking and only its launcher/widget surfaces", () => {
  assert.match(manifest, /android\.permission\.INTERNET/);
  assert.match(manifest, /android\.permission\.ACCESS_NETWORK_STATE/);
  assert.match(manifest, /android\.permission\.ACCESS_LOCAL_NETWORK/);
  assert.match(manifest, /android:networkSecurityConfig="@xml\/network_security_config"/);
  assert.match(manifest, /android:exported="true"[\s\S]*android\.intent\.category\.LAUNCHER/);
  assert.doesNotMatch(manifest, /<service|<provider/);
  assert.match(manifest, /<receiver[\s\S]*PaddWidgetProvider[\s\S]*APPWIDGET_UPDATE/);
  assert.match(security, /cleartextTrafficPermitted="true"/);
});

test("Android companion owns its native UI and is pinned to the paired private station", () => {
  for (const source of ["10", "172", "192", "PADD_PORT = 8766"]) assert.match(guard, new RegExp(source));
  assert.match(guard, /isAllowedUrl/);
  assert.match(activity, /HttpURLConnection/);
  assert.match(activity, /api\/padd\/(?:pair|state|action)/);
  assert.match(activity, /STANDALONE PADD/);
  assert.match(activity, /STATUS.*MEDIA.*COMMAND/s);
  assert.doesNotMatch(activity, /WebView|addJavascriptInterface/);
  assert.match(activity, /LAST_STATION/);
});
