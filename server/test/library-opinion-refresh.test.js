import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appCore = fs.readFileSync(
  new URL("../../assets/js/app/app-core.js", import.meta.url),
  "utf8"
);

test("Biblioteca se refresca cuando cambia una opinión personal", () => {
  const libraryRefreshBlock = appCore.match(
    /const isLibraryActive[\s\S]*?scheduleLibraryRefresh\(\);/
  );

  assert.ok(
    libraryRefreshBlock,
    "Debe existir el bloque de refresco de Biblioteca"
  );

  assert.match(
    libraryRefreshBlock[0],
    /kind\s*===\s*"opinions"/,
    'El refresco de Biblioteca debe contemplar kind === "opinions"'
  );
});
