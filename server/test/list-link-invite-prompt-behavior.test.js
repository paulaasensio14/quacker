import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = fs.readFileSync(
  new URL(
    "../../assets/js/app/list-link-invite-prompt.js",
    import.meta.url
  ),
  "utf8"
);

const token = "A".repeat(43);
const anotherToken = "B".repeat(43);

function createDeferred() {
  let resolve;
  let reject;

  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });

  return { promise, resolve, reject };
}

function createElement(id) {
  const listeners = new Map();

  return {
    id,
    disabled: false,
    textContent: "",
    attributes: {},

    addEventListener(type, handler) {
      const items = listeners.get(type) || [];
      items.push(handler);
      listeners.set(type, items);
    },

    emit(type, event = {}) {
      for (const handler of listeners.get(type) || []) {
        handler({
          target: this,
          ...event
        });
      }
    },

    listenerCount(type) {
      return (listeners.get(type) || []).length;
    },

    setAttribute(name, value) {
      this.attributes[name] = value;
    }
  };
}

function createHarness({
  pendingToken = token,
  acceptHandler = null
} = {}) {
  let storedToken = pendingToken;

  const state = {
    apiCalls: [],
    clears: 0,
    opens: [],
    closes: [],
    binds: [],
    views: [],
    loads: 0,
    toasts: []
  };

  const ids = [
    "listLinkInviteAcceptModal",
    "btnAcceptListLinkInvite",
    "btnDeclineListLinkInvite",
    "btnCloseListLinkInvite",
    "listLinkInviteAcceptFeedback"
  ];

  const elements = Object.fromEntries(
    ids.map((id) => [
      id,
      createElement(id)
    ])
  );

  const windowListeners = new Map();

  const entry = {
    getPendingToken() {
      return storedToken;
    },

    clearPendingToken() {
      state.clears += 1;
      storedToken = null;
    }
  };

  const modalApi = {
    bind(id, options) {
      state.binds.push({ id, options });
    },

    open(element, options) {
      state.opens.push({
        id: element.id,
        options
      });
    },

    close(element) {
      state.closes.push(element.id);
    }
  };

  const window = {
    ListLinkInviteEntry: entry,
    UIModal: modalApi,

    I18n: {
      t(key) {
        return key;
      }
    },

    Router: {
      showView(view) {
        state.views.push(view);
      }
    },

    ListsModule: {
      load() {
        state.loads += 1;
        return Promise.resolve();
      }
    },

    toast(data) {
      state.toasts.push(data);
    },

    addEventListener(type, handler) {
      const items =
        windowListeners.get(type) || [];

      items.push(handler);
      windowListeners.set(type, items);
    }
  };

  const document = {
    getElementById(id) {
      return elements[id] || null;
    }
  };

  const ApiClient = {
    acceptListLinkInvite(receivedToken) {
      state.apiCalls.push(receivedToken);

      if (acceptHandler) {
        return acceptHandler(
          receivedToken,
          state.apiCalls.length
        );
      }

      return Promise.resolve({
        accepted: true,
        list: {
          id: "list-1",
          name: "Lista compartida"
        }
      });
    }
  };

  vm.runInNewContext(
    source,
    {
      window,
      document,
      ApiClient,
      console
    },
    {
      filename: "list-link-invite-prompt.js",
      timeout: 3000
    }
  );

  const prompt =
    window.ListLinkInvitePrompt;

  assert.equal(
    typeof prompt?.init,
    "function"
  );

  return {
    state,
    elements,

    init() {
      prompt.init();
    },

    click(id) {
      assert.ok(
        elements[id],
        `Control inexistente: ${id}`
      );

      elements[id].emit("click");
    },

    backdrop() {
      const modal =
        elements.listLinkInviteAcceptModal;

      modal.emit("click", {
        target: modal
      });
    },

    escape() {
      const event = {
        key: "Escape",
        prevented: false,
        stopped: false,

        preventDefault() {
          this.prevented = true;
        },

        stopImmediatePropagation() {
          this.stopped = true;
        }
      };

      for (
        const handler of
        windowListeners.get("keydown") || []
      ) {
        handler(event);
      }

      return event;
    },

    getPending() {
      return storedToken;
    },

    setPending(value) {
      storedToken = value;
    }
  };
}

