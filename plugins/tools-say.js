const handler = async (m, { conn, text, usedPrefix, command }) => {
  if (!text) m.reply(`Harap masukkan text!\n\ncontoh:\n${usedPrefix + command} Haruno`)
  conn.reply(m.chat, text, null)
}

handler.help = ["say <teks>"]
handler.tags = ["tools"]
handler.command = ["say"]

module.exports = handler
