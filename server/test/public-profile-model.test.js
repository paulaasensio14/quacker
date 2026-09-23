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
      },
      activity: [],
      lists: [],
      reviews: [],
      stats: {
        totalItems: 0,
        completedCount: 0,
        inProgressCount: 0,
        notStartedCount: 0,
        byType: {
          pelicula: 0,
          serie: 0,
          game: 0,
          book: 0
        }
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

test("rechaza data SVG legacy y conserva formatos raster permitidos", () => {
  const svgUsers = {
    u_svg: {
      profile: {
        name: "SVG Legacy",
        handle: "@svg_legacy",
        bio: "",
        avatar:
          "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'></svg>"
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
            cover:
              "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'></svg>"
          },
          addedAt: "2026-09-23T09:00:00.000Z"
        }],
        serie: [],
        game: [],
        book: []
      }
    }
  };

  const svgResult =
    getPublicProfileByUsername(
      svgUsers,
      "svg_legacy"
    );

  assert.equal(
    svgResult.profile.avatar,
    "",
    "un avatar SVG legacy no debe salir por la API pública"
  );

  assert.equal(
    svgResult.favorites.pelicula[0].itemSnapshot.cover,
    "",
    "una portada SVG legacy no debe salir por la API pública"
  );

  const rasterUsers = {
    u_raster: {
      profile: {
        name: "Raster",
        handle: "@raster",
        bio: "",
        avatar:
          "data:image/png;base64,AAAA"
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
            cover:
              "data:image/webp;base64,BBBB"
          },
          addedAt: "2026-09-23T09:00:00.000Z"
        }],
        serie: [],
        game: [],
        book: []
      }
    }
  };

  const rasterResult =
    getPublicProfileByUsername(
      rasterUsers,
      "raster"
    );

  assert.equal(
    rasterResult.profile.avatar,
    "data:image/png;base64,AAAA",
    "PNG debe seguir permitido"
  );

  assert.equal(
    rasterResult.favorites.pelicula[0].itemSnapshot.cover,
    "data:image/webp;base64,BBBB",
    "WebP debe seguir permitido"
  );
});

test("la actividad pública solo expone eventos resolubles con identidad segura", () => {
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
        activity: true
      },
      library: [{
        id: "internal-library-id",
        type: "pelicula",
        title: "Fight Club",
        source: "tmdb",
        externalId: "550",
        cover: "https://image.tmdb.org/example.jpg",
        status: "in_progress",
        progress: 42,
        createdAt: "2026-09-01T10:00:00.000Z",
        updatedAt: "2026-09-22T10:00:00.000Z"
      }],
      activities: [{
        id: "internal-activity-id",
        type: "progress",
        targetType: "library_item",
        targetId: "internal-library-id",
        minutes: 45,
        createdAt: "2026-09-22T09:00:00.000Z",
        payload: {
          progress: 42
        }
      }, {
        id: "orphan-activity",
        type: "completed",
        targetType: "library_item",
        targetId: "missing-item",
        minutes: 0,
        createdAt: "2026-09-21T09:00:00.000Z",
        payload: null
      }]
    }
  };

  const result =
    getPublicProfileByUsername(users, "paula");

  assert.deepEqual(result.activity, [{
    type: "progress",
    contentType: "pelicula",
    source: "tmdb",
    externalId: "550",
    itemSnapshot: {
      title: "Fight Club",
      cover: "https://image.tmdb.org/example.jpg"
    },
    minutes: 45,
    createdAt: "2026-09-22T09:00:00.000Z",
    payload: {
      progress: 42
    }
  }]);

  assert.equal(
    Object.hasOwn(result.activity[0], "id"),
    false
  );

  assert.equal(
    Object.hasOwn(result.activity[0], "targetId"),
    false
  );
});

test("la actividad se omite por completo si su permiso no está activo", () => {
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
        activity: false
      },
      activities: [{
        id: "private-activity",
        type: "completed",
        targetId: "item-1",
        createdAt: "2026-09-22T09:00:00.000Z"
      }]
    }
  };

  const result =
    getPublicProfileByUsername(users, "paula");

  assert.equal(
    Object.hasOwn(result, "activity"),
    false
  );
});

test("las listas públicas solo exponen listas public con contenido resoluble", () => {
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
        lists: true
      },
      library: [{
        id: "movie-internal-id",
        type: "pelicula",
        title: "Fight Club",
        source: "tmdb",
        externalId: "550",
        cover: "https://image.tmdb.org/fight-club.jpg"
      }, {
        id: "game-internal-id",
        type: "game",
        title: "The Witcher 3",
        source: "rawg",
        externalId: "3328",
        cover: "https://media.rawg.io/witcher.jpg"
      }],
      lists: [{
        id: "public-list-id",
        name: "Imprescindibles",
        description: "Mis favoritos de siempre",
        visibility: "public",
        items: [{
          id: "movie-internal-id",
          addedAt: "2026-09-20T10:00:00.000Z"
        }, {
          id: "missing-item",
          addedAt: "2026-09-21T10:00:00.000Z"
        }],
        itemsCount: 2,
        createdAt: "2026-09-01T10:00:00.000Z",
        updatedAt: "2026-09-21T10:00:00.000Z"
      }, {
        id: "private-list-id",
        name: "Privada",
        description: "",
        visibility: "private",
        items: [{
          id: "game-internal-id"
        }]
      }, {
        id: "collab-list-id",
        name: "Colaborativa",
        description: "",
        visibility: "collab",
        items: [{
          id: "game-internal-id"
        }]
      }]
    }
  };

  const result =
    getPublicProfileByUsername(users, "paula");

  assert.deepEqual(result.lists, [{
    name: "Imprescindibles",
    description: "Mis favoritos de siempre",
    itemsCount: 1,
    items: [{
      contentType: "pelicula",
      source: "tmdb",
      externalId: "550",
      itemSnapshot: {
        title: "Fight Club",
        cover: "https://image.tmdb.org/fight-club.jpg"
      }
    }]
  }]);

  assert.equal(
    Object.hasOwn(result.lists[0], "id"),
    false
  );

  assert.equal(
    Object.hasOwn(result.lists[0].items[0], "id"),
    false
  );

  assert.equal(
    Object.hasOwn(result.lists[0].items[0], "addedAt"),
    false
  );
});

