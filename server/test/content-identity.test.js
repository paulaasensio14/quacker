import test from "node:test";
import assert from "node:assert/strict";

import {
  getCanonicalContentKey,
  normalizeContentIdentity,
  normalizeOpenLibraryWorkId,
  sameContentIdentity
} from "../lib/content-identity.js";

test("normaliza una película de TMDB y elimina ceros iniciales", () => {
  const identity = normalizeContentIdentity({
    source: " TMDB ",
    type: "movie",
    externalId: "000123"
  });

  assert.deepEqual(identity, {
    ok: true,
    error: "",
    source: "tmdb",
    type: "pelicula",
    externalId: "123",
    key: "tmdb::pelicula::123"
  });
});

test("normaliza una serie de TMDB con identificador prefijado", () => {
  const identity = normalizeContentIdentity({
    source: "tmdb",
    type: "tv",
    externalId: "tmdb:series:0042"
  });

  assert.deepEqual(identity, {
    ok: true,
    error: "",
    source: "tmdb",
    type: "serie",
    externalId: "42",
    key: "tmdb::serie::42"
  });
});

test("detecta conflictos entre el tipo indicado y el prefijo de TMDB", () => {
  const identity = normalizeContentIdentity({
    source: "tmdb",
    type: "pelicula",
    externalId: "tmdb:tv:12"
  });

  assert.equal(identity.ok, false);
  assert.equal(identity.error, "identity_type_conflict");
  assert.equal(identity.externalId, "");
  assert.equal(identity.key, "");
});

test("normaliza un videojuego de RAWG", () => {
  const identity = normalizeContentIdentity({
    source: "RAWG",
    type: "game",
    externalId: "rawg:0007"
  });

  assert.deepEqual(identity, {
    ok: true,
    error: "",
    source: "rawg",
    type: "game",
    externalId: "7",
    key: "rawg::game::7"
  });
});

test("normaliza una edición de Open Library desde una URL", () => {
  const identity = normalizeContentIdentity({
    source: "openlibrary",
    type: "book",
    externalId: "https://openlibrary.org/books/ol123m"
  });

  assert.deepEqual(identity, {
    ok: true,
    error: "",
    source: "open_library",
    type: "book",
    externalId: "OL123M",
    key: "open_library::book::OL123M"
  });
});

test("normaliza identificadores de obra de Open Library", () => {
  assert.equal(
    normalizeOpenLibraryWorkId(
      "https://openlibrary.org/works/ol456w"
    ),
    "OL456W"
  );

  assert.equal(
    normalizeOpenLibraryWorkId("/works/OL789W"),
    "OL789W"
  );

  assert.equal(
    normalizeOpenLibraryWorkId("OL123M"),
    ""
  );
});

test("normaliza un contenido manual mediante UUID", () => {
  const identity = normalizeContentIdentity({
    source: "manual",
    type: "film",
    externalId: "550E8400-E29B-41D4-A716-446655440000"
  });

  assert.deepEqual(identity, {
    ok: true,
    error: "",
    source: "manual",
    type: "pelicula",
    externalId: "550e8400-e29b-41d4-a716-446655440000",
    key:
      "manual::pelicula::550e8400-e29b-41d4-a716-446655440000"
  });
});

test("rechaza Google Books como proveedor retirado", () => {
  const identity = normalizeContentIdentity({
    source: "google_books",
    type: "book",
    externalId: "abc123"
  });

  assert.equal(identity.ok, false);
  assert.equal(identity.error, "retired_source");
  assert.equal(identity.key, "");
});

const invalidCases = [
  {
    name: "rechaza una fuente ausente",
    input: {
      type: "book",
      externalId: "OL123M"
    },
    expectedError: "missing_source"
  },
  {
    name: "rechaza un tipo ausente",
    input: {
      source: "tmdb",
      externalId: "123"
    },
    expectedError: "missing_type"
  },
  {
    name: "rechaza un tipo desconocido",
    input: {
      source: "tmdb",
      type: "podcast",
      externalId: "123"
    },
    expectedError: "invalid_type"
  },
  {
    name: "rechaza una combinación de fuente y tipo inválida",
    input: {
      source: "tmdb",
      type: "book",
      externalId: "123"
    },
    expectedError: "invalid_source_type"
  },
  {
    name: "rechaza el identificador cero de TMDB",
    input: {
      source: "tmdb",
      type: "movie",
      externalId: "0"
    },
    expectedError: "invalid_external_id"
  },
  {
    name: "rechaza un identificador vacío de RAWG",
    input: {
      source: "rawg",
      type: "game",
      externalId: ""
    },
    expectedError: "missing_external_id"
  },
  {
    name: "rechaza una obra usada como edición de Open Library",
    input: {
      source: "open_library",
      type: "book",
      externalId: "OL123W"
    },
    expectedError: "invalid_open_library_edition"
  },
  {
    name: "rechaza un UUID manual inválido",
    input: {
      source: "manual",
      type: "book",
      externalId: "no-es-un-uuid"
    },
    expectedError: "invalid_manual_uuid"
  }
];

for (const {
  name,
  input,
  expectedError
} of invalidCases) {
  test(name, () => {
    const identity = normalizeContentIdentity(input);

    assert.equal(identity.ok, false);
    assert.equal(identity.error, expectedError);
    assert.equal(identity.externalId, "");
    assert.equal(identity.key, "");
  });
}

test("genera la misma clave para identidades equivalentes", () => {
  const first = {
    source: "TMDB",
    type: "movie",
    externalId: "tmdb:film:00099"
  };

  const second = {
    source: "tmdb",
    type: "pelicula",
    externalId: "99"
  };

  assert.equal(
    getCanonicalContentKey(first),
    "tmdb::pelicula::99"
  );

  assert.equal(
    getCanonicalContentKey(second),
    "tmdb::pelicula::99"
  );

  assert.equal(
    sameContentIdentity(first, second),
    true
  );
});

test("no considera iguales identidades diferentes o inválidas", () => {
  assert.equal(
    sameContentIdentity(
      {
        source: "tmdb",
        type: "movie",
        externalId: "1"
      },
      {
        source: "tmdb",
        type: "movie",
        externalId: "2"
      }
    ),
    false
  );

  assert.equal(
    sameContentIdentity(
      {
        source: "tmdb",
        type: "movie",
        externalId: ""
      },
      {
        source: "tmdb",
        type: "movie",
        externalId: ""
      }
    ),
    false
  );

  assert.equal(
    getCanonicalContentKey({
      source: "google_books",
      type: "book",
      externalId: "abc"
    }),
    ""
  );
});
