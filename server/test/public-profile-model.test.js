import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizePublicUsername,
  getPublicProfileByUsername
} from "../lib/public-profile.js";

test("normaliza el username público sin @ y en minúsculas", () => {
  assert.equal(
    normalizePublicUsername("  @Paula_Dev  "),
    "paula_dev"
  );

  assert.equal(
    normalizePublicUsername("PAULA"),
    "paula"
  );
});

test("rechaza usernames públicos con formato inválido", () => {
  for (const value of [
    "",
    "@",
    "a",
    "paula dev",
    "paula.dev",
    "paula/dev",
    null
  ]) {
    assert.equal(
      normalizePublicUsername(value),
      ""
    );
  }
});

test("un usuario inexistente y un perfil privado producen el mismo resultado", () => {
  const users = {
    u_private: {
      profile: {
        name: "Paula",
        handle: "@paula",
        email: "paula@example.com",
        bio: "Bio privada",
        avatar: "assets/img/avatars/avatar-1.png",
        language: "es",
        theme: "dark"
      },
      privacy: {
        profile: false,
        favorites: true
      },
      favorites: {
        pelicula: [],
        serie: [],
        game: [],
        book: []
      }
    }
  };

  assert.equal(
    getPublicProfileByUsername(users, "no-existe"),
    null
  );

  assert.equal(
    getPublicProfileByUsername(users, "paula"),
    null
  );
});

test("el perfil público expone únicamente la identidad pública permitida", () => {
  const users = {
    u_1: {
      profile: {
        name: "Paula Asensio",
        handle: "@Paula",
        email: "secret@example.com",
        bio: "Mi rincón de pelis, series, juegos y libros.",
        avatar: "assets/img/avatars/avatar-2.png",
        language: "es",
        theme: "dark",
        lastStreakNotified: 25
      },
      privacy: {
        profile: true,
        favorites: false
      },
      favorites: {
        pelicula: [],
        serie: [],
        game: [],
        book: []
      }
    }
  };

  const result =
    getPublicProfileByUsername(users, "@PAULA");

  assert.deepEqual(result, {
    profile: {
      name: "Paula Asensio",
      username: "paula",
      bio: "Mi rincón de pelis, series, juegos y libros.",
      avatar: "assets/img/avatars/avatar-2.png"
    }
  });

  assert.equal(
    Object.hasOwn(result.profile, "email"),
    false
  );

  assert.equal(
    Object.hasOwn(result.profile, "language"),
    false
  );

  assert.equal(
    Object.hasOwn(result.profile, "theme"),
    false
  );

  assert.equal(
    Object.hasOwn(result, "privacy"),
    false
  );

  assert.equal(
    Object.hasOwn(result, "favorites"),
    false
  );
});

test("los favoritos solo se incluyen cuando su permiso está explícitamente activo", () => {
  const favoriteMovie = {
    contentType: "pelicula",
    source: "tmdb",
    externalId: "550",
    itemSnapshot: {
      title: "Fight Club",
      cover: "https://image.tmdb.org/example.jpg"
    },
    addedAt: "2026-09-21T16:00:00.000Z"
  };

  const users = {
    u_1: {
      profile: {
        name: "Paula",
        handle: "@paula",
        bio: "",
        avatar: ""
      },
      privacy: {
        profile: true,
        favorites: true
      },
      favorites: {
        pelicula: [favoriteMovie],
        serie: [],
        game: [],
        book: []
      }
    }
  };

  const result =
    getPublicProfileByUsername(users, "paula");

  assert.deepEqual(
    result.favorites.pelicula,
    [{
      contentType: "pelicula",
      source: "tmdb",
      externalId: "550",
      itemSnapshot: {
        title: "Fight Club",
        cover: favoriteMovie.itemSnapshot.cover
      }
    }]
  );

  assert.equal(
    Object.hasOwn(
      result.favorites.pelicula[0],
      "addedAt"
    ),
    false,
    "la API pública no debe revelar cuándo se añadió un favorito"
  );

  assert.deepEqual(result.favorites.serie, []);
  assert.deepEqual(result.favorites.game, []);
  assert.deepEqual(result.favorites.book, []);
});

test("la búsqueda del username público ignora mayúsculas y el prefijo @", () => {
  const users = {
    u_1: {
      profile: {
        name: "Paula",
        handle: "@Paula_Dev",
        bio: "",
        avatar: ""
      },
      privacy: {
        profile: true,
        favorites: false
      }
    }
  };

  assert.deepEqual(
    getPublicProfileByUsername(
      users,
      "PAULA_DEV"
    )?.profile,
    {
      name: "Paula",
      username: "paula_dev",
      bio: "",
      avatar: ""
    }
  );
});

test("un usuario sin configuración de privacidad permanece privado por defecto", () => {
  const users = {
    u_legacy: {
      profile: {
        name: "Usuario antiguo",
        handle: "@legacy",
        email: "legacy@example.com",
        bio: "No debe hacerse público por accidente",
        avatar: ""
      }
    }
  };

  assert.equal(
    getPublicProfileByUsername(users, "legacy"),
    null
  );
});

test("el contrato público funciona como whitelist aunque el bucket contenga datos sensibles", () => {
  const users = {
    u_secret: {
      profile: {
        id: "internal-profile-id",
        name: "Paula",
        handle: "@Paula",
        email: "secret@example.com",
        bio: "Bio pública",
        avatar: "assets/img/avatars/avatar-3.png",
        language: "es",
        theme: "dark",
        lastStreakNotified: 99,
        passwordHash: "never-public"
      },
      privacy: {
        profile: true,
        favorites: false,
        activity: true,
        library: true,
        lists: true,
        reviews: true,
        stats: true,
        internalFlag: true
      },
      passwordHash: "also-never-public",
      sessions: ["private-session"],
      library: [{ title: "Private library item" }],
      activities: [{ action: "private activity" }],
      opinions: [{ review: "private review" }]
    }
  };

  assert.deepEqual(
    getPublicProfileByUsername(users, "PAULA"),
    {
      profile: {
        name: "Paula",
        username: "paula",
        bio: "Bio pública",
        avatar: "assets/img/avatars/avatar-3.png"
      }
    }
  );
});

test("el contrato público no expone fuentes multimedia arbitrarias", () => {
  const users = {
    u_1: {
      profile: {
        name: "Paula",
        handle: "@paula",
        bio: "",
        avatar: "javascript:alert('avatar')"
      },
      privacy: {
        profile: true,
        favorites: true
      },
      favorites: {
        pelicula: [{
          contentType: "pelicula",
          source: "tmdb",
          externalId: "550",
          itemSnapshot: {
            title: "Fight Club",
            cover: "javascript:alert('cover')"
          },
          addedAt: "2026-09-21T16:00:00.000Z"
        }],
        serie: [],
        game: [],
        book: []
      }
    }
  };

  const result =
    getPublicProfileByUsername(users, "paula");

  assert.equal(
    result.profile.avatar,
    "",
    "un avatar con esquema no permitido no debe salir por la API pública"
  );

  assert.equal(
    result.favorites.pelicula[0].itemSnapshot.cover,
    "",
    "una portada con esquema no permitido no debe salir por la API pública"
  );
});
