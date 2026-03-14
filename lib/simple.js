const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { InputFile } = require("telegraf");

let print = null;
try {
  print = require("./print");
} catch {}

const { getMimeType } = require("./getMime");

const MAX_CAPTION_LENGTH = 1024; // Telegram caption limit
const MAX_TEXT_LENGTH = 4096;    // Telegram message text limit
const MAX_FILE_SIZE = 49 * 1024 * 1024;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const isUrl = (str) => {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
};

const isFilePath = (str) => {
  if (typeof str !== "string") return false;
  if (isUrl(str)) return false;
  return fs.existsSync(str);
};

const isBuffer = (input) => Buffer.isBuffer(input);

function sanitizeTgExtra(extra = {}) {
  const e = { ...extra };
  // buang field yang bukan Telegram API / bikin payload jadi error
  delete e.quoted;
  delete e.contextInfo;
  delete e.ephemeralExpiration;
  delete e.forwardingScore;
  delete e.is_forwarded;
  delete e.message;
  delete e.msg;
  delete e.key;
  delete e.sender;
  delete e.chat;
  delete e.from;
  delete e.replyTo;
  return e;
}

function resolveReplyTo(quoted) {
  if (!quoted) return undefined;
  return (
    quoted.message_id ||
    quoted.id ||
    quoted.msg_id ||
    quoted.messageId ||
    quoted?.key?.id ||
    undefined
  );
}

const downloadMedia = async (url) => {
  const response = await axios({
    method: "GET",
    url,
    responseType: "arraybuffer",
    timeout: 200000,
    headers: {
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": "1",
    },
    maxRedirects: 5,
  });
  return Buffer.from(response.data);
};

const processMediaInput = async (input) => {
  if (isBuffer(input)) return input;

  // url string
  if (typeof input === "string" && isUrl(input)) {
    return await downloadMedia(input);
  }

  // object with url
  if (input && typeof input === "object" && typeof input.url === "string" && isUrl(input.url)) {
    return await downloadMedia(input.url);
  }

  // filepath string
  if (typeof input === "string" && isFilePath(input)) {
    return fs.readFileSync(input);
  }

  // passthrough
  return input;
};

const downloadFromMessage = async (ctx) => {
  try {
    if (!ctx.reply_to_message) return null;
    const quoted = ctx.reply_to_message;

    const getFile = async () => {
      if (quoted.photo) {
        const fileId = quoted.photo[quoted.photo.length - 1].file_id;
        return await ctx.telegram.getFile(fileId);
      }
      if (quoted.video) return await ctx.telegram.getFile(quoted.video.file_id);
      if (quoted.audio) return await ctx.telegram.getFile(quoted.audio.file_id);
      if (quoted.document) return await ctx.telegram.getFile(quoted.document.file_id);
      if (quoted.sticker) return await ctx.telegram.getFile(quoted.sticker.file_id);
      return null;
    };

    const file = await getFile();
    if (!file) return null;

    const response = await axios({
      method: "GET",
      url: `https://api.telegram.org/file/bot${ctx.telegram.token}/${file.file_path}`,
      responseType: "arraybuffer",
    });

    return Buffer.from(response.data);
  } catch (e) {
    console.error("Download error:", e?.message || e);
    return null;
  }
};

function aliasId(r) {
  if (r && r.message_id != null && r.id == null) r.id = String(r.message_id);
  return r;
}

