import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const originalSource = fs.readFileSync(
  new URL("../../assets/js/app/profile.js", import.meta.url),
  "utf8"
);

const i18nSource = fs.readFileSync(
  new URL("../../assets/js/app/i18n.js", import.meta.url),
  "utf8"
);

const html = fs.readFileSync(
  new URL("../../dashboard.html", import.meta.url),
  "utf8"
);

const source = originalSource.replace(
  "  return { init, load, loadOpinionsView };",
  `  return {
    init,
    load,
    loadOpinionsView,
    __testBlocks: {
      renderBlockedUsers,
      loadBlockedUsers,
      bindBlockedUsers
    }
  };`
);

assert.notEqual(
  source,
  originalSource,
  "las funciones deben exponerse únicamente dentro del test"
);

class FakeElement {
  constructor(tag = "div") {
    this.tag = tag;
    this.children = [];
    this.parent = null;
    this.dataset = {};
    this.textContent = "";
    this.className = "";
    this.disabled = false;
    this.handlers = {};
    this.attributes = {};
  }

  replaceChildren(...children) {
    this.children = [];
    this.append(...children);
  }

  append(...children) {
    for (const child of children) {
      child.parent = this;
      this.children.push(child);
    }
  }

  remove() {
    if (!this.parent) return;

    const siblings = this.parent.children;
    const index = siblings.indexOf(this);

    if (index >= 0) {
      siblings.splice(index, 1);
    }

    this.parent = null;
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }

  addEventListener(type, handler) {
    this.handlers[type] = handler;
  }

  contains(target) {
    for (let node = target; node; node = node.parent) {
      if (node === this) return true;
    }
    return false;
  }

  closest(selector) {
    if (
      selector ===
        '[data-blocked-user-action="unblock"]' &&
      this.dataset.blockedUserAction === "unblock"
    ) {
      return this;
    }

    if (selector === ".profile-blocked-user-row") {
      for (let node = this; node; node = node.parent) {
        if (
          node.className
            .split(/\s+/)
            .includes("profile-blocked-user-row")
        ) {
          return node;
        }
      }
    }

    return null;
  }
}

function createHarness({
  initialBlocks = [{ username: "bob" }],
  confirmed = true,
  unblockError = null,
  loadError = null,
  loadErrorAfter = Infinity,
  language = "es",
  deferFirstLoad = false
} = {}) {
  let blocks = [...initialBlocks];
  let loadCount = 0;
  let resolveDeferredLoad = null;
  let rejectDeferredLoad = null;

  const unblockCalls = [];
  const messages = [];
  const confirmations = [];

  const list = new FakeElement();
  const status = new FakeElement();

  const elements = {
    "#profileBlockedUsersList": list,
    "#profileBlockedUsersStatus": status
  };

  const document = {
    querySelector(selector) {
      return elements[selector] || null;
    },
    createElement(tag) {
      return new FakeElement(tag);
    }
  };

  const window = {
    confirm(message) {
      confirmations.push(message);
      return confirmed;
    },
    toast(message) {
      messages.push(message);
    }
  };

  const ApiClient = {
    async getBlockedUsers() {
      loadCount += 1;

      if (loadError || loadCount > loadErrorAfter) {
        throw loadError || new Error("refresh_failed");
      }

      const snapshot =
        blocks.map((entry) => ({ ...entry }));

      if (deferFirstLoad && loadCount === 1) {
        return new Promise((resolve, reject) => {
          resolveDeferredLoad = () => resolve(snapshot);
          rejectDeferredLoad = () =>
            reject(new Error("stale_request_failed"));
        });
      }

      return snapshot;
    },

    async unblockUser(username) {
      unblockCalls.push(username);

      if (unblockError) throw unblockError;

      blocks = blocks.filter(
        (entry) => entry.username !== username
      );

      return {
        blocked: false,
        username
      };
    }
  };

  const context = {
    document,
    window,
    ApiClient,
    console,
    localStorage: {
      getItem() {
        return language;
      },
      setItem() {}
    }
  };

  vm.runInNewContext(
    i18nSource,
    context,
    { filename: "i18n.js" }
  );

  vm.runInNewContext(
    source,
    context,
    { filename: "profile.js" }
  );

  const actions =
    window.ProfileModule.__testBlocks;

  function firstButton() {
    return list.children[0]?.children[1] || null;
  }

  return {
    actions,
    list,
    status,
    confirmations,
    unblockCalls,
    messages,
    firstButton,
    get loadCount() {
      return loadCount;
    },
    setBlocks(nextBlocks) {
      blocks = [...nextBlocks];
    },
    releaseFirstLoad() {
      if (!resolveDeferredLoad) {
        throw new Error("No hay una carga pendiente.");
      }
      resolveDeferredLoad();
      resolveDeferredLoad = null;
    },
    rejectFirstLoad() {
      if (!rejectDeferredLoad) {
        throw new Error("No hay una carga pendiente.");
      }
      rejectDeferredLoad();
      rejectDeferredLoad = null;
    },
    async click(button = firstButton()) {
      return list.handlers.click({
        target: button
      });
    }
  };
}

