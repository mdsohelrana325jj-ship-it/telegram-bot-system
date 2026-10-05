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

app.use(express.json({ limit: "2mb" }));
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
   DEFAULT SETTINGS
========================================================= */

function slotDefault() {
  return {
    enabled: true,

    mediaType: "none",
    mediaSource: "upload",
    mediaId: null,
    mediaUrl: "",

    text: "",

    button1: {
      enabled: true,
      text: "OPEN LINK",
      url: "",
      color: "#6d5dfc",
      imageUrl: ""
    },

    button2: {
      enabled: false,
      text: "SUPPORT",
      url: "",
      color: "#6d5dfc",
      imageUrl: ""
    }
  };
}

function mainDefault(id, text) {
  return {
    id,
    enabled: true,

    text,

    /*
      Admin Panel color
    */
    buttonColor: "#6d5dfc",

    /*
      Empty means buttonColor will decide
      Telegram style.
    */
    buttonStyle: "",

    /*
      This is NOT placed inside Telegram's
      inline button. Telegram does not allow
      image background inside inline buttons.

      It will be shown as the 2:1 visual
      media above that button.
    */
    buttonImageUrl: "",

    /*
      Header media for the selected
      button page.
    */
    headerMediaType: "none",
    headerMediaSource: "upload",
    headerMediaId: null,
    headerMediaUrl: "",

    headerText: "",

    slots: []
  };
}

function defaultSettings() {
  return {
    autoDelete: 0,

    /* =====================================================
       WELCOME
    ===================================================== */

    welcome: {
      profilePhoto: true,

      mediaType: "none",
      mediaSource: "upload",

      mediaId: null,
      mediaUrl: "",

      text:
        "👋 Welcome to our Telegram Bot!"
    },

    /* =====================================================
       SIX MAIN BUTTONS
    ===================================================== */

    mainButtons: [
      mainDefault(
        "ai",
        "🤖 AI HACK All Link Check"
      ),

      mainDefault(
        "vip",
        "🔥 VIP GROUP All Link Check"
      ),

      mainDefault(
        "support",
        "💬 SUPPORT All Link Check"
      ),

      mainDefault(
        "official",
        "📢 OFFICIAL CHANNEL All Link Check"
      ),

      mainDefault(
        "bonus",
        "🎁 BONUS All Link Check"
      ),

      mainDefault(
        "admin",
        "👨‍💻 ADMIN All Link Check"
      )
    ],

    /* =====================================================
       AUDIO
    ===================================================== */

    audio: {
      enabled: false,

      text: "",

      mediaType: "audio",
      mediaSource: "upload",

      mediaId: null,
      mediaUrl: "",

      button1: {
        enabled: true,
        text: "OPEN LINK",
        url: "",
        color: "#6d5dfc",
        imageUrl: ""
      },

      button2: {
        enabled: false,
        text: "SUPPORT",
        url: "",
        color: "#6d5dfc",
        imageUrl: ""
      }
    }
  };
}

function clone(obj) {
  return JSON.parse(
    JSON.stringify(obj)
  );
}

/* =========================================================
   SETTINGS MERGE
========================================================= */

function mergeSettings(
  current,
  defaults
) {
  if (
    !current ||
    typeof current !== "object"
  ) {
    return clone(defaults);
  }

  const result =
    clone(defaults);

  for (
    const key of Object.keys(current)
  ) {
    if (
      current[key] &&
      typeof current[key] === "object" &&
      !Array.isArray(current[key]) &&
      result[key] &&
      typeof result[key] === "object" &&
      !Array.isArray(result[key])
    ) {
      result[key] = {
        ...result[key],
        ...current[key]
      };
    } else {
      result[key] =
        current[key];
    }
  }

  /*
    MAIN BUTTONS
  */

  if (
    Array.isArray(
      current.mainButtons
    )
  ) {
    result.mainButtons =
      current.mainButtons.map(
        (
          button,
          index
        ) => {
          const base =
            mainDefault(
              button.id ||
                `button_${index}`,

              button.text ||
                `Button ${
                  index + 1
                }`
            );

          return {
            ...base,
            ...button,

            slots:
              Array.isArray(
                button.slots
              )
                ? button.slots
                : []
          };
        }
      );
  }

  return result;
}

