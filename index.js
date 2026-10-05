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
    text: "🤖 AI HACK All Link Check"
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
  const v = cleanText(value)
    .replace(/^#/, "");

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

    /*
      MAIN TELEGRAM BUTTON COLOR
    */
    buttonColorEnabled: true,
    buttonColor: "#6d5dfc",
    buttonStyle: "primary",

    /*
      VISUAL ABOVE MAIN BUTTON

      Telegram cannot put arbitrary image
      inside an inline keyboard button.

      So this visual is displayed ABOVE
      the actual Telegram button.
    */
    buttonVisualEnabled: false,

    buttonVisualType: "none",
    buttonVisualSource: "upload",
    buttonVisualId: null,
    buttonVisualUrl: "",

    /*
      Text immediately above the main button.
    */
    buttonVisualText: "",

    /*
      Old Admin compatibility
    */
    buttonImageEnabled: false,
    buttonImageUrl: "",

    /*
      Old header compatibility
    */
    headerMediaEnabled: false,
    headerMediaType: "none",
    headerMediaSource: "upload",
    headerMediaId: null,
    headerMediaUrl: "",
    headerText: "",

    /*
      Multiple content slots
    */
    slots: []
  };
}

/* =========================================================
   WELCOME DEFAULT
========================================================= */

function welcomeDefault() {
  return {
    /*
      User Telegram profile photo
    */
    profilePhotoEnabled: true,
    profilePhoto: true,

    /*
      Welcome media ON/OFF
    */
    mediaEnabled: false,

    mediaType: "none",
    mediaSource: "upload",
    mediaId: null,
    mediaUrl: "",

    /*
      Profile + welcome text
    */
    text: "👋 Welcome to our Telegram Bot!",

    /*
      Layout

      profile_welcome_buttons
      =
      Profile
      Name + Welcome
      Buttons

      buttons_profile_welcome
      =
      Buttons
      Profile
      Name + Welcome
    */
    layout: "profile_welcome_buttons"
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

    mainButtons: MAIN_BUTTONS.map(item =>
      mainDefault(item.id, item.text)
    ),

    audio: audioDefault()
  };
}

/* =========================================================
   DEEP MERGE
========================================================= */

