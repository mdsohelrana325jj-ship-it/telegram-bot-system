const express = require("express");
const multer = require("multer");
const { Pool } = require("pg");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024
  }
});

/* =========================================================
   ENVIRONMENT
========================================================= */

const BOT_TOKEN = process.env.BOT_TOKEN || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123456";

const DATABASE_URL = process.env.DATABASE_URL || "";

const RENDER_EXTERNAL_URL =
  process.env.RENDER_EXTERNAL_URL ||
  `https://telegram-bot-system-kgdq.onrender.com`;

if (!BOT_TOKEN) {
  console.log("WARNING: BOT_TOKEN is not configured.");
}

if (!DATABASE_URL) {
  console.log("WARNING: DATABASE_URL is not configured.");
}

/* =========================================================
   DATABASE
========================================================= */

const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    })
  : null;

const DEFAULT_SETTINGS = {
  welcome: {
    profilePhoto: true,
    enabled: true,
    text: "🎉 Welcome to our bot!",
    textSize: "medium",
    imageFileId: "",
    imageUrl: "",
    buttons: [
      {
        enabled: true,
        text: "🔥 VIP GROUP All Link Check",
        url: "https://t.me/"
      },
      {
        enabled: true,
        text: "🤖 AI HACK All Link Check",
        url: ""
      },
      {
        enabled: true,
        text: "💬 SUPPORT All Link Check",
        url: ""
      },
      {
        enabled: true,
        text: "📢 OFFICIAL CHANNEL All Link Check",
        url: ""
      },
      {
        enabled: true,
        text: "🎁 BONUS All Link Check",
        url: ""
      },
      {
        enabled: true,
        text: "👨‍💻 ADMIN All Link Check",
        url: ""
      }
    ]
  },

  aiHack: [],

  categories: {
    vip: {
      enabled: true,
      text: "🔥 VIP GROUP All Link Check",
      mediaType: "none",
      fileId: "",
      url: "",
      message: "",
      buttons: []
    },

    support: {
      enabled: true,
      text: "💬 SUPPORT All Link Check",
      mediaType: "none",
      fileId: "",
      url: "",
      message: "",
      buttons: []
    },

    official: {
      enabled: true,
      text: "📢 OFFICIAL CHANNEL All Link Check",
      mediaType: "none",
      fileId: "",
      url: "",
      message: "",
      buttons: []
    },

    bonus: {
      enabled: true,
      text: "🎁 BONUS All Link Check",
      mediaType: "none",
      fileId: "",
      url: "",
      message: "",
      buttons: []
    },

    admin: {
      enabled: true,
      text: "👨‍💻 ADMIN All Link Check",
      mediaType: "none",
      fileId: "",
      url: "",
      message: "",
      buttons: []
    }
  },

  audio: {
    enabled: false,
    imageFileId: "",
    imageUrl: "",
    text: "",
    audioFileId: "",
    audioUrl: "",
    buttons: [
      {
        enabled: true,
        text: "Button 1",
        url: ""
      },
      {
        enabled: true,
        text: "Button 2",
        url: ""
      }
    ]
  },

  autoDelete: 0
};

/* =========================================================
   DATABASE INIT
========================================================= */

async function initDatabase() {
  if (!pool) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bot_settings (
      id INTEGER PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const result = await pool.query(
    "SELECT data FROM bot_settings WHERE id = 1"
  );

  if (result.rows.length === 0) {
    await pool.query(
      "INSERT INTO bot_settings (id, data) VALUES (1, $1)",
      [JSON.stringify(DEFAULT_SETTINGS)]
    );
  }
}

/* =========================================================
   SETTINGS
========================================================= */

async function getSettings() {
  if (!pool) {
    return DEFAULT_SETTINGS;
  }

  const result = await pool.query(
    "SELECT data FROM bot_settings WHERE id = 1"
  );

  if (!result.rows.length) {
    return DEFAULT_SETTINGS;
  }

  return result.rows[0].data;
}

async function saveSettings(settings) {
  if (!pool) {
    return false;
  }

  await pool.query(
    `
    UPDATE bot_settings
    SET data = $1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
    `,
    [JSON.stringify(settings)]
  );

  return true;
}

/* =========================================================
   TELEGRAM API
========================================================= */

async function telegram(method, body = {}) {
  if (!BOT_TOKEN) {
    throw new Error("BOT_TOKEN is missing");
  }

  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }
  );

  const data = await response.json();

  if (!data.ok) {
    throw new Error(
      data.description || `Telegram API error: ${method}`
    );
  }

  return data.result;
}

