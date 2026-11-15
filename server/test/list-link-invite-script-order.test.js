import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(
    new URL(path, import.meta.url),
    "utf8"
  );
}

const landing = read("../../index.html");
const dashboard = read("../../dashboard.html");

const landingJs = read(
  "../../assets/js/landing/main-landing.js"
);

const router = read(
  "../../assets/js/app/router.js"
);

const appCore = read(
  "../../assets/js/app/app-core.js"
);

const entry = read(
  "../../assets/js/app/list-link-invite-entry.js"
);

const entryScript =
  '<script src="assets/js/app/list-link-invite-entry.js"></script>';

const apiScript =
  '<script src="assets/js/data/api-client.js"></script>';

const landingScript =
  '<script src="assets/js/landing/main-landing.js"></script>';

const routerScript =
  '<script src="assets/js/app/router.js"></script>';

const coreScript =
  '<script src="assets/js/app/app-core.js"></script>';

const integrated =
  landing.includes(entryScript) &&
  dashboard.includes(entryScript);

function occurrences(text, fragment) {
  return text.split(fragment).length - 1;
}

test(
  "QK-184-SEC-06 SCRIPT: modulo en ambas paginas",
  () => {
    assert.equal(
      occurrences(landing, entryScript),
      1,
      "SCRIPT_ENTRY_LANDING_AUSENTE"
    );

    assert.equal(
      occurrences(dashboard, entryScript),
      1,
      "SCRIPT_ENTRY_DASHBOARD_AUSENTE"
    );
  }
);

test(
  "QK-184-SEC-06 SCRIPT: captura antes del login",
  { skip: !integrated },
  () => {
    const api = landing.indexOf(apiScript);
    const capture = landing.indexOf(entryScript);
    const auth = landing.indexOf(landingScript);

    assert.ok(api >= 0);
    assert.ok(capture > api);
    assert.ok(auth > capture);
  }
);

test(
  "QK-184-SEC-06 SCRIPT: captura antes del router",
  { skip: !integrated },
  () => {
    const api = dashboard.indexOf(apiScript);
    const capture = dashboard.indexOf(entryScript);
    const navigation = dashboard.indexOf(routerScript);
    const startup = dashboard.indexOf(coreScript);

    assert.ok(api >= 0);
    assert.ok(capture > api);
    assert.ok(navigation > capture);
    assert.ok(startup > capture);
    assert.ok(startup > navigation);
  }
);

test(
  "QK-184-SEC-06 SCRIPT: autenticacion existente conservada",
  { skip: !integrated },
  () => {
    assert.match(
      landingJs,
      /capturePasswordResetTokenFromHash/
    );

    assert.match(
      landingJs,
      /captureEmailVerificationTokenFromQuery/
    );

    assert.match(
      landingJs,
      /ApiClient\.login\(/
    );

    assert.match(
      landingJs,
      /window\.location\.assign\(/
    );

    assert.match(
      landingJs,
      /dashboard\.html/
    );
  }
);

test(
  "QK-184-SEC-06 SCRIPT: navegacion y captura compatibles",
  { skip: !integrated },
  () => {
    assert.match(
      router,
      /history\.replaceState\(/
    );

    assert.match(
      appCore,
      /Router\.init\(\)/
    );

    assert.match(
      entry,
      /captureFromLocation\(\);/
    );

    assert.match(
      entry,
      /sessionStorage\.setItem\(/
    );

    assert.doesNotMatch(
      entry,
      /ApiClient\.acceptListLinkInvite\(/
    );
  }
);
