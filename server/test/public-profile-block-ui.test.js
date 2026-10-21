import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const script = fs.readFileSync(
  new URL("../../assets/js/app/public-profile.js", import.meta.url),
  "utf8"
);

const i18nSource = fs.readFileSync(
  new URL("../../assets/js/app/i18n.js", import.meta.url),
  "utf8"
);

const html = fs.readFileSync(
  new URL("../../public-profile.html", import.meta.url),
  "utf8"
);

const css = fs.readFileSync(
  new URL("../../assets/css/public-profile.css", import.meta.url),
  "utf8"
);

function createHarness({
  viewer = { state: "none", access: "full" },
  confirmed = true,
  responseStatus = 201,
  networkError = false,
  language = "es"
} = {}) {
  const calls = [];
  const confirmations = [];

  function element(hidden = false) {
    return {
      hidden,
      disabled: false,
      dataset: {},
      textContent: "",
      handlers: {},
      addEventListener(type, handler) {
        this.handlers[type] = handler;
      },
      focus() {
        this.focused = true;
      }
    };
  }

  const elements = {};

  for (const id of [
    "publicProfileSocial",
    "publicProfileSocialAction",
    "publicProfileBlockAction",
    "publicProfileAccessNote",
    "publicProfileContent",
    "publicProfileLoading",
    "publicProfileError",
    "publicProfileBlocked",
    "publicProfileBlockedTitle",
    "publicProfileAvatar",
    "publicProfileName",
    "publicProfileUsername",
    "publicProfileBio"
  ]) {
    elements[`#${id}`] = element();
  }

  elements["#publicProfileBlockAction"].hidden = true;

  elements["#publicProfileBlockAction"].dataset.i18n =
    "public_block_button";

  elements["#publicProfileBlockedTitle"].dataset.i18n =
    "public_block_done_title";
  elements["#publicProfileContent"].hidden = true;
  elements["#publicProfileBlocked"].hidden = true;

  const documentHandlers = {};

  const document = {
    title: "",
    documentElement: {
      lang: "es"
    },
    querySelector(selector) {
      return elements[selector] || null;
    },
    querySelectorAll(selector) {
      if (selector === "[data-i18n]") {
        return Object.values(elements).filter(
          (element) => element.dataset.i18n
        );
      }
      return [];
    },
    addEventListener(type, handler) {
      documentHandlers[type] = handler;
    }
  };

  const window = {
    location: {
      pathname: "/u/blocks_bob"
    },
    confirm(message) {
      confirmations.push(message);
      return confirmed;
    }
  };

  async function fetchMock(url, options = {}) {
    calls.push({ url, options });

    if (url.startsWith("/api/public/users/")) {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            profile: {
              name: "Bob",
              username: "blocks_bob",
              bio: ""
            },
            viewer
          };
        }
      };
    }

    if (networkError) {
      throw new Error("network_error");
    }

    return {
      ok: responseStatus >= 200 && responseStatus < 300,
      status: responseStatus,
      headers: {
        get(name) {
          return name.toLowerCase() === "retry-after"
            ? "42"
            : null;
        }
      }
    };
  }

  const context = {
    document,
    window,
    fetch: fetchMock,
    console,
    localStorage: {
      getItem() {
        return language;
      },
      setItem() {}
    }
  };

  vm.runInNewContext(
    i18nSource,
    context,
    { filename: "i18n.js" }
  );

  vm.runInNewContext(
    script,
    context,
    { filename: "public-profile.js" }
  );

  return {
    elements,
    calls,
    confirmations,
    async initialize() {
      documentHandlers.DOMContentLoaded();
      await new Promise(setImmediate);
    },
    async clickBlock() {
      return elements[
        "#publicProfileBlockAction"
      ].handlers.click();
    },
    blockRequests() {
      return calls.filter(
        (call) => call.url.includes("/api/user/blocks/")
      );
    }
  };
}

