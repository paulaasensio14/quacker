import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(
  new URL(
    "../../assets/js/app/home-notifications.js",
    import.meta.url
  ),
  "utf8"
);

const start = source.indexOf(
  '// Modal confirmar "Marcar todas"'
);

const end = source.indexOf(
  '  document.getElementById("notifRetryLoadBtn")',
  start
);

assert.ok(start >= 0 && end > start);

const handlers = source.slice(start, end);

function deferred() {
  let resolve;
  let reject;

  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });

  return { promise, resolve, reject };
}

function fixture({
  snapshot = [{ id: "notif-a", title: "Ejemplo" }],
  snapshotError = null,
  decision = null,
  clearError = null,
  initiallyOpen = true
} = {}) {
  const calls = [];
  const toasts = [];
  const errors = [];
  const opened = [];

  let policy = null;

  class Element {
    constructor() {
      const classes = new Set();

      this.classList = {
        add: name => classes.add(name),
        remove: name => classes.delete(name),
        contains: name => classes.has(name)
      };

      this.dataset = {};
      this.handlers = {};
      this.attributes = {};
      this.disabled = false;
      this.textContent = "";
      this.innerHTML = "";
    }

    addEventListener(type, callback) {
      this.handlers[type] = callback;
    }

    setAttribute(name, value) {
      this.attributes[name] = String(value);
    }

    removeAttribute(name) {
      delete this.attributes[name];
    }

    focus() {
      document.activeElement = this;
    }

    querySelectorAll() {
      return [];
    }
  }

  const modal = new Element();
  const card = new Element();
  const panel = new Element();

  const markAllBtn = new Element();
  const confirm = new Element();
  const cancel = new Element();
  const close = new Element();

  const closeBtn = new Element();
  const trigger = new Element();

  modal.querySelector = selector =>
    selector === ".modal-card" ? card : null;

  panel.classList.add("is-open");

  if (initiallyOpen) {
    modal.classList.add("is-open");
  }

  const elements = {
    confirmClearNotifsModal: modal,
    confirmClearNotifs: confirm,
    cancelClearNotifs: cancel,
    closeConfirmClearNotifs: close
  };

  const document = {
    activeElement: markAllBtn,

    getElementById(id) {
      return elements[id] || null;
    }
  };

  const context = {
    document,
    panel,
    trigger,
    closeBtn,
    markAllBtn,
    __notifPanelInteractionVersion: 0,

    notifListEl: {
      querySelectorAll() {
        return [];
      }
    },

    console: {
      error(...args) {
        errors.push(args);
      }
    },

    setTimeout(callback) {
      queueMicrotask(callback);
      return 1;
    },

    requestAnimationFrame(callback) {
      queueMicrotask(callback);
    },

    async renderNotifications() {
      calls.push(["render"]);
    },

    ApiClient: {
      async getNotifications() {
        calls.push(["get"]);

        if (decision) {
          return await decision.promise;
        }

        if (snapshotError) throw snapshotError;

        return snapshot;
      },

      async clearNotifications() {
        calls.push(["clear"]);

        if (clearError) throw clearError;

        return { ok: true };
      },

      async setNotifications(value) {
        calls.push(["restore", value]);

        return { ok: true };
      }
    },

    window: {
      I18n: {
        t(key) {
          return key;
        }
      },

      toast(value) {
        toasts.push(value);
      },

      UIModal: {
        bind(id, options) {
          policy = options;
        },

        open(element, options) {
          opened.push(options);
          element.classList.add("is-open");
        },

        close(element) {
          element.classList.remove("is-open");
        }
      }
    }
  };

  vm.runInNewContext(handlers, context);

  return {
    context,
    calls,
    toasts,
    errors,
    opened,
    policy,
    modal,
    card,
    panel,
    markAllBtn,
    confirm,
    cancel,
    close,

    getRequests() {
      return calls.filter(c => c[0] === "get").length;
    },

    clearRequests() {
      return calls.filter(c => c[0] === "clear").length;
    },

    run() {
      return confirm.handlers.click();
    },

    open() {
      return markAllBtn.handlers.click();
    }
  };
}

test("DS-07.5.3 notificaciones: bloqueo antes de obtener copia", async () => {
  const decision = deferred();

  const f = fixture({ decision });

  const first = f.run();
  const second = f.run();

  const requestsBefore = f.getRequests();

  const blocked = [
    f.markAllBtn.disabled,
    f.confirm.disabled,
    f.cancel.disabled,
    f.close.disabled
  ];

  decision.resolve([{ id: "notif-a" }]);

  await Promise.all([first, second]);

  await new Promise(setImmediate);

  assert.equal(requestsBefore, 1);
  assert.deepEqual(blocked, [true, true, true, true]);

  assert.equal(f.clearRequests(), 1);
  assert.equal(f.confirm.disabled, false);
  assert.equal(f.cancel.disabled, false);
  assert.equal(f.close.disabled, false);
});

