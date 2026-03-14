const fetch = require('node-fetch');
const uploadImage = require('../lib/uploadImage.js');

let handler = m => m

handler.before = async function (m, { conn, isAdmin, isBotAdmin }) {
    try {
        const chat = global.db.data.chats[m.chat]
        if (!chat?.autohd) return

        const user = global.db.data.users[m.sender]
        if (!user || user.limit <= 0) return m.reply('Limit kamu habis!')

        const q = m.quoted ? m.quoted : m
        const mime = (q.msg || q).mimetype || q.mediaType || ''

        if (!/^image/.test(mime) || /webp/.test(mime)) return

        user.limit -= 1

        const img = await q.download()
        const out = await uploadImage(img)

        const api = await fetch(`https://api.betabotz.eu.org/api/tools/remini?url=${out}&apikey=${lann}`)
        const image = await api.json()
        const { url } = image

        await conn.sendMessage(m.chat, { image: url, caption: '' }, { quoted: m })
    } catch (e) {
        console.error('autohd error:', e?.message || e)
    }

    return true
}

module.exports = handler