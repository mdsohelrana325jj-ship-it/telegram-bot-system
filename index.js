const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 10000;

const BOT_TOKEN = process.env.BOT_TOKEN || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

const PUBLIC_URL =
  process.env.RENDER_EXTERNAL_URL ||
  process.env.PUBLIC_URL ||
  "";

if (!BOT_TOKEN) {
  console.error("ERROR: BOT_TOKEN is missing.");
}

if (!ADMIN_PASSWORD) {
  console.error("ERROR: ADMIN_PASSWORD is missing.");
}

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024
  }
});

/* =========================================================
   DATABASE
========================================================= */

let pool = null;

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
}

const defaultSettings = {
  welcome: {
    enabled: true,
    profilePhoto: true,
    text: "Welcome to our Telegram Bot!",
    textSize: "medium",
    mediaType: "none",
    mediaFileId: ""
  },

  mainButtons: [
    {
      enabled: true,
      text: "🤖 AI HACK All Link Check",
      action: "category",
      category: "aiHack",
      url: ""
    },
    {
      enabled: true,
      text: "🔥 VIP GROUP All Link Check",
      action: "category",
      category: "vip",
      url: ""
    },
    {
      enabled: true,
      text: "💬 SUPPORT All Link Check",
      action: "category",
      category: "support",
      url: ""
    },
    {
      enabled: true,
      text: "📢 OFFICIAL CHANNEL All Link Check",
      action: "category",
      category: "official",
      url: ""
    },
    {
      enabled: true,
      text: "🎁 BONUS All Link Check",
      action: "category",
      category: "bonus",
      url: ""
    },
    {
      enabled: true,
      text: "👨‍💻 ADMIN All Link Check",
      action: "category",
      category: "admin",
      url: ""
    }
  ],

  aiHack: [],

  categories: {
    vip: {
      enabled: true,
      title: "🔥 VIP GROUP",
      mediaType: "none",
      mediaFileId: "",
      text: "",
      buttons: [
        {
          enabled: true,
          text: "🔥 VIP GROUP JOIN",
          url: ""
        },
        {
          enabled: true,
          text: "💬 Support Admin",
          url: ""
        }
      ]
    },

    support: {
      enabled: true,
      title: "💬 SUPPORT",
      mediaType: "none",
      mediaFileId: "",
      text: "",
      buttons: [
        {
          enabled: true,
          text: "💬 Support Admin",
          url: ""
        },
        {
          enabled: false,
          text: "",
          url: ""
        }
      ]
    },

    official: {
      enabled: true,
      title: "📢 OFFICIAL CHANNEL",
      mediaType: "none",
      mediaFileId: "",
      text: "",
      buttons: [
        {
          enabled: true,
          text: "📢 OFFICIAL CHANNEL JOIN",
          url: ""
        },
        {
          enabled: false,
          text: "",
          url: ""
        }
      ]
    },

    bonus: {
      enabled: true,
      title: "🎁 BONUS",
      mediaType: "none",
      mediaFileId: "",
      text: "",
      buttons: [
        {
          enabled: true,
          text: "🎁 BONUS OPEN",
          url: ""
        },
        {
          enabled: false,
          text: "",
          url: ""
        }
      ]
    },

    admin: {
      enabled: true,
      title: "👨‍💻 ADMIN",
      mediaType: "none",
      mediaFileId: "",
      text: "",
      buttons: [
        {
          enabled: true,
          text: "👨‍💻 ADMIN CONTACT",
          url: ""
        },
        {
          enabled: false,
          text: "",
          url: ""
        }
      ]
    }
  },

  audio: {
    enabled: false,
    imageFileId: "",
    audioFileId: "",
    text: "",
    buttons: [
      {
        enabled: true,
        text: "🎧 OPEN",
        url: ""
      },
      {
        enabled: true,
        text: "💬 SUPPORT",
        url: ""
      }
    ]
  },

  autoDelete: 0,

  admin: {
    connectedChatId: "",
    connectCode: ""
  }
};

/* =========================================================
   HELPERS
========================================================= */

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function mergeDeep(target, source) {
  if (!source || typeof source !== "object") return target;

  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key])
    ) {
      if (!target[key] || typeof target[key] !== "object") {
        target[key] = {};
      }

      mergeDeep(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }

  return target;
}

function getSettingsSafe(data) {
  const result = clone(defaultSettings);
  return mergeDeep(result, data || {});
}

