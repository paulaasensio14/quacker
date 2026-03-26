import express from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { searchTmdb, getTmdbDetail } from "./adapters/tmdb.js";
import { searchGoogleBooks, getGoogleBookDetail } from "./adapters/google-books.js";
import { searchRawg, getRawgDetail } from "./adapters/rawg.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Raíz del proyecto = carpeta padre de /server
const PROJECT_ROOT = path.resolve(__dirname, "..");
const DB_PATH = path.join(__dirname, "db.json");

const app = express();

// ===== DEBUG SESIÓN (DEV) =====
// Loguea si llega cookie, cuál es el sessionID y si hay userId en la sesión.
// Esto nos dirá si el problema es: (a) cookie no llega, (b) session store se pierde, (c) userId desaparece.
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

app.use(
  session({
    secret: "quacker-dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax"
      // secure: true  // solo si usas https
    }
  })
);

app.use((req, _res, next) => {
  const isApi = req.path.startsWith("/api/");
  if (!isApi) return next();

  const sid = req.sessionID || null;
  const uid = req.session?.userId || null;

  // Ojo: no imprimimos la cookie completa por seguridad, solo si existe
  const hasCookieHeader = !!req.headers.cookie;
  const hasConnectSid = typeof req.headers.cookie === "string" && req.headers.cookie.includes("connect.sid=");

  console.log(
    `[DEV][${new Date().toISOString()}] ${req.method} ${req.path} | sid=${sid} uid=${uid} cookieHeader=${hasCookieHeader} connectSid=${hasConnectSid}`
  );

  next();
});

// ===== Helpers DB =====
function _readDb() {
  if (!fs.existsSync(DB_PATH)) {
    const init = { users: {} };
    fs.writeFileSync(DB_PATH, JSON.stringify(init, null, 2), "utf-8");
    return init;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
  } catch {
    const init = { users: {} };
    fs.writeFileSync(DB_PATH, JSON.stringify(init, null, 2), "utf-8");
    return init;
  }
}

function _writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

function _uid() {
  return `u_${Date.now()}_${Math.random().toString(16).slice(2)}`;
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
    lists: []
  };

  db.users[userId].library = Array.isArray(db.users[userId].library)
    ? db.users[userId].library
    : [];

  db.users[userId].lists = Array.isArray(db.users[userId].lists)
    ? db.users[userId].lists
    : [];

  return db.users[userId];
}