test("las listas se omiten por completo si su permiso no está activo", () => {
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
        lists: false
      },
      lists: [{
        id: "public-list-id",
        name: "No debe salir",
        visibility: "public",
        items: []
      }]
    }
  };

  const result =
    getPublicProfileByUsername(users, "paula");

  assert.equal(
    Object.hasOwn(result, "lists"),
    false
  );
});

test("las reseñas públicas exigen permiso global y privacidad public en la propia review", () => {
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
        reviews: true
      },
      opinions: [{
        itemId: "internal-movie-id",
        contentType: "pelicula",
        itemSnapshot: {
          title: "Fight Club",
          source: "tmdb",
          externalId: "550"
        },
        rating: 5,
        tags: [
          "masterpiece",
          "would_rewatch"
        ],
        review: {
          text: "Una de mis películas favoritas.",
          privacy: "public",
          spoiler: false,
          createdAt: "2026-09-20T10:00:00.000Z",
          updatedAt: "2026-09-21T10:00:00.000Z"
        },
        createdAt: "2026-09-20T10:00:00.000Z",
        updatedAt: "2026-09-21T10:00:00.000Z"
      }, {
        itemId: "internal-private-id",
        contentType: "game",
        itemSnapshot: {
          title: "Juego privado",
          source: "rawg",
          externalId: "3328"
        },
        rating: 4,
        tags: [],
        review: {
          text: "Esta reseña es privada.",
          privacy: "private",
          spoiler: false,
          createdAt: "2026-09-19T10:00:00.000Z",
          updatedAt: "2026-09-19T10:00:00.000Z"
        },
        createdAt: "2026-09-19T10:00:00.000Z",
        updatedAt: "2026-09-19T10:00:00.000Z"
      }]
    }
  };

  const result =
    getPublicProfileByUsername(users, "paula");

  assert.deepEqual(result.reviews, [{
    contentType: "pelicula",
    source: "tmdb",
    externalId: "550",
    itemSnapshot: {
      title: "Fight Club"
    },
    rating: 5,
    tags: [
      "masterpiece",
      "would_rewatch"
    ],
    review: {
      text: "Una de mis películas favoritas.",
      spoiler: false,
      createdAt: "2026-09-20T10:00:00.000Z",
      updatedAt: "2026-09-21T10:00:00.000Z"
    }
  }]);

  assert.equal(
    Object.hasOwn(result.reviews[0], "itemId"),
    false
  );

  assert.equal(
    Object.hasOwn(
      result.reviews[0].review,
      "privacy"
    ),
    false
  );
});

test("las reseñas se omiten por completo si su permiso global no está activo", () => {
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
        reviews: false
      },
      opinions: [{
        itemId: "internal-id",
        contentType: "pelicula",
        itemSnapshot: {
          title: "Fight Club",
          source: "tmdb",
          externalId: "550"
        },
        review: {
          text: "No debe salir",
          privacy: "public",
          spoiler: false,
          createdAt: "2026-09-20T10:00:00.000Z",
          updatedAt: "2026-09-20T10:00:00.000Z"
        },
        createdAt: "2026-09-20T10:00:00.000Z",
        updatedAt: "2026-09-20T10:00:00.000Z"
      }]
    }
  };

  const result =
    getPublicProfileByUsername(users, "paula");

  assert.equal(
    Object.hasOwn(result, "reviews"),
    false
  );
});

test("las estadísticas públicas exponen solo agregados estables de consumo", () => {
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
        stats: true
      },
      library: [{
        id: "movie-1",
        type: "pelicula",
        status: "completed",
        progress: 100
      }, {
        id: "series-1",
        type: "serie",
        status: "watching",
        progress: 45
      }, {
        id: "game-1",
        type: "game",
        status: "not_started",
        progress: 0
      }, {
        id: "book-1",
        type: "book",
        status: "reading",
        progress: 100
      }]
    }
  };

  const result =
    getPublicProfileByUsername(users, "paula");

  assert.deepEqual(result.stats, {
    totalItems: 4,
    completedCount: 2,
    inProgressCount: 1,
    notStartedCount: 1,
    byType: {
      pelicula: 1,
      serie: 1,
      game: 1,
      book: 1
    }
  });
});

test("las estadísticas se omiten por completo si su permiso no está activo", () => {
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
        stats: false
      },
      library: [{
        id: "movie-1",
        type: "pelicula",
        status: "completed",
        progress: 100
      }]
    }
  };

  const result =
    getPublicProfileByUsername(users, "paula");

  assert.equal(
    Object.hasOwn(result, "stats"),
    false
  );
});
