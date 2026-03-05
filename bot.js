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
        }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const senderNumber = msg.key.remoteJid;
        let text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        const prefixe = process.env.PREFIXE;
        if (prefixe && text.startsWith(prefixe)) {
            text = text.slice(prefixe.length).trim();
        } else if (prefixe) {
            // Ignore messages that don't start with prefix if a prefix is configured
            return;
        }

        if (text) {
            console.log(`Received message from ${senderNumber}: ${text}`);

            try {
                // Remove the @s.whatsapp.net for the webapi logic if needed, or keep it.
                // Assuming the webapi uses the full jid as user_id to ensure uniqueness.
                const response = await askChatbot(senderNumber, text);

                if (response && response.text) {
                    await sock.sendMessage(senderNumber, { text: response.text }, { quoted: msg });
                } else if (response && response.timeout) {
                    await sock.sendMessage(senderNumber, { text: "Délai d'attente dépassé ou aucune réponse de l'API." }, { quoted: msg });
                } else {
                    await sock.sendMessage(senderNumber, { text: "Erreur lors du traitement de votre message." }, { quoted: msg });
                }
            } catch (error) {
                console.error("Error processing message:", error);
                await sock.sendMessage(senderNumber, { text: "Une erreur interne s'est produite." }, { quoted: msg });
            }
        }
    });
}

module.exports = { startBot };
