import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = fs.readFileSync(
  new URL(
    "../../assets/js/data/api-client.js",
    import.meta.url
  ),
  "utf8"
);

const requiredMethods = [
  "createListLinkInvite",
  "revokeListLinkInvite",
  "acceptListLinkInvite"
];

const implemented = requiredMethods.every(
  (method) =>
    source.includes(
      `async function ${method}(`
    ) &&
    new RegExp(
      `\\n\\s+${method},`
    ).test(source)
);

function createHarness({
  local = false,
  responses = []
} = {}) {
  const requests = [];
  const events = [];
  const responseQueue = [...responses];

  const location = {
    hostname: local ? "localhost" : "quacker.es",
    protocol: local ? "http:" : "https:",
    port: local ? "3100" : "",
    pathname: "/dashboard.html",
    href: local
      ? "http://localhost:3100/dashboard.html"
      : "https://quacker.es/dashboard.html"
  };

  const window = {
    location,
    __QUACKER_RUNTIME_TRANSPORT__:
      local ? "local" : "http"
  };

  const document = {
    dispatchEvent(event) {
      events.push({
        type: event.type,
        detail: event.detail
      });
      return true;
    }
  };

  class CustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  }

  const fetch = async (url, options = {}) => {
    requests.push({
      url,
      method: options.method,
      credentials: options.credentials,
      body: options.body
    });

    const next = responseQueue.shift() || {
      status: 200,
      body: {
        accepted: true,
        list: { id: "list-1" }
      }
    };

    return {
      status: next.status,
      ok: next.status >= 200 &&
        next.status < 300,
      async text() {
        return JSON.stringify(next.body);
      }
    };
  };

  const context = {
    window,
    document,
    CustomEvent,
    fetch,
    AbortController,
    setTimeout,
    clearTimeout,
    console,
    URL,
    structuredClone
  };

  vm.runInNewContext(
    source,
    context,
    {
      filename: "api-client.js",
      timeout: 2000
    }
  );

  assert.ok(window.ApiClient);

  return {
    api: window.ApiClient,
    requests,
    events
  };
}

const token = "A".repeat(43);

test(
  "QK-184-SEC-06 API: expone tres operaciones de enlace",
  () => {
    const { api } = createHarness();

    for (const method of requiredMethods) {
      assert.equal(
        typeof api[method],
        "function",
        `API_ENLACE_METODO_AUSENTE: ${method}`
      );
    }
  }
);

test(
  "QK-184-SEC-06 API: crear usa POST y cookies",
  { skip: !implemented },
  async () => {
    const response = {
      created: true,
      invite: {
        url:
          "https://quacker.es/#list-invite=" +
          token,
        issuedAt: 1234567890
      }
    };

    const { api, requests } = createHarness({
      responses: [{
        status: 201,
        body: response
      }]
    });

    const result =
      await api.createListLinkInvite(
        " lista A/B "
      );

    assert.equal(result.created, true);
    assert.equal(
      result.invite.url,
      response.invite.url
    );

    assert.equal(requests.length, 1);

    assert.equal(
      requests[0].url,
      "/api/lists/lista%20A%2FB/link-invite"
    );

    assert.equal(
      requests[0].method,
      "POST"
    );

    assert.equal(
      requests[0].credentials,
      "include"
    );
  }
);

test(
  "QK-184-SEC-06 API: revocar usa DELETE",
  { skip: !implemented },
  async () => {
    const { api, requests } = createHarness({
      responses: [{
        status: 200,
        body: { revoked: true }
      }]
    });

    const result =
      await api.revokeListLinkInvite(
        "lista-1"
      );

    assert.equal(result.revoked, true);
    assert.equal(requests.length, 1);

    assert.equal(
      requests[0].url,
      "/api/lists/lista-1/link-invite"
    );

    assert.equal(
      requests[0].method,
      "DELETE"
    );

    assert.equal(
      requests[0].credentials,
      "include"
    );
  }
);

test(
  "QK-184-SEC-06 API: aceptar envia token en POST",
  { skip: !implemented },
  async () => {
    const { api, requests } = createHarness();

    const result =
      await api.acceptListLinkInvite(
        token
      );

    assert.equal(result.accepted, true);
    assert.equal(requests.length, 1);

    assert.equal(
      requests[0].url,
      "/api/user/list-invites/link/accept"
    );

    assert.equal(
      requests[0].method,
      "POST"
    );

    assert.equal(
      requests[0].credentials,
      "include"
    );

    assert.deepEqual(
      JSON.parse(requests[0].body),
      { token }
    );

    assert.equal(
      requests[0].url.includes(token),
      false,
      "El token no debe formar parte de la ruta HTTP"
    );
  }
);

test(
  "QK-184-SEC-06 API: rechaza ID de lista vacio",
  { skip: !implemented },
  async () => {
    const { api, requests } = createHarness();

    for (const method of [
      "createListLinkInvite",
      "revokeListLinkInvite"
    ]) {
      await assert.rejects(
        api[method]("   "),
        (error) =>
          error?.status === 404 &&
          error?.error === "list_not_found"
      );
    }

    assert.equal(requests.length, 0);
  }
);

test(
  "QK-184-SEC-06 API: rechaza token vacio",
  { skip: !implemented },
  async () => {
    const { api, requests } = createHarness();

    for (const value of [
      "",
      "   ",
      null
    ]) {
      await assert.rejects(
        api.acceptListLinkInvite(value),
        (error) =>
          error?.status === 400 &&
          error?.error === "missing_token"
      );
    }

    assert.equal(requests.length, 0);
  }
);

test(
  "QK-184-SEC-06 API: requiere transporte HTTP",
  { skip: !implemented },
  async () => {
    const { api, requests } = createHarness({
      local: true
    });

    await assert.rejects(
      api.createListLinkInvite("lista-1"),
      (error) =>
        error?.status === 501 &&
        error?.error === "unsupported_transport"
    );

    await assert.rejects(
      api.revokeListLinkInvite("lista-1"),
      (error) =>
        error?.status === 501 &&
        error?.error === "unsupported_transport"
    );

    await assert.rejects(
      api.acceptListLinkInvite(token),
      (error) =>
        error?.status === 501 &&
        error?.error === "unsupported_transport"
    );

    assert.equal(requests.length, 0);
  }
);

test(
  "QK-184-SEC-06 API: conserva error 404 de enlace",
  { skip: !implemented },
  async () => {
    const { api, requests } = createHarness({
      responses: [{
        status: 404,
        body: {
          error: "invite_not_found"
        }
      }]
    });

    await assert.rejects(
      api.acceptListLinkInvite(token),
      (error) =>
        error?.status === 404 &&
        error?.error === "invite_not_found"
    );

    assert.equal(requests.length, 1);
  }
);

test(
  "QK-184-SEC-06 API: aceptar actualiza listas",
  { skip: !implemented },
  async () => {
    const { api, events } = createHarness();

    const result =
      await api.acceptListLinkInvite(token);

    assert.equal(result.accepted, true);

    const event = events.find(
      (entry) =>
        entry.type === "quacker:data-changed" &&
        entry.detail?.kind === "lists" &&
        entry.detail?.action ===
          "accept_link_invite"
    );

    assert.ok(
      event,
      "Falta evento de actualizacion de listas"
    );
  }
);
