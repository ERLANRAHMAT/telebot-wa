const similarity = require('similarity')
const threshold = 0.72
const rewardAmount = 1000

const normalize = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFKC')
  .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
  .trim()
  .replace(/\s+/g, ' ')

const mentionText = (who) => {
  if (!who) return ''
  if (typeof who === 'string') return '@' + who.replace(/^@/, '')
  if (typeof who === 'number') return `(id:${who})`
  if (who.username) return '@' + who.username
  if (who.id) return `(id:${who.id})`
  return ''
}

module.exports = {
  async before(m) {
    // gunakan store di this (conn)
    const store = this.family = this.family || {}
    const id = m.chat
    if (!store[id]) return !0

    const room = store[id]
    if (!room || !Array.isArray(room.jawaban)) {
      delete store[id]
      return !0
    }

    // normalisasi input
    const input = normalize(m.text || '')
    if (!input) return !0

    // menyerah
    if (input === 'nyerah') {
      const allAnswers = room.jawaban
        .filter(Boolean)
        .map((ans, i) => `(${i + 1}) ${ans}`)
        .join('\n')
      await this.reply(m.chat, `Permainan berakhir karena menyerah.\n\nJawaban yang benar:\n${allAnswers}`, room.msg, { parse_mode: false })
      clearTimeout(room.timeout)
      delete store[id]
      return !0
    }

    // siapkan terjawab
    room.terjawab = Array.isArray(room.terjawab) ? room.terjawab : new Array(room.jawaban.length).fill(false)

    // daftar kandidat (belum terjawab & tidak kosong)
    const indexed = room.jawaban.map((j, i) => ({ j: String(j || '').trim(), n: normalize(j), i }))
    const candidates = indexed.filter(({ j, n, i }) => j && n && !room.terjawab[i])

    // exact match
    let hitIndex = -1
    const exact = candidates.find(({ n }) => n === input)
    if (exact) {
      hitIndex = exact.i
    } else {
      // similarity check
      let best = 0; let bestIdx = -1
      for (const { n, i } of candidates) {
        const score = similarity(n, input)
        if (score > best) { best = score; bestIdx = i }
      }
      if (best >= threshold) {
        await m.reply('Dikit lagi!')
      } else {
        await m.reply('*Salah!*')
      }
      return !0
    }

    if (hitIndex < 0 || room.terjawab[hitIndex]) return !0

    // simpan penjawab sebagai objek (aman dirender)
    room.terjawab[hitIndex] = {
      id: m.sender,
      username: m.usertag || m.username || null,
      name: m.pushName || m.name || null,
    }

    // hadiah
    const users = global?.db?.data?.users?.[m.sender]
    if (users) users.money = (users.money || 0) + rewardAmount

    // status menang?
    const isWin = room.terjawab.filter(Boolean).length === room.jawaban.length

    // render board
    const body = room.jawaban
      .map((jawaban, i) => room.terjawab[i]
        ? `(${i + 1}) ${jawaban} ${mentionText(room.terjawab[i])}`.trim()
        : null)
      .filter(Boolean)
      .join('\n')

    const hasSpaced = room.jawaban.some(v => (v || '').includes(' '))
    const caption = `
Soal: ${room.soal}

Terdapat ${room.jawaban.length} jawaban${hasSpaced ? '\n(beberapa jawaban terdapat spasi)' : ''}
${isWin ? 'SEMUA JAWABAN TERJAWAB\nSelamat, Anda telah menjawab semua jawaban dengan benar!' : ''}
${body}

+${rewardAmount} kredit sosial tiap jawaban benar
    `.trim()

    // update pesan (tanpa parse_mode biar aman)
    try {
      if (store[id].msg_old?.key) {
        await this.sendMessage(m.chat, { delete: store[id].msg_old.key }).catch(() => {})
      }
      const msg_old = await this.reply(m.chat, caption, m, { parse_mode: false })
        .then(msg => (store[id].msg = msg))
        .catch(() => null)
      store[id].msg_old = msg_old
    } catch {}

    if (isWin) {
      clearTimeout(room.timeout)
      setTimeout(() => {
        try { this.sendMessage(m.chat, { delete: store[id].msg.key }).catch(() => {}) } catch {}
        delete store[id]
      }, 10_000)
    }
    return !0
  }
}
