const handler = async (m, { conn, text, usedPrefix, command }) => {
  const user = global.db.data.users[m.sender]

  if (user.registered) return m.reply(`Anda sudah terdaftar!\nIngin daftar ulang? ${usedPrefix}unreg <SERIAL NUMBER>`)

  if (!text)
    return m.reply(
      `Format salah!\n\nPenggunaan:\n${usedPrefix + command} <nama>.<umur>\n\nContoh: ${usedPrefix + command} budi.17`,
    )

  const [nama, umur] = text.split(".")
  if (!nama) return m.reply(`Nama tidak boleh kosong!`)
  if (!umur) return m.reply(`Umur tidak boleh kosong!`)
  if (isNaN(umur)) return m.reply(`Umur harus berupa angka!`)
  if (umur < 5) return m.reply(`Umur minimal 5 tahun!`)
  if (umur > 120) return m.reply(`Umur maksimal 120 tahun!`)

  user.name = nama.trim()
  user.age = Number.parseInt(umur)
  user.registered = true
  user.regTime = +new Date()

  const sn = require("crypto").createHash("md5").update(m.sender.toString()).digest("hex")

  const caption = `
┌─〔 INFO PENGGUNA 〕
├ Nama: ${nama}
├ Umur: ${umur} tahun
├ SN: ${sn}
└────

Selamat! Anda berhasil terdaftar.
Ketik */menu* untuk melihat daftar perintah.
`.trim()

  conn.reply(m.chat, caption, { message_id: m.id })
}

handler.help = ["daftar <nama>.<umur>"]
handler.tags = ["main"]
handler.command = /^(daftar|register)$/i

module.exports = handler
