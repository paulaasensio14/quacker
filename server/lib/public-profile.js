import {
  normalizeContentIdentity
} from "./content-identity.js";

import {
  normalizeFavorites
} from "./favorites.js";

import {
  normalizeProfilePrivacy
} from "./profile-privacy.js";

export function normalizePublicUsername(value) {
  if (typeof value !== "string") return "";

  const trimmed = value.trim();
  if (!trimmed) return "";

  const withoutPrefix = trimmed.startsWith("@")
    ? trimmed.slice(1)
    : trimmed;

  const username = withoutPrefix.toLowerCase();

  if (!/^[a-z0-9_]{2,20}$/.test(username)) {
    return "";
  }

  return username;
}

function _normalizePublicMediaSource(value) {
  const source = String(value || "").trim();

  if (!source) return "";

  const isAllowedDataImage =
    /^data:image\/(?:jpeg|png|webp|gif);/i.test(
      source
    );

  if (
    source.startsWith("https://") ||
    source.startsWith("/assets/") ||
    source.startsWith("assets/") ||
    isAllowedDataImage
  ) {
    return source;
  }

  return "";
}

export function normalizePublicIdentity(profile = {}) {
  return {
    name: String(profile?.name || "").trim(),
    username: normalizePublicUsername(
      profile?.handle
    ),
    avatar: _normalizePublicMediaSource(
      profile?.avatar
    )
  };
}

function _normalizePublicProfile(profile = {}) {
  return {
    ...normalizePublicIdentity(profile),
    bio: String(profile?.bio || "")
      .trim()
      .slice(0, 180)
  };
}

function _toPublicFavorites(value) {
  const favorites = normalizeFavorites(value);

  return Object.fromEntries(
    Object.entries(favorites).map(
      ([type, items]) => [
        type,
        items.map((item) => ({
          contentType: item.contentType,
          source: item.source,
          externalId: item.externalId,
          itemSnapshot: {
            title: item.itemSnapshot.title,
            cover: _normalizePublicMediaSource(
              item.itemSnapshot.cover
            )
          }
        }))
      ]
    )
  );
}

function _normalizePublicDate(value) {
  const safeValue = String(value || "").trim();

  if (!safeValue) return "";

  const parsed = new Date(safeValue);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString();
}

function _normalizePublicActivityPayload(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const payload = {};

  const season = Number(value.season);
  const episode = Number(value.episode);
  const progress = Number(value.progress);

  if (
    Number.isInteger(season) &&
    season > 0 &&
    Number.isInteger(episode) &&
    episode > 0
  ) {
    payload.season = season;
    payload.episode = episode;
  }

  if (Number.isFinite(progress)) {
    payload.progress =
      Math.max(0, Math.min(100, progress));
  }

  return Object.keys(payload).length
    ? payload
    : null;
}

