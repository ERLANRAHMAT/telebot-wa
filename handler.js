const fs = require("fs");
const util = require("util");
const chalk = require("chalk");
const moment = require("moment-timezone");
//const { Canvafy } = require('canvafy');

const isNumber = (x) => typeof x === "number" && !isNaN(x);
const delay = (ms) =>
  isNumber(ms) && new Promise((resolve) => setTimeout(resolve, ms));

function isRealError(error) {
  return (
    error instanceof Error ||
    (error && error.constructor && error.constructor.name === "Error")
  );
}

function maskSecrets(rawText, { APIKeys = {}, aksesKey = {} } = {}) {
  let text = String(rawText ?? "");
  const knownSecrets = Array.from(
    new Set(
      [...Object.values(APIKeys || {}), ...Object.values(aksesKey || {})]
        .flat()
        .filter((v) => typeof v === "string")
        .map((v) => v.trim())
        .filter((v) => v.length >= 6),
    ),
  ).sort((a, b) => b.length - a.length);

  const sensitiveFields = [
    "apikey",
    "api_key",
    "access_key",
    "accessToken",
    "access_token",
    "token",
    "authorization",
    "x-api-key",
    "x_api_key",
    "client_secret",
    "clientSecret",
    "secret",
    "bearer",
    "key",
    "aksesKey",
    "akses_key",
  ];

  const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const name of sensitiveFields) {
    const n = escapeRegex(name);
    text = text.replace(
      new RegExp(`([?&])(${n})=([^&#\\s]*)`, "gi"),
      (_, pfx, field) => `${pfx}${field}=#HIDDEN#`,
    );
    text = text.replace(
      new RegExp(`(["']${n}["']\\s*:\\s*["'])([^"']+?)(["'])`, "gi"),
      `$1#HIDDEN#$3`,
    );
    text = text.replace(
      new RegExp(`(^|\\n)(${n})\\s*[:=]\\s*([^\\r\\n]+)`, "gi"),
      `$1$2: #HIDDEN#`,
    );
  }
  text = text.replace(
    /(^|\n)(Authorization\s*:\s*Bearer\s+)([^\s\r\n]+)/gi,
    `$1$2#HIDDEN#`,
  );
  for (const secret of knownSecrets) {
    const safe = escapeRegex(secret);
    const re = new RegExp(`(?<=^|[\\s"'=:&?])${safe}(?=$|[\\s"'&?#])`, "g");
    text = text.replace(re, "#HIDDEN#");
  }

  return text;
}

async function rlimit() {
  const now = moment().tz("Asia/Makassar");
  const resetTime = moment().tz("Asia/Makassar").startOf("day");

  if (now.isSameOrAfter(resetTime)) {
    for (const userId in global.db.data.users) {
      const user = global.db.data.users[userId];
      if (user.lastReset !== resetTime.format("YYYY-MM-DD")) {
        user.limit += 30;
        user.lastReset = resetTime.format("YYYY-MM-DD");
      }
    }
  }
}
// delay global declaration
global.delay = delay;