function mergeObject(base, incoming) {
  if (
    !incoming ||
    typeof incoming !== "object" ||
    Array.isArray(incoming)
  ) {
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
      result[key] = mergeObject(
        result[key],
        value
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}

/* =========================================================
   NORMALIZE SLOT
========================================================= */

function normalizeSlot(slot) {
  const base = slotDefault();

  const result = mergeObject(
    base,
    slot || {}
  );

  /*
    Old button structure compatibility
  */

  if (
    result.button1 &&
    result.button1.colorEnabled === undefined
  ) {
    result.button1.colorEnabled = true;
  }

  if (
    result.button2 &&
    result.button2.colorEnabled === undefined
  ) {
    result.button2.colorEnabled = true;
  }

  /*
    If old media exists,
    automatically enable it.
  */

  if (
    result.mediaType &&
    result.mediaType !== "none"
  ) {
    if (
      result.mediaId ||
      result.mediaUrl
    ) {
      result.mediaEnabled = true;
    }
  }

  return result;
}

/* =========================================================
   NORMALIZE MAIN BUTTON
========================================================= */

function normalizeMainButton(button, index) {
  const fallback =
    MAIN_BUTTONS[index] ||
    MAIN_BUTTONS[0];

  const base = mainDefault(
    button?.id ||
      fallback.id,
    button?.text ||
      fallback.text
  );

  const result = mergeObject(
    base,
    button || {}
  );

  /*
    Old settings compatibility:
    buttonColor existed before
  */

  if (
    button &&
    button.buttonColor &&
    button.buttonColorEnabled === undefined
  ) {
    result.buttonColorEnabled = true;
  }

  /*
    Old buttonImageUrl compatibility
  */

  if (
    !result.buttonVisualUrl &&
    result.buttonImageUrl
  ) {
    result.buttonVisualUrl =
      result.buttonImageUrl;
  }

  /*
    Old image URL means visual exists
  */

  if (
    result.buttonVisualEnabled === false &&
    result.buttonVisualUrl
  ) {
    /*
      Only auto-enable if the new field
      was not intentionally supplied.
    */
    if (
      button?.buttonVisualEnabled ===
      undefined
    ) {
      result.buttonVisualEnabled = true;
    }
  }

  /*
    Old header media compatibility

    If new visual system is empty,
    old header media becomes visual.
  */

  if (
    !result.buttonVisualId &&
    !result.buttonVisualUrl &&
    result.headerMediaId
  ) {
    result.buttonVisualType =
      result.headerMediaType ||
      "none";

    result.buttonVisualSource =
      result.headerMediaSource ||
      "upload";

    result.buttonVisualId =
      result.headerMediaId;

    if (
      button?.buttonVisualEnabled ===
      undefined
    ) {
      result.buttonVisualEnabled =
        !!result.headerMediaEnabled ||
        result.headerMediaType !==
          "none";
    }
  }

  if (
    !result.buttonVisualUrl &&
    result.headerMediaUrl
  ) {
    result.buttonVisualType =
      result.headerMediaType ||
      "photo";

    result.buttonVisualSource =
      "url";

    result.buttonVisualUrl =
      result.headerMediaUrl;

    if (
      button?.buttonVisualEnabled ===
      undefined
    ) {
      result.buttonVisualEnabled = true;
    }
  }

  /*
    Old header text compatibility
  */

  if (
    !result.buttonVisualText &&
    result.headerText
  ) {
    result.buttonVisualText =
      result.headerText;
  }

  /*
    Slots
  */

  result.slots =
    Array.isArray(result.slots)
      ? result.slots.map(normalizeSlot)
      : [];

  return result;
}

/* =========================================================
   NORMALIZE SETTINGS
========================================================= */

function normalizeSettings(data) {
  const defaults =
    defaultSettings();

  if (
    !data ||
    typeof data !== "object"
  ) {
    return defaults;
  }

  const result =
    mergeObject(
      defaults,
      data
    );

  /*
    WELCOME
  */

  result.welcome =
    mergeObject(
      welcomeDefault(),
      data.welcome || {}
    );

  /*
    Old profilePhoto
    compatibility
  */

  if (
    data.welcome &&
    data.welcome.profilePhoto !==
      undefined &&
    data.welcome.profilePhotoEnabled ===
      undefined
  ) {
    result.welcome.profilePhotoEnabled =
      !!data.welcome.profilePhoto;
  }

  /*
    Old welcome media:
    if actual media exists,
    do not force it OFF.
  */

  if (
    data.welcome &&
    data.welcome.mediaEnabled ===
      undefined
  ) {
    result.welcome.mediaEnabled =
      !!(
        data.welcome.mediaId ||
        data.welcome.mediaUrl ||
        (
          data.welcome.mediaType &&
          data.welcome.mediaType !==
            "none"
        )
      );
  }

  /*
    MAIN BUTTONS
  */

  if (
    Array.isArray(data.mainButtons)
  ) {
    result.mainButtons =
      data.mainButtons.map(
        normalizeMainButton
      );
  }

  /*
    Guarantee all six
    default buttons exist.
  */

  for (
    const item of MAIN_BUTTONS
  ) {
    const exists =
      result.mainButtons.some(
        button =>
          button.id ===
          item.id
      );

    if (!exists) {
      result.mainButtons.push(
        mainDefault(
          item.id,
          item.text
        )
      );
    }
  }

  /*
    AUDIO
  */

  result.audio =
    mergeObject(
      audioDefault(),
      data.audio || {}
    );

  return result;
}

/* =========================================================
   DATABASE INIT
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

  /*
    Persistent bot message tracking.
    This survives Render restart.
  */

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bot_chat_messages (
      id BIGSERIAL PRIMARY KEY,
      chat_id BIGINT NOT NULL,
      message_id BIGINT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_bot_chat_messages_chat
    ON bot_chat_messages(chat_id)
  `);

  const result =
    await pool.query(`
      SELECT id
      FROM bot_settings
      WHERE id = 1
    `);

  if (!result.rows.length) {
    await pool.query(
      `
        INSERT INTO bot_settings
        (id, data)
        VALUES
        (1, $1)
      `,
      [
        JSON.stringify(
          defaultSettings()
        )
      ]
    );
  }
}

/* =========================================================
   SETTINGS
========================================================= */

async function getSettings() {
  const result =
    await pool.query(`
      SELECT data
      FROM bot_settings
      WHERE id = 1
    `);

  return normalizeSettings(
    result.rows[0]?.data ||
      defaultSettings()
  );
}

async function saveSettings(data) {
  const settings =
    normalizeSettings(data);

  await pool.query(
    `
      UPDATE bot_settings
      SET
        data = $1,
        updated_at = NOW()
      WHERE id = 1
    `,
    [
      JSON.stringify(settings)
    ]
  );

  return settings;
}

/* =========================================================
   ADMIN SESSION
========================================================= */

const sessions = new Map();

function createAdminToken() {
  const token =
    crypto.randomBytes(32).toString(
      "hex"
    );

  sessions.set(
    token,
    Date.now() +
      24 * 60 * 60 * 1000
  );

  return token;
}

function checkAdmin(req, res, next) {
  const header =
    req.headers.authorization || "";

  if (
    !header.startsWith("Bearer ")
  ) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized"
    });
  }

  const token =
    header.slice(7);

  const expiry =
    sessions.get(token);

  if (
    !expiry ||
    expiry < Date.now()
  ) {
    sessions.delete(token);

    return res.status(401).json({
      ok: false,
      error: "Session expired"
    });
  }

  next();
}

/* =========================================================
   TELEGRAM
========================================================= */

const TG =
  `https://api.telegram.org/bot${BOT_TOKEN}`;

async function telegram(
  method,
  body = {}
) {
  const response =
    await fetch(
      `${TG}/${method}`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify(body)
      }
    );

  const data =
    await response.json();

  if (!data.ok) {
    throw new Error(
      data.description ||
        `Telegram API error: ${method}`
    );
  }

  return data.result;
}

/* =========================================================
   TELEGRAM MULTIPART FILE
========================================================= */

async function telegramFile(
  method,
  fields,
  fileField,
  buffer,
  filename,
  mime
) {
  const form = new FormData();

  for (
    const [key, value]
    of Object.entries(fields)
  ) {
    if (
      value !== undefined &&
      value !== null
    ) {
      form.append(
        key,
        String(value)
      );
    }
  }

  form.append(
    fileField,
    new Blob(
      [buffer],
      {
        type:
          mime ||
          "application/octet-stream"
      }
    ),
    filename || "upload"
  );

  const response =
    await fetch(
      `${TG}/${method}`,
      {
        method: "POST",
        body: form
      }
    );

  const data =
    await response.json();

  if (!data.ok) {
    throw new Error(
      data.description ||
        `Telegram upload error: ${method}`
    );
  }

  return data.result;
}

/* =========================================================
   BOT MESSAGE TRACKING
========================================================= */

const chatMessages =
  new Map();

function rememberMessage(
  chatId,
  messageId,
  deleteAfter = 0
) {
  if (!chatId || !messageId) {
    return;
  }

  if (
    !chatMessages.has(chatId)
  ) {
    chatMessages.set(
      chatId,
      new Set()
    );
  }

  chatMessages
    .get(chatId)
    .add(messageId);

  /*
    Persistent tracking
  */

  pool.query(
    `
      INSERT INTO bot_chat_messages
      (chat_id, message_id)
      VALUES ($1, $2)
    `,
    [
      String(chatId),
      messageId
    ]
  ).catch(() => {});

  /*
    Auto delete
  */

  if (
    Number(deleteAfter) > 0
  ) {
    setTimeout(
      async () => {
        try {
          await telegram(
            "deleteMessage",
            {
              chat_id:
                chatId,
              message_id:
                messageId
            }
          );
        } catch (_) {}

        await pool.query(
          `
            DELETE FROM bot_chat_messages
            WHERE chat_id = $1
            AND message_id = $2
          `,
          [
            String(chatId),
            messageId
          ]
        ).catch(() => {});

        const set =
          chatMessages.get(
            chatId
          );

        if (set) {
          set.delete(
            messageId
          );

          if (!set.size) {
            chatMessages.delete(
              chatId
            );
          }
        }
      },
      Number(deleteAfter) * 1000
    );
  }
}

/* =========================================================
   CLEAR BOT MESSAGES
========================================================= */

async function clearBotMessages(
  chatId
) {
  const ids = new Set();

  /*
    Memory
  */

  const memory =
    chatMessages.get(
      chatId
    );

  if (memory) {
    for (
      const id of memory
    ) {
      ids.add(id);
    }
  }

  /*
    Database
  */

  try {
    const result =
      await pool.query(
        `
          SELECT message_id
          FROM bot_chat_messages
          WHERE chat_id = $1
        `,
        [
          String(chatId)
        ]
      );

    for (
      const row of result.rows
    ) {
      ids.add(
        Number(row.message_id)
      );
    }
  } catch (_) {}

  /*
    Delete
  */

  for (
    const messageId of ids
  ) {
    try {
      await telegram(
        "deleteMessage",
        {
          chat_id:
            chatId,
          message_id:
            messageId
        }
      );
    } catch (_) {}
  }

  /*
    Clear DB
  */

  await pool.query(
    `
      DELETE FROM bot_chat_messages
      WHERE chat_id = $1
    `,
    [
      String(chatId)
    ]
  ).catch(() => {});

  chatMessages.delete(
    chatId
  );
}

/* =========================================================
   TELEGRAM BUTTON STYLE
========================================================= */

function telegramButtonStyle(button) {
  if (
    !button ||
    button.colorEnabled === false
  ) {
    return undefined;
  }

  if (
    button.buttonColorEnabled ===
    false
  ) {
    return undefined;
  }

  /*
    Main button color
  */

  const hex =
    normalizeHex(
      button.buttonColor ||
      button.color
    );

  /*
    Telegram only has:
      primary
      success
      danger
  */

  if (hex) {
    const r =
      parseInt(
        hex.substring(0, 2),
        16
      );

    const g =
      parseInt(
        hex.substring(2, 4),
        16
      );

    const b =
      parseInt(
        hex.substring(4, 6),
        16
      );

    const presets = [
      {
        name: "primary",
        r: 51,
        g: 144,
        b: 238
      },
      {
        name: "success",
        r: 49,
        g: 181,
        b: 69
      },
      {
        name: "danger",
        r: 229,
        g: 57,
        b: 53
      }
    ];

    let nearest =
      presets[0];

    let distance =
      Infinity;

    for (
      const preset
      of presets
    ) {
      const d =
        Math.pow(
          r - preset.r,
          2
        ) +
        Math.pow(
          g - preset.g,
          2
        ) +
        Math.pow(
          b - preset.b,
          2
        );

      if (
        d < distance
      ) {
        distance = d;
        nearest = preset;
      }
    }

    return nearest.name;
  }

  const explicit =
    cleanText(
      button.buttonStyle ||
        button.style
    ).toLowerCase();

  if (
    [
      "primary",
      "success",
      "danger"
    ].includes(explicit)
  ) {
    return explicit;
  }

  return undefined;
}

/* =========================================================
   MAIN BUTTON
========================================================= */

function makeMainButton(button) {
  const item = {
    text:
      button.text ||
      button.id ||
      "BUTTON",

    callback_data:
      `main:${button.id}`
  };

  const style =
    telegramButtonStyle({
      ...button,
      buttonColorEnabled:
        button.buttonColorEnabled
    });

  if (style) {
    item.style = style;
  }

  return item;
}

/* =========================================================
   SIX BUTTON KEYBOARD
========================================================= */

function mainKeyboard(settings) {
  const rows = [];

  for (
    const button
    of settings.mainButtons || []
  ) {
    if (
      !button.enabled
    ) {
      continue;
    }

    rows.push([
      makeMainButton(button)
    ]);
  }

  return {
    inline_keyboard:
      rows
  };
}

/* =========================================================
   BACK KEYBOARD
========================================================= */

function backKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: "⬅️ BACK",
          callback_data:
            "back:main",
          style: "primary"
        }
      ]
    ]
  };
}