async function settle() {
  await new Promise(
    resolve => setImmediate(resolve)
  );
}

function apiError(status, code) {
  const error = new Error(code);
  error.status = status;
  error.error = code;
  return error;
}

test(
  "QK-184-SEC-06 PROMPT: sin token no abre ventana",
  () => {
    const h = createHarness({
      pendingToken: null
    });

    h.init();

    assert.equal(h.state.opens.length, 0);
    assert.equal(h.state.apiCalls.length, 0);
    assert.equal(h.state.clears, 0);
  }
);

test(
  "QK-184-SEC-06 PROMPT: abre sin aceptar",
  () => {
    const h = createHarness();

    h.init();

    assert.equal(h.state.opens.length, 1);

    assert.equal(
      h.state.opens[0].id,
      "listLinkInviteAcceptModal"
    );

    assert.equal(
      h.state.binds.length,
      1
    );

    assert.equal(h.getPending(), token);
    assert.equal(h.state.apiCalls.length, 0);

    assert.equal(
      h.elements.btnAcceptListLinkInvite.disabled,
      false
    );
  }
);

test(
  "QK-184-SEC-06 PROMPT: inicializacion idempotente",
  async () => {
    const h = createHarness();

    h.init();
    h.init();

    assert.equal(h.state.opens.length, 1);

    assert.equal(
      h.elements.btnAcceptListLinkInvite
        .listenerCount("click"),
      1
    );

    h.click("btnAcceptListLinkInvite");
    await settle();

    assert.equal(h.state.apiCalls.length, 1);
  }
);

test(
  "QK-184-SEC-06 PROMPT: clic acepta y abre listas",
  async () => {
    const h = createHarness();

    h.init();

    assert.equal(h.state.apiCalls.length, 0);

    h.click("btnAcceptListLinkInvite");
    await settle();

    assert.deepEqual(
      h.state.apiCalls,
      [token]
    );

    assert.equal(h.getPending(), null);
    assert.equal(h.state.clears, 1);

    assert.deepEqual(
      h.state.closes,
      ["listLinkInviteAcceptModal"]
    );

    assert.deepEqual(
      h.state.views,
      ["lists"]
    );

    assert.equal(h.state.loads, 1);
    assert.equal(h.state.toasts.length, 1);

    assert.equal(
      h.state.toasts[0].type,
      "success"
    );
  }
);

test(
  "QK-184-SEC-06 PROMPT: bloquea doble aceptacion",
  async () => {
    const deferred = createDeferred();

    const h = createHarness({
      acceptHandler: () => deferred.promise
    });

    h.init();

    h.click("btnAcceptListLinkInvite");
    h.click("btnAcceptListLinkInvite");

    assert.equal(h.state.apiCalls.length, 1);

    assert.equal(
      h.elements.btnAcceptListLinkInvite.disabled,
      true
    );

    assert.equal(
      h.elements.btnDeclineListLinkInvite.disabled,
      true
    );

    deferred.resolve({
      accepted: true,
      list: { id: "list-1" }
    });

    await settle();

    assert.equal(h.state.apiCalls.length, 1);
    assert.equal(h.getPending(), null);
    assert.equal(h.state.closes.length, 1);
  }
);

test(
  "QK-184-SEC-06 PROMPT: descartar borra token",
  () => {
    const h = createHarness();

    h.init();
    h.click("btnDeclineListLinkInvite");

    assert.equal(h.getPending(), null);
    assert.equal(h.state.clears, 1);
    assert.equal(h.state.closes.length, 1);
    assert.equal(h.state.apiCalls.length, 0);
  }
);

test(
  "QK-184-SEC-06 PROMPT: cerrar borra token",
  () => {
    const h = createHarness();

    h.init();
    h.click("btnCloseListLinkInvite");

    assert.equal(h.getPending(), null);
    assert.equal(h.state.clears, 1);
    assert.equal(h.state.closes.length, 1);
    assert.equal(h.state.apiCalls.length, 0);
  }
);