function _toPublicActivity(
  activities,
  library
) {
  const safeActivities = Array.isArray(activities)
    ? activities
    : [];

  const safeLibrary = Array.isArray(library)
    ? library
    : [];

  const libraryById = new Map(
    safeLibrary.map((item) => [
      String(item?.id || "").trim(),
      item
    ])
  );

  return safeActivities
    .map((activity) => {
      const type = String(
        activity?.type || ""
      ).trim();

      if (
        type !== "progress" &&
        type !== "completed"
      ) {
        return null;
      }

      const targetId = String(
        activity?.targetId || ""
      ).trim();

      const item = libraryById.get(targetId);

      if (!targetId || !item) {
        return null;
      }

      const identity = normalizeContentIdentity({
        source: item.source,
        type: item.type,
        externalId: item.externalId
      });

      if (!identity.ok) {
        return null;
      }

      const title = String(
        item.title || ""
      ).trim().slice(0, 120);

      const createdAt =
        _normalizePublicDate(
          activity?.createdAt
        );

      if (!title || !createdAt) {
        return null;
      }

      return {
        type,
        contentType: identity.type,
        source: identity.source,
        externalId: identity.externalId,
        itemSnapshot: {
          title,
          cover: _normalizePublicMediaSource(
            item.cover
          )
        },
        minutes: Number.isFinite(
          Number(activity?.minutes)
        )
          ? Math.max(
              0,
              Number(activity.minutes)
            )
          : 0,
        createdAt,
        payload:
          _normalizePublicActivityPayload(
            activity?.payload
          )
      };
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    );
}

function _toPublicLists(
  lists,
  library
) {
  const safeLists = Array.isArray(lists)
    ? lists
    : [];

  const safeLibrary = Array.isArray(library)
    ? library
    : [];

  const libraryById = new Map(
    safeLibrary.map((item) => [
      String(item?.id || "").trim(),
      item
    ])
  );

  return safeLists
    .filter(
      (list) =>
        String(
          list?.visibility || ""
        ).trim().toLowerCase() === "public"
    )
    .map((list) => {
      const items = (
        Array.isArray(list?.items)
          ? list.items
          : []
      )
        .map((entry) => {
          const itemId = String(
            typeof entry === "string"
              ? entry
              : entry?.id || ""
          ).trim();

          if (!itemId) return null;

          const item = libraryById.get(itemId);
          if (!item) return null;

          const identity =
            normalizeContentIdentity({
              source: item.source,
              type: item.type,
              externalId: item.externalId
            });

          if (!identity.ok) {
            return null;
          }

          const title = String(
            item.title || ""
          ).trim().slice(0, 120);

          if (!title) {
            return null;
          }

          return {
            contentType: identity.type,
            source: identity.source,
            externalId: identity.externalId,
            itemSnapshot: {
              title,
              cover:
                _normalizePublicMediaSource(
                  item.cover
                )
            }
          };
        })
        .filter(Boolean);

      return {
        name: String(
          list?.name || ""
        ).replace(/\s+/g, " ").trim().slice(0, 80),
        description: String(
          list?.description || ""
        ).trim(),
        itemsCount: items.length,
        items
      };
    });
}

function _toPublicReviews(opinions) {
  const safeOpinions = Array.isArray(opinions)
    ? opinions
    : [];

  const allowedTags = new Set([
    "masterpiece",
    "casual",
    "surprised_me",
    "made_me_cry",
    "made_me_laugh",
    "comfort",
    "thought_provoking",
    "overrated",
    "underrated",
    "would_rewatch",
    "highly_recommended"
  ]);

  return safeOpinions
    .map((opinion) => {
      const review =
        opinion?.review &&
        typeof opinion.review === "object" &&
        !Array.isArray(opinion.review)
          ? opinion.review
          : null;

      if (
        !review ||
        review.privacy !== "public"
      ) {
        return null;
      }

      const contentType = String(
        opinion?.contentType || ""
      ).trim();

      const snapshot =
        opinion?.itemSnapshot &&
        typeof opinion.itemSnapshot === "object" &&
        !Array.isArray(opinion.itemSnapshot)
          ? opinion.itemSnapshot
          : null;

      if (!snapshot) {
        return null;
      }

      const identity = normalizeContentIdentity({
        source: snapshot.source,
        type: contentType,
        externalId: snapshot.externalId
      });

      if (!identity.ok) {
        return null;
      }

      const title = String(
        snapshot.title || ""
      ).trim().slice(0, 120);

      const text = String(
        review.text || ""
      ).trim();

      if (!title || !text) {
        return null;
      }

      const createdAt =
        _normalizePublicDate(
          review.createdAt
        ) ||
        _normalizePublicDate(
          opinion?.createdAt
        );

      const updatedAt =
        _normalizePublicDate(
          review.updatedAt
        ) ||
        _normalizePublicDate(
          opinion?.updatedAt
        ) ||
        createdAt;

      if (!createdAt || !updatedAt) {
        return null;
      }

      const rating =
        Number.isInteger(opinion?.rating) &&
        opinion.rating >= 1 &&
        opinion.rating <= 5
          ? opinion.rating
          : null;

      const tags = Array.isArray(opinion?.tags)
        ? [
            ...new Set(
              opinion.tags
                .map((tag) =>
                  String(tag || "")
                    .trim()
                    .toLowerCase()
                )
                .filter((tag) =>
                  allowedTags.has(tag)
                )
            )
          ]
        : [];

      return {
        contentType: identity.type,
        source: identity.source,
        externalId: identity.externalId,
        itemSnapshot: {
          title
        },
        rating,
        tags,
        review: {
          text,
          spoiler: review.spoiler === true,
          createdAt,
          updatedAt
        }
      };
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        new Date(b.review.updatedAt) -
        new Date(a.review.updatedAt)
    );
}

function _toPublicStats(library) {
  const allowedTypes = new Set([
    "pelicula",
    "serie",
    "game",
    "book"
  ]);

  const safeLibrary = (
    Array.isArray(library)
      ? library
      : []
  ).filter((item) =>
    allowedTypes.has(
      String(item?.type || "").trim()
    )
  );

  const stats = {
    totalItems: safeLibrary.length,
    completedCount: 0,
    inProgressCount: 0,
    notStartedCount: 0,
    byType: {
      pelicula: 0,
      serie: 0,
      game: 0,
      book: 0
    }
  };

  for (const item of safeLibrary) {
    const type = String(
      item?.type || ""
    ).trim();

    stats.byType[type] += 1;

    const progress = Math.max(
      0,
      Math.min(
        100,
        Number(item?.progress ?? 0)
      )
    );

    const status =
      progress >= 100 ||
      item?.status === "completed"
        ? "completed"
        : progress <= 0
          ? "not_started"
          : "in_progress";

    if (status === "completed") {
      stats.completedCount += 1;
    } else if (status === "in_progress") {
      stats.inProgressCount += 1;
    } else {
      stats.notStartedCount += 1;
    }
  }

  return stats;
}

export function getPublicProfileByUsername(
  users,
  username,
  { viewerUserId = "" } = {}
) {
  const normalizedUsername =
    normalizePublicUsername(username);

  if (
    !normalizedUsername ||
    !users ||
    typeof users !== "object" ||
    Array.isArray(users)
  ) {
    return null;
  }

  const targetEntry = Object.entries(users).find(
    ([, candidate]) =>
      normalizePublicUsername(
        candidate?.profile?.handle
      ) === normalizedUsername
  );

  if (!targetEntry) return null;

  const [
    targetUserId,
    userBucket
  ] = targetEntry;

  const privacy = normalizeProfilePrivacy(
    userBucket.privacy
  );

  if (
    privacy.profileVisibility === "hidden"
  ) {
    return null;
  }

  const profile = _normalizePublicProfile(
    userBucket.profile
  );

  if (!profile.username) {
    return null;
  }

  const normalizedViewerUserId =
    String(viewerUserId || "").trim();

  const viewerBucket =
    normalizedViewerUserId
      ? users[normalizedViewerUserId]
      : null;

  const viewerFollowing =
    Array.isArray(viewerBucket?.following)
      ? viewerBucket.following
      : [];

  const viewerFollowsTarget =
    viewerFollowing.includes(
      targetUserId
    );

  const targetFollowing =
    Array.isArray(userBucket?.following)
      ? userBucket.following
      : [];

  const targetFollowRequests =
    Array.isArray(userBucket?.followRequests)
      ? userBucket.followRequests
      : [];

  const hasPendingRequest =
    normalizedViewerUserId
      ? targetFollowRequests.includes(
          normalizedViewerUserId
        )
      : false;

  const targetFollowsViewer =
    normalizedViewerUserId
      ? targetFollowing.includes(
          normalizedViewerUserId
        )
      : false;

  const isFriend =
    viewerFollowsTarget &&
    targetFollowsViewer;

  const isOwner =
    normalizedViewerUserId ===
    targetUserId;

  const viewerState =
    isOwner
      ? "self"
      : isFriend
        ? "friend"
        : viewerFollowsTarget
          ? "following"
          : hasPendingRequest
            ? "requested"
            : "none";

  const hasFullAccess =
    privacy.profileVisibility === "public" ||
    isOwner ||
    (
      privacy.profileVisibility === "followers" &&
      viewerFollowsTarget
    ) ||
    (
      privacy.profileVisibility === "friends" &&
      isFriend
    );

  if (!hasFullAccess) {
    const restrictedResult = {
      profile: {
        name: profile.name,
        username: profile.username,
        avatar: profile.avatar
      }
    };

    if (normalizedViewerUserId) {
      restrictedResult.viewer = {
        access: "restricted",
        state: viewerState
      };
    }

    return restrictedResult;
  }

  const socialGraph =
    getPublicSocialGraphByUsername(
      users,
      normalizedUsername,
      {
        viewerUserId:
          normalizedViewerUserId
      }
    );

  const result = {
    profile,
    social: {
      followersCount:
        socialGraph?.access === "full"
          ? socialGraph.followers.length
          : 0,
      followingCount:
        socialGraph?.access === "full"
          ? socialGraph.following.length
          : 0
    }
  };

  if (normalizedViewerUserId) {
    result.viewer = {
      access: "full",
      state: viewerState
    };
  }

  if (privacy.favorites === true) {
    result.favorites = _toPublicFavorites(
      userBucket.favorites
    );
  }

  if (privacy.activity === true) {
    result.activity = _toPublicActivity(
      userBucket.activities,
      userBucket.library
    );
  }

  if (privacy.lists === true) {
    result.lists = _toPublicLists(
      userBucket.lists,
      userBucket.library
    );
  }

  if (privacy.reviews === true) {
    result.reviews = _toPublicReviews(
      userBucket.opinions
    );
  }

  if (privacy.stats === true) {
    result.stats = _toPublicStats(
      userBucket.library
    );
  }

  return result;
}

export function getPublicSocialGraphByUsername(
  users,
  username,
  { viewerUserId = "" } = {}
) {
  const normalizedUsername =
    normalizePublicUsername(username);

  if (
    !normalizedUsername ||
    !users ||
    typeof users !== "object" ||
    Array.isArray(users)
  ) {
    return null;
  }

  const targetEntry =
    Object.entries(users).find(
      ([, candidate]) =>
        normalizePublicUsername(
          candidate?.profile?.handle
        ) === normalizedUsername
    );

  if (!targetEntry) return null;

  const [
    targetUserId,
    targetBucket
  ] = targetEntry;

  const targetPrivacy =
    normalizeProfilePrivacy(
      targetBucket?.privacy
    );

  if (
    targetPrivacy.profileVisibility ===
    "hidden"
  ) {
    return null;
  }

  const normalizedViewerUserId =
    String(viewerUserId || "").trim();

  const viewerBucket =
    normalizedViewerUserId
      ? users[normalizedViewerUserId]
      : null;

  const viewerFollowing =
    Array.isArray(viewerBucket?.following)
      ? viewerBucket.following
      : [];

  const targetFollowing =
    Array.isArray(targetBucket?.following)
      ? targetBucket.following
      : [];

  const viewerFollowsTarget =
    viewerFollowing.includes(
      targetUserId
    );

  const targetFollowsViewer =
    normalizedViewerUserId
      ? targetFollowing.includes(
          normalizedViewerUserId
        )
      : false;

  const isOwner =
    normalizedViewerUserId ===
    targetUserId;

  const isFriend =
    viewerFollowsTarget &&
    targetFollowsViewer;

  const hasFullAccess =
    targetPrivacy.profileVisibility ===
      "public" ||
    isOwner ||
    (
      targetPrivacy.profileVisibility ===
        "followers" &&
      viewerFollowsTarget
    ) ||
    (
      targetPrivacy.profileVisibility ===
        "friends" &&
      isFriend
    );

  if (!hasFullAccess) {
    return {
      access: "restricted"
    };
  }

  const toVisibleIdentity = (
    userBucket
  ) => {
    if (!userBucket) return null;

    const privacy =
      normalizeProfilePrivacy(
        userBucket.privacy
      );

    if (
      privacy.profileVisibility ===
      "hidden"
    ) {
      return null;
    }

    const identity =
      normalizePublicIdentity(
        userBucket.profile
      );

    if (!identity.username) {
      return null;
    }

    return identity;
  };

  const followers =
    Object.entries(users)
      .filter(
        ([userId, userBucket]) =>
          userId !== targetUserId &&
          Array.isArray(
            userBucket?.following
          ) &&
          userBucket.following.includes(
            targetUserId
          )
      )
      .map(([, userBucket]) =>
        toVisibleIdentity(userBucket)
      )
      .filter(Boolean);

  const following =
    targetFollowing
      .map((followedUserId) =>
        toVisibleIdentity(
          users[followedUserId]
        )
      )
      .filter(Boolean);

  return {
    access: "full",
    followers,
    following
  };
}
