const { createCanvas, loadImage } = require("canvas")
const fs = require("fs")
const path = require("path")
const uploadImage = require('../lib/uploadImage')

let handler = async (m, { text, conn }) => {
  try {
    const user = global.db.data.users[m.sender]

    if (!user.registered) return m.reply(`Anda belum terdaftar!\nKetik */daftar nama.umur* untuk mendaftar`)

    if (!text) return m.reply(`Serial Number tidak ditemukan!\n\nCara menggunakan:\n*/unreg <SERIAL NUMBER>*`)
    
    const sn = require("crypto").createHash("md5")
      .update(m.sender.toString())
      .digest("hex")
      .slice(0, 25)
      .toUpperCase()

    if (text.toUpperCase() !== sn) {
      return m.reply(`Serial Number salah!\n\nSerial Number anda: *${sn}*`)
    }

    const name = user.name
    const username = m.pushName
    let caption = `✅ Berhasil unregister!\n\nSerial Number: *${sn}*\nAnda sekarang bisa daftar ulang dengan */daftar nama.umur*`

    try {
    const cardBuffer = await generateUnregisterCard({
      nama: name,
      id: m.sender,
      username: username,
      tanggal: new Date().toLocaleDateString("id-ID"),
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

    user.registered = false
    user.name = ""
    user.age = 0
    delete user.regTime
    delete user.sn
    delete user.username

  } catch (error) {
    console.error("Error di handler unregister:", error)
    m.reply(`Terjadi kesalahan: ${error.message}`)
  }
}

async function generateUnregisterCard(data) {
  const WIDTH = 955
  const HEIGHT = 1280
  const canvas = createCanvas(WIDTH, HEIGHT)
  const ctx = canvas.getContext("2d")
 const bgUnreg = path.join(__dirname, "../media/unreg.png")
   
   if (!fs.existsSync(bgUnreg)) {
     throw new Error(`Background file not found`)
   }
 
   let bgImage = null
   
   try {
     bgImage = await loadImage(bgUnreg)
   } catch (loadError) {
     throw new Error(`Failed to load background`)
   }
  ctx.drawImage(bgImage, 0, 0, WIDTH, HEIGHT)

  ctx.fillStyle = "#FFFFFF"
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

  
  ctx.fillStyle = "rgba(234, 251, 255, 0.7)"
  ctx.font = "bold 22px Arial"
  ctx.textAlign = "right"

  const snText = `SN: ${data.sn}`
  ctx.fillText(snText, WIDTH - 60, HEIGHT - 80)
  
  ctx.font = "18px Arial"
  ctx.fillStyle = "rgba(234, 251, 255, 0.7)"
  ctx.fillText(`${wm}`, WIDTH - 60, HEIGHT - 50)

  return canvas.toBuffer("image/png")
}

handler.help = ["unreg <serial number>"]
handler.tags = ["main"]
handler.command = /^(unreg|unregister)$/i
handler.register = true

module.exports = handler