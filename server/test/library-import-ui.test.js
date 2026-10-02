import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dashboardSource =
  fs.readFileSync(
    new URL(
      "../../dashboard.html",
      import.meta.url
    ),
    "utf8"
  );

const i18nSource =
  fs.readFileSync(
    new URL(
      "../../assets/js/app/i18n.js",
      import.meta.url
    ),
    "utf8"
  );

const apiClientSource =
  fs.readFileSync(
    new URL(
      "../../assets/js/data/api-client.js",
      import.meta.url
    ),
    "utf8"
  );

test(
  "Mi Biblioteca sustituye el CTA manual Añadir por Importar",
  () => {
    assert.match(
      dashboardSource,
      /<button[^>]*id="btnImportLibrary"[^>]*data-i18n="library_import_cta"[^>]*>/
    );

    assert.doesNotMatch(
      dashboardSource,
      /id="btnAddLibraryItem"/
    );
  }
);

test(
  "el CTA de importación existe en español e inglés",
  () => {
    const matches =
      i18nSource.match(
        /library_import_cta:\s*"[^"]+"/g
      ) || [];

    assert.equal(
      matches.length,
      2,
      "library_import_cta debe existir exactamente en ES y EN"
    );
  }
);

const librarySource =
  fs.readFileSync(
    new URL(
      "../../assets/js/app/library.js",
      import.meta.url
    ),
    "utf8"
  );

test(
  "el estado vacío inicial de Biblioteca también conduce a Importar",
  () => {
    assert.match(
      librarySource,
      /id="libEmptyImportBtn"/
    );

    assert.match(
      librarySource,
      /library_empty_initial_import_cta/
    );

    assert.doesNotMatch(
      librarySource,
      /id="libEmptyAddBtn"/
    );

    assert.doesNotMatch(
      librarySource,
      /getElementById\("libEmptyAddBtn"\)\?\.addEventListener\("click",\s*openAddLibraryModal\)/
    );
  }
);

test(
  "el CTA vacío de importación existe en español e inglés",
  () => {
    const matches =
      i18nSource.match(
        /library_empty_initial_import_cta:\s*"[^"]+"/g
      ) || [];

    assert.equal(
      matches.length,
      2,
      "library_empty_initial_import_cta debe existir exactamente en ES y EN"
    );
  }
);

