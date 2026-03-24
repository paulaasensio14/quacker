const GOOGLE_BOOKS_BASE_URL = "https://www.googleapis.com/books/v1";

import { ENV } from "../config/env.js";

function _googleBooksImage(volumeInfo = {}) {
  const links = volumeInfo?.imageLinks || {};
  return (
    String(
      links.thumbnail ||
        links.smallThumbnail ||
        links.small ||
        links.medium ||
        links.large ||
        links.extraLarge ||
        ""
    ).trim()
  );
}

function _yearFromDate(dateStr) {
  const raw = String(dateStr || "").trim();
  if (!raw) return null;

  const year = Number(raw.slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

function _normalizeAuthors(volumeInfo = {}) {
  return Array.isArray(volumeInfo?.authors)
    ? volumeInfo.authors.map((author) => String(author || "").trim()).filter(Boolean)
    : [];
}

async function _googleBooksGet(path, params = {}) {
  const url = new URL(`${GOOGLE_BOOKS_BASE_URL}${path}`);

  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  const apiKey = ENV.GOOGLE_BOOKS_API_KEY;
  if (apiKey) {
    url.searchParams.set("key", apiKey);
  }

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json"
    }
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    const err = new Error(`google_books_request_failed:${res.status}:${bodyText}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

function _baseSearchItemFromVolume(item) {
  const volumeInfo = item?.volumeInfo || {};
  const authors = _normalizeAuthors(volumeInfo);

  return {
    eid: `google_books:book:${String(item?.id || "").trim()}`,
    source: "google_books",
    externalId: String(item?.id || "").trim(),
    type: "book",
    title: String(volumeInfo.title || "").trim(),
    releaseDate: String(volumeInfo.publishedDate || "").trim(),
    summary: String(volumeInfo.description || "").trim(),
    cover: _googleBooksImage(volumeInfo),
    meta: {
      year: _yearFromDate(volumeInfo.publishedDate),
      author: authors.join(", "),
      totalPages: Number(volumeInfo.pageCount || 0) || null
    }
  };
}

export async function searchGoogleBooks(query) {
  const q = String(query || "").trim();
  if (!q) return [];

  const data = await _googleBooksGet("/volumes", {
    q,
    langRestrict: "es",
    maxResults: 20,
    printType: "books",
    orderBy: "relevance"
  });

  const items = Array.isArray(data?.items) ? data.items : [];

  return items
    .map(_baseSearchItemFromVolume)
    .filter((item) => item.externalId && item.title)
    .slice(0, 20);
}

export async function getGoogleBookDetail(externalId) {
  const safeId = String(externalId || "").trim();

  if (!safeId) {
    const err = new Error("missing_external_id");
    err.status = 400;
    throw err;
  }

  const data = await _googleBooksGet(`/volumes/${encodeURIComponent(safeId)}`);
  const volumeInfo = data?.volumeInfo || {};
  const authors = _normalizeAuthors(volumeInfo);

  return {
    eid: `google_books:book:${safeId}`,
    source: "google_books",
    externalId: safeId,
    type: "book",
    title: String(volumeInfo.title || "").trim(),
    originalTitle: String(volumeInfo.title || "").trim(),
    releaseDate: String(volumeInfo.publishedDate || "").trim(),
    summary: String(volumeInfo.description || "").trim(),
    description: String(volumeInfo.description || "").trim(),
    cover: _googleBooksImage(volumeInfo),
    backdrop: "",
    genres: Array.isArray(volumeInfo?.categories)
      ? volumeInfo.categories.map((category) => String(category || "").trim()).filter(Boolean)
      : [],
    runtime: null,
    rating: Number(volumeInfo.averageRating || 0) || null,
    ratingCount: Number(volumeInfo.ratingsCount || 0) || 0,
    statusLabel: "",
    seasons: null,
    episodes: null,
    meta: {
      year: _yearFromDate(volumeInfo.publishedDate),
      author: authors.join(", "),
      totalPages: Number(volumeInfo.pageCount || 0) || null
    }
  };
}