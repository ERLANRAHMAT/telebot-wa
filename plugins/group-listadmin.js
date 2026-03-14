const handler = async (m, { conn }) => {
  const admins = await conn.telegram.getChatAdministrators(m.chat);
  const filtered = admins.filter(a => !a.user.is_bot);

  let txt = `List Admin Group\n*Total:* ${filtered.length}\n\n`;
  for (const a of filtered) {
    const name = a.user.first_name || a.user.username || a.user.id;
    const mention = `[${name}](tg://user?id=${a.user.id})`;
    txt += `• ${mention}\n`;
  }

  await conn.sendMessage(m.chat, { text: txt }, {
    parse_mode: 'Markdown',
    reply_to_message_id: m.id
  });
};

handler.help = ['listadmin'];
handler.tags = ['group'];
handler.command = /^(adminlist|listadmin)$/i;
handler.group = true;

module.exports = handler;