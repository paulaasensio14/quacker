import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(
  new URL(
    "../../assets/js/app/community-profile.js",
    import.meta.url
  ),
  "utf8"
);

class FakeElement {
  constructor(tag = "div") {
    this.tag = tag;
    this.hidden = true;
    this.disabled = false;
    this.textContent = "";
    this.children = [];
    this.handlers = {};
    this.attributes = {};
    this.dataset = {};
    this.src = "";
    this.alt = "";
    this.isConnected = true;

    this.classList = {
      contains: () => false
    };
  }

  set innerHTML(_) {
    throw new Error(
      "No se permite insertar HTML sin sanitizar."
    );
  }

  append(...children) {
    this.children.push(...children);
  }

  replaceChildren(...children) {
    this.children = [...children];
  }

  addEventListener(type, handler) {
    (this.handlers[type] ||= []).push(handler);
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  focus() {}

  click() {
    return (this.handlers.click || []).map(
      (handler) => handler()
    );
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
    "communityProfileActions",
    "communityProfileFollowAction",
    "communityProfileBlockAction",
    "communityProfileBlocked",
    "communityProfileBlockedBack",
    "communityProfileSocialStatus",
    "communitySearchInput",
    "view-community-profile"
  ];

  for (const name of [
    "Favorites",
    "Stats",
    "Lists",
    "Reviews",
    "Activity"
  ]) {
    ids.push(
      `communityProfile${name}`,
      `communityProfile${name}Content`
    );
  }

  const elements = Object.fromEntries(
    ids.map((id) => [
      `#${id}`,
      new FakeElement()
    ])
  );

  const listeners = {};
  const profileRequests = [];
  const followRequests = [];
  const blockRequests = [];
  const navigation = [];
  let confirmResult = true;
  let confirmCount = 0;

  const messages = {
    community_follow_follow: "Seguir",
    community_follow_request: "Solicitar seguir",
    community_follow_requested: "Solicitud enviada",
    community_follow_unfollow: "Dejar de seguir",
    community_follow_self: "Tu perfil",
    community_follow_error:
      "No se pudo actualizar el seguimiento.",
    community_follow_busy:
      "Actualizando seguimiento...",
    community_block_error: "No se pudo bloquear al usuario.",
    community_block_success: "Usuario bloqueado correctamente."
  };

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
      navigation.push(viewId);

      for (const callback of (
        listeners["quacker:view-change"] || []
      )) {
        callback({
          detail: { viewId }
        });
      }
    }
  };

  function deferred() {
    let resolve;
    let reject;

    const promise = new Promise((a, b) => {
      resolve = a;
      reject = b;
    });

    return { promise, resolve, reject };
  }

  const ApiClient = {
    getCommunityProfile(username, options) {
      const request = {
        username,
        options,
        ...deferred()
      };

      profileRequests.push(request);
      return request.promise;
    },

    updateCommunityFollowing(username, action) {
      const request = {
        username,
        action,
        ...deferred()
      };

      followRequests.push(request);
      return request.promise;
    },

    blockCommunityUser(username) {
      const request = {
        username,
        ...deferred()
      };
      blockRequests.push(request);
      return request.promise;
    }
  };

  const window = {
    confirm() {
      confirmCount += 1;
      return confirmResult;
    },
    I18n: {
      t(key) {
        return messages[key] || key;
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
    },
    { filename: "community-profile.js" }
  );

  const module = window.CommunityProfileModule;
  module.init();

  return {
    module,
    elements,
    profileRequests,
    followRequests,
    blockRequests,
    navigation,
    button: elements["#communityProfileFollowAction"],
    blockButton: elements["#communityProfileBlockAction"],
    blockedPanel: elements["#communityProfileBlocked"],
    actions: elements["#communityProfileActions"],
    status: elements["#communityProfileSocialStatus"],

    setConfirmation(value) {
      confirmResult = value;
    },

    confirmationCount() {
      return confirmCount;
    },

    navigate(viewId) {
      Router.showView(viewId);
    },

    async tick() {
      await new Promise(
        (resolve) => setImmediate(resolve)
      );
    },

    async load(username, state = "none", access = "full") {
      module.open(username);

      profileRequests.at(-1).resolve(
        profileData(username, state, access)
      );

      await this.tick();
    }
  };
}

function profileData(
  username = "alba",
  state = "none",
  access = "full"
) {
  return {
    profile: {
      username,
      name: username,
      avatar: "",
      ...(access === "full" ? { bio: "" } : {})
    },
    viewer: {
      state,
      access,
      followsViewer: false
    },
    ...(access === "full"
      ? {
          social: {
            followersCount: 3,
            followingCount: 2
          }
        }
      : {})
  };
}

