import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const html = fs.readFileSync(
  new URL("../../dashboard.html", import.meta.url),
  "utf8"
);

const source = fs.readFileSync(
  new URL(
    "../../assets/js/app/community-profile.js",
    import.meta.url
  ),
  "utf8"
);

const categories = [
  "Favorites",
  "Stats",
  "Lists",
  "Reviews",
  "Activity"
];

const requiredIds = categories.flatMap((name) => [
  `communityProfile${name}`,
  `communityProfile${name}Content`
]);

const missingIds = requiredIds.filter(
  (id) => !html.includes(`id="${id}"`)
);

const hasContentLayout = missingIds.length === 0;

class FakeElement {
  constructor(tag = "div") {
    this.tag = tag;
    this.hidden = true;
    this.textContent = "";
    this.children = [];
    this.className = "";
    this.dataset = {};
    this.src = "";
    this.alt = "";
    this.handlers = {};
    this.isConnected = true;

    this.classList = {
      contains: () => false
    };
  }

  set innerHTML(_) {
    throw new Error(
      "No está permitido insertar HTML sin sanitizar."
    );
  }

  append(...nodes) {
    this.children.push(...nodes);
  }

  replaceChildren(...nodes) {
    this.children = [...nodes];
  }

  addEventListener(type, callback) {
    (this.handlers[type] ||= []).push(callback);
  }

  setAttribute(name, value) {
    this[name] = String(value);
  }

  focus() {
    this.focused = true;
  }

  click() {
    for (const callback of this.handlers.click || []) {
      callback();
    }
  }
}

function createHarness() {
  const ids = [
    "communityProfileBack",
    "communityProfileStatus",
    "communityProfileContent",
    "communityProfileName",
    "communityProfileUsername",
    "communityProfileAvatar",
    "communityProfileBio",
    "communityProfileBioSection",
    "communityProfileSocial",
    "communityProfileFollowers",
    "communityProfileFollowing",
    "communityProfileRestricted",
    "communitySearchInput",
    "view-community-profile",
    ...requiredIds
  ];

  const elements = Object.fromEntries(
    ids.map((id) => [
      `#${id}`,
      new FakeElement()
    ])
  );

  const listeners = {};
  const requests = [];

  const favoriteTabs = [
    ["pelicula", "communityFavoriteTabPelicula"],
    ["serie", "communityFavoriteTabSerie"],
    ["game", "communityFavoriteTabGame"],
    ["book", "communityFavoriteTabBook"]
  ].map(([type, id]) => {
    const tab = new FakeElement("button");
    tab.id = id;
    tab.dataset.communityFavoriteTab = type;
    return tab;
  });

  const document = {
    querySelector(selector) {
      return elements[selector] || null;
    },

    querySelectorAll(selector) {
      return selector ===
        "[data-community-favorite-tab]"
          ? favoriteTabs
          : [];
    },

    createElement(tag) {
      return new FakeElement(tag);
    },

    addEventListener(type, callback) {
      (listeners[type] ||= []).push(callback);
    }
  };

  const Router = {
    showView(viewId) {
      for (const callback of (
        listeners["quacker:view-change"] || []
      )) {
        callback({
          detail: { viewId }
        });
      }
    }
  };

  const ApiClient = {
    getCommunityProfile(username) {
      let resolve;
      let reject;

      const promise = new Promise((a, b) => {
        resolve = a;
        reject = b;
      });

      requests.push({
        username,
        resolve,
        reject
      });

      return promise;
    }
  };

  const window = {
    I18n: {
      t(key) {
        return key;
      }
    }
  };

  vm.runInNewContext(
    source,
    {
      document,
      Router,
      ApiClient,
      window,
      AbortController
    }
  );

  const module = window.CommunityProfileModule;

  module.init();

  return {
    module,
    elements,
    requests,
    favoriteTabs,

    async tick() {
      await new Promise(
        (resolve) => setImmediate(resolve)
      );
    }
  };
}