/* =========================================================
   DATABASE INITIALIZE
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

  const result =
    await pool.query(
      `
        SELECT id
        FROM bot_settings
        WHERE id = 1
      `
    );

  if (
    !result.rows.length
  ) {
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
   GET SETTINGS
========================================================= */

async function getSettings() {
  const result =
    await pool.query(
      `
        SELECT data
        FROM bot_settings
        WHERE id = 1
      `
    );

  const data =
    result.rows[0]?.data ||
    defaultSettings();

  return mergeSettings(
    data,
    defaultSettings()
  );
}

/* =========================================================
   SAVE SETTINGS
========================================================= */

async function saveSettings(
  data
) {
  await pool.query(
    `
      UPDATE bot_settings
      SET
        data = $1,
        updated_at = NOW()
      WHERE id = 1
    `,
    [
      JSON.stringify(data)
    ]
  );
}

/* =========================================================
   ADMIN LOGIN
========================================================= */

const sessions =
  new Map();

function createAdminToken() {
  const token =
    crypto
      .randomBytes(32)
      .toString("hex");

  sessions.set(
    token,
    Date.now() +
      24 *
        60 *
        60 *
        1000
  );

  return token;
}

function checkAdmin(
  req,
  res,
  next
) {
  const header =
    req.headers.authorization ||
    "";

  if (
    !header.startsWith(
      "Bearer "
    )
  ) {
    return res
      .status(401)
      .json({
        ok: false,
        error:
          "Unauthorized"
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
    sessions.delete(
      token
    );

    return res
      .status(401)
      .json({
        ok: false,
        error:
          "Session expired"
      });
  }

  next();
}

/* =========================================================
   TELEGRAM API
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

        body:
          JSON.stringify(body)
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
   TELEGRAM FILE UPLOAD
========================================================= */

async function telegramFile(
  method,
  fields,
  fileField,
  buffer,
  filename,
  mime
) {
  const form =
    new FormData();

  for (
    const [
      key,
      value
    ] of Object.entries(
      fields
    )
  ) {
    form.append(
      key,
      String(value)
    );
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

    filename ||
      "upload"
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
  if (!messageId) {
    return;
  }

  if (
    !chatMessages.has(
      chatId
    )
  ) {
    chatMessages.set(
      chatId,
      new Set()
    );
  }

  chatMessages
    .get(chatId)
    .add(messageId);

  if (
    deleteAfter > 0
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

        const set =
          chatMessages.get(
            chatId
          );

        if (set) {
          set.delete(
            messageId
          );

          if (
            !set.size
          ) {
            chatMessages.delete(
              chatId
            );
          }
        }
      },

      deleteAfter *
        1000
    );
  }
}

async function clearBotMessages(
  chatId
) {
  const ids =
    chatMessages.get(
      chatId
    );

  if (!ids) {
    return;
  }

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

  chatMessages.delete(
    chatId
  );
}

/* =========================================================
   COLOR SYSTEM
========================================================= */

function normalizeHex(
  value
) {
  const v =
    String(
      value || ""
    )
      .trim()
      .replace(
        /^#/,
        ""
      );

  if (
    /^[0-9a-fA-F]{6}$/.test(
      v
    )
  ) {
    return v.toLowerCase();
  }

  return null;
}

/*
  IMPORTANT:

  Telegram does NOT allow an arbitrary HEX
  color on an inline keyboard button.

  Telegram currently supports predefined
  button styles:

  primary
  success
  danger

  Therefore:

  Admin HEX color
          ↓
  nearest Telegram style
          ↓
  actual button

  Most importantly, buttonColor has priority
  over old buttonStyle="primary".
*/

function telegramButtonStyle(
  button
) {
  const hex =
    normalizeHex(
      button?.buttonColor ??
        button?.color
    );

  /*
    If Admin has a HEX color,
    use that FIRST.
  */

  if (hex) {
    const r =
      parseInt(
        hex.slice(0, 2),
        16
      );

    const g =
      parseInt(
        hex.slice(2, 4),
        16
      );

    const b =
      parseInt(
        hex.slice(4, 6),
        16
      );

    const presets = [
      {
        style:
          "primary",

        r: 51,
        g: 144,
        b: 238
      },

      {
        style:
          "success",

        r: 49,
        g: 181,
        b: 69
      },

      {
        style:
          "danger",

        r: 229,
        g: 57,
        b: 53
      }
    ];

    let best =
      presets[0];

    let distance =
      Infinity;

    for (
      const preset
      of presets
    ) {
      const d =
        Math.pow(
          r -
            preset.r,
          2
        ) +

        Math.pow(
          g -
            preset.g,
          2
        ) +

        Math.pow(
          b -
            preset.b,
          2
        );

      if (
        d <
        distance
      ) {
        distance =
          d;

        best =
          preset;
      }
    }

    return best.style;
  }

  /*
    Only if there is no HEX,
    use explicit style.
  */

  const explicit =
    String(
      button?.buttonStyle ||
        button?.style ||
        ""
    ).toLowerCase();

  if (
    [
      "primary",
      "success",
      "danger"
    ].includes(
      explicit
    )
  ) {
    return explicit;
  }

  return undefined;
}

/* =========================================================
   MAIN BUTTON OBJECT
========================================================= */

function makeMainButton(
  button
) {
  const item = {
    text:
      button.text ||
      button.id ||
      "BUTTON",

    callback_data:
      `main:${button.id}`
  };

  const style =
    telegramButtonStyle(
      button
    );

  if (style) {
    item.style =
      style;
  }

  return item;
}

/* =========================================================
   OLD MAIN KEYBOARD
========================================================= */

function mainKeyboard(
  settings
) {
  const rows =
    [];

  for (
    const button
    of settings.mainButtons ||
      []
  ) {
    if (
      !button.enabled
    ) {
      continue;
    }

    rows.push([
      makeMainButton(
        button
      )
    ]);
  }

  return {
    inline_keyboard:
      rows
  };
}

/* =========================================================
   SINGLE MAIN BUTTON KEYBOARD
========================================================= */

function oneMainButtonKeyboard(
  button
) {
  return {
    inline_keyboard: [
      [
        makeMainButton(
          button
        )
      ]
    ]
  };
}

/* =========================================================
   BACK
========================================================= */

function backKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text:
            "⬅️ BACK",

          callback_data:
            "back:main",

          style:
            "primary"
        }
      ]
    ]
  };
}

