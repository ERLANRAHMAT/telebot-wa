const fs = require("fs")
const util = require("util")
const chalk = require("chalk")
const moment = require("moment-timezone")

const isNumber = (x) => typeof x === "number" && !isNaN(x)
const delay = (ms) => isNumber(ms) && new Promise((resolve) => setTimeout(resolve, ms))

function isRealError(error) {
  return error instanceof Error || (error && error.constructor && error.constructor.name === "Error")
}

async function rlimit() {
  const now = moment().tz("Asia/Makassar")
  const resetTime = moment().tz("Asia/Makassar").startOf('day')

  if (now.isSameOrAfter(resetTime)) {
    for (const userId in global.db.data.users) {
      const user = global.db.data.users[userId]
      if (user.lastReset !== resetTime.format('YYYY-MM-DD')) {
        user.limit += 30
        user.lastReset = resetTime.format('YYYY-MM-DD')
      }
    }
  }
}

module.exports = {
  async handler(m) {
    await global.loadDatabase()
    if (global.db.data == null) return

    if (!m) return

    try {
      m.exp = 0
      m.limit = false

      await rlimit()

      if (m.callbackQuery && !m.isSimulated) {
        await this.telegram.answerCbQuery(m.callbackQuery.id)
      }

      const user = global.db.data.users[m.sender]
      if (typeof user !== "object") global.db.data.users[m.sender] = {}
      if (user) {
        if (!isNumber(user.saldo)) user.saldo = 0
        if (!isNumber(user.exp)) user.exp = 0
        if (!isNumber(user.level)) user.level = 0
        if (!isNumber(user.limit)) user.limit = 30
        if (!("registered" in user)) user.registered = false
        if (!("premium" in user)) user.premium = false
        if (!("banned" in user)) user.banned = false
        if (!isNumber(user.premiumTime)) user.premiumTime = 0
        if (!isNumber(user.command)) user.command = 0
        if (!isNumber(user.commandTotal)) user.commandTotal = 0
        if (!isNumber(user.lastCmd)) user.lastCmd = 0
        if (!isNumber(user.chat)) user.chat = 0
        if (!isNumber(user.chatTotal)) user.chatTotal = 0
        if (!isNumber(user.lastseen)) user.lastseen = 0
        if (!("lastReset" in user)) user.lastReset = moment().tz("Asia/Makassar").format('YYYY-MM-DD')
      } else {
        global.db.data.users[m.sender] = {
          saldo: 0,
          exp: 0,
          level: 0,
          limit: global.limit,
          registered: false,
          premium: false,
          banned: false,
          premiumTime: 0,
          command: 0,
          commandTotal: 0,
          lastCmd: 0,
          chat: 0,
          chatTotal: 0,
          lastseen: 0,
          lastReset: moment().tz("Asia/Makassar").format('YYYY-MM-DD')
        }
      }

      const chat = global.db.data.chats[m.chat]
      if (typeof chat !== "object") global.db.data.chats[m.chat] = {}
      if (chat) {
        if (!("isBanned" in chat)) chat.isBanned = false
        if (!("welcome" in chat)) chat.welcome = true
        if (!("mute" in chat)) chat.mute = false
        if (!("sWelcome" in chat)) chat.sWelcome = "Selamat datang @user di grup @subject!"
        if (!("sBye" in chat)) chat.sBye = "Selamat tinggal @user!"
        if (!("autoDL" in chat)) chat.autoDL = false
      } else {
        global.db.data.chats[m.chat] = {
          isBanned: false,
          welcome: true,
          mute: false,
          sWelcome: "Selamat datang @user di grup @subject!",
          sBye: "Selamat tinggal @user!",
          autoDL: false,
        }
      }

      const isROwner = global.ownerid && global.ownerid.length > 0 ? global.ownerid.includes(m.sender.toString()) : false
      const isOwner = isROwner || m.fromMe
      const isPrems = isROwner ||
        (global.premid && global.premid.length > 0 ? global.premid.includes(m.sender.toString()) : false) ||
        global.db.data.users[m.sender].premiumTime > 0 ||
        global.db.data.users[m.sender].premium

      try {
        require("./lib/print")(m, this)
      } catch (e) {
        console.log(m, m.quoted, e)
      }

      for (const name in global.plugins) {
        const plugin = global.plugins[name]
        if (!plugin) continue
        if (plugin.disabled) continue

        let beforeHandler = null
        let pluginData = plugin

        if (typeof plugin === 'function') {
          if (plugin.before && typeof plugin.before === 'function') {
            beforeHandler = plugin.before
            pluginData = plugin
          }
        } else if (typeof plugin === 'object') {
          if (plugin.before && typeof plugin.before === 'function') {
            beforeHandler = plugin.before
            pluginData = plugin
          }
          else if (plugin.default && plugin.default.before && typeof plugin.default.before === 'function') {
            beforeHandler = plugin.default.before
            pluginData = plugin.default
          }
          else if (plugin.run && plugin.run.before && typeof plugin.run.before === 'function') {
            beforeHandler = plugin.run.before
            pluginData = plugin.run
          }
        }

        if (beforeHandler) {
          try {
            const beforeResult = await beforeHandler.call(this, m, {
              conn: this,
              isROwner,
              isOwner,
              isPrems,
              isBotAdmin: m.isBotAdmin,
              isAdmin: m.isAdmin,
            })

            if (beforeResult === false) {
              console.log(`Plugin ${name} before handler returned false, skipping...`)
              continue
            }
          } catch (e) {
            console.error(`Plugin Before Error (${name}):`, e)
          }
        }
      }

      const processedCommands = new Set()

      for (const name in global.plugins) {
        const plugin = global.plugins[name]
        if (!plugin) continue
        if (plugin.disabled) continue

        let pluginData = plugin
        let pluginHandler = null

        if (typeof plugin === 'function') {
          pluginHandler = plugin
          pluginData = plugin
        } else if (typeof plugin === 'object') {
          if (plugin.handler && typeof plugin.handler === 'function') {
            pluginHandler = plugin.handler
            pluginData = plugin
          }
          else if (plugin.default && typeof plugin.default === 'function') {
            pluginHandler = plugin.default
            pluginData = plugin.default
          }
          else if (plugin.run && plugin.run.async && typeof plugin.run.async === 'function') {
            pluginHandler = plugin.run.async
            pluginData = plugin.run
          }
          else if (typeof plugin.before === 'function' && !plugin.handler && !plugin.default && !plugin.run) {
            continue
          }
          else {
            pluginHandler = plugin
            pluginData = plugin
          }
        }

        if (!pluginHandler || typeof pluginHandler !== "function") continue

        const str2Regex = (str) => str.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&")

        let _prefix = pluginData.customPrefix || global.prefix || "/"

        if (!Array.isArray(_prefix)) {
          _prefix = [_prefix]
        }

        let match = null
        let usedPrefix = ""

        if (m.text) {
          let textToProcess = m.text

          if (m.isGroup && textToProcess.includes('@')) {
            const botUsername = global.botname?.toLowerCase() || 'bot'
            const mentions = textToProcess.match(/@\w+/g) || []

            for (const mention of mentions) {
              const mentionName = mention.slice(1).toLowerCase()
              if (mentionName.includes(botUsername) || mentionName.includes('ztxzy_bot')) {
                textToProcess = textToProcess.replace(mention, '').trim()
                break
              }
            }
          }

          for (const prefix of _prefix) {
            if (prefix instanceof RegExp) {
              const regexMatch = prefix.exec(textToProcess)
              if (regexMatch) {
                match = [regexMatch, prefix]
                usedPrefix = regexMatch[0]
                break
              }
            } else {
              const prefixStr = String(prefix)
              if (textToProcess.startsWith(prefixStr)) {
                match = [[prefixStr], new RegExp(str2Regex(prefixStr))]
                usedPrefix = prefixStr
                break
              }
            }
          }
        }

        if (match && usedPrefix && m.text) {
          let textToProcess = m.text

          if (m.isGroup && textToProcess.includes('@')) {
            const botUsername = global.botname?.toLowerCase() || 'bot'
            const mentions = textToProcess.match(/@\w+/g) || []

            for (const mention of mentions) {
              const mentionName = mention.slice(1).toLowerCase()
              if (mentionName.includes(botUsername) || mentionName.includes('ztxzy_bot')) {
                textToProcess = textToProcess.replace(mention, '').trim()
                break
              }
            }
          }

          const noPrefix = textToProcess.replace(usedPrefix, "")
          let [command, ...args] = noPrefix.trim().split` `.filter((v) => v)
          args = args || []
          const _args = noPrefix.trim().split` `.slice(1)
          const text = _args.join` `
          command = (command || "").toLowerCase()
          const fail = pluginData.fail || global.dfail

          let isAccept = false
          let commandList = pluginData.command || pluginData.usage

          if (commandList) {
            if (commandList instanceof RegExp) {
              isAccept = commandList.test(command)
            } else if (Array.isArray(commandList)) {
              isAccept = commandList.some((cmd) =>
                cmd instanceof RegExp ? cmd.test(command) : cmd === command
              )
            } else if (typeof commandList === "string") {
              isAccept = commandList === command
            }
          }

          if (!isAccept) continue

          const commandKey = `${m.sender}_${command}_${Date.now()}`
          if (processedCommands.has(commandKey)) continue
          processedCommands.add(commandKey)

          m.plugin = name

          if (m.chat in global.db.data.chats || m.sender in global.db.data.users) {
            const chat = global.db.data.chats[m.chat]
            const user = global.db.data.users[m.sender]
            if (chat?.isBanned || chat?.mute) return
            if (user && user.banned) return
          }

          if (pluginData.rowner && pluginData.owner && !(isROwner || isOwner)) {
            fail("owner", m, this)
            continue
          }
          if (pluginData.rowner && !isROwner) {
            fail("rowner", m, this)
            continue
          }
          if (pluginData.owner && !isOwner) {
            fail("owner", m, this)
            continue
          }
          if (pluginData.premium && !isPrems) {
            fail("premium", m, this)
            continue
          }
          if (pluginData.group && !m.isGroup) {
            fail("group", m, this)
            continue
          }
          if (pluginData.private && m.isGroup) {
            fail("private", m, this)
            continue
          }
          if (pluginData.admin && !m.isAdmin) {
            fail("admin", m, this)
            continue
          }

          m.isCommand = true
          const xp = "exp" in pluginData ? Number.parseInt(pluginData.exp) : 17
          if (xp > 200) m.reply(`⚠️ Peringatan: Pengalaman (${xp}) terlalu tinggi, disarankan tidak lebih dari 200!`)
          else m.exp += xp

          if (!isPrems && !isOwner && pluginData.limit) {
            const requiredLimit = pluginData.limit === true ? 1 : pluginData.limit
            if (!args || args.length === 0) {
              m.limit = false
            } else {
              if (global.db.data.users[m.sender].limit < requiredLimit) {
                if (global.db.data.users[m.sender].limit === 0) {
                  await m.reply(`Limit kamu habis`, m)
                } else {
                  await m.reply(`Limit tidak mencukupi, membutuhkan ${requiredLimit}, dan kamu hanya mempunyai ${global.db.data.users[m.sender].limit}`, m)
                }
                continue
              }
              global.db.data.users[m.sender].limit -= requiredLimit
              m.limit = requiredLimit
            }
          }


          const extra = {
            match,
            usedPrefix,
            noPrefix,
            _args,
            args,
            command,
            text,
            conn: this,
            client: this,
            isROwner,
            isOwner,
            isPrems,
            isPrefix: usedPrefix,
            participants: m.participants || [],
            isBotAdmin: m.isBotAdmin,
            isAdmin: m.isAdmin,
            Func: global.Func || {}
          }

          try {
            const result = await pluginHandler.call(this, m, extra)



            if (!isPrems && !isOwner && pluginData.limit && typeof m.limit === 'number' && m.limit > 0) {
              const sisa = global.db.data.users[m.sender].limit
              const limitMsg = `✅ ${m.limit} limit terpakai\n💡 Sisa limit: ${sisa}`

              try {
                if (m.isGroup) {
                  // 📨 Kirim ke PM user jika command dilakukan di grup
                  m.reply(limitMsg);
                  // await this.sendMessFage(m.sender, { text: limitMsg }, { quoted: m })
                } else {
                  // 📩 Kirim langsung di private
                  m.reply(limitMsg);
                  // await this.sendMessage(m.chat, { text: limitMsg }, { quoted: m })
                }
              } catch (e) {
                console.error("Gagal kirim info limit:", e)
              }
            }




          } catch (e) {

            if (!isPrems && !isOwner && pluginData.limit && m.limit) {
              global.db.data.users[m.sender].limit += m.limit
              console.log(`Limit ${m.limit} tidak jadi digunakan karena terjadi error pada plugin ${name}`)
            }

            if (isRealError(e)) {
              m.error = e
              console.error(`Plugin Error (${m.plugin}):`, e)
              const text = util.format(e)
              for (const ownerId of global.ownerid) {
                try {
                  await this.reply(
                    ownerId,
                    `*Plugin Error:* ${m.plugin}\n*Sender:* ${m.sender}\n*Chat:* ${m.chat}\n*Command:* ${usedPrefix}${command} ${args.join(" ")}\n\n\`\`\`${text}\`\`\``
                  )
                } catch (notifyError) {
                  console.error("Failed to notify owner:", notifyError)
                }
              }
              try {
                await m.reply(text)
              } catch (replyError) {
                console.error("Failed to reply error to user:", replyError)
              }
            } else {
              try {
                await m.reply(String(e))
              } catch (replyError) {
                console.error("Failed to reply to user:", replyError)
              }
            }
          } finally {
            if (typeof pluginData.after === "function") {
              try {
                await pluginData.after.call(this, m, extra)
              } catch (e) {
                console.error(`Plugin After Error (${m.plugin}):`, e)
              }
            }
          }

          break
        }
      }

      const _user = global.db.data.users[m.sender]
      const stats = global.db.data.stats
      if (m) {
        if (m.sender && _user) {
          _user.exp += m.exp
        }

        let stat
        if (m.plugin) {
          const now = +new Date()
          if (m.plugin in stats) {
            stat = stats[m.plugin]
            if (!isNumber(stat.total)) stat.total = 1
            if (!isNumber(stat.success)) stat.success = m.error != null ? 0 : 1
            if (!isNumber(stat.last)) stat.last = now
            if (!isNumber(stat.lastSuccess)) stat.lastSuccess = m.error != null ? 0 : now
          } else {
            stat = stats[m.plugin] = {
              total: 1,
              success: m.error != null ? 0 : 1,
              last: now,
              lastSuccess: m.error != null ? 0 : now,
            }
          }
          stat.total += 1
          stat.last = now
          if (m.error == null) {
            stat.success += 1
            stat.lastSuccess = now
          }
        }
      }

      if (_user) {
        _user.chat++
        _user.chatTotal++
        _user.lastseen = Date.now()
      }
    } catch (e) {
      console.error("Handler Error:", e)
    }
  },

  async participantsUpdate(ctx) {
    try {
      await global.loadDatabase()

      let chatId, userId, userName, status, chatTitle, eventType = null

      if (ctx.myChatMember) {
        chatId = ctx.chat.id
        userId = ctx.myChatMember.new_chat_member.user.id
        userName = ctx.myChatMember.new_chat_member.user.first_name || ctx.myChatMember.new_chat_member.user.username || "Unknown"
        status = ctx.myChatMember.new_chat_member.status
        chatTitle = ctx.chat.title || "Unknown Group"

        if (status === "member" && ctx.myChatMember.old_chat_member.status === "left") {
          eventType = "join"
        } else if (status === "left" && ctx.myChatMember.old_chat_member.status === "member") {
          eventType = "leave"
        }
      } else if (ctx.message && ctx.message.new_chat_members) {
        chatId = ctx.chat.id
        chatTitle = ctx.chat.title || "Unknown Group"
        eventType = "join"

        for (const member of ctx.message.new_chat_members) {
          userId = member.id
          userName = member.first_name || member.username || "Unknown"

          const chat = global.db.data.chats[chatId] || {}
          if (chat.welcome) {
            let text = (chat.sWelcome || "Selamat datang @user di grup @subject!")
              .replace("@user", userName)
              .replace("@subject", chatTitle)

            try {
              await this.sendMessage(chatId, { text: text }, { quoted: null })

            } catch (e) {
              console.error("Error sending welcome message:", e)
            }
          }
        }
        return
      } else if (ctx.message && ctx.message.left_chat_member) {
        chatId = ctx.chat.id
        userId = ctx.message.left_chat_member.id
        userName = ctx.message.left_chat_member.first_name || ctx.message.left_chat_member.username || "Unknown"
        chatTitle = ctx.chat.title || "Unknown Group"
        eventType = "leave"
      }

      if (!chatId || !userId || !eventType) return

      const chat = global.db.data.chats[chatId] || {}
      if (!chat.welcome) return

      let text = ""

      if (eventType === "join") {
        text = (chat.sWelcome || "Selamat datang @user di grup @subject!")
          .replace("@user", userName)
          .replace("@subject", chatTitle)
      } else if (eventType === "leave") {
        text = (chat.sBye || "Selamat tinggal @user!")
          .replace("@user", userName)
          .replace("@subject", chatTitle)
      }

      if (text) {
        try {
          await this.sendMessage(chatId, { text: text }, { quoted: null })
        } catch (e) {
          console.error("Error sending participant update message:", e)
        }
      }
    } catch (e) {
      console.error("Error in participantsUpdate:", e)
    }
  },
}

global.dfail = async (type, m, conn) => {
  const msg = global.message;
  [type]
  if (msg) return await m.reply(msg)
}

const file = require.resolve(__filename)
fs.watchFile(file, () => {
  fs.unwatchFile(file)
  console.log(chalk.redBright("Update handler.js"))
  delete require.cache[file]
})
