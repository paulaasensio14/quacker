import assert from "node:assert/strict";
import test from "node:test";

import {
  castCollaborativeListPollVote,
  closeCollaborativeListPoll,
  finalizeCollaborativeListPollIfExpired,
  getCollaborativeListPollResults,
  isCollaborativeListPollClosed,
  normalizeCollaborativeListPoll
} from "../lib/collaborative-list-polls.js";


test(
  "normalizeCollaborativeListPoll normaliza una votación mínima válida",
  () => {
    const result =
      normalizeCollaborativeListPoll({
        id: " poll-1 ",
        title: "  Qué vemos el sábado  ",
        createdByUserId: " user-2 ",
        allowMultipleVotes: false,
        options: [],
        votesByUserId: {},
        deadlineAt: null,
        closedAt: null,
        createdAt:
          "2026-09-30T10:00:00.000Z"
      });

    assert.deepEqual(
      result,
      {
        id: "poll-1",
        title: "Qué vemos el sábado",
        createdByUserId: "user-2",
        allowMultipleVotes: false,
        options: [],
        votesByUserId: {},
        deadlineAt: null,
        closedAt: null,
        winnerContentKey: "",
        createdAt:
          "2026-09-30T10:00:00.000Z"
      }
    );
  }
);

test(
  "normalizeCollaborativeListPoll devuelve null para valores que no son objetos",
  () => {
    assert.equal(
      normalizeCollaborativeListPoll(null),
      null
    );

    assert.equal(
      normalizeCollaborativeListPoll("poll-1"),
      null
    );

    assert.equal(
      normalizeCollaborativeListPoll([]),
      null
    );
  }
);

test(
  "normalizeCollaborativeListPoll normaliza opciones por identidad canónica",
  () => {
    const result =
      normalizeCollaborativeListPoll({
        id: "poll-1",
        title: "Qué vemos",
        createdByUserId: "owner-1",
        options: [
          {
            source: " TMDB ",
            type: "movie",
            externalId: "00123",
            itemSnapshot: {
              title: "  Dune  ",
              cover: " https://example.com/dune.jpg "
            }
          }
        ],
        createdAt:
          "2026-09-30T10:00:00.000Z"
      });

    assert.deepEqual(
      result.options,
      [
        {
          source: "tmdb",
          type: "pelicula",
          externalId: "123",
          contentKey:
            "tmdb::pelicula::123",
          itemSnapshot: {
            title: "Dune",
            cover:
              "https://example.com/dune.jpg"
          }
        }
      ]
    );
  }
);

test(
  "normalizeCollaborativeListPoll elimina opciones duplicadas por identidad canónica",
  () => {
    const result =
      normalizeCollaborativeListPoll({
        id: "poll-1",
        title: "Qué vemos",
        createdByUserId: "owner-1",
        options: [
          {
            source: "TMDB",
            type: "movie",
            externalId: "00123",
            itemSnapshot: {
              title: "Dune",
              cover: "cover-1.jpg"
            }
          },
          {
            source: "tmdb",
            type: "pelicula",
            externalId: "123",
            itemSnapshot: {
              title: "Dune duplicada",
              cover: "cover-2.jpg"
            }
          }
        ],
        createdAt:
          "2026-09-30T10:00:00.000Z"
      });

    assert.equal(
      result.options.length,
      1
    );

    assert.equal(
      result.options[0].contentKey,
      "tmdb::pelicula::123"
    );

    assert.equal(
      result.options[0].itemSnapshot.title,
      "Dune"
    );
  }
);

test(
  "normalizeCollaborativeListPoll normaliza votos simples contra las opciones válidas",
  () => {
    const result =
      normalizeCollaborativeListPoll({
        id: "poll-1",
        title: "Qué vemos",
        createdByUserId: "owner-1",
        allowMultipleVotes: false,
        options: [
          {
            source: "tmdb",
            type: "pelicula",
            externalId: "123",
            itemSnapshot: {
              title: "Dune",
              cover: ""
            }
          },
          {
            source: "tmdb",
            type: "pelicula",
            externalId: "456",
            itemSnapshot: {
              title: "Arrival",
              cover: ""
            }
          }
        ],
        votesByUserId: {
          " user-2 ": [
            "tmdb::pelicula::123",
            "tmdb::pelicula::999",
            "tmdb::pelicula::123",
            "tmdb::pelicula::456"
          ]
        },
        createdAt:
          "2026-09-30T10:00:00.000Z"
      });

    assert.deepEqual(
      result.votesByUserId,
      {
        "user-2": [
          "tmdb::pelicula::123"
        ]
      }
    );
  }
);

