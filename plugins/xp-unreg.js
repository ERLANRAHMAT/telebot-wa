const handler = async (m, { conn, text }) => {
  const user = global.db.data.users[m.sender]

  if (!user.registered) return m.reply(`Anda belum terdaftar!\nKetik */daftar nama.umur* untuk mendaftar`)

  if (!text) return m.reply(`Serial Number tidak ditemukan!\n\nCara menggunakan:\n*/unreg <SERIAL NUMBER>*`)

  const sn = require("crypto").createHash("md5").update(m.sender.toString()).digest("hex")

  if (text !== sn) return m.reply(`Serial Number salah!\n\nSerial Number anda: ${sn}`)

  user.registered = false
  user.name = ""
  user.age = 0
  delete user.regTime

  conn.reply(m.chat, `✅ Berhasil unregister!\n\nAnda sekarang bisa daftar ulang dengan */daftar nama.umur*`, {
    message_id: m.id,
  })
}

handler.help = ["unreg <serial number>"]
handler.tags = ["main"]
handler.command = /^(unreg|unregister)$/i
handler.register = true

module.exports = handler
