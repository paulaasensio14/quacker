import assert from "node:assert/strict";
import test from "node:test";

import {
  buildExploreFallbackItems
} from "../lib/explore-fallback.js";

const SAMPLE_FEED = [
  {
    eid: "quacker_seed:book:ex_001",
    source: "quacker_seed",
    externalId: "ex_001",
    type: "book",
    title: "El nombre del viento",
    releaseDate: "2007-03-27",
    summary: "Novela de fantasía.",
    meta: {
      author: "Patrick Rothfuss"
    }
  },
  {
    eid: "quacker_seed:game:ex_002",
    source: "quacker_seed",
    externalId: "ex_002",
    type: "game",
    title: "Hades",
    releaseDate: "2020-09-17",
    summary: "Roguelite de acción."
  }
];

test(
  "convierte un seed en contenido manual con UUID estable",
  () => {
    const first = buildExploreFallbackItems(
      SAMPLE_FEED,
      {
        type: "book",
        limit: 1
      }
    );

    const second = buildExploreFallbackItems(
      SAMPLE_FEED,
      {
        type: "book",
        limit: 1
      }
    );

    assert.equal(first.length, 1);
    assert.equal(first[0].source, "manual");
    assert.equal(first[0].type, "book");
    assert.equal(first[0].meta.year, 2007);

    assert.match(
      first[0].externalId,
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );

    assert.equal(
      first[0].externalId,
      second[0].externalId
    );

    assert.equal(
      first[0].eid,
      `manual:book:${first[0].externalId}`
    );
  }
);

test(
  "filtra el fallback por tipo, búsqueda y límite",
  () => {
    const books = buildExploreFallbackItems(
      SAMPLE_FEED,
      {
        type: "book",
        query: "nombre viento",
        limit: 1
      }
    );

    const games = buildExploreFallbackItems(
      SAMPLE_FEED,
      {
        type: "game",
        query: "hades",
        limit: 1
      }
    );

    const missing = buildExploreFallbackItems(
      SAMPLE_FEED,
      {
        query: "contenido inexistente"
      }
    );

    assert.equal(books.length, 1);
    assert.equal(books[0].title, "El nombre del viento");

    assert.equal(games.length, 1);
    assert.equal(games[0].title, "Hades");

    assert.deepEqual(missing, []);
  }
);

test(
  "ignora entradas inválidas y fuentes que no sean seed",
  () => {
    const items = buildExploreFallbackItems([
      null,
      {},
      {
        source: "tmdb",
        externalId: "123",
        type: "pelicula",
        title: "No debe convertirse"
      },
      ...SAMPLE_FEED
    ]);

    assert.equal(items.length, 2);

    assert.deepEqual(
      items.map((item) => item.source),
      ["manual", "manual"]
    );
  }
);
