import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { searchRawg } from "../adapters/rawg.js";
import { searchOpenLibrary } from "../adapters/open-library.js";

test(
  "Explore puede usar un timeout RAWG corto sin cambiar el timeout general",
  async (t) => {
    const originalFetch = globalThis.fetch;
    const originalTimeout = AbortSignal.timeout;
    const originalRawgKey = process.env.RAWG_KEY;

    t.after(() => {
      globalThis.fetch = originalFetch;
      AbortSignal.timeout = originalTimeout;

      if (originalRawgKey === undefined) {
        delete process.env.RAWG_KEY;
      } else {
        process.env.RAWG_KEY = originalRawgKey;
      }
    });

    process.env.RAWG_KEY = "test-key";

    let configuredTimeout = null;

    AbortSignal.timeout = (milliseconds) => {
      configuredTimeout = milliseconds;

      return AbortSignal.abort(
        new DOMException(
          "The operation was aborted due to timeout",
          "TimeoutError"
        )
      );
    };

    globalThis.fetch = async (_url, options = {}) => {
      assert.ok(options.signal instanceof AbortSignal);
      throw options.signal.reason;
    };

    await assert.rejects(
      searchRawg("dune", { timeoutMs: 1500 }),
      (error) => {
        assert.equal(error.message, "rawg_request_timeout");
        assert.equal(error.status, 504);
        return true;
      }
    );

    assert.equal(configuredTimeout, 1500);
  }
);


test(
  "Explore puede usar un timeout Open Library corto sin cambiar el timeout general",
  async (t) => {
    const originalFetch = globalThis.fetch;
    const originalTimeout = AbortSignal.timeout;

    t.after(() => {
      globalThis.fetch = originalFetch;
      AbortSignal.timeout = originalTimeout;
    });

    let configuredTimeout = null;

    AbortSignal.timeout = (milliseconds) => {
      configuredTimeout = milliseconds;

      return AbortSignal.abort(
        new DOMException(
          "The operation was aborted due to timeout",
          "TimeoutError"
        )
      );
    };

    globalThis.fetch = async (_url, options = {}) => {
      assert.ok(options.signal instanceof AbortSignal);
      throw options.signal.reason;
    };

    await assert.rejects(
      searchOpenLibrary(
        "open library interactive timeout probe",
        { timeoutMs: 2000 }
      ),
      (error) => {
        assert.equal(
          error.message,
          "open_library_request_timeout"
        );
        assert.equal(error.status, 504);
        return true;
      }
    );

    assert.equal(configuredTimeout, 2000);
  }
);

test(
  "Explore inicia el fallback de Wikipedia sin esperar al resto de proveedores",
  () => {
    const serverSource = fs.readFileSync(
      new URL("../server.js", import.meta.url),
      "utf8"
    );

    const routeStart = serverSource.indexOf(
      'app.get("/api/explore",'
    );

    const routeEnd = serverSource.indexOf(
      'app.get("/api/explore/item/',
      routeStart
    );

    assert.notEqual(routeStart, -1, "debe existir GET /api/explore");
    assert.notEqual(routeEnd, -1, "debe poder aislarse GET /api/explore");

    const routeSource = serverSource.slice(routeStart, routeEnd);

    assert.match(
      routeSource,
      /searchRawg\(\s*q\s*,\s*\{\s*timeoutMs:\s*1500\s*\}\s*\)/s,
      "la búsqueda interactiva debe limitar RAWG a 1500 ms"
    );

    assert.match(
      routeSource,
      /searchOpenLibrary\(\s*q\s*,\s*\{\s*timeoutMs:\s*5000(?:\s*,[\s\S]*?)?\s*\}\s*\)/s,
      "la búsqueda interactiva debe limitar Open Library a 5000 ms"
    );

    const wikipediaIndex = routeSource.indexOf(
      "searchWikipediaGames(q)"
    );

    const allSettledIndex = routeSource.indexOf(
      "await Promise.allSettled"
    );

    assert.ok(
      wikipediaIndex >= 0,
      "debe existir el fallback Wikipedia"
    );

    assert.ok(
      allSettledIndex >= 0,
      "debe existir la espera paralela de proveedores"
    );

    assert.ok(
      wikipediaIndex < allSettledIndex,
      "Wikipedia debe quedar preparada antes de esperar al conjunto de proveedores"
    );

    assert.match(
      routeSource,
      /Promise\.allSettled\(\[[\s\S]*gameSearchPromise[\s\S]*\]\)/,
      "el flujo RAWG → Wikipedia debe participar como una única promesa paralela"
    );
  }
);


