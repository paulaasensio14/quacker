import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  createContext,
  runInContext
} from "node:vm";

const source = fs.readFileSync(
  new URL(
    "../../assets/js/app/home-notifications.js",
    import.meta.url
  ),
  "utf8"
);

const start = source.indexOf(
  "async function renderNotifications("
);

const end = source.indexOf(
  '// Modal confirmar "Marcar todas"',
  start
);

assert.ok(start >= 0, "Funcion de render localizada");
assert.ok(end > start, "Fin de la funcion localizado");

const renderSource = source.slice(start, end);

function createDeferred() {
  let resolve;
  let reject;

  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });

  return { promise, resolve, reject };
}

function createHarness() {
  const deferred = createDeferred();

  const state = {
    panelOpen: false,
    errors: []
  };

  const notifListEl = {
    innerHTML: "panel-preservado"
  };

  const notifCountEl = {
    textContent: "7"
  };

  const errorStateEl = {
    hidden: true
  };

  const emptyStateEl = {
    hidden: false
  };

  const context = createContext({
    ApiClient: {
      getNotifications: () => deferred.promise,
      getListInvites: async () => []
    },
    document: {
      getElementById(id) {
        if (id === "notifErrorState") {
          return errorStateEl;
        }

        if (id === "notifEmptyState") {
          return emptyStateEl;
        }

        return null;
      }
    },
    panel: {
      classList: {
        contains(value) {
          return value === "is-open" &&
            state.panelOpen;
        }
      }
    },
    notifListEl,
    notifCountEl,
    markAllBtn: null,
    console: {
      error(...args) {
        state.errors.push(args);
      }
    }
  });

  runInContext(
    `
      let __notifPanelInteractionVersion = 0;

      ${renderSource}

      globalThis.runRender = renderNotifications;

      globalThis.openPanelForTest = () => {
        __notifPanelInteractionVersion += 1;
      };
    `,
    context
  );

  const snapshot = () => ({
    html: notifListEl.innerHTML,
    count: notifCountEl.textContent,
    errorHidden: errorStateEl.hidden,
    emptyHidden: emptyStateEl.hidden
  });

  return {
    deferred,
    state,
    context,
    snapshot,
    render: context.runRender,
    markInteraction: context.openPanelForTest
  };
}

test(
  "la respuesta tardia no modifica un panel abierto",
  async () => {
    const h = createHarness();

    const before = h.snapshot();

    const pending = h.render({
      background: true
    });

    h.state.panelOpen = true;
    h.markInteraction();

    h.deferred.resolve([]);

    await pending;

    assert.deepEqual(h.snapshot(), before);
    assert.equal(h.state.errors.length, 0);
  }
);

test(
  "la respuesta anterior se descarta aunque el panel vuelva a cerrarse",
  async () => {
    const h = createHarness();

    const before = h.snapshot();

    const pending = h.render({
      background: true
    });

    h.state.panelOpen = true;
    h.markInteraction();
    h.state.panelOpen = false;

    h.deferred.resolve([]);

    await pending;

    assert.deepEqual(h.snapshot(), before);
  }
);

test(
  "un error tardio tampoco reemplaza el panel abierto",
  async () => {
    const h = createHarness();

    const before = h.snapshot();

    const pending = h.render({
      background: true
    });

    h.state.panelOpen = true;
    h.markInteraction();

    h.deferred.reject(
      new Error("respuesta retrasada simulada")
    );

    await pending;

    assert.deepEqual(h.snapshot(), before);
    assert.equal(h.state.errors.length, 0);
  }
);

test(
  "un error normal sigue mostrando el estado de error",
  async () => {
    const h = createHarness();

    const pending = h.render({
      background: false
    });

    h.deferred.reject(
      new Error("error normal simulado")
    );

    await pending;

    assert.equal(
      h.snapshot().html,
      ""
    );

    assert.equal(
      h.snapshot().count,
      "—"
    );

    assert.equal(
      h.snapshot().errorHidden,
      false
    );

    assert.equal(h.state.errors.length, 1);
  }
);
