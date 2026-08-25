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
  assert.match(page,/DECLARATIVE MODULE API · OFFICIAL \+ COMMUNITY GITHUB SOURCES/);
  assert.match(page,/BROWSE MODULES/);
  assert.match(page,/SEARCH MODULE REPOSITORY/);
  assert.match(page,/operate\(entry,"update"\)/);
  assert.equal((page.match(/<ExtensionHub installed=\{extensions\}/g)||[]).length,1);
});

test('desktop renderer loads Version 26.1 styling after Version 25',()=>{
  const v25 = renderer.indexOf('import "../app/v25.css"');
  const v261 = renderer.indexOf('import "../app/v26-1.css"');
  assert.notEqual(v25,-1);
  assert.ok(v261 > v25);
});

test('26.2 development builds identify themselves correctly while retaining 26.1 repository coverage',()=>{
  assert.equal(packageJson.version,'26.2.0-dev.1');
  assert.match(page,/26\.2 DEV/);
});
