require("./config")
const cluster = require('cluster');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const express = require('express');

const ports = global.ports
let availablePortIndex = 0;
let version = 'unknown';

function checkPort(port) {
  return new Promise((resolve, reject) => {
    const app = express();
    const server = app.listen(port, () => {
      server.close();
      resolve(true);
    });
    server.on('error', reject);
  });
}

async function startServer() {
  const port = ports[availablePortIndex];
  try {
    const isPortAvailable = await checkPort(port);

    if (isPortAvailable) {
      console.log('\x1b[33m%s\x1b[0m', `🌐 Port ${port} is open`);

      const app = express();

      app.get('/', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        const data = {
          status: 'true',
          message: 'Bot Successfully Activated!',
          author: 'BETABOTZ'
        };
        const result = {
          response: data
        };
        res.send(JSON.stringify(result, null, 2));
      });

      app.listen(port);
    }
  } catch (error) {
    console.log(`Port ${port} is already in use. Trying another port...`);
    availablePortIndex++;

    if (availablePortIndex >= ports.length) {
      console.log('No more available ports. Exiting...');
      process.exit(1);
    } else {
      ports[availablePortIndex] = parseInt(port) + 1;
      await startServer();
    }
  }
}

startServer();

let isRunning = false;

function start(file) {
  if (isRunning) return;
  isRunning = true;

  const args = [path.join(__dirname, file), ...process.argv.slice(2)];
  const p = spawn(process.argv[0], args, {
    stdio: ["inherit", "inherit", "inherit", "ipc"],
  });

  p.on("message", (data) => {
    console.log('\x1b[36m%s\x1b[0m', `🟢 RECEIVED ${data}`);
    switch (data) {
      case "reset":
        p.kill();
        isRunning = false;
        start.apply(this, arguments);
        break;
      case "uptime":
        p.send(process.uptime());
        break;
    }
  });

  p.on("exit", (code) => {
    isRunning = false;
    console.error('\x1b[31m%s\x1b[0m', `Exited with code: ${code}`);

    if (code === 0) return;

    fs.watchFile(args[0], () => {
      fs.unwatchFile(args[0]);
      console.error('\x1b[31m%s\x1b[0m', `File ${args[0]} has been modified. Script will restart...`);
      start("main.js");
    });

    setTimeout(() => {
      start('main.js');
    }, 1000);
  });

  p.on("error", (err) => {
    console.error('\x1b[31m%s\x1b[0m', `Error: ${err}`);
    p.kill();
    isRunning = false;
    console.error('\x1b[31m%s\x1b[0m', `Error occurred. Script will restart...`);
    setTimeout(() => {
      start("main.js");
    }, 1000);
  });

  const pluginsFolder = path.join(__dirname, "plugins");

  try {
    const telegrafPackagePath = path.join(__dirname, 'node_modules', 'telegraf', 'package.json');
    const packageData = JSON.parse(fs.readFileSync(telegrafPackagePath, 'utf8'));
    version = packageData.version;
  } catch (e) {
    console.error('\x1b[31m%s\x1b[0m', `❌ Telegraf library is not installed. Please run: npm install telegraf`);
  }

  fs.readdir(pluginsFolder, (err, files) => {
    if (err) {
      console.error('\x1b[31m%s\x1b[0m', `Error reading plugins folder: ${err}`);
      return;
    }
    if (!Array.isArray(files) || files.length === 0) {
      console.log('\x1b[33m%s\x1b[0m', `🟡 No plugins found in folder ${pluginsFolder}`);
      return;
    }
    console.log('\x1b[33m%s\x1b[0m', `🟡 Found ${files.length} plugins in folder ${pluginsFolder}`);
    console.log('\x1b[32m%s\x1b[0m', `✅ Telegraf library version ${version} is installed`);

    console.log('\x1b[36m%s\x1b[0m', '[');
    const displayFiles = files.slice(0, 15);
    displayFiles.forEach((file) => {
      console.log('\x1b[32m%s\x1b[0m', `  '${file}',`);
    });

    if (files.length > 15) {
      const remainingCount = files.length - 15;
      console.log('\x1b[36m%s\x1b[0m', `  ... ${remainingCount} more items`);
    }
    console.log('\x1b[36m%s\x1b[0m', ']');
  });

  console.log(`🖥️ \x1b[33m${os.type()}\x1b[0m, \x1b[33m${os.release()}\x1b[0m - \x1b[33m${os.arch()}\x1b[0m`);
  const ramInGB = os.totalmem() / (1024 * 1024 * 1024);
  console.log(`💾 \x1b[33mTotal RAM: ${ramInGB.toFixed(2)} GB\x1b[0m`);
  const freeRamInGB = os.freemem() / (1024 * 1024 * 1024);
  console.log(`💽 \x1b[33mFree RAM: ${freeRamInGB.toFixed(2)} GB\x1b[0m`);
  console.log('\x1b[33m%s\x1b[0m', `📃 Script by BETABOTZ`);

  setInterval(() => { }, 1000);
}

const tmpDir = './tmp';
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir);
  console.log('\x1b[33m%s\x1b[0m', `📁 Created directory ${tmpDir}`);
}

start("main.js");

process.on('unhandledRejection', (reason) => {
  console.error('\x1b[31m%s\x1b[0m', `Unhandled promise rejection: ${reason}`);
  console.error('\x1b[31m%s\x1b[0m', 'Unhandled promise rejection. Script will restart...');
  setTimeout(() => {
    start('main.js');
  }, 1000);
});

process.on('exit', (code) => {
  console.error(`Exited with code: ${code}`);
});
