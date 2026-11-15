import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const entrySource = fs.readFileSync(
  new URL(
    "../../assets/js/app/list-link-invite-entry.js",
    import.meta.url
  ),
  "utf8"
);

const promptSource = fs.readFileSync(
  new URL(
    "../../assets/js/app/list-link-invite-prompt.js",
    import.meta.url
  ),
  "utf8"
);

const coreSource = fs.readFileSync(
  new URL(
    "../../assets/js/app/app-core.js",
    import.meta.url
  ),
  "utf8"
);

const tokenA = "A".repeat(43);
const tokenB = "B".repeat(43);
const storageKey = "quacker:pending-list-invite";

function makeElement(id) {
  const handlers = new Map();

  return {
    id,
    disabled: false,
    textContent: "",
    attributes: {},

    addEventListener(type, listener) {
      const existing = handlers.get(type) || [];
      existing.push(listener);
      handlers.set(type, existing);
    },

    setAttribute(name, value) {
      this.attributes[name] = value;
    },

    emit(type) {
      for (const listener of handlers.get(type) || []) {
        listener({ target: this });
      }
    },

    listenerCount(type) {
      return (handlers.get(type) || []).length;
    }
  };
}

function createHarness({ initialHash = "" } = {}) {
  const storage = new Map();
  const events = new Map();

  const state = {
    apiCalls: [],
    opens: [],
    closes: [],
    binds: [],
    cleanUrls: [],
    loads: 0
  };

  const location = {
    pathname: "/dashboard.html",
    search: "",
    hash: initialHash
  };

  const elements = Object.fromEntries(
    [
      "listLinkInviteAcceptModal",
      "btnAcceptListLinkInvite",
      "btnDeclineListLinkInvite",
      "btnCloseListLinkInvite",
      "listLinkInviteAcceptFeedback"
    ].map(id => [id, makeElement(id)])
  );

  const window = {
    location,

    history: {
      replaceState(_state, _title, url) {
        state.cleanUrls.push(url);
        const index = url.indexOf("#");
        location.hash = index < 0
          ? ""
          : url.slice(index);
      }
    },

    sessionStorage: {
      getItem(key) {
        return storage.has(key)
          ? storage.get(key)
          : null;
      },

      setItem(key, value) {
        storage.set(key, String(value));
      },

      removeItem(key) {
        storage.delete(key);
      }
    },

    addEventListener(type, listener) {
      const existing = events.get(type) || [];
      existing.push(listener);
      events.set(type, existing);
    },

    UIModal: {
      bind(id) {
        state.binds.push(id);
      },

      open(element) {
        state.opens.push(element.id);
      },

      close(element) {
        state.closes.push(element.id);
      }
    },

    I18n: {
      t(key) {
        return key;
      }
    },

    Router: {
      showView() {}
    },

    ListsModule: {
      load() {
        state.loads += 1;
        return Promise.resolve();
      }
    },

    toast() {}
  };

  const ApiClient = {
    acceptListLinkInvite(receivedToken) {
      state.apiCalls.push(receivedToken);

      return Promise.resolve({
        accepted: true,
        list: {
          id: "list-qa",
          name: "Lista de prueba"
        }
      });
    }
  };

  const document = {
    title: "Quacker",

    getElementById(id) {
      return elements[id] || null;
    }
  };

  const context = {
    window,
    document,
    ApiClient,
    console
  };

  vm.runInNewContext(entrySource, context, {
    filename: "list-link-invite-entry.js",
    timeout: 3000
  });

  vm.runInNewContext(promptSource, context, {
    filename: "list-link-invite-prompt.js",
    timeout: 3000
  });

  return {
    window,
    elements,
    state,

    entry: window.ListLinkInviteEntry,
    prompt: window.ListLinkInvitePrompt,

    navigate(token) {
      location.hash = `#list-invite=${token}`;

      for (
        const listener of events.get("hashchange") || []
      ) {
        listener();
      }
    },

    click(id) {
      elements[id].emit("click");
    },

    getPending() {
      return storage.get(storageKey) || null;
    }
  };
}

async function settle() {
  await new Promise(resolve => setImmediate(resolve));
}

test(
  "QK-184-SEC-06 HASH: captura un enlace sin recargar",
  () => {
    const h = createHarness();

    assert.equal(h.getPending(), null);

    h.navigate(tokenA);

    assert.equal(h.getPending(), tokenA);
    assert.equal(h.window.location.hash, "");

    assert.deepEqual(
      h.state.cleanUrls,
      ["/dashboard.html"]
    );

    assert.equal(h.state.apiCalls.length, 0);
  }
);

test(
  "QK-184-SEC-06 HASH: reabre tras descartar sin duplicar eventos",
  async () => {
    const h = createHarness({
      initialHash: `#list-invite=${tokenA}`
    });

    h.prompt.init();

    assert.equal(h.state.opens.length, 1);

    h.click("btnDeclineListLinkInvite");

    assert.equal(h.getPending(), null);

    // Aislamos el comportamiento de reapertura.
    h.navigate(tokenB);
    h.entry.captureFromLocation();
    h.prompt.init();

    assert.equal(h.state.opens.length, 2);
    assert.equal(h.state.binds.length, 1);

    assert.equal(
      h.elements.btnAcceptListLinkInvite
        .listenerCount("click"),
      1
    );

    assert.equal(h.state.apiCalls.length, 0);

    h.click("btnAcceptListLinkInvite");
    await settle();

    assert.deepEqual(h.state.apiCalls, [tokenB]);
    assert.equal(h.state.loads, 1);
  }
);

test(
  "QK-184-SEC-06 HASH: actualiza invitacion abierta sin aceptarla",
  async () => {
    const h = createHarness({
      initialHash: `#list-invite=${tokenA}`
    });

    h.prompt.init();

    h.navigate(tokenB);
    h.entry.captureFromLocation();
    h.prompt.init();

    assert.equal(h.state.opens.length, 1);
    assert.equal(h.state.binds.length, 1);

    assert.equal(h.state.apiCalls.length, 0);

    h.click("btnAcceptListLinkInvite");
    await settle();

    assert.deepEqual(h.state.apiCalls, [tokenB]);
  }
);

test(
  "QK-184-SEC-06 HASH: listener del dashboard tras autenticacion",
  () => {
    const authentication = coreSource.indexOf(
      "await ApiClient.getCurrentSession()"
    );

    const router = coreSource.indexOf(
      "Router.init();"
    );

    const listener = coreSource.indexOf(
      'window.addEventListener("hashchange"'
    );

    assert.ok(authentication >= 0);
    assert.ok(router > authentication);

    assert.ok(
      listener > router,
      "El listener debe instalarse después " +
      "de validar la sesión e iniciar el router"
    );

    assert.match(
      coreSource.slice(listener),
      /ListLinkInvitePrompt\?\.init\?\.\(\)/
    );
  }
);