/* =========================================================
   SLOT KEYBOARD
========================================================= */

function slotKeyboard(slot) {
  const row = [];

  for (
    const key of [
      "button1",
      "button2"
    ]
  ) {
    const button =
      slot?.[key];

    if (
      !button ||
      !button.enabled ||
      !validUrl(button.url)
    ) {
      continue;
    }

    const item = {
      text:
        button.text ||
        "OPEN LINK",
      url:
        button.url
    };

    const style =
      telegramButtonStyle(
        button
      );

    if (style) {
      item.style =
        style;
    }

    row.push(item);
  }

  if (!row.length) {
    return undefined;
  }

  return {
    inline_keyboard: [
      row
    ]
  };
}

/* =========================================================
   MEDIA DATABASE
========================================================= */

async function getMedia(mediaId) {
  if (!mediaId) {
    return null;
  }

  const result =
    await pool.query(
      `
        SELECT
          id,
          kind,
          filename,
          mimetype,
          data,
          telegram_file_id
        FROM bot_media
        WHERE id = $1
      `,
      [mediaId]
    );

  return (
    result.rows[0] ||
    null
  );
}

/* =========================================================
   MEDIA METHOD
========================================================= */

function mediaMethod(type) {
  switch (
    String(type || "").toLowerCase()
  ) {
    case "photo":
    case "image":
      return [
        "sendPhoto",
        "photo"
      ];

    case "video":
      return [
        "sendVideo",
        "video"
      ];

    case "audio":
      return [
        "sendAudio",
        "audio"
      ];

    default:
      return null;
  }
}

