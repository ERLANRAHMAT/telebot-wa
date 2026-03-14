let handler = m => m
let linkRegex = /t\.me\/[\w]+|telegram\.me\/[\w]+|https?:\/\/t\.me\/[\w]+|https?:\/\/telegram\.me\/[\w]+/i

handler.before = async function (m, { isAdmin, isBotAdmin, conn }) {
  if (!m.isGroup) return;
  if (m.fromMe || m.isBot || m.sender === conn.user?.id) return;

  let botIsAdmin = isBotAdmin;
  
  if (botIsAdmin === undefined) {
    try {
      let botId = conn.botInfo?.id;
      
      if (!botId) {
        const botInfo = await conn.getMe();
        botId = botInfo.id;
      }
      
      if (!botId) {
        throw new Error('Cannot get bot ID');
      }
      
      const botMember = await conn.getChatMember(m.chat, botId);
      botIsAdmin = ['creator', 'administrator'].includes(botMember.status);
    } catch (err) {
      botIsAdmin = false;
    }
  }

  if (!botIsAdmin) return;

  let chat = global.db.data.chats[m.chat];

  if (!chat) {
    global.db.data.chats[m.chat] = {
      antiLink: false
    };
    chat = global.db.data.chats[m.chat];
  }

  const antiLinkStatus = chat.antiLink || false;

  if (!antiLinkStatus) return;

  const text = m.text ? m.text : "";
  const isGroupLink = linkRegex.test(text);

  if (isGroupLink) {
    let userIsAdmin = isAdmin;
    
    if (userIsAdmin === undefined) {
      try {
        const userMember = await conn.getChatMember(m.chat, m.sender);
        userIsAdmin = ['creator', 'administrator'].includes(userMember.status);
      } catch (err) {
        userIsAdmin = false;
      }
    }

    let username = '';
    const userId = m.sender;
    
    try {
      const userInfo = await conn.getChatMember(m.chat, userId);
      username = userInfo.user.username 
        ? `@${userInfo.user.username}` 
        : userInfo.user.first_name || 'User';
    } catch (e) {
      username = 'User';
    }

    const messageId = m.message_id || m.id;

    if (userIsAdmin) {
      await conn.sendMessage(m.chat, { 
        text: `*「 ANTI LINK 」*\n\nDetected *${username}* you have sent a group link!\n\nBut you're an admin, so you won't be kicked. hehe..`,
        parse_mode: 'Markdown',
        reply_to_message_id: messageId
      });
      return;
    }

    try {
      let currentChatLink = '';
      try {
        const inviteLink = await conn.exportChatInviteLink(m.chat);
        currentChatLink = inviteLink;
      } catch (e) {
        currentChatLink = '';
      }

      const isOwnGroupLink = currentChatLink && text.includes(currentChatLink);

      if (isOwnGroupLink) {
        await conn.sendMessage(m.chat, { 
          text: `*「 ANTI LINK 」*\n\nAction denied, bot will not kick you.\nBecause it's this group's own link.`,
          parse_mode: 'Markdown',
          reply_to_message_id: messageId
        });
        return;
      }

      await conn.sendMessage(m.chat, { 
        text: `*「 ANTI LINK 」*\n\nDetected *${username}* you have sent a group link!\n\nSorry, you will be kicked from this group. Bye!`,
        parse_mode: 'Markdown',
        reply_to_message_id: messageId
      });

      await conn.deleteMessage(m.chat, messageId);
      await conn.banChatMember(m.chat, userId);

    } catch (err) {
      await conn.sendMessage(m.chat, { 
        text: `🚨 Failed to kick user!\n\nError: ${err.message}\n\nMake sure bot has "Ban Users" permission.`
      });
    }
  }
  
  return true;
}

module.exports = handler