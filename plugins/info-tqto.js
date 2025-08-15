let handler = async (m, { conn }) => {
let ye = `@${m.pushName}`
let esce = `
Hai ${ye}\nDengan ini saya ingin mengucapkan terima kasih kepada:\n\n• Erlan ( Betabotz )\n• Dreamliner21 ( Paull )\n• Danaputra\n• Botcahx ( Tio )\n• Dan semua yang telah berkontribusi dalam pembuatan bot ini.\n\nTerima kasih atas dukungan dan kontribusinya! 
`
m.reply(esce)
}
handler.help = handler.command = ['thanksto', 'tqto']
handler.tags = ['info']
module.exports = handler
