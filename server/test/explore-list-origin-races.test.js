import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(
  new URL("../../assets/js/app/explore.js", import.meta.url),
  "utf8"
);

function extractFunction() {
  const begin = source.indexOf(
    "async function _populateExploreListPicker("
  );

  const end = source.indexOf(
    "async function _openExploreListPicker(",
    begin
  );

  assert.ok(begin >= 0, "Funcion de poblacion disponible");
  assert.ok(end > begin, "Limite de funcion disponible");

  return source.slice(begin, end);
}

function deferred() {
  let resolve;

  const promise = new Promise((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

function createSelect() {
  const select = {
    options: [],
    value: "",
    disabled: false,

    appendChild(option) {
      this.options.push(option);
    }
  };

  Object.defineProperty(select, "innerHTML", {
    configurable: true,

    get() {
      return "";
    },

    set() {
      this.options = [];
      this.value = "";
    }
  });

  return select;
}

function makeHarness(getLists, initialOrigin = "A") {
  const select = createSelect();
  const confirmBtn = { disabled: false };

  let originId = initialOrigin;
  let pickerOpen = true;
  let clearCount = 0;

  const context = {
    ApiClient: { getLists },
    __listPickerRequestSeq: { drawer: 0, detail: 0 },

    window: {
      I18n: {
        t(key) {
          return key;
        }
      }
    },

    document: {
      createElement() {
        return {
          value: "",
          textContent: ""
        };
      }
    },

    _normalizeId(value) {
      return String(value ?? "").trim();
    },

    _safeText(value) {
      return String(value ?? "");
    },

    _getExploreListPickerRefs() {
      return { select, confirmBtn };
    },

    _listOriginId() {
      return originId;
    },

    _clearListOriginContext() {
      originId = "";
      clearCount++;
    },

    _isExploreListPickerOpen() {
      return pickerOpen;
    },

    console: {
      error() {}
    }
  };

  vm.runInNewContext(
    extractFunction() +
      "\nthis.populate = _populateExploreListPicker;",
    context,
    {
      filename: "explore-picker-isolated.js",
      timeout: 1000
    }
  );

  return {
    select,
    confirmBtn,
    populate: context.populate,

    close() {
      pickerOpen = false;
    },

    getClearCount() {
      return clearCount;
    }
  };
}

test(
  "NAV-06: idioma conserva lista elegida manualmente",
  async () => {
    const lists = [
      { id: "A", name: "Lista A" },
      { id: "B", name: "Lista B" }
    ];

    const harness = makeHarness(async () => lists);

    await harness.populate("A", "drawer");

    assert.equal(harness.select.value, "A");

    // El usuario cambia manualmente a la lista B.
    harness.select.value = "B";

    // Simula recarga por cambio de idioma.
    await harness.populate(
      "A",
      "drawer",
      { preserveSelection: true }
    );

    assert.equal(
      harness.select.value,
      "B",
      "La recarga no debe sustituir la eleccion manual"
    );
  }
);

test(
  "NAV-06: respuesta tardia no modifica selector cerrado",
  async () => {
    const pending = deferred();

    const harness = makeHarness(
      () => pending.promise
    );

    const loading = harness.populate("A", "drawer");

    // El usuario cierra antes de recibir respuesta.
    harness.close();

    pending.resolve([
      { id: "A", name: "Lista A" }
    ]);

    await loading;

    assert.equal(
      harness.select.options.length,
      0,
      "Un selector cerrado no debe recibir resultados tardios"
    );

    assert.equal(
      harness.getClearCount(),
      0,
      "La respuesta tardia no debe borrar el origen"
    );
  }
);

test(
  "NAV-06: la respuesta mas reciente tiene prioridad",
  async () => {
    const slowRequest = deferred();
    let calls = 0;

    const harness = makeHarness(() => {
      calls++;

      if (calls === 1) {
        return slowRequest.promise;
      }

      return Promise.resolve([
        { id: "B", name: "Lista actual" }
      ]);
    });

    const oldLoad = harness.populate(null, "drawer");
    const newLoad = harness.populate(null, "drawer");

    await newLoad;

    slowRequest.resolve([
      { id: "A", name: "Lista antigua" }
    ]);

    await oldLoad;

    assert.deepEqual(
      harness.select.options.map(
        (option) => option.value
      ),
      ["", "B"],
      "Una respuesta antigua no debe sobrescribir la nueva"
    );
  }
);
