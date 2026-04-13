const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();
const pool = require("../config/db");
const { sendNewUserNotificationToAdmin } = require("../config/email");

router.post("/inscription", async (req, res) => {
  const { nom, email, mot_de_passe, num_telephone, role } = req.body;

  // Validation
  if (!nom || !email || !mot_de_passe) {
    return res.status(400).json({ message: "Champs obligatoires manquants" });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ message: "Email invalide" });
  }
  if (mot_de_passe.length < 6) {
    return res.status(400).json({ message: "Mot de passe min. 6 caractères" });
  }
  if (num_telephone && !/^[0-9]{8}$/.test(num_telephone)) {
    return res.status(400).json({ message: "Téléphone doit contenir 8 chiffres" });
  }

  // Sécurité : empêcher l'auto-attribution du rôle ADMIN
  const rolesAutorisés = ["CHERCHEUR", "INVITE", "CADRE_TECHNIQUE"];
  const roleFinal = rolesAutorisés.includes(role) ? role : "INVITE";

  try {
    const userCheck = await pool.query(
      "SELECT id FROM utilisateur WHERE email = $1",
      [email]
    );
    if (userCheck.rows.length > 0) {
      return res.status(409).json({ message: "Cet email est déjà utilisé" });
    }

    const hashedPassword = await bcrypt.hash(mot_de_passe, 10);

    // actif = FALSE → compte bloqué jusqu'à validation admin
    await pool.query(
      `INSERT INTO utilisateur
       (nom, email, mot_de_passe, num_telephone, role, actif, email_confirme)
       VALUES ($1, $2, $3, $4, $5, FALSE, FALSE)`,
      [nom, email, hashedPassword, num_telephone || null, roleFinal]
    );

    // Notifier l'admin en arrière-plan (sans bloquer la réponse)
    pool.query("SELECT email FROM utilisateur WHERE role = 'ADMIN' LIMIT 1")
      .then(async (adminResult) => {
        if (adminResult.rows.length > 0) {
          await sendNewUserNotificationToAdmin(
            adminResult.rows[0].email,
            nom,
            email
          );
        }
      })
      .catch(err => console.error("⚠️ Notification admin non envoyée:", err.message));

    res.status(201).json({
      message: "Inscription réussie. Votre compte est en attente de validation par l'administrateur.",
    });

  } catch (error) {
    console.error("Erreur inscription:", error.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;