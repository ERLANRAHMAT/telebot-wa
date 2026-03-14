const handler = async (m, { conn, text, usedPrefix, command }) => {
  global.db.data.sticker = global.db.data.sticker || {};
  if (!m.quoted) throw `Balas stiker dengan perintah *${usedPrefix + command} /menu*`;

  // Ambil file_id dari stiker yang di-reply
  const fileId = m.quoted.msg?.sticker?.file_id || 
                 m.quoted.msg?.sticker?.file_unique_id;

  if (!fileId) throw 'Reply ke pesan stiker, bukan pesan biasa!';
  if (!text) throw `Penggunaan:\n${usedPrefix + command} /menu`;

  const sticker = global.db.data.sticker;
  if (sticker[fileId]?.locked) throw 'Stiker ini terkunci!';

  sticker[fileId] = {
    text,
    creator: m.sender,
    at: Date.now(),
    locked: false,
  };

  m.reply(`✅ Berhasil! Stiker ini sekarang akan eksekusi: *${text}*`);
};

handler.help = ['setcmd <command>'];
handler.tags = ['database'];
handler.command = ['setcmd'];
handler.premium = true;
handler.fail = null;
module.exports = handler;