/* =========================================================
   TELEGRAM KEYBOARDS
========================================================= */

function mainKeyboard(settings) {
  const rows = [];

  const buttons = settings.welcome.buttons || [];

  for (let i = 0; i < buttons.length; i += 2) {
    const row = [];

    const a = buttons[i];
    const b = buttons[i + 1];

    if (a && a.enabled) {
      if (a.url) {
        row.push({
          text: a.text,
          url: a.url
        });
      } else {
        row.push({
          text: a.text,
          callback_data: `MAIN_${i}`
        });
      }
    }

    if (b && b.enabled) {
      if (b.url) {
        row.push({
          text: b.text,
          url: b.url
        });
      } else {
        row.push({
          text: b.text,
          callback_data: `MAIN_${i + 1}`
        });
      }
    }

    if (row.length) {
      rows.push(row);
    }
  }

  return {
    inline_keyboard: rows
  };
}

function backKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: "⬅️ BACK",
          callback_data: "BACK_MAIN"
        }
      ]
    ]
  };
}

/* =========================================================
   CATEGORY KEYBOARD
========================================================= */

function contentButtons(buttons = []) {
  const rows = [];

  let row = [];

  for (const button of buttons) {
    if (!button || !button.enabled || !button.text) continue;

    if (button.url) {
      row.push({
        text: button.text,
        url: button.url
      });
    }

    if (row.length === 2) {
      rows.push(row);
      row = [];
    }
  }

  if (row.length) {
    rows.push(row);
  }

  rows.push([
    {
      text: "⬅️ BACK",
      callback_data: "BACK_MAIN"
    }
  ]);

  return {
    inline_keyboard: rows
  };
}

/* =========================================================
   SEND MEDIA
========================================================= */

async function sendMedia(chatId, mediaType, fileId, caption, replyMarkup) {
  if (!fileId || !mediaType || mediaType === "none") {
    return null;
  }

  if (mediaType === "photo") {
    return telegram("sendPhoto", {
      chat_id: chatId,
      photo: fileId,
      caption: caption || "",
      reply_markup: replyMarkup
    });
  }

  if (mediaType === "video") {
    return telegram("sendVideo", {
      chat_id: chatId,
      video: fileId,
      caption: caption || "",
      reply_markup: replyMarkup
    });
  }

  if (mediaType === "audio") {
    return telegram("sendAudio", {
      chat_id: chatId,
      audio: fileId,
      caption: caption || "",
      reply_markup: replyMarkup
    });
  }

  return null;
}

/* =========================================================
   USER PROFILE PHOTO
========================================================= */

async function sendUserProfilePhoto(chatId, userId) {
  try {
    const photos = await telegram("getUserProfilePhotos", {
      user_id: userId,
      limit: 1
    });

    if (
      photos &&
      photos.total_count > 0 &&
      photos.photos &&
      photos.photos[0] &&
      photos.photos[0].length
    ) {
      const photo =
        photos.photos[0][photos.photos[0].length - 1];

      await telegram("sendPhoto", {
        chat_id: chatId,
        photo: photo.file_id
      });

      return true;
    }
  } catch (e) {
    console.log("Profile photo error:", e.message);
  }

  return false;
}

