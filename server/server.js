import express from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

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
  db.users[userId] = db.users[userId] || { profile: null, library: [] };
  db.users[userId].library = Array.isArray(db.users[userId].library) ? db.users[userId].library : [];
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

app.get("/api/explore", _requireAuth, (_req, res) => {
  res.json({ items: EXPLORE_FEED });
});

app.get("/api/explore", _requireAuth, (_req, res) => {
  res.json({ items: EXPLORE_FEED });
});

// ===== USER (mínimo) =====
app.get("/api/user", _requireAuth, (req, res) => {
  const db = _readDb();
  const bucket = _getUserBucket(db, req.session.userId);
  res.json(bucket.profile);
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
    "pagesRead"
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
        "pagesRead"
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