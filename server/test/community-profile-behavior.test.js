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
  constructor() {
    this.hidden = true;
    this.textContent = "";
    this.src = "";
    this.alt = "";
    this.value = "";
    this.focused = false;
    this.isConnected = true;
    this.handlers = {};
    this.active = false;

    this.classList = {
      contains: (name) =>
        name === "is-active" && this.active
    };
  }

  focus() {
    this.focused = true;
  }

  addEventListener(type, callback) {
    (this.handlers[type] ||= []).push(callback);
  }

  click() {
    for (const callback of this.handlers.click || []) {
      callback();
    }
  }
}

function createHarness({
  initialProfileActive = false
} = {}) {
  const selectors = [
    "#communityProfileBack",
    "#communityProfileStatus",
    "#communityProfileContent",
    "#communityProfileName",
    "#communityProfileUsername",
    "#communityProfileAvatar",
    "#communityProfileBio",
    "#communityProfileBioSection",
    "#communityProfileSocial",
    "#communityProfileFollowers",
    "#communityProfileFollowing",
    "#communityProfileRestricted",
    "#communitySearchInput",
    "#communityResults",
    "#view-community-profile"
  ];

  const elements = Object.fromEntries(
    selectors.map((selector) => [
      selector,
      new FakeElement()
    ])
  );

  elements[
    "#view-community-profile"
  ].active = initialProfileActive;

  const listeners = {};
  const requests = [];
  const navigation = [];

  const translations = {
    community_profile_loading: "Cargando perfil...",
    community_profile_error:
      "No hemos podido cargar este perfil.",
    community_profile_restricted:
      "Este perfil tiene acceso restringido."
  };

  const document = {
    querySelector(selector) {
      return elements[selector] || null;
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

  const ApiClient = {
    getCommunityProfile(username, options) {
      let resolve;
      let reject;

      const promise = new Promise((a, b) => {
        resolve = a;
        reject = b;
      });

      requests.push({
        username,
        options,
        resolve,
        reject
      });

      return promise;
    }
  };

  const window = {
    I18n: {
      t(key) {
        return translations[key] || key;
      }
    }
  };

  vm.runInNewContext(
    source,
    {
      window,
      document,
      Router,
      ApiClient,
      AbortController
    },
    { filename: "community-profile.js" }
  );

  const module = window.CommunityProfileModule;

  module.init();

  return {
    module,
    elements,
    requests,
    navigation,

    navigate(viewId) {
      Router.showView(viewId);
    },

    async tick() {
      await new Promise(
        (resolve) => setImmediate(resolve)
      );
    }
  };
}

function fullProfile(username = "alba") {
  return {
    profile: {
      username,
      name: "<img onerror=alert(1)>",
      avatar: "javascript:alert(1)",
      bio: "<svg onload=alert(1)>"
    },
    viewer: {
      access: "full",
      state: "none"
    },
    social: {
      followersCount: 5,
      followingCount: 3
    }
  };
}

test(
  "QA-012 funcional: rechaza usernames inválidos",
  () => {
    const h = createHarness();

    assert.equal(
      h.module.open("../admin"),
      false
    );

    assert.equal(
      h.module.open("a"),
      false
    );

    assert.equal(h.requests.length, 0);
    assert.equal(h.navigation.length, 0);
  }
);

test(
  "QA-012 funcional: carga identidad y contenido seguros",
  async () => {
    const h = createHarness();

    assert.equal(h.module.open("@ALBA"), true);

    assert.deepEqual(
      h.navigation,
      ["community-profile"]
    );

    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].username, "alba");

    h.requests[0].resolve(fullProfile());
    await h.tick();

    assert.equal(
      h.elements["#communityProfileName"].textContent,
      "<img onerror=alert(1)>"
    );

    assert.equal(
      h.elements["#communityProfileBio"].textContent,
      "<svg onload=alert(1)>"
    );

    assert.equal(
      h.elements["#communityProfileAvatar"].src,
      "/assets/img/logo-quacker.png"
    );

    assert.equal(
      h.elements["#communityProfileContent"].hidden,
      false
    );

    assert.equal(
      h.elements["#communityProfileSocial"].hidden,
      false
    );

    assert.equal(
      h.elements["#communityProfileFollowers"].textContent,
      "5"
    );

    assert.equal(
      h.elements["#communityProfileFollowing"].textContent,
      "3"
    );
  }
);

