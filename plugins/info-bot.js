const handler = async (m, { conn }) => {
  const totalUsers = Object.keys(global.db.data.users).length
  const totalChats = Object.keys(global.db.data.chats).length
  const uptime = process.uptime()
  const hours = Math.floor(uptime / 3600)
  const minutes = Math.floor((uptime % 3600) / 60)
  const seconds = Math.floor(uptime % 60)

  const infoText = `📊 *BOT INFORMATION*

🤖 *Bot Name:* ${global.botname}
👑 *Owner:* ${global.ownername}
📱 *Platform:* Telegram
🔧 *Library:* Telegraf v4
⚡ *Runtime:* Node.js

📈 *Statistics:*
👥 Total Users: ${totalUsers}
💬 Total Chats: ${totalChats}
⏱️ Uptime: ${hours}h ${minutes}m ${seconds}s
💾 Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB

🌟 *Features:*
• Plugin System
• Database Storage
• Limit System
• Registration System
• Anti-Link Protection
• Welcome/Goodbye Messages

📞 *Contact Owner:* @${global.ownername}`

  await conn.sendMessage(m.chat, { text: infoText }, { quoted: { message_id: m.id } })
}

handler.help = ["info", "botinfo"]
handler.tags = ["info"]
handler.command = /^(info|botinfo)$/i

module.exports = handler