test("el dashboard contiene los controles de bloqueados", () => {
  for (const id of [
    "profileBlockedUsersCard",
    "profileBlockedUsersStatus",
    "profileBlockedUsersList"
  ]) {
    assert.ok(
      html.includes(`id="${id}"`),
      `falta ${id}`
    );
  }
});

test("muestra el estado vacío sin botones", () => {
  const harness = createHarness({
    initialBlocks: []
  });

  harness.actions.renderBlockedUsers([]);

  assert.equal(harness.list.children.length, 0);
  assert.match(
    harness.status.textContent,
    /No tienes usuarios bloqueados/
  );
});

test("muestra usuarios y botones de desbloqueo", () => {
  const harness = createHarness();

  harness.actions.renderBlockedUsers([
    { username: "bob" },
    { username: "charlie" }
  ]);

  assert.equal(harness.list.children.length, 2);

  assert.equal(
    harness.list.children[0].children[0].textContent,
    "@bob"
  );

  const button = harness.firstButton();

  assert.equal(
    button.dataset.blockedUserAction,
    "unblock"
  );
  assert.equal(button.dataset.username, "bob");
  assert.equal(button.textContent, "Desbloquear");
});

test("carga los bloqueos desde el cliente API", async () => {
  const harness = createHarness();

  const result =
    await harness.actions.loadBlockedUsers();

  assert.equal(result, true);
  assert.equal(harness.loadCount, 1);
  assert.equal(harness.list.children.length, 1);
});

test("un error de carga muestra un mensaje", async () => {
  const harness = createHarness({
    loadError: new Error("network_error")
  });

  const result =
    await harness.actions.loadBlockedUsers();

  assert.equal(result, false);
  assert.match(
    harness.status.textContent,
    /No hemos podido cargar/
  );
});

test("cancelar no realiza un desbloqueo", async () => {
  const harness = createHarness({
    confirmed: false
  });

  harness.actions.renderBlockedUsers([
    { username: "bob" }
  ]);

  harness.actions.bindBlockedUsers();

  await harness.click();

  assert.equal(harness.confirmations.length, 1);
  assert.equal(harness.unblockCalls.length, 0);
  assert.equal(harness.firstButton().disabled, false);
});

test("desbloquear actualiza la lista y muestra éxito", async () => {
  const harness = createHarness();

  await harness.actions.loadBlockedUsers();
  harness.actions.bindBlockedUsers();

  await harness.click();

  assert.deepEqual(harness.unblockCalls, ["bob"]);
  assert.equal(harness.list.children.length, 0);
  assert.equal(harness.loadCount, 2);

  assert.match(
    harness.status.textContent,
    /No tienes usuarios bloqueados/
  );

  assert.equal(harness.messages.length, 1);
  assert.equal(harness.messages[0].type, "success");
});

test("HTTP 429 mantiene el usuario y permite reintentar", async () => {
  const harness = createHarness({
    unblockError: {
      status: 429,
      body: {
        retryAfterSeconds: 42
      }
    }
  });

  await harness.actions.loadBlockedUsers();
  harness.actions.bindBlockedUsers();

  await harness.click();

  assert.equal(harness.list.children.length, 1);
  assert.equal(harness.firstButton().disabled, false);
  assert.match(
    harness.status.textContent,
    /42 segundos/
  );
  assert.equal(harness.messages.length, 0);
});

