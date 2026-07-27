import test from "node:test";
import assert from "node:assert/strict";

import {
  blockSensitiveStaticPaths,
  isSensitiveStaticRequestPath,
  normalizeStaticRequestSegments
} from "../lib/static-path-security.js";

test(
  "permite archivos públicos normales",
  () => {
    assert.equal(
      isSensitiveStaticRequestPath("/"),
      false
    );

    assert.equal(
      isSensitiveStaticRequestPath(
        "/index.html"
      ),
      false
    );

    assert.equal(
      isSensitiveStaticRequestPath(
        "/assets/app.js"
      ),
      false
    );
  }
);

test(
  "bloquea el directorio server",
  () => {
    assert.equal(
      isSensitiveStaticRequestPath(
        "/server/db.json"
      ),
      true
    );
  }
);

test(
  "bloquea server ignorando mayúsculas",
  () => {
    assert.equal(
      isSensitiveStaticRequestPath(
        "/SeRvEr/server.js"
      ),
      true
    );
  }
);

test(
  "bloquea el repositorio Git y archivos ocultos",
  () => {
    assert.equal(
      isSensitiveStaticRequestPath(
        "/.git/config"
      ),
      true
    );

    assert.equal(
      isSensitiveStaticRequestPath(
        "/assets/.secret"
      ),
      true
    );
  }
);

test(
  "bloquea node_modules",
  () => {
    assert.equal(
      isSensitiveStaticRequestPath(
        "/node_modules/package/index.js"
      ),
      true
    );
  }
);

test(
  "bloquea nombres codificados",
  () => {
    assert.equal(
      isSensitiveStaticRequestPath(
        "/%73erver/db.json"
      ),
      true
    );
  }
);

test(
  "bloquea rutas codificadas dos veces",
  () => {
    assert.equal(
      isSensitiveStaticRequestPath(
        "/%252e%252e/server/db.json"
      ),
      true
    );
  }
);

test(
  "bloquea traversal hacia server",
  () => {
    assert.equal(
      isSensitiveStaticRequestPath(
        "/assets/../server/db.json"
      ),
      true
    );
  }
);

test(
  "bloquea separadores invertidos",
  () => {
    assert.equal(
      isSensitiveStaticRequestPath(
        "/%5cserver%5cdb.json"
      ),
      true
    );
  }
);

test(
  "bloquea codificación URI inválida",
  () => {
    assert.equal(
      isSensitiveStaticRequestPath(
        "/%E0%A4%A"
      ),
      true
    );
  }
);

test(
  "normaliza segmentos públicos",
  () => {
    assert.deepEqual(
      normalizeStaticRequestSegments(
        "/assets/./icons/../app.js"
      ),
      [
        "assets",
        "app.js"
      ]
    );
  }
);

test(
  "el middleware continúa para rutas públicas",
  () => {
    let nextCalls = 0;

    blockSensitiveStaticPaths(
      {
        originalUrl:
          "/assets/app.js?version=1"
      },
      {},
      () => {
        nextCalls += 1;
      }
    );

    assert.equal(nextCalls, 1);
  }
);

test(
  "el middleware devuelve 404 para rutas sensibles",
  () => {
    const result = {
      status: null,
      type: null,
      body: null
    };

    const response = {
      status(value) {
        result.status = value;
        return this;
      },

      type(value) {
        result.type = value;
        return this;
      },

      send(value) {
        result.body = value;
        return this;
      }
    };

    let nextCalls = 0;

    blockSensitiveStaticPaths(
      {
        originalUrl:
          "/server/db.json"
      },
      response,
      () => {
        nextCalls += 1;
      }
    );

    assert.equal(nextCalls, 0);
    assert.equal(result.status, 404);
    assert.equal(result.type, "text/plain");
    assert.equal(result.body, "Not Found");
  }
);
