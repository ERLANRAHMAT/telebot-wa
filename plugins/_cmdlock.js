// lockcmd.js
const handler = async (m, { conn, command }) => {
  if (!m.quoted) throw 'Balas pesan dulu!';
  const sticker = global.db.data.sticker;
  const hash = String(m.quoted.id);
  if (!(hash in sticker)) throw 'Hash tidak ditemukan di database';
  sticker[hash].locked = !/^un/i.test(command);
  m.reply('Done!');
};

handler.help = ['lockcmd', 'unlockcmd'];
handler.tags = ['database'];
handler.command = /^(un)?lockcmd$/i;
module.exports = handler;