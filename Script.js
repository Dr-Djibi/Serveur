const express = require('express');
const axios = require('axios');
require('dotenv').config(); 

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const WEBAPI_URL = process.env.WEBAPI_URL;
const AUTH_TOKEN = process.env.AUTH_TOKEN; 

app.post('/avatar-query', async (req, res) => {
    try {
        const { text, user_id } = req.body;

        // Validation de base
        if (!text) {
            return res.status(400).json({ error: "Le champ 'text' est requis." });
        }

        // Requête vers l'API externe (Correction du '³')
        const response = await axios.get(WEBAPI_URL, {
            params: {
                auth_token: AUTH_TOKEN,
                user_id: user_id,
                text: text 
            },
            timeout: 30000 // Timeout de 30 secondes pour éviter les attentes infinies
        });

        // Extraction sécurisée de la réponse
        let aiResponse = response.data.text || response.data;
        
        // On s'assure que c'est une chaîne avant de faire un .trim()
        const finalReply = typeof aiResponse === 'string' ? aiResponse.trim() : JSON.stringify(aiResponse);

        res.json({ reply: finalReply });

    } catch (error) {
        // Log détaillé pour le développeur
        console.error("Erreur Menma API:", error.response?.data || error.message);
        
        // Message propre pour l'utilisateur final
        res.status(500).json({ 
            error: "Le cerveau de Menma est saturé.",
            message: "Impossible de joindre l'API externe." 
        });
    }
});

app.listen(PORT, () => console.log(`✅ Avatar Server actif sur le port ${PORT}`));
