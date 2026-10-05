"use strict";

const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const { Pool } = require("pg");

const app = express();

const PORT = Number(process.env.PORT || 10000);

const BOT_TOKEN =
  process.env.BOT_TOKEN || "";

const STORAGE_CHAT_ID =
  process.env.STORAGE_CHAT_ID || "";

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || "CHANGE_ME_NOW";

const APP_SECRET =
  process.env.APP_SECRET ||
  crypto.randomBytes(32).toString("hex");

const DATABASE_URL =
  process.env.DATABASE_URL || "";


/* =========================================================
   EXPRESS
========================================================= */

app.use(express.json({limit:"2mb"}));
app.use(express.urlencoded({extended:true}));


/* =========================================================
   MULTER
========================================================= */

const upload = multer({
  storage: multer.memoryStorage(),

  limits:{
    fileSize:50 * 1024 * 1024
  }
});


/* =========================================================
   DATABASE
========================================================= */

let pool = null;

if(DATABASE_URL){

  pool = new Pool({
    connectionString:DATABASE_URL,

    ssl:
      process.env.NODE_ENV === "production"
        ? {rejectUnauthorized:false}
        : false,

    max:5
  });

}


/* =========================================================
   DEFAULT CONFIG
========================================================= */

function emptyButton(text=""){

  return {
    enabled:false,
    text,
    url:""
  };

}


function emptyItem(){

  return {
    enabled:false,
    type:"none",
    fileId:"",
    url:"",
    text:"",

    buttons:[
      emptyButton("Open"),
      emptyButton("Support")
    ]
  };

}


function makeCategory(){

  return Array.from(
    {length:10},
    () => emptyItem()
  );

}


function defaultConfig(){

  return {

    welcome:{

      enabled:true,

      profilePhoto:true,

      channelName:"My Channel",

      text:
        "Welcome {name}!\n\nWelcome to {channel}.",

      size:"medium",

      buttons:[
        {
          enabled:true,
          text:"🔥 VIP GROUP",
          url:""
        },
        {
          enabled:true,
          text:"🤖 AI HACK",
          url:""
        },
        {
          enabled:true,
          text:"💬 SUPPORT",
          url:""
        },
        {
          enabled:true,
          text:"📢 OFFICIAL CHANNEL",
          url:""
        },
        {
          enabled:true,
          text:"🎁 BONUS",
          url:""
        },
        {
          enabled:true,
          text:"👨‍💻 ADMIN",
          url:""
        }
      ]

    },


    mainButtons:[

      {
        enabled:true,
        text:"🤖 AI HACK All Link Check",
        category:"aiHack",
        url:""
      },

      {
        enabled:true,
        text:"🔥 VIP GROUP All Link Check",
        category:"vip",
        url:""
      },

      {
        enabled:true,
        text:"💬 SUPPORT All Link Check",
        category:"support",
        url:""
      },

      {
        enabled:true,
        text:"📢 OFFICIAL CHANNEL All Link Check",
        category:"official",
        url:""
      },

      {
        enabled:true,
        text:"🎁 BONUS All Link Check",
        category:"bonus",
        url:""
      },

      {
        enabled:true,
        text:"👨‍💻 ADMIN All Link Check",
        category:"admin",
        url:""
      }

    ],


    startMedia:{

      enabled:false,

      type:"none",

      fileId:"",

      url:"",

      caption:""

    },


    categories:{

      aiHack:makeCategory(),

      vip:makeCategory(),

      support:makeCategory(),

      official:makeCategory(),

      bonus:makeCategory(),

      admin:makeCategory()

    },


    audio:{

      enabled:false,

      fileId:"",

      url:"",

      text:"",

      buttons:[
        emptyButton("Open"),
        emptyButton("Support")
      ]

    },


    autoDelete:600,

    adminPasswordHash:""

  };

}


let cachedConfig =
  defaultConfig();


/* =========================================================
   DATABASE FUNCTIONS
========================================================= */

