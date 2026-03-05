require("dotenv").config();
const express = require("express");
const axios = require("axios");
const { startBot } = require("./bot");
const app = express();

const waiters = new Map();

app.get("/incoming", (req, res) => {
  const { user_id, text } = req.query;
  console.log(`\n📬 [WEBHOOK] Received for: ${user_id} | Text: ${text}`);

  if (!user_id || !text) return res.json({ status: 400 });

  const queue = waiters.get(user_id);
  if (queue && queue.length > 0) {
    console.log(`✅ Resolving waiter for ${user_id}`);
    const resolve = queue.shift();
    resolve(text);
    if (queue.length === 0) waiters.delete(user_id);
  } else {
    console.log(`❌ No waiter found for ${user_id}`);
  }

  res.json({ status: 200 });
});

async function askChatbot(user_id, text) {
  const cleanedId = user_id.replace(/[^0-9]/g, '');

  let queue = waiters.get(cleanedId);
  if (!queue) {
    queue = [];
    waiters.set(cleanedId, queue);
  }

  let resolveFunc;

  const responsePromise = new Promise(resolve => {
    resolveFunc = resolve;
    queue.push(resolve);

    setTimeout(() => {
      resolve(null); // Timeout resolves to null
    }, 15000);
  });

  try {
    await axios.get("https://c1877.webapi.ai/cmc/user_message", {
      params: { auth_token: process.env.AUTH_TOKEN, user_id: cleanedId, text }
    });

    console.log(`⏳ Waiting for AI response for ${cleanedId} (orig: ${user_id})...`);
    const reply = await responsePromise;

    if (reply) {
      console.log(`✨ AI responded for ${cleanedId}`);
    } else {
      console.log(`⏰ AI timeout for ${cleanedId}`);
    }

    // Cleanup queue
    const idx = queue.indexOf(resolveFunc);
    if (idx !== -1) queue.splice(idx, 1);
    if (queue.length === 0) waiters.delete(cleanedId);

    if (reply !== null) {
      return { text: reply };
    } else {
      return { text: null, timeout: true };
    }
  } catch (err) {
    const idx = queue.indexOf(resolveFunc);
    if (idx !== -1) queue.splice(idx, 1);
    if (queue.length === 0) waiters.delete(cleanedId);
    return { status: 500, error: err.message };
  }
}

app.get("/chatbot", async (req, res) => {
  const { user_id, text } = req.query;
  if (!user_id || !text) return res.json({ status: 400 });

  const result = await askChatbot(user_id, text);

  if (result.status === 500) {
    return res.json({ status: 500 });
  }

  res.json(result);
});

app.get("/", (_, res) => res.json({ status: "API online" }));

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log("API online on port " + PORT);
  // Start the WhatsApp bot after server starts
  startBot(askChatbot).catch(err => console.error("Error starting bot:", err));
});

setInterval(() => {
  console.log("Ping! Server alive at " + new Date().toLocaleTimeString());
}, 30000);
