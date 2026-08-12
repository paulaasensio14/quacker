import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const PUBLIC_NOT_FOUND_MODULE_URL =
  new URL("../lib/public-not-found.js", import.meta.url);

const NOT_FOUND_HTML_URL =
  new URL("../../404.html", import.meta.url);

async function loadPublicNotFoundModule() {
  try {
    return await import(PUBLIC_NOT_FOUND_MODULE_URL.href);
  } catch (_) {
    return null;
  }
}

test(
  "el 404 público distingue navegación web de API y otros métodos",
  async () => {
    const mod = await loadPublicNotFoundModule();

    assert.equal(
      typeof mod?.shouldServePublicNotFound,
      "function",
      "debe existir shouldServePublicNotFound"
    );

    assert.equal(
      mod.shouldServePublicNotFound({
        method: "GET",
        path: "/ruta-inexistente"
      }),
      true
    );

    assert.equal(
      mod.shouldServePublicNotFound({
        method: "HEAD",
        path: "/ruta-inexistente"
      }),
      true
    );

    assert.equal(
      mod.shouldServePublicNotFound({
        method: "GET",
        path: "/api/ruta-inexistente"
      }),
      false
    );

    assert.equal(
      mod.shouldServePublicNotFound({
        method: "GET",
        path: "/api"
      }),
      false
    );

    assert.equal(
      mod.shouldServePublicNotFound({
        method: "POST",
        path: "/ruta-inexistente"
      }),
      false
    );
  }
);

test(
  "el handler público responde 404 con la página propia y deja pasar API",
  async () => {
    const mod = await loadPublicNotFoundModule();

    assert.equal(
      typeof mod?.createPublicNotFoundHandler,
      "function",
      "debe existir createPublicNotFoundHandler"
    );

    const expectedFilePath = "/tmp/quacker-404-test.html";
    const handler =
      mod.createPublicNotFoundHandler(expectedFilePath);

    const result = {
      status: null,
      filePath: null,
      nextCalls: 0
    };

    const response = {
      status(value) {
        result.status = value;
        return this;
      },

      sendFile(value, callback) {
        result.filePath = value;

        if (typeof callback === "function") {
          callback(null);
        }

        return this;
      }
    };

    handler(
      {
        method: "GET",
        path: "/ruta-inexistente"
      },
      response,
      () => {
        result.nextCalls += 1;
      }
    );

    assert.equal(result.status, 404);
    assert.equal(result.filePath, expectedFilePath);
    assert.equal(result.nextCalls, 0);

    result.status = null;
    result.filePath = null;
    result.nextCalls = 0;

    handler(
      {
        method: "GET",
        path: "/api/ruta-inexistente"
      },
      response,
      () => {
        result.nextCalls += 1;
      }
    );

    assert.equal(result.status, null);
    assert.equal(result.filePath, null);
    assert.equal(result.nextCalls, 1);
  }
);

test(
  "existe una página 404 pública mínima y navegable",
  () => {
    assert.equal(
      fs.existsSync(NOT_FOUND_HTML_URL),
      true,
      "debe existir 404.html"
    );

    const html = fs.readFileSync(
      NOT_FOUND_HTML_URL,
      "utf8"
    );

    assert.match(html, /<!doctype html/i);
    assert.match(html, /\b404\b/);
    assert.match(
      html,
      /href=["']\/["']/,
      "la página debe permitir volver al inicio"
    );
  }
);

test(
  "el 404 público se registra después de la defensa de rutas sensibles",
  () => {
    const serverSource = fs.readFileSync(
      new URL("../server.js", import.meta.url),
      "utf8"
    );

    const sensitiveIndex = serverSource.indexOf(
      "app.use(blockSensitiveStaticPaths);"
    );

    const publicNotFoundIndex = serverSource.indexOf(
      "createPublicNotFoundHandler(",
      sensitiveIndex
    );

    assert.notEqual(
      sensitiveIndex,
      -1,
      "debe mantenerse blockSensitiveStaticPaths"
    );

    assert.notEqual(
      publicNotFoundIndex,
      -1,
      "debe registrarse el handler 404 público"
    );

    assert.ok(
      publicNotFoundIndex > sensitiveIndex,
      "el 404 público debe ejecutarse después de proteger rutas sensibles"
    );
  }
);
