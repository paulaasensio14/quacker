import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const jsURL = new URL(
  "../../assets/js/app/ui-confirm.js",
  import.meta.url
);

const cssURL = new URL(
  "../../assets/css/design-confirmations.css",
  import.meta.url
);

const options = {
  title: "Eliminar lista",
  message: "¿Seguro que quieres eliminar esta lista?",
  confirmLabel: "Eliminar",
  cancelLabel: "Cancelar",
  closeLabel: "Cerrar",
  tone: "danger"
};

function fixture({ supported = true } = {}) {
  const document = {};
  const listeners = new Map();

  class Element {
    constructor(tag) {
      this.tagName = tag.toUpperCase();
      this.children = [];
      this.attributes = {};
      this.listeners = new Map();
      this.textContent = "";
      this.className = "";
      this.id = "";
      this.open = false;
      this.disabled = false;
      this.isConnected = false;
    }

    append(...children) {
      for (const child of children) {
        child.parent = this;
        child.isConnected = this.isConnected;
        this.children.push(child);
      }
    }

    remove() {
      if (this.parent) {
        this.parent.children =
          this.parent.children.filter(child => child !== this);
      }

      this.isConnected = false;
    }

    setAttribute(key, value) {
      this.attributes[key] = String(value);
    }

    getAttribute(key) {
      return this.attributes[key] ?? null;
    }

    addEventListener(name, callback) {
      const callbacks = this.listeners.get(name) || [];
      callbacks.push(callback);
      this.listeners.set(name, callbacks);
    }

    emit(name, details = {}) {
      const event = {
        target: this,
        preventDefault() {},
        stopPropagation() {},
        ...details
      };

      for (const callback of this.listeners.get(name) || []) {
        callback(event);
      }
    }

    focus() {
      document.activeElement = this;
    }

    showModal() {
      this.open = true;
    }

    close() {
      this.open = false;
      this.emit("close");
    }

    getBoundingClientRect() {
      return {
        left: 100,
        top: 100,
        right: 500,
        bottom: 500
      };
    }
  }

  document.body = new Element("body");
  document.body.isConnected = true;

  document.createElement = tag => {
    const element = new Element(tag);

    if (!supported && tag === "dialog") {
      element.showModal = undefined;
    }

    return element;
  };

  document.getElementById = id => {
    function visit(element) {
      if (element.id === id) return element;

      for (const child of element.children) {
        const result = visit(child);
        if (result) return result;
      }

      return null;
    }

    return visit(document.body);
  };

  const trigger = new Element("button");
  trigger.id = "trigger";
  document.body.append(trigger);
  trigger.focus();

  const window = {
    addEventListener(name, callback) {
      listeners.set(name, callback);
    },

    removeEventListener(name, callback) {
      if (listeners.get(name) === callback) {
        listeners.delete(name);
      }
    }
  };

  vm.runInNewContext(
    fs.readFileSync(jsURL, "utf8"),
    { window, document, Promise }
  );

  function byClass(className) {
    function visit(element) {
      if (element.className.split(" ").includes(className)) {
        return element;
      }

      for (const child of element.children) {
        const result = visit(child);
        if (result) return result;
      }

      return null;
    }

    return visit(document.body);
  }

  function keydown(key, shiftKey = false) {
    const callback = listeners.get("keydown");

    let prevented = false;

    callback?.({
      key,
      shiftKey,
      preventDefault() {
        prevented = true;
      },
      stopPropagation() {}
    });

    return prevented;
  }

  return {
    api: window.UIConfirm,
    document,
    trigger,
    byClass,
    keydown,
    listeners
  };
}

test("UIConfirm: exige textos completos y falla de forma segura", async () => {
  const f = fixture();

  assert.equal(await f.api.ask(null), false);
  assert.equal(await f.api.ask({ title: "Prueba" }), false);

  assert.equal(
    await f.api.ask({ ...options, tone: "unknown" }),
    false
  );

  assert.equal(f.byClass("q-confirm-dialog"), null);
});

test("UIConfirm: navegador incompatible no autoriza la accion", async () => {
  const f = fixture({ supported: false });

  assert.equal(await f.api.ask(options), false);
  assert.equal(f.byClass("q-confirm-dialog"), null);
});

