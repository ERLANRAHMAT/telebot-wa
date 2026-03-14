const DEFAULT_MENU_IMAGE =
  "https://lann.pw/get-upload?id=uploader-api-1:1752838394888.jpg";
const uploadImage = require("../lib/uploadImage");

let handler = async (m, { conn, args, usedPrefix, command }) => {
  if (!global.ownerid?.includes(String(m.sender))) {
    return m.reply("⛔ Hanya owner yang bisa ganti gambar menu.");
  }

  const sub = args[0]?.toLowerCase();

  switch (sub) {
    case "menu": {
      const replied = m.quoted || m.quotedMsg;

      if (!replied?.mimetype?.startsWith("image/") && !args[1]) {
        return conn.telegram.sendMessage(
          m.chat,
          `Cara pakai:\n• Reply foto + \`${usedPrefix}${command} menu\`\n• \`${usedPrefix}${command} menu <url>\``,
          { parse_mode: "Markdown", reply_to_message_id: m.id },
        );
      }

      let newUrl;

      if (replied?.mimetype?.startsWith("image/")) {
        try {
          const buffer = await replied.download();
          newUrl = await uploadImage(buffer);
        } catch (e) {
          return conn.telegram.sendMessage(
            m.chat,
            `❌ Gagal upload gambar: ${e.message}`,
            {
              reply_to_message_id: m.id,
            },
          );
        }
      } else {
        if (!/^https?:\/\/.+/i.test(args[1])) {
          return conn.telegram.sendMessage(m.chat, "❌ URL tidak valid.", {
            reply_to_message_id: m.id,
          });
        }
        newUrl = args[1];
      }

      if (!newUrl || typeof newUrl !== "string") {
        return conn.telegram.sendMessage(
          m.chat,
          "❌ Gagal mendapatkan URL gambar.",
          {
            reply_to_message_id: m.id,
          },
        );
      }

      global.db.data.settings = global.db.data.settings || {};
      global.db.data.settings.menuImage = newUrl;

      return conn.telegram.sendMessage(
        m.chat,
        `✅ Gambar menu berhasil diubah!`,
        {
          reply_to_message_id: m.id,
        },
      );
    }

    case "reset": {
      global.db.data.settings = global.db.data.settings || {};
      delete global.db.data.settings.menuImage;
      return conn.telegram.sendMessage(
        m.chat,
        `✅ Gambar menu direset ke default.`,
        {
          reply_to_message_id: m.id,
        },
      );
    }

    default: {
      const current =
        global.db?.data?.settings?.menuImage || DEFAULT_MENU_IMAGE;
      return conn.telegram.sendMessage(
        m.chat,
        `🖼️ *Set Image*\n\n` +
          `• \`${usedPrefix}${command} menu\` — ganti gambar menu (reply foto atau tambah URL)\n` +
          `• \`${usedPrefix}${command} reset\` — reset ke gambar default\n\n` +
          `Gambar menu saat ini:\n${current}`,
        { parse_mode: "Markdown", reply_to_message_id: m.id },
      );
    }
  }
};

handler.help = ["setimage <menu|reset>"];
handler.tags = ["owner"];
handler.command = /^setimage$/i;
handler.owner = true;

module.exports = handler;
