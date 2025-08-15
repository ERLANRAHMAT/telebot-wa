let fetch = require('node-fetch');

let handler = async (m, { conn }) => {
	let img = 'https://api.betabotz.eu.org/api/tools/uploader-get?id=QWdBQ0FnVUFBeUVHQUFTclJWR2lBQUVCYzkxb2pLX0pnN2NEMkxlMjBSVERjbl96WGNyOVd3QUNHc2t4R19YRGFWU19yUmFLZ01HNlhBRUFBd0lBQTNnQUF6WUU6OjU4NjYyNzM5Njg6QUFFcHVLbFNGRW9Pd2ZScF9kUG9zVlZPbWVCa2JybWhlMFk=&mime=image/jpeg'
        let truth = await fetch(`https://api.betabotz.eu.org/api/random/truth?apikey=${lann}`).then(result => result.json()) 
	conn.sendFile(m.chat, img, 'truth.png', `*TRUTH*\n\n“${truth.result}”`, m)
}
handler.help = ['truth']
handler.tags = ['fun']
handler.command = /^(truth|kebenaran|kejujuran)$/i
handler.limit = true

module.exports = handler