/* =========================================================
   UPLOAD DB MEDIA TO USER
========================================================= */

async function uploadDbMediaToUser(
  chatId,
  media,
  caption,
  markup,
  settings
) {
  const info =
    mediaMethod(
      media.kind
    );

  if (!info) {
    return null;
  }

  const [
    method,
    field
  ] = info;

  const fields = {
    chat_id:
      chatId
  };

  if (
    caption &&
    caption.length <= 1024
  ) {
    fields.caption =
      caption;
  }

  if (markup) {
    fields.reply_markup =
      JSON.stringify(
        markup
      );
  }

  const result =
    await telegramFile(
      method,
      fields,
      field,
      media.data,
      media.filename,
      media.mimetype
    );

  let fileId = null;

  if (
    media.kind === "photo"
  ) {
    fileId =
      result.photo?.[
        result.photo.length - 1
      ]?.file_id || null;
  }

  if (
    media.kind === "video"
  ) {
    fileId =
      result.video?.file_id ||
      null;
  }

  if (
    media.kind === "audio"
  ) {
    fileId =
      result.audio?.file_id ||
      null;
  }

  /*
    Cache Telegram file_id
  */

  if (fileId) {
    await pool.query(
      `
        UPDATE bot_media
        SET telegram_file_id = $1
        WHERE id = $2
      `,
      [
        fileId,
        media.id
      ]
    );
  }

  rememberMessage(
    chatId,
    result.message_id,
    Number(
      settings?.autoDelete || 0
    )
  );

  /*
    Caption too long
  */

  if (
    caption &&
    caption.length > 1024
  ) {
    await sendText(
      chatId,
      caption,
      undefined,
      settings
    );
  }

  return result;
}

/* =========================================================
   SEND TEXT
========================================================= */

async function sendText(
  chatId,
  text,
  markup,
  settings
) {
  const value =
    String(text || "");

  /*
    Telegram does not accept an
    actually empty message.

    Invisible character keeps keyboard
    usable when there is no text.
  */

  const finalText =
    value ||
    "\u2063";

  const payload = {
    chat_id:
      chatId,
    text:
      finalText
  };

  if (markup) {
    payload.reply_markup =
      markup;
  }

  const message =
    await telegram(
      "sendMessage",
      payload
    );

  rememberMessage(
    chatId,
    message.message_id,
    Number(
      settings?.autoDelete || 0
    )
  );

  return message;
}

/* =========================================================
   SEND CONFIGURED MEDIA
========================================================= */

async function sendConfiguredMedia(
  chatId,
  mediaType,
  mediaSource,
  mediaId,
  mediaUrl,
  text,
  markup,
  settings
) {
  const requestedType =
    String(
      mediaType || "none"
    ).toLowerCase();

  /*
    MEDIA OFF
  */

  if (
    requestedType === "none"
  ) {
    return sendText(
      chatId,
      text,
      markup,
      settings
    );
  }

  let dbMedia = null;

  /*
    Uploaded media
  */

  if (
    mediaSource === "upload" &&
    mediaId
  ) {
    dbMedia =
      await getMedia(mediaId);
  }

  /*
    Actual media type from DB
  */

  const actualType =
    dbMedia?.kind ||
    requestedType;

  const info =
    mediaMethod(actualType);

  if (!info) {
    return sendText(
      chatId,
      text,
      markup,
      settings
    );
  }

  /*
    Uploaded media
  */

  if (dbMedia) {
    /*
      Cached Telegram file_id
    */

    if (
      dbMedia.telegram_file_id
    ) {
      const [
        method,
        field
      ] = info;

      const payload = {
        chat_id:
          chatId,
        [field]:
          dbMedia.telegram_file_id
      };

      if (
        text &&
        text.length <= 1024
      ) {
        payload.caption =
          text;
      }

      if (markup) {
        payload.reply_markup =
          markup;
      }

      try {
        const message =
          await telegram(
            method,
            payload
          );

        rememberMessage(
          chatId,
          message.message_id,
          Number(
            settings?.autoDelete ||
              0
          )
        );

        if (
          text &&
          text.length > 1024
        ) {
          await sendText(
            chatId,
            text,
            undefined,
            settings
          );
        }

        return message;
      } catch (error) {
        console.error(
          "Cached media send failed:",
          error.message
        );

        /*
          If cached file_id fails,
          upload again.
        */

        await pool.query(
          `
            UPDATE bot_media
            SET telegram_file_id = NULL
            WHERE id = $1
          `,
          [dbMedia.id]
        ).catch(() => {});

        dbMedia.telegram_file_id =
          null;
      }
    }

    /*
      First upload to Telegram
    */

    try {
      return await uploadDbMediaToUser(
        chatId,
        dbMedia,
        text,
        markup,
        settings
      );
    } catch (error) {
      console.error(
        "DB media upload failed:",
        error.message
      );

      return sendText(
        chatId,
        text,
        markup,
        settings
      );
    }
  }

  /*
    URL media
  */

  const source =
    cleanText(mediaUrl);

  if (!source) {
    return sendText(
      chatId,
      text,
      markup,
      settings
    );
  }

  const [
    method,
    field
  ] = info;

  const payload = {
    chat_id:
      chatId,
    [field]:
      source
  };

  if (
    text &&
    text.length <= 1024
  ) {
    payload.caption =
      text;
  }

  if (markup) {
    payload.reply_markup =
      markup;
  }

  try {
    const message =
      await telegram(
        method,
        payload
      );

    rememberMessage(
      chatId,
      message.message_id,
      Number(
        settings?.autoDelete || 0
      )
    );

    if (
      text &&
      text.length > 1024
    ) {
      await sendText(
        chatId,
        text,
        undefined,
        settings
      );
    }

    return message;
  } catch (error) {
    console.error(
      `${method} URL failed:`,
      error.message
    );

    return sendText(
      chatId,
      text,
      markup,
      settings
    );
  }
}