// ===== API BASE =====
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// ===== AUTH =====
app.post("/api/auth/register", (req, res) => {
  const { email, password, name } = req.body || {};
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail || !password || !name) {
    return res.status(400).json({ error: "missing_fields" });
  }
  const db = _readDb();
  // email único (dev)
  const existing = Object.entries(db.users).find(([, u]) => String(u?.profile?.email || "").trim().toLowerCase() === normalizedEmail);

  if (existing) return res.status(409).json({ error: "email_in_use" });

  const userId = _uid();
  db.users[userId] = {
    profile: {
      id: userId,
      email: normalizedEmail,
      name,
      handle: "@" + String(email).split("@")[0].trim().toLowerCase(),
      language: "es",
      theme: "light"
    },
    // NOTA: en backend real aquí irán también lists/activities/notifications...
    library: []
  };

  _writeDb(db);

  req.session.userId = userId;

  // IMPORTANTE: asegurar que la sesión se guarda antes de responder
  req.session.save((err) => {
    if (err) return res.status(500).json({ error: "session_save_failed" });
    res.json({ user: db.users[userId].profile });
  });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail || !password) return res.status(400).json({ error: "missing_fields" });
  const db = _readDb();
  const found = Object.entries(db.users).find(([, u]) => String(u?.profile?.email || "").trim().toLowerCase() === normalizedEmail);

  // DEV: no validamos password de verdad (solo para levantar pipeline)
  if (!found) return res.status(401).json({ error: "invalid_credentials" });

  const [userId] = found;
  req.session.userId = userId;

  // IMPORTANTE: asegurar que la sesión se guarda antes de responder
  req.session.save((err) => {
    if (err) return res.status(500).json({ error: "session_save_failed" });
    res.json({ user: db.users[userId].profile });
  });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
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

  const title = _normalizeExploreQueryText(item?.title);
  const author = _normalizeExploreQueryText(item?.meta?.author);
  const summary = _normalizeExploreQueryText(item?.summary);
  const tokens = _tokenizeExploreQuery(q);

  const normalizedTitle = normalize(title);
  const normalizedQuery = normalize(query);

  const queryWords = normalizedQuery.split(" ").filter(Boolean);

  // FILTRO DURO: al menos una palabra completa debe aparecer
  const hasStrongMatch = queryWords.some(word =>
    normalizedTitle.split(" ").includes(word)
  );

  if (!hasStrongMatch) {
    return 0;
  }

  // Exact match boost
  if (normalizedTitle === normalizedQuery) {
    score += 100;
  }

  // Starts with query
  if (normalizedTitle.startsWith(normalizedQuery)) {
    score += 40;
  }

  // All words match
  if (queryWords.every(word => normalizedTitle.includes(word))) {
    score += 30;
  }

  const matchedTitleTokens = tokens.filter((token) => title.includes(token));
  const missingTitleTokens = tokens.filter((token) => !title.includes(token));

  const titleStartsWithQuery = title.startsWith(q);
  const titleEqualsQuery = title === q;
  const titleContainsQuery = title.includes(q);

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
      coreMatchConfidence += 120;
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

  // boost si es exactamente la franquicia (muy importante)
  if (title === q) {
    score += 200;
  }

  if (/logic|explained|analysis|review|recap|summary|ending|theory/i.test(title)) {
    coreMatchConfidence -= 120;
  }

  score += coreMatchConfidence;

  // EXACT MATCH DOMINANTE
  if (titleEqualsQuery) {
    score += 1000;
  } else if (titleStartsWithQuery) {
    score += 220;
  } else if (titleContainsQuery) {
    score += 60;
  }

  // COBERTURA COMPLETA DEL QUERY EN TITLE
  if (tokens.length > 0 && matchedTitleTokens.length === tokens.length) {
    score += 220;
  } else if (matchedTitleTokens.length >= Math.max(1, tokens.length - 1)) {
    score += 70;
  }

  // PENALIZAR MATCHES PARCIALES
  if (missingTitleTokens.length > 0) {
    score -= missingTitleTokens.length * 22;
  }

  // TOKEN SIGNALS
  for (const token of tokens) {
    if (title.includes(token)) score += 14;
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
  } else if (item?.source === "google_books") {
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

  if (item?.source === "google_books") {
    score += Math.min(8, Math.floor(Math.log10(Math.max(1, ratingCount))) * 3);
  }

  // TYPE INTENT BOOST (suave, no dominante)

  let typeIntent = null;

  if (q.includes("game") || q.includes("elden") || q.includes("witcher 3")) {
    typeIntent = "game";
  } else if (q.includes("book") || q.includes("novel")) {
    typeIntent = "book";
  } else {
    typeIntent = "movie";
  }

  if (typeIntent === "movie") {
    if (item.type === "movie") score += 8;
    if (item.type === "series") score += 4;
    if (item.type === "game") score -= 3;
  }

  if (typeIntent === "game") {
    if (item.type === "game") score += 10;
    if (item.type === "movie") score -= 3;
  }

  if (typeIntent === "book") {
    if (item.type === "book") score += 8;
  }

  return score;
}

