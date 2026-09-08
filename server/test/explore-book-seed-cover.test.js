import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test(
  "el fallback semanal dispone de tres seeds de libro con portada",
  () => {
    const source = fs.readFileSync(
      new URL("../server.js", import.meta.url),
      "utf8"
    );

    const feedStart = source.indexOf("const EXPLORE_FEED = [");
    assert.notEqual(feedStart, -1, "EXPLORE_FEED debe existir");

    const feedEnd = source.indexOf("\n];", feedStart);
    assert.notEqual(feedEnd, -1, "EXPLORE_FEED debe terminar correctamente");

    const feedSource = source.slice(feedStart, feedEnd);

    const bookBlocks = [
      ...feedSource.matchAll(
        /\{\s*eid:\s*"quacker_seed:book:[^"]+"[\s\S]*?\n\s*\}/g
      )
    ].map((match) => match[0]);

    assert.ok(
      bookBlocks.length >= 3,
      "deben existir al menos tres seeds de libro"
    );

    for (const block of bookBlocks.slice(0, 3)) {
      assert.match(
        block,
        /\bcover:\s*"https:\/\/covers\.openlibrary\.org\/[^"]+"/,
        "los tres primeros seeds de libro deben tener portada de Open Library"
      );
    }
  }
);
