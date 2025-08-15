let handler = async (m, { conn }) => {
  let id = m.sender;
  let name = m.pushName || 'Unknown';
  let message = `Your ID: ${id}\nYour Name: ${name}`;
  m.reply(message);
}
handler.help = handler.command = ['getid', 'myid'];
handler.tags = ['inownerfo'];
module.exports = handler;