async function initDatabase() {
  if (!pool) {
    console.log("DATABASE_URL not found. Running with memory storage.");
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bot_settings (
      id INTEGER PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const result = await pool.query(
    "SELECT data FROM bot_settings WHERE id = 1"
  );

  if (result.rows.length === 0) {
    await pool.query(
      "INSERT INTO bot_settings (id, data) VALUES (1, $1)",
      [JSON.stringify(defaultSettings)]
    );
  }
}

let memorySettings = clone(defaultSettings);

async function getSettings() {
  if (!pool) {
    return clone(memorySettings);
  }

  const result = await pool.query(
    "SELECT data FROM bot_settings WHERE id = 1"
  );

  if (!result.rows.length) {
    return clone(defaultSettings);
  }

  return getSettingsSafe(result.rows[0].data);
}

async function saveSettings(data) {
  const finalData = getSettingsSafe(data);

  memorySettings = clone(finalData);

  if (pool) {
    await pool.query(
      `
      INSERT INTO bot_settings (id, data, updated_at)
      VALUES (1, $1, NOW())
      ON CONFLICT (id)
      DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
      `,
      [JSON.stringify(finalData)]
    );
  }

  return finalData;
}

/* =========================================================
   TELEGRAM API
========================================================= */

async function telegram(method, body = {}) {
  const url =
    `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(
      data.description || "Telegram API error"
    );
  }

  return data.result;
}

async function telegramMultipart(method, formData) {
  const url =
    `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;

  const response = await fetch(url, {
    method: "POST",
    body: formData
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(
      data.description || "Telegram API error"
    );
  }

  return data.result;
}

async function deleteMessage(chatId, messageId) {
  try {
    await telegram("deleteMessage", {
      chat_id: chatId,
      message_id: messageId
    });
  } catch (_) {}
}

async function answerCallback(id) {
  try {
    await telegram("answerCallbackQuery", {
      callback_query_id: id
    });
  } catch (_) {}
}

/* =========================================================
   KEYBOARDS
========================================================= */

function backKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: "⬅️ BACK TO MAIN",
          callback_data: "MAIN_MENU"
        }
      ]
    ]
  };
}

function categoryButtons(buttons) {
  const rows = [];

  for (const button of buttons || []) {
    if (!button.enabled || !button.text) continue;

    if (button.url) {
      rows.push([
        {
          text: button.text,
          url: button.url
        }
      ]);
    }
  }

  return rows;
}

function mainKeyboard(settings) {
  const rows = [];

  for (const button of settings.mainButtons || []) {
    if (!button.enabled || !button.text) continue;

    if (button.action === "url" && button.url) {
      rows.push([
        {
          text: button.text,
          url: button.url
        }
      ]);
    } else {
      rows.push([
        {
          text: button.text,
          callback_data:
            "CAT_" + (button.category || "aiHack")
        }
      ]);
    }
  }

  return {
    inline_keyboard: rows
  };
}

/* =========================================================
   MEDIA SENDER
========================================================= */

async function sendMedia(
  chatId,
  mediaType,
  fileId,
  caption = "",
  replyMarkup = null
) {
  if (!fileId || !mediaType || mediaType === "none") {
    return telegram("sendMessage", {
      chat_id: chatId,
      text: caption || " ",
      reply_markup: replyMarkup || undefined
    });
  }

  if (mediaType === "photo") {
    return telegram("sendPhoto", {
      chat_id: chatId,
      photo: fileId,
      caption: caption || undefined,
      reply_markup: replyMarkup || undefined
    });
  }

  if (mediaType === "video") {
    return telegram("sendVideo", {
      chat_id: chatId,
      video: fileId,
      caption: caption || undefined,
      reply_markup: replyMarkup || undefined
    });
  }

  if (mediaType === "audio") {
    return telegram("sendAudio", {
      chat_id: chatId,
      audio: fileId,
      caption: caption || undefined,
      reply_markup: replyMarkup || undefined
    });
  }

  return telegram("sendMessage", {
    chat_id: chatId,
    text: caption || " ",
    reply_markup: replyMarkup || undefined
  });
}

/* =========================================================
   PROFILE PHOTO
========================================================= */

