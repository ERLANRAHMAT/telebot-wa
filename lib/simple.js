const fs = require('fs')
const path = require('path')
const axios = require('axios')
const print = require('./print')

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
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
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

  conn.sendMessage = async (jid, content, options = {}) => {
    try {
      if (!jid || jid === "" || jid === undefined || jid === null) {
        throw new Error("Chat ID (jid) is required and cannot be empty")
      }

      const { text, photo, video, audio, document, sticker, image } = content

      if (text) {
        const messageText = String(text).trim()
        if (!messageText || messageText === "undefined" || messageText === "null") {
          return null
        }

        const opts = {
          parse_mode: "Markdown",
          ...options,
        }
        if (options.quoted && options.quoted.message_id) {
          opts.reply_to_message_id = options.quoted.message_id
        }
        const result = await conn.telegram.sendMessage(jid, messageText, opts)
        print({ content: { text: messageText }, chat: jid }, conn, true)
        return result
      }

      if (photo || image) {
        const imageInput = photo || image
        const processedImage = await processMediaInput(imageInput)

        const opts = {
          caption: content.caption || "",
          parse_mode: "Markdown",
          ...options,
        }
        if (options.quoted && options.quoted.message_id) {
          opts.reply_to_message_id = options.quoted.message_id
        }

        const result = await conn.telegram.sendPhoto(jid, processedImage, opts)
        print({ content: { photo: imageInput, caption: content.caption }, chat: jid }, conn, true)
        return result
      }

      if (video) {
        const processedVideo = await processMediaInput(video)

        const opts = {
          caption: content.caption || "",
          parse_mode: "Markdown",
          ...options,
        }
        if (options.quoted && options.quoted.message_id) {
          opts.reply_to_message_id = options.quoted.message_id
        }
        const result = await conn.telegram.sendVideo(jid, processedVideo, opts)
        print({ content: { video, caption: content.caption }, chat: jid }, conn, true)
        return result
      }

      if (audio) {
        const processedAudio = await processMediaInput(audio)

        const opts = {
          caption: content.caption || "",
          parse_mode: "Markdown",
          performer: content.performer,
          title: content.title,
          duration: content.duration,
          ...options,
        }
        if (options.quoted && options.quoted.message_id) {
          opts.reply_to_message_id = options.quoted.message_id
        }
        const result = await conn.telegram.sendAudio(jid, processedAudio, opts)
        print({ content: { audio, caption: content.caption }, chat: jid }, conn, true)
        return result
      }

      if (document) {
        const processedDocument = await processMediaInput(document)

        const opts = {
          caption: content.caption || "",
          parse_mode: "Markdown",
          ...options,
        }
        if (options.quoted && options.quoted.message_id) {
          opts.reply_to_message_id = options.quoted.message_id
        }
        const result = await conn.telegram.sendDocument(jid, processedDocument, opts)
        print({ content: { document, caption: content.caption }, chat: jid }, conn, true)
        return result
      }

      if (sticker) {
        const processedSticker = await processMediaInput(sticker)

        const opts = {
          ...options,
        }
        if (options.quoted && options.quoted.message_id) {
          opts.reply_to_message_id = options.quoted.message_id
        }
        const result = await conn.telegram.sendSticker(jid, processedSticker, opts)
        print({ content: { sticker }, chat: jid }, conn, true)
        return result
      }

      throw new Error("No valid content provided")
    } catch (error) {
      console.error('SendMessage error:', error.message)
      throw error
    }
  }

  // Only uncomment this if you want to use the sendFile method
  // conn.sendFile = async (jid, path, filename = "", caption = "", quoted, options = {}) => {
  //   try {
  //     if (!jid || jid === "" || jid === undefined || jid === null) {
  //       throw new Error("Chat ID (jid) is required and cannot be empty")
  //     }

  //     const opts = {
  //       caption,
  //       parse_mode: "Markdown",
  //       ...options,
  //     }
  //     if (quoted && quoted.message_id) {
  //       opts.reply_to_message_id = quoted.message_id
  //     }

  //     const fileInput = await processMediaInput(path)
  //     const result = await conn.telegram.sendDocument(jid, fileInput, opts)
  //     print({ content: { document: path, caption }, chat: jid }, conn, true)
  //     return result
  //   } catch (error) {
  //     console.error('SendFile error:', error.message)
  //     throw error
  //   }
  // }
  // conn.sendFile = async (jid, path, filename = "", caption = "", quoted, options = {}) => {
  //   try {
  //     if (!jid || jid === "") {
  //       throw new Error("Chat ID (jid) is required")
  //     }

  //     const opts = {
  //       caption,
  //       parse_mode: "Markdown",
  //       ...options,
  //     }
  //     if (quoted?.message_id) {
  //       opts.reply_to_message_id = quoted.message_id
  //     }

  //     const fileInput = await processMediaInput(path)
  //     const fileType = await getFileType(fileInput)

  //     // Split large files into smaller chunks
  //     const MAX_SIZE = 49 * 1024 * 1024 // 49MB chunks
  //     if (fileInput.length > MAX_SIZE) {
  //       // For large files, always send as document with compression
  //       const compressedBuffer = await compressFile(fileInput)
  //       if (compressedBuffer.length > MAX_SIZE) {
  //         throw new Error("File too large even after compression")
  //       }

  //       const result = await conn.telegram.sendDocument(jid, {
  //         source: compressedBuffer,
  //         filename: filename || 'file.zip'
  //       }, {
  //         ...opts,
  //         disable_content_type_detection: false
  //       })
  //       print({ content: { document: path, caption }, chat: jid }, conn, true)
  //       return result
  //     }

  //     // Add retry logic for network errors
  //     const maxRetries = 3
  //     let lastError

  //     for (let i = 0; i < maxRetries; i++) {
  //       try {
  //         let result

  //         switch (fileType) {
  //           case 'image':
  //             result = await conn.telegram.sendPhoto(jid, {
  //               source: fileInput,
  //               filename: filename
  //             }, opts)
  //             break

  //           case 'video':
  //             result = await conn.telegram.sendVideo(jid, {
  //               source: fileInput,
  //               filename: filename
  //             }, {
  //               ...opts,
  //               supports_streaming: true
  //             })
  //             break

  //           case 'audio':
  //             result = await conn.telegram.sendAudio(jid, {
  //               source: fileInput,
  //               filename: filename
  //             }, opts)
  //             break

  //           case 'sticker':
  //             result = await conn.telegram.sendSticker(jid, {
  //               source: fileInput
  //             }, opts)
  //             break

  //           default:
  //             result = await conn.telegram.sendDocument(jid, {
  //               source: fileInput,
  //               filename: filename
  //             }, opts)
  //         }

  //         print({ content: { file: path, type: fileType, caption }, chat: jid }, conn, true)
  //         return result

  //       } catch (err) {
  //         lastError = err
  //         // Only retry on network errors
  //         if (!err.response || err.response.error_code === 502) {
  //           await delay(1000 * (i + 1)) // Exponential backoff
  //           continue
  //         }
  //         throw err
  //       }
  //     }

  //     throw lastError
  //   } catch (error) {
  //     console.error('SendFile error:', error.message)
  //     throw error
  //   }
  // }
  conn.sendFile = async (jid, path, filename = "", caption = "", quoted, options = {}) => {
    try {
      if (!jid) throw new Error("Chat ID (jid) is required")

      // Konversi format quoted dari WhatsApp ke format Telegram
      let reply_to_message_id
      if (quoted) {
        // Jika quoted object dari WhatsApp
        if (quoted.key) {
          reply_to_message_id = quoted.key.id
        }
        // Jika quoted langsung message_id Telegram 
        else if (quoted.message_id) {
          reply_to_message_id = quoted.message_id
        }
        // Jika quoted object generic
        else if (typeof quoted === 'object') {
          reply_to_message_id = quoted.id || quoted.msg_id || quoted.messageId
        }
      }

      const opts = {
        caption,
        parse_mode: "Markdown",
        ...options,
        reply_to_message_id // Tambahkan reply_to_message_id ke options
      }

      const fileInput = await processMediaInput(path)
      const fileType = await getFileType(fileInput)

      // Handle large files
      const MAX_SIZE = 49 * 1024 * 1024
      if (fileInput.length > MAX_SIZE) {
        const compressedBuffer = await compressFile(fileInput)
        if (compressedBuffer.length > MAX_SIZE) {
          throw new Error("File too large even after compression")
        }

        return await conn.telegram.sendDocument(jid, {
          source: compressedBuffer,
          filename: filename || 'file.zip'
        }, {
          ...opts,
          disable_content_type_detection: false
        })
      }

      // Send based on file type
      let result
      switch (fileType) {
        case 'image':
          result = await conn.telegram.sendPhoto(jid, {
            source: fileInput
          }, opts)
          break

        case 'video':
          result = await conn.telegram.sendVideo(jid, {
            source: fileInput
          }, {
            ...opts,
            supports_streaming: true
          })
          break

        case 'audio':
          result = await conn.telegram.sendAudio(jid, {
            source: fileInput
          }, opts)
          break

        case 'sticker':
          result = await conn.telegram.sendSticker(jid, {
            source: fileInput
          }, opts)
          break

        default:
          result = await conn.telegram.sendDocument(jid, {
            source: fileInput,
            filename: filename
          }, opts)
      }

      print({ content: { file: path, type: fileType, caption }, chat: jid }, conn, true)
      return result

    } catch (error) {
      console.error('SendFile error:', error.message)
      throw error
    }
  }

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
        parse_mode: "Markdown",
        ...options,
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

  conn.reply = async (jid, text, quoted, options = {}) => {
    try {
      if (!jid || jid === "" || jid === undefined || jid === null) {
        return null
      }

      if (!text || text === "" || text === undefined || text === null) {
        return null
      }

      const messageText = String(text).trim()
      if (messageText === "" || messageText === "undefined" || messageText === "null") {
        return null
      }

      const opts = {
        parse_mode: "Markdown",
        ...options,
      }

      if (quoted && quoted.message_id) {
        opts.reply_to_message_id = quoted.message_id
      }

      if (options.parse_mode === false || options.parse_mode === null) {
        delete opts.parse_mode
      }

      const result = await conn.telegram.sendMessage(jid, messageText, opts)
      print({ content: { text: messageText }, chat: jid }, conn, true)
      return result
    } catch (error) {
      console.error('Reply error:', error.message)
      return null
    }
  }

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
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: buttons || [],
        },
        ...options,
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
