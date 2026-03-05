const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const pino = require("pino");

async function startBot(askChatbot) {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
    const { version, isLatest } = await fetchLatestBaileysVersion();
    const usePairingCode = process.env.USE_PAIRING_CODE === "true";

    console.log(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: !usePairingCode,
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        syncFullHistory: false
    });

    if (usePairingCode && !sock.authState.creds.registered) {
        let phoneNumber = process.env.NUMERO_BOT;
        if (!phoneNumber) {
            console.error("NUMERO_BOT environment variable format needed to use pairing code. E.g., NUMERO_BOT=221000000000");
            process.exit(1);
        }
        phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(phoneNumber);
                console.log(`\n======================================`);
                console.log(`🌟 PAIRING CODE: ${code}`);
                console.log(`======================================\n`);
            } catch (err) {
                console.error("Failed to request pairing code:", err);
            }
        }, 3000);
    }

    let chatbotMode = "on"; // Global status: on, off, pm, gc

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)
                ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
                : true;
            console.log("connection closed due to", lastDisconnect.error, ", reconnecting", shouldReconnect);
            if (shouldReconnect) {
                setTimeout(() => startBot(askChatbot), 5000);
            }
        } else if (connection === "open") {
            console.log("WhatsApp bot is connected and ready to receive messages!");
            const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            await sock.sendMessage(botNumber, { text: `✅ *${process.env.NOM_BOT || 'Menma'}* est en ligne !\n\n_Auteur: Dr djibi_` });
        }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const senderNumber = msg.key.remoteJid;
        const isGroup = senderNumber.endsWith('@g.us');
        const author = isGroup ? (msg.key.participant || senderNumber) : senderNumber;
        const source = isGroup ? "GROUP" : "PRIVATE";
        let text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        console.log(`\n📩 [${source}] From: ${author.split('@')[0]} | Content: ${text}`);

        const prefixe = process.env.PREFIXE || "!";
        const isCommand = text.startsWith(prefixe);

        if (isCommand) {
            const args = text.slice(prefixe.length).trim().split(/ +/);
            const command = args.shift().toLowerCase();

            if (command === "ping") {
                const start = Date.now();
                await sock.sendMessage(senderNumber, { text: "Calcul de la latence..." }, { quoted: msg });
                const end = Date.now();
                return await sock.sendMessage(senderNumber, { text: `🏓 Pong ! Latence : *${end - start}ms*` }, { quoted: msg });
            }

            if (command === "menu") {
                const menuText = `🌟 *MENU ${process.env.NOM_BOT || 'Menma'}* 🌟\n\n` +
                    `- *${prefixe}ping* : Vérifie la latence.\n` +
                    `- *${prefixe}chatbot on* : Active l'IA partout.\n` +
                    `- *${prefixe}chatbot off* : Désactive l'IA partout.\n` +
                    `- *${prefixe}chatbot pm* : IA en privé uniquement.\n` +
                    `- *${prefixe}chatbot gc* : IA en groupes uniquement.\n\n` +
                    `_Current Mode: ${chatbotMode.toUpperCase()}_`;
                return await sock.sendMessage(senderNumber, { text: menuText }, { quoted: msg });
            }

            if (command === "chatbot") {
                const sub = args[0]?.toLowerCase();
                if (["on", "off", "pm", "gc"].includes(sub)) {
                    chatbotMode = sub;
                    return await sock.sendMessage(senderNumber, { text: `✅ Chatbot configuré sur : *${sub.toUpperCase()}*` }, { quoted: msg });
                }
                return await sock.sendMessage(senderNumber, { text: `Usage: ${prefixe}chatbot [on|off|pm|gc]` }, { quoted: msg });
            }
        }

        // Check if we should respond with AI
        let shouldRespond = false;
        if (chatbotMode === "on") shouldRespond = true;
        else if (chatbotMode === "pm" && !isGroup) shouldRespond = true;
        else if (chatbotMode === "gc" && isGroup) shouldRespond = true;

        if (shouldRespond && text) {
            console.log(`Sending to AI from ${senderNumber}: ${text}`);

            try {
                const response = await askChatbot(senderNumber, text);

                if (response && response.text) {
                    await sock.sendMessage(senderNumber, { text: response.text }, { quoted: msg });
                } else if (response && response.timeout) {
                    await sock.sendMessage(senderNumber, { text: "Délai d'attente dépassé ou aucune réponse de l'API." }, { quoted: msg });
                }
            } catch (error) {
                console.error("Error processing message:", error);
            }
        }
    });
}

module.exports = { startBot };
