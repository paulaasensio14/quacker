import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL("../../assets/js/data/api-client.js", import.meta.url),
  "utf8"
);

function getSanitizer() {
  const start = source.indexOf(
    "  function _sanitizeLibraryMeta(meta) {"
  );

  const end = source.indexOf(
    "  function _sanitizeSeriesEpisodePointer(",
    start
  );

  assert.ok(start >= 0, "No se encontró el sanitizador");
  assert.ok(end > start, "No se encontró su límite");

  const block = source.slice(start, end);

  return Function(
    "_sanitizeEpisodeSeenMap",
    "_sanitizeSeriesEpisodePointer",
    `${block}
     return _sanitizeLibraryMeta;`
  )(
    (value) => value,
    (value) => value
  );
}

test(
  "QA-02-002: mantiene metadatos existentes de series",
  () => {
    const sanitize = getSanitizer();

    const result = sanitize({
      totalEpisodes: 62,
      totalSeasons: 5,
      season: 1,
      episode: 1
    });

    assert.equal(result.totalEpisodes, 62);
    assert.equal(result.totalSeasons, 5);
    assert.equal(result.season, 1);
    assert.equal(result.episode, 1);
  }
);

test(
  "QA-02-002: conserva marcador canónico de seguimiento",
  () => {
    const sanitize = getSanitizer();

    const result = sanitize({
      totalEpisodes: 62,
      episodeTrackingVersion: 1
    });

    assert.equal(
      result.episodeTrackingVersion,
      1,
      "El sanitizador no debe eliminar episodeTrackingVersion"
    );
  }
);

test(
  "QA-02-002: rechaza versiones de seguimiento inválidas",
  () => {
    const sanitize = getSanitizer();

    for (const invalid of [0, 2, -1, "1", null, true]) {
      const result = sanitize({
        totalEpisodes: 62,
        episodeTrackingVersion: invalid
      });

      assert.equal(
        Object.hasOwn(result, "episodeTrackingVersion"),
        false,
        `No se debe conservar el valor ${String(invalid)}`
      );

      assert.equal(result.totalEpisodes, 62);
    }

    const unknown = sanitize({
      episodeTrackingVersion: 1,
      unauthorizedField: "ignored"
    });

    assert.equal(unknown.episodeTrackingVersion, 1);
    assert.equal(
      Object.hasOwn(unknown, "unauthorizedField"),
      false
    );
  }
);
