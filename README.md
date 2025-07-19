# Telegram Bot with Telegraf

A powerful Telegram bot built with Telegraf framework featuring modular plugin system and database management.

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

## 🔑 API Configuration

### Available Plans & Pricing

| Plan     | Daily Limit | Duration | Price (IDR) |
|----------|------------|----------|-------------|
| Free     | 30         | Forever  | Free        |
| Basic    | 3000       | 1 Month  | 3,000      |
| Premium  | 5000       | 1 Month  | 5,000      |
| VIP      | 8000       | 2 Months | 8,000      |
| SUPREME  | 20000      | 4 Months | 20,000     |

### Getting API Key

1. Register at [BetaBotz API](https://api.betabotz.eu.org)
2. Choose your plan and click "Buy Now"
3. After payment, you'll receive your API key
4. Configure your API key in `config.js`:

```javascript
global.APIs = {   
  lann: 'https://api.betabotz.eu.org',
}
global.APIKeys = { 
  'https://api.betabotz.eu.org': 'YOUR_API_KEY_HERE'
}
```

### Whitelist Your Bot IP

1. Start your bot
2. Use command `/getip` to get your bot's IP
3. Go to [API Profile](https://api.betabotz.eu.org/profile)
4. Navigate to: Settings -> Management IP
5. Add your bot's IP to whitelist

### Node.js Requirements

This bot requires Node.js v20 or higher. Recommended hosting options:
- VPS with Node.js 20+
- Managed Node.js hosting
- Heroku with Node.js 20+ buildpack

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
  - conn.sendPhoto() - Send photo
  - conn.sendDocument() - Send file

## 📋 Features

### Database System
- Uses JSON file-based database
- Stores user data and chat settings
- Auto-saves changes
- Limit system for commands

### User Levels
- Normal users
- Premium users
- Admin users
- Owner access

### Command Limits
- Default: 30 commands per day
- Premium: Unlimited
- Auto reset daily

## 🛠️ Configuration

Edit `config.js` to customize:
- Bot name
- Owner details
- Command prefix
- API keys
- Message templates
- Limit settings

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
