import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const serverSource = fs.readFileSync(
  new URL("../server.js", import.meta.url),
  "utf8"
);

test(
  "GET /api/opinions requiere autenticación y permite filtrar por itemId",
  () => {
    const start = serverSource.indexOf(
      'app.get("/api/opinions"'
    );

    assert.notEqual(
      start,
      -1,
      "debe existir GET /api/opinions"
    );

    const end = serverSource.indexOf(
      "\napp.",
      start + 20
    );

    assert.notEqual(
      end,
      -1,
      "debe poder aislarse GET /api/opinions"
    );

    const block = serverSource.slice(start, end);

    assert.match(
      block,
      /_requireAuth/,
      "GET /api/opinions debe requerir autenticación"
    );

    assert.match(
      block,
      /bucket\.opinions/,
      "GET debe leer opinions del usuario autenticado"
    );

    assert.match(
      block,
      /req\.query\.itemId/,
      "GET debe poder filtrar por itemId"
    );
  }
);

test(
  "PUT /api/opinions/:itemId crea o edita una única opinión canónica",
  () => {
    const start = serverSource.search(
      /app\.put\(\s*["']\/api\/opinions\/:itemId["']/
    );

    assert.notEqual(
      start,
      -1,
      "debe existir PUT /api/opinions/:itemId"
    );

    const end = serverSource.indexOf(
      "\napp.",
      start + 20
    );

    assert.notEqual(
      end,
      -1,
      "debe poder aislarse PUT /api/opinions/:itemId"
    );

    const block = serverSource.slice(start, end);

    assert.match(
      block,
      /_requireAuth/,
      "PUT debe requerir autenticación"
    );

    assert.match(
      block,
      /bucket\.opinions/,
      "PUT debe trabajar sobre opinions del usuario"
    );

    assert.match(
      block,
      /findIndex/,
      "PUT debe localizar la opinión existente del contenido"
    );

    assert.match(
      block,
      /_normalizeOpinion/,
      "PUT debe validar la opinión con el normalizador canónico"
    );

    assert.match(
      block,
      /_writeDb\(db\)/,
      "PUT debe persistir los cambios"
    );
  }
);

test(
  "PUT deriva identidad desde Library al crear y conserva snapshot al editar",
  () => {
    const start = serverSource.search(
      /app\.put\(\s*["']\/api\/opinions\/:itemId["']/
    );

    assert.notEqual(
      start,
      -1,
      "debe existir PUT /api/opinions/:itemId"
    );

    const end = serverSource.indexOf(
      "\napp.",
      start + 20
    );

    const block = serverSource.slice(start, end);

    assert.match(
      block,
      /bucket\.library/,
      "al crear debe comprobar el contenido real de Library"
    );

    assert.match(
      block,
      /libraryItem\.type/,
      "el contentType nuevo debe derivarse de Library"
    );

    assert.match(
      block,
      /_buildConsumptionItemSnapshot\(\s*libraryItem\s*\)/,
      "el snapshot nuevo debe construirse desde Library"
    );

    assert.match(
      block,
      /existingOpinion/,
      "la edición debe poder partir de la opinión ya persistida"
    );

    assert.match(
      block,
      /existingOpinion\?\.createdAt|existingOpinion\.createdAt/,
      "al editar debe conservarse createdAt"
    );
  }
);

test(
  "DELETE /api/opinions/:itemId elimina la opinión canónica",
  () => {
    const start = serverSource.search(
      /app\.delete\(\s*["']\/api\/opinions\/:itemId["']/
    );

    assert.notEqual(
      start,
      -1,
      "debe existir DELETE /api/opinions/:itemId"
    );

    const end = serverSource.indexOf(
      "\napp.",
      start + 20
    );

    assert.notEqual(
      end,
      -1,
      "debe poder aislarse DELETE /api/opinions/:itemId"
    );

    const block = serverSource.slice(start, end);

    assert.match(
      block,
      /_requireAuth/,
      "DELETE debe requerir autenticación"
    );

    assert.match(
      block,
      /bucket\.opinions/,
      "DELETE debe operar sobre opinions del usuario"
    );

    assert.match(
      block,
      /\.filter\(/,
      "DELETE debe retirar la opinión del contenido"
    );

    assert.match(
      block,
      /_writeDb\(db\)/,
      "DELETE debe persistir la eliminación"
    );
  }
);

test(
  "PUT elimina la opinión si al editar queda completamente vacía",
  () => {
    const start = serverSource.search(
      /app\.put\(\s*["']\/api\/opinions\/:itemId["']/
    );

    assert.notEqual(
      start,
      -1,
      "debe existir PUT /api/opinions/:itemId"
    );

    const end = serverSource.indexOf(
      "\napp.",
      start + 20
    );

    assert.notEqual(
      end,
      -1,
      "debe poder aislarse PUT /api/opinions/:itemId"
    );

    const block = serverSource.slice(start, end);

    assert.match(
      block,
      /emptyOpinion/,
      "PUT debe detectar cuando la opinión queda vacía"
    );

    assert.match(
      block,
      /bucket\.opinions\.filter/,
      "una opinión vacía debe eliminarse del bucket"
    );

    assert.match(
      block,
      /deleted:\s*1/,
      "la respuesta debe indicar que la opinión fue eliminada"
    );
  }
);
