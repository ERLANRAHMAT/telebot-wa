let handler = async (m, { conn, text, usedPrefix, command }) => {
    if (m.msg?.forward_from_chat || m.forward_from_chat) {
        const chat = m.msg?.forward_from_chat || m.forward_from_chat
        const type = chat.type === 'channel' ? '📢 Channel' :
                     chat.type === 'supergroup' ? '👥 Supergroup' : '👥 Group'

        return m.reply(`
┌─〔 INFO CHAT 〕
├ ID: \`${chat.id}\`
├ Tipe: ${type}
├ Nama: ${chat.title || '-'}
${chat.username ? `├ Username: @${chat.username}` : ''}
└────
`.trim())
    }

    if (!text) throw `Masukan username/link atau forward pesan dari grup/channel!\n\nContoh:\n${usedPrefix + command} @username\n${usedPrefix + command} https://t.me/username`

    try {
        let username = text.trim()
            .replace('https://t.me/', '@')
            .replace('http://t.me/', '@')
        if (!username.startsWith('@')) username = '@' + username

        console.log('[GETID] Resolving:', username)
        const info = await conn.telegram.getChat(username)
        console.log('[GETID] Result:', JSON.stringify(info))

        const type = info.type === 'channel' ? '📢 Channel' :
                     info.type === 'supergroup' ? '👥 Supergroup' :
                     info.type === 'group' ? '👥 Group' : '👤 Private'

        m.reply(`
┌─〔 INFO CHAT 〕
├ ID: \`${info.id}\`
├ Tipe: ${type}
├ Nama: ${info.title || info.first_name || '-'}
${info.username ? `├ Username: @${info.username}` : ''}
└────
`.trim())
    } catch (e) {
        console.error('[GETID] Error:', e?.message || e)
        m.reply(`❌ Gagal mendapatkan info: ${e?.message || e}`)
    }
}

handler.help = ['getidgc <username/link/forward>']
handler.tags = ['owner']
handler.command = /^(getidgc|getidch)$/i
module.exports = handler