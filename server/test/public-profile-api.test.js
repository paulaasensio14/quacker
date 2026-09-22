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

test("server.js importa el modelo de perfil público", () => {
  assert.match(
    serverSource,
    /from\s+["']\.\/lib\/public-profile\.js["']/
  );

  assert.match(
    serverSource,
    /\bgetPublicProfileByUsername\b/
  );
});

test("GET /api/public/users/:username es público y usa el modelo seguro", () => {
  const block = routeBlock(
    'app.get("/api/public/users/:username"'
  );

  assert.doesNotMatch(
    block,
    /_requireAuth/,
    "el perfil público no debe exigir sesión"
  );

  assert.match(
    block,
    /req\.params\.username/
  );

  assert.match(
    block,
    /_readDb\(\)/
  );

  assert.match(
    block,
    /getPublicProfileByUsername/
  );
});

test("usuario inexistente y perfil privado reciben el mismo 404", () => {
  const block = routeBlock(
    'app.get("/api/public/users/:username"'
  );

  assert.match(
    block,
    /\.status\(404\)/
  );

  assert.match(
    block,
    /error:\s*["']not_found["']/
  );

  assert.doesNotMatch(
    block,
    /private_profile|user_not_found|profile_private/,
    "la respuesta no debe permitir distinguir perfil privado de usuario inexistente"
  );
});

test("la ruta devuelve directamente el contrato filtrado por el modelo público", () => {
  const block = routeBlock(
    'app.get("/api/public/users/:username"'
  );

  assert.match(
    block,
    /res\.json\(publicProfile\)/
  );

  assert.doesNotMatch(
    block,
    /bucket\.profile/
  );

  assert.doesNotMatch(
    block,
    /bucket\.privacy/
  );

  assert.doesNotMatch(
    block,
    /\.email\b/
  );
});

test("la API pública impide almacenar en caché el perfil", () => {
  const block = routeBlock(
    'app.get("/api/public/users/:username"'
  );

  assert.match(
    block,
    /res\.set\(\s*["']Cache-Control["']\s*,\s*["']no-store["']\s*\)/
  );
});
