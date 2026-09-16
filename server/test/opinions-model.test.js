import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const serverSource = fs.readFileSync(
  new URL("../server.js", import.meta.url),
  "utf8"
);

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);

  assert.notEqual(
    start,
    -1,
    `no se encontró function ${name}()`
  );

  let depth = 0;
  let bodyStarted = false;

  for (let i = start; i < source.length; i += 1) {
    if (source[i] === "{") {
      depth += 1;
      bodyStarted = true;
    } else if (source[i] === "}") {
      depth -= 1;

      if (bodyStarted && depth === 0) {
        return source.slice(start, i + 1);
      }
    }
  }

  throw new Error(`no se pudo aislar function ${name}()`);
}

function makeNormalizeOpinion() {
  const snapshotFnSource = extractFunction(
    serverSource,
    "_normalizeConsumptionItemSnapshot"
  );

  const opinionFnSource = extractFunction(
    serverSource,
    "_normalizeOpinion"
  );

  return Function(
    `"use strict";
${snapshotFnSource}
return (${opinionFnSource});`
  )();
}

function makeNormalizeOpinions(normalizeOpinion) {
  const fnSource = extractFunction(
    serverSource,
    "_normalizeOpinions"
  );

  return Function(
    "_normalizeOpinion",
    `"use strict"; return (${fnSource});`
  )(normalizeOpinion);
}

test(
  "normaliza una opinión completa",
  () => {
    const normalizeOpinion = makeNormalizeOpinion();

    assert.deepEqual(
      normalizeOpinion({
        itemId: " movie-1 ",
        contentType: "pelicula",
        itemSnapshot: {
          title: " Interstellar ",
          source: " tmdb ",
          externalId: " 157336 "
        },
        rating: 5,
        tags: [
          "masterpiece",
          "made_me_cry",
          "masterpiece",
          "invalid_tag"
        ],
        review: {
          text: " Me encantó. ",
          privacy: "public",
          spoiler: true,
          createdAt: "2026-09-16T07:00:00.000Z",
          updatedAt: "2026-09-16T07:05:00.000Z"
        },
        createdAt: "2026-09-16T07:00:00.000Z",
        updatedAt: "2026-09-16T07:05:00.000Z"
      }),
      {
        itemId: "movie-1",
        contentType: "pelicula",
        itemSnapshot: {
          title: "Interstellar",
          source: "tmdb",
          externalId: "157336"
        },
        rating: 5,
        tags: [
          "masterpiece",
          "made_me_cry"
        ],
        review: {
          text: "Me encantó.",
          privacy: "public",
          spoiler: true,
          createdAt: "2026-09-16T07:00:00.000Z",
          updatedAt: "2026-09-16T07:05:00.000Z"
        },
        createdAt: "2026-09-16T07:00:00.000Z",
        updatedAt: "2026-09-16T07:05:00.000Z"
      }
    );
  }
);

test(
  "rating solo admite enteros del 1 al 5 y es independiente de la reseña",
  () => {
    const normalizeOpinion = makeNormalizeOpinion();

    const opinion = normalizeOpinion({
      itemId: "book-1",
      contentType: "book",
      rating: 4.5,
      tags: [],
      review: {
        text: "Una reseña sin valoración.",
        privacy: "private",
        spoiler: false,
        createdAt: "2026-09-16T07:00:00.000Z",
        updatedAt: "2026-09-16T07:00:00.000Z"
      },
      createdAt: "2026-09-16T07:00:00.000Z",
      updatedAt: "2026-09-16T07:00:00.000Z"
    });

    assert.equal(opinion.rating, null);
    assert.equal(
      opinion.review.text,
      "Una reseña sin valoración."
    );
  }
);

test(
  "solo conserva los tags rápidos permitidos y elimina duplicados",
  () => {
    const normalizeOpinion = makeNormalizeOpinion();

    const opinion = normalizeOpinion({
      itemId: "game-1",
      contentType: "game",
      rating: null,
      tags: [
        "masterpiece",
        "casual",
        "surprised_me",
        "made_me_cry",
        "made_me_laugh",
        "comfort",
        "thought_provoking",
        "overrated",
        "underrated",
        "would_rewatch",
        "highly_recommended",
        "masterpiece",
        "otro"
      ],
      review: null,
      createdAt: "2026-09-16T07:00:00.000Z",
      updatedAt: "2026-09-16T07:00:00.000Z"
    });

    assert.deepEqual(
      opinion.tags,
      [
        "masterpiece",
        "casual",
        "surprised_me",
        "made_me_cry",
        "made_me_laugh",
        "comfort",
        "thought_provoking",
        "overrated",
        "underrated",
        "would_rewatch",
        "highly_recommended"
      ]
    );
  }
);

test(
  "descarta opiniones inválidas o completamente vacías",
  () => {
    const normalizeOpinion = makeNormalizeOpinion();

    assert.equal(
      normalizeOpinion({
        itemId: "",
        contentType: "pelicula",
        rating: 5,
        createdAt: "2026-09-16T07:00:00.000Z",
        updatedAt: "2026-09-16T07:00:00.000Z"
      }),
      null
    );

    assert.equal(
      normalizeOpinion({
        itemId: "movie-1",
        contentType: "podcast",
        rating: 5,
        createdAt: "2026-09-16T07:00:00.000Z",
        updatedAt: "2026-09-16T07:00:00.000Z"
      }),
      null
    );

    assert.equal(
      normalizeOpinion({
        itemId: "movie-1",
        contentType: "pelicula",
        rating: null,
        tags: [],
        review: null,
        createdAt: "2026-09-16T07:00:00.000Z",
        updatedAt: "2026-09-16T07:00:00.000Z"
      }),
      null
    );
  }
);

test(
  "opinions conserva una sola opinión canónica por contenido",
  () => {
    const normalizeOpinion = makeNormalizeOpinion();
    const normalizeOpinions =
      makeNormalizeOpinions(normalizeOpinion);

    const opinions = normalizeOpinions([
      {
        itemId: "movie-1",
        contentType: "pelicula",
        rating: 3,
        createdAt: "2026-09-15T07:00:00.000Z",
        updatedAt: "2026-09-15T07:00:00.000Z"
      },
      {
        itemId: "movie-1",
        contentType: "pelicula",
        rating: 5,
        createdAt: "2026-09-15T07:00:00.000Z",
        updatedAt: "2026-09-16T07:00:00.000Z"
      }
    ]);

    assert.equal(opinions.length, 1);
    assert.equal(opinions[0].rating, 5);
    assert.equal(
      opinions[0].updatedAt,
      "2026-09-16T07:00:00.000Z"
    );
  }
);


test(
  "rating no convierte booleanos ni strings en valoraciones",
  () => {
    const normalizeOpinion = makeNormalizeOpinion();

    for (const invalidRating of [true, "5"]) {
      const opinion = normalizeOpinion({
        itemId: "movie-coercion",
        contentType: "pelicula",
        rating: invalidRating,
        tags: [],
        review: {
          text: "Reseña válida.",
          privacy: "private",
          spoiler: false,
          createdAt: "2026-09-16T07:00:00.000Z",
          updatedAt: "2026-09-16T07:00:00.000Z"
        },
        createdAt: "2026-09-16T07:00:00.000Z",
        updatedAt: "2026-09-16T07:00:00.000Z"
      });

      assert.ok(opinion);
      assert.equal(
        opinion.rating,
        null,
        `rating ${JSON.stringify(invalidRating)} no debe convertirse`
      );
    }
  }
);
