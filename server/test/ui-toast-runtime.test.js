import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(
  new URL("../../assets/js/app/ui-toast.js", import.meta.url),
  "utf8"
);

function loadToast({ language = "en", sharedI18n = null } = {}) {
  const elements = new Map();

  class FakeClassList {
    constructor() {
      this.values = new Set();
    }

    add(value) {
      this.values.add(value);
    }

    remove(value) {
      this.values.delete(value);
    }

    contains(value) {
      return this.values.has(value);
    }
  }

  class FakeElement {
    constructor() {
      this.attributes = {};
      this.children = [];
      this.classList = new FakeClassList();
      this.innerHTML = "";
      this.listeners = {};
      this.disabled = false;
    }

    setAttribute(name, value) {
      this.attributes[name] = String(value);
    }

    appendChild(child) {
      this.children.push(child);
      return child;
    }

    addEventListener(type, handler) {
      this.listeners[type] = handler;
    }

    querySelector(selector) {
      if (selector === ".toast-close") {
        if (!this.closeButton) {
          this.closeButton = new FakeElement();
        }
        return this.closeButton;
      }

      if (
        selector === ".toast-action" &&
        this.innerHTML.includes("toast-action")
      ) {
        if (!this.actionButton) {
          this.actionButton = new FakeElement();
        }
        return this.actionButton;
      }

      return null;
    }

    closest(selector) {
      return selector === ".toast" ? this.parentToast || null : null;
    }

    remove() {}
  }

  const body = new FakeElement();

  const document = {
    body,

    getElementById(id) {
      return elements.get(id) || null;
    },

    createElement() {
      const element = new FakeElement();

      Object.defineProperty(element, "id", {
        get() {
          return this._id || "";
        },
        set(value) {
          this._id = value;
          if (value) elements.set(value, this);
        }
      });

      return element;
    }
  };

  const storage = new Map([
    ["quacker_lang", language]
  ]);

  const window = {
    I18n: sharedI18n,
    setTimeout(callback) {
      callback();
      return 1;
    }
  };

  const context = {
    window,
    document,
    localStorage: {
      getItem(key) {
        return storage.get(key) ?? null;
      }
    },
    navigator: {
      language: language === "es" ? "es-ES" : "en-US"
    },
    requestAnimationFrame(callback) {
      callback();
    },
    setTimeout(callback) {
      callback();
      return 1;
    },
    clearTimeout() {},
    console
  };

  vm.createContext(context);
  vm.runInContext(source, context, {
    filename: "assets/js/app/ui-toast.js"
  });

  return {
    window,
    getHost() {
      return elements.get("toastHost");
    }
  };
}

test("el toast funciona en la landing sin window.I18n", () => {
  const runtime = loadToast({
    language: "en"
  });

  runtime.window.toast({
    title: "Saved",
    message: "Done",
    duration: 0
  });

  const host = runtime.getHost();
  assert.ok(host);
  assert.equal(host.children.length, 1);

  const toast = host.children[0];

  assert.match(
    toast.innerHTML,
    /aria-label="Close notification"/
  );
});

test("Undo usa el estado inglés correcto sin window.I18n", async () => {
  const runtime = loadToast({
    language: "en"
  });

  runtime.window.toast({
    title: "Changed",
    actionLabel: "Undo",
    duration: 0,
    onAction: async () => {}
  });

  const toast = runtime.getHost().children[0];
  const actionButton = toast.querySelector(".toast-action");

  actionButton.parentToast = toast;

  const pending = actionButton.listeners.click();

  assert.match(
    actionButton.innerHTML,
    /Undoing…/
  );

  await pending;
});
