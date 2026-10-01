import {
  normalizeContentIdentity
} from "./content-identity.js";


function _normalizeText(value) {
  return String(value ?? "").trim();
}


function _normalizeOptions(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seenContentKeys = new Set();
  const options = [];

  for (const entry of value) {
    if (
      !entry ||
      typeof entry !== "object" ||
      Array.isArray(entry)
    ) {
      continue;
    }

    const identity =
      normalizeContentIdentity({
        source: entry.source,
        type: entry.type,
        externalId: entry.externalId
      });

    if (
      !identity.ok ||
      seenContentKeys.has(identity.key)
    ) {
      continue;
    }

    const snapshot =
      entry.itemSnapshot &&
      typeof entry.itemSnapshot === "object" &&
      !Array.isArray(entry.itemSnapshot)
        ? entry.itemSnapshot
        : {};

    seenContentKeys.add(identity.key);

    options.push({
      source: identity.source,
      type: identity.type,
      externalId: identity.externalId,
      contentKey: identity.key,
      itemSnapshot: {
        title:
          _normalizeText(snapshot.title)
            .replace(/\s+/g, " "),
        cover:
          _normalizeText(snapshot.cover)
      }
    });
  }

  return options;
}


function _normalizeVotesByUserId(
  value,
  {
    options = [],
    allowMultipleVotes = false
  } = {}
) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  const validContentKeys =
    new Set(
      options.map(
        (option) =>
          String(
            option?.contentKey || ""
          ).trim()
      ).filter(Boolean)
    );

  const votesByUserId = {};

  for (
    const [rawUserId, rawVotes]
    of Object.entries(value)
  ) {
    const userId =
      _normalizeText(rawUserId);

    if (
      !userId ||
      !Array.isArray(rawVotes)
    ) {
      continue;
    }

    const seen = new Set();
    const votes = [];

    for (const rawVote of rawVotes) {
      const contentKey =
        _normalizeText(rawVote);

      if (
        !contentKey ||
        !validContentKeys.has(contentKey) ||
        seen.has(contentKey)
      ) {
        continue;
      }

      seen.add(contentKey);
      votes.push(contentKey);

      if (!allowMultipleVotes) {
        break;
      }
    }

    if (votes.length > 0) {
      votesByUserId[userId] = votes;
    }
  }

  return votesByUserId;
}


export function normalizeCollaborativeListPoll(
  value
) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const allowMultipleVotes =
    value.allowMultipleVotes === true;

  const options =
    _normalizeOptions(value.options);

  const validContentKeys =
    new Set(
      options.map(
        (option) =>
          option.contentKey
      )
    );

  const rawWinnerContentKey =
    _normalizeText(
      value.winnerContentKey
    );

  const winnerContentKey =
    validContentKeys.has(
      rawWinnerContentKey
    )
      ? rawWinnerContentKey
      : "";

  return {
    id:
      _normalizeText(value.id),
    title:
      _normalizeText(value.title)
        .replace(/\s+/g, " "),
    createdByUserId:
      _normalizeText(
        value.createdByUserId
      ),
    allowMultipleVotes,
    options,
    votesByUserId:
      _normalizeVotesByUserId(
        value.votesByUserId,
        {
          options,
          allowMultipleVotes
        }
      ),
    deadlineAt:
      value.deadlineAt ?? null,
    closedAt:
      value.closedAt ?? null,
    winnerContentKey,
    createdAt:
      _normalizeText(value.createdAt)
  };
}


export function isCollaborativeListPollClosed(
  poll,
  {
    nowMs = Date.now()
  } = {}
) {
  if (
    !poll ||
    typeof poll !== "object" ||
    Array.isArray(poll)
  ) {
    return false;
  }

  const closedAt =
    _normalizeText(poll.closedAt);

  if (closedAt) {
    return true;
  }

  const deadlineAt =
    _normalizeText(poll.deadlineAt);

  if (!deadlineAt) {
    return false;
  }

  const deadlineMs =
    Date.parse(deadlineAt);

  const safeNowMs =
    Number(nowMs);

  return (
    Number.isFinite(deadlineMs) &&
    Number.isFinite(safeNowMs) &&
    deadlineMs <= safeNowMs
  );
}


export function castCollaborativeListPollVote(
  poll,
  userId,
  votes,
  {
    nowMs = Date.now()
  } = {}
) {
  const normalizedPoll =
    normalizeCollaborativeListPoll(
      poll
    );

  const normalizedUserId =
    _normalizeText(userId);

  if (!normalizedPoll) {
    return {
      ok: false,
      error: "invalid_poll"
    };
  }

  if (!normalizedUserId) {
    return {
      ok: false,
      error: "invalid_user"
    };
  }

  if (
    isCollaborativeListPollClosed(
      normalizedPoll,
      {
        nowMs
      }
    )
  ) {
    return {
      ok: false,
      error: "poll_closed"
    };
  }

  if (!Array.isArray(votes)) {
    return {
      ok: false,
      error: "invalid_vote"
    };
  }

  const validContentKeys =
    new Set(
      normalizedPoll.options.map(
        (option) =>
          option.contentKey
      )
    );

  const seen = new Set();
  const normalizedVotes = [];

  for (const rawVote of votes) {
    const contentKey =
      _normalizeText(rawVote);

    if (
      !contentKey ||
      !validContentKeys.has(contentKey) ||
      seen.has(contentKey)
    ) {
      continue;
    }

    seen.add(contentKey);
    normalizedVotes.push(
      contentKey
    );

    if (
      !normalizedPoll
        .allowMultipleVotes
    ) {
      break;
    }
  }

  if (normalizedVotes.length === 0) {
    return {
      ok: false,
      error: "invalid_vote"
    };
  }

  return {
    ok: true,
    poll: {
      ...normalizedPoll,
      votesByUserId: {
        ...normalizedPoll.votesByUserId,
        [normalizedUserId]:
          normalizedVotes
      }
    }
  };
}


