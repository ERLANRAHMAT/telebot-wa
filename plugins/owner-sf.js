const fs = require('fs')
const path = require('path')

let handler = async (m, { text, usedPrefix, command, conn }) => {
    if (!text) {
        return m.reply(`❌ Nama file tidak ditemukan!\n\n📝 Penggunaan:\n${usedPrefix + command} <nama_file>\n\n📋 Contoh:\n${usedPrefix + command} plugins/menu.js\n\n💡 Reply file/dokumen yang ingin disimpan!`)
    }
    
    if (!m.quoted) {
        return m.reply(`❌ Reply file atau dokumen yang ingin disimpan!\n\n📎 Format yang didukung:\n• .js, .json, .txt`)
    }
    
    if (typeof m.quoted.download !== 'function') {
        return m.reply(`❌ Pesan yang direply tidak mengandung file!\n\n💡 Tips:\n• Reply file/dokumen yang sudah diupload\n• Pastikan file memiliki ekstensi (.js, .txt, .json)\n• Jangan reply pesan teks biasa`)
    }
    
    try {
        let filePath = text.trim()
        
        if (path.isAbsolute(filePath)) {
            return m.reply(`✅ Contoh yang benar:\n• plugins/menu.js`)
        }
        
        let media = await m.quoted.download()
        if (!media || media.length === 0) {
            return m.reply(`❌ File kosong atau gagal didownload!`)
        }
        let dir = path.dirname(filePath)
        if (dir !== '.' && !fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
        }
        fs.writeFileSync(filePath, media)

        let fileStats = fs.statSync(filePath)
        let fileSize = fileStats.size
        
        let extension = path.extname(filePath) || ''
        
        const textExtensions = ['.js', '.json', '.txt']
        
        if (textExtensions.includes(extension.toLowerCase())) {
            try {
                let content = fs.readFileSync(filePath, 'utf8')
            } catch (e) {
                console.log('Could not read file as text:', e.message)
            }
        }
        
        const successMessage = `✅ File berhasil disimpan!`
        
        return m.reply(successMessage)
        
    } catch (error) {
        console.error('Error saving file:', error)
        m.reply(`❌ Gagal menyimpan file!\n\nError: ${error.message}`)
    }
}

handler.help = ['sf', 'savefile'].map(v => v + ' <nama_file>')
handler.tags = ['owner']
handler.command = /^(sf|savefile)$/i
handler.owner = true

module.exports = handler