test(
  "normalizeCollaborativeListPoll conserva varios votos válidos cuando se permiten múltiples",
  () => {
    const result =
      normalizeCollaborativeListPoll({
        id: "poll-1",
        title: "Qué vemos",
        createdByUserId: "owner-1",
        allowMultipleVotes: true,
        options: [
          {
            source: "tmdb",
            type: "pelicula",
            externalId: "123",
            itemSnapshot: {
              title: "Dune",
              cover: ""
            }
          },
          {
            source: "tmdb",
            type: "pelicula",
            externalId: "456",
            itemSnapshot: {
              title: "Arrival",
              cover: ""
            }
          }
        ],
        votesByUserId: {
          "user-2": [
            "tmdb::pelicula::123",
            "tmdb::pelicula::456",
            "tmdb::pelicula::123",
            "tmdb::pelicula::999"
          ]
        },
        createdAt:
          "2026-09-30T10:00:00.000Z"
      });

    assert.deepEqual(
      result.votesByUserId,
      {
        "user-2": [
          "tmdb::pelicula::123",
          "tmdb::pelicula::456"
        ]
      }
    );
  }
);


test(
  "isCollaborativeListPollClosed detecta cierre manual y fecha límite vencida",
  () => {
    const nowMs =
      Date.parse(
        "2026-09-30T12:00:00.000Z"
      );

    assert.equal(
      isCollaborativeListPollClosed(
        {
          deadlineAt:
            "2026-09-30T13:00:00.000Z",
          closedAt: null
        },
        {
          nowMs
        }
      ),
      false
    );

    assert.equal(
      isCollaborativeListPollClosed(
        {
          deadlineAt:
            "2026-09-30T11:59:59.000Z",
          closedAt: null
        },
        {
          nowMs
        }
      ),
      true
    );

    assert.equal(
      isCollaborativeListPollClosed(
        {
          deadlineAt: null,
          closedAt:
            "2026-09-30T11:00:00.000Z"
        },
        {
          nowMs
        }
      ),
      true
    );
  }
);


test(
  "castCollaborativeListPollVote registra y reemplaza un voto simple sin mutar la votación",
  () => {
    const original =
      normalizeCollaborativeListPoll({
        id: "poll-1",
        title: "Qué vemos",
        createdByUserId: "owner-1",
        allowMultipleVotes: false,
        options: [
          {
            source: "tmdb",
            type: "pelicula",
            externalId: "123",
            itemSnapshot: {
              title: "Dune",
              cover: ""
            }
          },
          {
            source: "tmdb",
            type: "pelicula",
            externalId: "456",
            itemSnapshot: {
              title: "Arrival",
              cover: ""
            }
          }
        ],
        votesByUserId: {
          "user-2": [
            "tmdb::pelicula::123"
          ]
        },
        deadlineAt: null,
        closedAt: null,
        createdAt:
          "2026-09-30T10:00:00.000Z"
      });

    const result =
      castCollaborativeListPollVote(
        original,
        " user-2 ",
        [
          "tmdb::pelicula::456"
        ],
        {
          nowMs:
            Date.parse(
              "2026-09-30T12:00:00.000Z"
            )
        }
      );

    assert.equal(
      result.ok,
      true
    );

    assert.deepEqual(
      result.poll.votesByUserId,
      {
        "user-2": [
          "tmdb::pelicula::456"
        ]
      }
    );

    assert.deepEqual(
      original.votesByUserId,
      {
        "user-2": [
          "tmdb::pelicula::123"
        ]
      }
    );
  }
);