module.exports = {
  // async handler(m) {
  //   await global.loadDatabase()
  //   if (global.db.data == null) return

  async handler(m) {
    await global.loadDatabase();
    if (global.db.data == null) return;

    // AUTO START SYNC ONCE
    // if (!global.__syncStarted) {
    //   global.__syncStarted = true
    //   try {
    //     const { startSync } = require("./sync")
    //     startSync()
    //     console.log("[SYNC] started")
    //   } catch (e) {
    //     console.log("[SYNC] failed:", e.message)
    //   }
    // }

    if (!m) return;

    try {
      m.exp = 0;
      m.limit = false;

      await rlimit();

      if (m.callbackQuery && !m.isSimulated) {
        await this.telegram.answerCbQuery(m.callbackQuery.id);
      }

      let user = global.db.data.users[m.sender];
      if (typeof user !== "object") global.db.data.users[m.sender] = {};
      if (user) {
        if (!isNumber(user.saldo)) user.saldo = 0;
        if (!isNumber(user.pengeluaran)) user.pengeluaran = 0;
        if (!isNumber(user.healt)) user.healt = 100;
        if (!isNumber(user.health)) user.health = 100;
        if (!isNumber(user.energi)) user.energi = 100;
        if (!isNumber(user.power)) user.power = 100;
        if (!isNumber(user.title)) user.title = 0;
        if (!isNumber(user.stamina)) user.stamina = 100;
        if (!isNumber(user.haus)) user.haus = 100;
        if (!isNumber(user.laper)) user.laper = 100;
        if (!isNumber(user.level)) user.level = 0;
        if (!("titlein" in user)) user.titlein = "Belum Ada";
        if (!("ultah" in user)) user.ultah = "";
        if (!("pasangan" in user)) user.pasangan = "";
        if (!("sahabat" in user)) user.sahabat = "";
        if (!("location" in user)) user.location = "Gubuk";
        if (!("husbu" in user)) user.husbu = "Belum Di Set";
        if (!("waifu" in user)) user.waifu = "Belum Di Set";
        if (!isNumber(user.follow)) user.follow = 0;
        if (!isNumber(user.lastfollow)) user.lastfollow = 0;
        if (!isNumber(user.followers)) user.followers = 0;
        if (!isNumber(user.exp)) user.exp = 0;
        if (!isNumber(user.pc)) user.pc = 0;
        if (!isNumber(user.korbanngocok)) user.korbanngocok = 0;
        if (!isNumber(user.ojekk)) user.ojekk = 0;
        if (!isNumber(user.polisi)) user.polisi = 0;
        if (!isNumber(user.ojek)) user.ojek = 0;
        if (!isNumber(user.pedagang)) user.pedagang = 0;
        if (!isNumber(user.dokter)) user.dokter = 0;
        if (!isNumber(user.petani)) user.petani = 0;
        if (!isNumber(user.montir)) user.montir = 0;
        if (!isNumber(user.kuli)) user.kuli = 0;
        if (!isNumber(user.trofi)) user.trofi = 0;
        if (!user.rtrofi) user.rtrofi = "Perunggu";
        if (!isNumber(user.troopcamp)) user.troopcamp = 0;
        if (!isNumber(user.coin)) user.coin = 0;
        if (!isNumber(user.atm)) user.atm = 0;
        if (!isNumber(user.limit)) user.limit = 10;
        if (!isNumber(user.glimit)) user.glimit = 10;
        if (!isNumber(user.tprem)) user.tprem = 0;
        if (!isNumber(user.tigame)) user.tigame = 5;
        if (!isNumber(user.lastclaim)) user.lastclaim = 0;
        if (isNumber(user.lastmulung)) user.lastmulung = 0;
        if (!isNumber(user.judilast)) user.judilast = 0;
        if (!isNumber(user.lastnambang)) user.lastnambang = 0;
        if (!isNumber(user.lastnebang)) user.lastnebang = 0;
        if (!isNumber(user.lastkerja)) user.lastkerja = 0;
        if (!isNumber(user.lastmaling)) user.lastmaling = 0;
        if (!isNumber(user.lastbunuhi)) user.lastbunuhi = 0;
        if (!isNumber(user.lastbisnis)) user.lastbisnis = 0;
        if (!isNumber(user.lastberbisnis)) user.lastberbisnis = 0;
        if (!isNumber(user.berbisnis)) user.berbisnis = 0;
        if (!isNumber(user.bisnis)) user.bisnis = 0;
        if (!isNumber(user.lastmancing)) user.lastmancing = 0;
        if (!isNumber(user.money)) user.money = 0;
        if (!isNumber(user.rumahsakit)) user.rumahsakit = 0;
        if (!isNumber(user.fortress)) user.fortress = 0;
        if (!isNumber(user.shield)) user.shield = false;
        if (!isNumber(user.pertanian)) user.pertanian = 0;
        if (!isNumber(user.pertambangan)) user.pertambangan = 0;
        if (!isNumber(user.camptroops)) user.camptroops = 0;
        if (!isNumber(user.tambang)) user.tambang = 0;

        //Tambahan rpg
        if (!isNumber(user.litecoin)) user.litecoin = 0;
        if (!isNumber(user.chip)) user.chip = 0;
        if (!isNumber(user.tiketcoin)) user.tiketcoin = 0;
        if (!isNumber(user.poin)) user.poin = 0;
        if (!isNumber(user.lastbossbattle)) user.lastbossbattle = 0;
        if (!isNumber(user.bank)) user.bank = 0;
        if (!isNumber(user.balance)) user.balance = 0;

        if (!isNumber(user.botol)) user.botol = 0;
        if (!isNumber(user.kardus)) user.kardus = 0;
        if (!isNumber(user.kaleng)) user.kaleng = 0;
        if (!isNumber(user.aqua)) user.aqua = 0;
        if (!isNumber(user.diamond)) user.diamond = 0;
        if (!isNumber(user.emerald)) user.emerald = 0;
        if (!isNumber(user.wood)) user.wood = 0;
        if (!isNumber(user.rock)) user.rock = 0;
        if (!isNumber(user.berlian)) user.berlian = 0;
        if (!isNumber(user.iron)) user.iron = 0;
        if (!isNumber(user.emas)) user.emas = 0;
        if (!isNumber(user.arlok)) user.arlok = 0;

        if (!isNumber(user.common)) user.common = 0;
        if (!isNumber(user.as)) user.as = 0;
        if (!isNumber(user.uncommon)) user.uncommon = 0;
        if (!isNumber(user.mythic)) user.mythic = 0;
        if (!isNumber(user.legendary)) user.legendary = 0;
        if (!isNumber(user.glory)) user.glory = 0;
        if (!isNumber(user.enchant)) user.enchant = 0;
        if (!isNumber(user.pet)) user.pet = 0;
        if (!isNumber(user.psepick)) user.psepick = 0;
        if (!isNumber(user.psenjata)) user.psenjata = 0;
        //rpg meracik
        if (!isNumber(user.lastramuanclaim)) user.lastramuanclaim = 0;
        if (!isNumber(user.gems)) user.gems = 0;
        if (!isNumber(user.cupon)) user.cupon = 0;
        if (!isNumber(user.lastgemclaim)) user.lastgemclaim = 0;
        if (!isNumber(user.eleksirb)) user.eleksirb = 0;
        if (!isNumber(user.penduduk)) user.penduduk = 0;
        if (!isNumber(user.archer)) user.archer = 0;
        if (!isNumber(user.shadow)) user.shadow = 0;
        if (!isNumber(user.lastpotionclaim)) user.lastpotionclaim = 0;
        if (!isNumber(user.laststringclaim)) user.laststringclaim = 0;
        if (!isNumber(user.lastswordclaim)) user.lastswordclaim = 0;
        if (!isNumber(user.lastweaponclaim)) user.lastweaponclaim = 0;
        if (!isNumber(user.lastironclaim)) user.lastironclaim = 0;
        if (!isNumber(user.lastmancingclaim)) user.lastmancingclaim = 0;
        if (!isNumber(user.anakpancingan)) user.anakpancingan = 0;

        if (!isNumber(user.potion)) user.potion = 0;
        if (!isNumber(user.sampah)) user.sampah = 0;
        if (!isNumber(user.pancing)) user.pancing = 0;
        if (!isNumber(user.pancingan)) user.pancingan = 0;
        if (!isNumber(user.totalPancingan)) user.totalPancingan = 0;
        //penambah stamina
        if (!isNumber(user.apel)) user.apel = 0;
        if (!isNumber(user.ayamb)) user.ayamb = 0;
        if (!isNumber(user.ayamg)) user.ayamg = 0;
        if (!isNumber(user.sapir)) user.sapir = 0;
        if (!isNumber(user.ssapi)) user.ssapi = 0;
        if (!isNumber(user.esteh)) user.esteh = 0;
        if (!isNumber(user.leleg)) user.leleg = 0;
        if (!isNumber(user.leleb)) user.leleb = 0;

        if (!isNumber(user.ayambakar)) user.ayambakar = 0;
        if (!isNumber(user.gulai)) user.gulai = 0;
        if (!isNumber(user.rendang)) user.rendang = 0;
        if (!isNumber(user.ayamgoreng)) user.ayamgoreng = 0;
        if (!isNumber(user.oporayam)) user.oporayam = 0;
        if (!isNumber(user.steak)) user.steak = 0;
        if (!isNumber(user.babipanggang)) user.babipanggang = 0;
        if (!isNumber(user.ikanbakar)) user.ikanbakar = 0;
        if (!isNumber(user.nilabakar)) user.nilabakar = 0;
        if (!isNumber(user.lelebakar)) user.lelebakar = 0;
        if (!isNumber(user.bawalbakar)) user.bawalbakar = 0;
        if (!isNumber(user.udangbakar)) user.udangbakar = 0;
        if (!isNumber(user.pausbakar)) user.pausbakar = 0;
        if (!isNumber(user.kepitingbakar)) user.kepitingbakar = 0;
        if (!isNumber(user.soda)) user.soda = 0;
        if (!isNumber(user.vodka)) user.vodka = 0;
        if (!isNumber(user.ganja)) user.ganja = 0;
        if (!isNumber(user.bandage)) user.bandage = 0;
        if (!isNumber(user.sushi)) user.sushi = 0;
        if (!isNumber(user.roti)) user.roti = 0;
        //untuk masak
        if (!isNumber(user.coal)) user.coal = 0;
        if (!isNumber(user.korekapi)) user.korekapi = 0;
        //tools
        if (!isNumber(user.umpan)) user.umpan = 0;

        if (!isNumber(user.armor)) user.armor = 0;
        if (!isNumber(user.armordurability)) user.armordurability = 0;
        if (!isNumber(user.weapon)) user.weapon = 0;
        if (!isNumber(user.weapondurability)) user.weapondurability = 0;
        if (!isNumber(user.sword)) user.sword = 0;
        if (!isNumber(user.sworddurability)) user.sworddurability = 0;
        if (!isNumber(user.pickaxe)) user.pickaxe = 0;
        if (!isNumber(user.pickaxedurability)) user.pickaxedurability = 0;
        if (!isNumber(user.fishingrod)) user.fishingrod = 0;
        if (!isNumber(user.fishingroddurability)) user.fishingroddurability = 0;
        if (!isNumber(user.katana)) user.katana = 0;
        if (!isNumber(user.katanadurability)) user.katanadurability = 0;
        if (!isNumber(user.bow)) user.bow = 0;
        if (!isNumber(user.bowdurability)) user.bowdurability = 0;
        if (!isNumber(user.kapak)) user.kapak = 0;
        if (!isNumber(user.kapakdurability)) user.kapakdurability = 0;
        if (!isNumber(user.axe)) user.axe = 0;
        if (!isNumber(user.axedurability)) user.axedurability = 0;
        if (!isNumber(user.pisau)) user.pisau = 0;
        if (!isNumber(user.pisaudurability)) user.pisaudurability = 0;

        if (!isNumber(user.kerjasatu)) user.kerjasatu = 0;
        if (!isNumber(user.kerjadua)) user.kerjadua = 0;
        if (!isNumber(user.kerjatiga)) user.kerjatiga = 0;
        if (!isNumber(user.kerjaempat)) user.kerjaempat = 0;
        if (!isNumber(user.kerjalima)) user.kerjalima = 0;
        if (!isNumber(user.kerjaenam)) user.kerjaenam = 0;
        if (!isNumber(user.kerjatujuh)) user.kerjatujuh = 0;
        if (!isNumber(user.kerjadelapan)) user.kerjadelapan = 0;
        if (!isNumber(user.kerjasembilan)) user.kerjasembilan = 0;
        if (!isNumber(user.kerjasepuluh)) user.kerjasepuluh = 0;
        if (!isNumber(user.kerjasebelas)) user.kerjasebelas = 0;
        if (!isNumber(user.kerjaduabelas)) user.kerjaduabelas = 0;
        if (!isNumber(user.kerjatigabelas)) user.kerjatigabelas = 0;
        if (!isNumber(user.kerjaempatbelas)) user.kerjaempatbelas = 0;
        if (!isNumber(user.kerjalimabelas)) user.kerjalimabelas = 0;

        if (!isNumber(user.pekerjaansatu)) user.pekerjaansatu = 0;
        if (!isNumber(user.pekerjaandua)) user.pekerjaandua = 0;
        if (!isNumber(user.pekerjaantiga)) user.pekerjaantiga = 0;
        if (!isNumber(user.pekerjaanempat)) user.pekerjaanempat = 0;
        if (!isNumber(user.pekerjaanlima)) user.pekerjaanlima = 0;
        if (!isNumber(user.pekerjaanenam)) user.pekerjaanenam = 0;
        if (!isNumber(user.pekerjaantujuh)) user.pekerjaantujuh = 0;
        if (!isNumber(user.pekerjaandelapan)) user.pekerjaandelapan = 0;
        if (!isNumber(user.pekerjaansembilan)) user.pekerjaansembilan = 0;
        if (!isNumber(user.pekerjaansepuluh)) user.pekerjaansepuluh = 0;
        if (!isNumber(user.pekerjaansebelas)) user.pekerjaansebelas = 0;
        if (!isNumber(user.pekerjaanduabelas)) user.pekerjaanduabelas = 0;
        if (!isNumber(user.pekerjaantigabelas)) user.pekerjaantigabelas = 0;
        if (!isNumber(user.pekerjaanempatbelas)) user.pekerjaanempatbelas = 0;
        if (!isNumber(user.pekerjaanlimabelas)) user.pekerjaanlimabelas = 0;

        if (!isNumber(user.kucing)) user.kucing = 0;
        if (!isNumber(user.kucinglastclaim)) user.kucinglastclaim = 0;
        if (!isNumber(user.kucingexp)) user.kucingexp = 0;
        if (!isNumber(user.kuda)) user.kuda = 0;
        if (!isNumber(user.kudalastclaim)) user.kudalastclaim = 0;
        if (!isNumber(user.rubah)) user.rubah = 0;
        if (!isNumber(user.rubahlastclaim)) user.rubahlastclaim = 0;
        if (!isNumber(user.rubahexp)) user.rubahexp = 0;
        if (!isNumber(user.anjing)) user.anjing = 0;
        if (!isNumber(user.anjinglastclaim)) user.anjinglastclaim = 0;
        if (!isNumber(user.anjingexp)) user.anjingexp = 0;
        if (!isNumber(user.serigalalastclaim)) user.serigalalastclaim = 0;
        if (!isNumber(user.nagalastclaim)) user.nagalastclaim = 0;
        if (!isNumber(user.phonixlastclaim)) user.phonixlastclaim = 0;
        if (!isNumber(user.phonixexp)) user.phonixexp = 0;
        if (!isNumber(user.griffinlastclaim)) user.griffinlastclaim = 0;
        if (!isNumber(user.centaurlastclaim)) user.centaurlastclaim = 0;

        if (!isNumber(user.makananpet)) user.makananpet = 0;
        if (!isNumber(user.makanannaga)) user.makanannaga = 0;
        if (!isNumber(user.makananphonix)) user.makananphonix = 0;
        if (!isNumber(user.makanangriffin)) user.makanangriffin = 0;
        if (!isNumber(user.makananserigala)) user.makananserigala = 0;
        if (!isNumber(user.makanancentaur)) user.makanancentaur = 0;

        if ((!"Banneduser") in user) user.Banneduser = false;
        if ((!"BannedReason") in user) user.BannedReason = "";
        if (!isNumber(user.warn)) user.warn = 0;
        if (!("banned" in user)) user.banned = false;
        if (!isNumber(user.bannedTime)) user.bannedTime = 0;

        if (!isNumber(user.afk)) user.afk = -1;
        if ((!"afkReason") in user) user.afkReason = "";

        //PET
        if (!isNumber(user.healthmonster)) user.healthmonster = 0;
        if (!isNumber(user.anakkucing)) user.anakkucing = 0;
        if (!isNumber(user.anakkuda)) user.anakkuda = 0;
        if (!isNumber(user.anakrubah)) user.anakrubah = 0;
        if (!isNumber(user.anakanjing)) user.anakanjing = 0;
        if (!isNumber(user.serigala)) user.serigala = 0;
        if (!isNumber(user.serigalaexp)) user.serigalaexp = 0;
        if (!isNumber(user.anakserigala)) user.anakserigala = 0;
        if (!isNumber(user.naga)) user.naga = 0;
        if (!isNumber(user.anaknaga)) user.anaknaga = 0;
        if (!isNumber(user.phonix)) user.phonix = 0;
        if (!isNumber(user.anakphonix)) user.anakphonix = 0;
        if (!isNumber(user.griffin)) user.griffin = 0;
        if (!isNumber(user.anakgriffin)) user.anakgriffin = 0;
        if (!isNumber(user.kyubi)) user.kyubi = 0;
        if (!isNumber(user.anakkyubi)) user.anakkyubi = 0;
        if (!isNumber(user.centaur)) user.centaur = 0;
        if (!isNumber(user.fightnaga)) user.fightnaga = 0;
        if (!isNumber(user.anakcentaur)) user.anakcentaur = 0;
        if (!isNumber(user.makananPet)) user.makananPet = 0;

        if (!isNumber(user.antispam)) user.antispam = 0;
        if (!isNumber(user.antispamlastclaim)) user.antispamlastclaim = 0;

        if (!isNumber(user.kayu)) user.kayu = 0;
        if (!("kingdom" in user)) user.kingdom = false;
        if (!isNumber(user.batu)) user.batu = 0;
        if (!isNumber(user.ramuan)) user.ramuan = 0;
        if (!isNumber(user.string)) user.string = 0;

        //mancing
        if (!isNumber(user.paus)) user.paus = 0;
        if (!isNumber(user.kepiting)) user.kepiting = 0;
        if (!isNumber(user.gurita)) user.gurita = 0;
        if (!isNumber(user.cumi)) user.cumi = 0;
        if (!isNumber(user.buntal)) user.buntal = 0;
        if (!isNumber(user.dory)) user.dory = 0;
        if (!isNumber(user.lumba)) user.lumba = 0;
        if (!isNumber(user.lobster)) user.lobster = 0;
        if (!isNumber(user.hiu)) user.hiu = 0;
        if (!isNumber(user.udang)) user.udang = 0;
        if (!isNumber(user.ikan)) user.ikan = 0;
        if (!isNumber(user.nila)) user.nila = 0;
        if (!isNumber(user.bawal)) user.bawal = 0;
        if (!isNumber(user.lele)) user.lele = 0;
        if (!isNumber(user.orca)) user.orca = 0;

        if (!isNumber(user.banteng)) user.banteng = 0;
        if (!isNumber(user.harimau)) user.harimau = 0;
        if (!isNumber(user.gajah)) user.gajah = 0;
        if (!isNumber(user.kambing)) user.kambing = 0;
        if (!isNumber(user.panda)) user.panda = 0;
        if (!isNumber(user.buaya)) user.buaya = 0;
        if (!isNumber(user.kerbau)) user.kerbau = 0;
        if (!isNumber(user.sapi)) user.sapi = 0;
        if (!isNumber(user.monyet)) user.monyet = 0;
        if (!isNumber(user.babihutan)) user.babihutan = 0;
        if (!isNumber(user.babi)) user.babi = 0;
        if (!isNumber(user.ayam)) user.ayam = 0;

        if (!isNumber(user.lastadventure)) user.lastadventure = 0;
        if (!isNumber(user.lastberburu)) user.lastberburu = 0;
        if (!isNumber(user.lastkill)) user.lastkill = 0;
        if (!isNumber(user.lastfishing)) user.lastfishing = 0;
        if (!isNumber(user.lastdungeon)) user.lastdungeon = 0;
        if (!isNumber(user.lastwar)) user.lastwar = 0;
        if (!isNumber(user.lastsda)) user.lastsda = 0;
        if (!isNumber(user.lastberbru)) user.lastberbru = 0;
        if (!isNumber(user.lastduel)) user.lastduel = 0;
        if (!isNumber(user.lastjb)) user.lastjb = 0;
        if (!isNumber(user.lastSetStatus)) user.lastSetStatus = 0;
        if (!isNumber(user.lastmining)) user.lastmining = 0;
        if (!isNumber(user.lasthunt)) user.lasthunt = 0;
        if (!isNumber(user.lasthun)) user.lasthun = 0;
        if (!isNumber(user.lastngocok)) user.lastngocok = 0;
        if (!isNumber(user.lastgift)) user.lastgift = 0;
        if (!isNumber(user.lastrob)) user.lastrob = 0;
        if (!isNumber(user.lastngojek)) user.lastngojek = 0;

        if (!isNumber(user.lastngewe)) user.lastngewe = 0;
        if (!isNumber(user.ngewe)) user.ngewe = 0;
        if (!isNumber(user.jualan)) user.jualan = 0;
        if (!isNumber(user.lastjualan)) user.lastjualan = 0;
        if (!isNumber(user.ngocokk)) user.ngocokk = 0;
        if (!isNumber(user.lastngocokk)) user.lastngocokk = 0;
        if (!isNumber(user.lastgrab)) user.lastgrab = 0;
        if (!isNumber(user.lastberkebon)) user.lastberkebon = 0;
        if (!isNumber(user.lastcodereg)) user.lastcodereg = 0;
        if (!isNumber(user.lastdagang)) user.lastdagang = 0;
        if (!isNumber(user.lasthourly)) user.lasthourly = 0;
        if (!isNumber(user.lastweekly)) user.lastweekly = 0;
        if (!isNumber(user.lastyearly)) user.lastyearly = 0;
        if (!isNumber(user.lastmonthly)) user.lastmonthly = 0;
        if (!isNumber(user.lastIstigfar)) user.lastIstigfar = 0;
        if (!isNumber(user.lastturu)) user.lastturu = 0;
        if (!isNumber(user.lastseen)) user.lastseen = 0;
        if (!isNumber(user.lastbansos)) user.lastbansos = 0;
        if (!isNumber(user.lastrampok)) user.lastrampok = 0;
        if (!("registered" in user)) user.registered = false;
        if (!user.registered) {
          if (!("name" in user)) user.name = this.getName(m.sender);

          if (!isNumber(user.apel)) user.apel = 0;
          if (!isNumber(user.anggur)) user.anggur = 0;
          if (!isNumber(user.jeruk)) user.jeruk = 0;
          if (!isNumber(user.semangka)) user.semangka = 0;
          if (!isNumber(user.mangga)) user.mangga = 0;
          if (!isNumber(user.stroberi)) user.stroberi = 0;
          if (!isNumber(user.pisang)) user.pisang = 0;
          if (!isNumber(user.kayu)) user.kayu = 0;
          if (!isNumber(user.makanan)) user.makanan = 0;
          if (!isNumber(user.bibitanggur)) user.bibitanggur = 0;
          if (!isNumber(user.bibitpisang)) user.bibitpisang = 0;
          if (!isNumber(user.bibitapel)) user.bibitapel = 0;
          if (!isNumber(user.bibitmangga)) user.bibitmangga = 0;
          if (!isNumber(user.bibitjeruk)) user.bibitjeruk = 0;

          //sambung kata
          if (!isNumber(user.skata)) user.skata = 0;

          if (!isNumber(user.age)) user.age = -1;
          if (!isNumber(user.premiumDate)) user.premiumDate = -1;
          if (!isNumber(user.regTime)) user.regTime = -1;
        }
        if (!isNumber(user.level)) user.level = 0;
        if (!user.job) user.job = "Pengangguran";
        if (!isNumber(user.jobexp)) user.jobexp = 0;
        if (!("jail" in user)) user.jail = false;
        if (!("penjara" in user)) user.penjara = false;
        if (!("dirawat" in user)) user.dirawat = false;
        if (!isNumber(user.antarpaket)) user.antarpaket = 0;
        if (!user.lbars) user.lbars = "[▒▒▒▒▒▒▒▒▒]";
        if (!user.premium) user.premium = false;
        if (!user.premiumTime) user.premiumTime = 0;
        if (!user.vip) user.vip = "tidak";
        if (!isNumber(user.vipPoin)) user.vipPoin = 0;
        if (!user.role) user.role = "Newbie ㋡";
        if (!("autolevelup" in user)) user.autolevelup = true;
        if (!("lastIstigfar" in user)) user.lastIstigfar = true;

        //demon slayer dan rpg baru
        if (!("skill" in user)) user.skill = "";
        if (!("korps" in user)) user.korps = "";
        if (!("korpsgrade" in user)) user.korpsgrade = "";
        if (!("breaths" in user)) user.breaths = "";
        if (!("magic" in user)) user.magic = "";
        if (!("demon" in user)) user.demon = "";
        if (!("job" in user)) user.job = "Not Have";
        if (!isNumber(user.darahiblis)) user.darahiblis = 0;
        if (!isNumber(user.lastyoutuber)) user.lastyoutuber = 0;
        if (!isNumber(user.subscribers)) user.subscribers = 0;
        if (!isNumber(user.viewers)) user.viewers = 0;
        if (!isNumber(user.like)) user.like = 0;
        if (!isNumber(user.playButton)) user.playButton = 0;
        if (!isNumber(user.demonblood)) user.demonblood = 0;
        if (!isNumber(user.demonkill)) user.demonkill = 0;
        if (!isNumber(user.hashirakill)) user.hashirakill = 0;
        if (!isNumber(user.alldemonkill)) user.alldemonkill = 0;
        if (!isNumber(user.allhashirakill)) user.allhashirakill = 0;
        if (!isNumber(user.attack)) user.attack = 0;
        if (!isNumber(user.strenght)) user.strenght = 0;
        if (!isNumber(user.speed)) user.speed = 0;
        if (!isNumber(user.defense)) user.defense = 0;
        if (!isNumber(user.regeneration)) user.regeneration = 0;
        if (!isNumber(user.dana)) user.dana = 0;
        if (!isNumber(user.gopay)) user.gopay = 0;
        if (!isNumber(user.ovo)) user.ovo = 0;
        if (!isNumber(user.lastngaji)) user.lastngaji = 0;
        if (!isNumber(user.lastlonte)) user.lastlonte = 0;
        if (!isNumber(user.lastkoboy)) user.lastkoboy = 0;
        if (!isNumber(user.lastdate)) user.lastdate = 0;
        if (!isNumber(user.lasttambang)) user.lasttambang = 0;
        if (!isNumber(user.lastngepet)) user.lastngepet = 0;
        if (!isNumber(user.lasttaxi)) user.lasttaxi = 0;
        if (!isNumber(user.taxi)) user.taxi = 0;
        if (!isNumber(user.lastjobkerja)) user.lastjobkerja = 0;
        if (!isNumber(user.lastjobchange)) user.lastjobchange = 0;
      } else
        global.db.data.users[m.sender] = {
          lastjobkerja: 0,
          lastjobchange: 0,
          taxi: 0,
          lasttaxi: 0,
          lastyoutuber: 0,
          subscribers: 0,
          viewers: 0,
          like: 0,
          playButton: 0,
          saldo: 0,
          pengeluaran: 0,
          healt: 100,
          health: 100,
          energi: 100,
          power: 100,
          title: "",
          haus: 100,
          laper: 100,
          tprem: 0,
          stamina: 100,
          level: 0,
          follow: 0,
          lastfollow: 0,
          followers: 0,
          pasangan: "",
          sahabat: "",
          location: "Gubuk",
          titlein: "Belum Ada",
          ultah: "",
          waifu: "Belum Di Set",
          husbu: "Belum Di Set",
          pc: 0,
          exp: 0,
          coin: 0,
          atm: 0,
          limit: 10,
          skata: 0,
          tigame: 999,
          lastclaim: 0,
          judilast: 0,
          lastnambang: 0,
          lastnebang: 0,
          lastmulung: 0,
          lastkerja: 0,
          lastmaling: 0,
          lastbunuhi: 0,
          lastbisnis: 0,
          lastberbisnis: 0,
          bisnis: 0,
          berbisnis: 0,
          lastmancing: 0,
          pancing: 0,
          pancingan: 0,
          totalPancingan: 0,
          kardus: 0,
          botol: 0,
          kaleng: 0,
          money: 0,
          litecoin: 0,
          chip: 0,
          tiketcoin: 0,
          poin: 0,
          bank: 0,
          balance: 0,
          diamond: 0,
          emerald: 0,
          rock: 0,
          wood: 0,
          berlian: 0,
          iron: 0,
          emas: 0,
          common: 0,
          uncommon: 0,
          mythic: 0,
          legendary: 0,
          rumahsakit: 0,
          tambang: 0,
          camptroops: 0,
          pertanian: 0,
          fortress: 0,
          trofi: 0,
          rtrofi: "perunggu",
          makanan: 0,
          troopcamp: 0,
          shield: 0,
          arlok: 0,
          ojekk: 0,
          ojek: 0,
          lastngewe: 0,
          ngewe: 0,
          polisi: 0,
          pedagang: 0,
          dokter: 0,
          petani: 0,
          montir: 0,
          kuli: 0,
          korbanngocok: 0,
          //+ stamina
          coal: 0,
          korekapi: 0,
          ayambakar: 0,
          gulai: 0,
          rendang: 0,
          ayamgoreng: 0,
          oporayam: 0,
          steak: 0,
          babipanggang: 0,
          ikanbakar: 0,
          lelebakar: 0,
          nilabakar: 0,
          bawalbakar: 0,
          udangbakar: 0,
          pausbakar: 0,
          kepitingbakar: 0,
          soda: 0,
          vodka: 0,
          ganja: 0,
          bandage: 0,
          sushi: 0,
          roti: 0,
          //meracik
          ramuan: 0,
          lastramuanclaim: 0,
          gems: 0,
          cupon: 0,
          lastgemsclaim: 0,
          eleksirb: 0,
          penduduk: 0,
          archer: 0,
          shadow: 0,
          laststringclaim: 0,
          lastpotionclaim: 0,
          lastswordclaim: 0,
          lastweaponclaim: 0,
          lastironclaim: 0,
          lastmancingclaim: 0,
          anakpancingan: 0,
          //mancing
          as: 0,
          paus: 0,
          kepiting: 0,
          gurita: 0,
          cumi: 0,
          buntal: 0,
          dory: 0,
          lumba: 0,
          lobster: 0,
          hiu: 0,
          lele: 0,
          nila: 0,
          bawal: 0,
          udang: 0,
          ikan: 0,
          orca: 0,
          banteng: 0,
          harimau: 0,
          gajah: 0,
          kambing: 0,
          panda: 0,
          buaya: 0,
          kerbau: 0,
          sapi: 0,
          monyet: 0,
          babihutan: 0,
          babi: 0,
          ayam: 0,
          apel: 20,
          ayamb: 0,
          ayamg: 0,
          ssapi: 0,
          sapir: 0,
          leleb: 0,
          leleg: 0,
          esteh: 0,
          pet: 0,
          potion: 0,
          sampah: 0,
          kucing: 0,
          kucinglastclaim: 0,
          kucingexp: 0,
          kuda: 0,
          kudalastclaim: 0,
          rubah: 0,
          rubahlastclaim: 0,
          rubahexp: 0,
          anjing: 0,
          anjinglastclaim: 0,
          anjingexp: 0,
          naga: 0,
          nagalastclaim: 0,
          griffin: 0,
          griffinlastclaim: 0,
          centaur: 0,
          fightnaga: 0,
          centaurlastclaim: 0,
          serigala: 0,
          serigalalastclaim: 0,
          serigalaexp: 0,
          phonix: 0,
          phonixlastclaim: 0,
          phonixexp: 0,
          makanannaga: 0,
          makananphonix: 0,
          makanancentaur: 0,
          makananserigala: 0,

          Banneduser: false,
          BannedReason: "",
          banned: false,
          bannedTime: 0,
          warn: 0,
          afk: -1,
          afkReason: "",
          anakkucing: 0,
          anakkuda: 0,
          anakrubah: 0,
          anakanjing: 0,
          makananpet: 0,
          makananPet: 0,
          antispam: 0,
          antispamlastclaim: 0,
          kayu: 0,
          batu: 0,
          string: 0,
          umpan: 0,
          armor: 0,
          armordurability: 0,
          weapon: 0,
          weapondurability: 0,
          sword: 0,
          sworddurability: 0,
          pickaxe: 0,
          pickaxedurability: 0,
          fishingrod: 0,
          fishingroddurability: 0,
          katana: 0,
          katanadurability: 0,
          bow: 0,
          bowdurability: 0,
          kapak: 0,
          kapakdurability: 0,
          axe: 0,
          axedurability: 0,
          pisau: 0,
          pisaudurability: 0,
          kerjasatu: 0,
          kerjadua: 0,
          kerjatiga: 0,
          kerjaempat: 0,
          kerjalima: 0,
          kerjaenam: 0,
          kerjatujuh: 0,
          kerjadelapan: 0,
          kerjasembilan: 0,
          kerjasepuluh: 0,
          kerjasebelas: 0,
          kerjaduabelas: 0,
          kerjatigabelas: 0,
          kerjaempatbelas: 0,
          kerjalimabelas: 0,
          pekerjaansatu: 0,
          pekerjaandua: 0,
          pekerjaantiga: 0,
          pekerjaanempat: 0,
          pekerjaanlima: 0,
          pekerjaanenam: 0,
          pekerjaantujuh: 0,
          pekerjaandelapan: 0,
          pekerjaansembilan: 0,
          pekerjaansepuluh: 0,
          pekerjaansebelas: 0,
          pekerjaanduabelas: 0,
          pekerjaantigabelas: 0,
          pekerjaanempatbelas: 0,
          pekerjaanlimabelas: 0,
          lastadventure: 0,
          lastwar: 0,
          lastberkebon: 0,
          lastberburu: 0,
          lastbansos: 0,
          lastrampok: 0,
          lastkill: 0,
          lastfishing: 0,
          lastdungeon: 0,
          lastduel: 0,
          lastmining: 0,
          lasthourly: 0,
          lastdagang: 0,
          lasthunt: 0,
          lasthun: 0,
          lastweekly: 0,
          lastmonthly: 0,
          lastyearly: 0,
          lastjb: 0,
          lastrob: 0,
          lastdaang: 0,
          lastngojek: 0,
          lastgrab: 0,
          lastngocok: 0,
          lastturu: 0,
          lastseen: 0,
          lastSetStatus: 0,
          registered: false,
          apel: 20,
          mangga: 0,
          stroberi: 0,
          semangka: 0,
          jeruk: 0,
          semangka: 0,
          name: this.getName(m.sender),
          age: -1,
          regTime: -1,
          premiumDate: -1,
          premium: false,
          premiumTime: 0,
          vip: "tidak",
          vipPoin: 0,
          job: "Pengangguran",
          jobexp: 0,
          jail: false,
          penjara: false,
          antarpaket: 0,
          dirawat: false,
          lbars: "[▒▒▒▒▒▒▒▒▒]",
          role: "Newbie ㋡",
          registered: false,
          name: this.getName(m.sender),
          age: -1,
          regTime: -1,
          autolevelup: true,
          lastIstigfar: 0,

          skill: "",
          korps: "",
          korpsgrade: "",
          demon: "",
          breaths: "",
          magic: "",
          darahiblis: 0,
          demonblood: 0,
          demonkill: 0,
          hashirakill: 0,
          alldemonkill: 0,
          allhashirakill: 0,
          attack: 0,
          speed: 0,
          strenght: 0,
          defense: 0,
          regeneration: 0,
          ovo: 0,
          dana: 0,
          gopay: 0,
          lastngaji: 0,
          lastlonte: 0,
          lastkoboy: 0,
          lastdate: 0,
          lasttambang: 0,
          lastngepet: 0,
        };
      let chat = global.db.data.chats[m.chat];
      if (typeof chat !== "object") global.db.data.chats[m.chat] = {};
      if (chat) {
        if (!("isBanned" in chat)) chat.isBanned = false;
        if (!("welcome" in chat)) chat.welcome = true;
        if (!isNumber(chat.welcometype)) chat.welcometype = 1;
        if (!("detect" in chat)) chat.detect = false;
        if (!("isBannedTime" in chat)) chat.isBannedTime = false;
        if (!("mute" in chat)) chat.mute = false;
        if (!("listStr" in chat)) chat.listStr = {};
        if (!("sWelcome" in chat))
          chat.sWelcome =
            "*Selamat datang @user!*\n\n     Di group @subject\n\n╭─────「 *intro* 」\n│\n│─⪼ Nama : \n│─⪼ Umur :\n│─⪼ Askot :\n│─⪼ Gender :\n╰─────────────\n\n> semoga betah";
        if (!("sBye" in chat)) chat.sBye = "Al-fatihah untuk @user";
        if (!("sPromote" in chat)) chat.sPromote = "";
        if (!("sDemote" in chat)) chat.sDemote = "";
        if (!("delete" in chat)) chat.delete = true;
        if (!("antiLink" in chat)) chat.antiLink = true;
        if (!("antiLinknokick" in chat)) chat.antiLinknokick = false;
        if (!("antiSticker" in chat)) chat.antiSticker = false;
        if (!("antiStickernokick" in chat)) chat.antiStickernokick = false;
        if (!("viewonce" in chat)) chat.viewonce = false;
        if (!("antiporn" in chat)) chat.antiporn = false;
        if (!("antiToxic" in chat)) chat.antiToxic = false;
        if (!isNumber(chat.expired)) chat.expired = 0;
        if (!("memgc" in chat)) chat.memgc = {};
        if (!("antilinkig" in chat)) chat.antilinkig = false;
        if (!("antilinkignokick" in chat)) chat.antilinkignokick = false;
        if (!("antilinkfb" in chat)) chat.antilinkfb = false;
        if (!("antilinkfbnokick" in chat)) chat.antilinkfbnokick = false;
        if (!("antilinktwit" in chat)) chat.antilinktwit = false;
        if (!("antilinktwitnokick" in chat)) chat.antilinktwitnokick = false;
        if (!("antilinkyt" in chat)) chat.antilinkyt = false;
        if (!("antilinkytnokick" in chat)) chat.antilinkytnokick = false;
        if (!("antilinktele" in chat)) chat.antilinktele = false;
        if (!("antilinktelenokick" in chat)) chat.antilinktelenokick = false;
        if (!("antilinkwame" in chat)) chat.antilinkwame = false;
        if (!("antilinkwamenokick" in chat)) chat.antilinkwamenokick = false;
        if (!("antilinkall" in chat)) chat.antilinkall = false;
        if (!("antilinkallnokick" in chat)) chat.antilinkallnokick = false;
        if (!("antilinktt" in chat)) chat.antilinktt = false;
        if (!("antilinkttnokick" in chat)) chat.antilinkttnokick = false;
        if (!("antibot" in chat)) chat.antibot = false;
        if (!("autohd" in chat)) chat.autohd = false;
        if (!("autobio" in chat)) chat.autobio = false;
        if (!("rpg" in chat)) chat.rpg = false;
        if (!("autobackup" in chat)) chat.autobackup = false;
        if (!("autodl" in chat)) chat.autodl = true;
        if (!("notifgempa" in chat)) chat.notifgempa = false;
        if (!("notifcuaca" in chat)) chat.notifcuaca = false;
        if (!("notifsholat" in chat)) chat.notifsholat = false;
        if (!("autotranslate" in chat)) chat.autotranslate = false;
        if (!("antitagsw" in chat)) chat.antitagsw = false;
      } else
        global.db.data.chats[m.chat] = {
          autotranslate: false,
          notifsholat: false,
          notifgempa: false,
          notifcuaca: false,
          autodl: true,
          autobackup: false,
          autobio: false,
          autohd: false,
          antiporn: false,
          isBanned: false,
          welcome: true,
          welcometype: 1,
          detect: false,
          isBannedTime: false,
          mute: false,
          listStr: {},
          sWelcome:
            "*Selamat datang @user!*\n\n     Di group @subject\n\n╭─────「 *intro* 」\n│\n│─⪼ Nama : \n│─⪼ Umur :\n│─⪼ Askot :\n│─⪼ Gender :\n╰─────────────\n\n> semoga betah",
          sBye: "Al-fatihah untuk @user",
          sPromote: "",
          sDemote: "",
          delete: false,
          antiLink: false,
          antiLinknokick: false,
          antiSticker: false,
          antiStickernokick: false,
          viewonce: false,
          antiToxic: false,
          antilinkig: false,
          antilinkignokick: false,
          antilinkyt: false,
          antilinkytnokick: false,
          antilinktwit: false,
          antilinktwitnokick: false,
          antilinkfb: false,
          antilinkfbnokick: false,
          antilinkall: false,
          antilinkallnokick: false,
          antilinkwame: false,
          antilinkwamenokick: false,
          antilinktele: false,
          antilinktelenokick: false,
          antilinktt: false,
          antilinkttnokick: false,
          antibot: false,
          rpg: false,
          antitagsw: false,
          antidelete: false,
          autoacc: false,
        };
      if (!global.db.data.chats[m.chat].memgc[m.sender])
        global.db.data.chats[m.chat].memgc[m.sender] = {};
      let memgc = global.db.data.chats[m.chat].memgc[m.sender];
      if (typeof memgc !== "object")
        global.db.data.chats[m.chat].memgc[m.sender] = {};
      if (memgc) {
        if (!("blacklist" in memgc)) memgc.blacklist = false;
        if (!("banned" in memgc)) memgc.banned = false;
        if (!isNumber(memgc.bannedTime)) memgc.bannedTime = 0;
        if (!isNumber(memgc.chat)) memgc.chat = 0;
        if (!isNumber(memgc.chatTotal)) memgc.chatTotal = 0;
        if (!isNumber(memgc.command)) memgc.command = 0;
        if (!isNumber(memgc.commandTotal)) memgc.commandTotal = 0;
        if (!isNumber(memgc.lastseen)) memgc.lastseen = 0;
      } else
        global.db.data.chats[m.chat].memgc[m.sender] = {
          blacklist: false,
          banned: false,
          bannedTime: 0,
          chat: 0,
          chatTotal: 0,
          command: 0,
          commandTotal: 0,
          lastseen: 0,
        };
      const isROwner =
        global.ownerid && global.ownerid.length > 0
          ? global.ownerid.includes(m.sender.toString()) ||
            (m.senderOriginal &&
              global.ownerid.includes(m.senderOriginal.toString()))
          : false;
      const isOwner = isROwner || m.fromMe;
      const isPrems =
        isROwner ||
        (global.premid && global.premid.length > 0
          ? global.premid.includes(m.sender.toString()) ||
            (m.senderOriginal &&
              global.premid.includes(m.senderOriginal.toString()))
          : false) ||
        global.db.data.users[m.sender].premiumTime > 0 ||
        global.db.data.users[m.sender].premium;

      try {
        require("./lib/print")(m, this);
      } catch (e) {
        console.log(m, m.quoted, e);
      }

      for (const name in global.plugins) {
        const plugin = global.plugins[name];
        if (!plugin) continue;
        if (plugin.disabled) continue;

        let beforeHandler = null;
        let pluginData = plugin;

        if (typeof plugin === "function") {
          if (plugin.before && typeof plugin.before === "function") {
            beforeHandler = plugin.before;
            pluginData = plugin;
          }
        } else if (typeof plugin === "object") {
          if (plugin.before && typeof plugin.before === "function") {
            beforeHandler = plugin.before;
            pluginData = plugin;
          } else if (
            plugin.default &&
            plugin.default.before &&
            typeof plugin.default.before === "function"
          ) {
            beforeHandler = plugin.default.before;
            pluginData = plugin.default;
          } else if (
            plugin.run &&
            plugin.run.before &&
            typeof plugin.run.before === "function"
          ) {
            beforeHandler = plugin.run.before;
            pluginData = plugin.run;
          }
        }

        if (beforeHandler) {
          try {
            const beforeResult = await beforeHandler.call(this, m, {
              conn: this,
              isROwner,
              isOwner,
              isPrems,
              isBotAdmin: m.isBotAdmin,
              isAdmin: m.isAdmin,
              usedPrefix: m.prefix,
              text: m.text,
              args: m.args,
            });

            if (beforeResult === false) {
              console.log(
                `Plugin ${name} before handler returned false, skipping...`,
              );
              continue;
            }
          } catch (e) {
            console.error(`Plugin Before Error (${name}):`, e);
          }
        }
      }

      const processedCommands = new Set();

      for (const name in global.plugins) {
        const plugin = global.plugins[name];
        if (!plugin) continue;
        if (plugin.disabled) continue;

        let pluginData = plugin;
        let pluginHandler = null;

        if (typeof plugin === "function") {
          pluginHandler = plugin;
          pluginData = plugin;
        } else if (typeof plugin === "object") {
          if (plugin.handler && typeof plugin.handler === "function") {
            pluginHandler = plugin.handler;
            pluginData = plugin;
          } else if (plugin.default && typeof plugin.default === "function") {
            pluginHandler = plugin.default;
            pluginData = plugin.default;
          } else if (
            plugin.run &&
            plugin.run.async &&
            typeof plugin.run.async === "function"
          ) {
            pluginHandler = plugin.run.async;
            pluginData = plugin.run;
          } else if (
            typeof plugin.before === "function" &&
            !plugin.handler &&
            !plugin.default &&
            !plugin.run
          ) {
            continue;
          } else {
            pluginHandler = plugin;
            pluginData = plugin;
          }
        }

        if (!pluginHandler || typeof pluginHandler !== "function") continue;

        const str2Regex = (str) => str.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");

        let _prefix = pluginData.customPrefix || global.prefix || "/";

        if (!Array.isArray(_prefix)) {
          _prefix = [_prefix];
        }

        let match = null;
        let usedPrefix = "";

        if (m.text) {
          let textToProcess = m.text;

          if (m.isGroup && textToProcess.includes("@")) {
            const botUsername = global.botname?.toLowerCase() || "bot";
            const mentions = textToProcess.match(/@\w+/g) || [];

            for (const mention of mentions) {
              const mentionName = mention.slice(1).toLowerCase();
              if (
                mentionName.includes(botUsername) ||
                mentionName.includes("ztxzy_bot")
              ) {
                textToProcess = textToProcess.replace(mention, "").trim();
                break;
              }
            }
          }

          for (const prefix of _prefix) {
            if (prefix instanceof RegExp) {
              const regexMatch = prefix.exec(textToProcess);
              if (regexMatch) {
                match = [regexMatch, prefix];
                usedPrefix = regexMatch[0];
                break;
              }
            } else {
              const prefixStr = String(prefix);
              if (textToProcess.startsWith(prefixStr)) {
                match = [[prefixStr], new RegExp(str2Regex(prefixStr))];
                usedPrefix = prefixStr;
                break;
              }
            }
          }
        }

        if (match && usedPrefix && m.text) {
          let textToProcess = m.text;

          if (m.isGroup && textToProcess.includes("@")) {
            const botUsername = global.botname?.toLowerCase() || "bot";
            const mentions = textToProcess.match(/@\w+/g) || [];

            for (const mention of mentions) {
              const mentionName = mention.slice(1).toLowerCase();
              if (
                mentionName.includes(botUsername) ||
                mentionName.includes("ztxzy_bot")
              ) {
                textToProcess = textToProcess.replace(mention, "").trim();
                break;
              }
            }
          }

          const noPrefix = textToProcess.replace(usedPrefix, "");
          let [command, ...args] = noPrefix.trim().split` `.filter((v) => v);
          args = args || [];
          const _args = noPrefix.trim().split` `.slice(1);
          const text = _args.join` `;
          command = (command || "").toLowerCase();

          if (global.botnames) {
            const cleanName = String(global.botnames).replace(/^@/, ""); // hapus @ kalau ada
            const botRegex = new RegExp(`@${cleanName}`, "i"); // case-insensitive
            command = command.replace(botRegex, "").trim();
          }

          const fail = pluginData.fail || global.dfail;

          let isAccept = false;
          let commandList = pluginData.command || pluginData.usage;

          if (commandList) {
            if (commandList instanceof RegExp) {
              isAccept = commandList.test(command);
            } else if (Array.isArray(commandList)) {
              isAccept = commandList.some((cmd) =>
                cmd instanceof RegExp ? cmd.test(command) : cmd === command,
              );
            } else if (typeof commandList === "string") {
              isAccept = commandList === command;
            }
          }

          if (!isAccept) continue;

          const commandKey = `${m.sender}_${command}_${Date.now()}`;
          if (processedCommands.has(commandKey)) continue;
          processedCommands.add(commandKey);

          m.plugin = name;

          if (
            m.chat in global.db.data.chats ||
            m.sender in global.db.data.users
          ) {
            const chat = global.db.data.chats[m.chat];
            const user = global.db.data.users[m.sender];
            if (chat?.isBanned || chat?.mute) return;
            if (user && user.banned) return;
          }

          if (pluginData.rowner && pluginData.owner && !(isROwner || isOwner)) {
            fail("owner", m, this);
            continue;
          }
          if (pluginData.rowner && !isROwner) {
            fail("rowner", m, this);
            continue;
          }
          if (pluginData.owner && !isOwner) {
            fail("owner", m, this);
            continue;
          }
          if (pluginData.premium && !isPrems) {
            fail("premium", m, this);
            continue;
          }
          if (pluginData.group && !m.isGroup) {
            fail("group", m, this);
            continue;
          }
          if (pluginData.private && m.isGroup) {
            fail("private", m, this);
            continue;
          }
          if (pluginData.admin && !m.isAdmin) {
            fail("admin", m, this);
            continue;
          }

          m.isCommand = true;
          const xp = "exp" in pluginData ? Number.parseInt(pluginData.exp) : 17;
          if (xp > 200)
            m.reply(
              `⚠️ Peringatan: Pengalaman (${xp}) terlalu tinggi, disarankan tidak lebih dari 200!`,
            );
          else m.exp += xp;

          if (!isPrems && !isOwner && pluginData.limit) {
            const requiredLimit =
              pluginData.limit === true ? 1 : pluginData.limit;
            if (!args || args.length === 0) {
              m.limit = false;
            } else {
              if (global.db.data.users[m.sender].limit < requiredLimit) {
                if (global.db.data.users[m.sender].limit === 0) {
                  await m.reply(`Limit kamu habis`, m);
                } else {
                  await m.reply(
                    `Limit tidak mencukupi, membutuhkan ${requiredLimit}, dan kamu hanya mempunyai ${global.db.data.users[m.sender].limit}`,
                    m,
                  );
                }
                continue;
              }
              global.db.data.users[m.sender].limit -= requiredLimit;
              m.limit = requiredLimit;
            }
          }

          const extra = {
            match,
            usedPrefix,
            noPrefix,
            _args,
            args,
            command,
            text,
            conn: this,
            client: this,
            isROwner,
            isOwner,
            isPrems,
            isPrefix: usedPrefix,
            participants: m.participants || [],
            isBotAdmin: m.isBotAdmin,
            isAdmin: m.isAdmin,
            chatId: m.chat,
            userId: m.sender,
            Func: global.Func || {},
          };

          try {
            const result = await pluginHandler.call(this, m, extra);

            if (
              !isPrems &&
              !isOwner &&
              pluginData.limit &&
              typeof m.limit === "number" &&
              m.limit > 0
            ) {
              const sisa = global.db.data.users[m.sender].limit;
              const limitMsg = `✅ ${m.limit} limit terpakai\n💡 Sisa limit: ${sisa}`;

              try {
                if (m.isGroup) {
                  // 📨 Kirim ke PM user jika command dilakukan di grup
                  m.reply(limitMsg);
                  // await this.sendMessFage(m.sender, { text: limitMsg }, { quoted: m })
                } else {
                  // 📩 Kirim langsung di private
                  m.reply(limitMsg);
                  // await this.sendMessage(m.chat, { text: limitMsg }, { quoted: m })
                }
              } catch (e) {
                console.error("Gagal kirim info limit:", e);
              }
            }
          } catch (e) {
            if (!isPrems && !isOwner && pluginData.limit && m.limit) {
              global.db.data.users[m.sender].limit += m.limit;
              console.log(
                `Limit ${m.limit} tidak jadi digunakan karena terjadi error pada plugin ${name}`,
              );
            }

            if (isRealError(e)) {
              m.error = e;
              console.error(`Plugin Error (${m.plugin}):`, e);
              let text = util.format(e);
              text = maskSecrets(text, { APIKeys, aksesKey: global.aksesKey });
              for (const ownerId of global.ownerid) {
                try {
                  await this.reply(
                    ownerId,
                    `*Plugin Error:* ${m.plugin}\n*Sender:* ${m.sender}\n*Chat:* ${m.chat}\n*Command:* ${usedPrefix}${command} ${args.join(" ")}\n\n\`\`\`${text}\`\`\``,
                  );
                } catch (notifyError) {
                  console.error("Failed to notify owner:", notifyError);
                }
              }
              try {
                await m.reply(text);
              } catch (replyError) {
                console.error("Failed to reply error to user:", replyError);
              }
            } else {
              try {
                await m.reply(String(e));
              } catch (replyError) {
                console.error("Failed to reply to user:", replyError);
              }
            }
          } finally {
            if (typeof pluginData.after === "function") {
              try {
                await pluginData.after.call(this, m, extra);
              } catch (e) {
                console.error(`Plugin After Error (${m.plugin}):`, e);
              }
            }
          }

          break;
        }
      }

      const _user = global.db.data.users[m.sender];
      const stats = global.db.data.stats;
      if (m) {
        if (m.sender && _user) {
          _user.exp += m.exp;
        }

        let stat;
        if (m.plugin) {
          const now = +new Date();
          if (m.plugin in stats) {
            stat = stats[m.plugin];
            if (!isNumber(stat.total)) stat.total = 1;
            if (!isNumber(stat.success)) stat.success = m.error != null ? 0 : 1;
            if (!isNumber(stat.last)) stat.last = now;
            if (!isNumber(stat.lastSuccess))
              stat.lastSuccess = m.error != null ? 0 : now;
          } else {
            stat = stats[m.plugin] = {
              total: 1,
              success: m.error != null ? 0 : 1,
              last: now,
              lastSuccess: m.error != null ? 0 : now,
            };
          }
          stat.total += 1;
          stat.last = now;
          if (m.error == null) {
            stat.success += 1;
            stat.lastSuccess = now;
          }
        }
      }

      if (_user) {
        _user.chat++;
        _user.chatTotal++;
        _user.lastseen = Date.now();
      }

      if (m.chat && m.sender && global.db.data.chats?.[m.chat]?.memgc?.[m.sender]) {
  const memgc = global.db.data.chats[m.chat].memgc[m.sender];
  memgc.chat = (memgc.chat || 0) + 1;
  memgc.chatTotal = (memgc.chatTotal || 0) + 1;
  memgc.lastseen = Date.now();
}
    } catch (e) {
      console.error("Handler Error:", e);
    }
  },

  async participantsUpdate(ctx) {
    try {
      await global.loadDatabase();

      console.log("[participantsUpdate] triggered");
      console.log(
        "[participantsUpdate] new_chat_members:",
        ctx.message?.new_chat_members,
      );
      console.log(
        "[participantsUpdate] left_chat_member:",
        ctx.message?.left_chat_member,
      );

      const handleWelcome = async () => {
        try {
          const chatId = ctx.chat.id;
          const groupMetadata = await this.groupMetadata(chatId);

          if (!global.db.data.chats[chatId]) {
            global.db.data.chats[chatId] = {
              welcome: true,
              sWelcome: "Selamat datang @user di grup @subject!",
              sBye: "Selamat tinggal @user",
              participants: [],
            };
          }

          const chat = global.db.data.chats[chatId];

          for (const member of ctx.message.new_chat_members) {
            if (!chat.participants) chat.participants = [];
            if (!chat.participants.includes(member.id)) {
              chat.participants.push(member.id);
            }
          }

          for (const member of ctx.message.new_chat_members) {
  if (!global.db.data.chats[chatId].memgc) global.db.data.chats[chatId].memgc = {};
  if (!global.db.data.chats[chatId].memgc[member.id]) {
    global.db.data.chats[chatId].memgc[member.id] = {
      blacklist: false,
      banned: false,
      bannedTime: 0,
      chat: 0,
      chatTotal: 0,
      command: 0,
      commandTotal: 0,
      lastseen: Date.now()
    };
  }
  if (!global.db.data.users[member.id]) global.db.data.users[member.id] = {};
  global.db.data.users[member.id].name = member.first_name || String(member.id);
}

          if (!chat.welcome) return;

          const chatTitle = ctx.chat.title || "Unknown Group";
          const groupDesc = groupMetadata.description || "Tidak ada deskripsi";

          for (const member of ctx.message.new_chat_members) {
            const userName =
              member.first_name +
              (member.last_name ? " " + member.last_name : "");
            const mention = member.username
              ? `@${member.username}`
              : `[${userName}](tg://user?id=${member.id})`;

            const welcomeText = (
              chat.sWelcome || "Selamat datang @user di grup @subject!"
            )
              .replace(/@user/gi, mention)
              .replace(/@subject/gi, chatTitle)
              .replace(/@desc/gi, groupDesc);

            let profilePicUrl =
              "https://cdn.discordapp.com/embed/avatars/0.png";
            try {
              const userProfilePhotos = await ctx.telegram.getUserProfilePhotos(
                member.id,
              );
              if (userProfilePhotos?.total_count > 0) {
                const fileId = userProfilePhotos.photos[0][0].file_id;
                const file = await ctx.telegram.getFile(fileId);
                profilePicUrl = `https://api.telegram.org/file/bot${this.token}/${file.file_path}`;
              }
            } catch (e) {
              console.error("Failed to get profile picture:", e);
            }

            try {
              const Canvafy = require("canvafy");
              const welcomeCard = await new Canvafy.WelcomeLeave()
                .setAvatar(profilePicUrl)
                .setBackground(
                  "image",
                  "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1200&h=675",
                )
                .setTitle("Selamat Datang!")
                .setDescription(`${userName} telah bergabung ke ${chatTitle}`)
                .setBorder("#2a2a2a")
                .setAvatarBorder("#2a2a2a")
                .setOverlayOpacity(0.3)
                .build();

              await ctx.telegram.sendPhoto(
                chatId,
                { source: welcomeCard },
                {
                  caption: welcomeText,
                  parse_mode: "Markdown",
                },
              );

              await ctx.telegram.sendAudio(
                chatId,
                { source: fs.createReadStream("./media/welcome.mp3") },
                {
                  title: `Welcome ${userName}`,
                  performer: chatTitle,
                  caption: `Selamat datang ${mention} di ${chatTitle}!`,
                },
              );
            } catch (e) {
              console.error(
                "Error sending welcome card, falling back to text:",
                e,
              );
              await ctx.telegram.sendMessage(chatId, welcomeText, {
                parse_mode: "Markdown",
              });
            }
          }
        } catch (error) {
          console.error("Error in handleWelcome:", error);
        }
      };

      const handleGoodbye = async () => {
        try {
          const chatId = ctx.chat.id;

          if (!global.db.data.chats[chatId]) {
            global.db.data.chats[chatId] = {
              welcome: true,
              sWelcome: "Selamat datang @user di grup @subject!",
              sBye: "Selamat tinggal @user",
              participants: [],
            };
          }

          const chat = global.db.data.chats[chatId];
          const member = ctx.message.left_chat_member;

          if (chat.participants) {
            const index = chat.participants.indexOf(member.id);
            if (index > -1) chat.participants.splice(index, 1);
          }

          if (!chat.welcome) return;

          const chatTitle = ctx.chat.title || "Unknown Group";
          const userName =
            member.first_name +
            (member.last_name ? " " + member.last_name : "");
          const mention = member.username
            ? `@${member.username}`
            : `[${userName}](tg://user?id=${member.id})`;

          const goodbyeText = (chat.sBye || "Selamat tinggal @user")
            .replace(/@user/gi, mention)
            .replace(/@subject/gi, chatTitle);

          let profilePicUrl = "https://cdn.discordapp.com/embed/avatars/0.png";
          try {
            const profilePhotos = await ctx.telegram.getUserProfilePhotos(
              member.id,
            );
            if (profilePhotos?.total_count > 0) {
              const fileId = profilePhotos.photos[0][0].file_id;
              const file = await ctx.telegram.getFile(fileId);
              profilePicUrl = `https://api.telegram.org/file/bot${this.token}/${file.file_path}`;
            }
          } catch (e) {
            console.log("Using default avatar");
          }

          try {
            const Canvafy = require("canvafy");
            const goodbyeCard = await new Canvafy.WelcomeLeave()
              .setAvatar(profilePicUrl)
              .setBackground(
                "image",
                "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1200&h=675",
              )
              .setTitle("Selamat Tinggal!")
              .setDescription(`${userName} telah meninggalkan ${chatTitle}`)
              .setBorder("#2a2a2a")
              .setAvatarBorder("#2a2a2a")
              .setOverlayOpacity(0.3)
              .build();

            await ctx.telegram.sendPhoto(
              chatId,
              { source: goodbyeCard },
              {
                caption: goodbyeText,
                parse_mode: "Markdown",
              },
            );

            await ctx.telegram.sendAudio(
              chatId,
              { source: fs.createReadStream("./media/leave.mp3") },
              {
                title: `GoodBye ${userName}`,
                performer: chatTitle,
                caption: `Selamat tinggal ${mention} dari ${chatTitle}!`,
              },
            );
          } catch (e) {
            console.error(
              "Error sending goodbye card, falling back to text:",
              e,
            );
            await ctx.telegram.sendMessage(chatId, goodbyeText, {
              parse_mode: "Markdown",
            });
          }
        } catch (error) {
          console.error("Error in handleGoodbye:", error);
        }
      };

      if (ctx.chatMember) {
  const oldStatus = ctx.chatMember.old_chat_member?.status;
  const newStatus = ctx.chatMember.new_chat_member?.status;
  const user = ctx.chatMember.new_chat_member?.user;
  const from = ctx.chatMember.from;
  const chatId = ctx.chat?.id;

  if (!user || !from || !chatId) return;

  const mention = (u) => u.username
    ? `@${u.username}`
    : `[${u.first_name || u.id}](tg://user?id=${u.id})`;

  if (oldStatus !== 'administrator' && newStatus === 'administrator') {
    await this.sendMessage(chatId, {
      text: `${mention(from)} telah menjadikan ${mention(user)} sebagai *admin*.`
    }, { parse_mode: 'Markdown' });

  } else if (oldStatus === 'administrator' && newStatus === 'member') {
    await this.sendMessage(chatId, {
      text: `${mention(from)} telah memberhentikan ${mention(user)} dari *admin*.`
    }, { parse_mode: 'Markdown' });
  }
}

      if (ctx.message?.new_chat_members) {
        await handleWelcome();
      } else if (ctx.message?.left_chat_member) {
        await handleGoodbye();
      }
    } catch (e) {
      console.error("Error in participantsUpdate:", e);
    }
  },
};
global.error = global.message.error;
global.dfail = async (type, m, conn) => {
  const msg =
    global.message?.[type] || "Perintah ini tidak bisa digunakan di sini.";
  return await m.reply(msg);
};

const file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.redBright("Update handler.js"));
  delete require.cache[file];
});