async function initDatabase(){

  if(!pool){

    console.log(
      "DATABASE_URL not set. Using memory storage."
    );

    return;
  }

  await pool.query(`

    CREATE TABLE IF NOT EXISTS bot_settings (

      id INTEGER PRIMARY KEY,

      config JSONB NOT NULL,

      updated_at TIMESTAMPTZ
      DEFAULT NOW()

    )

  `);


  const result =
    await pool.query(
      "SELECT config FROM bot_settings WHERE id=1"
    );


  if(result.rows.length===0){

    await pool.query(

      `INSERT INTO bot_settings(id,config)
       VALUES(1,$1)`,

      [JSON.stringify(cachedConfig)]

    );

  }else{

    cachedConfig =
      mergeDefaults(
        defaultConfig(),
        result.rows[0].config
      );

  }

}


function mergeDefaults(base,data){

  if(!data || typeof data!=="object"){
    return base;
  }

  for(const key of Object.keys(base)){

    if(
      data[key] !== undefined &&
      data[key] !== null
    ){

      if(
        typeof base[key]==="object" &&
        !Array.isArray(base[key]) &&
        typeof data[key]==="object" &&
        !Array.isArray(data[key])
      ){

        base[key] =
          mergeDefaults(
            base[key],
            data[key]
          );

      }else{

        base[key] = data[key];

      }

    }

  }

  return base;

}


async function getConfig(){

  if(!pool){

    return cachedConfig;

  }

  const result =
    await pool.query(
      "SELECT config FROM bot_settings WHERE id=1"
    );

  if(!result.rows.length){

    return cachedConfig;

  }

  cachedConfig =
    mergeDefaults(
      defaultConfig(),
      result.rows[0].config
    );

  return cachedConfig;

}


async function saveConfig(config){

  cachedConfig =
    mergeDefaults(
      defaultConfig(),
      config
    );

  if(!pool){

    return cachedConfig;

  }

  await pool.query(

    `INSERT INTO bot_settings
      (id,config,updated_at)
     VALUES
      (1,$1,NOW())
     ON CONFLICT(id)
     DO UPDATE SET
       config=EXCLUDED.config,
       updated_at=NOW()`,

    [JSON.stringify(cachedConfig)]

  );

  return cachedConfig;

}


/* =========================================================
   PASSWORD
========================================================= */

function hashPassword(password){

  return new Promise((resolve,reject)=>{

    const salt =
      crypto.randomBytes(16).toString("hex");

    crypto.scrypt(
      password,
      salt,
      64,
      (err,derived)=>{

        if(err){

          reject(err);

          return;
        }

        resolve(
          salt +
          ":" +
          derived.toString("hex")
        );

      }
    );

  });

}


function verifyHash(password,stored){

  return new Promise((resolve,reject)=>{

    if(!stored){

      resolve(false);

      return;
    }

    const parts =
      stored.split(":");

    if(parts.length!==2){

      resolve(false);

      return;
    }

    const salt = parts[0];

    const key =
      Buffer.from(parts[1],"hex");

    crypto.scrypt(
      password,
      salt,
      64,
      (err,derived)=>{

        if(err){

          reject(err);

          return;
        }

        resolve(
          key.length === derived.length &&
          crypto.timingSafeEqual(
            key,
            derived
          )
        );

      }
    );

  });

}


async function passwordIsCorrect(password){

  const cfg =
    await getConfig();

  if(cfg.adminPasswordHash){

    return verifyHash(
      password,
      cfg.adminPasswordHash
    );

  }

  return (
    password === ADMIN_PASSWORD
  );

}


/* =========================================================
   AUTH COOKIE
========================================================= */

function authToken(){

  return crypto
    .createHmac(
      "sha256",
      APP_SECRET
    )
    .update(
      "telegram-bot-admin-auth"
    )
    .digest("hex");

}


function setAuthCookie(res){

  res.setHeader(
    "Set-Cookie",
    `admin_auth=${authToken()}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`
  );

}


function isAuthenticated(req){

  const cookie =
    req.headers.cookie || "";

  const match =
    cookie.match(
      /(?:^|;\s*)admin_auth=([^;]+)/
    );

  return (
    match &&
    match[1] === authToken()
  );

}


function requireAuth(req,res,next){

  if(!isAuthenticated(req)){

    return res
      .status(401)
      .json({
        ok:false,
        message:"Unauthorized"
      });

  }

  next();

}


