const crypto = require("crypto");
const path = require("path");
const fs = require("fs/promises");

const ROOT_DIR = path.join(__dirname, "..");

const dotenv = require("dotenv");
dotenv.config({ path: path.join(ROOT_DIR, ".env") });

const express = require("express");
const bcrypt = require("bcryptjs");
const cookieSession = require("cookie-session");
const rateLimit = require("express-rate-limit");
const multer = require("multer");

const { getDb, load, toPublicContent, update } = require("./lib/store");
const { getAssistantReply, sanitizeHistory } = require("./lib/ai-assistant");

const UPLOADS_DIR = process.env.CMS_UPLOADS_DIR
  ? path.resolve(process.env.CMS_UPLOADS_DIR)
  : path.join(ROOT_DIR, "public", "uploads");

function normalizeUrlPrefix(prefix) {
  if (!prefix) return "/uploads";
  let p = String(prefix).trim();
  if (!p) return "/uploads";
  if (!p.startsWith("/")) p = `/${p}`;
  if (p.endsWith("/")) p = p.slice(0, -1);
  return p || "/uploads";
}

const UPLOADS_URL_PREFIX = normalizeUrlPrefix(process.env.CMS_UPLOADS_URL_PREFIX || "/uploads");

function nowIso() {
  return new Date().toISOString();
}

function publicUser(user) {
  return { id: user.id, username: user.username, role: user.role, createdAt: user.createdAt };
}

function getUserFromRequest(req) {
  const userId = req.session?.userId;
  if (!userId) return null;
  return getDb().users.find((u) => u.id === userId) ?? null;
}

function requireAuth(req, res, next) {
  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  req.user = user;
  next();
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function toIntOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return null;
  return Math.round(num);
}

async function ensureDefaultAdminUser() {
  if (getDb().users.length > 0) return;

  const username = (process.env.CMS_ADMIN_USERNAME || "admin").trim();
  const password = process.env.CMS_ADMIN_PASSWORD || "admin123";
  const passwordHash = await bcrypt.hash(password, 10);

  const user = {
    id: crypto.randomUUID(),
    username,
    passwordHash,
    role: "admin",
    createdAt: nowIso(),
  };

  await update((db) => {
    db.users.push(user);
  });

  console.log(`[cms] Created default admin user: ${username}`);
  if (!process.env.CMS_ADMIN_PASSWORD) {
    console.warn('[cms] WARNING: Using default password "admin123". Set CMS_ADMIN_PASSWORD and change it immediately.');
  }
}

