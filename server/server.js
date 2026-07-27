import express from "express";
import session from "express-session";
import sessionFileStore from "session-file-store";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import {
 searchTmdb,
 getTmdbDetail,
 getTmdbSeasonDetail,
 getWeeklyTrendingTmdbByType
} from "./adapters/tmdb.js";
import {
 searchOpenLibrary,
 getOpenLibraryBookDetail,
 getWeeklyFeaturedOpenLibrary
} from "./adapters/open-library.js";
import {
 searchRawg,
 getRawgDetail,
 getWeeklyFeaturedRawg
} from "./adapters/rawg.js";
import nodemailer from "nodemailer";
import { ENV } from "./config/env.js";

import {
  readJsonFile,
  writeJsonFileAtomic
} from "./lib/json-db.js";

import {
  normalizeContentIdentity,
  sameContentIdentity
} from "./lib/content-identity.js";

import {
  createUniqueAccountHandle,
  isAccountEmailInUse,
  isAccountHandleInUse,
  validateAccountEmail,
  validateAccountName,
  validateRegistrationAccount
} from "./lib/account-validation.js";

// Protect runtime files containing session or user data.
process.umask(0o077);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Raíz del proyecto = carpeta padre de /server
const PROJECT_ROOT = path.resolve(__dirname, "..");
const DB_PATH = path.join(__dirname, "db.json");

const app = express();

app.set("trust proxy", 1);

// ===== DEBUG SESIÓN (DEV) =====
// Loguea si llega cookie, cuál es el sessionID y si hay userId en la sesión.
// Esto nos dirá si el problema es: (a) cookie no llega, (b) session store se pierde, (c) userId desaparece.
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

const isProduction =
  process.env.NODE_ENV === "production";

const configuredSessionSecret = String(
  process.env.SESSION_SECRET || ""
).trim();

if (
  isProduction &&
  configuredSessionSecret.length < 32
) {
  const error = new Error(
    "SESSION_SECRET debe tener al menos 32 caracteres en producción."
  );

  error.code = "INVALID_SESSION_SECRET";

  throw error;
}

const sessionSecret =
  configuredSessionSecret ||
  "dev-secret-fallback";

const FileStore = sessionFileStore(session);
const SESSION_STORE_PATH = path.resolve(__dirname, ".sessions");
const SESSION_TTL_SECONDS = 24 * 60 * 60;

fs.mkdirSync(SESSION_STORE_PATH, {
  recursive: true,
  mode: 0o700
});

fs.chmodSync(SESSION_STORE_PATH, 0o700);

const sessionStore = new FileStore({
  path: SESSION_STORE_PATH,
  ttl: SESSION_TTL_SECONDS,
  retries: 5,
  reapInterval: 60 * 60,
  reapAsync: false,
  secret: sessionSecret,
  logFn: () => {}
});

const CONTACT_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const CONTACT_RATE_LIMIT_MAX = 3;

const contactRateLimit = new Map();
let mailTransporter = null;

app.use(
  session({
    store: sessionStore,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      maxAge: SESSION_TTL_SECONDS * 1000
    }
  })
);

// ===== Helpers DB =====
function _createInitialDb() {
  return {
    users: {}
  };
}

function _validateDb(db) {
  const isValidRoot =
    db &&
    typeof db === "object" &&
    !Array.isArray(db);

  const hasValidUsers =
    isValidRoot &&
    db.users &&
    typeof db.users === "object" &&
    !Array.isArray(db.users);

  if (!hasValidUsers) {
    const error = new Error(
      "La base de datos no contiene una estructura users válida."
    );

    error.code = "INVALID_DATABASE_STRUCTURE";

    throw error;
  }

  return db;
}

function _readDb() {
  return readJsonFile(DB_PATH, {
    createDefault: _createInitialDb,
    validate: _validateDb
  });
}

function _writeDb(db) {
  _validateDb(db);
  writeJsonFileAtomic(DB_PATH, db);
}

