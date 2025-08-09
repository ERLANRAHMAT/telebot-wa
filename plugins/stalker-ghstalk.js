let fetch = require('node-fetch')

let handler = async (m, { text, usedPrefix, command, conn }) => {
  if (!text) return m.reply(`Contoh:\n${usedPrefix + command} ERLANRAHMAT`.replace(/[\\_*[\]()~`>#+\-=|{}.!]/g, '\\$&'))

  try {
    let res = await fetch(`https://api.betabotz.eu.org/api/stalk/github?username=${text}&apikey=${lann}`)
    let json = await res.json()
    let user = json.result.user
    let ava = user.avatarUrl

    const cleanText = (str) => {
      if (!str) return "-"
      return str.toString()
        .replace(/[_*`[\]]/g, '') // Hapus karakter Markdown yang bermasalah
        .replace(/\n/g, ' ') // Ganti newline dengan spasi
        .trim()
    }

    // Fungsi untuk format angka dengan fallback
    const formatNumber = (num) => {
      if (num === null || num === undefined) return "-"
      return num.toString()
    }

    // Fungsi untuk format tanggal yang lebih readable
    const formatDate = (dateString) => {
      if (!dateString) return "-"
      try {
        const date = new Date(dateString)
        const options = { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric'
        }
        return date.toLocaleDateString('id-ID', options)
      } catch (error) {
        return dateString.split("T")[0]
      }
    }

    // Format teks yang bersih
    let capgh = 
`GitHub Stalker
─────────────────────────────
👤 Name      : ${cleanText(user.name) || cleanText(user.username)}
🆔 ID        : ${formatNumber(user.idUser)}
🆔 NodeId    : ${cleanText(user.nodeId)}
👥 Followers : ${formatNumber(user.followers)}
👣 Following : ${formatNumber(user.following)}
📝 Bio       : ${cleanText(user.bio)}
📌 Type      : ${cleanText(user.type)}
🏢 Company   : ${cleanText(user.company)}
🌐 Blog      : ${user.blog || "-"}
📂 Repo      : ${formatNumber(user.publicRepos)}
📊 Gists     : ${formatNumber(user.publicGists)}
📅 Created   : ${formatDate(user.createdAt)}
♻️ Updated   : ${formatDate(user.updatedAt)}
─────────────────────────────

🔗 Profile: https://github.com/${user.username}`

    await conn.sendMessage(
      m.chat,
      {
        image: { url: ava },
        caption: capgh,
      },
      { quoted: { message_id: m.id } }
    )

  } catch (e) {
    console.log(e)
    m.reply('Sistem Sedang Bermasalah!')
  }
}

handler.help = ['ghstalk <username>']
handler.tags = ['stalk']
handler.command = /^(ghstalk)$/i
handler.limit = true
handler.group = false

module.exports = handler