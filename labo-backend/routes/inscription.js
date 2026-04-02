const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();
const pool = require("../config/db");

router.post("/inscription", async (req, res) => {
  const { nom, email, mot_de_passe, num_telephone, role } = req.body;

  try {
    // Vérifier email
    const userCheck = await pool.query(
      "SELECT * FROM utilisateur WHERE email = $1",
      [email]
    );

    if (userCheck.rows.length > 0) {
      return res.status(400).json({ message: "Email déjà utilisé" });
    }
    // Hash password
    const hashedPassword = await bcrypt.hash(mot_de_passe, 10);

    // Insert user
    await pool.query(
      `INSERT INTO utilisateur
       (nom, email, mot_de_passe, num_telephone, role, actif)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [nom, email, hashedPassword, num_telephone, role, false]
    );

    res.status(201).json({ message: "Inscription réussie" });

  } catch (error) {
    console.error("Erreur inscription:", error.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;