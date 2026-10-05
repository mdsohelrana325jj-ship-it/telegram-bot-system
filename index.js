const express = require("express");
const multer = require("multer");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 10000;

const BOT_TOKEN = process.env.BOT_TOKEN || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

const PUBLIC_URL =
  process.env.RENDER_EXTERNAL_URL ||
  process.env.PUBLIC_URL ||
  "";

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    })
  : null;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024
  }
});

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

/* =========================================================
   DEFAULT DATA
========================================================= */

function button(text = "", url = "", enabled = true) {
  return {
    enabled,
    text,
    url
  };
}

function slot() {
  return {
    enabled: true,
    mediaType: "none",
    mediaSource: "upload",
    mediaId: null,
    mediaUrl: "",
    text: "",
    buttons: [
      button("OPEN", ""),
      button("💬 SUPPORT", "")
    ]
  };
}

function mainSection(name) {
  return {
    enabled: true,
    title: name,
    mediaType: "none",
    mediaSource: "upload",
    mediaId: null,
    mediaUrl: "",
    text: "",
    buttonBg: "#6842ee",
    buttonTextColor: "#ffffff",
    slots: []
  };
}

const DEFAULT_SETTINGS = {
  welcome: {
    enabled: true,
    profilePhoto: true,
    text:
      "👋 Welcome to our Telegram Bot!",
    textSize: "medium",
    mediaType: "none",
    mediaSource: "upload",
    mediaId: null,
    mediaUrl: "",
    buttonBg: "#6842ee",
    buttonTextColor: "#ffffff"
  },

  mainButtons: [
    {
      enabled: true,
      text: "🤖 AI HACK All Link Check",
      section: "aiHack"
    },
    {
      enabled: true,
      text: "🔥 VIP GROUP All Link Check",
      section: "vip"
    },
    {
      enabled: true,
      text: "💬 SUPPORT All Link Check",
      section: "support"
    },
    {
      enabled: true,
      text: "📢 OFFICIAL CHANNEL All Link Check",
      section: "official"
    },
    {
      enabled: true,
      text: "🎁 BONUS All Link Check",
      section: "bonus"
    },
    {
      enabled: true,
      text: "👨‍💻 ADMIN All Link Check",
      section: "admin"
    }
  ],

  sections: {
    aiHack: mainSection(
      "🤖 AI HACK All Link Check"
    ),

    vip: mainSection(
      "🔥 VIP GROUP All Link Check"
    ),

    support: mainSection(
      "💬 SUPPORT All Link Check"
    ),

    official: mainSection(
      "📢 OFFICIAL CHANNEL All Link Check"
    ),

    bonus: mainSection(
      "🎁 BONUS All Link Check"
    ),

    admin: mainSection(
      "👨‍💻 ADMIN All Link Check"
    )
  },

  audio: {
    enabled: false,
    mediaType: "audio",
    mediaSource: "upload",
    mediaId: null,
    mediaUrl: "",
    imageId: null,
    imageUrl: "",
    text: "",
    buttons: [
      button("🎧 OPEN", ""),
      button("💬 SUPPORT", "")
    ]
  },

  autoDelete: 0
};

/* =========================================================
   HELPERS
========================================================= */

function clone(x) {
  return JSON.parse(JSON.stringify(x));
}

function merge(a, b) {
  if (!b || typeof b !== "object") {
    return a;
  }

  for (const key of Object.keys(b)) {
    if (
      b[key] &&
      typeof b[key] === "object" &&
      !Array.isArray(b[key])
    ) {
      if (!a[key] || typeof a[key] !== "object") {
        a[key] = {};
      }

      merge(a[key], b[key]);
    } else {
      a[key] = b[key];
    }
  }

  return a;
}

let memorySettings = clone(DEFAULT_SETTINGS);

