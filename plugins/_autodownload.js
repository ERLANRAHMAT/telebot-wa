const fetch = require('node-fetch')
const axios = require('axios');

let handler = m => m

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// DOWNLOADER TIKTOK
async function downloadTikTok(link, m, conn) {
    try {
        if (global.db.data.users[m.sender].limit > 0) {
            const response = await fetch(`https://api.betabotz.eu.org/api/download/tiktok?url=${link}&apikey=${lann}`);
            const data = await response.json();

            if (!data.result || !data.result.video) {
                return m.reply('Tidak ada video yang ditemukan!')
            }

            global.db.data.users[m.sender].limit -= 1

            if (data.result.video.length > 1) {
                for (let v of data.result.video) {
                    await conn.sendMessage(m.chat, { video: v, caption: '*Tiktok Downloader*' }, { quoted: m })
                    await sleep(3000)
                }
            } else {
                await conn.sendMessage(m.chat, { video: data.result.video[0], caption: '*Tiktok Downloader*' }, { quoted: m })
            }
        } else {
            m.reply('Limit kamu habis!')
        }
    } catch (error) {
        console.error(error)
        m.reply('Terjadi kesalahan saat mengunduh video!')
    }
}

// DOWNLOADER DOUYIN
async function downloadDouyin(link, m, conn) {
    try {
        if (global.db.data.users[m.sender].limit > 0) {
            const response = await fetch(`https://api.betabotz.eu.org/api/download/douyin?url=${link}&apikey=${lann}`);
            const data = await response.json();

            if (!data.result.video) return

            global.db.data.users[m.sender].limit -= 1

            if (data.result.video.length > 1) {
                for (let v of data.result.video) {
                    await conn.sendMessage(m.chat, { video: v, caption: '*Douyin Downloader*' }, { quoted: m })
                    await sleep(3000)
                }
            } else {
                await conn.sendMessage(m.chat, { video: data.result.video[0], caption: '*Douyin Downloader*' }, { quoted: m })
            }
        } else {
            m.reply('Limit kamu habis!')
        }
    } catch (error) {
        console.error(error)
    }
}

// DOWNLOADER VIDEY
async function downloadVidey(text, m, conn) {
    try {
        if (global.db.data.users[m.sender].limit > 0) {
            const res = await axios.get(`https://api.betabotz.eu.org/api/download/videy?url=${text}&apikey=${lann}`)
            const data = res.data.result
            global.db.data.users[m.sender].limit -= 5
            await conn.sendMessage(m.chat, { video: data, caption: '*DONE*', fileName: 'videy.mp4' }, { quoted: m })
        } else {
            m.reply('Limit kamu habis!')
        }
    } catch (err) {
        m.reply(`❌ Error: ${err?.message || err}`)
    }
}

// DOWNLOADER MEDIAFIRE
async function downloadMediaFire(args, m, conn) {
    try {
        if (global.db.data.users[m.sender].limit > 0) {
            const response = await fetch(`https://api.filn.xyz/api/downloader/mfdl?apikey=scrx-5ff93b51483f695b49ce383715ade68585ea86e2&url=${args[0]}`);
            const json = await response.json();

            if (!json.status || !json.result) throw new Error('Gagal mengambil data dari MediaFire!')

            const { fileName, fileSize, fileType, uploaded, url } = json.result

            const caption = `
*💌 Name:* ${fileName}
*📊 Size:* ${fileSize}
*🗂️ Type:* ${fileType}
*📨 Uploaded:* ${uploaded}
`.trim()

            global.db.data.users[m.sender].limit -= 5

            const sentMsg = await conn.sendMessage(m.chat, { text: caption }, { quoted: m })
            await conn.sendMessage(m.chat, {
                document: url,
                fileName,
                caption: ''
            }, { quoted: sentMsg })
        } else {
            m.reply('Limit kamu habis!')
        }
    } catch (err) {
        console.error(err)
        m.reply(`❌ Terjadi kesalahan: ${err.message}`)
    }
}

// DOWNLOADER PINTEREST
async function downloadpin(link, m, conn) {
    try {
        if (global.db.data.users[m.sender].limit > 0) {
            const response = await fetch(`https://api.betabotz.eu.org/api/download/pinterest?url=${link}&apikey=${lann}`);
            const res = await response.json();

            const { media_type, image, title, pin_url, video } = res.result.data
            global.db.data.users[m.sender].limit -= 1

            if (media_type === 'video/mp4') {
                await conn.sendMessage(m.chat, {
                    video: video,
                    caption: `*Title:* ${title || 'Tidak tersedia'}\n*Mediatype:* ${media_type}\n*Source Url:* ${pin_url}`
                }, { quoted: m })
            } else {
                await conn.sendMessage(m.chat, {
                    image: image,
                    caption: `*Title:* ${title || 'Tidak tersedia'}\n*Mediatype:* ${media_type}\n*Source Url:* ${pin_url}`
                }, { quoted: m })
            }
        } else {
            m.reply('Limit kamu habis!')
        }
    } catch (error) {
        console.error(error)
    }
}

