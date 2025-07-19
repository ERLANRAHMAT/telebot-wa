const { Telegraf } = require("telegraf")
const fs = require("fs")
const path = require("path")
const syntaxError = require("syntax-error")
const child_process = require("child_process")
require("./config")
const chalk = require('chalk')

const conn = new Telegraf(global.token)
global.API = (name, path = '/', query = {}, apikeyqueryname) => (name in global.APIs ? global.APIs[name] : name) + path + (query || apikeyqueryname ? '?' + new URLSearchParams(Object.entries({ ...query, ...(apikeyqueryname ? { [apikeyqueryname]: global.APIKeys[name in global.APIs ? global.APIs[name] : name] } : {}) })) : '')
// global.Fn = function functionCallBack(fn, ...args) { return fn.call(global.conn, ...args) }
global.timestamp = {
  start: new Date
}

function waktuWIB() {
  const now = new Date()
  // WIB: GMT+7
  const wibTime = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  const options = {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Jakarta",
    timeZoneName: "longOffset",
  }
  const formatted = wibTime.toLocaleString("en-US", options)
  return `[${formatted.replace(/GMT\+7/, "GMT+0700")} (Western Indonesia Time - WIB)]`
}

conn.logger = {
  info: (msg) =>
    console.log(`${chalk.green.bold("INFO")} ${chalk.white.bold(waktuWIB())}: ${chalk.cyan(msg)}`),
  warn: (msg) =>
    console.log(
      `${chalk.hex('#FF8800').bold("WARNING")} ${chalk.white.bold(waktuWIB())}: ${chalk.yellow(msg)}`,
    ),
  error: (msg) =>
    console.log(`${chalk.red.bold("ERROR")} ${chalk.white.bold(waktuWIB())}: ${chalk.red(msg)}`),
}

require("./lib/simple")(conn)

let dbLibrary
try {
  dbLibrary = require("lowdb")
} catch (error) {
  dbLibrary = require("./lib/lowdb")
}
const { Low, JSONFile } = dbLibrary

const adapter = new JSONFile("./database.json")
global.db = new Low(adapter)

global.loadDatabase = async () => {
  if (global.db.READ) {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (!global.db.READ) {
          clearInterval(interval)
          resolve(global.db.data == null ? global.loadDatabase() : global.db.data)
        }
      }, 1000)
    })
  }

  if (global.db.data !== null) return

  global.db.READ = true
  await global.db.read()
  global.db.READ = false
  global.db.data = {
    users: {},
    chats: {},
    stats: {},
    msgs: {},
    sticker: {},
    ...(global.db.data || {}),
  }
  global.db.READ = false
}

async function saveDatabase() {
  try {
    if (global.db.data) {
      await global.db.write()
    }
  } catch (e) {
    console.log("Save database error:", e)
  }
}

loadDatabase()
setInterval(saveDatabase, 30000)

global.plugins = {}
const pluginsDir = path.join(__dirname, "plugins")

function loadPlugins() {
  if (!fs.existsSync(pluginsDir)) {
    fs.mkdirSync(pluginsDir)
  }

  const files = fs.readdirSync(pluginsDir).filter((file) => file.endsWith(".js"))

  for (const file of files) {
    try {
      delete require.cache[require.resolve(path.join(pluginsDir, file))]
      global.plugins[file] = require(path.join(pluginsDir, file))
    } catch (e) {
      console.log(`Error loading plugin ${file}:`, e)
    }
  }
}

loadPlugins()

global.reload = (event, filePath) => {
  if (/\.js$/.test(filePath)) {
    const fullFilePath = path.join(pluginsDir, filePath)
    if (fullFilePath in require.cache) {
      delete require.cache[fullFilePath]
      if (fs.existsSync(fullFilePath)) {
        conn.logger.info(`Re-requiring plugin '${filePath}'`)
      } else {
        conn.logger.warn(`Deleted plugin '${filePath}'`)
        return delete global.plugins[filePath]
      }
    } else {
      conn.logger.info(`Requiring new plugin '${filePath}'`)
    }

    const errorCheck = syntaxError(fs.readFileSync(fullFilePath), filePath)
    if (errorCheck) {
      conn.logger.error(`Syntax error while loading '${filePath}':\n${errorCheck}`)
    } else {
      try {
        global.plugins[filePath] = require(fullFilePath)
      } catch (error) {
        conn.logger.error(error)
      } finally {
        global.plugins = Object.fromEntries(Object.entries(global.plugins).sort(([a], [b]) => a.localeCompare(b)))
      }
    }
  }
}

