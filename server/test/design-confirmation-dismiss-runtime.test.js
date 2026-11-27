import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const modalSource = fs.readFileSync(
  new URL("../../assets/js/app/ui-modal.js", import.meta.url),
  "utf8"
);

const listsSource = fs.readFileSync(
  new URL("../../assets/js/app/lists.js", import.meta.url),
  "utf8"
);

function fixture({ guarded = true } = {}) {
  let busy = false;
  let dismissed = 0;

  const frames = [];
  const documentListeners = {};
  const document = {};

  class Element {
    constructor() {
      const classes = new Set();

      this.classList = {
        add: name => classes.add(name),
        remove: name => classes.delete(name),
        contains: name => classes.has(name)
      };

      this.dataset = {};
      this.attributes = {};
      this.listeners = {};
      this.disabled = false;
      this.offsetWidth = 100;
      this.offsetHeight = 44;
    }

    setAttribute(name, value) {
      this.attributes[name] = String(value);
    }

    addEventListener(name, callback) {
      this.listeners[name] = callback;
    }

    focus() {
      document.activeElement = this;
    }

    emit(name, details = {}) {
      this.listeners[name]?.({
        target: this,
        preventDefault() {},
        ...details
      });
    }
  }

  const modal = new Element();
  const card = new Element();
  const trigger = new Element();
  const cancel = new Element();
  const confirm = new Element();
  const close = new Element();

  const controls = [close, cancel, confirm];

  const selectors = {
    "#cancelDeleteList": cancel,
    "#confirmDeleteList": confirm,
    "#closeConfirmDeleteList": close,
    ".modal-card": card
  };

  modal.querySelector = selector =>
    selectors[selector] || null;

  modal.querySelectorAll = () =>
    controls.filter(control => !control.disabled);

  modal.contains = element =>
    element === modal ||
    element === card ||
    controls.includes(element);

  Object.assign(document, {
    body: new Element(),
    documentElement: { dataset: {} },
    activeElement: trigger,

    getElementById(id) {
      return id === "confirmDeleteListModal"
        ? modal
        : null;
    },

    querySelector(selector) {
      return selectors[selector] || null;
    },

    querySelectorAll() {
      return modal.classList.contains("is-open")
        ? [modal]
        : [];
    },

    addEventListener(name, callback) {
      documentListeners[name] = callback;
    }
  });

  const window = {};

  vm.runInNewContext(modalSource, {
    window,
    document,

    requestAnimationFrame(callback) {
      frames.push(callback);
    }
  });

  function flush() {
    while (frames.length) frames.shift()();
  }

  const api = window.UIModal;

  api.bind("confirmDeleteListModal", {
    closeSelectors: [
      "#cancelDeleteList",
      "#closeConfirmDeleteList"
    ],

    ...(guarded ? {
      canDismiss: () => !busy,
      onDismiss: () => { dismissed++; }
    } : {})
  });

  api.open(modal, {
    initialFocusSelector: "#cancelDeleteList",
    lastFocusEl: trigger
  });

  flush();

  function key(key) {
    let prevented = false;

    documentListeners.keydown({
      key,

      preventDefault() {
        prevented = true;
      }
    });

    flush();

    return prevented;
  }

  return {
    api,
    modal,
    card,
    cancel,
    confirm,
    close,
    trigger,
    document,
    flush,
    key,

    get dismissed() { return dismissed; },

    get open() {
      return modal.classList.contains("is-open");
    },

    setBusy(value) {
      busy = value;

      for (const control of controls) {
        control.disabled = value;
      }
    }
  };
}

test("DS-07.5.3: Escape no cierra un modal protegido ocupado", () => {
  const f = fixture();

  f.setBusy(true);

  assert.equal(f.key("Escape"), true);
  assert.equal(f.open, true);
  assert.equal(f.dismissed, 0);
});

test("DS-07.5.3: fondo X y Cancelar respetan bloqueo", () => {
  const f = fixture();

  f.setBusy(true);

  f.modal.emit("click");
  f.close.emit("click");
  f.cancel.emit("click");

  assert.equal(f.open, true);
  assert.equal(f.dismissed, 0);
});

test("DS-07.5.3: cancelar normalmente limpia y restaura foco", () => {
  for (const dismiss of [
    f => f.key("Escape"),
    f => f.cancel.emit("click"),
    f => f.close.emit("click"),
    f => f.modal.emit("click")
  ]) {
    const f = fixture();

    assert.equal(f.document.activeElement, f.cancel);

    dismiss(f);
    f.flush();

    assert.equal(f.open, false);
    assert.equal(f.dismissed, 1);
    assert.equal(f.document.activeElement, f.trigger);
    assert.equal(f.modal.attributes["aria-hidden"], "true");

    dismiss(f);

    assert.equal(f.dismissed, 1);
  }
});

test("DS-07.5.3: cierre programatico permitido tras guardar", () => {
  const f = fixture();

  f.setBusy(true);

  f.api.close(f.modal);
  f.flush();

  assert.equal(f.open, false);
  assert.equal(f.dismissed, 0);
});

test("DS-07.5.3: Tab no escapa durante procesamiento", () => {
  const f = fixture();

  f.setBusy(true);
  f.card.focus();

  assert.equal(f.key("Tab"), true);
  assert.equal(f.document.activeElement, f.card);
});

test("DS-07.5.3: modales sin proteccion conservan Escape", () => {
  const f = fixture({ guarded: false });

  f.setBusy(true);

  f.key("Escape");

  assert.equal(f.open, false);
  assert.equal(f.document.activeElement, f.trigger);
});

test("DS-07.5.3: eliminar lista usa Cancelar y proteccion propia", () => {
  const start = listsSource.indexOf(
    "  function openConfirmDeleteListModal("
  );

  const end = listsSource.indexOf(
    "    const search =",
    start
  );

  assert.ok(start >= 0 && end > start);

  const block = listsSource.slice(start, end);

  assert.match(
    block,
    /initialFocusSelector:\s*"#cancelDeleteList"/
  );

  assert.doesNotMatch(
    block,
    /initialFocusSelector:\s*"#confirmDeleteList"/
  );

  assert.match(block, /canDismiss:/);
  assert.match(block, /onDismiss:/);
  assert.match(block, /pendingDeleteListId = null/);
  assert.match(block, /lastFocusEl:\s*trigger/);

  assert.match(
    listsSource,
    /openConfirmDeleteListModal\(delBtn\)/
  );
});

test("DS-07.5.3: eliminacion anuncia ocupado y recupera controles", () => {
  const start = listsSource.indexOf(
    "// Confirmar eliminar (CON toast y deshacer)"
  );

  const end = listsSource.indexOf(
    '// Abrir "Nueva lista"',
    start
  );

  assert.ok(start >= 0 && end > start);

  const block = listsSource.slice(start, end);

  assert.match(
    block,
    /modal\.classList\.contains\("is-open"\)/
  );

  assert.match(
    block,
    /setAttribute\("aria-busy", "true"\)/
  );

  assert.match(
    block,
    /removeAttribute\("aria-busy"\)/
  );

  assert.match(block, /modalCard\?\.focus\(\)/);
  assert.match(block, /cancelBtn\?\.focus\(\)/);
  assert.match(block, /ApiClient\.deleteList\(targetListId\)/);
  assert.match(block, /ApiClient\.setLists\(/);
});
