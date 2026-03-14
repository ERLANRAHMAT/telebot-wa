let handler = async (m, { conn, text, usedPrefix, command }) => {
  if (!text) {
    return m.reply(`*『 GAGAL 』*\n\n• Format: ${usedPrefix + command} <user_id>|<days>\n\n*Example:*\n${usedPrefix + command} 123456789|30\n${usedPrefix + command} @username|30`);
  }
  
  const parts = text.split('|');
  if (parts.length < 2) {
    return m.reply(`*『 GAGAL 』*\n\n• Format salah! Gunakan: ${usedPrefix + command} <user_id>|<days>`);
  }
  
  let targetInput = parts[0].trim();
  let days = parseInt(parts[1].trim());
  
  if (isNaN(days) || days <= 0) {
    return m.reply('*『 GAGAL 』*\n\n• Jumlah hari harus berupa angka positif!');
  }
  
  let targetUserId = null;
  
  // Handle @username mention
  if (targetInput.startsWith('@')) {
    const username = targetInput.substring(1);
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
    targetUserId = targetInput.replace(/[^0-9]/g, '');
  }
  
  // Pastikan user ada di database
  if (typeof db.data.users[targetUserId] === 'undefined') {
    db.data.users[targetUserId] = {
      premium: false,
      premiumTime: 0,
      username: null
    };
  }
  
  const jumlahHari = 86400000 * days; // ms per day
  const now = new Date().getTime();
  
  db.data.users[targetUserId].premium = true;
  
  // Jika masih premium, tambahkan durasi
  if (now < db.data.users[targetUserId].premiumTime) {
    db.data.users[targetUserId].premiumTime += jumlahHari;
  } else {
    db.data.users[targetUserId].premiumTime = now + jumlahHari;
  }
  
  const expiryDate = new Date(db.data.users[targetUserId].premiumTime);
  const expiryStr = expiryDate.toLocaleString('id-ID', { 
    timeZone: 'Asia/Jakarta',
    dateStyle: 'full',
    timeStyle: 'short'
  });
  
  // Reply ke admin
  await m.reply(
    `*『 SUKSES 』*\n\n` +
    `✅ Berhasil menambahkan premium!\n\n` +
    `👤 User ID: \`${targetUserId}\`\n` +
    `⏰ Durasi: *${days} hari*\n` +
    `📅 Expired: ${expiryStr}`
  );
  
  // Kirim notifikasi ke user (optional)
  try {
    await conn.sendMessage(targetUserId, {
      text: 
        `*『 INFO PREMIUM 』*\n\n` +
        `🎉 Selamat! Anda telah mendapatkan akses premium!\n\n` +
        `⏰ Durasi: *${days} hari*\n` +
        `📅 Berakhir: ${expiryStr}\n\n` +
        `_Nikmati fitur premium bot ini!_ ✨`
    });
  } catch (e) {
    console.log('Failed to notify user:', e.message);
  }
};

handler.help = ['addprem <userid|days>'];
handler.tags = ['owner'];
handler.command = /^(addprem|prem)$/i;
handler.owner = true;

module.exports = handler;