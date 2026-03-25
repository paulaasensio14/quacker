import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar .env del root del proyecto independientemente del cwd
dotenv.config({
  path: path.resolve(__dirname, "..", "..", ".env")
});

export const ENV = {
  TMDB_API_KEY: String(process.env.TMDB_API_KEY || "").trim(),
  GOOGLE_BOOKS_API_KEY: String(process.env.GOOGLE_BOOKS_API_KEY || "").trim(),
  RAWG_API_KEY: String(process.env.RAWG_API_KEY || "").trim()
};