async function initDB() {
  if (!pool) {
    console.log("DATABASE_URL missing.");
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bot_settings (
      id INTEGER PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bot_media (
      id SERIAL PRIMARY KEY,
      kind TEXT NOT NULL,
      filename TEXT,
      mimetype TEXT,
      data BYTEA NOT NULL,
      file_id TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const r = await pool.query(
    "SELECT data FROM bot_settings WHERE id=1"
  );

  if (!r.rows.length) {
    await pool.query(
      "INSERT INTO bot_settings(id,data) VALUES(1,$1)",
      [JSON.stringify(DEFAULT_SETTINGS)]
    );
  }
}

async function getSettings() {
  if (!pool) {
    return clone(memorySettings);
  }

  const r = await pool.query(
    "SELECT data FROM bot_settings WHERE id=1"
  );

  if (!r.rows.length) {
    return clone(DEFAULT_SETTINGS);
  }

  return merge(
    clone(DEFAULT_SETTINGS),
    r.rows[0].data
  );
}

async function saveSettings(data) {
  const finalData = merge(
    clone(DEFAULT_SETTINGS),
    data
  );

  memorySettings = clone(finalData);

  if (pool) {
    await pool.query(
      `
      INSERT INTO bot_settings(id,data,updated_at)
      VALUES(1,$1,NOW())
      ON CONFLICT(id)
      DO UPDATE SET
        data=EXCLUDED.data,
        updated_at=NOW()
      `,
      [JSON.stringify(finalData)]
    );
  }

  return finalData;
}

/* =========================================================
   TELEGRAM
========================================================= */

async function tg(method, body = {}) {
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
      data.description || "Telegram error"
    );
  }

  return data.result;
}

async function tgForm(method, form) {
  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
    {
      method: "POST",
      body: form
    }
  );

  const data = await response.json();

  if (!data.ok) {
    throw new Error(
      data.description || "Telegram error"
    );
  }

  return data.result;
}

async function safeDelete(chatId, messageId) {
  try {
    await tg("deleteMessage", {
      chat_id: chatId,
      message_id: messageId
    });
  } catch (_) {}
}

function keyboard(buttons, bg = null) {
  const rows = [];

  for (const b of buttons || []) {
    if (!b.enabled || !b.text || !b.url) {
      continue;
    }

    rows.push([
      {
        text: b.text,
        url: b.url
      }
    ]);
  }

  return rows.length
    ? { inline_keyboard: rows }
    : undefined;
}

function mainKeyboard(settings) {
  const rows = [];

  settings.mainButtons.forEach(
    (b, i) => {
      if (!b.enabled || !b.text) return;

      rows.push([
        {
          text: b.text,
          callback_data:
            "SECTION_" + b.section
        }
      ]);
    }
  );

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
          callback_data: "MAIN"
        }
      ]
    ]
  };
}

/* =========================================================
   MEDIA DATABASE
========================================================= */

async function saveMedia(file) {
  if (!pool) {
    throw new Error(
      "DATABASE_URL is required for media upload."
    );
  }

  const r = await pool.query(
    `
    INSERT INTO bot_media
    (kind,filename,mimetype,data)
    VALUES($1,$2,$3,$4)
    RETURNING id
    `,
    [
      file.kind,
      file.originalname,
      file.mimetype,
      file.buffer
    ]
  );

  return r.rows[0].id;
}

async function getMedia(id) {
  if (!pool || !id) {
    return null;
  }

  const r = await pool.query(
    "SELECT * FROM bot_media WHERE id=$1",
    [id]
  );

  return r.rows[0] || null;
}

async function cacheFileId(id, fileId) {
  if (!pool || !id || !fileId) return;

  await pool.query(
    "UPDATE bot_media SET file_id=$1 WHERE id=$2",
    [fileId, id]
  );
}

/* =========================================================
   SEND MEDIA
========================================================= */

