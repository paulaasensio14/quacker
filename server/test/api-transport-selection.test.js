import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(
  new URL("../../assets/js/data/api-client.js", import.meta.url),
  "utf8"
);

function createHarness({
  hostname = "127.0.0.1",
  port = "3100",
  protocol = "http:",
  pathname = "/index.html",
  runtimeTransport
} = {}) {
  const requests = [];

  const window = {
    location: {
      hostname,
      port,
      protocol,
      pathname,
      href: `http://${hostname}:${port}${pathname}`
    }
  };

  if (runtimeTransport !== undefined) {
    window.__QUACKER_RUNTIME_TRANSPORT__ = runtimeTransport;
  }

  const context = {
    window,
    document: {
      dispatchEvent() {
        return true;
      }
    },
    AbortController,
    setTimeout,
    clearTimeout,
    console,
    async fetch(url, options = {}) {
      requests.push({ url, options });

      return {
        status: 401,
        ok: false,
        async text() {
          return JSON.stringify({
            error: "not_authenticated"
          });
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
    requests
  };
}

test("puerto 3000 mantiene transporte HTTP", () => {
  const h = createHarness({ port: "3000" });

  assert.equal(
    h.api.getTransportInfo().transport,
    "http"
  );
});

test("puerto temporal con configuración explícita utiliza HTTP", () => {
  const h = createHarness({
    port: "3100",
    runtimeTransport: "http"
  });

  assert.equal(
    h.api.getTransportInfo().transport,
    "http"
  );
});

test("servidor estático local mantiene transporte local", () => {
  const h = createHarness({ port: "5500" });

  assert.equal(
    h.api.getTransportInfo().transport,
    "local"
  );
});

test("dominio público mantiene transporte HTTP", () => {
  const h = createHarness({
    hostname: "quacker.es",
    port: "",
    protocol: "https:"
  });

  assert.equal(
    h.api.getTransportInfo().transport,
    "http"
  );
});

test("archivo local mantiene transporte demo", () => {
  const h = createHarness({
    hostname: "",
    port: "",
    protocol: "file:"
  });

  assert.equal(
    h.api.getTransportInfo().transport,
    "local"
  );
});

test("modo HTTP explícito no acepta sesión ficticia", async () => {
  const h = createHarness({
    port: "3100",
    runtimeTransport: "http"
  });

  const session = await h.api.getCurrentSession();

  assert.equal(session, null);
  assert.equal(h.requests.length, 1);
  assert.equal(
    h.requests[0].url,
    "/api/auth/me"
  );
});


test("el bootstrap respeta HTTP explícito", () => {
  const bootstrap = fs.readFileSync(
    new URL(
      "../../assets/js/app/dashboard-bootstrap.js",
      import.meta.url
    ),
    "utf8"
  );

  const changes = [];

  const client = {
    setTransport(mode) {
      changes.push(["transport", mode]);
    },
    setBaseUrl(url) {
      changes.push(["baseUrl", url]);
    }
  };

  const context = {
    ApiClient: client,
    window: {
      ApiClient: client,
      __QUACKER_RUNTIME_TRANSPORT__: "http",
      location: {
        port: "3100"
      }
    },
    sessionStorage: {
      getItem(key) {
        return key === "quacker_transport"
          ? "local"
          : "/api";
      }
    },
    document: {
      readyState: "loading",
      querySelector() {
        return null;
      },
      addEventListener() {}
    }
  };

  vm.runInNewContext(bootstrap, context);

  assert.equal(
    changes.some(
      ([key, value]) =>
        key === "transport" && value === "local"
    ),
    false,
    "El bootstrap no debe restaurar el modo demo"
  );
});


function runLandingTransport({
  port = "3100",
  explicitTransport,
  storedTransport = "local",
  storedBaseUrl = "/api"
} = {}) {
  const landing = fs.readFileSync(
    new URL(
      "../../assets/js/landing/main-landing.js",
      import.meta.url
    ),
    "utf8"
  );

  const startMarker = "    (function initApiTransport() {";
  const endMarker = "\n    const authOverlay =";

  const start = landing.indexOf(startMarker);
  const end = landing.indexOf(endMarker, start);

  assert.ok(start >= 0);
  assert.ok(end > start);

  const calls = [];

  const client = {
    setTransport(value) {
      calls.push(["transport", value]);
    },
    setBaseUrl(value) {
      calls.push(["baseUrl", value]);
    }
  };

  const context = {
    ApiClient: client,
    window: {
      ApiClient: client,
      location: { port },
      __QUACKER_RUNTIME_TRANSPORT__: explicitTransport
    },
    sessionStorage: {
      getItem(key) {
        calls.push(["read", key]);

        return key === "quacker_transport"
          ? storedTransport
          : storedBaseUrl;
      },
      setItem(key, value) {
        calls.push(["write", key, value]);
      }
    }
  };

  vm.runInNewContext(
    landing.slice(start, end),
    context
  );

  return calls;
}

test("la portada respeta HTTP explícito frente a local guardado", () => {
  const calls = runLandingTransport({
    port: "3100",
    explicitTransport: "http"
  });

  assert.ok(
    calls.some(
      ([key, value]) =>
        key === "transport" && value === "http"
    )
  );

  assert.equal(
    calls.some(
      ([key, value]) =>
        key === "transport" && value === "local"
    ),
    false
  );

  assert.equal(
    calls.some(([key]) => key === "read"),
    false
  );
});

test("la portada conserva modo estático sin configuración", () => {
  const calls = runLandingTransport({
    port: "5500"
  });

  assert.ok(
    calls.some(
      ([key, value]) =>
        key === "transport" && value === "local"
    )
  );
});

test("la portada fuerza HTTP en puerto 3000", () => {
  const calls = runLandingTransport({
    port: "3000"
  });

  assert.ok(
    calls.some(
      ([key, value]) =>
        key === "transport" && value === "http"
    )
  );

  assert.equal(
    calls.some(
      ([key, value]) =>
        key === "transport" && value === "local"
    ),
    false
  );
});

test("la portada respeta modo local explícito", () => {
  const calls = runLandingTransport({
    port: "3100",
    explicitTransport: "local",
    storedTransport: "http"
  });

  assert.ok(
    calls.some(
      ([key, value]) =>
        key === "transport" && value === "local"
    )
  );

  assert.equal(
    calls.some(([key]) => key === "read"),
    false
  );
});

test("la configuración explícita inválida conserva el modo automático", () => {
  const h = createHarness({
    port: "3100",
    runtimeTransport: "invalid"
  });

  assert.equal(
    h.api.getTransportInfo().transport,
    "local"
  );
});


test("el bootstrap nunca restaura demo en un dominio público", () => {
  const bootstrap = fs.readFileSync(
    new URL(
      "../../assets/js/app/dashboard-bootstrap.js",
      import.meta.url
    ),
    "utf8"
  );

  const calls = [];

  const client = {
    setTransport(value) {
      calls.push(["transport", value]);
    },
    setBaseUrl(value) {
      calls.push(["baseUrl", value]);
    }
  };

  vm.runInNewContext(bootstrap, {
    ApiClient: client,
    window: {
      ApiClient: client,
      location: {
        hostname: "quacker.es",
        port: "",
        protocol: "https:"
      }
    },
    sessionStorage: {
      getItem(key) {
        return key === "quacker_transport"
          ? "local"
          : "/api";
      }
    },
    document: {
      readyState: "loading",
      querySelector() {
        return null;
      },
      addEventListener() {}
    }
  });

  assert.equal(
    calls.some(
      ([key, value]) =>
        key === "transport" && value === "local"
    ),
    false
  );
});

test("la portada nunca restaura demo en un dominio público", () => {
  const landing = fs.readFileSync(
    new URL(
      "../../assets/js/landing/main-landing.js",
      import.meta.url
    ),
    "utf8"
  );

  const start = landing.indexOf(
    "    (function initApiTransport() {"
  );

  const end = landing.indexOf(
    "\n    const authOverlay =",
    start
  );

  assert.ok(start >= 0 && end > start);

  const calls = [];

  const client = {
    setTransport(value) {
      calls.push(["transport", value]);
    },
    setBaseUrl(value) {
      calls.push(["baseUrl", value]);
    }
  };

  vm.runInNewContext(
    landing.slice(start, end),
    {
      ApiClient: client,
      window: {
        ApiClient: client,
        location: {
          hostname: "quacker.es",
          port: "",
          protocol: "https:"
        }
      },
      sessionStorage: {
        getItem(key) {
          return key === "quacker_transport"
            ? "local"
            : "/api";
        },
        setItem() {}
      }
    }
  );

  assert.equal(
    calls.some(
      ([key, value]) =>
        key === "transport" && value === "local"
    ),
    false
  );
});


test("un dominio público no puede cambiar a modo local", async () => {
  const h = createHarness({
    hostname: "quacker.es",
    port: "",
    protocol: "https:"
  });

  h.api.setTransport("local");

  assert.equal(
    h.api.getTransportInfo().transport,
    "http"
  );

  const session = await h.api.getCurrentSession();

  assert.equal(session, null);
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].url, "/api/auth/me");
});

test("un servidor estático local conserva el modo demo", () => {
  const h = createHarness({
    hostname: "127.0.0.1",
    port: "5500",
    protocol: "http:"
  });

  h.api.setTransport("local");

  assert.equal(
    h.api.getTransportInfo().transport,
    "local"
  );
});
