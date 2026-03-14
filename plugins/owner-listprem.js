let handler = async (m, { conn, usedPrefix }) => {
  function msToDate(ms) {
    if (ms <= 0) return 'Expired';
    
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    const daysms = ms % (24 * 60 * 60 * 1000);
    const hours = Math.floor(daysms / (60 * 60 * 1000));
    const hoursms = ms % (60 * 60 * 1000);
    const minutes = Math.floor(hoursms / (60 * 1000));
    
    return `${days} Hari ${hours} Jam ${minutes} Menit`;
  }
  
  let users = global.db.data.users;
  let premiumUsers = [];
  let now = new Date().getTime();
  
  // Collect all premium users
  for (let jid in users) {
    if (users[jid].premium && users[jid].premiumTime > now) {
      const timeLeft = users[jid].premiumTime - now;
      const expiryDate = new Date(users[jid].premiumTime);
      
      premiumUsers.push({
        id: jid,
        username: users[jid].username || 'Unknown',
        timeLeft: msToDate(timeLeft),
        expiry: expiryDate.toLocaleString('id-ID', { 
          timeZone: 'Asia/Jakarta',
          dateStyle: 'medium',
          timeStyle: 'short'
        })
      });
    }
  }
  
  if (premiumUsers.length === 0) {
    return m.reply(
      `*『 LIST PREMIUM 』*\n\n` +
      `❌ Tidak ada user premium saat ini.\n\n` +
      `Ingin upgrade ke premium? Ketik *${usedPrefix}owner*`
    );
  }
  
  // Build message
  let text = `*『 LIST PREMIUM USERS 』*\n\n`;
  text += `📊 Total Premium: *${premiumUsers.length} user*\n`;
  text += `━━━━━━━━━━━━━━━━━\n\n`;
  
  premiumUsers.forEach((user, index) => {
    text += `${index + 1}. 👤 User ID: \`${user.id}\`\n`;
    if (user.username !== 'Unknown') {
      text += `   📱 Username: @${user.username}\n`;
    }
    text += `   ⏰ Sisa Waktu: ${user.timeLeft}\n`;
    text += `   📅 Expired: ${user.expiry}\n\n`;
  });
  
  text += `━━━━━━━━━━━━━━━━━\n`;
  text += `💎 Ingin upgrade ke Premium?\n`;
  text += `Ketik *${usedPrefix}owner*`;
  
  await m.reply(text);
};

handler.help = ['listpremium'];
handler.tags = ['info'];
handler.command = /^(listpremium|premiumlist|listprem|premlist)$/i;
handler.limit = false;

module.exports = handler;