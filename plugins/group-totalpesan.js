const handler = async (m, { conn }) => {
  const user = global.db.data.chats?.[m.chat]?.memgc;
  if (!user || !Object.keys(user).length) throw `Belum ada data chat di grup ini!`;

  const memgc = Object.keys(user)
    .filter(v => v != conn.botInfo?.id)
    .sort((a, b) => user[b].chat - user[a].chat);

  let chatToday = 0;
  let chatTotal = 0;
  for (const id of memgc) {
    chatToday += user[id].chat || 0;
    chatTotal += user[id].chatTotal || 0;
  }

  let head = `Total chat group hari ini: ${toRupiah(chatToday)}\nTotal semua chat: ${toRupiah(chatTotal)}\n\n`;
  let caption = '';
  let nomor = 1;

  for (let i = 0; i < memgc.length; i++) {
    if (typeof user[memgc[i]] !== 'undefined' && nomor <= 20) {
      const name = global.db.data.users?.[memgc[i]]?.name || memgc[i];
      caption += `*${nomor++}.* ${name}\n`;
      caption += `Chat Today : ${toRupiah(user[memgc[i]].chat)}\n`;
      caption += `Total Chat : ${toRupiah(user[memgc[i]].chatTotal)}\n`;
      caption += `Last Chat : ${getTime(user[memgc[i]].lastseen)}\n\n`;
    }
  }

  await conn.sendMessage(m.chat, { text: head + caption.trim() }, {
    parse_mode: 'Markdown',
    reply_to_message_id: m.id
  });
};

handler.help = ['totalchatgc'];
handler.tags = ['group'];
handler.command = /^(totalchatgc)$/i;
handler.isAdmin = true;
handler.group = true;

module.exports = handler;

function parseMs(ms) {
  return {
    days: Math.trunc(ms / 86400000),
    hours: Math.trunc(ms / 3600000) % 24,
    minutes: Math.trunc(ms / 60000) % 60,
    seconds: Math.trunc(ms / 1000) % 60
  };
}

function getTime(ms) {
  if (!ms) return 'unknown';
  const now = parseMs(+new Date() - ms);
  if (now.days) return `${now.days} days ago`;
  else if (now.hours) return `${now.hours} hours ago`;
  else if (now.minutes) return `${now.minutes} minutes ago`;
  else return `a few seconds ago`;
}

const toRupiah = number => parseInt(number).toLocaleString().replace(/,/gi, '.');