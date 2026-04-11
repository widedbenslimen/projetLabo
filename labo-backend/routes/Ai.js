const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");

router.post("/analyze", auth, async (req, res) => {
  console.log("🔑 Clé API Anthropic présente :", !!process.env.ANTHROPIC_API_KEY);
  
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("❌ ANTHROPIC_API_KEY non définie dans .env");
    return res.status(500).json({ error: "Configuration API manquante" });
  }

  try {
    const { model, max_tokens, system, messages } = req.body;
    
    if (!model || !messages) {
      return res.status(400).json({ error: "Paramètres manquants: model et messages requis" });
    }

    // Détection des types de contenu
    let hasImage = false;
    let hasPdf = false;
    
    if (messages && Array.isArray(messages)) {
      for (const msg of messages) {
        if (Array.isArray(msg.content)) {
          for (const c of msg.content) {
            if (c.type === "image") hasImage = true;
            if (c.type === "document" && c.source?.media_type === "application/pdf") hasPdf = true;
          }
        }
      }
    }

    const headers = {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    };

    const betaFlags = [];
    if (hasPdf) betaFlags.push("pdfs-2024-09-25");
    if (hasImage) betaFlags.push("visions-2023-10-16");
    
    if (betaFlags.length > 0) {
      headers["anthropic-beta"] = betaFlags.join(",");
    }

    console.log("📤 Envoi à Anthropic — Modèle:", model, "| Images:", hasImage, "| PDF:", hasPdf);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers,
      body: JSON.stringify({ 
        model, 
        max_tokens: max_tokens || 2000,
        system: system || "",
        messages,
        temperature: 0.2,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Erreur Anthropic:", JSON.stringify(data, null, 2));
      return res.status(response.status).json({
        error: data.error?.message || "Erreur API Anthropic",
        type: data.error?.type,
      });
    }

    console.log("✅ Réponse Anthropic reçue");
    res.json(data);

  } catch (err) {
    if (err.name === 'AbortError') {
      console.error("⏱️ Timeout de la requête IA");
      return res.status(504).json({ error: "L'analyse a pris trop de temps, veuillez réessayer" });
    }
    console.error("❌ Erreur proxy IA:", err);
    res.status(500).json({ error: "Erreur serveur proxy IA : " + err.message });
  }
});

module.exports = router;