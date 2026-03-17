const express = require("express");
const axios = require("axios");
const app = express();

const waiters = new Map();

app.get("/incoming", (req, res) => {
  const { user_id, text } = req.query;
  if (!user_id || !text) return res.json({ status: 400 });

  const queue = waiters.get(user_id);
  if (queue && queue.length > 0) {
    const resolve = queue.shift();
    resolve(text);
    if (queue.length === 0) waiters.delete(user_id);
  }

  res.json({ status: 200 });
});

app.get("/chatbot", async (req, res) => {
  const { user_id, text } = req.query;
  if (!user_id || !text) return res.json({ status: 400 });

  let queue = waiters.get(user_id);
  if (!queue) {
    queue = [];
    waiters.set(user_id, queue);
  }

  let resolveFunc;
  let resSent = false;

  const responsePromise = new Promise(resolve => {
    resolveFunc = resolve;
    queue.push(resolve);

    setTimeout(() => {
      const idx = queue.indexOf(resolveFunc);
      if (idx !== -1) queue.splice(idx, 1);
      if (queue.length === 0) waiters.delete(user_id);
      if (!resSent) {
        resSent = true;
        res.json({ text: null, timeout: true });
      }
    }, 15000);
  });

  try {
    await axios.get("https://c1877.webapi.ai/cmc/user_message", {
      params: { auth_token: "otznwxdd", user_id, text }
    });

    const reply = await responsePromise;
    if (!resSent) {
      resSent = true;
      res.json({ text: reply });
    }

  } catch (err) {
    const idx = queue.indexOf(resolveFunc);
    if (idx !== -1) queue.splice(idx, 1);
    if (queue.length === 0) waiters.delete(user_id);
    if (!resSent) {
      resSent = true;
      res.json({ status: 500 });
    }
  }
});

app.get("/", (_, res) => res.json({ status: "API online" }));

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log("API online on port " + PORT));

setInterval(() => {
  console.log("Ping! Server alive at " + new Date().toLocaleTimeString());
}, 30000);