function publicData(username = "alba") {
  return {
    profile: {
      username,
      name: "Alba",
      bio: "Mi biblioteca cultural",
      avatar: ""
    },
    viewer: {
      access: "full",
      state: "none"
    },
    social: {
      followersCount: 2,
      followingCount: 1
    },
    favorites: {
      pelicula: [{
        itemSnapshot: {
          title: "Película favorita",
          cover: ""
        }
      }]
    },
    stats: {
      totalItems: 2,
      completedCount: 1,
      inProgressCount: 1,
      notStartedCount: 0,
      byType: {
        pelicula: 1,
        serie: 1,
        game: 0,
        book: 0
      }
    },
    lists: [{
      name: "Lista pública",
      description: "Mis recomendaciones",
      items: [{
        itemSnapshot: {
          title: "Una película"
        }
      }]
    }],
    reviews: [{
      itemSnapshot: {
        title: "Película reseñada"
      },
      rating: 5,
      review: {
        text: "Una reseña visible",
        spoiler: false
      },
      tags: ["highly_recommended"]
    }],
    activity: [{
      type: "completed",
      itemSnapshot: {
        title: "Serie completada"
      },
      minutes: 60,
      payload: {
        season: 1,
        episode: 8
      }
    }]
  };
}

function allText(node) {
  return [
    String(node?.textContent || ""),
    ...(node?.children || []).map(allText)
  ].join(" ");
}

test(
  "QA-012 contenido: existen cinco secciones diferenciadas",
  () => {
    assert.deepEqual(
      missingIds,
      [],
      "Faltan secciones de contenido público: " +
        missingIds.join(", ")
    );
  }
);

test(
  "QA-012 contenido: muestra las cinco categorías autorizadas",
  { skip: !hasContentLayout },
  async () => {
    const h = createHarness();

    h.module.open("alba");

    h.requests[0].resolve(publicData());
    await h.tick();

    const expectations = {
      Favorites: "Película favorita",
      Stats: "2",
      Lists: "Lista pública",
      Reviews: "Película reseñada",
      Activity: "Serie completada"
    };

    for (const [name, expected] of Object.entries(
      expectations
    )) {
      const section =
        h.elements[`#communityProfile${name}`];

      const content =
        h.elements[`#communityProfile${name}Content`];

      assert.equal(
        section.hidden,
        false,
        `${name} debe aparecer`
      );

      assert.ok(
        allText(content).includes(expected),
        `${name} debe representar datos públicos`
      );
    }
  }
);

test(
  "QA-012 contenido: permisos individuales ocultan secciones omitidas",
  { skip: !hasContentLayout },
  async () => {
    const h = createHarness();

    h.module.open("alba");

    const data = publicData();

    delete data.lists;
    delete data.reviews;
    delete data.activity;

    h.requests[0].resolve(data);
    await h.tick();

    for (const name of [
      "Lists",
      "Reviews",
      "Activity"
    ]) {
      assert.equal(
        h.elements[
          `#communityProfile${name}`
        ].hidden,
        true,
        `${name} no debe mostrarse`
      );
    }

    for (const name of [
      "Favorites",
      "Stats"
    ]) {
      assert.equal(
        h.elements[
          `#communityProfile${name}`
        ].hidden,
        false
      );
    }
  }
);

test(
  "QA-012 contenido: cambiar de perfil elimina datos anteriores",
  { skip: !hasContentLayout },
  async () => {
    const h = createHarness();

    h.module.open("alba");
    h.requests[0].resolve(publicData());
    await h.tick();

    h.module.open("carlos");

    const next = publicData("carlos");

    for (const field of [
      "favorites",
      "stats",
      "lists",
      "reviews",
      "activity"
    ]) {
      delete next[field];
    }

    h.requests[1].resolve(next);
    await h.tick();

    for (const name of categories) {
      const section =
        h.elements[`#communityProfile${name}`];

      const content =
        h.elements[
          `#communityProfile${name}Content`
        ];

      assert.equal(section.hidden, true);

      assert.equal(
        content.children.length,
        0,
        `${name} conserva elementos del perfil anterior`
      );
    }
  }
);