test("UIConfirm: solo confirmar resuelve true", async () => {
  const f = fixture();

  const response = f.api.ask(options);

  assert.equal(f.api.isPending(), true);

  f.byClass("q-confirm-accept").emit("click");

  assert.equal(await response, true);
  assert.equal(f.api.isPending(), false);
  assert.equal(f.byClass("q-confirm-dialog"), null);
  assert.equal(f.document.activeElement, f.trigger);
  assert.equal(f.listeners.size, 0);
});

test("UIConfirm: cancelar X Escape y cierre externo resuelven false", async () => {
  const f = fixture();

  for (const action of [
    () => f.byClass("q-confirm-cancel").emit("click"),
    () => f.byClass("q-confirm-close").emit("click"),
    () => f.keydown("Escape"),
    () => f.byClass("q-confirm-dialog").emit("cancel"),
    () => f.byClass("q-confirm-dialog").close()
  ]) {
    const response = f.api.ask(options);

    action();

    assert.equal(await response, false);
    assert.equal(f.api.isPending(), false);
    assert.equal(f.document.activeElement, f.trigger);
    assert.equal(f.listeners.size, 0);
  }
});

test("UIConfirm: rechaza confirmaciones simultaneas", async () => {
  const f = fixture();

  const first = f.api.ask(options);

  assert.equal(await f.api.ask(options), false);
  assert.equal(f.api.isPending(), true);

  f.byClass("q-confirm-cancel").emit("click");

  assert.equal(await first, false);
  assert.equal(f.api.isPending(), false);
});

test("UIConfirm: foco seguro y ciclo de teclado", async () => {
  const f = fixture();

  const response = f.api.ask(options);

  const cancel = f.byClass("q-confirm-cancel");
  const close = f.byClass("q-confirm-close");
  const accept = f.byClass("q-confirm-accept");

  assert.equal(f.document.activeElement, cancel);

  accept.focus();
  assert.equal(f.keydown("Tab"), true);
  assert.equal(f.document.activeElement, close);

  assert.equal(f.keydown("Tab", true), true);
  assert.equal(f.document.activeElement, accept);

  f.keydown("Escape");

  assert.equal(await response, false);
  assert.equal(f.document.activeElement, f.trigger);
});

test("UIConfirm: texto literal y semantica accesible", async () => {
  const f = fixture();

  const message = '<img src=x onerror="alert(1)">';

  const response = f.api.ask({
    ...options,
    message,
    tone: "normal"
  });

  const dialog = f.byClass("q-confirm-dialog");

  assert.equal(dialog.getAttribute("aria-modal"), "true");
  assert.equal(dialog.getAttribute("role"), "dialog");

  const titleId = dialog.getAttribute("aria-labelledby");
  const messageId = dialog.getAttribute("aria-describedby");

  assert.equal(
    f.document.getElementById(titleId).textContent,
    options.title
  );

  assert.equal(
    f.document.getElementById(messageId).textContent,
    message
  );

  assert.equal(dialog.getAttribute("data-tone"), "normal");

  assert.equal(
    f.byClass("q-confirm-close").getAttribute("aria-label"),
    options.closeLabel
  );

  f.byClass("q-confirm-cancel").emit("click");

  assert.equal(await response, false);
});

test("UIConfirm: estilos aislados y variantes accesibles", () => {
  const css = fs.readFileSync(cssURL, "utf8");
  const js = fs.readFileSync(jsURL, "utf8");

  assert.match(css, /\.q-confirm-dialog::backdrop/);
  assert.match(css, /\.q-confirm-dialog\[data-tone="danger"\]/);
  assert.match(css, /--q-confirm-action-bg:\s*var\(--q-brand\)/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /body\.quacker-theme-system/);
  assert.match(css, /max-height:\s*calc\(100dvh - 32px\)/);

  assert.doesNotMatch(js, /\.innerHTML\s*=/);
  assert.doesNotMatch(js, /window\.confirm\s*\(/);
  assert.doesNotMatch(js, /\bfetch\s*\(/);
  assert.doesNotMatch(js, /\bApiClient\b/);
});

test("UIConfirm: variante destructiva prevalece en ambos temas", () => {
  const css = fs.readFileSync(cssURL, "utf8");

  assert.match(
    css,
    /body\.dark-theme \.q-confirm-dialog\[data-tone="danger"\]/
  );

  assert.match(
    css,
    /body\.quacker-theme-system \.q-confirm-dialog\[data-tone="danger"\]/
  );
});