async function main() {
  await load();
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  await ensureDefaultAdminUser();

  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "2mb" }));

  const sessionSecret = process.env.CMS_SESSION_SECRET || crypto.randomBytes(32).toString("hex");
  if (!process.env.CMS_SESSION_SECRET) {
    console.warn("[cms] CMS_SESSION_SECRET not set. Generated a random secret (sessions will reset on restart).");
  }

  app.use(
    cookieSession({
      name: "l44cms",
      secret: sessionSecret,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" || process.env.CMS_COOKIE_SECURE === "true",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    }),
  );

  app.use(
    "/api/auth",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 50,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.get("/api/health", (req, res) => res.json({ ok: true }));

  // AI Assistant (public)
  app.use(
    "/api/assistant",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: Number(process.env.AI_ASSISTANT_MAX_REQUESTS || 40),
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.post("/api/assistant/chat", async (req, res) => {
    if (process.env.AI_ASSISTANT_ENABLED === "false") {
      return res.status(404).json({ error: "Not Found" });
    }

    const { message, history } = req.body ?? {};
    if (!isNonEmptyString(message)) return res.status(400).json({ error: "Message is required" });

    const trimmed = message.trim();
    if (trimmed.length > 2000) return res.status(400).json({ error: "Message is too long" });

    try {
      const reply = await getAssistantReply({
        message: trimmed,
        history: sanitizeHistory(history),
        siteData: toPublicContent(),
      });
      return res.json({ reply });
    } catch (err) {
      const code = err?.code ? String(err.code) : "";
      if (code === "AI_NOT_CONFIGURED") {
        return res.status(503).json({ error: "AI assistant is not configured" });
      }

      console.error("[cms] AI assistant error:", err);
      return res.status(502).json({ error: "AI assistant request failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body ?? {};
    if (!isNonEmptyString(username) || typeof password !== "string") {
      return res.status(400).json({ error: "Invalid request" });
    }

    const normalized = username.trim().toLowerCase();
    const user = getDb().users.find((u) => u.username.trim().toLowerCase() === normalized) ?? null;
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    req.session.userId = user.id;
    return res.json({ user: publicUser(user) });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session = null;
    return res.json({ ok: true });
  });

  app.get("/api/auth/me", (req, res) => {
    const user = getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    return res.json({ user: publicUser(user) });
  });

  app.post("/api/users/me/password", requireAuth, async (req, res) => {
    const { currentPassword, newPassword } = req.body ?? {};
    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      return res.status(400).json({ error: "Invalid request" });
    }
    if (newPassword.trim().length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const user = req.user;
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Current password is incorrect" });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await update((db) => {
      const target = db.users.find((u) => u.id === user.id);
      if (!target) return;
      target.passwordHash = passwordHash;
    });

    return res.json({ ok: true });
  });

  // Public content (read-only)
  app.get("/api/content", (req, res) => res.json(toPublicContent()));
  app.get("/api/menu", (req, res) => res.json(getDb().menu));
  app.get("/api/events", (req, res) => res.json(getDb().events));
  app.get("/api/gallery", (req, res) => res.json(getDb().gallery));

  // Menu (CRUD)
  app.post("/api/menu", requireAuth, async (req, res) => {
    const { name, description, price, category, tags, imageUrl, featured } = req.body ?? {};
    if (!isNonEmptyString(name)) return res.status(400).json({ error: "Name is required" });

    const item = {
      id: crypto.randomUUID(),
      name: name.trim(),
      description: isNonEmptyString(description) ? description.trim() : "",
      price: toIntOrNull(price),
      category: isNonEmptyString(category) ? category.trim() : "General",
      tags: Array.isArray(tags) ? tags.filter(isNonEmptyString).map((t) => t.trim()) : [],
      imageUrl: isNonEmptyString(imageUrl) ? imageUrl.trim() : "",
      featured: Boolean(featured),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    await update((db) => {
      db.menu.unshift(item);
    });

    return res.status(201).json(item);
  });

  app.put("/api/menu/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    const { name, description, price, category, tags, imageUrl, featured } = req.body ?? {};

    await update((db) => {
      const item = db.menu.find((m) => m.id === id);
      if (!item) return;
      if (isNonEmptyString(name)) item.name = name.trim();
      if (typeof description === "string") item.description = description.trim();
      if (price !== undefined) item.price = toIntOrNull(price);
      if (typeof category === "string" && category.trim()) item.category = category.trim();
      if (Array.isArray(tags)) item.tags = tags.filter(isNonEmptyString).map((t) => t.trim());
      if (typeof imageUrl === "string") item.imageUrl = imageUrl.trim();
      if (featured !== undefined) item.featured = Boolean(featured);
      item.updatedAt = nowIso();
    });

    const updated = getDb().menu.find((m) => m.id === id);
    if (!updated) return res.status(404).json({ error: "Not found" });
    return res.json(updated);
  });

  app.delete("/api/menu/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    const before = getDb().menu.length;
    await update((db) => {
      db.menu = db.menu.filter((m) => m.id !== id);
    });
    const after = getDb().menu.length;
    if (before === after) return res.status(404).json({ error: "Not found" });
    return res.json({ ok: true });
  });

  // Events (CRUD)
  app.post("/api/events", requireAuth, async (req, res) => {
    const { title, description, date, time, price, category, imageUrl, featured } = req.body ?? {};
    if (!isNonEmptyString(title)) return res.status(400).json({ error: "Title is required" });

    const item = {
      id: crypto.randomUUID(),
      title: title.trim(),
      description: isNonEmptyString(description) ? description.trim() : "",
      date: isNonEmptyString(date) ? date.trim() : "",
      time: isNonEmptyString(time) ? time.trim() : "",
      price: toIntOrNull(price),
      category: isNonEmptyString(category) ? category.trim() : "General",
      imageUrl: isNonEmptyString(imageUrl) ? imageUrl.trim() : "",
      featured: Boolean(featured),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    await update((db) => {
      db.events.unshift(item);
    });

    return res.status(201).json(item);
  });

  app.put("/api/events/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    const { title, description, date, time, price, category, imageUrl, featured } = req.body ?? {};

    await update((db) => {
      const item = db.events.find((e) => e.id === id);
      if (!item) return;
      if (isNonEmptyString(title)) item.title = title.trim();
      if (typeof description === "string") item.description = description.trim();
      if (typeof date === "string") item.date = date.trim();
      if (typeof time === "string") item.time = time.trim();
      if (price !== undefined) item.price = toIntOrNull(price);
      if (typeof category === "string" && category.trim()) item.category = category.trim();
      if (typeof imageUrl === "string") item.imageUrl = imageUrl.trim();
      if (featured !== undefined) item.featured = Boolean(featured);
      item.updatedAt = nowIso();
    });

    const updated = getDb().events.find((e) => e.id === id);
    if (!updated) return res.status(404).json({ error: "Not found" });
    return res.json(updated);
  });

  app.delete("/api/events/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    const before = getDb().events.length;
    await update((db) => {
      db.events = db.events.filter((e) => e.id !== id);
    });
    const after = getDb().events.length;
    if (before === after) return res.status(404).json({ error: "Not found" });
    return res.json({ ok: true });
  });

  // Gallery (CRUD)
  app.post("/api/gallery", requireAuth, async (req, res) => {
    const { title, subtitle, category, imageUrl } = req.body ?? {};
    if (!isNonEmptyString(title)) return res.status(400).json({ error: "Title is required" });
    if (!isNonEmptyString(imageUrl)) return res.status(400).json({ error: "Image URL is required" });

    const item = {
      id: crypto.randomUUID(),
      title: title.trim(),
      subtitle: isNonEmptyString(subtitle) ? subtitle.trim() : "",
      category: isNonEmptyString(category) ? category.trim() : "dining",
      imageUrl: imageUrl.trim(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    await update((db) => {
      db.gallery.unshift(item);
    });

    return res.status(201).json(item);
  });

  app.put("/api/gallery/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    const { title, subtitle, category, imageUrl } = req.body ?? {};

    await update((db) => {
      const item = db.gallery.find((g) => g.id === id);
      if (!item) return;
      if (isNonEmptyString(title)) item.title = title.trim();
      if (typeof subtitle === "string") item.subtitle = subtitle.trim();
      if (typeof category === "string" && category.trim()) item.category = category.trim();
      if (typeof imageUrl === "string" && imageUrl.trim()) item.imageUrl = imageUrl.trim();
      item.updatedAt = nowIso();
    });

    const updated = getDb().gallery.find((g) => g.id === id);
    if (!updated) return res.status(404).json({ error: "Not found" });
    return res.json(updated);
  });

  app.delete("/api/gallery/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    const before = getDb().gallery.length;
    await update((db) => {
      db.gallery = db.gallery.filter((g) => g.id !== id);
    });
    const after = getDb().gallery.length;
    if (before === after) return res.status(404).json({ error: "Not found" });
    return res.json({ ok: true });
  });

  // Reservations (public submit, admin list)
  app.post("/api/reservations", async (req, res) => {
    const { name, phone, email, date, time, partySize, area, requests } = req.body ?? {};
    if (!isNonEmptyString(name)) return res.status(400).json({ error: "Name is required" });
    if (!isNonEmptyString(phone)) return res.status(400).json({ error: "Phone is required" });
    if (!isNonEmptyString(date)) return res.status(400).json({ error: "Date is required" });
    if (!isNonEmptyString(time)) return res.status(400).json({ error: "Time is required" });

    const reservation = {
      id: crypto.randomUUID(),
      name: name.trim(),
      phone: phone.trim(),
      email: typeof email === "string" ? email.trim() : "",
      date: date.trim(),
      time: time.trim(),
      partySize: toIntOrNull(partySize),
      area: typeof area === "string" ? area.trim() : "",
      requests: typeof requests === "string" ? requests.trim() : "",
      status: "new",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    await update((db) => {
      db.reservations.unshift(reservation);
    });

    return res.status(201).json({ ok: true, reservationId: reservation.id });
  });

  app.get("/api/reservations", requireAuth, (req, res) => {
    return res.json(getDb().reservations);
  });

  app.patch("/api/reservations/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body ?? {};
    const allowed = new Set(["new", "confirmed", "cancelled", "completed"]);
    if (status !== undefined && (!isNonEmptyString(status) || !allowed.has(status))) {
      return res.status(400).json({ error: "Invalid status" });
    }

    await update((db) => {
      const item = db.reservations.find((r) => r.id === id);
      if (!item) return;
      if (status) item.status = status;
      item.updatedAt = nowIso();
    });

    const updated = getDb().reservations.find((r) => r.id === id);
    if (!updated) return res.status(404).json({ error: "Not found" });
    return res.json(updated);
  });

  // Uploads
  const upload = multer({
    storage: multer.diskStorage({
      destination: async (req, file, cb) => {
        try {
          await fs.mkdir(UPLOADS_DIR, { recursive: true });
          cb(null, UPLOADS_DIR);
        } catch (err) {
          cb(err);
        }
      },
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || "").toLowerCase();
        const safeExt = ext && ext.length <= 10 ? ext : "";
        cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${safeExt}`);
      },
    }),
    limits: { fileSize: 25 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const ok = file.mimetype?.startsWith("image/") || file.mimetype?.startsWith("video/");
      cb(ok ? null : new Error("Only images/videos are allowed"), ok);
    },
  });

  app.post("/api/uploads", requireAuth, upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    return res.status(201).json({ url: `${UPLOADS_URL_PREFIX}/${req.file.filename}` });
  });

  // Settings update (simple)
  app.put("/api/settings", requireAuth, async (req, res) => {
    const { settings } = req.body ?? {};
    if (!settings || typeof settings !== "object") return res.status(400).json({ error: "Invalid request" });

    await update((db) => {
      db.settings = { ...db.settings, ...settings };
    });

    return res.json(getDb().settings);
  });

  // Static assets
  app.use(UPLOADS_URL_PREFIX, express.static(UPLOADS_DIR));
  app.use("/public/uploads", express.static(UPLOADS_DIR));
  app.use("/admin", express.static(path.join(ROOT_DIR, "admin")));
  app.use("/js", express.static(path.join(ROOT_DIR, "js")));
  app.use("/css", express.static(path.join(ROOT_DIR, "css")));
  app.use("/pages", express.static(path.join(ROOT_DIR, "pages")));
  app.use("/public", express.static(path.join(ROOT_DIR, "public")));

  // Root index
  app.get("/", (req, res) => res.sendFile(path.join(ROOT_DIR, "index.html")));

  // Allow a limited set of root-level files (images/videos/etc.) without exposing project internals.
  app.get("/:file", async (req, res, next) => {
    const file = req.params.file;
    if (!file || file.includes("/") || file.includes("\\") || file.includes("..")) return next();

    const blocked = new Set([
      "package.json",
      "package-lock.json",
      "tailwind.config.js",
      "README.md",
      "LICENSE",
    ]);
    if (blocked.has(file)) return next();

    const ext = path.extname(file).toLowerCase();
    const allowedExts = new Set([".html", ".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".mp4", ".ico"]);
    if (!allowedExts.has(ext)) return next();

    try {
      const fullPath = path.join(ROOT_DIR, file);
      const stat = await fs.stat(fullPath);
      if (!stat.isFile()) return next();
      return res.sendFile(fullPath);
    } catch {
      return next();
    }
  });

  // 404
  app.use((req, res) => res.status(404).send("Not Found"));

  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => {
    console.log(`[cms] Running at http://localhost:${port}`);
    console.log(`[cms] Admin: http://localhost:${port}/admin/`);
  });
}

main().catch((err) => {
  console.error("[cms] Fatal error:", err);
  process.exit(1);
});
