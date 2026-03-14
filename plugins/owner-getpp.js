const axios = require('axios')

let handler = async (m, { conn, isOwner }) => {
    const isAnonymousOwner = m.sender.toString() === '1087968824' && 
        global.ownerid?.some(id => id === m.chat.toString().replace(/^-100/, ''))
    
    if (!isOwner && !isAnonymousOwner) return m.reply('❌ Hanya owner yang bisa menggunakan perintah ini!')

    try {
        const photos = await conn.telegram.getUserProfilePhotos(conn.botInfo.id)
        
        if (!photos || photos.total_count === 0) {
            return m.reply('❌ Bot tidak memiliki foto profil!')
        }

        const photo = photos.photos[0][photos.photos[0].length - 1] // ukuran terbesar
        const fileId = photo.file_id

        const file = await conn.telegram.getFile(fileId)
        const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`

        const res = await axios.get(fileUrl, { responseType: 'arraybuffer' })
        const buffer = Buffer.from(res.data)

        await conn.sendMessage(m.chat, {
            image: buffer,
            caption: `📸 Foto profil bot`
        }, { quoted: m })
    } catch (e) {
        console.error('getppbot error:', e?.message || e)
        m.reply(`❌ Terjadi kesalahan: ${e?.message || e}`)
    }
}

handler.help = ['getppbot']
handler.tags = ['owner']
handler.command = /^(getppbot|getbotpp|getbotphoto)$/i
handler.rowner = false
module.exports = handler