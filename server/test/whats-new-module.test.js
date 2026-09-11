import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const moduleSource = fs.readFileSync(
  new URL(
    "../../assets/js/app/whats-new.js",
    import.meta.url
  ),
  "utf8"
);

const appCoreSource = fs.readFileSync(
  new URL(
    "../../assets/js/app/app-core.js",
    import.meta.url
  ),
  "utf8"
);

const dashboardSource = fs.readFileSync(
  new URL("../../dashboard.html", import.meta.url),
  "utf8"
);

test(
  "Qué hay de nuevo reutiliza UIModal y consulta su estado al iniciar",
  () => {
    assert.match(
      moduleSource,
      /UIModal\.bind\(\s*["']whatsNewModal["']/
    );

    assert.match(
      moduleSource,
      /ApiClient\.getWhatsNewUIState\(\)/
    );

    assert.match(
      moduleSource,
      /UIModal\.open\(\s*modal/
    );
  }
);

test(
  "el acceso manual permanece oculto hasta que exista una release activa",
  () => {
    assert.match(
      dashboardSource,
      /class="profile-menu-item"[^>]*data-profile-action="whats-new"[^>]*hidden/
    );

    assert.match(
      moduleSource,
      /menuItem\.hidden\s*=\s*!available/
    );
  }
);

test(
  "el contenido de la release se renderiza sin inyectar HTML",
  () => {
    assert.match(
      moduleSource,
      /releaseTitle\.textContent\s*=/
    );

    assert.match(
      moduleSource,
      /version\.textContent\s*=/
    );

    assert.match(
      moduleSource,
      /document\.createElement\(\s*["']li["']\s*\)/
    );

    assert.match(
      moduleSource,
      /item\.textContent\s*=/
    );

    assert.doesNotMatch(
      moduleSource,
      /\.innerHTML\s*=/
    );
  }
);

test(
  "una release pendiente se abre automáticamente y se marca como vista",
  () => {
    assert.match(
      moduleSource,
      /state\?\.unseen/
    );

    assert.match(
      moduleSource,
      /ApiClient\.markWhatsNewSeen\(\)/
    );
  }
);

test(
  "app-core inicia el módulo y permite reabrirlo desde el menú de perfil",
  () => {
    assert.match(
      appCoreSource,
      /window\.WhatsNewModule\?\.init\?\.\(\)/
    );

    assert.match(
      appCoreSource,
      /case\s+["']whats-new["']/
    );

    assert.match(
      appCoreSource,
      /window\.WhatsNewModule\?\.open\?\.\(\)/
    );
  }
);

test(
  "la reapertura manual refresca la release para respetar el idioma actual",
  () => {
    const openStart =
      moduleSource.indexOf(
        "async function open()"
      );

    assert.notEqual(
      openStart,
      -1,
      "debe existir async function open()"
    );

    const openBlock =
      moduleSource.slice(openStart);

    const cachedReturn =
      openBlock.indexOf(
        "showState(currentState)"
      );

    const freshRequest =
      openBlock.indexOf(
        "ApiClient.getWhatsNewUIState()"
      );

    assert.ok(
      freshRequest !== -1,
      "open() debe volver a consultar el estado"
    );

    assert.ok(
      cachedReturn === -1 ||
      freshRequest < cachedReturn,
      "open() no debe reutilizar contenido antiguo antes de refrescarlo"
    );
  }
);