Object.freeze(global.reload)
fs.watch(path.join(__dirname, "plugins"), global.reload)

global.reloadHandler = () => {
  return require("./handler")
}

function smsg(ctx) {
  if (!ctx.message && !ctx.callback_query) return null

  const m = ctx.message || ctx.callback_query.message
  const M = {}

  if (ctx.chat.type === "channel") {
    return null
  }

  M.text = m.text || m.caption || ""
  M.mtype = Object.keys(m)[1] || Object.keys(m)[0]
  M.id = m.message_id
  M.chat = ctx.chat.id
  M.sender = ctx.from.id
  M.fromMe = ctx.from.is_bot
  M.name = ctx.from.first_name || ctx.from.username || "Unknown"
  M.firstname = ctx.from.first_name || ""
  M.lastname = ctx.from.last_name || ""
  M.usertag = ctx.from.username || ""
  M.isBot = ctx.from.is_bot
  M.isGroup = ctx.chat.type === "group" || ctx.chat.type === "supergroup"

  if (M.isGroup) {
    M.groupName = ctx.chat.title || "Unknown Group"
  }

  M.mentionedJid = []

  if (ctx.callback_query) {
    M.callbackQuery = ctx.callback_query
    M.data = ctx.callback_query.data
  }

  if (m.entities) {
    m.entities.forEach((entity) => {
      if (entity.type === "mention") {
        M.mentionedJid.push(entity.user?.id)
      }
    })
  }

  const ctxCopy = JSON.parse(JSON.stringify(ctx, (key, value) => {
    if (key === 'token') return '[HIDDEN]'
    return value
  }))
  M.fakeObj = ctxCopy

  M.reply = async (text, options = {}) => {
    return await conn.reply(M.chat, text, { message_id: M.id }, options)
  }

  M.copy = () => M

  M.forward = async (jid) => {
    return await conn.telegram.forwardMessage(jid, M.chat, M.id)
  }

  M.delete = async () => {
    return await conn.telegram.deleteMessage(M.chat, M.id)
  }

  if (m.reply_to_message) {
    const quotedCtxCopy = JSON.parse(JSON.stringify(ctx, (key, value) => {
      if (key === 'token') return '[HIDDEN]'
      return value
    }))

    M.quoted = {
      text: m.reply_to_message.text || m.reply_to_message.caption || "",
      mtype: Object.keys(m.reply_to_message)[1] || Object.keys(m.reply_to_message)[0],
      id: m.reply_to_message.message_id,
      chat: ctx.chat.id,
      sender: m.reply_to_message.from.id,
      fromMe: m.reply_to_message.from.is_bot,
      name: m.reply_to_message.from.first_name || m.reply_to_message.from.username || "Unknown",
      firstname: m.reply_to_message.from.first_name || "",
      lastname: m.reply_to_message.from.last_name || "",
      usertag: m.reply_to_message.from.username || "",
      isBot: m.reply_to_message.from.is_bot,
      isGroup: ctx.chat.type === "group" || ctx.chat.type === "supergroup",
      message_id: m.reply_to_message.message_id,
      mentionedJid: [],
      fakeObj: quotedCtxCopy,
      reply: async (text, options = {}) => {
        return await conn.reply(M.chat, text, { message_id: m.reply_to_message.message_id }, options)
      },
      copy: () => M.quoted,
      forward: async (jid) => {
        return await conn.telegram.forwardMessage(jid, M.chat, m.reply_to_message.message_id)
      },
      delete: async () => {
        return await conn.telegram.deleteMessage(M.chat, m.reply_to_message.message_id)
      },
      download: async () => {
        if (m.reply_to_message.photo) {
          const fileId = m.reply_to_message.photo[m.reply_to_message.photo.length - 1].file_id
          const file = await conn.telegram.getFile(fileId)
          return await downloadFile(file.file_path)
        } else if (m.reply_to_message.document) {
          const file = await conn.telegram.getFile(m.reply_to_message.document.file_id)
          return await downloadFile(file.file_path)
        } else if (m.reply_to_message.video) {
          const file = await conn.telegram.getFile(m.reply_to_message.video.file_id)
          return await downloadFile(file.file_path)
        } else if (m.reply_to_message.audio) {
          const file = await conn.telegram.getFile(m.reply_to_message.audio.file_id)
          return await downloadFile(file.file_path)
        }
        return null
      },
    }

    if (m.reply_to_message.entities) {
      m.reply_to_message.entities.forEach((entity) => {
        if (entity.type === "mention") {
          M.quoted.mentionedJid.push(entity.user?.id)
        }
      })
    }
  }

  M.download = async () => {
    if (m.photo) {
      const fileId = m.photo[m.photo.length - 1].file_id
      const file = await conn.telegram.getFile(fileId)
      return await downloadFile(file.file_path)
    } else if (m.document) {
      const file = await conn.telegram.getFile(m.document.file_id)
      return await downloadFile(file.file_path)
    } else if (m.video) {
      const file = await conn.telegram.getFile(m.video.file_id)
      return await downloadFile(file.file_path)
    } else if (m.audio) {
      const file = await conn.telegram.getFile(m.audio.file_id)
      return await downloadFile(file.file_path)
    }
    return null
  }

  return M
}

