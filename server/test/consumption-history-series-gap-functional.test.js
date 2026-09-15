import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const apiSource = fs.readFileSync(
  new URL("../../assets/js/data/api-client.js", import.meta.url),
  "utf8"
);

const librarySource = fs.readFileSync(
  new URL("../../assets/js/app/library.js", import.meta.url),
  "utf8"
);

function extractBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);

  assert.notEqual(start, -1, `no se encontró ${startMarker}`);
  assert.notEqual(end, -1, `no se encontró ${endMarker}`);

  return source.slice(start, end);
}

function buildApiHelpers() {
  const cloneData = extractBlock(
    apiSource,
    "function _cloneData",
    "function _cloneCollection"
  );
  const normalizeDataId = extractBlock(
    apiSource,
    "function _normalizeDataId",
    "function _normalizeNotificationId"
  );
  const normalizeSeriesSeasonBreakdown = extractBlock(
    apiSource,
    "function _normalizeSeriesSeasonBreakdown",
    "function _getSeriesAbsoluteEpisodeFromMeta"
  );
  const buildSummary = extractBlock(
    apiSource,
    "function _buildSeriesConsumptionSummary",
    "async function getSeriesConsumptionSummary"
  );
  const buildQuickPatch = extractBlock(
    apiSource,
    "function _buildSeriesQuickProgressPatch",
    "async function progressLibraryItem"
  );

  return Function(`
    ${cloneData}
    ${normalizeDataId}
    ${normalizeSeriesSeasonBreakdown}

    const _t = (_key, _params, fallback = "") => fallback;

    ${buildSummary}
    ${buildQuickPatch}

    return {
      buildSummary: _buildSeriesConsumptionSummary,
      buildQuickPatch: _buildSeriesQuickProgressPatch
    };
  `)();
}

function buildLibraryHelper() {
  const normalizeSeasonBreakdown = extractBlock(
    librarySource,
    "function normalizeLibrarySeasonBreakdown",
    "function getLibraryAbsoluteEpisodeFromMeta"
  );
  const buildQuickPatch = extractBlock(
    librarySource,
    "function buildLibrarySeriesProgressPatch",
    "async function applyQuickProgressWithUndo"
  );

  return Function(`
    ${normalizeSeasonBreakdown}
    ${buildQuickPatch}

    return buildLibrarySeriesProgressPatch;
  `)();
}

function createSeriesFixture() {
  return {
    id: "series-gap-1",
    type: "serie",

    // Library está deliberadamente desincronizado.
    progress: 100,
    status: "completed",

    meta: {
      season: 1,
      episode: 3,
      totalEpisodes: 3,
      seasonBreakdown: [
        {
          seasonNumber: 1,
          episodeCount: 3
        }
      ]
    }
  };
}

function createHistoryFixture() {
  return [
    {
      id: "event-1",
      itemId: "series-gap-1",
      contentType: "serie",
      eventType: "episode_watched",
      occurredAt: "2026-01-01T20:00:00.000Z",
      meta: {
        season: 1,
        episode: 1
      }
    },
    {
      id: "event-3",
      itemId: "series-gap-1",
      contentType: "serie",
      eventType: "episode_watched",
      occurredAt: "2026-01-03T20:00:00.000Z",
      meta: {
        season: 1,
        episode: 3
      }
    }
  ];
}

test(
  "el resumen canónico detecta T1E2 como primer episodio no visto",
  () => {
    const { buildSummary } = buildApiHelpers();

    const summary = buildSummary(
      createSeriesFixture(),
      createHistoryFixture()
    );

    assert.equal(summary.watchedEpisodes, 2);
    assert.equal(summary.totalEpisodes, 3);
    assert.equal(summary.progress, 67);
    assert.equal(summary.completed, false);

    assert.deepEqual(
      summary.nextEpisode,
      {
        season: 1,
        episode: 2
      }
    );
  }
);

test(
  "ApiClient Continuar usa T1E2 aunque Library figure como completada",
  () => {
    const {
      buildSummary,
      buildQuickPatch
    } = buildApiHelpers();

    const item = createSeriesFixture();

    const summary = buildSummary(
      item,
      createHistoryFixture()
    );

    const patch = buildQuickPatch(
      item,
      summary
    );

    assert.ok(patch);

    assert.deepEqual(
      patch.activityPayload,
      {
        season: 1,
        episode: 2
      }
    );

    assert.equal(patch.meta.season, 1);
    assert.equal(patch.meta.episode, 2);
    assert.equal(patch.progress, 100);
    assert.equal(patch.status, "completed");
    assert.equal(patch.justCompleted, true);
  }
);

test(
  "Library Continuar usa el mismo T1E2 canónico",
  () => {
    const { buildSummary } = buildApiHelpers();
    const buildLibraryQuickPatch = buildLibraryHelper();

    const item = createSeriesFixture();

    const summary = buildSummary(
      item,
      createHistoryFixture()
    );

    const patch = buildLibraryQuickPatch(
      item,
      summary
    );

    assert.ok(patch);

    assert.deepEqual(
      patch.activityPayload,
      {
        season: 1,
        episode: 2
      }
    );

    assert.equal(patch.meta.season, 1);
    assert.equal(patch.meta.episode, 2);
    assert.equal(patch.progress, 100);
    assert.equal(patch.status, "completed");
  }
);

function createSeriesWithoutBreakdownFixture() {
  return {
    id: "series-no-breakdown-1",
    type: "serie",
    progress: 33,
    status: "watching",
    meta: {
      season: 1,
      episode: 1,
      totalEpisodes: 3
    }
  };
}

function createHistoryWithoutBreakdownFixture() {
  return [
    {
      id: "event-no-breakdown-1",
      itemId: "series-no-breakdown-1",
      contentType: "serie",
      eventType: "episode_watched",
      occurredAt: "2026-01-01T20:00:00.000Z",
      meta: {
        season: 1,
        episode: 1
      }
    }
  ];
}

test(
  "ApiClient Continuar usa el resumen canónico aunque Library no tenga seasonBreakdown",
  () => {
    const {
      buildSummary,
      buildQuickPatch
    } = buildApiHelpers();

    const item = createSeriesWithoutBreakdownFixture();
    const summary = buildSummary(
      item,
      createHistoryWithoutBreakdownFixture()
    );

    assert.deepEqual(summary.nextEpisode, {
      season: 1,
      episode: 2
    });

    const patch = buildQuickPatch(item, summary);

    assert.ok(patch);
    assert.deepEqual(patch.activityPayload, {
      season: 1,
      episode: 2
    });
    assert.equal(patch.progress, 67);
    assert.equal(patch.status, "watching");
  }
);

test(
  "Library Continuar usa el resumen canónico aunque Library no tenga seasonBreakdown",
  () => {
    const { buildSummary } = buildApiHelpers();
    const buildLibraryQuickPatch = buildLibraryHelper();

    const item = createSeriesWithoutBreakdownFixture();
    const summary = buildSummary(
      item,
      createHistoryWithoutBreakdownFixture()
    );

    assert.deepEqual(summary.nextEpisode, {
      season: 1,
      episode: 2
    });

    const patch = buildLibraryQuickPatch(item, summary);

    assert.ok(patch);
    assert.deepEqual(patch.activityPayload, {
      season: 1,
      episode: 2
    });
    assert.equal(patch.progress, 67);
    assert.equal(patch.status, "watching");
  }
);
