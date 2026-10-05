const express = require("express");
const multer = require("multer");
const { Pool } = require("pg");
const crypto = require("crypto");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const DATABASE_URL = process.env.DATABASE_URL;

if (!BOT_TOKEN) {
  console.error("BOT_TOKEN is missing");
  process.exit(1);
}

if (!ADMIN_PASSWORD) {
  console.error("ADMIN_PASSWORD is missing");
  process.exit(1);
}

if (!DATABASE_URL) {
  console.error("DATABASE_URL is missing");
  process.exit(1);
}

/* =========================================================
   EXPRESS
========================================================= */

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

/* =========================================================
   DATABASE
========================================================= */

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes("localhost")
    ? false
    : { rejectUnauthorized: false }
});

/* =========================================================
   CONSTANTS
========================================================= */

const MAX_UPLOAD_SIZE = 50 * 1024 * 1024;

const MAIN_BUTTONS = [
  {
    id: "ai",
    text: "🤖 AI HACK All Link Check ✅"
  },
  {
    id: "vip",
    text: "🔥 VIP GROUP All Link Check"
  },
  {
    id: "support",
    text: "💬 SUPPORT All Link Check"
  },
  {
    id: "official",
    text: "📢 OFFICIAL CHANNEL All Link Check"
  },
  {
    id: "bonus",
    text: "🎁 BONUS All Link Check"
  },
  {
    id: "admin",
    text: "👨‍💻 ADMIN All Link Check"
  }
];

/* =========================================================
   HELPERS
========================================================= */

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function validUrl(value) {
  const url = cleanText(value);
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:" ||
      parsed.protocol === "tg:"
    );
  } catch {
    return false;
  }
}

function normalizeHex(value) {
  const v = cleanText(value).replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(v)) {
    return v.toLowerCase();
  }
  return null;
}

/* =========================================================
   DEFAULT SLOT
========================================================= */

function slotDefault() {
  return {
    enabled: true,
    mediaEnabled: false,
    mediaType: "none",
    mediaSource: "upload",
    mediaId: null,
    mediaUrl: "",
    text: "",
    button1: {
      enabled: true,
      text: "OPEN LINK",
      url: "",
      colorEnabled: true,
      color: "#6d5dfc",
      style: "primary"
    },
    button2: {
      enabled: false,
      text: "SUPPORT",
      url: "",
      colorEnabled: true,
      color: "#6d5dfc",
      style: "success"
    }
  };
}

/* =========================================================
   MAIN BUTTON DEFAULT
========================================================= */

function mainDefault(id, text) {
  return {
    id,
    enabled: true,
    text,
    buttonColorEnabled: true,
    buttonColor: "#6d5dfc",
    buttonStyle: "primary",
    buttonVisualEnabled: false,
    buttonVisualType: "none",
    buttonVisualSource: "upload",
    buttonVisualId: null,
    buttonVisualUrl: "",
    buttonVisualText: "",
    buttonImageEnabled: false,
    buttonImageUrl: "",
    headerMediaEnabled: false,
    headerMediaType: "none",
    headerMediaSource: "upload",
    headerMediaId: null,
    headerMediaUrl: "",
    headerText: "",
    slots: []
  };
}

/* =========================================================
   WELCOME DEFAULT
========================================================= */

function welcomeDefault() {
  return {
    profilePhotoEnabled: true,
    profilePhoto: true,
    mediaEnabled: false,
    mediaType: "none",
    mediaSource: "upload",
    mediaId: null,
    mediaUrl: "",
    text: "👋 Welcome to our Telegram Bot!",
    layout: "profile_welcome_buttons" // Options: profile_welcome_buttons, buttons_profile_welcome, buttons_profile_welcome_reversed etc.
  };
}

/* =========================================================
   AUDIO DEFAULT
========================================================= */

function audioDefault() {
  return {
    enabled: false,
    mediaEnabled: true,
    text: "",
    mediaType: "audio",
    mediaSource: "upload",
    mediaId: null,
    mediaUrl: "",
    button1: {
      enabled: true,
      text: "OPEN LINK",
      url: "",
      colorEnabled: true,
      color: "#6d5dfc",
      style: "primary"
    },
    button2: {
      enabled: false,
      text: "SUPPORT",
      url: "",
      colorEnabled: true,
      color: "#6d5dfc",
      style: "success"
    }
  };
}

