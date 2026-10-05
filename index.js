const express = require('express');
const multer = require('multer');
const { Pool } = require('pg');
const crypto = require('crypto');
const path = require('path');

const app = express();

const PORT = Number(process.env.PORT || 3000);
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const DATABASE_URL = process.env.DATABASE_URL;

if (!BOT_TOKEN || !ADMIN_PASSWORD || !DATABASE_URL) {
  console.error('BOT_TOKEN, ADMIN_PASSWORD and DATABASE_URL are required.');
  process.exit(1);
}

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024
  }
});

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: /localhost|127\.0\.0\.1/.test(DATABASE_URL)
    ? false
    : { rejectUnauthorized: false }
});

const sessions = new Map();
const messageCache = new Map();
const mediaLocks = new Map();

const IDS = [
  'ai',
  'vip',
  'support',
  'official',
  'bonus',
  'admin'
];

const LABELS = {
  ai: '🤖 AI HACK All Link Check',
  vip: '🔥 VIP GROUP All Link Check',
  support: '💬 SUPPORT All Link Check',
  official: '📢 OFFICIAL CHANNEL All Link Check',
  bonus: '🎁 BONUS All Link Check',
  admin: '👨‍💻 ADMIN All Link Check'
};

const DEFAULT_SETTINGS = {
  autoDelete: 0,

  welcome: {
    profilePhotoEnabled: true,
    profilePhoto: true,

    mediaEnabled: false,
    mediaType: 'none',
    mediaSource: 'upload',
    mediaId: null,
    mediaUrl: '',

    text: '👋 Welcome to our Telegram Bot!',

    layout: 'profile_welcome_buttons'
  },

  mainButtons: IDS.map(id => ({
    id,
    enabled: true,
    text: LABELS[id],

    buttonColorEnabled: true,
    buttonColor: '#6d5dfc',
    buttonStyle: '',

    buttonVisualEnabled: false,
    buttonVisualMediaType: 'none',
    buttonVisualMediaSource: 'upload',
    buttonVisualMediaId: null,
    buttonVisualMediaUrl: '',
    buttonVisualText: '',

    // পুরোনো Admin panel-এর compatibility
    buttonImageEnabled: false,
    buttonImageUrl: '',

    headerMediaType: 'none',
    headerMediaSource: 'upload',
    headerMediaId: null,
    headerMediaUrl: '',
    headerText: '',

    slots: []
  })),

  audio: {
    enabled: false,
    text: '',
    source: 'upload',
    mediaId: null,
    mediaUrl: ''
  }
};

const clone = x => JSON.parse(JSON.stringify(x));

const str = (v, d = '') =>
  v == null ? d : String(v);

function bool(v, d = false) {
  if (v == null) return d;

  if (typeof v === 'boolean') {
    return v;
  }

  const s = String(v).toLowerCase().trim();

  if (['true', '1', 'yes', 'on'].includes(s)) {
    return true;
  }

  if (['false', '0', 'no', 'off'].includes(s)) {
    return false;
  }

  return !!v;
}

function mediaType(v) {
  v = str(v, 'none').toLowerCase();

  return ['none', 'photo', 'video', 'audio'].includes(v)
    ? v
    : 'none';
}

function mediaSource(v) {
  return str(v, 'upload').toLowerCase() === 'url'
    ? 'url'
    : 'upload';
}

function color(v, d = '#6d5dfc') {
  v = str(v, d).trim();

  return /^#[0-9a-f]{6}$/i.test(v)
    ? v
    : d;
}

function buttonStyle(v) {
  v = str(v, '').toLowerCase();

  return ['', 'primary', 'success', 'danger'].includes(v)
    ? v
    : '';
}

function cleanUrl(v) {
  return str(v, '').trim();
}

function normalizeSlot(x = {}) {
  const a = x.button1 || {};
  const b = x.button2 || {};

  return {
    enabled: bool(x.enabled, true),

    mediaType: mediaType(x.mediaType),
    mediaSource: mediaSource(x.mediaSource),

    mediaId: x.mediaId
      ? Number(x.mediaId)
      : null,

    mediaUrl: cleanUrl(x.mediaUrl),

    text: str(x.text, ''),

    button1: {
      enabled: bool(a.enabled, true),
      text: str(a.text, 'OPEN LINK'),
      url: cleanUrl(a.url),
      color: color(a.color),
      colorEnabled: bool(a.colorEnabled, true)
    },

    button2: {
      enabled: bool(b.enabled, false),
      text: str(b.text, 'SUPPORT'),
      url: cleanUrl(b.url),
      color: color(b.color),
      colorEnabled: bool(b.colorEnabled, true)
    }
  };
}