test(
  "QK-184-SEC-06 PROMPT: backdrop descarta token",
  () => {
    const h = createHarness();

    h.init();
    h.backdrop();

    assert.equal(h.getPending(), null);
    assert.equal(h.state.clears, 1);
    assert.equal(h.state.closes.length, 1);
    assert.equal(h.state.apiCalls.length, 0);
  }
);

test(
  "QK-184-SEC-06 PROMPT: Escape descarta token",
  () => {
    const h = createHarness();

    h.init();

    const event = h.escape();

    assert.equal(event.prevented, true);
    assert.equal(event.stopped, true);

    assert.equal(h.getPending(), null);
    assert.equal(h.state.clears, 1);
    assert.equal(h.state.closes.length, 1);
    assert.equal(h.state.apiCalls.length, 0);
  }
);

test(
  "QK-184-SEC-06 PROMPT: Escape no cierra durante POST",
  async () => {
    const deferred = createDeferred();

    const h = createHarness({
      acceptHandler: () => deferred.promise
    });

    h.init();
    h.click("btnAcceptListLinkInvite");

    const event = h.escape();

    assert.equal(event.prevented, true);
    assert.equal(event.stopped, true);

    assert.equal(h.getPending(), token);
    assert.equal(h.state.closes.length, 0);
    assert.equal(h.state.apiCalls.length, 1);

    deferred.resolve({
      accepted: true,
      list: { id: "list-1" }
    });

    await settle();

    assert.equal(h.getPending(), null);
    assert.equal(h.state.closes.length, 1);
  }
);

test(
  "QK-184-SEC-06 PROMPT: error de red permite reintento",
  async () => {
    const h = createHarness({
      acceptHandler: (_token, attempt) => {
        if (attempt === 1) {
          return Promise.reject(
            apiError(0, "network_error")
          );
        }

        return Promise.resolve({
          accepted: true,
          list: { id: "list-1" }
        });
      }
    });

    h.init();
    h.click("btnAcceptListLinkInvite");

    await settle();

    assert.equal(h.getPending(), token);
    assert.equal(h.state.closes.length, 0);

    assert.equal(
      h.elements.listLinkInviteAcceptFeedback.textContent,
      "lists_collab_link_accept_error"
    );

    assert.equal(
      h.elements.listLinkInviteAcceptFeedback
        .attributes.role,
      "alert"
    );

    assert.equal(
      h.elements.btnAcceptListLinkInvite.disabled,
      false
    );

    h.click("btnAcceptListLinkInvite");

    await settle();

    assert.equal(h.state.apiCalls.length, 2);
    assert.equal(h.getPending(), null);
    assert.equal(h.state.closes.length, 1);
  }
);

test(
  "QK-184-SEC-06 PROMPT: 404 invalida el enlace",
  async () => {
    const h = createHarness({
      acceptHandler: () =>
        Promise.reject(
          apiError(404, "invite_not_found")
        )
    });

    h.init();
    h.click("btnAcceptListLinkInvite");

    await settle();

    assert.equal(h.getPending(), null);
    assert.equal(h.state.clears, 1);

    assert.equal(
      h.elements.listLinkInviteAcceptFeedback.textContent,
      "lists_collab_link_accept_invalid"
    );

    assert.equal(
      h.elements.btnAcceptListLinkInvite.disabled,
      true
    );

    h.click("btnAcceptListLinkInvite");
    await settle();

    assert.equal(h.state.apiCalls.length, 1);
  }
);

test(
  "QK-184-SEC-06 PROMPT: 409 indica miembro existente",
  async () => {
    const h = createHarness({
      acceptHandler: () =>
        Promise.reject(
          apiError(409, "already_collaborator")
        )
    });

    h.init();
    h.click("btnAcceptListLinkInvite");

    await settle();

    assert.equal(h.getPending(), null);

    assert.equal(
      h.elements.listLinkInviteAcceptFeedback.textContent,
      "lists_collab_link_accept_already"
    );

    assert.equal(
      h.elements.btnAcceptListLinkInvite.disabled,
      true
    );

    assert.equal(h.state.closes.length, 0);
  }
);