test(
  "QA-012 seguimiento funcional: estados del botón",
  async () => {
    const cases = [
      ["none", "full", "Seguir", false],
      [
        "none",
        "restricted",
        "Solicitar seguir",
        false
      ],
      [
        "requested",
        "restricted",
        "Solicitud enviada",
        true
      ],
      [
        "following",
        "full",
        "Dejar de seguir",
        false
      ],
      ["friend", "full", "Dejar de seguir", false],
      ["self", "full", "Tu perfil", true]
    ];

    for (const [
      state, access, label, disabled
    ] of cases) {
      const h = createHarness();

      await h.load("alba", state, access);

      assert.equal(
        h.actions.hidden,
        false,
        `Acciones ocultas para ${state}`
      );

      assert.equal(
        h.button.textContent,
        label
      );

      assert.equal(
        h.button.disabled,
        disabled
      );
    }
  }
);

test(
  "QA-012 seguimiento funcional: 201 actualiza seguimiento",
  async () => {
    const h = createHarness();

    await h.load("alba");

    const operation = h.button.click()[0];

    assert.equal(h.followRequests.length, 1);
    assert.equal(h.followRequests[0].username, "alba");
    assert.equal(h.followRequests[0].action, "follow");
    assert.equal(h.button.disabled, true);

    h.followRequests[0].resolve({
      following: true,
      requested: false
    });

    await h.tick();

    assert.equal(
      h.profileRequests.length,
      2,
      "Debe recargar el estado desde el servidor"
    );

    h.profileRequests[1].resolve(
      profileData("alba", "following")
    );

    await operation;

    assert.equal(
      h.button.textContent,
      "Dejar de seguir"
    );

    assert.equal(h.button.disabled, false);
  }
);

test(
  "QA-012 seguimiento funcional: 202 crea solicitud pendiente",
  async () => {
    const h = createHarness();

    await h.load("alba", "none", "restricted");

    const operation = h.button.click()[0];

    h.followRequests[0].resolve({
      following: false,
      requested: true
    });

    await h.tick();

    assert.equal(h.profileRequests.length, 2);

    h.profileRequests[1].resolve(
      profileData("alba", "requested", "restricted")
    );

    await operation;

    assert.equal(
      h.button.textContent,
      "Solicitud enviada"
    );

    assert.equal(h.button.disabled, true);

    h.button.click();

    assert.equal(h.followRequests.length, 1);
  }
);

test(
  "QA-012 seguimiento funcional: dejar de seguir",
  async () => {
    const h = createHarness();

    await h.load("alba", "following");

    const operation = h.button.click()[0];

    assert.equal(
      h.followRequests[0].action,
      "unfollow"
    );

    h.followRequests[0].resolve({
      following: false,
      requested: false
    });

    await h.tick();

    h.profileRequests[1].resolve(
      profileData("alba", "none")
    );

    await operation;

    assert.equal(h.button.textContent, "Seguir");
    assert.equal(h.button.disabled, false);
  }
);

test(
  "QA-012 seguimiento funcional: doble clic no duplica operaciones",
  async () => {
    const h = createHarness();

    await h.load("alba");

    const operation = h.button.click()[0];

    h.button.click();

    assert.equal(h.followRequests.length, 1);
    assert.equal(h.button.disabled, true);

    h.followRequests[0].reject(
      Object.assign(
        new Error("limit"),
        { status: 429 }
      )
    );

    await operation;

    assert.equal(h.followRequests.length, 1);
  }
);

test(
  "QA-012 seguimiento funcional: error 409 conserva estado",
  async () => {
    const h = createHarness();

    await h.load("alba");

    const operation = h.button.click()[0];

    h.followRequests[0].reject(
      Object.assign(
        new Error("already_following"),
        { status: 409 }
      )
    );

    await operation;

    assert.equal(h.profileRequests.length, 1);

    assert.equal(
      h.button.textContent,
      "Seguir"
    );

    assert.equal(h.button.disabled, false);

    assert.match(
      h.status.textContent,
      /No se pudo actualizar/
    );
  }
);

test(
  "QA-012 seguimiento funcional: error 429 no altera seguimiento",
  async () => {
    const h = createHarness();

    await h.load("alba", "following");

    const operation = h.button.click()[0];

    h.followRequests[0].reject(
      Object.assign(
        new Error("rate_limited"),
        { status: 429 }
      )
    );

    await operation;

    assert.equal(h.profileRequests.length, 1);

    assert.equal(
      h.button.textContent,
      "Dejar de seguir"
    );

    assert.equal(h.button.disabled, false);

    assert.match(
      h.status.textContent,
      /No se pudo actualizar/
    );
  }
);

