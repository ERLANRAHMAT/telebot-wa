const didyoumean = require('didyoumean')
const similarity = require('similarity')

let handler = m => m

handler.before = async function (m, { conn }) {
    if (!m.text) return

    // parse prefix sendiri
    const prefixList = Array.isArray(global.prefix) ? global.prefix : [global.prefix || '/']
    let usedPrefix = ''
    for (const p of prefixList) {
        const pStr = String(p)
        if (m.text.startsWith(pStr)) {
            usedPrefix = pStr
            break
        }
    }

    if (!usedPrefix) return

    const noPrefix = m.text.replace(usedPrefix, '').trim()
    if (!noPrefix) return

    const alias = Object.values(global.plugins)
        .filter(v => v.help && !v.disabled)
        .map(v => v.help)
        .flat(1)
        .map(String)

    if (alias.includes(noPrefix)) return

    const mean = didyoumean(noPrefix, alias)
    if (!mean) return

    const sim = similarity(noPrefix, mean)
    const som = parseInt(sim * 100)

    await conn.sendMessage(m.chat, {
        text: `Halo! Apakah Anda sedang mencari *${usedPrefix + mean}*?\n\n◦ Nama menu: *${usedPrefix + mean}*\n◦ Kemiripan: *${som}%*`
    }, { quoted: m })
}

module.exports = handler