/* =========================================================
   START
========================================================= */

async function handleStart(message) {
  const settings = await getSettings();

  const chatId = message.chat.id;
  const userId = message.from.id;

  if (settings.welcome.profilePhoto) {
    await sendUserProfilePhoto(chatId, userId);
  }

  if (!settings.welcome.enabled) {
    await telegram("sendMessage", {
      chat_id: chatId,
      text: "Welcome!",
      reply_markup: mainKeyboard(settings)
    });

    return;
  }

  const name =
    message.from.first_name ||
    message.from.username ||
    "Friend";

  let welcomeText = settings.welcome.text || "";

  welcomeText = welcomeText
    .replaceAll("{name}", name)
    .replaceAll("{username}", message.from.username || "")
    .replaceAll(
      "{fullname}",
      `${message.from.first_name || ""} ${
        message.from.last_name || ""
      }`.trim()
    );

  if (settings.welcome.imageFileId) {
    await telegram("sendPhoto", {
      chat_id: chatId,
      photo: settings.welcome.imageFileId,
      caption: welcomeText,
      reply_markup: mainKeyboard(settings)
    });
  } else {
    await telegram("sendMessage", {
      chat_id: chatId,
      text: welcomeText,
      reply_markup: mainKeyboard(settings)
    });
  }
}

/* =========================================================
   AI HACK
========================================================= */

async function showAIHack(chatId) {
  const settings = await getSettings();

  const items = settings.aiHack || [];

  if (!items.length) {
    await telegram("sendMessage", {
      chat_id: chatId,
      text: "🤖 AI HACK\n\nNo content has been added yet.",
      reply_markup: backKeyboard()
    });

    return;
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (!item || !item.enabled) continue;

    const buttons = contentButtons(item.buttons || []);

    let caption =
      `🤖 AI HACK ${i + 1}\n\n` +
      (item.text || "");

    if (item.mediaType && item.fileId) {
      await sendMedia(
        chatId,
        item.mediaType,
        item.fileId,
        caption,
        buttons
      );
    } else {
      await telegram("sendMessage", {
        chat_id: chatId,
        text: caption,
        reply_markup: buttons
      });
    }
  }
}

/* =========================================================
   CATEGORY
========================================================= */

async function showCategory(chatId, categoryName) {
  const settings = await getSettings();

  const category =
    settings.categories &&
    settings.categories[categoryName];

  if (!category || !category.enabled) {
    await telegram("sendMessage", {
      chat_id: chatId,
      text: "This section is currently OFF.",
      reply_markup: backKeyboard()
    });

    return;
  }

  const text =
    `${category.text || ""}\n\n` +
    `${category.message || ""}`;

  const buttons = contentButtons(category.buttons || []);

  if (category.mediaType && category.fileId) {
    await sendMedia(
      chatId,
      category.mediaType,
      category.fileId,
      text,
      buttons
    );
  } else {
    await telegram("sendMessage", {
      chat_id: chatId,
      text,
      reply_markup: buttons
    });
  }
}

/* =========================================================
   AUDIO
========================================================= */

async function showAudio(chatId) {
  const settings = await getSettings();

  const audio = settings.audio;

  if (!audio || !audio.enabled) {
    await telegram("sendMessage", {
      chat_id: chatId,
      text: "🎵 Audio section is OFF.",
      reply_markup: backKeyboard()
    });

    return;
  }

  const buttons = contentButtons(audio.buttons || []);

  if (audio.imageFileId) {
    await telegram("sendPhoto", {
      chat_id: chatId,
      photo: audio.imageFileId,
      caption: audio.text || "",
      reply_markup: buttons
    });
  }

  if (audio.audioFileId) {
    await telegram("sendAudio", {
      chat_id: chatId,
      audio: audio.audioFileId,
      reply_markup: buttons
    });
  } else {
    await telegram("sendMessage", {
      chat_id: chatId,
      text: audio.text || "Audio is not available.",
      reply_markup: buttons
    });
  }
}

