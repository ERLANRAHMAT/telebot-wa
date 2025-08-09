let fetch = require('node-fetch')
let handler = async (m, { text, usedPrefix, command, conn }) => {
  if (!text) return m.reply(`Contoh:\n${usedPrefix + command} erlanrahmat_14`.replace(/[\\_*[\]()~`>#+\-=|{}.!]/g, '\\$&'))
  try {
    let api = await fetch(`https://api.betabotz.eu.org/api/stalk/ig?username=${text}&apikey=${lann}`)
    let response = await api.json()
    if (response.status) {
      let { photoUrl, postsCount, followers, following, bio, fullName, username } = response.result
      let capig = `乂 *I G S T A L K E R*\n\n`
      capig += `◦ *Username* : ${username}\n`
      capig += `◦ *Full Name* : ${fullName}\n`
      capig += `◦ *Bio* : ${bio}\n`
      capig += `◦ *Followers* : ${followers}\n`
      capig += `◦ *Following* : ${following}\n`
      capig += `◦ *Total Post* : ${postsCount}\n\n`
      capig += `🔗 Profile: https://instagram.com/${username}`

      await conn.sendMessage(
        m.chat,
        {
          image: { url: photoUrl },
          caption: capig,
        },
        { quoted: { message_id: m.id } }
      )

    } else {
      throw 'Sistem Sedang Bermasalah!'
    }
  } catch (e) {
    console.error(e)
    m.reply('Sistem Sedang Bermasalah!')
  }
}

handler.help = ['igstalk <username>']
handler.tags = ['stalk']
handler.command = /^(igstalk)$/i
handler.limit = true

module.exports = handler