function _rankAndMixExploreItems(
  query,
  tmdbItems = [],
  googleBooksItems = [],
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

  const deduped = [...tmdbItems, ...googleBooksItems, ...rawgItems].filter((item) => {
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
    eid: "ex_001",
    type: "serie",
    title: "Shogun",
    releaseDate: "2024-02-27",
    summary: "Drama histórico con estética muy cuidada y ritmo contenido."
  },
  {
    eid: "ex_002",
    type: "pelicula",
    title: "Dune: Part Two",
    releaseDate: "2024-03-01",
    summary: "Ciencia ficción épica, gran escala y producción muy sólida."
  },
  {
    eid: "ex_003",
    type: "book",
    title: "Project Hail Mary",
    releaseDate: "2021-05-04",
    summary: "Ciencia ficción accesible, humor y misterio científico."
  },
  {
    eid: "ex_004",
    type: "game",
    title: "Baldur's Gate 3",
    releaseDate: "2023-08-03",
    summary: "RPG enorme, decisiones con impacto y combate por turnos pulido."
  },
  {
    eid: "ex_005",
    type: "serie",
    title: "Arcane",
    releaseDate: "2021-11-06",
    summary: "Animación premium, música potente y narrativa muy emocional."
  },
  {
    eid: "ex_006",
    type: "pelicula",
    title: "Spider-Man: Across the Spider-Verse",
    releaseDate: "2023-06-02",
    summary: "Animación experimental, ritmo alto y diseño visual increíble."
  },
  {
    eid: "ex_007",
    type: "serie",
    title: "Severance",
    releaseDate: "2022-02-18",
    summary: "Thriller corporativo con misterio y una identidad visual muy marcada."
  },
  {
    eid: "ex_008",
    type: "serie",
    title: "The Bear",
    releaseDate: "2022-06-23",
    summary: "Cocina, caos y personajes intensos con ritmo rápido."
  },
  {
    eid: "ex_009",
    type: "serie",
    title: "Silo",
    releaseDate: "2023-05-05",
    summary: "Ciencia ficción con misterio, mundo cerrado y tensión creciente."
  },
  {
    eid: "ex_010",
    type: "serie",
    title: "The Last of Us",
    releaseDate: "2023-01-15",
    summary: "Drama postapocalíptico con foco en relación y supervivencia."
  },
  {
    eid: "ex_011",
    type: "pelicula",
    title: "Oppenheimer",
    releaseDate: "2023-07-21",
    summary: "Biografía densa con gran montaje y tensión sostenida."
  },
  {
    eid: "ex_012",
    type: "pelicula",
    title: "Poor Things",
    releaseDate: "2023-12-08",
    summary: "Fábula surreal con estética potente y humor oscuro."
  },
  {
    eid: "ex_013",
    type: "pelicula",
    title: "The Zone of Interest",
    releaseDate: "2023-12-15",
    summary: "Terror cotidiano contado desde la distancia y el sonido."
  },
  {
    eid: "ex_014",
    type: "pelicula",
    title: "Past Lives",
    releaseDate: "2023-06-02",
    summary: "Drama íntimo sobre decisiones, tiempo y conexiones."
  },
  {
    eid: "ex_015",
    type: "pelicula",
    title: "Barbie",
    releaseDate: "2023-07-21",
    summary: "Comedia y sátira con diseño de producción muy cuidado."
  },
  {
    eid: "ex_016",
    type: "book",
    title: "The Three-Body Problem",
    releaseDate: "2008-01-01",
    summary: "Ciencia ficción de ideas grandes, escala histórica y misterio."
  },
  {
    eid: "ex_017",
    type: "book",
    title: "Klara and the Sun",
    releaseDate: "2021-03-02",
    summary: "Reflexión suave sobre humanidad, amor y observación."
  },
  {
    eid: "ex_018",
    type: "book",
    title: "Tomorrow, and Tomorrow, and Tomorrow",
    releaseDate: "2022-07-05",
    summary: "Amistad, creatividad y videojuegos como hilo emocional."
  },
  {
    eid: "ex_019",
    type: "book",
    title: "The Name of the Wind",
    releaseDate: "2007-03-27",
    summary: "Fantasía con narrador carismático y mundo muy detallado."
  },
  {
    eid: "ex_020",
    type: "book",
    title: "Atomic Habits",
    releaseDate: "2018-10-16",
    summary: "Hábitos y sistemas con enfoque práctico y simple."
  },
  {
    eid: "ex_021",
    type: "game",
    title: "Hades",
    releaseDate: "2020-09-17",
    summary: "Roguelite ágil con narrativa integrada y combate muy pulido."
  },
  {
    eid: "ex_022",
    type: "game",
    title: "Elden Ring",
    releaseDate: "2022-02-25",
    summary: "Exploración libre, combate exigente y mundo enorme."
  },
  {
    eid: "ex_023",
    type: "game",
    title: "Cyberpunk 2077",
    releaseDate: "2020-12-10",
    summary: "RPG urbano con narrativa y estilo visual muy marcados."
  },
  {
    eid: "ex_024",
    type: "game",
    title: "The Legend of Zelda: Tears of the Kingdom",
    releaseDate: "2023-05-12",
    summary: "Creatividad, exploración y sistemas emergentes a gran escala."
  },
  {
    eid: "ex_025",
    type: "game",
    title: "Disco Elysium",
    releaseDate: "2019-10-15",
    summary: "RPG narrativo con decisiones, diálogos y tono único."
  },
  {
    eid: "ex_026",
    type: "serie",
    title: "True Detective",
    releaseDate: "2014-01-12",
    summary: "Investigación oscura, atmósfera densa y personajes complejos."
  }
];

app.get("/api/explore", _requireAuth, async (req, res) => {
  res.set("Cache-Control", "no-store");
  const q = String(req.query.q || "").trim();

  try {
    if (q) {
      const [tmdbResult, googleBooksResult, rawgResult] = await Promise.allSettled([
        searchTmdb(q),
        searchGoogleBooks(q),
        searchRawg(q)
      ]);

      if (tmdbResult.status === "rejected") {
        console.error("[/api/explore] TMDB search failed:", tmdbResult.reason);
      }

      if (googleBooksResult.status === "rejected") {
        console.error("[/api/explore] Google Books search failed:", googleBooksResult.reason);
      }

      if (rawgResult.status === "rejected") {
        console.error("[/api/explore] RAWG search failed:", rawgResult.reason);
      }

      const tmdbItems =
        tmdbResult.status === "fulfilled" && Array.isArray(tmdbResult.value)
          ? tmdbResult.value
          : [];

      const googleBooksItems =
        googleBooksResult.status === "fulfilled" && Array.isArray(googleBooksResult.value)
          ? googleBooksResult.value
          : [];

      const rawgItems =
      rawgResult.status === "fulfilled" && Array.isArray(rawgResult.value)
        ? rawgResult.value
        : [];
        
      const rankedItems = _rankAndMixExploreItems(q, tmdbItems, googleBooksItems, rawgItems);

      return res.json({
        items: rankedItems,
        debug: {
          tmdb: {
            status: tmdbResult.status,
            count: tmdbItems.length,
            error:
              tmdbResult.status === "rejected"
                ? String(tmdbResult.reason?.message || tmdbResult.reason)
                : null
          },
          googleBooks: {
            status: googleBooksResult.status,
            count: googleBooksItems.length,
            error:
              googleBooksResult.status === "rejected"
                ? String(googleBooksResult.reason?.message || googleBooksResult.reason)
                : null
          },
          rawg: {
            status: rawgResult.status,
            count: rawgItems.length,
            error:
              rawgResult.status === "rejected"
                ? String(rawgResult.reason?.message || rawgResult.reason)
                : null
          }
        }
      });
    }
    const db = _readDb();
    const bucket = _getUserBucket(db, req.session.userId);

    const fallbackItems = (bucket.library || []).map((item) => ({
      eid: item?.id ? `library:${String(item.id)}` : _uid(),
      source: "library",
      externalId: item?.id ? String(item.id) : "",
      type: String(item?.type || "").trim(),
      title: String(item?.title || "").trim(),
      year: item?.meta?.year || null,
      cover: String(item?.cover || "").trim(),
      description: "",
      meta: item?.meta || {}
    }));

    return res.json({ items: fallbackItems });
  } catch (err) {
    console.error("GET /api/explore error", err);
    return res.status(err?.status || 500).json({
      error: err?.message || "explore_fetch_failed"
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

    if (source === "google_books") {
      const item = await getGoogleBookDetail(externalId);
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
    "theme"
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
    const safeName = String(safePatch.name || "").replace(/\s+/g, " ").trim();
    if (!safeName || safeName.length < 2) {
      return res.status(400).json({ error: "invalid_name" });
    }
    safePatch.name = safeName;
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
    const safeEmail = String(safePatch.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) {
      return res.status(400).json({ error: "invalid_email" });
    }
    safePatch.email = safeEmail;
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

  bucket.profile = {
    ...(bucket.profile || {}),
    ...safePatch
  };

  _writeDb(db);

  res.json({ user: bucket.profile });
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

  if (!itemId) return res.status(400).json({ error: "missing_item_id" });

  const db = _readDb();
  const bucket = _getUserBucket(db, req.session.userId);

  const list = bucket.lists.find((x) => String(x.id) === listId);
  if (!list) return res.status(404).json({ error: "list_not_found" });

  const libraryItem = bucket.library.find((x) => String(x.id) === itemId);
  if (!libraryItem) return res.status(404).json({ error: "item_not_found" });

  list.items = Array.isArray(list.items) ? list.items : [];

  const already = list.items.some((entry) => {
    const id = typeof entry === "string" ? entry : entry?.id;
    return String(id) === itemId;
  });

  if (already) {
    return res.json({ ok: true, already: true, listId, itemId });
  }

  list.items.push({
    id: itemId,
    addedAt: new Date().toISOString()
  });
  list.itemsCount = list.items.length;
  list.updatedAt = new Date().toISOString();

  _writeDb(db);
  res.json({ ok: true, listId, itemId });
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

  list.itemsCount = list.items.length;
  list.updatedAt = new Date().toISOString();

  _writeDb(db);
  res.json({ ok: true, removed: before - list.items.length });
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

app.post("/api/library", _requireAuth, (req, res) => {
  const data = req.body || {};
  const title = String(data.title || "").replace(/\s+/g, " ").trim();
  const type = String(data.type || "pelicula").trim().toLowerCase();

  const allowedTypes = new Set(["serie", "pelicula", "book", "game"]);

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

  const rawProgress = Number(data.progress ?? 0);
  const progress = Number.isFinite(rawProgress)
    ? Math.max(0, Math.min(100, rawProgress))
    : 0;
  
  const db = _readDb();
  const bucket = _getUserBucket(db, req.session.userId);

  const normalizedTitle = title.toLocaleLowerCase("es").trim();
  const duplicate = bucket.library.find((it) => {
    const currentTitle = String(it?.title || "").replace(/\s+/g, " ").trim().toLocaleLowerCase("es");
    const currentType = String(it?.type || "").trim();
    return currentTitle === normalizedTitle && currentType === type;
  });
  if (duplicate) {
    return res.status(409).json({ error: "duplicate_item" });
  }

  const allowedMetaKeys = new Set([
    "totalEpisodes",
    "totalSeasons",
    "totalPages",
    "totalChapters",
    "platform",
    "author",
    "season",
    "episode",
    "pagesRead",
    "seasonBreakdown"
  ]);

  const sanitizedMeta = {};
  if (data.meta && typeof data.meta === "object" && !Array.isArray(data.meta)) {
    for (const key of Object.keys(data.meta)) {
      if (allowedMetaKeys.has(key)) {
        sanitizedMeta[key] = data.meta[key];
      }
    }
  }

  const nowIso = new Date().toISOString();

  const defaultStatus =
    type === "book" ? "reading" :
    type === "game" ? "playing" :
    type === "serie" ? "watching" :
    "watching";

  let safeProgress = Number(progress);
  if (!Number.isFinite(safeProgress)) safeProgress = 0;
  safeProgress = Math.max(0, Math.min(100, safeProgress));

  delete data.status;
  
  const item = {
    id: _uid(),
    type,
    title: String(title).replace(/\s+/g, " ").trim(),
    status: defaultStatus,
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
  const patch = req.body || {};

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: "empty_patch" });
  }

  const allowedPatchFields = new Set([
    "title",
    "type",
    "status",
    "progress",
    "meta",
    "cover"
  ]);

  for (const key of Object.keys(patch)) {
    if (!allowedPatchFields.has(key)) {
      delete patch[key];
    }
  }

  const allowedTypes = new Set(["serie", "pelicula", "book", "game"]);
  const allowedStatuses = new Set([
    "pending",
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

  const next = { ...prev, ...patch, id: prev.id, createdAt: prev.createdAt, updatedAt: new Date().toISOString() };

  if (Object.prototype.hasOwnProperty.call(patch, "title")) {
    const title = String(patch.title || "").replace(/\s+/g, " ").trim();

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

  if (Object.prototype.hasOwnProperty.call(patch, "status")) {
    const status = String(patch.status || "").trim();

    if (!allowedStatuses.has(status)) {
      return res.status(400).json({ error: "invalid_status" });
    }

    next.status = status;
  }

  if (Object.prototype.hasOwnProperty.call(patch, "progress")) {
    const rawProgress = Number(patch.progress);
    next.progress = Number.isFinite(rawProgress)
      ? Math.max(0, Math.min(100, rawProgress))
      : 0;
  } else {
    next.progress = Math.max(0, Math.min(100, Number(prev.progress ?? 0)));
  }

  if (Object.prototype.hasOwnProperty.call(patch, "cover")) {
    next.cover = String(patch.cover || "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(patch, "meta")) {
    if (patch.meta !== undefined) {
      if (typeof patch.meta !== "object" || Array.isArray(patch.meta)) {
        return res.status(400).json({ error: "invalid_meta" });
      }
    }

    if (patch.meta && typeof patch.meta === "object" && !Array.isArray(patch.meta)) {

    const allowedMetaKeys = new Set([
      "totalEpisodes",
      "totalSeasons",
      "totalPages",
      "totalChapters",
      "platform",
      "author",
      "season",
      "episode",
      "pagesRead",
      "seasonBreakdown"
    ]);

      const sanitizedMeta = {};

      for (const key of Object.keys(patch.meta)) {
        if (allowedMetaKeys.has(key)) {
          sanitizedMeta[key] = patch.meta[key];
        }
      }

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

  const normalizedNextTitle = String(next.title || "").replace(/\s+/g, " ").trim().toLocaleLowerCase("es");
  const duplicate = bucket.library.find((it) => {
    if (String(it?.id) === id) return false;
    const currentTitle = String(it?.title || "").replace(/\s+/g, " ").trim().toLocaleLowerCase("es");
    const currentType = String(it?.type || "").trim();
    return currentTitle === normalizedNextTitle && currentType === String(next.type || "").trim();
  });
  if (duplicate) {
    return res.status(409).json({ error: "duplicate_item" });
  }

  if (next.progress >= 100) {
    next.progress = 100;
    next.status = "completed";
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

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Quacker server running: http://127.0.0.1:${PORT}`);
});