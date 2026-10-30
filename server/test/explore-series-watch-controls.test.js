import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL("../../assets/js/app/explore.js", import.meta.url),
  "utf8"
);

function getSection(startMarker, endMarker) {
  const start = source.indexOf(startMarker);

  assert.ok(
    start >= 0,
    `No se encontró ${startMarker}`
  );

  const end = source.indexOf(
    endMarker,
    start + startMarker.length
  );

  assert.ok(
    end > start,
    `No se encontró el límite de ${startMarker}`
  );

  return source.slice(start, end);
}

test(
  "QA-02-002 UI: cada episodio tiene control de seguimiento",
  () => {
    const render = getSection(
      "function _renderContentDetailSeasonBody(",
      "function _scrollDetailNextEpisodeIntoView("
    );

    assert.match(
      render,
      /data-action="set-series-episode-watched"/
    );

    assert.match(
      render,
      /__libraryItemId/
    );

    assert.match(
      render,
      /_getDetailEpisodeSeenAt/
    );
  }
);

test(
  "QA-02-002 UI: existe control de temporada completa",
  () => {
    const render = getSection(
      "function _renderContentDetailSeasonBody(",
      "function _scrollDetailNextEpisodeIntoView("
    );

    assert.match(
      render,
      /data-action="set-series-season-watched"/
    );
  }
);

test(
  "QA-02-002 UI: botones conectados a ApiClient",
  () => {
    assert.match(
      source,
      /ApiClient\.setSeriesEpisodeWatched\s*\(/
    );

    assert.match(
      source,
      /ApiClient\.setSeriesSeasonWatched\s*\(/
    );
  }
);

test(
  "QA-02-002 UI: temporada requiere confirmación",
  () => {
    assert.match(
      source,
      /window\.confirm\s*\(/
    );

    assert.match(
      source,
      /data-action="set-series-season-watched"/
    );
  }
);


test(
  "QA-02-002 UI: botones nuevos respetan guardado pendiente",
  () => {
    const render = getSection(
      "function _renderContentDetailSeasonBody(",
      "function _scrollDetailNextEpisodeIntoView("
    );

    assert.match(
      render,
      /__detailEpisodeWatchBusy/,
      "El render debe consultar si existe un guardado pendiente"
    );

    const seasonButton = render.match(
      /<button[\s\S]*?data-action="set-series-season-watched"[\s\S]*?<\/button>/
    );

    const episodeButton = render.match(
      /<button[\s\S]*?data-action="set-series-episode-watched"[\s\S]*?<\/button>/
    );

    assert.ok(seasonButton, "Falta el botón de temporada");
    assert.ok(episodeButton, "Falta el botón de episodio");

    assert.match(
      seasonButton[0],
      /disabled/,
      "El botón de temporada debe poder nacer deshabilitado"
    );

    assert.match(
      episodeButton[0],
      /disabled/,
      "El botón de episodio debe poder nacer deshabilitado"
    );
  }
);
