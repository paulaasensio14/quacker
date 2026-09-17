import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(
  new URL("../../dashboard.html", import.meta.url),
  "utf8"
);

const js = fs.readFileSync(
  new URL("../../assets/js/app/profile.js", import.meta.url),
  "utf8"
);

test("Perfil incluye una tarjeta separada para Mis opiniones", () => {
  assert.match(html, /id="profileOpinionsCard"/);
  assert.match(html, /data-i18n="profile_opinions_title"/);
});

test("la tarjeta expone las métricas de opiniones, media y reseñas", () => {
  assert.match(html, /id="profileOpinionsCount"/);
  assert.match(html, /id="profileOpinionsAverage"/);
  assert.match(html, /id="profileReviewsCount"/);
});

test("la tarjeta reserva un espacio para la opinión más reciente", () => {
  assert.match(html, /id="profileOpinionsLatest"/);
});

test("la tarjeta incluye el acceso a todas las opiniones", () => {
  assert.match(html, /id="profileOpinionsViewAll"/);
  assert.match(html, /data-i18n="profile_opinions_view_all"/);
});

test("ProfileModule carga las opiniones mediante ApiClient", () => {
  assert.match(js, /ApiClient\.getOpinions\(\)/);
});

test("ProfileModule calcula el resumen de opiniones", () => {
  assert.match(js, /function buildOpinionsSummary\s*\(/);
  assert.match(js, /Number\.isInteger\(.*rating/);
  assert.match(js, /review\?\.text/);
});

test("ProfileModule renderiza el resumen en la tarjeta", () => {
  assert.match(js, /function renderOpinionsSummary\s*\(/);
  assert.match(js, /profileOpinionsCount/);
  assert.match(js, /profileOpinionsAverage/);
  assert.match(js, /profileReviewsCount/);
  assert.match(js, /profileOpinionsLatest/);
});
