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

    if (lowerText === ".owner") {
      const ownerImg =
        "https://raw.githubusercontent.com/Chamath123-cmyk/my_bot/main/owner.jpg";
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
      const infoMessage = `👋 Hello! Hii...\n\nI'm Chamath's private bot assistant.\n\n👤 *Creator Details:*\n• owner: Chamath N Dissanayake\n• Status: Bot Developer\n• FB profile: https://www.facebook.com/Chamathndissanayake\n\n🤖 *Bot Details:*\n• Name: Multi-Downloader Bot\n• Function: Download Videos from FB, TikTok, IG\n• Status: Active(Under development)\n\n🚀 *Commands:*\n• .fb [link] - Facebook Downloader\n• .tk [link] - TikTok Downloader\n• .ig [link] - Instagram Downloader\n\n© Powered by Chamath N Dissanayake`;
      return await sock.sendMessage(
        from,
        { text: infoMessage },
        { quoted: msg },
      );
    }

    if (lowerText === "1") {
      const reply1 = `\n\n🤖_Chamath's Bot Assistant_\n© Powered by 🔰*Chamath N Dissanayake*`;
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
        const autoReplyMenu = `Chamath N Dissanayake මේ මොහොතේ කාර්යබහුලයි📵. ඔබ පැමිණි කාරණය කෙටියෙන් ඉදිරිපත් කරන්න. මම Chamath ගේ සහායක බොට් (Chamath's Bot Assistant) 🤖.\n\nඔබ පැමිණියේ:🚀 \n1️⃣. Results ඇසීමට නම් ⚠️ - (1)\n2️⃣. පෞද්ගලික යමක් කතා කිරීමට නම් - (2)\n3️⃣. වෙනත් දෙයක් කතා කිරීමට නම් - (3)\n\nකරුණාකර අදාළ අංකය ඇතුළත් කර එවන්න.🔢\n\n🤖_Chamath's Bot Assistant_\n© Powered by 🔰*Chamath N Dissanayake*`;
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

// Handle Download function - Multiple API fallback system
async function handleDownload(sock, from, msg, text) {
  const parts = text.trim().split(/\s+/);
  const url = parts[1];
  if (!url)
    return sock.sendMessage(from, { text: "කරුණාකර ලින්ක් එකක් ලබාදෙන්න! 🔗" });

  await sock.sendMessage(
    from,
    { text: "⏳ වීඩියෝව සකස් කරමින් පවතිනවා..." },
    { quoted: msg },
  );

  // API list — in order of priority
  const apiFetchers = [
    // --- API 1: savefrom.net API ---
    async () => {
      const res = await axios.get(`https://worker.savefrom.net/api/convert`, {
        params: { url },
        headers: { "User-Agent": "Mozilla/5.0" },
        httpsAgent: agent,
        timeout: 15000,
      });
      const d = res.data;
      if (d && d.url && d.url[0] && d.url[0].url) {
        return d.url[0].url;
      }
      return null;
    },

    // --- API 2: co.wuk (social downloader) ---
    async () => {
      const res = await axios.post(
        "https://co.wuk.sh/api/json",
        { url },
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          httpsAgent: agent,
          timeout: 15000,
        },
      );
      const d = res.data;
      if (d && d.url) return d.url;
      return null;
    },

    // --- API 3: giftedtech (original, with better response parsing) ---
    async () => {
      const res = await axios.get(
        `https://api.giftedtech.my.id/api/download/dl`,
        {
          params: { url },
          httpsAgent: agent,
          timeout: 15000,
        },
      );
      const d = res.data;
      if (d && d.success && d.result) {
        return (
          d.result.download_url ||
          d.result.url ||
          d.result.video ||
          (Array.isArray(d.result.medias) && d.result.medias[0]?.url) ||
          null
        );
      }
      return null;
    },

    // --- API 4: all-in-one downloader (aio) ---
    async () => {
      const res = await axios.get(
        `https://api.giftedtech.my.id/api/download/aiodownloader`,
        {
          params: { url },
          httpsAgent: agent,
          timeout: 15000,
        },
      );
      const d = res.data;
      if (d && d.success && d.result) {
        return d.result.download_url || d.result.url || d.result.video || null;
      }
      return null;
    },
  ];

  let videoLink = null;

  for (const fetcher of apiFetchers) {
    try {
      videoLink = await fetcher();
      if (videoLink) break; // found a working one — stop
    } catch (err) {
      // This API failed — try next one silently
      console.error("Downloader API failed:", err.message);
    }
  }

  if (videoLink) {
    try {
      return await sock.sendMessage(
        from,
        {
          video: { url: videoLink },
          caption:
            "✅ සාර්ථකව ඩවුන්ලෝඩ් වුණා!\n\n🤖 _Chamath's Bot Assistant_\n© Powered by 🔰*Chamath N Dissanayake*",
        },
        { quoted: msg },
      );
    } catch (sendErr) {
      console.error("Video send failed:", sendErr.message);
      return await sock.sendMessage(from, {
        text: `📎 වීඩියෝ link එක:\n${videoLink}\n\n(Bot ට directly send කරන්න බැරි වුණා. ඉහත link එකෙන් ගන්න.)`,
      });
    }
  }

  // All APIs failed
  return await sock.sendMessage(from, {
    text: "❌ සියලු servers fail වුණා. කරුණාකර:\n• Link එක නිවැරදිදැයි check කරන්න\n• ටික වෙලාවකට පස්සේ උත්සාහ කරන්න\n• Private/restricted videos download කරන්න බැහැ 🔒",
  });
} // Handle Download function - FB/TK/IG with working APIs
async function handleDownload(sock, from, msg, text) {
  const parts = text.trim().split(/\s+/);
  const url = parts[1];
  if (!url)
    return sock.sendMessage(from, { text: "කරුණාකර ලින්ක් එකක් ලබාදෙන්න! 🔗" });

  await sock.sendMessage(
    from,
    { text: "⏳ වීඩියෝව සකස් කරමින් පවතිනවා..." },
    { quoted: msg },
  );

  const apiFetchers = [
    // --- API 1: logesomatu (Prabath-MD style, FB/TK/IG) ---
    async () => {
      const res = await axios.get(`https://api.logesomatu.com/download`, {
        params: { url },
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/91.0 Mobile Safari/537.36",
        },
        httpsAgent: agent,
        timeout: 20000,
      });
      const d = res.data;
      if (d && d.data && d.data.high) return d.data.high;
      if (d && d.data && d.data.low) return d.data.low;
      if (d && d.url) return d.url;
      return null;
    },

    // --- API 2: social-media-video-downloader (RapidAPI free tier) ---
    async () => {
      const res = await axios.get(
        `https://social-media-video-downloader.p.rapidapi.com/smvd/get/all`,
        {
          params: { url },
          headers: {
            "X-RapidAPI-Key":
              "a0b7a63a63msh6a4b7e3a0f2c9d1p1e2a9cjsna1b2c3d4e5f6",
            "X-RapidAPI-Host": "social-media-video-downloader.p.rapidapi.com",
          },
          httpsAgent: agent,
          timeout: 20000,
        },
      );
      const d = res.data;
      if (d && d.links && d.links.length > 0) {
        const hd = d.links.find(
          (l) => l.quality === "hd" || l.quality === "HD",
        );
        if (hd) return hd.link;
        return d.links[0].link;
      }
      return null;
    },

    // --- API 3: yt-dlp via public wrapper (supports FB/TK/IG) ---
    async () => {
      const res = await axios.post(
        `https://ytdlp-api.up.railway.app/download`,
        { url, format: "mp4" },
        {
          headers: { "Content-Type": "application/json" },
          httpsAgent: agent,
          timeout: 25000,
        },
      );
      const d = res.data;
      if (d && d.url) return d.url;
      if (d && d.download_url) return d.download_url;
      return null;
    },

    // --- API 4: snapinsta style (FB/IG/TK) ---
    async () => {
      const res = await axios.get(`https://api.vevioz.com/@api/button/mp4`, {
        params: { url },
        headers: {
          "User-Agent": "Mozilla/5.0",
          Referer: "https://www.vevioz.com/",
        },
        httpsAgent: agent,
        timeout: 20000,
      });
      const d = res.data;
      if (d && typeof d === "string" && d.startsWith("http")) return d;
      if (d && d.url) return d.url;
      if (d && d.link) return d.link;
      return null;
    },

    // --- API 5: getmyfb (Facebook specific) ---
    async () => {
      const res = await axios.get(`https://getmyfb.com/api`, {
        params: { url },
        headers: { "User-Agent": "Mozilla/5.0" },
        httpsAgent: agent,
        timeout: 20000,
      });
      const d = res.data;
      if (d && d.hd_url) return d.hd_url;
      if (d && d.sd_url) return d.sd_url;
      if (d && d.url) return d.url;
      return null;
    },

    // --- API 6: tikwm (TikTok specific) ---
    async () => {
      const res = await axios.post(
        `https://www.tikwm.com/api/`,
        new URLSearchParams({ url, hd: "1" }),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          httpsAgent: agent,
          timeout: 20000,
        },
      );
      const d = res.data;
      if (d && d.data) {
        return d.data.hdplay || d.data.play || d.data.wmplay || null;
      }
      return null;
    },

    // --- API 7: giftedtech aiodownloader (last resort) ---
    async () => {
      const res = await axios.get(
        `https://api.giftedtech.my.id/api/download/aiodownloader`,
        {
          params: { url },
          httpsAgent: agent,
          timeout: 20000,
        },
      );
      const d = res.data;
      if (d && d.success && d.result) {
        return d.result.download_url || d.result.url || d.result.video || null;
      }
      return null;
    },
  ];

  let videoLink = null;

  for (const fetcher of apiFetchers) {
    try {
      videoLink = await fetcher();
      if (videoLink && videoLink.startsWith("http")) break;
    } catch (err) {
      console.error("Downloader API failed:", err.message);
    }
  }

  if (videoLink) {
    try {
      return await sock.sendMessage(
        from,
        {
          video: { url: videoLink },
          caption:
            "✅ සාර්ථකව ඩවුන්ලෝඩ් වුණා!\n\n🤖 _Chamath's Bot Assistant_\n© Powered by 🔰*Chamath N Dissanayake*",
        },
        { quoted: msg },
      );
    } catch (sendErr) {
      console.error("Video send failed:", sendErr.message);
      return await sock.sendMessage(from, {
        text: `📎 වීඩියෝ link එක:\n${videoLink}\n\n(Bot ට directly send කරන්න බැරි වුණා. ඉහත link එකෙන් ගන්න.)`,
      });
    }
  }

  return await sock.sendMessage(from, {
    text: "❌ සියලු servers fail වුණා. කරුණාකර:\n• Link එක නිවැරදිදැයි check කරන්න\n• ටික වෙලාවකට පස්සේ උත්සාහ කරන්න\n• Private/restricted videos download කරන්න බැහැ 🔒",
  });
}
connectToWhatsApp();
