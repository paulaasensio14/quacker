import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const serverSource = fs.readFileSync(
  new URL("../server.js", import.meta.url),
  "utf8"
);

test(
  "GET /api/user/privacy requiere autenticación y devuelve solo la privacidad del usuario",
  () => {
    const start = serverSource.indexOf(
      'app.get("/api/user/privacy"'
    );

    assert.notEqual(
      start,
      -1,
      "debe existir GET /api/user/privacy"
    );

    const end = serverSource.indexOf(
      "\napp.",
      start + 20
    );

    assert.notEqual(
      end,
      -1,
      "debe poder aislarse GET /api/user/privacy"
    );

    const block = serverSource.slice(start, end);

    assert.match(
      block,
      /_requireAuth/,
      "GET debe requerir autenticación"
    );

    assert.match(
      block,
      /bucket\.privacy/,
      "GET debe devolver la privacidad del usuario autenticado"
    );

    assert.doesNotMatch(
      block,
      /bucket\.profile/,
      "GET no debe exponer datos del perfil"
    );
  }
);

test(
  "PATCH /api/user/privacy requiere autenticación y solo permite claves de privacidad conocidas",
  () => {
    const start = serverSource.indexOf(
      'app.patch("/api/user/privacy"'
    );

    assert.notEqual(
      start,
      -1,
      "debe existir PATCH /api/user/privacy"
    );

    const end = serverSource.indexOf(
      "\napp.",
      start + 20
    );

    assert.notEqual(
      end,
      -1,
      "debe poder aislarse PATCH /api/user/privacy"
    );

    const block = serverSource.slice(start, end);

    assert.match(
      block,
      /_requireAuth/,
      "PATCH debe requerir autenticación"
    );

    for (const field of [
      "profile",
      "activity",
      "library",
      "lists",
      "reviews",
      "stats",
      "favorites"
    ]) {
      assert.match(
        block,
        new RegExp(`["']${field}["']`),
        `PATCH debe reconocer ${field}`
      );
    }

    assert.match(
      block,
      /invalid_privacy_field/,
      "PATCH debe rechazar claves desconocidas"
    );
  }
);

test(
  "PATCH /api/user/privacy exige booleanos y persiste el resultado normalizado",
  () => {
    const start = serverSource.indexOf(
      'app.patch("/api/user/privacy"'
    );

    assert.notEqual(start, -1);

    const end = serverSource.indexOf(
      "\napp.",
      start + 20
    );

    const block = serverSource.slice(start, end);

    assert.match(
      block,
      /invalid_privacy_value/,
      "PATCH debe rechazar valores que no sean booleanos"
    );

    assert.match(
      block,
      /normalizeProfilePrivacy/,
      "PATCH debe usar el normalizador canónico"
    );

    assert.match(
      block,
      /bucket\.privacy/,
      "PATCH debe actualizar la privacidad del usuario"
    );

    assert.match(
      block,
      /_writeDb\(db\)/,
      "PATCH debe persistir los cambios"
    );
  }
);
