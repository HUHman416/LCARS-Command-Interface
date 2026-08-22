import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const extensions = readFileSync('shared/lcars_extensions.py','utf8');
const page = readFileSync('app/page.tsx','utf8');

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

test('existing Extension Hub consumes remote catalog and supports installation',()=>{
  assert.match(page,/\/api\/extension-catalog/);
  assert.match(page,/\/api\/extension-install/);
  assert.match(page,/SEARCH EXTENSIONS/);
  assert.match(page,/COLLAPSE HUB|OPEN HUB/);
});
