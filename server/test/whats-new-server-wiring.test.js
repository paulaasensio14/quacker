import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const serverSource = fs.readFileSync(
  new URL("../server.js", import.meta.url),
  "utf8"
);

test(
  "server.js integra la infraestructura de Qué hay de nuevo",
  () => {
    assert.match(
      serverSource,
      /from\s+["']\.\/lib\/whats-new\.js["']/,
      "server.js debe importar la lógica de Qué hay de nuevo"
    );

    assert.match(
      serverSource,
      /const\s+APP_VERSION\s*=/,
      "server.js debe disponer de una versión oficial activa"
    );

    const whatsNewDefaults =
      serverSource.match(
        /whatsNew:\s*normalizeWhatsNewUiState\(\)/g
      ) || [];

    assert.ok(
      whatsNewDefaults.length >= 2,
      "usuarios nuevos y buckets creados defensivamente deben inicializar ui.whatsNew"
    );

    assert.match(
      serverSource,
      /db\.users\[userId\]\.ui\.whatsNew\s*=\s*normalizeWhatsNewUiState\(/,
      "usuarios existentes deben normalizar ui.whatsNew"
    );

    assert.match(
      serverSource,
      /app\.get\(["']\/api\/user\/ui\/whats-new["']/,
      "debe existir GET /api/user/ui/whats-new"
    );

    assert.match(
      serverSource,
      /app\.patch\(["']\/api\/user\/ui\/whats-new["']/,
      "debe existir PATCH /api/user/ui/whats-new"
    );

    assert.match(
      serverSource,
      /resolveWhatsNewRelease\(/,
      "el endpoint debe resolver disponibilidad y estado pendiente"
    );

    assert.match(
      serverSource,
      /getWhatsNewReleaseContent\(/,
      "el endpoint debe obtener contenido solo para la versión oficial"
    );
  }
);
