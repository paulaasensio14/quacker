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
        createdAt: "2026-09-25T16:00:00.000Z"
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
        createdAt: "2026-09-25T16:00:00.000Z"
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
      recommendation,
      recommendations: [
        recommendation
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
