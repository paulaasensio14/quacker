function _safeMeta(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...value }
    : {};
}

export async function hydrateLibraryImportMeta({
  match = {},
  meta = {},
  getTmdbDetail
} = {}) {
  const baseMeta = _safeMeta(meta);

  const type = String(match?.type || "").trim().toLowerCase();
  const source = String(match?.source || "").trim().toLowerCase();
  const externalId = String(match?.externalId || "").trim();

  if (
    type !== "serie" ||
    source !== "tmdb" ||
    !externalId ||
    typeof getTmdbDetail !== "function"
  ) {
    return baseMeta;
  }

  let detail;

  try {
    detail = await getTmdbDetail({
      type: "serie",
      externalId
    });
  } catch (_) {
    return baseMeta;
  }

  const detailMeta = _safeMeta(detail?.meta);

  const totalSeasons = Math.max(
    0,
    Number(
      detailMeta.totalSeasons ||
      detail?.seasons ||
      0
    ) || 0
  );

  const totalEpisodes = Math.max(
    0,
    Number(
      detailMeta.totalEpisodes ||
      detail?.episodes ||
      0
    ) || 0
  );

  const seasonBreakdown = Array.isArray(detailMeta.seasonBreakdown)
    ? detailMeta.seasonBreakdown.map((season) => ({ ...season }))
    : [];

  return {
    ...baseMeta,
    totalSeasons,
    totalEpisodes,
    seasonBreakdown,
    season: Math.max(
      1,
      Number(baseMeta.season || 1) || 1
    ),
    episode: Math.max(
      1,
      Number(baseMeta.episode || 1) || 1
    )
  };
}
