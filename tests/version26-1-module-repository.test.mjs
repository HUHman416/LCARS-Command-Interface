import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const extensions = readFileSync('shared/lcars_extensions.py','utf8');
const page = readFileSync('app/page.tsx','utf8');
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
  assert.match(page,/DECLARATIVE MODULE API · TRUSTED MODULES BRANCH/);
  assert.match(page,/BROWSE MODULES/);
  assert.match(page,/SEARCH MODULE REPOSITORY/);
  assert.match(page,/operate\(entry,"update"\)/);
  assert.equal((page.match(/<ExtensionHub installed=\{extensions\}/g)||[]).length,1);
});

test('26.1 development builds identify themselves correctly',()=>{
  assert.equal(packageJson.version,'26.1.0-dev.1');
  assert.match(page,/V26\.1 DEV/);
});