// DOWNLOADER YOUTUBE
async function downloadyt(link, m, conn) {
    try {
        if (global.db.data.users[m.sender].limit > 0) {
            const response = await axios.get(`https://api.betabotz.eu.org/api/download/ytmp4?url=${link}&apikey=${lann}`)
            const res = response.data.result
            var { mp4, id, title, source, duration, mp3 } = res

            let capt = `*YT MP4*\n\n`
            capt += `◦ *id* : ${id}\n`
            capt += `◦ *title* : ${title}\n`
            capt += `◦ *source* : ${source}\n`
            capt += `◦ *duration* : ${duration}\n`

            global.db.data.users[m.sender].limit -= 1

            await conn.sendMessage(m.chat, { audio: mp3, fileName: `${title}.mp3` }, { quoted: m })
            await conn.sendMessage(m.chat, { video: mp4, caption: capt, fileName: `${title}.mp4` }, { quoted: m })
        } else {
            m.reply('Limit kamu habis!')
        }
    } catch (error) {
        console.error(error)
    }
}

// DOWNLOADER INSTAGRAM
async function downloadInstagram(link, m, conn) {
    try {
        if (global.db.data.users[m.sender].limit > 0) {
            const response = await fetch(`https://api.betabotz.eu.org/api/download/igdowloader?url=${link}&apikey=${lann}`);
            const message = await response.json()
            global.db.data.users[m.sender].limit -= 1

            for (let i of message.message) {
                await conn.sendMessage(m.chat, { video: i._url, caption: '*Instagram Downloader*' }, { quoted: m })
                await sleep(2000)
            }
        } else {
            m.reply('Limit kamu habis!')
        }
    } catch (err) {
        m.reply(`❌ Error: ${err?.message || err}`)
    }
}

// DOWNLOADER FACEBOOK
async function downloadFacebook(link, m, conn) {
    try {
        if (global.db.data.users[m.sender].limit > 0) {
            const response = await fetch(`https://api.betabotz.eu.org/api/download/fbdown?url=${link}&apikey=${lann}`);
            const js = await response.json()
            global.db.data.users[m.sender].limit -= 1
            await conn.sendMessage(m.chat, { video: js.result[1]._url, caption: '*Facebook Downloader*', fileName: 'fb.mp4' }, { quoted: m })
        } else {
            m.reply('Limit kamu habis!')
        }
    } catch (error) {
        console.error(error)
    }
}

// DOWNLOADER SPOTIFY
async function _spotify(link, m, conn) {
    try {
        if (global.db.data.users[m.sender].limit > 0) {
            const res = await fetch(`https://api.betabotz.eu.org/api/download/spotify?url=${link}&apikey=${lann}`)
            global.db.data.users[m.sender].limit -= 1
            const jsons = await res.json()
            const { thumbnail, title, url } = jsons.result.data

            await conn.sendMessage(m.chat, {
                audio: url,
                fileName: `${title}.mp3`,
                caption: `*🎵 ${title}*`
            }, { quoted: m })
        } else {
            m.reply('Limit kamu habis!')
        }
    } catch (error) {
        console.error(error)
    }
}

// DOWNLOADER TWITTER
async function _twitter(link, m, conn) {
    try {
        if (global.db.data.users[m.sender].limit > 0) {
            const api = await fetch(`https://api.betabotz.eu.org/api/download/twitter2?url=${link}&apikey=${lann}`)
            global.db.data.users[m.sender].limit -= 1
            const res = await api.json()
            const mediaURLs = res.result.mediaURLs
            const capt = `*Username: ${res.result.user_name} ${res.result.user_screen_name}*\n*Title: ${res.result.text}*\n*Replies: ${res.result.replies}*\n*Retweet: ${res.result.retweets}*`

            for (const url of mediaURLs) {
                const response = await fetch(url)
                const buffer = Buffer.from(await response.arrayBuffer())
                await conn.sendMessage(m.chat, { video: buffer, caption: capt }, { quoted: m })
                await sleep(3000)
            }
        } else {
            m.reply('Limit kamu habis!')
        }
    } catch (error) {
        console.error(error)
    }
}

// DOWNLOADER THREADS
async function _threads(link, m, conn) {
    try {
        if (global.db.data.users[m.sender].limit > 0) {
            const api = await fetch(`https://api.betabotz.eu.org/api/download/threads?url=${link}&apikey=${lann}`)
            const res = await api.json()
            global.db.data.users[m.sender].limit -= 1

            const foto = res.result.image_urls?.[0] || null
            const video = res.result.video_urls?.[0] || null

            if (video) {
                await conn.sendMessage(m.chat, { video: video.download_url, caption: '*THREADS DOWNLOADER*', fileName: 'threads.mp4' }, { quoted: m })
            } else if (foto) {
                await conn.sendMessage(m.chat, { image: foto, caption: '*THREADS DOWNLOADER*' }, { quoted: m })
            } else {
                throw 'Konten tidak ditemukan!'
            }
        } else {
            m.reply('Limit kamu habis!')
        }
    } catch (error) {
        console.error(error)
    }
}