async function downloadFile(filePath) {
  const https = require("https")
  const http = require("http")

  return new Promise((resolve, reject) => {
    const url = `https://api.telegram.org/file/bot${global.token}/${filePath}`
    const protocol = url.startsWith("https:") ? https : http

    protocol
      .get(url, (res) => {
        const chunks = []
        res.on("data", (chunk) => chunks.push(chunk))
        res.on("end", () => resolve(Buffer.concat(chunks)))
        res.on("error", reject)
      })
      .on("error", reject)
  })
}

conn.use(async (ctx, next) => {
  try {
    if (ctx.message || ctx.callback_query) {
      const m = smsg(ctx)

      if (m) {
        await require("./handler").handler.call(conn, m)
      }
    } else if (ctx.myChatMember) {
      await require("./handler").participantsUpdate.call(conn, ctx)
    } else if (ctx.chatMember) {
      await require("./handler").participantsUpdate.call(conn, ctx)
    }
    return next()
  } catch (e) {
    console.error("Middleware error:", e)
  }
})

conn.on('new_chat_members', async (ctx) => {
  try {
    await require("./handler").participantsUpdate.call(conn, ctx)
  } catch (e) {
    console.error("Error handling new_chat_members:", e)
  }
})

conn.on('left_chat_member', async (ctx) => {
  try {
    await require("./handler").participantsUpdate.call(conn, ctx)
  } catch (e) {
    console.error("Error handling left_chat_member:", e)
  }
})

async function checkMediaSupport() {
  const checks = await Promise.all(
    [
      child_process.spawn("ffmpeg"),
      child_process.spawn("ffprobe"),
      child_process.spawn("convert"),
      child_process.spawn("magick"),
      child_process.spawn("gm"),
    ].map((spawn) => {
      return Promise.race([
        new Promise((resolve) => {
          spawn.on("close", (exitCode) => resolve(exitCode !== 127))
        }),
        new Promise((resolve) => {
          spawn.on("error", () => resolve(false))
        }),
      ])
    }),
  )

  const [ffmpeg, ffprobe, convert, magick, gm] = checks
  global.support = { ffmpeg, ffprobe, convert, magick, gm }

  if (!global.support.ffmpeg) {
    conn.logger.warn("Please install FFMPEG for sending VIDEOS (sudo apt install ffmpeg)")
  }

  if (!global.support.magick) {
    conn.logger.warn("Please install ImageMagick for sending IMAGES (sudo apt install imagemagick)")
  }

}

async function launchBot() {
  let retryCount = 0
  const maxRetries = 5
  const retryDelay = 5000

  while (retryCount < maxRetries) {
    try {
      await conn.launch()
      conn.logger.info("Bot launched successfully")
      break
    } catch (err) {
      retryCount++
      conn.logger.error(`Bot launch attempt ${retryCount} failed: ${err.message}`)

      if (err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND' || err.code === 'ECONNRESET') {
        if (retryCount < maxRetries) {
          conn.logger.info(`Retrying in ${retryDelay / 1000} seconds...`)
          await new Promise(resolve => setTimeout(resolve, retryDelay))
        } else {
          conn.logger.error("Max retries reached. Check your internet connection and bot token.")
        }
      } else {
        throw err
      }
    }
  }
}

checkMediaSupport()
  .then(() => conn.logger.info("Quick Test Done"))
  .then(() => launchBot())
  .catch(console.error)

process.once("SIGINT", () => conn.stop("SIGINT"))
process.once("SIGTERM", () => conn.stop("SIGTERM"))
