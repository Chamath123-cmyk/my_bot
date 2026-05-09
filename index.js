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
const express = require("express"); // Railway එකේ keep-alive තබා ගැනීමට අවශ්‍යයි
const fs = require("fs");

// Railway එකේ Crash නොවී තබා ගැනීමට Express සේවාදායකය
const app = express();
const port = process.env.PORT || 8080;
app.get("/", (req, res) => res.send("Bot is Running... ✅"));
app.listen(port, () => console.log(`Server started on port ${port}`));

const agent = new https.Agent({ rejectUnauthorized: false });

let lastAutoReplyTime = {};
const ownerNumber = "94702903738@s.whatsapp.net";

async function connectToWhatsApp() {
  // Auth folder එක නැතිනම් සාදා ගැනීම (Railway Crash වැළැක්වීමට)
  if (!fs.existsSync("./auth_info_baileys")) {
    fs.mkdirSync("./auth_info_baileys");
  }

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
      const statusCode = (lastDisconnect.error instanceof Boom)?.output
        ?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) connectToWhatsApp();
    } else if (connection === "open") {
      console.log("✅ බොට් සාර්ථකව සම්බන්ධ වුණා!");
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async (m) => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.remoteJid === "status@broadcast") return;

    const from = msg.key.remoteJid;
    const isOwner = msg.key.fromMe || from === ownerNumber;
    const text =
      msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    const lowerText = text.toLowerCase().trim();

    // --- OWNER COMMANDS ---
    if (isOwner) {
      if (lowerText === ".block") {
        await sock.sendMessage(from, {
          text: "🚫 ඔබව Chamath විසින් Block කරනු ලැබුවා. මින් ඉදිරියට ඔබට පණිවිඩ එවීමට නොහැක.",
        });
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await sock.updateBlockStatus(from, "block");
        return;
      }
      if (lowerText === ".unblock") {
        await sock.updateBlockStatus(from, "unblock");
        return await sock.sendMessage(from, {
          text: "✅ ඔබව Chamath විසින් සාර්ථකව Unblock කරනු ලැබුවා.",
        });
      }
      if (lowerText === ".clear") {
        await sock.sendMessage(from, {
          text: "🗑️ මෙම චැට් එක සාර්ථකව Clear කරන ලදී.",
        });
        return await sock.chatModify(
          {
            delete: true,
            lastMessages: [
              { key: msg.key, messageTimestamp: msg.messageTimestamp },
            ],
          },
          from,
        );
      }
      if (lowerText === ".info") return await handleInfo(sock, from, msg);
      if (lowerText === ".menu") {
        const menuText = `🛠️ *BOT COMMAND MENU* 🛠️\n\n*Owner Commands:* \n• .block\n• .unblock\n• .clear\n• .info\n\n*Downloader:* \n• .fb [link]\n• .tk [link]\n• .ig [link]\n\n*General:* \n• .owner\n\n© Chamath N Dissanayake`;
        return await sock.sendMessage(
          from,
          { text: menuText },
          { quoted: msg },
        );
      }
    }

    if (lowerText === ".owner") {
      const ownerImg =
        "https://raw.githubusercontent.com/Chamath123-cmyk/my_bot/main/owner.jpg";
      const ownerInfo = `👤 *OWNER DETAILS*\n\n• *Name:* Chamath N Dissanayake\n• *FB Page:* https://www.facebook.com/Chamathndissanayake`;
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

    const hiMessages = ["hii", "hi", "hy", "ee", "ei", "hutto", "me"];
    if (hiMessages.some((h) => lowerText.startsWith(h))) {
      const infoMessage = `👋 Hello! Hii...\n\nI'm Chamath's private bot assistant.\n\n🚀 *Commands:*\n• .fb [link]\n• .tk [link]\n• .ig [link]`;
      return await sock.sendMessage(
        from,
        { text: infoMessage },
        { quoted: msg },
      );
    }

    if (lowerText === "1") {
      const rawVideoUrl =
        "https://raw.githubusercontent.com/Chamath123-cmyk/my_bot/main/video.mp4";
      return await sock.sendMessage(
        from,
        { video: { url: rawVideoUrl }, caption: "🤖 Chamath's Bot Assistant" },
        { quoted: msg },
      );
    }

    if (lowerText === "2" || lowerText === "3") {
      return await sock.sendMessage(
        from,
        { text: "Chamath එනකම් රැඳී සිටින්න.🕐" },
        { quoted: msg },
      );
    }

    if (!from.endsWith("@g.us")) {
      const now = Date.now();
      if (now - (lastAutoReplyTime[from] || 0) > 1800000) {
        const autoReplyMenu = `Chamath N Dissanayake මේ මොහොතේ කාර්යබහුලයි📵.\n\n1️⃣. Results ඇසීමට (1)\n2️⃣. පෞද්ගලික යමක් (2)\n3️⃣. වෙනත් දෙයක් (3)`;
        await sock.sendMessage(from, { text: autoReplyMenu }, { quoted: msg });
        lastAutoReplyTime[from] = now;
      }
    }
  });
}

async function handleInfo(sock, from, msg) {
  try {
    const isGroup = from.endsWith("@g.us");
    const targetJid = isGroup ? msg.key.participant || msg.key.remoteJid : from;
    let ppUrl;
    try {
      ppUrl = await sock.profilePictureUrl(targetJid, "image");
    } catch {
      ppUrl =
        "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";
    }

    const infoText = `👤 *USER INFORMATION*\n🔹 *Number:* ${targetJid.split("@")[0]}`;
    await sock.sendMessage(
      from,
      { image: { url: ppUrl }, caption: infoText },
      { quoted: msg },
    );
  } catch (e) {
    console.log(e);
  }
}

async function handleDownload(sock, from, msg, text) {
  const url = text.split(" ")[1];
  if (!url)
    return sock.sendMessage(from, { text: "කරුණාකර ලින්ක් එකක් ලබාදෙන්න!" });
  try {
    await sock.sendMessage(from, { text: "වීඩියෝව සකස් කරමින් පවතිනවා... ⏳" });
    let apiUrl = `https://api.giftedtech.my.id/api/download/dl?url=${encodeURIComponent(url)}`;

    const res = await axios.get(apiUrl, { httpsAgent: agent, timeout: 30000 });
    const data = res.data;

    if (data.success && data.result) {
      const videoLink = data.result.download_url || data.result.url;
      await sock.sendMessage(
        from,
        { video: { url: videoLink }, caption: "✅ සාර්ථකයි!" },
        { quoted: msg },
      );
    } else {
      await sock.sendMessage(from, { text: "වීඩියෝව සොයාගත නොහැකි විය." });
    }
  } catch (e) {
    await sock.sendMessage(from, { text: "සර්වර් දෝෂයක් හෝ Timeout එකක්." });
  }
}

connectToWhatsApp();
