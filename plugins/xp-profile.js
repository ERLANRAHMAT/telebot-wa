const handler = async (m, { conn }) => {
  const user = global.db.data.users[m.sender]
  const isOwner = global.ownerid.includes(m.sender.toString())
  const isPrems = global.premid.includes(m.sender.toString()) || user.premium || user.premiumTime > 0

  if (!user.registered) return m.reply(`Anda belum terdaftar!\nKetik /daftar nama.umur untuk mendaftar`)

  let status = "User"
  let limitText = `${user.limit}`

  if (isOwner) {
    status = "Owner"
    limitText = "Unlimited"
  } else if (isPrems) {
    status = "Premium"
    limitText = "Unlimited"
  }

  const regDate = new Date(user.regTime)
  const sn = require("crypto").createHash("md5")
      .update(m.sender.toString())
      .digest("hex")
      .slice(0, 25)
      .toUpperCase()

  const profileText = `👤 *PROFILE INFORMATION*

📝 *Personal Data:*
• Name: ${user.name}
• Age: ${user.age} tahun
• Status: ${status}
• Registered: ${regDate.toLocaleDateString("id-ID")}

📊 *Statistics:*
• Level: ${user.level}
• EXP: ${user.exp}
• Limit: ${limitText}
• Commands Used: ${user.commandTotal}
• Chat Count: ${user.chatTotal}

🔐 *Serial Number:*
\`${sn}\`

💡 *Tip:* Simpan Serial Number untuk unregister`

  await conn.sendMessage(m.chat, { text: profileText }, { quoted: { message_id: m.id } })
}

handler.help = ["profile", "me"]
handler.tags = ["main"]
handler.command = /^(profile|me)$/i
handler.register = true

module.exports = handler
