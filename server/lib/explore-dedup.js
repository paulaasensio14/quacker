function normalizeExploreDedupTitle(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[:\-–—]/g, " ")
    .replace(
      /\b(part|episode|season|temporada|episodio)\b\s*\d*/gi,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

export function buildExploreDedupKey(item) {
  const normalizedTitle =
    normalizeExploreDedupTitle(item?.title);

  const year = String(
    item?.meta?.year || ""
  );

  const type = String(
    item?.type || ""
  )
    .trim()
    .toLowerCase();

  return `${normalizedTitle}|${year}|${type}`;
}
