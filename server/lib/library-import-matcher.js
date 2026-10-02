import {
  normalizeContentIdentity
} from "./content-identity.js";

import {
  searchLibraryImportCandidates
} from "./library-import-search.js";

function _normalizeText(value) {
  return String(value ?? "").trim();
}

function _normalizeComparableText(value) {
  return _normalizeText(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function _normalizeYear(value) {
  const year = Number(value);

  return (
    Number.isInteger(year) &&
    year > 0
  )
    ? year
    : null;
}

function _buildImportMatchMeta(row = {}) {
  const meta = {};

  const year = _normalizeYear(row.year);

  if (year != null) {
    meta.year = year;
  }

  const author = _normalizeText(row.author);

  if (author) {
    meta.author = author;
  }

  return meta;
}

function _normalizeCandidate(candidate = {}) {
  const identity = normalizeContentIdentity({
    source: candidate.source,
    type: candidate.type,
    externalId: candidate.externalId
  });

  if (!identity.ok) {
    return null;
  }

  return {
    ...candidate,
    title: _normalizeText(candidate.title),
    type: identity.type,
    source: identity.source,
    externalId: identity.externalId,
    meta:
      candidate.meta &&
      typeof candidate.meta === "object" &&
      !Array.isArray(candidate.meta)
        ? { ...candidate.meta }
        : {}
  };
}

function _scoreCandidate(row = {}, candidate = {}) {
  let score = 0;

  const rowType =
    _normalizeText(row.type).toLowerCase();

  const candidateType =
    _normalizeText(candidate.type).toLowerCase();

  const rowAuthor =
    _normalizeComparableText(row.author);

  const candidateAuthor =
    _normalizeComparableText(candidate?.meta?.author);

  const usesAuthor =
    rowType === "book" &&
    Boolean(rowAuthor);

  const rowTitle =
    _normalizeComparableText(row.title);

  const candidateTitle =
    _normalizeComparableText(candidate.title);

  if (
    rowTitle &&
    candidateTitle &&
    rowTitle === candidateTitle
  ) {
    score += usesAuthor ? 0.6 : 0.65;
  }

  if (
    rowType &&
    candidateType &&
    rowType === candidateType
  ) {
    score += 0.2;
  }

  const rowYear =
    _normalizeYear(row.year);

  const candidateYear =
    _normalizeYear(candidate?.meta?.year);

  if (
    rowYear != null &&
    candidateYear != null &&
    rowYear === candidateYear
  ) {
    score += usesAuthor ? 0.1 : 0.15;
  }

  if (
    usesAuthor &&
    candidateAuthor &&
    rowAuthor === candidateAuthor
  ) {
    score += 0.1;
  }

  return Math.min(1, score);
}

function _hasAuthorMatch(row = {}, candidate = {}) {
  if (
    _normalizeText(row.type).toLowerCase() !== "book"
  ) {
    return false;
  }

  const rowAuthor =
    _normalizeComparableText(row.author);

  const candidateAuthor =
    _normalizeComparableText(candidate?.meta?.author);

  return Boolean(
    rowAuthor &&
    candidateAuthor &&
    rowAuthor === candidateAuthor
  );
}

function _buildSelectedMatch(candidate = {}) {
  const meta = {};

  const year =
    _normalizeYear(candidate?.meta?.year);

  if (year != null) {
    meta.year = year;
  }

  const author =
    _normalizeText(candidate?.meta?.author);

  if (author) {
    meta.author = author;
  }

  const match = {
    title: _normalizeText(candidate.title),
    type: candidate.type,
    source: candidate.source,
    externalId: candidate.externalId,
    meta
  };

  const cover =
    _normalizeText(candidate.cover)
      .slice(0, 500);

  if (cover) {
    match.cover = cover;
  }

  return match;
}

export async function matchLibraryImportRow(
  row = {},
  {
    searchCandidates,
    providers
  } = {}
) {
  const identity = normalizeContentIdentity({
    source: row.source,
    type: row.type,
    externalId: row.externalId
  });

  if (identity.ok) {
    return {
      status: "matched",
      confidence: 1,
      reason: "canonical_identity",
      match: {
        title: _normalizeText(row.title),
        type: identity.type,
        source: identity.source,
        externalId: identity.externalId,
        meta: _buildImportMatchMeta(row)
      },
      candidates: []
    };
  }

  const searched =
    typeof searchCandidates === "function"
      ? await searchCandidates(row)
      : await searchLibraryImportCandidates(
          row,
          providers
        );

  const candidates =
    Array.isArray(searched)
      ? searched
          .map(_normalizeCandidate)
          .filter(Boolean)
      : [];

  if (candidates.length === 0) {
    return {
      status: "not_found",
      confidence: 0,
      reason: "no_candidates",
      match: null,
      candidates: []
    };
  }

  const ranked = candidates
    .map((candidate, index) => ({
      candidate,
      index,
      score: _scoreCandidate(
        row,
        candidate
      )
    }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return a.index - b.index;
    });

  const best = ranked[0];
  const second = ranked[1];

  const ambiguousStrongTie =
    best.score >= 0.9 &&
    second &&
    Math.abs(
      best.score - second.score
    ) <= 1e-9 &&
    (
      best.candidate.source !==
        second.candidate.source ||
      best.candidate.type !==
        second.candidate.type ||
      best.candidate.externalId !==
        second.candidate.externalId
    );

  if (ambiguousStrongTie) {
    return {
      status: "unmatched",
      confidence: best.score,
      reason: "ambiguous_candidates",
      match: null,
      candidates
    };
  }

  if (best.score >= 0.9) {
    return {
      status: "matched",
      confidence: best.score,
      reason: _hasAuthorMatch(
        row,
        best.candidate
      )
        ? "title_type_year_author"
        : "title_type_year",
      match: _buildSelectedMatch(
        best.candidate
      ),
      candidates
    };
  }

  return {
    status: "unmatched",
    confidence: best.score,
    reason: "low_confidence",
    match: null,
    candidates
  };
}