/* =========================================================
   TELEGRAM API
========================================================= */

async function telegram(method,params={}){

  if(!BOT_TOKEN){

    throw new Error(
      "BOT_TOKEN is not configured"
    );

  }

  const response =
    await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
      {
        method:"POST",

        headers:{
          "Content-Type":"application/json"
        },

        body:JSON.stringify(params)
      }
    );


  const data =
    await response.json();


  if(!data.ok){

    throw new Error(
      data.description ||
      `Telegram API error: ${method}`
    );

  }

  return data.result;

}


/* =========================================================
   TELEGRAM MEDIA UPLOAD
========================================================= */

async function telegramUpload(
  method,
  fieldName,
  file
){

  if(!BOT_TOKEN){

    throw new Error(
      "BOT_TOKEN missing"
    );

  }

  if(!STORAGE_CHAT_ID){

    throw new Error(
      "STORAGE_CHAT_ID missing"
    );

  }

  const form =
    new FormData();

  form.append(
    "chat_id",
    String(STORAGE_CHAT_ID)
  );


  form.append(
    fieldName,
    new Blob(
      [file.buffer],
      {type:file.mimetype}
    ),
    file.originalname
  );


  const response =
    await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
      {
        method:"POST",
        body:form
      }
    );


  const data =
    await response.json();


  if(!data.ok){

    throw new Error(
      data.description ||
      "Telegram upload failed"
    );

  }


  const message =
    data.result;


  if(method==="sendPhoto"){

    const photos =
      message.photo || [];

    return photos.length
      ? photos[photos.length-1].file_id
      : "";

  }


  if(method==="sendVideo"){

    return message.video?.file_id || "";

  }


  if(method==="sendAudio"){

    return message.audio?.file_id || "";

  }


  if(method==="sendVoice"){

    return message.voice?.file_id || "";

  }


  if(method==="sendDocument"){

    return message.document?.file_id || "";

  }


  return "";

}


/* =========================================================
   SEND HELPERS
========================================================= */

function replaceVars(text,user,channelName){

  return String(text || "")

    .replaceAll(
      "{name}",
      user?.first_name || "User"
    )

    .replaceAll(
      "{username}",
      user?.username
        ? "@"+user.username
        : ""
    )

    .replaceAll(
      "{channel}",
      channelName || "Channel"
    );

}


function keyboard(buttons,back=false){

  const rows = [];


  for(const b of buttons || []){

    if(!b || !b.enabled || !b.text){

      continue;

    }


    if(b.url){

      rows.push([
        {
          text:b.text,
          url:b.url
        }
      ]);

    }

  }


  if(back){

    rows.push([
      {
        text:"⬅️ Back",
        callback_data:"BACK"
      }
    ]);

  }


  return rows.length
    ? {inline_keyboard:rows}
    : undefined;

}


function categoryKeyboard(config){

  const rows = [];


  for(const b of config.mainButtons){

    if(!b.enabled || !b.text){

      continue;

    }


    if(b.url){

      rows.push([
        {
          text:b.text,
          url:b.url
        }
      ]);

    }else{

      rows.push([
        {
          text:b.text,
          callback_data:
            "CAT:" + b.category
        }
      ]);

    }

  }


  return {
    inline_keyboard:rows
  };

}


function itemKeyboard(item){

  const rows=[];


  for(const b of item.buttons || []){

    if(!b.enabled || !b.text){

      continue;

    }


    if(b.url){

      rows.push([
        {
          text:b.text,
          url:b.url
        }
      ]);

    }

  }


  return rows.length
    ? {inline_keyboard:rows}
    : undefined;

}


/* =========================================================
   EPHEMERAL SUPPORT
========================================================= */

function ephemeralParams(
  chat,
  userId,
  callbackId
){

  if(
    !userId ||
    !chat ||
    (
      chat.type!=="group" &&
      chat.type!=="supergroup"
    )
  ){

    return {};

  }


  const value = {

    receiver_user_id:Number(userId)

  };


  if(callbackId){

    value.callback_query_id =
      String(callbackId);

  }


  return {
    ephemeral_message_parameters:value
  };

}


/* =========================================================
   SEND TEXT
========================================================= */