test(
  "QK-184-SEC-06 PROMPT: token cambiado no se envia",
  async () => {
    const h = createHarness();

    h.init();

    h.setPending(anotherToken);

    h.click("btnAcceptListLinkInvite");

    await settle();

    assert.equal(h.state.apiCalls.length, 0);
    assert.equal(h.getPending(), null);

    assert.equal(
      h.elements.listLinkInviteAcceptFeedback.textContent,
      "lists_collab_link_accept_invalid"
    );

    assert.equal(
      h.elements.btnAcceptListLinkInvite.disabled,
      true
    );
  }
);

test(
  "QK-184-SEC-06 PROMPT: lista no colaborativa",
  async () => {
    const h = createHarness({
      acceptHandler: () =>
        Promise.reject(
          apiError(
            400,
            "list_not_collaborative"
          )
        )
    });

    h.init();
    h.click("btnAcceptListLinkInvite");

    await settle();

    assert.equal(h.getPending(), null);

    assert.equal(
      h.elements.listLinkInviteAcceptFeedback.textContent,
      "lists_collab_link_accept_invalid"
    );

    assert.equal(
      h.elements.btnAcceptListLinkInvite.disabled,
      true
    );
  }
);

// QK-184-SEC-06: nueva invitacion mientras otra
// aceptacion HTTP sigue pendiente.

test(
  "QK-184-SEC-06 RACE: conserva nueva invitacion tras exito anterior",
  async () => {
    const firstRequest = createDeferred();

    const h = createHarness({
      acceptHandler: (_receivedToken, attempt) => {
        if (attempt === 1) {
          return firstRequest.promise;
        }

        return Promise.resolve({
          accepted: true,
          list: { id: "list-2" }
        });
      }
    });

    h.init();
    h.click("btnAcceptListLinkInvite");

    assert.deepEqual(
      h.state.apiCalls,
      [token]
    );

    // Llega otro enlace antes de finalizar el POST.
    h.setPending(anotherToken);
    h.init();

    // No debe aceptarse de forma automatica.
    assert.equal(h.state.apiCalls.length, 1);

    firstRequest.resolve({
      accepted: true,
      list: { id: "list-1" }
    });

    await settle();

    assert.equal(
      h.getPending(),
      anotherToken,
      "Aceptar A no debe borrar la nueva invitacion B"
    );

    assert.equal(
      h.state.opens.length,
      2,
      "El modal debe mostrar B al terminar A"
    );

    assert.equal(
      h.state.binds.length,
      1,
      "Los listeners no deben registrarse otra vez"
    );

    assert.equal(h.state.apiCalls.length, 1);

    h.click("btnAcceptListLinkInvite");
    await settle();

    assert.deepEqual(
      h.state.apiCalls,
      [token, anotherToken]
    );
  }
);

test(
  "QK-184-SEC-06 RACE: error antiguo no elimina invitacion nueva",
  async () => {
    const firstRequest = createDeferred();

    const h = createHarness({
      acceptHandler: (_receivedToken, attempt) => {
        if (attempt === 1) {
          return firstRequest.promise;
        }

        return Promise.resolve({
          accepted: true,
          list: { id: "list-2" }
        });
      }
    });

    h.init();
    h.click("btnAcceptListLinkInvite");

    h.setPending(anotherToken);
    h.init();

    assert.equal(h.state.apiCalls.length, 1);

    // El enlace A fue revocado, pero B es diferente.
    firstRequest.reject(
      apiError(404, "invite_not_found")
    );

    await settle();

    assert.equal(
      h.getPending(),
      anotherToken,
      "El error de A no debe borrar el enlace B"
    );

    assert.equal(
      h.state.apiCalls.length,
      1,
      "B debe requerir confirmacion expresa"
    );

    h.click("btnAcceptListLinkInvite");
    await settle();

    assert.deepEqual(
      h.state.apiCalls,
      [token, anotherToken]
    );

    assert.equal(
      h.state.binds.length,
      1
    );
  }
);
