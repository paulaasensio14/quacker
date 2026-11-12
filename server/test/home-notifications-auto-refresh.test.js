import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL(
    "../../assets/js/app/home-notifications.js",
    import.meta.url
  ),
  "utf8"
);

test("actualiza la campana periodicamente sin recargar", () => {
  assert.match(source, /setInterval\s*\(/);
  assert.match(source, /15000/);
});

test("respeta la pestaña oculta y el transporte HTTP", () => {
  assert.match(source, /document\.hidden/);
  assert.match(
    source,
    /ApiClient\.getTransportInfo\(\)\.transport/
  );
});

test("actualiza al recuperar foco y evita consultas simultaneas", () => {
  assert.match(source, /visibilitychange/);
  assert.match(source, /window\.addEventListener\(["']focus["']/);
  assert.match(source, /__notifPollInFlight/);
});
