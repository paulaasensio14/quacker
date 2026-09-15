import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const serverSource = fs.readFileSync(
  new URL("../server.js", import.meta.url),
  "utf8"
);

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);

  assert.notEqual(
    start,
    -1,
    `no se encontró function ${name}()`
  );

  let depth = 0;
  let bodyStarted = false;

  for (let i = start; i < source.length; i += 1) {
    if (source[i] === "{") {
      depth += 1;
      bodyStarted = true;
    } else if (source[i] === "}") {
      depth -= 1;

      if (bodyStarted && depth === 0) {
        return source.slice(start, i + 1);
      }
    }
  }

  throw new Error(`no se pudo aislar function ${name}()`);
}

test(
  "solo registra automáticamente un visionado al completar una película por primera vez",
  () => {
    const helperStart = serverSource.indexOf(
      "function _shouldRecordAutomaticMovieWatch"
    );

    const helperEnd = serverSource.indexOf(
      "function _normalizeConsumptionItemSnapshot",
      helperStart
    );

    assert.notEqual(helperStart, -1);
    assert.notEqual(helperEnd, -1);

    const fnSource = serverSource
      .slice(helperStart, helperEnd)
      .trim();

    const shouldRecordAutomaticMovieWatch = Function(
      `"use strict"; return (${fnSource});`
    )();

    assert.equal(
      shouldRecordAutomaticMovieWatch({
        contentType: "pelicula",
        prevCompleted: false,
        nextCompleted: true,
        shouldLogActivity: true
      }),
      true
    );

    assert.equal(
      shouldRecordAutomaticMovieWatch({
        contentType: "pelicula",
        prevCompleted: true,
        nextCompleted: true,
        shouldLogActivity: true
      }),
      false
    );

    assert.equal(
      shouldRecordAutomaticMovieWatch({
        contentType: "pelicula",
        prevCompleted: false,
        nextCompleted: true,
        shouldLogActivity: false
      }),
      false
    );

    assert.equal(
      shouldRecordAutomaticMovieWatch({
        contentType: "serie",
        prevCompleted: false,
        nextCompleted: true,
        shouldLogActivity: true
      }),
      false
    );
  }
);

test(
  "PATCH /api/library/:id registra el primer watched usando la fecha de la actividad",
  () => {
    const start = serverSource.indexOf(
      'app.patch("/api/library/:id"'
    );

    const end = serverSource.indexOf(
      'app.delete("/api/library/:id"',
      start
    );

    assert.notEqual(start, -1, "debe existir PATCH /api/library/:id");
    assert.notEqual(end, -1, "debe poder aislarse PATCH /api/library/:id");

    const block = serverSource.slice(start, end);

    assert.match(
      block,
      /_shouldRecordAutomaticMovieWatch/,
      "PATCH debe decidir si registra el primer visionado"
    );

    assert.match(
      block,
      /eventType:\s*"watched"/,
      "el evento automático de película debe ser watched"
    );

    assert.match(
      block,
      /occurredAt:\s*activityCreatedAt/,
      "el visionado debe usar la misma fecha real de la actividad"
    );

    assert.match(
      block,
      /consumptionHistory\.unshift/,
      "el visionado debe persistirse como evento histórico"
    );
  }
);

test(
  "DELETE /api/consumption-history elimina eventos por itemId y since",
  () => {
    const start = serverSource.indexOf(
      'app.delete("/api/consumption-history"'
    );

    assert.notEqual(
      start,
      -1,
      "debe existir DELETE /api/consumption-history"
    );

    const end = serverSource.indexOf(
      "\napp.",
      start + 20
    );

    assert.notEqual(
      end,
      -1,
      "debe poder aislarse DELETE /api/consumption-history"
    );

    const block = serverSource.slice(start, end);

    assert.match(
      block,
      /_requireAuth/,
      "DELETE debe requerir autenticación"
    );

    assert.match(
      block,
      /itemId/,
      "DELETE debe filtrar por itemId"
    );

    assert.match(
      block,
      /sinceIso/,
      "DELETE debe usar una fecha since validada"
    );

    assert.match(
      block,
      /occurredAt/,
      "DELETE debe comparar la fecha real del evento"
    );

    assert.match(
      block,
      /_writeDb\(db\)/,
      "DELETE debe persistir la eliminación"
    );
  }
);
