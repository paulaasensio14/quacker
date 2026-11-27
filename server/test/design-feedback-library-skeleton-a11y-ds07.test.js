import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(
  new URL(
    "../../assets/js/app/library.js",
    import.meta.url
  ),
  "utf8"
);

const start = source.indexOf(
  "  function renderLibrarySkeleton(){"
);

const end = source.indexOf(
  "  function renderLibraryLoadError()",
  start
);

assert.ok(start >= 0 && end > start);

const renderer = source.slice(start, end);

function fixture(withGrid = true) {
  const cards = [];

  const grid = {
    innerHTML: "",

    appendChild(card) {
      cards.push(card);
    }
  };

  const document = {
    getElementById(id) {
      assert.equal(id, "libraryGrid");

      return withGrid ? grid : null;
    },

    createElement(tagName) {
      return {
        tagName,
        className: "",
        innerHTML: "",
        attributes: {},

        setAttribute(name, value) {
          this.attributes[name] = String(value);
        }
      };
    }
  };

  const context = { document };

  vm.runInNewContext(
    renderer +
    "\nglobalThis.renderSkeleton = renderLibrarySkeleton;",
    context
  );

  return {
    cards,
    render: context.renderSkeleton
  };
}

test("DS-07.7: skeletons de biblioteca ocultos a lectores de pantalla", () => {
  const f = fixture();

  f.render();

  assert.equal(f.cards.length, 8);

  for (const card of f.cards) {
    assert.equal(card.tagName, "article");
    assert.equal(card.className, "lib-card is-skeleton");

    assert.equal(
      card.attributes["aria-hidden"],
      "true",
      "El contenido ficticio debe estar oculto"
    );

    assert.doesNotMatch(
      card.innerHTML,
      /<(button|a|input|select|textarea)\b/i
    );
  }
});

test("DS-07.7: skeleton de biblioteca tolera ausencia de contenedor", () => {
  const f = fixture(false);

  assert.doesNotThrow(() => f.render());

  assert.equal(f.cards.length, 0);
});