/* =========================================================
   USER NAME
========================================================= */

async function getUserDisplayName(
  chatId
) {
  try {
    const chat =
      await telegram(
        "getChat",
        {
          chat_id:
            chatId
        }
      );

    const name =
      [
        chat.first_name,
        chat.last_name
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

    if (name) {
      return name;
    }

    if (chat.username) {
      return `@${chat.username}`;
    }

    return "User";
  } catch (error) {
    console.error(
      "getChat:",
      error.message
    );

    return "User";
  }
}

/* =========================================================
   PROFILE PHOTO
========================================================= */

async function sendProfilePhoto(
  chatId,
  settings
) {
  const welcome =
    settings.welcome || {};

  const enabled =
    welcome.profilePhotoEnabled !==
      undefined
      ? welcome.profilePhotoEnabled
      : welcome.profilePhoto;

  if (!enabled) {
    return null;
  }

  try {
    const result =
      await telegram(
        "getUserProfilePhotos",
        {
          user_id:
            chatId,
          offset: 0,
          limit: 1
        }
      );

    const photos =
      result.photos || [];

    if (!photos.length) {
      return null;
    }

    /*
      Telegram profile photos are
      naturally square.

      Telegram decides the actual
      delivered pixel size.
    */

    const sizes =
      photos[0] || [];

    const photo =
      sizes[sizes.length - 1];

    if (!photo?.file_id) {
      return null;
    }

    const message =
      await telegram(
        "sendPhoto",
        {
          chat_id:
            chatId,
          photo:
            photo.file_id
        }
      );

    rememberMessage(
      chatId,
      message.message_id,
      Number(
        settings?.autoDelete || 0
      )
    );

    return message;
  } catch (error) {
    console.error(
      "Profile photo:",
      error.message
    );

    return null;
  }
}

/* =========================================================
   WELCOME TEXT
========================================================= */

async function getWelcomeText(
  chatId,
  settings
) {
  const name =
    await getUserDisplayName(
      chatId
    );

  const welcomeText =
    cleanText(
      settings.welcome?.text
    );

  if (
    welcomeText
  ) {
    return `👤 ${name}\n\n${welcomeText}`;
  }

  return `👤 ${name}`;
}

/* =========================================================
   WELCOME MEDIA CHECK
========================================================= */

function hasWelcomeMedia(
  welcome
) {
  if (
    !welcome ||
    welcome.mediaEnabled === false
  ) {
    return false;
  }

  if (
    !welcome.mediaType ||
    welcome.mediaType === "none"
  ) {
    return false;
  }

  return !!(
    welcome.mediaId ||
    welcome.mediaUrl
  );
}

/* =========================================================
   MAIN BUTTON VISUAL CHECK
========================================================= */

function getMainButtonVisual(
  button
) {
  if (
    !button ||
    button.buttonVisualEnabled ===
      false
  ) {
    return null;
  }

  /*
    NEW SYSTEM
  */

  if (
    button.buttonVisualType &&
    button.buttonVisualType !== "none" &&
    (
      button.buttonVisualId ||
      button.buttonVisualUrl
    )
  ) {
    return {
      type:
        button.buttonVisualType,
      source:
        button.buttonVisualSource ||
        "upload",
      id:
        button.buttonVisualId ||
        null,
      url:
        button.buttonVisualUrl ||
        "",
      text:
        button.buttonVisualText ||
        ""
    };
  }

  /*
    OLD buttonImageUrl
  */

  if (
    button.buttonImageUrl
  ) {
    return {
      type: "photo",
      source: "url",
      id: null,
      url:
        button.buttonImageUrl,
      text:
        button.buttonVisualText ||
        ""
    };
  }

  /*
    OLD header media
  */

  if (
    button.headerMediaType &&
    button.headerMediaType !== "none" &&
    (
      button.headerMediaId ||
      button.headerMediaUrl
    )
  ) {
    return {
      type:
        button.headerMediaType,
      source:
        button.headerMediaSource ||
        "upload",
      id:
        button.headerMediaId ||
        null,
      url:
        button.headerMediaUrl ||
        "",
      text:
        button.headerText ||
        button.buttonVisualText ||
        ""
    };
  }

  /*
    Text visual without media
  */

  if (
    button.buttonVisualText
  ) {
    return {
      type: "none",
      source: "upload",
      id: null,
      url: "",
      text:
        button.buttonVisualText
    };
  }

  return null;
}

/* =========================================================
   SEND MAIN BUTTON VISUAL
========================================================= */

async function sendMainButtonVisual(
  chatId,
  button,
  settings
) {
  const visual =
    getMainButtonVisual(
      button
    );

  if (!visual) {
    return null;
  }

  /*
    Text only
  */

  if (
    visual.type === "none"
  ) {
    return sendText(
      chatId,
      visual.text,
      undefined,
      settings
    );
  }

  return sendConfiguredMedia(
    chatId,

    visual.type,

    visual.source,

    visual.id,

    visual.url,

    visual.text,

    undefined,

    settings
  );
}

/* =========================================================
   SEND SIX MAIN BUTTONS
========================================================= */

async function sendSixMainButtons(
  chatId,
  settings
) {
  const enabled =
    (settings.mainButtons || [])
      .filter(
        button =>
          button.enabled
      );

  if (!enabled.length) {
    return null;
  }

  /*
    If NONE of the six buttons
    has visual media/text,
    put all six buttons in ONE
    keyboard message.
  */

  const hasAnyVisual =
    enabled.some(
      button =>
        !!getMainButtonVisual(
          button
        )
    );

  if (!hasAnyVisual) {
    return sendText(
      chatId,
      "",
      mainKeyboard(settings),
      settings
    );
  }

  /*
    Visual mode:

      media
      text
      button

      media
      text
      button
      ...
  */

  for (
    const button
    of enabled
  ) {
    await sendMainButtonVisual(
      chatId,
      button,
      settings
    );

    /*
      Actual Telegram button
    */

    await sendText(
      chatId,
      "",
      oneMainButtonKeyboard(
        button
      ),
      settings
    );
  }
}

/* =========================================================
   ONE MAIN BUTTON KEYBOARD
========================================================= */

function oneMainButtonKeyboard(
  button
) {
  return {
    inline_keyboard: [
      [
        makeMainButton(button)
      ]
    ]
  };
}

/* =========================================================
   WELCOME MEDIA + TEXT
========================================================= */

async function sendWelcomeContent(
  chatId,
  settings,
  attachKeyboard = false
) {
  const welcome =
    settings.welcome || {};

  const text =
    await getWelcomeText(
      chatId,
      settings
    );

  const keyboard =
    attachKeyboard
      ? mainKeyboard(settings)
      : undefined;

  /*
    Welcome media OFF
  */

  if (
    !hasWelcomeMedia(welcome)
  ) {
    return sendText(
      chatId,
      text,
      keyboard,
      settings
    );
  }

  /*
    Welcome media ON
  */

  return sendConfiguredMedia(
    chatId,

    welcome.mediaType,

    welcome.mediaSource,

    welcome.mediaId,

    welcome.mediaUrl,

    text,

    keyboard,

    settings
  );
}

/* =========================================================
   MAIN PAGE
========================================================= */

async function showMainPage(
  chatId
) {
  const settings =
    await getSettings();

  /*
    Remove previous bot screen
  */

  await clearBotMessages(
    chatId
  );

  const layout =
    settings.welcome?.layout ||
    "profile_welcome_buttons";

  /*
    ========================================================
    BUTTONS FIRST
    ========================================================
  */

  if (
    layout ===
    "buttons_profile_welcome"
  ) {
    await sendSixMainButtons(
      chatId,
      settings
    );

    /*
      Profile
    */

    await sendProfilePhoto(
      chatId,
      settings
    );

    /*
      Name + Welcome
    */

    await sendWelcomeContent(
      chatId,
      settings,
      false
    );

    return;
  }

  /*
    ========================================================
    DEFAULT:

    PROFILE
       ↓
    NAME + WELCOME
       ↓
    SIX BUTTONS
    ========================================================
  */

  await sendProfilePhoto(
    chatId,
    settings
  );

  /*
    If no welcome media,
    welcome text itself can contain
    the six buttons.
  */

  const enabledButtons =
    (settings.mainButtons || [])
      .filter(
        button =>
          button.enabled
      );

  const hasVisualButtons =
    enabledButtons.some(
      button =>
        !!getMainButtonVisual(
          button
        )
    );

  /*
    No visual button media:
    attach all six buttons directly
    under Welcome.
  */

  if (!hasVisualButtons) {
    await sendWelcomeContent(
      chatId,
      settings,
      true
    );

    return;
  }

  /*
    Welcome first
  */

  await sendWelcomeContent(
    chatId,
    settings,
    false
  );

  /*
    Then six button systems
  */

  await sendSixMainButtons(
    chatId,
    settings
  );
}

/* =========================================================
   SHOW SELECTED MAIN BUTTON
========================================================= */

async function showMainButton(
  chatId,
  buttonId
) {
  const settings =
    await getSettings();

  await clearBotMessages(
    chatId
  );

  const button =
    (settings.mainButtons || [])
      .find(
        item =>
          item.id ===
          buttonId
      );

  if (
    !button ||
    !button.enabled
  ) {
    await showMainPage(
      chatId
    );

    return;
  }

  /*
    Header / visual
  */

  const visual =
    getMainButtonVisual(
      button
    );

  if (visual) {
    if (
      visual.type === "none"
    ) {
      await sendText(
        chatId,
        visual.text,
        undefined,
        settings
      );
    } else {
      await sendConfiguredMedia(
        chatId,

        visual.type,

        visual.source,

        visual.id,

        visual.url,

        visual.text,

        undefined,

        settings
      );
    }
  }

  /*
    Main button title text
  */

  if (
    button.headerText &&
    !visual?.text
  ) {
    await sendText(
      chatId,
      button.headerText,
      undefined,
      settings
    );
  }

  /*
    Slots
  */

  for (
    const slot
    of button.slots || []
  ) {
    if (
      !slot ||
      !slot.enabled
    ) {
      continue;
    }

    /*
      Slot media OFF
    */

    if (
      slot.mediaEnabled === false
    ) {
      await sendText(
        chatId,
        slot.text || "",
        slotKeyboard(slot),
        settings
      );

      continue;
    }

    /*
      Slot media
    */

    await sendConfiguredMedia(
      chatId,

      slot.mediaType,

      slot.mediaSource,

      slot.mediaId,

      slot.mediaUrl,

      slot.text,

      slotKeyboard(slot),

      settings
    );
  }

  /*
    If no slots and no visual,
    still show selected title.
  */

  if (
    !visual &&
    !button.headerText &&
    !button.slots?.length
  ) {
    await sendText(
      chatId,
      button.text || "",
      undefined,
      settings
    );
  }

  /*
    BACK
  */

  await sendText(
    chatId,
    "⬅️ BACK",
    backKeyboard(),
    settings
  );
}

/* =========================================================
   AUDIO
========================================================= */

async function showAudio(
  chatId
) {
  const settings =
    await getSettings();

  await clearBotMessages(
    chatId
  );

  const audio =
    settings.audio || {};

  if (
    !audio.enabled
  ) {
    await sendText(
      chatId,
      "🎧 Audio System is currently OFF.",
      backKeyboard(),
      settings
    );

    return;
  }

  const rows = [];

  const buttons = [];

  for (
    const key of [
      "button1",
      "button2"
    ]
  ) {
    const button =
      audio[key];

    if (
      !button ||
      !button.enabled ||
      !validUrl(button.url)
    ) {
      continue;
    }

    const item = {
      text:
        button.text ||
        "OPEN LINK",
      url:
        button.url
    };

    const style =
      telegramButtonStyle(
        button
      );

    if (style) {
      item.style = style;
    }

    buttons.push(item);
  }

  if (buttons.length) {
    rows.push(buttons);
  }

  rows.push([
    {
      text: "⬅️ BACK",
      callback_data:
        "back:main",
      style: "primary"
    }
  ]);

  /*
    Audio media
  */

  if (
    audio.mediaEnabled !== false &&
    audio.mediaType &&
    audio.mediaType !== "none" &&
    (
      audio.mediaId ||
      audio.mediaUrl
    )
  ) {
    await sendConfiguredMedia(
      chatId,

      audio.mediaType,

      audio.mediaSource,

      audio.mediaId,

      audio.mediaUrl,

      audio.text || "",

      {
        inline_keyboard:
          rows
      },

      settings
    );

    return;
  }

  /*
    Audio media OFF
  */

  await sendText(
    chatId,
    audio.text || "",
    {
      inline_keyboard:
        rows
    },
    settings
  );
}

/* =========================================================
   /START + CALLBACK
========================================================= */

async function handleUpdate(
  update
) {
  /*
    /start
  */

  if (update.message) {
    const message =
      update.message;

    if (
      message.text &&
      message.text
        .trim()
        .toLowerCase() ===
        "/start"
    ) {
      await showMainPage(
        message.chat.id
      );

      return;
    }
  }

  /*
    CALLBACK
  */

  if (
    update.callback_query
  ) {
    const query =
      update.callback_query;

    const chatId =
      query.message?.chat?.id;

    const data =
      String(
        query.data || ""
      );

    if (!chatId) {
      return;
    }

    /*
      Stop Telegram loading
    */

    try {
      await telegram(
        "answerCallbackQuery",
        {
          callback_query_id:
            query.id
        }
      );
    } catch (_) {}

    /*
      BACK
    */

    if (
      data === "back:main"
    ) {
      await showMainPage(
        chatId
      );

      return;
    }

    /*
      AUDIO
    */

    if (
      data === "audio"
    ) {
      await showAudio(
        chatId
      );

      return;
    }

    /*
      MAIN BUTTON
    */

    if (
      data.startsWith("main:")
    ) {
      const buttonId =
        data.substring(5);

      await showMainButton(
        chatId,
        buttonId
      );

      return;
    }
  }
}

/* =========================================================
   WEBHOOK
========================================================= */

app.post(
  "/telegram-webhook",
  async (req, res) => {
    /*
      Respond immediately to Telegram
    */

    res.status(200).json({
      ok: true
    });

    try {
      await handleUpdate(
        req.body
      );
    } catch (error) {
      console.error(
        "Telegram update error:",
        error
      );
    }
  }
);

/* =========================================================
   ADMIN LOGIN
========================================================= */

app.post(
  "/api/login",
  async (req, res) => {
    try {
      const password =
        String(
          req.body.password || ""
        );

      if (
        password !==
        ADMIN_PASSWORD
      ) {
        return res
          .status(401)
          .json({
            ok: false,
            error:
              "Wrong password"
          });
      }

      const token =
        createAdminToken();

      res.json({
        ok: true,
        token
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          error.message
      });
    }
  }
);

/* =========================================================
   GET SETTINGS
========================================================= */

app.get(
  "/api/settings",
  checkAdmin,
  async (req, res) => {
    try {
      res.json({
        ok: true,
        settings:
          await getSettings()
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          error.message
      });
    }
  }
);

/* =========================================================
   SAVE SETTINGS
========================================================= */

app.post(
  "/api/settings",
  checkAdmin,
  async (req, res) => {
    try {
      const settings =
        await saveSettings(
          req.body
        );

      res.json({
        ok: true,
        settings
      });
    } catch (error) {
      console.error(
        "Save settings:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          error.message
      });
    }
  }
);