async function sendUploadedMedia(
  chatId,
  type,
  mediaId,
  caption,
  replyMarkup
) {
  const media = await getMedia(mediaId);

  if (!media) {
    return tg("sendMessage", {
      chat_id: chatId,
      text: caption || "Media unavailable.",
      reply_markup: replyMarkup
    });
  }

  if (media.file_id) {
    return tg(
      type === "photo"
        ? "sendPhoto"
        : type === "video"
        ? "sendVideo"
        : "sendAudio",
      {
        chat_id: chatId,
        [type]: media.file_id,
        caption: caption || undefined,
        reply_markup: replyMarkup
      }
    );
  }

  const form = new FormData();

  form.append(
    "chat_id",
    String(chatId)
  );

  form.append(
    type === "photo"
      ? "photo"
      : type === "video"
      ? "video"
      : "audio",
    new Blob(
      [media.data],
      {
        type:
          media.mimetype ||
          "application/octet-stream"
      }
    ),
    media.filename || "media"
  );

  if (caption) {
    form.append("caption", caption);
  }

  if (replyMarkup) {
    form.append(
      "reply_markup",
      JSON.stringify(replyMarkup)
    );
  }

  const method =
    type === "photo"
      ? "sendPhoto"
      : type === "video"
      ? "sendVideo"
      : "sendAudio";

  const sent =
    await tgForm(method, form);

  let fileId = "";

  if (
    type === "photo" &&
    sent.photo?.length
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

  if (fileId) {
    await cacheFileId(
      mediaId,
      fileId
    );
  }

  return sent;
}

async function sendMediaObject(
  chatId,
  obj,
  caption,
  replyMarkup
) {
  if (!obj) {
    return tg("sendMessage", {
      chat_id: chatId,
      text: caption || " ",
      reply_markup: replyMarkup
    });
  }

  const type =
    obj.mediaType || "none";

  if (
    type === "none"
  ) {
    return tg("sendMessage", {
      chat_id: chatId,
      text: caption || " ",
      reply_markup: replyMarkup
    });
  }

  if (
    obj.mediaSource === "url" &&
    obj.mediaUrl
  ) {
    return tg(
      type === "photo"
        ? "sendPhoto"
        : type === "video"
        ? "sendVideo"
        : "sendAudio",
      {
        chat_id: chatId,
        [type]: obj.mediaUrl,
        caption: caption || undefined,
        reply_markup: replyMarkup
      }
    );
  }

  if (obj.mediaId) {
    return sendUploadedMedia(
      chatId,
      type,
      obj.mediaId,
      caption,
      replyMarkup
    );
  }

  return tg("sendMessage", {
    chat_id: chatId,
    text: caption || " ",
    reply_markup: replyMarkup
  });
}

/* =========================================================
   AUTO DELETE
========================================================= */

async function autoRemove(
  chatId,
  messageId,
  seconds
) {
  if (!seconds || seconds <= 0) return;

  setTimeout(
    () =>
      safeDelete(
        chatId,
        messageId
      ),
    seconds * 1000
  );
}

/* =========================================================
   PROFILE
========================================================= */

async function sendProfile(
  chatId,
  userId
) {
  try {
    const result =
      await tg(
        "getUserProfilePhotos",
        {
          user_id: userId,
          limit: 1
        }
      );

    if (
      result.photos &&
      result.photos.length
    ) {
      const sizes =
        result.photos[0];

      const photo =
        sizes[sizes.length - 1];

      await tg("sendPhoto", {
        chat_id: chatId,
        photo: photo.file_id
      });
    }
  } catch (_) {}
}

/* =========================================================
   WELCOME / MAIN
========================================================= */

async function sendStart(
  chatId,
  user
) {
  const s =
    await getSettings();

  if (
    s.welcome.profilePhoto
  ) {
    await sendProfile(
      chatId,
      user.id
    );
  }

  const welcomeText =
    `${user.first_name || "Friend"}\n\n` +
    (s.welcome.text || "");

  const sent =
    await sendMediaObject(
      chatId,
      s.welcome,
      welcomeText,
      mainKeyboard(s)
    );

  autoRemove(
    chatId,
    sent.message_id,
    s.autoDelete
  );
}

async function sendMain(
  chatId
) {
  const s =
    await getSettings();

  const sent =
    await tg(
      "sendMessage",
      {
        chat_id: chatId,
        text:
          s.welcome.text ||
          "Welcome!",
        reply_markup:
          mainKeyboard(s)
      }
    );

  autoRemove(
    chatId,
    sent.message_id,
    s.autoDelete
  );
}

/* =========================================================
   SECTION
========================================================= */

async function sendSection(
  chatId,
  sectionName
) {
  const s =
    await getSettings();

  const section =
    s.sections[sectionName];

  if (
    !section ||
    !section.enabled
  ) {
    const x =
      await tg(
        "sendMessage",
        {
          chat_id: chatId,
          text:
            "This section is OFF.",
          reply_markup:
            backKeyboard()
        }
      );

    return x;
  }

  for (
    const item
    of section.slots || []
  ) {
    if (item.enabled === false) {
      continue;
    }

    const rows =
      keyboard(
        item.buttons
      );

    const sent =
      await sendMediaObject(
        chatId,
        item,
        item.text || "",
        rows
      );

    autoRemove(
      chatId,
      sent.message_id,
      s.autoDelete
    );
  }

  if (
    section.slots.length === 0 &&
    section.text
  ) {
    const sent =
      await sendMediaObject(
        chatId,
        section,
        section.text
      );

    autoRemove(
      chatId,
      sent.message_id,
      s.autoDelete
    );
  }

  await tg(
    "sendMessage",
    {
      chat_id: chatId,
      text: " ",
      reply_markup:
        backKeyboard()
    }
  );
}

/* =========================================================
   WEBHOOK
========================================================= */

app.post(
  "/telegram-webhook",
  async (req, res) => {
    res.sendStatus(200);

    try {
      const update =
        req.body;

      if (update.message) {
        const m =
          update.message;

        if (
          m.text === "/start" ||
          m.text?.startsWith("/start ")
        ) {
          await sendStart(
            m.chat.id,
            m.from
          );
          return;
        }
      }

      if (
        update.callback_query
      ) {
        const q =
          update.callback_query;

        await tg(
          "answerCallbackQuery",
          {
            callback_query_id:
              q.id
          }
        );

        const chatId =
          q.message.chat.id;

        await safeDelete(
          chatId,
          q.message.message_id
        );

        if (
          q.data === "MAIN"
        ) {
          await sendMain(
            chatId
          );
          return;
        }

        if (
          q.data.startsWith(
            "SECTION_"
          )
        ) {
          const section =
            q.data.replace(
              "SECTION_",
              ""
            );

          await sendSection(
            chatId,
            section
          );
        }
      }
    } catch (e) {
      console.error(
        "Webhook:",
        e.message
      );
    }
  }
);

/* =========================================================
   ADMIN AUTH
========================================================= */

function auth(req, res, next) {
  if (
    req.headers["x-admin-password"] !==
    ADMIN_PASSWORD
  ) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized"
    });
  }

  next();
}

