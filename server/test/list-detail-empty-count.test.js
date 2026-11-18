import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(
  new URL("../../assets/js/app/lists.js", import.meta.url),
  "utf8"
);

const marker = "  return { init, load, render };";

assert.equal(
  source.split(marker).length,
  2,
  "Exportacion de ListsModule inesperada"
);

const instrumented = source.replace(
  marker,
  `  return {
    __setState(lists, listId) {
      allLists = lists;
      activeListId = listId;
    },
    __render: renderActiveListItems,
    __header: _renderActiveListDetailHeader,
    __remove: removeItemFromActiveList
  };`
);

function createHarness(itemIds = []) {
  const ids = [
    "listDetailItemsGrid",
    "listDetailEmpty",
    "listDetailError",
    "listDetailHint",
    "listDetailShowing",
    "listDetailTitle",
    "listDetailVisibility",
    "listDetailDescription",
    "listDetailCount"
  ];

  const elements = Object.fromEntries(
    ids.map(id => [
      id,
      {
        textContent: "",
        innerHTML: "",
        hidden: false,
        classList: {
          add() {},
          remove() {}
        }
      }
    ])
  );

  const list = {
    id: "list-test",
    name: "Lista de prueba",
    visibility: "private",
    description: "",
    items: itemIds.map(id => ({ id })),
    itemsCount: itemIds.length
  };

  const toasts = [];
  const calls = {
    removed: [],
    added: []
  };

  const window = {
    I18n: {
      t(key) {
        return key;
      }
    },
    toast(payload) {
      toasts.push(payload);
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
    async removeLibraryItemFromList(listId, itemId) {
      calls.removed.push({ listId, itemId });
      return { ok: true };
    },

    async addLibraryItemToList(listId, itemId) {
      calls.added.push({ listId, itemId });
      return { ok: true };
    },

    async getLibrary() {
      return [{
        id: "item-test",
        title: "Contenido de prueba",
        type: "pelicula",
        progress: 0
      }];
    }
  };

  vm.runInNewContext(
    instrumented,
    {
      window,
      document,
      ApiClient,
      console
    },
    {
      filename: "lists.js",
      timeout: 3000
    }
  );

  const module = window.ListsModule;

  assert.ok(module);

  module.__setState([list], list.id);

  return {
    module,
    list,
    elements,
    toasts,
    calls
  };
}

test(
  "al quedar vacia, la lista limpia Mostrando 1 de 1",
  async () => {
    const h = createHarness([]);

    h.elements.listDetailShowing.textContent =
      "Mostrando 1 de 1";

    await h.module.__render();

    assert.equal(
      h.elements.listDetailShowing.textContent,
      "",
      "FALLO_ESPERADO_950_SHOWING"
    );

    assert.equal(
      h.elements.listDetailItemsGrid.innerHTML,
      ""
    );
  }
);

test(
  "al quitar el ultimo contenido actualiza el encabezado a cero",
  async () => {
    const h = createHarness(["item-test"]);

    h.module.__header(h.list);

    assert.equal(
      h.elements.listDetailCount.textContent,
      "1 lists_item_singular"
    );

    await h.module.__remove(
      "item-test",
      { canUndo: false }
    );

    assert.equal(h.list.items.length, 0);
    assert.equal(h.list.itemsCount, 0);

    assert.equal(
      h.elements.listDetailCount.textContent,
      "0 lists_item_plural",
      "FALLO_ESPERADO_950_HEADER"
    );
  }
);


test(
  "Deshacer restaura el contenido y el contador del encabezado",
  async () => {
    const h = createHarness(["item-test"]);

    h.module.__header(h.list);

    await h.module.__remove(
      "item-test",
      { canUndo: true }
    );

    assert.equal(h.calls.removed.length, 1);
    assert.equal(h.list.items.length, 0);
    assert.equal(h.list.itemsCount, 0);
    assert.equal(
      h.elements.listDetailCount.textContent,
      "0 lists_item_plural"
    );

    const undoToast = h.toasts.find(
      toast =>
        toast.actionLabel === "lists_undo" &&
        typeof toast.onAction === "function"
    );

    assert.ok(
      undoToast,
      "Debe existir una accion Deshacer"
    );

    await undoToast.onAction();

    assert.equal(h.calls.added.length, 1);
    assert.equal(h.calls.added[0].listId, "list-test");
    assert.equal(h.calls.added[0].itemId, "item-test");

    assert.equal(h.list.items.length, 1);
    assert.equal(h.list.itemsCount, 1);

    assert.equal(
      h.elements.listDetailCount.textContent,
      "1 lists_item_singular"
    );

    assert.match(
      h.elements.listDetailItemsGrid.innerHTML,
      /item-test/
    );
  }
);

test(
  "una lista inexistente limpia el indicador Mostrando",
  async () => {
    const h = createHarness([]);

    h.elements.listDetailShowing.textContent =
      "Mostrando 1 de 1";

    h.module.__setState([], "list-test");

    await h.module.__render();

    assert.equal(
      h.elements.listDetailShowing.textContent,
      ""
    );

    assert.equal(
      h.elements.listDetailItemsGrid.innerHTML,
      ""
    );
  }
);