test(
  "ApiClient permite cancelar una petición de Explore con una señal externa",
  () => {
    const apiSource = fs.readFileSync(
      new URL("../../assets/js/data/api-client.js", import.meta.url),
      "utf8"
    );

    const getExploreStart = apiSource.indexOf(
      "async function getExploreFeed("
    );

    const getExploreEnd = apiSource.indexOf(
      "async function getWeeklyFeaturedExploreFeed",
      getExploreStart
    );

    assert.notEqual(
      getExploreStart,
      -1,
      "debe existir getExploreFeed"
    );

    assert.notEqual(
      getExploreEnd,
      -1,
      "debe poder aislarse getExploreFeed"
    );

    const getExploreSource = apiSource.slice(
      getExploreStart,
      getExploreEnd
    );

    assert.match(
      getExploreSource,
      /opts\.signal/,
      "getExploreFeed debe aceptar una señal de cancelación"
    );

    assert.match(
      getExploreSource,
      /_httpJson\([\s\S]*signal:\s*opts\.signal[\s\S]*\)/,
      "getExploreFeed debe transmitir la señal a _httpJson"
    );

    const httpStart = apiSource.indexOf(
      "async function _httpJson("
    );

    const httpEnd = apiSource.indexOf(
      "const LIBRARY_CACHE_TTL_MS",
      httpStart
    );

    assert.notEqual(
      httpStart,
      -1,
      "debe existir _httpJson"
    );

    assert.notEqual(
      httpEnd,
      -1,
      "debe poder aislarse _httpJson"
    );

    const httpSource = apiSource.slice(httpStart, httpEnd);

const outerCatchStart = httpSource.indexOf(
  "} catch (err) {"
);

assert.notEqual(
  outerCatchStart,
  -1,
  "debe existir el catch exterior de _httpJson"
);

const outerCatchSource = httpSource.slice(outerCatchStart);

const externalAbortCheckIndex = outerCatchSource.indexOf(
  "if (abortedByExternal)"
);

const timeoutAbortCheckIndex = outerCatchSource.indexOf(
  "ctrl.signal.aborted"
);

assert.notEqual(
  externalAbortCheckIndex,
  -1,
  "el catch exterior debe distinguir el aborto externo"
);

assert.notEqual(
  timeoutAbortCheckIndex,
  -1,
  "el catch exterior debe mantener el tratamiento del timeout interno"
);

assert.ok(
  externalAbortCheckIndex < timeoutAbortCheckIndex,
  "el aborto externo debe resolverse antes de convertir abortos en timeout"
);

    assert.match(
      httpSource,
      /options\s*=\s*\{\}/,
      "_httpJson debe aceptar opciones"
    );

    assert.match(
      httpSource,
      /options\?\.signal/,
      "_httpJson debe contemplar una señal externa"
    );
  }
);

test(
  "Explore cancela la búsqueda anterior antes de iniciar una nueva",
  () => {
    const exploreSource = fs.readFileSync(
      new URL("../../assets/js/app/explore.js", import.meta.url),
      "utf8"
    );

    assert.match(
      exploreSource,
      /let\s+__searchAbortController\s*=\s*null/,
      "Explore debe conservar el AbortController de la búsqueda activa"
    );

    const loadStart = exploreSource.indexOf(
      "async function load()"
    );

    const bindStart = exploreSource.indexOf(
      "function bind()",
      loadStart
    );

    assert.notEqual(loadStart, -1, "debe existir load()");
    assert.notEqual(bindStart, -1, "debe poder aislarse load()");

    const loadSource = exploreSource.slice(
      loadStart,
      bindStart
    );

    assert.match(
      loadSource,
      /__searchAbortController\?\.abort\(\)/,
      "una búsqueda nueva debe abortar la búsqueda anterior"
    );

    assert.match(
      loadSource,
      /__searchAbortController\s*=\s*new AbortController\(\)/,
      "la nueva búsqueda debe crear su propio AbortController"
    );

    assert.match(
      loadSource,
      /ApiClient\.getExploreFeed\([\s\S]*signal:\s*__searchAbortController\.signal[\s\S]*\)/,
      "Explore debe pasar la señal activa a getExploreFeed"
    );
  }
);


