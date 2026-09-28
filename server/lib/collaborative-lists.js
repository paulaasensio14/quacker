function _normalizeUserId(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}


function _normalizeCollaborators(
  value,
  {
    ownerUserId = ""
  } = {}
) {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalizedOwnerUserId =
    _normalizeUserId(ownerUserId);

  const seen = new Set();
  const collaborators = [];

  for (const entry of value) {
    const userId =
      _normalizeUserId(entry);

    if (
      !userId ||
      userId === normalizedOwnerUserId ||
      seen.has(userId)
    ) {
      continue;
    }

    seen.add(userId);
    collaborators.push(userId);
  }

  return collaborators;
}


export function normalizeCollaborativeList(
  value,
  {
    fallbackOwnerUserId = ""
  } = {}
) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const ownerUserId =
    _normalizeUserId(
      value.ownerUserId
    ) ||
    _normalizeUserId(
      fallbackOwnerUserId
    );

  return {
    ...value,
    ownerUserId,
    collaborators:
      _normalizeCollaborators(
        value.collaborators,
        {
          ownerUserId
        }
      )
  };
}


export function normalizeCollaborativeLists(
  value,
  {
    fallbackOwnerUserId = ""
  } = {}
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(
      (entry) =>
        normalizeCollaborativeList(
          entry,
          {
            fallbackOwnerUserId
          }
        )
    )
    .filter(Boolean);
}


export function getCollaborativeListRole(
  list,
  userId
) {
  const normalizedUserId =
    _normalizeUserId(userId);

  if (!normalizedUserId) {
    return "";
  }

  const normalizedList =
    normalizeCollaborativeList(
      list
    );

  if (!normalizedList) {
    return "";
  }

  if (
    normalizedList.ownerUserId ===
    normalizedUserId
  ) {
    return "owner";
  }

  if (
    normalizedList.collaborators.includes(
      normalizedUserId
    )
  ) {
    return "collaborator";
  }

  return "";
}
