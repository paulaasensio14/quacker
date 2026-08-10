import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";


function loadFrontendItemIdentity() {
  const source = fs.readFileSync(
    new URL("../../assets/js/data/item-identity.js", import.meta.url),
    "utf8"
  );

  const context = {
    window: {},
    console
  };

  vm.createContext(context);
  vm.runInContext(source, context, {
    filename: "assets/js/data/item-identity.js"
  });

  return context.window.ItemIdentity;
}


test(
  "reconstruye el eid de Explore desde la identidad persistida de Library",
  () => {
    const ItemIdentity = loadFrontendItemIdentity();

    assert.equal(
      typeof ItemIdentity?.getExploreEid,
      "function",
      "ItemIdentity debe exponer getExploreEid"
    );

    const cases = [
      {
        item: {
          source: "tmdb",
          type: "pelicula",
          externalId: "123"
        },
        expected: "tmdb:movie:123"
      },
      {
        item: {
          source: "tmdb",
          type: "serie",
          externalId: "42"
        },
        expected: "tmdb:series:42"
      },
      {
        item: {
          source: "rawg",
          type: "game",
          externalId: "7"
        },
        expected: "rawg:game:7"
      },
      {
        item: {
          source: "wikipedia_game",
          type: "game",
          externalId: "51310184"
        },
        expected: "wikipedia_game:game:51310184"
      },
      {
        item: {
          source: "open_library",
          type: "book",
          externalId: "OL123M"
        },
        expected: "open_library:book:OL123M"
      },
      {
        item: {
          source: "manual",
          type: "book",
          externalId: "550e8400-e29b-41d4-a716-446655440000"
        },
        expected: "manual:book:550e8400-e29b-41d4-a716-446655440000"
      }
    ];

    for (const { item, expected } of cases) {
      assert.equal(
        ItemIdentity.getExploreEid(item),
        expected,
        JSON.stringify(item)
      );
    }
  }
);


test(
  "la identidad frontend acepta wikipedia_game como fuente canónica de videojuegos",
  () => {
    const ItemIdentity = loadFrontendItemIdentity();

    const identity = ItemIdentity.normalizeContentIdentity({
      source: " Wikipedia_Game ",
      type: "game",
      externalId: "wikipedia_game:0051310184"
    });

    assert.deepEqual(
      JSON.parse(JSON.stringify(identity)),
      {
        ok: true,
        error: "",
        source: "wikipedia_game",
        type: "game",
        externalId: "51310184",
        key: "wikipedia_game::game::51310184"
      }
    );
  }
);


test(
  "Library conecta sus tarjetas con Detail sin interceptar controles internos",
  () => {
    const source = fs.readFileSync(
      new URL("../../assets/js/app/library.js", import.meta.url),
      "utf8"
    );

    const start = source.indexOf(
      "// Abrir Detail desde una tarjeta de Mi Biblioteca."
    );
    const end = source.indexOf(
      "// Bind modales",
      start
    );

    assert.notEqual(
      start,
      -1,
      "debe existir el listener Library → Detail"
    );

    assert.notEqual(
      end,
      -1,
      "debe poder aislarse el listener Library → Detail"
    );

    const listener = source.slice(start, end);

    assert.match(
      listener,
      /e\.target\.closest\("\.lib-card\[data-id\]"\)/
    );

    assert.match(
      listener,
      /"button, a, input, select, textarea, \[data-action\]"/
    );

    assert.match(
      listener,
      /window\.DetailModule\?\.open\?\.\(detailItem,\s*\{\s*originView: "library",\s*triggerEl: card\s*\}\s*\)/s
    );
  }
);