test(
  "QA-012 contenido: perfil restringido nunca enseña categorías privadas",
  { skip: !hasContentLayout },
  async () => {
    const h = createHarness();

    h.module.open("alba");

    const data = publicData();

    data.viewer.access = "restricted";
    delete data.profile.bio;

    // Incluso si una respuesta anómala incluyese
    // campos adicionales, fallamos de forma cerrada.
    h.requests[0].resolve(data);
    await h.tick();

    for (const name of categories) {
      assert.equal(
        h.elements[
          `#communityProfile${name}`
        ].hidden,
        true,
        `${name} no debe aparecer sin acceso`
      );
    }
  }
);

test(
  "QA-012 contenido: texto seguro y spoilers protegidos",
  { skip: !hasContentLayout },
  async () => {
    const h = createHarness();

    h.module.open("alba");

    const data = publicData();

    data.lists[0].name =
      '<img src=x onerror=alert(1)>';

    data.reviews[0].review.spoiler = true;

    data.reviews[0].review.text =
      "REVELACION_DEL_FINAL";

    data.favorites.pelicula[0].itemSnapshot.cover =
      "javascript:alert(1)";

    h.requests[0].resolve(data);
    await h.tick();

    const listContent =
      h.elements["#communityProfileListsContent"];

    assert.ok(
      allText(listContent).includes(
        '<img src=x onerror=alert(1)>'
      ),
      "El texto debe conservarse sin interpretarlo como HTML"
    );

    const reviewContent =
      h.elements["#communityProfileReviewsContent"];

    assert.equal(
      allText(reviewContent).includes(
        "REVELACION_DEL_FINAL"
      ),
      false,
      "Un spoiler no debe revelarse antes de una acción"
    );

    const favorites =
      h.elements["#communityProfileFavoritesContent"];

    function hasUnsafeImage(node) {
      if (
        node.tag === "img" &&
        String(node.src).startsWith("javascript:")
      ) {
        return true;
      }

      return node.children.some(hasUnsafeImage);
    }

    assert.equal(
      hasUnsafeImage(favorites),
      false,
      "No se permiten URLs ejecutables en imágenes"
    );
  }
);


function favoritesForTabs() {
  const entries = [
    ["pelicula", "Película de prueba"],
    ["serie", "Serie de prueba"],
    ["game", "Juego de prueba"],
    ["book", "Libro de prueba"]
  ];

  return Object.fromEntries(
    entries.map(([type, title]) => [
      type,
      [{
        itemSnapshot: {
          title,
          cover: ""
        }
      }]
    ])
  );
}

async function loadFavoritesHarness() {
  const h = createHarness();
  const data = publicData();

  data.favorites = favoritesForTabs();

  h.module.open("alba");
  h.requests[0].resolve(data);

  await h.tick();

  return h;
}

function favoritesText(h) {
  return allText(
    h.elements[
      "#communityProfileFavoritesContent"
    ]
  );
}

function pressFavoriteKey(tab, key) {
  const handler = tab.handlers.keydown?.[0];

  assert.equal(
    typeof handler,
    "function",
    "Falta manejador de teclado"
  );

  let prevented = false;

  handler({
    currentTarget: tab,
    key,
    preventDefault() {
      prevented = true;
    }
  });

  assert.equal(
    prevented,
    true,
    `Debe gestionar ${key}`
  );
}

test(
  "QK-929-BEH: Películas aparece inicialmente",
  async () => {
    const h = await loadFavoritesHarness();

    assert.match(
      favoritesText(h),
      /Película de prueba/
    );

    assert.doesNotMatch(
      favoritesText(h),
      /Serie de prueba/
    );

    assert.equal(
      h.favoriteTabs[0]["aria-selected"],
      "true"
    );

    assert.equal(
      h.favoriteTabs[1]["aria-selected"],
      "false"
    );

    assert.equal(
      h.elements[
        "#communityProfileFavoritesContent"
      ]["aria-labelledby"],
      "communityFavoriteTabPelicula"
    );
  }
);

