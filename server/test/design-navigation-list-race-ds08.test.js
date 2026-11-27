import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const original = fs.readFileSync(
  new URL(
    "../../assets/js/app/lists.js",
    import.meta.url
  ),
  "utf8"
);

const marker = "  return { init, load, render };";

assert.equal(original.split(marker).length, 2);

const source = original.replace(
  marker,
  `  return {
    __setState(lists, listId) {
      allLists = lists;
      activeListId = listId;
    },
    __render: renderActiveListItems
  };`
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

function element() {
  const classes = new Set();

  return {
    innerHTML: "",
    textContent: "",
    hidden: false,

    classList: {
      add(name) {
        classes.add(name);
      },
      remove(name) {
        classes.delete(name);
      },
      contains(name) {
        return classes.has(name);
      }
    }
  };
}

function createHarness() {
  const ids = [
    "listDetailItemsGrid",
    "listDetailEmpty",
    "listDetailError",
    "listDetailHint",
    "listDetailShowing"
  ];

  const elements = Object.fromEntries(
    ids.map(id => [id, element()])
  );

  const requests = [];

  const listA = {
    id: "list-a",
    name: "Lista A",
    visibility: "private",
    items: [{ id: "item-a" }]
  };

  const listB = {
    id: "list-b",
    name: "Lista B",
    visibility: "private",
    items: []
  };

  const library = [{
    id: "item-a",
    title: "Contenido A",
    type: "pelicula",
    progress: 0
  }];

  const window = {
    I18n: {
      t(key) {
        return key;
      }
    }
  };

  const document = {
    getElementById(id) {
      return elements[id] || null;
    },
    querySelector() {
      return null;
    }
  };

  const ApiClient = {
    getLibrary() {
      const request = deferred();
      requests.push(request);
      return request.promise;
    }
  };

  vm.runInNewContext(source, {
    window,
    document,
    ApiClient,
    console: {
      error() {}
    }
  });

  const module = window.ListsModule;

  function select(id) {
    module.__setState([listA, listB], id);
  }

  function snapshot() {
    return JSON.stringify(
      Object.fromEntries(
        ids.map(id => [
          id,
          {
            innerHTML: elements[id].innerHTML,
            textContent: elements[id].textContent,
            hidden: elements[id].hidden,
            initiallyHidden:
              elements[id].classList.contains(
                "is-initially-hidden"
              )
          }
        ])
      )
    );
  }

  return {
    module,
    elements,
    requests,
    library,
    select,
    snapshot
  };
}

test("DS-08.2: una carga antigua no sustituye otra lista", async () => {
  const h = createHarness();

  h.select("list-a");

  const old = h.module.__render();

  assert.equal(h.requests.length, 1);

  h.select("list-b");

  await h.module.__render();

  const expected = h.snapshot();

  h.requests[0].resolve(h.library);

  await old;

  assert.equal(h.snapshot(), expected);
});

test("DS-08.2: un error antiguo no altera otra lista", async () => {
  const h = createHarness();

  h.select("list-a");

  const old = h.module.__render();

  h.select("list-b");

  await h.module.__render();

  const expected = h.snapshot();

  h.requests[0].reject(
    new Error("Fallo simulado de la lista antigua")
  );

  await old;

  assert.equal(h.snapshot(), expected);
});

test("DS-08.2: prevalece la ultima carga de una misma lista", async () => {
  const h = createHarness();

  h.select("list-a");

  const old = h.module.__render();
  const latest = h.module.__render();

  assert.equal(h.requests.length, 2);

  h.requests[1].resolve(h.library);

  await latest;

  const expected = h.snapshot();

  h.requests[0].reject(
    new Error("Fallo de una peticion anterior")
  );

  await old;

  assert.equal(h.snapshot(), expected);
});

test("DS-08.2: cerrar el detalle invalida su respuesta pendiente", async () => {
  const h = createHarness();

  h.select("list-a");

  const old = h.module.__render();

  h.select(null);

  const expected = h.snapshot();

  h.requests[0].resolve(h.library);

  await old;

  assert.equal(h.snapshot(), expected);
});

test("DS-08.2: una respuesta actual conserva su renderizado", async () => {
  const h = createHarness();

  h.select("list-a");

  const operation = h.module.__render();

  h.requests[0].resolve(h.library);

  await operation;

  assert.match(
    h.elements.listDetailItemsGrid.innerHTML,
    /item-a/
  );

  assert.equal(
    h.elements.listDetailError.hidden,
    true
  );
});

test("DS-08.2: un error actual conserva su estado de recuperacion", async () => {
  const h = createHarness();

  h.select("list-a");

  const operation = h.module.__render();

  h.requests[0].reject(
    new Error("Fallo actual simulado")
  );

  await operation;

  assert.equal(
    h.elements.listDetailError.hidden,
    false
  );

  assert.equal(
    h.elements.listDetailItemsGrid.innerHTML,
    ""
  );
});