test(
  "castCollaborativeListPollVote impide votar después del cierre automático",
  () => {
    const original =
      normalizeCollaborativeListPoll({
        id: "poll-1",
        title: "Qué vemos",
        createdByUserId: "owner-1",
        allowMultipleVotes: false,
        options: [
          {
            source: "tmdb",
            type: "pelicula",
            externalId: "123",
            itemSnapshot: {
              title: "Dune",
              cover: ""
            }
          },
          {
            source: "tmdb",
            type: "pelicula",
            externalId: "456",
            itemSnapshot: {
              title: "Arrival",
              cover: ""
            }
          }
        ],
        votesByUserId: {
          "user-2": [
            "tmdb::pelicula::123"
          ]
        },
        deadlineAt:
          "2026-09-30T11:00:00.000Z",
        closedAt: null,
        createdAt:
          "2026-09-30T10:00:00.000Z"
      });

    const result =
      castCollaborativeListPollVote(
        original,
        "user-2",
        [
          "tmdb::pelicula::456"
        ],
        {
          nowMs:
            Date.parse(
              "2026-09-30T12:00:00.000Z"
            )
        }
      );

    assert.deepEqual(
      result,
      {
        ok: false,
        error: "poll_closed"
      }
    );

    assert.deepEqual(
      original.votesByUserId,
      {
        "user-2": [
          "tmdb::pelicula::123"
        ]
      }
    );
  }
);


test(
  "getCollaborativeListPollResults cuenta votos y detecta un ganador único",
  () => {
    const poll =
      normalizeCollaborativeListPoll({
        id: "poll-1",
        title: "Qué vemos",
        createdByUserId: "owner-1",
        allowMultipleVotes: false,
        options: [
          {
            source: "tmdb",
            type: "pelicula",
            externalId: "123",
            itemSnapshot: {
              title: "Dune",
              cover: ""
            }
          },
          {
            source: "tmdb",
            type: "pelicula",
            externalId: "456",
            itemSnapshot: {
              title: "Arrival",
              cover: ""
            }
          }
        ],
        votesByUserId: {
          "user-2": [
            "tmdb::pelicula::123"
          ],
          "user-3": [
            "tmdb::pelicula::123"
          ],
          "user-4": [
            "tmdb::pelicula::456"
          ]
        },
        createdAt:
          "2026-09-30T10:00:00.000Z"
      });

    assert.deepEqual(
      getCollaborativeListPollResults(
        poll
      ),
      {
        totalVotes: 3,
        counts: {
          "tmdb::pelicula::123": 2,
          "tmdb::pelicula::456": 1
        },
        topContentKeys: [
          "tmdb::pelicula::123"
        ],
        winnerContentKey:
          "tmdb::pelicula::123",
        tied: false
      }
    );
  }
);


test(
  "closeCollaborativeListPoll persiste un desempate aleatorio al cerrar",
  () => {
    const poll =
      normalizeCollaborativeListPoll({
        id: "poll-1",
        title: "Qué vemos",
        createdByUserId: "owner-1",
        allowMultipleVotes: false,
        options: [
          {
            source: "tmdb",
            type: "pelicula",
            externalId: "123",
            itemSnapshot: {
              title: "Dune",
              cover: ""
            }
          },
          {
            source: "tmdb",
            type: "pelicula",
            externalId: "456",
            itemSnapshot: {
              title: "Arrival",
              cover: ""
            }
          }
        ],
        votesByUserId: {
          "user-2": [
            "tmdb::pelicula::123"
          ],
          "user-3": [
            "tmdb::pelicula::456"
          ]
        },
        deadlineAt: null,
        closedAt: null,
        createdAt:
          "2026-09-30T10:00:00.000Z"
      });

    const result =
      closeCollaborativeListPoll(
        poll,
        {
          nowMs:
            Date.parse(
              "2026-09-30T12:00:00.000Z"
            ),
          random: () => 0.99
        }
      );

    assert.equal(
      result.ok,
      true
    );

    assert.equal(
      result.poll.closedAt,
      "2026-09-30T12:00:00.000Z"
    );

    assert.equal(
      result.poll.winnerContentKey,
      "tmdb::pelicula::456"
    );

    assert.deepEqual(
      poll,
      {
        ...poll,
        closedAt: null
      }
    );
  }
);

