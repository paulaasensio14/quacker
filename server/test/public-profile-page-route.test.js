import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const serverSource = fs.readFileSync(
  new URL("../server.js", import.meta.url),
  "utf8"
);

test("server.js define un HTML específico para el perfil público", () => {
  assert.match(
    serverSource,
    /const PUBLIC_PROFILE_HTML_PATH\s*=/
  );

  assert.match(
    serverSource,
    /path\.join\(PROJECT_ROOT,\s*["']public-profile\.html["']\)/
  );
});

test("GET /u/:username comprueba privacidad antes de servir el perfil", () => {
  const signature =
    'app.get("/u/:username"';

  const start = serverSource.indexOf(signature);

  assert.notEqual(
    start,
    -1,
    "debe existir GET /u/:username"
  );

  const end = serverSource.indexOf(
    "\napp.",
    start + signature.length
  );

  const block = serverSource.slice(
    start,
    end === -1 ? undefined : end
  );

  assert.match(
    block,
    /_readDb\(\)/
  );

  assert.match(
    block,
    /getPublicProfileByUsername/
  );

  assert.match(
    block,
    /req\.params\.username/
  );

  assert.match(
    block,
    /\.status\(404\)/
  );

  assert.match(
    block,
    /NOT_FOUND_HTML_PATH/
  );

  assert.match(
    block,
    /PUBLIC_PROFILE_HTML_PATH/
  );
});

test("la ruta /u/:username se registra antes del 404 público general", () => {
  const profileRouteIndex = serverSource.indexOf(
    'app.get("/u/:username"'
  );

  const publicNotFoundIndex = serverSource.indexOf(
    "createPublicNotFoundHandler("
  );

  assert.notEqual(profileRouteIndex, -1);
  assert.notEqual(publicNotFoundIndex, -1);

  assert.ok(
    profileRouteIndex < publicNotFoundIndex,
    "el perfil público debe resolverse antes del 404 general"
  );
});

test("la página pública del perfil no se almacena en caché", () => {
  const signature =
    'app.get("/u/:username"';

  const start = serverSource.indexOf(signature);

  assert.notEqual(start, -1);

  const end = serverSource.indexOf(
    "\napp.",
    start + signature.length
  );

  const block = serverSource.slice(
    start,
    end === -1 ? undefined : end
  );

  assert.match(
    block,
    /res\.set\(\s*["']Cache-Control["']\s*,\s*["']no-store["']\s*\)/
  );
});
