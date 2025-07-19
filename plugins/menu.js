const fs = require("fs");
const path = require("path");

let loadedCategories = {};
let totalLoadedCommands = 0;

const loadBotPlugins = () => {
  const pluginDir = path.join(__dirname);
  const plugins = [];
  const categories = {};
  let totalCommands = 0;

  fs.readdirSync(pluginDir).forEach((file) => {
    if (file.endsWith(".js") && file !== "menu.js") {
      try {
        delete require.cache[require.resolve(path.join(pluginDir, file))];
        const plugin = require(path.join(pluginDir, file));
        if (plugin.help && plugin.tags) plugins.push(plugin);
      } catch (e) {
        console.error(`Error loading ${file}:`, e);
      }
    }
  });

  plugins.forEach((plugin) => {
    if (plugin.tags && plugin.help) {
      plugin.tags.forEach((tag) => {
        if (!categories[tag]) categories[tag] = [];
        plugin.help.forEach((help) => {
          if (!categories[tag].includes(help)) {
            categories[tag].push(help);
            totalCommands++;
          }
        });
      });
    }
  });

  loadedCategories = categories;
  totalLoadedCommands = totalCommands;
};

loadBotPlugins();

const categoryNames = {
  main: "🎯 MAIN",
  tools: "⚙️ TOOLS",
  downloader: "💫 DOWNLOADER",
  fun: "🎪 FUN",
  group: "👾 GROUP",
  owner: "👤 OWNER",
  admin: "🛡️ ADMIN",
  premium: "⭐ PREMIUM",
  info: "🎐 INFO",
  advanced: "⚡ ADVANCED",
};

const menuTemplate = {
  header: '╭─『 %category 』',
  body: '│ ⌬ %cmd %islimit %ispremium',
  footer: '╰────────࿐\n',
};

const handler = async (m, { conn, args }) => {
  const user = global.db.data.users[m.sender];
  const isOwner = global.ownerid.includes(m.sender.toString());
  const isPrems = global.premid.includes(m.sender.toString()) || user.premium || user.premiumTime > 0;

  let d = new Date();
  let locale = 'id';
  let date = d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  let time = d.toLocaleTimeString(locale, { hour: 'numeric', minute: 'numeric' });
  let uptime = clockString(process.uptime() * 1000);

  const menuImage = "https://lann.pw/get-upload?id=uploader-api-1:1752838394888.jpg";

  if (args[0]) {
    const categoryArg = args[0].toLowerCase();
    const foundCategory = Object.keys(loadedCategories).find(cat => cat.toLowerCase() === categoryArg);

    if (foundCategory) {
      const categoryDisplayName = categoryNames[foundCategory] || foundCategory.toUpperCase();
      let categoryMenuText = menuTemplate.header.replace(/%category/g, categoryDisplayName) + '\n';

      loadedCategories[foundCategory].forEach(cmd => {
        categoryMenuText += menuTemplate.body
          .replace(/%cmd/g, cmd)
          .replace(/%islimit/g, '')
          .replace(/%ispremium/g, '') + '\n';
      });

      categoryMenuText += menuTemplate.footer;
      categoryMenuText += '\n*Note:* Kembali ke menu utama dengan */menu*';

      return conn.sendMessage(m.chat, {
        image: { url: menuImage },
        caption: categoryMenuText,
        parse_mode: 'Markdown'
          }, { quoted: { message_id: m.id } })
    } else {
      return conn.sendMessage(m.chat, {
        text: `Kategori *"${args[0]}"* tidak ditemukan.\n\nKetik */menu* untuk melihat daftar kategori yang tersedia.`,
        parse_mode: 'Markdown'
          }, { quoted: { message_id: m.id } })
    }
  }

  let mainMenuText = `*${global.botname}*\n\nHi %name!\nI'm a Telegram Bot that can help you with various tasks.\n\n◦ *Uptime:* %uptime\n◦ *Date:* %date\n◦ *Time:* %time WIB\n\n`;

  mainMenuText = mainMenuText
    .replace(/%name/g, m.name)
    .replace(/%uptime/g, uptime)
    .replace(/%date/g, date)
    .replace(/%time/g, time);

  mainMenuText += '╭─『 *Kategori Perintah* 』\n';

  const arrayMenu = Object.keys(categoryNames);

  Object.keys(loadedCategories)
    .sort((a, b) => {
      const indexA = arrayMenu.indexOf(a);
      const indexB = arrayMenu.indexOf(b);
      if (indexA === -1 || indexB === -1) return 0;
      return indexA - indexB;
    })
    .forEach(category => {
      const categoryDisplayName = categoryNames[category] || category.toUpperCase();
      mainMenuText += `│ ⌬ ${categoryDisplayName}\n`;
    });

  mainMenuText += '╰─────────────࿐\n\n';
  mainMenuText += '┌───『 *Statistics* 』───࿐\n';
  mainMenuText += `│ • Users: ${Object.keys(global.db.data.users).length}\n`;
  mainMenuText += `│ • Commands: ${totalLoadedCommands}\n`;
  mainMenuText += '└────────────࿐\n\n';
  mainMenuText += '*Note:* Ketik */menu <kategori>* untuk detail perintah.\nContoh: */menu downloader*';

  await conn.sendMessage(m.chat, {
    image: { url: menuImage },
    caption: mainMenuText,
    parse_mode: 'Markdown'
      }, { quoted: { message_id: m.id } })
};

handler.help = ["menu", "help"];
handler.tags = ["main"];
handler.command = /^(menu|help|\?)$/i;

function clockString(ms) {
  let h = Math.floor(ms / 3600000);
  let m = Math.floor(ms / 60000) % 60;
  let s = Math.floor(ms / 1000) % 60;
  return [h, m, s].map(v => v.toString().padStart(2, 0)).join(':');
}

module.exports = handler;