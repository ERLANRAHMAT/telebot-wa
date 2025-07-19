const chalk = require("chalk")
const fs = require("fs")

module.exports = async (m, conn = { logger: console }, isOutgoing = false) => {
  const sender = isOutgoing ? "Bot" : m.name || "Unknown"
  const username = isOutgoing
    ? `@${conn.botInfo?.username || global.botname || "bot"}`
    : m.fakeObj?.from?.username
      ? `@${m.fakeObj.from.username}`
      : ""
  const userId = isOutgoing ? conn.botInfo?.id || "bot" : m.sender || "Unknown"
  const chat = m.isGroup ? "Group Chat" : "Private Chat"
  const chatId = m.chat || "Unknown"

  let messageType = "Text"
  let filesize = 0

  if (isOutgoing) {
    if (m.content?.photo) {
      messageType = "Photo"
      filesize = 0
    } else if (m.content?.document) {
      messageType = "Document"
      filesize = 0
    } else if (m.content?.audio) {
      messageType = "Audio"
      filesize = 0
    } else if (m.content?.video) {
      messageType = "Video"
      filesize = 0
    } else if (m.content?.sticker) {
      messageType = "Sticker"
      filesize = 0
    } else if (m.content?.text || m.text) {
      messageType = "Text"
      filesize = (m.content?.text || m.text || "").length
    }
  } else {
    if (m.fakeObj?.message?.photo) {
      messageType = "Photo"
      filesize = m.fakeObj.message.photo[m.fakeObj.message.photo.length - 1].file_size || 0
    } else if (m.fakeObj?.message?.document) {
      messageType = "Document"
      filesize = m.fakeObj.message.document.file_size || 0
    } else if (m.fakeObj?.message?.audio) {
      messageType = "Audio"
      filesize = m.fakeObj.message.audio.file_size || 0
    } else if (m.fakeObj?.message?.video) {
      messageType = "Video"
      filesize = m.fakeObj.message.video.file_size || 0
    } else if (m.fakeObj?.message?.voice) {
      messageType = "Voice"
      filesize = m.fakeObj.message.voice.file_size || 0
    } else if (m.fakeObj?.message?.sticker) {
      messageType = "Sticker"
      filesize = m.fakeObj.message.sticker.file_size || 0
    } else if (m.fakeObj?.message?.animation) {
      messageType = "Animation"
      filesize = m.fakeObj.message.animation.file_size || 0
    } else if (m.fakeObj?.message?.video_note) {
      messageType = "VideoNote"
      filesize = m.fakeObj.message.video_note.file_size || 0
    } else if (m.fakeObj?.message?.contact) {
      messageType = "Contact"
    } else if (m.fakeObj?.message?.location) {
      messageType = "Location"
    } else if (m.text) {
      messageType = "Text"
      filesize = m.text.length
    }
  }

  const user = global.db?.data?.users?.[isOutgoing ? chatId : userId]
  const botInfo = conn.botInfo || { username: global.botname || "telegram_bot", first_name: global.botname || "Bot" }

  const messageDate = isOutgoing
    ? new Date()
    : m.fakeObj?.message?.date
      ? new Date(m.fakeObj.message.date * 1000)
      : new Date()
  const timeString = messageDate.toTimeString()

  const direction = isOutgoing ? "📤" : "📥"
  const typeColor = isOutgoing ? chalk.cyan : chalk.green
  const senderColor = isOutgoing ? chalk.blue : chalk.green

  console.log(
    `\n\n▣────────────···
│ ${chalk.redBright("%s")}\n│⏰ㅤ${chalk.black(chalk.bgYellow("%s"))}\n│📑ㅤ${chalk.black(chalk.bgGreen("%s"))}\n│📊ㅤ${chalk.magenta("%s [%s %sB]")}
│${direction}ㅤ${senderColor("%s")}\n│📃ㅤ${chalk.yellow("%s%s")}\n│📍ㅤ${typeColor("%s")}\n│💬ㅤ${chalk.black(chalk.bgYellow("%s"))}
▣────────────···
`.trim(),
    `${botInfo.first_name} ~@${botInfo.username}`,
    timeString,
    m.isGroup ? "group" : "private",
    filesize,
    filesize === 0 ? 0 : (filesize / 1000 ** Math.floor(Math.log(filesize) / Math.log(1000))).toFixed(1),
    ["", ..."KMGTP"][Math.floor(Math.log(filesize) / Math.log(1000))] || "",
    `${sender}${username ? " " + username : ""} (${userId})`,
    user ? user.exp || "?" : "?",
    user ? "|" + (user.exp || 0) + "|" + (user.limit || 0) + "|" + (user.level || 1) : "|0|0|1",
    `${chat} (${chatId})`,
    messageType,
  )

  const messageText = isOutgoing ? m.content?.text || m.text || "" : m.text || ""

  if (typeof messageText === "string" && messageText) {
    let log = messageText.replace(/\u200e+/g, "")

    if (log.length < 4096) {
      log = log.replace(/(https?:\/\/[^\s]+)/g, (url) => {
        return chalk.blueBright(url)
      })
    }

    log = log.replace(/\*([^*]+)\*/g, (_, text) => chalk.bold(text))
    log = log.replace(/_([^_]+)_/g, (_, text) => chalk.italic(text))
    log = log.replace(/~([^~]+)~/g, (_, text) => chalk.strikethrough(text))
    log = log.replace(/`([^`]+)`/g, (_, text) => chalk.gray(text))

    if (!isOutgoing && m.fakeObj?.message?.entities) {
      for (const entity of m.fakeObj.message.entities) {
        if (entity.type === "mention") {
          const mention = log.substring(entity.offset, entity.offset + entity.length)
          log = log.replace(mention, chalk.blueBright(mention))
        }
      }
    }

    const logColor = isOutgoing
      ? chalk.cyan
      : m.error != null
        ? chalk.red
        : log.startsWith("/")
          ? chalk.yellow
          : chalk.white
    console.log(logColor(log))
  }

  if (isOutgoing && m.content?.caption) {
    console.log(chalk.gray("Caption: ") + m.content.caption)
  } else if (!isOutgoing && m.fakeObj?.message?.caption) {
    console.log(chalk.gray("Caption: ") + m.fakeObj.message.caption)
  }

  if (!isOutgoing) {
    if (m.fakeObj?.message?.document && m.fakeObj.message.document.file_name) {
      console.log(`📄 ${m.fakeObj.message.document.file_name}`)
    } else if (m.fakeObj?.message?.contact) {
      console.log(`👨 ${m.fakeObj.message.contact.first_name || ""} ${m.fakeObj.message.contact.last_name || ""}`)
    } else if (m.fakeObj?.message?.audio) {
      const duration = m.fakeObj.message.audio.duration || 0
      const minutes = Math.floor(duration / 60)
        .toString()
        .padStart(2, "0")
      const seconds = (duration % 60).toString().padStart(2, "0")
      console.log(`🎵 (AUDIO) ${minutes}:${seconds}`)
    } else if (m.fakeObj?.message?.voice) {
      const duration = m.fakeObj.message.voice.duration || 0
      const minutes = Math.floor(duration / 60)
        .toString()
        .padStart(2, "0")
      const seconds = (duration % 60).toString().padStart(2, "0")
      console.log(`🎤 (VOICE) ${minutes}:${seconds}`)
    } else if (m.fakeObj?.message?.location) {
      console.log(`📍 Location: ${m.fakeObj.message.location.latitude}, ${m.fakeObj.message.location.longitude}`)
    }
  }

  console.log()
}

const file = require.resolve(__filename)
fs.watchFile(file, () => {
  fs.unwatchFile(file)
  delete require.cache[file]
})
