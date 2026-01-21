const { createCanvas, loadImage } = require("canvas")
const fs = require("fs")
const path = require("path")
const uploadImage = require('../lib/uploadImage')

let handler = async (m, { conn, text, usedPrefix, command }) => {
  try {
    const user = global.db.data.users[m.sender] || {}
    
    if (user.registered) {
      const message = `Anda sudah terdaftar!\nIngin daftar ulang? /unreg <SERIAL NUMBER>`
      await m.reply(message)
      return
    }
    
    
    if (!text)
    return m.reply(
      `Format salah!\n\nPenggunaan:\n${usedPrefix + command} <nama>.<umur>\n\nContoh: ${usedPrefix + command} budi.17`,
    )

   const [nama, umur] = text.split(".")
  if (!nama) return m.reply(`Nama tidak boleh kosong!`)
  if (!umur) return m.reply(`Umur tidak boleh kosong!`)
  if (isNaN(umur)) return m.reply(`Umur harus berupa angka!`)
  if (umur < 5) return m.reply(`Umur minimal 5 tahun!`)
  if (umur > 120) return m.reply(`Umur maksimal 120 tahun!`)
    const username = m.pushName

    const sn = require("crypto").createHash("md5")
      .update(m.sender.toString())
      .digest("hex")
      .slice(0, 25)
      .toUpperCase()

    const tanggal = new Date().toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
    global.db.data.users[m.sender] = {
      ...user,
      name: nama.trim(),
      age: Number.parseInt(umur),
      registered: true,
      regTime: +new Date(),
      id: m.sender,
      username: username,
      sn: sn
    }

    const caption = `
┌─〔 INFO PENGGUNA 〕
├ Nama: ${nama}
├ Umur: ${umur} tahun
├ ID: ${m.sender}
├ Username: @${username}
├ SN: ${sn}
├ Tanggal: ${tanggal}
└────

Selamat! Anda berhasil terdaftar.
Ketik /menu untuk melihat daftar perintah.
`.trim()

    try {
      const cardBuffer = await generateRegisterCard({
        nama: nama.trim(),
        id: m.sender,
        username: username,
        tanggal: tanggal,
        umur: `${umur} tahun`,
        sn: sn
      })

      const photoUrl = await uploadImage(cardBuffer)

      await conn.sendMessage(
        m.chat,
        {
          image: { url: photoUrl },
          caption: caption,
        },
        { quoted: { message_id: m.id } }
      )

    } catch (cardError) {
      console.error("Gagal generate kartu, mengirim caption saja:", cardError.message)
      await m.reply(caption)
    }

  } catch (error) {
    console.error("Error di handler register:", error)
    console.error(error.stack)
    try {
      const errorMsg = `Terjadi kesalahan saat registrasi. Silakan coba lagi atau hubungi admin.`
      await m.reply(errorMsg)
    } catch (e) {
      console.error("Failed to send error message to user:", e)
    }
  }
}

async function generateRegisterCard(data) {
  const WIDTH = 955
  const HEIGHT = 1280
  const canvas = createCanvas(WIDTH, HEIGHT)
  const ctx = canvas.getContext("2d")

  const bgReg = path.join(__dirname, "../media/register.png")
  
  if (!fs.existsSync(bgReg)) {
    throw new Error(`Background file not found`)
  }

  let bgImage = null
  
  try {
    bgImage = await loadImage(bgReg)
  } catch (loadError) {
    throw new Error(`Failed to load background`)
  }
  ctx.drawImage(bgImage, 0, 0, WIDTH, HEIGHT)

  ctx.fillStyle = "#5a3e36"
  ctx.font = "bold 48px Arial"
  ctx.textBaseline = "middle"
  ctx.textAlign = "left"

  const posisi = {
    nama: { x: 320, y: 430 },
    id: { x: 280, y: 650 },
    username: { x: 400, y: 860 },
    tanggal: { x: 420, y: 1080 }
  }

  const MAX_WIDTH = 560

  function drawTextLimit(text, x, y, maxWidth) {
    let output = text.toString()
    const originalFont = ctx.font
    let fontSize = 48
    while (ctx.measureText(output).width > maxWidth && fontSize > 24) {
      fontSize -= 2
      ctx.font = `bold ${fontSize}px Arial`
    }
    
    ctx.fillText(output, x, y)
    ctx.font = originalFont
  }

  drawTextLimit(data.nama, posisi.nama.x, posisi.nama.y, MAX_WIDTH)
  drawTextLimit(data.id.toString(), posisi.id.x, posisi.id.y, MAX_WIDTH)
  drawTextLimit(data.username, posisi.username.x, posisi.username.y, MAX_WIDTH)
  drawTextLimit(data.tanggal, posisi.tanggal.x, posisi.tanggal.y, MAX_WIDTH)

  ctx.fillStyle = "rgba(90, 62, 54, 0.8)"
  ctx.font = "bold 22px Arial"
  ctx.textAlign = "right"
  const snText = `SN: ${data.sn}`
  ctx.fillText(snText, WIDTH - 60, HEIGHT - 80)
  
  ctx.font = "18px Arial"
  ctx.fillStyle = "rgba(90, 62, 54, 0.6)"
  ctx.fillText(`${wm}`, WIDTH - 60, HEIGHT - 50)

  return canvas.toBuffer("image/png")
}

handler.command = /^(daftar|register|reg)$/i
handler.tags = ['main']
handler.help = ['daftar <nama>.<umur>']

module.exports = handler