function normalizeButton(raw = {}, def = {}) {
  const oldImageUrl = cleanUrl(raw.buttonImageUrl);

  const oldImageEnabled = bool(
    raw.buttonImageEnabled,
    !!oldImageUrl
  );

  const hasNewVisual =
    raw.buttonVisualEnabled !== undefined ||
    raw.buttonVisualMediaType !== undefined ||
    raw.buttonVisualMediaId !== undefined ||
    raw.buttonVisualMediaUrl !== undefined ||
    raw.buttonVisualText !== undefined;

  let visualEnabled = bool(
    raw.buttonVisualEnabled,
    oldImageEnabled ||
    !!raw.buttonVisualMediaId ||
    !!raw.buttonVisualMediaUrl ||
    !!raw.buttonVisualText
  );

  let visualType = mediaType(raw.buttonVisualMediaType);
  let visualSource = mediaSource(raw.buttonVisualMediaSource);

  let visualId = raw.buttonVisualMediaId
    ? Number(raw.buttonVisualMediaId)
    : null;

  let visualUrl = cleanUrl(raw.buttonVisualMediaUrl);

  let visualText = str(
    raw.buttonVisualText,
    ''
  );

  // পুরোনো buttonImageUrl → নতুন Visual System
  if (!hasNewVisual && oldImageUrl) {
    visualEnabled = true;
    visualType = 'photo';
    visualSource = 'url';
    visualId = null;
    visualUrl = oldImageUrl;
  }

  return {
    id: str(raw.id, def.id),

    enabled: bool(
      raw.enabled,
      def.enabled !== undefined
        ? def.enabled
        : true
    ),

    text: str(
      raw.text,
      def.text || ''
    ),

    buttonColorEnabled: bool(
      raw.buttonColorEnabled,
      true
    ),

    buttonColor: color(
      raw.buttonColor
    ),

    buttonStyle: buttonStyle(
      raw.buttonStyle
    ),

    buttonVisualEnabled: visualEnabled,

    buttonVisualMediaType: visualType,

    buttonVisualMediaSource: visualSource,

    buttonVisualMediaId: visualId,

    buttonVisualMediaUrl: visualUrl,

    buttonVisualText: visualText,

    // Legacy fields
    buttonImageEnabled: visualEnabled,

    buttonImageUrl:
      visualType === 'photo' &&
      visualSource === 'url'
        ? visualUrl
        : oldImageUrl,

    headerMediaType:
      mediaType(raw.headerMediaType),

    headerMediaSource:
      mediaSource(raw.headerMediaSource),

    headerMediaId:
      raw.headerMediaId
        ? Number(raw.headerMediaId)
        : null,

    headerMediaUrl:
      cleanUrl(raw.headerMediaUrl),

    headerText:
      str(raw.headerText, ''),

    slots:
      Array.isArray(raw.slots)
        ? raw.slots.map(normalizeSlot)
        : []
  };
}

function normalizeSettings(raw = {}) {
  const out = clone(DEFAULT_SETTINGS);

  const r =
    raw && typeof raw === 'object'
      ? raw
      : {};

  const n = Number(r.autoDelete);

  out.autoDelete =
    Number.isFinite(n)
      ? Math.max(
          0,
          Math.min(
            86400,
            Math.floor(n)
          )
        )
      : 0;

  const w =
    r.welcome &&
    typeof r.welcome === 'object'
      ? r.welcome
      : {};

  out.welcome = {
    profilePhotoEnabled: bool(
      w.profilePhotoEnabled,
      w.profilePhoto === undefined
        ? true
        : bool(w.profilePhoto, true)
    ),

    profilePhoto: bool(
      w.profilePhoto,
      bool(w.profilePhotoEnabled, true)
    ),

    mediaEnabled: bool(
      w.mediaEnabled,
      !!w.mediaId ||
      !!cleanUrl(w.mediaUrl) ||
      mediaType(w.mediaType) !== 'none'
    ),

    mediaType:
      mediaType(w.mediaType),

    mediaSource:
      mediaSource(w.mediaSource),

    mediaId:
      w.mediaId
        ? Number(w.mediaId)
        : null,

    mediaUrl:
      cleanUrl(w.mediaUrl),

    text:
      str(
        w.text,
        out.welcome.text
      ),

    layout:
      str(
        w.layout,
        'profile_welcome_buttons'
      ) === 'buttons_profile_welcome'
        ? 'buttons_profile_welcome'
        : 'profile_welcome_buttons'
  };

  const rawButtons =
    Array.isArray(r.mainButtons)
      ? r.mainButtons
      : [];

  const byId = new Map(
    rawButtons.map(
      x => [
        str(x && x.id),
        x
      ]
    )
  );

  out.mainButtons = IDS.map(id => {
    const defaultButton =
      out.mainButtons.find(
        x => x.id === id
      );

    return normalizeButton(
      byId.get(id) || {},
      defaultButton
    );
  });

  const a =
    r.audio &&
    typeof r.audio === 'object'
      ? r.audio
      : {};

  out.audio = {
    enabled:
      bool(a.enabled, false),

    text:
      str(a.text, ''),

    source:
      mediaSource(a.source),

    mediaId:
      a.mediaId
        ? Number(a.mediaId)
        : null,

    mediaUrl:
      cleanUrl(a.mediaUrl)
  };

  return out;
}

