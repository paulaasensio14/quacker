import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import * as whatsNew from "../lib/whats-new.js";

const current = "1.1.0-rc.1";

const getState = options => {
  assert.equal(
    typeof whatsNew.getWhatsNewDisplayState,
    "function",
    "Debe existir un resolvedor de novedades publicadas"
  );

  return whatsNew.getWhatsNewDisplayState(options);
};

test(
  "la version candidata permite consultar la ultima release publicada",
  () => {
    const state = getState({
      currentVersion: current,
      lastSeenVersion: "",
      language: "es"
    });

    assert.equal(state.currentVersion, current);
    assert.equal(state.available, true);
    assert.equal(state.unseen, false);
    assert.equal(state.release.version, "1.0.6");

    assert.equal(
      state.release.title,
      "Quacker se ha puesto el casco"
    );
  }
);

test(
  "no muestra novedades de una version futura",
  () => {
    const state = getState({
      currentVersion: "1.0.5",
      lastSeenVersion: "",
      language: "es"
    });

    assert.equal(state.currentVersion, "1.0.5");
    assert.equal(state.available, false);
    assert.equal(state.unseen, false);
    assert.equal(state.release, null);
  }
);

test(
  "una version actual con novedades conserva el aviso una sola vez",
  () => {
    const first = getState({
      currentVersion: "1.0.6",
      lastSeenVersion: "1.0.5",
      language: "es"
    });

    assert.equal(first.available, true);
    assert.equal(first.unseen, true);
    assert.equal(first.release.version, "1.0.6");

    const seen = getState({
      currentVersion: "1.0.6",
      lastSeenVersion: "1.0.6",
      language: "es"
    });

    assert.equal(seen.available, true);
    assert.equal(seen.unseen, false);
  }
);

test(
  "API y frontend usan el contenido publicado y su version real",
  () => {
    const serverSource = readFileSync(
      new URL("../server.js", import.meta.url),
      "utf8"
    );

    const frontendSource = readFileSync(
      new URL(
        "../../assets/js/app/whats-new.js",
        import.meta.url
      ),
      "utf8"
    );

    assert.match(
      serverSource,
      /getWhatsNewDisplayState\(\s*\{/,
      "La API debe utilizar el resolvedor con fallback"
    );

    assert.match(
      frontendSource,
      /state\.release\??\.version/,
      "La modal debe mostrar la version de las novedades"
    );
  }
);
