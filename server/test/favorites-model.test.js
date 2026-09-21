import test from "node:test";
import assert from "node:assert/strict";
import {
  FAVORITE_TYPES,
  MAX_FAVORITES_PER_TYPE,
  normalizeFavorites
} from "../lib/favorites.js";

const EMPTY_FAVORITES = {
  pelicula: [],
  serie: [],
  game: [],
  book: []
};

function favorite({
  contentType = "pelicula",
  source = "tmdb",
  externalId = "99",
  title = "Dune",
  cover = "https://image.tmdb.org/example.jpg",
  addedAt = "2026-09-21T08:00:00.000Z",
  ...extra
} = {}) {
  return {
    contentType,
    source,
    externalId,
    itemSnapshot: {
      title,
      cover
    },
    addedAt,
    ...extra
  };
}

test("define cuatro categorías y un máximo de cuatro favoritos por categoría", () => {
  assert.deepEqual(
    FAVORITE_TYPES,
    ["pelicula", "serie", "game", "book"]
  );

  assert.equal(MAX_FAVORITES_PER_TYPE, 4);
});

test("una cuenta antigua sin favoritos se normaliza con las cuatro categorías vacías", () => {
  assert.deepEqual(
    normalizeFavorites(undefined),
    EMPTY_FAVORITES
  );

  assert.deepEqual(
    normalizeFavorites(null),
    EMPTY_FAVORITES
  );
});

test("normaliza la identidad canónica y conserva solo el snapshot visual necesario", () => {
  const normalized = normalizeFavorites({
    pelicula: [
      favorite({
        contentType: "movie",
        source: "TMDB",
        externalId: "tmdb:film:00099",
        title: "  Dune  ",
        cover: "  https://image.tmdb.org/dune.jpg  ",
        itemId: "library-local-id",
        eid: "otro-id"
      })
    ]
  });

  assert.deepEqual(
    normalized.pelicula,
    [
      {
        contentType: "pelicula",
        source: "tmdb",
        externalId: "99",
        itemSnapshot: {
          title: "Dune",
          cover: "https://image.tmdb.org/dune.jpg"
        },
        addedAt: "2026-09-21T08:00:00.000Z"
      }
    ]
  );

  assert.equal(
    Object.hasOwn(normalized.pelicula[0], "itemId"),
    false
  );

  assert.equal(
    Object.hasOwn(normalized.pelicula[0], "eid"),
    false
  );
});

test("mantiene como máximo cuatro favoritos por categoría y conserva su orden", () => {
  const normalized = normalizeFavorites({
    game: [
      favorite({
        contentType: "game",
        source: "rawg",
        externalId: "1",
        title: "Juego 1"
      }),
      favorite({
        contentType: "game",
        source: "rawg",
        externalId: "2",
        title: "Juego 2"
      }),
      favorite({
        contentType: "game",
        source: "rawg",
        externalId: "3",
        title: "Juego 3"
      }),
      favorite({
        contentType: "game",
        source: "rawg",
        externalId: "4",
        title: "Juego 4"
      }),
      favorite({
        contentType: "game",
        source: "rawg",
        externalId: "5",
        title: "Juego 5"
      })
    ]
  });

  assert.equal(normalized.game.length, 4);

  assert.deepEqual(
    normalized.game.map((entry) => entry.externalId),
    ["1", "2", "3", "4"]
  );
});

test("elimina duplicados usando la identidad canónica", () => {
  const normalized = normalizeFavorites({
    pelicula: [
      favorite({
        contentType: "movie",
        source: "tmdb",
        externalId: "tmdb:movie:00042",
        title: "Primera copia"
      }),
      favorite({
        contentType: "pelicula",
        source: "TMDB",
        externalId: "42",
        title: "Segunda copia"
      })
    ]
  });

  assert.equal(normalized.pelicula.length, 1);
  assert.equal(
    normalized.pelicula[0].itemSnapshot.title,
    "Primera copia"
  );
  assert.equal(normalized.pelicula[0].externalId, "42");
});

test("descarta identidades inválidas, tipos cruzados y entradas corruptas", () => {
  const normalized = normalizeFavorites({
    pelicula: [
      favorite({
        source: "desconocido",
        externalId: "123"
      }),
      favorite({
        contentType: "game",
        source: "rawg",
        externalId: "7"
      }),
      favorite({
        title: "   "
      }),
      favorite({
        externalId: "no-es-un-id"
      }),
      null,
      "favorito"
    ]
  });

  assert.deepEqual(normalized.pelicula, []);
});

test("normaliza portada y fecha, descarta fechas inválidas e ignora categorías desconocidas", () => {
  const normalized = normalizeFavorites({
    book: [
      favorite({
        contentType: "book",
        source: "openlibrary",
        externalId: "https://openlibrary.org/books/ol123m",
        title: "  Libro  ",
        cover: `  ${"x".repeat(600)}  `,
        addedAt: "2026-09-21T08:00:00Z"
      }),
      favorite({
        contentType: "book",
        source: "open_library",
        externalId: "OL124M",
        title: "Fecha rota",
        addedAt: "esto-no-es-una-fecha"
      })
    ],
    admin: [
      favorite()
    ],
    secretStuff: [
      favorite()
    ]
  });

  assert.equal(normalized.book.length, 1);

  assert.deepEqual(
    normalized.book[0],
    {
      contentType: "book",
      source: "open_library",
      externalId: "OL123M",
      itemSnapshot: {
        title: "Libro",
        cover: "x".repeat(500)
      },
      addedAt: "2026-09-21T08:00:00.000Z"
    }
  );

  assert.deepEqual(
    Object.keys(normalized),
    ["pelicula", "serie", "game", "book"]
  );
});
