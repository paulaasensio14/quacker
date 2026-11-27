"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");

const original = fs.readFileSync(
    path.join(root, "assets/js/app/lists.js"),
    "utf8"
);

function extract(name) {
    const lines = original.split(/\r?\n/);

    const pattern = new RegExp(
        "^  (?:async )?function " +
        name +
        "\\("
    );

    const start = lines.findIndex(
        line => pattern.test(line)
    );

    assert.ok(start >= 0, "Funcion no encontrada: " + name);

    const end = lines.findIndex(
        (line, index) =>
            index > start &&
            line.trimEnd() === "  }"
    );

    assert.ok(end > start, "Cierre no encontrado: " + name);

    return lines.slice(start, end + 1).join("\n");
}

const functions = [
    "load",
    "applyFilters",
    "openListDetail",
    "closeListDetail",
    "openListFromNavigation"
];

const source = functions.map(extract).join("\n\n");

function deferred() {
    let resolve;
    let reject;

    const promise = new Promise((yes, no) => {
        resolve = yes;
        reject = no;
    });

    return { promise, resolve, reject };
}

async function waitFor(predicate) {
    for (let i = 0; i < 30; i++) {
        if (predicate()) return;

        await new Promise(resolve => {
            setImmediate(resolve);
        });
    }

    assert.fail("No se alcanzo la peticion esperada");
}

function list(id) {
    return {
        id,
        name: "Lista ficticia " + id,
        visibility: "private",
        items: []
    };
}

function harness() {
    const ordinary = [];
    const fresh = [];
    const selections = [];
    const toasts = [];
    const elements = new Map();

    function getElement(id) {
        if (!elements.has(id)) {
            elements.set(id, {
                hidden: id === "listDetail",
                textContent: ""
            });
        }

        return elements.get(id);
    }

    const context = vm.createContext({
        allLists: [],
        visibleLists: [],
        activeListId: null,

        activeDetailItemsRequestVersion: 0,
        listDetailOpenRequestVersion: 0,
        listsLoadRequestVersion: 0,
        collaborationIdentityRequestVersion: 0,

        activeDetailTab: "content",
        listsFilter: "all",
        searchTerm: "",

        ApiClient: {
            getLists() {
                const request = deferred();

                ordinary.push(request);

                return request.promise;
            },

            getListsForNavigation() {
                const request = deferred();

                fresh.push(request);

                return request.promise;
            }
        },

        document: {
            getElementById: getElement,

            querySelector() {
                return {
                    classList: {
                        contains() {
                            return true;
                        }
                    }
                };
            }
        },

        window: {
            Router: {
                showView() {}
            },

            SidebarLists: {
                select(id) {
                    selections.push(id);
                }
            },

            toast(payload) {
                toasts.push(payload);
            }
        },

        console: {
            error() {}
        },

        t: key => key,

        _normalizeId(value) {
            return String(value ?? "").trim() || null;
        },

        _getEl: getElement,

        _setHidden(element, hidden) {
            if (element) {
                element.hidden = hidden;
            }
        },

        async _loadUIState() {},
        async _ensureCurrentUserId() {},
        async _loadListsOverviewLibrary() {},

        renderListsSkeleton() {},
        _syncListsToolbarUI() {},
        _syncListDetailFiltersUI() {},
        _setListsOverviewControlsHidden() {},
        closeListMemberSuggestions() {},
        resetListLinkInviteUI() {},
        _renderActiveListDetailHeader() {},
        renderListCollaboration() {},
        activateListDetailTab() {},
        render() {},

        async renderActiveListPolls() {},
        async renderActiveListItems() {},

        requestAnimationFrame(callback) {
            callback();
        }
    });

    vm.runInContext(
        source,
        context,
        { filename: "quacker-lists-original.js" }
    );

    return {
        ordinary,
        fresh,
        selections,
        toasts,

        load() {
            return context.load();
        },

        open(id) {
            return context.openListFromNavigation({
                detail: {
                    listId: id,
                    source: "sidebar"
                }
            });
        },

        ids() {
            return Array.from(
                context.allLists,
                entry => entry.id
            );
        },

        visibleIds() {
            return Array.from(
                context.visibleLists,
                entry => entry.id
            );
        },

        activeId() {
            return context.activeListId;
        },

        detailHidden() {
            return getElement("listDetail").hidden;
        }
    };
}

async function openThroughSidebar(
    h,
    id,
    ordinaryResponse,
    freshResponse
) {
    const ordinaryIndex = h.ordinary.length;
    const freshIndex = h.fresh.length;

    const operation = h.open(id);

    await waitFor(
        () => h.ordinary.length > ordinaryIndex
    );

    h.ordinary[ordinaryIndex].resolve(ordinaryResponse);

    await waitFor(
        () => h.fresh.length > freshIndex
    );

    h.fresh[freshIndex].resolve(freshResponse);

    await operation;
}

