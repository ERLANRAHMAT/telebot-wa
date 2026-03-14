const handler = m => m;

handler.before = async function(m) {
  if (!m.isGroup) return true;

  const msg = m.message || {};

  // Ganti title grup
  if (msg.new_chat_title) {
    const name = m.name || m.sender;
    await this.sendMessage(m.chat, {
      text: `[${name}](tg://user?id=${m.sender}) mengubah nama grup menjadi *${msg.new_chat_title}*`
    }, { parse_mode: 'Markdown' });

  // Ganti foto grup
  } else if (msg.new_chat_photo) {
    const name = m.name || m.sender;
    await this.sendMessage(m.chat, {
      text: `[${name}](tg://user?id=${m.sender}) telah mengubah foto grup.`
    }, { parse_mode: 'Markdown' });

  // Hapus foto grup
  } else if (msg.delete_chat_photo) {
    const name = m.name || m.sender;
    await this.sendMessage(m.chat, {
      text: `[${name}](tg://user?id=${m.sender}) telah menghapus foto grup.`
    }, { parse_mode: 'Markdown' });

  // Pin pesan
  } else if (msg.pinned_message) {
    const name = m.name || m.sender;
    await this.sendMessage(m.chat, {
      text: `[${name}](tg://user?id=${m.sender}) telah mempin sebuah pesan.`
    }, { parse_mode: 'Markdown' });
  }

  return true;
};

module.exports = handler;