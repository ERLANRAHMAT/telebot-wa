const fs = require('fs')
const path = require('path')
const axios = require('axios')
const print = require('./print')
const { getMimeType } = require('./getMime')
const { M } = require('human-readable')

const isUrl = (str) => {
  try {
    new URL(str)
    return true
  } catch {
    return false
  }
}

const isFilePath = (str) => {
  if (typeof str !== 'string') return false
  if (isUrl(str)) return false
  return fs.existsSync(str)
}

const isBuffer = (input) => {
  return Buffer.isBuffer(input)
}

const downloadMedia = async (url) => {
  try {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'arraybuffer',
      timeout: 200000,
      headers: {

        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      maxRedirects: 5
    })
    return Buffer.from(response.data)
  } catch (error) {
    console.error('Download error:', error.message)
    throw new Error(`Failed to download: ${error.message}`)
  }
}

const processMediaInput = async (input) => {
  try {
    if (isBuffer(input)) {
      return input
    }

    if (isUrl(input)) {
      return await downloadMedia(input) 
    }

    if (isFilePath(input)) {
      return fs.readFileSync(input)
    }

    return input
  } catch (error) {
    console.error('Process media error:', error.message)
    throw error
  }
}

const downloadFromMessage = async (ctx) => {
  try {
    if (!ctx.reply_to_message) return null

    const quoted = ctx.reply_to_message

    const getFile = async () => {
      if (quoted.photo) {
        const fileId = quoted.photo[quoted.photo.length - 1].file_id
        return await ctx.telegram.getFile(fileId)
      }
      if (quoted.video) return await ctx.telegram.getFile(quoted.video.file_id)
      if (quoted.audio) return await ctx.telegram.getFile(quoted.audio.file_id)
      if (quoted.document) return await ctx.telegram.getFile(quoted.document.file_id)
      if (quoted.sticker) return await ctx.telegram.getFile(quoted.sticker.file_id)
      return null
    }

    const file = await getFile()
    if (!file) return null

    const response = await axios({
      method: 'GET',
      url: `https://api.telegram.org/file/bot${ctx.telegram.token}/${file.file_path}`,
      responseType: 'arraybuffer'
    })

    return Buffer.from(response.data)

  } catch (e) {
    console.error('Download error:', e)
    return null
  }
}

