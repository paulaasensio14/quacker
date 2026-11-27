import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../../", import.meta.url);

const read = path => fs.readFileSync(
  new URL(path, root), "utf8"
);

function deferred() {
  let resolve;
  let reject;

  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });

  return { promise, resolve, reject };
}

const tick = () => new Promise(
  resolve => setImmediate(resolve)
);

function element(tag = "div") {
  const listeners = new Map();
  const attributes = new Map();

  return {
    tagName: tag.toUpperCase(),
    children: [],
    dataset: {},
    hidden: false,
    textContent: "",
    innerHTML: "",
    className: "",

    setAttribute(name, value) {
      attributes.set(name, String(value));
    },

    getAttribute(name) {
      return attributes.get(name) ?? null;
    },

    removeAttribute(name) {
      attributes.delete(name);
    },

    append(...children) {
      this.children.push(...children);
    },

    replaceChildren(...children) {
      this.children = children;
    },

    addEventListener(type, callback) {
      listeners.set(type, callback);
    },

    fire(type, event = {}) {
      return listeners.get(type)?.(event);
    },

    focus() {},
    click() {
      return this.fire("click");
    }
  };
}

function harness() {
  const ids = [
    "sidebarLists",
    "sidebarListsEntries",
    "sidebarListsStatus",
    "sidebarListsCreate",
    "sidebarListsAll",
    "sidebarListsRetry",
    "btnBackToLists"
  ];

  const elements = Object.fromEntries(
    ids.map(id => [id, element()])
  );

  const events = [];
  const requests = [];
  const views = [];
  const listeners = new Map();

  const document = {
    hidden: false,
    activeElement: null,

    getElementById(id) {
      return elements[id] || null;
    },

    createElement(tag) {
      return element(tag);
    },

    addEventListener(name, handler) {
      listeners.set(name, handler);
    },

    dispatchEvent(event) {
      events.push(event);
    }
  };

  const window = {
    I18n: { t: key => key },

    Router: {
      showView(view) {
        views.push(view);
      }
    },

    matchMedia() {
      return {
        matches: true,
        addEventListener() {}
      };
    },

    addEventListener() {}
  };

  const ApiClient = {
    getListsForNavigation() {
      const request = deferred();

      requests.push(request);

      return request.promise;
    }
  };

  class CustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  }

  vm.runInNewContext(
    read("assets/js/app/sidebar-lists.js"),
    {
      window,
      document,
      ApiClient,
      CustomEvent
    }
  );

  const module = window.SidebarLists;

  module.init();

  return {
    module,
    elements,
    requests,
    events,
    views,

    emit(type, detail) {
      listeners.get(type)?.({ detail });
    },

    buttons() {
      return elements.sidebarListsEntries.children
        .map(row => row.children[0]);
    }
  };
}

test("DS-08.2: integracion de accesos en dashboard y arranque autenticado", () => {
  const html = read("dashboard.html");
  const core = read("assets/js/app/app-core.js");
  const css = read("assets/css/design-navigation.css");
  const i18n = read("assets/js/app/i18n.js");

  assert.match(html, /id="sidebarLists"/);
  assert.match(html, /id="sidebarListsCreate"/);
  assert.match(html, /id="sidebarListsAll"/);
  assert.match(html, /id="sidebarListsEntries"/);
  assert.match(html, /assets\/js\/app\/sidebar-lists\.js/);

  assert.ok(
    core.indexOf("window.SidebarLists?.init?.()") >
    core.indexOf("await ApiClient.getCurrentSession()")
  );

  assert.match(
    css,
    /#sidebar:not\(\.collapsed\) #sidebarLists/
  );

  assert.match(
    css,
    /@media \(min-width: 1025px\)/
  );

  for (const key of [
    "sidebar_lists_title",
    "sidebar_lists_all",
    "sidebar_lists_loading",
    "sidebar_lists_empty",
    "sidebar_lists_error"
  ]) {
    assert.equal(
      (i18n.match(new RegExp(key + ":", "g")) || [])
        .length,
      2
    );
  }
});

test("DS-08.2: lectura HTTP directa sin fallback ni cache anterior", async () => {
  const source = read("assets/js/data/api-client.js");

  const start = source.indexOf(
    "  async function getListsForNavigation()"
  );

  const end = source.indexOf(
    "  // Devuelve las listas donde",
    start
  );

  assert.ok(start >= 0 && end > start);

  let fail = false;
  let calls = 0;

  const fn = vm.runInNewContext(
    source.slice(start, end) + "\ngetListsForNavigation",
    {
      _isHttp: () => true,

      async _httpJson(method, endpoint) {
        assert.equal(method, "GET");
        assert.equal(endpoint, "/lists");

        calls++;

        if (fail) throw new Error("network_failure");

        return [{ id: "list-a" }];
      },

      listsCacheReadVersion: 0,
      listsCacheDirectVersion: 0,
      _setListsCache() {},
      _normalizeListCollection: items => items,
      _makeApiError: () => new Error("invalid_lists_response"),

      getLists() {
        throw new Error("No debe usar cache en HTTP");
      }
    }
  );

  assert.equal((await fn())[0].id, "list-a");

  fail = true;

  await assert.rejects(fn(), /network_failure/);

  assert.equal(calls, 2);

  assert.match(
    source,
    /getLists,\s*getListsForNavigation,/
  );
});

