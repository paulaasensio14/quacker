import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test(
  "Detail reserva una sección propia para la opinión personal del usuario",
  () => {
    const html = fs.readFileSync(
      new URL("../../dashboard.html", import.meta.url),
      "utf8"
    );

    assert.match(
      html,
      /id="contentDetailOpinionCard"/,
      "dashboard debe incluir la tarjeta de opinión personal"
    );

    assert.match(
      html,
      /id="contentDetailOpinion"/,
      "dashboard debe incluir el contenedor donde se renderiza la opinión"
    );
  }
);

test(
  "Detail delega el render de la opinión sin acceder directamente a la API",
  () => {
    const source = fs.readFileSync(
      new URL("../../assets/js/app/detail.js", import.meta.url),
      "utf8"
    );

    assert.match(
      source,
      /const opinionCardEl = document\.getElementById\("contentDetailOpinionCard"\)/
    );

    assert.match(
      source,
      /const opinionEl = document\.getElementById\("contentDetailOpinion"\)/
    );

    assert.match(
      source,
      /__renderDeps\.renderOpinion\?\.\(opinionEl,\s*opinionCardEl,\s*item\)/
    );

    assert.doesNotMatch(
      source,
      /ApiClient\.getOpinions/,
      "DetailModule no debe cargar opiniones directamente desde ApiClient"
    );
  }
);
