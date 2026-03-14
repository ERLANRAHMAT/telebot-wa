let fetch = require('node-fetch')

let handler = async (m, { conn, command }) => {
    let api = `https://api.betabotz.eu.org/api/cecan/${command}?apikey=${lann}`
    let buffer = await fetch(api).then(res => res.buffer())
    conn.sendFile(m.chat, buffer, 'hasil.jpg', `Random ${command}`, m)
}

handler.command = ['china','vietnam','thailand','indonesia','korea','japan','malaysia','justinaxie','jeni','jiso','ryujin','rose','hijaber']
handler.tags = ['downloader'];
handler.limit = true;
module.exports = handler;
