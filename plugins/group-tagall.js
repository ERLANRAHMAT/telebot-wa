const handler = async (m, { conn, text }) => {
  const memgc = global.db.data.chats?.[m.chat]?.memgc || {};
  const list = Object.keys(memgc);

  if (!list.length) throw `Belum ada data member, tunggu mereka kirim pesan dulu!`;

  const getName = async (id) => {
    const userData = global.db.data.users?.[id];
    if (userData?.name && userData.name !== id) return userData.name;
    try {
      const info = await conn.telegram.getChat(id);
      const name = info.first_name || info.username || id;
      if (global.db.data.users?.[id]) global.db.data.users[id].name = name;
      return name;
    } catch {
      return String(id);
    }
  };

  const chunk = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  const chunks = chunk(list, 50);

  for (const group of chunks) {
    const names = await Promise.all(group.map(id => getName(id)));
    const mentions = group.map((id, i) => `[${names[i]}](tg://user?id=${id})`).join(' ');

    const teks = `⋙ *PESAN DARI ADMIN GROUP* ⋘\n\n*${text || 'Nothing'}*\n\n${mentions}\n〰〰〰〰〰〰〰〰〰〰〰〰〰`;

    await conn.sendMessage(m.chat, { text: teks }, {
      parse_mode: 'Markdown',
      reply_to_message_id: m.id
    });

    await new Promise(res => setTimeout(res, 500));
  }
};

handler.help = ['tagall <pesan>'];
handler.tags = ['group'];
handler.command = /^(tagall)$/i;
handler.group = true;
handler.isAdmin = true;

module.exports = handler;