import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const serverSource = fs.readFileSync(
  new URL("../server.js", import.meta.url),
  "utf8"
);

test(
  "el servidor permite aislar la base de datos sin cambiar la ruta por defecto",
  () => {
    const start = serverSource.indexOf(
      "const DB_PATH"
    );

    assert.notEqual(
      start,
      -1,
      "debe existir DB_PATH"
    );

    const block = serverSource.slice(
      start,
      start + 320
    );

    assert.match(
      block,
      /process\.env\.QUACKER_DB_PATH/,
      "DB_PATH debe permitir una ruta temporal por entorno"
    );

    assert.match(
      block,
      /NODE_ENV\s*===\s*["']test["']/,
      "el override de DB debe limitarse al entorno de test"
    );

    assert.match(
      block,
      /path\.join\(__dirname,\s*"db\.json"\)/,
      "debe conservar db.json como ruta por defecto"
    );
  }
);

test(
  "el servidor permite aislar las sesiones sin cambiar la ruta por defecto",
  () => {
    const start = serverSource.indexOf(
      "const SESSION_STORE_PATH"
    );

    assert.notEqual(
      start,
      -1,
      "debe existir SESSION_STORE_PATH"
    );

    const block = serverSource.slice(
      start,
      start + 380
    );

    assert.match(
      block,
      /process\.env\.QUACKER_SESSION_STORE_PATH/,
      "las sesiones deben permitir una ruta temporal por entorno"
    );

    assert.match(
      block,
      /NODE_ENV\s*===\s*["']test["']/,
      "el override de sesiones debe limitarse al entorno de test"
    );

    assert.match(
      block,
      /path\.resolve\(__dirname,\s*"\.sessions"\)/,
      "debe conservar .sessions como ruta por defecto"
    );
  }
);
