export const ENV = {
  TMDB_API_KEY: String(process.env.TMDB_API_KEY || "").trim(),
  GOOGLE_BOOKS_API_KEY: String(process.env.GOOGLE_BOOKS_API_KEY || "").trim(),
  RAWG_API_KEY: String(process.env.RAWG_API_KEY || "").trim()
};