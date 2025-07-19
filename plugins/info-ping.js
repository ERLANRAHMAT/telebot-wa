const { totalmem, freemem } = require('os');
const os = require('os');
const util = require('util');
const osu = require('node-os-utils');
const { performance } = require('perf_hooks');
const { sizeFormatter } = require('human-readable');

const format = sizeFormatter({
  std: 'JEDEC',
  decimalPlaces: 2,
  keepTrailingZeroes: false,
  render: (literal, symbol) => `${literal} ${symbol}B`,
});

const handler = async (m, { conn }) => {
  const used = process.memoryUsage();
  const cpus = os.cpus().map(cpu => {
    cpu.total = Object.values(cpu.times).reduce((acc, t) => acc + t, 0);
    return cpu;
  });

  const cpu = cpus.reduce(
    (acc, cpu, _, { length }) => {
      acc.total += cpu.total;
      acc.speed += cpu.speed / length;
      Object.keys(cpu.times).forEach(type => acc.times[type] += cpu.times[type]);
      return acc;
    },
    {
      speed: 0,
      total: 0,
      times: {
        user: 0,
        nice: 0,
        sys: 0,
        idle: 0,
        irq: 0,
      },
    }
  );

  let _muptime;
  if (process.send) {
    process.send('uptime');
    _muptime = await new Promise(resolve => {
      process.once('message', resolve);
      setTimeout(() => resolve(null), 1000);
    });
  }
  const muptime = clockString(_muptime);

  const old = performance.now();
  const neww = performance.now();
  const speed = neww - old;

  const cpux = osu.cpu;
  const cpuCore = cpux.count();
  const drive = osu.drive;
  const mem = osu.mem;
  const netstat = osu.netstat;
  const HostN = osu.os.hostname();
  const OS = osu.os.platform();
  const cpuModel = cpux.model();

  const d = new Date(Date.now() + 3600000); // +1 jam
  const locale = 'id';
  const weeks = d.toLocaleDateString(locale, { weekday: 'long' });
  const dates = d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const times = d.toLocaleTimeString(locale, { hour: 'numeric', minute: 'numeric', second: 'numeric' });

  await m.reply('_Testing speed..._');

  const txt = `
ᴘ ɪ ɴ ɢ
${Math.round(neww - old)} ms
${speed.toFixed(2)} ms

ʀ ᴜ ɴ ᴛ ɪ ᴍ ᴇ 
${muptime}

s ᴇ ʀ ᴠ ᴇ ʀ
🛑 ʀᴀᴍ: ${format(totalmem() - freemem())} / ${format(totalmem())}
🔵 ғʀᴇᴇRAM: ${format(freemem())}
🔴 ᴍᴇᴍᴏʀy: ${(used.heapUsed / 1024 / 1024).toFixed(2)} MB / ${Math.round(totalmem() / 1024 / 1024)} MB
🔭 ᴘʟᴀᴛғᴏʀᴍ: ${os.platform()}
🧿 sᴇʀᴠᴇʀ: ${os.hostname()}
💻 ᴏs: ${OS}
⏰ ᴛɪᴍᴇ sᴇʀᴠᴇʀ: ${times}

_NodeJS Memory Usage_
\`\`\`
${Object.keys(used)
  .map(key => `${key.padEnd(15)}: ${format(used[key])}`)
  .join('\n')}
\`\`\`

${cpus[0] ? `_Total CPU Usage_
${cpus[0].model.trim()} (${cpu.speed.toFixed(2)} MHz)
${Object.keys(cpu.times)
  .map(type => `- ${type.padEnd(6)}: ${(100 * cpu.times[type] / cpu.total).toFixed(2)}%`)
  .join('\n')}

_CPU Core(s) Usage (${cpus.length} Core CPU)_
${cpus.map((cpu, i) => 
  `${i + 1}. ${cpu.model.trim()} (${cpu.speed} MHz)
${Object.keys(cpu.times)
  .map(type => `- ${type.padEnd(6)}: ${(100 * cpu.times[type] / cpu.total).toFixed(2)}%`)
  .join('\n')}`).join('\n\n')}
` : ""}
  `.trim();

  m.reply(txt);
};

handler.help = ['ping', 'speed'];
handler.tags = ['info'];
handler.command = /^(ping|speed|pong|ingfo)$/i;
module.exports = handler;

function clockString(ms) {
  const d = isNaN(ms) ? '--' : Math.floor(ms / 86400000);
  const h = isNaN(ms) ? '--' : Math.floor(ms / 3600000) % 24;
  const m = isNaN(ms) ? '--' : Math.floor(ms / 60000) % 60;
  const s = isNaN(ms) ? '--' : Math.floor(ms / 1000) % 60;
  return [d, 'D ', h, 'H ', m, 'M ', s, 'S ']
    .map(v => v.toString().padStart(2, 0)).join('');
}