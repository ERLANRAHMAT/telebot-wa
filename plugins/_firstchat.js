const moment = require('moment-timezone');

let handler = async function(m) {
  // Skip kalau pesan dari grup atau dari bot sendiri
  if (m.isGroup || m.fromMe) return;

  let user = global.db.data.users[m.sender];
  if (!user) return;

  // Cooldown 3 jam
  if (new Date() - user.pc < 10800000) return;

  const botName = this.botInfo?.first_name || 'Bot';
  let txt = `👋 Hai, ${ucapan()}\n\n${user.banned 
    ? '📮 Maaf, kamu dibanned & tidak bisa menggunakan bot ini lagi' 
    : `💬 Ada yang bisa ${botName} bantu?`}`;

  await this.sendMessage(m.chat, { text: txt.trim() }, {
    parse_mode: 'Markdown',
    reply_to_message_id: m.id
  });

  user.pc = Date.now();
};

handler.before = handler;

function ucapan() {
  const time = moment.tz('Asia/Jakarta').format('HH');
  let res = 'Selamat dinihari 🌆';
  if (time >= 4) res = 'Selamat pagi 🌄';
  if (time > 10) res = 'Selamat siang ☀️';
  if (time >= 15) res = 'Selamat sore 🌇';
  if (time >= 18) res = 'Selamat malam 🌙';
  return res;
}

module.exports = handler;