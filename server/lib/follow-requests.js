function normalizeUserId(value) {
  if (typeof value !== "string") return "";

  return value.trim();
}

export function normalizeFollowRequests(
  value,
  {
    ownerUserId = ""
  } = {}
) {
  if (!Array.isArray(value)) return [];

  const normalizedOwnerUserId =
    normalizeUserId(ownerUserId);

  const seen = new Set();
  const followRequests = [];

  for (const entry of value) {
    const userId =
      normalizeUserId(entry);

    if (
      !userId ||
      userId === normalizedOwnerUserId ||
      seen.has(userId)
    ) {
      continue;
    }

    seen.add(userId);
    followRequests.push(userId);
  }

  return followRequests;
}

export function addFollowRequest(
  followRequests,
  requesterUserId,
  {
    ownerUserId = ""
  } = {}
) {
  const normalizedOwnerUserId =
    normalizeUserId(ownerUserId);

  const normalizedRequesterUserId =
    normalizeUserId(requesterUserId);

  if (!normalizedRequesterUserId) {
    return {
      ok: false,
      error: "invalid_follow_target"
    };
  }

  if (
    normalizedOwnerUserId &&
    normalizedRequesterUserId ===
      normalizedOwnerUserId
  ) {
    return {
      ok: false,
      error: "cannot_follow_self"
    };
  }

  const normalizedFollowRequests =
    normalizeFollowRequests(
      followRequests,
      {
        ownerUserId:
          normalizedOwnerUserId
      }
    );

  if (
    normalizedFollowRequests.includes(
      normalizedRequesterUserId
    )
  ) {
    return {
      ok: false,
      error: "follow_request_exists"
    };
  }

  return {
    ok: true,
    followRequests: [
      ...normalizedFollowRequests,
      normalizedRequesterUserId
    ]
  };
}

export function removeFollowRequest(
  followRequests,
  requesterUserId,
  {
    ownerUserId = ""
  } = {}
) {
  const normalizedRequesterUserId =
    normalizeUserId(requesterUserId);

  if (!normalizedRequesterUserId) {
    return {
      ok: false,
      error: "invalid_follow_target"
    };
  }

  const normalizedFollowRequests =
    normalizeFollowRequests(
      followRequests,
      {
        ownerUserId
      }
    );

  if (
    !normalizedFollowRequests.includes(
      normalizedRequesterUserId
    )
  ) {
    return {
      ok: false,
      error: "follow_request_not_found"
    };
  }

  return {
    ok: true,
    followRequests:
      normalizedFollowRequests.filter(
        (userId) =>
          userId !==
          normalizedRequesterUserId
      )
  };
}
