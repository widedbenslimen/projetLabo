const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const router = express.Router();
const pool = require("../config/db");

router.post("/connexion", async (req, res) => {
  const { email, mot_de_passe } = req.body;

  if (!email || !mot_de_passe) {
    return res.status(400).json({
      message: "Email et mot de passe obligatoires"
    });
  }
  
  try {
    // Vérifier si utilisateur existe
    const user = await pool.query(
      "SELECT * FROM utilisateur WHERE email = $1",
      [email]
    );

    if (user.rows.length === 0) {
      return res.status(400).json({ message: "Email ou mot de passe incorrect" });
    }

    

    const utilisateur = user.rows[0];

    if (!user.rows[0].actif) {
      return res.status(403).json({
        message: "Votre compte n'est pas encore validé par l'administrateur"
      });
    }

    // Vérifier mot de passe
    const isMatch = await bcrypt.compare(
      mot_de_passe,
      utilisateur.mot_de_passe
    );

    if (!isMatch) {
      return res.status(400).json({ message: "Email ou mot de passe incorrect" });
    }

    // Générer JWT
    const token = jwt.sign(
      { id: utilisateur.id, role: utilisateur.role },
      process.env.JWT_SECRET || "secret123",
      { expiresIn: "1d" }
    );

    res.json({
      message: "Connexion réussie",
      token,
      utilisateur: {
        id: utilisateur.id,
        nom: utilisateur.nom,
        email: utilisateur.email,
        role: utilisateur.role,
      },
    
    });

  } catch (error) {
    console.error("Erreur connexion:", error.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;