async function sendText(
  chatId,
  chat,
  userId,
  text,
  markup,
  callbackId
){

  const params={

    chat_id:chatId,

    text:String(text || " ")

  };


  if(markup){

    params.reply_markup=markup;

  }


  Object.assign(
    params,
    ephemeralParams(
      chat,
      userId,
      callbackId
    )
  );


  return telegram(
    "sendMessage",
    params
  );

}


/* =========================================================
   SEND MEDIA
========================================================= */

async function sendMedia(
  chatId,
  chat,
  userId,
  item,
  caption="",
  markup,
  callbackId
){

  const type =
    item.type || "none";

  const source =
    item.fileId || item.url;


  if(!source){

    if(caption){

      return sendText(
        chatId,
        chat,
        userId,
        caption,
        markup,
        callbackId
      );

    }

    return null;

  }


  const method =
    type==="video"
      ? "sendVideo"
      : type==="image"
        ? "sendPhoto"
        : type==="audio"
          ? "sendAudio"
          : "sendDocument";


  const field =
    type==="video"
      ? "video"
      : type==="image"
        ? "photo"
        : type==="audio"
          ? "audio"
          : "document";


  const params={

    chat_id:chatId,

    [field]:source

  };


  if(caption){

    if(type==="audio"){

      params.caption=caption;

    }else{

      params.caption=caption;

    }

  }


  if(markup){

    params.reply_markup=markup;

  }


  Object.assign(
    params,
    ephemeralParams(
      chat,
      userId,
      callbackId
    )
  );


  return telegram(
    method,
    params
  );

}


/* =========================================================
   PROFILE PHOTO
========================================================= */

async function sendUserProfile(
  chatId,
  chat,
  user
){

  try{

    const result =
      await telegram(
        "getUserProfilePhotos",
        {
          user_id:user.id,
          limit:1
        }
      );


    if(
      !result.total_count ||
      !result.photos?.length
    ){

      return null;

    }


    const sizes =
      result.photos[0];


    const photo =
      sizes[sizes.length-1];


    return sendMedia(
      chatId,
      chat,
      user.id,
      {
        type:"image",
        fileId:photo.file_id
      },
      "",
      undefined
    );

  }catch(e){

    console.log(
      "Profile photo:",
      e.message
    );

    return null;

  }

}


/* =========================================================
   MESSAGE CLEANUP
========================================================= */

const recentMessages =
  new Map();


function rememberMessage(
  chatId,
  message
){

  if(!message?.message_id){

    return;

  }


  const key =
    String(chatId);


  if(!recentMessages.has(key)){

    recentMessages.set(
      key,
      []
    );

  }


  const arr =
    recentMessages.get(key);


  arr.push(
    message.message_id
  );


  while(arr.length>100){

    arr.shift();

  }

}


async function cleanupChat(chatId){

  const key =
    String(chatId);


  const arr =
    recentMessages.get(key) || [];


  for(const id of arr){

    try{

      await telegram(
        "deleteMessage",
        {
          chat_id:chatId,
          message_id:id
        }
      );

    }catch(e){

      // Ignore messages that cannot be deleted.
    }

  }


  recentMessages.set(
    key,
    []
  );

}


function scheduleDelete(
  chatId,
  messageIds,
  seconds
){

  if(
    !seconds ||
    !messageIds?.length
  ){

    return;

  }


  setTimeout(
    async()=>{

      for(const id of messageIds){

        try{

          await telegram(
            "deleteMessage",
            {
              chat_id:chatId,
              message_id:id
            }
          );

        }catch(e){}

      }

    },
    Number(seconds)*1000
  );

}


/* =========================================================
   WELCOME
========================================================= */

