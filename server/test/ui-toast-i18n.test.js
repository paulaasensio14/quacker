import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const toastSource = fs.readFileSync(
  new URL("../../assets/js/app/ui-toast.js", import.meta.url),
  "utf8"
);

const i18nSource = fs.readFileSync(
  new URL("../../assets/js/app/i18n.js", import.meta.url),
  "utf8"
);

test("el toast obtiene de i18n la etiqueta accesible de cierre", () => {
  assert.match(
    toastSource,
    /I18n\.t\(\s*["']toast_close_label["']\s*\)/,
    "el aria-label del botón de cierre debe proceder de I18n"
  );

  assert.doesNotMatch(
    toastSource,
    /aria-label=["']Cerrar notificación["']/,
    "el toast no debe incrustar la etiqueta de cierre en español"
  );
});

test("el toast obtiene de i18n sus estados de acción", () => {
  assert.match(
    toastSource,
    /I18n\.t\(\s*["']toast_undo_busy["']\s*\)/,
    "el estado de deshacer debe proceder de I18n"
  );

  assert.match(
    toastSource,
    /I18n\.t\(\s*["']toast_action_busy["']\s*\)/,
    "el estado genérico de una acción debe proceder de I18n"
  );

  assert.doesNotMatch(
    toastSource,
    /toLowerCase\(\)\s*===\s*["']deshacer["']/,
    "la detección de Undo no debe depender del texto español"
  );
});

test("el toast reconoce Undo mediante la traducción común", () => {
  assert.match(
    toastSource,
    /I18n\.t\(\s*["']common_undo["']\s*\)/,
    "la detección de Undo debe utilizar la traducción activa"
  );
});

test("existen las traducciones ES y EN del toast", () => {
  assert.match(i18nSource, /toast_close_label\s*:\s*["']Cerrar notificación["']/);
  assert.match(i18nSource, /toast_close_label\s*:\s*["']Close notification["']/);

  assert.match(i18nSource, /toast_undo_busy\s*:\s*["']Deshaciendo…["']/);
  assert.match(i18nSource, /toast_undo_busy\s*:\s*["']Undoing…["']/);

  assert.match(i18nSource, /toast_action_busy\s*:\s*["']Procesando…["']/);
  assert.match(i18nSource, /toast_action_busy\s*:\s*["']Processing…["']/);
});

test("el toast mantiene un fallback seguro cuando window.I18n no existe", () => {
  assert.match(
    toastSource,
    /window\.I18n/,
    "el toast debe comprobar el i18n compartido antes de usarlo"
  );

  assert.match(
    toastSource,
    /quacker_lang/,
    "el fallback debe respetar la preferencia de idioma de la landing"
  );

  assert.match(
    toastSource,
    /navigator\.language/,
    "sin preferencia guardada debe respetar el idioma del navegador"
  );

  assert.match(
    toastSource,
    /Cerrar notificación/,
    "debe existir fallback español para el cierre"
  );

  assert.match(
    toastSource,
    /Close notification/,
    "debe existir fallback inglés para el cierre"
  );
});
