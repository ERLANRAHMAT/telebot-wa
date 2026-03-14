let handler = async (m, { conn }) => {
    try {
        await conn.removeMyProfilePhoto()
        m.reply('✅ Foto profil bot berhasil dihapus!')
    } catch (e) {
        console.error('removeMyProfilePhoto error:', e?.message || e)
        m.reply(`❌ Terjadi kesalahan: ${e?.message || e}`)
    }
}

handler.help = ['delppbot']
handler.tags = ['owner']
handler.command = /^(delppbot|delbotpp|delbotphoto)$/i
handler.rowner = true
module.exports = handler