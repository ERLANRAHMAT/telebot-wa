const fetch = require('node-fetch');

const handler = async (m, { conn }) => {
  const users = global.db.data.users;
  const totalUsers = Object.keys(users).length;
  const registeredUsers = Object.values(users).filter(u => u.registered === true).length;
  const unregisteredUsers = totalUsers - registeredUsers;

  const capts = `*📊 Statistik Pengguna:*\n\n` +
    `👤 Total User: *${totalUsers}*\n` +
    `✅ Sudah Register: *${registeredUsers}*\n` +
    `❌ Belum Register: *${unregisteredUsers}*`;

  let photoBuffer = null;
  try {
    const photos = await conn.telegram.getUserProfilePhotos(m.sender);
    if (photos?.total_count > 0) {
      const fileId = photos.photos[0][0].file_id;
      const file = await conn.telegram.getFile(fileId);
      const url = `https://api.telegram.org/file/bot${conn.token}/${file.file_path}`;
      const res = await fetch(url);
      photoBuffer = await res.buffer();
    }
  } catch {
    photoBuffer = null;
  }

  if (photoBuffer) {
    await conn.sendMessage(m.chat, { photo: photoBuffer, caption: capts }, {
      parse_mode: 'Markdown',
      reply_to_message_id: m.id
    });
  } else {
    await conn.sendMessage(m.chat, { text: capts }, {
      parse_mode: 'Markdown',
      reply_to_message_id: m.id
    });
  }
};

handler.help = ['database', 'user'];
handler.tags = ['info'];
handler.command = /^(database|jumlahdatabase|user)$/i;

module.exports = handler;