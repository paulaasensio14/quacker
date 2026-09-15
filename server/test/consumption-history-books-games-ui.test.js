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

function extractBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);

  assert.notEqual(start, -1, `no se encontró ${startMarker}`);
  assert.notEqual(end, -1, `no se encontró ${endMarker}`);

  return source.slice(start, end);
}

test(
  "los libros muestran lecturas completadas y sus fechas",
  () => {
    assert.match(
      librarySource,
      /function renderBookConsumptionHistory\s*\(/
    );

    const block = extractBlock(
      librarySource,
      "function renderBookConsumptionHistory",
      "function renderGameConsumptionHistory"
    );

    assert.match(block, /eventType\s*===\s*"read_completed"/);
    assert.match(block, /occurredAt/);
    assert.match(block, /library_history_book_reads/);
    assert.match(block, /library_history_book_read/);
    assert.match(block, /consumption-history-list/);
  }
);

test(
  "los juegos muestran sesiones, horas y finalizaciones",
  () => {
    assert.match(
      librarySource,
      /function renderGameConsumptionHistory\s*\(/
    );

    const block = extractBlock(
      librarySource,
      "function renderGameConsumptionHistory",
      "async function recordBookReread"
    );

    assert.match(block, /eventType\s*===\s*"played"/);
    assert.match(block, /eventType\s*===\s*"completed"/);
    assert.match(block, /durationHours/);
    assert.match(block, /library_history_game_sessions/);
    assert.match(block, /library_history_game_hours/);
    assert.match(block, /library_history_game_completions/);
    assert.match(block, /library_history_game_session/);
    assert.match(block, /library_history_game_completed/);
  }
);

test(
  "una relectura registra otro read_completed sin modificar Library",
  () => {
    const block = extractBlock(
      librarySource,
      "async function recordBookReread",
      "async function recordGameCompletion"
    );

    assert.match(block, /item\.type !== "book"/);
    assert.match(block, /isCompleted/);
    assert.match(block, /addConsumptionHistoryEvent/);
    assert.match(block, /eventType:\s*"read_completed"/);

    assert.doesNotMatch(
      block,
      /updateLibraryItem|completeLibraryItem/
    );
  }
);

test(
  "otra finalización de juego registra completed sin modificar Library",
  () => {
    const block = extractBlock(
      librarySource,
      "async function recordGameCompletion",
      "async function recordMovieRewatch"
    );

    assert.match(block, /item\.type !== "game"/);
    assert.match(block, /isCompleted/);
    assert.match(block, /addConsumptionHistoryEvent/);
    assert.match(block, /eventType:\s*"completed"/);

    assert.doesNotMatch(
      block,
      /updateLibraryItem|completeLibraryItem/
    );
  }
);

test(
  "el modal de libro muestra historial y permite registrar relectura si está completado",
  () => {
    const block = extractBlock(
      librarySource,
      "async function openProgressModal",
      "function closeProgressModal"
    );

    assert.match(block, /renderBookConsumptionHistory\(consumptionHistory\)/);
    assert.match(block, /data-action="record-reread"/);
    assert.match(block, /name="rereadAt"/);
    assert.match(block, /library_reread_action/);
  }
);

test(
  "el modal de juego muestra historial y permite registrar otra finalización",
  () => {
    const block = extractBlock(
      librarySource,
      "async function openProgressModal",
      "function closeProgressModal"
    );

    assert.match(block, /renderGameConsumptionHistory\(consumptionHistory\)/);
    assert.match(block, /data-action="record-game-completion"/);
    assert.match(block, /name="gameCompletionAt"/);
    assert.match(block, /library_game_completion_action/);
  }
);

test(
  "los handlers ejecutan las acciones explícitas de libro y juego",
  () => {
    assert.match(
      librarySource,
      /\[data-action="record-reread"\]/
    );

    assert.match(
      librarySource,
      /recordBookReread\(itemId,\s*rereadAt\)/
    );

    assert.match(
      librarySource,
      /\[data-action="record-game-completion"\]/
    );

    assert.match(
      librarySource,
      /recordGameCompletion\(itemId,\s*gameCompletionAt\)/
    );
  }
);

test(
  "los textos de historial de libros y juegos existen en español e inglés",
  () => {
    const keys = [
      "library_history_book_reads",
      "library_history_book_read",
      "library_reread_datetime_label",
      "library_reread_action",
      "library_reread_success_title",
      "library_reread_success_message",
      "library_reread_error_title",
      "library_history_game_sessions",
      "library_history_game_hours",
      "library_history_game_completions",
      "library_history_game_session",
      "library_history_game_completed",
      "library_game_completion_datetime_label",
      "library_game_completion_action",
      "library_game_completion_success_title",
      "library_game_completion_success_message",
      "library_game_completion_error_title"
    ];

    for (const key of keys) {
      const matches =
        i18nSource.match(new RegExp(`${key}:`, "g")) || [];

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
