import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const profileSource = fs.readFileSync(
  new URL("../../assets/js/app/profile.js", import.meta.url),
  "utf8"
);

const cssSource = fs.readFileSync(
  new URL("../../assets/css/dashboard.css", import.meta.url),
  "utf8"
);

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.className = "";
    this.dataset = {};
    this.attributes = {};
    this.listeners = {};
    this.textContent = "";
    this.hidden = false;

    this.classList = {
      add: (...names) => {
        const tokens = new Set(
          this.className.split(/\s+/).filter(Boolean)
        );

        for (const name of names) {
          tokens.add(name);
        }

        this.className = [...tokens].join(" ");
      },
      contains: (name) =>
        this.className.split(/\s+/).includes(name)
    };
  }

  append(...nodes) {
    this.children.push(...nodes);
  }

  replaceChildren(...nodes) {
    this.children = [...nodes];
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  addEventListener(name, callback) {
    this.listeners[name] = callback;
  }
}

function allNodes(root) {
  return [
    root,
    ...root.children.flatMap(allNodes)
  ];
}

function byClass(root, className) {
  return allNodes(root).find(
    node => node.classList.contains(className)
  );
}

function nodesByClass(root, className) {
  return allNodes(root).filter(
    node => node.classList.contains(className)
  );
}

function favorite(title, cover = "") {
  return {
    itemSnapshot: {
      title,
      cover
    }
  };
}

function render(type, favorites) {
  const host = new FakeElement("div");

  const document = {
    querySelector(selector) {
      return selector ===
        `[data-favorite-slots="${type}"]`
          ? host
          : null;
    },
    createElement(tagName) {
      return new FakeElement(tagName);
    }
  };

  const window = {
    I18n: {
      t(key) {
        return key;
      }
    }
  };

  // Instrumentacion exclusivamente en memoria.
  // No modifica profile.js ni sus exports reales.
  const original =
    "return { init, load, loadOpinionsView };";

  const instrumented = profileSource.replace(
    original,
    "return { init, load, loadOpinionsView, " +
      "__ux04Render: renderFavoriteSlots };"
  );

  assert.notEqual(
    instrumented,
    profileSource,
    "No se encontro el punto de instrumentacion"
  );

  vm.runInNewContext(
    instrumented,
    {
      document,
      window,
      console
    },
    {
      filename: "profile.js",
      timeout: 3000
    }
  );

  const renderFavoriteSlots =
    window.ProfileModule.__ux04Render;

  assert.equal(
    typeof renderFavoriteSlots,
    "function"
  );

  renderFavoriteSlots(type, favorites);

  return host;
}

test(
  "UX-04 BASE: mantiene cuatro posiciones y acciones",
  () => {
    const host = render("pelicula", [
      favorite("Primera"),
      favorite("Segunda")
    ]);

    assert.equal(host.children.length, 4);

    assert.deepEqual(
      host.children.map(
        slot => slot.dataset.favoritePosition
      ),
      ["1", "2", "3", "4"]
    );

    const first = host.children[0];
    const second = host.children[1];
    const third = host.children[2];

    const actions = slot =>
      allNodes(slot)
        .map(node =>
          node.attributes["data-favorite-action"]
        )
        .filter(Boolean);

    for (const action of [
      "move-down",
      "replace",
      "remove"
    ]) {
      assert.ok(actions(first).includes(action));
    }

    for (const action of [
      "move-up",
      "replace",
      "remove"
    ]) {
      assert.ok(actions(second).includes(action));
    }

    assert.ok(actions(third).includes("pick"));
  }
);

test(
  "UX-04 BASE: los titulos se insertan como texto",
  () => {
    const title =
      '<img src=x onerror="alert(1)">';

    const host = render("book", [
      favorite(title)
    ]);

    const displayed = byClass(
      host.children[0],
      "profile-favorite-slot-title"
    );

    assert.ok(displayed);
    assert.equal(displayed.textContent, title);
  }
);