test(
  "QK-929-BEH: cambiar categoría cambia las portadas",
  async () => {
    const h = await loadFavoritesHarness();

    const examples = [
      ["serie", "Serie de prueba"],
      ["game", "Juego de prueba"],
      ["book", "Libro de prueba"],
      ["pelicula", "Película de prueba"]
    ];

    for (const [type, title] of examples) {
      const tab = h.favoriteTabs.find(
        (candidate) =>
          candidate.dataset.communityFavoriteTab ===
          type
      );

      tab.click();

      assert.ok(
        favoritesText(h).includes(title),
        `${type} debe mostrar sus favoritos`
      );

      assert.equal(
        tab["aria-selected"],
        "true"
      );
    }

    assert.equal(
      h.requests.length,
      1,
      "Cambiar pestaña no debe consultar otra vez la API"
    );
  }
);

test(
  "QK-929-BEH: flechas navegan y conservan foco",
  async () => {
    const h = await loadFavoritesHarness();

    pressFavoriteKey(
      h.favoriteTabs[0],
      "ArrowRight"
    );

    assert.match(
      favoritesText(h),
      /Serie de prueba/
    );

    assert.equal(
      h.favoriteTabs[1].focused,
      true
    );

    pressFavoriteKey(
      h.favoriteTabs[1],
      "ArrowRight"
    );

    assert.match(
      favoritesText(h),
      /Juego de prueba/
    );

    pressFavoriteKey(
      h.favoriteTabs[2],
      "ArrowRight"
    );

    assert.match(
      favoritesText(h),
      /Libro de prueba/
    );

    pressFavoriteKey(
      h.favoriteTabs[3],
      "ArrowRight"
    );

    assert.match(
      favoritesText(h),
      /Película de prueba/
    );

    pressFavoriteKey(
      h.favoriteTabs[0],
      "ArrowLeft"
    );

    assert.match(
      favoritesText(h),
      /Libro de prueba/
    );
  }
);

test(
  "QK-929-BEH: Inicio y Fin seleccionan extremos",
  async () => {
    const h = await loadFavoritesHarness();

    pressFavoriteKey(
      h.favoriteTabs[0],
      "End"
    );

    assert.match(
      favoritesText(h),
      /Libro de prueba/
    );

    pressFavoriteKey(
      h.favoriteTabs[3],
      "Home"
    );

    assert.match(
      favoritesText(h),
      /Película de prueba/
    );
  }
);

test(
  "QK-929-BEH: otro perfil restablece categoría",
  async () => {
    const h = await loadFavoritesHarness();

    h.favoriteTabs[1].click();

    assert.match(
      favoritesText(h),
      /Serie de prueba/
    );

    h.module.open("carlos");

    h.requests[1].resolve(
      publicData("carlos")
    );

    await h.tick();

    assert.match(
      favoritesText(h),
      /Película favorita/
    );

    assert.doesNotMatch(
      favoritesText(h),
      /Serie de prueba/
    );

    assert.equal(
      h.favoriteTabs[0]["aria-selected"],
      "true"
    );
  }
);

test(
  "QK-929-BEH: perfil restringido no filtra favoritos",
  async () => {
    const h = await loadFavoritesHarness();

    h.favoriteTabs[1].click();

    h.module.open("carlos");

    const restricted = publicData("carlos");

    restricted.viewer.access = "restricted";
    delete restricted.profile.bio;

    h.requests[1].resolve(restricted);

    await h.tick();

    const section = h.elements[
      "#communityProfileFavorites"
    ];

    const host = h.elements[
      "#communityProfileFavoritesContent"
    ];

    assert.equal(section.hidden, true);
    assert.equal(host.children.length, 0);

    h.favoriteTabs[2].click();

    assert.equal(host.children.length, 0);
  }
);

test(
  "QK-929-BEH: limita portadas a cuatro",
  async () => {
    const h = createHarness();
    const data = publicData();

    data.favorites.pelicula =
      Array.from({ length: 6 }, (_, index) => ({
        itemSnapshot: {
          title: `Favorito ${index + 1}`,
          cover: ""
        }
      }));

    h.module.open("alba");
    h.requests[0].resolve(data);

    await h.tick();

    const host = h.elements[
      "#communityProfileFavoritesContent"
    ];

    assert.equal(
      host.children[0].children.length,
      4
    );
  }
);