app.post(
  "/api/login",
  (req, res) => {
    if (
      req.body.password ===
      ADMIN_PASSWORD
    ) {
      return res.json({
        ok: true
      });
    }

    res.status(401).json({
      ok: false,
      error: "Wrong password"
    });
  }
);

/* =========================================================
   SETTINGS API
========================================================= */

app.get(
  "/api/settings",
  auth,
  async (req, res) => {
    try {
      res.json({
        ok: true,
        settings:
          await getSettings()
      });
    } catch (e) {
      res.status(500).json({
        ok: false,
        error: e.message
      });
    }
  }
);

app.post(
  "/api/settings",
  auth,
  async (req, res) => {
    try {
      res.json({
        ok: true,
        settings:
          await saveSettings(
            req.body
          )
      });
    } catch (e) {
      res.status(500).json({
        ok: false,
        error: e.message
      });
    }
  }
);

app.post(
  "/api/reset",
  auth,
  async (req, res) => {
    try {
      res.json({
        ok: true,
        settings:
          await saveSettings(
            clone(
              DEFAULT_SETTINGS
            )
          )
      });
    } catch (e) {
      res.status(500).json({
        ok: false,
        error: e.message
      });
    }
  }
);

/* =========================================================
   MEDIA UPLOAD
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
          error:
            "Select a file."
        });
      }

      const kind =
        req.body.kind;

      if (
        ![
          "photo",
          "video",
          "audio"
        ].includes(kind)
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Invalid media type."
        });
      }

      const id =
        await saveMedia({
          kind,
          originalname:
            req.file.originalname,
          mimetype:
            req.file.mimetype,
          buffer:
            req.file.buffer
        });

      res.json({
        ok: true,
        id
      });
    } catch (e) {
      res.status(500).json({
        ok: false,
        error: e.message
      });
    }
  }
);

/* =========================================================
   HEALTH
========================================================= */

app.get(
  "/health",
  (req, res) =>
    res.json({
      ok: true
    })
);

/* =========================================================
   ADMIN FILE
========================================================= */

app.get(
  "/",
  (req, res) =>
    res.sendFile(
      __dirname +
        "/Admin.html"
    )
);

app.get(
  "/Admin.html",
  (req, res) =>
    res.sendFile(
      __dirname +
        "/Admin.html"
    )
);

/* =========================================================
   WEBHOOK SETUP
========================================================= */

async function setWebhook() {
  if (!PUBLIC_URL) {
    console.log(
      "Render URL not found."
    );
    return;
  }

  const url =
    PUBLIC_URL.replace(
      /\/$/,
      ""
    ) +
    "/telegram-webhook";

  try {
    await tg(
      "setWebhook",
      {
        url,
        drop_pending_updates:
          true
      }
    );

    console.log(
      "Webhook:",
      url
    );
  } catch (e) {
    console.error(
      "Webhook error:",
      e.message
    );
  }
}

/* =========================================================
   START SERVER
========================================================= */

(async () => {
  try {
    await initDB();

    app.listen(
      PORT,
      async () => {
        console.log(
          "Server running:",
          PORT
        );

        await setWebhook();
      }
    );
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