test(
  "Importar abre un modal accesible con selector de archivo CSV",
  () => {
    assert.match(
      dashboardSource,
      /<div[^>]*id="importLibraryModal"[^>]*aria-hidden="true"[^>]*>/
    );

    assert.match(
      dashboardSource,
      /<div[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="importLibraryModalTitle"[^>]*>/
    );

    assert.match(
      dashboardSource,
      /<input[^>]*id="importLibraryFile"[^>]*type="file"[^>]*accept="[^"]*\.csv[^"]*"[^>]*>/
    );

    assert.match(
      dashboardSource,
      /<label[^>]*for="importLibraryFile"[^>]*data-i18n="library_import_file_label"[^>]*>/
    );
  }
);

test(
  "el flujo Importar reutiliza UIModal y sustituye el listener manual antiguo",
  () => {
    assert.match(
      librarySource,
      /UIModal\?\.bind\("importLibraryModal"/
    );

    assert.match(
      librarySource,
      /closest\("#btnImportLibrary"\)/
    );

    assert.match(
      librarySource,
      /openImportLibraryModal\(\)/
    );

    assert.doesNotMatch(
      librarySource,
      /closest\("#btnAddLibraryItem"\)/
    );
  }
);

test(
  "las etiquetas básicas del selector de importación existen en ES y EN",
  () => {
    for (const key of [
      "library_import_modal_title",
      "library_import_file_label"
    ]) {
      const matches =
        i18nSource.match(
          new RegExp(`${key}:\\s*"[^"]+"`, "g")
        ) || [];

      assert.equal(
        matches.length,
        2,
        `${key} debe existir exactamente en ES y EN`
      );
    }
  }
);


test(
  "ApiClient expone el preview de importación contra el endpoint HTTP",
  () => {
    assert.match(
      apiClientSource,
      /async function previewLibraryImport\s*\(\s*text\s*=\s*""\s*\)/
    );

    assert.match(
      apiClientSource,
      /_httpJson\(\s*"POST"\s*,\s*"\/library\/import\/preview"\s*,\s*\{\s*text\s*\}\s*\)/
    );

    assert.match(
      apiClientSource,
      /\bpreviewLibraryImport\b[\s\S]*\bgetLibrary\b/
    );
  }
);

test(
  "el modal de importación ofrece análisis y contenedores de Preview",
  () => {
    assert.match(
      dashboardSource,
      /id="analyzeImportLibraryBtn"[^>]*data-i18n="library_import_analyze"/
    );

    assert.match(
      dashboardSource,
      /id="importLibraryErrors"/
    );

    assert.match(
      dashboardSource,
      /id="importLibraryPreview"/
    );

    assert.match(
      dashboardSource,
      /id="importLibraryPreviewSummary"/
    );

    assert.match(
      dashboardSource,
      /id="importLibraryRows"/
    );
  }
);

test(
  "Library analiza el CSV seleccionado mediante ApiClient y renderiza el Preview",
  () => {
    assert.match(
      librarySource,
      /function _renderLibraryImportPreview\s*\(/
    );

    assert.match(
      librarySource,
      /getElementById\("importLibraryFile"\)/
    );

    assert.match(
      librarySource,
      /\.files\?\.\[0\]/
    );

    assert.match(
      librarySource,
      /await file\.text\(\)/
    );

    assert.match(
      librarySource,
      /await ApiClient\.previewLibraryImport\(text\)/
    );

    assert.match(
      librarySource,
      /_renderLibraryImportPreview\s*\(\s*preview\s*\)/
    );
  }
);

test(
  "las etiquetas básicas del Preview de importación existen en ES y EN",
  () => {
    for (const key of [
      "library_import_analyze",
      "library_import_preview_title",
      "library_import_preview_total",
      "library_import_preview_matched",
      "library_import_preview_doubtful",
      "library_import_preview_not_found",
      "library_import_preview_duplicate",
      "library_import_preview_invalid"
    ]) {
      const matches =
        i18nSource.match(
          new RegExp(`${key}:\\s*"[^"]+"`, "g")
        ) || [];

      assert.equal(
        matches.length,
        2,
        `${key} debe existir exactamente en ES y EN`
      );
    }
  }
);

test(
  "el Preview permite corregir manualmente coincidencias dudosas",
  () => {
    assert.match(
      librarySource,
      /let __libraryImportPreviewState\s*=\s*null/
    );

    assert.match(
      librarySource,
      /function _applyLibraryImportManualMatch\s*\(/
    );

    assert.match(
      librarySource,
      /data-import-candidate-select/
    );

    assert.match(
      librarySource,
      /manual_selection/
    );

    assert.match(
      librarySource,
      /status:\s*"matched"/
    );
  }
);

test(
  "la corrección manual recalcula el resumen del Preview",
  () => {
    assert.match(
      librarySource,
      /function _recalculateLibraryImportSummary\s*\(/
    );

    assert.match(
      librarySource,
      /__libraryImportPreviewState/
    );

    assert.match(
      librarySource,
      /_renderLibraryImportPreview\s*\(\s*__libraryImportPreviewState\s*\)/
    );

    assert.match(
      librarySource,
      /closest\('\[data-import-candidate-select\]'\)/
    );
  }
);

test(
  "ApiClient expone la confirmación de importación contra el endpoint HTTP",
  () => {
    assert.match(
      apiClientSource,
      /async function confirmLibraryImport\s*\(\s*rows\s*=\s*\[\]\s*\)/
    );

    assert.match(
      apiClientSource,
      /_httpJson\(\s*"POST"\s*,\s*"\/library\/import\/confirm"\s*,\s*\{\s*rows\s*\}\s*\)/
    );

    assert.match(
      apiClientSource,
      /\bpreviewLibraryImport\b[\s\S]*\bconfirmLibraryImport\b[\s\S]*\bgetLibrary\b/
    );
  }
);

test(
  "el modal de importación expone una acción de confirmación traducida",
  () => {
    assert.match(
      dashboardSource,
      /<button[^>]*id="confirmImportLibraryBtn"[^>]*data-i18n="library_import_confirm"[^>]*>/
    );

    const matches =
      i18nSource.match(
        /library_import_confirm:\s*"[^"]+"/g
      ) || [];

    assert.equal(
      matches.length,
      2,
      "library_import_confirm debe existir exactamente en ES y EN"
    );
  }
);

test(
  "Library confirma el Preview mediante ApiClient antes de cerrar el modal",
  () => {
    assert.match(
      librarySource,
      /getElementById\("confirmImportLibraryBtn"\)\?\.addEventListener\("click",\s*async\s*\(\)\s*=>/
    );

    assert.match(
      librarySource,
      /if\s*\(\s*!__libraryImportPreviewState\s*\|\|\s*!Array\.isArray\(\s*__libraryImportPreviewState\.rows\s*\)\s*\)/
    );

    assert.match(
      librarySource,
      /await ApiClient\.confirmLibraryImport\(\s*__libraryImportPreviewState\.rows\s*\)/
    );

    assert.match(
      librarySource,
      /closeImportLibraryModal\(\)/
    );
  }
);

test(
  "Library muestra un resumen final después de confirmar la importación",
  () => {
    assert.match(
      dashboardSource,
      /id="importLibraryResult"/
    );

    for (const key of [
      "library_import_result_title",
      "library_import_result_imported",
      "library_import_result_duplicate",
      "library_import_result_skipped",
      "library_import_result_failed"
    ]) {
      const matches =
        i18nSource.match(
          new RegExp(
            `${key}:\\s*"[^"]+"`,
            "g"
          )
        ) || [];

      assert.equal(
        matches.length,
        2,
        `${key} debe existir exactamente en ES y EN`
      );
    }

    assert.match(
      librarySource,
      /function _renderLibraryImportResult\s*\(/
    );

    assert.match(
      librarySource,
      /const result\s*=\s*await ApiClient\.confirmLibraryImport\(\s*__libraryImportPreviewState\.rows\s*\)/
    );

    assert.match(
      librarySource,
      /_renderLibraryImportResult\(\s*result\s*\)/
    );
  }
);

test(
  "resetear el modal vuelve a habilitar Analizar después del resumen final",
  () => {
    const match =
      librarySource.match(
        /function _resetLibraryImportPreview\s*\(\)\s*\{([\s\S]*?)\n\}/
      );

    assert.ok(
      match,
      "_resetLibraryImportPreview debe existir"
    );

    const resetSource =
      match[1];

    assert.match(
      resetSource,
      /getElementById\(\s*"analyzeImportLibraryBtn"\s*\)/
    );

    assert.match(
      resetSource,
      /disabled\s*=\s*false/
    );
  }
);

test(
  "Library traduce los códigos internos de importación a mensajes legibles",
  () => {
    assert.match(
      librarySource,
      /function _libraryImportErrorMessage\s*\(/
    );

    for (const key of [
      "library_import_error_file_required",
      "library_import_error_unsupported_format",
      "library_import_error_unclosed_quote",
      "library_import_error_invalid_headers",
      "library_import_error_column_count",
      "library_import_error_preview_failed",
      "library_import_error_confirm_failed"
    ]) {
      const matches =
        i18nSource.match(
          new RegExp(
            `${key}:\\s*"[^"]+"`,
            "g"
          )
        ) || [];

      assert.equal(
        matches.length,
        2,
        `${key} debe existir exactamente en ES y EN`
      );
    }

    for (const code of [
      "unsupported_import_format",
      "csv_unclosed_quote",
      "csv_empty_header",
      "csv_duplicate_header",
      "csv_missing_required_headers",
      "csv_unsupported_header",
      "csv_column_count_mismatch"
    ]) {
      assert.match(
        librarySource,
        new RegExp(
          `(?:["']${code}["']|${code})\\s*:`
        )
      );
    }

    assert.match(
      librarySource,
      /_showLibraryImportError\(\s*_libraryImportErrorMessage\(/
    );
  }
);

test(
  "el resumen final muestra también el total procesado",
  () => {
    const matches =
      i18nSource.match(
        /library_import_result_total:\s*"[^"]+"/g
      ) || [];

    assert.equal(
      matches.length,
      2,
      "library_import_result_total debe existir exactamente en ES y EN"
    );

    const resultMatch =
      librarySource.match(
        /function _renderLibraryImportResult\s*\([\s\S]*?\n\}/
      );

    assert.ok(
      resultMatch,
      "_renderLibraryImportResult debe existir"
    );

    assert.match(
      resultMatch[0],
      /summary\.total/
    );

    assert.match(
      resultMatch[0],
      /library_import_result_total/
    );
  }
);