test("DS-07.5.3 notificaciones: fallo de copia no elimina nada", async () => {
  const f = fixture({
    snapshotError: new Error("network_error")
  });

  await f.run();

  assert.equal(f.clearRequests(), 0);
  assert.equal(f.confirm.disabled, false);
  assert.equal(f.cancel.disabled, false);
  assert.equal(f.close.disabled, false);

  assert.equal(
    f.modal.classList.contains("is-open"),
    true
  );

  assert.ok(
    f.toasts.some(toast => toast.type === "error")
  );
});

test("DS-07.5.3 notificaciones: copia invalida o vacia no elimina", async () => {
  for (const snapshot of [null, {}, []]) {
    const f = fixture({ snapshot });

    await f.run();

    assert.equal(f.clearRequests(), 0);
    assert.equal(f.confirm.disabled, false);
  }
});

test("DS-07.5.3 notificaciones: exito conserva Deshacer", async () => {
  const snapshot = [
    { id: "notif-a", title: "Ejemplo" }
  ];

  const f = fixture({ snapshot });

  await f.run();

  assert.equal(f.clearRequests(), 1);

  const success = f.toasts.find(
    toast => toast.type === "success"
  );

  assert.ok(success);
  assert.equal(success.actionLabel, "lists_undo");

  await success.onAction();

  const restoration = f.calls.find(
    call => call[0] === "restore"
  );

  assert.deepEqual(restoration[1], snapshot);
});

test("DS-07.5.3 notificaciones: error de guardado recupera controles", async () => {
  const f = fixture({
    clearError: new Error("network_error")
  });

  await f.run();

  assert.equal(f.clearRequests(), 1);
  assert.equal(f.markAllBtn.disabled, false);
  assert.equal(f.confirm.disabled, false);
  assert.equal(f.cancel.disabled, false);
  assert.equal(f.close.disabled, false);

  assert.ok(
    f.toasts.some(toast => toast.type === "error")
  );

  assert.equal(
    f.toasts.some(toast => toast.type === "success"),
    false
  );
});

test("DS-07.5.3 notificaciones: apertura y cierre seguros", async () => {
  const decision = deferred();

  const f = fixture({
    initiallyOpen: false,
    decision
  });

  const first = f.open();
  const second = f.open();

  const requestsBefore = f.getRequests();

  decision.resolve([{ id: "notif-a" }]);

  await Promise.all([first, second]);

  assert.equal(requestsBefore, 1);
  assert.equal(f.opened.length, 1);

  assert.equal(
    f.opened[0].initialFocusSelector,
    "#cancelClearNotifs"
  );

  assert.equal(f.policy.canDismiss(), true);

  const operation = f.run();

  assert.equal(f.policy.canDismiss(), false);

  await operation;

  assert.equal(f.policy.canDismiss(), true);

  assert.equal(
    f.modal.classList.contains("is-open"),
    false
  );

  assert.equal(f.card.attributes["aria-busy"], undefined);
});

test("DS-07.5.3 notificaciones: cierre del panel invalida apertura tardia", async () => {
  const decision = deferred();

  const f = fixture({
    initiallyOpen: false,
    decision
  });

  const operation = f.open();

  f.panel.classList.remove("is-open");

  decision.resolve([{ id: "notif-a" }]);

  await operation;

  assert.equal(f.opened.length, 0);
  assert.equal(f.clearRequests(), 0);
});

test("DS-07.5.3 notificaciones: modal prevalece sobre panel inferior", () => {
  const trapStart = source.indexOf("  function trapTabKey(e)");
  const trapEnd = source.indexOf(
    "  if (trigger && panel)",
    trapStart
  );

  assert.ok(trapStart >= 0 && trapEnd > trapStart);

  const trap = source.slice(trapStart, trapEnd);

  assert.match(
    trap,
    /isClearNotifsModalOpen\(\)/
  );

  const closeStart = source.indexOf(
    "  // Cerrar al clicar fuera"
  );

  const closeEnd = source.indexOf(
    "  // Trap de Tab dentro del panel",
    closeStart
  );

  assert.ok(closeStart >= 0 && closeEnd > closeStart);

  const closing = source.slice(closeStart, closeEnd);

  assert.match(closing, /modal\?\.contains\(e\.target\)/);
  assert.match(closing, /e\.defaultPrevented/);
  assert.match(closing, /isClearNotifsModalOpen\(\)/);

  assert.match(
    source,
    /markAllBtn\.dataset\?\.markAllBusy !== "1"/
  );
});