async function sendProfilePhoto(chatId, userId) {
  try {
    const photos = await telegram(
      "getUserProfilePhotos",
      {
        user_id: userId,
        limit: 1
      }
    );

    if (
      photos &&
      photos.photos &&
      photos.photos.length > 0
    ) {
      const sizes = photos.photos[0];

      if (sizes && sizes.length > 0) {
        const photo = sizes[sizes.length - 1];

        await telegram("sendPhoto", {
          chat_id: chatId,
          photo: photo.file_id
        });
      }
    }
  } catch (_) {}
}

/* =========================================================
   WELCOME
========================================================= */

async function sendWelcome(chatId, user) {
  const settings = await getSettings();

  if (!settings.welcome.enabled) {
    await sendMainMenu(chatId);
    return;
  }

  if (settings.welcome.profilePhoto) {
    await sendProfilePhoto(chatId, user.id);
  }

  const name =
    user.first_name ||
    user.username ||
    "Friend";

  const text =
    `👋 Hello ${name}\n\n` +
    (settings.welcome.text || "Welcome!");

  let keyboard = mainKeyboard(settings);

  if (
    settings.welcome.mediaType !== "none" &&
    settings.welcome.mediaFileId
  ) {
    await sendMedia(
      chatId,
      settings.welcome.mediaType,
      settings.welcome.mediaFileId,
      text,
      keyboard
    );
  } else {
    await telegram("sendMessage", {
      chat_id: chatId,
      text,
      reply_markup: keyboard
    });
  }
}

async function sendMainMenu(chatId) {
  const settings = await getSettings();

  await telegram("sendMessage", {
    chat_id: chatId,
    text:
      settings.welcome.text ||
      "Welcome!",
    reply_markup: mainKeyboard(settings)
  });
}

/* =========================================================
   AI HACK
========================================================= */

async function sendAiHack(chatId) {
  const settings = await getSettings();

  if (!settings.aiHack || !settings.aiHack.length) {
    await telegram("sendMessage", {
      chat_id: chatId,
      text: "🤖 AI HACK content is not available.",
      reply_markup: backKeyboard()
    });

    return;
  }

  for (const item of settings.aiHack) {
    if (item.enabled === false) continue;

    const rows = [];

    for (const b of item.buttons || []) {
      if (!b.enabled || !b.text || !b.url) continue;

      rows.push([
        {
          text: b.text,
          url: b.url
        }
      ]);
    }

    await sendMedia(
      chatId,
      item.mediaType || "none",
      item.mediaFileId || "",
      item.text || "",
      rows.length
        ? {
            inline_keyboard: rows
          }
        : undefined
    );
  }

  await telegram("sendMessage", {
    chat_id: chatId,
    text: "🤖 AI HACK Complete",
    reply_markup: backKeyboard()
  });
}

/* =========================================================
   CATEGORY
========================================================= */

async function sendCategory(chatId, categoryName) {
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

  const rows = categoryButtons(category.buttons);

  await sendMedia(
    chatId,
    category.mediaType || "none",
    category.mediaFileId || "",
    `${category.title || ""}\n\n${category.text || ""}`.trim(),
    rows.length
      ? {
          inline_keyboard: rows
        }
      : undefined
  );

  await telegram("sendMessage", {
    chat_id: chatId,
    text: " ",
    reply_markup: backKeyboard()
  });
}

/* =========================================================
   AUDIO
========================================================= */

async function sendAudioSection(chatId) {
  const settings = await getSettings();
  const audio = settings.audio;

  if (!audio.enabled) {
    await telegram("sendMessage", {
      chat_id: chatId,
      text: "Audio section is OFF.",
      reply_markup: backKeyboard()
    });

    return;
  }

  if (audio.imageFileId) {
    await telegram("sendPhoto", {
      chat_id: chatId,
      photo: audio.imageFileId
    });
  }

  if (audio.audioFileId) {
    const rows = categoryButtons(audio.buttons);

    await telegram("sendAudio", {
      chat_id: chatId,
      audio: audio.audioFileId,
      caption: audio.text || "",
      reply_markup: rows.length
        ? {
            inline_keyboard: rows
          }
        : undefined
    });
  } else {
    await telegram("sendMessage", {
      chat_id: chatId,
      text: audio.text || " ",
      reply_markup: backKeyboard()
    });
  }

  await telegram("sendMessage", {
    chat_id: chatId,
    text: " ",
    reply_markup: backKeyboard()
  });
}

/* =========================================================
   WEBHOOK
========================================================= */

