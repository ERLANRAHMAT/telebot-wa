let fetch = require('node-fetch');

function escapeMarkdown(text) {
  if (typeof text !== 'string') return text;
  return text.replace(/([_*[\]()~`>#+=|{}.!-])/g, '\\$1');
}

let handler = async (m, { text, usedPrefix, command, conn }) => {
  if (!text) return m.reply(`Contoh:\n${usedPrefix + command} prabowo`.replace(/[\\_*[\]()~`>#+\-=|{}.!]/g, '\\$&'))

  try {
    let x = await fetch(`https://api.betabotz.eu.org/api/stalk/twitter?username=${text}&apikey=${lann}`);
    let stalkx = await x.json();

    if (stalkx.status) {
      let {
        profileImage,
        id,
        bio,
        username,
        fullName,
        follower,
        following,
        totalPosts,
        favoritCount,
        location,
        createdAt
      } = stalkx.result;

      let captw = `*乂 X S T A L K E R*\n\n`;
      captw += `╭─❒ *User Info*\n`;
      captw += `│◦ *Username* : ${escapeMarkdown(username)}\n`;
      captw += `│◦ *Full Name* : ${escapeMarkdown(fullName)}\n`;
      captw += `│◦ *ID* : ${escapeMarkdown(id)}\n`;
      captw += `│◦ *Bio* : ${escapeMarkdown(bio)}\n`;
      captw += `│◦ *Location* : ${escapeMarkdown(location)}\n`;
      captw += `│◦ *Created At* : ${createdAt.toLocaleString()}\n`;
      captw += `╰──────\n\n`;
      captw += `╭─❒ *Statistics*\n`;
      captw += `│◦ *Followers* : ${follower.toLocaleString()}\n`;
      captw += `│◦ *Following* : ${following.toLocaleString()}\n`;
      captw += `│◦ *Total Posts* : ${totalPosts.toLocaleString()}\n`;
      captw += `│◦ *Favorit Count* : ${favoritCount.toLocaleString()}\n`;
      captw += `╰──────\n\n`;
      captw += `🔗 Profile: https://x.com/${username}`;

      await conn.sendMessage(
        m.chat,
        {
          image: { url: profileImage },
          caption: captw,
        },
        { quoted: { message_id: m.id } }
      )

    } else {
      throw 'Gagal menemukan username atau sistem sedang bermasalah';
    }
  } catch (e) {
    console.error(e);
    m.reply('Gagal menemukan username atau sistem sedang bermasalah');
  }
};

handler.help = ['twitterstalk <username>'];
handler.tags = ['stalk'];
handler.command = /^(twitterstalk|twstalk|xstalk)$/i;
handler.limit = true;

module.exports = handler;