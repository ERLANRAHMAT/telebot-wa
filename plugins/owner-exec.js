let syntaxerror = require('syntax-error')
let util = require('util')

function escapeMarkdown(text) {
  return text.toString()
    .replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&')
}

function safeCodeBlock(content) {
  if (!content) return ''
  const escaped = content.toString().replace(/```/g, '`‌`‌`')
  return '```\n' + escaped + '\n```'
}

const handler = async (m, extra) => {
  const { conn, usedPrefix, noPrefix, args, groupMetadata } = extra
  let _return
  let _syntax = ''
  let _text = (/^=/.test(usedPrefix) ? 'return ' : '') + noPrefix
  const old = m.exp * 1 
  
  try {
    let i = 15
    const f = {
      exports: {}
    }
    
    const print = (...args) => {
      if (--i < 1) return
      console.log(...args)
      const formattedOutput = util.format(...args)
      return conn.reply(m.chat, escapeMarkdown(formattedOutput), m)
    }
    
    const context = {
      print,
      m,
      handler,
      require,
      conn,
      Array: CustomArray,
      process,
      args,
      groupMetadata,
      module: f,
      exports: f.exports,
      argument: [conn, extra],
      console,
      Buffer,
      JSON,
      Math,
      Date,
      RegExp,
      String,
      Number,
      Boolean,
      Object,
      Array: Array,
      Error,
      Promise,
      setTimeout,
      setInterval,
      clearTimeout,
      clearInterval
    }
    
    const contextKeys = Object.keys(context)
    const contextValues = Object.values(context)
    
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor
    const exec = new AsyncFunction(...contextKeys, _text)
    
    _return = await exec.apply(conn, contextValues)
    
  } catch (e) {
    const err = syntaxerror(_text, 'Execution Function', {
      allowReturnOutsideFunction: true,
      allowAwaitOutsideFunction: true
    })
    if (err) _syntax = safeCodeBlock(err) + '\n\n'
    _return = e
  } finally {
    const finalOutput = _syntax + escapeMarkdown(util.format(_return))
    if (finalOutput.length > 4096) {
      await m.reply( 'Output terlalu panjang, dipotong...', m)
      await m.reply( finalOutput.substring(0, 4000) + '...', m)
    } else {
      await m.reply( finalOutput, m)
    }
    m.exp = old
  }
}

handler.help = ['> ', '=> ']
handler.tags = ['advanced']
handler.customPrefix = /^=?> /
handler.command = /(?:)/i
handler.owner = true

module.exports = handler

class CustomArray extends Array {
  constructor(...args) {
    if (typeof args[0] == 'number') return super(Math.min(args[0], 10000))
    else return super(...args)
  }
}
