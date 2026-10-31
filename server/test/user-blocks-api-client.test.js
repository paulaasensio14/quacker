import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(
  new URL(
    "../../assets/js/data/api-client.js",
    import.meta.url
  ),
  "utf8"
);

function createHarness({
  status = 200,
  body = {},
  local = false
} = {}) {
  const requests = [];
  const events = [];

  const window = {
    location: {
      hostname: local ? "127.0.0.1" : "quacker.es",
      port: local ? "5500" : "",
      protocol: local ? "http:" : "https:",
      pathname: "/dashboard.html",
      href: "/dashboard.html"
    }
  };

  const document = {
    dispatchEvent(event) {
      events.push(event);
      return true;
    }
  };

  class CustomEventMock {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  }

  const context = {
    window,
    document,
    CustomEvent: CustomEventMock,
    AbortController,
    setTimeout,
    clearTimeout,
    console,
    async fetch(url, options = {}) {
      requests.push({ url, options });

      return {
        status,
        ok: status >= 200 && status < 300,
        async text() {
          return JSON.stringify(body);
        }
      };
    }
  };

  vm.runInNewContext(
    source + "\nglobalThis.__testClient = ApiClient;",
    context,
    { filename: "api-client.js" }
  );

  return {
    api: context.__testClient,
    requests,
    events
  };
}

test(
  "consulta y normaliza los usuarios bloqueados",
  async () => {
    const harness = createHarness({
      body: {
        blocks: [
          { username: " @Bob " },
          { username: "CHARLIE" },
          { username: "" },
          null
        ]
      }
    });

    const blocks =
      await harness.api.getBlockedUsers();

    assert.deepEqual(
      Array.from(
        blocks,
        (entry) => entry.username
      ),
      ["bob", "charlie"]
    );

    assert.equal(harness.requests.length, 1);
    assert.equal(
      harness.requests[0].url,
      "/api/user/blocks"
    );
    assert.equal(
      harness.requests[0].options.method,
      "GET"
    );
    assert.equal(
      harness.requests[0].options.credentials,
      "include"
    );
  }
);

test(
  "una respuesta de bloques inválida produce una lista vacía",
  async () => {
    const harness = createHarness({
      body: {
        blocks: "invalid"
      }
    });

    const blocks =
      await harness.api.getBlockedUsers();

    assert.equal(blocks.length, 0);
  }
);

test(
  "desbloquear normaliza el usuario y utiliza DELETE",
  async () => {
    const harness = createHarness({
      body: {
        blocked: false,
        username: "bob"
      }
    });

    const result =
      await harness.api.unblockUser(" @BoB ");

    assert.equal(result.blocked, false);

    assert.equal(
      harness.requests[0].url,
      "/api/user/blocks/bob"
    );

    assert.equal(
      harness.requests[0].options.method,
      "DELETE"
    );

    assert.equal(
      harness.requests[0].options.credentials,
      "include"
    );

    assert.equal(harness.events.length, 1);

    assert.equal(
      harness.events[0].type,
      "quacker:data-changed"
    );

    assert.equal(
      harness.events[0].detail.kind,
      "user_blocks"
    );

    assert.equal(
      harness.events[0].detail.action,
      "unblock"
    );

    assert.equal(
      harness.events[0].detail.username,
      "bob"
    );
  }
);

test(
  "un nombre vacío no realiza peticiones DELETE",
  async () => {
    const harness = createHarness();

    await assert.rejects(
      harness.api.unblockUser("   "),
      (error) =>
        error.status === 400 &&
        error.error === "invalid_block_target"
    );

    assert.equal(harness.requests.length, 0);
    assert.equal(harness.events.length, 0);
  }
);

test(
  "HTTP 429 conserva el error y no emite cambios",
  async () => {
    const harness = createHarness({
      status: 429,
      body: {
        error: "social_block_rate_limited",
        retryAfterSeconds: 42
      }
    });

    await assert.rejects(
      harness.api.unblockUser("bob"),
      (error) =>
        error.status === 429 &&
        error.error === "social_block_rate_limited" &&
        error.body?.retryAfterSeconds === 42
    );

    assert.equal(harness.requests.length, 1);
    assert.equal(harness.events.length, 0);
  }
);

test(
  "un desbloqueo rechazado con HTTP 404 no emite cambios",
  async () => {
    const harness = createHarness({
      status: 404,
      body: {
        error: "not_blocked"
      }
    });

    await assert.rejects(
      harness.api.unblockUser("bob"),
      (error) =>
        error.status === 404 &&
        error.error === "not_blocked"
    );

    assert.equal(harness.events.length, 0);
  }
);

test(
  "el transporte local no simula desbloqueos",
  async () => {
    const harness = createHarness({ local: true });

    harness.api.setTransport("local");

    const blocks =
      await harness.api.getBlockedUsers();

    assert.equal(blocks.length, 0);

    await assert.rejects(
      harness.api.unblockUser("bob"),
      (error) =>
        error.status === 501 &&
        error.error === "unsupported_transport"
    );

    assert.equal(harness.requests.length, 0);
    assert.equal(harness.events.length, 0);
  }
);
