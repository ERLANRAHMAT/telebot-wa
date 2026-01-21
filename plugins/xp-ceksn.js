const { createHash } = require('crypto');

const handler = async (m, { conn, text }) => {
  const user = global.db.data.users[m.sender];
  if (!user.sn) {
    let initialSN = createHash('md5').update(String(m.sender)).digest('hex').slice(0, 25).toUpperCase();
    user.sn = initialSN;
  }

  const cooldown = 180000;
  const timePassed = new Date() - (user.snlast || 0);
  const timeLeft = cooldown - timePassed;

  if (timePassed >= cooldown) {
    user.snlast = new Date() * 1;
    const sn = user.sn;
    await m.reply(`🔖 *SN Anda:*\n\n${sn}\n\n📌 *Catatan:*\n_SN ini bersifat permanen dan tidak dapat diubah._`);
  } else {
    const waktutunggu = clockString(timeLeft);
    await m.reply(`⏳ Mohon tunggu *${waktutunggu}* lagi untuk melihat SN Anda.`);
  }
}

handler.help = ['ceksn']
handler.tags = ['main']
handler.command = /^(ceksn|sn|serialnumber)$/i
handler.register = true

module.exports = handler

function clockString(ms) {
  let h = isNaN(ms) ? '--' : Math.floor(ms / 3600000);
  let m = isNaN(ms) ? '--' : Math.floor(ms / 60000) % 60;
  let s = isNaN(ms) ? '--' : Math.floor(ms / 1000) % 60;
  return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
}