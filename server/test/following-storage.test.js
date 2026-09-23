import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const serverSource = fs.readFileSync(
  new URL("../server.js", import.meta.url),
  "utf8"
);

test("server.js importa el modelo canónico de following", () => {
  assert.match(
    serverSource,
    /from\s+["']\.\/lib\/following\.js["']/
  );

  assert.match(
    serverSource,
    /\bnormalizeFollowing\b/
  );
});

test("_getUserBucket prepara following para usuarios nuevos y legacy", () => {
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
    /following:\s*normalizeFollowing\(\)/
  );

  assert.match(
    block,
    /db\.users\[userId\]\.following\s*=\s*normalizeFollowing\(/
  );

  assert.match(
    block,
    /ownerUserId:\s*userId/
  );
});

test("las cuentas nuevas empiezan con following vacío", () => {
  const registerStart = serverSource.indexOf(
    'app.post("/api/auth/register"'
  );

  assert.notEqual(
    registerStart,
    -1,
    "no se encontró POST /api/auth/register"
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

  assert.match(
    registerBlock,
    /following:\s*normalizeFollowing\(\)/
  );
});
