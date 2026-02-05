const fs = require("fs/promises");
const path = require("path");

const repoDataDir = path.join(__dirname, "..", "data");
const seedDbPath = path.join(repoDataDir, "db.json");

const dataDir = process.env.CMS_DATA_DIR ? path.resolve(process.env.CMS_DATA_DIR) : repoDataDir;
const dbPath = process.env.CMS_DB_PATH ? path.resolve(process.env.CMS_DB_PATH) : path.join(dataDir, "db.json");

const DEFAULT_DB = {
  version: 1,
  settings: {
    siteName: "Lounge 44",
    currency: "UGX",
    contactPhone: "+256 700 123 456",
    contactEmail: "info@lounge44.ug",
    address: "Kyengera Town, Wakiso District, Uganda",
    openingHours: "Mon-Thu: 5:00 PM - 12:00 AM; Fri-Sun: 5:00 PM - 2:00 AM",
  },
  menu: [],
  events: [],
  gallery: [],
  reservations: [],
  users: [],
};

let db = null;
let writeChain = Promise.resolve();

function normalizeDb(input) {
  const parsed = input && typeof input === "object" ? input : {};
  return {
    ...DEFAULT_DB,
    ...parsed,
    settings: { ...DEFAULT_DB.settings, ...(parsed.settings ?? {}) },
    menu: Array.isArray(parsed.menu) ? parsed.menu : [],
    events: Array.isArray(parsed.events) ? parsed.events : [],
    gallery: Array.isArray(parsed.gallery) ? parsed.gallery : [],
    reservations: Array.isArray(parsed.reservations) ? parsed.reservations : [],
    users: Array.isArray(parsed.users) ? parsed.users : [],
  };
}

function getDb() {
  if (!db) throw new Error("DB not loaded");
  return db;
}

function toPublicContent() {
  const current = getDb();
  return {
    settings: current.settings ?? DEFAULT_DB.settings,
    menu: Array.isArray(current.menu) ? current.menu : [],
    events: Array.isArray(current.events) ? current.events : [],
    gallery: Array.isArray(current.gallery) ? current.gallery : [],
  };
}

async function atomicWriteJson(filePath, data) {
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmpPath, filePath);
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function load() {
  await fs.mkdir(path.dirname(dbPath), { recursive: true });

  try {
    const parsed = await readJson(dbPath);
    db = normalizeDb(parsed);
  } catch (err) {
    if (err && err.code !== "ENOENT") {
      // Corrupt or unreadable DB; start fresh but keep the error visible.
      console.warn("[cms] Failed to load db.json, creating a new one.", err);
    }
    let seed = null;
    if (err && err.code === "ENOENT" && seedDbPath !== dbPath) {
      try {
        seed = await readJson(seedDbPath);
      } catch {
        seed = null;
      }
    }

    db = normalizeDb(seed ?? DEFAULT_DB);
    await atomicWriteJson(dbPath, db);
  }
}

async function persist() {
  await atomicWriteJson(dbPath, getDb());
}

function update(mutator) {
  mutator(getDb());
  writeChain = writeChain.then(persist);
  return writeChain;
}

module.exports = {
  DEFAULT_DB,
  dbPath,
  getDb,
  load,
  toPublicContent,
  update,
};
