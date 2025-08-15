"use strict";
const yts = require("yt-search");
const axios = require("axios");

let handler = async (m, { conn, text, usedPrefix, command }) => {
  if (!text) throw `Masukkan judul/link YouTube!\n\nContoh:\n${usedPrefix + command} taylor swift love story`;
  await conn.reply(m.chat, "Tunggu sebentar...", m);

  try {
    const look = await yts(text);
    const vid = look.videos?.[0];
    if (!vid) throw new Error("Video/Audio tidak ditemukan");
    if (vid.seconds >= 3600) {
      return conn.reply(m.chat, "Video lebih dari 1 jam!", m,);
    }
    const { data } = await axios.get(
      `https://api.betabotz.eu.org/api/download/yt?url=${encodeURIComponent(vid.url)}&apikey=${lann}`
    );
    if (!data || !data.result || !data.result.mp3) {
      throw new Error("Gagal mendapatkan link audio");
    }
    const audioUrl = data.result.mp3;
    const caption =
      `∘ Title : ${vid.title}\n` +
      `∘ ID : ${vid.videoId}\n` +
      `∘ Duration : ${vid.timestamp}\n` +
      `∘ Viewers : ${vid.views}\n` +
      `∘ Upload At : ${vid.ago}\n` +
      `∘ Author : ${vid.author?.name}\n` +
      `∘ Channel : ${vid.author?.url}\n` +
      `∘ Url : ${vid.url}`;

    await conn.sendMessage(
      m.chat,
      { image: { url: vid.image }, caption },
      {
        quoted: { message_id: m.id },
      }
    );
    await conn.sendMessage(m.chat, { audio: { url: audioUrl }, mimetype: 'audio/mpeg' }, { quoted: m });
        
  } catch (e) {
    console.error(e);
    return conn.reply(m.chat, `*Error:* ${e.message || e}`, m, { parse_mode: false });
  }
};

handler.command = handler.help = ["play", "ds", "song"];
handler.tags = ["downloader"];
handler.limit = true;
handler.premium = false;

module.exports = handler;