test(
  "QA-012 funcional: un perfil restringido no publica datos privados",
  async () => {
    const h = createHarness();

    h.module.open("alba");

    h.requests[0].resolve({
      profile: {
        username: "alba",
        name: "Alba",
        avatar: ""
      },
      viewer: {
        access: "restricted",
        state: "none"
      }
    });

    await h.tick();

    assert.equal(
      h.elements["#communityProfileContent"].hidden,
      false
    );

    assert.equal(
      h.elements["#communityProfileBioSection"].hidden,
      true
    );

    assert.equal(
      h.elements["#communityProfileSocial"].hidden,
      true
    );

    assert.equal(
      h.elements["#communityProfileRestricted"].hidden,
      false
    );
  }
);

test(
  "QA-012 funcional: rechaza respuestas sin perfil válido",
  async () => {
    const h = createHarness();

    h.module.open("alba");

    h.requests[0].resolve({
      profile: {
        username: "otro",
        name: "Otro"
      }
    });

    await h.tick();

    assert.equal(
      h.elements["#communityProfileContent"].hidden,
      true
    );

    assert.match(
      h.elements["#communityProfileStatus"].textContent,
      /No hemos podido cargar/
    );
  }
);

test(
  "QA-012 funcional: error HTTP no muestra un perfil anterior",
  async () => {
    const h = createHarness();

    h.module.open("alba");

    h.requests[0].resolve(fullProfile());
    await h.tick();

    h.module.open("carlos");

    h.requests[1].reject(
      Object.assign(
        new Error("not_found"),
        { status: 404 }
      )
    );

    await h.tick();

    assert.equal(
      h.elements["#communityProfileContent"].hidden,
      true
    );

    assert.match(
      h.elements["#communityProfileStatus"].textContent,
      /No hemos podido cargar/
    );
  }
);

test(
  "QA-012 funcional: cambiar usuario cancela respuestas antiguas",
  async () => {
    const h = createHarness();

    h.module.open("alba");
    h.module.open("carlos");

    assert.equal(h.requests.length, 2);

    assert.equal(
      h.requests[0].options.signal.aborted,
      true
    );

    h.requests[1].resolve(
      fullProfile("carlos")
    );

    await h.tick();

    h.requests[0].resolve(
      fullProfile("alba")
    );

    await h.tick();

    assert.equal(
      h.elements["#communityProfileUsername"].textContent,
      "@carlos"
    );
  }
);

test(
  "QA-012 funcional: volver conserva búsqueda y foco",
  async () => {
    const h = createHarness();
    const trigger = new FakeElement();

    h.elements["#communitySearchInput"].value =
      "alba";

    h.module.open("alba", trigger);

    assert.equal(
      h.elements["#communityProfileBack"].focused,
      true
    );

    h.module.back();

    assert.equal(
      h.requests[0].options.signal.aborted,
      true
    );

    assert.equal(
      h.navigation.at(-1),
      "community"
    );

    assert.equal(trigger.focused, true);

    assert.equal(
      h.elements["#communitySearchInput"].value,
      "alba"
    );

    h.requests[0].resolve(fullProfile());
    await h.tick();

    assert.equal(
      h.elements["#communityProfileContent"].hidden,
      true
    );
  }
);

test(
  "QA-012 funcional: salir del perfil cancela la petición",
  async () => {
    const h = createHarness();

    h.module.open("alba");

    h.navigate("home");

    assert.equal(
      h.requests[0].options.signal.aborted,
      true
    );

    h.requests[0].resolve(
      fullProfile()
    );

    await h.tick();

    assert.equal(
      h.elements["#communityProfileContent"].hidden,
      true
    );
  }
);

test(
  "QA-012 funcional: acceso directo sin usuario regresa a Comunidad",
  () => {
    const h = createHarness({
      initialProfileActive: true
    });

    assert.deepEqual(
      h.navigation,
      ["community"]
    );

    assert.equal(h.requests.length, 0);
  }
);
