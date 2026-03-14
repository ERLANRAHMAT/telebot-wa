const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone");
const crypto = require("crypto");

const SELF_FILE = path.basename(__filename);
const MENU_IMAGE = "https://lann.pw/get-upload?id=uploader-api-1:1752838394888.jpg";
const getMenuImage = () => global.db?.data?.settings?.menuImage || MENU_IMAGE;

const LABEL = {
  main: "MAIN",
  tools: "TOOLS",
  news: "NEWS",
  downloader: "DOWNLOAD",
  fun: "FUN",
  group: "GROUP",
  owner: "OWNER",
  admin: "ADMIN",
  premium: "PREMIUM",
  info: "INFO",
  advanced: "ADVANCED",
};

let MAP = {};
let TOTAL = 0;

const clock = (ms) => {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor(ms / 60000) % 60;
  const s = Math.floor(ms / 1000) % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
};

const nowInfo = () => {
  const m = moment.tz("Asia/Jakarta").locale("id");
  const date = m.format("D MMMM YYYY");
  const time = m.format("HH.mm") + " WIB";
  const hour = m.hour();
  const greet = hour < 11 ? "Pagi" : hour < 15 ? "Siang" : hour < 19 ? "Sore" : "Malam";
  return { date, time, greet };
};

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const seed = (s) => {
  let n = 0;
  const str = String(s);
  for (let i = 0; i < str.length; i++) n = (n * 31 + str.charCodeAt(i)) >>> 0;
  return () => (n = (1103515245 * n + 12345) >>> 0) / 0xffffffff;
};

const shuffleDet = (arr, s) => {
  const rnd = seed(s);
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

function loadPlugins() {
  const dir = __dirname;
  const mapSet = new Map();
  let total = 0;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".js") || file === SELF_FILE) continue;
    const abs = path.join(dir, file);
    try {
      delete require.cache[require.resolve(abs)];
      const mod = require(abs);
      if (!Array.isArray(mod?.help) || !Array.isArray(mod?.tags)) continue;
      for (const tag of mod.tags) {
        if (!mapSet.has(tag)) mapSet.set(tag, new Set());
        const set = mapSet.get(tag);
        for (const cmd of mod.help) {
          if (!set.has(cmd)) {
            set.add(cmd);
            total++;
          }
        }
      }
    } catch (e) {
      console.log("Load error:", file, "-", e.message);
    }
  }
  const out = {};
  for (const [tag, set] of mapSet.entries()) out[tag] = Array.from(set).sort();
  MAP = out;
  TOTAL = total;
}

function mainMenuText(m, up) {
  const { date, time, greet } = nowInfo();
  const bot = global.botname || "FilnBotz";
  const name = m.name || "teman";
  let t = `*${bot}*\n\n`;
  t += `Halo, ${name}. Selamat ${greet}! 👋\n`;
  t += `Uptime: ${up}\nTanggal: ${date}\nWaktu: ${time}\n\n`;
  t += `Statistik:\n`;
  t += `• Pengguna: ${Object.keys(global.db?.data?.users || {}).length}\n`;
  t += `• Perintah: ${TOTAL}\n`;
  t += `\nPilih kategori di tombol bawah.`;
  return t;
}

function catListText(key, usedPrefix = "/") {
  const label = LABEL[key] || key.toUpperCase();
  const cmds = MAP[key] || [];
  let txt = `— *${label}* —\n`;
  txt += `Total: ${cmds.length} perintah\n\n`;
  txt += cmds.map((cmd, i) => `${i + 1}. /${cmd}`).join("\n");
  return txt;
}

function catButtons(sessionId, mName) {
  const keys = shuffleDet(Object.keys(MAP), mName + sessionId);
  const rows = chunk(
    keys.map((k) => ({
      text: LABEL[k] || k.toUpperCase(),
      callback_data: `menu_cat_${k}_${sessionId}`,
    })),
    3
  );
  rows.push([
    { text: "Profil", callback_data: `menu_profile_${sessionId}` },
    { text: "Tentang Bot", callback_data: `menu_info_${sessionId}` },
  ]);
  return rows;
}

async function sendMain(conn, chat, name, sid, quote) {
  const up = clock(process.uptime() * 1000);
  const text = mainMenuText({ name }, up);
  const buttons = catButtons(sid, name || "");
  const img = getMenuImage();
  const sent = await conn.sendButt(chat, { text, photo: img }, buttons, quote || null);
  const newId = sent?.message_id || sent?.message?.message_id || null;
  global.menuSessions[sid] = global.menuSessions[sid] || {};
  global.menuSessions[sid].lastBotMsgId = newId;
  return sent;
}

