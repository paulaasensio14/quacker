import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const clientSource = fs.readFileSync(
  new URL(
    "../../assets/js/app/public-profile.js",
    import.meta.url
  ),
  "utf8"
);

test("el cliente obtiene el username únicamente desde /u/:username", () => {
  assert.match(
    clientSource,
    /window\.location\.pathname/
  );

  assert.match(
    clientSource,
    /parts\[0\]\s*!==\s*["']u["']/
  );

  assert.match(
    clientSource,
    /decodeURIComponent/
  );
});

test("la petición pública codifica el username y evita reutilizar caché", () => {
  assert.match(
    clientSource,
    /encodeURIComponent\(username\)/
  );

  assert.match(
    clientSource,
    /\/api\/public\/users\//
  );

  assert.match(
    clientSource,
    /cache:\s*["']no-store["']/
  );
});

test("los datos públicos se insertan con textContent y no con innerHTML", () => {
  assert.match(
    clientSource,
    /\.textContent\s*=/
  );

  assert.doesNotMatch(
    clientSource,
    /\.innerHTML\s*=/,
    "los datos del perfil no deben renderizarse mediante innerHTML"
  );
});

test("los favoritos se construyen mediante nodos DOM seguros", () => {
  assert.match(
    clientSource,
    /document\.createElement/
  );

  assert.match(
    clientSource,
    /replaceChildren\(\)/
  );

  assert.match(
    clientSource,
    /createFavoriteCard/
  );
});

test("la sección de favoritos permanece oculta cuando la API no los publica", () => {
  const start = clientSource.indexOf(
    "function renderFavorites"
  );

  assert.notEqual(start, -1);

  const end = clientSource.indexOf(
    "\n  function renderProfile",
    start
  );

  assert.notEqual(end, -1);

  const block = clientSource.slice(
    start,
    end
  );

  assert.match(
    block,
    /section\.hidden\s*=\s*true/
  );

  assert.match(
    block,
    /section\.hidden\s*=\s*false/
  );
});

test("avatar y portadas aplican listas de esquemas permitidos", () => {
  const avatarStart = clientSource.indexOf(
    "function resolveAvatarSrc"
  );

  const coverStart = clientSource.indexOf(
    "function resolveCoverSrc"
  );

  assert.notEqual(avatarStart, -1);
  assert.notEqual(coverStart, -1);

  assert.match(
    clientSource,
    /startsWith\(["']data:image\//
  );

  assert.match(
    clientSource,
    /startsWith\(["']https:\/\/["']\)/
  );

  assert.match(
    clientSource,
    /startsWith\(["']\/assets\/["']\)/
  );
});

test("un fallo de red o una respuesta HTTP no válida muestra el estado de error", () => {
  assert.match(
    clientSource,
    /if\s*\(!response\.ok\)/
  );

  assert.match(
    clientSource,
    /catch\s*\(_\)/
  );

  assert.match(
    clientSource,
    /showError\(\)/
  );
});

test("el perfil público integra renderizadores para stats, listas, reseñas y actividad", () => {
  assert.match(
    clientSource,
    /function renderStats/
  );

  assert.match(
    clientSource,
    /function renderLists/
  );

  assert.match(
    clientSource,
    /function renderReviews/
  );

  assert.match(
    clientSource,
    /function renderActivity/
  );

  assert.match(
    clientSource,
    /renderStats\(data\.stats\)/
  );

  assert.match(
    clientSource,
    /renderLists\(data\.lists\)/
  );

  assert.match(
    clientSource,
    /renderReviews\(data\.reviews\)/
  );

  assert.match(
    clientSource,
    /renderActivity\(data\.activity\)/
  );
});

test("las nuevas secciones permanecen ocultas cuando la API no publica sus datos", () => {
  for (const functionName of [
    "renderStats",
    "renderLists",
    "renderReviews",
    "renderActivity"
  ]) {
    const start = clientSource.indexOf(
      `function ${functionName}`
    );

    assert.notEqual(
      start,
      -1,
      `${functionName} debe existir`
    );

    const nextFunction = clientSource.indexOf(
      "\n  function ",
      start + 1
    );

    const block = clientSource.slice(
      start,
      nextFunction === -1
        ? clientSource.length
        : nextFunction
    );

    assert.match(
      block,
      /section\.hidden\s*=\s*true/,
      `${functionName} debe poder ocultar su sección`
    );

    assert.match(
      block,
      /section\.hidden\s*=\s*false/,
      `${functionName} debe poder mostrar su sección`
    );
  }
});

test("el contenido público nuevo se sigue construyendo mediante DOM seguro", () => {
  for (const functionName of [
    "renderStats",
    "renderLists",
    "renderReviews",
    "renderActivity"
  ]) {
    const start = clientSource.indexOf(
      `function ${functionName}`
    );

    assert.notEqual(
      start,
      -1,
      `${functionName} debe existir`
    );

    const nextFunction = clientSource.indexOf(
      "\n  function ",
      start + 1
    );

    const block = clientSource.slice(
      start,
      nextFunction === -1
        ? clientSource.length
        : nextFunction
    );

    assert.match(
      block,
      /document\.createElement/
    );

    assert.match(
      block,
      /\.textContent\s*=/
    );

    assert.doesNotMatch(
      block,
      /\.innerHTML\s*=/
    );
  }
});
