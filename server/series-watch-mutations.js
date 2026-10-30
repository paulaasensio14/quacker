/**
 * Calcula cambios en los episodios vistos de una serie.
 *
 * No modifica el historial original ni realiza escrituras.
 * El servidor debe validar la propiedad del item y persistir
 * el resultado en una operación única.
 */
export function applySeriesWatchMutation({
  itemId,
  seasonBreakdown,
  history,
  season,
  episodes,
  watched
} = {}) {
  const safeItemId = String(itemId || "").trim();

  if (!safeItemId) {
    throw new Error("invalid_item_id");
  }

  if (typeof watched !== "boolean") {
    throw new Error("invalid_watched_state");
  }

  if (!Number.isInteger(season) || season < 1) {
    throw new Error("invalid_season");
  }

  const breakdown = Array.isArray(seasonBreakdown)
    ? seasonBreakdown
    : [];

  const normalizedBreakdown = breakdown.map((entry) => ({
    seasonNumber: Number(entry?.seasonNumber),
    episodeCount: Number(entry?.episodeCount)
  }));

  if (normalizedBreakdown.some((entry) =>
    !Number.isInteger(entry.seasonNumber) ||
    entry.seasonNumber < 1 ||
    !Number.isInteger(entry.episodeCount) ||
    entry.episodeCount < 1
  )) {
    throw new Error("invalid_season_breakdown");
  }

  const seasonNumbers = normalizedBreakdown.map(
    (entry) => entry.seasonNumber
  );

  if (new Set(seasonNumbers).size !== seasonNumbers.length) {
    throw new Error("duplicate_season");
  }

  const selectedSeason = normalizedBreakdown.find(
    (entry) => entry.seasonNumber === season
  );

  if (!selectedSeason) {
    throw new Error("invalid_season");
  }

  if (!Array.isArray(episodes) || episodes.length === 0) {
    throw new Error("invalid_episode");
  }

  const requestedEpisodes = new Set();

  for (const episode of episodes) {
    if (
      !Number.isInteger(episode) ||
      episode < 1 ||
      episode > selectedSeason.episodeCount
    ) {
      throw new Error("invalid_episode");
    }

    requestedEpisodes.add(episode);
  }

  const original = Array.isArray(history) ? history : [];

  const current = original.map((entry) => ({
    ...entry,
    meta: entry?.meta && typeof entry.meta === "object"
      ? { ...entry.meta }
      : {}
  }));

  const keyFor = (seasonNumber, episodeNumber) =>
    `${seasonNumber}:${episodeNumber}`;

  const watchedKeys = new Set();

  for (const event of current) {
    if (
      event?.eventType !== "episode_watched" ||
      String(event?.itemId || "") !== safeItemId
    ) {
      continue;
    }

    const key = keyFor(
      Number(event?.meta?.season),
      Number(event?.meta?.episode)
    );

    watchedKeys.add(key);
  }

  const added = [];
  const removed = [];

  const now = new Date().toISOString();

  for (const episode of requestedEpisodes) {
    const key = keyFor(season, episode);

    if (watched) {
      if (watchedKeys.has(key)) continue;

      const event = {
        id: `pending:${safeItemId}:${key}`,
        itemId: safeItemId,
        contentType: "serie",
        eventType: "episode_watched",
        occurredAt: now,
        meta: { season, episode }
      };

      current.push(event);
      added.push(event);
      watchedKeys.add(key);
    } else {
      const matching = current.filter((event) =>
        event?.eventType === "episode_watched" &&
        String(event?.itemId || "") === safeItemId &&
        Number(event?.meta?.season) === season &&
        Number(event?.meta?.episode) === episode
      );

      if (matching.length === 0) continue;

      removed.push(...matching);
      watchedKeys.delete(key);
    }
  }

  const removedIds = new Set(removed.map((event) => event.id));

  const nextHistory = current.filter(
    (event) => !removedIds.has(event.id)
  );

  const orderedEpisodes = normalizedBreakdown
    .slice()
    .sort((a, b) => a.seasonNumber - b.seasonNumber)
    .flatMap((entry) =>
      Array.from(
        { length: entry.episodeCount },
        (_, index) => ({
          season: entry.seasonNumber,
          episode: index + 1
        })
      )
    );

  const validKeys = new Set(
    orderedEpisodes.map((entry) =>
      keyFor(entry.season, entry.episode)
    )
  );

  const validWatchedKeys = new Set(
    [...watchedKeys].filter((key) => validKeys.has(key))
  );

  const nextEpisode = orderedEpisodes.find((entry) =>
    !validWatchedKeys.has(keyFor(entry.season, entry.episode))
  ) || null;

  const totalEpisodes = orderedEpisodes.length;
  const watchedEpisodes = validWatchedKeys.size;

  return {
    history: nextHistory,
    added,
    removed,
    watchedEpisodes,
    totalEpisodes,
    progress: totalEpisodes === 0 || watchedEpisodes === 0
      ? 0
      : watchedEpisodes === totalEpisodes
        ? 100
        : Math.max(
            1,
            Math.min(
              99,
              Math.round((watchedEpisodes / totalEpisodes) * 100)
            )
          ),
    completed:
      totalEpisodes > 0 &&
      watchedEpisodes === totalEpisodes,
    nextEpisode
  };
}
