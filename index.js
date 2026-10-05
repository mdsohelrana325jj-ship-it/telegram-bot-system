'use strict';

const express = require('express');
const multer = require('multer');
const { Pool } = require('pg');
const crypto = require('crypto');
const path = require('path');

const app = express();

const PORT = Number(process.env.PORT || 10000);

const BOT_TOKEN =
  process.env.BOT_TOKEN || '';

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || '';

const DATABASE_URL =
  process.env.DATABASE_URL || '';

const PUBLIC_URL = (
  process.env.RENDER_EXTERNAL_URL ||
  (
    process.env.RENDER_EXTERNAL_HOSTNAME
      ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`
      : 'https://telegram-bot-system-kgdq.onrender.com'
  )
).replace(/\/$/, '');


if (!BOT_TOKEN) {
  console.warn('BOT_TOKEN is missing.');
}

if (!ADMIN_PASSWORD) {
  console.warn('ADMIN_PASSWORD is missing.');
}

if (!DATABASE_URL) {
  console.warn('DATABASE_URL is missing.');
}


/* =========================================================
   DATABASE
========================================================= */

const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,

      ssl: DATABASE_URL.includes('localhost')
        ? false
        : {
            rejectUnauthorized: false
          }
    })
  : null;


/* =========================================================
   EXPRESS
========================================================= */

app.use(
  express.json({
    limit: '2mb'
  })
);

app.use(
  express.urlencoded({
    extended: true
  })
);


/* =========================================================
   MULTER
========================================================= */

const upload = multer({

  storage:
    multer.memoryStorage(),

  limits: {
    fileSize:
      50 * 1024 * 1024
  }

});


/* =========================================================
   DEFAULT MAIN BUTTON
========================================================= */

function buttonDefault(
  id,
  text,
  color,
  style
) {

  return {

    id,

    enabled: true,

    text,


    /* =========================
       COLOR SYSTEM
    ========================= */

    buttonColorEnabled: true,

    buttonColor:
      color,

    buttonStyle:
      style || '',


    /* =========================
       VISUAL SYSTEM
       Image / Video / Audio / Text
    ========================= */

    buttonVisualEnabled: false,

    buttonVisualMediaType:
      'none',

    buttonVisualMediaSource:
      'upload',

    buttonVisualMediaId:
      null,

    buttonVisualMediaUrl:
      '',

    buttonVisualText:
      '',


    /* =========================
       OLD SYSTEM COMPATIBILITY
    ========================= */

    buttonImageEnabled:
      false,

    buttonImageUrl:
      '',


    /* =========================
       CLICKED BUTTON HEADER
    ========================= */

    headerMediaType:
      'none',

    headerMediaSource:
      'upload',

    headerMediaId:
      null,

    headerMediaUrl:
      '',

    headerText:
      '',


    /* =========================
       SLOTS
    ========================= */

    slots: []

  };

}


/* =========================================================
   DEFAULT SETTINGS
========================================================= */

function defaultSettings() {

  return {

    autoDelete:
      0,


    /* =========================
       WELCOME
    ========================= */

    welcome: {

      profilePhotoEnabled:
        true,

      profilePhoto:
        true,


      /*
        IMPORTANT

        Welcome media-এর
        ON / OFF system
      */

      mediaEnabled:
        false,


      mediaType:
        'none',

      mediaSource:
        'upload',

      mediaId:
        null,

      mediaUrl:
        '',


      text:
        '👋 Welcome to our Telegram Bot!',


      /*
        profile_welcome_buttons
        অথবা
        buttons_profile_welcome
      */

      layout:
        'profile_welcome_buttons'

    },


    /* =========================
       SIX MAIN BUTTONS
    ========================= */

    mainButtons: [

      buttonDefault(
        'ai',
        '🤖 AI HACK All Link Check',
        '#67a74a',
        'success'
      ),

      buttonDefault(
        'vip',
        '🔥 VIP GROUP All Link Check',
        '#6d5dfc',
        'primary'
      ),

      buttonDefault(
        'support',
        '💬 SUPPORT All Link Check',
        '#e89b24',
        'primary'
      ),

      buttonDefault(
        'official',
        '📢 OFFICIAL CHANNEL All Link Check🥰',
        '#ff3b30',
        'danger'
      ),

      buttonDefault(
        'bonus',
        '🎁 BONUS All Link Check',
        '#16a085',
        'success'
      ),

      buttonDefault(
        'admin',
        '👨‍💻 ADMIN All Link Check',
        '#8e44ad',
        'primary'
      )

    ],


    /* =========================
       AUDIO SYSTEM
    ========================= */

    audio: {

      enabled:
        false,

      text:
        '',

      mediaType:
        'audio',

      mediaSource:
        'url',

      mediaId:
        null,

      mediaUrl:
        '',


      button1: {

        enabled:
          false,

        text:
          '',

        url:
          '',

        color:
          '#6d5dfc',

        colorEnabled:
          true

      },


      button2: {

        enabled:
          false,

        text:
          '',

        url:
          '',

        color:
          '#6d5dfc',

        colorEnabled:
          true

      }

    }

  };

}


/* =========================================================
   CLONE
========================================================= */

function clone(value) {

  return JSON.parse(
    JSON.stringify(value)
  );

}


/* =========================================================
   VALUE CHECK
========================================================= */

function hasValue(value) {

  return (
    value !== undefined &&
    value !== null &&
    String(value).trim() !== ''
  );

}


/* =========================================================
   SLOT NORMALIZE
========================================================= */

function normalizeSlot(raw) {

  const s =
    raw || {};

  const b1 =
    s.button1 || {};

  const b2 =
    s.button2 || {};


  return {

    enabled:
      s.enabled !== false,


    mediaType:
      s.mediaType || 'none',


    mediaSource:
      s.mediaSource || 'upload',


    mediaId:
      s.mediaId ?? null,


    mediaUrl:
      s.mediaUrl || '',


    text:
      s.text || '',


    button1: {

      enabled:
        b1.enabled !== false,

      text:
        b1.text ||
        'OPEN LINK',

      url:
        b1.url ||
        '',

      color:
        b1.color ||
        '#6d5dfc',

      colorEnabled:
        b1.colorEnabled !== undefined
          ? !!b1.colorEnabled
          : true,

      buttonStyle:
        b1.buttonStyle ||
        ''

    },


    button2: {

      enabled:
        !!b2.enabled,

      text:
        b2.text ||
        'SUPPORT',

      url:
        b2.url ||
        '',

      color:
        b2.color ||
        '#6d5dfc',

      colorEnabled:
        b2.colorEnabled !== undefined
          ? !!b2.colorEnabled
          : true,

      buttonStyle:
        b2.buttonStyle ||
        ''

    }

  };

}


/* =========================================================
   NORMALIZE MAIN BUTTON
========================================================= */

function normalizeButton(
  raw,
  def
) {

  const b = {

    ...clone(def),

    ...(raw || {})

  };


  b.id =
    raw?.id ||
    def.id;


  b.enabled =
    raw?.enabled !== false;


  b.text =
    hasValue(raw?.text)
      ? String(raw.text)
      : def.text;


  /* =========================
     COLOR
  ========================= */

  b.buttonColorEnabled =
    raw?.buttonColorEnabled !== undefined
      ? !!raw.buttonColorEnabled
      : true;


  b.buttonColor =
    hasValue(
      raw?.buttonColor
    )
      ? String(
          raw.buttonColor
        )
      : def.buttonColor;


  b.buttonStyle =
    raw?.buttonStyle ||
    def.buttonStyle ||
    '';


  /* =========================
     OLD IMAGE
  ========================= */

  const legacyImage =
    hasValue(
      raw?.buttonImageUrl
    );


  const legacyImageEnabled =
    raw?.buttonImageEnabled !== undefined
      ? !!raw.buttonImageEnabled
      : legacyImage;


  /* =========================
     NEW VISUAL
  ========================= */

  const hasNewVisualFields =

    raw?.buttonVisualEnabled !==
      undefined ||

    raw?.buttonVisualMediaType !==
      undefined ||

    raw?.buttonVisualMediaId !==
      undefined ||

    raw?.buttonVisualMediaUrl !==
      undefined ||

    raw?.buttonVisualText !==
      undefined;


  b.buttonVisualEnabled =
    raw?.buttonVisualEnabled !==
      undefined

      ? !!raw.buttonVisualEnabled

      : legacyImageEnabled;


  b.buttonVisualMediaType =
    raw?.buttonVisualMediaType ||

    (
      legacyImage
        ? 'photo'
        : 'none'
    );


  b.buttonVisualMediaSource =
    raw?.buttonVisualMediaSource ||

    (
      legacyImage
        ? 'url'
        : 'upload'
    );


  b.buttonVisualMediaId =
    raw?.buttonVisualMediaId ??
    null;


  b.buttonVisualMediaUrl =
    hasValue(
      raw?.buttonVisualMediaUrl
    )

      ? String(
          raw.buttonVisualMediaUrl
        )

      : (
          legacyImage
            ? String(
                raw.buttonImageUrl
              )
            : ''
        );


  b.buttonVisualText =
    raw?.buttonVisualText ||
    '';


  /* =========================
     LEGACY MIRROR
  ========================= */

  b.buttonImageEnabled =
    b.buttonVisualEnabled;


  b.buttonImageUrl =

    b.buttonVisualMediaType ===
      'photo' &&

    b.buttonVisualMediaSource ===
      'url'

      ? b.buttonVisualMediaUrl

      : (
          raw?.buttonImageUrl ||
          ''
        );


  /* =========================
     HEADER
  ========================= */

  b.headerMediaType =
    raw?.headerMediaType ||
    'none';


  b.headerMediaSource =
    raw?.headerMediaSource ||
    'upload';


  b.headerMediaId =
    raw?.headerMediaId ??
    null;


  b.headerMediaUrl =
    raw?.headerMediaUrl ||
    '';


  b.headerText =
    raw?.headerText ||
    '';


  /*
    পুরোনো system থেকে migration

    যদি নতুন Visual system না থাকে,
    তাহলে পুরোনো Header media-কে
    button visual হিসেবে ব্যবহার করবে।
  */

  if (
    !hasNewVisualFields &&
    !legacyImage &&
    !b.buttonVisualEnabled
  ) {

    if (
      b.headerMediaType !==
        'none' &&

      (
        b.headerMediaId ||
        b.headerMediaUrl
      )
    ) {

      b.buttonVisualEnabled =
        true;

      b.buttonVisualMediaType =
        b.headerMediaType;

      b.buttonVisualMediaSource =
        b.headerMediaSource;

      b.buttonVisualMediaId =
        b.headerMediaId;

      b.buttonVisualMediaUrl =
        b.headerMediaUrl;

      b.buttonVisualText =
        b.headerText ||
        '';

    }

    else if (
      b.headerText
    ) {

      b.buttonVisualEnabled =
        true;

      b.buttonVisualMediaType =
        'none';

      b.buttonVisualMediaSource =
        'upload';

      b.buttonVisualText =
        b.headerText;

    }

  }


  /* =========================
     SLOTS
  ========================= */

  const rawSlots =
    Array.isArray(
      raw?.slots
    )
      ? raw.slots
      : [];


  b.slots =
    rawSlots
      .slice(0,20)
      .map(
        normalizeSlot
      );


  return b;

}


/* =========================================================
   NORMALIZE SETTINGS
========================================================= */

function normalizeSettings(raw) {

  const defaults =
    defaultSettings();

  const src =
    raw &&
    typeof raw === 'object'
      ? raw
      : {};


  const out =
    clone(
      defaults
    );


  /* =========================
     AUTO DELETE
  ========================= */

  out.autoDelete =
    Math.max(
      0,
      Math.min(
        86400,
        Number(
          src.autoDelete ||
          0
        )
      )
    );


  /* =========================
     WELCOME
  ========================= */

  const rw =
    src.welcome ||
    {};


  out.welcome.profilePhotoEnabled =

    rw.profilePhotoEnabled !==
      undefined

      ? !!rw.profilePhotoEnabled

      : (
          rw.profilePhoto !==
            undefined

            ? !!rw.profilePhoto

            : true
        );


  out.welcome.profilePhoto =
    out.welcome.profilePhotoEnabled;


  const oldWelcomeMediaConfigured =

    (
      rw.mediaType &&
      rw.mediaType !== 'none'
    ) ||

    hasValue(
      rw.mediaId
    ) ||

    hasValue(
      rw.mediaUrl
    );


  out.welcome.mediaEnabled =

    rw.mediaEnabled !==
      undefined

      ? !!rw.mediaEnabled

      : !!oldWelcomeMediaConfigured;


  out.welcome.mediaType =
    rw.mediaType ||
    'none';


  out.welcome.mediaSource =
    rw.mediaSource ||
    'upload';


  out.welcome.mediaId =
    rw.mediaId ??
    null;


  out.welcome.mediaUrl =
    rw.mediaUrl ||
    '';


  out.welcome.text =
    rw.text !== undefined
      ? String(rw.text)
      : defaults.welcome.text;


  out.welcome.layout =

    rw.layout ===
      'buttons_profile_welcome'

      ? 'buttons_profile_welcome'

      : 'profile_welcome_buttons';


  /* =========================
     MAIN BUTTONS
  ========================= */

  const rawById =
    new Map(

      (
        Array.isArray(
          src.mainButtons
        )
          ? src.mainButtons
          : []
      )

      .filter(
        x =>
          x &&
          x.id
      )

      .map(
        x => [
          String(x.id),
          x
        ]
      )

    );


  out.mainButtons =
    defaults.mainButtons.map(
      def =>
        normalizeButton(
          rawById.get(
            def.id
          ),
          def
        )
    );


  /* =========================
     AUDIO
  ========================= */

  out.audio = {

    ...clone(
      defaults.audio
    ),

    ...(src.audio || {})

  };


  out.audio.enabled =
    !!out.audio.enabled;


  out.audio.mediaType =
    'audio';


  out.audio.mediaSource =
    out.audio.mediaSource ||
    'url';


  out.audio.mediaId =
    out.audio.mediaId ??
    null;


  out.audio.mediaUrl =
    out.audio.mediaUrl ||
    '';


  out.audio.text =
    out.audio.text ||
    '';


  out.audio.button1 = {

    ...clone(
      defaults.audio.button1
    ),

    ...(out.audio.button1 || {})

  };


  out.audio.button2 = {

    ...clone(
      defaults.audio.button2
    ),

    ...(out.audio.button2 || {})

  };


  return out;

}


/* =========================================================
   DATABASE QUERY
========================================================= */

async function dbQuery(
  text,
  params = []
) {

  if (!pool) {

    throw new Error(
      'DATABASE_URL is not configured.'
    );

  }

  return pool.query(
    text,
    params
  );

}


/* =========================================================
   DATABASE INIT
========================================================= */

async function initDb() {

  if (!pool)
    return;


  await dbQuery(`

    CREATE TABLE IF NOT EXISTS bot_settings (

      id INTEGER PRIMARY KEY,

      data JSONB NOT NULL,

      updated_at
        TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()

    )

  `);


  await dbQuery(`

    CREATE TABLE IF NOT EXISTS bot_media (

      id BIGSERIAL PRIMARY KEY,

      kind TEXT NOT NULL,

      filename TEXT NOT NULL,

      mimetype TEXT NOT NULL,

      data BYTEA NOT NULL,

      telegram_file_id TEXT,

      created_at
        TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()

    )

  `);


  await dbQuery(`

    CREATE TABLE IF NOT EXISTS bot_chat_messages (

      chat_id BIGINT NOT NULL,

      message_id BIGINT NOT NULL,

      created_at
        TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

      PRIMARY KEY (
        chat_id,
        message_id
      )

    )

  `);


  const result =
    await dbQuery(
      `
      SELECT data
      FROM bot_settings
      WHERE id=1
      LIMIT 1
      `
    );


  if (
    !result.rows.length
  ) {

    await dbQuery(

      `
      INSERT INTO
        bot_settings(
          id,
          data
        )

      VALUES(
        1,
        $1::jsonb
      )
      `,

      [
        JSON.stringify(
          defaultSettings()
        )
      ]

    );

  }

  else {

    const normalized =
      normalizeSettings(
        result.rows[0].data
      );


    await dbQuery(

      `
      UPDATE bot_settings

      SET
        data=$1::jsonb,
        updated_at=NOW()

      WHERE id=1
      `,

      [
        JSON.stringify(
          normalized
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
    await dbQuery(
      `
      SELECT data
      FROM bot_settings
      WHERE id=1
      LIMIT 1
      `
    );


  if (
    !result.rows.length
  ) {

    return normalizeSettings(
      defaultSettings()
    );

  }


  return normalizeSettings(
    result.rows[0].data
  );

}


/* =========================================================
   SAVE SETTINGS
========================================================= */

async function saveSettings(
  data
) {

  const normalized =
    normalizeSettings(
      data
    );


  await dbQuery(

    `
    INSERT INTO
      bot_settings(
        id,
        data,
        updated_at
      )

    VALUES(
      1,
      $1::jsonb,
      NOW()
    )

    ON CONFLICT(id)

    DO UPDATE SET

      data =
        EXCLUDED.data,

      updated_at =
        NOW()
    `,

    [
      JSON.stringify(
        normalized
      )
    ]

  );


  return normalized;

}


/* =========================================================
   ADMIN AUTH
========================================================= */

const adminSessions =
  new Map();

const SESSION_MS =
  7 *
  24 *
  60 *
  60 *
  1000;


function makeToken() {

  return crypto
    .randomBytes(32)
    .toString('hex');

}


function requireAdmin(
  req,
  res,
  next
) {

  const header =
    req.headers.authorization ||
    '';


  const token =
    header.startsWith(
      'Bearer '
    )

      ? header
          .slice(7)
          .trim()

      : '';


  const created =
    adminSessions.get(
      token
    );


  if (
    !token ||
    !created ||
    Date.now() -
      created >
      SESSION_MS
  ) {

    adminSessions.delete(
      token
    );


    return res
      .status(401)
      .json({

        ok:false,

        error:
          'Unauthorized'

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
  payload = {}
) {

  if (!BOT_TOKEN) {

    throw new Error(
      'BOT_TOKEN is not configured.'
    );

  }


  const response =
    await fetch(
      `${TG}/${method}`,
      {

        method:
          'POST',

        headers: {
          'Content-Type':
            'application/json'
        },

        body:
          JSON.stringify(
            payload
          )

      }
    );


  let data;


  try {

    data =
      await response.json();

  }

  catch (_) {

    throw new Error(
      `Telegram returned HTTP ${response.status}`
    );

  }


  if (!data.ok) {

    throw new Error(
      data.description ||
      `Telegram API error in ${method}`
    );

  }


  return data.result;

}


/* =========================================================
   TELEGRAM MULTIPART
========================================================= */

async function telegramMultipart(
  method,
  form
) {

  const response =
    await fetch(
      `${TG}/${method}`,
      {

        method:
          'POST',

        body:
          form

      }
    );


  const data =
    await response.json();


  if (!data.ok) {

    throw new Error(
      data.description ||
      `Telegram API error in ${method}`
    );

  }


  return data.result;

}


/* =========================================================
   TELEGRAM BUTTON STYLE
========================================================= */

function telegramButtonStyle(
  color,
  enabled,
  explicitStyle
) {

  /*
    COLOR OFF

    Telegram default style.
  */

  if (
    enabled === false
  ) {

    return undefined;

  }


  if (
    explicitStyle &&
    [
      'primary',
      'success',
      'danger'
    ].includes(
      explicitStyle
    )
  ) {

    return explicitStyle;

  }


  const c =
    String(
      color || ''
    )
    .toLowerCase()
    .replace(
      '#',
      ''
    );


  if (
    !/^[0-9a-f]{6}$/.test(c)
  ) {

    return 'primary';

  }


  const r =
    parseInt(
      c.slice(0,2),
      16
    );


  const g =
    parseInt(
      c.slice(2,4),
      16
    );


  const b =
    parseInt(
      c.slice(4,6),
      16
    );


  if (
    r > 175 &&
    r > g * 1.22 &&
    r > b * 1.22
  ) {

    return 'danger';

  }


  if (
    g > 125 &&
    g >= r * 1.12 &&
    g >= b * 1.05
  ) {

    return 'success';

  }


  return 'primary';

}


/* =========================================================
   URL BUTTON
========================================================= */

function makeUrlButton(
  button
) {

  if (
    !button ||
    button.enabled === false ||
    !hasValue(button.url) ||
    !hasValue(button.text)
  ) {

    return null;

  }


  const result = {

    text:
      String(
        button.text
      ),

    url:
      String(
        button.url
      )

  };


  const style =
    telegramButtonStyle(

      button.color,

      button.colorEnabled,

      button.buttonStyle

    );


  if (style) {

    result.style =
      style;

  }


  return result;

}


/* =========================================================
   CALLBACK BUTTON
========================================================= */

function makeCallbackButton(
  text,
  data,
  color,
  colorEnabled,
  explicitStyle
) {

  const result = {

    text,

    callback_data:
      data

  };


  const style =
    telegramButtonStyle(

      color,

      colorEnabled,

      explicitStyle

    );


  if (style) {

    result.style =
      style;

  }


  return result;

}


/* =========================================================
   MAIN CALLBACK BUTTON
========================================================= */

function mainCallbackButton(
  button
) {

  return makeCallbackButton(

    button.text,

    `main:${button.id}`,

    button.buttonColor,

    button.buttonColorEnabled,

    button.buttonStyle

  );

}


/* =========================================================
   BACK
========================================================= */

function backButton() {

  return makeCallbackButton(

    '⬅️ BACK',

    'back:main',

    '#555b6b',

    true,

    'primary'

  );

}


/* =========================================================
   SLOT KEYBOARD
========================================================= */

function slotKeyboard(
  slot
) {

  const rows = [];

  const row = [];


  const b1 =
    makeUrlButton(
      slot.button1
    );


  const b2 =
    makeUrlButton(
      slot.button2
    );


  if (b1)
    row.push(b1);


  if (b2)
    row.push(b2);


  if (
    row.length
  ) {

    rows.push(
      row
    );

  }


  return rows;

}


/* =========================================================
   MEDIA DATABASE
========================================================= */

async function getMedia(
  mediaId
) {

  if (!mediaId)
    return null;


  const result =
    await dbQuery(

      `
      SELECT
        id,
        kind,
        filename,
        mimetype,
        data,
        telegram_file_id

      FROM bot_media

      WHERE id=$1

      LIMIT 1
      `,

      [
        Number(
          mediaId
        )
      ]

    );


  return (
    result.rows[0] ||
    null
  );

}


/* =========================================================
   CACHE TELEGRAM FILE ID
========================================================= */

async function setTelegramFileId(
  mediaId,
  fileId
) {

  await dbQuery(

    `
    UPDATE bot_media

    SET
      telegram_file_id=$1

    WHERE id=$2
    `,

    [
      fileId,

      Number(
        mediaId
      )
    ]

  );

}


/* =========================================================
   BUFFER -> BLOB
========================================================= */

function inputFileForBuffer(
  media
) {

  return new Blob(
    [
      media.data
    ],

    {
      type:
        media.mimetype ||
        'application/octet-stream'
    }

  );

}


/* =========================================================
   SEND UPLOADED MEDIA
========================================================= */

async function sendUploadedMedia(
  chatId,
  media,
  caption = '',
  replyMarkup
) {

  let fileId =
    media.telegram_file_id ||
    null;


  /* =========================
     CACHED TELEGRAM FILE ID
  ========================= */

  if (fileId) {

    const payload = {

      chat_id:
        chatId

    };


    if (
      media.kind ===
        'photo'
    ) {

      payload.photo =
        fileId;

    }


    if (
      media.kind ===
        'video'
    ) {

      payload.video =
        fileId;

    }


    if (
      media.kind ===
        'audio'
    ) {

      payload.audio =
        fileId;

    }


    if (caption) {

      payload.caption =
        caption;

    }


    if (replyMarkup) {

      payload.reply_markup =
        replyMarkup;

    }


    try {

      return await telegram(

        media.kind === 'photo'
          ? 'sendPhoto'

          : media.kind === 'video'
            ? 'sendVideo'

            : 'sendAudio',

        payload

      );

    }

    catch (_) {

      fileId =
        null;

    }

  }


  /* =========================
     UPLOAD TO TELEGRAM
  ========================= */

  const form =
    new FormData();


  form.append(
    'chat_id',
    String(chatId)
  );


  form.append(

    media.kind === 'photo'
      ? 'photo'

      : media.kind === 'video'
        ? 'video'

        : 'audio',

    inputFileForBuffer(
      media
    ),

    media.filename ||
      `upload-${Date.now()}`
  );


  if (caption) {

    form.append(
      'caption',
      caption
    );

  }


  if (replyMarkup) {

    form.append(

      'reply_markup',

      JSON.stringify(
        replyMarkup
      )

    );

  }


  const result =
    await telegramMultipart(

      media.kind === 'photo'
        ? 'sendPhoto'

        : media.kind === 'video'
          ? 'sendVideo'

          : 'sendAudio',

      form

    );


  let newFileId =
    null;


  if (
    media.kind ===
      'photo'
  ) {

    newFileId =
      result
        ?.photo
        ?.at(-1)
        ?.file_id;

  }


  if (
    media.kind ===
      'video'
  ) {

    newFileId =
      result
        ?.video
        ?.file_id;

  }


  if (
    media.kind ===
      'audio'
  ) {

    newFileId =
      result
        ?.audio
        ?.file_id;

  }


  if (newFileId) {

    try {

      await setTelegramFileId(
        media.id,
        newFileId
      );

    }

    catch (_) {}

  }


  return result;

}


/* =========================================================
   SEND URL MEDIA
========================================================= */

async function sendUrlMedia(
  chatId,
  type,
  url,
  caption = '',
  replyMarkup
) {

  if (
    !hasValue(url)
  ) {

    return null;

  }


  const payload = {

    chat_id:
      chatId

  };


  if (
    type === 'photo'
  ) {

    payload.photo =
      url;

  }

  else if (
    type === 'video'
  ) {

    payload.video =
      url;

  }

  else if (
    type === 'audio'
  ) {

    payload.audio =
      url;

  }

  else {

    return null;

  }


  if (caption) {

    payload.caption =
      caption;

  }


  if (replyMarkup) {

    payload.reply_markup =
      replyMarkup;

  }


  return telegram(

    type === 'photo'
      ? 'sendPhoto'

      : type === 'video'
        ? 'sendVideo'

        : 'sendAudio',

    payload

  );

}


/* =========================================================
   SEND CONFIGURED MEDIA
========================================================= */

async function sendConfiguredMedia(
  chatId,
  cfg,
  caption = '',
  replyMarkup
) {

  const type =
    cfg?.mediaType ||
    cfg?.type ||
    'none';


  if (
    type === 'none'
  ) {

    return null;

  }


  try {

    if (
      cfg.mediaSource ===
        'upload' &&

      cfg.mediaId
    ) {

      const media =
        await getMedia(
          cfg.mediaId
        );


      if (media) {

        return await sendUploadedMedia(

          chatId,

          media,

          caption,

          replyMarkup

        );

      }

    }


    if (
      cfg.mediaUrl
    ) {

      return await sendUrlMedia(

        chatId,

        type,

        cfg.mediaUrl,

        caption,

        replyMarkup

      );

    }

  }

  catch (error) {

    console.error(
      'sendConfiguredMedia:',
      error.message
    );

  }


  return null;

}


/* =========================================================
   SEND TEXT
========================================================= */

async function sendText(
  chatId,
  text,
  replyMarkup
) {

  if (
    !hasValue(text) &&
    !replyMarkup
  ) {

    return null;

  }


  const payload = {

    chat_id:
      chatId,

    text:
      hasValue(text)
        ? String(text)
        : '\u2063'

  };


  if (replyMarkup) {

    payload.reply_markup =
      replyMarkup;

  }


  return telegram(
    'sendMessage',
    payload
  );

}


/* =========================================================
   BOT MESSAGE TRACKING
========================================================= */

const memoryMessages =
  new Map();


function rememberMessage(
  chatId,
  message
) {

  if (
    !message?.message_id
  ) {

    return message;

  }


  const cid =
    String(chatId);


  if (
    !memoryMessages.has(
      cid
    )
  ) {

    memoryMessages.set(
      cid,
      new Set()
    );

  }


  memoryMessages
    .get(cid)
    .add(
      Number(
        message.message_id
      )
    );


  dbQuery(

    `
    INSERT INTO
      bot_chat_messages(
        chat_id,
        message_id
      )

    VALUES(
      $1,
      $2
    )

    ON CONFLICT DO NOTHING
    `,

    [
      String(chatId),

      Number(
        message.message_id
      )
    ]

  )
  .catch(
    () => {}
  );


  return message;

}


/* =========================================================
   REMEMBER + AUTO DELETE
========================================================= */

async function rememberAndSchedule(
  chatId,
  message,
  settings
) {

  if (!message)
    return message;


  rememberMessage(
    chatId,
    message
  );


  const seconds =
    Number(
      settings?.autoDelete ||
      0
    );


  if (
    seconds > 0
  ) {

    setTimeout(

      async () => {

        try {

          await telegram(
            'deleteMessage',
            {
              chat_id:
                chatId,

              message_id:
                message.message_id
            }
          );

        }

        catch (_) {}


        try {

          await dbQuery(

            `
            DELETE FROM
              bot_chat_messages

            WHERE
              chat_id=$1

              AND
              message_id=$2
            `,

            [
              String(chatId),

              Number(
                message.message_id
              )
            ]

          );

        }

        catch (_) {}


        const set =
          memoryMessages.get(
            String(chatId)
          );


        if (set) {

          set.delete(
            Number(
              message.message_id
            )
          );

        }

      },

      seconds * 1000

    );

  }


  return message;

}


/* =========================================================
   CLEAR BOT MESSAGES
========================================================= */

async function clearBotMessages(
  chatId
) {

  const ids =
    new Set();


  const mem =
    memoryMessages.get(
      String(chatId)
    );


  if (mem) {

    mem.forEach(
      id =>
        ids.add(
          Number(id)
        )
    );

  }


  if (pool) {

    try {

      const result =
        await dbQuery(

          `
          SELECT
            message_id

          FROM
            bot_chat_messages

          WHERE
            chat_id=$1
          `,

          [
            String(chatId)
          ]

        );


      result.rows.forEach(
        row =>
          ids.add(
            Number(
              row.message_id
            )
          )
      );

    }

    catch (_) {}

  }


  for (
    const messageId of ids
  ) {

    try {

      await telegram(
        'deleteMessage',
        {

          chat_id:
            chatId,

          message_id:
            messageId

        }
      );

    }

    catch (_) {}

  }


  if (pool) {

    try {

      await dbQuery(

        `
        DELETE FROM
          bot_chat_messages

        WHERE
          chat_id=$1
        `,

        [
          String(chatId)
        ]

      );

    }

    catch (_) {}

  }


  memoryMessages.delete(
    String(chatId)
  );

}


/* =========================================================
   TRACKED SEND
========================================================= */

async function trackedSend(
  chatId,
  settings,
  fn
) {

  try {

    const message =
      await fn();


    if (message) {

      await rememberAndSchedule(

        chatId,

        message,

        settings

      );

    }


    return message;

  }

  catch (error) {

    console.error(
      'trackedSend:',
      error.message
    );


    return null;

  }

}


/* =========================================================
   USER NAME
========================================================= */

async function getProfileName(
  user
) {

  const first =
    user?.first_name ||
    '';


  const last =
    user?.last_name ||
    '';


  const full =
    `${first} ${last}`.trim();


  return (
    full ||
    user?.username ||
    'User'
  );

}


/* =========================================================
   MAIN BUTTONS
========================================================= */

function mainButtons(
  settings
) {

  return (

    settings.mainButtons ||
    []

  ).filter(
    b =>
      b.enabled !== false
  );

}


/* =========================================================
   BUTTON VISUAL CHECK
========================================================= */

function buttonHasVisual(
  button
) {

  if (
    !button?.buttonVisualEnabled
  ) {

    return false;

  }


  const hasMedia =

    button.buttonVisualMediaType &&
    button.buttonVisualMediaType !==
      'none' &&

    (
      button.buttonVisualMediaId ||
      button.buttonVisualMediaUrl
    );


  const hasText =
    hasValue(
      button.buttonVisualText
    );


  return !!(
    hasMedia ||
    hasText
  );

}


/* =========================================================
   MAIN BUTTON KEYBOARD
========================================================= */

function mainButtonsKeyboard(
  settings
) {

  const buttons =
    mainButtons(
      settings
    )
    .map(
      mainCallbackButton
    );


  if (
    !buttons.length
  ) {

    return undefined;

  }


  return {

    inline_keyboard:
      buttons.map(
        button =>
          [button]
      )

  };

}


/* =========================================================
   SEND MAIN BUTTON VISUAL
========================================================= */

async function sendButtonVisual(
  chatId,
  button,
  settings
) {

  if (
    !buttonHasVisual(
      button
    )
  ) {

    return null;

  }


  const visual = {

    mediaType:
      button.buttonVisualMediaType ||
      'none',

    mediaSource:
      button.buttonVisualMediaSource ||
      'upload',

    mediaId:
      button.buttonVisualMediaId ||
      null,

    mediaUrl:
      button.buttonVisualMediaUrl ||
      ''

  };


  const caption =
    button.buttonVisualText ||
    '';


  const keyboard = {

    inline_keyboard: [

      [
        mainCallbackButton(
          button
        )
      ]

    ]

  };


  if (
    visual.mediaType !==
      'none'
  ) {

    return trackedSend(

      chatId,

      settings,

      () =>
        sendConfiguredMedia(

          chatId,

          visual,

          caption,

          keyboard

        )

    );

  }


  return trackedSend(

    chatId,

    settings,

    () =>
      sendText(

        chatId,

        caption ||
          '\u2063',

        keyboard

      )

  );

}


/* =========================================================
   SEND SIX MAIN BUTTONS
========================================================= */

async function sendMainButtons(
  chatId,
  settings
) {

  const buttons =
    mainButtons(
      settings
    );


  if (
    !buttons.length
  ) {

    return null;

  }


  const anyVisual =
    buttons.some(
      buttonHasVisual
    );


  /*
    যদি কোনো Button Visual না থাকে

    তাহলে ৬টি button
    একসাথে দেখাবে।
  */

  if (
    !anyVisual
  ) {

    return trackedSend(

      chatId,

      settings,

      () =>
        sendText(

          chatId,

          '\u2063',

          mainButtonsKeyboard(
            settings
          )

        )

    );

  }


  /*
    Visual থাকা button আলাদা message
    হিসেবে দেখাবে।

    Visual-এর নিচেই
    তার button থাকবে।
  */

  for (
    const button of buttons
  ) {

    if (
      buttonHasVisual(
        button
      )
    ) {

      await sendButtonVisual(

        chatId,

        button,

        settings

      );

    }

    else {

      await trackedSend(

        chatId,

        settings,

        () =>
          sendText(

            chatId,

            '\u2063',

            {

              inline_keyboard: [

                [
                  mainCallbackButton(
                    button
                  )

                ]

              ]

            }

          )

      );

    }

  }

}


/* =========================================================
   SEND PROFILE PHOTO
========================================================= */

async function sendProfilePhoto(
  chatId,
  user,
  settings
) {

  if (
    !settings.welcome
      .profilePhotoEnabled
  ) {

    return null;

  }


  try {

    const photos =
      await telegram(

        'getUserProfilePhotos',

        {

          user_id:
            user.id,

          limit:
            1

        }

      );


    const sizes =
      photos
        ?.photos
        ?.[0] ||
      [];


    const largest =
      sizes.at(-1);


    if (
      !largest?.file_id
    ) {

      return null;

    }


    /*
      Telegram profile photo
      square format.

      Bot API দিয়ে exact
      501x501 pixel force করা
      সম্ভব নয়।
    */

    return trackedSend(

      chatId,

      settings,

      () =>
        telegram(

          'sendPhoto',

          {

            chat_id:
              chatId,

            photo:
              largest.file_id

          }

        )

    );

  }

  catch (error) {

    console.error(
      'profile photo:',
      error.message
    );


    return null;

  }

}


/* =========================================================
   COMBINED PROFILE + WELCOME
========================================================= */

function combinedWelcomeText(
  profileName,
  welcomeText
) {

  const name =
    hasValue(
      profileName
    )

      ? `👤 ${profileName}`

      : '';


  const text =
    hasValue(
      welcomeText
    )

      ? String(
          welcomeText
        )

      : '';


  return [

    name,

    text

  ].filter(
    Boolean
  ).join(
    '\n\n'
  );

}


/* =========================================================
   SEND WELCOME CONTENT
========================================================= */

async function sendWelcomeContent(
  chatId,
  user,
  settings,
  attachButtons
) {

  const profileName =
    await getProfileName(
      user
    );


  const text =
    combinedWelcomeText(

      profileName,

      settings.welcome.text

    );


  const markup =
    attachButtons

      ? mainButtonsKeyboard(
          settings
        )

      : undefined;


  /*
    Welcome media ON
  */

  if (

    settings.welcome
      .mediaEnabled &&

    settings.welcome
      .mediaType !==
        'none'

  ) {

    const result =
      await trackedSend(

        chatId,

        settings,

        () =>
          sendConfiguredMedia(

            chatId,

            settings.welcome,

            text,

            markup

          )

      );


    if (result) {

      return result;

    }

  }


  /*
    Welcome media OFF

    অথবা media fail হলে

    Profile name +
    Welcome text
  */

  if (
    text ||
    markup
  ) {

    return trackedSend(

      chatId,

      settings,

      () =>
        sendText(

          chatId,

          text ||
            '\u2063',

          markup

        )

    );

  }


  return null;

}


/* =========================================================
   SHOW MAIN PAGE
========================================================= */

async function showMainPage(
  chatId,
  user
) {

  const settings =
    await getSettings();


  /*
    পুরোনো bot messages clear
  */

  await clearBotMessages(
    chatId
  );


  const buttons =
    mainButtons(
      settings
    );


  const anyVisual =
    buttons.some(
      buttonHasVisual
    );


  const layout =
    settings.welcome.layout ||
    'profile_welcome_buttons';


  /* =======================================================
     OPTION 2

     Buttons first
     Profile
     Welcome
  ======================================================= */

  if (
    layout ===
      'buttons_profile_welcome'
  ) {

    await sendMainButtons(

      chatId,

      settings

    );


    await sendProfilePhoto(

      chatId,

      user,

      settings

    );


    await sendWelcomeContent(

      chatId,

      user,

      settings,

      false

    );


    return;

  }


  /* =======================================================
     DEFAULT

     Profile Photo
     Welcome
     Six Buttons
  ======================================================= */

  await sendProfilePhoto(

    chatId,

    user,

    settings

  );


  /*
    কোনো button-এর visual নেই

    => Welcome message-এর
       নিচেই ৬টি button
  */

  await sendWelcomeContent(

    chatId,

    user,

    settings,

    !anyVisual &&
      buttons.length > 0

  );


  /*
    Button visual থাকলে
    প্রত্যেকটা আলাদা visual
    সহ দেখাবে।
  */

  if (anyVisual) {

    await sendMainButtons(

      chatId,

      settings

    );

  }

  /*
    Welcome text/media কিছুই না থাকলে
    সরাসরি ৬টি button
  */

  else if (

    !settings.welcome.text &&

    !settings.welcome.mediaEnabled

  ) {

    await sendMainButtons(

      chatId,

      settings

    );

  }

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


  const button =
    settings.mainButtons.find(

      b =>
        b.id ===
        buttonId

    );


  if (
    !button ||
    button.enabled === false
  ) {

    return;

  }


  await clearBotMessages(
    chatId
  );


  /* =========================
     HEADER
  ========================= */

  const headerCfg = {

    mediaType:
      button.headerMediaType ||
      'none',

    mediaSource:
      button.headerMediaSource ||
      'upload',

    mediaId:
      button.headerMediaId ||
      null,

    mediaUrl:
      button.headerMediaUrl ||
      ''

  };


  if (
    headerCfg.mediaType !==
      'none'
  ) {

    const result =
      await trackedSend(

        chatId,

        settings,

        () =>
          sendConfiguredMedia(

            chatId,

            headerCfg,

            button.headerText ||
              ''

          )

      );


    if (
      !result &&
      button.headerText
    ) {

      await trackedSend(

        chatId,

        settings,

        () =>
          sendText(

            chatId,

            button.headerText

          )

      );

    }

  }

  else if (
    button.headerText
  ) {

    await trackedSend(

      chatId,

      settings,

      () =>
        sendText(

          chatId,

          button.headerText

        )

    );

  }


  /* =========================
     SLOTS
  ========================= */

  for (
    const slot of
      button.slots || []
  ) {

    if (
      slot.enabled === false
    ) {

      continue;

    }


    const rows =
      slotKeyboard(
        slot
      );


    const markup =
      rows.length

        ? {
            inline_keyboard:
              rows
          }

        : undefined;


    const cfg = {

      mediaType:
        slot.mediaType ||
        'none',

      mediaSource:
        slot.mediaSource ||
        'upload',

      mediaId:
        slot.mediaId ||
        null,

      mediaUrl:
        slot.mediaUrl ||
        ''

    };


    if (
      cfg.mediaType !==
        'none'
    ) {

      const result =
        await trackedSend(

          chatId,

          settings,

          () =>
            sendConfiguredMedia(

              chatId,

              cfg,

              slot.text ||
                '',

              markup

            )

        );


      if (
        !result &&
        slot.text
      ) {

        await trackedSend(

          chatId,

          settings,

          () =>
            sendText(

              chatId,

              slot.text,

              markup

            )

        );

      }

    }

    else if (
      slot.text ||
      markup
    ) {

      await trackedSend(

        chatId,

        settings,

        () =>
          sendText(

            chatId,

            slot.text ||
              '\u2063',

            markup

          )

      );

    }

  }


  /* =========================
     BACK
  ========================= */

  await trackedSend(

    chatId,

    settings,

    () =>
      sendText(

        chatId,

        '\u2063',

        {

          inline_keyboard: [

            [
              backButton()
            ]

          ]

        }

      )

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


  if (
    !settings.audio.enabled
  ) {

    return;

  }


  await clearBotMessages(
    chatId
  );


  const rows = [];

  const row = [];


  const b1 =
    makeUrlButton(
      settings.audio.button1
    );


  const b2 =
    makeUrlButton(
      settings.audio.button2
    );


  if (b1)
    row.push(b1);


  if (b2)
    row.push(b2);


  if (
    row.length
  ) {

    rows.push(
      row
    );

  }


  const markup =
    rows.length

      ? {
          inline_keyboard:
            rows
        }

      : undefined;


  const cfg = {

    mediaType:
      'audio',

    mediaSource:
      settings.audio.mediaSource,

    mediaId:
      settings.audio.mediaId,

    mediaUrl:
      settings.audio.mediaUrl

  };


  if (
    cfg.mediaId ||
    cfg.mediaUrl
  ) {

    const result =
      await trackedSend(

        chatId,

        settings,

        () =>
          sendConfiguredMedia(

            chatId,

            cfg,

            settings.audio.text ||
              '',

            markup

          )

      );


    if (
      !result &&
      settings.audio.text
    ) {

      await trackedSend(

        chatId,

        settings,

        () =>
          sendText(

            chatId,

            settings.audio.text,

            markup

          )

      );

    }

  }

  else if (
    settings.audio.text ||
    markup
  ) {

    await trackedSend(

      chatId,

      settings,

      () =>
        sendText(

          chatId,

          settings.audio.text ||
            '\u2063',

          markup

        )

    );

  }


  await trackedSend(

    chatId,

    settings,

    () =>
      sendText(

        chatId,

        '\u2063',

        {

          inline_keyboard: [

            [
              backButton()
            ]

          ]

        }

      )

  );

}


/* =========================================================
   HANDLE TELEGRAM UPDATE
========================================================= */

async function handleUpdate(
  update
) {

  try {

    /* =========================
       MESSAGE
    ========================= */

    if (
      update.message
    ) {

      const msg =
        update.message;


      const chatId =
        msg.chat?.id;


      if (!chatId)
        return;


      if (
        msg.text ===
          '/start' ||

        msg.text ===
          '/menu'
      ) {

        await showMainPage(

          chatId,

          msg.from ||
            {}

        );


        return;

      }


      if (
        msg.text ===
          '/audio'
      ) {

        await showAudio(
          chatId
        );

        return;

      }


      return;

    }


    /* =========================
       CALLBACK
    ========================= */

    if (
      update.callback_query
    ) {

      const query =
        update.callback_query;


      const chatId =
        query.message
          ?.chat
          ?.id;


      if (!chatId)
        return;


      try {

        await telegram(

          'answerCallbackQuery',

          {

            callback_query_id:
              query.id

          }

        );

      }

      catch (_) {}


      /* =========================
         BACK
      ========================= */

      if (
        query.data ===
          'back:main'
      ) {

        await showMainPage(

          chatId,

          query.from ||
            {}

        );


        return;

      }


      /* =========================
         AUDIO
      ========================= */

      if (
        query.data ===
          'audio'
      ) {

        await showAudio(
          chatId
        );

        return;

      }


      /* =========================
         MAIN BUTTON
      ========================= */

      if (
        query.data &&
        query.data.startsWith(
          'main:'
        )
      ) {

        const id =
          query.data.slice(
            5
          );


        await showMainButton(

          chatId,

          id

        );

      }

    }

  }

  catch (error) {

    console.error(
      'handleUpdate:',
      error
    );

  }

}


/* =========================================================
   LOGIN API
========================================================= */

app.post(
  '/api/login',
  async (
    req,
    res
  ) => {

    try {

      const password =
        String(
          req.body?.password ||
          ''
        );


      if (
        !ADMIN_PASSWORD ||
        password !==
          ADMIN_PASSWORD
      ) {

        return res
          .status(401)
          .json({

            ok:false,

            error:
              'Invalid password'

          });

      }


      const token =
        makeToken();


      adminSessions.set(
        token,
        Date.now()
      );


      return res.json({

        ok:true,

        token

      });

    }

    catch (error) {

      return res
        .status(500)
        .json({

          ok:false,

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
  '/api/settings',
  requireAdmin,
  async (
    req,
    res
  ) => {

    try {

      const settings =
        await getSettings();


      res.json({

        ok:true,

        settings

      });

    }

    catch (error) {

      res
        .status(500)
        .json({

          ok:false,

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
  '/api/settings',
  requireAdmin,
  async (
    req,
    res
  ) => {

    try {

      const settings =
        await saveSettings(
          req.body
        );


      res.json({

        ok:true,

        settings

      });

    }

    catch (error) {

      console.error(
        '/api/settings:',
        error
      );


      res
        .status(500)
        .json({

          ok:false,

          error:
            error.message

        });

    }

  }
);


/* =========================================================
   UPLOAD
========================================================= */

app.post(
  '/api/upload',
  requireAdmin,
  upload.single('file'),

  async (
    req,
    res
  ) => {

    try {

      if (!req.file) {

        return res
          .status(400)
          .json({

            ok:false,

            error:
              'No file uploaded'

          });

      }


      const requestedKind =
        String(
          req.body?.kind ||
          ''
        )
        .toLowerCase();


      let kind =
        requestedKind;


      if (
        ![
          'photo',
          'video',
          'audio'
        ].includes(
          kind
        )
      ) {

        if (
          req.file.mimetype
            .startsWith(
              'image/'
            )
        ) {

          kind =
            'photo';

        }

        else if (
          req.file.mimetype
            .startsWith(
              'video/'
            )
        ) {

          kind =
            'video';

        }

        else if (
          req.file.mimetype
            .startsWith(
              'audio/'
            )
        ) {

          kind =
            'audio';

        }

        else {

          return res
            .status(400)
            .json({

              ok:false,

              error:
                'Unsupported media type'

            });

        }

      }


      const result =
        await dbQuery(

          `
          INSERT INTO bot_media(

            kind,

            filename,

            mimetype,

            data

          )

          VALUES(

            $1,

            $2,

            $3,

            $4

          )

          RETURNING id
          `,

          [

            kind,

            req.file
              .originalname ||
              `upload-${Date.now()}`,

            req.file.mimetype,

            req.file.buffer

          ]

        );


      res.json({

        ok:true,

        mediaId:
          Number(
            result.rows[0].id
          )

      });

    }

    catch (error) {

      console.error(
        '/api/upload:',
        error
      );


      res
        .status(500)
        .json({

          ok:false,

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
  '/media/:id',
  async (
    req,
    res
  ) => {

    try {

      const media =
        await getMedia(
          req.params.id
        );


      if (!media) {

        return res
          .status(404)
          .send(
            'Media not found'
          );

      }


      res.setHeader(

        'Content-Type',

        media.mimetype ||
          'application/octet-stream'

      );


      res.setHeader(

        'Content-Length',

        media.data.length

      );


      res.setHeader(

        'Cache-Control',

        'public, max-age=31536000, immutable'

      );


      res.send(
        media.data
      );

    }

    catch (error) {

      res
        .status(500)
        .send(
          'Media error'
        );

    }

  }
);


/* =========================================================
   MEDIA INFO
========================================================= */

app.get(
  '/api/media/:id',
  requireAdmin,
  async (
    req,
    res
  ) => {

    try {

      const media =
        await getMedia(
          req.params.id
        );


      if (!media) {

        return res
          .status(404)
          .json({

            ok:false,

            error:
              'Media not found'

          });

      }


      res.json({

        ok:true,

        media: {

          id:
            Number(
              media.id
            ),

          kind:
            media.kind,

          filename:
            media.filename,

          mimetype:
            media.mimetype,

          url:
            `/media/${media.id}`

        }

      });

    }

    catch (error) {

      res
        .status(500)
        .json({

          ok:false,

          error:
            error.message

        });

    }

  }
);


/* =========================================================
   REMOVE MEDIA
========================================================= */

app.post(
  '/api/remove-media',
  requireAdmin,

  async (
    req,
    res
  ) => {

    try {

      const id =
        Number(
          req.body?.mediaId
        );


      if (!id) {

        return res
          .status(400)
          .json({

            ok:false,

            error:
              'mediaId required'

          });

      }


      await dbQuery(

        `
        DELETE FROM
          bot_media

        WHERE
          id=$1
        `,

        [id]

      );


      res.json({

        ok:true

      });

    }

    catch (error) {

      res
        .status(500)
        .json({

          ok:false,

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
  '/api/reset',
  requireAdmin,

  async (
    req,
    res
  ) => {

    try {

      const settings =
        await saveSettings(
          defaultSettings()
        );


      res.json({

        ok:true,

        settings

      });

    }

    catch (error) {

      res
        .status(500)
        .json({

          ok:false,

          error:
            error.message

        });

    }

  }
);


/* =========================================================
   CHANGE PASSWORD
========================================================= */

app.post(
  '/api/change-password',
  requireAdmin,

  async (
    req,
    res
  ) => {

    /*
      ADMIN_PASSWORD is a Render Environment Variable.

      তাই runtime-এ fake success দেখানো হবে না।
    */

    res
      .status(400)
      .json({

        ok:false,

        error:
          'Change ADMIN_PASSWORD in Render Environment Variables, then redeploy.'

      });

  }
);


/* =========================================================
   STATUS
========================================================= */

app.get(
  '/api/status',
  requireAdmin,

  async (
    req,
    res
  ) => {

    try {

      const bot =
        await telegram(
          'getMe'
        );


      let database =
        false;


      if (pool) {

        await dbQuery(
          'SELECT 1'
        );


        database =
          true;

      }


      res.json({

        ok:true,

        bot: {

          id:
            bot.id,

          username:
            bot.username,

          name:
            bot.first_name

        },

        database,

        publicUrl:
          PUBLIC_URL

      });

    }

    catch (error) {

      res
        .status(500)
        .json({

          ok:false,

          error:
            error.message

        });

    }

  }
);


/* =========================================================
   WEBHOOK
========================================================= */

app.post(
  '/telegram/webhook',
  async (
    req,
    res
  ) => {

    /*
      Telegram-কে সঙ্গে সঙ্গে 200
      পাঠানো হচ্ছে।
    */

    res.sendStatus(
      200
    );


    await handleUpdate(
      req.body
    );

  }
);


/* =========================================================
   HEALTH
========================================================= */

app.get(
  '/health',
  (
    req,
    res
  ) => {

    res.json({

      ok:true,

      service:
        'telegram-bot-system'

    });

  }
);


/* =========================================================
   ADMIN HTML
========================================================= */

const adminFile =
  path.join(
    __dirname,
    'Admin.html'
  );


app.get(
  '/',
  (
    req,
    res
  ) => {

    res.sendFile(
      adminFile
    );

  }
);


app.get(
  '/admin.html',
  (
    req,
    res
  ) => {

    res.sendFile(
      adminFile
    );

  }
);


/* =========================================================
   WEBHOOK SETUP
========================================================= */

async function setupWebhook() {

  if (!BOT_TOKEN)
    return;


  try {

    await telegram(

      'setWebhook',

      {

        url:
          `${PUBLIC_URL}/telegram/webhook`,

        allowed_updates: [

          'message',

          'callback_query'

        ]

      }

    );


    console.log(

      `Telegram webhook set: ${PUBLIC_URL}/telegram/webhook`

    );

  }

  catch (error) {

    console.error(

      'Webhook setup failed:',

      error.message

    );

  }

}


/* =========================================================
   BOOTSTRAP
========================================================= */

async function bootstrap() {

  try {

    await initDb();


    app.listen(

      PORT,

      async () => {

        console.log(
          `Server listening on ${PORT}`
        );


        console.log(
          `Admin: ${PUBLIC_URL}/`
        );


        await setupWebhook();

      }

    );

  }

  catch (error) {

    console.error(
      'BOOTSTRAP FAILED:',
      error
    );


    process.exit(
      1
    );

  }

}


bootstrap();
