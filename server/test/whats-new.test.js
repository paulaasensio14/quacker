import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeWhatsNewUiState,
  resolveWhatsNewRelease
} from "../lib/whats-new.js";

test(
  "normaliza el estado de Qué hay de nuevo sin aceptar valores no string",
  () => {
    assert.deepEqual(
      normalizeWhatsNewUiState(),
      {
        lastSeenVersion: ""
      }
    );

    assert.deepEqual(
      normalizeWhatsNewUiState({
        lastSeenVersion: "  1.0.5  "
      }),
      {
        lastSeenVersion: "1.0.5"
      }
    );

    assert.deepEqual(
      normalizeWhatsNewUiState({
        lastSeenVersion: 106
      }),
      {
        lastSeenVersion: ""
      }
    );
  }
);

test(
  "no expone una release futura distinta de la versión publicada",
  () => {
    const result = resolveWhatsNewRelease({
      currentVersion: "1.0.5",
      lastSeenVersion: "",
      availableVersions: [
        "1.0.6"
      ]
    });

    assert.deepEqual(
      result,
      {
        currentVersion: "1.0.5",
        lastSeenVersion: "",
        available: false,
        unseen: false
      }
    );
  }
);

test(
  "expone la release publicada cuando existe contenido para esa versión",
  () => {
    const result = resolveWhatsNewRelease({
      currentVersion: "1.0.6",
      lastSeenVersion: "1.0.5",
      availableVersions: [
        "1.0.6"
      ]
    });

    assert.deepEqual(
      result,
      {
        currentVersion: "1.0.6",
        lastSeenVersion: "1.0.5",
        available: true,
        unseen: true
      }
    );
  }
);

test(
  "una release ya vista sigue disponible manualmente pero deja de estar pendiente",
  () => {
    const result = resolveWhatsNewRelease({
      currentVersion: "1.0.6",
      lastSeenVersion: "1.0.6",
      availableVersions: [
        "1.0.6"
      ]
    });

    assert.deepEqual(
      result,
      {
        currentVersion: "1.0.6",
        lastSeenVersion: "1.0.6",
        available: true,
        unseen: false
      }
    );
  }
);

test(
  "el catálogo solo devuelve contenido para versiones conocidas",
  async () => {
    const {
      getWhatsNewReleaseContent
    } = await import("../lib/whats-new.js");

    assert.equal(
      getWhatsNewReleaseContent("1.0.5", "es"),
      null
    );

    assert.equal(
      getWhatsNewReleaseContent("9.9.9", "es"),
      null
    );
  }
);

test(
  "la release 1.0.6 dispone de contenido sanitizado en español e inglés",
  async () => {
    const {
      getWhatsNewReleaseContent
    } = await import("../lib/whats-new.js");

    const es =
      getWhatsNewReleaseContent("1.0.6", "es");

    const en =
      getWhatsNewReleaseContent("1.0.6", "en");

    for (const release of [es, en]) {
      assert.equal(release.version, "1.0.6");
      assert.equal(typeof release.title, "string");
      assert.ok(release.title.trim().length > 0);

      assert.ok(Array.isArray(release.items));
      assert.ok(release.items.length >= 1);

      for (const item of release.items) {
        assert.equal(typeof item, "string");
        assert.ok(item.trim().length > 0);
      }
    }

    assert.notEqual(es.title, en.title);
  }
);

test(
  "el catálogo usa español como fallback de idioma",
  async () => {
    const {
      getWhatsNewReleaseContent
    } = await import("../lib/whats-new.js");

    assert.deepEqual(
      getWhatsNewReleaseContent("1.0.6", "fr"),
      getWhatsNewReleaseContent("1.0.6", "es")
    );
  }
);
