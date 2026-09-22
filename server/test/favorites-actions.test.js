import test from "node:test";
import assert from "node:assert/strict";

import {
  addFavorite,
  moveFavorite,
  replaceFavorite,
  removeFavorite
} from "../lib/favorites.js";

function favorite({
  contentType = "pelicula",
  source = "tmdb",
  externalId = "99",
  title = "Dune",
  cover = "https://image.tmdb.org/dune.jpg",
  addedAt = "2026-09-21T10:00:00.000Z"
} = {}) {
  return {
    contentType,
    source,
    externalId,
    itemSnapshot: {
      title,
      cover
    },
    addedAt
  };
}

test("añade un favorito a su categoría sin alterar las demás", () => {
  const result = addFavorite(
    undefined,
    "pelicula",
    favorite()
  );

  assert.equal(result.ok, true);
  assert.equal(result.error, "");
  assert.equal(result.favorite.externalId, "99");

  assert.deepEqual(
    result.favorites.pelicula.map((entry) => entry.externalId),
    ["99"]
  );

  assert.deepEqual(result.favorites.serie, []);
  assert.deepEqual(result.favorites.game, []);
  assert.deepEqual(result.favorites.book, []);
});

test("rechaza categorías de favoritos no admitidas", () => {
  const result = addFavorite(
    undefined,
    "podcast",
    favorite()
  );

  assert.deepEqual(result, {
    ok: false,
    error: "invalid_favorite_type"
  });
});

test("rechaza un favorito cuya identidad o snapshot no sean válidos", () => {
  const result = addFavorite(
    undefined,
    "pelicula",
    favorite({
      externalId: "no-es-id"
    })
  );

  assert.deepEqual(result, {
    ok: false,
    error: "invalid_favorite"
  });
});

test("rechaza duplicados usando la identidad canónica", () => {
  const initial = {
    pelicula: [
      favorite({
        externalId: "42",
        title: "Original"
      })
    ]
  };

  const result = addFavorite(
    initial,
    "pelicula",
    favorite({
      externalId: "tmdb:movie:00042",
      title: "Duplicado"
    })
  );

  assert.deepEqual(result, {
    ok: false,
    error: "favorite_already_exists"
  });
});

test("no permite más de cuatro favoritos en una categoría", () => {
  const initial = {
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
      })
    ]
  };

  const result = addFavorite(
    initial,
    "game",
    favorite({
      contentType: "game",
      source: "rawg",
      externalId: "5",
      title: "Juego 5"
    })
  );

  assert.deepEqual(result, {
    ok: false,
    error: "favorites_limit_reached"
  });
});

test("sustituye una posición ocupada conservando el resto y sin crear huecos", () => {
  const initial = {
    book: [
      favorite({
        contentType: "book",
        source: "open_library",
        externalId: "OL1M",
        title: "Libro 1"
      }),
      favorite({
        contentType: "book",
        source: "open_library",
        externalId: "OL2M",
        title: "Libro 2"
      }),
      favorite({
        contentType: "book",
        source: "open_library",
        externalId: "OL3M",
        title: "Libro 3"
      })
    ]
  };

  const result = replaceFavorite(
    initial,
    "book",
    2,
    favorite({
      contentType: "book",
      source: "open_library",
      externalId: "OL99M",
      title: "Libro nuevo"
    })
  );

  assert.equal(result.ok, true);

  assert.deepEqual(
    result.favorites.book.map((entry) => entry.externalId),
    ["OL1M", "OL99M", "OL3M"]
  );

  assert.equal(
    result.favorite.itemSnapshot.title,
    "Libro nuevo"
  );
});

test("una sustitución no puede duplicar otro favorito de la misma categoría", () => {
  const initial = {
    pelicula: [
      favorite({
        externalId: "1",
        title: "Película 1"
      }),
      favorite({
        externalId: "2",
        title: "Película 2"
      })
    ]
  };

  const result = replaceFavorite(
    initial,
    "pelicula",
    2,
    favorite({
      externalId: "tmdb:movie:00001",
      title: "Duplicado"
    })
  );

  assert.deepEqual(result, {
    ok: false,
    error: "favorite_already_exists"
  });
});

test("rechaza posiciones inexistentes al sustituir", () => {
  const result = replaceFavorite(
    {
      serie: [
        favorite({
          contentType: "serie",
          externalId: "10",
          title: "Serie"
        })
      ]
    },
    "serie",
    2,
    favorite({
      contentType: "serie",
      externalId: "20",
      title: "Otra serie"
    })
  );

  assert.deepEqual(result, {
    ok: false,
    error: "favorite_not_found"
  });
});

test("elimina por posición y compacta el orden de la categoría", () => {
  const initial = {
    pelicula: [
      favorite({
        externalId: "1",
        title: "Uno"
      }),
      favorite({
        externalId: "2",
        title: "Dos"
      }),
      favorite({
        externalId: "3",
        title: "Tres"
      })
    ]
  };

  const result = removeFavorite(
    initial,
    "pelicula",
    2
  );

  assert.equal(result.ok, true);
  assert.equal(result.removed.externalId, "2");

  assert.deepEqual(
    result.favorites.pelicula.map((entry) => entry.externalId),
    ["1", "3"]
  );
});

test("rechaza posiciones fuera del rango 1-4", () => {
  for (const position of [0, 5, -1, "abc"]) {
    const result = removeFavorite(
      {
        pelicula: [
          favorite()
        ]
      },
      "pelicula",
      position
    );

    assert.deepEqual(result, {
      ok: false,
      error: "invalid_favorite_position"
    });
  }
});


test("mueve un favorito a otra posición conservando el orden relativo", () => {
  const initial = {
    pelicula: [
      favorite({
        externalId: "1",
        title: "Uno"
      }),
      favorite({
        externalId: "2",
        title: "Dos"
      }),
      favorite({
        externalId: "3",
        title: "Tres"
      }),
      favorite({
        externalId: "4",
        title: "Cuatro"
      })
    ]
  };

  const result = moveFavorite(
    initial,
    "pelicula",
    4,
    2
  );

  assert.equal(result.ok, true);

  assert.deepEqual(
    result.favorites.pelicula.map(
      (entry) => entry.externalId
    ),
    ["1", "4", "2", "3"]
  );
});