async function sendCat(conn, chat, key, sessionId) {
  const txt = catListText(key);
  const img = getMenuImage();
  const backButton = [[{ text: "⬅️ Kembali ke Menu Utama", callback_data: `menu_main_${sessionId}` }]];
  const sent = await conn.sendButt(chat, { text: txt, photo: img }, backButton, null);
  const newId = sent?.message_id || sent?.message?.message_id || null;
  global.menuSessions[sessionId] = global.menuSessions[sessionId] || {};
  global.menuSessions[sessionId].lastBotMsgId = newId;
  return sent;
}

const handler = async (m, { conn, args }) => {
  const sid =
    typeof m.sender === "number"
      ? String(m.sender)
      : String(m.sender || "").replace("@s.whatsapp.net", "");

  global.menuSessions = global.menuSessions || {};
  global.menuSessions[sid] = { userMessageId: m.id, chatId: m.chat, lastBotMsgId: null };

  if (Array.isArray(args) && args.length > 0 && args[0].trim() !== "") {
    const input = String(args[0]).toLowerCase();
    const found = Object.keys(MAP).find((k) => k.toLowerCase() === input);
    if (found) return sendCat(conn, m.chat, found, sid);
    await conn.sendMessage(
      m.chat,
      { text: `Kategori "${args[0]}" nggak ketemu. Coba /menu tanpa tambahan teks ya.`, parse_mode: "Markdown" },
      { quoted: { message_id: m.id } }
    );
    return;
  }

  const img = getMenuImage();
  const sent = await conn.sendButt(
    m.chat,
    { text: mainMenuText(m, clock(process.uptime() * 1000)), photo: img },
    catButtons(sid, m.name || ""),
    { message_id: m.id }
  );
  const newId = sent?.message_id || sent?.message?.message_id || null;
  global.menuSessions[sid].lastBotMsgId = newId;
};

handler.callback = async ({ callbackQuery, conn, data, answerCbQuery, deleteMessage }) => {
  try {
    if (!data || !data.startsWith("menu_")) return false;

    const chat = callbackQuery?.message?.chat?.id;
    const from = callbackQuery?.from;
    const msgId = callbackQuery?.message?.message_id;

    const parts = data.split("_");
    const action = parts[1];
    const sid = parts[parts.length - 1];

    if (answerCbQuery) await answerCbQuery("Sebentar…");

    // Selalu hapus pesan lama sebelum kirim yang baru
    if (msgId) await conn.telegram.deleteMessage(chat, msgId).catch(() => {});

    if (action === "main") {
      const sess = global.menuSessions?.[sid];
      const userMsgId = sess?.userMessageId ? { message_id: sess.userMessageId } : null;
      await sendMain(conn, chat, from?.first_name || "User", sid, userMsgId);
      return true;
    }

    if (action === "cat") {
      const catKey = parts[2];
      await sendCat(conn, chat, catKey, sid);
      return true;
    }

    if (action === "profile") {
      const u = (global.db?.data?.users || {})[sid] || {};
      const txt = `Profil Kamu\n• Nama: ${from?.first_name || "User"}\n• Nomor: ${from.id}\n• Premium: ${u.premium ? "Ya" : "Tidak"}\n• Limit: ${u.limit || 0}\n• Level: ${u.level || 0}\n• XP: ${u.exp || 0}\n• Terdaftar: ${u.registered ? "Ya" : "Tidak"}`;
      const img = getMenuImage();
      await conn.sendButt(chat, { text: txt, photo: img }, [
        [{ text: "⬅️ Kembali ke Menu Utama", callback_data: `menu_main_${sid}` }],
      ]);
      return true;
    }

    if (action === "info") {
      const txt = `Tentang Bot\n• Nama: ${global.botname || "FilnBotz"}\n• Owner: ${global.ownername || "Filn"}\n• Versi: 3.0.0\n• Runtime: ${clock(process.uptime() * 1000)}\n• Platform: ${process.platform}\n• Node: ${process.version}\n• Memori: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB\n• Pengguna: ${Object.keys(global.db?.data?.users || {}).length}\n• Total Perintah: ${TOTAL}`;
      const img = getMenuImage();
      await conn.sendButt(chat, { text: txt, photo: img }, [
        [{ text: "⬅️ Kembali ke Menu Utama", callback_data: `menu_main_${sid}` }],
      ]);
      return true;
    }

    return true;
  } catch (e) {
    console.error("[MENU CALLBACK ERROR]", e);
    try {
      await answerCbQuery("Lagi error, coba lagi ya.", { show_alert: true });
    } catch {}
    return true;
  }
};

loadPlugins();
handler.help = handler.command = ["menu", "help", "start"];
handler.tags = ["main"];
module.exports = handler;