/* =========================================================
   DEFAULT SETTINGS
========================================================= */

function defaultSettings() {
  return {
    autoDelete: 0,
    welcome: welcomeDefault(),
    mainButtons: MAIN_BUTTONS.map(item => mainDefault(item.id, item.text)),
    audio: audioDefault()
  };
}

/* =========================================================
   DEEP MERGE & NORMALIZE
========================================================= */

function mergeObject(base, incoming) {
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
    return clone(base);
  }
  const result = clone(base);
  for (const key of Object.keys(incoming)) {
    const value = incoming[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      result[key] &&
      typeof result[key] === "object" &&
      !Array.isArray(result[key])
    ) {
      result[key] = mergeObject(result[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function normalizeSlot(slot) {
  const base = slotDefault();
  return mergeObject(base, slot || {});
}

function normalizeMainButton(button, index) {
  const fallback = MAIN_BUTTONS[index] || MAIN_BUTTONS[0];
  const base = mainDefault(button?.id || fallback.id, button?.text || fallback.text);
  const result = mergeObject(base, button || {});
  result.slots = Array.isArray(result.slots) ? result.slots.map(normalizeSlot) : [];
  return result;
}

function normalizeSettings(data) {
  const defaults = defaultSettings();
  if (!data || typeof data !== "object") return defaults;
  const result = mergeObject(defaults, data);
  result.welcome = mergeObject(welcomeDefault(), data.welcome || {});
  if (Array.isArray(data.mainButtons)) {
    result.mainButtons = data.mainButtons.map(normalizeMainButton);
  }
  for (const item of MAIN_BUTTONS) {
    if (!result.mainButtons.some(b => b.id === item.id)) {
      result.mainButtons.push(mainDefault(item.id, item.text));
    }
  }
  result.audio = mergeObject(audioDefault(), data.audio || {});
  return result;
}

/* =========================================================
   DATABASE INIT & HELPERS
========================================================= */

async function dbInit() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bot_settings (
      id INTEGER PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bot_media (
      id BIGSERIAL PRIMARY KEY,
      kind TEXT NOT NULL,
      filename TEXT,
      mimetype TEXT,
      data BYTEA NOT NULL,
      telegram_file_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bot_chat_messages (
      id BIGSERIAL PRIMARY KEY,
      chat_id BIGINT NOT NULL,
      message_id BIGINT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const result = await pool.query(`SELECT id FROM bot_settings WHERE id = 1`);
  if (!result.rows.length) {
    await pool.query(
      `INSERT INTO bot_settings (id, data) VALUES (1, $1)`,
      [JSON.stringify(defaultSettings())]
    );
  }
}

async function getSettings() {
  const result = await pool.query(`SELECT data FROM bot_settings WHERE id = 1`);
  return normalizeSettings(result.rows[0]?.data || defaultSettings());
}

async function saveSettings(data) {
  const settings = normalizeSettings(data);
  await pool.query(
    `UPDATE bot_settings SET data = $1, updated_at = NOW() WHERE id = 1`,
    [JSON.stringify(settings)]
  );
  return settings;
}

/* =========================================================
   ADMIN SESSION & TELEGRAM UTILS
========================================================= */

const sessions = new Map();

function createAdminToken() {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, Date.now() + 24 * 60 * 60 * 1000);
  return token;
}

function checkAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  const token = header.slice(7);
  const expiry = sessions.get(token);
  if (!expiry || expiry < Date.now()) {
    sessions.delete(token);
    return res.status(401).json({ ok: false, error: "Session expired" });
  }
  next();
}

const TG = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function telegram(method, body = {}) {
  const response = await fetch(`${TG}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.description || `Telegram API error: ${method}`);
  }
  return data.result;
}

async function telegramFile(method, fields, fileField, buffer, filename, mime) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null) {
      form.append(key, String(value));
    }
  }
  form.append(
    fileField,
    new Blob([buffer], { type: mime || "application/octet-stream" }),
    filename || "upload"
  );
  const response = await fetch(`${TG}/${method}`, { method: "POST", body: form });
  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.description || `Telegram upload error: ${method}`);
  }
  return data.result;
}

const chatMessages = new Map();

function rememberMessage(chatId, messageId, deleteAfter = 0) {
  if (!chatId || !messageId) return;
  if (!chatMessages.has(chatId)) {
    chatMessages.set(chatId, new Set());
  }
  chatMessages.get(chatId).add(messageId);
}

async function clearBotMessages(chatId) {
  const memory = chatMessages.get(chatId);
  if (memory) {
    for (const messageId of memory) {
      try {
        await telegram("deleteMessage", { chat_id: chatId, message_id: messageId });
      } catch (_) {}
    }
  }
  chatMessages.delete(chatId);
}

function telegramButtonStyle(button) {
  if (!button || button.colorEnabled === false || button.buttonColorEnabled === false) {
    return undefined;
  }
  const hex = normalizeHex(button.buttonColor || button.color);
  if (hex) {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const presets = [
      { name: "primary", r: 51, g: 144, b: 238 },
      { name: "success", r: 49, g: 181, b: 69 },
      { name: "danger", r: 229, g: 57, b: 53 }
    ];
    let nearest = presets[0];
    let distance = Infinity;
    for (const preset of presets) {
      const d = Math.pow(r - preset.r, 2) + Math.pow(g - preset.g, 2) + Math.pow(b - preset.b, 2);
      if (d < distance) {
        distance = d;
        nearest = preset;
      }
    }
    return nearest.name;
  }
  return undefined;
}

function makeMainButton(button) {
  const item = {
    text: button.text || button.id || "BUTTON",
    callback_data: `main:${button.id}`
  };
  const style = telegramButtonStyle(button);
  if (style) item.style = style;
  return item;
}

function mainKeyboard(settings) {
  const rows = [];
  for (const button of settings.mainButtons || []) {
    if (!button.enabled) continue;
    rows.push([makeMainButton(button)]);
  }
  return { inline_keyboard: rows };
}

function backKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "⬅️ BACK", callback_data: "back:main", style: "primary" }]
    ]
  };
}

async function getMedia(mediaId) {
  if (!mediaId) return null;
  const result = await pool.query(
    `SELECT id, kind, filename, mimetype, data, telegram_file_id FROM bot_media WHERE id = $1`,
    [mediaId]
  );
  return result.rows[0] || null;
}

function mediaMethod(type) {
  switch (String(type || "").toLowerCase()) {
    case "photo":
    case "image":
      return ["sendPhoto", "photo"];
    case "video":
      return ["sendVideo", "video"];
    case "audio":
      return ["sendAudio", "audio"];
    default:
      return null;
  }
}

async function sendConfiguredMedia(chatId, mediaType, mediaSource, mediaId, mediaUrl, text, markup, settings) {
  const requestedType = String(mediaType || "none").toLowerCase();
  if (requestedType === "none") {
    return sendText(chatId, text, markup, settings);
  }

  let dbMedia = null;
  if (mediaSource === "upload" && mediaId) {
    dbMedia = await getMedia(mediaId);
  }

  const actualType = dbMedia?.kind || requestedType;
  const info = mediaMethod(actualType);
  if (!info) return sendText(chatId, text, markup, settings);

  const [method, field] = info;
  const payload = { chat_id: chatId };
  if (text && text.length <= 1024) payload.caption = text;
  if (markup) payload.reply_markup = markup;

  if (dbMedia) {
    payload[field] = dbMedia.telegram_file_id || Buffer.from(dbMedia.data);
    try {
      const res = await telegramFile(method, payload, field, dbMedia.data, dbMedia.filename, dbMedia.mimetype);
      rememberMessage(chatId, res.message_id, Number(settings?.autoDelete || 0));
      return res;
    } catch (e) {
      console.error("Media send error:", e.message);
    }
  } else if (mediaUrl) {
    payload[field] = mediaUrl;
    try {
      const res = await telegram(method, payload);
      rememberMessage(chatId, res.message_id, Number(settings?.autoDelete || 0));
      return res;
    } catch (e) {
      console.error("URL Media error:", e.message);
    }
  }
  return sendText(chatId, text, markup, settings);
}

async function sendText(chatId, text, markup, settings) {
  const payload = { chat_id: chatId, text: text || "\u2063" };
  if (markup) payload.reply_markup = markup;
  const message = await telegram("sendMessage", payload);
  rememberMessage(chatId, message.message_id, Number(settings?.autoDelete || 0));
  return message;
}

async function getUserDisplayName(chatId) {
  try {
    const chat = await telegram("getChat", { chat_id: chatId });
    return [chat.first_name, chat.last_name].filter(Boolean).join(" ").trim() || chat.username || "User";
  } catch {
    return "User";
  }
}

async function sendProfilePhoto(chatId, settings) {
  const welcome = settings.welcome || {};
  if (welcome.profilePhotoEnabled === false && welcome.profilePhoto === false) return null;
  try {
    const res = await telegram("getUserProfilePhotos", { user_id: chatId, limit: 1 });
    const photos = res.photos || [];
    if (!photos.length) return null;
    const sizes = photos[0];
    const photo = sizes[sizes.length - 1];
    if (!photo?.file_id) return null;
    const msg = await telegram("sendPhoto", { chat_id: chatId, photo: photo.file_id });
    rememberMessage(chatId, msg.message_id, Number(settings?.autoDelete || 0));
    return msg;
  } catch {
    return null;
  }
}

async function getWelcomeText(chatId, settings) {
  const name = await getUserDisplayName(chatId);
  const welcomeText = cleanText(settings.welcome?.text);
  return welcomeText ? `👤 ${name}\n\n${welcomeText}` : `👤 ${name}`;
}

function hasWelcomeMedia(welcome) {
  if (!welcome || welcome.mediaEnabled === false) return false;
  if (!welcome.mediaType || welcome.mediaType === "none") return false;
  return !!(welcome.mediaId || welcome.mediaUrl);
}

function getMainButtonVisual(button) {
  if (!button || button.buttonVisualEnabled === false) return null;
  if (button.buttonVisualType && button.buttonVisualType !== "none" && (button.buttonVisualId || button.buttonVisualUrl)) {
    return {
      type: button.buttonVisualType,
      source: button.buttonVisualSource || "upload",
      id: button.buttonVisualId || null,
      url: button.buttonVisualUrl || "",
      text: button.buttonVisualText || ""
    };
  }
  return null;
}

async function sendMainButtonVisual(chatId, button, settings) {
  const visual = getMainButtonVisual(button);
  if (!visual) return null;
  if (visual.type === "none") {
    return sendText(chatId, visual.text, undefined, settings);
  }
  return sendConfiguredMedia(chatId, visual.type, visual.source, visual.id, visual.url, visual.text, undefined, settings);
}

async function sendSixMainButtons(chatId, settings) {
  const enabled = (settings.mainButtons || []).filter(b => b.enabled);
  if (!enabled.length) return null;

  for (const button of enabled) {
    await sendMainButtonVisual(chatId, button, settings);
    await sendText(chatId, "", { inline_keyboard: [[makeMainButton(button)]] }, settings);
  }
}

async function showMainPage(chatId) {
  const settings = await getSettings();
  await clearBotMessages(chatId);

  const layout = settings.welcome?.layout || "profile_welcome_buttons";
  const welcome = settings.welcome || {};

  // Layout handling as requested by user
  if (layout === "buttons_profile_welcome") {
    await sendSixMainButtons(chatId, settings);
    await sendProfilePhoto(chatId, settings);
    const text = await getWelcomeText(chatId, settings);
    await sendConfiguredMedia(chatId, welcome.mediaType, welcome.mediaSource, welcome.mediaId, welcome.mediaUrl, text, undefined, settings);
    return;
  }

  // Default: Profile Photo -> Welcome Media/Text -> 6 Buttons
  await sendProfilePhoto(chatId, settings);
  const text = await getWelcomeText(chatId, settings);
  
  if (hasWelcomeMedia(welcome)) {
    await sendConfiguredMedia(chatId, welcome.mediaType, welcome.mediaSource, welcome.mediaId, welcome.mediaUrl, text, undefined, settings);
    await sendSixMainButtons(chatId, settings);
  } else {
    // If no welcome media, buttons can go right below welcome text or separate
    await sendText(chatId, text, mainKeyboard(settings), settings);
  }
}

async function showMainButton(chatId, buttonId) {
  const settings = await getSettings();
  await clearBotMessages(chatId);
  const button = (settings.mainButtons || []).find(item => item.id === buttonId);
  if (!button || !button.enabled) {
    return showMainPage(chatId);
  }

  const visual = getMainButtonVisual(button);
  if (visual) {
    await sendConfiguredMedia(chatId, visual.type, visual.source, visual.id, visual.url, visual.text, undefined, settings);
  }

  for (const slot of button.slots || []) {
    if (!slot || !slot.enabled) continue;
    await sendConfiguredMedia(chatId, slot.mediaType, slot.mediaSource, slot.mediaId, slot.mediaUrl, slot.text, undefined, settings);
  }

  await sendText(chatId, "⬅️ BACK", backKeyboard(), settings);
}

async function handleUpdate(update) {
  if (update.message?.text?.trim().toLowerCase() === "/start") {
    await showMainPage(update.message.chat.id);
    return;
  }
  if (update.callback_query) {
    const query = update.callback_query;
    const chatId = query.message?.chat?.id;
    const data = String(query.data || "");
    if (!chatId) return;

    try { await telegram("answerCallbackQuery", { callback_query_id: query.id }); } catch {}

    if (data === "back:main") {
      await showMainPage(chatId);
      return;
    }
    if (data.startsWith("main:")) {
      await showMainButton(chatId, data.substring(5));
      return;
    }
  }
}

/* =========================================================
   ROUTES & WEBHOOK
========================================================= */

app.post("/telegram-webhook", async (req, res) => {
  res.status(200).json({ ok: true });
  try {
    await handleUpdate(req.body);
  } catch (e) {
    console.error("Webhook error:", e);
  }
});

app.post("/api/login", async (req, res) => {
  const password = String(req.body.password || "");
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, error: "Wrong password" });
  }
  res.json({ ok: true, token: createAdminToken() });
});

app.get("/api/settings", checkAdmin, async (req, res) => {
  res.json({ ok: true, settings: await getSettings() });
});

app.post("/api/settings", checkAdmin, async (req, res) => {
  const settings = await saveSettings(req.body);
  res.json({ ok: true, settings });
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_SIZE } });

app.post("/api/upload", checkAdmin, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: "No file selected" });
  let kind = "photo";
  if (req.file.mimetype.startsWith("video/")) kind = "video";
  else if (req.file.mimetype.startsWith("audio/")) kind = "audio";

  const result = await pool.query(
    `INSERT INTO bot_media (kind, filename, mimetype, data) VALUES ($1, $2, $3, $4) RETURNING id`,
    [kind, req.file.originalname, req.file.mimetype, req.file.buffer]
  );

  res.json({ ok: true, mediaId: result.rows[0].id, kind, url: `/media/${result.rows[0].id}` });
});

app.get("/media/:id", async (req, res) => {
  const result = await pool.query(`SELECT mimetype, data, filename FROM bot_media WHERE id = $1`, [req.params.id]);
  if (!result.rows.length) return res.status(404).send("Not found");
  res.setHeader("Content-Type", result.rows[0].mimetype);
  res.send(result.rows[0].data);
});

app.post("/api/reset", checkAdmin, async (req, res) => {
  const settings = await saveSettings(defaultSettings());
  res.json({ ok: true, settings });
});

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "Admin.html")));
app.get("/admin.html", (req, res) => res.sendFile(path.join(__dirname, "Admin.html")));

async function setupWebhook() {
  const base = process.env.RENDER_EXTERNAL_URL || "https://telegram-bot-system-kgdq.onrender.com";
  try {
    await telegram("setWebhook", { url: `${base}/telegram-webhook`, allowed_updates: ["message", "callback_query"] });
  } catch (e) {
    console.error("Webhook error:", e.message);
  }
}

async function start() {
  await dbInit();
  app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await setupWebhook();
  });
}

start();