test("HTTP 404 comunica que el bloqueo ya no existe", async () => {
  const harness = createHarness({
    unblockError: {
      status: 404
    }
  });

  await harness.actions.loadBlockedUsers();
  harness.actions.bindBlockedUsers();

  await harness.click();

  assert.match(
    harness.status.textContent,
    /ya no figura como bloqueado/
  );

  assert.equal(harness.firstButton().disabled, false);
});


test(
  "desbloquear correctamente permite recuperarse si falla la recarga",
  async () => {
    const harness = createHarness({
      loadErrorAfter: 1
    });

    await harness.actions.loadBlockedUsers();
    harness.actions.bindBlockedUsers();

    assert.equal(harness.list.children.length, 1);

    await harness.click();

    assert.deepEqual(harness.unblockCalls, ["bob"]);
    assert.equal(harness.loadCount, 2);

    assert.equal(
      harness.list.children.length,
      0,
      "no debe quedar una fila obsoleta"
    );

    assert.match(
      harness.status.textContent,
      /Usuario desbloqueado, pero no se ha podido/
    );

    assert.equal(harness.messages.length, 1);
    assert.equal(harness.messages[0].type, "success");
  }
);


test(
  "la gestión de bloqueos muestra los textos en inglés",
  async () => {
    const harness = createHarness({
      language: "en"
    });

    await harness.actions.loadBlockedUsers();

    const button = harness.firstButton();

    assert.equal(button.textContent, "Unblock");
    assert.equal(
      button.attributes["aria-label"],
      "Unblock @bob"
    );

    harness.actions.bindBlockedUsers();

    await harness.click();

    assert.match(
      harness.confirmations[0],
      /Do you want to unblock @bob/
    );

    assert.equal(
      harness.status.textContent,
      "You have not blocked anyone."
    );

    assert.equal(
      harness.messages[0].title,
      "You unblocked @bob"
    );
  }
);

test(
  "los textos de bloqueo están definidos en ambos idiomas",
  () => {
    const occurrences =
      i18nSource.match(
        /profile_blocks_title:\s*"/g
      ) || [];

    assert.equal(occurrences.length, 2);

    assert.match(
      originalSource,
      /function bindBlockedUsers\(/
    );
  }
);


test(
  "un fallo de carga elimina las filas anteriores",
  async () => {
    const harness = createHarness({
      loadError: new Error("network_error")
    });

    harness.actions.renderBlockedUsers([
      { username: "antiguo" }
    ]);

    assert.equal(harness.list.children.length, 1);

    const result =
      await harness.actions.loadBlockedUsers();

    assert.equal(result, false);
    assert.equal(harness.list.children.length, 0);

    assert.match(
      harness.status.textContent,
      /No hemos podido cargar/
    );
  }
);

test(
  "una respuesta antigua no sustituye el listado reciente",
  async () => {
    const harness = createHarness({
      initialBlocks: [{ username: "antiguo" }],
      deferFirstLoad: true
    });

    const oldRequest =
      harness.actions.loadBlockedUsers();

    harness.setBlocks([
      { username: "nuevo" }
    ]);

    assert.equal(
      await harness.actions.loadBlockedUsers(),
      true
    );

    harness.releaseFirstLoad();

    assert.equal(await oldRequest, null);
    assert.equal(harness.list.children.length, 1);

    assert.equal(
      harness.list.children[0].children[0].textContent,
      "@nuevo"
    );
  }
);

test(
  "un error antiguo no sobrescribe una carga correcta",
  async () => {
    const harness = createHarness({
      initialBlocks: [{ username: "antiguo" }],
      deferFirstLoad: true
    });

    const oldRequest =
      harness.actions.loadBlockedUsers();

    harness.setBlocks([
      { username: "nuevo" }
    ]);

    await harness.actions.loadBlockedUsers();

    harness.rejectFirstLoad();

    assert.equal(await oldRequest, null);
    assert.equal(harness.list.children.length, 1);

    assert.equal(
      harness.list.children[0].children[0].textContent,
      "@nuevo"
    );

    assert.equal(harness.status.textContent, "");
  }
);