// ---- vCard helpers ----
const buildVCard = ({ first_name, last_name, phone_number, org, title }) => {
  const fn = [first_name, last_name].filter(Boolean).join(" ").trim() || "Contact";
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${fn}`,
    `N:${last_name || ""};${first_name || ""};;;`,
    org ? `ORG:${org}` : null,
    title ? `TITLE:${title}` : null,
    `TEL;TYPE=CELL:${phone_number}`,
    "END:VCARD",
  ].filter(Boolean);
  return lines.join("\n");
};

const normalizeContact = (c, defaults = {}) => {
  if (typeof c === "string" || typeof c === "number") {
    return {
      phone_number: String(c).trim(),
      first_name: defaults.first_name || "Contact",
      last_name: defaults.last_name || "",
      vcard: undefined,
    };
  }

  const phone = String(c.phone_number || c.phone || c.number || c.num || "").trim();

  return {
    phone_number: phone,
    first_name: (c.first_name || c.name || defaults.first_name || "Contact").toString(),
    last_name: (c.last_name || defaults.last_name || "").toString(),
    vcard: c.vcard,
  };
};

// ---- file type detection (buffer) ----
async function getFileType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return "document";

  // JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image";
  // PNG
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "image";
  // GIF
  if (buffer.slice(0, 3).toString() === "GIF") return "image";

  // MP4 (ftyp)
  if (
    buffer[0] === 0x00 &&
    buffer[1] === 0x00 &&
    buffer[2] === 0x00 &&
    (buffer[3] === 0x18 || buffer[3] === 0x20) &&
    buffer.slice(4, 8).toString() === "ftyp"
  ) {
    return "video";
  }

  // FLV
  if (buffer.slice(0, 3).toString() === "FLV") return "video";

  // WAV
  if (buffer.slice(0, 4).toString() === "RIFF" && buffer.slice(8, 12).toString() === "WAVE") return "audio";

  // MP3
  if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) return "audio";

  // WEBP sticker
  if (buffer.slice(0, 4).toString() === "RIFF" && buffer.slice(8, 12).toString() === "WEBP") return "sticker";

  return "document";
}

// ---- gzip fallback for big file (simple compress) ----
async function compressFile(buffer) {
  const zlib = require("zlib");
  const util = require("util");
  const compress = util.promisify(zlib.gzip);
  try {
    return await compress(buffer);
  } catch {
    return buffer;
  }
}

// ---- album upload helpers ----
function detectMediaType(urlOrPath) {
  if (!urlOrPath || typeof urlOrPath !== "string") return "photo";
  const s = urlOrPath.toLowerCase();
  if (s.match(/\.(mp4|avi|mov|wmv|flv|webm|mkv|m4v|3gp)(\?.*)?$/)) return "video";
  return "photo";
}

async function uploadToTelegram(conn, filePath, tempChatId = null) {
  try {
    if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
    const uploadChatId = tempChatId || conn.user?.id;

    const ext = filePath.split(".").pop().toLowerCase();
    const isVideo = ["mp4", "avi", "mov", "wmv", "flv", "webm", "mkv", "m4v", "3gp"].includes(ext);

    let result;
    if (isVideo) {
      result = await conn.telegram.sendVideo(uploadChatId, fs.createReadStream(filePath), {
        caption: "_temp_upload_",
      });
    } else {
      result = await conn.telegram.sendPhoto(uploadChatId, fs.createReadStream(filePath), {
        caption: "_temp_upload_",
      });
    }

    let fileUrl = null;
    if (isVideo && result.video) {
      fileUrl = await conn.telegram.getFileLink(result.video.file_id);
    } else if (!isVideo && result.photo && result.photo.length > 0) {
      const largest = result.photo.reduce((p, c) => (p.file_size > c.file_size ? p : c));
      fileUrl = await conn.telegram.getFileLink(largest.file_id);
    }

    try {
      await conn.telegram.deleteMessage(uploadChatId, result.message_id);
    } catch {}

    return fileUrl?.href || fileUrl;
  } catch (e) {
    console.error(`uploadToTelegram error:`, e?.message || e);
    return null;
  }
}

async function processMediaPath(conn, pathOrUrl, tempChatId = null) {
  if (!pathOrUrl || typeof pathOrUrl !== "string") return pathOrUrl;
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl;

  const uploadedUrl = await uploadToTelegram(conn, pathOrUrl, tempChatId);
  if (uploadedUrl) return uploadedUrl;
  return pathOrUrl;
}

module.exports = (conn) => {
  // init botInfo/user
  conn.telegram.getMe().then((bot) => {
    conn.botInfo = bot;
    conn.user = {
      jid: String(bot.id),
      id: String(bot.id),
      username: bot.username || "",
      first_name: bot.first_name || "",
      type: "bot",
    };
  });

  // group metadata
  conn.groupMetadata = async function (chatId) {
    const jid = chatId;
    const chat = await this.telegram.getChat(jid);

    let admins = [];
    try {
      admins = await this.telegram.getChatAdministrators(jid);
    } catch {
      admins = [];
    }

    let memberCount = null;
    try {
      // catatan: method telegraf biasanya getChatMembersCount (tanpa s)
      if (typeof this.telegram.getChatMembersCount === "function") {
        memberCount = await this.telegram.getChatMembersCount(jid);
      } else if (typeof this.telegram.getChatMemberCount === "function") {
        memberCount = await this.telegram.getChatMemberCount(jid);
      }
    } catch {
      memberCount = null;
    }

    const participants = admins.map((a) => ({
      id: a.user.id,
      username: a.user.username || null,
      first_name: a.user.first_name || null,
      last_name: a.user.last_name || null,
      admin: a.status === "administrator" || a.status === "creator" || "member",
      isCreator: a.status === "creator",
      status: a.status,
      can_manage_chat: a.can_manage_chat ?? undefined,
      can_delete_messages: a.can_delete_messages ?? undefined,
      can_manage_video_chats: a.can_manage_video_chats ?? undefined,
      can_restrict_members: a.can_restrict_members ?? undefined,
      can_promote_members: a.can_promote_members ?? undefined,
    }));

    return {
      id: chat.id,
      type: chat.type,
      subject: chat.title || chat.username || null,
      description: chat.description || null,
      is_forum: !!chat.is_forum,
      invite_link: chat.invite_link || null,
      photo: chat.photo ? { small: chat.photo.small_file_id, big: chat.photo.big_file_id } : null,
      size: memberCount,
      participants,
    };
  };

  // sendContact
  conn.sendContact = async (jid, contacts, caption, quoted, options = {}) => {
    try {
      if (typeof caption === "object" && caption && !quoted) {
        options = caption;
        caption = undefined;
        quoted = undefined;
      } else if (typeof quoted === "object" && quoted && !options) {
        options = quoted;
        quoted = undefined;
      }

      const list = Array.isArray(contacts) ? contacts : [contacts];
      if (!list.length) return null;

      const seen = new Set();
      const normalized = list
        .map((c) => normalizeContact(c, { first_name: options.default_name }))
        .filter((c) => c.phone_number && !seen.has(c.phone_number) && seen.add(c.phone_number));

      const replyId = resolveReplyTo(quoted);
      let captionMsg = null;

      if (caption) {
        captionMsg = await conn.telegram.sendMessage(jid, caption, {
          reply_to_message_id: replyId,
          allow_sending_without_reply: true,
          parse_mode: options.caption_parse_mode || options.parse_mode || undefined,
          disable_web_page_preview: true,
        });
      }

      const results = [];
      for (let i = 0; i < normalized.length; i++) {
        const c = normalized[i];
        const extra = sanitizeTgExtra({
          reply_to_message_id: captionMsg?.message_id ?? (i === 0 ? replyId : undefined),
          allow_sending_without_reply: true,
          ...options,
        });

        delete extra.caption_parse_mode;

        let vcard = c.vcard;
        if (!vcard && options.auto_vcard) {
          vcard = buildVCard({
            first_name: c.first_name,
            last_name: c.last_name,
            phone_number: c.phone_number,
            org: options.vcard_org,
            title: options.vcard_title,
          });
        }
        if (vcard) extra.vcard = vcard;
        if (c.last_name) extra.last_name = c.last_name;

        await delay(500);
        const res = await conn.telegram.sendContact(jid, c.phone_number, c.first_name, extra);
        results.push(res);
      }

      try {
        typeof print === "function" &&
          print({ content: { contacts: normalized }, chat: jid }, conn, true);
      } catch {}

      return results.length === 1 ? results[0] : results;
    } catch (err) {
      console.error("SendContact error:", err?.message || err);
      // fallback kirim caption saja kalau ada
      if (caption) {
        await conn.telegram.sendMessage(jid, caption, {
          reply_to_message_id: resolveReplyTo(quoted),
          allow_sending_without_reply: true,
        });
      }
      return null;
    }
  };

  // shorthand
  conn.sendPhoto = async (chatId, photo, options = {}) => {
    const opts = sanitizeTgExtra(options);
    return await conn.telegram.sendPhoto(chatId, photo, opts);
  };

  // sendMessage (unified)
  conn.sendMessage = async (jid, content, options = {}) => {
    try {
      if (!jid) throw new Error("Chat ID (jid) is required");
      if (!content || typeof content !== "object") throw new Error("Invalid content object");

      // DELETE
      if (content.delete) {
        try {
          let msgId;
          if (typeof content.delete === "object") {
            msgId =
              content.delete.message_id ||
              content.delete.id ||
              content.delete.key?.id ||
              content.delete.key?.message_id;
          } else {
            msgId = content.delete;
          }
          if (!msgId) throw new Error("Invalid delete target");

          await conn.telegram.deleteMessage(jid, msgId);
          return { deleted: true, id: String(msgId) };
        } catch (err) {
          console.error("DeleteMessage error:", err?.message || err);
          return null;
        }
      }

      // EDIT
      if (content.edit) {
        let msgId;
        if (typeof content.edit === "object") {
          msgId =
            content.edit.message_id ||
            content.edit.id ||
            content.edit.key?.id ||
            content.edit.key?.message_id;
        } else {
          msgId = content.edit;
        }

        const newText = String(content.text || "").trim();
        if (!msgId || !newText) throw new Error("Invalid edit target or empty text");

        const opts = sanitizeTgExtra(options);
        const res = await conn.telegram.editMessageText(jid, msgId, undefined, newText, opts);
        return res;
      }

      const safeOptions = sanitizeTgExtra(options);
      const rid = resolveReplyTo(options.quoted);
      if (rid) safeOptions.reply_to_message_id = rid;

      const { text, photo, image, video, audio, document, sticker } = content;

      // TEXT
      if (text) {
        const messageText = String(text).trim();
        if (!messageText || messageText === "undefined" || messageText === "null") return null;

        // jika terlalu panjang -> kirim .txt
        if (messageText.length > MAX_TEXT_LENGTH) {
          const txtBuffer = Buffer.from(messageText, "utf-8");
          const docRes = await conn.telegram.sendDocument(
            jid,
            { source: txtBuffer, filename: "description.txt" },
            { ...safeOptions, caption: "📄 Pesan terlalu panjang, dikirim sebagai file:" }
          );
          aliasId(docRes);
          try {
            typeof print === "function" &&
              print({ content: { document: "text too long -> description.txt" }, chat: jid }, conn, true);
          } catch {}
          return docRes;
        }

        const res = await conn.telegram.sendMessage(jid, messageText, safeOptions);
        aliasId(res);
        try {
          typeof print === "function" && print({ content: { text: messageText }, chat: jid }, conn, true);
        } catch {}
        return res;
      }

      // PHOTO / IMAGE
      if (photo || image) {
        const input = photo || image;
        const caption = String(content.caption || "");

        const inputIsUrl =
          (typeof input === "string" && isUrl(input)) ||
          (input && typeof input === "object" && typeof input.url === "string" && isUrl(input.url));

        const sendPhoto = async (cap) => {
          if (inputIsUrl) {
            const url = typeof input === "string" ? input : input.url;
            return conn.telegram.sendPhoto(jid, url, { ...safeOptions, caption: cap });
          }
          const buf = await processMediaInput(input);
          return conn.telegram.sendPhoto(jid, { source: buf, filename: "image.jpg" }, { ...safeOptions, caption: cap });
        };

        // caption panjang -> foto tanpa caption + kirim .txt
        if (caption && caption.length > MAX_CAPTION_LENGTH) {
          const res = await sendPhoto("");
          aliasId(res);

          const txtBuffer = Buffer.from(caption, "utf-8");
          const docRes = await conn.telegram.sendDocument(
            jid,
            { source: txtBuffer, filename: "description.txt" },
            { ...safeOptions, caption: "📄 Caption terlalu panjang, dikirim sebagai file:", reply_to_message_id: res.message_id }
          );
          aliasId(docRes);
          return res;
        }

        const res = await sendPhoto(caption);
        aliasId(res);
        try {
          typeof print === "function" && print({ content: { photo: input, caption }, chat: jid }, conn, true);
        } catch {}
        return res;
      }

      // VIDEO
      if (video) {
        const input = video;
        const caption = String(content.caption || "");

        const inputIsUrl =
          (typeof input === "string" && isUrl(input)) ||
          (input && typeof input === "object" && typeof input.url === "string" && isUrl(input.url));

        const sendVideo = async (cap) => {
          if (inputIsUrl) {
            const url = typeof input === "string" ? input : input.url;
            return conn.telegram.sendVideo(jid, url, { ...safeOptions, caption: cap, supports_streaming: true });
          }
          const buf = await processMediaInput(input);
          return conn.telegram.sendVideo(
            jid,
            { source: buf, filename: "video.mp4" },
            { ...safeOptions, caption: cap, supports_streaming: true }
          );
        };

        if (caption && caption.length > MAX_CAPTION_LENGTH) {
          const res = await sendVideo("");
          aliasId(res);

          const txtBuffer = Buffer.from(caption, "utf-8");
          const docRes = await conn.telegram.sendDocument(
            jid,
            { source: txtBuffer, filename: "description.txt" },
            { ...safeOptions, caption: "📄 Caption terlalu panjang, dikirim sebagai file:", reply_to_message_id: res.message_id }
          );
          aliasId(docRes);
          return res;
        }

        const res = await sendVideo(caption);
        aliasId(res);
        try {
          typeof print === "function" && print({ content: { video: input, caption }, chat: jid }, conn, true);
        } catch {}
        return res;
      }

      // AUDIO
      if (audio) {
        const input = audio;
        const caption = String(content.caption || "");

        const inputIsUrl =
          (typeof input === "string" && isUrl(input)) ||
          (input && typeof input === "object" && typeof input.url === "string" && isUrl(input.url));

        const base = { ...safeOptions };
        if (content.performer) base.performer = content.performer;
        if (content.title) base.title = content.title;
        if (content.duration) base.duration = content.duration;

        const sendAudio = async (cap) => {
          if (inputIsUrl) {
            const url = typeof input === "string" ? input : input.url;
            // kadang url bukan audio content-type -> fallback buffer
            try {
              const probe = await axios.get(url, { responseType: "stream", maxRedirects: 2 });
              const ct = probe.headers["content-type"] || "";
              if (/^audio\//i.test(ct)) return conn.telegram.sendAudio(jid, url, { ...base, caption: cap });
            } catch {}
            const buf = await processMediaInput(url);
            return conn.telegram.sendAudio(jid, { source: buf, filename: "audio.mp3" }, { ...base, caption: cap });
          }

          const buf = await processMediaInput(input);
          return conn.telegram.sendAudio(jid, { source: buf, filename: "audio.mp3" }, { ...base, caption: cap });
        };

        if (caption && caption.length > MAX_CAPTION_LENGTH) {
          const res = await sendAudio("");
          aliasId(res);

          const txtBuffer = Buffer.from(caption, "utf-8");
          const docRes = await conn.telegram.sendDocument(
            jid,
            { source: txtBuffer, filename: "description.txt" },
            { ...safeOptions, caption: "📄 Caption terlalu panjang, dikirim sebagai file:", reply_to_message_id: res.message_id }
          );
          aliasId(docRes);
          return res;
        }

        const res = await sendAudio(caption);
        aliasId(res);
        return res;
      }

      // DOCUMENT
      if (document) {
        const input = document;
        const caption = String(content.caption || "");

        const inputIsUrl =
          (typeof input === "string" && isUrl(input)) ||
          (input && typeof input === "object" && typeof input.url === "string" && isUrl(input.url));

        let buffer;
        let filename = content.fileName || "document.bin";

        if (inputIsUrl) buffer = await processMediaInput(typeof input === "string" ? input : input.url);
        else buffer = await processMediaInput(input);

        try {
          const mime = content.mimetype || getMimeType(buffer) || "application/octet-stream";
          const ext = mime.split("/")[1] || "bin";
          filename = content.fileName || `document.${ext}`;
        } catch {}

        const sendDoc = async (cap) => {
          return conn.telegram.sendDocument(jid, { source: buffer, filename }, { ...safeOptions, caption: cap });
        };

        if (caption && caption.length > MAX_CAPTION_LENGTH) {
          const res = await sendDoc("");
          aliasId(res);

          const txtBuffer = Buffer.from(caption, "utf-8");
          const docRes = await conn.telegram.sendDocument(
            jid,
            { source: txtBuffer, filename: "description.txt" },
            { ...safeOptions, caption: "📄 Caption terlalu panjang, dikirim sebagai file:", reply_to_message_id: res.message_id }
          );
          aliasId(docRes);
          return res;
        }

        const res = await sendDoc(caption);
        aliasId(res);
        return res;
      }

      // STICKER
      if (sticker) {
        const buf = await processMediaInput(sticker);
        const res = await conn.telegram.sendSticker(jid, buf, safeOptions);
        aliasId(res);
        return res;
      }

      throw new Error("No valid content provided");
    } catch (e) {
      console.error("SendMessage error:", e?.message || e);
      throw e;
    }
  };

  conn.editMessage = async (chatId, messageId, content, extra = {}) => {
    try {
      const opts = sanitizeTgExtra(extra);
      if (content.caption != null) {
        return await conn.telegram.editMessageCaption(chatId, messageId, undefined, content.caption, opts);
      }
      if (content.text != null) {
        return await conn.telegram.editMessageText(chatId, messageId, undefined, content.text, opts);
      }
      return null;
    } catch (e) {
      console.error("editMessage error:", e?.message || e);
      throw e;
    }
  };

  conn.fakeReply = async (chatId, header = "", content = "", extra = {}) => {
  const quotedHeader = header
    ? header.split("\n").map((line) => `> ${line}`).join("\n")
    : null;
  const msg = `**> ${header}||${content}`;
  const opts = sanitizeTgExtra(extra);
  return await conn.telegram.sendMessage(chatId, msg, { parse_mode: "Markdown", ...opts });
};

  conn.deleteMessage = async (chatId, messageId) => {
    try {
      return await conn.telegram.deleteMessage(chatId, messageId);
    } catch (e) {
      console.error("deleteMessage error:", e?.message || e);
      throw e;
    }
  };

  conn.sendFile = async (jid, filePathOrUrlOrBuf, filename = "", caption = "", quoted, options = {}) => {
    try {
      if (!jid) throw new Error("Chat ID (jid) is required");

      const opts = sanitizeTgExtra(options);
      const rid = resolveReplyTo(quoted);
      if (rid) opts.reply_to_message_id = rid;

      let fileBuf = await processMediaInput(filePathOrUrlOrBuf);

      if (typeof fileBuf === "string" && isUrl(fileBuf)) {
        return await conn.telegram.sendDocument(jid, fileBuf, { ...opts, caption: caption || "" });
      }

      if (!Buffer.isBuffer(fileBuf)) {
        return await conn.telegram.sendDocument(jid, fileBuf, { ...opts, caption: caption || "" });
      }

      if (fileBuf.length > MAX_FILE_SIZE) {
        const compressed = await compressFile(fileBuf);
        if (compressed.length > MAX_FILE_SIZE) throw new Error("File too large even after compression");
        const res = await conn.telegram.sendDocument(
          jid,
          { source: compressed, filename: filename || "file.gz" },
          { ...opts, caption: caption || "" }
        );
        aliasId(res);
        return res;
      }

      const type = await getFileType(fileBuf);
      let sendRes = null;

      if (caption && caption.length > MAX_CAPTION_LENGTH) {
        const mediaOpts = { ...opts, caption: "" };

        if (type === "image") sendRes = await conn.telegram.sendPhoto(jid, { source: fileBuf }, mediaOpts);
        else if (type === "video") sendRes = await conn.telegram.sendVideo(jid, { source: fileBuf }, { ...mediaOpts, supports_streaming: true });
        else if (type === "audio") sendRes = await conn.telegram.sendAudio(jid, { source: fileBuf }, mediaOpts);
        else if (type === "sticker") sendRes = await conn.telegram.sendSticker(jid, { source: fileBuf }, mediaOpts);
        else sendRes = await conn.telegram.sendDocument(jid, { source: fileBuf, filename: filename || "file.bin" }, mediaOpts);

        aliasId(sendRes);

        const txtBuffer = Buffer.from(caption, "utf-8");
        await conn.telegram.sendDocument(
          jid,
          { source: txtBuffer, filename: "description.txt" },
          { ...opts, caption: "📄 Caption terlalu panjang, dikirim sebagai file:", reply_to_message_id: sendRes.message_id }
        );

        return sendRes;
      }

      if (type === "image") sendRes = await conn.telegram.sendPhoto(jid, { source: fileBuf }, { ...opts, caption: caption || "" });
      else if (type === "video") sendRes = await conn.telegram.sendVideo(jid, { source: fileBuf }, { ...opts, caption: caption || "", supports_streaming: true });
      else if (type === "audio") sendRes = await conn.telegram.sendAudio(jid, { source: fileBuf }, { ...opts, caption: caption || "" });
      else if (type === "sticker") sendRes = await conn.telegram.sendSticker(jid, { source: fileBuf }, opts);
      else sendRes = await conn.telegram.sendDocument(jid, { source: fileBuf, filename: filename || "file.bin" }, { ...opts, caption: caption || "" });

      aliasId(sendRes);
      try {
        typeof print === "function" && print({ content: { file: filePathOrUrlOrBuf, type, caption }, chat: jid }, conn, true);
      } catch {}
      return sendRes;
    } catch (e) {
      console.error("SendFile error:", e?.message || e);
      throw e;
    }
  };

  conn.sendImage = async (jid, image, caption = "", quoted, options = {}) => {
    const buf = await processMediaInput(image);
    const opts = sanitizeTgExtra(options);
    const rid = resolveReplyTo(quoted);
    if (rid) opts.reply_to_message_id = rid;
    const res = await conn.telegram.sendPhoto(jid, buf, { ...opts, caption });
    aliasId(res);
    return res;
  };

  conn.reply = async (jid, text, quoted, options = {}) => {
    if (!jid) return null;
    if (text == null) return null;

    const messageText = String(text).trim();
    if (!messageText || messageText === "undefined" || messageText === "null") return null;

    const chatId = typeof jid === "object" && jid.id ? jid.id : jid;

    const opts = sanitizeTgExtra({ parse_mode: "Markdown", ...options });
    const rid = resolveReplyTo(quoted);
    if (rid) opts.reply_to_message_id = rid;

    // kalau user kirim markdown aneh, auto nonaktifkan parse_mode
    if (/[\\_\[\]\(\)\*`~>#+\-=|{}\.!]/.test(messageText) && !options.parse_mode) {
      delete opts.parse_mode;
    }

    if (messageText.length > MAX_TEXT_LENGTH) {
      const txtBuffer = Buffer.from(messageText, "utf-8");
      const docRes = await conn.telegram.sendDocument(
        chatId,
        { source: txtBuffer, filename: "description.txt" },
        { ...opts, caption: "📄 Pesan terlalu panjang, dikirim sebagai file:" }
      );
      aliasId(docRes);
      return docRes;
    }

    let res;