let settings =
  clone(DEFAULT_SETTINGS);

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bot_settings (
      id INTEGER PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bot_media (
      id BIGSERIAL PRIMARY KEY,
      kind TEXT NOT NULL,
      filename TEXT NOT NULL,
      mimetype TEXT NOT NULL,
      data BYTEA NOT NULL,
      telegram_file_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bot_chat_messages (
      chat_id BIGINT NOT NULL,
      message_id BIGINT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY(chat_id, message_id)
    )
  `);

  const q =
    await pool.query(
      'SELECT data FROM bot_settings WHERE id=1'
    );

  settings =
    q.rows.length
      ? normalizeSettings(q.rows[0].data)
      : clone(DEFAULT_SETTINGS);

  await pool.query(
    `
      INSERT INTO bot_settings(id,data)
      VALUES(1,$1::jsonb)

      ON CONFLICT(id)

      DO UPDATE SET
        data=EXCLUDED.data,
        updated_at=NOW()
    `,
    [
      JSON.stringify(settings)
    ]
  );

  console.log(
    'Database initialized.'
  );
}

async function saveSettings(x) {
  settings =
    normalizeSettings(x);

  await pool.query(
    `
      INSERT INTO bot_settings(
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
        data=EXCLUDED.data,
        updated_at=NOW()
    `,
    [
      JSON.stringify(settings)
    ]
  );

  return settings;
}

async function telegram(
  method,
  payload = {}
) {
  const response =
    await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json'
        },

        body:
          JSON.stringify(payload)
      }
    );

  const data =
    await response.json()
      .catch(() => ({
        ok: false,
        description:
          `HTTP ${response.status}`
      }));

  if (
    !response.ok ||
    !data.ok
  ) {
    throw new Error(
      data.description ||
      `Telegram HTTP ${response.status}`
    );
  }

  return data.result;
}

async function telegramForm(
  method,
  form
) {
  const response =
    await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
      {
        method: 'POST',
        body: form
      }
    );

  const data =
    await response.json()
      .catch(() => ({
        ok: false,
        description:
          `HTTP ${response.status}`
      }));

  if (
    !response.ok ||
    !data.ok
  ) {
    throw new Error(
      data.description ||
      `Telegram HTTP ${response.status}`
    );
  }

  return data.result;
}

function rememberMessage(
  chatId,
  messageId
) {
  if (!messageId) return;

  const key =
    String(chatId);

  if (
    !messageCache.has(key)
  ) {
    messageCache.set(
      key,
      new Set()
    );
  }

  messageCache
    .get(key)
    .add(Number(messageId));

  pool.query(
    `
      INSERT INTO bot_chat_messages(
        chat_id,
        message_id
      )
      VALUES($1,$2)

      ON CONFLICT DO NOTHING
    `,
    [
      key,
      Number(messageId)
    ]
  ).catch(() => {});

  const seconds =
    Number(settings.autoDelete || 0);

  if (seconds > 0) {
    setTimeout(
      () => {
        deleteOneMessage(
          chatId,
          messageId
        ).catch(() => {});
      },
      seconds * 1000
    );
  }
}

async function deleteOneMessage(
  chatId,
  messageId
) {
  try {
    await telegram(
      'deleteMessage',
      {
        chat_id: chatId,
        message_id: messageId
      }
    );
  } catch {}

  const set =
    messageCache.get(
      String(chatId)
    );

  if (set) {
    set.delete(
      Number(messageId)
    );

    if (!set.size) {
      messageCache.delete(
        String(chatId)
      );
    }
  }

  await pool.query(
    `
      DELETE FROM bot_chat_messages
      WHERE chat_id=$1
      AND message_id=$2
    `,
    [
      String(chatId),
      Number(messageId)
    ]
  ).catch(() => {});
}

async function clearMessages(
  chatId
) {
  const key =
    String(chatId);

  const ids =
    new Set([
      ...(messageCache.get(key) || [])
    ]);

  const q =
    await pool.query(
      `
        SELECT message_id
        FROM bot_chat_messages
        WHERE chat_id=$1
      `,
      [key]
    ).catch(() => ({
      rows: []
    }));

  q.rows.forEach(row => {
    ids.add(
      Number(row.message_id)
    );
  });

  for (const id of ids) {
    try {
      await telegram(
        'deleteMessage',
        {
          chat_id: key,
          message_id: id
        }
      );
    } catch {}
  }

  messageCache.delete(key);

  await pool.query(
    `
      DELETE FROM bot_chat_messages
      WHERE chat_id=$1
    `,
    [key]
  ).catch(() => {});
}

async function sendText(
  chatId,
  text,
  markup
) {
  const payload = {
    chat_id: chatId,
    text:
      str(text, '\u2063')
  };

  if (markup) {
    payload.reply_markup =
      markup;
  }

  const message =
    await telegram(
      'sendMessage',
      payload
    );

  rememberMessage(
    chatId,
    message.message_id
  );

  return message;
}

async function sendUrlMedia(
  chatId,
  type,
  mediaUrl,
  caption,
  markup
) {
  const method = {
    photo: 'sendPhoto',
    video: 'sendVideo',
    audio: 'sendAudio'
  }[type];

  if (!method || !mediaUrl) {
    return null;
  }

  const payload = {
    chat_id: chatId,
    [type]: mediaUrl
  };

  if (caption) {
    payload.caption =
      caption.slice(0, 1024);
  }

  if (markup) {
    payload.reply_markup =
      markup;
  }

  const message =
    await telegram(
      method,
      payload
    );

  rememberMessage(
    chatId,
    message.message_id
  );

  return message;
}

async function getMedia(
  id
) {
  const q =
    await pool.query(
      `
        SELECT *
        FROM bot_media
        WHERE id=$1
      `,
      [Number(id)]
    );

  return q.rows[0] || null;
}

async function getTelegramFileId(
  chatId,
  row
) {
  if (
    row.telegram_file_id
  ) {
    return row.telegram_file_id;
  }

  const key =
    String(row.id);

  if (
    mediaLocks.has(key)
  ) {
    return mediaLocks.get(key);
  }

  const promise =
    (async () => {
      const form =
        new FormData();

      form.append(
        'chat_id',
        String(chatId)
      );

      const field =
        row.kind === 'photo'
          ? 'photo'
          : row.kind === 'video'
            ? 'video'
            : 'audio';

      const blob =
        new Blob(
          [row.data],
          {
            type:
              row.mimetype ||
              'application/octet-stream'
          }
        );

      form.append(
        field,
        blob,
        row.filename ||
          `media-${row.id}`
      );

      const method =
        row.kind === 'photo'
          ? 'sendPhoto'
          : row.kind === 'video'
            ? 'sendVideo'
            : 'sendAudio';

      const result =
        await telegramForm(
          method,
          form
        );

      const fileId =
        row.kind === 'photo'
          ? result.photo?.at(-1)?.file_id
          : row.kind === 'video'
            ? result.video?.file_id
            : result.audio?.file_id;

      if (fileId) {
        await pool.query(
          `
            UPDATE bot_media
            SET telegram_file_id=$1
            WHERE id=$2
          `,
          [
            fileId,
            row.id
          ]
        );
      }

      // Temporary upload message delete
      try {
        await telegram(
          'deleteMessage',
          {
            chat_id: chatId,
            message_id:
              result.message_id
          }
        );
      } catch {}

      return fileId;
    })();

  mediaLocks.set(
    key,
    promise
  );

  try {
    return await promise;
  } finally {
    mediaLocks.delete(key);
  }
}

async function sendDbMedia(
  chatId,
  id,
  caption,
  markup
) {
  const row =
    await getMedia(id);

  if (!row) {
    throw new Error(
      'Media not found'
    );
  }

  const fileId =
    await getTelegramFileId(
      chatId,
      row
    );

  if (!fileId) {
    throw new Error(
      'Telegram file id unavailable'
    );
  }

  const method =
    row.kind === 'photo'
      ? 'sendPhoto'
      : row.kind === 'video'
        ? 'sendVideo'
        : 'sendAudio';

  const payload = {
    chat_id: chatId,
    [row.kind]: fileId
  };

  if (caption) {
    payload.caption =
      caption.slice(0, 1024);
  }

  if (markup) {
    payload.reply_markup =
      markup;
  }

  const message =
    await telegram(
      method,
      payload
    );

  rememberMessage(
    chatId,
    message.message_id
  );

  return message;
}

async function sendMedia(
  chatId,
  type,
  source,
  id,
  mediaUrl,
  caption = '',
  markup = null
) {
  type =
    mediaType(type);

  if (type === 'none') {
    return null;
  }

  try {
    if (
      source === 'url'
    ) {
      return await sendUrlMedia(
        chatId,
        type,
        cleanUrl(mediaUrl),
        caption,
        markup
      );
    }

    if (id) {
      return await sendDbMedia(
        chatId,
        Number(id),
        caption,
        markup
      );
    }
  } catch (error) {
    console.error(
      'Media error:',
      error.message
    );
  }

  return null;
}

function telegramButtonStyle(
  button,
  colorKey = 'buttonColorEnabled'
) {
  if (
    !bool(
      button[colorKey],
      true
    )
  ) {
    return undefined;
  }

  const explicit =
    buttonStyle(
      button.buttonStyle ||
      button.style
    );

  if (explicit) {
    return explicit;
  }

  const c =
    color(
      button.buttonColor ||
      button.color
    );

  const r =
    parseInt(
      c.slice(1, 3),
      16
    );

  const g =
    parseInt(
      c.slice(3, 5),
      16
    );

  const b =
    parseInt(
      c.slice(5, 7),
      16
    );

  if (
    r > 150 &&
    r > g * 1.18 &&
    r > b * 1.18
  ) {
    return 'danger';
  }

  if (
    g > r * 1.15 &&
    g > b * 1.05
  ) {
    return 'success';
  }

  return 'primary';
}

function mainButton(button) {
  const item = {
    text:
      button.text ||
      'BUTTON',

    callback_data:
      `main:${button.id}`
  };

  const style =
    telegramButtonStyle(
      button
    );

  if (style) {
    item.style = style;
  }

  return item;
}

function backButton() {
  return {
    text: '⬅️ BACK',
    callback_data: 'back:main',
    style: 'primary'
  };
}

function urlButton(button) {
  const item = {
    text:
      button.text ||
      'OPEN LINK',

    url:
      button.url
  };

  const style =
    telegramButtonStyle({
      buttonColor:
        button.color,

      colorEnabled:
        button.colorEnabled,

      buttonColorEnabled:
        button.colorEnabled,

      buttonStyle:
        button.buttonStyle
    });

  if (style) {
    item.style = style;
  }

  return item;
}

function makeKeyboard(rows) {
  return {
    inline_keyboard:
      rows.filter(
        row =>
          row &&
          row.length
      )
  };
}

function userName(user = {}) {
  const full =
    `${str(user.first_name).trim()} ${str(user.last_name).trim()}`
      .trim();

  if (full) {
    return full;
  }

  if (user.username) {
    return `@${user.username}`;
  }

  return 'Telegram User';
}

function getVisual(button) {
  if (
    !button.buttonVisualEnabled
  ) {
    return null;
  }

  if (
    button.buttonVisualMediaType !== 'none' &&
    (
      button.buttonVisualMediaId ||
      button.buttonVisualMediaUrl
    )
  ) {
    return {
      type:
        button.buttonVisualMediaType,

      source:
        button.buttonVisualMediaSource,

      id:
        button.buttonVisualMediaId,

      url:
        button.buttonVisualMediaUrl,

      text:
        button.buttonVisualText ||
        ''
    };
  }

  if (
    str(
      button.buttonVisualText
    ).trim()
  ) {
    return {
      type: 'none',
      source: 'url',
      id: null,
      url: '',
      text:
        button.buttonVisualText
    };
  }

  // Legacy support
  if (
    button.buttonImageEnabled &&
    button.buttonImageUrl
  ) {
    return {
      type: 'photo',
      source: 'url',
      id: null,
      url:
        button.buttonImageUrl,
      text:
        button.buttonVisualText ||
        ''
    };
  }

  return null;
}

function hasVisual(button) {
  return !!getVisual(button);
}

async function sendProfilePhoto(
  chatId,
  userId
) {
  if (
    !settings.welcome.profilePhotoEnabled
  ) {
    return;
  }

  if (!userId) {
    return;
  }

  try {
    const result =
      await telegram(
        'getUserProfilePhotos',
        {
          user_id: userId,
          offset: 0,
          limit: 1
        }
      );

    const photo =
      result.photos?.[0]?.at(-1)?.file_id;

    if (!photo) {
      return;
    }

    const message =
      await telegram(
        'sendPhoto',
        {
          chat_id: chatId,
          photo
        }
      );

    rememberMessage(
      chatId,
      message.message_id
    );
  } catch (error) {
    console.error(
      'Profile photo:',
      error.message
    );
  }
}

function welcomeText(user) {
  const name =
    userName(user);

  const text =
    str(
      settings.welcome.text
    ).trim();

  if (
    name &&
    text
  ) {
    return `👤 ${name}\n\n${text}`;
  }

  return name || text;
}

async function sendWelcomeContent(
  chatId,
  user,
  markup = null
) {
  const w =
    settings.welcome;

  const caption =
    welcomeText(user);

  if (
    w.mediaEnabled &&
    w.mediaType !== 'none'
  ) {
    const message =
      await sendMedia(
        chatId,
        w.mediaType,
        w.mediaSource,
        w.mediaId,
        w.mediaUrl,
        caption,
        markup
      );

    if (message) {
      return message;
    }
  }

  if (caption) {
    return await sendText(
      chatId,
      caption,
      markup
    );
  }

  if (markup) {
    return await sendText(
      chatId,
      '\u2063',
      markup
    );
  }
}

async function sendMainVisual(
  chatId,
  button,
  attach = true
) {
  const visual =
    getVisual(button);

  if (!visual) {
    return;
  }

  const markup =
    attach
      ? makeKeyboard([
          [mainButton(button)]
        ])
      : null;

  if (
    visual.type === 'none'
  ) {
    return await sendText(
      chatId,
      visual.text ||
        '\u2063',
      markup
    );
  }

  const message =
    await sendMedia(
      chatId,
      visual.type,
      visual.source,
      visual.id,
      visual.url,
      visual.text || '',
      markup
    );

  if (
    !message &&
    visual.text
  ) {
    await sendText(
      chatId,
      visual.text,
      markup
    );
  }
}

async function sendAllMainButtons(
  chatId
) {
  const buttons =
    settings.mainButtons
      .filter(
        b => b.enabled
      );

  if (!buttons.length) {
    return;
  }

  const anyVisual =
    buttons.some(
      hasVisual
    );

  if (!anyVisual) {
    await sendText(
      chatId,
      '\u2063',
      makeKeyboard(
        buttons.map(
          b => [
            mainButton(b)
          ]
        )
      )
    );

    return;
  }

  for (
    const button of buttons
  ) {
    if (hasVisual(button)) {
      await sendMainVisual(
        chatId,
        button,
        true
      );
    } else {
      await sendText(
        chatId,
        '\u2063',
        makeKeyboard([
          [mainButton(button)]
        ])
      );
    }
  }
}

async function showMainPage(
  chatId,
  user = {}
) {
  await clearMessages(
    chatId
  );

  const buttons =
    settings.mainButtons
      .filter(
        b => b.enabled
      );

  const anyVisual =
    buttons.some(
      hasVisual
    );

  if (
    settings.welcome.layout ===
    'buttons_profile_welcome'
  ) {
    await sendAllMainButtons(
      chatId
    );

    await sendProfilePhoto(
      chatId,
      user.id
    );

    await sendWelcomeContent(
      chatId,
      user
    );

    return;
  }

  // Default:
  // Profile Photo
  // Name + Welcome
  // Main Buttons

  await sendProfilePhoto(
    chatId,
    user.id
  );

  if (!anyVisual) {
    const markup =
      buttons.length
        ? makeKeyboard(
            buttons.map(
              b => [
                mainButton(b)
              ]
            )
          )
        : null;

    await sendWelcomeContent(
      chatId,
      user,
      markup
    );

    return;
  }

  await sendWelcomeContent(
    chatId,
    user
  );

  await sendAllMainButtons(
    chatId
  );
}

async function sendSlot(
  chatId,
  slot
) {
  if (
    !slot ||
    !slot.enabled
  ) {
    return;
  }

  const row = [];

  if (
    slot.button1?.enabled &&
    cleanUrl(
      slot.button1.url
    )
  ) {
    row.push(
      urlButton(
        slot.button1
      )
    );
  }

  if (
    slot.button2?.enabled &&
    cleanUrl(
      slot.button2.url
    )
  ) {
    row.push(
      urlButton(
        slot.button2
      )
    );
  }

  const markup =
    row.length
      ? makeKeyboard([row])
      : null;

  const text =
    str(slot.text).trim();

  if (
    slot.mediaType !== 'none'
  ) {
    const message =
      await sendMedia(
        chatId,
        slot.mediaType,
        slot.mediaSource,
        slot.mediaId,
        slot.mediaUrl,
        text,
        markup
      );

    if (
      !message &&
      text
    ) {
      await sendText(
        chatId,
        text,
        markup
      );
    }

    return;
  }

  if (
    text ||
    markup
  ) {
    await sendText(
      chatId,
      text || '\u2063',
      markup
    );
  }
}

async function sendButtonHeader(
  chatId,
  button
) {
  if (
    button.headerMediaType !==
    'none'
  ) {
    const message =
      await sendMedia(
        chatId,
        button.headerMediaType,
        button.headerMediaSource,
        button.headerMediaId,
        button.headerMediaUrl,
        str(
          button.headerText
        ).trim()
      );

    if (
      !message &&
      str(button.headerText).trim()
    ) {
      await sendText(
        chatId,
        button.headerText
      );
    }

    return;
  }

  if (
    str(
      button.headerText
    ).trim()
  ) {
    await sendText(
      chatId,
      button.headerText
    );
  }
}

async function showMainButton(
  chatId,
  button
) {
  if (
    !button ||
    !button.enabled
  ) {
    return;
  }

  await clearMessages(
    chatId
  );

  await sendButtonHeader(
    chatId,
    button
  );

  for (
    const slot of button.slots || []
  ) {
    await sendSlot(
      chatId,
      slot
    );
  }

  await sendText(
    chatId,
    '\u2063',
    makeKeyboard([
      [backButton()]
    ])
  );
}

async function sendAudioSystem(
  chatId
) {
  const audio =
    settings.audio;

  if (!audio.enabled) {
    return;
  }

  if (
    audio.source === 'url' &&
    audio.mediaUrl
  ) {
    await sendMedia(
      chatId,
      'audio',
      'url',
      null,
      audio.mediaUrl,
      audio.text || ''
    );

    return;
  }

  if (
    audio.mediaId
  ) {
    await sendMedia(
      chatId,
      'audio',
      'upload',
      audio.mediaId,
      '',
      audio.text || ''
    );

    return;
  }

  if (audio.text) {
    await sendText(
      chatId,
      audio.text
    );
  }
}

async function answerCallback(
  id,
  text
) {
  try {
    const payload = {
      callback_query_id: id
    };

    if (text) {
      payload.text = text;
    }

    await telegram(
      'answerCallbackQuery',
      payload
    );
  } catch {}
}

async function handleUpdate(
  update
) {
  if (!update) {
    return;
  }

  // /start
  if (update.message) {
    const message =
      update.message;

    const chatId =
      message.chat?.id;

    if (!chatId) {
      return;
    }

    if (
      message.text === '/start' ||
      message.text === '/menu'
    ) {
      await showMainPage(
        chatId,
        message.from || {}
      );
    }

    return;
  }

  // Callback buttons
  if (
    update.callback_query
  ) {
    const callback =
      update.callback_query;

    const data =
      str(callback.data);

    const chatId =
      callback.message?.chat?.id;

    if (!chatId) {
      await answerCallback(
        callback.id
      );

      return;
    }

    if (
      data === 'back:main'
    ) {
      await answerCallback(
        callback.id
      );

      await showMainPage(
        chatId,
        callback.from || {}
      );

      return;
    }

    if (
      data === 'audio'
    ) {
      await answerCallback(
        callback.id
      );

      await clearMessages(
        chatId
      );

      await sendAudioSystem(
        chatId
      );

      await sendText(
        chatId,
        '\u2063',
        makeKeyboard([
          [backButton()]
        ])
      );

      return;
    }

    if (
      data.startsWith('main:')
    ) {
      const id =
        data.slice(5);

      const button =
        settings.mainButtons.find(
          b => b.id === id
        );

      if (
        !button ||
        !button.enabled
      ) {
        await answerCallback(
          callback.id,
          'This option is unavailable.'
        );

        return;
      }

      await answerCallback(
        callback.id
      );

      await showMainButton(
        chatId,
        button
      );

      return;
    }

    await answerCallback(
      callback.id
    );
  }
}

function adminAuth(
  req,
  res,
  next
) {
  const header =
    str(
      req.headers.authorization
    );

  const token =
    header.startsWith('Bearer ')
      ? header.slice(7).trim()
      : '';

  if (
    !token ||
    !sessions.has(token)
  ) {
    return res
      .status(401)
      .json({
        ok: false,
        error: 'UNAUTHORIZED'
      });
  }

  next();
}

app.get(
  '/',
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        'Admin.html'
      )
    );
  }
);

app.get(
  '/admin.html',
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        'Admin.html'
      )
    );
  }
);

app.get(
  '/health',
  (req, res) => {
    res.json({
      ok: true,
      service:
        'telegram-bot-system',
      time:
        new Date().toISOString()
    });
  }
);

app.post(
  '/telegram/webhook',
  (req, res) => {
    res.json({
      ok: true
    });

    handleUpdate(
      req.body
    ).catch(error => {
      console.error(
        'Webhook error:',
        error
      );
    });
  }
);

app.post(
  '/api/login',
  async (req, res) => {
    try {
      if (
        str(
          req.body?.password
        ) !== ADMIN_PASSWORD
      ) {
        return res
          .status(401)
          .json({
            ok: false,
            error:
              'INVALID_PASSWORD'
          });
      }

      const session =
        crypto
          .randomBytes(32)
          .toString('hex');

      sessions.set(
        session,
        Date.now()
      );

      if (
        sessions.size > 100
      ) {
        const first =
          sessions.keys()
            .next()
            .value;

        if (first) {
          sessions.delete(first);
        }
      }

      res.json({
        ok: true,
        token: session
      });
    } catch {
      res
        .status(500)
        .json({
          ok: false,
          error:
            'SERVER_ERROR'
        });
    }
  }
);

app.post(
  '/api/logout',
  adminAuth,
  (req, res) => {
    const header =
      str(
        req.headers.authorization
      );

    const token =
      header
        .slice(7)
        .trim();

    sessions.delete(
      token
    );

    res.json({
      ok: true
    });
  }
);

app.get(
  '/api/settings',
  adminAuth,
  (req, res) => {
    res.json({
      ok: true,
      settings:
        normalizeSettings(
          settings
        )
    });
  }
);

app.post(
  '/api/settings',
  adminAuth,
  async (req, res) => {
    try {
      const incoming =
        req.body?.settings ||
        req.body;

      if (
        !incoming ||
        typeof incoming !==
          'object'
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            error:
              'INVALID_SETTINGS'
          });
      }

      const saved =
        await saveSettings(
          incoming
        );

      res.json({
        ok: true,
        settings: saved
      });
    } catch (error) {
      console.error(
        '/api/settings:',
        error
      );

      res
        .status(500)
        .json({
          ok: false,
          error:
            error.message ||
            'SERVER_ERROR'
        });
    }
  }
);

app.post(
  '/api/upload',
  adminAuth,
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({
            ok: false,
            error:
              'NO_FILE'
          });
      }

      let kind =
        str(
          req.body.kind
        ).toLowerCase();

      if (
        ![
          'photo',
          'video',
          'audio'
        ].includes(kind)
      ) {
        if (
          req.file.mimetype
            .startsWith('image/')
        ) {
          kind = 'photo';
        } else if (
          req.file.mimetype
            .startsWith('video/')
        ) {
          kind = 'video';
        } else if (
          req.file.mimetype
            .startsWith('audio/')
        ) {
          kind = 'audio';
        } else {
          return res
            .status(400)
            .json({
              ok: false,
              error:
                'UNSUPPORTED_MEDIA_TYPE'
            });
        }
      }

      const result =
        await pool.query(
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
            RETURNING
              id,
              kind,
              filename,
              mimetype,
              created_at
          `,
          [
            kind,
            req.file.originalname ||
              `upload-${Date.now()}`,
            req.file.mimetype ||
              'application/octet-stream',
            req.file.buffer
          ]
        );

      const media =
        result.rows[0];

      res.json({
        ok: true,

        media: {
          id:
            Number(media.id),

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
    } catch (error) {
      console.error(
        '/api/upload:',
        error
      );

      res
        .status(500)
        .json({
          ok: false,
          error:
            error.message ||
            'UPLOAD_FAILED'
        });
    }
  }
);

app.get(
  '/media/:id',
  async (req, res) => {
    try {
      const id =
        Number(
          req.params.id
        );

      const result =
        await pool.query(
          `
            SELECT
              filename,
              mimetype,
              data
            FROM bot_media
            WHERE id=$1
          `,
          [id]
        );

      if (
        !result.rows.length
      ) {
        return res
          .status(404)
          .send(
            'Media not found'
          );
      }

      const media =
        result.rows[0];

      res.setHeader(
        'Content-Type',
        media.mimetype ||
          'application/octet-stream'
      );

      res.setHeader(
        'Content-Disposition',
        `inline; filename="${str(
          media.filename
        ).replace(
          /"/g,
          ''
        )}"`
      );

      res.setHeader(
        'Cache-Control',
        'public,max-age=31536000,immutable'
      );

      res.send(
        media.data
      );
    } catch {
      res
        .status(500)
        .send(
          'Media error'
        );
    }
  }
);

app.get(
  '/api/media/:id',
  adminAuth,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
            SELECT
              id,
              kind,
              filename,
              mimetype,
              telegram_file_id,
              created_at
            FROM bot_media
            WHERE id=$1
          `,
          [
            Number(
              req.params.id
            )
          ]
        );

      if (
        !result.rows.length
      ) {
        return res
          .status(404)
          .json({
            ok: false,
            error:
              'NOT_FOUND'
          });
      }

      const media =
        result.rows[0];

      media.id =
        Number(media.id);

      media.url =
        `/media/${media.id}`;

      res.json({
        ok: true,
        media
      });
    } catch {
      res
        .status(500)
        .json({
          ok: false,
          error:
            'SERVER_ERROR'
        });
    }
  }
);

app.delete(
  '/api/media/:id',
  adminAuth,
  async (req, res) => {
    try {
      await pool.query(
        `
          DELETE FROM bot_media
          WHERE id=$1
        `,
        [
          Number(
            req.params.id
          )
        ]
      );

      res.json({
        ok: true
      });
    } catch {
      res
        .status(500)
        .json({
          ok: false,
          error:
            'SERVER_ERROR'
        });
    }
  }
);

app.post(
  '/api/reset',
  adminAuth,
  async (req, res) => {
    try {
      const saved =
        await saveSettings(
          clone(
            DEFAULT_SETTINGS
          )
        );

      res.json({
        ok: true,
        settings: saved
      });
    } catch {
      res
        .status(500)
        .json({
          ok: false,
          error:
            'RESET_FAILED'
        });
    }
  }
);

app.get(
  '/api/status',
  adminAuth,
  async (req, res) => {
    try {
      const me =
        await telegram(
          'getMe'
        );

      res.json({
        ok: true,

        bot: {
          id: me.id,
          username:
            me.username || '',
          name:
            me.first_name || ''
        },

        database:
          'connected'
      });
    } catch (error) {
      res
        .status(500)
        .json({
          ok: false,
          error:
            error.message ||
            'STATUS_FAILED'
        });
    }
  }
);

app.use(
  (error, req, res, next) => {
    if (
      error?.code ===
      'LIMIT_FILE_SIZE'
    ) {
      return res
        .status(413)
        .json({
          ok: false,
          error:
            'FILE_TOO_LARGE',
          message:
            'Maximum upload size is 50MB.'
        });
    }

    console.error(
      'Server error:',
      error
    );

    res
      .status(500)
      .json({
        ok: false,
        error:
          'SERVER_ERROR'
      });
  }
);

async function setWebhook() {
  const base =
    str(
      process.env.RENDER_EXTERNAL_URL
    ).trim() ||
    (
      process.env.RENDER_EXTERNAL_HOSTNAME
        ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`
        : 'https://telegram-bot-system-kgdq.onrender.com'
    );

  const webhookUrl =
    base.replace(
      /\/+$/,
      ''
    ) +
    '/telegram/webhook';

  try {
    await telegram(
      'setWebhook',
      {
        url:
          webhookUrl,

        allowed_updates: [
          'message',
          'callback_query'
        ]
      }
    );

    console.log(
      'Telegram webhook:',
      webhookUrl
    );
  } catch (error) {
    console.error(
      'Webhook setup:',
      error.message
    );
  }
}

async function start() {
  try {
    await initDB();

    app.listen(
      PORT,
      () => {
        console.log(
          `Server running on port ${PORT}`
        );
      }
    );

    await setWebhook();
  } catch (error) {
    console.error(
      'Startup failed:',
      error
    );

    process.exit(1);
  }
}

process.on(
  'SIGTERM',
  async () => {
    await pool
      .end()
      .catch(() => {});

    process.exit(0);
  }
);

process.on(
  'SIGINT',
  async () => {
    await pool
      .end()
      .catch(() => {});

    process.exit(0);
  }
);

start();
