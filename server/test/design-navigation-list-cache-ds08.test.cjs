"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");

const original = fs.readFileSync(
    path.join(root, "assets/js/data/api-client.js"),
    "utf8"
);

function extract(name) {
    const lines = original.split(/\r?\n/);

    const pattern = new RegExp(
        "^  (?:async )?function " + name + "\\("
    );

    const start = lines.findIndex(
        line => pattern.test(line)
    );

    assert.ok(start >= 0, name);

    const end = lines.findIndex(
        (line, index) =>
            index > start &&
            line.trimEnd() === "  }"
    );

    assert.ok(end > start, name);

    return lines.slice(start, end + 1).join("\n");
}

const names = [
    "_invalidateListsCache",
    "_getListsCacheSnapshot",
    "_setListsCache",
    "getLists",
    "getListsForNavigation"
];

const ttl = original.match(
    /const LISTS_CACHE_TTL_MS\s*=\s*[^;\n]+;/
);

assert.ok(ttl, "TTL no localizado");

const source = [
    ttl[0],
    ...names.map(extract)
].join("\n\n");

function deferred() {
    let resolve;
    let reject;

    const promise = new Promise((yes, no) => {
        resolve = yes;
        reject = no;
    });

    return { promise, resolve, reject };
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function list(id) {
    return {
        id,
        name: "Lista ficticia " + id,
        visibility: "private",
        items: []
    };
}

function ids(items) {
    return Array.from(items, entry => entry.id);
}

function harness() {
    const requests = [];
    const responses = [];

    const context = vm.createContext({
        __cfg: {
            transport: "http"
        },

        _listsCache: null,
        listsCacheReadVersion: 0,
        listsCacheDirectVersion: 0,

        _isHttp: () => true,

        _cloneCollection: clone,

        _normalizeListCollection(items) {
            return clone(items);
        },

        _makeApiError(message) {
            return new Error(message);
        },

        _safeState() {
            throw new Error(
                "No se permite estado local en HTTP"
            );
        },

        async _httpJson(method, endpoint) {
            assert.equal(method, "GET");
            assert.equal(endpoint, "/lists");

            requests.push({ method, endpoint });

            assert.ok(
                responses.length > 0,
                "Peticion HTTP inesperada"
            );

            return responses.shift()();
        },

        console: {
            error() {}
        }
    });

    vm.runInContext(
        source,
        context,
        { filename: "quacker-api-cache-original.js" }
    );

    context._invalidateListsCache();

    return {
        requests,

        reply(items) {
            responses.push(
                () => Promise.resolve(clone(items))
            );
        },

        fail(message) {
            responses.push(
                () => Promise.reject(new Error(message))
            );
        },

        pending() {
            const request = deferred();

            responses.push(() => request.promise);

            return request;
        },

        ordinary() {
            return context.getLists();
        },

        direct() {
            return context.getListsForNavigation();
        },

        invalidate() {
            context._invalidateListsCache();
        }
    };
}

test("DS-08.2 cache control: una lectura ordinaria reutiliza la cache", async () => {
    const h = harness();

    h.reply([list("a")]);

    assert.deepEqual(
        ids(await h.ordinary()),
        ["a"]
    );

    assert.deepEqual(
        ids(await h.ordinary()),
        ["a"]
    );

    assert.equal(h.requests.length, 1);
});

test("DS-08.2 cache control: la lectura directa no usa fallback", async () => {
    const h = harness();

    h.reply([list("a")]);

    await h.ordinary();

    h.fail("network_failure");

    await assert.rejects(
        h.direct(),
        /network_failure/
    );

    assert.equal(h.requests.length, 2);
});

test("DS-08.2 cache race: una lectura directa actualiza una cache anterior", async () => {
    const h = harness();

    h.reply([list("a")]);

    await h.ordinary();

    h.reply([list("b")]);

    assert.deepEqual(
        ids(await h.direct()),
        ["b"]
    );

    assert.deepEqual(
        ids(await h.ordinary()),
        ["b"]
    );

    assert.equal(h.requests.length, 2);
});

test("DS-08.2 cache race: una respuesta ordinaria antigua no sobrescribe la directa", async () => {
    const h = harness();

    const pending = h.pending();

    const old = h.ordinary();

    assert.equal(h.requests.length, 1);

    h.reply([list("b")]);

    assert.deepEqual(
        ids(await h.direct()),
        ["b"]
    );

    pending.resolve([list("a")]);

    await old;

    assert.deepEqual(
        ids(await h.ordinary()),
        ["b"]
    );

    assert.equal(h.requests.length, 2);
});

test("DS-08.2 cache race: una lectura directa antigua no sobrescribe otra posterior", async () => {
    const h = harness();

    h.reply([list("initial")]);

    await h.ordinary();

    const pending = h.pending();

    const old = h.direct();

    h.reply([list("b")]);

    assert.deepEqual(
        ids(await h.direct()),
        ["b"]
    );

    pending.resolve([list("a")]);

    await old;

    assert.deepEqual(
        ids(await h.ordinary()),
        ["b"]
    );

    assert.equal(h.requests.length, 3);
});

test("DS-08.2 cache race: invalidar la cache descarta escrituras pendientes", async () => {
    const h = harness();

    const pending = h.pending();

    const old = h.ordinary();

    assert.equal(h.requests.length, 1);

    h.invalidate();

    pending.resolve([list("removed")]);

    await old;

    h.reply([list("current")]);

    assert.deepEqual(
        ids(await h.ordinary()),
        ["current"]
    );

    assert.equal(h.requests.length, 2);
});


test("DS-08.2 cache race: una directa prevalece sobre una ordinaria iniciada mientras estaba pendiente", async () => {
    const h = harness();

    const directResponse = h.pending();
    const direct = h.direct();

    const ordinaryResponse = h.pending();
    const ordinary = h.ordinary();

    directResponse.resolve([list("b")]);

    assert.deepEqual(
        ids(await direct),
        ["b"]
    );

    ordinaryResponse.resolve([list("a")]);

    await ordinary;

    assert.deepEqual(
        ids(await h.ordinary()),
        ["b"]
    );

    assert.equal(h.requests.length, 2);
});

test("DS-08.2 cache race: una directa posterior en responder actualiza la cache ordinaria concurrente", async () => {
    const h = harness();

    const directResponse = h.pending();
    const direct = h.direct();

    const ordinaryResponse = h.pending();
    const ordinary = h.ordinary();

    ordinaryResponse.resolve([list("a")]);

    await ordinary;

    directResponse.resolve([list("b")]);

    assert.deepEqual(
        ids(await direct),
        ["b"]
    );

    assert.deepEqual(
        ids(await h.ordinary()),
        ["b"]
    );

    assert.equal(h.requests.length, 2);
});

test("DS-08.2 cache control: invalidar descarta una escritura directa pendiente", async () => {
    const h = harness();

    const pending = h.pending();
    const old = h.direct();

    h.invalidate();

    pending.resolve([list("removed")]);

    await old;

    h.reply([list("current")]);

    assert.deepEqual(
        ids(await h.ordinary()),
        ["current"]
    );

    assert.equal(h.requests.length, 2);
});

test("DS-08.2 cache race: dos lecturas ordinarias conservan la escritura mas reciente", async () => {
    const h = harness();

    const firstResponse = h.pending();
    const first = h.ordinary();

    const secondResponse = h.pending();
    const second = h.ordinary();

    secondResponse.resolve([list("b")]);

    await second;

    firstResponse.resolve([list("a")]);

    await first;

    assert.deepEqual(
        ids(await h.ordinary()),
        ["b"]
    );

    assert.equal(h.requests.length, 2);
});

test("DS-08.2 cache control: una respuesta directa invalida no sustituye una cache valida", async () => {
    const h = harness();

    h.reply([list("a")]);

    await h.ordinary();

    h.reply({ unexpected: true });

    await assert.rejects(
        h.direct(),
        /invalid_lists_response/
    );

    assert.deepEqual(
        ids(await h.ordinary()),
        ["a"]
    );

    assert.equal(h.requests.length, 2);
});