/* =========================================================
   SLOT BUTTONS
========================================================= */

function slotKeyboard(
  slot
) {
  const buttons =
    [];

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
      !button.url
    ) {
      continue;
    }

    const item = {
      text:
        button.text ||
        "OPEN",

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

    buttons.push(
      item
    );
  }

  if (
    !buttons.length
  ) {
    return undefined;
  }

  return {
    inline_keyboard:
      [
        buttons
      ]
  };
}

/* =========================================================
   MEDIA DATABASE
========================================================= */

async function getMedia(
  mediaId
) {
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

function mediaMethod(
  type
) {
  if (
    type === "photo"
  ) {
    return [
      "sendPhoto",
      "photo"
    ];
  }

  if (
    type === "video"
  ) {
    return [
      "sendVideo",
      "video"
    ];
  }

  if (
    type === "audio"
  ) {
    return [
      "sendAudio",
      "audio"
    ];
  }

  return null;
}

/* =========================================================
   UPLOAD DATABASE MEDIA DIRECTLY TO USER
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
    caption.length <=
      1024
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

  let fileId =
    null;

  if (
    media.kind ===
    "photo"
  ) {
    fileId =
      result
        .photo?.[
          result.photo.length -
            1
        ]?.file_id ||
      null;
  }

  else if (
    media.kind ===
    "video"
  ) {
    fileId =
      result.video
        ?.file_id ||
      null;
  }

  else if (
    media.kind ===
    "audio"
  ) {
    fileId =
      result.audio
        ?.file_id ||
      null;
  }

  /*
    Save Telegram file_id
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
      settings?.autoDelete ||
        0
    )
  );

  /*
    Telegram caption max
    */

  if (
    caption &&
    caption.length >
      1024
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
  if (!text) {
    return null;
  }

  const message =
    await telegram(
      "sendMessage",
      {
        chat_id:
          chatId,

        text:

          text,

        reply_markup:
          markup ||
          undefined
      }
    );

  rememberMessage(
    chatId,

    message.message_id,

    Number(
      settings?.autoDelete ||
        0
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
  /*
    No media
  */

  if (
    !mediaType ||
    mediaType === "none"
  ) {
    return sendText(
      chatId,

      text,

      markup,

      settings
    );
  }

  let source =
    mediaUrl ||
    "";

  let dbMedia =
    null;

  /*
    Uploaded media
  */

  if (
    mediaSource ===
      "upload" &&
    mediaId
  ) {
    dbMedia =
      await getMedia(
        mediaId
      );

    if (!dbMedia) {
      console.error(
        "Media not found:",
        mediaId
      );
    }
  }

  /*
    Existing Telegram file_id
  */

  if (
    dbMedia &&
    dbMedia.telegram_file_id
  ) {
    source =
      dbMedia.telegram_file_id;
  }

  /*
    Uploaded media has not yet
    been sent to Telegram.
  */

  if (
    dbMedia &&
    !dbMedia.telegram_file_id
  ) {
    try {
      return await uploadDbMediaToUser(
        chatId,

        dbMedia,

        text,

        markup,

        settings
      );
    }

    catch (error) {
      console.error(
        "Database media upload failed:",
        error.message
      );

      /*
        Still show text if
        media upload fails.
      */

      return sendText(
        chatId,

        text,

        markup,

        settings
      );
    }
  }

  /*
    No usable source
  */

  if (!source) {
    return sendText(
      chatId,

      text,

      markup,

      settings
    );
  }

  const info =
    mediaMethod(
      mediaType
    );

  if (!info) {
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

  /*
    Caption
  */

  if (
    text &&
    text.length <=
      1024
  ) {
    payload.caption =
      text;
  }

  /*
    Buttons
  */

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

    /*
      Long text
    */

    if (
      text &&
      text.length >
        1024
    ) {
      await sendText(
        chatId,

        text,

        undefined,

        settings
      );
    }

    return message;
  }

  catch (error) {
    console.error(
      `${method} failed:`,
      error.message
    );

    /*
      If Telegram cannot
      fetch URL, don't break
      the complete system.
    */

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

async function sendUserIdentity(
  chatId,
  settings
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

    const displayName =
      name ||
      (
        chat.username
          ? `@${chat.username}`
          : "User"
      );

    return sendText(
      chatId,

      `👤 ${displayName}`,

      undefined,

      settings
    );
  }

  catch (error) {
    console.error(
      "getChat error:",
      error.message
    );

    return null;
  }
}

/* =========================================================
   PROFILE PHOTO
========================================================= */

async function sendProfilePhoto(
  chatId,
  settings
) {
  if (
    !settings.welcome
      ?.profilePhoto
  ) {
    return;
  }

  try {
    const result =
      await telegram(
        "getUserProfilePhotos",
        {
          user_id:
            chatId,

          offset:
            0,

          limit:
            1
        }
      );

    const photos =
      result.photos ||
      [];

    const photo =
      photos[0]?.[
        photos[0].length -
          1
      ];

    if (!photo) {
      return;
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

      message.message_id
    );
  }

  catch (error) {
    console.error(
      "Profile photo error:",
      error.message
    );
  }
}

/* =========================================================
   MAIN BUTTON SECTION
========================================================= */

/*
  MAIN WELCOME SCREEN:

  Profile Photo
       ↓
  Profile Name
       ↓
  Welcome Media
       ↓
  Welcome Text
       ↓

  Button 1 media
  Button 1
       ↓
  Button 2 media
  Button 2
       ↓
  ...
  Button 6 media
  Button 6

  Telegram cannot put an image INSIDE the
  inline button. Therefore buttonImageUrl
  becomes the visual media immediately ABOVE
  that button.
*/

async function sendMainButtonSection(
  chatId,
  button,
  settings
) {
  const keyboard =
    oneMainButtonKeyboard(
      button
    );

  /*
    PRIORITY:

    1. Button Background Image URL
       -> displayed above the button

    2. Header Media
       -> if no button image exists

    3. Header Text
  */

  if (
    button.buttonImageUrl
  ) {
    await sendConfiguredMedia(
      chatId,

      "photo",

      "url",

      null,

      button.buttonImageUrl,

      button.headerText ||
        "",

      keyboard,

      settings
    );

    return;
  }

  /*
    Header Media
  */

  if (
    button.headerMediaType &&
    button.headerMediaType !==
      "none"
  ) {
    await sendConfiguredMedia(
      chatId,

      button.headerMediaType,

      button.headerMediaSource,

      button.headerMediaId,

      button.headerMediaUrl,

      button.headerText ||
        "",

      keyboard,

      settings
    );

    return;
  }

  /*
    No media:
    put button directly below
    its text.
  */

  if (
    button.headerText
  ) {
    await sendText(
      chatId,

      button.headerText,

      keyboard,

      settings
    );

    return;
  }

  /*
    No media and no text.
    Telegram needs a message in order
    to display an inline keyboard.
  */

  await sendText(
    chatId,

    "\u2063",

    keyboard,

    settings
  );
}

/* =========================================================
   MAIN WELCOME PAGE
========================================================= */

async function showMainPage(
  chatId
) {
  const settings =
    await getSettings();

  /*
    Delete previous bot messages
  */

  await clearBotMessages(
    chatId
  );

  /*
    1. Profile Photo
  */

  await sendProfilePhoto(
    chatId,

    settings
  );

  /*
    2. Profile Name
  */

  await sendUserIdentity(
    chatId,

    settings
  );

  /*
    3. Welcome Media + Welcome Text
  */

  await sendConfiguredMedia(
    chatId,

    settings.welcome
      ?.mediaType,

    settings.welcome
      ?.mediaSource,

    settings.welcome
      ?.mediaId,

    settings.welcome
      ?.mediaUrl,

    settings.welcome
      ?.text ||
      "",

    undefined,

    settings
  );

  /*
    4. Six independent
       button systems
  */

  for (
    const button
    of settings.mainButtons ||
      []
  ) {
    if (
      !button.enabled
    ) {
      continue;
    }

    await sendMainButtonSection(
      chatId,

      button,

      settings
    );
  }
}

/* =========================================================
   SELECTED MAIN BUTTON
========================================================= */

async function showMainButton(
  chatId,
  buttonId
) {
  const settings =
    await getSettings();

  const button =
    (
      settings.mainButtons ||
      []
    ).find(
      b =>
        b.id ===
        buttonId
    );

  /*
    Clear old page
  */

  await clearBotMessages(
    chatId
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
    Selected button's
    main image/header
  */

  if (
    button.buttonImageUrl
  ) {
    await sendConfiguredMedia(
      chatId,

      "photo",

      "url",

      null,

      button.buttonImageUrl,

      button.headerText ||
        "",

      undefined,

      settings
    );
  }

  else if (
    button.headerMediaType &&
    button.headerMediaType !==
      "none"
  ) {
    await sendConfiguredMedia(
      chatId,

      button.headerMediaType,

      button.headerMediaSource,

      button.headerMediaId,

      button.headerMediaUrl,

      button.headerText ||
        "",

      undefined,

      settings
    );
  }

  else if (
    button.headerText
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
    of button.slots ||
      []
  ) {
    if (
      !slot.enabled
    ) {
      continue;
    }

    await sendConfiguredMedia(
      chatId,

      slot.mediaType,

      slot.mediaSource,

      slot.mediaId,

      slot.mediaUrl,

      slot.text,

      slotKeyboard(
        slot
      ),

      settings
    );
  }

  /*
    Back
  */

  const back =
    await telegram(
      "sendMessage",
      {
        chat_id:
          chatId,

        text:
          "⬅️ BACK",

        reply_markup:
          backKeyboard()
      }
    );

  rememberMessage(
    chatId,

    back.message_id
  );
}

/* =========================================================
   AUDIO SYSTEM
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
    settings.audio ||
    {};

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

  const rows =
    [];

  const buttons =
    [];

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
      !button.url
    ) {
      continue;
    }

    const item = {
      text:
        button.text ||
        "OPEN",

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

    buttons.push(
      item
    );
  }

  if (
    buttons.length
  ) {
    rows.push(
      buttons
    );
  }

  rows.push([
    {
      text:
        "⬅️ BACK",

      callback_data:
        "back:main",

      style:
        "primary"
    }
  ]);

  await sendConfiguredMedia(
    chatId,

    audio.mediaType,

    audio.mediaSource,

    audio.mediaId,

    audio.mediaUrl,

    audio.text ||
      "",

    {
      inline_keyboard:
        rows
    },

    settings
  );
}

/* =========================================================
   TELEGRAM UPDATE
========================================================= */

async function handleUpdate(
  update
) {
  /*
    /start
  */

  if (
    update.message
  ) {
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
      query.message
        ?.chat
        ?.id;

    const data =
      query.data ||
      "";

    if (!chatId) {
      return;
    }

    try {
      await telegram(
        "answerCallbackQuery",
        {
          callback_query_id:
            query.id
        }
      );
    }

    catch (_) {}

    /*
      BACK
    */

    if (
      data ===
      "back:main"
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
      data ===
      "audio"
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
      data.startsWith(
        "main:"
      )
    ) {
      await showMainButton(
        chatId,

        data.slice(5)
      );

      return;
    }
  }
}

/* =========================================================
   TELEGRAM WEBHOOK
========================================================= */

app.post(
  "/telegram-webhook",

  async (
    req,
    res
  ) => {
    /*
      Telegram gets immediate response
    */

    res.json({
      ok: true
    });

    try {
      await handleUpdate(
        req.body
      );
    }

    catch (error) {
      console.error(
        "Telegram update error:",
        error
      );
    }
  }
);

/* =========================================================
   ADMIN LOGIN API
========================================================= */

app.post(
  "/api/login",

  async (
    req,
    res
  ) => {
    try {
      const password =
        String(
          req.body.password ||
            ""
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
    }

    catch (error) {
      res
        .status(500)
        .json({
          ok: false,

          error:
            error.message
        });
    }
  }
);

/* =========================================================
   GET SETTINGS API
========================================================= */

app.get(
  "/api/settings",

  checkAdmin,

  async (
    req,
    res
  ) => {
    try {
      res.json({
        ok: true,

        settings:
          await getSettings()
      });
    }

    catch (error) {
      res
        .status(500)
        .json({
          ok: false,

          error:
            error.message
        });
    }
  }
);

/* =========================================================
   SAVE SETTINGS API
========================================================= */

app.post(
  "/api/settings",

  checkAdmin,

  async (
    req,
    res
  ) => {
    try {
      const settings =
        mergeSettings(
          req.body,

          defaultSettings()
        );

      await saveSettings(
        settings
      );

      res.json({
        ok: true,

        settings
      });
    }

    catch (error) {
      res
        .status(500)
        .json({
          ok: false,

          error:
            error.message
        });
    }
  }
);

/* =========================================================
   MEDIA UPLOAD
========================================================= */

const upload =
  multer({
    storage:
      multer.memoryStorage(),

    limits: {
      fileSize:
        50 *
        1024 *
        1024
    }
  });

app.post(
  "/api/upload",

  checkAdmin,

  upload.single(
    "file"
  ),

  async (
    req,
    res
  ) => {
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
        String(
          req.body.kind ||
            ""
        ).toLowerCase();

      let kind =
        null;

      /*
        Explicit Admin type
      */

      if (
        requested ===
          "photo" ||
        requested ===
          "image"
      ) {
        kind =
          "photo";
      }

      else if (
        requested ===
        "video"
      ) {
        kind =
          "video";
      }

      else if (
        requested ===
        "audio"
      ) {
        kind =
          "audio";
      }

      /*
        MIME detection
      */

      else if (
        req.file
          .mimetype
          .startsWith(
            "image/"
          )
      ) {
        kind =
          "photo";
      }

      else if (
        req.file
          .mimetype
          .startsWith(
            "video/"
          )
      ) {
        kind =
          "video";
      }

      else if (
        req.file
          .mimetype
          .startsWith(
            "audio/"
          )
      ) {
        kind =
          "audio";
      }

      if (!kind) {
        return res
          .status(400)
          .json({
            ok: false,

            error:
              "Only image, video or audio is supported"
          });
      }

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

            req.file
              .originalname,

            req.file
              .mimetype,

            req.file
              .buffer
          ]
        );

      res.json({
        ok: true,

        mediaId:
          result.rows[0]
            .id,

        kind,

        url:
          `/media/${result.rows[0].id}`
      });
    }

    catch (error) {
      console.error(
        "Upload error:",
        error
      );

      res
        .status(500)
        .json({
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

  async (
    req,
    res
  ) => {
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
            "Not found"
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
    }

    catch (error) {
      console.error(
        "Media preview error:",
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

  async (
    req,
    res
  ) => {
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
    }

    catch (error) {
      res
        .status(500)
        .json({
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

  async (
    req,
    res
  ) => {
    try {
      const settings =
        defaultSettings();

      await saveSettings(
        settings
      );

      res.json({
        ok: true,

        settings
      });
    }

    catch (error) {
      res
        .status(500)
        .json({
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

  async (
    req,
    res
  ) => {
    try {
      await pool.query(
        "SELECT 1"
      );

      res.json({
        ok: true,

        bot: true,

        database:
          true
      });
    }

    catch (error) {
      res
        .status(500)
        .json({
          ok: false,

          bot: true,

          database:
            false,

          error:
            error.message
        });
    }
  }
);

/* =========================================================
   ADMIN HTML
========================================================= */

app.get(
  "/",

  (
    req,
    res
  ) => {
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

  (
    req,
    res
  ) => {
    res.sendFile(
      path.join(
        __dirname,
        "Admin.html"
      )
    );
  }
);

/* =========================================================
   WEBHOOK
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
          webhook
      }
    );

    console.log(
      "Webhook:",
      webhook
    );
  }

  catch (error) {
    console.error(
      "Webhook error:",
      error.message
    );
  }
}

/* =========================================================
   START SERVER
========================================================= */

async function start() {
  try {
    await dbInit();

    app.listen(
      PORT,

      async () => {
        console.log(
          `Server running on ${PORT}`
        );

        await setupWebhook();
      }
    );
  }

  catch (error) {
    console.error(
      "Startup error:",
      error
    );

    process.exit(1);
  }
}

start();
