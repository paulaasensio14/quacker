import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const librarySource = fs.readFileSync(
  new URL("../../assets/js/app/library.js", import.meta.url),
  "utf8"
);

const i18nSource = fs.readFileSync(
  new URL("../../assets/js/app/i18n.js", import.meta.url),
  "utf8"
);

const cssSource = fs.readFileSync(
  new URL("../../assets/css/dashboard.css", import.meta.url),
  "utf8"
);

function extractBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);

  assert.notEqual(start, -1, `no se encontró ${startMarker}`);
  assert.notEqual(end, -1, `no se encontró ${endMarker}`);

  return source.slice(start, end);
}

test(
  "el modal de progreso carga consumptionHistory del item",
  () => {
    const block = extractBlock(
      librarySource,
      "async function openProgressModal",
      "function closeProgressModal"
    );

    assert.match(
      block,
      /ApiClient\.getConsumptionHistory\s*\(\s*\{\s*itemId:\s*normalizedItemId\s*\}/,
      "debe cargar el historial canónico del item"
    );
  }
);

test(
  "las películas muestran total de visionados y fechas del historial",
  () => {
    assert.match(
      librarySource,
      /function renderMovieConsumptionHistory\s*\(/,
      "debe existir un renderer específico para historial de películas"
    );

    const block = extractBlock(
      librarySource,
      "function renderMovieConsumptionHistory",
      "function renderSeriesConsumptionHistory"
    );

    assert.match(
      block,
      /eventType\s*===\s*"watched"/,
      "solo debe contar eventos watched"
    );

    assert.match(
      block,
      /library_history_movie_views/,
      "debe mostrar el total de visionados mediante i18n"
    );

    assert.match(
      block,
      /occurredAt/,
      "debe mostrar las fechas del historial"
    );

    assert.match(
      block,
      /consumption-history-list/,
      "debe renderizar una lista visual de fechas"
    );
  }
);

test(
  "las series muestran progreso real, siguiente episodio e historial por episodio",
  () => {
    assert.match(
      librarySource,
      /function renderSeriesConsumptionHistory\s*\(/,
      "debe existir un renderer específico para historial de series"
    );

    const block = extractBlock(
      librarySource,
      "function renderSeriesConsumptionHistory",
      "async function recordMovieRewatch"
    );

    assert.match(
      block,
      /watchedEpisodes/,
      "debe mostrar episodios vistos reales"
    );

    assert.match(
      block,
      /totalEpisodes/,
      "debe mostrar el total de episodios"
    );

    assert.match(
      block,
      /nextEpisode/,
      "debe mostrar el siguiente episodio"
    );

    assert.match(
      block,
      /episodeHistory/,
      "debe usar el historial canónico por episodio"
    );

    assert.match(
      block,
      /library_history_series_progress/,
      "el progreso debe usar i18n"
    );

    assert.match(
      block,
      /library_history_next_episode/,
      "el siguiente episodio debe usar i18n"
    );
  }
);

test(
  "openProgressModal usa el resumen canónico para series",
  () => {
    const block = extractBlock(
      librarySource,
      "async function openProgressModal",
      "function closeProgressModal"
    );

    assert.match(
      block,
      /ApiClient\.getSeriesConsumptionSummary\s*\(\s*normalizedItemId\s*\)/,
      "debe obtener el resumen real de la serie"
    );

    assert.match(
      block,
      /renderSeriesConsumptionHistory/,
      "debe insertar el historial de series en el modal"
    );

    assert.match(
      block,
      /renderMovieConsumptionHistory/,
      "debe insertar el historial de películas en el modal"
    );
  }
);

test(
  "los textos del historial existen en español e inglés",
  () => {
    const keys = [
      "library_history_title",
      "library_history_empty",
      "library_history_movie_views",
      "library_history_series_progress",
      "library_history_next_episode",
      "library_history_episode"
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
  }
);

test(
  "el historial del modal tiene estilos propios compatibles con claro y oscuro",
  () => {
    assert.match(
      cssSource,
      /\.consumption-history-panel\s*\{/,
      "debe existir el contenedor visual del historial"
    );

    assert.match(
      cssSource,
      /\.consumption-history-list\s*\{/,
      "debe existir la lista visual del historial"
    );

    assert.match(
      cssSource,
      /\.consumption-history-item\s*\{/,
      "debe existir cada fila del historial"
    );

    assert.match(
      cssSource,
      /body\.dark-theme\s+\.consumption-history-panel/,
      "el panel debe contemplar modo oscuro"
    );
  }
);
