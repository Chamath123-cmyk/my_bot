process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const P = require("pino");
const axios = require("axios");
const https = require("https");

const agent = new https.Agent({ rejectUnauthorized: false });

let lastAutoReplyTime = {};
const ownerNumber = "94702903738@s.whatsapp.net";

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, P({ level: "silent" })),
    },
    logger: P({ level: "silent" }),
    printQRInTerminal: false,
    browser: ["Ubuntu", "Chrome", "20.0.04"],
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  if (!sock.authState.creds.registered) {
    const phoneNumber = "94702903738";
    setTimeout(async () => {
      try {
        let code = await sock.requestPairingCode(phoneNumber);
        code = code?.match(/.{1,4}/g)?.join("-") || code;
        console.log("\n\n====================================");
        console.log(`✅ YOUR PAIRING CODE: ${code}`);
        console.log("====================================\n\n");
      } catch (err) {
        console.error("❌ Pairing Code ලබාගැනීමේදී දෝෂයක්:", err.message);
      }
    }, 10000);
  }

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect.error instanceof Boom)?.output?.statusCode !==
        DisconnectReason.loggedOut;
      if (shouldReconnect) connectToWhatsApp();
    } else if (connection === "open") {
      console.log("✅ බොට් සාර්ථකව සම්බන්ධ වුණා!");
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async (m) => {
    const msg = m.messages[0];
    if (!msg.message) return;

    const from = msg.key.remoteJid;
    const isOwner = msg.key.fromMe || from === ownerNumber;
    const text =
      msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    const lowerText = text.toLowerCase().trim();

    // --- OWNER COMMANDS ---
    if (isOwner) {
      // BLOCK COMMAND
      if (lowerText === ".block") {
        await sock.sendMessage(from, {
          text: "🚫 ඔබව Chamath විසින් Block කරනු ලැබුවා. මින් ඉදිරියට ඔබට පණිවිඩ එවීමට නොහැක.",
        });
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Message එක යනකම් තත්පරයක් ඉන්නවා
        await sock.updateBlockStatus(from, "block");
        return;
      }

      // UNBLOCK COMMAND
      if (lowerText === ".unblock") {
        await sock.updateBlockStatus(from, "unblock");
        return await sock.sendMessage(from, {
          text: "✅ ඔබව Chamath විසින් සාර්ථකව Unblock කරනු ලැබුවා.",
        });
      }

      // CLEAR COMMAND
      if (lowerText === ".clear") {
        await sock.sendMessage(from, {
          text: "🗑️ මෙම චැට් එක සාර්ථකව Clear කරන ලදී.",
        });
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await sock.chatModify(
          {
            delete: true,
            lastMessages: [
              { key: msg.key, messageTimestamp: msg.messageTimestamp },
            ],
          },
          from,
        );
        return;
      }

      if (lowerText === ".info") {
        return await handleInfo(sock, from, msg);
      }

      if (lowerText === ".menu") {
        const menuText = `🛠️ *BOT COMMAND MENU* 🛠️\n\n*Owner Commands:* \n• .block - Block current chat\n• .unblock - Unblock current chat\n• .clear - Clear chat\n• .info - Get user details\n\n*Downloader:* \n• .fb [link]\n• .tk [link]\n• .ig [link]\n\n*General:* \n• .owner - Admin info\n\n© Chamath N Dissanayake`;
        return await sock.sendMessage(
          from,
          { text: menuText },
          { quoted: msg },
        );
      }
    }

    // --- PUBLIC COMMANDS & AUTO REPLIES (ඔයාට ඉහලින් දීපු විදියටම තියෙනවා) ---
    if (lowerText === ".owner") {
      const ownerImg =
        "https://raw.githubusercontent.com/Chamath123-cmyk/my_bot/main/owner.jpeg";
      const ownerInfo = `👤 *OWNER DETAILS*\n\n• *Name:* Chamath N Dissanayake\n• *Role:* Bot Developer\n• *FB Page:* https://www.facebook.com/Chamathndissanayake\n\n© Powered by Chamath N Dissanayake`;
      return await sock.sendMessage(
        from,
        { image: { url: ownerImg }, caption: ownerInfo },
        { quoted: msg },
      );
    }

    if (
      text.startsWith(".fb ") ||
      text.startsWith(".tk ") ||
      text.startsWith(".ig ")
    ) {
      return await handleDownload(sock, from, msg, text);
    }

    if (msg.key.fromMe) return;

    const hiMessages = [
      "hii",
      "hi",
      "hy",
      "hyy",
      "hyyy",
      "ee",
      "eee",
      "eeee",
      "e bn",
      "kammliy",
      "kmmliy",
      "kmmliya",
      "ei",
      "eii",
      "eiii",
      "hutto",
      "huttoo",
      "huttooo",
      "me",
      "mee",
      "meee",
    ];
    if (hiMessages.includes(lowerText)) {
      const infoMessage = `👋 Hello! Hii...\n\nI'm Dulina's private bot assistant.\n\n👤 *Creator Details:*\n• owner: Chamath N Dissanayake\n• Status: Bot Developer\n• FB profile: https://www.facebook.com/share/p/1BAip71vk6/?mibextid=wwXIfr\n\n🤖 *Bot Details:*\n• Name: Multi-Downloader Bot\n• Function: Download Videos from FB, TikTok, IG\n• Status: Active(Under development)\n\n🚀 *Commands:*\n• .fb [link] - Facebook Downloader\n• .tk [link] - TikTok Downloader\n• .ig [link] - Instagram Downloader\n\n© Powered by Chamath N Dissanayake`;
      return await sock.sendMessage(
        from,
        { text: infoMessage },
        { quoted: msg },
      );
    }

    if (lowerText === "1") {
      const reply1 = `අනුන්ගේ දේවල් සොයන්නට ගොස් තමන්ගේ කාලය නිකරුණේ නාස්ති කරගන්න එපා❌. ඔබේ දියුණුව සඳහා වැඩක් කරගන්න. ස්තූතියි!⚠️\n\n🤖_Chamath's Bot Assistant_\n© Powered by 🔰*Chamath N Dissanayake*`;
      const rawVideoUrl =
        "https://raw.githubusercontent.com/Chamath123-cmyk/my_bot/main/video.mp4";
      return await sock.sendMessage(
        from,
        { video: { url: rawVideoUrl }, caption: reply1 },
        { quoted: msg },
      );
    }

    if (lowerText === "2" || lowerText === "3") {
      const replyRest = `Chamath එනකම් රැඳී සිටින්න.🕐 ඔහු ඉක්මනින් ඔබව සම්බන්ධ කර ගනීවි.\n\n🤖_Chamath's Bot Assistant_\n© Powered by 🔰*Chamath N Dissanayake*`;
      return await sock.sendMessage(from, { text: replyRest }, { quoted: msg });
    }

    if (!from.endsWith("@g.us")) {
      const now = Date.now();
      const lastTime = lastAutoReplyTime[from] || 0;
      if (now - lastTime > 1800000) {
        const autoReplyMenu = `Chamathමේ මොහොතේ කාර්යබහුලයි📵. ඔබ පැමිණි කාරණය කෙටියෙන් ඉදිරිපත් කරන්න. මම දුලින ගේ සහායක බොට් (Dulina's Bot Assistant) 🤖.\n\nඔබ පැමිණියේ:🚀 \n1️⃣. Results ඇසීමට නම් ⚠️ - (1)\n2️⃣. පෞද්ගලික යමක් කතා කිරීමට නම් - (2)\n3️⃣. වෙනත් දෙයක් කතා කිරීමට නම් - (3)\n\nකරුණාකර අදාළ අංකය ඇතුළත් කර එවන්න.🔢\n\n🤖_Dulina's Bot Assistant_\n© Powered by 🔰*Chamath N Dissanayake*`;
        await sock.sendMessage(from, { text: autoReplyMenu }, { quoted: msg });
        lastAutoReplyTime[from] = now;
      }
    }
  });
}