module.exports = (conn) => {
  conn.telegram.getMe().then(bot => {
    conn.botInfo = bot;
    conn.user = {
      jid: String(bot.id),
      id: String(bot.id),
      username: bot.username || '',
      first_name: bot.first_name || '',
      type: 'bot'
    };
  });
  conn.groupMetadata = async function (chatId) {
    const jid = chatId;
    const chat = await this.telegram.getChat(jid);
    let admins = [];
    try {
      admins = await this.telegram.getChatAdministrators(jid);
    } catch (e) {
      admins = [];
    }
    let memberCount = null;
    try {
      memberCount = await this.telegram.getChatMemberCounts(jid);
    } catch (e) {
      memberCount = null;
    }
    const participants = admins.map((a) => ({
      id: a.user.id,
      username: a.user.username || null,
      first_name: a.user.first_name || null,
      last_name: a.user.last_name || null,
      admin: a.status === 'administrator' || a.status === 'creator' || 'member',
      isCreator: a.status === 'creator',
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
      photo: chat.photo
        ? { small: chat.photo.small_file_id, big: chat.photo.big_file_id }
        : null,
      size: memberCount,
      participants,
    };
  };
  // ---- helpers kecil ----
  const getQuotedId = (q) =>
    q?.message_id || q?.id || q?.msg_id || q?.messageId || undefined;

  const buildVCard = ({ first_name, last_name, phone_number, org, title }) => {
    const fn = [first_name, last_name].filter(Boolean).join(' ').trim() || 'Contact';
    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${fn}`,
      `N:${last_name || ''};${first_name || ''};;;`,
      org ? `ORG:${org}` : null,
      title ? `TITLE:${title}` : null,
      `TEL;TYPE=CELL:${phone_number}`,
      'END:VCARD'
    ].filter(Boolean);
    return lines.join('\n');
  };

  const normalizeContact = (c, defaults = {}) => {
    if (typeof c === 'string' || typeof c === 'number') {
      return {
        phone_number: String(c).trim(),
        first_name: defaults.first_name || 'Contact',
        last_name: defaults.last_name || '',
        vcard: undefined,
      };
    }
    const phone = String(
      c.phone_number || c.phone || c.number || c.num || ''
    ).trim();

    return {
      phone_number: phone,
      first_name: (c.first_name || c.name || defaults.first_name || 'Contact').toString(),
      last_name: (c.last_name || defaults.last_name || '').toString(),
      vcard: c.vcard,
    };
  };

  // ---- fungsi utama ----
  conn.sendContact = async (jid, contacts, caption, quoted, options = {}) => {
    try {
      if (typeof caption === 'object' && caption && !quoted && !options) {
        options = caption; caption = undefined; quoted = undefined;
      } else if (typeof quoted === 'object' && !('message_id' in (quoted || {})) && !options) {
        options = quoted; quoted = undefined;
      }

      const list = Array.isArray(contacts) ? contacts : [contacts];
      if (!list.length) return null;
      const seen = new Set();
      const normalized = list
        .map(c => normalizeContact(c, { first_name: options.default_name }))
        .filter(c => c.phone_number && !seen.has(c.phone_number) && seen.add(c.phone_number));

      const replyId = getQuotedId(quoted);
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
        const extra = {
          reply_to_message_id: captionMsg?.message_id ?? (i === 0 ? replyId : undefined),
          allow_sending_without_reply: true,
          ...options,
        };
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

        // Telegraf: sendContact(chatId, phoneNumber, firstName, extra)\
        // https://telegraf.js.org/classes/Telegram.html#sendContact.sendContact-1
        await delay(5000)
        const res = await conn.telegram.sendContact(jid, c.phone_number, c.first_name, extra);
        results.push(res);
      }
      try { typeof print === 'function' && print({ content: { contacts: normalized }, chat: jid }, conn, true); } catch { }

      return results.length === 1 ? results[0] : results;
    } catch (err) {
      console.error('SendContact error:', err);
      const replyId = getQuotedId(quoted);
      await conn.telegram.sendMessage(jid, caption, {
          reply_to_message_id: replyId,
          allow_sending_without_reply: true,
          parse_mode: options.caption_parse_mode || options.parse_mode || undefined,
          disable_web_page_preview: true,
        });
      // throw err;
    }
  };

  // Menambahkan id pada setiap pesan untuk fitur games
  const aliasId = (r) => {
    if (r && r.message_id != null && r.id == null) r.id = String(r.message_id);
    return r;
  };

  // Original tanpa try catch kalo teksnya kepanjangan send file txt
  // conn.sendMessage = async (jid, content, options = {}) => {
  //   try {
  //     if (!jid || jid === "" || jid === undefined || jid === null) {
  //       throw new Error("Chat ID (jid) is required and cannot be empty")
  //     }
  //     const { text, photo, video, audio, document, sticker, image } = content

  //     if (text) {
  //       const messageText = String(text).trim()
  //       if (!messageText || messageText === "undefined" || messageText === "null") {
  //         return null
  //       }

  //       const opts = {
  //         // parse_mode: "Markdown",
  //         ...options,
  //       }
  //       if (opts.parse_mode === false || opts.parse_mode === null) {
  //         delete opts.parse_mode;
  //       }
  //       if (options.quoted && options.quoted.message_id) {
  //         opts.reply_to_message_id = options.quoted.message_id
  //       }
  //       const result = await conn.telegram.sendMessage(jid, messageText, opts);
  //       if (result && result.message_id != null) result.id = String(result.message_id);

  //       // const result = await conn.telegram.sendMessage(jid, messageText, opts)
  //       aliasId(result);
  //       print({ content: { text: messageText }, chat: jid }, conn, true)
  //       return result
  //     }

  //     if (photo || image) {
  //       const imageInput = photo || image;

  //       // console.log('Image Input', imageInput);
  //       const opts = {
  //         caption: content.caption || "",
  //         // parse_mode: "Markdown",
  //         ...options,
  //       };
  //       if (opts.parse_mode === false || opts.parse_mode === null) {
  //         delete opts.parse_mode;
  //       }
  //       if (options.quoted) {
  //         opts.reply_to_message_id =
  //           options.quoted.message_id || options.quoted.id || options.quoted.msg_id || options.quoted.messageId;
  //       }

  //       const inputIsUrl =
  //         (typeof imageInput === 'string' && isUrl(imageInput)) ||
  //         (imageInput && typeof imageInput === 'object' && typeof imageInput.url === 'string' && isUrl(imageInput.url));

  //       let result;
  //       if (inputIsUrl) {
  //         const url = typeof imageInput === 'string' ? imageInput : imageInput.url;
  //         result = await conn.telegram.sendPhoto(jid, url, opts);
  //       } else {
  //         const buffer = await processMediaInput(imageInput);
  //         result = await conn.telegram.sendPhoto(
  //           jid,
  //           { source: buffer, filename: "image.jpg" },
  //           opts
  //         );
  //       }
  //       aliasId(result);
  //       print({ content: { photo: imageInput, caption: content.caption }, chat: jid }, conn, true);
  //       return result;
  //     }
  //     if (video) {
  //       const videoInput = video;

  //       const opts = {
  //         caption: content.caption || "",
  //         // parse_mode: "Markdown",
  //         ...options,
  //       };
  //       if (opts.parse_mode === false || opts.parse_mode === null) {
  //         delete opts.parse_mode;
  //       }
  //       if (options.quoted) {
  //         opts.reply_to_message_id =
  //           options.quoted.message_id || options.quoted.id || options.quoted.msg_id || options.quoted.messageId;
  //       }

  //       const inputIsUrl =
  //         (typeof videoInput === 'string' && isUrl(videoInput)) ||
  //         (videoInput && typeof videoInput === 'object' && typeof videoInput.url === 'string' && isUrl(videoInput.url));

  //       let result;
  //       if (inputIsUrl) {
  //         const url = typeof videoInput === 'string' ? videoInput : videoInput.url;
  //         result = await conn.telegram.sendVideo(jid, url, { ...opts, supports_streaming: true });
  //       } else {
  //         const buffer = await processMediaInput(videoInput);
  //         result = await conn.telegram.sendVideo(
  //           jid,
  //           { source: buffer, filename: "video.mp4" },
  //           { ...opts, supports_streaming: true }
  //         );
  //       }
  //       aliasId(result);
  //       print({ content: { video: videoInput, caption: content.caption }, chat: jid }, conn, true);
  //       return result;
  //     }
  //     if (audio) {
  //       const audioInput = audio;

  //       const opts = {
  //         caption: content.caption || "",
  //         // parse_mode: "Markdown",
  //         performer: content.performer,
  //         title: content.title,
  //         duration: content.duration,
  //         ...options,
  //       };
  //       if (opts.parse_mode === false || opts.parse_mode === null) {
  //         delete opts.parse_mode;
  //       }
  //       if (options.quoted) {
  //         opts.reply_to_message_id =
  //           options.quoted.message_id || options.quoted.id || options.quoted.msg_id || options.quoted.messageId;
  //       }
  //       const inputIsUrl =
  //         (typeof audioInput === 'string' && isUrl(audioInput)) ||
  //         (audioInput && typeof audioInput === 'object' && typeof audioInput.url === 'string' && isUrl(audioInput.url));

  //       let result;
  //       if (inputIsUrl) {
  //         try {
  //           const probe = await axios.get(typeof audioInput === 'string' ? audioInput : audioInput.url, {
  //             method: 'GET',
  //             responseType: 'stream',
  //             maxRedirects: 2,
  //           });
  //           const ct = probe.headers['content-type'] || '';
  //           if (/^audio\//i.test(ct)) {
  //             result = await conn.telegram.sendAudio(jid, typeof audioInput === 'string' ? audioInput : audioInput.url, opts);
  //           } else {
  //             const { data } = await axios.get(typeof audioInput === 'string' ? audioInput : audioInput.url, {
  //               responseType: 'arraybuffer',
  //             });
  //             const buf = Buffer.from(data);
  //             result = await conn.telegram.sendAudio(jid, { source: buf, filename: 'audio.mp3' }, opts);
  //           }
  //         } catch {
  //           const { data } = await axios.get(typeof audioInput === 'string' ? audioInput : audioInput.url, {
  //             responseType: 'arraybuffer',
  //           });
  //           const buf = Buffer.from(data);
  //           result = await conn.telegram.sendAudio(jid, { source: buf, filename: 'audio.mp3' }, opts);
  //         }
  //       } else {
  //         const buffer = await processMediaInput(audioInput);
  //         result = await conn.telegram.sendAudio(jid, { source: buffer, filename: 'audio.mp3' }, opts);
  //       }

  //       aliasId(result);
  //       print({ content: { audio: audioInput, caption: content.caption }, chat: jid }, conn, true);
  //       return result;
  //     }
  //     if (document) {
  //       const docInput = document;
  //       console.log(content)
  //       // console.log('Document Input', docInput);  
  //       const opts = {
  //         caption: content.caption || "",
  //         // parse_mode: "Markdown",
  //         ...options,
  //       };
  //       console.log(options)
  //       if (opts.parse_mode === false || opts.parse_mode === null) {
  //         delete opts.parse_mode;
  //       }
  //       if (options.quoted) {
  //         opts.reply_to_message_id =
  //           options.quoted.message_id ||
  //           options.quoted.id ||
  //           options.quoted.msg_id ||
  //           options.quoted.messageId;
  //       }

  //       const inputIsUrl =
  //         (typeof docInput === 'string' && isUrl(docInput)) ||
  //         (docInput && typeof docInput === 'object' && typeof docInput.url === 'string' && isUrl(docInput.url));

  //       let result;
  //       let buffer;
  //       let filename = content.fileName || 'document.bin';

  //       if (inputIsUrl) {
  //         buffer = await processMediaInput(typeof docInput === 'string' ? docInput : docInput.url);
  //       } else {
  //         buffer = await processMediaInput(docInput);
  //       }
  //       try {
  //         const mimeType = content.mimetype || getMimeType(buffer) || 'application/octet-stream';
  //         const ext = mimeType.split('/')[1] || 'bin';
  //         filename = content.fileName || `document.${ext}`;
  //       } catch (e) {
  //         console.warn('Gagal deteksi MIME, pakai default .bin');
  //       }

  //       result = await conn.telegram.sendDocument(
  //         jid,
  //         { source: buffer, filename },
  //         opts
  //       );
  //       aliasId(result);
  //       print({ content: { document: docInput, caption: content.caption }, chat: jid }, conn, true);
  //       return result;
  //     }
  //     if (sticker) {
  //       const processedSticker = await processMediaInput(sticker)

  //       const opts = {
  //         ...options,
  //       }
  //       if (options.quoted && options.quoted.message_id) {
  //         opts.reply_to_message_id = options.quoted.message_id
  //       }
  //       const result = await conn.telegram.sendSticker(jid, processedSticker, opts)
  //       print({ content: { sticker }, chat: jid }, conn, true)
  //       return result
  //     }

  //     throw new Error("No valid content provided")
  //   } catch (error) {
  //     console.error('SendMessage error:', error.message)
  //     throw error
  //   }
  // }
  conn.sendMessage = async (jid, content, options = {}) => {
    try {
      if (!jid || jid === "" || jid === undefined || jid === null) {
        throw new Error("Chat ID (jid) is required and cannot be empty");
      }

      const aliasId = (r) => {
        if (r && r.message_id != null && r.id == null) r.id = String(r.message_id);
        return r;
      };

      const CAP_LIMIT = MAX_CAPTION_LENGTH;

      // helper ambil reply_to_message_id dari quoted
      const resolveReplyTo = (q) => {
        if (!q) return undefined;
        return q.message_id || q.id || q.msg_id || q.messageId || (q.key && q.key.id);
      };

      const { text, photo, video, audio, document, sticker, image } = content;

      // TEXT
      if (text) {
        const messageText = String(text).trim();
        if (!messageText || messageText === "undefined" || messageText === "null") {
          return null;
        }

        const baseOpts = { ...options };
        if (baseOpts.parse_mode === false || baseOpts.parse_mode === null) delete baseOpts.parse_mode;

        const rid = resolveReplyTo(options.quoted);
        if (rid) baseOpts.reply_to_message_id = rid;

        // jika text melebihi limit, kirim sebagai dokumen .txt
        if (messageText.length > CAP_LIMIT) {
          const txtBuffer = Buffer.from(messageText, 'utf-8');
          const docRes = await conn.telegram.sendDocument(
            jid,
            { source: txtBuffer, filename: 'description.txt' },
            { ...baseOpts, caption: '📄 Pesan terlalu panjang, dikirim sebagai file:' }
          );
          aliasId(docRes);
          print(
            { content: { document: 'conn.sendMessage text terlalu panjang mengirim menjadi file.txt' }, chat: jid },
            conn,
            true
          );
          return docRes;
        }

        // normal: kirim sebagai pesan teks
        const result = await conn.telegram.sendMessage(jid, messageText, baseOpts);
        if (result && result.message_id != null) result.id = String(result.message_id);
        aliasId(result);
        print({ content: { text: messageText }, chat: jid }, conn, true);
        return result;
      }

      // IMAGE / PHOTO
      if (photo || image) {
        const imageInput = photo || image;
        const caption = content.caption || "";

        const baseOpts = { ...options };
        if (baseOpts.parse_mode === false || baseOpts.parse_mode === null) delete baseOpts.parse_mode;
        const rid = resolveReplyTo(options.quoted);
        if (rid) baseOpts.reply_to_message_id = rid;

        const inputIsUrl =
          (typeof imageInput === 'string' && isUrl(imageInput)) ||
          (imageInput && typeof imageInput === 'object' && typeof imageInput.url === 'string' && isUrl(imageInput.url));

        let result;
        const sendPhoto = async (optsWithCaption) => {
          if (inputIsUrl) {
            const url = typeof imageInput === 'string' ? imageInput : imageInput.url;
            return conn.telegram.sendPhoto(jid, url, optsWithCaption);
          } else {
            const buffer = await processMediaInput(imageInput);
            return conn.telegram.sendPhoto(jid, { source: buffer, filename: "image.jpg" }, optsWithCaption);
          }
        };

        if (caption && caption.length > CAP_LIMIT) {
          // kirim foto tanpa caption
          result = await sendPhoto({ ...baseOpts, caption: "" });
          aliasId(result);
          print({ content: { photo: imageInput, caption: "" }, chat: jid }, conn, true);

          // kirim caption sebagai teks terpisah mereply media
          const txtBuffer = Buffer.from(caption, 'utf-8');
          const textRes = await conn.telegram.sendDocument(jid, {
            source: txtBuffer,
            filename: 'description.txt',
          }, {
            ...options,
            caption: '📄 Caption terlalu panjang, dikirim sebagai file:',
            reply_to_message_id: result.message_id,
          });

          aliasId(textRes);
          print({ content: { document: 'conn.sendMessage caption terlalu panjang mengirim menjadi file.txt' }, chat: jid }, conn, true);
        } else {
          result = await sendPhoto({ ...baseOpts, caption });
          aliasId(result);
          print({ content: { photo: imageInput, caption }, chat: jid }, conn, true);
        }
        return result;
      }

      // VIDEO
      if (video) {
        const videoInput = video;
        const caption = content.caption || "";

        const baseOpts = { ...options };
        if (baseOpts.parse_mode === false || baseOpts.parse_mode === null) delete baseOpts.parse_mode;
        const rid = resolveReplyTo(options.quoted);
        if (rid) baseOpts.reply_to_message_id = rid;

        const inputIsUrl =
          (typeof videoInput === 'string' && isUrl(videoInput)) ||
          (videoInput && typeof videoInput === 'object' && typeof videoInput.url === 'string' && isUrl(videoInput.url));

        let result;
        const sendVideo = async (optsWithCaption) => {
          if (inputIsUrl) {
            const url = typeof videoInput === 'string' ? videoInput : videoInput.url;
            return conn.telegram.sendVideo(jid, url, { ...optsWithCaption, supports_streaming: true });
          } else {
            const buffer = await processMediaInput(videoInput);
            return conn.telegram.sendVideo(
              jid,
              { source: buffer, filename: "video.mp4" },
              { ...optsWithCaption, supports_streaming: true }
            );
          }
        };

        if (caption && caption.length > CAP_LIMIT) {
          result = await sendVideo({ ...baseOpts, caption: "" });
          aliasId(result);
          print({ content: { video: videoInput, caption: "" }, chat: jid }, conn, true);

          const txtBuffer = Buffer.from(caption, 'utf-8');
          const textRes = await conn.telegram.sendDocument(jid, {
            source: txtBuffer,
            filename: 'description.txt',
          }, {
            ...options,
            caption: '📄 Caption terlalu panjang, dikirim sebagai file:',
            reply_to_message_id: result.message_id,
          });

          aliasId(textRes);
          print({ content: { document: 'conn.sendMessage caption terlalu panjang mengirim menjadi file.txt' }, chat: jid }, conn, true);
        } else {
          result = await sendVideo({ ...baseOpts, caption });
          aliasId(result);
          print({ content: { video: videoInput, caption }, chat: jid }, conn, true);
        }
        return result;
      }

      // AUDIO
      if (audio) {
        const audioInput = audio;
        const caption = content.caption || "";

        const baseOpts = {
          performer: content.performer,
          title: content.title,
          duration: content.duration,
          ...options,
        };
        if (baseOpts.parse_mode === false || baseOpts.parse_mode === null) delete baseOpts.parse_mode;
        const rid = resolveReplyTo(options.quoted);
        if (rid) baseOpts.reply_to_message_id = rid;

        const inputIsUrl =
          (typeof audioInput === 'string' && isUrl(audioInput)) ||
          (audioInput && typeof audioInput === 'object' && typeof audioInput.url === 'string' && isUrl(audioInput.url));

        let result;
        const sendAudio = async (optsWithCaption) => {
          if (inputIsUrl) {
            try {
              const probe = await axios.get(typeof audioInput === 'string' ? audioInput : audioInput.url, {
                method: 'GET',
                responseType: 'stream',
                maxRedirects: 2,
              });
              const ct = probe.headers['content-type'] || '';
              if (/^audio\//i.test(ct)) {
                return conn.telegram.sendAudio(jid, (typeof audioInput === 'string' ? audioInput : audioInput.url), optsWithCaption);
              } else {
                const { data } = await axios.get(typeof audioInput === 'string' ? audioInput : audioInput.url, {
                  responseType: 'arraybuffer',
                });
                const buf = Buffer.from(data);
                return conn.telegram.sendAudio(jid, { source: buf, filename: 'audio.mp3' }, optsWithCaption);
              }
            } catch {
              const { data } = await axios.get(typeof audioInput === 'string' ? audioInput : audioInput.url, {
                responseType: 'arraybuffer',
              });
              const buf = Buffer.from(data);
              return conn.telegram.sendAudio(jid, { source: buf, filename: 'audio.mp3' }, optsWithCaption);
            }
          } else {
            const buffer = await processMediaInput(audioInput);
            return conn.telegram.sendAudio(jid, { source: buffer, filename: 'audio.mp3' }, optsWithCaption);
          }
        };

        if (caption && caption.length > CAP_LIMIT) {
          result = await sendAudio({ ...baseOpts, caption: "" });
          aliasId(result);
          print({ content: { audio: audioInput, caption: "" }, chat: jid }, conn, true);

          const txtBuffer = Buffer.from(caption, 'utf-8');
          const textRes = await conn.telegram.sendDocument(jid, {
            source: txtBuffer,
            filename: 'description.txt',
          }, {
            ...options,
            caption: '📄 Caption terlalu panjang, dikirim sebagai file:',
            reply_to_message_id: result.message_id,
          });

          aliasId(textRes);
          print({ content: { document: 'conn.sendMessage caption terlalu panjang mengirim menjadi file.txt' }, chat: jid }, conn, true);
        } else {
          result = await sendAudio({ ...baseOpts, caption });
          aliasId(result);
          print({ content: { audio: audioInput, caption }, chat: jid }, conn, true);
        }
        return result;
      }

      // DOCUMENT
      if (document) {
        const docInput = document;
        const caption = content.caption || "";

        const baseOpts = { ...options };
        if (baseOpts.parse_mode === false || baseOpts.parse_mode === null) delete baseOpts.parse_mode;
        const rid = resolveReplyTo(options.quoted);
        if (rid) baseOpts.reply_to_message_id = rid;

        const inputIsUrl =
          (typeof docInput === 'string' && isUrl(docInput)) ||
          (docInput && typeof docInput === 'object' && typeof docInput.url === 'string' && isUrl(docInput.url));

        let buffer;
        let filename = content.fileName || 'document.bin';

        if (inputIsUrl) {
          buffer = await processMediaInput(typeof docInput === 'string' ? docInput : docInput.url);
        } else {
          buffer = await processMediaInput(docInput);
        }

        try {
          const mimeType = content.mimetype || getMimeType(buffer) || 'application/octet-stream';
          const ext = mimeType.split('/')[1] || 'bin';
          filename = content.fileName || `document.${ext}`;
        } catch (e) {
          console.warn('Gagal deteksi MIME, pakai default .bin');
        }

        let result;
        if (caption && caption.length > CAP_LIMIT) {
          // kirim dokumen tanpa caption
          result = await conn.telegram.sendDocument(
            jid,
            { source: buffer, filename },
            { ...baseOpts, caption: "" }
          );
          aliasId(result);
          print({ content: { document: docInput, caption: "" }, chat: jid }, conn, true);

          // kirim caption sebagai teks terpisah mereply dokumen
          const txtBuffer = Buffer.from(caption, 'utf-8');
          const textRes = await conn.telegram.sendDocument(jid, {
            source: txtBuffer,
            filename: 'description.txt',
          }, {
            ...options,
            caption: '📄 Caption terlalu panjang, dikirim sebagai file:',
            reply_to_message_id: result.message_id,
          });

          aliasId(textRes);
          print({ content: { document: 'conn.sendMessage caption terlalu panjang mengirim menjadi file.txt' }, chat: jid }, conn, true);
        } else {
          result = await conn.telegram.sendDocument(
            jid,
            { source: buffer, filename },
            { ...baseOpts, caption }
          );
          aliasId(result);
          print({ content: { document: docInput, caption }, chat: jid }, conn, true);
        }
        return result;
      }

      // STICKER (tidak ada caption)
      if (sticker) {
        const processedSticker = await processMediaInput(sticker);
        const opts = { ...options };
        const rid = resolveReplyTo(options.quoted);
        if (rid) opts.reply_to_message_id = rid;

        const result = await conn.telegram.sendSticker(jid, processedSticker, opts);
        aliasId(result);
        print({ content: { sticker }, chat: jid }, conn, true);
        return result;
      }

      throw new Error("No valid content provided");
    } catch (error) {
      console.error('SendMessage error:', error.message);
      throw error;
    }
  };

  conn.sendFile = async (jid, path, filename = "", caption = "", quoted, options = {}) => {
    try {
      if (!jid) throw new Error("Chat ID (jid) is required");

      // Handle reply/quoted message
      let reply_to_message_id;
      if (quoted) {
        if (quoted.key) reply_to_message_id = quoted.key.id;
        else if (quoted.message_id) reply_to_message_id = quoted.message_id;
        else if (typeof quoted === 'object') reply_to_message_id = quoted.id || quoted.msg_id || quoted.messageId;
      }

      const opts = {
        caption,
        ...options,
        reply_to_message_id,
      };

      if (opts.parse_mode === false || opts.parse_mode === null) {
        delete opts.parse_mode;
      }

      const fileInput = await processMediaInput(path);
      const fileType = await getFileType(fileInput);
      const MAX_SIZE = 49 * 1024 * 1024;

      // Handle file terlalu besar
      if (fileInput.length > MAX_SIZE) {
        const compressedBuffer = await compressFile(fileInput);
        if (compressedBuffer.length > MAX_SIZE) throw new Error("File too large even after compression");
        return await conn.telegram.sendDocument(jid, {
          source: compressedBuffer,
          filename: filename || 'file.zip',
        }, { ...opts, disable_content_type_detection: false });
      }

      let result;

      // Jika caption terlalu panjang
      if (caption && caption.length > MAX_CAPTION_LENGTH) {
        // 1. Kirim file utama dulu TANPA caption
        const mediaOpts = {
          ...options,
          caption: '',
          reply_to_message_id,
        };

        switch (fileType) {
          case 'image':
            result = await conn.telegram.sendPhoto(jid, { source: fileInput }, mediaOpts);
            break;
          case 'video':
            result = await conn.telegram.sendVideo(jid, { source: fileInput }, { ...mediaOpts, supports_streaming: true });
            break;
          case 'audio':
            result = await conn.telegram.sendAudio(jid, { source: fileInput }, mediaOpts);
            break;
          case 'sticker':
            result = await conn.telegram.sendSticker(jid, { source: fileInput }, mediaOpts);
            break;
          default:
            result = await conn.telegram.sendDocument(jid, { source: fileInput, filename }, mediaOpts);
        }

        // 2. Kirim caption panjang sebagai file .txt
        const txtBuffer = Buffer.from(caption, 'utf-8');
        await conn.telegram.sendDocument(jid, {
          source: txtBuffer,
          filename: 'description.txt',
        }, {
          ...options,
          caption: '📄 Caption terlalu panjang, dikirim sebagai file:',
          reply_to_message_id: result.message_id,
        });

        return result;
      }

      // Jika caption normal, kirim biasa
      switch (fileType) {
        case 'image':
          result = await conn.telegram.sendPhoto(jid, { source: fileInput }, opts);
          break;
        case 'video':
          result = await conn.telegram.sendVideo(jid, { source: fileInput }, { ...opts, supports_streaming: true });
          break;
        case 'audio':
          result = await conn.telegram.sendAudio(jid, { source: fileInput }, opts);
          break;
        case 'sticker':
          result = await conn.telegram.sendSticker(jid, { source: fileInput }, opts);
          break;
        default:
          result = await conn.telegram.sendDocument(jid, { source: fileInput, filename }, opts);
      }
      aliasId(result)
      print({ content: { file: path, type: fileType, caption }, chat: jid }, conn, true);
      return result;

    } catch (error) {
      console.error('SendFile error:', error.message);
      throw error;
    }
  };

  // Helper function to compress files
  async function compressFile(buffer) {
    const zlib = require('zlib')
    const util = require('util')
    const compress = util.promisify(zlib.gzip)

    try {
      return await compress(buffer)
    } catch (err) {
      console.error('Compression error:', err)
      return buffer // Return original if compression fails
    }
  }
  async function getFileType(buffer) {
    if (buffer.length < 4) return 'document'

    // Image formats
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'image' // JPEG
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'image' // PNG
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return 'image' // GIF

    // Video formats
    if (buffer[0] === 0x00 && buffer[1] === 0x00 && buffer[2] === 0x00 &&
      (buffer[3] === 0x18 || buffer[3] === 0x20) &&
      buffer.slice(4, 8).toString() === 'ftyp') return 'video' // MP4
    if (buffer.slice(0, 3).toString() === 'FLV') return 'video'

    // Audio formats
    if (buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WAVE') return 'audio' // WAV
    if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) return 'audio' // MP3

    // WebP/Sticker
    if (buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WEBP') return 'sticker'

    return 'document'
  }

  conn.sendImage = async (jid, image, caption = "", quoted, options = {}) => {
    try {
      if (!jid || jid === "" || jid === undefined || jid === null) {
        throw new Error("Chat ID (jid) is required and cannot be empty")
      }

      const processedImage = await processMediaInput(image)

      const opts = {
        caption,
        // parse_mode: "Markdown",
        ...options,
      }
      if (opts.parse_mode === false || opts.parse_mode === null) {
        delete opts.parse_mode;
      }
      if (quoted && quoted.message_id) {
        opts.reply_to_message_id = quoted.message_id
      }

      const result = await conn.telegram.sendPhoto(jid, processedImage, opts)
      print({ content: { photo: image, caption }, chat: jid }, conn, true)
      return result
    } catch (error) {
      console.error('SendImage error:', error.message)
      throw error
    }
  }

  // Original klo teks kepanjangan ga send file tapi error
  // conn.reply = async (jid, text, quoted, options = {}) => {
  //   try {
  //     if (!jid) return null;
  //     if (!text) return null;

  //     const messageText = String(text).trim();
  //     if (!messageText || messageText === "undefined" || messageText === "null") return null;

  //     const opts = {
  //       parse_mode: "Markdown", // default Markdown
  //       ...options,
  //     };

  //     if (quoted) {
  //       const replyId =
  //         quoted.message_id ||
  //         quoted.id ||
  //         quoted.msg_id ||
  //         quoted.messageId ||
  //         quoted.message?.message_id ||
  //         quoted.reply_to_message?.message_id ||
  //         quoted.key?.id;

  //       if (replyId) opts.reply_to_message_id = replyId;
  //     }

  //     // Kalau memang parse_mode dimatikan → hapus dari opts
  //     if (options.parse_mode === false || options.parse_mode === null) {
  //       delete opts.parse_mode;
  //     }

  //     // Optional: auto-matikan Markdown kalau text punya karakter "bermasalah"
  //     if (/\_|\[|\]|\(|\)|\*/.test(messageText) && !options.parse_mode) {
  //       delete opts.parse_mode;
  //     }

  //     const chatId = typeof jid === 'object' && jid.id ? jid.id : jid;
  //     const result = await conn.telegram.sendMessage(chatId, messageText, opts);

  //     if (result && result.message_id != null) result.id = String(result.message_id);
  //     print({ content: { text: messageText }, chat: chatId }, conn, true);
  //     return result;
  //   } catch (error) {
  //     console.error('Reply error:', error.message);
  //     return null;
  //   }
  // }
  conn.reply = async (jid, text, quoted, options = {}) => {
    try {
      if (!jid) return null;
      if (!text) return null;

      const messageText = String(text).trim();
      if (!messageText || messageText === "undefined" || messageText === "null") return null;

      const chatId = (typeof jid === 'object' && jid.id) ? jid.id : jid;

      const opts = {
        parse_mode: "Markdown",
        ...options,
      };
      if (quoted) {
        const replyId =
          quoted.message_id ||
          quoted.id ||
          quoted.msg_id ||
          quoted.messageId ||
          quoted.message?.message_id ||
          quoted.reply_to_message?.message_id ||
          quoted.key?.id;
        if (replyId) opts.reply_to_message_id = replyId;
      }
      if (options.parse_mode === false || options.parse_mode === null) {
        delete opts.parse_mode;
      }
      if (/[\\_\[\]\(\)\*`~>#+\-=|{}\.!]/.test(messageText) && !options.parse_mode) {
        delete opts.parse_mode;
      }
      const TEXT_LIMIT = MAX_CAPTION_LENGTH
      if (messageText.length > TEXT_LIMIT) {
        const txtBuffer = Buffer.from(messageText, 'utf-8');
        const docRes = await conn.telegram.sendDocument(
          chatId,
          { source: txtBuffer, filename: 'description.txt' },
          { ...opts, caption: '📄 Pesan terlalu panjang, dikirim sebagai file:' }
        );
        if (docRes && docRes.message_id != null) docRes.id = String(docRes.message_id);
        print({ content: { document: 'reply text terlalu panjang -> file.txt' }, chat: chatId }, conn, true);
        return docRes;
      }
      const result = await conn.telegram.sendMessage(chatId, messageText, opts);
      if (result && result.message_id != null) result.id = String(result.message_id);
      print({ content: { text: messageText }, chat: chatId }, conn, true);
      return result;

    } catch (error) {
      console.error('Reply error:', error.message);
      return null;
    }
  };

  conn.sendButt = async (jid, text, buttons, quoted, options = {}) => {
    try {
      if (!jid || jid === "" || jid === undefined || jid === null) {
        throw new Error("Chat ID (jid) is required and cannot be empty")
      }

      if (!text || text === "" || text === undefined || text === null) {
        return null
      }

      const messageText = String(text).trim()
      if (messageText === "" || messageText === "undefined" || messageText === "null") {
        return null
      }

      const opts = {
        // parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: buttons || [],
        },
        ...options,
      }
      if (opts.parse_mode === false || opts.parse_mode === null) {
        delete opts.parse_mode;
      }

      if (quoted && quoted.message_id) {
        opts.reply_to_message_id = quoted.message_id
      }

      const result = await conn.telegram.sendMessage(jid, messageText, opts)
      print({ content: { text: messageText }, chat: jid }, conn, true)
      return result
    } catch (error) {
      console.error('SendButt error:', error.message)
      return null
    }
  }

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
