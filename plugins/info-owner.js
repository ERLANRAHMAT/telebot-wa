let handler = async (m, { conn }) => {
  // daftar owner dari config (array nomor)
  const ownerNumbers = (global.owner || []);

  // siapkan objek-objek contact
  const contacts = ownerNumbers.map(num => ({
    phone_number: num,
    first_name: global.ownername || 'Owner',
    // optional:
    // last_name: '',
    // vcard: '...string vcard jika kamu punya...',
  }));

  const caption = `<b>${global.botname}</b>\nOwner: <b>@${global.ownername}</b>\nID: <code>${global.ownerid}</code>`;
  await conn.sendContact(
    m.chat,
    contacts,             // <= array -> dikirim satu-satu
    caption,              // <= caption (pesan teks terpisah)
    m,                    // <= quoted (reply ke pesan user)
    {
      parse_mode: 'HTML', // untuk caption di atas
      auto_vcard: true, // aktifkan kalau mau auto-generate vCard
      vcard_org: 'Betabotz',
      vcard_title: 'Owner',
      dedupe: false, // false untuk mengirim semua kontak meskipun ada yang sama
    }
  );
};

handler.command = handler.help = ['owner', 'creator'];
handler.tags = ['info'];
module.exports = handler;
