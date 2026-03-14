let handler = async (m, { conn, usedPrefix, command, text }) => {
    const chatId = m.chat
    let targetId
    let targetName = "User"

    // ✅ Prioritas 1: Reply message
    if (m.quoted) {
        targetId = m.quoted.sender
        targetName = m.quoted.pushname || m.quoted.name || `User ${targetId}`
    }

    // ✅ Prioritas 2: Text mention (dari tap nama)
    if (!targetId && m.msgs?.entities) {
        const textMention = m.msgs.entities.find(e => 
            e.type === 'text_mention' && e.user?.id
        )
        if (textMention) {
            targetId = textMention.user.id
            targetName = textMention.user.first_name || 
                        textMention.user.username || 
                        `User ${targetId}`
        }
    }

    // ✅ Prioritas 3: @username dari text (dengan database lookup)
    if (!targetId && text) {
        const match = text.match(/^@(\S+)/)
        if (match) {
            const username = match[1].toLowerCase()
            
            // Cek database
            const userData = global.resolveUsername(username)
            if (userData) {
                targetId = userData.id
                targetName = userData.full_name || userData.first_name || `@${username}`
            } else {
                throw `❌ User @${username} belum pernah berinteraksi dengan bot.\n\n` +
                      `💡 *Solusi:*\n` +
                      `1. Balas pesan member tersebut\n` +
                      `2. Tap nama member (auto-mention)\n` +
                      `3. Suruh @${username} kirim pesan di grup ini dulu`
            }
        }
    }

    // Validasi
    if (!targetId) {
        throw `📝 *Cara pakai:*\n\n` +
              `1. Balas pesan member:\n` +
              `   _${usedPrefix + command} ⭐ VIP_\n\n` +
              `2. Mention member:\n` +
              `   _${usedPrefix + command} @user ⭐ VIP_`
    }

    // Ambil tag text
    let tag = text?.replace(/^@\S+\s*/i, '').trim()
    if (!tag) {
        throw `Masukkan nama tag!\n\nContoh: *${usedPrefix + command} ⭐ VIP*`
    }

    // Set tag
    try {
        await conn.setChatMemberTag(chatId, targetId, tag);
        await m.reply(`✅ Tag *${tag}* berhasil diberikan ke *${targetName}*!`)
    } catch (e) {
        console.error('[settag]', e)
        const errMsg = e?.description || e?.message || String(e)
        
        if (errMsg.includes('not enough rights')) {
            throw `❌ Bot perlu hak admin *can_manage_tags*`
        } else if (errMsg.includes('user not found')) {
            throw `❌ User tidak ada di grup ini`
        } else {
            throw `❌ Error: ${errMsg}`
        }
    }
}

handler.help = ['settag <reply/@user> <tag>']
handler.tags = ['group']
handler.command = /^(settagmember|settag|addtag)$/i
handler.group = true
handler.botAdmin = true

module.exports = handler