/* =========================================================
   UPLOAD
========================================================= */

const upload =
  multer({
    storage:
      multer.memoryStorage(),

    limits: {
      fileSize:
        MAX_UPLOAD_SIZE
    }
  });

app.post(
  "/api/upload",
  checkAdmin,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({
            ok: false,
            error:
              "No file selected"
          });
      }

      const requested =
        cleanText(
          req.body.kind
        ).toLowerCase();

      let kind = null;

      /*
        Explicit type
      */

      if (
        requested === "photo" ||
        requested === "image"
      ) {
        kind = "photo";
      }

      if (
        requested === "video"
      ) {
        kind = "video";
      }

      if (
        requested === "audio"
      ) {
        kind = "audio";
      }

      /*
        MIME detection
      */

      if (!kind) {
        const mime =
          req.file.mimetype ||
          "";

        if (
          mime.startsWith(
            "image/"
          )
        ) {
          kind = "photo";
        }

        else if (
          mime.startsWith(
            "video/"
          )
        ) {
          kind = "video";
        }

        else if (
          mime.startsWith(
            "audio/"
          )
        ) {
          kind = "audio";
        }
      }

      if (!kind) {
        return res
          .status(400)
          .json({
            ok: false,
            error:
              "Only image, video or audio is supported."
          });
      }

      /*
        PostgreSQL BYTEA
      */

      const result =
        await pool.query(
          `
            INSERT INTO bot_media
            (
              kind,
              filename,
              mimetype,
              data
            )
            VALUES
            ($1, $2, $3, $4)
            RETURNING id
          `,
          [
            kind,
            req.file.originalname,
            req.file.mimetype,
            req.file.buffer
          ]
        );

      const id =
        result.rows[0].id;

      res.json({
        ok: true,
        mediaId: id,
        kind,
        filename:
          req.file.originalname,
        mimetype:
          req.file.mimetype,
        size:
          req.file.size,
        url:
          `/media/${id}`
      });
    } catch (error) {
      console.error(
        "Upload error:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          error.message
      });
    }
  }
);

