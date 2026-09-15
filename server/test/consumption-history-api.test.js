import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const serverSource = fs.readFileSync(
  new URL("../server.js", import.meta.url),
  "utf8"
);

test(
  "GET /api/consumption-history requiere autenticación y devuelve el historial",
  () => {
    const start = serverSource.indexOf(
      'app.get("/api/consumption-history"'
    );

    assert.notEqual(
      start,
      -1,
      "debe existir GET /api/consumption-history"
    );

    const end = serverSource.indexOf(
      'app.post("/api/consumption-history"',
      start
    );

    assert.notEqual(
      end,
      -1,
      "debe poder aislarse GET /api/consumption-history"
    );

    const block = serverSource.slice(start, end);

    assert.match(
      block,
      /_requireAuth/,
      "GET /api/consumption-history debe requerir autenticación"
    );

    assert.match(
      block,
      /bucket\.consumptionHistory/,
      "GET debe leer consumptionHistory del usuario autenticado"
    );

    assert.match(
      block,
      /occurredAt/,
      "GET debe ordenar o trabajar con occurredAt"
    );
  }
);

test(
  "POST /api/consumption-history deriva el tipo desde Library y valida el evento",
  () => {
    const start = serverSource.indexOf(
      'app.post("/api/consumption-history"'
    );

    assert.notEqual(
      start,
      -1,
      "debe existir POST /api/consumption-history"
    );

    const end = serverSource.indexOf(
      "\napp.",
      start + 20
    );

    assert.notEqual(
      end,
      -1,
      "debe poder aislarse POST /api/consumption-history"
    );

    const block = serverSource.slice(start, end);

    assert.match(
      block,
      /_requireAuth/,
      "POST debe requerir autenticación"
    );

    assert.match(
      block,
      /bucket\.library/,
      "POST debe comprobar el elemento dentro de Library"
    );

    assert.match(
      block,
      /contentType:\s*libraryItem\.type/,
      "el tipo de contenido debe derivarse del elemento de Library"
    );

    assert.match(
      block,
      /_normalizeConsumptionEvent/,
      "el evento debe pasar por el normalizador"
    );
  }
);

test(
  "POST /api/consumption-history persiste eventos repetidos sin convertirlos en un contador",
  () => {
    const start = serverSource.indexOf(
      'app.post("/api/consumption-history"'
    );

    assert.notEqual(
      start,
      -1,
      "debe existir POST /api/consumption-history"
    );

    const end = serverSource.indexOf(
      "\napp.",
      start + 20
    );

    const block = serverSource.slice(start, end);

    assert.match(
      block,
      /consumptionHistory\.unshift/,
      "cada consumo debe persistirse como un evento independiente"
    );

    assert.match(
      block,
      /_writeDb\(db\)/,
      "el nuevo evento debe persistirse en la base de datos"
    );

    assert.doesNotMatch(
      block,
      /totalViews|totalReads|totalReplays/,
      "los totales no deben guardarse como contadores independientes"
    );
  }
);
