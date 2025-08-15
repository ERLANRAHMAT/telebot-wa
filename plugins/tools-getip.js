const fetch = require('node-fetch');

let handler = async (m, { conn }) => {
  let ip = await fetch(`https://api.betabotz.eu.org/ip`).then(response => response.text());
  let message = `your ip: ${ip}`
m.reply(message)
};

handler.help = ['getip']
handler.tags = ['owner']
handler.command = /^(getip)$/i;
handler.owner = true;
module.exports = handler;