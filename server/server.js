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
  if (!email || !password || !name) {
    return res.status(400).json({ error: "missing_fields" });
  }

  const db = _readDb();

  // email único (dev)
  const existing = Object.entries(db.users).find(([, u]) => u?.profile?.email === email);
  if (existing) return res.status(409).json({ error: "email_in_use" });

  const userId = _uid();
  db.users[userId] = {
    profile: {
      id: userId,
      email,
      name,
      handle: "@user",
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
  if (!email || !password) return res.status(400).json({ error: "missing_fields" });

  const db = _readDb();
  const found = Object.entries(db.users).find(([, u]) => u?.profile?.email === email);

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
  const title = String(data.title || "").trim();
  const type = String(data.type || "pelicula");

  if (!title) return res.status(400).json({ error: "missing_title" });

  const db = _readDb();
  const bucket = _getUserBucket(db, req.session.userId);

  const nowIso = new Date().toISOString();

  const defaultStatus =
    type === "book" ? "reading" :
    type === "game" ? "playing" :
    type === "serie" ? "watching" :
    "watching";

  const item = {
    id: _uid(),
    type,
    title,
    status: defaultStatus,
    progress: Number(data.progress ?? 0) || 0,
    meta: (data.meta && typeof data.meta === "object") ? data.meta : {},
    cover: String(data.cover || ""),
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

  const db = _readDb();
  const bucket = _getUserBucket(db, req.session.userId);

  const idx = bucket.library.findIndex((it) => String(it.id) === id);
  if (idx === -1) return res.status(404).json({ error: "not_found" });

  const prev = bucket.library[idx];
  const nowIso = new Date().toISOString();

  const next = {
    ...prev,
    ...patch,
    meta: { ...(prev.meta || {}), ...(patch.meta || {}) },
    updatedAt: nowIso
  };

  // normalización mínima
  const pct = Math.max(0, Math.min(100, Number(next.progress ?? 0)));
  next.progress = pct;
  if (pct >= 100) next.status = "completed";

  bucket.library[idx] = next;
  _writeDb(db);

  // De momento ignoramos logActivity en backend (lo implementaremos cuando migremos Activities)
  res.json(next);
});

app.delete("/api/library/:id", _requireAuth, (req, res) => {
  const id = String(req.params.id);

  const db = _readDb();
  const bucket = _getUserBucket(db, req.session.userId);

  const before = bucket.library.length;
  bucket.library = bucket.library.filter((it) => String(it.id) !== id);
  _writeDb(db);

  res.json({ ok: true, deleted: before - bucket.library.length });
});

// ===== STATIC (sirve tu frontend) =====
// Importante: esto evita CORS y hace que cookies funcionen bien.
app.use(express.static(PROJECT_ROOT));

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Quacker server running: http://127.0.0.1:${PORT}`);
});