app.post("/telegram-webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const update = req.body;

    /* ---------------- MESSAGE ---------------- */

    if (update.message) {
      const message = update.message;
      const chatId = message.chat.id;
      const user = message.from;

      /* ADMIN CONNECTION */

      if (
        message.text &&
        message.text.startsWith("/admin ")
      ) {
        const code =
          message.text.substring(7).trim();

        const settings = await getSettings();

        if (
          settings.admin.connectCode &&
          settings.admin.connectCode === code
        ) {
          settings.admin.connectedChatId =
            String(chatId);

          settings.admin.connectCode = "";

          await saveSettings(settings);

          await telegram("sendMessage", {
            chat_id: chatId,
            text:
              "✅ Admin connected successfully.\n\n" +
              "এখন Admin Panel থেকে Image / Video / Audio upload করতে পারবেন."
          });
        } else {
          await telegram("sendMessage", {
            chat_id: chatId,
            text:
              "❌ Invalid or expired admin connection code."
          });
        }

        return;
      }

      /* START */

      if (
        message.text === "/start" ||
        message.text === "/start "
      ) {
        await sendWelcome(chatId, user);
        return;
      }

      /* ADMIN MEDIA CAPTURE */

      const settings = await getSettings();

      if (
        settings.admin.connectedChatId &&
        String(settings.admin.connectedChatId) ===
          String(chatId)
      ) {
        let fileId = "";
        let mediaType = "";

        if (
          message.photo &&
          message.photo.length
        ) {
          fileId =
            message.photo[
              message.photo.length - 1
            ].file_id;

          mediaType = "photo";
        } else if (message.video) {
          fileId = message.video.file_id;
          mediaType = "video";
        } else if (message.audio) {
          fileId = message.audio.file_id;
          mediaType = "audio";
        }

        if (fileId) {
          await telegram("sendMessage", {
            chat_id: chatId,
            text:
              `MEDIA_FILE_ID\n\n${mediaType}\n${fileId}`
          });

          return;
        }
      }
    }

    /* ---------------- CALLBACK ---------------- */

    if (update.callback_query) {
      const query = update.callback_query;

      await answerCallback(
        query.id
      );

      const chatId =
        query.message.chat.id;

      const messageId =
        query.message.message_id;

      const data =
        query.data || "";

      await deleteMessage(
        chatId,
        messageId
      );

      if (data === "MAIN_MENU") {
        await sendMainMenu(chatId);
        return;
      }

      if (data === "CAT_aiHack") {
        await sendAiHack(chatId);
        return;
      }

      if (data.startsWith("CAT_")) {
        const category =
          data.substring(4);

        await sendCategory(
          chatId,
          category
        );

        return;
      }
    }
  } catch (error) {
    console.error(
      "Webhook Error:",
      error.message
    );
  }
});

/* =========================================================
   ADMIN AUTH
========================================================= */

function adminAuth(req, res, next) {
  const password =
    req.headers["x-admin-password"];

  if (
    !ADMIN_PASSWORD ||
    password !== ADMIN_PASSWORD
  ) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized"
    });
  }

  next();
}

/* =========================================================
   ADMIN LOGIN
========================================================= */

app.post("/api/login", (req, res) => {
  const password =
    req.body.password || "";

  if (
    ADMIN_PASSWORD &&
    password === ADMIN_PASSWORD
  ) {
    return res.json({
      ok: true
    });
  }

  return res.status(401).json({
    ok: false,
    error: "Wrong password"
  });
});

/* =========================================================
   SETTINGS
========================================================= */

