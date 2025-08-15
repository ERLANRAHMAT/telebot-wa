let handler = async (m, { conn }) => {
let ye = `@${m.pushName}`
let esce = `
Hai ${ye} Bot Ini Menggunakan Script :\n• https://github.com/ERLANRAHMAT/telebot-wa 
`
m.reply(esce)
}
handler.help = ['sc', 'sourcecode']
handler.tags = ['info']
handler.command = /^(sc|sourcecode)$/i

module.exports = handler
