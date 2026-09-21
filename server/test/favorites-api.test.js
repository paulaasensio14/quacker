import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const serverSource = fs.readFileSync(
  new URL("../server.js", import.meta.url),
  "utf8"
);

function routeBlock(signature) {
  const start = serverSource.indexOf(signature);

  assert.notEqual(
    start,
    -1,
    `debe existir ${signature}`
  );

  const end = serverSource.indexOf(
    "\napp.",
    start + signature.length
  );

  return serverSource.slice(
    start,
    end === -1 ? undefined : end
  );
}

test("server.js importa el modelo canónico de favoritos", () => {
  assert.match(
    serverSource,
    /from\s+["']\.\/lib\/favorites\.js["']/
  );

  for (const helper of [
    "normalizeFavorites",
    "addFavorite",
    "replaceFavorite",
    "removeFavorite"
  ]) {
    assert.match(
      serverSource,
      new RegExp(`\\b${helper}\\b`),
      `server.js debe usar ${helper}`
    );
  }
});

test("usuarios nuevos y antiguos reciben el bucket canónico de favoritos", () => {
  const bucketStart = serverSource.indexOf(
    "function _getUserBucket"
  );
  assert.notEqual(bucketStart, -1);

  const bucketEnd = serverSource.indexOf(
    "// ===== API BASE =====",
    bucketStart
  );
  assert.notEqual(bucketEnd, -1);

  const bucketBlock = serverSource.slice(
    bucketStart,
    bucketEnd
  );

  assert.match(
    bucketBlock,
    /favorites:\s*normalizeFavorites\(\)/
  );

  assert.match(
    bucketBlock,
    /db\.users\[userId\]\.favorites\s*=\s*normalizeFavorites\(/
  );

  const registrationStart = serverSource.indexOf(
    "const userId = _uid()"
  );
  assert.notEqual(registrationStart, -1);

  const registrationEnd = serverSource.indexOf(
    "try {",
    registrationStart
  );
  assert.notEqual(registrationEnd, -1);

  const registrationBlock = serverSource.slice(
    registrationStart,
    registrationEnd
  );

  assert.match(
    registrationBlock,
    /favorites:\s*normalizeFavorites\(\)/
  );
});

test("GET /api/user/favorites requiere autenticación y devuelve solo favoritos", () => {
  const block = routeBlock(
    'app.get("/api/user/favorites"'
  );

  assert.match(block, /_requireAuth/);
  assert.match(block, /bucket\.favorites/);

  assert.doesNotMatch(
    block,
    /bucket\.profile/
  );

  assert.doesNotMatch(
    block,
    /bucket\.privacy/
  );
});

test("POST /api/user/favorites/:contentType añade con fecha generada por servidor", () => {
  const block = routeBlock(
    'app.post("/api/user/favorites/:contentType"'
  );

  assert.match(block, /_requireAuth/);
  assert.match(block, /addFavorite/);
  assert.match(block, /new Date\(\)\.toISOString\(\)/);
  assert.match(block, /req\.params\.contentType/);
  assert.match(block, /req\.body/);
  assert.match(block, /bucket\.favorites/);
  assert.match(block, /_writeDb\(db\)/);
  assert.match(block, /\.status\(201\)/);

  assert.match(block, /favorite_already_exists/);
  assert.match(block, /favorites_limit_reached/);
});

test("PATCH /api/user/favorites/:contentType/:position sustituye la posición indicada", () => {
  const block = routeBlock(
    'app.patch("/api/user/favorites/:contentType/:position"'
  );

  assert.match(block, /_requireAuth/);
  assert.match(block, /replaceFavorite/);
  assert.match(block, /req\.params\.contentType/);
  assert.match(block, /req\.params\.position/);
  assert.match(block, /new Date\(\)\.toISOString\(\)/);
  assert.match(block, /bucket\.favorites/);
  assert.match(block, /_writeDb\(db\)/);

  assert.match(block, /favorite_not_found/);
  assert.match(block, /favorite_already_exists/);
});

test("DELETE /api/user/favorites/:contentType/:position elimina y persiste", () => {
  const block = routeBlock(
    'app.delete("/api/user/favorites/:contentType/:position"'
  );

  assert.match(block, /_requireAuth/);
  assert.match(block, /removeFavorite/);
  assert.match(block, /req\.params\.contentType/);
  assert.match(block, /req\.params\.position/);
  assert.match(block, /bucket\.favorites/);
  assert.match(block, /_writeDb\(db\)/);

  assert.match(block, /favorite_not_found/);
  assert.match(block, /invalid_favorite_position/);
});