function _uid() {
  return `u_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function _normalizeContentText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function _normalizeContactName(value) {
  return String(value || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function _normalizeContactMessage(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .trim();
}

function _isValidContactEmail(value) {
  const email = String(value || "").trim();

  return (
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

function _escapeContactHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function _consumeContactRateLimit(ip) {
  const now = Date.now();
  const key = String(ip || "unknown");

  const recentAttempts = (contactRateLimit.get(key) || [])
    .filter((timestamp) => now - timestamp < CONTACT_RATE_LIMIT_WINDOW_MS);

  if (recentAttempts.length >= CONTACT_RATE_LIMIT_MAX) {
    contactRateLimit.set(key, recentAttempts);
    return false;
  }

  recentAttempts.push(now);
  contactRateLimit.set(key, recentAttempts);

  if (contactRateLimit.size > 1000) {
    for (const [storedIp, timestamps] of contactRateLimit.entries()) {
      const fresh = timestamps.filter(
        (timestamp) => now - timestamp < CONTACT_RATE_LIMIT_WINDOW_MS
      );

      if (fresh.length) {
        contactRateLimit.set(storedIp, fresh);
      } else {
        contactRateLimit.delete(storedIp);
      }
    }
  }

  return true;
}

function _getMailTransporter() {
  const missingConfig = [
    ["SMTP_HOST", ENV.SMTP_HOST],
    ["SMTP_PORT", ENV.SMTP_PORT],
    ["SMTP_USER", ENV.SMTP_USER],
    ["SMTP_PASS", ENV.SMTP_PASS]
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingConfig.length) {
    const error = new Error("mail_not_configured");
    error.code = "mail_not_configured";
    error.missingConfig = missingConfig;
    throw error;
  }

  if (!mailTransporter) {
    mailTransporter = nodemailer.createTransport({
      host: ENV.SMTP_HOST,
      port: ENV.SMTP_PORT,
      secure: ENV.SMTP_SECURE,
      requireTLS: !ENV.SMTP_SECURE,
      auth: {
        user: ENV.SMTP_USER,
        pass: ENV.SMTP_PASS
      },
      tls: {
        minVersion: "TLSv1.2"
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });
  }

  return mailTransporter;
}

async function _sendContactEmail({ name, email, message, language }) {
  if (!ENV.CONTACT_TO) {
    const error = new Error("contact_mail_not_configured");
    error.code = "contact_mail_not_configured";
    error.missingConfig = ["CONTACT_TO"];
    throw error;
  }

  const transporter = _getMailTransporter();
  const languageLabel = language === "en" ? "English" : "Español";

  await transporter.sendMail({
    from: {
      name: "Quacker",
      address: ENV.SMTP_USER
    },
    to: ENV.CONTACT_TO,
    replyTo: {
      name,
      address: email
    },
    subject: `[Quacker] Nuevo mensaje de ${name}`,
    text: [
      "Nuevo mensaje desde el formulario de contacto de Quacker.",
      "",
      `Nombre: ${name}`,
      `Email: ${email}`,
      `Idioma: ${languageLabel}`,
      "",
      "Mensaje:",
      message
    ].join("\n"),
    html: `
      <h2>Nuevo mensaje desde Quacker</h2>
      <p><strong>Nombre:</strong> ${_escapeContactHtml(name)}</p>
      <p><strong>Email:</strong> ${_escapeContactHtml(email)}</p>
      <p><strong>Idioma:</strong> ${_escapeContactHtml(languageLabel)}</p>
      <p><strong>Mensaje:</strong></p>
      <p>${_escapeContactHtml(message).replace(/\n/g, "<br>")}</p>
    `
  });
}

async function _sendWelcomeEmail({ name, email, language }) {
  const transporter = _getMailTransporter();
  const isEnglish = language === "en";
  const safeName = _normalizeContactName(name);
  const safeHtmlName = _escapeContactHtml(safeName);

  const copy = isEnglish
    ? {
        subject: safeName
          ? `${safeName}, your Quacker nest is ready`
          : "Your Quacker nest is ready",
        preheader:
          "Your account is ready. Start building your personal entertainment library.",
        kicker: "YOUR NEW ENTERTAINMENT HOME",
        title: "Welcome to Quacker!",
        greeting: "Hi",
        intro:
          "Your account is ready, and your next favorite story now has a place to land.",
        body:
          "Quacker brings your shows, movies, books and video games together, so you always know what you are enjoying, what comes next and what you have already finished.",
        stepsTitle: "Start in three simple steps",
        steps: [
          {
            title: "Explore",
            text: "Find a show, movie, book or game you are excited about."
          },
          {
            title: "Build your library",
            text: "Save everything you want to watch, read or play."
          },
          {
            title: "Keep moving",
            text: "Update your progress and organize titles into custom lists."
          }
        ],
        button: "Open my library",
        support:
          "Questions, ideas or feedback? Reply to this email or write to hello@quacker.es.",
        signoff: "See you in the nest,",
        team: "The Quacker team",
        footer: "One place for everything you watch, read and play."
      }
    : {
        subject: safeName
          ? `${safeName}, tu nido en Quacker está listo`
          : "Tu nido en Quacker está listo",
        preheader:
          "Tu cuenta está lista. Empieza a crear tu biblioteca personal.",
        kicker: "TU NUEVO HOGAR PARA TODO LO QUE DISFRUTAS",
        title: "¡Te damos la bienvenida a Quacker!",
        greeting: "Hola",
        intro:
          "Tu cuenta ya está lista y tus próximas obsesiones ya tienen dónde aterrizar.",
        body:
          "Quacker reúne tus series, películas, libros y videojuegos para que siempre sepas qué estás disfrutando, qué viene después y qué has terminado.",
        stepsTitle: "Empieza en tres pasos sencillos",
        steps: [
          {
            title: "Explora",
            text: "Encuentra una serie, película, libro o juego que te apetezca descubrir."
          },
          {
            title: "Crea tu biblioteca",
            text: "Guarda todo lo que quieras ver, leer o jugar."
          },
          {
            title: "Sigue avanzando",
            text: "Actualiza tu progreso y organiza títulos en listas personalizadas."
          }
        ],
        button: "Abrir mi biblioteca",
        support:
          "¿Tienes alguna duda, idea o sugerencia? Responde a este correo o escríbenos a hello@quacker.es.",
        signoff: "Nos vemos en el nido,",
        team: "El equipo de Quacker",
        footer: "Un solo sitio para todo lo que ves, lees y juegas."
      };

  const safeHtmlSubject = _escapeContactHtml(copy.subject);

  const greeting = safeName
    ? `${copy.greeting} ${safeName},`
    : `${copy.greeting},`;

  const htmlGreeting = safeName
    ? `${copy.greeting} ${safeHtmlName},`
    : `${copy.greeting},`;

  const text = [
    greeting,
    "",
    copy.intro,
    "",
    copy.body,
    "",
    copy.stepsTitle,
    ...copy.steps.map(
      (step, index) => `${index + 1}. ${step.title}: ${step.text}`
    ),
    "",
    `${copy.button}: https://quacker.es`,
    "",
    copy.support,
    "",
    copy.signoff,
    copy.team
  ].join("\n");

  const html = `
    <!doctype html>
    <html lang="${isEnglish ? "en" : "es"}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="color-scheme" content="light only">
        <meta name="supported-color-schemes" content="light only">
        <title>${safeHtmlSubject}</title>
      </head>

      <body style="margin:0;padding:0;background:#f3f0e7;font-family:Arial,Helvetica,sans-serif;color:#0d3340;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
          ${copy.preheader}
        </div>

        <table
          role="presentation"
          width="100%"
          cellpadding="0"
          cellspacing="0"
          border="0"
          style="width:100%;margin:0;padding:0;background:#f3f0e7;"
        >
          <tr>
            <td align="center" style="padding:32px 14px;">
              <table
                role="presentation"
                width="600"
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="width:100%;max-width:600px;background:#ffffff;border:2px solid #0d3340;border-radius:24px;overflow:hidden;"
              >
                <tr>
                  <td style="padding:24px 28px;background:#f2c230;">
                    <table
                      role="presentation"
                      cellpadding="0"
                      cellspacing="0"
                      border="0"
                    >
                      <tr>
                        <td
                          width="56"
                          height="56"
                          align="center"
                          valign="middle"
                          style="width:56px;height:56px;"
                        >
                          <img
                            src="https://quacker.es/assets/img/logo-quacker.png"
                            alt="Quacker"
                            width="52"
                            height="52"
                            style="
                              display:block;
                              width:52px;
                              height:52px;
                              border:2px solid #0d3340;
                              border-radius:50%;
                              outline:none;
                              text-decoration:none;
                            "
                          >
                        </td>

                        <td
                          valign="middle"
                          style="padding-left:14px;color:#0d3340;font-size:30px;font-weight:900;letter-spacing:-1px;"
                        >
                          Quacker
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding:34px 36px 16px;">
                    <p style="margin:0 0 10px;color:#9a7410;font-size:12px;font-weight:800;letter-spacing:1.5px;">
                      ${copy.kicker}
                    </p>

                    <h1 style="margin:0 0 22px;color:#0d3340;font-size:32px;line-height:1.18;letter-spacing:-0.7px;">
                      ${copy.title}
                    </h1>

                    <p style="margin:0 0 14px;color:#0d3340;font-size:18px;line-height:1.55;font-weight:700;">
                      ${htmlGreeting}
                    </p>

                    <table
                      role="presentation"
                      width="100%"
                      cellpadding="0"
                      cellspacing="0"
                      border="0"
                      style="width:100%;margin:0 0 22px;background:#fff7d6;border:1px solid #ead47d;border-radius:16px;"
                    >
                      <tr>
                        <td style="padding:20px 22px;">
                          <p style="margin:0;color:#0d3340;font-size:17px;line-height:1.55;font-weight:700;">
                            ${copy.intro}
                          </p>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:0 0 26px;color:#405b64;font-size:16px;line-height:1.65;">
                      ${copy.body}
                    </p>

                    <h2 style="margin:0 0 14px;color:#0d3340;font-size:20px;line-height:1.35;">
                      ${copy.stepsTitle}
                    </h2>

                    ${copy.steps
                      .map(
                        (step, index) => `
                          <table
                            role="presentation"
                            width="100%"
                            cellpadding="0"
                            cellspacing="0"
                            border="0"
                            style="width:100%;margin:0 0 10px;background:#f8f6ef;border:1px solid #ded9c9;border-radius:14px;"
                          >
                            <tr>
                              <td
                                width="54"
                                valign="top"
                                style="width:54px;padding:17px 0 17px 18px;"
                              >
                                <div style="width:34px;height:34px;border-radius:50%;background:#0d3340;color:#f2c230;font-size:16px;font-weight:800;line-height:34px;text-align:center;">
                                  ${index + 1}
                                </div>
                              </td>

                              <td style="padding:15px 18px 15px 10px;">
                                <p style="margin:0 0 3px;color:#0d3340;font-size:16px;line-height:1.4;font-weight:800;">
                                  ${step.title}
                                </p>

                                <p style="margin:0;color:#526a72;font-size:14px;line-height:1.55;">
                                  ${step.text}
                                </p>
                              </td>
                            </tr>
                          </table>
                        `
                      )
                      .join("")}

                    <table
                      role="presentation"
                      cellpadding="0"
                      cellspacing="0"
                      border="0"
                      style="margin:28px auto 26px;"
                    >
                      <tr>
                        <td
                          align="center"
                          style="border-radius:999px;background:#0d3340;"
                        >
                          <a
                            href="https://quacker.es"
                            style="display:inline-block;padding:15px 28px;color:#ffffff;font-size:16px;font-weight:800;line-height:1;text-decoration:none;border-radius:999px;"
                          >
                            ${copy.button} &rarr;
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:0 0 24px;color:#526a72;font-size:14px;line-height:1.65;text-align:center;">
                      ${copy.support}
                    </p>

                    <p style="margin:0;color:#0d3340;font-size:15px;line-height:1.6;">
                      ${copy.signoff}<br>
                      <strong>${copy.team}</strong>
                    </p>
                  </td>
                </tr>

                <tr>
                  <td
                    align="center"
                    style="padding:20px 28px;background:#0d3340;"
                  >
                    <p style="margin:0 0 6px;color:#ffffff;font-size:13px;line-height:1.5;font-weight:700;">
                      ${copy.footer}
                    </p>

                    <p style="margin:0;color:#a9bbc0;font-size:12px;line-height:1.5;">
                      quacker.es · hello@quacker.es
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  await transporter.sendMail({
    from: {
      name: "Quacker",
      address: ENV.SMTP_USER
    },
    to: email,
    replyTo: ENV.CONTACT_TO || ENV.SMTP_USER,
    subject: copy.subject,
    text,
    html
  });
}

function _normalizeCanonicalIdentity(source, type, externalId) {
  const identity = normalizeContentIdentity({
    source,
    type,
    externalId
  });

  if (!identity.ok) {
    return {
      source: identity.source || "",
      type: identity.type || "",
      externalId: "",
      key: "",
      error: identity.error
    };
  }

  return identity;
}

function _hasCanonicalIdentity(item) {
  return normalizeContentIdentity(item).ok;
}

function _isSameLibraryIdentity(a, b) {
  return sameContentIdentity(a, b);
}

function _sanitizeLibraryMeta(meta) {
  const allowedMetaKeys = new Set([
    "totalEpisodes",
    "totalSeasons",
    "totalPages",
    "totalChapters",
    "year",
    "platform",
    "author",
    "season",
    "episode",
    "episodeSeenMap",
    "hoursPlayed",
    "pagesRead",
    "seasonBreakdown"
  ]);

  const sanitizedMeta = {};

  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return sanitizedMeta;
  }

  for (const key of Object.keys(meta)) {
    if (allowedMetaKeys.has(key)) {
      sanitizedMeta[key] = key === "episodeSeenMap"
        ? _sanitizeEpisodeSeenMap(meta[key])
        : meta[key];
    }
  }

  return sanitizedMeta;
}

function _sanitizeEpisodeSeenMap(value) {
  const safeMap = {};

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return safeMap;
  }

  for (const [rawKey, rawIso] of Object.entries(value)) {
    const match = String(rawKey || "").trim().match(/^(\d+):(\d+)$/);
    if (!match) continue;

    const season = Math.max(0, Number(match[1] || 0) || 0);
    const episode = Math.max(0, Number(match[2] || 0) || 0);
    const normalizedIso = _normalizeActivityCreatedAt(rawIso);

    if (season <= 0 || episode <= 0 || !normalizedIso) {
      continue;
    }

    safeMap[`${season}:${episode}`] = normalizedIso;
  }

  return safeMap;
}

function _normalizeActivityType(type) {
  const safeType = String(type || "").trim().toLowerCase();
  if (safeType === "completed") return "completed";
  if (safeType === "progress") return "progress";
  return "";
}

function _normalizeActivityCreatedAt(value) {
  const safeValue = String(value || "").trim();
  if (!safeValue) return "";

  const parsed = new Date(safeValue);
  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toISOString();
}

function _normalizeActivityPayload(payload) {
  if (!payload || typeof payload !== "object") return null;

  const season = Math.max(0, Number(payload.season || 0) || 0);
  const episode = Math.max(0, Number(payload.episode || 0) || 0);

  if (season <= 0 || episode <= 0) return null;

  return { season, episode };
}

function _appendUserActivity(bucket, activity) {
  bucket.activities = Array.isArray(bucket.activities) ? bucket.activities : [];

  const createdAt = _normalizeActivityCreatedAt(activity?.createdAt) || new Date().toISOString();
  const targetId = String(activity?.targetId || "").trim();
  const type = _normalizeActivityType(activity?.type) || "progress";
  const payload = _normalizeActivityPayload(activity?.payload);

  if (!targetId) return null;

  const nextActivity = {
    id: _uid(),
    type,
    targetType: "library_item",
    targetId,
    minutes: Number.isFinite(Number(activity?.minutes))
      ? Math.max(0, Number(activity.minutes))
      : 0,
    createdAt,
    payload
  };

  bucket.activities.unshift(nextActivity);

  if (bucket.activities.length > 500) {
    bucket.activities = bucket.activities.slice(0, 500);
  }

  return nextActivity;
}

function _normalizeNotificationId(value) {
  return String(value || "").trim();
}

function _normalizeNotificationCreatedAt(value) {
  const safeValue = String(value || "").trim();
  if (!safeValue) return "";

  const parsed = new Date(safeValue);
  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toISOString();
}

function _normalizeUserNotification(entry) {
  if (!entry || typeof entry !== "object") return null;

  const title = String(entry.title || "").trim();
  const createdAt = _normalizeNotificationCreatedAt(entry.createdAt) || new Date().toISOString();
  const notificationId = _normalizeNotificationId(entry.id) || _uid();

  if (!title) return null;

  return {
    id: notificationId,
    title,
    text: String(entry.text || "").trim(),
    color: String(entry.color || "").trim() || "#2563eb",
    icon: String(entry.icon || "").trim() || "check",
    createdAt
  };
}

function _normalizeUserNotificationsList(list) {
  const seen = new Set();

  return (Array.isArray(list) ? list : [])
    .map((entry) => _normalizeUserNotification(entry))
    .filter((entry) => {
      if (!entry || seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 200);
}

function _normalizeExploreUiState(ui) {
  const safeUi = ui && typeof ui === "object" && !Array.isArray(ui) ? ui : {};

  return {
    typeFilter: typeof safeUi.typeFilter === "string" ? safeUi.typeFilter : "all",
    sortMode: typeof safeUi.sortMode === "string" ? safeUi.sortMode : "recent",
    searchTerm: typeof safeUi.searchTerm === "string" ? safeUi.searchTerm : ""
  };
}

function _normalizeLibraryUiState(ui) {
  const safeUi = ui && typeof ui === "object" && !Array.isArray(ui) ? ui : {};

  return {
    sortMode: typeof safeUi.sortMode === "string" ? safeUi.sortMode : "recent",
    typeFilter: typeof safeUi.typeFilter === "string" ? safeUi.typeFilter : "all",
    statusFilter: typeof safeUi.statusFilter === "string" ? safeUi.statusFilter : "all",
    searchTerm: typeof safeUi.searchTerm === "string" ? safeUi.searchTerm : ""
  };
}

function _normalizeListsUiState(ui) {
  const safeUi = ui && typeof ui === "object" && !Array.isArray(ui) ? ui : {};
  const safeListsViewMode = String(safeUi.listsViewMode || "").trim();

  return {
    visibilityFilter: typeof safeUi.visibilityFilter === "string" ? safeUi.visibilityFilter : "all",
    searchTerm: typeof safeUi.searchTerm === "string" ? safeUi.searchTerm : "",
    listsViewMode: safeListsViewMode === "list" ? "list" : "cards",
    detailSearch: typeof safeUi.detailSearch === "string" ? safeUi.detailSearch : "",
    detailType: typeof safeUi.detailType === "string" ? safeUi.detailType : "all",
    detailStatus: typeof safeUi.detailStatus === "string" ? safeUi.detailStatus : "all"
  };
}

function _normalizeExploreDismissedIds(list) {
  const seen = new Set();

  return (Array.isArray(list) ? list : [])
    .map((entry) => String(entry || "").trim())
    .filter((entry) => {
      if (!entry || seen.has(entry)) return false;
      seen.add(entry);
      return true;
    })
    .slice(0, 500);
}

function _getDefaultLibraryStatus(type) {
  return type === "book"
    ? "reading"
    : type === "game"
      ? "playing"
      : type === "serie"
        ? "watching"
        : "watching";
}

function _normalizeLibraryStatus(status, type, progress, fallbackStatus = "") {
  const safeStatus = String(status || "").trim().toLowerCase();
  const safeType = String(type || "").trim().toLowerCase();
  const safeProgress = Number.isFinite(Number(progress))
    ? Math.max(0, Math.min(100, Number(progress)))
    : 0;
  const defaultStatus = _getDefaultLibraryStatus(safeType);

  if (safeProgress >= 100) {
    return "completed";
  }

  if (!safeStatus && safeProgress <= 0 && !fallbackStatus) {
    return "not_started";
  }

  if (!safeStatus) {
    return String(fallbackStatus || defaultStatus).trim() || defaultStatus;
  }

  if (safeProgress <= 0) {
    if (safeStatus === "pending" || safeStatus === "not_started") {
      return "not_started";
    }

    if (safeStatus === "completed") {
      return "not_started";
    }

    if (safeStatus === "in_progress") {
      return defaultStatus;
    }

    if (safeStatus === "watching" || safeStatus === "reading" || safeStatus === "playing") {
      return safeStatus;
    }

    return String(fallbackStatus || defaultStatus).trim() || defaultStatus;
  }

  if (safeStatus === "pending" || safeStatus === "not_started") {
    return defaultStatus;
  }

  if (safeStatus === "in_progress") {
    return defaultStatus;
  }

  if (safeStatus === "watching" || safeStatus === "reading" || safeStatus === "playing") {
    return safeStatus;
  }

  if (safeStatus === "completed") {
    return defaultStatus;
  }

  return String(fallbackStatus || defaultStatus).trim() || defaultStatus;
}

function _hashPassword(password) {
  const normalizedPassword = String(password || "");
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(normalizedPassword, salt, 64).toString("hex");

  return { salt, hash };
}

function _verifyPassword(password, auth) {
  const normalizedPassword = String(password || "");
  const salt = String(auth?.passwordSalt || "");
  const storedHash = String(auth?.passwordHash || "");

  if (!salt || !storedHash) return false;

  const computedHash = crypto.scryptSync(normalizedPassword, salt, 64);
  const storedBuffer = Buffer.from(storedHash, "hex");

  if (storedBuffer.length !== computedHash.length) return false;

  return crypto.timingSafeEqual(storedBuffer, computedHash);
}

function _requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "not_authenticated" });
  }
  next();
}

function _getUserBucket(db, userId) {
  db.users[userId] = db.users[userId] || {
    profile: null,
    library: [],
    lists: [],
    activities: [],
    notifications: [],
    explore: {
      dismissed: []
    },
    ui: {
      explore: _normalizeExploreUiState(),
      library: _normalizeLibraryUiState(),
      lists: _normalizeListsUiState()
    }
  };

  db.users[userId].library = Array.isArray(db.users[userId].library)
    ? db.users[userId].library
    : [];

  db.users[userId].lists = Array.isArray(db.users[userId].lists)
    ? db.users[userId].lists
    : [];

  db.users[userId].activities = Array.isArray(db.users[userId].activities)
    ? db.users[userId].activities
    : [];

  db.users[userId].notifications = _normalizeUserNotificationsList(
    db.users[userId].notifications
  );
  db.users[userId].explore = db.users[userId].explore && typeof db.users[userId].explore === "object"
    ? db.users[userId].explore
    : {};

  db.users[userId].explore.dismissed = _normalizeExploreDismissedIds(
    db.users[userId].explore.dismissed
  );

  db.users[userId].ui = db.users[userId].ui && typeof db.users[userId].ui === "object"
    ? db.users[userId].ui
    : {};

  db.users[userId].ui.explore = _normalizeExploreUiState(db.users[userId].ui.explore);
  db.users[userId].ui.library = _normalizeLibraryUiState(db.users[userId].ui.library);
  db.users[userId].ui.lists = _normalizeListsUiState(db.users[userId].ui.lists);

  return db.users[userId];
}

// ===== API BASE =====
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/contact", async (req, res) => {
  const body = req.body || {};

  const name = _normalizeContactName(body.name);
  const email = String(body.email || "").trim().toLowerCase();
  const message = _normalizeContactMessage(body.message);
  const language = body.language === "en" ? "en" : "es";
  const website = String(body.website || "").trim();

  // Campo trampa para bots. Los usuarios reales no lo rellenan.
  if (website) {
    return res.json({ ok: true });
  }

  if (
    name.length < 2 ||
    name.length > 80 ||
    !_isValidContactEmail(email) ||
    message.length < 10 ||
    message.length > 3000
  ) {
    return res.status(400).json({
      error: "invalid_contact_form"
    });
  }

  if (!_consumeContactRateLimit(req.ip)) {
    return res.status(429).json({
      error: "contact_rate_limited"
    });
  }

  try {
    await _sendContactEmail({
      name,
      email,
      message,
      language
    });

    return res.json({ ok: true });
  } catch (error) {
    console.error("[Contact] email delivery failed", {
      code: error?.code || "",
      command: error?.command || "",
      responseCode: error?.responseCode || null,
      missingConfig: error?.missingConfig || []
    });

    return res.status(502).json({
      error: "contact_delivery_failed"
    });
  }
});

// ===== AUTH =====
app.post("/api/auth/register", (req, res) => {
  const { email, password, name, language } = req.body || {};
  const safeLanguage = language === "en" ? "en" : "es";

  const validation = validateRegistrationAccount({
    email,
    password,
    name
  });

  if (!validation.ok) {
    return res.status(400).json({
      error: validation.error
    });
  }

  const {
    email: normalizedEmail,
    password: validatedPassword,
    name: normalizedName
  } = validation.value;

  const db = _readDb();

  if (isAccountEmailInUse(db.users, normalizedEmail)) {
    return res.status(409).json({
      error: "email_in_use"
    });
  }

  const userId = _uid();
  const { salt, hash } = _hashPassword(validatedPassword);

  db.users[userId] = {
    profile: {
      id: userId,
      email: normalizedEmail,
      name: normalizedName,
      handle: createUniqueAccountHandle(
        db.users,
        normalizedEmail
      ),
      language: safeLanguage,
      theme: "light"
    },
    auth: {
      passwordSalt: salt,
      passwordHash: hash
    },
    library: [],
    lists: [],
    activities: [],
    notifications: [],
    explore: {
      dismissed: []
    },
    ui: {
      explore: _normalizeExploreUiState(),
      library: _normalizeLibraryUiState(),
      lists: _normalizeListsUiState()
    }
  };

  _writeDb(db);

  req.session.userId = userId;

  req.session.save((err) => {
    if (err) {
      return res.status(500).json({
        error: "session_save_failed"
      });
    }

    res.json({
      user: db.users[userId].profile
    });

    void _sendWelcomeEmail({
      name: normalizedName,
      email: normalizedEmail,
      language: safeLanguage
    }).catch((error) => {
      console.error("[Auth] welcome email delivery failed", {
        code: error?.code || "",
        command: error?.command || "",
        responseCode: error?.responseCode || null,
        missingConfig: error?.missingConfig || []
      });
    });
  });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail || !password) {
    return res.status(400).json({ error: "missing_fields" });
  }

  const db = _readDb();
  const found = Object.entries(db.users).find(([, u]) =>
    String(u?.profile?.email || "").trim().toLowerCase() === normalizedEmail
  );

  if (!found) return res.status(401).json({ error: "invalid_credentials" });

  const [userId, userBucket] = found;
  const isValidPassword = _verifyPassword(password, userBucket?.auth);

  if (!isValidPassword) {
    return res.status(401).json({ error: "invalid_credentials" });
  }

  req.session.userId = userId;

  req.session.save((err) => {
    if (err) return res.status(500).json({ error: "session_save_failed" });
    res.json({ user: userBucket.profile });
  });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "logout_failed" });

    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

app.get("/api/auth/me", (req, res) => {
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ error: "not_authenticated" });

  const db = _readDb();
  const bucket = _getUserBucket(db, userId);
  res.json({ user: bucket.profile });
});

// ===== EXPLORE =====

function _normalizeExploreQueryText(value) {
  return String(value || "").trim().toLowerCase();
}

function _tokenizeExploreQuery(value) {
  return _normalizeExploreQueryText(value).split(/\s+/).filter(Boolean);
}

function _scoreExploreSearchItem(item, query) {
  const q = _normalizeExploreQueryText(query);
  if (!q) return 0;

  const localizedTitle = _normalizeExploreQueryText(item?.title);
  const originalTitle = _normalizeExploreQueryText(item?.originalTitle);
  const rawTokens = _tokenizeExploreQuery(q);

  const scoreTitleVariant = (candidate) => {
    if (!candidate) return -1;

    if (candidate === q) return 1000;
    if (candidate.startsWith(q)) return 800;
    if (candidate.includes(q)) return 600;

    const candidateWords = candidate.split(/\s+/).filter(Boolean);
    const matchedTokens = rawTokens.filter((token) =>
      candidateWords.includes(token)
    ).length;

    return (
      matchedTokens * 100 -
      Math.max(0, candidateWords.length - rawTokens.length)
    );
  };

  const title =
    [localizedTitle, originalTitle]
      .filter(Boolean)
      .sort(
        (first, second) =>
          scoreTitleVariant(second) - scoreTitleVariant(first)
      )[0] || "";

  const author = _normalizeExploreQueryText(item?.meta?.author);
  const summary = _normalizeExploreQueryText(item?.summary);
  const ignoredSearchTokens = new Set([
    "y",
    "e",
    "el",
    "la",
    "los",
    "las",
    "de",
    "del",
    "the",
    "and",
    "of"
  ]);

  const cleanedTokens = rawTokens.filter((token, index) => {
    if (ignoredSearchTokens.has(token)) return false;
    if (token.length === 1 && index === rawTokens.length - 1) return false;
    return true;
  });

  const tokens = cleanedTokens.length ? cleanedTokens : rawTokens;
  const titleWords = title.split(/\s+/).filter(Boolean);

  const normalizedTitle = title;
  const normalizedQuery = q;

  // match fuerte tipo franquicia
  const isStrongFranchiseMatch =
    normalizedTitle.startsWith(normalizedQuery) ||
    normalizedTitle.includes(` ${normalizedQuery}`) ||
    normalizedTitle.includes(`${normalizedQuery}:`);

  // HARD FILTER para queries de 1 palabra (evitar ruido tipo "Zelda película random")
  if (tokens.length === 1) {
    const token = tokens[0];

    const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const isExact = title === token;
    const startsWith = title.startsWith(token + " ");
    const containsStrong = new RegExp(`(^|\\s)${escapedToken}(\\s|$)`).test(title);

    if (!isExact && !startsWith && !containsStrong) {
      return 0;
    }

    const isVeryShortQuery = token.length <= 2;

    if (isVeryShortQuery) {
      const isStandaloneWord = new RegExp(`^${escapedToken}$`).test(title);
      const isKnownPattern = new RegExp(`^${escapedToken}[:\\-–—]`).test(title);
      const isStrongStart = title.startsWith(token + " ");

      if (!isStandaloneWord && !isStrongStart && !isKnownPattern) {
        return 0;
      }
    }
  }

  const matchedTitleTokens = tokens.filter((token) => titleWords.includes(token));

  const missingTitleTokens = tokens.filter((token) => !titleWords.includes(token));

  // HARD FILTER: require at least one strong title token match
  if (tokens.length > 1 && matchedTitleTokens.length === 0) {
    return 0;
  }

  const titleStartsWithQuery = title.startsWith(q);
  const titleEqualsQuery = title === q;
  const escapedQuery = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const titleContainsQuery = new RegExp(`(^|\\s)${escapedQuery}(\\s|$)`).test(title);

  const isSingleTokenCanonicalFranchise =
    tokens.length === 1 &&
    new RegExp(`\\b(?:the\\s+legend\\s+of|the)\\s+${escapedQuery}(?:\\b|:)`).test(title);

  const suffixAfterPrefix = titleStartsWithQuery ? title.slice(q.length).trim() : "";

  const derivativePattern =
    /\b(?:vol\.?|volume|tomo|book|gu[ií]a|guide|strategy|artbook|art\s*book|comic|manga|novel|novela|season|temporada|episode|episodio|part|parte|chapter|cap[ií]tulo|collection|complete\s+collection|bundle|dlc|soundtrack|ost|expansion|remaster|remastered|definitive|edition|deluxe|ultimate|gold|goty|ii|iii|iv|v|\d+)\b/i;

  const isDerivativeEdition = Boolean(
    suffixAfterPrefix && /^(?:[:\-–—]|\()/.test(suffixAfterPrefix) && derivativePattern.test(suffixAfterPrefix)
  );

  const hasDerivativeSignalsAnywhere =
    derivativePattern.test(title) && !titleEqualsQuery && !titleStartsWithQuery;

  let score = 0;

  // CORE ENTITY CONFIDENCE
  let coreMatchConfidence = 0;

  if (tokens.length > 0) {
    const coverage = matchedTitleTokens.length / tokens.length;

    if (coverage === 1) {
      coreMatchConfidence += tokens.length === 1 ? 30 : 120;
    } else if (coverage >= 0.75) {
      coreMatchConfidence += 60;
    }
  }

  // penalizar SOLO si claramente es derivado / ruido
  const extraWords = title.split(/\s+/).slice(tokens.length);

  if (
    extraWords.length > 0 &&
    extraWords.every((w) =>
      /^(guide|analysis|review|recap|summary|explained|ending|theory|collection|edition)$/i.test(w)
    )
  ) {
    coreMatchConfidence -= 80;
  }

  const strongDerivativePattern =
    /\b(?:logic|explained|analysis|review|recap|summary|ending|theory|breakdown|easter\s*eggs|facts)\b/i;

  if (strongDerivativePattern.test(title)) {
    score -= 300;
    coreMatchConfidence -= 120;
  }

  score += coreMatchConfidence;

  if (isStrongFranchiseMatch) {
    score += 400;
  }

  if (isSingleTokenCanonicalFranchise) {
    score += 260;
  }

  // EXACT MATCH DOMINANTE
  if (titleEqualsQuery) {
    score += tokens.length === 1 ? 40 : 1000;
  } else if (titleStartsWithQuery) {
    score += tokens.length === 1 ? 80 : 220;
  } else if (titleContainsQuery) {
    score += 60;
  }

  // COBERTURA COMPLETA DEL QUERY EN TITLE
  if (tokens.length > 0 && matchedTitleTokens.length === tokens.length) {
    score += tokens.length === 1 ? 60 : 220;
  } else if (matchedTitleTokens.length >= Math.max(1, tokens.length - 1)) {
    score += 70;
  }

  // PENALIZAR MATCHES PARCIALES
  if (missingTitleTokens.length > 0) {
    score -= missingTitleTokens.length * 40;
  }

  for (const token of tokens) {
    if (titleWords.includes(token)) {
      score += tokens.length === 1 ? 6 : 14;
    }
    if (author.includes(token)) score += 4;
    if (summary.includes(token)) score += 1;
  }

  // CANONICAL BOOST:
  // si empieza por la query y no parece una edición/derivado, se impulsa mucho
  if (titleStartsWithQuery && !suffixAfterPrefix) {
    score += 140;
  } else if (titleStartsWithQuery && !isDerivativeEdition) {
    score += 70;
  }

  // PENALIZACIONES DE DERIVADOS / RUIDO
  if (isDerivativeEdition) {
    score -= 140;
  }

  if (hasDerivativeSignalsAnywhere) {
    score -= 60;
  }

  if (item?.cover) score += 6;
  if (item?.summary) score += 3;

  // BALANCE REAL DE PROVIDERS
  if (item?.source === "tmdb") {
    score += 8;
  } else if (item?.source === "rawg") {
    score += 5;
  } else if (item?.source === "open_library") {
    score += 1;
  }

  const popularity = Number(item?.meta?.popularity || 0);
  const rating = Number(item?.meta?.rating || 0);
  const ratingCount = Number(item?.meta?.ratingCount || 0);

  if (item?.source === "tmdb") {
    score += Math.min(18, Math.floor(Math.log10(Math.max(1, popularity))) * 6);
    score += Math.min(12, Math.floor(Math.log10(Math.max(1, ratingCount))) * 4);
  }

  if (item?.source === "rawg") {
    if (rating >= 4) score += 12;
    else if (rating >= 3.5) score += 8;

    score += Math.min(20, Math.floor(Math.log10(Math.max(1, ratingCount))) * 5);
  }

  if (item?.source === "open_library") {
    score += Math.min(8, Math.floor(Math.log10(Math.max(1, ratingCount))) * 3);
  }

  // TYPE INTENT BOOST (solo cuando la query lo indica de verdad)

  let typeIntent = null;

  if (q.includes("game") || q.includes("videojuego") || q.includes("elden") || q.includes("witcher 3")) {
    typeIntent = "game";
  } else if (q.includes("book") || q.includes("novel") || q.includes("libro")) {
    typeIntent = "book";
  } else if (q.includes("serie") || q.includes("series") || q.includes("tv") || q.includes("show")) {
    typeIntent = "serie";
  } else if (q.includes("movie") || q.includes("film") || q.includes("pelicula") || q.includes("película")) {
    typeIntent = "pelicula";
  }

  if (typeIntent === "pelicula") {
    if (item.type === "pelicula") score += 8;
    if (item.type === "serie") score += 4;
    if (item.type === "game") score -= 3;
  }

  if (typeIntent === "serie") {
    if (item.type === "serie") score += 10;
    if (item.type === "pelicula") score += 3;
    if (item.type === "game") score -= 3;
  }

  if (typeIntent === "game") {
    if (item.type === "game") score += 10;
    if (item.type === "pelicula" || item.type === "serie") score -= 3;
  }

  if (typeIntent === "book") {
    if (item.type === "book") score += 8;
  }

  return score;
}

function _rankAndMixExploreItems(
  query,
  tmdbItems = [],
  openLibraryItems = [],
  rawgItems = []
) {
  const seen = new Set();

  const normalizeDedupTitle = (value) =>
    String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\([^)]*\)/g, " ")
      .replace(/[:\-–—]/g, " ")
      .replace(/\b(part|episode|season|temporada|episodio)\b\s*\d*/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

  const deduped = [...tmdbItems, ...openLibraryItems, ...rawgItems].filter((item) => {
    const normalizedTitle = normalizeDedupTitle(item?.title);
    const year = String(item?.meta?.year || "");
    const key = `${normalizedTitle}|${year}`;

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const ranked = deduped
    .map((item) => ({
      ...item,
      __score: _scoreExploreSearchItem(item, query)
    }))
    .filter((item) => item.__score > 0)
    .sort((a, b) => {
      if (b.__score !== a.__score) return b.__score - a.__score;

      const yearA = Number(a?.meta?.year || 0);
      const yearB = Number(b?.meta?.year || 0);
      if (yearB !== yearA) return yearB - yearA;

      const coverA = Number(Boolean(a?.cover));
      const coverB = Number(Boolean(b?.cover));
      if (coverB !== coverA) return coverB - coverA;

      return String(a?.title || "").localeCompare(String(b?.title || ""), "es", {
        sensitivity: "base"
      });
    });

  const mixed = [];
  const pool = [...ranked];

  while (pool.length) {
    const lastSource = mixed[mixed.length - 1]?.source || null;
    const prevSource = mixed[mixed.length - 2]?.source || null;
    const blockedSource = lastSource && lastSource === prevSource ? lastSource : null;

    let pickIndex = 0;

    if (blockedSource) {
      const alternativeIndex = pool.findIndex((item) => item.source !== blockedSource);
      if (alternativeIndex >= 0) pickIndex = alternativeIndex;
    }

    mixed.push(pool.splice(pickIndex, 1)[0]);
  }

  return mixed.slice(0, 30).map(({ __score, ...item }) => item);
}

const EXPLORE_FEED = [
  {
    eid: "quacker_seed:serie:ex_001",
    source: "quacker_seed",
    externalId: "ex_001",
    type: "serie",
    title: "Shogun",
    releaseDate: "2024-02-27",
    summary: "Drama histórico con estética muy cuidada y ritmo contenido."
  },
  {
    eid: "quacker_seed:pelicula:ex_002",
    source: "quacker_seed",
    externalId: "ex_002",
    type: "pelicula",
    title: "Dune: Part Two",
    releaseDate: "2024-03-01",
    summary: "Ciencia ficción épica, gran escala y producción muy sólida."
  },
  {
    eid: "quacker_seed:book:ex_003",
    source: "quacker_seed",
    externalId: "ex_003",
    type: "book",
    title: "Project Hail Mary",
    releaseDate: "2021-05-04",
    summary: "Ciencia ficción accesible, humor y misterio científico."
  },
  {
    eid: "quacker_seed:game:ex_004",
    source: "quacker_seed",
    externalId: "ex_004",
    type: "game",
    title: "Baldur's Gate 3",
    releaseDate: "2023-08-03",
    summary: "RPG enorme, decisiones con impacto y combate por turnos pulido."
  },
  {
    eid: "quacker_seed:serie:ex_005",
    source: "quacker_seed",
    externalId: "ex_005",
    type: "serie",
    title: "Arcane",
    releaseDate: "2021-11-06",
    summary: "Animación premium, música potente y narrativa muy emocional."
  },
  {
    eid: "quacker_seed:pelicula:ex_006",
    source: "quacker_seed",
    externalId: "ex_006",
    type: "pelicula",
    title: "Spider-Man: Across the Spider-Verse",
    releaseDate: "2023-06-02",
    summary: "Animación experimental, ritmo alto y diseño visual increíble."
  },
  {
    eid: "quacker_seed:serie:ex_007",
    source: "quacker_seed",
    externalId: "ex_007",
    type: "serie",
    title: "Severance",
    releaseDate: "2022-02-18",
    summary: "Thriller corporativo con misterio y una identidad visual muy marcada."
  },
  {
    eid: "quacker_seed:serie:ex_008",
    source: "quacker_seed",
    externalId: "ex_008",
    type: "serie",
    title: "The Bear",
    releaseDate: "2022-06-23",
    summary: "Cocina, caos y personajes intensos con ritmo rápido."
  },
  {
    eid: "quacker_seed:serie:ex_009",
    source: "quacker_seed",
    externalId: "ex_009",
    type: "serie",
    title: "Silo",
    releaseDate: "2023-05-05",
    summary: "Ciencia ficción con misterio, mundo cerrado y tensión creciente."
  },
  {
    eid: "quacker_seed:serie:ex_010",
    source: "quacker_seed",
    externalId: "ex_010",
    type: "serie",
    title: "The Last of Us",
    releaseDate: "2023-01-15",
    summary: "Drama postapocalíptico con foco en relación y supervivencia."
  },
  {
    eid: "quacker_seed:pelicula:ex_011",
    source: "quacker_seed",
    externalId: "ex_011",
    type: "pelicula",
    title: "Oppenheimer",
    releaseDate: "2023-07-21",
    summary: "Biografía densa con gran montaje y tensión sostenida."
  },
  {
    eid: "quacker_seed:pelicula:ex_012",
    source: "quacker_seed",
    externalId: "ex_012",
    type: "pelicula",
    title: "Poor Things",
    releaseDate: "2023-12-08",
    summary: "Fábula surreal con estética potente y humor oscuro."
  },
  {
    eid: "quacker_seed:pelicula:ex_013",
    source: "quacker_seed",
    externalId: "ex_013",
    type: "pelicula",
    title: "The Zone of Interest",
    releaseDate: "2023-12-15",
    summary: "Terror cotidiano contado desde la distancia y el sonido."
  },
  {
    eid: "quacker_seed:pelicula:ex_014",
    source: "quacker_seed",
    externalId: "ex_014",
    type: "pelicula",
    title: "Past Lives",
    releaseDate: "2023-06-02",
    summary: "Drama íntimo sobre decisiones, tiempo y conexiones."
  },
  {
    eid: "quacker_seed:pelicula:ex_015",
    source: "quacker_seed",
    externalId: "ex_015",
    type: "pelicula",
    title: "Barbie",
    releaseDate: "2023-07-21",
    summary: "Comedia y sátira con diseño de producción muy cuidado."
  },
  {
    eid: "quacker_seed:book:ex_016",
    source: "quacker_seed",
    externalId: "ex_016",
    type: "book",
    title: "The Three-Body Problem",
    releaseDate: "2008-01-01",
    summary: "Ciencia ficción de ideas grandes, escala histórica y misterio."
  },
  {
    eid: "quacker_seed:book:ex_017",
    source: "quacker_seed",
    externalId: "ex_017",
    type: "book",
    title: "Klara and the Sun",
    releaseDate: "2021-03-02",
    summary: "Reflexión suave sobre humanidad, amor y observación."
  },
  {
    eid: "quacker_seed:book:ex_018",
    source: "quacker_seed",
    externalId: "ex_018",
    type: "book",
    title: "Tomorrow, and Tomorrow, and Tomorrow",
    releaseDate: "2022-07-05",
    summary: "Amistad, creatividad y videojuegos como hilo emocional."
  },
  {
    eid: "quacker_seed:book:ex_019",
    source: "quacker_seed",
    externalId: "ex_019",
    type: "book",
    title: "The Name of the Wind",
    releaseDate: "2007-03-27",
    summary: "Fantasía con narrador carismático y mundo muy detallado."
  },
  {
    eid: "quacker_seed:book:ex_020",
    source: "quacker_seed",
    externalId: "ex_020",
    type: "book",
    title: "Atomic Habits",
    releaseDate: "2018-10-16",
    summary: "Hábitos y sistemas con enfoque práctico y simple."
  },
  {
    eid: "quacker_seed:game:ex_021",
    source: "quacker_seed",
    externalId: "ex_021",
    type: "game",
    title: "Hades",
    releaseDate: "2020-09-17",
    summary: "Roguelite ágil con narrativa integrada y combate muy pulido."
  },
  {
    eid: "quacker_seed:game:ex_022",
    source: "quacker_seed",
    externalId: "ex_022",
    type: "game",
    title: "Elden Ring",
    releaseDate: "2022-02-25",
    summary: "Exploración libre, combate exigente y mundo enorme."
  },
  {
    eid: "quacker_seed:game:ex_023",
    source: "quacker_seed",
    externalId: "ex_023",
    type: "game",
    title: "Cyberpunk 2077",
    releaseDate: "2020-12-10",
    summary: "RPG urbano con narrativa y estilo visual muy marcados."
  },
  {
    eid: "quacker_seed:game:ex_024",
    source: "quacker_seed",
    externalId: "ex_024",
    type: "game",
    title: "The Legend of Zelda: Tears of the Kingdom",
    releaseDate: "2023-05-12",
    summary: "Creatividad, exploración y sistemas emergentes a gran escala."
  },
  {
    eid: "quacker_seed:game:ex_025",
    source: "quacker_seed",
    externalId: "ex_025",
    type: "game",
    title: "Disco Elysium",
    releaseDate: "2019-10-15",
    summary: "RPG narrativo con decisiones, diálogos y tono único."
  },
  {
    eid: "quacker_seed:serie:ex_026",
    source: "quacker_seed",
    externalId: "ex_026",
    type: "serie",
    title: "True Detective",
    releaseDate: "2014-01-12",
    summary: "Investigación oscura, atmósfera densa y personajes complejos."
  }
];

app.get("/api/explore", _requireAuth, async (req, res) => {
 res.set("Cache-Control", "no-store");

 const q = String(req.query.q || "").trim();
 const type = String(req.query.type || "").trim().toLowerCase();
 const sort = String(req.query.sort || "").trim().toLowerCase();
 const limit =
 Number.isFinite(Number(req.query.limit)) && Number(req.query.limit) > 0
 ? Number(req.query.limit)
 : 0;

 try {
  if (q) {
  const [tmdbResult, openLibraryResult, rawgResult] = await Promise.allSettled([
  searchTmdb(q),
  searchOpenLibrary(q),
  searchRawg(q)
  ]);

  if (tmdbResult.status === "rejected") {
    console.error("[/api/explore] TMDB search failed:", tmdbResult.reason);
  }

  if (openLibraryResult.status === "rejected") {
    console.error("[/api/explore] Open Library search failed:", openLibraryResult.reason);
  }

  if (rawgResult.status === "rejected") {
    console.error("[/api/explore] RAWG search failed:", rawgResult.reason);
  }

  const tmdbItems =
  tmdbResult.status === "fulfilled" && Array.isArray(tmdbResult.value)
  ? tmdbResult.value
  : [];

  const openLibraryItems =
  openLibraryResult.status === "fulfilled" && Array.isArray(openLibraryResult.value)
  ? openLibraryResult.value
  : [];

  const rawgItems =
  rawgResult.status === "fulfilled" && Array.isArray(rawgResult.value)
  ? rawgResult.value
  : [];

  let rankedItems = _rankAndMixExploreItems(q, tmdbItems, openLibraryItems, rawgItems);

  if (type) {
    rankedItems = rankedItems.filter((item) => String(item?.type || "").trim() === type);
  }

  if (limit > 0) {
    rankedItems = rankedItems.slice(0, limit);
  }
  return res.json({ items: rankedItems });
 }

 if (sort === "weekly") {
  const weeklyLimit = limit > 0 ? limit : 3;

  if (type === "serie" || type === "pelicula") {
  const items = await getWeeklyTrendingTmdbByType(type, weeklyLimit);
  return res.json({ items });
  }

  if (type === "game") {
  const items = await getWeeklyFeaturedRawg(weeklyLimit);
  return res.json({ items });
  }

  if (type === "book") {
  const items = await getWeeklyFeaturedOpenLibrary(weeklyLimit);
  return res.json({ items });
  }

  const [seriesResult, moviesResult, booksResult, gamesResult] = await Promise.allSettled([
  getWeeklyTrendingTmdbByType("serie", weeklyLimit),
  getWeeklyTrendingTmdbByType("pelicula", weeklyLimit),
  getWeeklyFeaturedOpenLibrary(weeklyLimit),
  getWeeklyFeaturedRawg(weeklyLimit)
  ]);

  const items = [
  ...(seriesResult.status === "fulfilled" ? seriesResult.value : []),
  ...(moviesResult.status === "fulfilled" ? moviesResult.value : []),
  ...(booksResult.status === "fulfilled" ? booksResult.value : []),
  ...(gamesResult.status === "fulfilled" ? gamesResult.value : [])
  ];

  return res.json({ items });
 }

  return res.json({ items: [] });

 } catch (err) {

 console.error("GET /api/explore error", err);

 return res.status(err?.status || 500).json({

 error: err?.message || "explore_fetch_failed"

 });

 }

});

app.get("/api/explore/item/:source/:type/:externalId/season/:seasonNumber", _requireAuth, async (req, res) => {
  const source = String(req.params.source || "").trim().toLowerCase();
  const type = String(req.params.type || "").trim().toLowerCase();
  const externalId = String(req.params.externalId || "").trim();
  const seasonNumber = Math.max(1, Number(req.params.seasonNumber || 0) || 0);

  try {
    if (source === "tmdb" && type === "serie") {
      const season = await getTmdbSeasonDetail({ externalId, seasonNumber });
      return res.json(season);
    }

    return res.status(400).json({ error: "unsupported_season_source" });
  } catch (err) {
    console.error("GET /api/explore/item season error", err);
    return res.status(err?.status || 500).json({
      error: err?.message || "explore_season_detail_failed"
    });
  }
});

app.get("/api/explore/item/:source/:type/:externalId", _requireAuth, async (req, res) => {
  const source = String(req.params.source || "").trim().toLowerCase();
  const type = String(req.params.type || "").trim().toLowerCase();
  const externalId = String(req.params.externalId || "").trim();

  try {
    if (source === "tmdb") {
      const item = await getTmdbDetail({ type, externalId });
      return res.json(item);
    }

    if (source === "open_library") {
      const item = await getOpenLibraryBookDetail(externalId);
      return res.json(item);
    }

    if (source === "rawg") {
      const item = await getRawgDetail(externalId);
      return res.json(item);
    }

    return res.status(400).json({ error: "unsupported_source" });
  } catch (err) {
    console.error("GET /api/explore/item error", err);
    return res.status(err?.status || 500).json({
      error: err?.message || "explore_detail_failed"
    });
  }
});

// ===== USER (mínimo) =====
app.get("/api/user", _requireAuth, (req, res) => {
  const db = _readDb();
  const bucket = _getUserBucket(db, req.session.userId);
  res.json(bucket.profile);
});

app.patch("/api/user", _requireAuth, (req, res) => {
  const patch = req.body || {};

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: "empty_patch" });
  }

  const allowedFields = new Set([
    "name",
    "handle",
    "email",
    "language",
    "bio",
    "avatar",
    "theme",
    "lastStreakNotified"
  ]);

  const safePatch = {};

  for (const key of Object.keys(patch)) {
    if (allowedFields.has(key)) {
      safePatch[key] = patch[key];
    }
  }

  if (Object.keys(safePatch).length === 0) {
    return res.status(400).json({ error: "empty_patch" });
  }

  if (Object.prototype.hasOwnProperty.call(safePatch, "name")) {
    const nameValidation = validateAccountName(safePatch.name);

    if (!nameValidation.ok) {
      return res.status(400).json({
        error: nameValidation.error
      });
    }

    safePatch.name = nameValidation.value;
  }

  if (Object.prototype.hasOwnProperty.call(safePatch, "handle")) {
    let safeHandle = String(safePatch.handle || "").trim();
    if (!safeHandle.startsWith("@")) safeHandle = `@${safeHandle}`;
    const raw = safeHandle.slice(1);

    if (!/^[a-zA-Z0-9_]{2,20}$/.test(raw)) {
      return res.status(400).json({ error: "invalid_handle" });
    }

    safePatch.handle = safeHandle;
  }

  if (Object.prototype.hasOwnProperty.call(safePatch, "email")) {
    const emailValidation = validateAccountEmail(safePatch.email);

    if (!emailValidation.ok) {
      return res.status(400).json({
        error: emailValidation.error
      });
    }

    safePatch.email = emailValidation.value;
  }

  if (Object.prototype.hasOwnProperty.call(safePatch, "language")) {
    const safeLanguage = String(safePatch.language || "").trim().toLowerCase();
    if (!["es", "en"].includes(safeLanguage)) {
      return res.status(400).json({ error: "invalid_language" });
    }
    safePatch.language = safeLanguage;
  }

  if (Object.prototype.hasOwnProperty.call(safePatch, "bio")) {
    const safeBio = String(safePatch.bio || "").trim();
    if (safeBio.length > 180) {
      return res.status(400).json({ error: "bio_too_long" });
    }
    safePatch.bio = safeBio;
  }

  if (Object.prototype.hasOwnProperty.call(safePatch, "lastStreakNotified")) {
    const safeValue = Math.max(0, Number(safePatch.lastStreakNotified || 0) || 0);
    safePatch.lastStreakNotified = safeValue;
  }

  if (Object.prototype.hasOwnProperty.call(safePatch, "theme")) {
    const safeTheme = String(safePatch.theme || "").trim().toLowerCase();
    if (!["light", "dark"].includes(safeTheme)) {
      return res.status(400).json({ error: "invalid_theme" });
    }
    safePatch.theme = safeTheme;
  }

  if (Object.prototype.hasOwnProperty.call(safePatch, "avatar")) {
    safePatch.avatar = String(safePatch.avatar || "").trim();
  }

  const db = _readDb();
  const bucket = _getUserBucket(db, req.session.userId);

  if (
    Object.prototype.hasOwnProperty.call(safePatch, "handle") &&
    isAccountHandleInUse(
      db.users,
      safePatch.handle,
      {
        excludeUserId: req.session.userId
      }
    )
  ) {
    return res.status(409).json({
      error: "handle_in_use"
    });
  }

  if (
    Object.prototype.hasOwnProperty.call(safePatch, "email") &&
    isAccountEmailInUse(
      db.users,
      safePatch.email,
      {
        excludeUserId: req.session.userId
      }
    )
  ) {
    return res.status(409).json({
      error: "email_in_use"
    });
  }

  bucket.profile = {
    ...(bucket.profile || {}),
    ...safePatch
  };

  _writeDb(db);

  res.json({ user: bucket.profile });
});

app.get("/api/user/ui/explore", _requireAuth, (req, res) => {
  const db = _readDb();
  const bucket = _getUserBucket(db, req.session.userId);
  res.json(bucket.ui.explore);
});

app.patch("/api/user/ui/explore", _requireAuth, (req, res) => {
  const patch = req.body || {};
  const db = _readDb();
  const bucket = _getUserBucket(db, req.session.userId);

  bucket.ui.explore = _normalizeExploreUiState({
    ...bucket.ui.explore,
    ...patch
  });

  _writeDb(db);

  res.json({ ok: true, ui: bucket.ui.explore });
});

app.get("/api/user/ui/library", _requireAuth, (req, res) => {
  const db = _readDb();
  const bucket = _getUserBucket(db, req.session.userId);
  res.json(bucket.ui.library);
});

app.patch("/api/user/ui/library", _requireAuth, (req, res) => {
  const patch = req.body || {};
  const db = _readDb();
  const bucket = _getUserBucket(db, req.session.userId);

  bucket.ui.library = _normalizeLibraryUiState({
    ...bucket.ui.library,
    ...patch
  });

  _writeDb(db);

  res.json({ ok: true, ui: bucket.ui.library });
});

app.get("/api/user/ui/lists", _requireAuth, (req, res) => {
  const db = _readDb();
  const bucket = _getUserBucket(db, req.session.userId);
  res.json(bucket.ui.lists);
});

app.patch("/api/user/ui/lists", _requireAuth, (req, res) => {
  const patch = req.body || {};
  const db = _readDb();
  const bucket = _getUserBucket(db, req.session.userId);

  bucket.ui.lists = _normalizeListsUiState({
    ...bucket.ui.lists,
    ...patch
  });

  _writeDb(db);

  res.json({ ok: true, ui: bucket.ui.lists });
});

app.get("/api/user/explore/dismissed", _requireAuth, (req, res) => {
  const db = _readDb();
  const bucket = _getUserBucket(db, req.session.userId);
  res.json({ dismissed: bucket.explore.dismissed });
});

app.post("/api/user/explore/dismissed", _requireAuth, (req, res) => {
  const eid = String(req.body?.eid || "").trim();

  if (!eid) {
    return res.status(400).json({ error: "missing_eid" });
  }

  const db = _readDb();
  const bucket = _getUserBucket(db, req.session.userId);

  bucket.explore.dismissed = _normalizeExploreDismissedIds([
    eid,
    ...bucket.explore.dismissed
  ]);

  _writeDb(db);

  res.json({ ok: true, dismissed: bucket.explore.dismissed });
});

app.delete("/api/user/explore/dismissed", _requireAuth, (req, res) => {
  const db = _readDb();
  const bucket = _getUserBucket(db, req.session.userId);

  bucket.explore.dismissed = [];

  _writeDb(db);

  res.json({ ok: true });
});

app.get("/api/lists", _requireAuth, (req, res) => {
  const db = _readDb();
  const bucket = _getUserBucket(db, req.session.userId);
  res.json(bucket.lists);
});

app.post("/api/lists", _requireAuth, (req, res) => {
  const data = req.body || {};
  const name = String(data.name || "").replace(/\s+/g, " ").trim();
  const description = String(data.description || "").trim();
  const visibility = String(data.visibility || "private").trim().toLowerCase();

  if (!name) return res.status(400).json({ error: "missing_name" });
  if (name.length < 2) return res.status(400).json({ error: "name_too_short" });
  if (name.length > 80) return res.status(400).json({ error: "name_too_long" });
  if (!["private", "public", "collab"].includes(visibility)) {
    return res.status(400).json({ error: "invalid_visibility" });
  }

  const db = _readDb();
  const bucket = _getUserBucket(db, req.session.userId);
  const nowIso = new Date().toISOString();

  const list = {
    id: _uid(),
    name,
    description,
    visibility,
    items: [],
    itemsCount: 0,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  bucket.lists.push(list);
  _writeDb(db);

  res.status(201).json(list);
});

app.put("/api/lists", _requireAuth, (req, res) => {
  const incoming = Array.isArray(req.body?.lists) ? req.body.lists : null;

  if (!incoming) {
    return res.status(400).json({ error: "invalid_lists_payload" });
  }

  const db = _readDb();
  const bucket = _getUserBucket(db, req.session.userId);
  const nowIso = new Date().toISOString();

  const safeLists = incoming.map((list) => {
    const items = Array.isArray(list?.items) ? list.items : [];

    const safeItems = items
      .map((entry) => {
        const rawId = typeof entry === "string" ? entry : entry?.id;
        if (!rawId) return null;

        return {
          id: String(rawId),
          addedAt: entry?.addedAt || nowIso
        };
      })
      .filter(Boolean);

    return {
      id: list?.id ? String(list.id) : _uid(),
      name: String(list?.name || "").replace(/\s+/g, " ").trim() || "Sin nombre",
      description: String(list?.description || "").trim(),
      visibility: ["private", "public", "collab"].includes(String(list?.visibility || "").trim().toLowerCase())
        ? String(list.visibility).trim().toLowerCase()
        : "private",
      items: safeItems,
      itemsCount: safeItems.length,
      createdAt: list?.createdAt || nowIso,
      updatedAt: nowIso
    };
  });

  bucket.lists = safeLists;
  _writeDb(db);

  res.json({ ok: true, lists: bucket.lists });
});

app.patch("/api/lists/:id", _requireAuth, (req, res) => {
  const id = String(req.params.id);
  const patch = req.body || {};

  const db = _readDb();
  const bucket = _getUserBucket(db, req.session.userId);
  const idx = bucket.lists.findIndex((list) => String(list.id) === id);

  if (idx === -1) return res.status(404).json({ error: "not_found" });

  const prev = bucket.lists[idx];
  const next = {
    ...prev,
    updatedAt: new Date().toISOString()
  };

  if (Object.prototype.hasOwnProperty.call(patch, "name")) {
    const safeName = String(patch.name || "").replace(/\s+/g, " ").trim();
    if (!safeName) return res.status(400).json({ error: "missing_name" });
    if (safeName.length < 2) return res.status(400).json({ error: "name_too_short" });
    if (safeName.length > 80) return res.status(400).json({ error: "name_too_long" });
    next.name = safeName;
  }

  if (Object.prototype.hasOwnProperty.call(patch, "description")) {
    next.description = String(patch.description || "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(patch, "visibility")) {
    const safeVisibility = String(patch.visibility || "").trim().toLowerCase();
    if (!["private", "public", "collab"].includes(safeVisibility)) {
      return res.status(400).json({ error: "invalid_visibility" });
    }
    next.visibility = safeVisibility;
  }

  next.items = Array.isArray(prev.items) ? prev.items : [];
  next.itemsCount = next.items.length;

  bucket.lists[idx] = next;
  _writeDb(db);

  res.json(next);
});

app.delete("/api/lists/:id", _requireAuth, (req, res) => {
  const id = String(req.params.id);

  const db = _readDb();
  const bucket = _getUserBucket(db, req.session.userId);
  const before = bucket.lists.length;

  bucket.lists = bucket.lists.filter((list) => String(list.id) !== id);

  if (bucket.lists.length === before) {
    return res.status(404).json({ error: "not_found" });
  }

  _writeDb(db);
  res.json({ ok: true, deleted: 1 });
});

app.post("/api/lists/:id/items", _requireAuth, (req, res) => {
  const listId = String(req.params.id);
  const itemId = String(req.body?.itemId || "").trim();

  if (!itemId) {
    return res.status(400).json({ error: "missing_item_id" });
  }

  const db = _readDb();
  const bucket = _getUserBucket(db, req.session.userId);

  bucket.lists = Array.isArray(bucket.lists) ? bucket.lists : [];
  bucket.library = Array.isArray(bucket.library) ? bucket.library : [];

  const list = bucket.lists.find((entry) => String(entry?.id) === listId);
  if (!list) {
    return res.status(404).json({ error: "list_not_found" });
  }

  const libraryItemExists = bucket.library.some(
    (entry) => String(entry?.id) === itemId
  );
  if (!libraryItemExists) {
    return res.status(404).json({ error: "item_not_found" });
  }

  list.items = Array.isArray(list.items) ? list.items : [];

  const already = list.items.some((entry) => {
    const id = typeof entry === "string" ? entry : entry?.id;
    return String(id) === itemId;
  });

  if (already) {
    return res.json({ ok: true, already: true, list });
  }

  list.items.push({
    id: itemId,
    addedAt: new Date().toISOString()
  });

  list.itemsCount = list.items.length;
  list.updatedAt = new Date().toISOString();

  _writeDb(db);

  return res.status(201).json({
    ok: true,
    list,
    itemId
  });
});

app.delete("/api/lists/:id/items/:itemId", _requireAuth, (req, res) => {
  const listId = String(req.params.id);
  const itemId = String(req.params.itemId);

  const db = _readDb();
  const bucket = _getUserBucket(db, req.session.userId);

  const list = bucket.lists.find((x) => String(x.id) === listId);
  if (!list) return res.status(404).json({ error: "list_not_found" });

  list.items = Array.isArray(list.items) ? list.items : [];
  const before = list.items.length;

  list.items = list.items.filter((entry) => {
    const id = typeof entry === "string" ? entry : entry?.id;
    return String(id) !== itemId;
  });

  const removed = before - list.items.length;
  if (removed <= 0) {
    return res.status(404).json({ error: "item_not_in_list" });
  }

  list.itemsCount = list.items.length;
  list.updatedAt = new Date().toISOString();

  _writeDb(db);
  res.json({ ok: true, removed });
});

app.get("/api/activities", _requireAuth, (req, res) => {
  const db = _readDb();
  const bucket = _getUserBucket(db, req.session.userId);
  const filter = String(req.query.filter || "all").trim().toLowerCase();
  const limit = Math.max(0, Number(req.query.limit || 0) || 0);
  const itemId = String(req.query.itemId || "").trim();
  const allowedTypes = new Set(["progress", "completed"]);

  const activities = (Array.isArray(bucket.activities) ? bucket.activities : [])
    .filter((activity) => {
      const type = _normalizeActivityType(activity?.type);
      if (!allowedTypes.has(type)) return false;
      if (itemId && String(activity?.targetId || "").trim() !== itemId) return false;
      if (filter === "all" || !filter) return true;
      return type === filter;
    })
    .map((activity) => ({
      id: String(activity?.id || "").trim() || _uid(),
      type: _normalizeActivityType(activity?.type),
      targetType: "library_item",
      targetId: String(activity?.targetId || "").trim(),
      minutes: Number.isFinite(Number(activity?.minutes))
        ? Math.max(0, Number(activity.minutes))
        : 0,
      createdAt: _normalizeActivityCreatedAt(activity?.createdAt) || new Date().toISOString(),
      payload: _normalizeActivityPayload(activity?.payload)
    }))
    .filter((activity) => activity.targetId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({
    activities: limit > 0 ? activities.slice(0, limit) : activities
  });
});

app.delete("/api/activities", _requireAuth, (req, res) => {
  const itemId = String(req.query.itemId || "").trim();
  const sinceIso = _normalizeActivityCreatedAt(req.query.since);

  if (!itemId || !sinceIso) {
    return res.status(400).json({ error: "missing_params" });
  }

  const db = _readDb();
  const bucket = _getUserBucket(db, req.session.userId);
  const before = Array.isArray(bucket.activities) ? bucket.activities.length : 0;

  bucket.activities = (Array.isArray(bucket.activities) ? bucket.activities : []).filter((entry) => {
    const targetId = String(entry?.targetId || "").trim();
    const type = _normalizeActivityType(entry?.type);
    const createdAt = _normalizeActivityCreatedAt(entry?.createdAt);

    if (targetId !== itemId) return true;
    if (!["progress", "completed"].includes(type)) return true;
    if (!createdAt) return true;

    return new Date(createdAt) < new Date(sinceIso);
  });

  const removed = before - bucket.activities.length;
  _writeDb(db);

  res.json({ ok: true, removed });
});

app.get("/api/notifications", _requireAuth, (req, res) => {
  const db = _readDb();
  const bucket = _getUserBucket(db, req.session.userId);

  res.json({
    notifications: _normalizeUserNotificationsList(bucket.notifications)
  });
});

app.post("/api/notifications", _requireAuth, (req, res) => {
  const db = _readDb();
  const bucket = _getUserBucket(db, req.session.userId);
  const nextNotification = _normalizeUserNotification(req.body || {});

  if (!nextNotification) {
    return res.status(400).json({ error: "invalid_notification" });
  }

  bucket.notifications = _normalizeUserNotificationsList([
    nextNotification,
    ...(Array.isArray(bucket.notifications) ? bucket.notifications : [])
  ]);
  _writeDb(db);

  res.status(201).json(nextNotification);
});

app.delete("/api/notifications/:id", _requireAuth, (req, res) => {
  const targetId = _normalizeNotificationId(req.params.id);
  if (!targetId) {
    return res.status(400).json({ error: "missing_id" });
  }

  const db = _readDb();
  const bucket = _getUserBucket(db, req.session.userId);
  const before = bucket.notifications.length;

  bucket.notifications = _normalizeUserNotificationsList(bucket.notifications).filter(
    (entry) => entry.id !== targetId
  );

  if (bucket.notifications.length === before) {
    return res.status(404).json({ error: "not_found" });
  }

  _writeDb(db);
  res.json({ ok: true, removed: 1 });
});

app.delete("/api/notifications", _requireAuth, (req, res) => {
  const db = _readDb();
  const bucket = _getUserBucket(db, req.session.userId);

  bucket.notifications = [];
  _writeDb(db);

  res.json({ ok: true, cleared: true });
});

app.put("/api/notifications", _requireAuth, (req, res) => {
  const db = _readDb();
  const bucket = _getUserBucket(db, req.session.userId);
  const nextList = _normalizeUserNotificationsList(req.body?.notifications);

  bucket.notifications = nextList;
  _writeDb(db);

  res.json({
    ok: true,
    notifications: nextList
  });
});

// ===== LIBRARY =====
app.get("/api/library", _requireAuth, (req, res) => {
  const db = _readDb();
  const bucket = _getUserBucket(db, req.session.userId);
  res.json(bucket.library);
});

app.get("/api/library/:id", _requireAuth, (req, res) => {
  const db = _readDb();
  const bucket = _getUserBucket(db, req.session.userId);

  const id = String(req.params.id);
  const item = bucket.library.find((it) => String(it.id) === id);
  if (!item) return res.status(404).json({ error: "not_found" });

  res.json(item);
});

app.post("/api/library/restore", _requireAuth, (req, res) => {
  const body = req.body || {};
  const data = body.item && typeof body.item === "object" && !Array.isArray(body.item)
    ? body.item
    : body;

  const id = String(data.id || "").trim();
  const title = _normalizeContentText(data.title);
  const type = String(data.type || "pelicula").trim().toLowerCase();
  const canonicalIdentity = _normalizeCanonicalIdentity(data.source, type, data.externalId);

  const allowedTypes = new Set(["serie", "pelicula", "book", "game"]);
  const allowedStatuses = new Set([
    "pending",
    "not_started",
    "in_progress",
    "watching",
    "reading",
    "playing",
    "completed"
  ]);

  if (!id) return res.status(400).json({ error: "missing_id" });
  if (!title) return res.status(400).json({ error: "missing_title" });
  if (title.length < 2) return res.status(400).json({ error: "title_too_short" });
  if (title.length > 120) return res.status(400).json({ error: "title_too_long" });
  if (!allowedTypes.has(type)) return res.status(400).json({ error: "invalid_type" });
  if (!canonicalIdentity.source || !canonicalIdentity.externalId) {
    return res.status(400).json({ error: "missing_identity" });
  }

  if (
    Object.prototype.hasOwnProperty.call(data, "status") &&
    data.status != null &&
    String(data.status).trim() !== ""
  ) {
    const status = String(data.status || "").trim().toLowerCase();
    if (!allowedStatuses.has(status)) {
      return res.status(400).json({ error: "invalid_status" });
    }
  }

  const rawProgress = Number(data.progress ?? 0);
  const safeProgress = Number.isFinite(rawProgress)
    ? Math.max(0, Math.min(100, rawProgress))
    : 0;

  const db = _readDb();
  const bucket = _getUserBucket(db, req.session.userId);
  bucket.library = Array.isArray(bucket.library) ? bucket.library : [];

  const existing = bucket.library.find((it) => String(it.id) === id);

  if (existing) {
    return res.json({
      ok: true,
      already: true,
      alreadyExists: true,
      item: {
        ...existing,
        alreadyExists: true
      }
    });
  }

  const duplicate = bucket.library.find((it) =>
    _isSameLibraryIdentity(it, {
      title,
      type,
      source: canonicalIdentity.source,
      externalId: canonicalIdentity.externalId
    })
  );

  if (duplicate) {
    return res.json({
      ok: true,
      already: true,
      alreadyExists: true,
      item: {
        ...duplicate,
        alreadyExists: true
      }
    });
  }

  const nowIso = new Date().toISOString();
  const item = {
    id,
    type,
    title,
    source: canonicalIdentity.source,
    externalId: canonicalIdentity.externalId,
    status: _normalizeLibraryStatus(data.status, type, safeProgress),
    progress: safeProgress,
    meta: _sanitizeLibraryMeta(data.meta),
    cover: String(data.cover || "").trim().slice(0, 500),
    createdAt: String(data.createdAt || nowIso),
    updatedAt: nowIso
  };

  if (body.toFront === false) {
    bucket.library.push(item);
  } else {
    bucket.library.unshift(item);
  }

  _writeDb(db);

  res.status(201).json({ ok: true, item });
});

app.post("/api/library", _requireAuth, (req, res) => {
  const data = req.body || {};
  const title = _normalizeContentText(data.title);
  const type = String(data.type || "pelicula").trim().toLowerCase();
  const canonicalIdentity = _normalizeCanonicalIdentity(
    data.source,
    type,
    data.externalId
  );

  const allowedTypes = new Set(["serie", "pelicula", "book", "game"]);
  const allowedStatuses = new Set([
    "pending",
    "not_started",
    "in_progress",
    "watching",
    "reading",
    "playing",
    "completed"
  ]);

  if (!title) {
    return res.status(400).json({ error: "missing_title" });
  }

  if (title.length < 2) {
    return res.status(400).json({ error: "title_too_short" });
  }

  if (title.length > 120) {
    return res.status(400).json({ error: "title_too_long" });
  }

  if (!allowedTypes.has(type)) {
    return res.status(400).json({ error: "invalid_type" });
  }

  if (!canonicalIdentity.source || !canonicalIdentity.externalId) {
    return res.status(400).json({ error: "missing_identity" });
  }

  if (
    Object.prototype.hasOwnProperty.call(data, "status") &&
    data.status != null &&
    String(data.status).trim() !== ""
  ) {
    const status = String(data.status || "").trim().toLowerCase();
    if (!allowedStatuses.has(status)) {
      return res.status(400).json({ error: "invalid_status" });
    }
  }

  const rawProgress = Number(data.progress ?? 0);
  const progress = Number.isFinite(rawProgress)
    ? Math.max(0, Math.min(100, rawProgress))
    : 0;
  
  const db = _readDb();
  const bucket = _getUserBucket(db, req.session.userId);

  const duplicate = bucket.library.find((it) =>
    _isSameLibraryIdentity(it, {
      title,
      type,
      source: canonicalIdentity.source,
      externalId: canonicalIdentity.externalId
    })
  );

  if (duplicate) {
    return res.json({
      ok: true,
      already: true,
      alreadyExists: true,
      item: {
        ...duplicate,
        alreadyExists: true
      }
    });
  }

  const sanitizedMeta = _sanitizeLibraryMeta(data.meta);

  const nowIso = new Date().toISOString();

  let safeProgress = Number(progress);
  if (!Number.isFinite(safeProgress)) safeProgress = 0;
  safeProgress = Math.max(0, Math.min(100, safeProgress));
  const status = _normalizeLibraryStatus(data.status, type, safeProgress);
  
  const item = {
    id: _uid(),
    type,
    title,
    source: canonicalIdentity.source,
    externalId: canonicalIdentity.externalId,
    status,
    progress: safeProgress,
    meta: sanitizedMeta,
    cover: String(data.cover || "").trim().slice(0, 500),
    createdAt: nowIso,
    updatedAt: nowIso
  };

  bucket.library.push(item);
  _writeDb(db);

  res.json(item);
});

app.patch("/api/library/:id", _requireAuth, (req, res) => {
  const id = String(req.params.id);
  const rawPatch = req.body || {};
  const patch = { ...rawPatch };
  const shouldLogActivity = rawPatch.logActivity !== false;

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: "empty_patch" });
  }

  const allowedPatchFields = new Set([
    "title",
    "type",
    "source",
    "externalId",
    "status",
    "progress",
    "meta",
    "cover",
    "lastActivityAt"
  ]);

  for (const key of Object.keys(patch)) {
    if (!allowedPatchFields.has(key)) {
      delete patch[key];
    }
  }

  const allowedTypes = new Set(["serie", "pelicula", "book", "game"]);
  const allowedStatuses = new Set([
    "pending",
    "not_started",
    "in_progress",
    "watching",
    "reading",
    "playing",
    "completed"
  ]);

  const db = _readDb();
  const bucket = _getUserBucket(db, req.session.userId);

  const idx = bucket.library.findIndex((it) => String(it.id) === id);
  if (idx === -1) return res.status(404).json({ error: "not_found" });

  const prev = bucket.library[idx];
  const nowIso = new Date().toISOString();
  const prevProgress = Math.max(0, Math.min(100, Number(prev.progress ?? 0)));
  const prevCompleted = prevProgress >= 100 || String(prev.status || "").trim().toLowerCase() === "completed";

  const next = {
    ...prev,
    ...patch,
    id: prev.id,
    createdAt: prev.createdAt,
    updatedAt: new Date().toISOString()
  };

  if (Object.prototype.hasOwnProperty.call(patch, "title")) {
    const title = _normalizeContentText(patch.title);

    next.title = title;

    if (!title) {
      return res.status(400).json({ error: "missing_title" });
    }

    if (title.length < 2) {
      return res.status(400).json({ error: "title_too_short" });
    }

    if (title.length > 120) {
      return res.status(400).json({ error: "title_too_long" });
    }

    next.title = title;
  }

  if (Object.prototype.hasOwnProperty.call(patch, "type")) {
    const type = String(patch.type || "").trim();

    if (!allowedTypes.has(type)) {
      return res.status(400).json({ error: "invalid_type" });
    }

    next.type = type;
  }

  const canonicalIdentity = _normalizeCanonicalIdentity(
    Object.prototype.hasOwnProperty.call(patch, "source")
      ? patch.source
      : prev.source,
    next.type,
    Object.prototype.hasOwnProperty.call(patch, "externalId")
      ? patch.externalId
      : prev.externalId
  );

  if (
    canonicalIdentity.error ||
    !canonicalIdentity.source ||
    !canonicalIdentity.type ||
    !canonicalIdentity.externalId
  ) {
    return res.status(400).json({
      error: canonicalIdentity.error || "missing_identity"
    });
  }

  next.source = canonicalIdentity.source;
  next.externalId = canonicalIdentity.externalId;

  if (Object.prototype.hasOwnProperty.call(patch, "status")) {
    const status = String(patch.status || "").trim().toLowerCase();

    if (!allowedStatuses.has(status)) {
      return res.status(400).json({ error: "invalid_status" });
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, "progress")) {
    const rawProgress = Number(patch.progress);
    next.progress = Number.isFinite(rawProgress)
      ? Math.max(0, Math.min(100, rawProgress))
      : 0;
  } else {
    next.progress = Math.max(0, Math.min(100, Number(prev.progress ?? 0)));
  }

  next.status = _normalizeLibraryStatus(
    Object.prototype.hasOwnProperty.call(patch, "status") ? patch.status : prev.status,
    next.type,
    next.progress,
    prev.status
  );

  if (Object.prototype.hasOwnProperty.call(patch, "cover")) {
    next.cover = String(patch.cover || "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(patch, "lastActivityAt")) {
    const normalizedLastActivityAt = _normalizeActivityCreatedAt(patch.lastActivityAt);

    if (!normalizedLastActivityAt) {
      return res.status(400).json({ error: "invalid_last_activity_at" });
    }

    next.lastActivityAt = normalizedLastActivityAt;
  }

  if (Object.prototype.hasOwnProperty.call(patch, "meta")) {
    if (patch.meta !== undefined) {
      if (typeof patch.meta !== "object" || Array.isArray(patch.meta)) {
        return res.status(400).json({ error: "invalid_meta" });
      }
    }

    if (patch.meta && typeof patch.meta === "object" && !Array.isArray(patch.meta)) {
      const sanitizedMeta = _sanitizeLibraryMeta(patch.meta);
      next.meta = {
        ...(prev.meta || {}),
        ...sanitizedMeta
      };

    } else {
      next.meta = { ...(prev.meta || {}) };
    }
  } else {
    next.meta = { ...(prev.meta || {}) };
  }

  const duplicate = bucket.library.find((it) => {
    if (String(it?.id) === id) return false;

    return _isSameLibraryIdentity(it, {
      title: next.title,
      type: next.type,
      source: next.source,
      externalId: next.externalId
    });
  });
  if (duplicate) {
    return res.status(409).json({ error: "duplicate_item" });
  }

  if (next.progress >= 100) {
    next.progress = 100;
    next.status = "completed";
  }

  const nextProgress = Math.max(0, Math.min(100, Number(next.progress ?? 0)));
  const nextCompleted = nextProgress >= 100 || next.status === "completed";
  const activityCreatedAt = _normalizeActivityCreatedAt(next.lastActivityAt) || nowIso;

  let activityType = "";

  if (shouldLogActivity) {
    if (!prevCompleted && nextCompleted) {
      activityType = "completed";
    } else if (nextProgress > 0 && nextProgress !== prevProgress) {
      activityType = "progress";
    }
  }

  if (activityType) {
    next.lastActivityAt = activityCreatedAt;
    const activityPayload = next.type === "serie"
      ? _normalizeActivityPayload(
        rawPatch?.activityPayload || {
          season: next?.meta?.season,
          episode: next?.meta?.episode
        }
      )
      : null;
    _appendUserActivity(bucket, {
      type: activityType,
      targetId: id,
      minutes: 20,
      createdAt: activityCreatedAt,
      payload: activityPayload
    });
  }

  bucket.library[idx] = next;
  _writeDb(db);

  res.json(next);
});

app.delete("/api/library/:id", _requireAuth, (req, res) => {
  const id = String(req.params.id);

  const db = _readDb();
  const bucket = _getUserBucket(db, req.session.userId);

  const idx = bucket.library.findIndex((it) => String(it.id) === id);
  if (idx === -1) {
    return res.status(404).json({ error: "not_found" });
  }

  bucket.library.splice(idx, 1);

  bucket.lists = Array.isArray(bucket.lists) ? bucket.lists : [];

  for (const list of bucket.lists) {
    const items = Array.isArray(list?.items) ? list.items : [];

    list.items = items.filter((entry) => {
      const entryId = typeof entry === "string" ? entry : entry?.id;
      return String(entryId) !== id;
    });

    list.itemsCount = list.items.length;
    list.updatedAt = new Date().toISOString();
  }

  _writeDb(db);

  res.json({ ok: true, deleted: 1 });
});

// ===== STATIC (sirve tu frontend) =====
// Importante: esto evita CORS y hace que cookies funcionen bien.
app.use(express.static(PROJECT_ROOT));

const PORT = Number.parseInt(
  process.env.PORT || "3000",
  10
);

if (
  !Number.isInteger(PORT) ||
  PORT < 1 ||
  PORT > 65535
) {
  const error = new Error(
    "PORT debe ser un número válido entre 1 y 65535."
  );

  error.code = "INVALID_PORT";

  throw error;
}

app.listen(PORT, () => {
  console.log(`Quacker server running: http://127.0.0.1:${PORT}`);
});
