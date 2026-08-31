import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const extensions = readFileSync('shared/lcars_extensions.py','utf8');
const page = readFileSync('app/page.tsx','utf8');
const renderer = readFileSync('desktop/renderer.tsx','utf8');
const packageJson = JSON.parse(readFileSync('package.json','utf8'));

test('26.1 trusts only the dedicated Modules branch',()=>{
  assert.match(extensions,/REMOTE_CATALOG_URL=.*LCARS-Command-Interface\/Modules\/catalog\.json/);
  assert.match(extensions,/TRUSTED_RAW_PREFIX=.*LCARS-Command-Interface\/Modules\//);
  assert.match(extensions,/module download URL is outside the trusted Modules branch/);
});

test('26.1 verifies catalog module payloads before installation',()=>{
  assert.match(extensions,/hashlib\.sha256\(payload\)\.hexdigest\(\)/);
  assert.match(extensions,/module checksum verification failed/);
  assert.match(extensions,/downloaded module id does not match catalog entry/);
  assert.match(extensions,/downloaded module version does not match catalog entry/);
});

test('integrated Module Repository is the Updates slot 03 browser',()=>{
  assert.match(page,/STABLE MODULE API V3 · SIGNED PACKAGES · ISOLATED HOST RENDERER/);
  assert.match(page,/OPEN PLATFORM/);
  assert.match(page,/SEARCH MODULE PLATFORM/);
  assert.match(page,/operate\(entry,"update"\)/);
  assert.equal((page.match(/<ExtensionHub openByDefault installed=\{extensions\}/g)||[]).length,1);
});

test('desktop renderer loads Version 26.1 styling after Version 25',()=>{
  const v25 = renderer.indexOf('import "../app/v25.css"');
  const v261 = renderer.indexOf('import "../app/v26-1.css"');
  assert.notEqual(v25,-1);
  assert.ok(v261 > v25);
});

test('newer candidates retain Version 26.1 repository coverage',()=>{
  assert.ok(['30.8.0-dev.1','30.7.0-dev.1','30.6.0-dev.1','30.4.0-dev.1','30.3.0-dev.1','30.2.0-dev.1','30.1.0-dev.2','29.0.0','29.3.0-rc.1','29.2.0-dev.1','28.0.0','28.3.0-rc.1','28.2.0-dev.1','27.2.1-dev.1','27.2.0-dev.1','27.1.1-dev.1','26.3.0-dev.1','26.0.0'].includes(packageJson.version));
  assert.match(page,/30\.8 DEV|30\.7 DEV|30\.6 DEV|30\.4 DEV|30\.3 DEV|30\.2 DEV|30\.1 DEV|29 STABLE|29\.3 RC 1|29\.2 DEVELOPMENT|28 STABLE|28\.3 RC 1|28\.2 DEV|27\.2(?:\.1)? DEV|27\.1(?:\.1)? DEV|26\.3 RC|26 STABLE/);
});
