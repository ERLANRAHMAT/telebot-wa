const TicTacToe = require("../lib/tictactoe")

function getCurrentPlayerId(game) {
  // 1) Kalau ada method currentTurn(): 'x' atau 'o'
  if (typeof game.currentTurn === 'function') {
    const t = String(game.currentTurn()).toLowerCase()
    return t === 'o' ? game.playerO : game.playerX
  }
  // 2) Kalau ada property currentTurn: 'x' / 'o'
  if (typeof game.currentTurn === 'string') {
    const t = game.currentTurn.toLowerCase()
    return t === 'o' ? game.playerO : game.playerX
  }
  // 3) Fallback boolean _currentTurn (berdasarkan dump kamu: false di awal)
  if (typeof game._currentTurn === 'boolean') {
    // asumsi: false = X jalan, true = O jalan
    return game._currentTurn ? game.playerO : game.playerX
  }
  // 4) Paritas turn
  if (typeof game.turns === 'number') {
    return game.turns % 2 === 0 ? game.playerX : game.playerO
  }
  // default
  return game.playerX
}

const cellEmoji = v => ({
  X: '❌', O: '⭕',
  1: '1️⃣', 2: '2️⃣', 3: '3️⃣',
  4: '4️⃣', 5: '5️⃣', 6: '6️⃣',
  7: '7️⃣', 8: '8️⃣', 9: '9️⃣',
}[v] || v)

let handler = async (m, { conn, usedPrefix, command, text }) => {
  conn.game = conn.game || {}

  // larang user join lebih dari 1 game
  if (Object.values(conn.game).find(room => room.id.startsWith('tictactoe') && [room.game.playerX, room.game.playerO].includes(m.sender))) {
    throw 'Kamu masih didalam game'
  }

  // cari room menunggu (opsional by name)
  let room = Object.values(conn.game).find(room => room.state === 'WAITING' && (text ? room.name === text : true))

  if (room) {
    // join sebagai O
    await m.reply('Partner ditemukan!')
    room.o = m.chat
    room.game.playerO = m.sender
    room.state = 'PLAYING'

    const arr = room.game.render().map(cellEmoji)
    const turnId = getCurrentPlayerId(room.game)

    const str = [
      `Room ID: ${room.id}`,
      `${arr.slice(0,3).join('')}`,
      `${arr.slice(3,6).join('')}`,
      `${arr.slice(6).join('')}`,
      ``,
      `Menunggu: <a href="tg://user?id=${turnId}">giliran</a>`,
      `Ketik "nyerah" untuk menyerah`,
    ].join('\n')

    // NOTE: urutan argumen reply(conn.reply) di projekmu biasanya (chatId, text, quoted?, options?)
    if (room.x !== room.o) await conn.sendMessage(room.x, { text: str }, { quoted: m, parse_mode: 'HTML' })
    await conn.sendMessage(room.o, { text: str }, { quoted: m, parse_mode: 'HTML' })

  } else {
    // buat room baru: X = pembuat
    room = {
      id: 'tictactoe-' + (+new Date()),
      x: m.chat,
      o: '',
      game: new TicTacToe(m.sender, 'o'), // lib kamu tampaknya menerima (playerX, 'o') dsb.
      state: 'WAITING',
    }
    if (text) room.name = text

    await m.reply('Menunggu partner' + (text ? `\nKetik:\n${usedPrefix}${command} ${text}` : ''))
    conn.game[room.id] = room
  }
}

handler.help = ['tictactoe', 'ttt'].map(v => v + ' [custom room name]')
handler.tags = ['game']
handler.command = /^(tictactoe|t{3})$/

module.exports = handler