async function sendWelcome(
  chat,
  user,
  callbackId
){

  const cfg =
    await getConfig();


  if(!cfg.welcome.enabled){

    return;

  }


  const chatId =
    chat.id;


  const sent=[];


  const ephemeral =
    (
      chat.type==="group" ||
      chat.type==="supergroup"
    );


  const targetUser =
    ephemeral
      ? user.id
      : null;


  /* START MEDIA */

  if(cfg.startMedia.enabled){

    const mediaMessage =
      await sendMedia(
        chatId,
        chat,
        targetUser,
        cfg.startMedia,
        replaceVars(
          cfg.startMedia.caption,
          user,
          cfg.welcome.channelName
        ),
        undefined,
        callbackId
      );

    if(mediaMessage){

      rememberMessage(
        chatId,
        mediaMessage
      );

      if(mediaMessage.message_id){

        sent.push(
          mediaMessage.message_id
        );

      }

    }

  }


  /* PROFILE */

  if(cfg.welcome.profilePhoto){

    const profile =
      await sendUserProfile(
        chatId,
        chat,
        user
      );

    if(profile){

      rememberMessage(
        chatId,
        profile
      );

      if(profile.message_id){

        sent.push(
          profile.message_id
        );

      }

    }

  }


  /* WELCOME TEXT */

  const text =
    replaceVars(
      cfg.welcome.text,
      user,
      cfg.welcome.channelName
    );


  const message =
    await sendText(
      chatId,
      chat,
      targetUser,
      text,
      categoryKeyboard(cfg),
      callbackId
    );


  if(message){

    rememberMessage(
      chatId,
      message
    );

    if(message.message_id){

      sent.push(
        message.message_id
      );

    }

  }


  /* AUTO DELETE FOR NORMAL PRIVATE MESSAGES */

  if(!ephemeral){

    scheduleDelete(
      chatId,
      sent,
      cfg.autoDelete
    );

  }

}


/* =========================================================
   CATEGORY
========================================================= */

async function sendCategory(
  chat,
  user,
  category,
  callbackId
){

  const cfg =
    await getConfig();


  const list =
    cfg.categories[category] || [];


  const chatId =
    chat.id;


  const ephemeral =
    (
      chat.type==="group" ||
      chat.type==="supergroup"
    );


  const targetUser =
    ephemeral
      ? user.id
      : null;


  if(!ephemeral){

    await cleanupChat(
      chatId
    );

  }


  const sent=[];


  for(const item of list){

    if(!item.enabled){

      continue;

    }


    const text =
      replaceVars(
        item.text,
        user,
        cfg.welcome.channelName
      );


    let msg;


    if(
      item.type!=="none" &&
      (item.fileId || item.url)
    ){

      msg =
        await sendMedia(
          chatId,
          chat,
          targetUser,
          item,
          text,
          itemKeyboard(item),
          callbackId
        );

    }else{

      msg =
        await sendText(
          chatId,
          chat,
          targetUser,
          text,
          itemKeyboard(item),
          callbackId
        );

    }


    if(msg){

      rememberMessage(
        chatId,
        msg
      );

      if(msg.message_id){

        sent.push(
          msg.message_id
        );

      }

    }

  }


  const back =
    await sendText(
      chatId,
      chat,
      targetUser,
      "Choose another category:",
      {
        inline_keyboard:[
          [
            {
              text:"⬅️ Back",
              callback_data:"BACK"
            }
          ]
        ]
      },
      callbackId
    );


  if(back){

    rememberMessage(
      chatId,
      back
    );

    if(back.message_id){

      sent.push(
        back.message_id
      );

    }

  }


  if(!ephemeral){

    scheduleDelete(
      chatId,
      sent,
      cfg.autoDelete
    );

  }

}


/* =========================================================
   AUDIO
========================================================= */

async function sendAudioSystem(
  chat,
  user
){

  const cfg =
    await getConfig();


  if(!cfg.audio.enabled){

    return;

  }


  const text =
    replaceVars(
      cfg.audio.text,
      user,
      cfg.welcome.channelName
    );


  const item={

    type:"audio",

    fileId:cfg.audio.fileId,

    url:cfg.audio.url

  };


  const message =
    await sendMedia(
      chat.id,
      chat,
      chat.type==="group" ||
      chat.type==="supergroup"
        ? user.id
        : null,
      item,
      text,
      keyboard(cfg.audio.buttons)
    );


  if(message){

    rememberMessage(
      chat.id,
      message
    );

  }

}


/* =========================================================
   TELEGRAM UPDATE HANDLER
========================================================= */