test(
  "Explorar propaga la desconexión del cliente a Open Library",
  () => {
    const serverSource = fs.readFileSync(
      new URL("../server.js", import.meta.url),
      "utf8"
    );

    const routeStart = serverSource.indexOf(
      'app.get("/api/explore",'
    );

    const routeEnd = serverSource.indexOf(
      'app.get("/api/explore/item/',
      routeStart
    );

    assert.notEqual(routeStart, -1, "debe existir GET /api/explore");
    assert.notEqual(
      routeEnd,
      -1,
      "debe poder aislarse GET /api/explore"
    );

    const routeSource = serverSource.slice(routeStart, routeEnd);

    assert.match(
      routeSource,
      /new AbortController\(\)/,
      "la ruta debe crear un AbortController para la petición del cliente"
    );

    assert.match(
      routeSource,
      /(?:req|res)\.(?:once|on)\(\s*["'](?:aborted|close)["']/,
      "la ruta debe detectar que el cliente ha cerrado la petición"
    );

    assert.match(
      routeSource,
      /searchOpenLibrary\(\s*q\s*,\s*\{[\s\S]*?timeoutMs:\s*5000[\s\S]*?signal:\s*[^,}\n]+\.signal[\s\S]*?\}\s*\)/s,
      "la búsqueda Open Library debe recibir la señal de cancelación del cliente"
    );
  }
);

test(
  "Explorar espera 600 ms antes de lanzar una búsqueda remota",
  () => {
    const exploreSource = fs.readFileSync(
      new URL("../../assets/js/app/explore.js", import.meta.url),
      "utf8"
    );

    const scheduleStart = exploreSource.indexOf(
      "function _scheduleApplyFilters()"
    );

    const scheduleEnd = exploreSource.indexOf(
      "const TYPE_LABELS",
      scheduleStart
    );

    assert.notEqual(
      scheduleStart,
      -1,
      "debe existir _scheduleApplyFilters"
    );

    assert.notEqual(
      scheduleEnd,
      -1,
      "debe poder aislarse el debounce de Explorar"
    );

    const scheduleSource = exploreSource.slice(
      scheduleStart,
      scheduleEnd
    );

    assert.match(
      scheduleSource,
      /setTimeout\([\s\S]*?,\s*600\s*\)/s,
      "Explorar debe esperar 600 ms antes de lanzar la búsqueda remota"
    );
  }
);

test(
  "Explorar cancela también la carga semanal al iniciar otra búsqueda",
  () => {
    const apiClientSource = fs.readFileSync(
      new URL("../../assets/js/data/api-client.js", import.meta.url),
      "utf8"
    );

    const exploreSource = fs.readFileSync(
      new URL("../../assets/js/app/explore.js", import.meta.url),
      "utf8"
    );

    const weeklyStart = apiClientSource.indexOf(
      "async function getWeeklyFeaturedExploreFeed"
    );

    const weeklyEnd = apiClientSource.indexOf(
      "async function",
      weeklyStart + 20
    );

    assert.notEqual(
      weeklyStart,
      -1,
      "debe existir getWeeklyFeaturedExploreFeed"
    );

    const weeklySource = apiClientSource.slice(
      weeklyStart,
      weeklyEnd === -1 ? undefined : weeklyEnd
    );

    assert.match(
      weeklySource,
      /getWeeklyFeaturedExploreFeed\s*\(\s*options\s*=\s*\{\}\s*\)/,
      "la carga semanal debe aceptar opciones"
    );

    assert.match(
      weeklySource,
      /getExploreFeed\(\{[\s\S]*?\bsignal\b[\s\S]*?\}\)/s,
      "las peticiones semanales deben recibir una señal de cancelación"
    );

    assert.match(
      weeklySource,
      /signal\?\.aborted[\s\S]*?throw/s,
      "la carga semanal no debe continuar tras una cancelación"
    );

    assert.match(
      exploreSource,
      /getWeeklyFeaturedExploreFeed\(\s*\{[\s\S]*?signal:\s*__searchAbortController\.signal[\s\S]*?\}\s*\)/s,
      "Explorar debe pasar su AbortController también a la carga semanal"
    );
  }
);
