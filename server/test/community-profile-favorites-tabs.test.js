import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(
  new URL("../../dashboard.html", import.meta.url),
  "utf8"
);

const js = fs.readFileSync(
  new URL(
    "../../assets/js/app/community-profile.js",
    import.meta.url
  ),
  "utf8"
);

const css = fs.readFileSync(
  new URL(
    "../../assets/css/dashboard.css",
    import.meta.url
  ),
  "utf8"
);

const section = html.match(
  /<section\b[^>]*id="communityProfileFavorites"[\s\S]*?<\/section>/
)?.[0] || "";

test("QK-929: favoritos dispone de tablist accesible", () => {
  assert.ok(section, "Seccion Favoritos ausente");
  assert.match(section, /role="tablist"/);
});

test("QK-929: existen cuatro pestanas accesibles", () => {
  const types = [
    "pelicula",
    "serie",
    "game",
    "book"
  ];

  const buttons = [
    ...section.matchAll(/<button\b[^>]*>/g)
  ].map((match) => match[0]);

  for (const type of types) {
    const matching = buttons.filter(
      (button) =>
        button.includes(
          `data-community-favorite-tab="${type}"`
        )
    );

    assert.equal(
      matching.length,
      1,
      `Debe existir una pestana para ${type}`
    );

    const button = matching[0];

    assert.match(button, /role="tab"/);
    assert.match(button, /aria-selected=/);
    assert.match(button, /aria-controls=/);
    assert.match(button, /tabindex=/);
  }
});

test("QK-929: existe un panel asociado a las pestanas", () => {
  assert.match(
    section,
    /id="communityProfileFavoritesContent"/
  );

  const panel = section.match(
    /<div\b[^>]*id="communityProfileFavoritesContent"[^>]*>/
  )?.[0];

  assert.ok(panel, "Panel de favoritos ausente");
  assert.match(panel, /role="tabpanel"/);
  assert.match(panel, /aria-labelledby=/);
});

test("QK-929: JavaScript gestiona la seleccion activa", () => {
  assert.match(js, /data-community-favorite-tab/);
  assert.match(js, /aria-selected/);
  assert.match(js, /addEventListener\s*\(\s*["']click/);
});

test("QK-929: navegacion accesible mediante teclado", () => {
  for (const key of [
    "ArrowLeft",
    "ArrowRight",
    "Home",
    "End"
  ]) {
    assert.ok(
      js.includes(key),
      `Falta compatibilidad con ${key}`
    );
  }
});

test("QK-929: estilos de pestanas y modo oscuro", () => {
  assert.match(
    css,
    /\.community-profile-favorites-tabs\b/
  );

  assert.match(
    css,
    /\.community-profile-favorites-tab\b/
  );

  assert.match(
    css,
    /body\.dark-theme\s+\.community-profile-favorites-tab/
  );
});

test("QK-929: adaptacion responsive de pestanas", () => {
  assert.match(
    css,
    /@media\s*\(max-width:\s*\d+px\)[\s\S]*?\.community-profile-favorites-tabs/
  );
});
