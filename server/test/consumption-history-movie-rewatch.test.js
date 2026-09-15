import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const apiClientSource = fs.readFileSync(
  new URL("../../assets/js/data/api-client.js", import.meta.url),
  "utf8"
);

const librarySource = fs.readFileSync(
  new URL("../../assets/js/app/library.js", import.meta.url),
  "utf8"
);

test(
  "ApiClient permite registrar un evento explícito de consumptionHistory",
  () => {
    assert.match(
      apiClientSource,
      /async function addConsumptionHistoryEvent\s*\(/,
      "debe existir addConsumptionHistoryEvent"
    );

    assert.match(
      apiClientSource,
      /POST[\s\S]*\/consumption-history/,
      "debe usar POST /consumption-history"
    );

    const exportStart = apiClientSource.lastIndexOf("return {");
    const exportBlock = apiClientSource.slice(exportStart);

    assert.match(
      exportBlock,
      /addConsumptionHistoryEvent/,
      "debe exportarse en ApiClient"
    );
  }
);

test(
  "el modal muestra Registrar otro visionado solo para películas completadas",
  () => {
    const start = librarySource.indexOf(
      "async function openProgressModal"
    );

    const end = librarySource.indexOf(
      "function closeProgressModal",
      start
    );

    assert.notEqual(start, -1, "debe existir openProgressModal");
    assert.notEqual(end, -1, "debe poder aislarse openProgressModal");

    const block = librarySource.slice(start, end);

    assert.match(
      block,
      /item\.type === "pelicula"/,
      "debe tratar películas"
    );

    assert.match(
      block,
      /isCompleted/,
      "debe comprobar que la película ya esté completada"
    );

    assert.match(
      block,
      /data-action="record-rewatch"/,
      "debe mostrar la acción de revisualización"
    );

    assert.match(
      block,
      /type="datetime-local"/,
      "debe permitir elegir fecha y hora"
    );
  }
);

test(
  "registrar una revisualización crea otro watched sin modificar Library",
  () => {
    assert.match(
      librarySource,
      /async function recordMovieRewatch/,
      "debe existir recordMovieRewatch"
    );

    const start = librarySource.indexOf(
      "async function recordMovieRewatch"
    );

    const end = librarySource.indexOf(
      "\nasync function openProgressModal",
      start + 20
    );

    assert.notEqual(start, -1, "debe existir recordMovieRewatch");
    assert.notEqual(end, -1, "debe poder aislarse recordMovieRewatch");

    const block = librarySource.slice(start, end);

    assert.match(
      block,
      /addConsumptionHistoryEvent/,
      "debe registrar un evento histórico"
    );

    assert.match(
      block,
      /eventType:\s*"watched"/,
      "la revisualización debe ser otro watched"
    );

    assert.match(
      block,
      /occurredAt/,
      "debe enviar la fecha/hora elegida"
    );

    assert.doesNotMatch(
      block,
      /updateLibraryItem|completeLibraryItem/,
      "no debe modificar el estado de Library"
    );
  }
);

test(
  "el click de Registrar otro visionado usa el item y la fecha del modal",
  () => {
    assert.match(
      librarySource,
      /data-action="record-rewatch"/,
      "debe existir el botón de revisualización"
    );

    assert.match(
      librarySource,
      /recordMovieRewatch\(/,
      "el handler debe ejecutar recordMovieRewatch"
    );

    assert.match(
      librarySource,
      /\[name="rewatchAt"\]/,
      "el handler debe leer la fecha/hora del modal"
    );
  }
);

test(
  "los textos de revisualización usan i18n en español e inglés",
  () => {
    const i18nSource = fs.readFileSync(
      new URL("../../assets/js/app/i18n.js", import.meta.url),
      "utf8"
    );

    const keys = [
      "library_rewatch_datetime_label",
      "library_rewatch_action",
      "library_rewatch_success_title",
      "library_rewatch_success_message",
      "library_rewatch_error_title"
    ];

    for (const key of keys) {
      const matches = i18nSource.match(
        new RegExp(`${key}:`, "g")
      ) || [];

      assert.equal(
        matches.length,
        2,
        `${key} debe existir en español e inglés`
      );

      assert.match(
        librarySource,
        new RegExp(key),
        `${key} debe usarse desde Library`
      );
    }

    assert.doesNotMatch(
      librarySource,
      /Fecha y hora del nuevo visionado|Registrar otro visionado|Visionado registrado|Se ha añadido otro visionado al historial\.|No se pudo registrar/,
      "Library no debe contener textos de revisualización hardcodeados"
    );
  }
);
