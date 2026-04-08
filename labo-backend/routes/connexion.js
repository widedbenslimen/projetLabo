const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const router = express.Router();
const pool = require("../config/db");

const JWT_SECRET = process.env.JWT_SECRET;

// 🔐 LOGIN
router.post("/connexion", async (req, res) => {
  const { email, mot_de_passe } = req.body;

  if (!email || !mot_de_passe) {
    return res.status(400).json({
      message: "Email et mot de passe obligatoires"
    });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM utilisateur WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        message: "Email ou mot de passe incorrect"
      });
    }

    const utilisateur = result.rows[0];

    // 🔒 Vérifier si compte verrouillé
    if (utilisateur.compte_verrouille) {

      const now = new Date();
      const lockTime = new Date(utilisateur.date_verrouillage);

      const diffMinutes = (now - lockTime) / 60000;

      // ⏳ إذا مازال ما تعداش 30 دقيقة
      if (diffMinutes < 30) {
        return res.status(403).json({
          message: `Compte verrouillé. Réessayez après ${Math.ceil(30 - diffMinutes)} min`
        });
      }

      // 🔓 إذا تعدات 30 دقيقة → نحل الحساب
      await pool.query(
        `UPDATE utilisateur 
         SET compte_verrouille = FALSE,
             tentatives_login = 0,
             date_verrouillage = NULL
         WHERE id = $1`,
        [utilisateur.id]
      );
    }

    // ❌ Vérifier actif
    if (!utilisateur.actif) {
      return res.status(403).json({
        message: "Votre compte n'est pas encore validé"
      });
    }

    // 🔑 Vérifier mot de passe
    const isMatch = await bcrypt.compare(
      mot_de_passe,
      utilisateur.mot_de_passe
    );

    if (!isMatch) {
      const tentatives = utilisateur.tentatives_login + 1;
      const verrouille = tentatives >= 3;

      await pool.query(
        `UPDATE utilisateur 
         SET tentatives_login = $1,
             compte_verrouille = $2,
             date_verrouillage = CASE 
               WHEN $2 = TRUE THEN NOW() 
               ELSE date_verrouillage 
             END
         WHERE id = $3`,
        [tentatives, verrouille, utilisateur.id]
      );

      return res.status(400).json({
        message: verrouille
          ? "Compte verrouillé pour 30 minutes"
          : `Mot de passe incorrect (${tentatives}/3)`
      });
    }

    // ✅ Reset après succès
    await pool.query(
      `UPDATE utilisateur 
       SET tentatives_login = 0,
           compte_verrouille = FALSE,
           date_verrouillage = NULL
       WHERE id = $1`,
      [utilisateur.id]
    );

    // 🎟️ JWT
    const token = jwt.sign(
      {
        id: utilisateur.id,
        role: utilisateur.role
      },
      JWT_SECRET,
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
    res.status(500).json({
      message: "Erreur serveur"
    });
  }
});

module.exports = router;