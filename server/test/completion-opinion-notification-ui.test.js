import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const librarySource = fs.readFileSync(
  new URL("../../assets/js/app/library.js", import.meta.url),
  "utf8"
);

const notificationsSource = fs.readFileSync(
  new URL("../../assets/js/app/home-notifications.js", import.meta.url),
  "utf8"
);

test(
  "LibraryUI expone una apertura de Detail por itemId reutilizando la identidad canónica",
  () => {
    assert.match(
      librarySource,
      /async function openDetailByItemId\(/
    );

    const start = librarySource.indexOf(
      "async function openDetailByItemId("
    );
    const end = librarySource.indexOf(
      "\n  function setExternalFilters",
      start
    );

    assert.notEqual(start, -1);
    assert.notEqual(end, -1);

    const block = librarySource.slice(start, end);

    assert.match(
      block,
      /getLibraryItemById/
    );

    assert.match(
      block,
      /buildLibraryDetailItem/
    );

    assert.match(
      block,
      /window\.DetailModule\?\.open\?\.\(/
    );

    assert.match(
      block,
      /originView:\s*"library"/
    );

    const moduleEnd = librarySource.indexOf(
      "\n})();\n\n// Exponer al scope global"
    );

    assert.notEqual(moduleEnd, -1);

    const exportStart = librarySource.lastIndexOf(
      "\n  return {",
      moduleEnd
    );
    const exportEnd = librarySource.indexOf(
      "\n  };",
      exportStart
    );

    assert.notEqual(exportStart, -1);
    assert.notEqual(exportEnd, -1);

    const exportsBlock = librarySource.slice(
      exportStart,
      exportEnd
    );

    assert.match(
      exportsBlock,
      /openDetailByItemId/
    );
  }
);

test(
  "las notificaciones rate_content muestran Valorar y Ahora no",
  () => {
    assert.match(
      notificationsSource,
      /n\.action\s*===\s*"rate_content"/
    );

    assert.match(
      notificationsSource,
      /completion_opinion_action_rate/
    );

    assert.match(
      notificationsSource,
      /completion_opinion_action_later/
    );

    assert.match(
      notificationsSource,
      /notif-opinion-actions/
    );

    assert.match(
      notificationsSource,
      /notif-opinion-rate-btn/
    );

    assert.match(
      notificationsSource,
      /notif-opinion-later-btn/
    );
  }
);

test(
  "Valorar abre la ficha y Ahora no descarta la invitación",
  () => {
    const actionStart = notificationsSource.indexOf(
      'n.action === "rate_content"'
    );

    assert.notEqual(actionStart, -1);

    const actionEnd = notificationsSource.indexOf(
      "card.appendChild(icon)",
      actionStart
    );

    assert.notEqual(actionEnd, -1);

    const block = notificationsSource.slice(
      actionStart,
      actionEnd
    );

    assert.match(
      block,
      /window\.LibraryUI\?\.openDetailByItemId\?\.\(/
    );

    assert.match(
      block,
      /n\.itemId/
    );

    assert.match(
      block,
      /triggerEl:\s*trigger\s*\|\|\s*notifButtonEl/
    );

    assert.doesNotMatch(
      block,
      /triggerEl:\s*rateBtn/
    );

    assert.match(
      block,
      /ApiClient\.dismissNotification\(n\.id\)/
    );
  }
);

test(
  "las acciones de la invitación reutilizan los botones compactos de Quacker",
  () => {
    assert.match(
      notificationsSource,
      /rateBtn\.className\s*=\s*"notif-opinion-rate-btn btn-primary btn-sm"/
    );

    assert.match(
      notificationsSource,
      /laterBtn\.className\s*=\s*"notif-opinion-later-btn btn-secondary btn-sm"/
    );
  }
);


test(
  "los datos de la notificación se renderizan como texto seguro",
  () => {
    const renderStart = notificationsSource.indexOf(
      "sortedList.forEach((n) => {"
    );

    const renderEnd = notificationsSource.indexOf(
      'const markBtn = document.createElement("button")',
      renderStart
    );

    assert.notEqual(renderStart, -1);
    assert.notEqual(renderEnd, -1);

    const block = notificationsSource.slice(
      renderStart,
      renderEnd
    );

    assert.doesNotMatch(
      block,
      /\$\{n\.(?:title|text|time)\s*\|\|\s*""\}/
    );

    assert.match(
      block,
      /titleEl\.textContent\s*=\s*n\.title\s*\|\|\s*""/
    );

    assert.match(
      block,
      /textEl\.textContent\s*=\s*n\.text\s*\|\|\s*""/
    );

    assert.match(
      block,
      /timeEl\.textContent\s*=\s*n\.time\s*\|\|\s*""/
    );
  }
);

test(
  "la invitación de valoración usa la imagen oficial de Quacker",
  () => {
    assert.match(
      notificationsSource,
      /n\.action\s*===\s*"rate_content"/
    );

    assert.match(
      notificationsSource,
      /assets\/img\/quacker-rating\.png/
    );
  }
);