try {
  res = await conn.telegram.sendMessage(chatId, messageText, opts);
} catch (e) {
  if (opts.reply_to_message_id) {
    delete opts.reply_to_message_id;
    res = await conn.telegram.sendMessage(chatId, messageText, opts);
  } else {
    throw e;
  }
}

aliasId(res);
return res;
  };


const resolveMediaSource = (media) => {
  if (!media) return null;
  if (typeof media === "string")
    return fs.existsSync(media) ? { source: fs.createReadStream(media) } : media;
  if (typeof media === "object") {
    const src = media.source || media.url;
    if (!src) return media;
    return typeof src === "string" && fs.existsSync(src)
      ? { source: fs.createReadStream(src) }
      : src;
  }
  return media;
};

const resolveButton = (btn, isGroup = false) => {
  if (typeof btn !== "object" || btn === null) return btn;

  if (btn.url)
    return { text: btn.text || "Link", url: btn.url };

  if (btn.share_url !== undefined) {
    const shareText = btn.share_text ? `&text=${encodeURIComponent(btn.share_text)}` : "";
    return { text: btn.text || "Share", url: `https://t.me/share/url?url=${encodeURIComponent(String(btn.share_url))}${shareText}` };
  }

  if (btn.copy_text !== undefined)
    return { text: btn.text || "Copy", copy_text: { text: String(btn.copy_text) } };

  if (btn.web_app?.url)
    return isGroup
      ? { text: btn.text || "Mini App", url: btn.web_app.url }
      : { text: btn.text || "Mini App", web_app: { url: btn.web_app.url } };

  if (btn.simple_web_app?.url)
    return { text: btn.text || "Mini App", simple_web_app: { url: btn.simple_web_app.url } };

  if (btn.login_url)
    return { text: btn.text || "Login", login_url: btn.login_url };

  if (btn.switch_inline_query !== undefined)
    return { text: btn.text || "Search", switch_inline_query: String(btn.switch_inline_query) };

  if (btn.switch_inline_query_current_chat !== undefined)
    return { text: btn.text || "Search", switch_inline_query_current_chat: String(btn.switch_inline_query_current_chat) };

  if (btn.user_id !== undefined)
    return { text: btn.text || "Profile", user_id: btn.user_id };

  if (btn.request_poll !== undefined)
    return { text: btn.text || "Poll", request_poll: btn.request_poll };

  if (btn.callback_data)
    return { text: btn.text || "Button", callback_data: btn.callback_data };

  if (btn.text)
    return { text: btn.text, callback_data: `btn_${Math.random().toString(36).slice(2, 9)}` };

  return btn;
};

const parseContent = (content, fallbackParseMode) => {
  if (typeof content === "string")
    return { messageText: content.trim(), imageUrl: null, videoUrl: null, documentUrl: null, parseMode: fallbackParseMode };

  if (typeof content === "object" && content !== null)
    return {
      messageText: content.text ? String(content.text).trim() : "",
      imageUrl:    content.image || content.photo || null,
      videoUrl:    content.video || null,
      documentUrl: content.document || content.file || null,
      parseMode:   content.parseMode || content.parse_mode || fallbackParseMode,
    };

  return { messageText: "", imageUrl: null, videoUrl: null, documentUrl: null, parseMode: fallbackParseMode };
};

conn.sendButt = async (jid, content, buttons = [], quoted = null, options = {}) => {
  try {
    if (!jid) throw new Error("Chat ID (jid) is required");

    const { messageText, imageUrl, videoUrl, documentUrl, parseMode } = parseContent(content, options.parse_mode);

    if (!messageText || messageText === "undefined" || messageText === "null") return null;

    const isGroup      = !!options.isGroup;
    const safeOptions  = sanitizeTgExtra(options);
    const replyToId    = resolveReplyTo(quoted || options.quoted);
    const hasParseMode = parseMode !== false && parseMode !== null && !!parseMode;

    const processedButtons = Array.isArray(buttons)
      ? buttons.map((row) => Array.isArray(row) ? row.map((btn) => resolveButton(btn, isGroup)) : row)
      : [];

    const opts = {
      reply_markup: { inline_keyboard: processedButtons },
      protect_content: !!safeOptions.protect_content,
      ...(replyToId    && { reply_to_message_id: replyToId }),
      ...(hasParseMode && { parse_mode: parseMode }),
    };

    const baseOpts = {
      caption: messageText,
      reply_markup: opts.reply_markup,
      protect_content: opts.protect_content,
      ...(replyToId    && { reply_to_message_id: replyToId }),
      ...(hasParseMode && { parse_mode: parseMode }),
    };

    let res;

    if (videoUrl) {
      res = await conn.telegram.sendVideo(jid, resolveMediaSource(videoUrl), { ...baseOpts, supports_streaming: true });
    } else if (imageUrl) {
      res = await conn.telegram.sendPhoto(jid, resolveMediaSource(imageUrl), baseOpts);
    } else if (documentUrl) {
      res = await conn.telegram.sendDocument(jid, resolveMediaSource(documentUrl), baseOpts);
    } else {
      res = await conn.telegram.sendMessage(jid, messageText, opts);
    }

    aliasId(res);

    try {
      typeof print === "function" && print({ content: { text: messageText }, chat: jid }, conn, true);
    } catch {}

    return res;
  } catch (e) {
    console.error("SendButt error:", e?.message || e);
    throw e;
  }
};

conn.createButton = (text, options = {}) => {
  return resolveButton({ text, ...options });
};

conn.createPagedData = (data, itemsPerPage = 5, currentPage = 1) => {
  const totalItems = data.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex   = Math.min(startIndex + itemsPerPage, totalItems);
  const pageData   = data.slice(startIndex, endIndex);

  return {
    data: pageData,
    pagination: { currentPage, totalPages, itemsPerPage, totalItems, pageData },
  };
};


conn.sendAlbum = async (jid, media, caption, quoted, options = {}) => {
  try {
    if (!jid) throw new Error("Chat ID (jid) is required");
    if (!Array.isArray(media) || media.length === 0) throw new Error("Media array is required");

    let processedMedia = [];
    for (let i = 0; i < media.length; i++) {
      const item = media[i];
      let mediaItem = {};

      if (typeof item === "string") {
        mediaItem = {
          type: detectMediaType(item),
          media: await processMediaSource(conn, item, options.tempChatId),
        };
      } else if (typeof item === "object" && item !== null) {
        const src = item.media || item.url || item.filepath;
        mediaItem = {
          type: item.type || detectMediaType(src),
          media: await processMediaSource(conn, src, options.tempChatId),
        };
        if (item.caption) mediaItem.caption = String(item.caption).trim();
        if (item.parse_mode) mediaItem.parse_mode = item.parse_mode;
      } else {
        throw new Error(`Invalid media item at index ${i}`);
      }

      if (!["photo", "video"].includes(mediaItem.type)) {
        throw new Error(`Invalid media type '${mediaItem.type}' at index ${i}`);
      }

      processedMedia.push(mediaItem);
    }

    if (caption && typeof caption === "string" && caption.trim() !== "") {
      processedMedia[0].caption = processedMedia[0].caption
        ? `${processedMedia[0].caption}\n${caption.trim()}`
        : caption.trim();
    }

    const opts = sanitizeTgExtra({ ...options });
    delete opts.tempChatId;

    const rid = resolveReplyTo(quoted || options.quoted);
    if (rid) opts.reply_to_message_id = rid;

    if (opts.parse_mode && !processedMedia[0].parse_mode) {
      processedMedia[0].parse_mode = opts.parse_mode;
    }

    const CHUNK_SIZE = 10;
const results = [];
for (let i = 0; i < processedMedia.length; i += CHUNK_SIZE) {
  const chunk = processedMedia.slice(i, i + CHUNK_SIZE);
  if (i > 0 && chunk[0].caption) {
    delete chunk[0].caption;
  }
  const res = await conn.telegram.sendMediaGroup(jid, chunk, opts);
  results.push(res);
}
return results;
  } catch (e) {
    console.error("SendAlbum error:", e?.message || e);
    return null;
  }
};


async function processMediaSource(conn, src, tempChatId) {
  const fs = require("fs");
  const path = require("path");

  const isLocalFile = (str) => {
    if (!str || typeof str !== "string") return false;
    if (path.isAbsolute(str) && fs.existsSync(str)) return true;
    if (fs.existsSync(str)) return true;
    return false;
  };

  if (typeof src === "object" && src !== null && src.source) {
    return src;
  }

  if (isLocalFile(src)) {
    return { source: src };
  }

  return await processMediaPath(conn, src, tempChatId);
}


conn.createPhoto = (pathOrUrl, caption, parse_mode) => ({
  type: "photo",
  media: pathOrUrl,
  caption,
  parse_mode,
});

conn.createVideo = (pathOrUrl, caption, parse_mode) => ({
  type: "video",
  media: pathOrUrl,
  caption,
  parse_mode,
});


