import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const apiSource = fs.readFileSync(
  new URL("../../assets/js/data/api-client.js", import.meta.url),
  "utf8"
);

const uiSource = fs.readFileSync(
  new URL("../../assets/js/app/home-notifications.js", import.meta.url),
  "utf8"
);

test("las rachas iniciales usan un icono semántico de racha y no check", () => {
  assert.match(
    apiSource,
    /const icon = hot \? "flame" : "streak";/
  );
});

test("check no se clasifica como notificación de racha", () => {
  assert.doesNotMatch(
    uiSource,
    /n\?\.icon === "check"/
  );

  assert.doesNotMatch(
    uiSource,
    /n\.icon === "check"/
  );
});

test("check tiene un icono visual propio de contenido completado", () => {
  assert.match(
    uiSource,
    /if \(kind === "check"\)[\s\S]{0,700}<path d="M5 12l4 4 10-10"/
  );
});
