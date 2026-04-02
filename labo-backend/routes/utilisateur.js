const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

// 🔍 GET /api/utilisateur?email=xxx
router.get('/', auth, async (req, res) => {
  const { email } = req.query;

  try {
    if (email) {
      const result = await pool.query(
        `SELECT id, nom, email, role FROM utilisateur WHERE email = $1 AND actif = true`,
        [email.trim().toLowerCase()]
      );
      return res.json(result.rows);
    }

    const result = await pool.query(
      `SELECT id, nom, email, role FROM utilisateur WHERE actif = true ORDER BY nom`
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;