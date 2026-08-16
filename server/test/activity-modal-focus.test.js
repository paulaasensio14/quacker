import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../../assets/js/app/home-lists-ui.js", import.meta.url),
  "utf8"
);

test("Activity Modal abre mediante UIModal con foco inicial dentro del diálogo", () => {
  assert.match(
    source,
    /function\s+__openActivityModal\s*\(\)\s*\{[\s\S]*?window\.UIModal(?:\?\.)?\.?open\s*\([\s\S]*?initialFocusSelector\s*:/,
    "__openActivityModal debe delegar en UIModal.open con foco inicial"
  );
});

test("Activity Modal cierra mediante UIModal respetando restoreFocus", () => {
  assert.match(
    source,
    /function\s+__closeActivityModal\s*\(\{\s*restoreFocus\s*=\s*true\s*\}\s*=\s*\{\}\)\s*\{[\s\S]*?window\.UIModal(?:\?\.)?\.?close\s*\([\s\S]*?restoreFocus/,
    "__closeActivityModal debe delegar en UIModal.close y respetar restoreFocus"
  );
});

test("El backdrop de Activity restaura el foco al cerrar", () => {
  assert.doesNotMatch(
    source,
    /e\.target\.id\s*===\s*"activityModal"[\s\S]{0,120}__closeActivityModal\s*\(\{\s*restoreFocus\s*:\s*false\s*\}\)/,
    "cerrar Activity desde el backdrop no debe desactivar la restauración de foco"
  );
});
