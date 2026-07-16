import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "..", "..", ".env")
});

const smtpPort = Number(process.env.SMTP_PORT || 587);

export const ENV = {
  TMDB_API_KEY: String(process.env.TMDB_API_KEY || "").trim(),
  RAWG_API_KEY: String(process.env.RAWG_API_KEY || "").trim(),

  SMTP_HOST: String(process.env.SMTP_HOST || "").trim(),
  SMTP_PORT: Number.isFinite(smtpPort) ? smtpPort : 587,
  SMTP_SECURE:
    String(process.env.SMTP_SECURE || "false")
      .trim()
      .toLowerCase() === "true",
  SMTP_USER: String(process.env.SMTP_USER || "").trim(),
  SMTP_PASS: String(process.env.SMTP_PASS || ""),
  CONTACT_TO: String(
    process.env.CONTACT_TO || process.env.SMTP_USER || ""
  ).trim()
};