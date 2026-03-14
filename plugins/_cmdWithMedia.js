// _stickercmd.js
const handler = m => m;

handler.before = async function(m) {
  try {
    if (m.fromMe) return true;

    // Cek apakah pesan ini adalah stiker
    const isSticker = m.mimetype === 'image/webp' || 
                      m.mimetype === 'image/webm' ||
                      m.mediaType === 'image/webp' ||
                      m.mediaType === 'image/webm';

    if (!isSticker) return true;

    const sticker = global.db.data.sticker || {};

    // Gunakan file_id stiker sebagai hash
    const fileId = m.msgs?.sticker?.file_id || m.msgs?.sticker?.file_unique_id;
    if (!fileId) return true;

    console.log('[STICKERCMD] sticker file_id:', fileId);

    if (!(fileId in sticker)) return true;

    const { text } = sticker[fileId];
    if (!text) return true;

    // Parse command
    const prefixes = Array.isArray(global.prefix) ? global.prefix : [global.prefix || '/'];
    let usedPrefix = '';
    let commandText = text.trim();

    for (const p of prefixes) {
      const ps = String(p);
      if (commandText.startsWith(ps)) {
        usedPrefix = ps;
        commandText = commandText.slice(ps.length);
        break;
      }
    }

    const [command, ...args] = commandText.trim().split(' ');
    const cmdLower = command.toLowerCase();
    const textArgs = args.join(' ');

    console.log(`[STICKERCMD] Executing: ${usedPrefix}${cmdLower} ${textArgs}`);

    for (const name in global.plugins) {
      const plugin = global.plugins[name];
      if (!plugin || plugin.disabled) continue;

      let pluginHandler = null;
      let pluginData = plugin;

      if (typeof plugin === 'function') {
        pluginHandler = plugin;
      } else if (typeof plugin === 'object') {
        if (plugin.handler && typeof plugin.handler === 'function') {
          pluginHandler = plugin.handler;
          pluginData = plugin;
        } else if (plugin.default && typeof plugin.default === 'function') {
          pluginHandler = plugin.default;
          pluginData = plugin.default;
        }
      }

      if (!pluginHandler) continue;

      const commandList = pluginData.command || pluginData.usage;
      if (!commandList) continue;

      let isAccept = false;
      if (commandList instanceof RegExp) {
        isAccept = commandList.test(cmdLower);
      } else if (Array.isArray(commandList)) {
        isAccept = commandList.some(c =>
          c instanceof RegExp ? c.test(cmdLower) : c === cmdLower
        );
      } else if (typeof commandList === 'string') {
        isAccept = commandList === cmdLower;
      }

      if (!isAccept) continue;

      const fakeM = Object.assign({}, m, {
        text: textArgs,
        args,
        prefix: usedPrefix,
        command: cmdLower,
        isCommand: true,
      });

      const extra = {
        conn: this,
        client: this,
        usedPrefix,
        command: cmdLower,
        args,
        text: textArgs,
        noPrefix: commandText,
        _args: args,
        isOwner: false,
        isPrems: global.db.data.users?.[m.sender]?.premium || false,
        isAdmin: m.isAdmin || false,
        isBotAdmin: m.isBotAdmin || false,
        isGroup: m.isGroup || false,
        participants: m.participants || [],
        chatId: m.chat,
        userId: m.sender,
        Func: global.Func || {},
        match: [[cmdLower], new RegExp(cmdLower)],
      };

      try {
        await pluginHandler.call(this, fakeM, extra);
        console.log(`[STICKERCMD] Executed: ${usedPrefix}${cmdLower}`);
      } catch (e) {
        if (e && typeof e === 'string') {
          await this.sendMessage(m.chat, { text: e }, {
            parse_mode: 'Markdown',
            reply_to_message_id: m.id
          });
        } else {
          console.error(`[STICKERCMD] Error:`, e?.message || e);
        }
      }

      break;
    }

  } catch (e) {
    console.error('[STICKERCMD]', e.message);
  }

  return true;
};

module.exports = handler;