let fetch = require('node-fetch')
let handler = async (m, { text, usedPrefix, command, conn }) => {
  if (!text) return m.reply(`Contoh:\n${usedPrefix + command} annchire`.replace(/[\\_*[\]()~`>#+\-=|{}.!]/g, '\\$&'))
  try {
    let json = await fetch(`https://api.betabotz.eu.org/api/stalk/tt?username=${text}&apikey=${lann}`).then(res => res.json())
    
    if (!json.result) return m.reply('Username tidak ditemukan atau API error')
    
    let pp = json.result.profile
    let username = json.result.username
    
    let captt = `乂 *T T S T A L K E R*\n\n`
    captt += `◦ *Username* : ${username}\n`
    captt += `◦ *Description* : ${json.result.description}\n`
    captt += `◦ *Likes* : ${json.result.likes.toLocaleString()}\n`
    captt += `◦ *Followers* : ${json.result.followers.toLocaleString()}\n`
    captt += `◦ *Following* : ${json.result.following.toLocaleString()}\n`
    captt += `◦ *Total Post* : ${json.result.totalPosts.toLocaleString()}\n\n`
    captt += `🔗 Profile: https://tiktok.com/@${username}`

    await conn.sendMessage(
      m.chat,
      {
        image: { url: pp },
        caption: captt,
      },
      { quoted: { message_id: m.id } }
    )

  } catch (e) {
    console.error(e)
    m.reply('Gagal menemukan username atau sistem sedang bermasalah')
  }
}

handler.help = ['ttstalk <username>']
handler.tags = ['stalk']
handler.command = /^(ttstalk)$/i
handler.limit = true

module.exports = handler