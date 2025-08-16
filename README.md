# Betabotz Telegram Bot v2 
Telegram bot yang dibuat menggunakan library telegraf dengan system plugins mirip seperti botwa berbasis CJS 

## 🚀 Getting Started

### Prerequisites
- Node.js V20 or higher
- NPM or Yarn
- Basic knowledge of JavaScript

### Installation
1. Clone this repository
```bash
git clone https://github.com/ERLANRAHMAT/telebot-wa.git
cd telebot-wa
```

2. Install dependencies
```bash
npm install
```

3. Configure bot token
- Get your bot token from [@BotFather](https://t.me/BotFather)
  1. Start chat with BotFather
  2. Send `/newbot`
  3. Follow instructions to create bot
  4. Copy the token provided
- Edit `config.js` and paste your token:
```javascript
global.token = "YOUR_BOT_TOKEN"
```
4. Start the bot
```bash
npm start
```

5. Configuration Owner
- Get your id and username owner from command `/getid`
- Copy your id and username , and then paste your id & username:
```javascript
global.ownerid = ["your id"]
global.premid = ["your id"]
global.ownername = ["your username"]
global.owner = ["your phone number"]
```

## 🔑 API Configuration

### Apikey Available Plans & Pricing

| Plan     | Limit | Duration | Price (IDR) |
|----------|------------|----------|-------------|
| Free     | 30         | Forever  | Free        |
| Cheap1   | 3000       | 1 Month  | 3,000      |
| Cheap2   | 4000       | 1 Month  | 4,000      |
| Premium  | 5000       | 1 Month  | 5,000      |
| Vip      | 8000       | 2 Months | 8,000      |
| Vvip      | 12000    | 3 Months  | 12,000     |
| Supreme  | 20000      | 4 Months | 20,000     |

### Getting API Key
`Full Plans: https://api.betabotz.eu.org/price#apikey`

1. Register at [BetaBotz API](https://api.betabotz.eu.org)
2. Choose your plan and click "Buy Now"
3. After payment, you'll receive your API key
4. Configure your API key in `config.js`:

```javascript
global.APIs = {   
  lann: 'https://api.betabotz.eu.org',
}
global.lann = 'your apikey'
```

### AksesKey Available Plans & Pricing

| Plan     |  Limit | Duration | Price (IDR) |
|----------|------------|----------|-------------|
| Basic V1    | 5000       | 1 Month  | 5,000      |
| Premium V2  | 10000       | 2 Month  | 10,000      |
| Starter V1  | 15000       | 1 Months | 15,000      |
| Starter V2  | 30000      | 2 Months | 30,000     |

### Getting AksesKey
`Full Plans: https://api.betabotz.eu.org/price#akses`

1. Register at [BetaBotz API](https://api.betabotz.eu.org)
2. Choose your plan and click "Buy Now"
3. After payment, you'll receive your AksesKey
4. Configure your API key in `config.js`:

```javascript
global.aksesKey = 'your aksesKey'
```

### Whitelist Your Bot IP

1. Start your bot
2. Use command `/getip` to get your bot's IP
3. Go to [API Profile](https://api.betabotz.eu.org/profile)
4. Navigate to: Settings -> Management IP
5. Add your bot's IP to whitelist

### Node.js Requirements

This bot requires **Node.js v20 or higher**. Recommended hosting options:

- VPS with Node.js 20+
- Panel with Node.js 20+
- Managed Node.js hosting
- Heroku with Node.js 20+ buildpack

If you need reliable hosting, you can purchase it at [Click Here](https://api.betabotz.eu.org/price#panel)

### Additional Information

- API Documentation: [api.betabotz.eu.org/docs](https://api.betabotz.eu.org/docs)
- Support Group: [Join Group](https://chat.whatsapp.com/H8XPKS8vmHm2spliGlKY41)
- Updates Channel: [Join Channel](https://whatsapp.com/channel/0029VaiIG3UJpe8n3Y2MZ51z)

## 📚 Plugin System

### Plugin Structure
Plugins are located in `plugins/` directory. Each plugin should follow this structure:

```javascript
const handler = async (m, { conn }) => {
  // Plugin code here
}

handler.help = ['commandname']
handler.tags = ['category']
handler.command = /^(commandname)$/i

module.exports = handler
```

### Available Categories
- 🎯 Main - Basic commands
- ⚙️ Tools - Utility tools
- 💫 Downloader - Media downloaders
- 🎪 Fun - Fun commands
- 👾 Group - Group management
- 👤 Owner - Owner only commands
- 🛡️ Admin - Admin commands
- ⭐ Premium - Premium user commands
- 🎐 Info - Information commands
- ⚡ Advanced - Advanced features

### Creating a Plugin
1. Create new .js file in plugins/
2. Follow basic structure
3. Define:
   - handler function
   - help array
   - tags array
   - command regex

Example plugin:
```javascript
const handler = async (m, { conn }) => {
  await m.reply('Hello World!')
}

handler.help = ['hello']
handler.tags = ['main']
handler.command = /^(hello|hi)$/i

module.exports = handler
```

### Handler Parameters
- `m` - Message context
  - m.chat - Chat ID
  - m.sender - Sender ID
  - m.reply() - Reply to message
  - m.quoted - Quoted message

- `conn` - Bot connection object
  - conn.sendMessage() - Send message
  - conn.sendFile() - Send file 
  - conn.sendPhoto() - Send photo
  - conn.sendDocument() - Send file

## 🙏 Special Thanks
With this, I would like to express my gratitude to:

- **Erlan (Betabotz)**
- **Dreamliner21 (Paull)**
- **Danaputra**
- **Botcahx (Tio)**
- And everyone who has contributed to the development of this bot.

Thank you so much for your support and contributions! 🚀

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details

## 🤝 Contributing

1. Fork the repo
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create pull request

## ⚠️ Important Notes

- Keep your bot token secret
- Don't share config.js with tokens
- Regular backups recommended
- Check Telegram bot API limits