test(
  "normalizeCollaborativeListPoll conserva un ganador cerrado válido",
  () => {
    const result =
      normalizeCollaborativeListPoll({
        id: "poll-1",
        title: "Qué vemos",
        createdByUserId: "owner-1",
        allowMultipleVotes: false,
        options: [
          {
            source: "tmdb",
            type: "pelicula",
            externalId: "123",
            itemSnapshot: {
              title: "Dune",
              cover: ""
            }
          },
          {
            source: "tmdb",
            type: "pelicula",
            externalId: "456",
            itemSnapshot: {
              title: "Arrival",
              cover: ""
            }
          }
        ],
        votesByUserId: {
          "user-2": [
            "tmdb::pelicula::123"
          ],
          "user-3": [
            "tmdb::pelicula::456"
          ]
        },
        deadlineAt: null,
        closedAt:
          "2026-09-30T12:00:00.000Z",
        winnerContentKey:
          "tmdb::pelicula::456",
        createdAt:
          "2026-09-30T10:00:00.000Z"
      });

    assert.equal(
      result.winnerContentKey,
      "tmdb::pelicula::456"
    );
  }
);

test(
  "closeCollaborativeListPoll no vuelve a sortear una votación ya cerrada",
  () => {
    const poll =
      normalizeCollaborativeListPoll({
        id: "poll-1",
        title: "Qué vemos",
        createdByUserId: "owner-1",
        allowMultipleVotes: false,
        options: [
          {
            source: "tmdb",
            type: "pelicula",
            externalId: "123",
            itemSnapshot: {
              title: "Dune",
              cover: ""
            }
          },
          {
            source: "tmdb",
            type: "pelicula",
            externalId: "456",
            itemSnapshot: {
              title: "Arrival",
              cover: ""
            }
          }
        ],
        votesByUserId: {
          "user-2": [
            "tmdb::pelicula::123"
          ],
          "user-3": [
            "tmdb::pelicula::456"
          ]
        },
        deadlineAt: null,
        closedAt:
          "2026-09-30T12:00:00.000Z",
        winnerContentKey:
          "tmdb::pelicula::123",
        createdAt:
          "2026-09-30T10:00:00.000Z"
      });

    const result =
      closeCollaborativeListPoll(
        poll,
        {
          nowMs:
            Date.parse(
              "2026-09-30T13:00:00.000Z"
            ),
          random: () => 0.99
        }
      );

    assert.equal(
      result.ok,
      true
    );

    assert.equal(
      result.poll.closedAt,
      "2026-09-30T12:00:00.000Z"
    );

    assert.equal(
      result.poll.winnerContentKey,
      "tmdb::pelicula::123"
    );
  }
);


test(
  "finalizeCollaborativeListPollIfExpired cierra y resuelve una votación al vencer su fecha límite",
  () => {
    const poll =
      normalizeCollaborativeListPoll({
        id: "poll-1",
        title: "Qué vemos",
        createdByUserId: "owner-1",
        allowMultipleVotes: false,
        options: [
          {
            source: "tmdb",
            type: "pelicula",
            externalId: "123",
            itemSnapshot: {
              title: "Dune",
              cover: ""
            }
          },
          {
            source: "tmdb",
            type: "pelicula",
            externalId: "456",
            itemSnapshot: {
              title: "Arrival",
              cover: ""
            }
          }
        ],
        votesByUserId: {
          "user-2": [
            "tmdb::pelicula::123"
          ],
          "user-3": [
            "tmdb::pelicula::123"
          ],
          "user-4": [
            "tmdb::pelicula::456"
          ]
        },
        deadlineAt:
          "2026-09-30T12:00:00.000Z",
        closedAt: null,
        winnerContentKey: "",
        createdAt:
          "2026-09-30T10:00:00.000Z"
      });

    const result =
      finalizeCollaborativeListPollIfExpired(
        poll,
        {
          nowMs:
            Date.parse(
              "2026-09-30T13:00:00.000Z"
            )
        }
      );

    assert.equal(
      result.changed,
      true
    );

    assert.equal(
      result.poll.closedAt,
      "2026-09-30T13:00:00.000Z"
    );

    assert.equal(
      result.poll.winnerContentKey,
      "tmdb::pelicula::123"
    );
  }
);