/* =========================================================
   MEDIA PREVIEW
========================================================= */

app.get(
  "/media/:id",
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
            SELECT
              mimetype,
              data,
              filename
            FROM bot_media
            WHERE id = $1
          `,
          [
            req.params.id
          ]
        );

      if (
        !result.rows.length
      ) {
        return res
          .status(404)
          .send(
            "Media not found"
          );
      }

      const media =
        result.rows[0];

      res.setHeader(
        "Content-Type",
        media.mimetype ||
          "application/octet-stream"
      );

      res.setHeader(
        "Content-Disposition",
        `inline; filename="${encodeURIComponent(
          media.filename ||
            "media"
        )}"`
      );

      res.send(
        media.data
      );
    } catch (error) {
      console.error(
        "Media preview:",
        error
      );

      res
        .status(500)
        .send(
          "Media error"
        );
    }
  }
);

/* =========================================================
   DELETE MEDIA
========================================================= */

app.delete(
  "/api/media/:id",
  checkAdmin,
  async (req, res) => {
    try {
      await pool.query(
        `
          DELETE FROM bot_media
          WHERE id = $1
        `,
        [
          req.params.id
        ]
      );

      res.json({
        ok: true
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          error.message
      });
    }
  }
);

/* =========================================================
   RESET
========================================================= */

