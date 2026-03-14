var fetch = require("node-fetch");
var handler = async (m, { conn, args, usedPrefix, command }) => {
  if (!args[0]) throw `Masukan URL!\n\ncontoh:\n${usedPrefix + command} https://www.facebook.com/...`;
  
  try {
    m.reply('*Please wait..*');
    const url = args[0];
    const get = await fetch(`https://api.betabotz.eu.org/api/download/fbdown?url=${url}&apikey=${lann}`);
    var js = await get.json();

    const videoUrl = js.result?.find(r => !r.shouldRender)?._url;

if (!videoUrl) throw new Error('URL video tidak ditemukan di response API');

conn.sendFile(m.chat, videoUrl, 'fb.mp4', '', m);
  } catch (e) {
    console.log(e);
    if (m.sender) {
      conn.reply(m.chat, `_*Terjadi kesalahan!*_\n${e.message}`, m);
    }
  }
};
handler.help = ['facebook'];
handler.command = /^(fb|facebook|facebookdl|fbdl|fbdown|dlfb)$/i;
handler.tags = ['downloader'];
handler.limit = true;
handler.group = true;
handler.premium = false;
handler.owner = false;
handler.admin = false;
handler.botAdmin = false;
handler.fail = null;
handler.private = false;
module.exports = handler;
