const handler = async (m, { conn }) => {
  const name = global.db.data.users?.[m.sender]?.name || 'kamu';
  const mention = `[${name}](tg://user?id=${m.sender})`;

  await conn.sendMessage(m.chat, { text: mention }, {
    parse_mode: 'Markdown',
    reply_to_message_id: m.id
  });
};

handler.help = ['tagme'];
handler.tags = ['group'];
handler.command = /^tagme$/i;
handler.group = true;

module.exports = handler;