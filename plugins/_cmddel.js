// delcmd.js
const handler = async (m, { conn, text }) => {
  const hash = m.quoted ? String(m.quoted.id) : text;
  if (!hash) throw 'Tidak ada hash';
  const sticker = global.db.data.sticker;
  if (sticker[hash]?.locked) throw 'Kamu tidak memiliki izin untuk menghapus perintah ini';
  delete sticker[hash];
  m.reply('Berhasil!');
};

handler.help = ['delcmd <teks>'];
handler.tags = ['database'];
handler.command = ['delcmd'];
handler.premium = true;
module.exports = handler;