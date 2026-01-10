const fs = require("fs");
const pino = require("pino");
const path = require("path");
const config = require("./config");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  logger,
  delay,
  makeCacheableSignalKeyStore,
  jidDecode,
  getContentType,
  downloadContentFromMessage,
  makeInMemoryStore,
  fetchLatestBaileysVersion,
  DisconnectReason,
} = require("@whiskeysockets/baileys");

const PREFIXE = process.env.PREFIXE;
const NUMBER = process.env.NUMBER_OWNER;
const DEV = "Docteur Djibi";
const NAME = process.env.NAME_OWNER;
const msgStore = new Map();
const getMessage = (key) => store.get(key.id)?.message;

async function connectWhatsapp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const { version } = await fetchLastestBaileysVersion();

  const sock = makeWASocket({
      printQRInTerminal: true,
      auth: state,
      version: version,
      getMessage
  });

  sock.ev.process( async ( events ) => {
    if ( events['connection.update']) {
      const { connection , lastDisconnect } = events['connection.update'];
      if ( connection === 'close' ) {
        if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
          connectWhatsapp();
        } else {
          console.log('Deconnexion, S\'il vous plaît scanner le code QR pour reessayer')
        }
      } else if (connection === 'open') {
        console.log('Bot connecté avec succès')
      }
    }
    if (events['creds.update']) {
      await saveCreds
    }
    if (events['messages.upsert']) {
          const { messages } = events['messages.upsert'];
          messages.forEach(msg => handleCommand(sock, msg));
    }
  })
}

connectWhatsapp()