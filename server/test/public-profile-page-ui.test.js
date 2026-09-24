import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const HTML_URL =
  new URL("../../public-profile.html", import.meta.url);

const CSS_URL =
  new URL(
    "../../assets/css/public-profile.css",
    import.meta.url
  );

const JS_URL =
  new URL(
    "../../assets/js/app/public-profile.js",
    import.meta.url
  );

test("existe la página pública con CSS y JS propios", () => {
  assert.equal(
    fs.existsSync(HTML_URL),
    true,
    "debe existir public-profile.html"
  );

  assert.equal(
    fs.existsSync(CSS_URL),
    true,
    "debe existir assets/css/public-profile.css"
  );

  assert.equal(
    fs.existsSync(JS_URL),
    true,
    "debe existir assets/js/app/public-profile.js"
  );
});

test("el HTML usa rutas absolutas compatibles con /u/:username", () => {
  const html = fs.readFileSync(
    HTML_URL,
    "utf8"
  );

  assert.match(
    html,
    /href=["']\/assets\/css\/base\.css["']/
  );

  assert.match(
    html,
    /href=["']\/assets\/css\/public-profile\.css["']/
  );

  assert.match(
    html,
    /src=["']\/assets\/js\/app\/public-profile\.js["']/
  );

  assert.match(
    html,
    /src=["']\/assets\/img\/logo-quacker\.png["']/
  );
});

test("la cabecera pública tiene avatar, nombre, username y biografía", () => {
  const html = fs.readFileSync(
    HTML_URL,
    "utf8"
  );

  for (const id of [
    "publicProfileAvatar",
    "publicProfileName",
    "publicProfileUsername",
    "publicProfileBio"
  ]) {
    assert.match(
      html,
      new RegExp(`id=["']${id}["']`)
    );
  }
});

test("Favoritos usa cuatro pestañas y un único panel de contenido", () => {
  const html = fs.readFileSync(
    HTML_URL,
    "utf8"
  );

  assert.match(
    html,
    /id=["']publicProfileFavoritesTabs["'][^>]*role=["']tablist["']/
  );

  for (const type of [
    "pelicula",
    "serie",
    "game",
    "book"
  ]) {
    assert.match(
      html,
      new RegExp(
        `data-favorites-tab=["']${type}["']`
      )
    );
  }

  assert.match(
    html,
    /id=["']publicProfileFavoritesPanel["'][^>]*role=["']tabpanel["']/
  );

  assert.match(
    html,
    /id=["']publicProfileFavoritesGrid["']/
  );

  assert.doesNotMatch(
    html,
    /🎬|📺|🎮|📚/,
    "Favoritos no debe usar emojis como iconografía"
  );
});

test("la página contempla carga, error y ausencia de favoritos", () => {
  const html = fs.readFileSync(
    HTML_URL,
    "utf8"
  );

  assert.match(
    html,
    /id=["']publicProfileLoading["']/
  );

  assert.match(
    html,
    /id=["']publicProfileError["']/
  );

  assert.match(
    html,
    /id=["']publicProfileFavorites["']/
  );
});

test("el perfil público declara soporte para modo claro y oscuro", () => {
  const html = fs.readFileSync(
    HTML_URL,
    "utf8"
  );

  const css = fs.readFileSync(
    CSS_URL,
    "utf8"
  );

  assert.match(
    html,
    /name=["']color-scheme["'][^>]*content=["']light dark["']/
  );

  assert.match(
    css,
    /prefers-color-scheme:\s*dark/
  );
});

test("el HTML no necesita scripts inline", () => {
  const html = fs.readFileSync(
    HTML_URL,
    "utf8"
  );

  assert.doesNotMatch(
    html,
    /<script(?![^>]*\bsrc=)[^>]*>/i,
    "debe mantenerse compatible con la CSP sin unsafe-inline"
  );
});

test("la página reserva estadísticas, listas públicas, reseñas y actividad", () => {
  const html = fs.readFileSync(
    HTML_URL,
    "utf8"
  );

  for (const id of [
    "publicProfileStats",
    "publicProfileStatsGrid",
    "publicProfileLists",
    "publicProfileListsGrid",
    "publicProfileReviews",
    "publicProfileReviewsList",
    "publicProfileActivity",
    "publicProfileActivityList"
  ]) {
    assert.match(
      html,
      new RegExp(`id=["']${id}["']`)
    );
  }
});

test("el bloque social público tiene estilos accesibles y responsive", () => {
  const css = fs.readFileSync(
    CSS_URL,
    "utf8"
  );

  for (const selector of [
    ".public-profile-social",
    ".public-profile-social-action",
    ".public-profile-access-note"
  ]) {
    assert.match(
      css,
      new RegExp(
        selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      ),
      `falta el estilo ${selector}`
    );
  }

  assert.match(
    css,
    /\.public-profile-social-action:focus-visible/
  );

  assert.match(
    css,
    /\.public-profile-social-action:disabled/
  );

  assert.match(
    css,
    /@media\s*\(max-width:\s*760px\)[\s\S]*\.public-profile-social/
  );
});

test("las nuevas secciones tienen estilos propios coherentes con el perfil público", () => {
  const css = fs.readFileSync(
    CSS_URL,
    "utf8"
  );

  for (const selector of [
    ".public-profile-section",
    ".public-profile-stats-grid",
    ".public-profile-stat",
    ".public-profile-list-card",
    ".public-profile-review-card",
    ".public-profile-activity-card",
    ".public-profile-section-empty"
  ]) {
    assert.match(
      css,
      new RegExp(
        selector.replaceAll(".", "\\.")
      )
    );
  }

  assert.match(
    css,
    /var\(--public-border\)/
  );

  assert.match(
    css,
    /var\(--public-surface\)/
  );

  assert.match(
    css,
    /var\(--public-surface-soft\)/
  );
});

test("las nuevas secciones contemplan adaptación responsive", () => {
  const css = fs.readFileSync(
    CSS_URL,
    "utf8"
  );

  assert.match(
    css,
    /@media\s*\(max-width:\s*760px\)[\s\S]*?\.public-profile-section/
  );

  assert.match(
    css,
    /@media\s*\(max-width:\s*760px\)[\s\S]*?\.public-profile-stats-grid/
  );
});

test("la actividad pública limita su altura con scroll interno", () => {
  const css = fs.readFileSync(
    CSS_URL,
    "utf8"
  );

  assert.match(
    css,
    /\.public-profile-activity-list\s*\{[\s\S]*?max-height:\s*540px;[\s\S]*?overflow-y:\s*auto;[\s\S]*?overscroll-behavior:\s*contain;/
  );

  assert.match(
    css,
    /@media\s*\(max-width:\s*760px\)[\s\S]*?\.public-profile-activity-list\s*\{[\s\S]*?max-height:\s*420px;/
  );
});

test(
  "la cabecera pública reserva una zona accesible para la relación social",
  () => {
    const html = fs.readFileSync(
      HTML_URL,
      "utf8"
    );

    assert.match(
      html,
      /id=["']publicProfileSocial["'][^>]*hidden/
    );

    assert.match(
      html,
      /id=["']publicProfileSocialAction["'][^>]*type=["']button["']/
    );

    assert.match(
      html,
      /id=["']publicProfileAccessNote["'][^>]*aria-live=["']polite["']/
    );
  }
);
