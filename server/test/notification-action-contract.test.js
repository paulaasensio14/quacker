import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const apiSource = fs.readFileSync(
  new URL("../../assets/js/data/api-client.js", import.meta.url),
  "utf8"
);

const serverSource = fs.readFileSync(
  new URL("../server.js", import.meta.url),
  "utf8"
);

test("addNotification admite contexto accionable de contenido", () => {
  const signature = apiSource.match(
    /async function addNotification\(([\s\S]*?)\}\s*=\s*\{\}\)/
  );

  assert.ok(signature, "Debe existir la firma de addNotification");
  assert.match(signature[1], /action/);
  assert.match(signature[1], /itemId/);
  assert.match(signature[1], /contentType/);
});

test("addNotification envía el contexto accionable al backend", () => {
  const block = apiSource.match(
    /async function addNotification[\s\S]*?(?=\/\/ === RACHA)/
  );

  assert.ok(block, "Debe existir el bloque addNotification");

  assert.match(block[0], /action/);
  assert.match(block[0], /itemId/);
  assert.match(block[0], /contentType/);
});

test("el backend conserva action, itemId y contentType al normalizar notificaciones", () => {
  const block = serverSource.match(
    /function _normalizeUserNotification\(entry\)[\s\S]*?(?=function _normalizeUserNotificationsList)/
  );

  assert.ok(block, "Debe existir _normalizeUserNotification");

  assert.match(block[0], /action/);
  assert.match(block[0], /itemId/);
  assert.match(block[0], /contentType/);
});