// Handle Info function
async function handleInfo(sock, from, msg) {
  try {
    const isGroup = from.endsWith("@g.us");
    const targetJid = isGroup ? msg.key.participant || msg.key.remoteJid : from;
    const targetNumber = targetJid.split("@")[0].split(":")[0];
    let targetName = msg.pushName || "User";
    let ppUrl;
    try {
      ppUrl = await sock.profilePictureUrl(targetJid, "image");
    } catch {
      ppUrl =
        "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";
    }
    let status;
    try {
      const statusData = await sock.fetchStatus(targetJid);
      status = statusData.status || "No Status";
    } catch {
      status = "Privacy Protected";
    }
    const infoText = `👤 *USER INFORMATION* 👤\n\n🔹 *Name:* ${targetName}\n🔹 *Number:* ${targetNumber}\n🔹 *About:* ${status}\n\n🚀 *Bot by Chamath N Dissanayake*`;
    await sock.sendMessage(
      from,
      { image: { url: ppUrl }, caption: infoText },
      { quoted: msg },
    );
  } catch (e) {
    console.log(e);
  }
}

// Handle Download function
async function handleDownload(sock, from, msg, text) {
  const cmd = text.split(" ")[0];
  const url = text.split(" ")[1];
  if (!url)
    return sock.sendMessage(from, { text: "කරුණාකර ලින්ක් එකක් ලබාදෙන්න!" });
  try {
    await sock.sendMessage(from, { text: "වීඩියෝව සකස් කරමින් පවතිනවා... ⏳" });
    let apiUrl = "";
    if (cmd === ".fb")
      apiUrl = `https://dark-yoshio-official.vercel.app/api/downloader/fbdl?url=${url}`;
    if (cmd === ".tk")
      apiUrl = `https://dark-yoshio-official.vercel.app/api/downloader/tiktok?url=${url}`;
    if (cmd === ".ig")
      apiUrl = `https://dark-yoshio-official.vercel.app/api/downloader/igdl?url=${url}`;
    const res = await axios.get(apiUrl, { httpsAgent: agent });
    const result = res.data.result;
    const videoLink =
      result.url ||
      result.video ||
      result.hd ||
      result.sd ||
      (result[0] && result[0].url);
    if (videoLink) {
      await sock.sendMessage(
        from,
        { video: { url: videoLink }, caption: "✅ සාර්ථකව ඩවුන්ලෝඩ් වුණා!" },
        { quoted: msg },
      );
    } else {
      await sock.sendMessage(from, { text: "වීඩියෝව සොයාගත නොහැකි විය." });
    }
  } catch (e) {
    await sock.sendMessage(from, { text: "සර්වර් එකේ දෝෂයක්." });
  }
}

connectToWhatsApp();
