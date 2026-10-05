const express = require('express');
const multer = require('multer');
const { Pool } = require('pg');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const DATABASE_URL = process.env.DATABASE_URL;

if (!BOT_TOKEN) console.warn('WARNING: BOT_TOKEN is not set.');
if (!ADMIN_PASSWORD) console.warn('WARNING: ADMIN_PASSWORD is not set.');
if (!DATABASE_URL) console.warn('WARNING: DATABASE_URL is not set.');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL && !/localhost|127\.0\.0\.1/.test(DATABASE_URL)
    ? { rejectUnauthorized: false }
    : false
});

/*
  IMPORTANT:
  There is intentionally NO file-size limit here.
*/
const upload = multer({
  storage: multer.memoryStorage()
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessions = new Map();

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

  mainButtons: [
    {
      id: 'ai',
      enabled: true,
      text: '🤖 AI HACK All Link Check',

      buttonColorEnabled: true,
      buttonColor: '#67a74a',
      buttonStyle: 'success',

      buttonVisualEnabled: false,
      buttonVisualMediaType: 'none',
      buttonVisualMediaSource: 'upload',
      buttonVisualMediaId: null,
      buttonVisualMediaUrl: '',
      buttonVisualText: '',

      buttonImageEnabled: false,
      buttonImageUrl: '',

      headerMediaType: 'none',
      headerMediaSource: 'upload',
      headerMediaId: null,
      headerMediaUrl: '',
      headerText: '',

      slots: []
    },
    {
      id: 'vip',
      enabled: true,
      text: '🔥 VIP GROUP All Link Check',

      buttonColorEnabled: true,
      buttonColor: '#6d5dfc',
      buttonStyle: 'primary',

      buttonVisualEnabled: false,
      buttonVisualMediaType: 'none',
      buttonVisualMediaSource: 'upload',
      buttonVisualMediaId: null,
      buttonVisualMediaUrl: '',
      buttonVisualText: '',

      buttonImageEnabled: false,
      buttonImageUrl: '',

      headerMediaType: 'none',
      headerMediaSource: 'upload',
      headerMediaId: null,
      headerMediaUrl: '',
      headerText: '',

      slots: []
    },
    {
      id: 'support',
      enabled: true,
      text: '💬 SUPPORT All Link Check',

      buttonColorEnabled: true,
      buttonColor: '#e89b24',
      buttonStyle: 'primary',

      buttonVisualEnabled: false,
      buttonVisualMediaType: 'none',
      buttonVisualMediaSource: 'upload',
      buttonVisualMediaId: null,
      buttonVisualMediaUrl: '',
      buttonVisualText: '',

      buttonImageEnabled: false,
      buttonImageUrl: '',

      headerMediaType: 'none',
      headerMediaSource: 'upload',
      headerMediaId: null,
      headerMediaUrl: '',
      headerText: '',

      slots: []
    },
    {
      id: 'official',
      enabled: true,
      text: '📢 OFFICIAL CHANNEL All Link Check🥰',

      buttonColorEnabled: true,
      buttonColor: '#ff3b30',
      buttonStyle: 'danger',

      buttonVisualEnabled: false,
      buttonVisualMediaType: 'none',
      buttonVisualMediaSource: 'upload',
      buttonVisualMediaId: null,
      buttonVisualMediaUrl: '',
      buttonVisualText: '',

      buttonImageEnabled: false,
      buttonImageUrl: '',

      headerMediaType: 'none',
      headerMediaSource: 'upload',
      headerMediaId: null,
      headerMediaUrl: '',
      headerText: '',

      slots: []
    },
    {
      id: 'bonus',
      enabled: true,
      text: '🎁 BONUS All Link Check',

      buttonColorEnabled: true,
      buttonColor: '#16a085',
      buttonStyle: 'success',

      buttonVisualEnabled: false,
      buttonVisualMediaType: 'none',
      buttonVisualMediaSource: 'upload',
      buttonVisualMediaId: null,
      buttonVisualMediaUrl: '',
      buttonVisualText: '',

      buttonImageEnabled: false,
      buttonImageUrl: '',

      headerMediaType: 'none',
      headerMediaSource: 'upload',
      headerMediaId: null,
      headerMediaUrl: '',
      headerText: '',

      slots: []
    },
    {
      id: 'admin',
      enabled: true,
      text: '👨‍💻 ADMIN All Link Check',

      buttonColorEnabled: true,
      buttonColor: '#8e44ad',
      buttonStyle: 'primary',

      buttonVisualEnabled: false,
      buttonVisualMediaType: 'none',
      buttonVisualMediaSource: 'upload',
      buttonVisualMediaId: null,
      buttonVisualMediaUrl: '',
      buttonVisualText: '',

      buttonImageEnabled: false,
      buttonImageUrl: '',

      headerMediaType: 'none',
      headerMediaSource: 'upload',
      headerMediaId: null,
      headerMediaUrl: '',
      headerText: '',

      slots: []
    }
  ],

  audio: {
    enabled: false,
    text: '',
    mediaType: 'audio',
    mediaSource: 'url',
    mediaId: null,
    mediaUrl: '',
    button1: {
      enabled: false,
      text: '',
      url: '',
      color: '#6d5dfc',
      colorEnabled: true
    },
    button2: {
      enabled: false,
      text: '',
      url: '',
      color: '#6d5dfc',
      colorEnabled: true
    }
  }
};

function clone(x) {
  return JSON.parse(JSON.stringify(x));
}

function str(x) {
  return x == null ? '' : String(x);
}

function bool(v, fallback = false) {
  return v == null ? fallback : !!v;
}

function clamp(n, min, max) {
  n = Number(n);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function normalizeSlot(slot) {
  slot = slot || {};

  function normBtn(x, enabledDefault) {
    x = x || {};

    return {
      enabled: x.enabled ?? enabledDefault,
      text: str(x.text),
      url: str(x.url),
      color: x.color || '#6d5dfc',
      colorEnabled: x.colorEnabled ?? true
    };
  }

  return {
    enabled: slot.enabled !== false,
    mediaType: slot.mediaType || 'none',
    mediaSource: slot.mediaSource || 'upload',
    mediaId: slot.mediaId || null,
    mediaUrl: str(slot.mediaUrl),
    text: str(slot.text),
    button1: normBtn(slot.button1, true),
    button2: normBtn(slot.button2, false)
  };
}

function normalizeButton(raw, fallback) {
  const b = {
    ...clone(fallback),
    ...(raw || {})
  };

  b.enabled = b.enabled !== false;
  b.text = str(b.text);

  b.buttonColorEnabled =
    raw?.buttonColorEnabled ?? true;

  b.buttonColor =
    raw?.buttonColor || fallback.buttonColor || '#6d5dfc';

  b.buttonStyle =
    raw?.buttonStyle || fallback.buttonStyle || '';

  b.buttonVisualEnabled =
    raw?.buttonVisualEnabled ??
    raw?.buttonImageEnabled ??
    Boolean(
      raw?.buttonVisualMediaId ||
      raw?.buttonVisualMediaUrl ||
      raw?.buttonVisualText ||
      raw?.buttonImageUrl
    );

  b.buttonVisualMediaType =
    raw?.buttonVisualMediaType ||
    (raw?.buttonImageUrl ? 'photo' : 'none');

  b.buttonVisualMediaSource =
    raw?.buttonVisualMediaSource ||
    (raw?.buttonImageUrl ? 'url' : 'upload');

  b.buttonVisualMediaId =
    raw?.buttonVisualMediaId || null;

  b.buttonVisualMediaUrl =
    raw?.buttonVisualMediaUrl ||
    raw?.buttonImageUrl ||
    '';

  b.buttonVisualText =
    raw?.buttonVisualText || '';

  b.buttonImageEnabled =
    b.buttonVisualEnabled;

  b.buttonImageUrl =
    b.buttonVisualMediaType === 'photo' &&
    b.buttonVisualMediaSource === 'url'
      ? b.buttonVisualMediaUrl
      : '';

  b.headerMediaType =
    raw?.headerMediaType || 'none';

  b.headerMediaSource =
    raw?.headerMediaSource || 'upload';

  b.headerMediaId =
    raw?.headerMediaId || null;

  b.headerMediaUrl =
    raw?.headerMediaUrl || '';

  b.headerText =
    raw?.headerText || '';

  b.slots =
    Array.isArray(raw?.slots)
      ? raw.slots.slice(0, 20).map(normalizeSlot)
      : [];

  return b;
}

function normalizeSettings(raw) {
  raw = raw || {};

  const s = {
    ...clone(DEFAULT_SETTINGS),
    ...raw
  };

  s.welcome = {
    ...clone(DEFAULT_SETTINGS.welcome),
    ...(raw.welcome || {})
  };

  const w = s.welcome;

  w.profilePhotoEnabled =
    raw.welcome?.profilePhotoEnabled ??
    raw.welcome?.profilePhoto ??
    true;

  w.profilePhoto =
    w.profilePhotoEnabled;

  w.mediaEnabled =
    raw.welcome?.mediaEnabled ??
    Boolean(
      raw.welcome?.mediaType &&
      raw.welcome?.mediaType !== 'none'
    ) ||
    Boolean(
      raw.welcome?.mediaId ||
      raw.welcome?.mediaUrl
    );

  w.mediaType =
    raw.welcome?.mediaType || 'none';

  w.mediaSource =
    raw.welcome?.mediaSource || 'upload';

  w.mediaId =
    raw.welcome?.mediaId || null;

  w.mediaUrl =
    raw.welcome?.mediaUrl || '';

  w.text =
    raw.welcome?.text ||
    DEFAULT_SETTINGS.welcome.text;

  w.layout =
    raw.welcome?.layout ||
    'profile_welcome_buttons';

  const rawButtons =
    Array.isArray(raw.mainButtons)
      ? raw.mainButtons
      : [];

  const byId = new Map(
    rawButtons.map(x => [x.id, x])
  );

  s.mainButtons =
    DEFAULT_SETTINGS.mainButtons.map(def => {
      return normalizeButton(
        byId.get(def.id),
        def
      );
    });

  s.audio = {
    ...clone(DEFAULT_SETTINGS.audio),
    ...(raw.audio || {})
  };

  s.audio.enabled =
    !!s.audio.enabled;

  s.audio.text =
    str(s.audio.text);

  s.audio.mediaType =
    'audio';

  s.audio.mediaSource =
    s.audio.mediaSource || 'url';

  s.audio.mediaId =
    s.audio.mediaId || null;

  s.audio.mediaUrl =
    s.audio.mediaUrl || '';

  s.audio.button1 = normalizeSlot({
    button1: s.audio.button1,
    button2: s.audio.button2
  }).button1;

  s.audio.button2 = normalizeSlot({
    button1: s.audio.button1,
    button2: s.audio.button2
  }).button2;

  s.autoDelete =
    clamp(raw.autoDelete || 0, 0, 86400);

  return s;
}

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
      filename TEXT,
      mimetype TEXT,
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
      PRIMARY KEY(chat_id,message_id)
    )
  `);

  const q = await pool.query(
    'SELECT data FROM bot_settings WHERE id=1'
  );

  if (!q.rows.length) {
    await pool.query(
      `INSERT INTO bot_settings(id,data)
       VALUES(1,$1)`,
      [normalizeSettings(DEFAULT_SETTINGS)]
    );
  }
}

async function getSettings() {
  const q = await pool.query(
    'SELECT data FROM bot_settings WHERE id=1'
  );

  if (!q.rows.length) {
    return normalizeSettings(DEFAULT_SETTINGS);
  }

  return normalizeSettings(q.rows[0].data);
}

async function saveSettings(settings) {
  const normalized =
    normalizeSettings(settings);

  await pool.query(
    `INSERT INTO bot_settings(id,data,updated_at)
     VALUES(1,$1,NOW())
     ON CONFLICT(id)
     DO UPDATE SET
       data=EXCLUDED.data,
       updated_at=NOW()`,
    [normalized]
  );

  return normalized;
}

async function tg(method, body = {}) {
  const r = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }
  );

  const data = await r.json();

  if (!data.ok) {
    throw new Error(
      data.description || `Telegram API error: ${method}`
    );
  }

  return data.result;
}

async function tgMultipart(
  method,
  fields,
  fileField,
  buffer,
  filename,
  mimetype
) {
  const fd = new FormData();

  for (const [key, value] of Object.entries(fields || {})) {
    fd.append(key, String(value));
  }

  fd.append(
    fileField,
    new Blob([buffer], {
      type: mimetype || 'application/octet-stream'
    }),
    filename || 'upload'
  );

  const r = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
    {
      method: 'POST',
      body: fd
    }
  );

  const data = await r.json();

  if (!data.ok) {
    throw new Error(
      data.description || `Telegram API error: ${method}`
    );
  }

  return data.result;
}

async function rememberMessage(chatId, messageId) {
  try {
    await pool.query(
      `INSERT INTO bot_chat_messages(chat_id,message_id)
       VALUES($1,$2)
       ON CONFLICT DO NOTHING`,
      [chatId, messageId]
    );
  } catch {}
}

async function rememberResult(chatId, result) {
  if (!result) return;

  if (Array.isArray(result)) {
    for (const m of result) {
      if (m?.message_id) {
        await rememberMessage(
          chatId,
          m.message_id
        );
      }
    }
  } else if (result.message_id) {
    await rememberMessage(
      chatId,
      result.message_id
    );
  }
}

async function deleteMessageSafe(chatId, messageId) {
  try {
    await tg('deleteMessage', {
      chat_id: chatId,
      message_id: messageId
    });
  } catch {}
}

async function clearChatMessages(chatId) {
  const q = await pool.query(
    `SELECT message_id
     FROM bot_chat_messages
     WHERE chat_id=$1
     ORDER BY message_id`,
    [chatId]
  );

  for (const row of q.rows) {
    await deleteMessageSafe(
      chatId,
      row.message_id
    );
  }

  await pool.query(
    'DELETE FROM bot_chat_messages WHERE chat_id=$1',
    [chatId]
  );
}

function scheduleDelete(chatId, messageId, seconds) {
  if (!seconds || seconds <= 0) return;

  setTimeout(async () => {
    await deleteMessageSafe(
      chatId,
      messageId
    );

    try {
      await pool.query(
        `DELETE FROM bot_chat_messages
         WHERE chat_id=$1 AND message_id=$2`,
        [chatId, messageId]
      );
    } catch {}
  }, seconds * 1000);
}

async function sendAndRemember(
  chatId,
  method,
  body,
  settings
) {
  const result = await tg(method, body);

  await rememberResult(
    chatId,
    result
  );

  if (
    result?.message_id &&
    settings?.autoDelete > 0
  ) {
    scheduleDelete(
      chatId,
      result.message_id,
      settings.autoDelete
    );
  }

  return result;
}

function buttonStyleFromColor(color) {
  color = String(color || '').toLowerCase();

  const hex =
    /^#?([0-9a-f]{6})$/i.exec(color);

  if (!hex) return 'primary';

  const n = parseInt(hex[1], 16);

  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;

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

function makeUrlButton(btn) {
  if (!btn || !btn.enabled || !btn.url) {
    return null;
  }

  const item = {
    text: btn.text || 'OPEN LINK',
    url: btn.url
  };

  /*
    Telegram supports predefined styles only.
    Arbitrary HEX colors are not supported by
    Telegram inline keyboard buttons.
  */
  if (btn.colorEnabled !== false) {
    item.style =
      btn.buttonStyle ||
      buttonStyleFromColor(btn.color);
  }

  return item;
}

function keyboard(buttons) {
  const rows = [];

  for (const b of buttons) {
    const x = makeUrlButton(b);

    if (x) {
      rows.push([x]);
    }
  }

  return rows.length
    ? { inline_keyboard: rows }
    : undefined;
}

function mainButtonKeyboard(b) {
  if (!b.enabled) return null;

  return {
    inline_keyboard: [
      [
        {
          text: b.text,
          callback_data: `main:${b.id}`
        }
      ]
    ]
  };
}

function backKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: '⬅️ BACK',
          callback_data: 'back'
        }
      ]
    ]
  };
}

async function getMedia(mediaId) {
  if (!mediaId) return null;

  const q = await pool.query(
    `SELECT *
     FROM bot_media
     WHERE id=$1`,
    [Number(mediaId)]
  );

  return q.rows[0] || null;
}

async function telegramFileIdForMedia(mediaId) {
  const media = await getMedia(mediaId);

  if (!media) {
    throw new Error('MEDIA_NOT_FOUND');
  }

  if (media.telegram_file_id) {
    return {
      id: media.telegram_file_id,
      media
    };
  }

  let method;

  if (media.kind === 'photo') {
    method = 'sendPhoto';
  } else if (media.kind === 'video') {
    method = 'sendVideo';
  } else {
    method = 'sendAudio';
  }

  const result = await tgMultipart(
    method,
    {
      chat_id: '@invalid'
    },
    media.kind === 'photo'
      ? 'photo'
      : media.kind === 'video'
        ? 'video'
        : 'audio',
    media.data,
    media.filename,
    media.mimetype
  );

  /*
    This function is normally not used directly because
    media is uploaded to the target chat below.
  */

  return {
    id:
      result?.photo?.[result.photo.length - 1]?.file_id ||
      result?.video?.file_id ||
      result?.audio?.file_id ||
      null,
    media
  };
}

async function sendMedia(
  chatId,
  type,
  source,
  mediaId,
  mediaUrl,
  caption,
  replyMarkup,
  settings
) {
  if (type === 'none') {
    if (!caption && !replyMarkup) {
      return null;
    }

    return sendAndRemember(
      chatId,
      'sendMessage',
      {
        chat_id: chatId,
        text: caption || ' ',
        reply_markup: replyMarkup
      },
      settings
    );
  }

  if (
    source === 'url' &&
    mediaUrl
  ) {
    const method =
      type === 'photo'
        ? 'sendPhoto'
        : type === 'video'
          ? 'sendVideo'
          : 'sendAudio';

    const field =
      type === 'photo'
        ? 'photo'
        : type === 'video'
          ? 'video'
          : 'audio';

    return sendAndRemember(
      chatId,
      method,
      {
        chat_id: chatId,
        [field]: mediaUrl,
        caption: caption || undefined,
        reply_markup: replyMarkup
      },
      settings
    );
  }

  if (source === 'upload' && mediaId) {
    const media = await getMedia(mediaId);

    if (!media) {
      throw new Error('MEDIA_NOT_FOUND');
    }

    if (media.telegram_file_id) {
      const method =
        type === 'photo'
          ? 'sendPhoto'
          : type === 'video'
            ? 'sendVideo'
            : 'sendAudio';

      const field =
        type === 'photo'
          ? 'photo'
          : type === 'video'
            ? 'video'
            : 'audio';

      return sendAndRemember(
        chatId,
        method,
        {
          chat_id: chatId,
          [field]: media.telegram_file_id,
          caption: caption || undefined,
          reply_markup: replyMarkup
        },
        settings
      );
    }

    const method =
      type === 'photo'
        ? 'sendPhoto'
        : type === 'video'
          ? 'sendVideo'
          : 'sendAudio';

    const field =
      type === 'photo'
        ? 'photo'
        : type === 'video'
          ? 'video'
          : 'audio';

    const fd = new FormData();

    fd.append(
      'chat_id',
      String(chatId)
    );

    fd.append(
      field,
      new Blob([media.data], {
        type:
          media.mimetype ||
          'application/octet-stream'
      }),
      media.filename || 'upload'
    );

    if (caption) {
      fd.append('caption', caption);
    }

    if (replyMarkup) {
      fd.append(
        'reply_markup',
        JSON.stringify(replyMarkup)
      );
    }

    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
      {
        method: 'POST',
        body: fd
      }
    );

    const data = await response.json();

    if (!data.ok) {
      throw new Error(
        data.description ||
        'TELEGRAM_MEDIA_SEND_FAILED'
      );
    }

    const result = data.result;

    let fileId = null;

    if (type === 'photo') {
      fileId =
        result.photo?.[
          result.photo.length - 1
        ]?.file_id || null;
    } else if (type === 'video') {
      fileId =
        result.video?.file_id || null;
    } else {
      fileId =
        result.audio?.file_id || null;
    }

    if (fileId) {
      await pool.query(
        `UPDATE bot_media
         SET telegram_file_id=$1
         WHERE id=$2`,
        [fileId, media.id]
      );
    }

    await rememberResult(
      chatId,
      result
    );

    if (
      result?.message_id &&
      settings?.autoDelete > 0
    ) {
      scheduleDelete(
        chatId,
        result.message_id,
        settings.autoDelete
      );
    }

    return result;
  }

  return sendAndRemember(
    chatId,
    'sendMessage',
    {
      chat_id: chatId,
      text: caption || ' ',
      reply_markup: replyMarkup
    },
    settings
  );
}

function welcomeText(user, text) {
  const name =
    user?.first_name ||
    user?.username ||
    'Friend';

  if (!text) {
    return `👤 ${name}`;
  }

  return `👤 ${name}\n\n${text}`;
}

async function sendProfilePhoto(
  chatId,
  userId,
  settings
) {
  if (!settings.welcome.profilePhotoEnabled) {
    return null;
  }

  try {
    const photos = await tg(
      'getUserProfilePhotos',
      {
        user_id: userId,
        limit: 1
      }
    );

    const sizes =
      photos?.photos?.[0];

    if (!sizes?.length) {
      return null;
    }

    const largest =
      sizes[sizes.length - 1];

    return sendAndRemember(
      chatId,
      'sendPhoto',
      {
        chat_id: chatId,
        photo: largest.file_id
      },
      settings
    );
  } catch {
    return null;
  }
}

function visualOf(b) {
  if (!b.buttonVisualEnabled) {
    return null;
  }

  const type =
    b.buttonVisualMediaType || 'none';

  const source =
    b.buttonVisualMediaSource || 'upload';

  const id =
    b.buttonVisualMediaId || null;

  const url =
    b.buttonVisualMediaUrl ||
    b.buttonImageUrl ||
    '';

  const text =
    b.buttonVisualText || '';

  if (
    type === 'none' &&
    !text
  ) {
    return null;
  }

  return {
    type,
    source,
    id,
    url,
    text
  };
}

async function sendMainPage(
  chatId,
  user
) {
  const settings =
    await getSettings();

  await clearChatMessages(chatId);

  const enabled =
    settings.mainButtons.filter(
      b => b.enabled
    );

  const visualButtons =
    enabled.filter(
      b => !!visualOf(b)
    );

  const layout =
    settings.welcome.layout ||
    'profile_welcome_buttons';

  if (
    layout ===
    'buttons_profile_welcome'
  ) {
    if (visualButtons.length) {
      for (const b of enabled) {
        const v = visualOf(b);

        if (v) {
          if (
            v.type !== 'none' &&
            (v.id || v.url)
          ) {
            await sendMedia(
              chatId,
              v.type,
              v.source,
              v.id,
              v.url,
              v.text,
              undefined,
              settings
            );
          } else if (v.text) {
            await sendAndRemember(
              chatId,
              'sendMessage',
              {
                chat_id: chatId,
                text: v.text
              },
              settings
            );
          }

          await sendAndRemember(
            chatId,
            'sendMessage',
            {
              chat_id: chatId,
              text: b.text,
              reply_markup:
                mainButtonKeyboard(b)
            },
            settings
          );
        } else {
          await sendAndRemember(
            chatId,
            'sendMessage',
            {
              chat_id: chatId,
              text: b.text,
              reply_markup:
                mainButtonKeyboard(b)
            },
            settings
          );
        }
      }
    } else {
      const kb = {
        inline_keyboard:
          enabled.map(b => [
            {
              text: b.text,
              callback_data:
                `main:${b.id}`
            }
          ])
      };

      await sendAndRemember(
        chatId,
        'sendMessage',
        {
          chat_id: chatId,
          text: ' ',
          reply_markup: kb
        },
        settings
      );
    }

    await sendProfilePhoto(
      chatId,
      user.id,
      settings
    );

    await sendAndRemember(
      chatId,
      'sendMessage',
      {
        chat_id: chatId,
        text: welcomeText(
          user,
          settings.welcome.text
        )
      },
      settings
    );

    return;
  }

  await sendProfilePhoto(
    chatId,
    user.id,
    settings
  );

  const welcomeMedia =
    settings.welcome;

  if (
    welcomeMedia.mediaEnabled &&
    welcomeMedia.mediaType !== 'none' &&
    (
      welcomeMedia.mediaId ||
      welcomeMedia.mediaUrl
    )
  ) {
    const welcomeButtons =
      visualButtons.length
        ? undefined
        : {
            inline_keyboard:
              enabled.map(b => [
                {
                  text: b.text,
                  callback_data:
                    `main:${b.id}`
                }
              ])
          };

    await sendMedia(
      chatId,
      welcomeMedia.mediaType,
      welcomeMedia.mediaSource,
      welcomeMedia.mediaId,
      welcomeMedia.mediaUrl,
      welcomeText(
        user,
        welcomeMedia.text
      ),
      welcomeButtons,
      settings
    );
  } else {
    await sendAndRemember(
      chatId,
      'sendMessage',
      {
        chat_id: chatId,
        text: welcomeText(
          user,
          settings.welcome.text
        ),
        reply_markup:
          visualButtons.length
            ? undefined
            : {
                inline_keyboard:
                  enabled.map(b => [
                    {
                      text: b.text,
                      callback_data:
                        `main:${b.id}`
                    }
                  ])
              }
      },
      settings
    );
  }

  if (visualButtons.length) {
    for (const b of enabled) {
      const v = visualOf(b);

      if (v) {
        if (
          v.type !== 'none' &&
          (v.id || v.url)
        ) {
          await sendMedia(
            chatId,
            v.type,
            v.source,
            v.id,
            v.url,
            v.text,
            undefined,
            settings
          );
        } else if (v.text) {
          await sendAndRemember(
            chatId,
            'sendMessage',
            {
              chat_id: chatId,
              text: v.text
            },
            settings
          );
        }
      }

      await sendAndRemember(
        chatId,
        'sendMessage',
        {
          chat_id: chatId,
          text: b.text,
          reply_markup:
            mainButtonKeyboard(b)
        },
        settings
      );
    }
  }
}

async function showSelectedButton(
  chatId,
  buttonId
) {
  const settings =
    await getSettings();

  const b =
    settings.mainButtons.find(
      x => x.id === buttonId
    );

  if (!b || !b.enabled) {
    return;
  }

  await clearChatMessages(chatId);

  if (
    b.headerMediaType !== 'none' &&
    (
      b.headerMediaId ||
      b.headerMediaUrl
    )
  ) {
    await sendMedia(
      chatId,
      b.headerMediaType,
      b.headerMediaSource,
      b.headerMediaId,
      b.headerMediaUrl,
      b.headerText || b.text,
      undefined,
      settings
    );
  } else if (b.headerText) {
    await sendAndRemember(
      chatId,
      'sendMessage',
      {
        chat_id: chatId,
        text: b.headerText
      },
      settings
    );
  }

  const v = visualOf(b);

  if (v) {
    if (
      v.type !== 'none' &&
      (v.id || v.url)
    ) {
      await sendMedia(
        chatId,
        v.type,
        v.source,
        v.id,
        v.url,
        v.text,
        undefined,
        settings
      );
    } else if (v.text) {
      await sendAndRemember(
        chatId,
        'sendMessage',
        {
          chat_id: chatId,
          text: v.text
        },
        settings
      );
    }
  }

  if (!b.headerMediaId &&
      !b.headerMediaUrl &&
      !b.headerText &&
      !v) {
    await sendAndRemember(
      chatId,
      'sendMessage',
      {
        chat_id: chatId,
        text: b.text
      },
      settings
    );
  }

  for (const slot of b.slots) {
    if (!slot.enabled) continue;

    const btns = [
      slot.button1,
      slot.button2
    ].filter(
      x =>
        x &&
        x.enabled &&
        x.url
    );

    const kb =
      keyboard(btns);

    if (
      slot.mediaType !== 'none' &&
      (
        slot.mediaId ||
        slot.mediaUrl
      )
    ) {
      await sendMedia(
        chatId,
        slot.mediaType,
        slot.mediaSource,
        slot.mediaId,
        slot.mediaUrl,
        slot.text,
        kb,
        settings
      );
    } else if (
      slot.text ||
      kb
    ) {
      await sendAndRemember(
        chatId,
        'sendMessage',
        {
          chat_id: chatId,
          text: slot.text || ' ',
          reply_markup: kb
        },
        settings
      );
    }
  }

  await sendAndRemember(
    chatId,
    'sendMessage',
    {
      chat_id: chatId,
      text: '⬅️ BACK',
      reply_markup:
        backKeyboard()
    },
    settings
  );
}

async function processUpdate(update) {
  if (update.message) {
    const msg = update.message;
    const chatId = msg.chat.id;

    if (
      msg.text &&
      msg.text.startsWith('/start')
    ) {
      await sendMainPage(
        chatId,
        msg.from
      );
    }

    return;
  }

  if (update.callback_query) {
    const q =
      update.callback_query;

    const chatId =
      q.message?.chat?.id;

    if (!chatId) return;

    await tg(
      'answerCallbackQuery',
      {
        callback_query_id:
          q.id
      }
    );

    if (
      q.data === 'back'
    ) {
      await sendMainPage(
        chatId,
        q.from
      );

      return;
    }

    if (
      q.data?.startsWith('main:')
    ) {
      const id =
        q.data.substring(5);

      await showSelectedButton(
        chatId,
        id
      );
    }
  }
}

/* =========================
   ADMIN AUTH
========================= */

function auth(req, res, next) {
  const header =
    req.headers.authorization || '';

  const token =
    header.startsWith('Bearer ')
      ? header.substring(7)
      : '';

  if (
    !token ||
    !sessions.has(token)
  ) {
    return res.status(401).json({
      ok: false,
      error: 'UNAUTHORIZED'
    });
  }

  sessions.set(
    token,
    Date.now()
  );

  next();
}

function newToken() {
  return crypto
    .randomBytes(32)
    .toString('hex');
}

/* =========================
   ADMIN API
========================= */

app.post(
  '/api/login',
  async (req, res) => {
    try {
      if (
        str(req.body?.password) !==
        ADMIN_PASSWORD
      ) {
        return res.status(401).json({
          ok: false,
          error: 'INVALID_PASSWORD'
        });
      }

      const token =
        newToken();

      sessions.set(
        token,
        Date.now()
      );

      if (sessions.size > 100) {
        const first =
          sessions.keys().next().value;

        sessions.delete(first);
      }

      res.json({
        ok: true,
        token
      });
    } catch (e) {
      res.status(500).json({
        ok: false,
        error: 'SERVER_ERROR'
      });
    }
  }
);

app.post(
  '/api/logout',
  auth,
  async (req, res) => {
    const header =
      req.headers.authorization || '';

    const token =
      header.startsWith('Bearer ')
        ? header.substring(7)
        : '';

    sessions.delete(token);

    res.json({
      ok: true
    });
  }
);

app.get(
  '/api/settings',
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
        error: e.message ||
          'SERVER_ERROR'
      });
    }
  }
);

app.post(
  '/api/settings',
  auth,
  async (req, res) => {
    try {
      const data =
        req.body?.settings ||
        req.body;

      if (
        !data ||
        typeof data !== 'object'
      ) {
        return res.status(400).json({
          ok: false,
          error: 'INVALID_SETTINGS'
        });
      }

      res.json({
        ok: true,
        settings:
          await saveSettings(data)
      });
    } catch (e) {
      console.error(e);

      res.status(500).json({
        ok: false,
        error:
          e.message ||
          'SERVER_ERROR'
      });
    }
  }
);

/*
  NO FILE SIZE LIMIT.
*/
app.post(
  '/api/upload',
  auth,
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          ok: false,
          error: 'NO_FILE'
        });
      }

      let kind =
        str(req.body.kind)
          .toLowerCase();

      if (
        !['photo', 'video', 'audio']
          .includes(kind)
      ) {
        if (
          req.file.mimetype
            ?.startsWith('image/')
        ) {
          kind = 'photo';
        } else if (
          req.file.mimetype
            ?.startsWith('video/')
        ) {
          kind = 'video';
        } else if (
          req.file.mimetype
            ?.startsWith('audio/')
        ) {
          kind = 'audio';
        } else {
          return res.status(400).json({
            ok: false,
            error:
              'UNSUPPORTED_MEDIA_TYPE'
          });
        }
      }

      const q =
        await pool.query(
          `INSERT INTO bot_media
          (kind,filename,mimetype,data)
          VALUES($1,$2,$3,$4)
          RETURNING
          id,kind,filename,mimetype,created_at`,
          [
            kind,
            req.file.originalname ||
              `upload-${Date.now()}`,
            req.file.mimetype ||
              'application/octet-stream',
            req.file.buffer
          ]
        );

      const m =
        q.rows[0];

      res.json({
        ok: true,
        media: {
          id: Number(m.id),
          kind: m.kind,
          filename: m.filename,
          mimetype: m.mimetype,
          url:
            `/media/${m.id}`
        },
        mediaId:
          Number(m.id)
      });
    } catch (e) {
      console.error(e);

      res.status(500).json({
        ok: false,
        error:
          e.message ||
          'UPLOAD_FAILED'
      });
    }
  }
);

app.get(
  '/media/:id',
  async (req, res) => {
    try {
      const q =
        await pool.query(
          `SELECT
            filename,
            mimetype,
            data
           FROM bot_media
           WHERE id=$1`,
          [
            Number(req.params.id)
          ]
        );

      if (!q.rows.length) {
        return res.status(404)
          .send('Media not found');
      }

      const m =
        q.rows[0];

      res.setHeader(
        'Content-Type',
        m.mimetype ||
          'application/octet-stream'
      );

      res.setHeader(
        'Content-Disposition',
        `inline; filename="${str(
          m.filename
        ).replace(/"/g, '')}"`
      );

      res.setHeader(
        'Cache-Control',
        'public,max-age=31536000,immutable'
      );

      res.send(m.data);
    } catch (e) {
      res.status(500)
        .send('Media error');
    }
  }
);

app.get(
  '/api/media/:id',
  auth,
  async (req, res) => {
    try {
      const q =
        await pool.query(
          `SELECT
            id,
            kind,
            filename,
            mimetype,
            telegram_file_id,
            created_at
           FROM bot_media
           WHERE id=$1`,
          [
            Number(req.params.id)
          ]
        );

      if (!q.rows.length) {
        return res.status(404).json({
          ok: false,
          error: 'NOT_FOUND'
        });
      }

      const m =
        q.rows[0];

      m.id =
        Number(m.id);

      m.url =
        `/media/${m.id}`;

      res.json({
        ok: true,
        media: m
      });
    } catch (e) {
      res.status(500).json({
        ok: false,
        error: 'SERVER_ERROR'
      });
    }
  }
);

app.delete(
  '/api/media/:id',
  auth,
  async (req, res) => {
    try {
      await pool.query(
        `DELETE FROM bot_media
         WHERE id=$1`,
        [
          Number(req.params.id)
        ]
      );

      res.json({
        ok: true
      });
    } catch (e) {
      res.status(500).json({
        ok: false,
        error: 'SERVER_ERROR'
      });
    }
  }
);

app.post(
  '/api/reset',
  auth,
  async (req, res) => {
    try {
      res.json({
        ok: true,
        settings:
          await saveSettings(
            clone(DEFAULT_SETTINGS)
          )
      });
    } catch (e) {
      res.status(500).json({
        ok: false,
        error:
          'RESET_FAILED'
      });
    }
  }
);

app.get(
  '/api/status',
  auth,
  async (req, res) => {
    try {
      const me =
        await tg('getMe');

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
    } catch (e) {
      res.status(500).json({
        ok: false,
        error:
          e.message ||
          'STATUS_FAILED'
      });
    }
  }
);

/* =========================
   TELEGRAM WEBHOOK
========================= */

app.post(
  '/telegram/webhook',
  async (req, res) => {
    try {
      res.json({
        ok: true
      });

      await processUpdate(
        req.body
      );
    } catch (e) {
      console.error(
        'Webhook error:',
        e
      );
    }
  }
);

/* =========================
   HEALTH
========================= */

app.get(
  '/health',
  async (req, res) => {
    try {
      await pool.query(
        'SELECT 1'
      );

      res.json({
        ok: true,
        status: 'running'
      });
    } catch {
      res.status(500).json({
        ok: false,
        status: 'database_error'
      });
    }
  }
);

/* =========================
   ADMIN HTML
========================= */

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

/*
  No artificial upload-size error is used here.
*/
app.use(
  (e, req, res, next) => {
    console.error(e);

    res.status(
      e?.statusCode || 500
    ).json({
      ok: false,
      error:
        e?.message ||
        'SERVER_ERROR'
    });
  }
);

/* =========================
   START
========================= */

async function start() {
  try {
    await initDB();

    app.listen(
      PORT,
      async () => {
        console.log(
          `Server running on port ${PORT}`
        );

        try {
          const base =
            process.env.RENDER_EXTERNAL_URL ||
            (
              process.env.RENDER_EXTERNAL_HOSTNAME
                ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`
                : 'https://telegram-bot-system-kgdq.onrender.com'
            );

          const webhook =
            `${base.replace(/\/$/, '')}/telegram/webhook`;

          await tg(
            'setWebhook',
            {
              url: webhook
            }
          );

          console.log(
            'Telegram webhook:',
            webhook
          );
        } catch (e) {
          console.error(
            'Webhook setup failed:',
            e.message
          );
        }
      }
    );
  } catch (e) {
    console.error(
      'Startup failed:',
      e
    );

    process.exit(1);
  }
}

start();
