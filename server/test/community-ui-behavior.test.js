import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(
  new URL("../../assets/js/app/community.js", import.meta.url),
  "utf8"
);

class FakeNode {
  constructor(tag = "div") {
    this.tag = tag;
    this.value = "";
    this.textContent = "";
    this.children = [];
    this.attributes = {};
    this.handlers = {};
    this.className = "";
    this.href = "";
    this.src = "";
  }

  set innerHTML(_) {
    throw new Error("HTML sin sanitizar");
  }

  append(...children) {
    this.children.push(...children);
  }

  replaceChildren(...children) {
    this.children = [...children];
  }

  setAttribute(key, value) {
    this.attributes[key] = String(value);
  }

  addEventListener(type, callback) {
    (this.handlers[type] ||= []).push(callback);
  }

  emit(type, event = {}) {
    for (const cb of this.handlers[type] || []) {
      cb(event);
    }
  }
}

function createHarness() {
  const input = new FakeNode("input");
  const results = new FakeNode();
  const status = new FakeNode();

  const elements = {
    "#communitySearchInput": input,
    "#communityResults": results,
    "#communitySearchStatus": status
  };

  const listeners = {};
  const requests = [];
  const timers = new Map();

  let timerId = 0;

  const messages = {
    community_idle:
      "Escribe al menos dos caracteres para buscar.",
    community_loading:
      "Buscando personas...",
    community_error:
      "No pudimos buscar usuarios. Inténtalo de nuevo.",
    community_rate_limited:
      "Demasiadas búsquedas. Vuelve a intentarlo más tarde.",
    community_no_results:
      "No encontramos usuarios con ese nombre.",
    community_view_profile:
      "Ver perfil"
  };

  const context = {
    window: {
      I18n: {
        t(key) {
          return messages[key] || key;
        }
      }
    },
    document: {
      querySelector(selector) {
        return elements[selector] || null;
      },
      createElement(tag) {
        return new FakeNode(tag);
      },
      addEventListener(type, callback) {
        (listeners[type] ||= []).push(callback);
      }
    },
    ApiClient: {
      getCommunityUsers(query, options) {
        let resolve;
        let reject;

        const promise = new Promise((a, b) => {
          resolve = a;
          reject = b;
        });

        requests.push({
          query,
          options,
          resolve,
          reject
        });

        return promise;
      }
    },
    setTimeout(callback) {
      const id = ++timerId;
      timers.set(id, callback);
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    AbortController
  };

  vm.runInNewContext(source, context);
  context.window.CommunityModule.init();

  return {
    input,
    results,
    status,
    requests,

    type(value) {
      input.value = value;
      input.emit("input");
    },

    navigate(viewId) {
      for (
        const callback of
        listeners["quacker:view-change"] || []
      ) {
        callback({
          detail: { viewId }
        });
      }
    },

    flush() {
      const jobs = [...timers.values()];
      timers.clear();
      jobs.forEach((callback) => callback());
    },

    async tick() {
      await new Promise(
        (resolve) => setImmediate(resolve)
      );
    }
  };
}

test(
  "QA-011 funcional: una búsqueda corta no consulta la API",
  () => {
    const h = createHarness();

    h.type("@a");
    h.flush();

    assert.equal(h.requests.length, 0);
    assert.match(
      h.status.textContent,
      /dos caracteres/
    );
  }
);

test(
  "QA-011 funcional: resultados seguros y misma pestaña",
  async () => {
    const h = createHarness();

    h.type("@ALBA");
    h.flush();

    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].query, "@ALBA");

    h.requests[0].resolve([{
      name: "<img onerror=alert(1)>",
      username: "alba",
      avatar: "javascript:evil()"
    }]);

    await h.tick();

    const link =
      h.results.children[0].children[0];

    assert.equal(link.href, "/u/alba");
    assert.equal(
      link.children[0].src,
      "/assets/img/logo-quacker.png"
    );
    assert.equal(
      link.children[1].children[0].textContent,
      "<img onerror=alert(1)>"
    );
    assert.equal(link.target, undefined);
  }
);

test(
  "QA-011 funcional: ignora resultados antiguos",
  async () => {
    const h = createHarness();

    h.type("alba");
    h.flush();

    h.type("carlos");

    assert.equal(
      h.requests[0].options.signal.aborted,
      true
    );

    h.flush();

    h.requests[1].resolve([{
      name: "Carlos",
      username: "carlos",
      avatar: ""
    }]);

    await h.tick();

    h.requests[0].resolve([{
      name: "Alba",
      username: "alba",
      avatar: ""
    }]);

    await h.tick();

    assert.equal(h.results.children.length, 1);

    assert.equal(
      h.results.children[0].children[0].href,
      "/u/carlos"
    );
  }
);

test(
  "QA-011 funcional: sin resultados y límite de búsquedas",
  async () => {
    const h = createHarness();

    h.type("alba");
    h.flush();

    h.requests[0].resolve([]);
    await h.tick();

    assert.match(
      h.status.textContent,
      /No encontramos/
    );

    h.type("albi");
    h.flush();

    h.requests[1].reject(
      Object.assign(
        new Error("limit"),
        { status: 429 }
      )
    );

    await h.tick();

    assert.match(
      h.status.textContent,
      /Demasiadas búsquedas/
    );
  }
);

test(
  "QA-011 funcional: salir cancela la búsqueda activa",
  async () => {
    const h = createHarness();

    h.type("alba");
    h.flush();

    h.navigate("home");

    assert.equal(
      h.requests[0].options.signal.aborted,
      true
    );

    h.requests[0].resolve([{
      name: "Alba",
      username: "alba",
      avatar: ""
    }]);

    await h.tick();

    assert.equal(h.results.children.length, 0);
  }
);

test(
  "QA-011 funcional: volver reanuda una búsqueda interrumpida",
  async () => {
    const h = createHarness();

    h.type("alba");
    h.flush();

    h.navigate("home");
    h.navigate("community");
    h.flush();

    assert.equal(
      h.requests.length,
      2,
      "Debe reanudar la consulta pendiente al regresar"
    );

    h.requests[1].resolve([]);
    await h.tick();

    assert.match(
      h.status.textContent,
      /No encontramos/
    );
  }
);
