const fs = require("fs")
const path = require("path")

const arrayMenu = [
    'main', 'tools', 'downloader', 'fun', 'group', 'owner', 
    'admin', 'premium', 'info', 'advanced'
]

const defaultMenu = {
    before: `*${global.botname}*\n\nHi %name!\nI'm a Telegram Bot that can help you with various tasks.\n\n◦ *Uptime:* %uptime\n◦ *Date:* %date\n◦ *Time:* %time WIB\n`,
    header: '╭─『 %category 』',
    body: '│ ⌬ %cmd %islimit %ispremium',
    footer: '╰────────࿐\n',
    after: '*Note:* Type /help <category> for specific menu\nExample: /help tools'
}

const handler = async (m, { conn }) => {
    const user = global.db.data.users[m.sender]
    const isOwner = global.ownerid.includes(m.sender.toString())
    const isPrems = global.premid.includes(m.sender.toString()) || user.premium || user.premiumTime > 0

    const loadPlugins = () => {
        const pluginDir = path.join(__dirname)
        const plugins = []

        fs.readdirSync(pluginDir).forEach((file) => {
            if (file.endsWith(".js") && file !== "menu.js") {
                try {
                    delete require.cache[require.resolve(path.join(pluginDir, file))]
                    const plugin = require(path.join(pluginDir, file))
                    if (plugin.help && plugin.tags) {
                        plugins.push(plugin)
                    }
                } catch (e) {
                    console.error(`Error loading ${file}:`, e)
                }
            }
        })

        return plugins
    }

    const plugins = loadPlugins()
    const categories = {}
    let totalCommands = 0 // Initialize totalCommands here

    plugins.forEach((plugin) => {
        if (plugin.tags && plugin.help) {
            plugin.tags.forEach((tag) => {
                if (!categories[tag]) {
                    categories[tag] = []
                }
                plugin.help.forEach((help) => {
                    categories[tag].push(help)
                    totalCommands++ // Increment for each command
                })
            })
        }
    })

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
    }

    let limitStatus = ""
    if (isOwner) {
        limitStatus = "♾️ Unlimited (Owner)"
    } else if (isPrems) {
        limitStatus = "♾️ Unlimited (Premium)"
    } else {
        limitStatus = `${user?.limit || 0} (User)`
    }

    let d = new Date()
    let locale = 'id'
    let date = d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
    let time = d.toLocaleTimeString(locale, { hour: 'numeric', minute: 'numeric' })
    let uptime = clockString(process.uptime() * 1000)

    let menuText = defaultMenu.before
        .replace(/%name/g, m.name)
        .replace(/%uptime/g, uptime)
        .replace(/%date/g, date)
        .replace(/%time/g, time)

    Object.keys(categories)
        .sort()
        .forEach(category => {
            const categoryName = categoryNames[category] || category
            menuText += defaultMenu.header.replace(/%category/g, categoryName) + '\n'
            categories[category].forEach(cmd => {
                menuText += defaultMenu.body
                    .replace(/%cmd/g, cmd)
                    .replace(/%islimit/g, '')
                    .replace(/%ispremium/g, '') + '\n'
            })
            menuText += defaultMenu.footer
        })

    menuText += `\n┌───『 *Statistics* 』───࿐\n`
    menuText += `│ • Users: ${Object.keys(global.db.data.users).length}\n`
    menuText += `│ • Commands: ${totalCommands}\n`
    menuText += `└────────────࿐\n\n`
    menuText += defaultMenu.after

    await conn.sendMessage(m.chat, {
        image: { url: "https://lann.pw/get-upload?id=uploader-api-1:1752838394888.jpg" },
        caption: menuText
    }, { quoted: { message_id: m.id } })
}

handler.help = ["menu", "help"]
handler.tags = ["main"]
handler.command = /^(menu|help|\?)$/i

function clockString(ms) {
    let h = Math.floor(ms / 3600000)
    let m = Math.floor(ms / 60000) % 60
    let s = Math.floor(ms / 1000) % 60
    return [h, m, s].map(v => v.toString().padStart(2, 0)).join(':')
}

module.exports = handler