// DOWNLOADER CAPCUT
async function _capcut(link, m, conn) {
    try {
        if (global.db.data.users[m.sender].limit > 0) {
            const response = await fetch(`https://api.betabotz.eu.org/api/download/capcut?url=${link}&apikey=${lann}`)
            global.db.data.users[m.sender].limit -= 1
            const res = await response.json()
            const { video, title, owner } = res.result

            await conn.sendMessage(m.chat, {
                video: video,
                caption: `Title: ${title}\n\nProfile: ${owner}`,
                fileName: 'capcut.mp4'
            }, { quoted: m })
        } else {
            m.reply('Limit kamu habis!')
        }
    } catch (e) {
        console.error(e)
    }
}

/**=========================================**/

handler.before = async function (m, { conn, isPrems }) {
    const chat = global.db.data.chats[m.chat]

    if (!chat.autoDL) return
    if (!m.text) return
    if (m.text.startsWith('=>') || m.text.startsWith('>') || m.text.startsWith('.') ||
        m.text.startsWith('#') || m.text.startsWith('!') || m.text.startsWith('/')) return
    if (chat.isBanned) return
    if (!m.text.includes('http')) return

    const text = m.text.replace(/\n+/g, ' ')

    const tiktokRegex = /^(?:https?:\/\/)?(?:www\.|vt\.|vm\.|t\.)?(?:tiktok\.com\/)(?:\S+)?$/i
    const douyinRegex = /^(?:https?:\/\/)?(?:www\.|vt\.|vm\.|t\.|v\.)?(?:douyin\.com\/)(?:\S+)?$/i
    const instagramRegex = /^(?:https?:\/\/)?(?:www\.)?(?:instagram\.com\/)(?:tv\/|p\/|reel\/)(?:\S+)?$/i
    const facebookRegex = /^(?:https?:\/\/(web\.|www\.|m\.)?(facebook|fb)\.(com|watch)\S+)?$/i
    const youtubeRegex = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([\w\-]{11})(?:\?[\S]*)?$/i
    const pinterestRegex = /^(?:https?:\/\/)?(?:pin\.it)\/([a-zA-Z0-9]+)$/i
    const spotifyRegex = /^(?:https?:\/\/)?(?:open\.spotify\.com\/track\/)([a-zA-Z0-9]+)(?:\S+)?$/i
    const twitterRegex = /^(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/([A-Za-z0-9_]+)\/status\/(\d+)(?:\?[^#]*)?(?:#.*)?$/i
    const threadsRegex = /^(https?:\/\/)?(www\.)?threads\.net(\/[^\s]*)?(\?[^\s]*)?$/
    const capcutRegex = /^https:\/\/www\.capcut\.com\/(t\/[A-Za-z0-9_-]+\/?|template-detail\/\d+\?(?:[^=]+=[^&]+&?)+)$/
    const videyRegex = /^(https?:\/\/)?videy\.co\/v\?id=[a-zA-Z0-9]+$/i
    const mediafireRegex = /^https:\/\/www\.mediafire\.com\/file\/[a-zA-Z0-9]+\/[^\/]+\/file$/

    

    const react = async () => conn.telegram.sendChatAction(m.chat, 'upload_video')

    if (text.match(tiktokRegex)) {
        await react()
        await downloadTikTok(text.match(tiktokRegex)[0], m, conn)
    } else if (text.match(douyinRegex)) {
        await react()
        await downloadDouyin(text.match(douyinRegex)[0], m, conn)
    } else if (text.match(videyRegex)) {
        await react()
        await downloadVidey(text.match(videyRegex)[0], m, conn)
    } else if (text.match(mediafireRegex)) {
        await react()
        await downloadMediaFire([text.match(mediafireRegex)[0]], m, conn)
    } else if (text.match(instagramRegex)) {
        await react()
        await downloadInstagram(text.match(instagramRegex)[0], m, conn)
    } else if (text.match(facebookRegex)) {
        await react()
        await downloadFacebook(text.match(facebookRegex)[0], m, conn)
    } else if (text.match(youtubeRegex)) {
        await react()
        await downloadyt(text.match(youtubeRegex)[0], m, conn)
    } else if (text.match(pinterestRegex)) {
        await react()
        await downloadpin(text.match(pinterestRegex)[0], m, conn)
    } else if (text.match(spotifyRegex)) {
        await react()
        await _spotify(text.match(spotifyRegex)[0], m, conn)
    } else if (text.match(twitterRegex)) {
        await react()
        await _twitter(text.match(twitterRegex)[0], m, conn)
    } else if (text.match(threadsRegex)) {
        await react()
        await _threads(text.match(threadsRegex)[0], m, conn)
    } else if (text.match(capcutRegex)) {
        await react()
        await _capcut(text.match(capcutRegex)[0], m, conn)
    }

    return true
}

module.exports = handler