test("DS-08.2 control: carga ordinaria correcta", async () => {
    const h = harness();

    const operation = h.load();

    await waitFor(() => h.ordinary.length === 1);

    h.ordinary[0].resolve([list("a")]);

    await operation;

    assert.deepEqual(h.ids(), ["a"]);
    assert.deepEqual(h.visibleIds(), ["a"]);
});

test("DS-08.2 control: apertura lateral correcta", async () => {
    const h = harness();

    await openThroughSidebar(
        h,
        "b",
        [list("a")],
        [list("b")]
    );

    assert.deepEqual(h.ids(), ["b"]);
    assert.equal(h.activeId(), "b");
    assert.equal(h.detailHidden(), false);
});

test("DS-08.2 race: una carga antigua no sobrescribe la reciente", async () => {
    const h = harness();

    const old = h.load();

    await waitFor(() => h.ordinary.length === 1);

    const latest = h.load();

    await waitFor(() => h.ordinary.length === 2);

    h.ordinary[1].resolve([list("b")]);

    await latest;

    assert.deepEqual(h.ids(), ["b"]);

    h.ordinary[0].resolve([list("a")]);

    await old;

    assert.deepEqual(h.ids(), ["b"]);
    assert.deepEqual(h.visibleIds(), ["b"]);
});

test("DS-08.2 race: un error antiguo no vacia la carga reciente", async () => {
    const h = harness();

    const old = h.load();

    await waitFor(() => h.ordinary.length === 1);

    const latest = h.load();

    await waitFor(() => h.ordinary.length === 2);

    h.ordinary[1].resolve([list("b")]);

    await latest;

    assert.deepEqual(h.ids(), ["b"]);

    h.ordinary[0].reject(
        new Error("Error antiguo simulado")
    );

    await old;

    assert.deepEqual(h.ids(), ["b"]);
    assert.deepEqual(h.visibleIds(), ["b"]);
});

test("DS-08.2 race: una carga antigua no cierra un detalle valido", async () => {
    const h = harness();

    const background = h.load();

    await waitFor(() => h.ordinary.length === 1);

    await openThroughSidebar(
        h,
        "b",
        [list("a")],
        [list("b")]
    );

    assert.equal(h.activeId(), "b");
    assert.equal(h.detailHidden(), false);

    h.ordinary[0].resolve([list("a")]);

    await background;

    assert.equal(h.activeId(), "b");
    assert.equal(h.detailHidden(), false);
    assert.deepEqual(h.ids(), ["b"]);
});

test("DS-08.2 race: una carga antigua no recupera una lista retirada", async () => {
    const h = harness();

    const background = h.load();

    await waitFor(() => h.ordinary.length === 1);

    await openThroughSidebar(
        h,
        "a",
        [list("a")],
        []
    );

    assert.deepEqual(h.ids(), []);
    assert.equal(h.activeId(), null);
    assert.equal(h.detailHidden(), true);
    assert.equal(h.toasts.length, 1);

    h.ordinary[0].resolve([list("a")]);

    await background;

    assert.deepEqual(h.ids(), []);
    assert.deepEqual(h.visibleIds(), []);
    assert.equal(h.detailHidden(), true);
});


test("DS-08.2 race: la verificacion directa invalida una carga ordinaria concurrente", async () => {
    const h = harness();

    const opening = h.open("b");

    await waitFor(() => h.ordinary.length === 1);

    h.ordinary[0].resolve([list("a")]);

    await waitFor(() => h.fresh.length === 1);

    const background = h.load();

    await waitFor(() => h.ordinary.length === 2);

    h.fresh[0].resolve([list("b")]);

    await opening;

    assert.equal(h.activeId(), "b");

    h.ordinary[1].resolve([list("a")]);

    await background;

    assert.deepEqual(h.ids(), ["b"]);
    assert.deepEqual(h.visibleIds(), ["b"]);
    assert.equal(h.activeId(), "b");
    assert.equal(h.detailHidden(), false);
});

test("DS-08.2 control: el error de la carga actual mantiene su comportamiento", async () => {
    const h = harness();

    const initial = h.load();

    await waitFor(() => h.ordinary.length === 1);

    h.ordinary[0].resolve([list("a")]);

    await initial;

    assert.deepEqual(h.ids(), ["a"]);

    const latest = h.load();

    await waitFor(() => h.ordinary.length === 2);

    h.ordinary[1].reject(
        new Error("Error actual simulado")
    );

    await latest;

    assert.deepEqual(h.ids(), []);
    assert.deepEqual(h.visibleIds(), []);
});
