import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeRecommendations
} from "../lib/recommendations.js";

test("normalizeRecommendations devuelve una lista vacía para valores inválidos", () => {
  assert.deepEqual(
    normalizeRecommendations(null),
    []
  );

  assert.deepEqual(
    normalizeRecommendations({}),
    []
  );

  assert.deepEqual(
    normalizeRecommendations("recommendation"),
    []
  );
});

test("normalizeRecommendations normaliza una recomendación válida", () => {
  assert.deepEqual(
    normalizeRecommendations([
      {
        id: " rec-1 ",
        fromUserId: " user-1 ",
        contentType: "pelicula",
        source: "tmdb",
        externalId: "123",
        itemSnapshot: {
          title: " Arrival ",
          cover: " https://image.tmdb.org/arrival.jpg "
        },
        message: " Esta película es muy tú. ",
        createdAt: "2026-09-25T16:00:00.000Z"
      }
    ]),
    [
      {
        id: "rec-1",
        fromUserId: "user-1",
        contentType: "pelicula",
        source: "tmdb",
        externalId: "123",
        itemSnapshot: {
          title: "Arrival",
          cover: "https://image.tmdb.org/arrival.jpg"
        },
        message: "Esta película es muy tú.",
        createdAt: "2026-09-25T16:00:00.000Z",
        status: "pending",
        resolvedAt: null
      }
    ]
  );
});

test("normalizeRecommendations elimina duplicados del mismo emisor y contenido", () => {
  const baseRecommendation = {
    fromUserId: "user-1",
    contentType: "pelicula",
    source: "tmdb",
    externalId: "123",
    itemSnapshot: {
      title: "Arrival",
      cover: "https://image.tmdb.org/arrival.jpg"
    },
    message: "Esta película es muy tú."
  };

  assert.deepEqual(
    normalizeRecommendations([
      {
        ...baseRecommendation,
        id: "rec-1",
        createdAt: "2026-09-25T16:00:00.000Z"
      },
      {
        ...baseRecommendation,
        id: "rec-2",
        message: "Duplicada",
        createdAt: "2026-09-25T16:05:00.000Z"
      }
    ]),
    [
      {
        id: "rec-1",
        fromUserId: "user-1",
        contentType: "pelicula",
        source: "tmdb",
        externalId: "123",
        itemSnapshot: {
          title: "Arrival",
          cover: "https://image.tmdb.org/arrival.jpg"
        },
        message: "Esta película es muy tú.",
        createdAt: "2026-09-25T16:00:00.000Z",
        status: "pending",
        resolvedAt: null
      }
    ]
  );
});

test("normalizeRecommendations permite el mismo contenido desde emisores distintos", () => {
  const content = {
    contentType: "pelicula",
    source: "tmdb",
    externalId: "123",
    itemSnapshot: {
      title: "Arrival",
      cover: "https://image.tmdb.org/arrival.jpg"
    }
  };

  const recommendations = normalizeRecommendations([
    {
      ...content,
      id: "rec-1",
      fromUserId: "user-1",
      message: "Esta película es muy tú.",
      createdAt: "2026-09-25T16:00:00.000Z"
    },
    {
      ...content,
      id: "rec-2",
      fromUserId: "user-2",
      message: "Creo que te va a encantar.",
      createdAt: "2026-09-25T16:05:00.000Z"
    }
  ]);

  assert.equal(recommendations.length, 2);

  assert.deepEqual(
    recommendations.map(
      (recommendation) =>
        recommendation.fromUserId
    ),
    [
      "user-1",
      "user-2"
    ]
  );
});

test("addRecommendation añade una recomendación válida", async () => {
  const {
    addRecommendation
  } = await import("../lib/recommendations.js");

  const recommendation = {
    id: "rec-1",
    fromUserId: "user-1",
    contentType: "pelicula",
    source: "tmdb",
    externalId: "123",
    itemSnapshot: {
      title: "Arrival",
      cover: "https://image.tmdb.org/arrival.jpg"
    },
    message: "Esta película es muy tú.",
    createdAt: "2026-09-25T16:00:00.000Z"
  };

  assert.deepEqual(
    addRecommendation(
      [],
      recommendation,
      {
        ownerUserId: "user-2"
      }
    ),
    {
      ok: true,
      error: "",
      recommendation: {
        ...recommendation,
        status: "pending",
        resolvedAt: null
      },
      recommendations: [
        {
          ...recommendation,
          status: "pending",
          resolvedAt: null
        }
      ]
    }
  );
});