/* =========================================================
   CALLBACK
========================================================= */

async function handleCallback(query) {
  const data = query.data;
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;

  await telegram("answerCallbackQuery", {
    callback_query_id: query.id
  });

  /*
    We try to remove the previous bot message.
    If Telegram refuses, the system continues.
  */

  async function deletePrevious() {
    try {
      await telegram("deleteMessage", {
        chat_id: chatId,
        message_id: messageId
      });
    } catch (e) {}
  }

  if (data === "BACK_MAIN") {
    await deletePrevious();

    const settings = await getSettings();

    await telegram("sendMessage", {
      chat_id: chatId,
      text: settings.welcome.text || "Main Menu",
      reply_markup: mainKeyboard(settings)
    });

    return;
  }

  if (data === "OPEN_AI") {
    await deletePrevious();
    await showAIHack(chatId);
    return;
  }

  if (data === "OPEN_VIP") {
    await deletePrevious();
    await showCategory(chatId, "vip");
    return;
  }

  if (data === "OPEN_SUPPORT") {
    await deletePrevious();
    await showCategory(chatId, "support");
    return;
  }

  if (data === "OPEN_OFFICIAL") {
    await deletePrevious();
    await showCategory(chatId, "official");
    return;
  }

  if (data === "OPEN_BONUS") {
    await deletePrevious();
    await showCategory(chatId, "bonus");
    return;
  }

  if (data === "OPEN_ADMIN") {
    await deletePrevious();
    await showCategory(chatId, "admin");
    return;
  }

  /*
    Compatibility with main button indexes.
  */

  if (data.startsWith("MAIN_")) {
    const index = Number(
      data.replace("MAIN_", "")
    );

    const settings = await getSettings();

    const button =
      settings.welcome.buttons[index];

    if (!button) return;

    const text =
      (button.text || "").toLowerCase();

    await deletePrevious();

    if (text.includes("ai hack")) {
      await showAIHack(chatId);
      return;
    }

    if (text.includes("vip")) {
      await showCategory(chatId, "vip");
      return;
    }

    if (text.includes("support")) {
      await showCategory(chatId, "support");
      return;
    }

    if (text.includes("official")) {
      await showCategory(chatId, "official");
      return;
    }

    if (text.includes("bonus")) {
      await showCategory(chatId, "bonus");
      return;
    }

    if (text.includes("admin")) {
      await showCategory(chatId, "admin");
      return;
    }
  }
}

/* =========================================================
   TELEGRAM UPDATE
========================================================= */

async function processTelegramUpdate(update) {
  try {
    if (update.message) {
      const message = update.message;

      if (
        message.text &&
        message.text.startsWith("/start")
      ) {
        await handleStart(message);
      }
    }

    if (update.callback_query) {
      await handleCallback(
        update.callback_query
      );
    }
  } catch (error) {
    console.log(
      "Telegram update error:",
      error.message
    );
  }
}

/* =========================================================
   WEBHOOK
========================================================= */

app.post("/telegram-webhook", async (req, res) => {
  res.sendStatus(200);

  await processTelegramUpdate(req.body);
});

/* =========================================================
   ADMIN AUTH
========================================================= */

function auth(req, res, next) {
  const password =
    req.headers["x-admin-password"];

  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized"
    });
  }

  next();
}

/* =========================================================
   ADMIN PAGE
========================================================= */

app.get("/", (req, res) => {
  res.sendFile(
    __dirname + "/Admin.html"
  );
});

app.get("/admin.html", (req, res) => {
  res.sendFile(
    __dirname + "/Admin.html"
  );
});

/* =========================================================
   ADMIN LOGIN CHECK
========================================================= */

app.post("/api/login", (req, res) => {
  const password =
    req.body.password || "";

  if (password === ADMIN_PASSWORD) {
    return res.json({
      ok: true
    });
  }

  res.status(401).json({
    ok: false,
    error: "Wrong password"
  });
});

