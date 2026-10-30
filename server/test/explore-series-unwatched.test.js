import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../../assets/js/app/explore.js", import.meta.url),
  "utf8"
);

function extractFunction(name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);

  assert.ok(start >= 0, `No se encuentra ${name}`);

  const bodyStart = source.indexOf("{", start);
  let depth = 0;

  for (let i = bodyStart; i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}") depth--;

    if (depth === 0) {
      return source.slice(start, i + 1);
    }
  }

  throw new Error(`Función incompleta: ${name}`);
}

const norm = (value) =>
  String(value ?? "").trim().toLowerCase();

const hasMeaningfulActivity = new Function(
  "_norm",
  `${extractFunction("_hasMeaningfulExploreWatchActivity")}
   return _hasMeaningfulExploreWatchActivity;`
)(norm);

test(
  "QA-02-001: una serie nueva en T1-E1 no tiene episodios vistos",
  () => {
    const item = {
      type: "serie",
      status: "not_started",
      progress: 0,
      meta: {
        season: 1,
        episode: 1,
        totalEpisodes: 62
      },
      updatedAt: "2026-10-30T11:28:00.000Z"
    };

    assert.equal(hasMeaningfulActivity(item), false);
  }
);

test(
  "QA-02-001: una serie con progreso real conserva su actividad",
  () => {
    const item = {
      type: "serie",
      status: "in_progress",
      progress: 25,
      meta: {
        season: 2,
        episode: 3
      }
    };

    assert.equal(hasMeaningfulActivity(item), true);
  }
);

test(
  "QA-02-001: una serie completada conserva su actividad",
  () => {
    const item = {
      type: "serie",
      status: "completed",
      progress: 100,
      meta: {
        season: 5,
        episode: 16
      }
    };

    assert.equal(hasMeaningfulActivity(item), true);
  }
);

test(
  "QA-02-001: una serie nueva no implica visionado aunque tenga posicion avanzada",
  () => {
    const item = {
      type: "serie",
      status: "not_started",
      progress: 0,
      meta: { season: 2, episode: 4 }
    };

    assert.equal(hasMeaningfulActivity(item), false);
  }
);

test(
  "QA-02-001: una serie en progreso con posicion avanzada conserva actividad",
  () => {
    const item = {
      type: "serie",
      status: "in_progress",
      progress: 0,
      meta: { season: 2, episode: 4 }
    };

    assert.equal(hasMeaningfulActivity(item), true);
  }
);

test(
  "QA-02-001: una pelicula no vista no tiene actividad",
  () => {
    const item = {
      type: "pelicula",
      status: "not_started",
      progress: 0,
      updatedAt: "2026-10-30T11:28:00.000Z"
    };

    assert.equal(hasMeaningfulActivity(item), false);
  }
);
