// listcmd.js
const handler = async (m, { conn }) => {
  const list = Object.entries(global.db.data.sticker || {})
    .map(([key, value], index) =>
      `${index + 1}. ${value.locked ? '🔒 ' : ''}${key} : ${value.text}`)
    .join('\n');

  await conn.sendMessage(m.chat, {
    text: `*DAFTAR CMD*\n\`\`\`${list || 'Kosong'}\`\`\``
  }, { parse_mode: 'Markdown', reply_to_message_id: m.id });
};

handler.help = ['listcmd'];
handler.tags = ['database'];
handler.command = ['listcmd'];
module.exports = handler;