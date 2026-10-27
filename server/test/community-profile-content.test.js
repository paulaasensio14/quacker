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

  focus() {}

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

  const document = {
    querySelector(selector) {
      return elements[selector] || null;
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