/* =========================================================
   GET SETTINGS
========================================================= */

app.get("/api/settings", auth, async (req, res) => {
  try {
    const settings = await getSettings();

    res.json({
      ok: true,
      settings
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

/* =========================================================
   SAVE SETTINGS
========================================================= */

app.post("/api/settings", auth, async (req, res) => {
  try {
    const settings = req.body.settings;

    if (!settings) {
      return res.status(400).json({
        ok: false,
        error: "Settings missing"
      });
    }

    await saveSettings(settings);

    res.json({
      ok: true,
      message: "Settings saved"
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

/* =========================================================
   RESET
========================================================= */

app.post("/api/reset", auth, async (req, res) => {
  try {
    await saveSettings(
      JSON.parse(
        JSON.stringify(DEFAULT_SETTINGS)
      )
    );

    res.json({
      ok: true,
      message: "System reset successfully"
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

/* =========================================================
   TELEGRAM MEDIA UPLOAD
========================================================= */

app.post(
  "/api/upload",
  auth,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          ok: false,
          error: "No file uploaded"
        });
      }

      const type =
        req.body.type || "document";

      const fileBuffer = req.file.buffer;

      /*
        Telegram sendPhoto/sendVideo/sendAudio
        needs multipart/form-data.
      */

      const form = new FormData();

      form.append(
        "chat_id",
        String(req.body.chatId || "")
      );

      const blob = new Blob(
        [fileBuffer],
        {
          type:
            req.file.mimetype ||
            "application/octet-stream"
        }
      );

      form.append(
        type,
        blob,
        req.file.originalname
      );

      const endpoint =
        type === "photo"
          ? "sendPhoto"
          : type === "video"
          ? "sendVideo"
          : type === "audio"
          ? "sendAudio"
          : "sendDocument";

      const response = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/${endpoint}`,
        {
          method: "POST",
          body: form
        }
      );

      const result =
        await response.json();

      if (!result.ok) {
        throw new Error(
          result.description ||
            "Telegram upload failed"
        );
      }

      let fileId = "";

      if (type === "photo") {
        const photos =
          result.result.photo;

        fileId =
          photos[photos.length - 1]
            .file_id;
      } else {
        fileId =
          result.result[type]?.file_id ||
          result.result.document?.file_id ||
          "";
      }

      res.json({
        ok: true,
        fileId,
        telegramResult: result.result
      });
    } catch (error) {
      console.log(
        "Upload error:",
        error.message
      );

      res.status(500).json({
        ok: false,
        error: error.message
      });
    }
  }
);

/* =========================================================
   WEBHOOK SETUP
========================================================= */

async function setupWebhook() {
  if (!BOT_TOKEN) return;

  const webhookUrl =
    `${RENDER_EXTERNAL_URL}/telegram-webhook`;

  try {
    const result =
      await telegram("setWebhook", {
        url: webhookUrl,
        allowed_updates: [
          "message",
          "callback_query"
        ]
      });

    console.log(
      "Telegram webhook:",
      result,
      webhookUrl
    );
  } catch (error) {
    console.log(
      "Webhook error:",
      error.message
    );
  }
}

/* =========================================================
   BOT INFO
========================================================= */

app.get("/api/status", auth, async (req, res) => {
  try {
    const me = await telegram("getMe");

    res.json({
      ok: true,
      bot: me
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

/* =========================================================
   HEALTH
========================================================= */

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "Telegram Bot System"
  });
});

/* =========================================================
   START SERVER
========================================================= */

(async () => {
  try {
    await initDatabase();

    app.listen(PORT, async () => {
      console.log(
        `Server running on port ${PORT}`
      );

      await setupWebhook();
    });
  } catch (error) {
    console.error(
      "Startup error:",
      error
    );

    process.exit(1);
  }
})();
