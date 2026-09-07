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
  "convierte portadas legacy de Google Books a una ruta same-origin del item",
  () => {
    const fnSource = extractFunction(
      serverSource,
      "_normalizeLibraryCover"
    );

    const normalizeLibraryCover = Function(
      `"use strict"; return (${fnSource});`
    )();

    assert.equal(
      normalizeLibraryCover({
        id: "u_legacy_book",
        source: "open_library",
        externalId: "OL34156823M",
        cover:
          "https://books.google.com/books/content?id=-Ff2DwAAQBAJ&printsec=frontcover&img=1&zoom=1"
      }),
      "/api/library/u_legacy_book/legacy-cover"
    );

    assert.equal(
      normalizeLibraryCover({
        source: "open_library",
        externalId: "OL34156823M",
        cover:
          "https://covers.openlibrary.org/b/id/123456-L.jpg"
      }),
      "https://covers.openlibrary.org/b/id/123456-L.jpg"
    );

    assert.equal(
      normalizeLibraryCover({
        source: "tmdb",
        externalId: "123",
        cover:
          "https://image.tmdb.org/t/p/w500/example.jpg"
      }),
      "https://image.tmdb.org/t/p/w500/example.jpg"
    );
  }
);

test(
  "GET /api/library normaliza las portadas legacy antes de responder",
  () => {
    const start = serverSource.indexOf(
      'app.get("/api/library",'
    );
    const end = serverSource.indexOf(
      'app.get("/api/library/:id"',
      start
    );

    assert.notEqual(start, -1, "debe existir GET /api/library");
    assert.notEqual(end, -1, "debe poder aislarse GET /api/library");

    const getLibraryBlock = serverSource.slice(start, end);

    assert.match(
      getLibraryBlock,
      /_normalizeLibraryCover/,
      "GET /api/library debe normalizar las portadas antes de enviarlas"
    );
  }
);

test(
  "GET /api/library/:id normaliza la portada legacy antes de responder",
  () => {
    const start = serverSource.indexOf(
      'app.get("/api/library/:id"'
    );
    const end = serverSource.indexOf(
      'app.post("/api/library/restore"',
      start
    );

    assert.notEqual(start, -1, "debe existir GET /api/library/:id");
    assert.notEqual(end, -1, "debe poder aislarse GET /api/library/:id");

    const getLibraryItemBlock = serverSource.slice(start, end);

    assert.match(
      getLibraryItemBlock,
      /_normalizeLibraryCover/,
      "GET /api/library/:id debe normalizar la portada antes de enviarla"
    );
  }
);


test(
  "existe una ruta autenticada y acotada para servir la portada legacy",
  () => {
    const start = serverSource.indexOf(
      '"/api/library/:id/legacy-cover"'
    );

    assert.notEqual(
      start,
      -1,
      "debe existir GET /api/library/:id/legacy-cover"
    );

    const end = serverSource.indexOf(
      'app.get("/api/library/:id"',
      start + 1
    );

    assert.notEqual(
      end,
      -1,
      "debe poder aislarse la ruta legacy-cover"
    );

    const routeBlock = serverSource.slice(start, end);

    assert.match(
      routeBlock,
      /_requireAuth/,
      "la portada legacy debe requerir autenticación"
    );

    assert.match(
      routeBlock,
      /books\.google\.com/,
      "la ruta debe validar explícitamente el host legacy permitido"
    );

    assert.match(
      routeBlock,
      /redirect:\s*"error"/,
      "la descarga legacy no debe seguir redirecciones"
    );
  }
);
