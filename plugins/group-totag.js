const handler = async (m, { conn }) => {
  if (!m.quoted) throw `Reply pesan dulu!`;

  const memgc = global.db.data.chats?.[m.chat]?.memgc || {};
  const list = Object.keys(memgc);

  if (!list.length) throw `Belum ada data member, tunggu mereka kirim pesan dulu!`;

  const chunk = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  const chunks = chunk(list, 50);

  for (const group of chunks) {
    const entities = group.map(id => ({
      type: 'text_mention',
      offset: 0,
      length: 1,
      user: { id: parseInt(id) }
    }));

    await conn.sendMessage(m.chat, { text: '.' }, {
      entities,
      reply_to_message_id: m.quoted.message_id
    });

    await new Promise(res => setTimeout(res, 500));
  }
};

handler.help = ['totag', 'hidetag'];
handler.tags = ['group'];
handler.command = /^(totag|tag|hidetag)$/i;
handler.isAdmin = true;
handler.group = true;

module.exports = handler;