app.get(
  "/api/settings",
  adminAuth,
  async (req, res) => {
    try {
      const settings =
        await getSettings();

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
  }
);

app.post(
  "/api/settings",
  adminAuth,
  async (req, res) => {
    try {
      const settings =
        await saveSettings(req.body);

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
  }
);

/* =========================================================
   RESET
========================================================= */

app.post(
  "/api/reset",
  adminAuth,
  async (req, res) => {
    try {
      const settings =
        await saveSettings(
          clone(defaultSettings)
        );

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
  }
);

/* =========================================================
   ADMIN CONNECTION
========================================================= */

app.post(
  "/api/admin/connect-code",
  adminAuth,
  async (req, res) => {
    try {
      const settings =
        await getSettings();

      const code =
        String(
          Math.floor(
            100000 +
              Math.random() *
                900000
          )
        );

      settings.admin.connectCode =
        code;

      await saveSettings(settings);

      res.json({
        ok: true,
        code,
        instruction:
          "Open the bot and send /admin " +
          code
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error.message
      });
    }
  }
);

app.get(
  "/api/admin/status",
  adminAuth,
  async (req, res) => {
    try {
      const settings =
        await getSettings();

      res.json({
        ok: true,
        connected:
          !!settings.admin.connectedChatId
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error.message
      });
    }
  }
);

app.post(
  "/api/admin/unlink",
  adminAuth,
  async (req, res) => {
    try {
      const settings =
        await getSettings();

      settings.admin.connectedChatId =
        "";

      settings.admin.connectCode =
        "";

      await saveSettings(settings);

      res.json({
        ok: true
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error.message
      });
    }
  }
);

/* =========================================================
   MEDIA UPLOAD
========================================================= */

app.post(
  "/api/upload",
  adminAuth,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          ok: false,
          error: "No file selected"
        });
      }

      const settings =
        await getSettings();

      const adminChatId =
        settings.admin.connectedChatId;

      if (!adminChatId) {
        return res.status(400).json({
          ok: false,
          error:
            "Admin Telegram is not connected. Generate a connection code first."
        });
      }

      const type =
        req.body.type || "";

      const form =
        new FormData();

      form.append(
        "chat_id",
        String(adminChatId)
      );

      form.append(
        type === "photo"
          ? "photo"
          : type === "video"
          ? "video"
          : "audio",
        new Blob(
          [req.file.buffer],
          {
            type:
              req.file.mimetype ||
              "application/octet-stream"
          }
        ),
        req.file.originalname
      );

      let method = "sendAudio";

      if (type === "photo") {
        method = "sendPhoto";
      }

      if (type === "video") {
        method = "sendVideo";
      }

      const sent =
        await telegramMultipart(
          method,
          form
        );

      let fileId = "";

      if (
        type === "photo" &&
        sent.photo &&
        sent.photo.length
      ) {
        fileId =
          sent.photo[
            sent.photo.length - 1
          ].file_id;
      }

      if (
        type === "video" &&
        sent.video
      ) {
        fileId =
          sent.video.file_id;
      }

      if (
        type === "audio" &&
        sent.audio
      ) {
        fileId =
          sent.audio.file_id;
      }

      if (!fileId) {
        throw new Error(
          "Telegram did not return file_id"
        );
      }

      await deleteMessage(
        adminChatId,
        sent.message_id
      );

      res.json({
        ok: true,
        type,
        fileId
      });
    } catch (error) {
      console.error(
        "Upload error:",
        error
      );

      res.status(500).json({
        ok: false,
        error: error.message
      });
    }
  }
);

/* =========================================================
   STATUS
========================================================= */

app.get(
  "/api/status",
  adminAuth,
  async (req, res) => {
    try {
      const me =
        await telegram("getMe");

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
  }
);

/* =========================================================
   HEALTH
========================================================= */

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "telegram-bot-system"
  });
});

/* =========================================================
   ADMIN HTML
========================================================= */

app.get("/", (req, res) => {
  res.sendFile(
    __dirname + "/Admin.html"
  );
});

app.get("/Admin.html", (req, res) => {
  res.sendFile(
    __dirname + "/Admin.html"
  );
});

/* =========================================================
   WEBHOOK SETUP
========================================================= */

async function setupWebhook() {
  if (!PUBLIC_URL) {
    console.log(
      "PUBLIC URL not detected. Webhook was not set."
    );
    return;
  }

  const webhook =
    PUBLIC_URL.replace(/\/$/, "") +
    "/telegram-webhook";

  try {
    await telegram(
      "setWebhook",
      {
        url: webhook,
        drop_pending_updates: true
      }
    );

    console.log(
      "Telegram webhook:",
      webhook
    );
  } catch (error) {
    console.error(
      "Webhook setup failed:",
      error.message
    );
  }
}

/* =========================================================
   START
========================================================= */

(async () => {
  try {
    await initDatabase();

    app.listen(
      PORT,
      async () => {
        console.log(
          `Server running on port ${PORT}`
        );

        await setupWebhook();
      }
    );
  } catch (error) {
    console.error(
      "Startup error:",
      error
    );

    process.exit(1);
  }
})();
