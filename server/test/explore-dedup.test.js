import assert from "node:assert/strict";
import test from "node:test";

import {
  buildExploreDedupKey
} from "../lib/explore-dedup.js";

test(
  "mantiene separados contenidos de distinto tipo con mismo título y año",
  () => {
    const book = {
      type: "book",
      title: "Little Nightmares",
      meta: {
        year: 2017
      }
    };

    const game = {
      type: "game",
      title: "Little Nightmares",
      meta: {
        year: 2017
      }
    };

    assert.equal(
      buildExploreDedupKey(book),
      "little nightmares|2017|book"
    );

    assert.equal(
      buildExploreDedupKey(game),
      "little nightmares|2017|game"
    );

    assert.notEqual(
      buildExploreDedupKey(book),
      buildExploreDedupKey(game)
    );
  }
);

test(
  "sigue considerando duplicados del mismo tipo con título y año equivalentes",
  () => {
    const first = {
      type: "game",
      title: "Little Nightmares",
      meta: {
        year: 2017
      }
    };

    const second = {
      type: "GAME",
      title: "Little Nightmares (2017)",
      meta: {
        year: 2017
      }
    };

    assert.equal(
      buildExploreDedupKey(first),
      buildExploreDedupKey(second)
    );

    assert.equal(
      buildExploreDedupKey(first),
      "little nightmares|2017|game"
    );
  }
);
