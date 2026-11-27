import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function read(relative) {
  return fs.readFileSync(
    new URL("../../" + relative, import.meta.url),
    "utf8"
  );
}

const source = read("assets/js/app/ui-toast.js");

function renderToast(options) {
  const host = {
    children: [],
    appendChild(element) {
      this.children.push(element);
    }
  };

  const window = {};

  const document = {
    getElementById() {
      return host;
    },

    createElement() {
      const classes = new Set();

      return {
        className: "",
        innerHTML: "",
        attributes: {},

        classList: {
          add(value) {
            classes.add(value);
          },

          remove(value) {
            classes.delete(value);
          },

          contains(value) {
            return classes.has(value);
          }
        },

        setAttribute(name, value) {
          this.attributes[name] = String(value);
        },

        querySelector(selector) {
          if (selector === ".toast-close") {
            return { addEventListener() {} };
          }

          return null;
        }
      };
    }
  };

  vm.runInNewContext(source, {
    window,
    document,

    navigator: {
      language: "es-ES"
    },

    localStorage: {
      getItem() {
        return "es";
      }
    },

    requestAnimationFrame(callback) {
      callback();
    },

    setTimeout() {
      return 1;
    },

    clearTimeout() {},
    console
  });

  window.toast({
    title: "Contenido guardado",
    duration: 0,
    ...options
  });

  return host.children[0];
}

test("DS-07.1: aviso de listas conserva semantica de exito", () => {
  const toast = renderToast({
    type: "success",
    icon: "list"
  });

  assert.equal(toast.className, "toast toast--success");

  assert.ok(
    toast.classList.contains("toast--list")
  );

  assert.match(
    toast.innerHTML,
    /M9 6h11M9 12h11M9 18h11/
  );

  assert.equal(toast.attributes.role, "status");
});

test("DS-07.1: exito convencional conserva marcador verde", () => {
  const toast = renderToast({
    type: "success"
  });

  assert.equal(toast.className, "toast toast--success");

  assert.equal(
    toast.classList.contains("toast--list"),
    false
  );

  assert.match(toast.innerHTML, /M5 12l4 4L19 6/);
});

test("DS-07.1: la variante listas no sustituye errores", () => {
  const toast = renderToast({
    type: "error",
    icon: "list"
  });

  assert.equal(toast.className, "toast toast--error");

  assert.equal(
    toast.classList.contains("toast--list"),
    false
  );

  assert.match(
    toast.innerHTML,
    /M6 6l12 12M18 6L6 18/
  );
});

test("DS-07.1: variante de listas solo en operaciones confirmadas", () => {
  const library = read("assets/js/app/library.js");
  const explore = read("assets/js/app/explore.js");

  assert.match(
    library,
    /title: t\("library_add_to_list_updated_title"\),\s*message: msg,\s*type: "success",\s*icon: "list",/
  );

  assert.match(
    explore,
    /message: feedbackMessage,\s*type: feedbackType,\s*icon: feedbackType === "success" \? "list" : null,/
  );
});

test("DS-07.1: icono de listas usa amarillo corporativo", () => {
  const css = read("assets/css/design-feedback.css");

  assert.match(
    css,
    /\.toast--success\.toast--list \.toast-icon\s*\{[^}]*background:\s*var\(--q-brand\)\s*;[^}]*color:\s*#17181c\s*;/s
  );
});
