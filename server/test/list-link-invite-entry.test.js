import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const moduleUrl = new URL(
  "../../assets/js/app/list-link-invite-entry.js",
  import.meta.url
);

const exists = fs.existsSync(moduleUrl);

const token = "A".repeat(43);

const storageKey =
  "quacker:pending-list-invite";

function createHarness({
  hash = "",
  search = "",
  sharedStorage = null,
  storageAvailable = true
} = {}) {
  const values = sharedStorage || new Map();
  const historyCalls = [];
  const apiCalls = [];

  const storage = {
    getItem(key) {
      if (!storageAvailable) {
        throw new Error("storage_unavailable");
      }
      return values.has(key)
        ? values.get(key)
        : null;
    },
    setItem(key, value) {
      if (!storageAvailable) {
        throw new Error("storage_unavailable");
      }
      values.set(key, String(value));
    },
    removeItem(key) {
      if (!storageAvailable) {
        throw new Error("storage_unavailable");
      }
      values.delete(key);
    }
  };

  const location = {
    pathname: "/index.html",
    search,
    hash
  };

  const history = {
    replaceState(_state, _title, url) {
      historyCalls.push(url);

      const position = url.indexOf("#");

      location.hash =
        position < 0
          ? ""
          : url.slice(position);
    }
  };

  const window = {
    location,
    history,
    sessionStorage: storage
  };

  const context = {
    window,
    document: {
      title: "Quacker"
    },
    URLSearchParams,
    console: {
      error() {},
      warn() {},
      log() {
        throw new Error(
          "El token no debe registrarse en consola"
        );
      }
    },
    ApiClient: {
      acceptListLinkInvite() {
        apiCalls.push("accept");

        throw new Error(
          "No debe aceptarse automaticamente"
        );
      }
    }
  };

  const source = fs.readFileSync(
    moduleUrl,
    "utf8"
  );

  vm.runInNewContext(
    source,
    context,
    {
      filename: "list-link-invite-entry.js",
      timeout: 3000
    }
  );

  const api = window.ListLinkInviteEntry;

  assert.ok(api);

  for (const method of [
    "parseListInviteHash",
    "captureFromLocation",
    "getPendingToken",
    "clearPendingToken"
  ]) {
    assert.equal(
      typeof api[method],
      "function",
      `Falta metodo ${method}`
    );
  }

  return {
    api,
    values,
    location,
    historyCalls,
    apiCalls
  };
}

test(
  "QK-184-SEC-06 ENTRY: existe modulo compartido",
  () => {
    assert.ok(
      exists,
      "ENTRY_MODULO_AUSENTE"
    );
  }
);

test(
  "QK-184-SEC-06 ENTRY: valida formato estricto",
  { skip: !exists },
  () => {
    const h = createHarness();

    assert.equal(
      h.api.parseListInviteHash(
        `#list-invite=${token}`
      ),
      token
    );

    const invalid = [
      "",
      "#list-invite=",
      "#list-invite=short",
      "#list-invite=" + "A".repeat(44),
      "#list-invite=invalid%20token",
      "#list-invite=" + token + "&x=1",
      "#reset=" + token,
      "#lists",
      "#list-invite=" + token + "#other"
    ];

    for (const value of invalid) {
      assert.equal(
        h.api.parseListInviteHash(value),
        null,
        `Fragmento inesperadamente valido: ${value}`
      );
    }
  }
);

test(
  "QK-184-SEC-06 ENTRY: captura y limpia URL",
  { skip: !exists },
  () => {
    const h = createHarness({
      hash: `#list-invite=${token}`,
      search: "?lang=es"
    });

    // Debe funcionar tanto si el modulo captura
    // automaticamente al cargarse como manualmente.
    h.api.captureFromLocation();

    assert.equal(
      h.api.getPendingToken(),
      token
    );

    assert.equal(
      h.values.get(storageKey),
      token
    );

    assert.equal(
      h.location.hash,
      ""
    );

    assert.ok(
      h.historyCalls.some(
        url => url === "/index.html?lang=es"
      )
    );

    assert.equal(
      h.apiCalls.length,
      0
    );
  }
);

test(
  "QK-184-SEC-06 ENTRY: conserva token tras login",
  { skip: !exists },
  () => {
    const sharedStorage = new Map();

    const landing = createHarness({
      hash: `#list-invite=${token}`,
      sharedStorage
    });

    landing.api.captureFromLocation();

    const dashboard = createHarness({
      sharedStorage
    });

    assert.equal(
      dashboard.api.getPendingToken(),
      token
    );

    assert.equal(
      dashboard.apiCalls.length,
      0
    );
  }
);

test(
  "QK-184-SEC-06 ENTRY: permite descartar invitacion",
  { skip: !exists },
  () => {
    const h = createHarness({
      hash: `#list-invite=${token}`
    });

    h.api.captureFromLocation();

    h.api.clearPendingToken();

    assert.equal(
      h.api.getPendingToken(),
      null
    );

    assert.equal(
      h.values.has(storageKey),
      false
    );
  }
);

test(
  "QK-184-SEC-06 ENTRY: respeta recuperacion password",
  { skip: !exists },
  () => {
    const h = createHarness({
      hash: "#reset=token-de-recuperacion"
    });

    h.api.captureFromLocation();

    assert.equal(
      h.location.hash,
      "#reset=token-de-recuperacion"
    );

    assert.equal(
      h.api.getPendingToken(),
      null
    );

    assert.equal(
      h.historyCalls.length,
      0
    );
  }
);

test(
  "QK-184-SEC-06 ENTRY: ignora enlace malformado",
  { skip: !exists },
  () => {
    const h = createHarness({
      hash: "#list-invite=short"
    });

    h.api.captureFromLocation();

    assert.equal(
      h.api.getPendingToken(),
      null
    );

    assert.equal(
      h.apiCalls.length,
      0
    );
  }
);

test(
  "QK-184-SEC-06 ENTRY: no sobrescribe otra invitacion",
  { skip: !exists },
  () => {
    const h = createHarness();

    h.values.set(
      storageKey,
      token
    );

    h.api.captureFromLocation();

    assert.equal(
      h.api.getPendingToken(),
      token
    );
  }
);

test(
  "QK-184-SEC-06 ENTRY: almacenamiento no disponible",
  { skip: !exists },
  () => {
    const h = createHarness({
      hash: `#list-invite=${token}`,
      storageAvailable: false
    });

    assert.doesNotThrow(() => {
      h.api.captureFromLocation();
      h.api.getPendingToken();
      h.api.clearPendingToken();
    });

    assert.equal(
      h.apiCalls.length,
      0
    );
  }
);

test(
  "QK-184-SEC-06 ENTRY: nunca acepta automaticamente",
  { skip: !exists },
  () => {
    const h = createHarness({
      hash: `#list-invite=${token}`
    });

    h.api.captureFromLocation();
    h.api.getPendingToken();

    assert.equal(
      h.apiCalls.length,
      0
    );
  }
);
