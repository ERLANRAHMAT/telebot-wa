const handler = m => m;

handler.before = async function(m, { conn, isAdmin, isBotAdmin }) {
  try {
    const chat = global.db.data.chats?.[m.chat];
    if (!chat?.antivideo) return true;
    if (isAdmin) return true; // admin boleh kirim video

    const isVideo = /^video/.test(m.mimetype || '') ||
      /^video/.test(m.mediaType || '');

    if (!isVideo) return true;

    await this.sendMessage(m.chat, { delete: m.id });
    await this.sendMessage(m.chat, {
      text: `*⚠️ Video Terdeteksi*\n\nMaaf, video tidak diizinkan di grup ini!`
    }, { parse_mode: 'Markdown' });

  } catch (e) {
    console.error('[ANTIVIDEO]', e.message);
  }
  return true;
};

module.exports = handler;