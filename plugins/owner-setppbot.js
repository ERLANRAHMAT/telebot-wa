const sharp = require('sharp')
let handler = async (m, { conn, usedPrefix, command, isOwner }) => {
    const isAnonymousOwner = m.sender.toString() === '1087968824' && 
        global.ownerid?.some(id => id === m.chat.toString().replace(/^-100/, ''))
    
    if (!isOwner && !isAnonymousOwner) return m.reply('❌ Hanya owner yang bisa menggunakan perintah ini!')

    let q = m.quoted ? m.quoted : m
    let mime = (q.msg || q).mimetype || q.mimetype || ''

    if (/image/.test(mime)) {
        try {
            let img = await q.download()
            if (!img) throw 'Gambar tidak ditemukan'

            img = await sharp(img)
                .resize(640, 640, { fit: 'cover' })
                .jpeg({ quality: 80 })
                .toBuffer()

            await conn.setMyProfilePhoto(img)
            m.reply('✅ Foto profil bot berhasil diubah!')
        } catch (e) {
            console.error('setMyProfilePhoto error:', e?.message || e)
            m.reply(`❌ Terjadi kesalahan: ${e?.message || e}`)
        }
    } else {
        throw `Kirim/balas gambar dengan caption *${usedPrefix + command}*`
    }
}

handler.help = ['setppbot <caption / reply image>']
handler.tags = ['owner']
handler.command = /^(setppbot|setbotphoto|setbotpp)$/i
handler.rowner = false
module.exports = handler