test("el perfil incluye el botón y la confirmación", () => {
  assert.match(
    html,
    /id="publicProfileBlockAction"/
  );
  assert.match(
    html,
    /id="publicProfileBlocked"/
  );
  assert.match(
    css,
    /\.public-profile-block-action\[hidden\]\s*\{\s*display:\s*none;/
  );
});

test("el bloqueo se oculta en perfiles anónimos y propios", async () => {
  for (const viewer of [
    null,
    { state: "self" }
  ]) {
    const harness = createHarness({ viewer });
    await harness.initialize();

    assert.equal(
      harness.elements["#publicProfileBlockAction"].hidden,
      true
    );
  }
});

test("el bloqueo aparece en el perfil de otro usuario", async () => {
  const harness = createHarness();
  await harness.initialize();

  assert.equal(
    harness.elements["#publicProfileBlockAction"].hidden,
    false
  );
});

test("cancelar la confirmación no envía el bloqueo", async () => {
  const harness = createHarness({
    confirmed: false
  });

  await harness.initialize();
  await harness.clickBlock();

  assert.equal(harness.confirmations.length, 1);
  assert.equal(harness.blockRequests().length, 0);
  assert.equal(
    harness.elements["#publicProfileContent"].hidden,
    false
  );
});

test("bloquear por HTTP muestra la pantalla de confirmación", async () => {
  const harness = createHarness();
  await harness.initialize();
  await harness.clickBlock();

  const requests = harness.blockRequests();

  assert.equal(requests.length, 1);
  assert.equal(
    requests[0].url,
    "/api/user/blocks/blocks_bob"
  );
  assert.equal(requests[0].options.method, "POST");
  assert.equal(
    requests[0].options.credentials,
    "same-origin"
  );
  assert.equal(
    harness.elements["#publicProfileContent"].hidden,
    true
  );
  assert.equal(
    harness.elements["#publicProfileBlocked"].hidden,
    false
  );
  assert.equal(
    harness.elements["#publicProfileBlockedTitle"].focused,
    true
  );
});

test("HTTP 429 muestra el tiempo de espera y conserva el perfil", async () => {
  const harness = createHarness({
    responseStatus: 429
  });

  await harness.initialize();
  await harness.clickBlock();

  assert.equal(harness.blockRequests().length, 1);
  assert.match(
    harness.elements["#publicProfileAccessNote"].textContent,
    /42 segundos/
  );
  assert.equal(
    harness.elements["#publicProfileContent"].hidden,
    false
  );
  assert.equal(
    harness.elements["#publicProfileBlocked"].hidden,
    true
  );
});

test("HTTP 401 informa de la sesión caducada", async () => {
  const harness = createHarness({
    responseStatus: 401
  });

  await harness.initialize();
  await harness.clickBlock();

  assert.match(
    harness.elements["#publicProfileAccessNote"].textContent,
    /sesión ha caducado/
  );
});

test("un fallo de red no oculta el perfil", async () => {
  const harness = createHarness({
    networkError: true
  });

  await harness.initialize();
  await harness.clickBlock();

  assert.match(
    harness.elements["#publicProfileAccessNote"].textContent,
    /Error de conexión/
  );
  assert.equal(
    harness.elements["#publicProfileContent"].hidden,
    false
  );
});


test(
  "bloqueo público en inglés traduce botón, confirmación y éxito",
  async () => {
    const harness = createHarness({
      language: "en"
    });

    await harness.initialize();

    assert.equal(
      harness.elements["#publicProfileBlockAction"].textContent,
      "Block user"
    );

    await harness.clickBlock();

    assert.match(
      harness.confirmations[0],
      /Do you want to block @blocks_bob/
    );

    assert.equal(
      harness.elements["#publicProfileBlockedTitle"].textContent,
      "User blocked"
    );

    assert.equal(
      harness.elements["#publicProfileBlocked"].hidden,
      false
    );
  }
);

test(
  "el límite de bloqueos se informa en inglés",
  async () => {
    const harness = createHarness({
      language: "en",
      responseStatus: 429
    });

    await harness.initialize();
    await harness.clickBlock();

    assert.match(
      harness.elements["#publicProfileAccessNote"].textContent,
      /42 seconds/
    );

    assert.equal(
      harness.elements["#publicProfileBlocked"].hidden,
      true
    );
  }
);

test(
  "la página pública declara los textos traducibles",
  () => {
    for (const key of [
      "public_block_button",
      "public_block_done_title",
      "public_block_done_description",
      "public_block_done_manage",
      "public_block_done_return"
    ]) {
      assert.ok(
        html.includes(`data-i18n="${key}"`),
        `Falta la traducción HTML: ${key}`
      );
    }
  }
);
