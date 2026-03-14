const handler = async (m, { conn }) => {
  const memgc = global.db.data.chats?.[m.chat]?.memgc || {};
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  const activeToday = Object.entries(memgc)
    .filter(([id, data]) => data.lastseen && (now - data.lastseen) < oneDay)
    .sort((a, b) => b[1].lastseen - a[1].lastseen);

  if (!activeToday.length) throw `Belum ada member aktif hari ini!`;

  let text = `*👤 LIST AKTIF HARI INI*\n<==================>\n`;
  activeToday.forEach(([id, data], i) => {
    const name = global.db.data.users?.[id]?.name || id;
    const menit = Math.floor((now - data.lastseen) / 60000);
    const waktu = menit < 60 ? `${menit}m ago` : `${Math.floor(menit/60)}h ago`;
    text += `*${i + 1}.* [${name}](tg://user?id=${id}) — ${waktu}\n`;
  });

  await conn.sendMessage(m.chat, { text }, {
    parse_mode: 'Markdown',
    reply_to_message_id: m.id
  });
};

handler.help = ['listonline'];
handler.tags = ['group'];
handler.command = /^listonline$/i;
handler.group = true;
handler.isAdmin = true;

module.exports = handler;