export function getCollaborativeListPollResults(
  poll
) {
  const normalizedPoll =
    normalizeCollaborativeListPoll(
      poll
    );

  if (!normalizedPoll) {
    return null;
  }

  const counts = {};

  for (
    const option
    of normalizedPoll.options
  ) {
    counts[option.contentKey] = 0;
  }

  let totalVotes = 0;

  for (
    const votes
    of Object.values(
      normalizedPoll.votesByUserId
    )
  ) {
    for (const contentKey of votes) {
      if (
        !Object.prototype.hasOwnProperty.call(
          counts,
          contentKey
        )
      ) {
        continue;
      }

      counts[contentKey] += 1;
      totalVotes += 1;
    }
  }

  const maxVotes =
    Object.keys(counts).length > 0
      ? Math.max(
          ...Object.values(counts)
        )
      : 0;

  const topContentKeys =
    Object.entries(counts)
      .filter(
        ([, count]) =>
          count === maxVotes
      )
      .map(
        ([contentKey]) =>
          contentKey
      );

  const tied =
    topContentKeys.length > 1;

  return {
    totalVotes,
    counts,
    topContentKeys,
    winnerContentKey:
      topContentKeys.length === 1
        ? topContentKeys[0]
        : "",
    tied
  };
}


export function closeCollaborativeListPoll(
  poll,
  {
    nowMs = Date.now(),
    random = Math.random
  } = {}
) {
  const normalizedPoll =
    normalizeCollaborativeListPoll(
      poll
    );

  if (!normalizedPoll) {
    return {
      ok: false,
      error: "invalid_poll"
    };
  }

  if (
    _normalizeText(
      normalizedPoll.closedAt
    )
  ) {
    return {
      ok: true,
      poll: normalizedPoll
    };
  }

  const safeNowMs =
    Number(nowMs);

  if (!Number.isFinite(safeNowMs)) {
    return {
      ok: false,
      error: "invalid_close_time"
    };
  }

  const results =
    getCollaborativeListPollResults(
      normalizedPoll
    );

  let winnerContentKey =
    results?.winnerContentKey || "";

  if (
    !winnerContentKey &&
    results?.topContentKeys?.length > 1
  ) {
    const randomValue =
      Number(random());

    const safeRandomValue =
      Number.isFinite(randomValue)
        ? Math.min(
            Math.max(randomValue, 0),
            0.9999999999999999
          )
        : 0;

    const winnerIndex =
      Math.floor(
        safeRandomValue *
        results.topContentKeys.length
      );

    winnerContentKey =
      results.topContentKeys[
        winnerIndex
      ];
  }

  return {
    ok: true,
    poll: {
      ...normalizedPoll,
      closedAt:
        new Date(
          safeNowMs
        ).toISOString(),
      winnerContentKey
    }
  };
}


export function finalizeCollaborativeListPollIfExpired(
  poll,
  {
    nowMs = Date.now(),
    random = Math.random
  } = {}
) {
  const normalizedPoll =
    normalizeCollaborativeListPoll(
      poll
    );

  if (!normalizedPoll) {
    return {
      ok: false,
      error: "invalid_poll",
      changed: false,
      poll: null
    };
  }

  if (
    _normalizeText(
      normalizedPoll.closedAt
    )
  ) {
    return {
      ok: true,
      changed: false,
      poll: normalizedPoll
    };
  }

  const safeNowMs =
    Number(nowMs);

  if (!Number.isFinite(safeNowMs)) {
    return {
      ok: false,
      error: "invalid_close_time",
      changed: false,
      poll: normalizedPoll
    };
  }

  const deadlineAt =
    _normalizeText(
      normalizedPoll.deadlineAt
    );

  if (!deadlineAt) {
    return {
      ok: true,
      changed: false,
      poll: normalizedPoll
    };
  }

  const deadlineMs =
    Date.parse(deadlineAt);

  if (
    !Number.isFinite(deadlineMs) ||
    deadlineMs > safeNowMs
  ) {
    return {
      ok: true,
      changed: false,
      poll: normalizedPoll
    };
  }

  const closed =
    closeCollaborativeListPoll(
      normalizedPoll,
      {
        nowMs: safeNowMs,
        random
      }
    );

  if (!closed.ok) {
    return {
      ...closed,
      changed: false
    };
  }

  return {
    ok: true,
    changed: true,
    poll: closed.poll
  };
}
