import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const library = fs.readFileSync(
  new URL("../../assets/js/app/library.js", import.meta.url),
  "utf8"
);

const i18n = fs.readFileSync(
  new URL("../../assets/js/app/i18n.js", import.meta.url),
  "utf8"
);

const css = fs.readFileSync(
  new URL("../../assets/css/dashboard.css", import.meta.url),
  "utf8"
);

test("el progreso rápido utiliza una clave de traducción", () => {
  assert.match(
    library,
    /t\(["']library_progress_updating["']\)/
  );
});

test("el texto de actualización existe en español e inglés", () => {
  assert.match(
    i18n,
    /library_progress_updating:\s*"Actualizando…"/
  );

  assert.match(
    i18n,
    /library_progress_updating:\s*"Updating…"/
  );
});

test("los botones de progreso controlan el desbordamiento", () => {
  assert.match(
    css,
    /#view-library \.lib-footer-actions \.lib-primary-btn\s*\{[^}]*overflow:\s*hidden/s
  );

  assert.match(
    css,
    /#view-library \.lib-footer-actions \.lib-primary-btn span:not\(\.btn-spinner\)\s*\{[^}]*text-overflow:\s*ellipsis/s
  );
});

test("el spinner conserva su espacio y el botón completar no se comprime", () => {
  assert.match(
    css,
    /#view-library \.lib-footer-actions \.lib-primary-btn \.btn-spinner\s*\{[^}]*flex:\s*0 0 auto/s
  );

  assert.match(
    css,
    /#view-library \.lib-footer-actions \.lib-complete-btn\s*\{[^}]*flex-shrink:\s*0/s
  );
});


test("FakeBackend normaliza los once elementos demo con identidades válidas", async () => {
  const vm = await import("node:vm");

  const mock = fs.readFileSync(
    new URL("../../assets/js/data/mock-data.js", import.meta.url),
    "utf8"
  );

  const store = new Map();

  const context = vm.createContext({
    localStorage: {
      getItem: key => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: key => store.delete(key)
    },
    console,
    Date,
    Math,
    JSON
  });

  vm.runInContext(mock, context);

  const items = vm.runInContext(
    "FakeBackend.getState().library",
    context
  );

  assert.equal(items.length, 11);

  const uuids = new Set();

  for (const item of items) {
    assert.equal(item.source, "manual");
    assert.match(
      item.externalId,
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    assert.equal(uuids.has(item.externalId), false);
    uuids.add(item.externalId);
  }
});

test("FakeBackend repara los registros demo antiguos sin borrar su progreso", async () => {
  const vm = await import("node:vm");

  const mock = fs.readFileSync(
    new URL("../../assets/js/data/mock-data.js", import.meta.url),
    "utf8"
  );

  const storage = new Map();

  const context = vm.createContext({
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key)
    },
    console,
    Date,
    Math,
    JSON
  });

  vm.runInContext(mock, context);

  const initial = vm.runInContext(
    "FakeBackend.getState()",
    context
  );

  const legacy = JSON.parse(JSON.stringify(initial));
  const expanse = legacy.library.find(
    item => item.id === "bk_serie_02"
  );

  delete expanse.source;
  delete expanse.externalId;
  expanse.progress = 73;
  expanse.meta.episode = 7;

  storage.set("quacker_data_v1", JSON.stringify(legacy));

  const restored = vm.runInContext(
    "FakeBackend.getState()",
    context
  );

  const updated = restored.library.find(
    item => item.id === "bk_serie_02"
  );

  assert.equal(updated.source, "manual");
  assert.ok(updated.externalId);
  assert.equal(updated.progress, 73);
  assert.equal(updated.meta.episode, 7);
});

test("FakeBackend conserva identidades existentes", async () => {
  const vm = await import("node:vm");

  const mock = fs.readFileSync(
    new URL("../../assets/js/data/mock-data.js", import.meta.url),
    "utf8"
  );

  const storage = new Map();

  const context = vm.createContext({
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key)
    },
    console,
    Date,
    Math,
    JSON
  });

  vm.runInContext(mock, context);

  const initial = JSON.parse(JSON.stringify(
    vm.runInContext("FakeBackend.getState()", context)
  ));

  const expanse = initial.library.find(
    item => item.id === "bk_serie_02"
  );

  expanse.source = "tmdb";
  expanse.externalId = "12345";

  storage.set("quacker_data_v1", JSON.stringify(initial));

  const restored = vm.runInContext(
    "FakeBackend.getState()",
    context
  );

  const updated = restored.library.find(
    item => item.id === "bk_serie_02"
  );

  assert.equal(updated.source, "tmdb");
  assert.equal(updated.externalId, "12345");
});
