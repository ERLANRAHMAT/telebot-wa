let fs = require('fs')

let handler = async (m, { text, usedPrefix, command }) => {
    if (!text) {
        return m.reply(`Nama plugin mana?\n\nContoh: ${usedPrefix + command} menu`)
    }

    if (command === 'sfp') {
        if (!m.quoted) {
            return m.reply(`Reply file dulu yang mau disimpan!`)
        }
        
        if (typeof m.quoted.download !== 'function') {
            return m.reply(`Itu bukan file! Reply file/dokumen yang udah diupload ya`)
        }
        
        try {
            let filePath = text.trim()
            
            let media = await m.quoted.download()
            if (!media || media.length === 0) {
                return m.reply(`File kosong atau ga bisa didownload!`)
            }
            
            let fullPath = `plugins/${filePath}.js`
            
            if (!fs.existsSync('plugins')) {
                fs.mkdirSync('plugins')
            }
            
            fs.writeFileSync(fullPath, media)
            
            try {
                let content = fs.readFileSync(fullPath, 'utf8')
            } catch (e) {
                // ignore
            }
            
            return m.reply(`Plugin tersimpan!`)
            
        } catch (error) {
            return m.reply(`Gagal simpan plugin!\n\n${error.message}`)
        }
        
    } else if (command === 'dfp' || command === 'df') {
        try {
            let filePath = `plugins/${text.trim()}.js`
            
            if (!fs.existsSync(filePath)) {
                return m.reply(`Plugin ${text}.js ga ada!`)
            }
            
            fs.unlinkSync(filePath)
            return m.reply(`Plugin ${text}.js udah dihapus!`)
            
        } catch (error) {
            return m.reply(`Gagal hapus plugin!\n\n${error.message}`)
        }
    }
}

handler.help = ['sfp', 'dfp', 'df'].map(v => v + ' <nama>')
handler.tags = ['owner']
handler.command = /^(sfp|dfp|df)$/i
handler.rowner = true

module.exports = handler
