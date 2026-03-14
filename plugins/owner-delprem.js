let handler = async (m, { conn, text, usedPrefix, command }) => {
  if (!text) {
    return m.reply(
      `*『 GAGAL 』*\n\n` +
      `• Format: ${usedPrefix + command} <user_id>\n\n` +
      `*Example:*\n` +
      `${usedPrefix + command} 123456789\n` +
      `${usedPrefix + command} @username`
    );
  }
  
  let targetUserId = null;
  
  // Handle @username mention
  if (text.startsWith('@')) {
    const username = text.substring(1).trim();
    // Cari user berdasarkan username di database
    for (let userId in db.data.users) {
      if (db.data.users[userId].username === username) {
        targetUserId = userId;
        break;
      }
    }
    
    if (!targetUserId) {
      return m.reply(`*『 GAGAL 』*\n\n• User @${username} tidak ditemukan di database!`);
    }
  } else {
    // Langsung pakai user ID
    targetUserId = text.replace(/[^0-9]/g, '');
  }
  
  // Cek apakah user ada di database
  if (typeof db.data.users[targetUserId] === 'undefined') {
    return m.reply(`*『 GAGAL 』*\n\n• User ID \`${targetUserId}\` tidak ditemukan di database!`);
  }
  
  // Hapus premium
  db.data.users[targetUserId].premium = false;
  db.data.users[targetUserId].premiumTime = 0;
  
  await m.reply(
    `*『 SUKSES 』*\n\n` +
    `✅ Berhasil menghapus akses premium!\n\n` +
    `👤 User ID: \`${targetUserId}\``
  );
  
  // Kirim notifikasi ke user (optional)
  try {
    await conn.sendMessage(targetUserId, {
      text: 
        `*『 INFO PREMIUM 』*\n\n` +
        `⚠️ Akses premium Anda telah dihapus.\n\n` +
        `Hubungi owner jika ada pertanyaan.`
    });
  } catch (e) {
    console.log('Failed to notify user:', e.message);
  }
};

handler.help = ['unprem <userid>'];
handler.tags = ['owner'];
handler.command = /^(unprem|delprem)$/i;
handler.owner = true;

module.exports = handler;