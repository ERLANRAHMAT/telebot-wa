let handler = async (m, { args, chatId, isOwner }) => {
  const quotedText = m.quoted?.text || m.quoted?.caption || '';
  const argsText = args.join(' ');
  const text = quotedText || argsText;
  const isGroup = m.isGroup;
  const isAdmin = m.isAdmin || isOwner;

  if (!isGroup) {
    return m.reply('Perintah ini hanya dapat digunakan di grup!');
  }

  if (!isAdmin) {
    return m.reply('Perintah ini hanya untuk Admin!');
  }

  if (!text) {
    return m.reply('📝 Cara penggunaan:\n\n1️⃣ Kirim pesan dengan format leave yang diinginkan (bisa multi-line)\n2️⃣ Reply pesan tersebut dengan /setleave\n\nAtau ketik langsung:\n/setleave Teks leave\n\n🔖 Variable:\n@user - nama user\n@subject - nama grup');
  }

if (!global.db.data.chats[chatId]) global.db.data.chats[chatId] = {};
global.db.data.chats[chatId].sWelcome = text;
  
  const preview = text.length > 150 ? text.substring(0, 150) + '...' : text;
  await m.reply(`✅ Leave message berhasil diatur!\n\n🔖 Variable yang tersedia:\n@user - nama user\n@subject - nama grup\n\n📄 Preview:\n${preview}`);
};

handler.command = ['setwelcome'];
handler.tags = ['group'];
handler.help = ['setwelcome <teks>'];

module.exports = handler;