import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(
  new URL("../../404.html", import.meta.url),
  "utf8"
);

const runSource = fs.readFileSync(
  new URL("../../assets/js/quacker-run.js", import.meta.url),
  "utf8"
);

const i18nSource = fs.readFileSync(
  new URL("../../assets/js/app/i18n.js", import.meta.url),
  "utf8"
);

test("la 404 reutiliza el sistema i18n existente de Quacker", () => {
  assert.match(
    html,
    /<script[^>]+src=["']\/assets\/js\/app\/i18n\.js["'][^>]*><\/script>/i,
    "404.html debe cargar assets/js/app/i18n.js"
  );

  assert.match(
    html,
    /data-i18n=["']quacker_run_/,
    "la interfaz 404 debe utilizar claves data-i18n de Quacker Run"
  );
});

test("Quacker Run contiene traducciones ES y EN", () => {
  assert.match(
    i18nSource,
    /quacker_run_start\s*:\s*["']Empezar["']/,
    "debe existir la traducción española del botón de inicio"
  );

  assert.match(
    i18nSource,
    /quacker_run_start\s*:\s*["']Start["']/,
    "debe existir la traducción inglesa del botón de inicio"
  );

  assert.match(
    i18nSource,
    /quacker_run_game_over\s*:\s*["']Fin de la partida\.["']/,
    "debe existir el estado español de fin de partida"
  );

  assert.match(
    i18nSource,
    /quacker_run_game_over\s*:\s*["']Game over\.["']/,
    "debe existir el estado inglés de fin de partida"
  );
});

test("el controlador usa I18n para sus textos dinámicos", () => {
  assert.match(
    runSource,
    /window\.I18n/,
    "Quacker Run debe reutilizar window.I18n"
  );

  assert.match(
    runSource,
    /I18n\.t\(\s*["']quacker_run_/,
    "los textos dinámicos deben obtenerse mediante I18n.t"
  );

  assert.match(
    runSource,
    /quacker:lang-change/,
    "el juego debe reaccionar a cambios de idioma"
  );
});
