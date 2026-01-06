const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// Utilisation des variables d'environnement (plus pro)
const PORT = process.env.PORT || 3000;
const WEBAPI_URL = "https://c1878.webapi.ai/cmc/user_message";
const AUTH_TOKEN = process.env.AUTH_TOKEN; 

app.post('/avatar-query', async (req, res) => {
    try {
        const { text, user_id } = req.body;

        const response = await axios.get(WEBAPI_URL, {
            params: {
                auth_token: AUTH_TOKEN,
                user_id: user_id,
                text: text 
            }
        });

        let aiResponse = response.data.text || response.data;

        // On nettoie les éventuels résidus de politesse "bot"
        aiResponse = aiResponse.replace(/comment puis-je t'aider ?/gi, "")
                               .replace(/en quoi puis-je vous aider ?/gi, "");

        res.json({ reply: aiResponse.trim() });
    } catch (error) {
        console.error("Erreur serveur:", error.message);
        res.status(500).json({ error: "Le cerveau de Menma est saturé." });
    }
});

app.listen(PORT, () => console.log(`Avatar Server actif sur le port ${PORT}`));
