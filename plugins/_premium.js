let handler = m => m;

handler.before = async function (m) {
  if (!m.sender) return;
  
  let user = db.data.users[m.sender];
  
  if (!user) {
    db.data.users[m.sender] = {
      premium: false,
      premiumTime: 0
    };
    return;
  }
  
  if (user.premiumTime > 0 && new Date() - user.premiumTime > 0) {
    user.premiumTime = 0;
    user.premium = false;
    
    try {
      await conn.sendMessage(m.chat, { 
        text: '⚠️ *Premium Anda telah berakhir!*\n\nHubungi owner untuk perpanjang premium.' 
      });
    } catch (e) {
      console.log('Failed to send premium expiry notification:', e.message);
    }
  }
};

module.exports = handler;