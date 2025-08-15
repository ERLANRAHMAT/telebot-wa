global.token = "8310293199:AAGw_TNRVCjn89togdTqDH9X-JQXzQo3_m4"
global.ownername = "betabotz" // sesuai username telegram
global.ownerid = ["1344383547"] // jika lebih dari 1 owner maka isi disni
global.premid = "1344383547"
global.botname = "XiaoLann"
global.owner = ["628954231835277", "628954231835287", "62895423183527"] // untuk contact owner sesuaikan dengan ownerid
global.prefix = ["/", ".", "#", "!"]
global.wib = 7
global.wait = "Tunggu Sebentar..."
global.wm = "© Betabotz"
// Message
// Jangan diubah bagian ini 
global.MAX_CAPTION_LENGTH = 3900;
// Ini boleh diubah sesuai kebutuhan
global.message = {
    rowner: "Perintah ini hanya dapat digunakan oleh _*OWNER!*_",
    owner: "Perintah ini hanya dapat digunakan oleh _*Owner Bot*_!",
    premium: "Perintah ini hanya untuk member _*Premium*_!",
    group: "Perintah ini hanya dapat digunakan di grup!",
    private: "Perintah ini hanya dapat digunakan di Chat Pribadi!",
    admin: "Perintah ini hanya dapat digunakan oleh admin grup!",
    error: "Terjadi kesalahan, coba lagi nanti.",
  };

// Port configuration
global.ports = [4000, 3000, 5000, 8000];

// Database configuration
global.limit = 100;

// Apikey
//INI WAJIB DI ISI!//
global.lann = 'BtzApi' 
global.aksesKey = 'BtzApis'
//Daftar terlebih dahulu https://api.betabotz.eu.org

global.APIs = {   
  lann: 'https://api.betabotz.eu.org',
}
global.APIKeys = { 
  'https://api.betabotz.eu.org': global.lann, 
}

let fs = require('fs');
let chalk = require('chalk');

const file = require.resolve(__filename);

fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.redBright(`Update 'config.js'`));
  delete require.cache[file];
  require(file);
});
