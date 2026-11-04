import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const serverSource = fs.readFileSync(
  new URL("../server.js", import.meta.url),
  "utf8"
);

test("server.js importa el modelo canónico de followRequests", () => {
  assert.match(
    serverSource,
    /from\s+["']\.\/lib\/follow-requests\.js["']/
  );

  assert.match(
    serverSource,
    /\bnormalizeFollowRequests\b/
  );
});

test("_getUserBucket prepara followRequests para usuarios nuevos y legacy", () => {
  const start = serverSource.indexOf(
    "function _getUserBucket(db, userId)"
  );

  assert.notEqual(
    start,
    -1,
    "no se encontró _getUserBucket"
  );

  const end = serverSource.indexOf(
    "// ===== API BASE =====",
    start
  );

  assert.notEqual(end, -1);

  const block = serverSource.slice(
    start,
    end
  );

  assert.match(
    block,
    /followRequests:\s*normalizeFollowRequests\(\)/
  );

  assert.match(
    block,
    /db\.users\[userId\]\.followRequests\s*=\s*normalizeFollowRequests\(/
  );

  assert.match(
    block,
    /ownerUserId:\s*userId/
  );
});

test("las cuentas nuevas empiezan con followRequests vacío", () => {
  const registerStart = serverSource.indexOf(
    'function _createRegisteredUser(db, {'
  );

  assert.notEqual(
    registerStart,
    -1,
    "no se encontró la función _createRegisteredUser"
  );

  const registerEnd = serverSource.indexOf(
    "\napp.",
    registerStart + 20
  );

  const registerBlock = serverSource.slice(
    registerStart,
    registerEnd === -1
      ? undefined
      : registerEnd
  );

  const confirmStart = serverSource.indexOf(
    '"/api/auth/email-verification/confirm"'
  );

  assert.notEqual(confirmStart, -1);

  const confirmEnd = serverSource.indexOf(
    "\napp.",
    confirmStart + 20
  );

  assert.notEqual(confirmEnd, -1);

  const confirmBlock = serverSource.slice(
    confirmStart,
    confirmEnd
  );

  assert.match(
    confirmBlock,
    /commitVerifiedRegistration\(\{/
  );

  assert.match(
    confirmBlock,
    /createUser:\s*\(db,\s*registration\)\s*=>\s*_createRegisteredUser\(db,\s*registration\)/
  );

  assert.match(
    registerBlock,
    /followRequests:\s*normalizeFollowRequests\(\)/
  );
});