test(
  "QA-012 seguimiento funcional: respuesta inválida no se considera éxito",
  async () => {
    const h = createHarness();

    await h.load("alba");

    const operation = h.button.click()[0];

    h.followRequests[0].resolve({
      following: false,
      requested: false
    });

    await operation;

    assert.equal(h.profileRequests.length, 1);
    assert.equal(h.button.textContent, "Seguir");

    assert.match(
      h.status.textContent,
      /No se pudo actualizar/
    );
  }
);

test(
  "QA-012 seguimiento funcional: operación antigua no cambia otro perfil",
  async () => {
    const h = createHarness();

    await h.load("alba");

    const operation = h.button.click()[0];

    h.module.open("carlos");

    h.profileRequests[1].resolve(
      profileData("carlos", "none")
    );

    await h.tick();

    h.followRequests[0].resolve({
      following: true,
      requested: false
    });

    await operation;

    assert.equal(
      h.elements["#communityProfileUsername"].textContent,
      "@carlos"
    );

    assert.equal(h.button.textContent, "Seguir");
    assert.equal(h.button.disabled, false);
    assert.equal(h.profileRequests.length, 2);
  }
);

test(
  "QA-012 seguimiento funcional: salir no reactiva una operación pendiente",
  async () => {
    const h = createHarness();

    await h.load("alba");

    const operation = h.button.click()[0];

    h.navigate("home");

    h.followRequests[0].resolve({
      following: true,
      requested: false
    });

    await operation;

    assert.equal(
      h.navigation.at(-1),
      "home"
    );

    assert.equal(
      h.profileRequests.length,
      1,
      "No debe recargar un perfil abandonado"
    );
  }
);

test("QA-012 bloqueo funcional: cancelar no envía petición", async () => {
  const h = createHarness();
  await h.load("alba");
  h.setConfirmation(false);

  await h.blockButton.click()[0];

  assert.equal(h.confirmationCount(), 1);
  assert.equal(h.blockRequests.length, 0);
  assert.equal(h.elements["#communityProfileContent"].hidden, false);
  assert.equal(h.blockButton.disabled, false);
});

test("QA-012 bloqueo funcional: confirmar solo envía una petición", async () => {
  const h = createHarness();
  await h.load("alba");

  const operation = h.blockButton.click()[0];
  h.blockButton.click();

  assert.equal(h.blockRequests.length, 1);
  assert.equal(h.blockRequests[0].username, "alba");
  assert.equal(h.blockButton.disabled, true);
  assert.equal(h.button.disabled, true);

  h.blockRequests[0].reject(new Error("network"));
  await operation;
});

test("QA-012 bloqueo funcional: éxito oculta el perfil", async () => {
  const h = createHarness();
  await h.load("alba", "following");

  const operation = h.blockButton.click()[0];
  h.blockRequests[0].resolve({ blocked: true, username: "alba" });
  await operation;

  assert.equal(h.elements["#communityProfileContent"].hidden, true);
  assert.equal(h.actions.hidden, true);
  assert.equal(h.blockButton.hidden, true);
  assert.equal(h.blockedPanel.hidden, false);
  assert.equal(h.followRequests.length, 0);
});

test("QA-012 bloqueo funcional: error conserva el perfil", async () => {
  const h = createHarness();
  await h.load("alba");

  const operation = h.blockButton.click()[0];
  h.blockRequests[0].reject(Object.assign(new Error("limit"), { status: 429 }));
  await operation;

  assert.equal(h.elements["#communityProfileContent"].hidden, false);
  assert.equal(h.blockedPanel.hidden, true);
  assert.equal(h.blockButton.disabled, false);
  assert.match(h.status.textContent, /No se pudo bloquear/);
});

test("QA-012 bloqueo funcional: respuesta antigua no altera otro perfil", async () => {
  const h = createHarness();
  await h.load("alba");

  const operation = h.blockButton.click()[0];
  h.module.open("carlos");
  h.profileRequests[1].resolve(profileData("carlos"));
  await h.tick();

  h.blockRequests[0].resolve({ blocked: true, username: "alba" });
  await operation;

  assert.equal(h.elements["#communityProfileUsername"].textContent, "@carlos");
  assert.equal(h.elements["#communityProfileContent"].hidden, false);
  assert.equal(h.blockedPanel.hidden, true);
  assert.equal(h.blockButton.disabled, false);
});
