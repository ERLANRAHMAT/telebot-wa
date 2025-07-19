const handler = async (m, { conn, usedPrefix, command, args, isOwner, isROwner }) => {
  const isEnable = /true|enable|(turn)?on|1/i.test(command)
  const chat = global.db.data.chats[m.chat]
  const user = global.db.data.users[m.sender]
  const type = (args[0] || "").toLowerCase()
  let isAll = false
  let isUser = false

  const isAdmin = m.isGroup ? true : false

  switch (type) {
    case "welcome":
      if (!m.isGroup) {
        if (!isOwner) {
          global.dfail("group", m, conn)
          throw false
        }
      } else if (!isAdmin && !isOwner) {
        global.dfail("admin", m, conn)
        throw false
      }
      chat.welcome = isEnable
      break

    case "detect":
      if (!m.isGroup) {
        if (!isOwner) {
          global.dfail("group", m, conn)
          throw false
        }
      } else if (!isAdmin && !isOwner) {
        global.dfail("admin", m, conn)
        throw false
      }
      chat.detect = isEnable
      break

    case "antilink":
      if (m.isGroup) {
        if (!(isAdmin || isOwner)) {
          global.dfail("admin", m, conn)
          throw false
        }
      }
      chat.antiLink = isEnable
      break

    case "antibot":
      if (m.isGroup) {
        if (!(isAdmin || isOwner)) {
          global.dfail("admin", m, conn)
          throw false
        }
      }
      chat.antiBot = isEnable
      break

    case "autodl":
      if (m.isGroup) {
        if (!(isAdmin || isOwner)) {
          global.dfail("admin", m, conn)
          throw false
        }
      }
      chat.autoDL = isEnable
      break

    case "antitoxic":
      if (m.isGroup) {
        if (!(isAdmin || isOwner)) {
          global.dfail("admin", m, conn)
          throw false
        }
      }
      chat.antiToxic = isEnable
      break

    case "autolevelup":
      isUser = true
      user.autolevelup = isEnable
      break

    case "public":
      isAll = true
      if (!isROwner) {
        global.dfail("rowner", m, conn)
        throw false
      }
      global.opts = global.opts || {}
      global.opts["self"] = !isEnable
      break

    case "restrict":
      isAll = true
      if (!isROwner) {
        global.dfail("rowner", m, conn)
        throw false
      }
      global.opts = global.opts || {}
      global.opts["restrict"] = isEnable
      break

    case "gconly":
    case "grouponly":
      isAll = true
      if (!isROwner) {
        global.dfail("rowner", m, conn)
        throw false
      }
      global.opts = global.opts || {}
      global.opts["gconly"] = isEnable
      break

    case "pconly":
    case "privateonly":
      isAll = true
      if (!isROwner) {
        global.dfail("rowner", m, conn)
        throw false
      }
      global.opts = global.opts || {}
      global.opts["pconly"] = isEnable
      break

    case "mute":
      if (m.isGroup) {
        if (!(isAdmin || isOwner)) {
          global.dfail("admin", m, conn)
          throw false
        }
      }
      chat.mute = isEnable
      break

    default:
      if (!/[01]/.test(command))
        return m.reply(
          `
List option:
| welcome
| detect  
| antilink
| antibot
| antitoxic
| autolevelup
| public
| restrict
| gconly
| pconly
| autodl
| mute 

Contoh:
${usedPrefix}enable welcome
${usedPrefix}disable welcome
${usedPrefix}on welcome
${usedPrefix}off welcome
`.trim(),
        )
      throw "error"
  }

  m.reply(
    `
*${type}* berhasil di *${isEnable ? "nyala" : "mati"}kan* ${isAll ? "untuk bot ini" : isUser ? "untuk user ini" : "untuk chat ini"}
`.trim(),
  )
}

handler.help = ["en", "dis"].map((v) => v + "able <option>")
handler.tags = ["group", "owner"]
handler.command = /^((en|dis)able|(tru|fals)e|(turn)?o(n|ff))$/i

module.exports = handler
