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

  const allowedMetaKeys = new Set([
    "totalEpisodes",
    "totalSeasons",
    "totalPages",
    "totalChapters",
    "platform",
    "author"
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
        "author"
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