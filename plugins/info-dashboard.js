const handler = async (m, { conn }) => {
  let stats = Object.entries(global.db.data.stats).map(([key, val]) => {
    const name = Array.isArray(global.plugins[key]?.help)
      ? global.plugins[key]?.help?.join(', ')
      : global.plugins[key]?.help || key;
    if (/exec/.test(name)) return null;
    return { name, ...val };
  }).filter(Boolean);

  stats = stats.sort((a, b) => b.total - a.total);

  const lines = stats.slice(0, 50).map(({ name, total, last, success, lastSuccess }, i) => {
    return `*${i + 1}.* *${name}*\n   • *Hits* : ${total}\n   • *Success* : ${success}\n   • *Last Used* : ${getTime(last)}\n   • *Last Success* : ${formatTime(lastSuccess)}`;
  });

  // Split jadi chunks max 4000 karakter per pesan
  const chunks = [];
  let current = '';
  for (const line of lines) {
    if ((current + '\n\n' + line).length > 4000) {
      chunks.push(current.trim());
      current = line;
    } else {
      current += (current ? '\n\n' : '') + line;
    }
  }
  if (current) chunks.push(current.trim());

  for (let i = 0; i < chunks.length; i++) {
    const header = i === 0 ? `📊 *Dashboard Plugin*\n\n` : '';
    await conn.sendMessage(m.chat, { text: header + chunks[i] }, {
      parse_mode: 'Markdown',
      reply_to_message_id: m.id
    });
    await new Promise(res => setTimeout(res, 500));
  }
};

handler.command = handler.help = ['dashboard', 'totalhits'];
handler.tags = ['info'];

module.exports = handler;

function formatTime(time) {
  if (!time) return 'Never';
  const date = new Date(time);
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function getTime(ms) {
  if (!ms) return 'Never';
  const now = parseMs(+new Date() - ms);
  if (now.days) return `${now.days} days ago`;
  else if (now.hours) return `${now.hours} hours ago`;
  else if (now.minutes) return `${now.minutes} minutes ago`;
  else return `a few seconds ago`;
}

function parseMs(ms) {
  return {
    days: Math.trunc(ms / 86400000),
    hours: Math.trunc(ms / 3600000) % 24,
    minutes: Math.trunc(ms / 60000) % 60,
    seconds: Math.trunc(ms / 1000) % 60
  };
}