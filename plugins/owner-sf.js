let handler = async (m, { text, usedPrefix, command }) => {
    if (!text) m.reply( `uhm.. teksnya mana?\n\npenggunaan:\n${usedPrefix + command} <teks>\n\ncontoh:\n${usedPrefix + command} plugins/menu.js`)
    if (!m.quoted.text) m.reply( `balas pesan nya!`)
    let path = `${text}`
    await require('fs').writeFileSync(path, m.quoted.text)
    m.reply(`tersimpan di ${path}`)
}
handler.help = ['sf'].map(v => v + ' <teks>')
handler.tags = ['owner']
handler.command = /^sf$/i

handler.owner = true

module.exports = handler