async function handleUpdate(update){

  const cfg =
    await getConfig();


  /* CALLBACK */

  if(update.callback_query){

    const q =
      update.callback_query;

    const chat =
      q.message?.chat;

    const user =
      q.from;


    if(!chat){

      return;

    }


    try{

      await telegram(
        "answerCallbackQuery",
        {
          callback_query_id:
            q.id
        }
      );

    }catch(e){}


    if(q.data==="BACK"){

      if(chat.type==="private"){

        await cleanupChat(
          chat.id
        );

      }

      await sendWelcome(
        chat,
        user,
        q.id
      );

      return;

    }


    if(
      q.data &&
      q.data.startsWith("CAT:")
    ){

      const category =
        q.data.slice(4);


      if(
        !cfg.categories[category]
      ){

        return;

      }


      await sendCategory(
        chat,
        user,
        category,
        q.id
      );

      return;

    }


    return;

  }


  /* MESSAGE */

  if(update.message){

    const message =
      update.message;

    const chat =
      message.chat;


    /* START */

    if(
      message.text &&
      /^\/start\b/i.test(
        message.text
      )
    ){

      if(chat.type==="private"){

        await cleanupChat(
          chat.id
        );

      }


      await sendWelcome(
        chat,
        message.from
      );

      return;

    }


    /* NEW MEMBER */

    if(
      message.new_chat_members &&
      message.new_chat_members.length
    ){

      for(
        const user
        of message.new_chat_members
      ){

        if(user.is_bot){

          continue;

        }


        await sendWelcome(
          chat,
          user
        );

      }

      return;

    }

  }


  /* CHAT MEMBER UPDATE */

  if(update.chat_member){

    const cm =
      update.chat_member;


    const oldStatus =
      cm.old_chat_member?.status;

    const newStatus =
      cm.new_chat_member?.status;


    const wasOut =
      ["left","kicked"]
        .includes(oldStatus);


    const isIn =
      ["member","administrator","creator","restricted"]
        .includes(newStatus);


    if(wasOut && isIn){

      await sendWelcome(
        cm.chat,
        cm.new_chat_member.user
      );

    }

  }

}


/* =========================================================
   WEBHOOK
========================================================= */

app.post(
  "/telegram/webhook",
  async(req,res)=>{

    res.status(200).json({
      ok:true
    });


    try{

      await handleUpdate(
        req.body
      );

    }catch(e){

      console.error(
        "Telegram update error:",
        e
      );

    }

  }
);


/* =========================================================
   ADMIN LOGIN
========================================================= */

app.post(
  "/api/login",
  async(req,res)=>{

    try{

      const password =
        String(
          req.body.password || ""
        );


      if(
        !password ||
        !(await passwordIsCorrect(password))
      ){

        return res
          .status(401)
          .json({
            ok:false,
            message:"Wrong password"
          });

      }


      setAuthCookie(res);


      res.json({
        ok:true
      });

    }catch(e){

      res
        .status(500)
        .json({
          ok:false,
          message:e.message
        });

    }

  }
);


/* =========================================================
   LOGOUT
========================================================= */

app.post(
  "/api/logout",
  (req,res)=>{

    res.setHeader(
      "Set-Cookie",
      "admin_auth=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"
    );

    res.json({
      ok:true
    });

  }
);


/* =========================================================
   GET SETTINGS
========================================================= */

app.get(
  "/api/settings",
  requireAuth,
  async(req,res)=>{

    try{

      res.json(
        await getConfig()
      );

    }catch(e){

      res
        .status(500)
        .json({
          ok:false,
          message:e.message
        });

    }

  }
);


/* =========================================================
   SAVE SETTINGS
========================================================= */

app.post(
  "/api/settings",
  requireAuth,
  async(req,res)=>{

    try{

      const saved =
        await saveConfig(
          req.body
        );


      res.json({
        ok:true,
        config:saved
      });

    }catch(e){

      res
        .status(500)
        .json({
          ok:false,
          message:e.message
        });

    }

  }
);


/* =========================================================
   RESET
========================================================= */

