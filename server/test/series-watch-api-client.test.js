import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL("../../assets/js/data/api-client.js", import.meta.url),
  "utf8"
);

function getFunction(name) {
  const marker = `async function ${name}(`;
  const start = source.indexOf(marker);

  assert.ok(start >= 0, `Falta ${name}`);

  const end = source.indexOf(
    "\n  async function ",
    start + marker.length
  );

  return source.slice(
    start,
    end >= 0 ? end : source.length
  );
}

test("QA-02-002: ApiClient expone marcado de episodios", () => {
  const fn = getFunction("setSeriesEpisodeWatched");

  assert.match(fn, /_httpJson/);
  assert.match(fn, /\/episodes\//);
  assert.match(fn, /expectedUpdatedAt/);
});

test("QA-02-002: ApiClient expone marcado de temporadas", () => {
  const fn = getFunction("setSeriesSeasonWatched");

  assert.match(fn, /_httpJson/);
  assert.match(fn, /\/seasons\//);
  assert.match(fn, /expectedUpdatedAt/);
});

test("QA-02-002: las mutaciones notifican cambios de datos", () => {
  const episode = getFunction("setSeriesEpisodeWatched");
  const season = getFunction("setSeriesSeasonWatched");

  assert.match(episode, /_emitDataChanged/);
  assert.match(season, /_emitDataChanged/);
});

test("QA-02-002: ambas funciones son públicas", () => {
  const exportsStart = source.lastIndexOf(
    "getConsumptionHistory,"
  );

  assert.ok(exportsStart >= 0);

  const exportsBlock = source.slice(
    exportsStart,
    source.indexOf("\n  };", exportsStart)
  );

  assert.match(
    exportsBlock,
    /setSeriesEpisodeWatched,/
  );

  assert.match(
    exportsBlock,
    /setSeriesSeasonWatched,/
  );
});