test("DS-08.2: cuatro listas reales y nombres tratados como texto", async () => {
  const h = harness();

  h.requests[0].resolve([
    { id: "a", name: "<img onerror=alert(1)>", visibility: "private" },
    { id: "a", name: "Duplicada", visibility: "private" },
    { id: "b", name: "Publica", visibility: "public" },
    { id: "c", name: "Colaborativa", visibility: "collab" },
    { id: "d", name: "Cuarta", visibility: "private" },
    { id: "e", name: "Quinta", visibility: "private" }
  ]);

  await tick();

  const buttons = h.buttons();

  assert.equal(buttons.length, 4);

  assert.deepEqual(
    Array.from(buttons, b => b.dataset.listShortcutId),
    ["a", "b", "c", "d"]
  );

  assert.equal(
    buttons[0].children[1].textContent,
    "<img onerror=alert(1)>"
  );

  assert.equal(buttons[0].children[1].innerHTML, "");

  assert.equal(buttons[1].dataset.visibility, "public");
  assert.equal(buttons[2].dataset.visibility, "collab");
});

test("DS-08.2: accesos reutilizan navegacion y creacion actuales", async () => {
  const h = harness();

  h.requests[0].resolve([
    { id: "a", name: "Lista A", visibility: "private" }
  ]);

  await tick();

  h.buttons()[0].click();

  const open = h.events.at(-1);

  assert.equal(open.type, "quacker:lists-open-detail");
  assert.equal(open.detail.listId, "a");
  assert.equal(open.detail.source, "sidebar");

  h.elements.sidebarListsCreate.click();

  assert.equal(
    h.events.at(-1).type,
    "quacker:lists-create-request"
  );

  h.elements.sidebarListsAll.click();

  assert.equal(h.views.at(-1), "lists");
});

test("DS-08.2: estado vacio diferente de error de conexion", async () => {
  const h = harness();

  h.requests[0].resolve([]);

  await tick();

  assert.equal(h.buttons().length, 0);

  assert.equal(
    h.elements.sidebarListsStatus.textContent,
    "sidebar_lists_empty"
  );

  h.emit("quacker:data-changed", {
    kind: "lists",
    action: "delete"
  });

  h.requests[1].reject(new Error("offline"));

  await tick();

  assert.equal(
    h.elements.sidebarListsStatus.textContent,
    "sidebar_lists_error"
  );

  assert.equal(h.elements.sidebarListsRetry.hidden, false);
});

test("DS-08.2: una respuesta antigua no recupera accesos eliminados", async () => {
  const h = harness();

  h.emit("quacker:data-changed", {
    kind: "lists",
    action: "delete"
  });

  h.requests[1].resolve([]);

  await tick();

  h.requests[0].resolve([
    { id: "old", name: "Eliminada", visibility: "private" }
  ]);

  await tick();

  assert.equal(h.buttons().length, 0);
});

test("DS-08.2: seleccion de lista activa accesible", async () => {
  const h = harness();

  h.requests[0].resolve([
    { id: "a", name: "Lista A", visibility: "private" },
    { id: "b", name: "Lista B", visibility: "public" }
  ]);

  await tick();

  h.module.select("b");

  assert.equal(
    h.buttons()[1].getAttribute("aria-current"),
    "page"
  );

  assert.equal(
    h.buttons()[0].getAttribute("aria-current"),
    null
  );

  h.module.select(null);

  assert.equal(
    h.buttons()[1].getAttribute("aria-current"),
    null
  );
});

function navigationHarness() {
  const lists = read("assets/js/app/lists.js");

  const start = lists.indexOf(
    "  async function openListFromNavigation(e)"
  );

  const end = lists.indexOf(
    "  function init() {",
    start
  );

  assert.ok(start >= 0 && end > start);

  const opened = [];
  const requests = [];
  const toasts = [];

  let active = true;

  const context = vm.createContext({
    allLists: [],
    activeListId: null,
    listDetailOpenRequestVersion: 0,
    listsLoadRequestVersion: 0,

    _normalizeId(value) {
      return String(value ?? "").trim() || null;
    },

    document: {
      querySelector() {
        return {
          classList: {
            contains() {
              return active;
            }
          }
        };
      }
    },

    window: {
      Router: {
        showView() {
          active = true;
          context.listDetailOpenRequestVersion++;
        }
      },

      toast(payload) {
        toasts.push(payload);
      }
    },

    ApiClient: {
      getListsForNavigation() {
        const request = deferred();

        requests.push(request);

        return request.promise;
      }
    },

    async load() {},
    applyFilters() {},
    closeListDetail() {},
    t: key => key,

    async openListDetail(id) {
      opened.push(id);
    },

    console: { error() {} }
  });

  const open = vm.runInContext(
    lists.slice(start, end) + "\nopenListFromNavigation",
    context
  );

  return {
    opened,
    requests,
    toasts,

    open(id) {
      return open({
        detail: {
          listId: id,
          source: "sidebar"
        }
      });
    },

    leave() {
      active = false;
      context.listDetailOpenRequestVersion++;
    }
  };
}

test("DS-08.2: solo se abre la ultima lista solicitada", async () => {
  const h = navigationHarness();

  const old = h.open("a");

  await tick();

  const latest = h.open("b");

  await tick();

  assert.equal(h.requests.length, 2);

  h.requests[1].resolve([{ id: "b" }]);

  await latest;

  h.requests[0].resolve([{ id: "a" }]);

  await old;

  assert.deepEqual(h.opened, ["b"]);
});

test("DS-08.2: salir de Listas invalida una apertura pendiente", async () => {
  const h = navigationHarness();

  const operation = h.open("a");

  await tick();

  h.leave();

  h.requests[0].resolve([{ id: "a" }]);

  await operation;

  assert.deepEqual(h.opened, []);
});

test("DS-08.2: un acceso retirado no abre el detalle", async () => {
  const h = navigationHarness();

  const operation = h.open("a");

  await tick();

  h.requests[0].resolve([]);

  await operation;

  assert.deepEqual(h.opened, []);
  assert.equal(h.toasts.length, 1);
});