app.post(
  "/api/reset",
  requireAuth,
  async(req,res)=>{

    try{

      const current =
        await getConfig();


      const fresh =
        defaultConfig();


      fresh.adminPasswordHash =
        current.adminPasswordHash;


      const saved =
        await saveConfig(
          fresh
        );


      res.json({
        ok:true,
        config:saved
      });

    }catch(e){

      res
        .status(500)
        .json({
          ok:false,
          message:e.message
        });

    }

  }
);


/* =========================================================
   CHANGE PASSWORD
========================================================= */

app.post(
  "/api/change-password",
  requireAuth,
  async(req,res)=>{

    try{

      const current =
        String(
          req.body.current || ""
        );

      const password =
        String(
          req.body.password || ""
        );


      if(
        !current ||
        !password ||
        password.length < 6
      ){

        return res
          .status(400)
          .json({
            ok:false,
            message:
              "Password must be at least 6 characters"
          });

      }


      if(
        !(await passwordIsCorrect(current))
      ){

        return res
          .status(401)
          .json({
            ok:false,
            message:"Current password is wrong"
          });

      }


      const cfg =
        await getConfig();


      cfg.adminPasswordHash =
        await hashPassword(
          password
        );


      await saveConfig(
        cfg
      );


      res.json({
        ok:true
      });

    }catch(e){

      res
        .status(500)
        .json({
          ok:false,
          message:e.message
        });

    }

  }
);


/* =========================================================
   UPLOAD
========================================================= */

app.post(
  "/api/upload",
  requireAuth,
  upload.single("file"),
  async(req,res)=>{

    try{

      if(!req.file){

        return res
          .status(400)
          .json({
            ok:false,
            message:"No file selected"
          });

      }


      const mediaType =
        String(
          req.body.mediaType || ""
        );


      let method =
        "sendDocument";

      let field =
        "document";


      if(mediaType==="video"){

        method="sendVideo";
        field="video";

      }else if(mediaType==="image"){

        method="sendPhoto";
        field="photo";

      }else if(mediaType==="audio"){

        method="sendAudio";
        field="audio";

      }else if(mediaType==="voice"){

        method="sendVoice";
        field="voice";

      }


      const fileId =
        await telegramUpload(
          method,
          field,
          req.file
        );


      res.json({
        ok:true,
        fileId
      });

    }catch(e){

      console.error(
        "Upload error:",
        e
      );

      res
        .status(500)
        .json({
          ok:false,
          message:e.message
        });

    }

  }
);


/* =========================================================
   HEALTH
========================================================= */

app.get(
  "/health",
  (req,res)=>{

    res.json({

      ok:true,

      server:"online",

      botConfigured:Boolean(
        BOT_TOKEN
      ),

      databaseConfigured:Boolean(
        DATABASE_URL
      )

    });

  }
);


/* =========================================================
   ADMIN HTML
========================================================= */

app.get(
  ["/","/admin","/Admin.html"],
  (req,res)=>{

    res.sendFile(
      require("path").join(
        __dirname,
        "Admin.html"
      )
    );

  }
);


/* =========================================================
   WEBHOOK SETUP
========================================================= */

async function setupWebhook(){

  if(!BOT_TOKEN){

    console.log(
      "BOT_TOKEN missing. Telegram bot disabled."
    );

    return;

  }


  const base =
    process.env.RENDER_EXTERNAL_URL ||
    "";


  if(!base){

    console.log(
      "RENDER_EXTERNAL_URL missing. Webhook not set."
    );

    return;

  }


  const webhookUrl =
    `${base}/telegram/webhook`;


  try{

    await telegram(
      "deleteWebhook",
      {
        drop_pending_updates:false
      }
    );


    await telegram(
      "setWebhook",
      {
        url:webhookUrl,

        allowed_updates:[
          "message",
          "callback_query",
          "chat_member"
        ]
      }
    );


    console.log(
      "Telegram webhook:",
      webhookUrl
    );

  }catch(e){

    console.error(
      "Webhook setup error:",
      e.message
    );

  }

}


/* =========================================================
   START
========================================================= */

async function start(){

  try{

    await initDatabase();

  }catch(e){

    console.error(
      "Database error:",
      e.message
    );

  }


  app.listen(
    PORT,
    "0.0.0.0",
    async()=>{

      console.log(
        `Server running on ${PORT}`
      );


      await setupWebhook();

    }
  );

}


start();