test("addRecommendation impide recomendarse contenido a uno mismo", async () => {
  const {
    addRecommendation
  } = await import("../lib/recommendations.js");

  const result = addRecommendation(
    [],
    {
      id: "rec-1",
      fromUserId: "user-1",
      contentType: "pelicula",
      source: "tmdb",
      externalId: "123",
      itemSnapshot: {
        title: "Arrival",
        cover: "https://image.tmdb.org/arrival.jpg"
      },
      message: "Para mí.",
      createdAt: "2026-09-25T16:00:00.000Z"
    },
    {
      ownerUserId: "user-1"
    }
  );

  assert.deepEqual(
    result,
    {
      ok: false,
      error: "cannot_recommend_self"
    }
  );
});

test("addRecommendation impide duplicar una recomendación pendiente del mismo emisor y contenido", async () => {
  const {
    addRecommendation
  } = await import("../lib/recommendations.js");

  const existing = {
    id: "rec-1",
    fromUserId: "user-1",
    contentType: "pelicula",
    source: "tmdb",
    externalId: "123",
    itemSnapshot: {
      title: "Arrival",
      cover: "https://image.tmdb.org/arrival.jpg"
    },
    message: "Esta película es muy tú.",
    createdAt: "2026-09-25T16:00:00.000Z"
  };

  const result = addRecommendation(
    [
      existing
    ],
    {
      ...existing,
      id: "rec-2",
      message: "Te la vuelvo a recomendar.",
      createdAt: "2026-09-25T16:05:00.000Z"
    },
    {
      ownerUserId: "user-2"
    }
  );

  assert.deepEqual(
    result,
    {
      ok: false,
      error: "recommendation_already_exists"
    }
  );
});

test("normalizeRecommendations conserva un estado resuelto válido", () => {
  assert.deepEqual(
    normalizeRecommendations([
      {
        id: "rec-resolved",
        fromUserId: "user-1",
        contentType: "book",
        source: "open_library",
        externalId: "OL123M",
        itemSnapshot: {
          title: "Dune",
          cover: ""
        },
        message: "Te va a gustar.",
        createdAt: "2026-09-25T16:00:00.000Z",
        status: "dismissed",
        resolvedAt: "2026-09-25T17:00:00.000Z"
      }
    ]),
    [
      {
        id: "rec-resolved",
        fromUserId: "user-1",
        contentType: "book",
        source: "open_library",
        externalId: "OL123M",
        itemSnapshot: {
          title: "Dune",
          cover: ""
        },
        message: "Te va a gustar.",
        createdAt: "2026-09-25T16:00:00.000Z",
        status: "dismissed",
        resolvedAt: "2026-09-25T17:00:00.000Z"
      }
    ]
  );
});