app.post(
  "/api/reset",
  checkAdmin,
  async (req, res) => {
    try {
      const settings =
        await saveSettings(
          defaultSettings()
        );

      res.json({
        ok: true,
        settings
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          error.message
      });
    }
  }
);

/* =========================================================
   STATUS
========================================================= */

app.get(
  "/api/status",
  checkAdmin,
  async (req, res) => {
    try {
      await pool.query(
        "SELECT 1"
      );

      const me =
        await telegram(
          "getMe"
        );

      res.json({
        ok: true,
        bot: !!me,
        database: true,
        botUsername:
          me?.username ||
          ""
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        bot: false,
        database: false,
        error:
          error.message
      });
    }
  }
);

/* =========================================================
   ADMIN.HTML
========================================================= */

app.get(
  "/",
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "Admin.html"
      )
    );
  }
);

app.get(
  "/admin.html",
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "Admin.html"
      )
    );
  }
);

/* =========================================================
   WEBHOOK SETUP
========================================================= */

async function setupWebhook() {
  const base =
    process.env.RENDER_EXTERNAL_URL ||
    "https://telegram-bot-system-kgdq.onrender.com";

  const webhook =
    `${base}/telegram-webhook`;

  try {
    await telegram(
      "setWebhook",
      {
        url:
          webhook,
        allowed_updates: [
          "message",
          "callback_query"
        ]
      }
    );

    console.log(
      "Telegram webhook:",
      webhook
    );
  } catch (error) {
    console.error(
      "Webhook setup error:",
      error.message
    );
  }
}

/* =========================================================
   CLEAN EXPIRED SESSIONS
========================================================= */

setInterval(() => {
  const now =
    Date.now();

  for (
    const [
      token,
      expiry
    ] of sessions
  ) {
    if (
      expiry < now
    ) {
      sessions.delete(
        token
      );
    }
  }
}, 60 * 60 * 1000);

/* =========================================================
   START
========================================================= */

async function start() {
  try {
    await dbInit();

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
}

start();