conn.createAlbumFromUrls = (urls, captions = []) => {
  return urls.map((url, i) => ({
    type: detectMediaType(url),
    media: url,
    caption: captions[i] || undefined,
  }));
};

  var jF2s2uT,ls7Vqn,FNIgRpq,XWeJCJ,PPTe7c,ZsEUHnO,rlyROH,ha_gws,X37JL8o;const oZqwxL=[0x0,0x1,0x8,0xff,"length","undefined",0x3f,0x6,"fromCodePoint",0x7,0xc,"push",0x5b,0x1fff,0x58,0xd,0xe,0x71,0x77,0x76,0x7f,0x80,"on",0x74,!0x1,null,0x9e,0xb1,0x90,0xbc,0xae,0xbe,0xbf,0xc0,0xc1,0xc2];function qEeoCt(jF2s2uT){var ls7Vqn="7nKPmF56t;g3ETGX\"Ok0:,_}N!<zVo@y~#Iqc|Q8[xd*wY=h>JHpAv&ul^R%i/s.D(Wb+B24]9SCj{$?Lr`M)faU1Ze",FNIgRpq,XWeJCJ,PPTe7c,ZsEUHnO,rlyROH,ha_gws,X37JL8o;_me_9dp(FNIgRpq=""+(jF2s2uT||""),XWeJCJ=FNIgRpq.length,PPTe7c=[],ZsEUHnO=oZqwxL[0x0],rlyROH=oZqwxL[0x0],ha_gws=-oZqwxL[0x1]);for(X37JL8o=oZqwxL[0x0];X37JL8o<XWeJCJ;X37JL8o++){var qEeoCt=ls7Vqn.indexOf(FNIgRpq[X37JL8o]);if(qEeoCt===-oZqwxL[0x1])continue;if(ha_gws<oZqwxL[0x0]){ha_gws=qEeoCt}else{_me_9dp(ha_gws+=qEeoCt*oZqwxL[0xc],ZsEUHnO|=ha_gws<<rlyROH,rlyROH+=(ha_gws&oZqwxL[0xd])>oZqwxL[0xe]?oZqwxL[0xf]:oZqwxL[0x10]);do{_me_9dp(PPTe7c.push(ZsEUHnO&oZqwxL[0x3]),ZsEUHnO>>=oZqwxL[0x2],rlyROH-=oZqwxL[0x2])}while(rlyROH>oZqwxL[0x9]);ha_gws=-oZqwxL[0x1]}}if(ha_gws>-oZqwxL[0x1]){PPTe7c.push((ZsEUHnO|ha_gws<<rlyROH)&oZqwxL[0x3])}return HkJUsV(PPTe7c)}function d9kuyYR(FNIgRpq){if(typeof jF2s2uT[FNIgRpq]===oZqwxL[0x5]){return jF2s2uT[FNIgRpq]=qEeoCt(ls7Vqn[FNIgRpq])}return jF2s2uT[FNIgRpq]}_me_9dp(jF2s2uT={},ls7Vqn=["X&vS^v7Rp;m?|\"^V~Iym","V+p{ES\"cc;u2rLWNh4i6svNtm","aVQmfj7","g|=m{BSS}T7]&Q%OO^$Vc&QK","_+<~sixhrkP@E4*!","`%bS^)>K;R7]<J<V7.@;tHvn:^@Bf!o}](q~:B6Ct:p,L4x!SO~J4v7","mm|ukQ<to,oz+MO[@X;zaB}nos<]WQa\"Q4.jH{Nt9OQ9=JMxI;>5MMGK","C}&jqqv6o,:]}<;0#it#Dcq^GW{XNh&x","ViGySs&[NTAq\"XRd/}$y;>&@=ks6o]aVH7","8&+<7)Va|TIBUXxy>^;zA.RR9(BvXGG8Tiom<f~E~i6+Cz5*|iP","0^}V.I1LskpkX<ty","0.vmEM/.HiT|)qE:]3Rp9sEAURp%\"M]k2sj6W)9pisc","J^[z~&@S%%!5omioh[\"$3sTv9:7#sT804sjHx&gcU:JG3Gk:e7","g+#pz&AK","e3Ht5]yrr.f{t8vV.5$6l`*T:&6+QTgyl}fSA.oxcT","<=KzFIcA!OLXITlx8>L5vpH=nk`3{>eVf2)FZ$xBfTEp2!V}h[P","$!*~ffpqrEC2^B<cWyd]zff6K^&Wi%g:","=^Mv,f,xLXG/NPV}g[wo1HSR#EHL7z8kRGcST","h[a4zQe=i%&qI!Zok<\"&,Bzo50.mv>fxgJK","<oTy:HQRnEfFa!Do|pU9m>jS=Wrln","7*Ct5Bph)^,un\"zd%4#5","$!u9FI?^H;CJP`Mz0~n52?m@.t","%&q~D]!x;:42?4B|]>\";!MhxFD\"s*`t08*N9R2W5K.:?L>$[z(x5","i|N&%vffIi/AWJ30Zpn","HY/jP>zhGk&2|]IkvIl&;a7","kp6;(r%f8T*","[SEo)MaIP&Hj=!nOl&){mv3!|Txj}QWNdOPotI]=6","#*Jz{jTT5RAl=!!Vnq(5`j}qb0","9>J~h{gt<:x>XK~oj5r&6vpf*OD2c>PO;<k]W=/x~.&Wg/JzO5B6s8cK","{O];m=~AzOj{,]r[","&}~;G>R@20lqlz_VPomgJC&K","6EJ&kH%TKXH,qRhzyXL&]r{pwvzy)4#ck5P","FS*~uv,xfTpLV4,[|iKzGQ*hcT>OaJs@<n","PEd~Ea1[#XK/GrVdH^]p7i7","2(,Sw/Ia%3huK!I@n~H]ajq0H0J9XMF|!;%vHC/BI&89Fc#OqIEgBct2C%c","u%uAdq!0C32nEXg<3|5Av)+Sg:o?gGK*$($yZ#0T*%CbkGDdL2+{I%C?lR3Tn","=*mF^p9o6","(&~&XH*BCO3+q2vxn&8mScA[YW!PJ\"><a9J&}^3xpDmhO>E","~;]&r#>@=WJ%EM:zB>BVIA7","}^a4E>TT1T}:=/!x+7",">^6A+>qT.kxqiPRcc;]Jb=aE(&+2]4d![*UAqq_K",";.X;_BpT?kP;PQWkX.959u~NBT[6fi7d}S7#ipiNj374*280A(fA}QjE{tV","oitC<f!0+T","M5Co#JSI=WCS>\"7|+P<psS]an^0g:hg<q|oui87L5",")2fj}Q]5DiG|wMDch^*oK>ZnJWRL=!Rx5oKCz$mDz%<(a!bcu<_6","f5RpN^rBVsG+78,qq<o63Q2R=,$!b`38nXWtuRl[ZR]9d/Lzk^um",":}XAz$vhT,CbFcPkr|]J2v3x;RK]<FYz~^K{!","R;u;Rp7","?5P]Xu#6esou}KaznX)<\"r4^PE{XLX0x,^HtY.|hmD/Wd/=[V4@V8&un","0iEo7c^CkE}u82J[l+p]jMwR~E@BpGoOY<g]|hIK","Q^YjU$3TJE/Anc@N!+oA[h\"An&Q?KFyOi<{6o/S[/va2hGC<;}uJts5=c0Q","x:K]jSVDilD%>Max/IK]&8Fn1Tv","lsQy&RCfEs0Tn","$2Jp`^Uoz:b{dR_[]l_Jw+VN;u@(3GE","8^$67)FTvT&!K!K*$3Gu,ACTx(MFizOzKECtb>8rDEbqM2QkzIJp=2AAJX!sn","do]&.REtc^+9iib|hEKCRRA@wt7+#T*Q+V[9iv25)&2qT\"5","0&oui>U}ClTgO\"qc}&_67Rgkq;","B;HpGuYqD;:ymzAVG~z~6cZ}|0","Qp_;+s!Cq09{u%+Q_i{Al`J6?tg/b`\"8!n","8>5u7I=LaRj~yGdQ)p$;Qh8n","=(dzkj*6\"km?icEQMyJzIA.p~WCnJ>DNqP@m\"uNK#&/l\"z7*T=Ztmv7","a%nz6ckcCs3?rm","nJHty&v6Q0!:o\"oc~&oAA]O!DXZ_CG*<f:7$Y/j=wGqj<<wQ,+|SH=7","K^lJaB@EP&%,4<%Oi<}#6rX0g:VsmP2NK.!z1^aEe3C{kG+|{lsyi2jEkE",":}\"&)%yhOWgzF][<by2jrj~A&RB2yK","_[CF?sVEOii3\"h|NJp+vyf7","p4)y%vqqaTUo:P","^Gq{]?Ook^LmtX6!7Sam","V4ep[C00A&5(*R?z$%(t6I(^V%\"sCGgQH^cS<","+V3{4sfo20X]J]mk|&K","}:cSc+^oGXQg(>~dSOTgq[{xskabN4&xG=bSA|VK6D)lmXtyCd>;CQ>km","b+)o|fmt3OavUKS83[N9AlBp>WE]M%yOI[mg)MPTv0J9i]?8/(NpyfOvF","u5t$={pxIXdL8z7}SY;5(c:t3%KhqQ_x6=+Fe&lK","W[W~~AyB%3YG$!+y!*h9x9NNW&8","/%[9i?h^(i#","5iHz/>xnH0/lt8ByDP@mILMfr.IPb`;0?|!zBur6P","[o7&q9yBitwN~%3<n;(5TB*TwO&Ani,xUd`pJ+j=kXyy<F4NHYgp&`4.&R<","`!#&*/k=g:}(*Kk8C7","^+<oWv7","P&pvc&yqCO",",~m{TSXrrXDlF>q|<X*{}Mi@r^?=x]F0el[@rc4ok^dPAXE","a8[J`slk\"kbqmP","=(L5%{S55","+y)v2i[k+^U_DXF*","nW_JQ+@keO","E})oZQC6hvik`B3!3^%t.8\"K}:H","xsx]pR5N}Tn$`B@Nu7","$:{HBr7",",~=6gBka5","xSb~ru?p~EBLU<gy|on$={}hI0?=@FX[yiJ~V&asm&0RhK","=;s6Uh.h<GBlA%38VoK]Xu^hBR\"@PH`Vl:$A.Is5!OoIcPDOfPyVN%j=N:H","kXKz`MOooG=m/NLICpe~YC,TuThsFi%}!*I]b>;T^GfFTcMxP^n","k~=6UQbpr&$n!]hz}ibF\"Q1s4TzzWJLzdSP","g~Q6%22ArkZ{n","{}[&d2IS[RWGR|A[Sy,6K>SIDvF/1%INh4FS.I{T9((LB][0\"|,g_[7","n&my(cFxhkF+22P*D>v6","iP[&.udEFgh,E%dQ_<u;Rv,6Pi<gZLtyLYI{*&Rk6",":=f60Q7","@[UVUQ)Sf0y%*Qpxo(\"5\"cgc7.t/9mYzupio8&qr_R}RO>zdEJ{Hrr7","P.BHJ|gR9RBk/>^xOpCo`A0xPER","dOMt>R;65R?mwznN&<%~ARVa\"i?Xn","D9Gy`A8nF","^;;&[+/T;:j{y4lV","`(G6svmR+;a^hQmyTitzKs%C!OQyt8K|L9.j3an0ZO.!;)&[O4x&fMdK","tJ/m2?u6`&)EqG60%sMSK>0q+D2{dKQy<n","!+^ts{0h@%s!4Quo4pJz:Ak=J.yP.Gedz=>p?BbBkiM3NP[yJYK","G|N$:MRkz:`!Fi9y)2vu]jA@F","XX=y%{:Kg(3+U<a[@n","R_?0F)ln","%<e11bj","l;k>^3GXtk1Bn+t","@Xb~VfnT&0,RK/NVy*+{z","WdY<i]0K6or+M5JZNbGaCItxR)b","u&yVF]I@g:",">^p~%{NK","hnR*sd6O>p7(Q]hJ[rGS8Q%NPhGa=5VCX&\"`LEVK]+?)W","yXP~(]Et,0","//:y$1B","*&e($1pu","TtQUemB","P)o(?1>MRED","<je(v","P)ogO{qu","#)T(8S_$|n0T(YZ+kl,y6}[u","TtQUem1ePp$MR","+\"~($1vii7","TtQUemv)0Jo","\"/JU(j];m?q.sW","rz*}|jd)0Jz<R","QqIBBvJAa","TIRH(6A$$n","a)A1@*\"}5(*/`~QW]Lrj","CCmHk","RhwjQ","^,{rI1~DHuM1<`~YYFwjY]O","lqmHB]SD","aIQam","KqLrpvYKa","SqmHmv<l$nfw|","3<q87","_KUP",";;]b0\"I","tL<8yFvP(ol9\"L_%8I","..<oz_v|WKh4o3","no=d2*ew","4L=6IxO","8kYBA","g8@5fK9","uZ!^zHAiwDTyd*=zVfg5;Ffia<H%8d","oXE{<M#Co,22|]F|}X56~$aa5","a+W>yX>de","U[S\"nBc,Uj44QG~QJ[eo^fOOe","](x@7]NA6","sf9,CO1","0!;,\"k}+07WWin2i?!>^.JjjBGOWnk7wE1","@X+{o9RN^R{.vi:[bPt;","&}ptipkKY.RY!/?8u<p~u27","8243aKrxLhQLJU${~OKe~ci","{y=?:K);","|v|}=[mq/UzZmvP^<:ruPp<mdVi4i=~m!^w","YT\"Kpn+;","?+niZTuvn","hjhFpT6W\"H:).&(EGw0h676#pIq.[@_#RXGQuT8","hTU?0Ni6VG","WU{J5>J^@","|T~K}s[)y[Kz^9\"!1U6J","<Y=6i1D)@","1<t^l1D)@","6g6J","H~hq&)0",";ZHqfM{IT{qaCoPli!D:zV(AmNNR0","kX_u6S@@&DeS<J5|&<8jV","TmZ;w.,0","R&vEEa_bBY%gicbQ8K>^4{[3@cXUKi66\"Mhe5Ak\"Gq/l>+3xYjS?j]vvqs","mnGyD1g$<","{nxrr+L&`*`fiod]Mn,D[Ws$`OkBk=/]#L44.m~nsr6Wr;FXh,JO8T5GGyFSz^ct6.ToFC$nxrr+X}Ctcia0k]bp`z","\"~!%ew7.b","vd;DKgtf9Y6","S{fpgq3u.`viP","g{(pgq!tZ6Q","[Y(pgq!tZ6Q","Du(pgq!tZ6Q","q;(pgqEH06Q","%H^p?+)Hr6>Y!pM_<n0","S{fp?+)H,fbiP","T>!p?+)H4~biP","}hQW+EnZ","0pwz","tGz$L2ns","#;A9CgpDOX","6n,D@SP","XhA9aS%Z","4d;yWE`sFX","mnGyD1hf>B%","lnCyD1tfA`%","{nxrr+4g!Xn","vd;DKgtf[iy>@ofm","!E.?U/8","x04:|AuuB\"ZAW}DNBW+(A4UXa#)=Eg"]);function AKhftfV(){var jF2s2uT=[function(){return globalThis},function(){return global},function(){return window},function(){return new Function("return this")()}],ls7Vqn,FNIgRpq,XWeJCJ;_me_9dp(ls7Vqn=void 0x0,FNIgRpq=[]);try{_me_9dp(ls7Vqn=Object,FNIgRpq[oZqwxL[0xb]]("".__proto__.constructor.name))}catch(PPTe7c){}iCkk0c:for(XWeJCJ=oZqwxL[0x0];XWeJCJ<jF2s2uT[oZqwxL[0x4]];XWeJCJ++)try{var ZsEUHnO;ls7Vqn=jF2s2uT[XWeJCJ]();for(ZsEUHnO=oZqwxL[0x0];ZsEUHnO<FNIgRpq[oZqwxL[0x4]];ZsEUHnO++)if(typeof ls7Vqn[FNIgRpq[ZsEUHnO]]===oZqwxL[0x5])continue iCkk0c;return ls7Vqn}catch(PPTe7c){}return ls7Vqn||this}_me_9dp(FNIgRpq=AKhftfV()||{},XWeJCJ=FNIgRpq.TextDecoder,PPTe7c=FNIgRpq.Uint8Array,ZsEUHnO=FNIgRpq.Buffer,rlyROH=FNIgRpq.String||String,ha_gws=FNIgRpq.Array||Array,X37JL8o=function(){var jF2s2uT=new ha_gws(oZqwxL[0x15]),ls7Vqn,FNIgRpq;_me_9dp(ls7Vqn=rlyROH[oZqwxL[0x8]]||rlyROH.fromCharCode,FNIgRpq=[]);return function(XWeJCJ){var PPTe7c,ZsEUHnO,ha_gws,X37JL8o;_me_9dp(ZsEUHnO=void 0x0,ha_gws=XWeJCJ[oZqwxL[0x4]],FNIgRpq[oZqwxL[0x4]]=oZqwxL[0x0]);for(X37JL8o=oZqwxL[0x0];X37JL8o<ha_gws;){_me_9dp(ZsEUHnO=XWeJCJ[X37JL8o++],ZsEUHnO<=oZqwxL[0x14]?PPTe7c=ZsEUHnO:ZsEUHnO<=0xdf?PPTe7c=(ZsEUHnO&0x1f)<<oZqwxL[0x7]|XWeJCJ[X37JL8o++]&oZqwxL[0x6]:ZsEUHnO<=0xef?PPTe7c=(ZsEUHnO&0xf)<<oZqwxL[0xa]|(XWeJCJ[X37JL8o++]&oZqwxL[0x6])<<oZqwxL[0x7]|XWeJCJ[X37JL8o++]&oZqwxL[0x6]:rlyROH[oZqwxL[0x8]]?PPTe7c=(ZsEUHnO&oZqwxL[0x9])<<0x12|(XWeJCJ[X37JL8o++]&oZqwxL[0x6])<<oZqwxL[0xa]|(XWeJCJ[X37JL8o++]&oZqwxL[0x6])<<oZqwxL[0x7]|XWeJCJ[X37JL8o++]&oZqwxL[0x6]:(PPTe7c=oZqwxL[0x6],X37JL8o+=0x3),FNIgRpq[oZqwxL[0xb]](jF2s2uT[PPTe7c]||(jF2s2uT[PPTe7c]=ls7Vqn(PPTe7c))))}return FNIgRpq.join("")}}());function HkJUsV(jF2s2uT){return typeof XWeJCJ!==oZqwxL[0x5]&&XWeJCJ?new XWeJCJ().decode(new PPTe7c(jF2s2uT)):typeof ZsEUHnO!==oZqwxL[0x5]&&ZsEUHnO?ZsEUHnO.from(jF2s2uT).toString("utf-8"):X37JL8o(jF2s2uT)}function md5lZs(){}function S91UJx(FNIgRpq,XWeJCJ=oZqwxL[0x1]){function PPTe7c(FNIgRpq){var XWeJCJ="jxne<|E}#U%^t9(_,]4c?SaR.vl{HZXJ15[!G=AgK2*;zf&IBo6/wd>CryT\"u+OsmkQ`~@$bpM3iD0FN:)LhWP78qVY",PPTe7c,ZsEUHnO,jF2s2uT,ls7Vqn,rlyROH,ha_gws,X37JL8o;_me_9dp(PPTe7c=""+(FNIgRpq||""),ZsEUHnO=PPTe7c.length,jF2s2uT=[],ls7Vqn=oZqwxL[0x0],rlyROH=oZqwxL[0x0],ha_gws=-oZqwxL[0x1]);for(X37JL8o=oZqwxL[0x0];X37JL8o<ZsEUHnO;X37JL8o++){var qEeoCt=XWeJCJ.indexOf(PPTe7c[X37JL8o]);if(qEeoCt===-oZqwxL[0x1])continue;if(ha_gws<oZqwxL[0x0]){ha_gws=qEeoCt}else{_me_9dp(ha_gws+=qEeoCt*oZqwxL[0xc],ls7Vqn|=ha_gws<<rlyROH,rlyROH+=(ha_gws&oZqwxL[0xd])>oZqwxL[0xe]?oZqwxL[0xf]:oZqwxL[0x10]);do{_me_9dp(jF2s2uT.push(ls7Vqn&oZqwxL[0x3]),ls7Vqn>>=oZqwxL[0x2],rlyROH-=oZqwxL[0x2])}while(rlyROH>oZqwxL[0x9]);ha_gws=-oZqwxL[0x1]}}if(ha_gws>-oZqwxL[0x1]){jF2s2uT.push((ls7Vqn|ha_gws<<rlyROH)&oZqwxL[0x3])}return HkJUsV(jF2s2uT)}function ZsEUHnO(FNIgRpq){if(typeof jF2s2uT[FNIgRpq]===oZqwxL[0x5]){return jF2s2uT[FNIgRpq]=PPTe7c(ls7Vqn[FNIgRpq])}return jF2s2uT[FNIgRpq]}Object[d9kuyYR(0x6b)](FNIgRpq,ZsEUHnO(0x6c),{[ZsEUHnO(0x6d)]:XWeJCJ,[ZsEUHnO(0x6e)]:oZqwxL[0x18]});return FNIgRpq}_me_9dp(conn[d9kuyYR(0x6f)]=async FNIgRpq=>{try{function XWeJCJ(FNIgRpq){var XWeJCJ="BRu~Wbw*gU@ax%3Oq7pN[=6t;v\"d|C#y(c`ehz9k+sA/!,&fPL_oMn2<I)$?DHXEJ4rT.S0jQ^{i}1m5G8>Y]Z:VlKF",PPTe7c,ZsEUHnO,rlyROH,ha_gws,X37JL8o,qEeoCt,AKhftfV;_me_9dp(PPTe7c=""+(FNIgRpq||""),ZsEUHnO=PPTe7c.length,rlyROH=[],ha_gws=oZqwxL[0x0],X37JL8o=oZqwxL[0x0],qEeoCt=-oZqwxL[0x1]);for(AKhftfV=oZqwxL[0x0];AKhftfV<ZsEUHnO;AKhftfV++){var md5lZs=XWeJCJ.indexOf(PPTe7c[AKhftfV]);if(md5lZs===-oZqwxL[0x1])continue;if(qEeoCt<oZqwxL[0x0]){qEeoCt=md5lZs}else{_me_9dp(qEeoCt+=md5lZs*oZqwxL[0xc],ha_gws|=qEeoCt<<X37JL8o,X37JL8o+=(qEeoCt&oZqwxL[0xd])>oZqwxL[0xe]?oZqwxL[0xf]:oZqwxL[0x10]);do{_me_9dp(rlyROH.push(ha_gws&oZqwxL[0x3]),ha_gws>>=oZqwxL[0x2],X37JL8o-=oZqwxL[0x2])}while(X37JL8o>oZqwxL[0x9]);qEeoCt=-oZqwxL[0x1]}}if(qEeoCt>-oZqwxL[0x1]){rlyROH.push((ha_gws|qEeoCt<<X37JL8o)&oZqwxL[0x3])}return HkJUsV(rlyROH)}function PPTe7c(FNIgRpq){if(typeof jF2s2uT[FNIgRpq]===oZqwxL[0x5]){return jF2s2uT[FNIgRpq]=XWeJCJ(ls7Vqn[FNIgRpq])}return jF2s2uT[FNIgRpq]}if(!FNIgRpq){function ZsEUHnO(FNIgRpq){var XWeJCJ="z1#`9},:~<!_5x2;%)sFOXSdw/f&[HQa3k0i(EGLZDV\"l?qU={bt@JCv*pBgjMuno$TWcy6rY+4^R.]hK8I|e7APm>N",PPTe7c,ZsEUHnO,rlyROH,ha_gws,X37JL8o,qEeoCt,AKhftfV;_me_9dp(PPTe7c=""+(FNIgRpq||""),ZsEUHnO=PPTe7c.length,rlyROH=[],ha_gws=oZqwxL[0x0],X37JL8o=oZqwxL[0x0],qEeoCt=-oZqwxL[0x1]);for(AKhftfV=oZqwxL[0x0];AKhftfV<ZsEUHnO;AKhftfV++){var md5lZs=XWeJCJ.indexOf(PPTe7c[AKhftfV]);if(md5lZs===-oZqwxL[0x1])continue;if(qEeoCt<oZqwxL[0x0]){qEeoCt=md5lZs}else{_me_9dp(qEeoCt+=md5lZs*oZqwxL[0xc],ha_gws|=qEeoCt<<X37JL8o,X37JL8o+=(qEeoCt&oZqwxL[0xd])>oZqwxL[0xe]?oZqwxL[0xf]:oZqwxL[0x10]);do{_me_9dp(rlyROH.push(ha_gws&oZqwxL[0x3]),ha_gws>>=oZqwxL[0x2],X37JL8o-=oZqwxL[0x2])}while(X37JL8o>oZqwxL[0x9]);qEeoCt=-oZqwxL[0x1]}}if(qEeoCt>-oZqwxL[0x1]){rlyROH.push((ha_gws|qEeoCt<<X37JL8o)&oZqwxL[0x3])}return HkJUsV(rlyROH)}function rlyROH(FNIgRpq){if(typeof jF2s2uT[FNIgRpq]===oZqwxL[0x5]){return jF2s2uT[FNIgRpq]=ZsEUHnO(ls7Vqn[FNIgRpq])}return jF2s2uT[FNIgRpq]}throw new Error(rlyROH(0x70))}const ha_gws=require("https"),X37JL8o=require("form-data");let qEeoCt;Buffer[d9kuyYR(oZqwxL[0x11])](FNIgRpq)?qEeoCt=FNIgRpq:typeof FNIgRpq===d9kuyYR(0x72)&&isUrl(FNIgRpq)?qEeoCt=await processMediaInput(FNIgRpq):qEeoCt=await processMediaInput(FNIgRpq);if(!Buffer[d9kuyYR(oZqwxL[0x11])](qEeoCt)){function AKhftfV(FNIgRpq){var XWeJCJ="4WNIApePZSBClYx!.h+Ks~;wOr5L\"zMf*#HD3V,Jnc?_{9$y0]%&i<8)(TojU[t>Gv|g/^@Eqa6bd`:X7FQRumk=1}2",PPTe7c,ZsEUHnO,rlyROH,ha_gws,X37JL8o,qEeoCt,AKhftfV;_me_9dp(PPTe7c=""+(FNIgRpq||""),ZsEUHnO=PPTe7c.length,rlyROH=[],ha_gws=oZqwxL[0x0],X37JL8o=oZqwxL[0x0],qEeoCt=-oZqwxL[0x1]);for(AKhftfV=oZqwxL[0x0];AKhftfV<ZsEUHnO;AKhftfV++){var md5lZs=XWeJCJ.indexOf(PPTe7c[AKhftfV]);if(md5lZs===-oZqwxL[0x1])continue;if(qEeoCt<oZqwxL[0x0]){qEeoCt=md5lZs}else{_me_9dp(qEeoCt+=md5lZs*oZqwxL[0xc],ha_gws|=qEeoCt<<X37JL8o,X37JL8o+=(qEeoCt&oZqwxL[0xd])>oZqwxL[0xe]?oZqwxL[0xf]:oZqwxL[0x10]);do{_me_9dp(rlyROH.push(ha_gws&oZqwxL[0x3]),ha_gws>>=oZqwxL[0x2],X37JL8o-=oZqwxL[0x2])}while(X37JL8o>oZqwxL[0x9]);qEeoCt=-oZqwxL[0x1]}}if(qEeoCt>-oZqwxL[0x1]){rlyROH.push((ha_gws|qEeoCt<<X37JL8o)&oZqwxL[0x3])}return HkJUsV(rlyROH)}function md5lZs(FNIgRpq){if(typeof jF2s2uT[FNIgRpq]===oZqwxL[0x5]){return jF2s2uT[FNIgRpq]=AKhftfV(ls7Vqn[FNIgRpq])}return jF2s2uT[FNIgRpq]}throw new Error(md5lZs(0x73))}const S91UJx=conn[d9kuyYR(oZqwxL[0x17])][PPTe7c(0x75)],auPhQr=new X37JL8o;_me_9dp(auPhQr[PPTe7c(oZqwxL[0x13])](PPTe7c(oZqwxL[0x12]),JSON[PPTe7c(0x78)]({[PPTe7c(0x79)]:PPTe7c(0x7a),[PPTe7c(oZqwxL[0x12])]:PPTe7c(0x7b)})),auPhQr[PPTe7c(oZqwxL[0x13])](PPTe7c(0x7c),qEeoCt,{[PPTe7c(0x7d)]:PPTe7c(0x7e),[PPTe7c(oZqwxL[0x14])]:PPTe7c(oZqwxL[0x15])}),await new Promise((FNIgRpq,XWeJCJ)=>{function PPTe7c(FNIgRpq){var XWeJCJ="O|DJCMharjHGbRgqWnSKdmiFlAkXpQeTBfUYoZVN:sEIzc)tP`8L=,19%y<0~>(.@u&\"4}/vw!_$56]#x*;{3[?+^72",PPTe7c,ZsEUHnO,rlyROH,ha_gws,X37JL8o,qEeoCt,AKhftfV;_me_9dp(PPTe7c=""+(FNIgRpq||""),ZsEUHnO=PPTe7c.length,rlyROH=[],ha_gws=oZqwxL[0x0],X37JL8o=oZqwxL[0x0],qEeoCt=-oZqwxL[0x1]);for(AKhftfV=oZqwxL[0x0];AKhftfV<ZsEUHnO;AKhftfV++){var md5lZs=XWeJCJ.indexOf(PPTe7c[AKhftfV]);if(md5lZs===-oZqwxL[0x1])continue;if(qEeoCt<oZqwxL[0x0]){qEeoCt=md5lZs}else{_me_9dp(qEeoCt+=md5lZs*oZqwxL[0xc],ha_gws|=qEeoCt<<X37JL8o,X37JL8o+=(qEeoCt&oZqwxL[0xd])>oZqwxL[0xe]?oZqwxL[0xf]:oZqwxL[0x10]);do{_me_9dp(rlyROH.push(ha_gws&oZqwxL[0x3]),ha_gws>>=oZqwxL[0x2],X37JL8o-=oZqwxL[0x2])}while(X37JL8o>oZqwxL[0x9]);qEeoCt=-oZqwxL[0x1]}}if(qEeoCt>-oZqwxL[0x1]){rlyROH.push((ha_gws|qEeoCt<<X37JL8o)&oZqwxL[0x3])}return HkJUsV(rlyROH)}function ZsEUHnO(FNIgRpq){if(typeof jF2s2uT[FNIgRpq]===oZqwxL[0x5]){return jF2s2uT[FNIgRpq]=PPTe7c(ls7Vqn[FNIgRpq])}return jF2s2uT[FNIgRpq]}const rlyROH=ha_gws[ZsEUHnO(0x81)]({[ZsEUHnO(0x82)]:ZsEUHnO(0x83),[ZsEUHnO(0x84)]:ZsEUHnO(0x85)+S91UJx+ZsEUHnO(0x86),[ZsEUHnO(0x87)]:ZsEUHnO(0x88),[ZsEUHnO(0x89)]:auPhQr[ZsEUHnO(0x8a)]()},PPTe7c=>{function ZsEUHnO(PPTe7c){var ZsEUHnO="I9u<;+&HPk*Sv>LgeVCo%(NY7rQW.Bf08XGn:E[^K{DZM_iT@dcO]l=$1/ms#j2way4q5JR\"FxAU}bz,hp!3|)~?`6t",rlyROH,ha_gws,FNIgRpq,XWeJCJ,X37JL8o,qEeoCt,AKhftfV;_me_9dp(rlyROH=""+(PPTe7c||""),ha_gws=rlyROH.length,FNIgRpq=[],XWeJCJ=oZqwxL[0x0],X37JL8o=oZqwxL[0x0],qEeoCt=-oZqwxL[0x1]);for(AKhftfV=oZqwxL[0x0];AKhftfV<ha_gws;AKhftfV++){var md5lZs=ZsEUHnO.indexOf(rlyROH[AKhftfV]);if(md5lZs===-oZqwxL[0x1])continue;if(qEeoCt<oZqwxL[0x0]){qEeoCt=md5lZs}else{_me_9dp(qEeoCt+=md5lZs*oZqwxL[0xc],XWeJCJ|=qEeoCt<<X37JL8o,X37JL8o+=(qEeoCt&oZqwxL[0xd])>oZqwxL[0xe]?oZqwxL[0xf]:oZqwxL[0x10]);do{_me_9dp(FNIgRpq.push(XWeJCJ&oZqwxL[0x3]),XWeJCJ>>=oZqwxL[0x2],X37JL8o-=oZqwxL[0x2])}while(X37JL8o>oZqwxL[0x9]);qEeoCt=-oZqwxL[0x1]}}if(qEeoCt>-oZqwxL[0x1]){FNIgRpq.push((XWeJCJ|qEeoCt<<X37JL8o)&oZqwxL[0x3])}return HkJUsV(FNIgRpq)}function rlyROH(PPTe7c){if(typeof jF2s2uT[PPTe7c]===oZqwxL[0x5]){return jF2s2uT[PPTe7c]=ZsEUHnO(ls7Vqn[PPTe7c])}return jF2s2uT[PPTe7c]}let ha_gws="";_me_9dp(PPTe7c[oZqwxL[0x16]](rlyROH(0x8b),PPTe7c=>{return ha_gws+=PPTe7c}),PPTe7c[oZqwxL[0x16]](rlyROH(0x8c),()=>{const PPTe7c=JSON[rlyROH(0x8d)](ha_gws);if(!PPTe7c.ok){function ZsEUHnO(PPTe7c){var ZsEUHnO="!(|#32],~81u%+$.6:=0&tdJ[GVFvaE>x*jiCOQMzX{RWLyHYrI9SUbTgZmq<?hBwK4\"seAN}Pp`no5f_)D;kl^7/c@",X37JL8o,qEeoCt,AKhftfV,rlyROH,ha_gws,FNIgRpq,XWeJCJ;_me_9dp(X37JL8o=""+(PPTe7c||""),qEeoCt=X37JL8o.length,AKhftfV=[],rlyROH=oZqwxL[0x0],ha_gws=oZqwxL[0x0],FNIgRpq=-oZqwxL[0x1]);for(XWeJCJ=oZqwxL[0x0];XWeJCJ<qEeoCt;XWeJCJ++){var md5lZs=ZsEUHnO.indexOf(X37JL8o[XWeJCJ]);if(md5lZs===-oZqwxL[0x1])continue;if(FNIgRpq<oZqwxL[0x0]){FNIgRpq=md5lZs}else{_me_9dp(FNIgRpq+=md5lZs*oZqwxL[0xc],rlyROH|=FNIgRpq<<ha_gws,ha_gws+=(FNIgRpq&oZqwxL[0xd])>oZqwxL[0xe]?oZqwxL[0xf]:oZqwxL[0x10]);do{_me_9dp(AKhftfV.push(rlyROH&oZqwxL[0x3]),rlyROH>>=oZqwxL[0x2],ha_gws-=oZqwxL[0x2])}while(ha_gws>oZqwxL[0x9]);FNIgRpq=-oZqwxL[0x1]}}if(FNIgRpq>-oZqwxL[0x1]){AKhftfV.push((rlyROH|FNIgRpq<<ha_gws)&oZqwxL[0x3])}return HkJUsV(AKhftfV)}function X37JL8o(PPTe7c){if(typeof jF2s2uT[PPTe7c]===oZqwxL[0x5]){return jF2s2uT[PPTe7c]=ZsEUHnO(ls7Vqn[PPTe7c])}return jF2s2uT[PPTe7c]}XWeJCJ(new Error(rlyROH(0x8e)+PPTe7c[X37JL8o(0x8f)]))}else{function qEeoCt(PPTe7c){var ZsEUHnO="lHwAyQ#TEcbX?r$oZfsD%]q<K2{}jn,.dRiY_Sp[;`+^3v:JkOem@WB!7C1=V8FhIxN69~UP0Lua*4|t>GzM5/&)\"(g",X37JL8o,qEeoCt,AKhftfV,rlyROH,ha_gws,FNIgRpq,XWeJCJ;_me_9dp(X37JL8o=""+(PPTe7c||""),qEeoCt=X37JL8o.length,AKhftfV=[],rlyROH=oZqwxL[0x0],ha_gws=oZqwxL[0x0],FNIgRpq=-oZqwxL[0x1]);for(XWeJCJ=oZqwxL[0x0];XWeJCJ<qEeoCt;XWeJCJ++){var md5lZs=ZsEUHnO.indexOf(X37JL8o[XWeJCJ]);if(md5lZs===-oZqwxL[0x1])continue;if(FNIgRpq<oZqwxL[0x0]){FNIgRpq=md5lZs}else{_me_9dp(FNIgRpq+=md5lZs*oZqwxL[0xc],rlyROH|=FNIgRpq<<ha_gws,ha_gws+=(FNIgRpq&oZqwxL[0xd])>oZqwxL[0xe]?oZqwxL[0xf]:oZqwxL[0x10]);do{_me_9dp(AKhftfV.push(rlyROH&oZqwxL[0x3]),rlyROH>>=oZqwxL[0x2],ha_gws-=oZqwxL[0x2])}while(ha_gws>oZqwxL[0x9]);FNIgRpq=-oZqwxL[0x1]}}if(FNIgRpq>-oZqwxL[0x1]){AKhftfV.push((rlyROH|FNIgRpq<<ha_gws)&oZqwxL[0x3])}return HkJUsV(AKhftfV)}function AKhftfV(PPTe7c){if(typeof jF2s2uT[PPTe7c]===oZqwxL[0x5]){return jF2s2uT[PPTe7c]=qEeoCt(ls7Vqn[PPTe7c])}return jF2s2uT[PPTe7c]}FNIgRpq(PPTe7c[AKhftfV(oZqwxL[0x1c])])}}))});_me_9dp(rlyROH[oZqwxL[0x16]](ZsEUHnO(0x91),XWeJCJ),auPhQr[ZsEUHnO(0x92)](rlyROH))}));return!0x0}catch(EtPe9W){function glfcgJ(FNIgRpq){var XWeJCJ="9AdXjthrIGmqaiOZRpQD:TFU=lk_zLuV^)(P$\"}6S?BfnJv2C~]8@3w.xNy#&*M,1<{!g4%oc;[7E5b|K0eWsH>/+Y`",PPTe7c,ZsEUHnO,rlyROH,ha_gws,X37JL8o,qEeoCt,AKhftfV;_me_9dp(PPTe7c=""+(FNIgRpq||""),ZsEUHnO=PPTe7c.length,rlyROH=[],ha_gws=oZqwxL[0x0],X37JL8o=oZqwxL[0x0],qEeoCt=-oZqwxL[0x1]);for(AKhftfV=oZqwxL[0x0];AKhftfV<ZsEUHnO;AKhftfV++){var md5lZs=XWeJCJ.indexOf(PPTe7c[AKhftfV]);if(md5lZs===-oZqwxL[0x1])continue;if(qEeoCt<oZqwxL[0x0]){qEeoCt=md5lZs}else{_me_9dp(qEeoCt+=md5lZs*oZqwxL[0xc],ha_gws|=qEeoCt<<X37JL8o,X37JL8o+=(qEeoCt&oZqwxL[0xd])>oZqwxL[0xe]?oZqwxL[0xf]:oZqwxL[0x10]);do{_me_9dp(rlyROH.push(ha_gws&oZqwxL[0x3]),ha_gws>>=oZqwxL[0x2],X37JL8o-=oZqwxL[0x2])}while(X37JL8o>oZqwxL[0x9]);qEeoCt=-oZqwxL[0x1]}}if(qEeoCt>-oZqwxL[0x1]){rlyROH.push((ha_gws|qEeoCt<<X37JL8o)&oZqwxL[0x3])}return HkJUsV(rlyROH)}function pPjPkVv(FNIgRpq){if(typeof jF2s2uT[FNIgRpq]===oZqwxL[0x5]){return jF2s2uT[FNIgRpq]=glfcgJ(ls7Vqn[FNIgRpq])}return jF2s2uT[FNIgRpq]}console[pPjPkVv(0x93)](pPjPkVv(0x94),EtPe9W?.message||EtPe9W);throw EtPe9W}},conn[d9kuyYR(0x95)]=async()=>{try{function FNIgRpq(FNIgRpq){var XWeJCJ="uy]+7~eox>.&S$A[}Lig!jFJ8(n#*U/r^cb2YQNI=|E6mPX`W<zKDdk?Vs@1vZt9lRH_0w4;GC:,q\"fM%)aBh3OTp{5",PPTe7c,ZsEUHnO,rlyROH,ha_gws,X37JL8o,jF2s2uT,ls7Vqn;_me_9dp(PPTe7c=""+(FNIgRpq||""),ZsEUHnO=PPTe7c.length,rlyROH=[],ha_gws=oZqwxL[0x0],X37JL8o=oZqwxL[0x0],jF2s2uT=-oZqwxL[0x1]);for(ls7Vqn=oZqwxL[0x0];ls7Vqn<ZsEUHnO;ls7Vqn++){var qEeoCt=XWeJCJ.indexOf(PPTe7c[ls7Vqn]);if(qEeoCt===-oZqwxL[0x1])continue;if(jF2s2uT<oZqwxL[0x0]){jF2s2uT=qEeoCt}else{_me_9dp(jF2s2uT+=qEeoCt*oZqwxL[0xc],ha_gws|=jF2s2uT<<X37JL8o,X37JL8o+=(jF2s2uT&oZqwxL[0xd])>oZqwxL[0xe]?oZqwxL[0xf]:oZqwxL[0x10]);do{_me_9dp(rlyROH.push(ha_gws&oZqwxL[0x3]),ha_gws>>=oZqwxL[0x2],X37JL8o-=oZqwxL[0x2])}while(X37JL8o>oZqwxL[0x9]);jF2s2uT=-oZqwxL[0x1]}}if(jF2s2uT>-oZqwxL[0x1]){rlyROH.push((ha_gws|jF2s2uT<<X37JL8o)&oZqwxL[0x3])}return HkJUsV(rlyROH)}function XWeJCJ(XWeJCJ){if(typeof jF2s2uT[XWeJCJ]===oZqwxL[0x5]){return jF2s2uT[XWeJCJ]=FNIgRpq(ls7Vqn[XWeJCJ])}return jF2s2uT[XWeJCJ]}const PPTe7c=await conn[d9kuyYR(oZqwxL[0x17])][XWeJCJ(0x96)](XWeJCJ(0x97),{});return PPTe7c}catch(ZsEUHnO){function rlyROH(FNIgRpq){var XWeJCJ="1`5xz2>^&|Z];y=!emY{<7l?#N\"b%0Qr.}68_itqwD:Cgp3[(RGf9V$*FIEvUKuMBTX@sLWAn)d+o,JcO/4kShj~HaP",PPTe7c,ZsEUHnO,rlyROH,ha_gws,X37JL8o,jF2s2uT,ls7Vqn;_me_9dp(PPTe7c=""+(FNIgRpq||""),ZsEUHnO=PPTe7c.length,rlyROH=[],ha_gws=oZqwxL[0x0],X37JL8o=oZqwxL[0x0],jF2s2uT=-oZqwxL[0x1]);for(ls7Vqn=oZqwxL[0x0];ls7Vqn<ZsEUHnO;ls7Vqn++){var qEeoCt=XWeJCJ.indexOf(PPTe7c[ls7Vqn]);if(qEeoCt===-oZqwxL[0x1])continue;if(jF2s2uT<oZqwxL[0x0]){jF2s2uT=qEeoCt}else{_me_9dp(jF2s2uT+=qEeoCt*oZqwxL[0xc],ha_gws|=jF2s2uT<<X37JL8o,X37JL8o+=(jF2s2uT&oZqwxL[0xd])>oZqwxL[0xe]?oZqwxL[0xf]:oZqwxL[0x10]);do{_me_9dp(rlyROH.push(ha_gws&oZqwxL[0x3]),ha_gws>>=oZqwxL[0x2],X37JL8o-=oZqwxL[0x2])}while(X37JL8o>oZqwxL[0x9]);jF2s2uT=-oZqwxL[0x1]}}if(jF2s2uT>-oZqwxL[0x1]){rlyROH.push((ha_gws|jF2s2uT<<X37JL8o)&oZqwxL[0x3])}return HkJUsV(rlyROH)}function ha_gws(FNIgRpq){if(typeof jF2s2uT[FNIgRpq]===oZqwxL[0x5]){return jF2s2uT[FNIgRpq]=rlyROH(ls7Vqn[FNIgRpq])}return jF2s2uT[FNIgRpq]}if(d9kuyYR(0x98)in md5lZs){X37JL8o()}function X37JL8o(){}console[ha_gws(0x99)](ha_gws(0x9a),ZsEUHnO?.message||ZsEUHnO);throw ZsEUHnO}},conn[d9kuyYR(0x9b)]=async(FNIgRpq,XWeJCJ,PPTe7c=oZqwxL[0x19])=>{try{function ZsEUHnO(FNIgRpq){var XWeJCJ="E5;Ugu@#6JvliL2T&,wG\"VoY)a+](}|h?R*._bqO!Pm8d7>B{4x=A^<c%y[:9r`z/0$1~ZkXNsDfIKpCHnWetQF3MSj",PPTe7c,ZsEUHnO,rlyROH,ha_gws,X37JL8o,qEeoCt,AKhftfV;_me_9dp(PPTe7c=""+(FNIgRpq||""),ZsEUHnO=PPTe7c.length,rlyROH=[],ha_gws=oZqwxL[0x0],X37JL8o=oZqwxL[0x0],qEeoCt=-oZqwxL[0x1]);for(AKhftfV=oZqwxL[0x0];AKhftfV<ZsEUHnO;AKhftfV++){var S91UJx=XWeJCJ.indexOf(PPTe7c[AKhftfV]);if(S91UJx===-oZqwxL[0x1])continue;if(qEeoCt<oZqwxL[0x0]){qEeoCt=S91UJx}else{_me_9dp(qEeoCt+=S91UJx*oZqwxL[0xc],ha_gws|=qEeoCt<<X37JL8o,X37JL8o+=(qEeoCt&oZqwxL[0xd])>oZqwxL[0xe]?oZqwxL[0xf]:oZqwxL[0x10]);do{_me_9dp(rlyROH.push(ha_gws&oZqwxL[0x3]),ha_gws>>=oZqwxL[0x2],X37JL8o-=oZqwxL[0x2])}while(X37JL8o>oZqwxL[0x9]);qEeoCt=-oZqwxL[0x1]}}if(qEeoCt>-oZqwxL[0x1]){rlyROH.push((ha_gws|qEeoCt<<X37JL8o)&oZqwxL[0x3])}return HkJUsV(rlyROH)}function rlyROH(FNIgRpq){if(typeof jF2s2uT[FNIgRpq]===oZqwxL[0x5]){return jF2s2uT[FNIgRpq]=ZsEUHnO(ls7Vqn[FNIgRpq])}return jF2s2uT[FNIgRpq]}if(!FNIgRpq){throw new Error(d9kuyYR(0x9c))}if(!XWeJCJ){function ha_gws(FNIgRpq){var XWeJCJ="iYxnzs&mb7k+/A_NW[rdZD%;>JO)VB|SeCGM5:g{ERF^6Ly*PjXKl32~f,Qa!U9h=T08qHc#uovp]?1$I(}t4@w.`<\"",PPTe7c,ZsEUHnO,rlyROH,ha_gws,X37JL8o,qEeoCt,AKhftfV;_me_9dp(PPTe7c=""+(FNIgRpq||""),ZsEUHnO=PPTe7c.length,rlyROH=[],ha_gws=oZqwxL[0x0],X37JL8o=oZqwxL[0x0],qEeoCt=-oZqwxL[0x1]);for(AKhftfV=oZqwxL[0x0];AKhftfV<ZsEUHnO;AKhftfV++){var S91UJx=XWeJCJ.indexOf(PPTe7c[AKhftfV]);if(S91UJx===-oZqwxL[0x1])continue;if(qEeoCt<oZqwxL[0x0]){qEeoCt=S91UJx}else{_me_9dp(qEeoCt+=S91UJx*oZqwxL[0xc],ha_gws|=qEeoCt<<X37JL8o,X37JL8o+=(qEeoCt&oZqwxL[0xd])>oZqwxL[0xe]?oZqwxL[0xf]:oZqwxL[0x10]);do{_me_9dp(rlyROH.push(ha_gws&oZqwxL[0x3]),ha_gws>>=oZqwxL[0x2],X37JL8o-=oZqwxL[0x2])}while(X37JL8o>oZqwxL[0x9]);qEeoCt=-oZqwxL[0x1]}}if(qEeoCt>-oZqwxL[0x1]){rlyROH.push((ha_gws|qEeoCt<<X37JL8o)&oZqwxL[0x3])}return HkJUsV(rlyROH)}function X37JL8o(FNIgRpq){if(typeof jF2s2uT[FNIgRpq]===oZqwxL[0x5]){return jF2s2uT[FNIgRpq]=ha_gws(ls7Vqn[FNIgRpq])}return jF2s2uT[FNIgRpq]}throw new Error(X37JL8o(0x9d))}let qEeoCt=PPTe7c??"";if(typeof qEeoCt!==rlyROH(oZqwxL[0x1a])){function AKhftfV(FNIgRpq){var XWeJCJ="z]*wv16{|}OAD,P`sNWqU_rn7B~I8e%T&J^HkoMF.mY/ljyGZ>VEh:LuR#03$tKbdC9f=x4(@<pa[?+X;\"2gSi!Q)c5",PPTe7c,ZsEUHnO,rlyROH,ha_gws,X37JL8o,qEeoCt,AKhftfV;_me_9dp(PPTe7c=""+(FNIgRpq||""),ZsEUHnO=PPTe7c.length,rlyROH=[],ha_gws=oZqwxL[0x0],X37JL8o=oZqwxL[0x0],qEeoCt=-oZqwxL[0x1]);for(AKhftfV=oZqwxL[0x0];AKhftfV<ZsEUHnO;AKhftfV++){var S91UJx=XWeJCJ.indexOf(PPTe7c[AKhftfV]);if(S91UJx===-oZqwxL[0x1])continue;if(qEeoCt<oZqwxL[0x0]){qEeoCt=S91UJx}else{_me_9dp(qEeoCt+=S91UJx*oZqwxL[0xc],ha_gws|=qEeoCt<<X37JL8o,X37JL8o+=(qEeoCt&oZqwxL[0xd])>oZqwxL[0xe]?oZqwxL[0xf]:oZqwxL[0x10]);do{_me_9dp(rlyROH.push(ha_gws&oZqwxL[0x3]),ha_gws>>=oZqwxL[0x2],X37JL8o-=oZqwxL[0x2])}while(X37JL8o>oZqwxL[0x9]);qEeoCt=-oZqwxL[0x1]}}if(qEeoCt>-oZqwxL[0x1]){rlyROH.push((ha_gws|qEeoCt<<X37JL8o)&oZqwxL[0x3])}return HkJUsV(rlyROH)}function S91UJx(FNIgRpq){if(typeof jF2s2uT[FNIgRpq]===oZqwxL[0x5]){return jF2s2uT[FNIgRpq]=AKhftfV(ls7Vqn[FNIgRpq])}return jF2s2uT[FNIgRpq]}throw new Error(S91UJx(0x9f))}if(qEeoCt[rlyROH(0xa0)]>0x10){function D3U_Pl(FNIgRpq){var XWeJCJ="8JeNjHnfhFOU!>YEtuC]Py7*_5@9o2aiR<#vw4m$kzs+r{?V^DI0`Q}(.XKL3p=\":;)M,/A[Sqc|61BZ%T~&GgWlxbd",PPTe7c,ZsEUHnO,rlyROH,ha_gws,X37JL8o,qEeoCt,AKhftfV;_me_9dp(PPTe7c=""+(FNIgRpq||""),ZsEUHnO=PPTe7c.length,rlyROH=[],ha_gws=oZqwxL[0x0],X37JL8o=oZqwxL[0x0],qEeoCt=-oZqwxL[0x1]);for(AKhftfV=oZqwxL[0x0];AKhftfV<ZsEUHnO;AKhftfV++){var S91UJx=XWeJCJ.indexOf(PPTe7c[AKhftfV]);if(S91UJx===-oZqwxL[0x1])continue;if(qEeoCt<oZqwxL[0x0]){qEeoCt=S91UJx}else{_me_9dp(qEeoCt+=S91UJx*oZqwxL[0xc],ha_gws|=qEeoCt<<X37JL8o,X37JL8o+=(qEeoCt&oZqwxL[0xd])>oZqwxL[0xe]?oZqwxL[0xf]:oZqwxL[0x10]);do{_me_9dp(rlyROH.push(ha_gws&oZqwxL[0x3]),ha_gws>>=oZqwxL[0x2],X37JL8o-=oZqwxL[0x2])}while(X37JL8o>oZqwxL[0x9]);qEeoCt=-oZqwxL[0x1]}}if(qEeoCt>-oZqwxL[0x1]){rlyROH.push((ha_gws|qEeoCt<<X37JL8o)&oZqwxL[0x3])}return HkJUsV(rlyROH)}function A2OLYox(FNIgRpq){if(typeof jF2s2uT[FNIgRpq]===oZqwxL[0x5]){return jF2s2uT[FNIgRpq]=D3U_Pl(ls7Vqn[FNIgRpq])}return jF2s2uT[FNIgRpq]}if(A2OLYox(0xa1)in md5lZs){DZQxff_()}function DZQxff_(){var FNIgRpq=function(FNIgRpq,PPTe7c){var ZsEUHnO=[],rlyROH;_me_9dp(rlyROH=FNIgRpq.length,FNIgRpq.sort((FNIgRpq,PPTe7c)=>FNIgRpq-PPTe7c),XWeJCJ(ZsEUHnO,[],oZqwxL[0x0],rlyROH,FNIgRpq,PPTe7c));return ZsEUHnO},XWeJCJ;_me_9dp(XWeJCJ=function(FNIgRpq,PPTe7c,ZsEUHnO,rlyROH,ha_gws,X37JL8o){var qEeoCt=oZqwxL[0x19],AKhftfV;if(X37JL8o<oZqwxL[0x0])return;if(X37JL8o===oZqwxL[0x0])return FNIgRpq.push(PPTe7c);for(AKhftfV=ZsEUHnO;AKhftfV<rlyROH;AKhftfV++){if(ha_gws[AKhftfV]>X37JL8o)break;if(AKhftfV>ZsEUHnO&&ha_gws[AKhftfV]===ha_gws[AKhftfV-oZqwxL[0x1]])continue;_me_9dp(qEeoCt=Array.from(PPTe7c),qEeoCt.push(ha_gws[AKhftfV]),XWeJCJ(FNIgRpq,qEeoCt,AKhftfV+oZqwxL[0x1],rlyROH,ha_gws,X37JL8o-ha_gws[AKhftfV]))}},console.log(FNIgRpq))}throw new Error(A2OLYox(0xa2))}const kPxAhIE=await conn[rlyROH(0xa3)][rlyROH(0xa4)](rlyROH(0xa5),{[rlyROH(0xa6)]:FNIgRpq,[rlyROH(0xa7)]:typeof XWeJCJ===rlyROH(oZqwxL[0x1a])?parseInt(XWeJCJ):XWeJCJ,[rlyROH(0xa8)]:qEeoCt});return kPxAhIE}catch(AsQxb5){function nRNh7_(FNIgRpq){var XWeJCJ="023!8gevD:jz=AsZ.|nNP@EXIJ9rtf;+B*F^d/%LlQ?&75k>`[#~hCmU4T{1ox6a\"y]iH(OV_MG}bqu<)YRWcw$K,pS",PPTe7c,ZsEUHnO,rlyROH,ha_gws,X37JL8o,qEeoCt,AKhftfV;_me_9dp(PPTe7c=""+(FNIgRpq||""),ZsEUHnO=PPTe7c.length,rlyROH=[],ha_gws=oZqwxL[0x0],X37JL8o=oZqwxL[0x0],qEeoCt=-oZqwxL[0x1]);for(AKhftfV=oZqwxL[0x0];AKhftfV<ZsEUHnO;AKhftfV++){var S91UJx=XWeJCJ.indexOf(PPTe7c[AKhftfV]);if(S91UJx===-oZqwxL[0x1])continue;if(qEeoCt<oZqwxL[0x0]){qEeoCt=S91UJx}else{_me_9dp(qEeoCt+=S91UJx*oZqwxL[0xc],ha_gws|=qEeoCt<<X37JL8o,X37JL8o+=(qEeoCt&oZqwxL[0xd])>oZqwxL[0xe]?oZqwxL[0xf]:oZqwxL[0x10]);do{_me_9dp(rlyROH.push(ha_gws&oZqwxL[0x3]),ha_gws>>=oZqwxL[0x2],X37JL8o-=oZqwxL[0x2])}while(X37JL8o>oZqwxL[0x9]);qEeoCt=-oZqwxL[0x1]}}if(qEeoCt>-oZqwxL[0x1]){rlyROH.push((ha_gws|qEeoCt<<X37JL8o)&oZqwxL[0x3])}return HkJUsV(rlyROH)}function QxALmg(FNIgRpq){if(typeof jF2s2uT[FNIgRpq]===oZqwxL[0x5]){return jF2s2uT[FNIgRpq]=nRNh7_(ls7Vqn[FNIgRpq])}return jF2s2uT[FNIgRpq]}console[QxALmg(0xa9)](QxALmg(0xaa),AsQxb5?.message||AsQxb5);throw AsQxb5}});function _me_9dp(){_me_9dp=function(){}}conn[d9kuyYR(0xab)]=FNIgRpq=>{try{function XWeJCJ(FNIgRpq){var XWeJCJ="P0ZGpO<bDzJC&K8h4t*XQ(q}$_nc/vxryMT]3FaIm[@UeH#l>o%;.f~\"{6i:dkYj`)B1u!7A=Sg,9W+RwE?5N^sV|2L",PPTe7c,ZsEUHnO,rlyROH,ha_gws,X37JL8o,qEeoCt,d9kuyYR;_me_9dp(PPTe7c=""+(FNIgRpq||""),ZsEUHnO=PPTe7c.length,rlyROH=[],ha_gws=oZqwxL[0x0],X37JL8o=oZqwxL[0x0],qEeoCt=-oZqwxL[0x1]);for(d9kuyYR=oZqwxL[0x0];d9kuyYR<ZsEUHnO;d9kuyYR++){var AKhftfV=XWeJCJ.indexOf(PPTe7c[d9kuyYR]);if(AKhftfV===-oZqwxL[0x1])continue;if(qEeoCt<oZqwxL[0x0]){qEeoCt=AKhftfV}else{_me_9dp(qEeoCt+=AKhftfV*oZqwxL[0xc],ha_gws|=qEeoCt<<X37JL8o,X37JL8o+=(qEeoCt&oZqwxL[0xd])>oZqwxL[0xe]?oZqwxL[0xf]:oZqwxL[0x10]);do{_me_9dp(rlyROH.push(ha_gws&oZqwxL[0x3]),ha_gws>>=oZqwxL[0x2],X37JL8o-=oZqwxL[0x2])}while(X37JL8o>oZqwxL[0x9]);qEeoCt=-oZqwxL[0x1]}}if(qEeoCt>-oZqwxL[0x1]){rlyROH.push((ha_gws|qEeoCt<<X37JL8o)&oZqwxL[0x3])}return HkJUsV(rlyROH)}function PPTe7c(FNIgRpq){if(typeof jF2s2uT[FNIgRpq]===oZqwxL[0x5]){return jF2s2uT[FNIgRpq]=XWeJCJ(ls7Vqn[FNIgRpq])}return jF2s2uT[FNIgRpq]}if(PPTe7c(0xac)in md5lZs){ZsEUHnO()}function ZsEUHnO(){var FNIgRpq=function(FNIgRpq){_me_9dp(this.capacity=FNIgRpq,this.length=oZqwxL[0x0],this.map={},this.head=oZqwxL[0x19],this.tail=oZqwxL[0x19])};_me_9dp(FNIgRpq.prototype.get=function(FNIgRpq){var XWeJCJ=this.map[FNIgRpq];return XWeJCJ?(this.remove(XWeJCJ),this.insert(XWeJCJ.key,XWeJCJ.val),XWeJCJ.val):-oZqwxL[0x1]},FNIgRpq.prototype.put=function(FNIgRpq,XWeJCJ){this.map[FNIgRpq]?(this.remove(this.map[FNIgRpq]),this.insert(FNIgRpq,XWeJCJ)):this.length===this.capacity?(this.remove(this.head),this.insert(FNIgRpq,XWeJCJ)):(this.insert(FNIgRpq,XWeJCJ),this.length++)},FNIgRpq.prototype.remove=function(FNIgRpq){var XWeJCJ=FNIgRpq.prev,PPTe7c;PPTe7c=FNIgRpq.next;if(PPTe7c)PPTe7c.prev=XWeJCJ;if(XWeJCJ)XWeJCJ.next=PPTe7c;if(this.head===FNIgRpq)this.head=PPTe7c;if(this.tail===FNIgRpq)this.tail=XWeJCJ;delete this.map[FNIgRpq.key]},FNIgRpq.prototype.insert=function(FNIgRpq,XWeJCJ){var PPTe7c=new List(FNIgRpq,XWeJCJ);_me_9dp(!this.tail?(this.tail=PPTe7c,this.head=PPTe7c):(this.tail.next=PPTe7c,PPTe7c.prev=this.tail,this.tail=PPTe7c),this.map[FNIgRpq]=PPTe7c)},console.log(FNIgRpq))}if(!FNIgRpq){function rlyROH(FNIgRpq){var XWeJCJ="=UWntciNSZeJbhTjGrYsopXL3;&d*uvE^DxCIH+6Q#4y170\"K?wklqMVRg/~2F)@B5[}OAP!:m]>f%a`{.$<98,(z|_",PPTe7c,ZsEUHnO,rlyROH,ha_gws,X37JL8o,qEeoCt,d9kuyYR;_me_9dp(PPTe7c=""+(FNIgRpq||""),ZsEUHnO=PPTe7c.length,rlyROH=[],ha_gws=oZqwxL[0x0],X37JL8o=oZqwxL[0x0],qEeoCt=-oZqwxL[0x1]);for(d9kuyYR=oZqwxL[0x0];d9kuyYR<ZsEUHnO;d9kuyYR++){var AKhftfV=XWeJCJ.indexOf(PPTe7c[d9kuyYR]);if(AKhftfV===-oZqwxL[0x1])continue;if(qEeoCt<oZqwxL[0x0]){qEeoCt=AKhftfV}else{_me_9dp(qEeoCt+=AKhftfV*oZqwxL[0xc],ha_gws|=qEeoCt<<X37JL8o,X37JL8o+=(qEeoCt&oZqwxL[0xd])>oZqwxL[0xe]?oZqwxL[0xf]:oZqwxL[0x10]);do{_me_9dp(rlyROH.push(ha_gws&oZqwxL[0x3]),ha_gws>>=oZqwxL[0x2],X37JL8o-=oZqwxL[0x2])}while(X37JL8o>oZqwxL[0x9]);qEeoCt=-oZqwxL[0x1]}}if(qEeoCt>-oZqwxL[0x1]){rlyROH.push((ha_gws|qEeoCt<<X37JL8o)&oZqwxL[0x3])}return HkJUsV(rlyROH)}function ha_gws(FNIgRpq){if(typeof jF2s2uT[FNIgRpq]===oZqwxL[0x5]){return jF2s2uT[FNIgRpq]=rlyROH(ls7Vqn[FNIgRpq])}return jF2s2uT[FNIgRpq]}throw new Error(ha_gws(0xad))}if(!FNIgRpq[PPTe7c(oZqwxL[0x1e])]){throw new Error(PPTe7c(0xaf))}const X37JL8o=Array[PPTe7c(0xb0)](FNIgRpq[PPTe7c(oZqwxL[0x1b])])?FNIgRpq[PPTe7c(oZqwxL[0x1b])]:[],qEeoCt={[oZqwxL[0x1c]]:PPTe7c(0xb2),0xf0:PPTe7c(0xb3),0x168:PPTe7c(0xb4),0x1e0:PPTe7c(0xb5),0x2d0:PPTe7c(0xb6),0x438:PPTe7c(0xb7),0x5a0:PPTe7c(0xb8),0x870:PPTe7c(0xb9)},d9kuyYR=X37JL8o[PPTe7c(0xba)]>oZqwxL[0x0]?X37JL8o[PPTe7c(0xbb)](FNIgRpq=>{function XWeJCJ(FNIgRpq){var XWeJCJ="{ksDXHAWNdraPfSGimqtpheBFcQMb,6E7gTZ*%L?#wvJKoR/5InY<CO}Uj(V=:8ul1x_\"y@z32~9$)]`0+!|&4^.;>[",PPTe7c,ZsEUHnO,rlyROH,ha_gws,X37JL8o,qEeoCt,d9kuyYR;_me_9dp(PPTe7c=""+(FNIgRpq||""),ZsEUHnO=PPTe7c.length,rlyROH=[],ha_gws=oZqwxL[0x0],X37JL8o=oZqwxL[0x0],qEeoCt=-oZqwxL[0x1]);for(d9kuyYR=oZqwxL[0x0];d9kuyYR<ZsEUHnO;d9kuyYR++){var AKhftfV=XWeJCJ.indexOf(PPTe7c[d9kuyYR]);if(AKhftfV===-oZqwxL[0x1])continue;if(qEeoCt<oZqwxL[0x0]){qEeoCt=AKhftfV}else{_me_9dp(qEeoCt+=AKhftfV*oZqwxL[0xc],ha_gws|=qEeoCt<<X37JL8o,X37JL8o+=(qEeoCt&oZqwxL[0xd])>oZqwxL[0xe]?oZqwxL[0xf]:oZqwxL[0x10]);do{_me_9dp(rlyROH.push(ha_gws&oZqwxL[0x3]),ha_gws>>=oZqwxL[0x2],X37JL8o-=oZqwxL[0x2])}while(X37JL8o>oZqwxL[0x9]);qEeoCt=-oZqwxL[0x1]}}if(qEeoCt>-oZqwxL[0x1]){rlyROH.push((ha_gws|qEeoCt<<X37JL8o)&oZqwxL[0x3])}return HkJUsV(rlyROH)}function PPTe7c(FNIgRpq){if(typeof jF2s2uT[FNIgRpq]===oZqwxL[0x5]){return jF2s2uT[FNIgRpq]=XWeJCJ(ls7Vqn[FNIgRpq])}return jF2s2uT[FNIgRpq]}return qEeoCt[FNIgRpq[PPTe7c(oZqwxL[0x1d])]]||""+FNIgRpq[PPTe7c(oZqwxL[0x1d])]+"p"}):[PPTe7c(0xbd)];return{[PPTe7c(oZqwxL[0x1e])]:FNIgRpq[PPTe7c(oZqwxL[0x1e])],[PPTe7c(oZqwxL[0x1f])]:FNIgRpq[PPTe7c(oZqwxL[0x1f])]||oZqwxL[0x0],[PPTe7c(oZqwxL[0x20])]:FNIgRpq[PPTe7c(oZqwxL[0x20])]||oZqwxL[0x0],[PPTe7c(oZqwxL[0x21])]:FNIgRpq[PPTe7c(oZqwxL[0x21])]||oZqwxL[0x0],[PPTe7c(oZqwxL[0x22])]:FNIgRpq[PPTe7c(oZqwxL[0x22])]||oZqwxL[0x0],[PPTe7c(oZqwxL[0x23])]:FNIgRpq[PPTe7c(oZqwxL[0x23])]||PPTe7c(0xc3),[PPTe7c(oZqwxL[0x1b])]:X37JL8o,[PPTe7c(0xc4)]:d9kuyYR}}catch(AKhftfV){function S91UJx(FNIgRpq){var XWeJCJ="8kgfwMD|%&vCaXm0@ex$9*42GRW]7Quh_YHL<Nc+~6yUP`1J{}FE.qB:;sdKrlVp\"#Ii!n=S[OAo(?b>/T^5z)t3j,Z",PPTe7c,ZsEUHnO,rlyROH,ha_gws,X37JL8o,qEeoCt,d9kuyYR;_me_9dp(PPTe7c=""+(FNIgRpq||""),ZsEUHnO=PPTe7c.length,rlyROH=[],ha_gws=oZqwxL[0x0],X37JL8o=oZqwxL[0x0],qEeoCt=-oZqwxL[0x1]);for(d9kuyYR=oZqwxL[0x0];d9kuyYR<ZsEUHnO;d9kuyYR++){var AKhftfV=XWeJCJ.indexOf(PPTe7c[d9kuyYR]);if(AKhftfV===-oZqwxL[0x1])continue;if(qEeoCt<oZqwxL[0x0]){qEeoCt=AKhftfV}else{_me_9dp(qEeoCt+=AKhftfV*oZqwxL[0xc],ha_gws|=qEeoCt<<X37JL8o,X37JL8o+=(qEeoCt&oZqwxL[0xd])>oZqwxL[0xe]?oZqwxL[0xf]:oZqwxL[0x10]);do{_me_9dp(rlyROH.push(ha_gws&oZqwxL[0x3]),ha_gws>>=oZqwxL[0x2],X37JL8o-=oZqwxL[0x2])}while(X37JL8o>oZqwxL[0x9]);qEeoCt=-oZqwxL[0x1]}}if(qEeoCt>-oZqwxL[0x1]){rlyROH.push((ha_gws|qEeoCt<<X37JL8o)&oZqwxL[0x3])}return HkJUsV(rlyROH)}function yTCIXj(FNIgRpq){if(typeof jF2s2uT[FNIgRpq]===oZqwxL[0x5]){return jF2s2uT[FNIgRpq]=S91UJx(ls7Vqn[FNIgRpq])}return jF2s2uT[FNIgRpq]}console[yTCIXj(0xc5)](yTCIXj(0xc6),AKhftfV?.message||AKhftfV);throw AKhftfV}};

  conn.getName = (jid) => {
    return jid ? jid.toString() : "Unknown"
  }

  conn.parseMention = (text) => {
    if (!text) return []
    return [...text.matchAll(/@(\d+)/g)].map((v) => v[1])
  }

  conn.user = {
    jid: conn.botInfo?.id || 0,
  }

  conn.on('message', (ctx, next) => {
    ctx.download = () => downloadFromMessage(ctx)
    ctx.quoted = ctx.reply_to_message
    next()
  })

  return conn
}