test(
  "UX-04 PORTADA: tarjeta con imagen y texto alternativo",
  () => {
    const host = render("pelicula", [
      favorite(
        "Pelicula de prueba",
        "https://example.com/poster.jpg"
      )
    ]);

    const slot = host.children[0];

    const frame = byClass(
      slot,
      "profile-favorite-cover-frame"
    );

    assert.ok(
      frame,
      "Falta el contenedor visual de portada"
    );

    const image = byClass(
      frame,
      "profile-favorite-cover"
    );

    assert.ok(image, "Falta la imagen");

    assert.equal(
      image.src,
      "https://example.com/poster.jpg"
    );

    assert.match(
      String(image.alt || ""),
      /Pelicula de prueba/
    );

    assert.equal(image.loading, "lazy");

    assert.ok(
      byClass(slot, "profile-favorite-slot-title"),
      "Debe conservar el titulo"
    );
  }
);

test(
  "UX-04 URL: acepta portadas seguras y rechaza URLs inseguras",
  () => {
    const host = render("game", [
      favorite(
        "Permitida",
        "/assets/img/poster.jpg"
      ),
      favorite(
        "JavaScript",
        "javascript:alert(1)"
      ),
      favorite(
        "SVG no permitido",
        "data:image/svg+xml;base64,PHN2Zz4="
      ),
      favorite(
        "HTTP no permitido",
        "http://example.com/poster.jpg"
      )
    ]);

    const firstImage = byClass(
      host.children[0],
      "profile-favorite-cover"
    );

    assert.ok(
      firstImage,
      "Debe admitir una portada local segura"
    );

    assert.equal(
      firstImage.src,
      "/assets/img/poster.jpg"
    );

    for (const index of [1, 2, 3]) {
      assert.equal(
        nodesByClass(
          host.children[index],
          "profile-favorite-cover"
        ).length,
        0,
        `No debe insertar URL insegura: ${index}`
      );
    }
  }
);

test(
  "UX-04 SIN PORTADA: mantiene un espacio visual estable",
  () => {
    const host = render("serie", [
      favorite("Serie sin imagen")
    ]);

    const slot = host.children[0];

    const frame = byClass(
      slot,
      "profile-favorite-cover-frame"
    );

    assert.ok(
      frame,
      "Una portada ausente necesita un marco"
    );

    assert.equal(
      nodesByClass(
        frame,
        "profile-favorite-cover"
      ).length,
      0
    );

    assert.equal(
      byClass(
        slot,
        "profile-favorite-slot-title"
      )?.textContent,
      "Serie sin imagen"
    );
  }
);

test(
  "UX-04 ERROR: imagen rota se oculta sin perder titulo",
  () => {
    const host = render("book", [
      favorite(
        "Libro con portada rota",
        "https://example.com/missing.jpg"
      )
    ]);

    const slot = host.children[0];

    const image = byClass(
      slot,
      "profile-favorite-cover"
    );

    assert.ok(
      image,
      "Falta la imagen de portada"
    );

    assert.equal(
      typeof image.listeners.error,
      "function",
      "Falta gestionar el error de carga"
    );

    image.listeners.error();

    assert.equal(image.hidden, true);

    assert.equal(
      byClass(
        slot,
        "profile-favorite-slot-title"
      )?.textContent,
      "Libro con portada rota"
    );
  }
);

test(
  "UX-04 CSS: tarjetas, proporcion, responsive y dark",
  () => {
    const slotsRule = cssSource.match(
      /\.profile-favorites-slots\s*\{([^}]*)\}/
    )?.[1] || "";

    assert.match(
      slotsRule,
      /grid-template-columns\s*:/
    );

    assert.match(
      cssSource,
      /\.profile-favorite-cover-frame\s*\{[^}]*aspect-ratio\s*:\s*2\s*\/\s*3/s
    );

    assert.match(
      cssSource,
      /\.profile-favorite-cover\s*\{[^}]*object-fit\s*:\s*contain/s
    );

    assert.match(
      cssSource,
      /body\.dark-theme\s+\.profile-favorite-slot/
    );

    assert.match(
      cssSource,
      /@media\s*\(max-width:\s*\d+px\)[\s\S]*?\.profile-favorites-slots/
    );
  }
);
