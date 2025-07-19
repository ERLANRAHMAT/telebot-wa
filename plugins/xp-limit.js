let handler = async (m, { conn }) => {
    let user = global.db.data.users[m.sender]
    if (!user) {
        return m.reply('Data user tidak ditemukan!')
    }

    let limit = user.limit || 0
    let premium = user.premium || false
    let premiumTime = user.premiumTime || 0
    let isPremium = premium || premiumTime > Date.now()

    let premiumTimeText = 'Tidak ada'
    if (premiumTime > Date.now()) {
        let date = new Date(premiumTime)
        premiumTimeText = date.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: '2-digit', 
            year: 'numeric'
        })
    }

    let text = `╭─「 💎 LIMIT INFO 」
│ • *User:* ${m.name || 'User'}
│ • *ID:* ${m.sender}
│ • *Limit:* ${limit} 🎫
│ • *Premium:* ${isPremium ? 'Ya ✅' : 'Tidak ❌'}
│ • *Premium Time:* ${premiumTimeText}
│ • *Level:* ${user.level || 1} ⭐
│ • *EXP:* ${user.exp || 0} 🎯
╰────────────────

💡 *Tips:*
• Gunakan /buylimit untuk membeli limit
• Premium member mendapat unlimited limit
• Limit reset setiap hari pada jam 00:00 WIB

📌 *Note:* Setiap command menggunakan 1 limit`

    m.reply(text)
}

handler.help = ['limit', 'checklimit', 'ceklimit']
handler.tags = ['xp']
handler.command = ['limit', 'checklimit', 'ceklimit']

module.exports = handler