test("addRecommendation siempre crea una recomendación pendiente", async () => {
  const {
    addRecommendation
  } = await import("../lib/recommendations.js");

  const result = addRecommendation(
    [],
    {
      id: "rec-new",
      fromUserId: "user-1",
      contentType: "pelicula",
      source: "tmdb",
      externalId: "603",
      itemSnapshot: {
        title: "The Matrix",
        cover: ""
      },
      message: "Mírala.",
      createdAt: "2026-09-25T18:00:00.000Z",
      status: "dismissed",
      resolvedAt: "2026-09-25T18:05:00.000Z"
    },
    {
      ownerUserId: "user-2"
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.recommendation.status, "pending");
  assert.equal(result.recommendation.resolvedAt, null);
});


test("resolveRecommendation resuelve una recomendación pendiente y conserva el historial", async () => {
  const {
    resolveRecommendation
  } = await import("../lib/recommendations.js");

  const pending = {
    id: "rec-1",
    fromUserId: "user-1",
    contentType: "pelicula",
    source: "tmdb",
    externalId: "603",
    itemSnapshot: {
      title: "The Matrix",
      cover: ""
    },
    message: "Mírala.",
    createdAt: "2026-09-25T18:00:00.000Z",
    status: "pending",
    resolvedAt: null
  };

  const result = resolveRecommendation(
    [pending],
    "rec-1",
    "consumed",
    {
      resolvedAt: "2026-09-25T19:00:00.000Z"
    }
  );

  assert.deepEqual(
    result,
    {
      ok: true,
      error: "",
      recommendation: {
        ...pending,
        status: "consumed",
        resolvedAt: "2026-09-25T19:00:00.000Z"
      },
      recommendations: [
        {
          ...pending,
          status: "consumed",
          resolvedAt: "2026-09-25T19:00:00.000Z"
        }
      ]
    }
  );
});

test("resolveRecommendation admite added, consumed y dismissed", async () => {
  const {
    resolveRecommendation
  } = await import("../lib/recommendations.js");

  for (const status of [
    "added",
    "consumed",
    "dismissed"
  ]) {
    const result = resolveRecommendation(
      [
        {
          id: `rec-${status}`,
          fromUserId: "user-1",
          contentType: "pelicula",
          source: "tmdb",
          externalId: "603",
          itemSnapshot: {
            title: "The Matrix",
            cover: ""
          },
          message: "",
          createdAt: "2026-09-25T18:00:00.000Z",
          status: "pending",
          resolvedAt: null
        }
      ],
      `rec-${status}`,
      status,
      {
        resolvedAt: "2026-09-25T19:00:00.000Z"
      }
    );

    assert.equal(result.ok, true);
    assert.equal(
      result.recommendation.status,
      status
    );
    assert.equal(
      result.recommendation.resolvedAt,
      "2026-09-25T19:00:00.000Z"
    );
  }
});

test("resolveRecommendation rechaza un estado final inválido", async () => {
  const {
    resolveRecommendation
  } = await import("../lib/recommendations.js");

  const result = resolveRecommendation(
    [],
    "rec-1",
    "pending",
    {
      resolvedAt: "2026-09-25T19:00:00.000Z"
    }
  );

  assert.deepEqual(
    result,
    {
      ok: false,
      error: "invalid_recommendation_status"
    }
  );
});

test("resolveRecommendation devuelve not_found si la recomendación no existe", async () => {
  const {
    resolveRecommendation
  } = await import("../lib/recommendations.js");

  const result = resolveRecommendation(
    [],
    "rec-missing",
    "dismissed",
    {
      resolvedAt: "2026-09-25T19:00:00.000Z"
    }
  );

  assert.deepEqual(
    result,
    {
      ok: false,
      error: "recommendation_not_found"
    }
  );
});

test("resolveRecommendation impide resolver dos veces la misma recomendación", async () => {
  const {
    resolveRecommendation
  } = await import("../lib/recommendations.js");

  const result = resolveRecommendation(
    [
      {
        id: "rec-1",
        fromUserId: "user-1",
        contentType: "pelicula",
        source: "tmdb",
        externalId: "603",
        itemSnapshot: {
          title: "The Matrix",
          cover: ""
        },
        message: "",
        createdAt: "2026-09-25T18:00:00.000Z",
        status: "added",
        resolvedAt: "2026-09-25T18:30:00.000Z"
      }
    ],
    "rec-1",
    "dismissed",
    {
      resolvedAt: "2026-09-25T19:00:00.000Z"
    }
  );

  assert.deepEqual(
    result,
    {
      ok: false,
      error: "recommendation_already_resolved"
    }
  );
});

test("resolveRecommendation exige una fecha de resolución válida", async () => {
  const {
    resolveRecommendation
  } = await import("../lib/recommendations.js");

  const result = resolveRecommendation(
    [
      {
        id: "rec-1",
        fromUserId: "user-1",
        contentType: "pelicula",
        source: "tmdb",
        externalId: "603",
        itemSnapshot: {
          title: "The Matrix",
          cover: ""
        },
        message: "",
        createdAt: "2026-09-25T18:00:00.000Z",
        status: "pending",
        resolvedAt: null
      }
    ],
    "rec-1",
    "added",
    {
      resolvedAt: "fecha-invalida"
    }
  );

  assert.deepEqual(
    result,
    {
      ok: false,
      error: "invalid_resolved_at"
    }
  );
});

test("addRecommendation impide volver a recomendar contenido ya resuelto por el mismo emisor", async () => {
  const {
    addRecommendation
  } = await import("../lib/recommendations.js");

  for (const status of [
    "added",
    "consumed",
    "dismissed"
  ]) {
    const existing = {
      id: `rec-${status}`,
      fromUserId: "user-1",
      contentType: "pelicula",
      source: "tmdb",
      externalId: "603",
      itemSnapshot: {
        title: "The Matrix",
        cover: ""
      },
      message: "",
      createdAt: "2026-09-25T18:00:00.000Z",
      status,
      resolvedAt: "2026-09-25T19:00:00.000Z"
    };

    const result = addRecommendation(
      [existing],
      {
        id: `rec-new-${status}`,
        fromUserId: "user-1",
        contentType: "pelicula",
        source: "tmdb",
        externalId: "603",
        itemSnapshot: {
          title: "The Matrix",
          cover: ""
        },
        message: "Te la vuelvo a recomendar.",
        createdAt: "2026-09-26T18:00:00.000Z"
      },
      {
        ownerUserId: "user-2"
      }
    );

    assert.deepEqual(
      result,
      {
        ok: false,
        error: "recommendation_already_exists"
      }
    );
  }
});
