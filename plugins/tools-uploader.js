const uploadFile = require('../lib/uploadFile')
const uploadImage = require('../lib/uploadImage')
const { getMimeType } = require('../lib/getMime');

let handler = async (m) => {
    let q = m.quoted ? m.quoted : m
    try {
        if (!q) throw 'Tidak ada media yang ditemukan'
        let media = await q.download()
        let mime = await getMimeType(await q.download());
        let isTele = /image\/(png|jpe?g|gif)|video\/mp4/.test(mime)
        let fileSizeLimit = 5 * 1024 * 1024
        if (media.length > fileSizeLimit) {
            throw 'Ukuran media tidak boleh melebihi 5MB'
        }
        let link = await (isTele ? uploadImage : uploadFile)(media)
        m.reply(`${link}
${media.length} Byte(s)
${isTele ? '(Tidak Ada Tanggal Kedaluwarsa)' : '(Expired 24 hours)'}`)
    } catch (e) {
        console.error(e)
        m.reply('Gagal mengunggah media. Pastikan media yang dikirim adalah gambar atau video ataupun audio.')
    }
}
handler.help = ['tourl <reply image>']
handler.tags = ['sticker']
handler.command = /^(upload|tourl)$/i

module.exports = handler