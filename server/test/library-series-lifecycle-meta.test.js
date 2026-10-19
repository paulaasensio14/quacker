import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function extractFunction(source, functionName, nextFunctionName) {
  const start = source.indexOf(`function ${functionName}`);
  const end = source.indexOf(
    `function ${nextFunctionName}`,
    start
  );

  assert.notEqual(
    start,
    -1,
    `${functionName} debe existir`
  );

  assert.notEqual(
    end,
    -1,
    `${nextFunctionName} debe existir`
  );

  return source.slice(start, end);
}

function buildSanitizer(source) {
  const sanitizeLibraryMeta = extractFunction(
    source,
    "_sanitizeLibraryMeta",
    "_sanitizeEpisodeSeenMap"
  );

  return Function(`
    const _sanitizeEpisodeSeenMap = (value) => value;
    ${sanitizeLibraryMeta}
    return _sanitizeLibraryMeta;
  `)();
}

const lifecycleMeta = {
  lastAirDate: "2026-01-08",
  seriesStatus: "Returning Series",
  inProduction: true,
  lastEpisodeToAir: {
    season: 1,
    episode: 8,
    airDate: "2026-01-08"
  },
  nextEpisodeToAir: {
    season: 2,
    episode: 1,
    airDate: "2026-11-05"
  }
};

test(
  "backend conserva metadatos de ciclo de vida de series",
  () => {
    const source = fs.readFileSync(
      new URL("../server.js", import.meta.url),
      "utf8"
    );

    const sanitize = buildSanitizer(source);
    const result = sanitize(lifecycleMeta);

    assert.deepEqual(result, lifecycleMeta);
  }
);

test(
  "cliente conserva metadatos de ciclo de vida de series",
  () => {
    const source = fs.readFileSync(
      new URL("../../assets/js/data/api-client.js", import.meta.url),
      "utf8"
    );

    const sanitize = buildSanitizer(source);
    const result = sanitize(lifecycleMeta);

    assert.deepEqual(result, lifecycleMeta);
  }
);

const unsafeLifecycleMeta = {
  lastEpisodeToAir: {
    season: "2",
    episode: "3",
    airDate: " 2026-11-12 ",
    injected: {
      arbitrary: true
    }
  },
  nextEpisodeToAir: {
    season: 0,
    episode: 4,
    airDate: "2026-11-19",
    injected: "discard-me"
  }
};

function assertLifecyclePointersAreSanitized(source) {
  const sanitize = buildSanitizer(source);
  const result = sanitize(unsafeLifecycleMeta);

  assert.deepEqual(result.lastEpisodeToAir, {
    season: 2,
    episode: 3,
    airDate: "2026-11-12"
  });

  assert.equal(result.nextEpisodeToAir, null);
}

test(
  "backend sanea la estructura de los punteros de episodios de una serie",
  () => {
    const source = fs.readFileSync(
      new URL("../server.js", import.meta.url),
      "utf8"
    );

    assertLifecyclePointersAreSanitized(source);
  }
);

test(
  "cliente sanea la estructura de los punteros de episodios de una serie",
  () => {
    const source = fs.readFileSync(
      new URL("../../assets/js/data/api-client.js", import.meta.url),
      "utf8"
    );

    assertLifecyclePointersAreSanitized(source);
  }
);
